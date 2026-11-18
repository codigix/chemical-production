import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Search, PackagePlus, Truck, CheckCircle2, IndianRupee, AlertTriangle } from 'lucide-react';
import { Card, PageHeader, Button, Badge, Mono, Table, Stat, inputCls, fmtNum, fmtDate, cx } from '../../components/ui';
import RequestItems from '../../components/RequestItems';
import { navigate } from '../../router';
import { PurchaseRowActions } from '../../components/rowActions';
import { usePurchaseFlow, PurchaseSteps, poValue } from '../../components/purchase';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'Ordered', label: 'Open · to receive' },
  { key: 'Received', label: 'Received' },
];

/* Step 3 of purchasing: purchase orders → receive through GRN */
export default function PurchaseOrders({ params = {} }) {
  const { state, openPoBlank, modals } = usePurchaseFlow();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState(params.q || '');
  useEffect(() => { if (params.q) setQ(params.q); }, [params.q]);
  const today = new Date().toISOString().slice(0, 10);
  const pos = state.purchases;

  const rows = useMemo(() => pos.filter((p) => (tab === 'all' || p.status === tab)
    && (!q || `${p.id} ${p.supplier} ${p.reqId || ''} ${p.rfqId || ''} ${p.grnNo || ''} ${p.items.map((it) => state.materials.find((m) => m.code === it.code)?.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()))),
  [pos, tab, q, state.materials]);
  const count = (k) => (k === 'all' ? pos.length : pos.filter((p) => p.status === k).length);
  const open = pos.filter((p) => p.status === 'Ordered');
  const late = open.filter((p) => p.expected && p.expected < today).length;
  const openValue = open.reduce((t, p) => t + poValue(p.items), 0);

  return (
    <>
      <PageHeader module="inventory" icon={FileText} title="Purchase Orders" subtitle="Every purchase order, from RFQ or direct. Receive goods through GRN to add stock."
        actions={<Button variant="inventory" icon={Plus} onClick={openPoBlank}>New purchase order</Button>} />

      <PurchaseSteps active="po" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total POs" value={pos.length} hint={`${pos.filter((p) => p.rfqId).length} from RFQ`} icon={FileText} color="blue" />
        <Stat label="Open · to receive" value={open.length} hint={late ? `${late} past expected date` : 'Awaiting delivery'} icon={Truck} color="orange" />
        <Stat label="Received" value={count('Received')} hint="GRN posted, stock added" icon={CheckCircle2} color="teal" />
        <Stat label="Open PO value" value={`₹ ${fmtNum(Math.round(openValue))}`} hint="Not yet received" icon={IndianRupee} color="red" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-white/[0.06]">
          <div className="flex gap-1.5 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cx('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  tab === t.key ? 'bg-prod-500 text-white' : 'text-slate-500 hover:bg-prod-50 hover:text-prod-500 dark:hover:bg-white/[0.06]')}>
                {t.label}<span className={cx('rounded px-1 text-[0.625rem]', tab === t.key ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/[0.06]')}>{count(t.key)}</span>
              </button>
            ))}
          </div>
          <div className="relative lg:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={cx(inputCls, 'pl-9')} placeholder="Search PO, supplier, material, RFQ" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Table
          rows={rows}
          empty={{ icon: FileText, title: pos.length ? 'No purchase orders match' : 'No purchase orders yet', text: 'Raise one from a compared RFQ, or click New purchase order.' }}
          columns={[
            { key: 'id', label: 'PO', render: (p) => <div><Mono>{p.id}</Mono><div className="text-[0.6875rem] text-slate-400">{fmtDate(p.date)}</div></div> },
            { key: 'supplier', label: 'Supplier', render: (p) => <span className="font-medium">{p.supplier}</span> },
            { key: 'items', label: 'Materials', render: (p) => <RequestItems items={p.items} max={2} /> },
            { key: 'val', label: 'Value', align: 'right', render: (p) => <span className="tabular font-semibold">₹ {fmtNum(Math.round(poValue(p.items)))}</span> },
            { key: 'src', label: 'Source', render: (p) => (
              <div className="space-y-0.5">
                {p.rfqId ? <button onClick={() => navigate('inventory/rfq')} className="block"><Mono className="text-prod-600 hover:underline">{p.rfqId}</Mono></button> : null}
                {p.reqId ? <Mono className="block text-slate-500">{p.reqId}</Mono> : null}
                {!p.rfqId && !p.reqId && <span className="text-xs text-slate-400">Direct</span>}
              </div>
            ) },
            { key: 'exp', label: 'Expected', render: (p) => {
              const isLate = p.status === 'Ordered' && p.expected && p.expected < today;
              return <span className={cx('whitespace-nowrap', isLate && 'font-semibold text-rose-600')}>{isLate && <AlertTriangle size={12} className="mr-1 inline" />}{fmtDate(p.expected)}</span>;
            } },
            { key: 'st', label: 'Status', render: (p) => <Badge status={p.status} /> },
            { key: 'a', label: 'Actions', align: 'right', render: (p) => (
              <div className="flex items-center justify-end gap-2">
                {p.status === 'Ordered'
                  ? <Button size="sm" variant="inventory" icon={PackagePlus} onClick={() => navigate('inventory/stock-in', { po: p.id })}>Receive GRN</Button>
                  : <Mono className="text-emerald-600">{p.grnNo}</Mono>}
                <PurchaseRowActions po={p} />
              </div>
            ) },
          ]}
        />
      </Card>

      {modals}
    </>
  );
}
