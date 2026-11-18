import { useState } from 'react';
import { ScanSearch, ShieldCheck, Eye } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Button, Badge, Modal, Field, Mono, Table, EmptyState, inputCls, fmtNum, fmtDateTime, cx, useToast, SelectAll } from '../../components/ui';
import RequestItems from '../../components/RequestItems';
import OrderDetail from '../../components/OrderDetail';
import { StockCheckRowActions } from '../../components/rowActions';

const CHECKS = [
  'Issued quantity matches SOP consumption',
  'No excess raw material left on the shop floor',
  'Empty containers returned and labelled',
  'Batch record and yield entered correctly',
];

export default function StockVerification() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [cur, setCur] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({ by: 'Stock Person', remarks: '', checks: {} });

  const queue = state.orders.filter((o) => o.status === 'SOP Submitted');
  const done = state.orders.filter((o) => o.stockCheck);
  const sopOf = (o) => state.sops.find((s) => s.id === o.sopId);
  const reqOf = (o) => state.requests.find((r) => r.id === o.pullOutReqId);
  const all = CHECKS.every((_, i) => form.checks[i]);

  const confirm = () => {
    dispatch('STOCK_VERIFY', { orderId: cur.id, by: form.by, remarks: form.remarks, checks: CHECKS });
    toast(`${cur.id} verified by stock person`);
    setCur(null);
  };

  return (
    <>
      <PageHeader module="inventory" icon={ScanSearch} title="Stock Person Verification" subtitle="Physically check consumption against the submitted SOP before it goes to the office." />

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Awaiting stock check · {queue.length}</h2>
      {queue.length === 0 ? (
        <Card className="mb-8"><EmptyState icon={ScanSearch} title="Queue is empty" text="SOPs submitted by Production will appear here." /></Card>
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {queue.map((o) => (
            <Card key={o.id} className="flex flex-col p-5">
              <div className="flex items-center justify-between"><Mono>{o.id}</Mono><Badge status={o.status} /></div>
              <div className="mt-2 text-lg font-bold">{sopOf(o)?.product}</div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-white/[0.03]"><div className="text-[0.6562rem] uppercase tracking-wider text-slate-400">Planned</div><b className="tabular">{fmtNum(o.batches * sopOf(o)?.batchSize)} {sopOf(o)?.unit}</b></div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-white/[0.03]"><div className="text-[0.6562rem] uppercase tracking-wider text-slate-400">Actual</div><b className="tabular">{fmtNum(o.submission?.actualYield)} {sopOf(o)?.unit}</b></div>
              </div>
              {reqOf(o) && <div className="mt-3"><RequestItems items={reqOf(o).items} /></div>}
              <div className="mt-auto flex gap-2 pt-4">
                <Button variant="ghost" icon={Eye} onClick={() => setViewing(o.id)}>Details</Button>
                <Button variant="inventory" icon={ShieldCheck} className="flex-1" onClick={() => { setCur(o); setForm({ by: 'Stock Person', remarks: '', checks: {} }); }}>Verify</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="Verification log" icon={ShieldCheck} tone="inventory" />
        <Table
          rows={done}
          empty={{ title: 'No verifications yet' }}
          columns={[
            { key: 'id', label: 'Order', render: (o) => <Mono>{o.id}</Mono> },
            { key: 'p', label: 'Product', render: (o) => sopOf(o)?.product },
            { key: 'b', label: 'Checked by', render: (o) => o.stockCheck.by },
            { key: 'r', label: 'Remarks', render: (o) => <span className="text-slate-500">{o.stockCheck.remarks || '—'}</span> },
            { key: 't', label: 'When', render: (o) => <span className="whitespace-nowrap text-slate-500">{fmtDateTime(o.stockCheck.t)}</span> },
            { key: 's', label: 'Status', render: (o) => <Badge status={o.status} /> },
            { key: 'act', label: 'Actions', align: 'right', render: (o) => <StockCheckRowActions order={o} /> },
          ]}
        />
      </Card>

      <Modal open={!!cur} onClose={() => setCur(null)} title={cur && `Stock check · ${cur.id}`} subtitle={cur ? `${sopOf(cur)?.product || ''} · every point must be confirmed.` : ''}
        footer={<><Button variant="ghost" onClick={() => setCur(null)}>Cancel</Button><Button variant="inventory" icon={ShieldCheck} disabled={!all || !form.by} onClick={confirm}>Mark verified</Button></>}>
        <div className="space-y-2">
          {/* Product being checked (from the order's SOP) */}
          {cur && (
            <div className="mb-2 grid gap-3 rounded-lg bg-prod-50/70 p-3 text-sm sm:grid-cols-3 dark:bg-white/[0.04]">
              <div className="sm:col-span-3">
                <div className="text-[0.6562rem] font-semibold uppercase tracking-wider text-slate-400">Product</div>
                <div className="text-base font-bold">{sopOf(cur)?.product || '—'}</div>
                <div className="text-xs text-slate-500">{cur.sopId} · {sopOf(cur)?.version}{cur.submission?.batchNo ? ` · Batch ${cur.submission.batchNo}` : ''}</div>
              </div>
              <div><div className="text-[0.6562rem] uppercase tracking-wider text-slate-400">Planned</div><b className="tabular">{fmtNum(cur.batches * (sopOf(cur)?.batchSize || 0))} {sopOf(cur)?.unit}</b></div>
              <div><div className="text-[0.6562rem] uppercase tracking-wider text-slate-400">Actual yield</div><b className="tabular">{fmtNum(cur.submission?.actualYield)} {sopOf(cur)?.unit}</b></div>
              <div><div className="text-[0.6562rem] uppercase tracking-wider text-slate-400">Pull out</div><b>{reqOf(cur)?.id || '—'}</b></div>
            </div>
          )}
          <div className="flex justify-end">
            <SelectAll total={CHECKS.length} done={CHECKS.filter((_, i) => form.checks[i]).length}
              onChange={(v) => setForm({ ...form, checks: Object.fromEntries(CHECKS.map((_, i) => [i, v])) })} />
          </div>
          {CHECKS.map((c, i) => (
            <label key={c} className={cx('flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition', form.checks[i] ? 'border-inv-500/40 bg-inv-50 dark:bg-inv-500/10' : 'border-slate-200 dark:border-white/10')}>
              <input type="checkbox" className="h-4 w-4 accent-[#2e37a4]" checked={!!form.checks[i]} onChange={(e) => setForm({ ...form, checks: { ...form.checks, [i]: e.target.checked } })} />
              {c}
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Stock person"><input className={inputCls} value={form.by} onChange={(e) => setForm({ ...form, by: e.target.value })} /></Field>
          <Field label="Remarks"><input className={inputCls} value={form.remarks} placeholder="Optional" onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field>
        </div>
      </Modal>

      {viewing && <OrderDetail orderId={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
