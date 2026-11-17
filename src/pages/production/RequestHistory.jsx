import { useState } from 'react';
import { History, ShoppingCart, PackageOpen, Layers } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Card, PageHeader, Badge, Mono, Table, Stat, inputCls, fmtDateTime, cx } from '../../components/ui';
import RequestItems from '../../components/RequestItems';

export default function RequestHistory() {
  const { state } = useStore();
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const statuses = [...new Set(state.requests.map((r) => r.status))];
  const rows = state.requests.filter((r) => (type === 'ALL' || r.type === type) && (status === 'ALL' || r.status === status));

  return (
    <>
      <PageHeader module="production" icon={History} title="Material Request History" subtitle="Every purchase requirement and pull out request raised by Production." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="All requests" value={state.requests.length} icon={Layers} />
        <Stat label="Purchase requirements" value={state.requests.filter((r) => r.type === 'PURCHASE').length} icon={ShoppingCart} color="orange" />
        <Stat label="Pull out requests" value={state.requests.filter((r) => r.type === 'PULL_OUT').length} icon={PackageOpen} color="teal" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center dark:border-white/[0.06]">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-white/[0.05]">
            {[['ALL', 'All'], ['PURCHASE', 'Purchase'], ['PULL_OUT', 'Pull out']].map(([k, l]) => (
              <button key={k} onClick={() => setType(k)} className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', type === k ? 'bg-white shadow-sm dark:bg-ink-800' : 'text-slate-500')}>{l}</button>
            ))}
          </div>
          <select className={cx(inputCls, 'sm:w-56')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">All statuses</option>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <Table
          rows={rows}
          empty={{ icon: History, title: 'No requests yet', text: 'Requests appear when Production runs an RM check and sends a purchase requirement or pull out request.' }}
          columns={[
            { key: 'id', label: 'Request', render: (r) => <Mono>{r.id}</Mono> },
            { key: 'type', label: 'Type', render: (r) => <Badge status={r.type} /> },
            { key: 'order', label: 'Order', render: (r) => <Mono className="text-prod-600">{r.orderId}</Mono> },
            { key: 'items', label: 'Materials', render: (r) => <RequestItems items={r.items} max={3} /> },
            { key: 'link', label: 'Linked', render: (r) => (r.purchaseId ? <Mono className="text-inv-600">{r.purchaseId}</Mono> : <span className="text-slate-300">—</span>) },
            { key: 'created', label: 'Raised', render: (r) => <span className="whitespace-nowrap text-slate-500">{fmtDateTime(r.createdAt)}</span> },
            { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
          ]}
        />
      </Card>
    </>
  );
}
