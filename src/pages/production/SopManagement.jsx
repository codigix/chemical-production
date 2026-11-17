import { useState } from 'react';
import { BookOpenCheck, Plus, Clock, Layers, Trash2, FlaskRound } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Card, PageHeader, Button, Modal, Field, Mono, inputCls, fmtNum, useToast } from '../../components/ui';

const blank = { product: '', version: 'v1.0', batchSize: 500, unit: 'kg', duration: '4 h', materials: [{ code: '', qty: 0 }], steps: [''] };

export default function SopManagement() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const mat = (code) => state.materials.find((m) => m.code === code);
  const usedBy = (id) => state.orders.filter((o) => o.sopId === id).length;

  const save = () => {
    const sop = {
      ...f,
      batchSize: Number(f.batchSize),
      materials: f.materials.filter((m) => m.code && Number(m.qty) > 0).map((m) => ({ code: m.code, qty: Number(m.qty) })),
      steps: f.steps.filter(Boolean),
    };
    dispatch('CREATE_SOP', { sop });
    setOpen(false);
    setF(blank);
    toast('SOP added');
  };
  const valid = f.product && f.materials.some((m) => m.code && Number(m.qty) > 0);

  return (
    <>
      <PageHeader module="production" icon={BookOpenCheck} title="SOP Management" subtitle="Standard operating procedures with the bill of raw materials per batch."
        actions={<Button variant="production" icon={Plus} onClick={() => setOpen(true)}>New SOP</Button>} />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {state.sops.map((s) => (
          <Card key={s.id} className="group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-prod-500/30 hover:shadow-lg">
            <div className="relative overflow-hidden border-b border-prod-100 bg-gradient-to-br from-prod-50 to-white p-5 dark:border-white/[0.07] dark:from-prod-500/15 dark:to-transparent">
              <FlaskRound size={90} className="absolute -bottom-5 -right-3 text-prod-500 opacity-[0.08]" />
              <div className="flex items-center justify-between">
                <Mono className="rounded-md bg-white px-2 py-0.5 text-prod-500 ring-1 ring-prod-100 dark:bg-white/10 dark:ring-0">{s.id}</Mono>
                <span className="rounded-full bg-prod-500 px-2 py-0.5 text-[0.6875rem] font-semibold text-white">{s.version}</span>
              </div>
              <h3 className="mt-3 text-lg font-bold leading-snug text-slate-900 dark:text-white">{s.product}</h3>
              <div className="mt-3 flex gap-4 text-xs font-medium text-prod-500">
                <span className="flex items-center gap-1"><Layers size={13} />{fmtNum(s.batchSize)} {s.unit} / batch</span>
                <span className="flex items-center gap-1"><Clock size={13} />{s.duration}</span>
              </div>
            </div>
            <div className="flex-1 p-5">
              <div className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">Raw materials / batch</div>
              <div className="space-y-1.5">
                {s.materials.map((m) => (
                  <div key={m.code} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-white/[0.03]">
                    <span className="truncate">{mat(m.code)?.name}</span>
                    <span className="tabular shrink-0 font-semibold">{fmtNum(m.qty)} {mat(m.code)?.unit}</span>
                  </div>
                ))}
              </div>
              <div className="mb-2 mt-5 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">Process steps</div>
              <ol className="space-y-2">
                {s.steps.map((st, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-prod-500 text-[0.625rem] font-bold text-white">{i + 1}</span>{st}
                  </li>
                ))}
              </ol>
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-white/[0.06]">Used in {usedBy(s.id)} production order{usedBy(s.id) === 1 ? '' : 's'}</div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New SOP" subtitle="Saved to the JSON store." width="max-w-2xl"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="production" onClick={save} disabled={!valid}>Save SOP</Button></>}>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Product name" className="sm:col-span-3"><input className={inputCls} value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} placeholder="e.g. Ferric Chloride 40%" /></Field>
          <Field label="Version"><input className={inputCls} value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} /></Field>
          <Field label="Batch size"><input type="number" className={inputCls} value={f.batchSize} onChange={(e) => setF({ ...f, batchSize: e.target.value })} /></Field>
          <Field label="Unit"><select className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}><option>kg</option><option>L</option></select></Field>
          <Field label="Duration" className="sm:col-span-2"><input className={inputCls} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></Field>
        </div>

        <div className="mt-5 text-xs font-semibold text-slate-600 dark:text-slate-300">Raw materials per batch</div>
        <div className="mt-2 space-y-2">
          {f.materials.map((m, i) => (
            <div key={i} className="flex gap-2">
              <select className={inputCls} value={m.code} onChange={(e) => setF({ ...f, materials: f.materials.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)) })}>
                <option value="">Select material</option>
                {state.materials.map((rm) => <option key={rm.code} value={rm.code}>{rm.code} · {rm.name}</option>)}
              </select>
              <input type="number" className={`${inputCls} w-32`} value={m.qty} onChange={(e) => setF({ ...f, materials: f.materials.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) })} />
              <button className="rounded-lg px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500" onClick={() => setF({ ...f, materials: f.materials.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button size="sm" variant="soft" icon={Plus} onClick={() => setF({ ...f, materials: [...f.materials, { code: '', qty: 0 }] })}>Add material</Button>
        </div>

        <div className="mt-5 text-xs font-semibold text-slate-600 dark:text-slate-300">Process steps</div>
        <div className="mt-2 space-y-2">
          {f.steps.map((st, i) => (
            <input key={i} className={inputCls} placeholder={`Step ${i + 1}`} value={st} onChange={(e) => setF({ ...f, steps: f.steps.map((x, j) => (j === i ? e.target.value : x)) })} />
          ))}
          <Button size="sm" variant="soft" icon={Plus} onClick={() => setF({ ...f, steps: [...f.steps, ''] })}>Add step</Button>
        </div>
      </Modal>
    </>
  );
}
