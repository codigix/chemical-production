import { useMemo, useState } from 'react';
import { Building2, Plus, Search, Save, Phone, Mail, MapPin, Star, Truck, FileText, IndianRupee, CheckCircle2, Archive, RotateCcw, AlertTriangle, Trash2 } from 'lucide-react';
import { useStore, supplierUsage } from '../../store/StoreContext';
import { MATERIAL_CATEGORIES } from '../../store/rules';
import { Card, PageHeader, Button, Badge, Modal, Field, Mono, Table, Stat, inputCls, fmtNum, fmtDate, cx, useToast } from '../../components/ui';
import { RowActions, DetailModal } from '../../components/actions';

const BLANK = { name: '', contact: '', phone: '', email: '', gstin: '', city: '', address: '', categories: [], paymentTerms: '30 days credit', leadDays: 5, rating: 3, notes: '' };
const TERMS = ['Advance', '7 days credit', '15 days credit', '30 days credit', '45 days credit', '60 days credit'];
const poValue = (items) => items.reduce((t, it) => t + Number(it.qty) * Number(it.rate || 0), 0);
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

function Stars({ value, onChange, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} className={cx(!onChange && 'cursor-default')} aria-label={`${n} star`}>
          <Star size={size} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'} />
        </button>
      ))}
    </span>
  );
}

export default function SupplierMaster() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const suppliers = state.suppliers || [];
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [cat, setCat] = useState('All');
  const [form, setForm] = useState(null); // { id?, ...fields }
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const stats = (name) => {
    const u = supplierUsage(state, name);
    const open = u.pos.filter((p) => p.status === 'Ordered');
    return { ...u, open, value: u.pos.reduce((t, p) => t + poValue(p.items), 0) };
  };

  const rows = useMemo(() => suppliers.filter((x) => {
    const st = status === 'all' || (status === 'active' ? x.active !== false : x.active === false);
    const c = cat === 'All' || (x.categories || []).includes(cat);
    const s = !q || `${x.id} ${x.name} ${x.contact} ${x.city} ${x.gstin} ${x.phone} ${x.email}`.toLowerCase().includes(q.toLowerCase());
    return st && c && s;
  }), [suppliers, status, cat, q]);

  /* Validation */
  const dup = form && suppliers.some((x) => x.id !== form.id && x.name.trim().toLowerCase() === form.name.trim().toLowerCase());
  const gstBad = form && form.gstin && !GSTIN_RE.test(form.gstin.trim().toUpperCase());
  const emailBad = form && form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim());
  const canSave = form && form.name.trim() && !dup && !gstBad && !emailBad;

  const save = () => {
    if (form.id) {
      const old = suppliers.find((x) => x.id === form.id);
      dispatch('UPDATE_SUPPLIER', form);
      toast(old && old.name !== form.name.trim() ? `Supplier renamed · POs, RFQs and materials updated` : `Supplier ${form.id} updated`);
    } else {
      dispatch('CREATE_SUPPLIER', form);
      toast(`Supplier ${form.name.trim()} added`);
    }
    setForm(null);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const totalValue = state.purchases.reduce((t, p) => t + poValue(p.items), 0);
  const openPos = state.purchases.filter((p) => p.status === 'Ordered').length;
  const viewSup = suppliers.find((x) => x.id === viewing);
  const delInfo = deleting && stats(deleting.name);
  const delBlocked = delInfo && (delInfo.pos.length > 0 || delInfo.rfqs.length > 0);

  return (
    <>
      <PageHeader module="inventory" icon={Building2} title="Supplier Master" subtitle="All suppliers used for RFQs and purchase orders. Add, edit, deactivate or delete suppliers."
        actions={<Button variant="inventory" icon={Plus} onClick={() => setForm({ ...BLANK })}>Add supplier</Button>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Suppliers" value={suppliers.length} hint={`${suppliers.filter((x) => x.active === false).length} inactive`} icon={Building2} color="blue" />
        <Stat label="Active" value={suppliers.filter((x) => x.active !== false).length} hint="Shown in RFQ & PO" icon={CheckCircle2} color="teal" />
        <Stat label="Open POs" value={openPos} hint="Awaiting delivery" icon={Truck} color="orange" />
        <Stat label="Total purchase value" value={`₹ ${fmtNum(Math.round(totalValue))}`} hint="All purchase orders" icon={IndianRupee} color="red" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-white/[0.06]">
          <div className="flex flex-wrap gap-2">
            {[['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']].map(([k, l]) => (
              <button key={k} onClick={() => setStatus(k)}
                className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', status === k ? 'bg-prod-500 text-white' : 'text-slate-500 hover:bg-prod-50 hover:text-prod-500 dark:hover:bg-white/[0.06]')}>{l}</button>
            ))}
            <select className={cx(inputCls, 'h-8 w-auto py-0 text-xs')} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
              <option value="All">All categories</option>
              {MATERIAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="relative lg:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={cx(inputCls, 'pl-9')} placeholder="Search name, contact, city, GSTIN…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Table
          rows={rows}
          empty={{ icon: Building2, title: 'No suppliers found', text: 'Change the filter or add a supplier.' }}
          onRowClick={(x) => setViewing(x.id)}
          columns={[
            { key: 'name', label: 'Supplier', render: (x) => (
              <div>
                <div className="font-semibold">{x.name}{x.active === false && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">Inactive</span>}</div>
                <div className="flex items-center gap-1 text-[0.6875rem] text-slate-400"><Mono>{x.id}</Mono>{x.city && <><span>·</span><MapPin size={11} />{x.city}</>}</div>
              </div>
            ) },
            { key: 'contact', label: 'Contact', render: (x) => (
              <div className="text-xs">
                <div className="font-medium text-slate-700 dark:text-slate-200">{x.contact || '—'}</div>
                {x.phone && <div className="flex items-center gap-1 text-slate-500"><Phone size={11} />{x.phone}</div>}
                {x.email && <div className="flex items-center gap-1 text-slate-500"><Mail size={11} />{x.email}</div>}
              </div>
            ) },
            { key: 'cat', label: 'Supplies', render: (x) => (
              <div className="flex max-w-[12rem] flex-wrap gap-1">
                {(x.categories || []).length ? x.categories.map((c) => <span key={c} className="rounded bg-prod-50 px-1.5 py-0.5 text-[0.6875rem] font-medium text-prod-600 dark:bg-white/[0.06] dark:text-prod-200">{c}</span>) : <span className="text-xs text-slate-400">—</span>}
              </div>
            ) },
            { key: 'terms', label: 'Terms', render: (x) => <div className="text-xs"><div>{x.paymentTerms || '—'}</div><div className="text-slate-500">{x.leadDays ? `${x.leadDays} days lead time` : ''}</div></div> },
            { key: 'rating', label: 'Rating', render: (x) => <Stars value={x.rating || 0} /> },
            { key: 'act', label: 'Purchases', align: 'right', render: (x) => {
              const st = stats(x.name);
              return <div className="text-xs"><div className="font-semibold tabular">₹ {fmtNum(Math.round(st.value))}</div><div className="text-slate-500">{st.pos.length} PO{st.pos.length === 1 ? '' : 's'}{st.open.length ? ` · ${st.open.length} open` : ''}</div></div>;
            } },
            { key: 'a', label: 'Actions', align: 'right', render: (x) => (
              <span onClick={(e) => e.stopPropagation()}>
                <RowActions onView={() => setViewing(x.id)} onEdit={() => setForm({ ...BLANK, ...x })} onDelete={() => setDeleting(x)} />
              </span>
            ) },
          ]}
        />
      </Card>

      {/* Add / edit */}
      <Modal open={!!form} onClose={() => setForm(null)} width="max-w-2xl" title={form?.id ? `Edit supplier · ${form.id}` : 'Add supplier'}
        subtitle={form?.id ? 'Renaming updates the name on POs, RFQs and materials.' : 'New suppliers appear in RFQ and purchase order screens.'}
        footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button variant="inventory" icon={form?.id ? Save : Plus} disabled={!canSave} onClick={save}>{form?.id ? 'Save changes' : 'Add supplier'}</Button></>}>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionTitle>Company</SectionTitle>
            <Field label="Supplier name *" className="sm:col-span-2">
              <input className={cx(inputCls, dup && 'border-rose-400')} value={form.name} onChange={set('name')} placeholder="e.g. Gujarat Alkalies Ltd." autoFocus />
              {dup && <span className="mt-1 block text-[0.6875rem] font-semibold text-rose-600">A supplier with this name already exists.</span>}
            </Field>
            <Field label="GSTIN">
              <input className={cx(inputCls, 'uppercase', gstBad && 'border-rose-400')} value={form.gstin} onChange={set('gstin')} placeholder="24AAACG1234F1Z5" maxLength={15} />
              {gstBad && <span className="mt-1 block text-[0.6875rem] font-semibold text-rose-600">GSTIN should be 15 characters, e.g. 24AAACG1234F1Z5</span>}
            </Field>
            <Field label="City"><input className={inputCls} value={form.city} onChange={set('city')} placeholder="e.g. Vadodara" /></Field>
            <Field label="Address" className="sm:col-span-2"><input className={inputCls} value={form.address} onChange={set('address')} placeholder="Street, area, PIN" /></Field>

            <SectionTitle>Contact</SectionTitle>
            <Field label="Contact person"><input className={inputCls} value={form.contact} onChange={set('contact')} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+91 …" /></Field>
            <Field label="Email" className="sm:col-span-2">
              <input className={cx(inputCls, emailBad && 'border-rose-400')} value={form.email} onChange={set('email')} placeholder="sales@supplier.com" />
              {emailBad && <span className="mt-1 block text-[0.6875rem] font-semibold text-rose-600">Enter a valid email address.</span>}
            </Field>

            <SectionTitle>Purchase</SectionTitle>
            <div className="sm:col-span-2">
              <div className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Material categories supplied</div>
              <div className="flex flex-wrap gap-1.5">
                {MATERIAL_CATEGORIES.map((c) => {
                  const on = form.categories.includes(c);
                  return (
                    <button key={c} type="button" onClick={() => setForm({ ...form, categories: on ? form.categories.filter((x) => x !== c) : [...form.categories, c] })}
                      className={cx('rounded-full border px-3 py-1 text-xs font-semibold transition', on ? 'border-prod-500 bg-prod-500 text-white' : 'border-slate-200 text-slate-500 hover:border-prod-300 dark:border-white/10')}>{c}</button>
                  );
                })}
              </div>
            </div>
            <Field label="Payment terms">
              <select className={inputCls} value={form.paymentTerms} onChange={set('paymentTerms')}>{[...new Set([form.paymentTerms, ...TERMS])].filter(Boolean).map((t) => <option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="Lead time (days)"><input type="number" min="0" className={inputCls} value={form.leadDays} onChange={set('leadDays')} /></Field>
            <Field label="Rating"><div className="flex h-10 items-center"><Stars value={Number(form.rating) || 0} onChange={(n) => setForm({ ...form, rating: n })} size={20} /></div></Field>
            <Field label="Notes"><input className={inputCls} value={form.notes} onChange={set('notes')} placeholder="Optional" /></Field>
          </div>
        )}
      </Modal>

      {/* View */}
      {viewSup && (() => {
        const st = stats(viewSup.name);
        return (
          <DetailModal open onClose={() => setViewing(null)} width="max-w-3xl" title={viewSup.name} subtitle={`${viewSup.id}${viewSup.city ? ` · ${viewSup.city}` : ''}${viewSup.active === false ? ' · Inactive' : ''}`}
            fields={[
              ['Contact person', viewSup.contact || '—'], ['Phone', viewSup.phone || '—'], ['Email', viewSup.email || '—'], ['GSTIN', viewSup.gstin || '—'],
              ['Payment terms', viewSup.paymentTerms || '—'], ['Lead time', viewSup.leadDays ? `${viewSup.leadDays} days` : '—'],
              ['Rating', <Stars key="r" value={viewSup.rating || 0} />], ['Supplies', (viewSup.categories || []).join(', ') || '—'],
              ['Address', viewSup.address || '—'], ['Notes', viewSup.notes || '—'],
            ]}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Mini label="Purchase orders" value={st.pos.length} />
              <Mini label="Total value" value={`₹ ${fmtNum(Math.round(st.value))}`} />
              <Mini label="Preferred for materials" value={st.materials.length} />
            </div>
            <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Purchase orders</div>
            <div className="mt-2 overflow-hidden rounded-lg border border-line dark:border-white/[0.07]">
              {st.pos.length === 0 ? <div className="p-4 text-center text-sm text-slate-400">No purchase orders yet</div>
                : st.pos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-line px-3 py-2 text-sm last:border-0 dark:border-white/[0.05]">
                    <span className="flex items-center gap-2"><FileText size={14} className="text-slate-400" /><Mono>{p.id}</Mono><span className="text-xs text-slate-500">{fmtDate(p.date)}</span></span>
                    <span className="flex items-center gap-3"><b className="tabular">₹ {fmtNum(Math.round(poValue(p.items)))}</b><Badge status={p.status} /></span>
                  </div>
                ))}
            </div>
            {st.materials.length > 0 && (
              <>
                <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Preferred supplier for</div>
                <div className="mt-2 flex flex-wrap gap-1.5">{st.materials.map((m) => <span key={m.code} className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/[0.06]">{m.name}</span>)}</div>
              </>
            )}
          </DetailModal>
        );
      })()}

      {/* Delete / deactivate */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} width="max-w-md" title={delBlocked ? 'Supplier is in use' : 'Delete supplier?'}
        footer={deleting && (
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            {deleting.active === false
              ? <Button variant="soft" icon={RotateCcw} onClick={() => { dispatch('SET_SUPPLIER_ACTIVE', { id: deleting.id, active: true }); toast(`${deleting.name} activated`); setDeleting(null); }}>Activate</Button>
              : <Button variant="soft" icon={Archive} onClick={() => { dispatch('SET_SUPPLIER_ACTIVE', { id: deleting.id, active: false }); toast(`${deleting.name} deactivated`); setDeleting(null); }}>Deactivate</Button>}
            {!delBlocked && <Button className="bg-rose-600 hover:bg-rose-700" icon={Trash2} onClick={() => { dispatch('DELETE_SUPPLIER', { id: deleting.id }); toast(`${deleting.name} deleted`); setDeleting(null); }}>Delete</Button>}
          </>
        )}>
        {deleting && (
          <div className="flex gap-3">
            <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-full', delBlocked ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600')}><AlertTriangle size={19} /></span>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {delBlocked ? (
                <>
                  <b>{deleting.name}</b> is used in {delInfo.pos.length} purchase order(s) and {delInfo.rfqs.length} RFQ(s), so it can't be deleted.
                  {deleting.active === false ? ' It is already inactive.' : ' Deactivate it instead: it stays on old records but is hidden from new RFQs and POs.'}
                </>
              ) : (
                <>
                  <b>{deleting.name}</b> will be removed from the Supplier Master.
                  {delInfo.materials.length > 0 && <> It is the preferred supplier for {delInfo.materials.length} material(s); that field will be cleared.</>}
                  {' '}You can also just deactivate it.
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function SectionTitle({ children }) {
  return <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 sm:col-span-2">{children}</div>;
}
function Mini({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.03]">
      <div className="text-[0.6562rem] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
