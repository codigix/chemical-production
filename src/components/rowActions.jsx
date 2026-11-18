import { useState } from 'react';
import { Save, Plus, Trash2, Archive, RotateCcw, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { Modal, Button, Field, Badge, Mono, inputCls, fmtNum, fmtDate, fmtDateTime, useToast } from './ui';
import { RowActions, ConfirmDialog, DetailModal } from './actions';
import OrderDetail from './OrderDetail';
import RequestItems from './RequestItems';
import {
  requestBlock, poBlock, issueRevertBlock, submissionBlock, stockCheckBlock, materialDeleteBlock, POSTED,
  MATERIAL_CATEGORIES, HAZARD_CLASSES, hazardClass, categoryOf, MATERIAL_TYPES, materialTypeOf, materialUsage, isActive,
} from '../store/rules';

/*
  Self-contained View / Edit / Delete for each record type.
  Drop <XRowActions record={...} /> into any table cell or card; the pop-ups live inside.
*/

function SupplierDatalist() {
  const { state } = useStore();
  return <datalist id="supplier-master-list">{(state.suppliers || []).filter((x) => x.active !== false).map((x) => <option key={x.id} value={x.name} />)}</datalist>;
}

function ItemLines({ items, onChange, withRate = false, requiredOf }) {
  const { state } = useStore();
  const mat = (c) => state.materials.find((m) => m.code === c);
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const req = requiredOf?.(it.code);
        return (
        <div key={it.code} className={withRate ? 'grid grid-cols-[1fr_7rem_7rem] items-center gap-2' : 'grid grid-cols-[1fr_8rem] items-center gap-2'}>
          <span className="text-sm font-medium">{mat(it.code)?.name} <span className="text-xs text-slate-400">({mat(it.code)?.unit})</span>
            {req != null && (
              <span className={`block text-[0.6875rem] font-semibold ${Number(it.qty) < req ? 'text-rose-600' : Number(it.qty) > req ? 'text-orange-600' : 'text-emerald-600'}`}>
                Required {fmtNum(req)} {mat(it.code)?.unit}{Number(it.qty) > req ? ` · ordering ${fmtNum(Number(it.qty) - req)} extra` : ''}
              </span>
            )}
          </span>
          <input type="number" min="0" className={inputCls} value={it.qty} aria-label="Quantity"
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
          {withRate && (
            <input type="number" min="0" className={inputCls} value={it.rate} aria-label="Rate"
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} />
          )}
        </div>
        );
      })}
    </div>
  );
}

/* ---------- Material request (purchase requirement / pull out) ---------- */
export function RequestRowActions({ req }) {
  const { state, dispatch } = useStore();
  const linkedPo = req.purchaseId ? state.purchases.find((p) => p.id === req.purchaseId) : null;
  const toast = useToast();
  const [mode, setMode] = useState(null);
  const [items, setItems] = useState(req.items);
  const block = requestBlock(req);
  return (
    <>
      <RowActions onView={() => setMode('view')} onEdit={() => { setItems(req.items.map((x) => ({ ...x }))); setMode('edit'); }} onDelete={() => setMode('delete')}
        editBlock={block} deleteBlock={block} deleteLabel="Cancel request" />
      <DetailModal open={mode === 'view'} onClose={() => setMode(null)} title={`Request ${req.id}`} subtitle={req.type === 'PURCHASE' ? 'Purchase requirement' : 'Material pull out'}
        fields={[['Order', req.orderId], ['Status', <Badge key="s" status={req.status} />], ['Raised', fmtDateTime(req.createdAt)],
          ['Issued by', req.issuedBy], ['Issued at', req.issuedAt && fmtDateTime(req.issuedAt)], ['Linked PO', req.purchaseId]].filter(([, v]) => v)}>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Materials</div>
        <RequestItems items={req.items} max={20} />
        {/* Required vs what the linked PO actually orders / received */}
        {linkedPo && (
          <div className="mt-4 overflow-hidden rounded-lg border border-line dark:border-white/[0.07]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-prod-50/70 text-left text-[0.75rem] font-semibold text-slate-700 dark:bg-white/[0.03] dark:text-slate-300">
                  <th className="px-3 py-2">Material</th><th className="px-3 py-2 text-right">Required</th>
                  <th className="px-3 py-2 text-right">On {linkedPo.id}</th><th className="px-3 py-2 text-right">Received</th>
                </tr>
              </thead>
              <tbody>
                {req.items.map((it) => {
                  const m = state.materials.find((x) => x.code === it.code);
                  const i = linkedPo.items.findIndex((x) => x.code === it.code);
                  const ordered = i >= 0 ? linkedPo.items[i].qty : 0;
                  const received = linkedPo.received?.[i]?.qty;
                  return (
                    <tr key={it.code} className="border-t border-line dark:border-white/[0.05]">
                      <td className="px-3 py-2">{m?.name ?? it.code}</td>
                      <td className="px-3 py-2 text-right tabular">{fmtNum(it.qty)} {m?.unit}</td>
                      <td className={`px-3 py-2 text-right tabular font-semibold ${ordered < it.qty ? 'text-rose-600' : ordered > it.qty ? 'text-orange-600' : 'text-emerald-600'}`}>{fmtNum(ordered)} {m?.unit}</td>
                      <td className="px-3 py-2 text-right tabular">{received != null ? `${fmtNum(received)} ${m?.unit}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DetailModal>
      <Modal open={mode === 'edit'} onClose={() => setMode(null)} title={`Edit request ${req.id}`} subtitle="Change quantities before Inventory acts on it."
        footer={<><Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
          <Button icon={Save} onClick={() => { dispatch('UPDATE_REQUEST', { reqId: req.id, items }); toast(`Request ${req.id} updated`); setMode(null); }}>Save changes</Button></>}>
        <ItemLines items={items} onChange={setItems} />
      </Modal>
      <ConfirmDialog open={mode === 'delete'} onClose={() => setMode(null)} title="Cancel request?" confirmLabel="Cancel request"
        message={<>Request <b>{req.id}</b> will be removed and order <b>{req.orderId}</b> goes back to <b>{req.type === 'PURCHASE' ? 'Shortage' : 'Ready'}</b>.</>}
        onConfirm={() => { dispatch('DELETE_REQUEST', { reqId: req.id }); toast(`Request ${req.id} cancelled`); }} />
    </>
  );
}

/* ---------- Purchase order ---------- */
export function PurchaseRowActions({ po }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState(null);
  const [f, setF] = useState(null);
  const block = poBlock(po);
  const total = po.items.reduce((t, it) => t + it.qty * (it.rate || 0), 0);
  const mat = (c) => state.materials.find((m) => m.code === c);
  return (
    <>
      <RowActions onView={() => setMode('view')} onEdit={() => { setF({ supplier: po.supplier, expected: po.expected, items: po.items.map((x) => ({ ...x })) }); setMode('edit'); }}
        onDelete={() => setMode('delete')} editBlock={block} deleteBlock={block} />
      <DetailModal open={mode === 'view'} onClose={() => setMode(null)} title={`Purchase order ${po.id}`} subtitle={po.supplier}
        fields={[['Status', <Badge key="s" status={po.status} />], ['Expected', fmtDate(po.expected)], ['Raised', fmtDateTime(po.date)], ['Requirement', po.reqId || 'Direct'],
          ['GRN', po.grnNo], ['Received', po.receivedAt && fmtDateTime(po.receivedAt)]].filter(([, v]) => v)}>
        {po.items.map((it, i) => {
          const rec = po.received?.[i];
          return (
            <div key={i} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-white/[0.06]">
              <span>{mat(it.code)?.name} <Mono className="text-xs text-slate-400">{it.code}</Mono>
                {rec && <span className={rec.qty < it.qty ? 'ml-2 text-xs font-semibold text-orange-600' : 'ml-2 text-xs font-semibold text-emerald-600'}>Received {fmtNum(rec.qty)}</span>}
              </span>
              <span className="whitespace-nowrap tabular">{fmtNum(it.qty)} {mat(it.code)?.unit} × ₹{it.rate} = <b>₹ {fmtNum(Math.round(it.qty * it.rate))}</b></span>
            </div>
          );
        })}
        <div className="mt-3 text-right text-sm font-bold text-prod-500">PO total ₹ {fmtNum(Math.round(total))}</div>
        {po.receivedValue != null && <div className="text-right text-sm font-bold text-emerald-600">Received value ₹ {fmtNum(Math.round(po.receivedValue))}</div>}
      </DetailModal>
      <Modal open={mode === 'edit'} onClose={() => setMode(null)} title={`Edit PO ${po.id}`} width="max-w-xl"
        footer={<><Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
          <Button icon={Save} onClick={() => { dispatch('UPDATE_PO', { purchaseId: po.id, ...f }); toast(`PO ${po.id} updated`); setMode(null); }}>Save changes</Button></>}>
        {f && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Supplier"><select className={inputCls} value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })}>{[...new Set([f.supplier, ...(state.suppliers || []).filter((x) => x.active !== false).map((x) => x.name)])].filter(Boolean).map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Expected delivery"><input type="date" className={inputCls} value={f.expected} onChange={(e) => setF({ ...f, expected: e.target.value })} /></Field>
            </div>
            <div className="mb-2 mt-4 grid grid-cols-[1fr_7rem_7rem] gap-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500"><span>Material</span><span>Qty</span><span>Rate ₹</span></div>
            <ItemLines items={f.items} withRate onChange={(items) => setF({ ...f, items })}
              requiredOf={po.reqId ? (code) => state.requests.find((r) => r.id === po.reqId)?.items.find((x) => x.code === code)?.qty : undefined} />
          </>
        )}
      </Modal>
      <ConfirmDialog open={mode === 'delete'} onClose={() => setMode(null)} title="Delete purchase order?"
        message={<>PO <b>{po.id}</b> will be deleted.{po.reqId && <> Requirement <b>{po.reqId}</b> goes back to Pending.</>}</>}
        onConfirm={() => { dispatch('DELETE_PO', { purchaseId: po.id }); toast(`PO ${po.id} deleted`); }} />
    </>
  );
}

/* ---------- Issued pull out (Inventory) ---------- */
export function IssueRowActions({ req }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState(null);
  return (
    <>
      <RowActions onView={() => setMode('view')} onEdit={() => {}} onDelete={() => setMode('delete')}
        editBlock="Issued quantities follow the request. Reverse the issue to change them" deleteBlock={issueRevertBlock(req)} deleteLabel="Reverse issue" />
      <DetailModal open={mode === 'view'} onClose={() => setMode(null)} title={`Pull out ${req.id}`}
        fields={[['Order', req.orderId], ['Status', <Badge key="s" status={req.status} />], ['Issued by', req.issuedBy], ['Issued at', fmtDateTime(req.issuedAt)]]}>
        <RequestItems items={req.items} max={20} />
      </DetailModal>
      <ConfirmDialog open={mode === 'delete'} onClose={() => setMode(null)} title="Reverse this issue?" confirmLabel="Reverse issue"
        message={<>Reserved stock for <b>{req.id}</b> is released and the request goes back to <b>Pending</b>.</>}
        onConfirm={() => { dispatch('REVERT_ISSUE', { reqId: req.id }); toast(`Issue of ${req.id} reversed`); }} />
    </>
  );
}

/* ---------- SOP submission (Production) ---------- */
export function SubmissionRowActions({ order }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState(null);
  const [f, setF] = useState({ actualYield: '', notes: '' });
  const block = submissionBlock(order);
  return (
    <>
      <RowActions onView={() => setMode('view')} onEdit={() => { setF({ actualYield: order.submission?.actualYield ?? '', notes: order.submission?.notes ?? '' }); setMode('edit'); }}
        onDelete={() => setMode('delete')} editBlock={block} deleteBlock={block} deleteLabel="Withdraw submission" />
      {mode === 'view' && <OrderDetail orderId={order.id} onClose={() => setMode(null)} />}
      <Modal open={mode === 'edit'} onClose={() => setMode(null)} title={`Edit submission · ${order.id}`}
        footer={<><Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
          <Button icon={Save} disabled={!f.actualYield} onClick={() => { dispatch('UPDATE_SUBMISSION', { orderId: order.id, ...f }); toast('Submission updated'); setMode(null); }}>Save changes</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Actual yield"><input type="number" className={inputCls} value={f.actualYield} onChange={(e) => setF({ ...f, actualYield: e.target.value })} /></Field>
          <Field label="Batch notes"><input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Modal>
      <ConfirmDialog open={mode === 'delete'} onClose={() => setMode(null)} title="Withdraw SOP submission?" confirmLabel="Withdraw"
        message={<>Order <b>{order.id}</b> goes back to <b>Production Verified</b> so it can be submitted again.</>}
        onConfirm={() => { dispatch('WITHDRAW_SUBMISSION', { orderId: order.id }); toast('Submission withdrawn'); }} />
    </>
  );
}

/* ---------- Stock person check (Inventory) ---------- */
export function StockCheckRowActions({ order }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState(null);
  const [f, setF] = useState({ by: '', remarks: '' });
  const block = stockCheckBlock(order);
  return (
    <>
      <RowActions onView={() => setMode('view')} onEdit={() => { setF({ by: order.stockCheck?.by ?? '', remarks: order.stockCheck?.remarks ?? '' }); setMode('edit'); }}
        onDelete={() => setMode('delete')} editBlock={block} deleteBlock={block} deleteLabel="Reverse check" />
      {mode === 'view' && <OrderDetail orderId={order.id} onClose={() => setMode(null)} />}
      <Modal open={mode === 'edit'} onClose={() => setMode(null)} title={`Edit stock check · ${order.id}`}
        footer={<><Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
          <Button icon={Save} disabled={!f.by} onClick={() => { dispatch('UPDATE_STOCK_CHECK', { orderId: order.id, ...f }); toast('Stock check updated'); setMode(null); }}>Save changes</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stock person"><input className={inputCls} value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })} /></Field>
          <Field label="Remarks"><input className={inputCls} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
        </div>
      </Modal>
      <ConfirmDialog open={mode === 'delete'} onClose={() => setMode(null)} title="Reverse stock check?" confirmLabel="Reverse"
        message={<>Order <b>{order.id}</b> goes back to <b>SOP Submitted</b> and must be checked again.</>}
        onConfirm={() => { dispatch('REVERT_STOCK_CHECK', { orderId: order.id }); toast('Stock check reversed'); }} />
    </>
  );
}

/* ---------- Accepted SOP (final) ---------- */
export function AcceptedRowActions({ order }) {
  const [view, setView] = useState(false);
  const final = 'Accepted SOPs are final. Stock is already posted';
  return (
    <>
      <RowActions onView={() => setView(true)} onEdit={() => {}} onDelete={() => {}} editBlock={final} deleteBlock={final} />
      {view && <OrderDetail orderId={order.id} onClose={() => setView(false)} />}
    </>
  );
}

/* ---------- Order (generic view + final lock) ---------- */
export function OrderViewActions({ order }) {
  const [view, setView] = useState(false);
  return (
    <>
      <RowActions onView={() => setView(true)} />
      {view && <OrderDetail orderId={order.id} onClose={() => setView(false)} />}
    </>
  );
}

/* ---------- Ledger entry (read only) ---------- */
export function LedgerRowActions({ entry }) {
  const { state } = useStore();
  const [view, setView] = useState(false);
  const m = state.materials.find((x) => x.code === entry.code);
  return (
    <>
      <RowActions onView={() => setView(true)} onEdit={() => {}} onDelete={() => {}} editBlock={POSTED} deleteBlock={POSTED} />
      <DetailModal open={view} onClose={() => setView(false)} title={`Ledger entry ${entry.id}`} subtitle={m?.name}
        fields={[['Type', <Badge key="t" status={entry.type} />], ['Date', fmtDateTime(entry.date)], ['Quantity', `${entry.type === 'IN' ? '+' : '−'}${fmtNum(entry.qty)} ${m?.unit}`],
          ['Balance after', `${fmtNum(entry.balance)} ${m?.unit}`], ['Material', <Mono key="c">{entry.code}</Mono>], ['Reference', entry.ref],
          ...(entry.rate != null ? [['Rate', `₹ ${entry.rate} / ${m?.unit}`], ['Value', `₹ ${fmtNum(Math.round(entry.value))}`]] : [])]} />
    </>
  );
}

/* ---------- Raw material master ---------- */
export { MATERIAL_CATEGORIES, HAZARD_CLASSES };

function Section({ children }) {
  return <div className="mb-2 mt-1 text-[0.6875rem] font-bold uppercase tracking-wider text-prod-500 sm:col-span-2">{children}</div>;
}

export function MaterialForm({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Section>Basic details</Section>
      <Field label="Material name *"><input className={inputCls} value={value.name} onChange={set('name')} placeholder="e.g. Ferric Chloride 40%" /></Field>
      <Field label="Material type" hint={value.code ? undefined : 'Code starts with RM- or PM-'}>
        <select className={inputCls} value={materialTypeOf(value.type)} onChange={set('type')}>
          {MATERIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Category">
        <select className={inputCls} value={categoryOf(value.category)} onChange={set('category')}>
          {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Grade / Specification"><input className={inputCls} value={value.grade || ''} onChange={set('grade')} placeholder="e.g. Technical, 98%" /></Field>
      <Field label="Unit of measure"><select className={inputCls} value={value.unit} onChange={set('unit')}><option>kg</option><option>L</option><option>MT</option><option>Nos</option><option>Roll</option></select></Field>
      <Field label="HSN code"><input className={inputCls} value={value.hsn || ''} onChange={set('hsn')} placeholder="e.g. 28070010" /></Field>

      <Section>Safety & purchase</Section>
      <Field label="Hazard class">
        <select className={inputCls} value={hazardClass(value.hazard)} onChange={set('hazard')}>
          {HAZARD_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Preferred supplier">
        {/* pick from the Supplier Master (typing a name is still allowed) */}
        <input className={inputCls} list="supplier-master-list" value={value.supplier || ''} onChange={set('supplier')} placeholder="Pick from Supplier Master" />
        <SupplierDatalist />
      </Field>
      <Field label="Standard rate (₹ / unit)"><input type="number" min="0" className={inputCls} value={value.rate ?? ''} onChange={set('rate')} /></Field>

      <Section>Storage</Section>
      <Field label="Reorder level"><input type="number" min="0" className={inputCls} value={value.reorder} onChange={set('reorder')} /></Field>
      <Field label="Storage location"><input className={inputCls} value={value.location} onChange={set('location')} placeholder="e.g. Tank T-02 / Bay A-01" /></Field>
    </div>
  );
}

/* Another material with the same name (case-insensitive), ignoring the one being edited */
const dupOf = (state, name, exceptCode) =>
  state.materials.find((x) => x.code !== exceptCode && x.name.trim().toLowerCase() === String(name || '').trim().toLowerCase());

function DupWarning({ state, name, exceptCode }) {
  const d = name && dupOf(state, name, exceptCode);
  if (!d) return null;
  return <p className="mt-3 text-xs font-semibold text-rose-600">{d.code} already uses this name. Edit that material instead of creating a duplicate.</p>;
}

export function NewMaterialButton() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const blank = { name: '', unit: 'kg', type: 'Raw Material', category: 'General', grade: '', hsn: '', hazard: 'Non-hazardous', supplier: '', rate: '', reorder: 100, location: '' }; // defaults: General / Non-hazardous
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  return (
    <>
      <Button icon={Plus} onClick={() => { setF(blank); setOpen(true); }}>New material</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New raw material" subtitle="Starts with zero stock. Use RM Stock In to add quantity." width="max-w-2xl"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button icon={Save} disabled={!f.name || !!dupOf(state, f.name)} onClick={() => { dispatch('CREATE_MATERIAL', f); toast('Raw material added'); setOpen(false); }}>Save material</Button></>}>
        <MaterialForm value={f} onChange={setF} />
        <DupWarning state={state} name={f.name} />
      </Modal>
    </>
  );
}

export function MaterialRowActions({ m }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState(null);
  const [f, setF] = useState(m);
  const usage = materialUsage(state, m);
  const sops = usage.sops;
  const active = isActive(m);
  return (
    <>
      {active ? (
        <RowActions onView={() => setMode('view')} onEdit={() => { setF({ ...m }); setMode('edit'); }} onDelete={() => setMode('delete')} />
      ) : (
        <div className="inline-flex items-center gap-1.5">
          <RowActions onView={() => setMode('view')} />
          <button type="button" title="Restore material" aria-label="Restore material"
            className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-500 hover:text-white dark:border-white/10 dark:bg-emerald-500/15"
            onClick={() => { dispatch('RESTORE_MATERIAL', { code: m.code }); toast(`${m.code} restored`); }}>
            <RotateCcw size={14} />
          </button>
        </div>
      )}
      <DetailModal open={mode === 'view'} onClose={() => setMode(null)} title={`${m.code} · ${m.name}`} subtitle={m.location}
        fields={[['Material type', materialTypeOf(m.type)], ['Category', categoryOf(m.category)], ['Grade / Spec', m.grade || '—'], ['Unit', m.unit], ['HSN code', m.hsn || '—'],
          ['Hazard class', hazardClass(m.hazard)], ['Preferred supplier', m.supplier || '—'], ['Standard rate', m.rate ? `₹ ${m.rate} / ${m.unit}` : '—'], ['Location', m.location || '—'],
          ['On hand', `${fmtNum(m.onHand)} ${m.unit}`], ['Reserved', `${fmtNum(m.reserved)} ${m.unit}`], ['Available', `${fmtNum(m.onHand - m.reserved)} ${m.unit}`],
          ['Reorder level', `${fmtNum(m.reorder)} ${m.unit}`], ['Stock value', `₹ ${fmtNum(Math.round(m.onHand * (m.rate || 0)))}`], ['Used in SOPs', sops.map((s) => s.id).join(', ') || 'None'],
          ['Ledger entries', state.ledger.filter((l) => l.code === m.code).length]]} />
      <Modal open={mode === 'edit'} onClose={() => setMode(null)} title={`Edit material ${m.code}`} width="max-w-2xl"
        footer={<><Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
          <Button icon={Save} disabled={!f.name || !!dupOf(state, f.name, m.code)} onClick={() => { dispatch('UPDATE_MATERIAL', { code: m.code, ...f }); toast(`${m.code} updated`); setMode(null); }}>Save changes</Button></>}>
        <MaterialForm value={f} onChange={setF} />
        <DupWarning state={state} name={f.name} exceptCode={m.code} />
      </Modal>
      {/* Delete: usage check, then delete / deactivate / explain what blocks it */}
      <Modal open={mode === 'delete'} onClose={() => setMode(null)} width="max-w-lg"
        title={usage.mode === 'delete' ? 'Delete material?' : usage.mode === 'deactivate' ? 'Deactivate material?' : 'Material is in use'}
        subtitle={`${m.code} · ${m.name}`}
        footer={<>
          <Button variant="ghost" onClick={() => setMode(null)}>{usage.mode === 'blocked' ? 'Close' : 'Cancel'}</Button>
          {usage.mode === 'delete' && (
            <Button className="bg-rose-600 hover:bg-rose-700" icon={Trash2} onClick={() => { dispatch('DELETE_MATERIAL', { code: m.code }); toast(`${m.code} deleted`); setMode(null); }}>Delete permanently</Button>
          )}
          {usage.mode === 'deactivate' && (
            <Button className="bg-orange-500 hover:bg-orange-600" icon={Archive} onClick={() => { dispatch('DEACTIVATE_MATERIAL', { code: m.code }); toast(`${m.code} deactivated`); setMode(null); }}>Deactivate</Button>
          )}
        </>}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['On hand', `${fmtNum(m.onHand)} ${m.unit}`], ['Reserved', `${fmtNum(m.reserved)} ${m.unit}`], ['Ledger entries', usage.entries]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 p-2.5 dark:bg-white/[0.03]">
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">{k}</div>
              <div className="mt-0.5 text-sm font-bold">{v}</div>
            </div>
          ))}
        </div>
        {usage.mode === 'delete' && (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">This material has never been used: no stock, no ledger history and no SOP, PO or request. It will be <b>removed permanently</b> from the JSON data.</p>
        )}
        {usage.mode === 'deactivate' && (
          <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p>This material has <b>stock or ledger history</b>, so it can't be erased without breaking the Stock Ledger.</p>
            <p><b>Deactivate</b> instead: it disappears from new SOPs, purchase orders and stock-in, but every ledger entry is kept. You can <b>restore</b> it any time.</p>
          </div>
        )}
        {usage.mode === 'blocked' && (
          <div className="mt-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">It can't be deleted or deactivated while it is in active use:</p>
            <ul className="mt-2 space-y-1.5">
              {usage.blockers.map((b) => (
                <li key={b} className="flex gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{b}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Remove it from those SOPs, close or delete the open PO/request, and let reserved stock be accepted or reversed. Then try again.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
