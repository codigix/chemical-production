import { useState } from 'react';
import { PackageOpen, PackageCheck, Hourglass, CheckCircle2, Truck, Factory } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Card, CardHeader, Table, PageHeader, Button, Badge, Modal, Field, Mono, EmptyState, inputCls, fmtNum, fmtDateTime, cx, useToast, SelectAll } from '../../components/ui';
import RequestItems from '../../components/RequestItems';
import { navigate } from '../../router';
import { RequestRowActions } from '../../components/rowActions';

const TABS = [
  { key: 'Issued', label: 'Issued · verify now', icon: PackageCheck },
  { key: 'Pending', label: 'Waiting for Inventory', icon: Hourglass },
  { key: 'done', label: 'Verified', icon: CheckCircle2 },
];

export default function PullOutRequest() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const pulls = state.requests.filter((r) => r.type === 'PULL_OUT');
  const [tab, setTab] = useState(pulls.some((r) => r.status === 'Issued') ? 'Issued' : 'Pending');
  const [verify, setVerify] = useState(null);
  const [checks, setChecks] = useState({});
  const [note, setNote] = useState('');
  const [by, setBy] = useState('Production Supervisor');

  const list = pulls.filter((r) => (tab === 'done' ? ['Received by Production', 'Closed'].includes(r.status) : r.status === tab));
  const mat = (c) => state.materials.find((m) => m.code === c);
  const product = (orderId) => {
    const o = state.orders.find((x) => x.id === orderId);
    return state.sops.find((s) => s.id === o?.sopId)?.product;
  };

  const openVerify = (r) => { setVerify(r); setChecks({}); setNote(''); };
  const allChecked = verify && verify.items.every((it) => checks[it.code]);
  const confirm = () => {
    dispatch('VERIFY_ISSUED', { orderId: verify.orderId, note, by });
    setVerify(null);
    toast(`Issued material verified for ${verify.orderId}`);
  };

  return (
    <>
      <PageHeader module="production" icon={PackageOpen} title="Material Pull Out Request" subtitle="Track pull out requests and verify the material Inventory has issued to the shop floor."
        actions={<Button variant="ghost" icon={PackageOpen} onClick={() => navigate('production/rm-stock')}>New request from RM check</Button>} />

      {/* Stock in production: material issued from the store and held on the shop floor (until office acceptance posts the ledger OUT) */}
      {(() => {
        const held = pulls.filter((r) => ['Issued', 'Received by Production'].includes(r.status));
        const byMat = {};
        held.forEach((r) => r.items.forEach((it) => {
          const row = byMat[it.code] || (byMat[it.code] = { code: it.code, qty: 0, orders: [], pending: 0 });
          row.qty = Math.round((row.qty + it.qty) * 1000) / 1000;
          row.orders.push(r.orderId);
          if (r.status === 'Issued') row.pending = Math.round((row.pending + it.qty) * 1000) / 1000;
        }));
        const rows = Object.values(byMat);
        return (
          <Card className="mb-6">
            <CardHeader title="Stock in production" subtitle="Material moved Store → Production on issue · stock OUT posted in Stock Movement at issue" icon={Factory} tone="production" />
            <Table
              rows={rows}
              rowKey={(x) => x.code}
              empty={{ icon: Factory, title: 'No material in production', text: 'Material appears here once Inventory issues a pull out request.' }}
              columns={[
                { key: 'm', label: 'Material', render: (x) => <div><div className="font-medium">{mat(x.code)?.name}</div><div className="text-[0.6875rem] text-slate-400">{x.code}</div></div> },
                { key: 'o', label: 'Orders', render: (x) => <div className="flex flex-wrap gap-1">{[...new Set(x.orders)].map((o) => <Mono key={o} className="text-prod-600">{o}</Mono>)}</div> },
                { key: 'in', label: 'Received from store', align: 'right', render: (x) => <span className="tabular font-semibold text-emerald-600">+{fmtNum(x.qty)} <span className="text-xs font-normal text-slate-400">{mat(x.code)?.unit}</span></span> },
                { key: 's', label: 'Status', render: (x) => x.pending > 0
                  ? <span className="text-xs font-semibold text-amber-600">{fmtNum(x.pending)} {mat(x.code)?.unit} to verify</span>
                  : <span className="text-xs font-semibold text-emerald-600">✓ Verified on floor</span> },
              ]}
            />
          </Card>
        );
      })()}

      <div className="mb-5 inline-flex flex-wrap rounded-lg border border-line bg-white p-1 dark:border-white/[0.07] dark:bg-ink-900">
        {TABS.map((t) => {
          const n = pulls.filter((r) => (t.key === 'done' ? ['Received by Production', 'Closed'].includes(r.status) : r.status === t.key)).length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cx('flex items-center gap-2 rounded-md px-4 py-2 text-[0.8125rem] font-semibold transition',
                tab === t.key ? 'bg-prod-500 text-white' : 'text-slate-500 hover:text-prod-500 dark:hover:text-white')}>
              <t.icon size={15} />{t.label}<span className={cx('rounded-md px-1.5 text-[0.6875rem]', tab === t.key ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/[0.06]')}>{n}</span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <Card><EmptyState icon={Truck} title="Nothing in this list" text={tab === 'Pending' ? 'Request material from the RM Stock Availability screen.' : 'Requests will show here as Inventory issues material.'} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><Mono>{r.id}</Mono><span className="text-slate-300">→</span><Mono className="text-prod-600">{r.orderId}</Mono></div>
                  <div className="mt-1 font-semibold">{product(r.orderId)}</div>
                </div>
                <Badge status={r.status} />
              </div>
              <div className="mt-4"><RequestItems items={r.items} max={6} /></div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-white/[0.06]">
                <span>Requested {fmtDateTime(r.createdAt)}{r.issuedBy && <> · issued by <b className="text-slate-700 dark:text-slate-200">{r.issuedBy}</b></>}</span>
                <div className="flex items-center gap-2">
                  {r.status === 'Issued' && <Button size="sm" variant="production" icon={PackageCheck} onClick={() => openVerify(r)}>Verify issued material</Button>}
                  <RequestRowActions req={r} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!verify} onClose={() => setVerify(null)} title="Verify issued material" subtitle={verify && `${verify.id} for ${verify.orderId}. Tick each line once it is physically checked.`}
        footer={<><Button variant="ghost" onClick={() => setVerify(null)}>Cancel</Button><Button variant="production" icon={CheckCircle2} disabled={!allChecked} onClick={confirm}>Confirm verification</Button></>}>
        {verify && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <SelectAll total={verify.items.length} done={verify.items.filter((it) => checks[it.code]).length}
                onChange={(v) => setChecks(Object.fromEntries(verify.items.map((it) => [it.code, v])))} />
            </div>
            {verify.items.map((it) => (
              <label key={it.code} className={cx('flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition', checks[it.code] ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-white/10')}>
                <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={!!checks[it.code]} onChange={(e) => setChecks({ ...checks, [it.code]: e.target.checked })} />
                <span className="flex-1 text-sm font-medium">{mat(it.code)?.name}</span>
                <span className="tabular text-sm font-semibold">{fmtNum(it.qty)} {mat(it.code)?.unit}</span>
              </label>
            ))}
            <div className="grid gap-3 pt-3 sm:grid-cols-2">
              <Field label="Verified by"><input className={inputCls} value={by} onChange={(e) => setBy(e.target.value)} /></Field>
              <Field label="Remarks"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
