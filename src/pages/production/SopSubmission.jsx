import { useState } from 'react';
import { FileCheck2, Send, ClipboardCheck, Eye } from 'lucide-react';
import { useStore, requirementFor } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Button, Badge, Modal, Field, Mono, Table, EmptyState, inputCls, fmtNum, fmtDateTime, cx, useToast } from '../../components/ui';
import OrderFlow from '../../components/OrderFlow';
import OrderDetail from '../../components/OrderDetail';
import { SubmissionRowActions, OrderViewActions } from '../../components/rowActions';

export default function SopSubmission() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [sub, setSub] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({ actualYield: '', notes: '', steps: {}, lines: [] });

  const ready = state.orders.filter((o) => o.status === 'Production Verified');
  const submitted = state.orders.filter((o) => ['SOP Submitted', 'Stock Verified', 'Accepted'].includes(o.status));
  const sopOf = (o) => state.sops.find((s) => s.id === o.sopId);

  const open = (o) => {
    setSub(o);
    const lines = requirementFor(state, o).map((l) => ({ code: l.code, group: l.group, std: l.required, actual: l.required, checked: false }));
    setForm({
      actualYield: o.batches * (sopOf(o)?.batchSize || 0), notes: '', steps: {},
      batchNo: o.id, mfgDate: new Date().toISOString().slice(0, 10), lines,
    });
  };
  const sop = sub && sopOf(sub);
  const allSteps = sop && sop.steps.every((_, i) => form.steps[i]);
  const allChecked = form.lines?.every((l) => l.checked);
  const setLine = (i, patch) => setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const submit = () => {
    dispatch('SUBMIT_SOP', {
      orderId: sub.id, actualYield: form.actualYield, notes: form.notes, batchNo: form.batchNo, mfgDate: form.mfgDate,
      lines: form.lines.map((l) => ({ ...l, actual: Number(l.actual) || 0 })),
    });
    setSub(null);
    toast(`Batch sheet for ${sub.id} submitted for office acceptance`);
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
                <div className="flex items-center gap-2">
                  <Button variant="production" icon={Send} className="flex-1" onClick={() => open(o)}>Submit SOP</Button>
                  <OrderViewActions order={o} />
                </div>
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
            { key: 'a', label: 'Actions', align: 'right', render: (o) => <SubmissionRowActions order={o} /> },
          ]}
        />
      </Card>

      <Modal open={!!sub} onClose={() => setSub(null)} title={sub && `Batch sheet · ${sub.id}`} subtitle={sop && `${state.company?.name || ''} · ${sop.product} · ${sop.id} ${sop.version}`} width="max-w-4xl"
        footer={<><Button variant="ghost" onClick={() => setSub(null)}>Cancel</Button><Button variant="production" icon={Send} onClick={submit} disabled={!allSteps || !allChecked || !form.actualYield || !form.batchNo}>Submit for acceptance</Button></>}>
        {sop && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Product name"><input className={inputCls} value={sop.product} disabled /></Field>
              <Field label="Batch no *"><input className={inputCls} value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} /></Field>
              <Field label="Batch size"><input className={inputCls} value={`${fmtNum(sub.batches * sop.batchSize)} ${sop.unit}`} disabled /></Field>
              <Field label="MFG date"><input type="date" className={inputCls} value={form.mfgDate} onChange={(e) => setForm({ ...form, mfgDate: e.target.value })} /></Field>
            </div>

            {[['RM', 'Bill of raw material'], ['PM', `Packing material${sop.packSize ? ` for ${sop.packSize} pack` : ''}`]].map(([grp, label]) => {
              const rows = form.lines.map((l, i) => ({ ...l, i })).filter((l) => l.group === grp);
              if (!rows.length) return null;
              return (
                <div key={grp} className="mt-5">
                  <div className="mb-2 text-[0.78rem] font-bold uppercase tracking-wider text-prod-500">{label}</div>
                  <div className="overflow-x-auto rounded-lg border border-line dark:border-white/[0.07]">
                    <table className="w-full min-w-[40rem] text-sm">
                      <thead>
                        <tr className="bg-prod-50/70 text-left text-[0.75rem] font-semibold text-slate-700 dark:bg-white/[0.03] dark:text-slate-300">
                          <th className="w-14 px-3 py-2">Sr No</th><th className="px-3 py-2">{grp === 'RM' ? 'Ingredient' : 'Material'}</th>
                          <th className="px-3 py-2 text-right">Std qty</th><th className="w-36 px-3 py-2">Actual qty</th><th className="w-24 px-3 py-2 text-center">Check list</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((l, k) => {
                          const m = state.materials.find((x) => x.code === l.code);
                          const diff = Number(l.actual) - l.std;
                          return (
                            <tr key={l.i} className={cx('border-t border-line dark:border-white/[0.05]', l.checked && 'bg-emerald-50/50 dark:bg-emerald-500/5')}>
                              <td className="px-3 py-2 text-slate-400">{k + 1}</td>
                              <td className="px-3 py-2 font-medium">{m?.name ?? l.code}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-right tabular">{fmtNum(l.std)} <span className="text-xs text-slate-400">{m?.unit}</span></td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" step="any" className={cx(inputCls, 'h-9', Math.abs(diff) > 0.0001 && 'border-orange-400')} value={l.actual}
                                  onChange={(e) => setLine(l.i, { actual: e.target.value })} aria-label={`Actual quantity for ${m?.name}`} />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input type="checkbox" className="h-4 w-4 accent-[#2e37a4]" checked={l.checked} onChange={(e) => setLine(l.i, { checked: e.target.checked })} aria-label={`Checked ${m?.name}`} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="soft" onClick={() => setForm({ ...form, lines: form.lines.map((l) => ({ ...l, checked: true })) })}>Tick all lines</Button>
            </div>

            <div className="mb-2 mt-5 text-[0.78rem] font-bold uppercase tracking-wider text-prod-500">Process steps completed</div>
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
