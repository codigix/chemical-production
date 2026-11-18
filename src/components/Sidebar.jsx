import { FlaskConical, Factory, ChevronsUpDown, Database } from 'lucide-react';
import { NAV, DASHBOARD } from '../nav';
import { useStore } from '../store/StoreContext';
import { cx } from './ui';

/* Pending-work counters shown as pills next to menu items */
function useCounts() {
  const { state } = useStore();
  const byStatus = (s) => state.orders.filter((o) => o.status === s).length;
  return {
    'production/rm-stock': byStatus('Draft') + byStatus('Shortage') + byStatus('Ready'),
    'production/pull-out': byStatus('Material Issued'),
    'production/sop-submission': byStatus('Production Verified'),
    'inventory/purchase': state.requests.filter((r) => r.type === 'PURCHASE' && r.status === 'Pending').length,
    'inventory/rfq': (state.rfqs || []).filter((x) => x.status === 'Sent' || x.status === 'Quoted').length,
    'inventory/purchase-orders': state.purchases.filter((p) => p.status === 'Ordered').length,
    'inventory/stock-in': state.purchases.filter((p) => p.status === 'Ordered').length,
    'inventory/requests': state.requests.filter((r) => r.status === 'Pending').length,
    'inventory/pull-out': state.requests.filter((r) => r.type === 'PULL_OUT' && r.status === 'Pending').length,
    'inventory/stock-verification': byStatus('SOP Submitted'),
    'inventory/office-acceptance': byStatus('Stock Verified'),
  };
}

function Item({ item, active, count, onClick }) {
  const Icon = item.icon;
  return (
    <a
      href={`#/${item.path}`}
      onClick={onClick}
      className={cx(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8438rem] transition',
        active
          ? 'bg-prod-50 font-semibold text-prod-500 dark:bg-prod-500/15'
          : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-prod-500 dark:text-slate-300 dark:hover:bg-white/[0.04]'
      )}
    >
      <Icon size={17} strokeWidth={active ? 2.3 : 1.9} className="shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {count > 0 && (
        <span className={cx('min-w-5 rounded-full px-1.5 text-center text-[0.625rem] font-bold leading-5', active ? 'bg-prod-500 text-white' : 'bg-rose-500 text-white')}>
          {count}
        </span>
      )}
    </a>
  );
}

export default function Sidebar({ current, open, onClose }) {
  const counts = useCounts();

  return (
    <>
      <div className={cx('fixed inset-0 z-30 bg-ink-950/40 lg:hidden', open ? 'block' : 'hidden')} onClick={onClose} />
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-[16.25rem] flex-col border-r border-line bg-white transition-transform lg:translate-x-0 dark:border-white/[0.07] dark:bg-ink-900',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-5 dark:border-white/[0.07]">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-prod-500 text-white">
            <FlaskConical size={17} strokeWidth={2.4} />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">ChemFlow</span>
        </div>

        {/* Plant switcher card */}
        <div className="px-4 pt-4">
          <button className="flex w-full items-center gap-3 rounded-lg border border-line bg-slate-50 p-2.5 text-left dark:border-white/[0.07] dark:bg-white/[0.03]">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-prod-500 text-white"><Factory size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-semibold text-slate-900 dark:text-white">Unit 1 · Chemical Plant</span>
              <span className="block text-[0.7188rem] text-slate-500">Shift A</span>
            </span>
            <ChevronsUpDown size={15} className="text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-4 scrollbar-thin">
          <div>
            <div className="mb-1.5 px-3 text-[0.7188rem] font-semibold text-slate-400">Main Menu</div>
            <Item item={DASHBOARD} active={current === 'dashboard'} onClick={onClose} />
          </div>
          {NAV.map((g) => (
            <div key={g.module}>
              <div className="mb-1.5 px-3 text-[0.7188rem] font-semibold text-slate-400">{g.label}</div>
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <Item key={it.path} item={it} active={current === it.path} count={counts[it.path]} onClick={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="m-4 flex items-start gap-2.5 rounded-lg bg-prod-50 p-3 dark:bg-prod-500/10">
          <Database size={16} className="mt-0.5 shrink-0 text-prod-500" />
          <div>
            <div className="text-[0.7812rem] font-semibold text-slate-900 dark:text-white">JSON data store</div>
            <p className="text-[0.7188rem] leading-relaxed text-slate-500">No database. Dummy JSON kept in your browser.</p>
          </div>
        </div>
      </aside>
    </>
  );
}
