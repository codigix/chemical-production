import { useState } from 'react';
import { Inbox, ShoppingCart, PackageMinus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStore, available } from '../../store/StoreContext';
import { Card, PageHeader, Button, Badge, Mono, Table, Stat, fmtDateTime, cx } from '../../components/ui';
import RequestItems from '../../components/RequestItems';
import { navigate } from '../../router';
import { RequestRowActions } from '../../components/rowActions';

export default function ProductionRequests() {
  const { state } = useStore();
  const [view, setView] = useState('open');
  const isOpen = (r) => ['Pending', 'PO Raised'].includes(r.status);
  const rows = state.requests.filter((r) => (view === 'open' ? isOpen(r) : true));
  const mat = (c) => state.materials.find((m) => m.code === c);
  const canFulfil = (r) => r.items.every((it) => available(mat(it.code)) >= it.qty);

  return (
    <>
      <PageHeader module="inventory" icon={Inbox} title="Production Material Requests" subtitle="Inbox of purchase requirements and pull out requests coming from Production." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Waiting on Inventory" value={state.requests.filter((r) => r.status === 'Pending').length} icon={Inbox} color="red" />
        <Stat label="Purchase in progress" value={state.requests.filter((r) => r.status === 'PO Raised').length} icon={ShoppingCart} color="orange" />
        <Stat label="Completed" value={state.requests.filter((r) => !isOpen(r)).length} icon={CheckCircle2} color="teal" />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-white/[0.06]">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-white/[0.05]">
            {[['open', 'Open'], ['all', 'All requests']].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', view === k ? 'bg-white shadow-sm dark:bg-ink-800' : 'text-slate-500')}>{l}</button>
            ))}
          </div>
        </div>
        <Table
          rows={rows}
          empty={{ icon: Inbox, title: 'Inbox zero', text: 'No open requests from Production right now.' }}
          columns={[
            { key: 'id', label: 'Request', render: (r) => <Mono>{r.id}</Mono> },
            { key: 'type', label: 'Type', render: (r) => <Badge status={r.type} /> },
            { key: 'order', label: 'Order', render: (r) => <Mono className="text-prod-600">{r.orderId}</Mono> },
            { key: 'items', label: 'Materials', render: (r) => <RequestItems items={r.items} max={3} /> },
            { key: 'stock', label: 'Stock', render: (r) => r.type === 'PULL_OUT' && r.status === 'Pending'
              ? (canFulfil(r)
                ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={13} />Can issue</span>
                : <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><AlertTriangle size={13} />Insufficient</span>)
              : <span className="text-slate-300">—</span> },
            { key: 'at', label: 'Raised', render: (r) => <span className="whitespace-nowrap text-slate-500">{fmtDateTime(r.createdAt)}</span> },
            { key: 'st', label: 'Status', render: (r) => <Badge status={r.status} /> },
            { key: 'a', label: 'Actions', align: 'right', render: (r) => (
              <div className="flex items-center justify-end gap-2">
                {r.status === 'Pending' && (r.type === 'PURCHASE'
                  ? <Button size="sm" variant="warn" icon={ShoppingCart} onClick={() => navigate('inventory/purchase')}>Raise PO</Button>
                  : <Button size="sm" variant="inventory" icon={PackageMinus} onClick={() => navigate('inventory/pull-out')}>Issue</Button>)}
                <RequestRowActions req={r} />
              </div>
            ) },
          ]}
        />
      </Card>
    </>
  );
}
