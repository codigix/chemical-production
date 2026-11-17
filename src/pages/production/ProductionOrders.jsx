import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Search, Gauge, PackageCheck, FileCheck2, Eye } from 'lucide-react';
import { useStore, requirementFor } from '../../store/StoreContext';
import { Card, PageHeader, Button, Badge, Table, Modal, Field, Mono, inputCls, fmtDate, fmtNum, cx, useToast } from '../../components/ui';
import OrderFlow from '../../components/OrderFlow';
import OrderDetail from '../../components/OrderDetail';
import { navigate } from '../../router';

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
  const [form, setForm] = useState({ sopId: state.sops[0]?.id, batches: 1, plannedDate: today, priority: 'Medium' });

  useEffect(() => { if (params.new) setCreating(true); }, [params.new]);

  const sopOf = (o) => state.sops.find((s) => s.id === o.sopId);
  const rows = useMemo(() => state.orders.filter((o) => {
    const f = filter === 'All' || (filter === 'In progress' ? IN_PROGRESS.includes(o.status) : o.status === filter);
    const s = !q || `${o.id} ${sopOf(o)?.product}`.toLowerCase().includes(q.toLowerCase());
    return f && s;
  }), [state.orders, filter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = requirementFor(state, { ...form, batches: Number(form.batches) || 0 });
  const formSop = state.sops.find((s) => s.id === form.sopId);

  const create = () => {
    dispatch('CREATE_ORDER', form);
    setCreating(false);
    toast('Production order created');
  };

  const action = (o) => {
    if (['Draft', 'Shortage', 'Ready'].includes(o.status))
      return <Button size="sm" variant="production" icon={Gauge} onClick={() => navigate('production/rm-stock', { order: o.id })}>Check RM</Button>;
    if (o.status === 'Material Issued')
      return <Button size="sm" variant="production" icon={PackageCheck} onClick={() => navigate('production/pull-out')}>Verify</Button>;
    if (o.status === 'Production Verified')
      return <Button size="sm" variant="production" icon={FileCheck2} onClick={() => navigate('production/sop-submission')}>Submit SOP</Button>;
    return <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewing(o.id)}>View</Button>;
  };

  const countFor = (f) => f === 'All' ? state.orders.length : f === 'In progress' ? state.orders.filter((o) => IN_PROGRESS.includes(o.status)).length : state.orders.filter((o) => o.status === f).length;

  return (
    <>
      <PageHeader module="production" icon={ClipboardList} title="Production Orders" subtitle="Plan production against an SOP and push it through the material workflow."
        actions={<Button variant="production" icon={Plus} onClick={() => setCreating(true)}>New production order</Button>} />

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
            { key: 'act', label: '', align: 'right', render: action },
          ]}
        />
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="New production order" subtitle="Pick an SOP; the raw material requirement is calculated for you." width="max-w-2xl"
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button variant="production" icon={Plus} onClick={create} disabled={!form.sopId || form.batches < 1}>Create order</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SOP / Product" className="sm:col-span-2">
            <select className={inputCls} value={form.sopId} onChange={(e) => setForm({ ...form, sopId: e.target.value })}>
              {state.sops.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.product} ({s.version})</option>)}
            </select>
          </Field>
          <Field label="Number of batches" hint={formSop ? `1 batch = ${fmtNum(formSop.batchSize)} ${formSop.unit}` : ''}>
            <input type="number" min="1" className={inputCls} value={form.batches} onChange={(e) => setForm({ ...form, batches: e.target.value })} />
          </Field>
          <Field label="Planned date">
            <input type="date" className={inputCls} value={form.plannedDate} onChange={(e) => setForm({ ...form, plannedDate: e.target.value })} />
          </Field>
          <Field label="Priority" className="sm:col-span-2">
            <div className="grid grid-cols-3 gap-2">
              {['Low', 'Medium', 'High'].map((p) => (
                <button key={p} type="button" onClick={() => setForm({ ...form, priority: p })}
                  className={cx('h-10 rounded-lg border text-sm font-semibold transition', form.priority === p ? 'border-prod-500 bg-prod-50 text-prod-700 ring-4 ring-prod-500/10 dark:bg-prod-500/10 dark:text-prod-100' : 'border-slate-200 text-slate-500 dark:border-white/10')}>{p}</button>
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-5 rounded-lg bg-slate-50 p-4 dark:bg-white/[0.03]">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Requirement preview</div>
          {preview.map((l) => (
            <div key={l.code} className="flex items-center justify-between py-1.5 text-sm">
              <span>{l.name}</span>
              <span className={cx('tabular font-semibold', l.shortage > 0 && 'text-rose-600')}>
                {fmtNum(l.required)} {l.unit}{l.shortage > 0 && <span className="ml-2 text-xs font-medium">(short {fmtNum(l.shortage)})</span>}
              </span>
            </div>
          ))}
        </div>
      </Modal>

      {viewing && <OrderDetail orderId={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
