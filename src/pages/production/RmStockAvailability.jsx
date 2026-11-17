import { useState } from 'react';
import { Gauge, AlertTriangle, CheckCircle2, ShoppingCart, PackageOpen, Hourglass, ArrowRight, Boxes } from 'lucide-react';
import { useStore, requirementFor, available } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Button, Badge, Meter, Mono, EmptyState, fmtNum, fmtDate, cx, useToast } from '../../components/ui';
import { navigate } from '../../router';

const CHECKABLE = ['Draft', 'Shortage', 'Ready', 'Awaiting Purchase'];

export default function RmStockAvailability({ params }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const queue = state.orders.filter((o) => CHECKABLE.includes(o.status));
  const [sel, setSel] = useState(params.order && queue.some((o) => o.id === params.order) ? params.order : queue[0]?.id);
  const order = state.orders.find((o) => o.id === sel && CHECKABLE.includes(o.status)) || queue[0];
  const sop = order && state.sops.find((s) => s.id === order.sopId);
  const lines = order ? requirementFor(state, order) : [];
  const short = lines.some((l) => l.shortage > 0);
  const waiting = order?.status === 'Awaiting Purchase';

  const sendPurchase = () => {
    dispatch('CHECK_RM', { orderId: order.id });
    dispatch('SEND_PURCHASE_REQ', { orderId: order.id });
    toast('Purchase requirement sent to Inventory');
  };
  const requestPull = () => {
    const id = order.id;
    dispatch('CHECK_RM', { orderId: id });
    dispatch('REQUEST_PULL_OUT', { orderId: id });
    toast('Pull out request sent to Inventory');
    setSel(undefined);
  };

  return (
    <>
      <PageHeader module="production" icon={Gauge} title="RM Stock Availability" subtitle="Compare an order's raw material requirement with live Inventory stock." />

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
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
          <div className="space-y-6">
            <div className={cx('relative overflow-hidden rounded-[10px] border p-5',
              waiting ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5'
                : short ? 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/5'
                  : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/5')}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white', waiting ? 'bg-amber-500' : short ? 'bg-rose-500' : 'bg-emerald-500')}>
                    {waiting ? <Hourglass size={20} /> : short ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                  </span>
                  <div>
                    <div className="text-lg font-bold">
                      {waiting ? 'Waiting for purchase' : short ? `Shortage on ${lines.filter((l) => l.shortage > 0).length} material(s)` : 'All raw materials available'}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      <Mono>{order.id}</Mono> · {sop?.product} · {order.batches} × {fmtNum(sop?.batchSize)} {sop?.unit}
                      {waiting && <> · requirement <Mono>{order.purchaseReqId}</Mono> is with Inventory</>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {waiting ? (
                    <Button variant="ghost" icon={ArrowRight} onClick={() => navigate('production/history')}>Track request</Button>
                  ) : short ? (
                    <Button variant="warn" icon={ShoppingCart} onClick={sendPurchase}>Send purchase requirement</Button>
                  ) : (
                    <Button variant="production" icon={PackageOpen} onClick={requestPull}>Request material pull out</Button>
                  )}
                </div>
              </div>
            </div>

            <Card>
              <CardHeader title="Requirement vs available" subtitle="Available = on hand − already reserved for other orders" icon={Gauge} />
              <div className="hidden gap-3 border-b border-slate-100 px-5 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500 md:grid md:grid-cols-[1.4fr_repeat(3,0.6fr)_1fr] dark:border-white/[0.06]">
                <span>Material</span><span>Required</span><span>Available</span><span>Shortage</span><span>Coverage</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {lines.map((l) => (
                  <div key={l.code} className="grid items-center gap-3 px-5 py-4 md:grid-cols-[1.4fr_repeat(3,0.6fr)_1fr]">
                    <div><Mono className="text-slate-400">{l.code}</Mono><div className="font-medium">{l.name}</div></div>
                    <Num label="Required" v={l.required} u={l.unit} />
                    <Num label="Available" v={l.available} u={l.unit} />
                    <Num label="Shortage" v={l.shortage} u={l.unit} danger={l.shortage > 0} />
                    <div>
                      <Meter value={l.available} max={l.required} />
                      <div className={cx('mt-1 text-[0.6875rem] font-semibold', l.shortage > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                        {l.shortage > 0 ? `${Math.round((l.available / l.required) * 100)}% covered` : 'Fully covered'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <Card><EmptyState icon={Gauge} title="No order selected" text="Create a production order first." /></Card>
        )}
      </div>

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
