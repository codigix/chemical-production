import { useState } from 'react';
import { Gauge, AlertTriangle, CheckCircle2, ShoppingCart, PackageOpen, Hourglass, ArrowRight, Boxes } from 'lucide-react';
import { useStore, requirementFor, available, ledgerBalance, ledgerEntries } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Button, Badge, Meter, Mono, EmptyState, Modal, fmtNum, fmtDate, cx, useToast } from '../../components/ui';
import { navigate } from '../../router';
import { RowActions, ConfirmDialog } from '../../components/actions';
import OrderDetail from '../../components/OrderDetail';
import { orderEditBlock } from '../../store/rules';

const CHECKABLE = ['Draft', 'Shortage', 'Ready', 'Awaiting Purchase'];

export default function RmStockAvailability({ params }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const queue = state.orders.filter((o) => CHECKABLE.includes(o.status));
  const [sel, setSel] = useState(params.order && queue.some((o) => o.id === params.order) ? params.order : queue[0]?.id);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const order = state.orders.find((o) => o.id === sel && CHECKABLE.includes(o.status)) || queue[0];
  const sop = order && state.sops.find((s) => s.id === order.sopId);
  const lines = order ? requirementFor(state, order) : [];
  const short = lines.some((l) => l.shortage > 0);
  /* Cross-check every line against the Stock Ledger */
  const checks = lines.map((l) => {
    const m = state.materials.find((x) => x.code === l.code);
    const ledger = ledgerBalance(state, l.code);
    const onHand = m?.onHand ?? 0;
    return { ...l, ledger, onHand, reserved: m?.reserved ?? 0, entries: ledgerEntries(state, l.code), ok: Math.abs(ledger - onHand) < 0.001 };
  });
  const ledgerOk = checks.every((c) => c.ok);
  const waiting = order?.status === 'Awaiting Purchase';

  const sendPurchase = () => {
    dispatch('CHECK_RM', { orderId: order.id });
    dispatch('SEND_PURCHASE_REQ', { orderId: order.id });
    toast('Purchase requirement sent to Inventory');
  };
  const [pullOpen, setPullOpen] = useState(false);
  const requestPull = () => {
    setPullOpen(false);
    const id = order.id;
    dispatch('CHECK_RM', { orderId: id });
    dispatch('REQUEST_PULL_OUT', { orderId: id });
    toast('Pull out request sent to Inventory');
    setSel(undefined);
  };

  return (
    <>
      <PageHeader module="production" icon={Gauge} title="RM Stock Availability" subtitle="Compare an order's raw material requirement with live Inventory stock." />

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Orders to check" subtitle={`${queue.length} waiting`} icon={Boxes} />
          {queue.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All clear" text="Every order has already moved past the RM check." />
          ) : (
            <div className="space-y-2 p-3">
              {queue.map((o) => {
                const s = state.sops.find((x) => x.id === o.sopId);
                const active = order?.id === o.id;
                return (
                  <button key={o.id} onClick={() => setSel(o.id)}
                    className={cx('w-full rounded-lg border p-3.5 text-left transition',
                      active ? 'border-prod-500 bg-prod-50/70 ring-4 ring-prod-500/10 dark:bg-prod-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/[0.07] dark:hover:border-white/20')}>
                    <div className="flex items-center justify-between"><Mono>{o.id}</Mono><Badge status={o.status} /></div>
                    <div className="mt-1.5 text-sm font-medium">{s?.product}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{o.batches} batch · due {fmtDate(o.plannedDate)}</div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {order ? (
          <div className="min-w-0 space-y-6">
            <div className={cx('relative overflow-hidden rounded-[10px] border p-5',
              waiting ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5'
                : short ? 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/5'
                  : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/5')}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white', waiting ? 'bg-amber-500' : short ? 'bg-rose-500' : 'bg-emerald-500')}>
                    {waiting ? <Hourglass size={20} /> : short ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                  </span>
                  <div>
                    <div className="text-lg font-bold">
                      {waiting ? 'Waiting for purchase' : short ? `Shortage on ${lines.filter((l) => l.shortage > 0).length} material(s)` : !ledgerOk ? 'Stock does not match the ledger' : 'All materials available · ledger verified'}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      <Mono>{order.id}</Mono> · {sop?.product} · {order.batches} × {fmtNum(sop?.batchSize)} {sop?.unit}
                      {waiting && <> · requirement <Mono>{order.purchaseReqId}</Mono> is with Inventory</>}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <RowActions onView={() => setViewing(order.id)} onEdit={() => navigate('production/orders', { edit: order.id })} onDelete={() => setDeleting(order)}
                    editBlock={orderEditBlock(order)} deleteBlock={orderEditBlock(order)} />
                  {waiting ? (
                    <Button variant="ghost" icon={ArrowRight} onClick={() => navigate('production/history')}>Track request</Button>
                  ) : short ? (
                    <Button variant="warn" icon={ShoppingCart} onClick={sendPurchase}>Send purchase requirement</Button>
                  ) : (
                    <Button variant="production" icon={PackageOpen} onClick={() => setPullOpen(true)} disabled={!ledgerOk}
                      title={ledgerOk ? undefined : 'Fix the stock ledger mismatch before requesting material'}>Request material pull out</Button>
                  )}
                </div>
              </div>
            </div>

            <Card>
              <CardHeader title="Requirement vs stock ledger" icon={Gauge}
                subtitle="Ledger stock = all IN − OUT in the Stock Ledger · Available = ledger stock − reserved for other orders"
                action={<span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', ledgerOk ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300')}>
                  {ledgerOk ? `Ledger verified · ${checks.length}/${checks.length}` : `${checks.filter((c) => !c.ok).length} ledger mismatch`}
                </span>} />
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full table-fixed text-left text-[0.8125rem]">
                  <thead>
                    <tr className="bg-prod-50/70 text-[0.75rem] font-semibold text-slate-700 dark:bg-white/[0.03] dark:text-slate-300">
                      <th className="w-[19%] px-3 py-2.5">Material</th>
                      <th className="w-[11%] px-3 py-2.5 text-right">Required</th>
                      <th className="w-[12%] px-3 py-2.5 text-right">Ledger stock</th>
                      <th className="w-[9%] px-3 py-2.5 text-right">Reserved</th>
                      <th className="w-[10%] px-3 py-2.5 text-right">Available</th>
                      <th className="w-[9%] px-3 py-2.5 text-right">Shortage</th>
                      <th className="w-[19%] px-3 py-2.5">Ledger check</th>
                      <th className="w-[11%] px-3 py-2.5">Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map((l) => (
                      <tr key={l.code} className="border-t border-line dark:border-white/[0.05]">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5"><Mono className="text-slate-400">{l.code}</Mono>
                            <span className={cx('rounded px-1 text-[0.625rem] font-bold', l.group === 'PM' ? 'bg-orange-50 text-orange-600' : 'bg-prod-50 text-prod-500')}>{l.group}</span></div>
                          <div className="font-medium">{l.name}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular font-semibold">{fmtNum(l.required)} <span className="text-xs font-normal text-slate-400">{l.unit}</span></td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular">{fmtNum(l.ledger)} <span className="text-xs text-slate-400">{l.unit}</span></td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular text-indigo-600">{l.reserved ? fmtNum(l.reserved) : <span className="text-slate-300">0</span>}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular font-semibold">{fmtNum(l.available)}</td>
                        <td className={cx('whitespace-nowrap px-3 py-3 text-right tabular font-semibold', l.shortage > 0 ? 'text-rose-600' : 'text-slate-400')}>{fmtNum(l.shortage)}</td>
                        <td className="px-3 py-3">
                          {l.entries === 0 && l.onHand === 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600"><AlertTriangle size={13} />No stock entries</span>
                          ) : l.ok ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={13} />Matches ledger</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600" title={`Material record says ${l.onHand}, ledger says ${l.ledger}`}>
                              <AlertTriangle size={13} />Record {fmtNum(l.onHand)} ≠ ledger
                            </span>
                          )}
                          <button onClick={() => navigate('inventory/movements', { code: l.code })} className="block text-[0.6875rem] font-semibold text-prod-500 hover:underline">
                            {l.entries} entr{l.entries === 1 ? 'y' : 'ies'} · view ledger
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <Meter value={l.available} max={l.required} />
                          <div className={cx('mt-1 text-[0.6875rem] font-semibold', l.shortage > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                            {l.shortage > 0 ? `${Math.round((l.available / l.required) * 100)}% covered` : 'Fully covered'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : (
          <Card><EmptyState icon={Gauge} title="No order selected" text="Create a production order first." /></Card>
        )}
      </div>

      {/* Pull out request: shows the material that will go OUT of the store to Production */}
      <Modal open={pullOpen && !!order} onClose={() => setPullOpen(false)} title="Request material pull out" width="max-w-2xl"
        subtitle={order && `${order.id} · ${sop?.product} · ${order.batches} × ${fmtNum(sop?.batchSize)} ${sop?.unit}`}
        footer={<><Button variant="ghost" onClick={() => setPullOpen(false)}>Cancel</Button><Button variant="production" icon={PackageOpen} onClick={requestPull}>Send pull out request</Button></>}>
        {order && (
          <>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Material out <span className="normal-case tracking-normal text-slate-400">· Store <ArrowRight size={12} className="inline" /> Production</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-line dark:border-white/[0.07]">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="bg-prod-50/70 text-left text-[0.75rem] font-semibold text-slate-700 dark:bg-white/[0.03] dark:text-slate-300">
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2 text-right">Available now</th>
                    <th className="px-3 py-2 text-right">Pull out</th>
                    <th className="px-3 py-2 text-right">Available after</th>
                    <th className="px-3 py-2 text-right">To production</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const after = Math.round((l.available - l.required) * 1000) / 1000;
                    return (
                      <tr key={l.code} className="border-t border-line dark:border-white/[0.05]">
                        <td className="px-3 py-2"><div className="font-medium">{l.name}</div><div className="text-[0.6875rem] text-slate-400">{l.code} · {l.group}</div></td>
                        <td className="tabular px-3 py-2 text-right">{fmtNum(l.available)} <span className="text-xs text-slate-400">{l.unit}</span></td>
                        <td className="tabular px-3 py-2 text-right font-semibold text-rose-600">−{fmtNum(l.required)} <span className="text-xs font-normal">{l.unit}</span></td>
                        <td className="px-3 py-2 text-right">
                          <b className={cx('tabular', after < 0 && 'text-rose-600')}>{fmtNum(after)}</b> <span className="text-xs text-slate-400">{l.unit}</span>
                          <div className="text-[0.6875rem] text-slate-400">{fmtNum(l.available)} − {fmtNum(l.required)} = {fmtNum(after)}</div>
                        </td>
                        <td className="tabular px-3 py-2 text-right font-semibold text-emerald-600">+{fmtNum(l.required)} <span className="text-xs font-normal">{l.unit}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">The request goes to Inventory. When Inventory confirms the issue, the stock OUT entry is posted in Stock Movement.</p>
          </>
        )}
      </Modal>

      {viewing && <OrderDetail orderId={viewing} onClose={() => setViewing(null)} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete production order?"
        message={deleting && <>Order <b>{deleting.id}</b> will be removed from the JSON data.</>}
        onConfirm={() => { dispatch('DELETE_ORDER', { orderId: deleting.id }); toast(`Order ${deleting.id} deleted`); setSel(undefined); }} />

      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wider text-slate-500">Live inventory snapshot</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {state.materials.map((m) => {
          const av = available(m);
          return (
            <Card key={m.code} className="p-4">
              <div className="flex items-center justify-between"><Mono className="text-slate-400">{m.code}</Mono>{av < m.reorder && <Badge status="Shortage">Low</Badge>}</div>
              <div className="mt-1 truncate text-sm font-medium">{m.name}</div>
              <div className="mt-2 text-xl font-extrabold tabular">{fmtNum(av)} <span className="text-xs font-semibold text-slate-400">{m.unit}</span></div>
              {m.reserved > 0 && <div className="text-[0.6875rem] text-slate-500">{fmtNum(m.reserved)} reserved</div>}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Num({ label, v, u, danger }) {
  return (
    <div>
      <div className="text-[0.6562rem] font-semibold uppercase tracking-wider text-slate-400 md:hidden">{label}</div>
      <div className={cx('tabular font-semibold', danger && 'text-rose-600')}>{fmtNum(v)} <span className="text-xs font-medium text-slate-400">{u}</span></div>
    </div>
  );
}
