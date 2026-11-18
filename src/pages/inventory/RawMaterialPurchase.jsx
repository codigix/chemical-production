import { ShoppingCart, FileText, Send, Scale, AlertTriangle, ClipboardList, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardHeader, PageHeader, Button, Badge, Mono, Table, EmptyState, Stat, fmtDateTime, cx } from '../../components/ui';
import RequestItems from '../../components/RequestItems';
import { navigate } from '../../router';
import { RequestRowActions } from '../../components/rowActions';
import { usePurchaseFlow, PurchaseSteps } from '../../components/purchase';

/* Step 1 of purchasing: requirements from Production → create RFQ (or PO directly) */
export default function RawMaterialPurchase() {
  const { state, rfqs, openRfqFromReq, openQuotes, openPoFromReq, modals } = usePurchaseFlow();
  const purchaseReqs = state.requests.filter((r) => r.type === 'PURCHASE');
  const pending = purchaseReqs.filter((r) => r.status === 'Pending');
  const done = purchaseReqs.filter((r) => r.status !== 'Pending');
  const rfqOf = (r) => rfqs.find((x) => x.id === r.rfqId);
  const product = (orderId) => state.sops.find((s) => s.id === state.orders.find((o) => o.id === orderId)?.sopId)?.product;
  const noRfq = pending.filter((r) => !rfqOf(r)).length;
  const inRfq = pending.filter((r) => rfqOf(r)).length;

  return (
    <>
      <PageHeader module="inventory" icon={ShoppingCart} title="Raw Material Purchase" subtitle="Purchase requirements from Production. Send an RFQ to suppliers, compare quotes, then raise the PO."
        actions={<Button variant="ghost" icon={Send} onClick={() => navigate('inventory/rfq')}>Go to RFQ & Quotation</Button>} />

      <PurchaseSteps active="req" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open requirements" value={pending.length} hint="Waiting for a PO" icon={AlertTriangle} color="orange" />
        <Stat label="Need an RFQ" value={noRfq} hint="Not sent to suppliers yet" icon={ClipboardList} color="red" />
        <Stat label="In RFQ" value={inRfq} hint="Quotes being collected" icon={Send} color="blue" />
        <Stat label="PO raised" value={done.length} hint="Requirement closed" icon={CheckCircle2} color="teal" />
      </div>

      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
        <AlertTriangle size={15} className="text-amber-500" /> Open requirements · {pending.length}
      </h2>
      {pending.length === 0 ? (
        <Card className="mb-8"><EmptyState icon={ShoppingCart} title="No open requirements" text="When Production finds a shortage, the requirement lands here." /></Card>
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pending.map((r) => {
            const rfq = rfqOf(r);
            const n = rfq ? Object.keys(rfq.quotes || {}).length : 0;
            const stage = !rfq ? 0 : n ? 2 : 1;
            return (
              <Card key={r.id} className={cx('flex flex-col border-l-4 p-5', stage === 0 ? 'border-l-amber-400' : stage === 1 ? 'border-l-sky-400' : 'border-l-emerald-400')}>
                <div className="flex items-center justify-between"><Mono>{r.id}</Mono><RequestRowActions req={r} /></div>
                <div className="mt-1 text-sm font-semibold">{product(r.orderId) || '—'}</div>
                <div className="text-xs text-slate-500">Order <Mono className="text-prod-600">{r.orderId}</Mono> · {fmtDateTime(r.createdAt)}</div>
                <div className="mt-3"><RequestItems items={r.items} /></div>

                {/* RFQ → Quotes → PO tracker */}
                <div className="mt-4 flex items-center gap-1.5 text-[0.6875rem] font-semibold">
                  {['RFQ sent', 'Quotes in', 'PO'].map((st, i) => (
                    <span key={st} className="flex items-center gap-1.5">
                      {i > 0 && <span className={cx('h-px w-4', i <= stage ? 'bg-emerald-400' : 'bg-slate-300')} />}
                      <span className={cx('rounded-full px-2 py-0.5', i < stage ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10' : i === stage ? 'bg-prod-50 text-prod-600 ring-1 ring-prod-500/30 dark:bg-white/[0.06]' : 'bg-slate-100 text-slate-400 dark:bg-white/[0.04]')}>{i < stage ? '✓ ' : ''}{st}</span>
                    </span>
                  ))}
                </div>
                {rfq && <div className="mt-2 text-[0.6875rem] text-slate-500"><Mono>{rfq.id}</Mono> · {n}/{rfq.suppliers.length} suppliers quoted</div>}

                <div className="mt-auto pt-4">
                  {!rfq
                    ? <Button variant="inventory" icon={Send} className="w-full" onClick={() => openRfqFromReq(r)}>Create RFQ</Button>
                    : <Button variant="inventory" icon={n ? Scale : FileText} className="w-full" onClick={() => openQuotes(rfq)}>{n ? 'Compare quotes & raise PO' : 'Enter supplier quotes'}</Button>}
                  {!rfq && <button onClick={() => openPoFromReq(r)} className="mt-2 w-full text-center text-[0.6875rem] font-semibold text-slate-400 hover:text-prod-500">Skip RFQ · raise PO directly</button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader title="Closed requirements" subtitle="Requirements that already have a purchase order" icon={CheckCircle2} tone="inventory"
          action={<button onClick={() => navigate('inventory/purchase-orders')} className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-prod-500 hover:underline">Purchase orders <ArrowRight size={14} /></button>} />
        <Table
          rows={done}
          empty={{ title: 'Nothing closed yet' }}
          columns={[
            { key: 'id', label: 'Requirement', render: (r) => <Mono>{r.id}</Mono> },
            { key: 'o', label: 'Order', render: (r) => <div><Mono className="text-prod-600">{r.orderId}</Mono><div className="text-xs text-slate-500">{product(r.orderId)}</div></div> },
            { key: 'i', label: 'Materials', render: (r) => <RequestItems items={r.items} max={3} /> },
            { key: 'rfq', label: 'RFQ', render: (r) => (r.rfqId ? <Mono>{r.rfqId}</Mono> : <span className="text-xs text-slate-400">Direct</span>) },
            { key: 'po', label: 'PO', render: (r) => (r.purchaseId ? <Mono className="text-emerald-600">{r.purchaseId}</Mono> : '—') },
            { key: 's', label: 'Status', render: (r) => <Badge status={r.status} /> },
          ]}
        />
      </Card>

      {modals}
    </>
  );
}
