import { useState } from 'react';
import {
  ArrowRight, ClipboardList, AlertTriangle, Inbox, PackageX, Factory, ChevronLeft, ChevronRight, CalendarDays,
  ShoppingCart, PackagePlus, Gauge, PackageOpen, FileCheck2, ScanSearch, Stamp, Database, Warehouse, Activity, Workflow,
} from 'lucide-react';
import { useStore, available } from '../store/StoreContext';
import { Card, CardHeader, Stat, Badge, Meter, Mono, Button, cx, fmtNum, timeAgo, fmtDate } from '../components/ui';
import OrderFlow from '../components/OrderFlow';
import { OrderViewActions } from '../components/rowActions';
import { navigate } from '../router';

/* Dummy monthly production figures for the statistics chart (UI only) */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHLY = [
  { done: 22, prog: 8, blocked: 3 }, { done: 18, prog: 10, blocked: 4 }, { done: 26, prog: 9, blocked: 2 },
  { done: 24, prog: 12, blocked: 5 }, { done: 30, prog: 7, blocked: 3 }, { done: 21, prog: 11, blocked: 6 },
  { done: 28, prog: 10, blocked: 2 }, { done: 33, prog: 8, blocked: 4 }, { done: 27, prog: 13, blocked: 3 },
  { done: 35, prog: 9, blocked: 2 }, { done: 29, prog: 12, blocked: 5 }, { done: 0, prog: 0, blocked: 0 },
];

export default function Dashboard() {
  const { state } = useStore();
  const { orders, requests, materials, purchases, activity, sops } = state;
  const count = (s) => orders.filter((o) => o.status === s).length;
  const active = orders.filter((o) => o.status !== 'Accepted');
  const lowStock = materials.filter((m) => available(m) < m.reorder);
  const pendingReq = requests.filter((r) => r.status === 'Pending');
  const product = (o) => sops.find((s) => s.id === o.sopId)?.product;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Plant Dashboard</h1>
          <p className="mt-1 text-[0.8125rem] text-slate-500">Production and Inventory at a glance · {fmtDate(new Date())}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={ClipboardList} onClick={() => navigate('production/orders', { new: 1 })}>New Production Order</Button>
          <Button variant="ghost" icon={Inbox} onClick={() => navigate('inventory/requests')}>Request Inbox</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active Orders" value={active.length} icon={Factory} color="blue" delta={12} bars={[4, 6, 5, 8, 6, 9, 7, active.length + 4]} hint={`${count('Accepted')} accepted to date`} />
        <Stat label="Shortage / Awaiting PO" value={count('Shortage') + count('Awaiting Purchase')} icon={AlertTriangle} color="orange" delta={-8} bars={[3, 5, 2, 4, 6, 3, 4, 2]} hint="Blocked at RM check" />
        <Stat label="Pending Requests" value={pendingReq.length} icon={Inbox} color="red" delta={5} bars={[2, 4, 3, 5, 4, 6, 3, 5]} hint={`${purchases.filter((p) => p.status === 'Ordered').length} POs awaiting GRN`} />
        <Stat label="Below Reorder" value={lowStock.length} icon={PackageX} color="teal" delta={-3} bars={[5, 4, 6, 3, 4, 2, 3, 4]} hint={`of ${materials.length} raw materials`} />
      </div>

      {/* Statistics chart + calendar */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Production Statistics" icon={Activity}
            action={<select className="h-8 rounded-lg border border-line bg-white px-2 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.04]"><option>Monthly</option><option>Weekly</option></select>} />
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['All Orders', orders.length + 315, 'bg-slate-400'],
                ['Accepted', count('Accepted') + 293, 'bg-prod-500'],
                ['In Progress', active.length - count('Shortage') - count('Awaiting Purchase') + 117, 'bg-cyan-400'],
                ['Blocked', count('Shortage') + count('Awaiting Purchase') + 39, 'bg-orange-400'],
              ].map(([l, v, dot]) => (
                <div key={l} className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className={cx('h-2 w-2 rounded-full', dot)} />{l}</div>
                  <div className="mt-1 text-lg font-bold tabular text-slate-900 dark:text-white">{fmtNum(v)}</div>
                </div>
              ))}
            </div>
            <BarChart />
          </div>
        </Card>

        <ScheduleCalendar orders={orders} product={product} />
      </div>

      {/* Workflow map */}
      <Card>
        <CardHeader title="Workflow Map" subtitle="Click any step to open it. Numbers show items waiting at that step." icon={Workflow} />
        <div className="grid gap-4 p-5 lg:grid-cols-[120px_1fr]">
          <Lane label="Inventory" />
          <div className="flex flex-wrap items-center gap-2">
            <Node icon={ShoppingCart} label="Raw Material Purchase" to="inventory/purchase" count={requests.filter((r) => r.type === 'PURCHASE' && r.status === 'Pending').length} />
            <Arrow />
            <Node icon={PackagePlus} label="RM Stock In" to="inventory/stock-in" count={purchases.filter((p) => p.status === 'Ordered').length} />
          </div>

          <Lane label="Production" />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Node icon={ClipboardList} label="Production Order / SOP" to="production/orders" count={count('Draft')} />
              <Arrow />
              <Node icon={Gauge} label="Check RM Stock" to="production/rm-stock" count={count('Ready')} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-orange-300 bg-orange-50/40 p-2.5 dark:border-orange-500/30 dark:bg-orange-500/5">
                <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-orange-600">Shortage</span>
                <Node icon={AlertTriangle} label="Purchase Requirement" tone="warn" to="production/rm-stock" count={count('Shortage')} />
                <Arrow />
                <Node icon={ShoppingCart} label="PO / GRN" to="inventory/purchase" count={count('Awaiting Purchase')} />
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 p-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/5">
                <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-emerald-600">Available</span>
                <Node icon={PackageOpen} label="Material Pull Out" to="inventory/pull-out" count={count('Pull Out Requested')} />
                <Arrow />
                <Node icon={FileCheck2} label="SOP Verification" to="production/pull-out" count={count('Material Issued') + count('Production Verified')} />
              </div>
            </div>
          </div>

          <Lane label="Office" />
          <div className="flex flex-wrap items-center gap-2">
            <Node icon={ScanSearch} label="Stock Person Check" to="inventory/stock-verification" count={count('SOP Submitted')} />
            <Arrow />
            <Node icon={Stamp} label="Office Signature & Acceptance" to="inventory/office-acceptance" count={count('Stock Verified')} />
            <Arrow />
            <Node icon={Database} label="JSON Stock Records Updated" tone="ok" to="inventory/ledger" />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Orders in flight */}
        <Card className="xl:col-span-2">
          <CardHeader title="Orders in Flight" icon={Factory}
            action={<button onClick={() => navigate('production/orders')} className="text-[0.8125rem] font-semibold text-prod-500 hover:underline">View All</button>} />
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[40rem] text-left text-[0.8125rem]">
              <thead>
                <tr className="bg-slate-50 text-[0.7812rem] text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">Progress</th>
                  <th className="px-5 py-3 font-semibold">Planned</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 6).map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 dark:border-white/[0.05]">
                    <td className="px-5 py-3"><Mono className="text-prod-500">{o.id}</Mono></td>
                    <td className="px-5 py-3"><div className="font-medium text-slate-900 dark:text-white">{product(o)}</div><div className="text-xs text-slate-500">{o.batches} batch{o.batches > 1 ? 'es' : ''} · <Badge status={o.priority} /></div></td>
                    <td className="min-w-[10.625rem] px-5 py-3"><OrderFlow status={o.status} compact /></td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{fmtDate(o.plannedDate)}</td>
                    <td className="px-5 py-3"><Badge status={o.status} /></td>
                    <td className="px-5 py-3 text-right"><OrderViewActions order={o} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Stock health */}
        <Card>
          <CardHeader title="Stock Health" icon={Warehouse}
            action={<button onClick={() => navigate('inventory/ledger')} className="text-[0.8125rem] font-semibold text-prod-500 hover:underline">Ledger</button>} />
          <div className="space-y-4 p-5">
            {materials.map((m) => {
              const av = available(m);
              return (
                <div key={m.code}>
                  <div className="mb-1.5 flex items-center justify-between text-[0.8125rem]">
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">{m.name}</span>
                    <span className={cx('tabular text-xs font-semibold', av < m.reorder ? 'text-rose-600' : 'text-slate-500')}>{fmtNum(av)} {m.unit}</span>
                  </div>
                  <Meter value={av} max={m.reorder * 3} tone={av < m.reorder ? 'bg-rose-500' : av < m.reorder * 1.5 ? 'bg-orange-400' : 'bg-prod-500'} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Activity */}
      <Card>
        <CardHeader title="Recent Activity" subtitle="Every action is written to the JSON store" icon={Activity} />
        <ul className="grid gap-x-8 p-5 md:grid-cols-2">
          {activity.slice(0, 10).map((a, i) => (
            <li key={i} className="flex gap-3 py-2.5">
              <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.module === 'inventory' ? 'bg-orange-400' : 'bg-prod-500')} />
              <div className="min-w-0">
                <div className="text-[0.8125rem] text-slate-700 dark:text-slate-200">{a.msg}</div>
                <div className="text-[0.7188rem] text-slate-400">{a.module === 'inventory' ? 'Inventory' : 'Production'} · {timeAgo(a.t)}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ---------- Stacked monthly bar chart (pure CSS) ---------- */
function BarChart() {
  const max = 50;
  const ticks = [50, 40, 30, 20, 10, 0];
  return (
    <div className="mt-5">
      <div className="relative flex h-60 gap-2 pl-8">
        <div className="absolute inset-y-0 left-0 flex w-full flex-col justify-between">
          {ticks.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="w-6 text-right text-[0.6562rem] text-slate-400 tabular">{t}</span>
              <span className="h-px flex-1 border-t border-dashed border-line dark:border-white/[0.07]" />
            </div>
          ))}
        </div>
        {MONTHLY.map((m, i) => (
          <div key={i} className="group relative z-10 flex flex-1 flex-col items-center justify-end">
            <div className="flex w-full max-w-[1.375rem] flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: `${((m.done + m.prog + m.blocked) / max) * 100}%` }}>
              <span className="bg-prod-500" style={{ flexGrow: m.done }} />
              <span className="bg-cyan-400" style={{ flexGrow: m.prog }} />
              <span className="bg-orange-400" style={{ flexGrow: m.blocked }} />
            </div>
            <div className="pointer-events-none absolute -top-2 z-20 hidden -translate-y-full whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[0.6875rem] text-white shadow-lg group-hover:block">
              {MONTHS[i]}: {m.done} accepted · {m.prog} in progress · {m.blocked} blocked
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 pl-8">
        {MONTHS.map((m) => <span key={m} className="flex-1 text-center text-[0.6875rem] text-slate-400">{m}</span>)}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-prod-500" />Accepted</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cyan-400" />In Progress</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-orange-400" />Blocked</span>
      </div>
    </div>
  );
}

/* ---------- Mini calendar of planned production dates ---------- */
function ScheduleCalendar({ orders, product }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const startOffset = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(y, m + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);
  const key = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const planned = new Set(orders.map((o) => o.plannedDate));
  const upcoming = [...orders].filter((o) => o.status !== 'Accepted').sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)).slice(0, 3);

  return (
    <Card>
      <CardHeader title="Production Schedule" icon={CalendarDays} />
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setCursor(new Date(y, m - 1, 1))} className="grid h-7 w-7 place-items-center rounded-md border border-line text-slate-500 hover:text-prod-500 dark:border-white/10" aria-label="Previous month"><ChevronLeft size={15} /></button>
          <span className="text-[0.8438rem] font-semibold text-slate-900 dark:text-white">{cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setCursor(new Date(y, m + 1, 1))} className="grid h-7 w-7 place-items-center rounded-md border border-line text-slate-500 hover:text-prod-500 dark:border-white/10" aria-label="Next month"><ChevronRight size={15} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[0.6875rem] font-semibold text-slate-400">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <span key={d} className="py-1">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[0.7812rem]">
          {Array.from({ length: startOffset }).map((_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const k = key(i + 1);
            const isToday = k === todayKey;
            const has = planned.has(k);
            return (
              <span key={k} className={cx('relative grid h-8 place-items-center rounded-md',
                isToday ? 'bg-prod-500 font-semibold text-white' : has ? 'bg-prod-50 font-semibold text-prod-500 dark:bg-prod-500/15' : 'text-slate-600 dark:text-slate-300')}>
                {i + 1}
                {has && !isToday && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-prod-500" />}
              </span>
            );
          })}
        </div>

        <div className="mt-5 space-y-2.5">
          {upcoming.map((o) => (
            <button key={o.id} onClick={() => navigate('production/orders')} className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-left transition hover:border-prod-500/40 dark:border-white/[0.07]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-prod-50 text-prod-500 dark:bg-prod-500/15">
                <span className="text-center leading-none"><span className="block text-[0.8125rem] font-bold">{new Date(o.plannedDate).getDate()}</span><span className="text-[0.5938rem] font-semibold uppercase">{new Date(o.plannedDate).toLocaleDateString('en-GB', { month: 'short' })}</span></span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-semibold text-slate-900 dark:text-white">{product(o)}</span>
                <span className="block text-[0.7188rem] text-slate-500">{o.id} · {o.batches} batch</span>
              </span>
              <Badge status={o.status} />
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ---------- Workflow map pieces ---------- */
function Node({ icon: Icon, label, count, tone, to }) {
  const t = tone === 'warn'
    ? 'border-orange-200 bg-white text-orange-700 dark:border-orange-500/30 dark:bg-transparent dark:text-orange-300'
    : tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
      : 'border-line bg-white text-slate-700 hover:border-prod-500/50 hover:text-prod-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200';
  return (
    <button onClick={() => to && navigate(to)} className={cx('flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[0.7812rem] font-semibold transition hover:shadow-sm', t)}>
      <Icon size={15} className={tone ? '' : 'text-prod-500'} />
      <span className="whitespace-nowrap">{label}</span>
      {count > 0 && <span className="rounded-full bg-prod-500 px-1.5 text-[0.625rem] font-bold leading-4 text-white">{count}</span>}
    </button>
  );
}
const Arrow = () => <ArrowRight size={15} className="shrink-0 text-slate-300 dark:text-slate-600" />;
function Lane({ label }) {
  return <div className="self-start rounded-md bg-prod-50 px-2.5 py-1.5 text-[0.7188rem] font-bold uppercase tracking-wider text-prod-500 dark:bg-prod-500/15">{label}</div>;
}
