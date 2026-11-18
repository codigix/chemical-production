import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Plus, Search, Gauge, PackageCheck, FileCheck2, Save, Trash2, RotateCcw, ChevronDown, Check } from 'lucide-react';
import { RowActions, ConfirmDialog } from '../../components/actions';
import { orderEditBlock, materialTypeOf } from '../../store/rules';
import { useStore, requirementFor, sopLines } from '../../store/StoreContext';
import { Card, PageHeader, Button, Badge, Table, Modal, Field, Mono, inputCls, fmtDate, fmtNum, cx, useToast } from '../../components/ui';
import OrderFlow from '../../components/OrderFlow';
import OrderDetail from '../../components/OrderDetail';
import { navigate } from '../../router';

/*
  SOP / Product field:
  - Type the product name (or SOP no.) manually — no list pops up while typing.
  - The list opens only from the ▾ button.
  - Typed text is matched to an SOP when you press Enter or leave the field.
*/
function SopCombo({ sops, value, onChange }) {
  const sel = sops.find((s) => s.id === value);
  const label = (s) => `${s.id} · ${s.product} (${s.version})`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(sel ? label(sel) : '');
  const ref = useRef(null);

  /* Keep the box in step when the SOP changes from outside (open edit, list pick) */
  useEffect(() => { if (sel) setText(label(sel)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const norm = (v) => v.trim().toLowerCase();
  const findMatch = (v) => {
    const t = norm(v);
    if (!t) return null;
    return sops.find((s) => norm(label(s)) === t || norm(s.id) === t || norm(s.product) === t || norm(`${s.product} (${s.version})`) === t) || null;
  };
  const match = findMatch(text);
  const typedUnknown = text.trim() && !match;

  /* Resolve the typed text to an SOP */
  const commit = () => {
    if (match) { if (match.id !== value) onChange(match.id); setText(label(match)); }
    else if (text.trim() && value) onChange('');
  };
  const pick = (s) => { onChange(s.id); setText(label(s)); setOpen(false); };

  return (
    <div ref={ref}>
      <div className="relative">
        <input className={cx(inputCls, 'pr-10', typedUnknown && 'border-amber-400')}
          placeholder="Type product name / SOP no. or pick from ▾"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
        <button type="button" title="Show SOP list" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-prod-50 hover:text-prod-500 dark:hover:bg-white/[0.06]">
          <ChevronDown size={16} className={cx('transition', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg scrollbar-thin dark:border-white/10 dark:bg-ink-800">
            {sops.map((s) => (
              <button key={s.id} type="button" onClick={() => pick(s)}
                className={cx('flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-prod-50 dark:hover:bg-white/[0.06]',
                  s.id === value && 'bg-prod-50/60 font-semibold text-prod-600 dark:text-prod-300')}>
                <span><span className="font-medium">{s.product}</span> <span className="text-xs text-slate-400">({s.version})</span></span>
                <span className="flex items-center gap-2"><Mono>{s.id}</Mono>{s.id === value && <Check size={14} className="text-prod-500" />}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {typedUnknown && (
        <div className="mt-1 text-[0.6875rem] text-amber-600">No SOP found for “{text.trim()}” — check the name or pick one from the ▾ list.</div>
      )}
    </div>
  );
}

const FILTERS = ['All', 'Draft', 'Shortage', 'Awaiting Purchase', 'Ready', 'In progress', 'Accepted'];
const IN_PROGRESS = ['Pull Out Requested', 'Material Issued', 'Production Verified', 'SOP Submitted', 'Stock Verified'];

export default function ProductionOrders({ params }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(!!params.new);
  const [viewing, setViewing] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  /* New order starts with an empty SOP / Product field — user types or picks it */
  const blankForm = () => ({ sopId: '', batches: 1, plannedDate: today, priority: 'Medium', lines: [] });
  const [form, setForm] = useState(blankForm);

  useEffect(() => { if (params.new) { setEditingId(null); setForm(blankForm()); setCreating(true); } }, [params.new]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Opened from another screen with ?edit=PRD-xxxx */
  useEffect(() => {
    const o = params.edit && state.orders.find((x) => x.id === params.edit);
    if (o && !orderEditBlock(o)) openEdit(o);
  }, [params.edit]); // eslint-disable-line react-hooks/exhaustive-deps

  const sopOf = (o) => state.sops.find((s) => s.id === o.sopId);
  const rows = useMemo(() => state.orders.filter((o) => {
    const f = filter === 'All' || (filter === 'In progress' ? IN_PROGRESS.includes(o.status) : o.status === filter);
    const s = !q || `${o.id} ${sopOf(o)?.product}`.toLowerCase().includes(q.toLowerCase());
    return f && s;
  }), [state.orders, filter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const formSop = state.sops.find((s) => s.id === form.sopId);
  /* Live requirement of the lines being edited (required vs available) */
  const preview = requirementFor(state, { ...form, batches: Number(form.batches) || 0, lines: form.lines.filter((l) => l.code && Number(l.qty) > 0) });
  const previewOf = (code) => preview.find((p) => p.code === code);
  const sopStd = sopLines(state, form.sopId, form.batches);
  const customised = JSON.stringify(sopStd.map((l) => [l.code, l.qty])) !== JSON.stringify(form.lines.map((l) => [l.code, Number(l.qty)]));
  const validLines = form.lines.some((l) => l.code && Number(l.qty) > 0);

  const [editingId, setEditingId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const openNew = () => { setEditingId(null); setForm(blankForm()); setCreating(true); };
  const openEdit = (o) => {
    setEditingId(o.id);
    setForm({ sopId: o.sopId, batches: o.batches, plannedDate: o.plannedDate, priority: o.priority, lines: o.lines?.length ? o.lines.map((l) => ({ ...l })) : sopLines(state, o.sopId, o.batches) });
    setCreating(true);
  };
  /* Changing SOP or batches reloads the standard quantities */
  const setRecipe = (patch) => {
    const next = { ...form, ...patch };
    setForm({ ...next, lines: sopLines(state, next.sopId, next.batches) });
  };
  const setLine = (i, patch) => setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const addLine = (group) => setForm({ ...form, lines: [...form.lines, { code: '', group, qty: '' }] });
  const removeLine = (i) => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) });
  const optionsFor = (group, i) => state.materials.filter((m) =>
    (group === 'PM' ? materialTypeOf(m.type) === 'Packing Material' : materialTypeOf(m.type) === 'Raw Material')
    && (m.active !== false || m.code === form.lines[i]?.code)
    && !form.lines.some((l, j) => j !== i && l.code === m.code));

  const save = () => {
    if (editingId) {
      dispatch('UPDATE_ORDER', { orderId: editingId, patch: form });
      toast(`Order ${editingId} updated`);
    } else {
      dispatch('CREATE_ORDER', form);
      toast('Production order created');
    }
    setCreating(false);
    setEditingId(null);
  };

  /* Next workflow step (if any) + View / Edit / Delete */
  const action = (o) => {
    let next = null;
    if (['Draft', 'Shortage', 'Ready'].includes(o.status))
      next = <Button size="sm" variant="production" icon={Gauge} onClick={() => navigate('production/rm-stock', { order: o.id })}>Check RM</Button>;
    else if (o.status === 'Material Issued')
      next = <Button size="sm" variant="production" icon={PackageCheck} onClick={() => navigate('production/pull-out')}>Verify</Button>;
    else if (o.status === 'Production Verified')
      next = <Button size="sm" variant="production" icon={FileCheck2} onClick={() => navigate('production/sop-submission')}>Submit SOP</Button>;
    const block = orderEditBlock(o);
    return (
      <div className="flex items-center justify-end gap-2">
        {next}
        <RowActions onView={() => setViewing(o.id)} onEdit={() => openEdit(o)} onDelete={() => setDeleting(o)} editBlock={block} deleteBlock={block} />
      </div>
    );
  };

  const countFor = (f) => f === 'All' ? state.orders.length : f === 'In progress' ? state.orders.filter((o) => IN_PROGRESS.includes(o.status)).length : state.orders.filter((o) => o.status === f).length;

  return (
    <>
      <PageHeader module="production" icon={ClipboardList} title="Production Orders" subtitle="Plan production against an SOP and push it through the material workflow."
        actions={<Button variant="production" icon={Plus} onClick={openNew}>New production order</Button>} />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-white/[0.06]">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cx('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  filter === f ? 'bg-prod-500 text-white' : 'text-slate-500 hover:bg-prod-50 hover:text-prod-500 dark:hover:bg-white/[0.06]')}>
                {f}<span className={cx('rounded px-1 text-[0.625rem]', filter === f ? 'bg-white/20 dark:bg-ink-900/10' : 'bg-slate-100 dark:bg-white/[0.06]')}>{countFor(f)}</span>
              </button>
            ))}
          </div>
          <div className="relative lg:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={cx(inputCls, 'pl-9')} placeholder="Search order or product" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <Table
          rows={rows}
          empty={{ icon: ClipboardList, title: 'No orders match', text: 'Try another filter or create a new production order.' }}
          columns={[
            { key: 'id', label: 'Order', render: (o) => <button onClick={() => setViewing(o.id)} className="hover:text-prod-600"><Mono>{o.id}</Mono></button> },
            { key: 'product', label: 'Product / SOP', render: (o) => <div><div className="font-medium">{sopOf(o)?.product}</div><div className="text-xs text-slate-400">{o.sopId} · {sopOf(o)?.version}</div></div> },
            { key: 'batches', label: 'Batches', align: 'right', render: (o) => <span>{o.batches} <span className="text-xs text-slate-400">({fmtNum(o.batches * (sopOf(o)?.batchSize || 0))} {sopOf(o)?.unit})</span></span> },
            { key: 'plannedDate', label: 'Planned', render: (o) => fmtDate(o.plannedDate) },
            { key: 'priority', label: 'Priority', render: (o) => <Badge status={o.priority} /> },
            { key: 'progress', label: 'Progress', className: 'min-w-[10.625rem]', render: (o) => <OrderFlow status={o.status} compact /> },
            { key: 'status', label: 'Status', render: (o) => <Badge status={o.status} /> },
            { key: 'act', label: 'Actions', align: 'right', render: action },
          ]}
        />
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title={editingId ? `Edit order · ${editingId}` : 'New production order'} subtitle="Pick an SOP; the material list is filled from it. Add, remove or change materials for this order." width="max-w-3xl"
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button variant="production" icon={editingId ? Save : Plus} onClick={save} disabled={!form.sopId || form.batches < 1 || !validLines}>{editingId ? 'Save changes' : 'Create order'}</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SOP / Product" className="sm:col-span-2">
            <SopCombo sops={state.sops} value={form.sopId} onChange={(id) => setRecipe({ sopId: id })} />
          </Field>
          <Field label="Number of batches" hint={formSop ? `1 batch = ${fmtNum(formSop.batchSize)} ${formSop.unit}` : ''}>
            <input type="number" min="1" className={inputCls} value={form.batches} onChange={(e) => setRecipe({ batches: e.target.value })} />
          </Field>
          <Field label="Planned date">
            <input type="date" className={inputCls} value={form.plannedDate} onChange={(e) => setForm({ ...form, plannedDate: e.target.value })} />
          </Field>
          {/* Priority field hidden from the form — new orders keep the default 'Medium', edits keep their existing priority */}
        </div>
        {/* Editable material list for this order */}
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Material requirement</span>
              {!form.sopId ? null : customised
                ? <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">Customised for this order</span>
                : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">As per SOP</span>}
            </div>
            {customised && form.sopId && <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setForm({ ...form, lines: sopStd })}>Reset to SOP</Button>}
          </div>
          <div className="overflow-x-auto rounded-lg border border-line dark:border-white/[0.07]">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="bg-prod-50/70 text-left text-[0.75rem] font-semibold text-slate-700 dark:bg-white/[0.03] dark:text-slate-300">
                  <th className="w-12 px-3 py-2">Type</th><th className="px-3 py-2">Material</th><th className="w-32 px-3 py-2">Qty for order</th>
                  <th className="w-28 px-3 py-2 text-right">Available</th><th className="w-24 px-3 py-2 text-right">Shortage</th><th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {form.lines.map((l, i) => {
                  const p = previewOf(l.code);
                  const m = state.materials.find((x) => x.code === l.code);
                  return (
                    <tr key={i} className="border-t border-line dark:border-white/[0.05]">
                      <td className="px-3 py-2"><span className={cx('rounded px-1.5 py-0.5 text-[0.625rem] font-bold', l.group === 'PM' ? 'bg-orange-50 text-orange-600' : 'bg-prod-50 text-prod-500')}>{l.group}</span></td>
                      <td className="px-3 py-2">
                        <select className={cx(inputCls, 'h-9')} value={l.code} onChange={(e) => setLine(i, { code: e.target.value })} aria-label="Material">
                          <option value="">Select {l.group === 'PM' ? 'packing material' : 'raw material'}…</option>
                          {optionsFor(l.group, i).map((x) => <option key={x.code} value={x.code}>{x.code} · {x.name} ({x.unit})</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <input type="number" min="0" step="any" className={cx(inputCls, 'h-9')} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} aria-label="Quantity" />
                          <span className="w-8 text-xs text-slate-400">{m?.unit}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular text-slate-600 dark:text-slate-300">{p ? fmtNum(p.available) : '—'}</td>
                      <td className={cx('whitespace-nowrap px-3 py-2 text-right tabular font-semibold', p?.shortage > 0 ? 'text-rose-600' : 'text-slate-300')}>{p ? fmtNum(p.shortage) : '—'}</td>
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => removeLine(i)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label="Remove material" title="Remove material">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {form.lines.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">{form.sopId ? 'No materials. Add a line or reset to SOP.' : 'Enter or pick an SOP / Product above — its materials will load here.'}</td></tr>
                )}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-2 border-t border-line p-2 dark:border-white/[0.07]">
              <Button size="sm" variant="soft" icon={Plus} onClick={() => addLine('RM')}>Add raw material</Button>
              <Button size="sm" variant="soft" icon={Plus} onClick={() => addLine('PM')}>Add packing material</Button>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Changing the SOP or number of batches reloads the standard quantities. This list is what the RM check, pull out and batch sheet use.</p>
        </div>
      </Modal>

      {viewing && <OrderDetail orderId={viewing} onClose={() => setViewing(null)} />}

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)}
        title="Delete production order?"
        message={deleting && <>Order <b>{deleting.id}</b> ({sopOf(deleting)?.product}) will be removed from the JSON data. This cannot be undone.</>}
        onConfirm={() => { dispatch('DELETE_ORDER', { orderId: deleting.id }); toast(`Order ${deleting.id} deleted`); }} />
    </>
  );
}
