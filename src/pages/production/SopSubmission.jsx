import { useState } from 'react';
import { FileCheck2, Send, ClipboardCheck, Eye } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Button, Badge, Modal, Field, Mono, Table, EmptyState, inputCls, fmtNum, fmtDateTime, cx, useToast } from '../../components/ui';
import OrderFlow from '../../components/OrderFlow';
import OrderDetail from '../../components/OrderDetail';

export default function SopSubmission() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [sub, setSub] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({ actualYield: '', notes: '', steps: {} });

  const ready = state.orders.filter((o) => o.status === 'Production Verified');
  const submitted = state.orders.filter((o) => ['SOP Submitted', 'Stock Verified', 'Accepted'].includes(o.status));
  const sopOf = (o) => state.sops.find((s) => s.id === o.sopId);

  const open = (o) => { setSub(o); setForm({ actualYield: o.batches * (sopOf(o)?.batchSize || 0), notes: '', steps: {} }); };
  const sop = sub && sopOf(sub);
  const allSteps = sop && sop.steps.every((_, i) => form.steps[i]);
  const submit = () => {
    dispatch('SUBMIT_SOP', { orderId: sub.id, actualYield: form.actualYield, notes: form.notes });
    setSub(null);
    toast(`SOP for ${sub.id} submitted for office acceptance`);
  };

  return (
    <>
      <PageHeader module="production" icon={FileCheck2} title="SOP Submission" subtitle="Record batch completion and send the SOP to Inventory and Office for acceptance." />

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Ready to submit · {ready.length}</h2>
      {ready.length === 0 ? (
        <Card className="mb-8"><EmptyState icon={ClipboardCheck} title="No SOPs ready" text="Orders appear here after Production verifies the issued material." /></Card>
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ready.map((o) => (
            <Card key={o.id} className="overflow-hidden">
              <div className="h-1 bg-prod-500" />
              <div className="p-5">
                <div className="flex items-center justify-between"><Mono>{o.id}</Mono><Badge status={o.priority} /></div>
                <div className="mt-2 text-lg font-bold leading-snug">{sopOf(o)?.product}</div>
                <div className="text-sm text-slate-500">{o.sopId} {sopOf(o)?.version} · planned {fmtNum(o.batches * sopOf(o)?.batchSize)} {sopOf(o)?.unit}</div>
                <div className="my-4"><OrderFlow status={o.status} compact /></div>
                <Button variant="production" icon={Send} className="w-full" onClick={() => open(o)}>Submit SOP</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="Submitted SOPs" subtitle="Downstream status in Inventory and Office" icon={Send} />
        <Table
          rows={submitted}
          empty={{ icon: FileCheck2, title: 'No submissions yet' }}
          columns={[
            { key: 'id', label: 'Order', render: (o) => <Mono>{o.id}</Mono> },
            { key: 'p', label: 'Product', render: (o) => sopOf(o)?.product },
            { key: 'y', label: 'Actual yield', align: 'right', render: (o) => `${fmtNum(o.submission?.actualYield)} ${sopOf(o)?.unit}` },
            { key: 't', label: 'Submitted', render: (o) => fmtDateTime(o.submission?.t) },
            { key: 's', label: 'Status', render: (o) => <Badge status={o.status} /> },
            { key: 'a', label: '', align: 'right', render: (o) => <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewing(o.id)}>View</Button> },
          ]}
        />
      </Card>

      <Modal open={!!sub} onClose={() => setSub(null)} title={sub && `Submit SOP · ${sub.id}`} subtitle={sop && `${sop.product} · ${sop.id} ${sop.version}`} width="max-w-xl"
        footer={<><Button variant="ghost" onClick={() => setSub(null)}>Cancel</Button><Button variant="production" icon={Send} onClick={submit} disabled={!allSteps || !form.actualYield}>Submit for acceptance</Button></>}>
        {sop && (
          <>
            <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Confirm each process step was completed</div>
            <div className="space-y-2">
              {sop.steps.map((st, i) => (
                <label key={i} className={cx('flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition', form.steps[i] ? 'border-prod-500/40 bg-prod-50 dark:bg-prod-500/10' : 'border-slate-200 dark:border-white/10')}>
                  <input type="checkbox" className="h-4 w-4 accent-[#2e37a4]" checked={!!form.steps[i]} onChange={(e) => setForm({ ...form, steps: { ...form.steps, [i]: e.target.checked } })} />
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[0.625rem] font-bold text-prod-700 dark:bg-white/10 dark:text-prod-100">{i + 1}</span>{st}
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={`Actual yield (${sop.unit})`} hint={`Planned ${fmtNum(sub.batches * sop.batchSize)} ${sop.unit}`}>
                <input type="number" className={inputCls} value={form.actualYield} onChange={(e) => setForm({ ...form, actualYield: e.target.value })} />
              </Field>
              <Field label="Batch notes"><input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></Field>
            </div>
          </>
        )}
      </Modal>

      {viewing && <OrderDetail orderId={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
