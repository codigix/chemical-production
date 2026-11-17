import { useState } from 'react';
import { PackageMinus, CheckCircle2, AlertTriangle, MapPin, Truck } from 'lucide-react';
import { useStore, available } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Button, Badge, Modal, Field, Mono, Table, EmptyState, Meter, inputCls, fmtNum, fmtDateTime, cx, useToast } from '../../components/ui';
import RequestItems from '../../components/RequestItems';
import { RequestRowActions, IssueRowActions } from '../../components/rowActions';

export default function RawMaterialPullOut() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [issue, setIssue] = useState(null);
  const [by, setBy] = useState('Stores In-charge');
  const pending = state.requests.filter((r) => r.type === 'PULL_OUT' && r.status === 'Pending');
  const issued = state.requests.filter((r) => r.type === 'PULL_OUT' && r.status !== 'Pending');
  const mat = (c) => state.materials.find((m) => m.code === c);
  const product = (orderId) => state.sops.find((s) => s.id === state.orders.find((o) => o.id === orderId)?.sopId)?.product;
  const ok = (r) => r.items.every((it) => available(mat(it.code)) >= it.qty);

  const confirm = () => {
    dispatch('ISSUE_PULL_OUT', { reqId: issue.id, issuedBy: by });
    toast(`Material issued for ${issue.orderId}`);
    setIssue(null);
  };

  return (
    <>
      <PageHeader module="inventory" icon={PackageMinus} title="Raw Material Pull Out" subtitle="Pick and issue raw material to the shop floor. Stock is reserved now and posted out on office acceptance." />

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">To issue · {pending.length}</h2>
      {pending.length === 0 ? (
        <Card className="mb-8"><EmptyState icon={Truck} title="No pull out requests" text="Requests appear when Production confirms all materials are available." /></Card>
      ) : (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          {pending.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-white/[0.06]">
                <div>
                  <div className="flex items-center gap-2"><Mono>{r.id}</Mono><span className="text-slate-300">·</span><Mono className="text-prod-600">{r.orderId}</Mono></div>
                  <div className="mt-1 font-semibold">{product(r.orderId)}</div>
                  <div className="text-xs text-slate-500">Requested {fmtDateTime(r.createdAt)}</div>
                </div>
                {ok(r) ? <Badge status="Ready">Stock OK</Badge> : <Badge status="Shortage">Short</Badge>}
              </div>
              <div className="space-y-3 p-5">
                {r.items.map((it) => {
                  const m = mat(it.code);
                  const av = available(m);
                  return (
                    <div key={it.code}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{m.name} <span className="ml-1 inline-flex items-center gap-0.5 text-[0.6875rem] font-normal text-slate-400"><MapPin size={11} />{m.location}</span></span>
                        <span className="tabular"><b>{fmtNum(it.qty)}</b> <span className="text-xs text-slate-400">/ {fmtNum(av)} {m.unit}</span></span>
                      </div>
                      <Meter value={av} max={it.qty} />
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-slate-100 p-4 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Button variant="inventory" icon={PackageMinus} className="flex-1" disabled={!ok(r)} onClick={() => setIssue(r)}>Issue material</Button>
                  <RequestRowActions req={r} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="Issued history" subtitle="Pull outs already handed to Production" icon={CheckCircle2} tone="inventory" />
        <Table
          rows={issued}
          empty={{ title: 'Nothing issued yet' }}
          columns={[
            { key: 'id', label: 'Request', render: (r) => <Mono>{r.id}</Mono> },
            { key: 'o', label: 'Order', render: (r) => <Mono className="text-prod-600">{r.orderId}</Mono> },
            { key: 'i', label: 'Materials', render: (r) => <RequestItems items={r.items} max={3} /> },
            { key: 'b', label: 'Issued by', render: (r) => r.issuedBy },
            { key: 't', label: 'Issued', render: (r) => <span className="whitespace-nowrap text-slate-500">{fmtDateTime(r.issuedAt)}</span> },
            { key: 's', label: 'Status', render: (r) => <Badge status={r.status} /> },
            { key: 'act', label: 'Actions', align: 'right', render: (r) => <IssueRowActions req={r} /> },
          ]}
        />
      </Card>

      <Modal open={!!issue} onClose={() => setIssue(null)} title="Issue raw material" subtitle={issue && `${issue.id} for ${issue.orderId}`}
        footer={<><Button variant="ghost" onClick={() => setIssue(null)}>Cancel</Button><Button variant="inventory" icon={CheckCircle2} onClick={confirm}>Confirm issue</Button></>}>
        {issue && (
          <>
            <div className="mb-4 flex gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              Quantities will be reserved against this order. The stock ledger is posted when the office accepts the SOP.
            </div>
            <div className="space-y-1.5">
              {issue.items.map((it) => (
                <div key={it.code} className={cx('flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-white/[0.03]')}>
                  <span>{mat(it.code)?.name}</span><b className="tabular">{fmtNum(it.qty)} {mat(it.code)?.unit}</b>
                </div>
              ))}
            </div>
            <Field label="Issued by" className="mt-4"><input className={inputCls} value={by} onChange={(e) => setBy(e.target.value)} /></Field>
          </>
        )}
      </Modal>
    </>
  );
}
