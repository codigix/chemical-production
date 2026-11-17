import { Check } from 'lucide-react';
import { ORDER_FLOW } from '../store/StoreContext';
import { cx } from './ui';

const SHORT = {
  Draft: 'Order',
  Ready: 'RM Check',
  'Pull Out Requested': 'Pull Out Req.',
  'Material Issued': 'Issued',
  'Production Verified': 'Prod. Verified',
  'SOP Submitted': 'SOP Submitted',
  'Stock Verified': 'Stock Check',
  Accepted: 'Office Accepted',
};

/* Where an order sits in the end-to-end flow. Shortage / Awaiting Purchase sit at the RM-check step. */
export function stepIndex(status) {
  if (status === 'Shortage' || status === 'Awaiting Purchase') return 1;
  return Math.max(0, ORDER_FLOW.indexOf(status));
}

/* Compact horizontal stepper showing an order's progress across both modules */
export default function OrderFlow({ status, compact = false }) {
  const idx = stepIndex(status);
  const blocked = status === 'Shortage' || status === 'Awaiting Purchase';
  const done = status === 'Accepted';

  return (
    <div className="flex w-full items-center">
      {ORDER_FLOW.map((s, i) => {
        const complete = i < idx || done;
        const current = i === idx && !done;
        const inv = i >= 3 && i !== 4 && i !== 5; // Issued, Stock check, Accepted happen in Inventory
        return (
          <div key={s} className={cx('flex items-center', i < ORDER_FLOW.length - 1 && 'flex-1')}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cx(
                  'grid place-items-center rounded-full text-[0.625rem] font-bold ring-4 transition',
                  compact ? 'h-5 w-5' : 'h-7 w-7',
                  complete && 'bg-emerald-500 text-white ring-emerald-500/15',
                  current && !blocked && cx('text-white', inv ? 'bg-inv-500 ring-inv-500/20' : 'bg-prod-500 ring-prod-500/20'),
                  current && blocked && 'bg-amber-500 text-white ring-amber-500/20',
                  !complete && !current && 'bg-slate-100 text-slate-400 ring-transparent dark:bg-white/[0.06]'
                )}
              >
                {complete ? <Check size={compact ? 11 : 14} strokeWidth={3} /> : i + 1}
              </span>
              {!compact && (
                <span className={cx('hidden whitespace-nowrap text-[0.6562rem] font-semibold md:block', current ? 'text-slate-900 dark:text-white' : 'text-slate-400')}>
                  {current && blocked ? 'Shortage' : SHORT[s]}
                </span>
              )}
            </div>
            {i < ORDER_FLOW.length - 1 && (
              <div className={cx('mx-1 h-0.5 flex-1 rounded-full', compact ? '' : 'md:mb-5', i < idx || done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-white/[0.08]')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
