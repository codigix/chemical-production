import { useMemo, useState } from 'react';
import { Send, Plus, Search, Scale, FileText, Trash2, Eye, Hourglass, CheckCircle2, Trophy, CalendarClock } from 'lucide-react';
import { Card, PageHeader, Button, Badge, Mono, EmptyState, Stat, inputCls, fmtNum, fmtDate, fmtDateTime, cx } from '../../components/ui';
import { ConfirmDialog } from '../../components/actions';
import RequestItems from '../../components/RequestItems';
import { navigate } from '../../router';
import { usePurchaseFlow, PurchaseSteps } from '../../components/purchase';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'Sent', label: 'Awaiting quotes' },
  { key: 'Quoted', label: 'Ready to compare' },
  { key: 'PO Raised', label: 'Converted to PO' },
];

/* Step 2 of purchasing: RFQs sent to suppliers, quotes entered and compared, L1 → PO */
export default function RfqQuotation() {
  const { state, dispatch, toast, rfqs, quoteTotal, openRfqBlank, openQuotes, modals } = usePurchaseFlow();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [cancelling, setCancelling] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const product = (reqId) => {
    const r = state.requests.find((x) => x.id === reqId);
    return state.sops.find((s) => s.id === state.orders.find((o) => o.id === r?.orderId)?.sopId)?.product;
  };

  const rows = useMemo(() => rfqs.filter((x) => (tab === 'all' || x.status === tab)
    && (!q || `${x.id} ${x.reqId || ''} ${x.suppliers.join(' ')} ${x.items.map((it) => state.materials.find((m) => m.code === it.code)?.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()))),
  [rfqs, tab, q, state.materials]);
  const count = (k) => (k === 'all' ? rfqs.length : rfqs.filter((x) => x.status === k).length);
  const overdue = rfqs.filter((x) => x.status === 'Sent' && x.dueDate < today).length;
  const savings = rfqs.filter((x) => x.status === 'PO Raised').reduce((t, x) => {
    const totals = x.suppliers.map((s) => quoteTotal(x, s, x.quotes || {})).filter((v) => v != null);
    return totals.length > 1 ? t + (Math.max(...totals) - Math.min(...totals)) : t;
  }, 0);

  return (
    <>
      <PageHeader module="inventory" icon={Send} title="RFQ & Quotation" subtitle="Send requests for quotation to suppliers, enter their quotes, compare side by side and raise the PO with the best one."
        actions={<Button variant="inventory" icon={Plus} onClick={openRfqBlank}>New RFQ</Button>} />

      <PurchaseSteps active="rfq" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Awaiting quotes" value={count('Sent')} hint={overdue ? `${overdue} past due date` : 'Sent to suppliers'} icon={Hourglass} color="orange" />
        <Stat label="Ready to compare" value={count('Quoted')} hint="Quotes received" icon={Scale} color="blue" />
        <Stat label="Converted to PO" value={count('PO Raised')} hint="Supplier selected" icon={CheckCircle2} color="teal" />
        <Stat label="Saved by comparing" value={`₹ ${fmtNum(Math.round(savings))}`} hint="Highest vs selected quote" icon={Trophy} color="red" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1.5 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cx('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                tab === t.key ? 'bg-prod-500 text-white' : 'bg-white text-slate-500 hover:text-prod-500 dark:bg-ink-900')}>
              {t.label}<span className={cx('rounded px-1 text-[0.625rem]', tab === t.key ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/[0.06]')}>{count(t.key)}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={cx(inputCls, 'pl-9')} placeholder="Search RFQ, supplier or material" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {rows.length === 0 ? (
        <Card><EmptyState icon={Send} title={rfqs.length ? 'No RFQs match' : 'No RFQs yet'} text="Create an RFQ from a purchase requirement, or click New RFQ." /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((x) => {
            const totals = Object.fromEntries(x.suppliers.map((s) => [s, quoteTotal(x, s, x.quotes || {})]));
            const vals = Object.values(totals).filter((v) => v != null);
            const best = vals.length ? Math.min(...vals) : null;
            const n = vals.length;
            const late = x.status === 'Sent' && x.dueDate < today;
            const daysLeft = Math.ceil((new Date(x.dueDate) - new Date(today)) / 864e5);
            return (
              <Card key={x.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><Mono>{x.id}</Mono>{x.reqId && <><span className="text-slate-300">·</span><Mono className="text-prod-600">{x.reqId}</Mono></>}</div>
                    <div className="mt-1 text-sm font-semibold">{x.reqId ? product(x.reqId) || 'Purchase requirement' : 'Direct RFQ'}</div>
                    <div className="text-xs text-slate-500">Sent {fmtDateTime(x.date)}</div>
                  </div>
                  <Badge status={x.status} />
                </div>
                <div className="mt-3"><RequestItems items={x.items} max={4} /></div>

                {/* Supplier quote status */}
                <div className="mt-4 overflow-hidden rounded-lg border border-line dark:border-white/[0.07]">
                  {x.suppliers.map((s) => {
                    const t = totals[s];
                    const isBest = t != null && t === best && n > 0;
                    return (
                      <div key={s} className={cx('flex items-center justify-between border-b border-line px-3 py-2 text-sm last:border-0 dark:border-white/[0.05]', x.selected === s && 'bg-emerald-50/70 dark:bg-emerald-500/10')}>
                        <span className="flex items-center gap-2">
                          <span className={cx('h-2 w-2 rounded-full', t != null ? 'bg-emerald-500' : 'bg-amber-400')} />
                          {s}
                          {x.selected === s && <span className="rounded bg-emerald-500 px-1.5 text-[0.625rem] font-bold text-white">Selected</span>}
                        </span>
                        {t != null
                          ? <span className="tabular font-semibold">₹ {fmtNum(Math.round(t))}{isBest && <span className="ml-1.5 rounded bg-emerald-50 px-1.5 text-[0.625rem] font-bold text-emerald-700">L1</span>}</span>
                          : <span className="text-xs text-amber-600">Awaiting quote</span>}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className={cx('inline-flex items-center gap-1', late ? 'font-semibold text-rose-600' : 'text-slate-500')}>
                    <CalendarClock size={13} />Due {fmtDate(x.dueDate)}{x.status === 'Sent' && (late ? ' · overdue' : daysLeft === 0 ? ' · today' : ` · ${daysLeft}d left`)}
                  </span>
                  <span className="text-slate-500">{n}/{x.suppliers.length} quoted</span>
                </div>

                <div className="mt-auto flex items-center gap-2 pt-4">
                  {x.status === 'PO Raised' ? (
                    <>
                      <Button variant="ghost" icon={Eye} className="flex-1" onClick={() => openQuotes(x)}>View quotes</Button>
                      <Button variant="inventory" icon={FileText} className="flex-1" onClick={() => navigate('inventory/purchase-orders', { q: x.poId })}>{x.poId}</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="inventory" icon={n ? Scale : FileText} className="flex-1" onClick={() => openQuotes(x)}>{n ? `Compare ${n} quote${n > 1 ? 's' : ''} & raise PO` : 'Enter supplier quotes'}</Button>
                      <button title="Cancel RFQ" onClick={() => setCancelling(x)} className="grid h-10 w-10 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10"><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel RFQ?"
        message={cancelling && <>RFQ <b>{cancelling.id}</b> and its quotes will be removed. {cancelling.reqId && <>Requirement <b>{cancelling.reqId}</b> goes back to “Need an RFQ”.</>}</>}
        onConfirm={() => { dispatch('DELETE_RFQ', { rfqId: cancelling.id }); toast(`${cancelling.id} cancelled`); }} />
      {modals}
    </>
  );
}
