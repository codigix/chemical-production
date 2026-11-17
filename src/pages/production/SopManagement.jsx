import { useState } from 'react';
import { BookOpenCheck, Plus, Trash2, Save, Search, FlaskConical, Package, ListOrdered } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Card, PageHeader, Button, Modal, Field, Mono, Table, inputCls, fmtNum, cx, useToast } from '../../components/ui';
import { RowActions, ConfirmDialog } from '../../components/actions';
import BatchSheet, { PrintButton } from '../../components/BatchSheet';
import { sopEditBlock, sopDeleteBlock, materialTypeOf, isActive } from '../../store/rules';

const blank = {
  product: '', version: 'v1.0', batchSize: 500, unit: 'kg', duration: '4 h', packSize: '5000 ML', refBatch: 200,
  materials: [{ code: '', qty: '' }], packing: [{ code: '', qty: '' }], steps: [''],
};
const n3 = (v) => Math.round(Number(v || 0) * 1000) / 1000;

export default function SopManagement() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [f, setF] = useState(blank);
  const [q, setQ] = useState('');

  const mat = (code) => state.materials.find((m) => m.code === code);
  const usedBy = (id) => state.orders.filter((o) => o.sopId === id).length;
  const inForm = (m) => f.materials.some((l) => l.code === m.code) || f.packing.some((l) => l.code === m.code);
  const rawMaterials = state.materials.filter((m) => materialTypeOf(m.type) === 'Raw Material' && (isActive(m) || inForm(m)));
  const packMaterials = state.materials.filter((m) => materialTypeOf(m.type) === 'Packing Material' && (isActive(m) || inForm(m)));
  const rows = state.sops.filter((s) => !q || `${s.id} ${s.product}`.toLowerCase().includes(q.toLowerCase()));

  const openNew = () => { setEditId(null); setF(blank); setOpen(true); };
  const openEdit = (s) => {
    setEditId(s.id);
    setF({
      product: s.product, version: s.version, batchSize: s.batchSize, unit: s.unit, duration: s.duration || '',
      packSize: s.packSize || '', refBatch: s.refBatch ?? '',
      materials: s.materials.map((m) => ({ ...m })), packing: (s.packing || []).map((m) => ({ ...m })),
      steps: s.steps.length ? [...s.steps] : [''],
    });
    setOpen(true);
  };

  const clean = (lines) => lines.filter((l) => l.code && Number(l.qty) > 0).map((l) => ({ code: l.code, qty: n3(l.qty) }));
  const save = () => {
    const sop = {
      product: f.product.trim(), version: f.version, batchSize: Number(f.batchSize), unit: f.unit, duration: f.duration,
      packSize: f.packSize, refBatch: Number(f.refBatch) || 0,
      materials: clean(f.materials), packing: clean(f.packing), steps: f.steps.map((s) => s.trim()).filter(Boolean),
    };
    if (editId) { dispatch('UPDATE_SOP', { id: editId, sop }); toast(`SOP ${editId} updated`); }
    else { dispatch('CREATE_SOP', { sop }); toast('SOP created'); }
    setOpen(false);
  };

  const rmTotal = f.materials.reduce((t, l) => t + Number(l.qty || 0), 0);
  const valid = f.product.trim() && Number(f.batchSize) > 0 && clean(f.materials).length > 0;

  /* Editable BOM table used for both raw and packing material */
  const LineTable = ({ field, options, qtyLabel, showRef }) => {
    const lines = f[field];
    const setLine = (i, patch) => setF({ ...f, [field]: lines.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    const used = (code, i) => lines.some((x, j) => j !== i && x.code === code);
    return (
      <div className="overflow-x-auto rounded-lg border border-line dark:border-white/[0.07]">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="bg-prod-50/70 text-left text-[0.75rem] font-semibold text-slate-700 dark:bg-white/[0.03] dark:text-slate-300">
              <th className="w-14 px-3 py-2">Sr No</th>
              <th className="px-3 py-2">{field === 'packing' ? 'Material' : 'Ingredient'}</th>
              <th className="w-36 px-3 py-2">{qtyLabel}</th>
              {showRef && <th className="w-40 px-3 py-2 text-right">Std qty for {fmtNum(f.refBatch) || '—'} LTR</th>}
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-line dark:border-white/[0.05]">
                <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <select className={cx(inputCls, 'h-9')} value={l.code} onChange={(e) => setLine(i, { code: e.target.value })} aria-label="Material">
                    <option value="">Select…</option>
                    {options.map((m) => <option key={m.code} value={m.code} disabled={used(m.code, i)}>{m.code} · {m.name} ({m.unit})</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><input type="number" min="0" step="any" className={cx(inputCls, 'h-9')} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} aria-label="Quantity" /></td>
                {showRef && (
                  <td className="px-3 py-2 text-right tabular text-slate-600 dark:text-slate-300">
                    {Number(f.batchSize) > 0 && Number(f.refBatch) > 0 && l.qty !== '' ? fmtNum(n3(l.qty * f.refBatch / f.batchSize)) : '—'}
                  </td>
                )}
                <td className="px-2 py-2">
                  <button type="button" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label="Remove line"
                    onClick={() => setF({ ...f, [field]: lines.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {field === 'materials' && (
              <tr className="border-t-2 border-line bg-slate-50 font-semibold dark:border-white/10 dark:bg-white/[0.03]">
                <td /><td className="px-3 py-2">Total</td>
                <td className={cx('px-3 py-2 tabular', Number(f.batchSize) > 0 && Math.abs(rmTotal - f.batchSize) > 0.001 ? 'text-orange-600' : 'text-emerald-600')}>
                  {fmtNum(n3(rmTotal))} {f.unit}
                </td>
                {showRef && <td className="px-3 py-2 text-right tabular">{Number(f.batchSize) > 0 && Number(f.refBatch) > 0 ? fmtNum(n3(rmTotal * f.refBatch / f.batchSize)) : '—'}</td>}
                <td />
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-line p-2 dark:border-white/[0.07]">
          <Button size="sm" variant="soft" icon={Plus} onClick={() => setF({ ...f, [field]: [...lines, { code: '', qty: '' }] })}>Add line</Button>
        </div>
      </div>
    );
  };

  const Section = ({ icon: I, children, note }) => (
    <div className="mb-2 mt-6 flex items-center justify-between gap-3 first:mt-0">
      <div className="flex items-center gap-2 text-[0.78rem] font-bold uppercase tracking-wider text-prod-500"><I size={15} />{children}</div>
      {note}
    </div>
  );

  return (
    <>
      <PageHeader module="production" title="SOP Management" subtitle="Standard operating procedures in the batch-sheet format: bill of raw material, packing material and process steps."
        actions={<Button variant="production" icon={Plus} onClick={openNew}>New SOP</Button>} />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.06]">
          <div className="text-sm text-slate-500">{state.sops.length} SOPs</div>
          <div className="relative sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={cx(inputCls, 'pl-9')} placeholder="Search SOP or product" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Table
          rows={rows}
          empty={{ icon: BookOpenCheck, title: 'No SOPs found', text: 'Create an SOP with New SOP.' }}
          columns={[
            { key: 'id', label: 'SOP', render: (s) => <div><Mono className="text-prod-500">{s.id}</Mono><div className="text-xs text-slate-400">{s.version}</div></div> },
            { key: 'p', label: 'Product name', render: (s) => <span className="font-semibold text-slate-900 dark:text-white">{s.product}</span> },
            { key: 'bs', label: 'Batch size', align: 'right', render: (s) => `${fmtNum(s.batchSize)} ${s.unit}` },
            { key: 'pk', label: 'Pack size', render: (s) => s.packSize || <span className="text-slate-300">—</span> },
            { key: 'rm', label: 'Raw materials', align: 'right', render: (s) => s.materials.length },
            { key: 'pm', label: 'Packing items', align: 'right', render: (s) => (s.packing || []).length },
            { key: 'u', label: 'Used in orders', align: 'right', render: (s) => usedBy(s.id) },
            { key: 'a', label: 'Actions', align: 'right', render: (s) => (
              <RowActions onView={() => setViewing(s)} onEdit={() => openEdit(s)} onDelete={() => setDeleting(s)}
                editBlock={sopEditBlock(state, s)} deleteBlock={sopDeleteBlock(state, s)} />
            ) },
          ]}
        />
      </Card>

      {/* View: paper-format SOP sheet */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} width="max-w-4xl"
        title={viewing && `${viewing.id} · ${viewing.product}`} subtitle="SOP sheet. Batch no, MFG date, actual qty and check list are filled on the production order."
        footer={<><PrintButton target="sop-sheet" title={viewing?.product} /><Button variant="ghost" onClick={() => setViewing(null)}>Close</Button></>}>
        {viewing && <BatchSheet sop={state.sops.find((s) => s.id === viewing.id) || viewing} id="sop-sheet" />}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete SOP?"
        message={deleting && <>SOP <b>{deleting.id}</b> · {deleting.product} will be removed from the JSON data.</>}
        onConfirm={() => { dispatch('DELETE_SOP', { id: deleting.id }); toast(`SOP ${deleting.id} deleted`); }} />

      {/* New / Edit in the batch-sheet layout */}
      <Modal open={open} onClose={() => setOpen(false)} width="max-w-4xl"
        title={editId ? `Edit SOP · ${editId}` : 'New SOP'} subtitle={state.company?.name}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="production" icon={Save} onClick={save} disabled={!valid}>{editId ? 'Save changes' : 'Save SOP'}</Button></>}>
        <Section icon={BookOpenCheck}>Product details</Section>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Product name *" className="sm:col-span-3"><input className={inputCls} value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} placeholder="e.g. SURVEK R1" /></Field>
          <Field label="Version"><input className={inputCls} value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} /></Field>
          <Field label="Batch size *"><input type="number" min="0" className={inputCls} value={f.batchSize} onChange={(e) => setF({ ...f, batchSize: e.target.value })} /></Field>
          <Field label="Unit"><select className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}><option>kg</option><option>L</option></select></Field>
          <Field label="Pack size" hint="e.g. 5000 ML"><input className={inputCls} value={f.packSize} onChange={(e) => setF({ ...f, packSize: e.target.value })} /></Field>
          <Field label="Std qty reference (LTR)" hint="Shows a 'Std qty for … LTR' column"><input type="number" min="0" className={inputCls} value={f.refBatch} onChange={(e) => setF({ ...f, refBatch: e.target.value })} /></Field>
        </div>

        <Section icon={FlaskConical} note={<span className="text-xs text-slate-500">Batch no, MFG date, actual qty and check list are filled per production order</span>}>Bill of raw material</Section>
        {LineTable({ field: 'materials', options: rawMaterials, qtyLabel: `Std qty in ${f.unit === 'L' ? 'L' : 'KG'}`, showRef: Number(f.refBatch) > 0 })}
        {Number(f.batchSize) > 0 && Math.abs(rmTotal - f.batchSize) > 0.001 && (
          <p className="mt-1.5 text-xs font-semibold text-orange-600">Total of ingredients ({fmtNum(n3(rmTotal))}) differs from batch size ({fmtNum(f.batchSize)}).</p>
        )}

        <Section icon={Package}>Packing material{f.packSize ? ` for ${f.packSize} pack` : ''}</Section>
        {LineTable({ field: 'packing', options: packMaterials, qtyLabel: 'Std qty per batch', showRef: false })}

        <Section icon={ListOrdered}>Process steps</Section>
        <div className="space-y-2">
          {f.steps.map((st, i) => (
            <div key={i} className="flex gap-2">
              <span className="grid h-10 w-8 shrink-0 place-items-center text-sm font-semibold text-slate-400">{i + 1}</span>
              <input className={inputCls} placeholder={`Step ${i + 1}`} value={st} onChange={(e) => setF({ ...f, steps: f.steps.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className="rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label="Remove step"
                onClick={() => setF({ ...f, steps: f.steps.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
            </div>
          ))}
          <Button size="sm" variant="soft" icon={Plus} onClick={() => setF({ ...f, steps: [...f.steps, ''] })}>Add step</Button>
        </div>
      </Modal>
    </>
  );
}
