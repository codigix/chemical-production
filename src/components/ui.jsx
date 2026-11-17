import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Inbox, Info, X } from 'lucide-react';

export const cx = (...c) => c.filter(Boolean).join(' ');

/* ---------- formatting ---------- */
export const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
export const timeAgo = (d) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

/* ---------- module theming ---------- */
export const MODULE = {
  production: { label: 'Production', text: 'text-prod-500', soft: 'bg-prod-50 text-prod-500 dark:bg-prod-500/15' },
  inventory: { label: 'Inventory', text: 'text-inv-500', soft: 'bg-inv-50 text-inv-500 dark:bg-inv-500/15' },
};

/* Accent palette for icon chips and mini charts (blue / orange / red / teal / violet) */
export const ACCENT = {
  blue: { chip: 'bg-prod-500 text-white', soft: 'bg-prod-50 text-prod-500 dark:bg-prod-500/15', bar: 'bg-prod-500' },
  orange: { chip: 'bg-orange-500 text-white', soft: 'bg-orange-50 text-orange-600 dark:bg-orange-500/15', bar: 'bg-orange-400' },
  red: { chip: 'bg-rose-500 text-white', soft: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15', bar: 'bg-rose-400' },
  teal: { chip: 'bg-teal-500 text-white', soft: 'bg-teal-50 text-teal-600 dark:bg-teal-500/15', bar: 'bg-teal-400' },
  violet: { chip: 'bg-violet-500 text-white', soft: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15', bar: 'bg-violet-400' },
};

/* ---------- Card ---------- */
export function Card({ className, children, ...rest }) {
  return (
    <div
      className={cx(
        'rounded-[10px] border border-line bg-white shadow-[0_1px_2px_rgb(16_24_40/0.04)]',
        'dark:border-white/[0.07] dark:bg-ink-900 dark:shadow-none',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, action, tone = 'production' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 dark:border-white/[0.07]">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className={cx('grid h-8 w-8 place-items-center rounded-lg', MODULE[tone]?.soft)}>
            <Icon size={16} />
          </span>
        )}
        <div>
          <h3 className="text-[0.9375rem] font-semibold leading-tight text-slate-900 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ---------- Page header: title + breadcrumb on the left, actions on the right ---------- */
export function PageHeader({ module = 'production', title, subtitle, actions }) {
  const m = MODULE[module];
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-slate-500 dark:text-slate-400">
          <a href="#/dashboard" className="hover:text-prod-500">Home</a>
          <span className="text-slate-300">/</span>
          <span>{m.label}</span>
          <span className="text-slate-300">/</span>
          <span className="font-medium text-prod-500">{title}</span>
        </div>
        {subtitle && <p className="mt-1.5 text-[0.8125rem] text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Button ---------- */
const BTN = {
  primary: 'bg-prod-500 text-white hover:bg-prod-600',
  production: 'bg-prod-500 text-white hover:bg-prod-600',
  inventory: 'bg-inv-500 text-white hover:bg-inv-600',
  warn: 'bg-orange-500 text-white hover:bg-orange-600',
  ghost: 'border border-line bg-white text-slate-700 hover:border-prod-500/40 hover:text-prod-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.07]',
  soft: 'bg-prod-50 text-prod-500 hover:bg-prod-100 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10',
};
export function Button({ variant = 'primary', size = 'md', icon: Icon, className, children, ...rest }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9.5 px-4 text-[0.8125rem]',
        BTN[variant],
        className
      )}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

/* ---------- Status badges ---------- */
const STATUS_TONE = {
  Draft: 'slate', Shortage: 'rose', 'Awaiting Purchase': 'amber', Ready: 'emerald',
  'Pull Out Requested': 'sky', 'Material Issued': 'indigo', 'Production Verified': 'teal',
  'SOP Submitted': 'violet', 'Stock Verified': 'fuchsia', Accepted: 'emerald',
  Pending: 'amber', 'PO Raised': 'sky', Received: 'emerald', Issued: 'indigo',
  'Received by Production': 'teal', Closed: 'slate', Ordered: 'sky',
  High: 'rose', Medium: 'amber', Low: 'slate', IN: 'emerald', OUT: 'rose',
  PURCHASE: 'amber', PULL_OUT: 'sky',
};
const TONE = {
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-white/[0.06] dark:text-slate-300',
  rose: 'bg-rose-50 text-rose-700 ring-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
  amber: 'bg-amber-50 text-amber-700 ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  sky: 'bg-sky-50 text-sky-700 ring-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300',
  teal: 'bg-teal-50 text-teal-700 ring-teal-500/20 dark:bg-teal-500/10 dark:text-teal-300',
  violet: 'bg-violet-50 text-violet-700 ring-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
};
const DOT = { slate: 'bg-slate-400', rose: 'bg-rose-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500', sky: 'bg-sky-500', indigo: 'bg-indigo-500', teal: 'bg-teal-500', violet: 'bg-violet-500', fuchsia: 'bg-fuchsia-500' };
const LABEL = { PULL_OUT: 'Pull Out', PURCHASE: 'Purchase' };

export function Badge({ status, children }) {
  const tone = STATUS_TONE[status] || 'slate';
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold ring-1 ring-inset', TONE[tone])}>
      <span className={cx('h-1.5 w-1.5 rounded-full', DOT[tone])} />
      {children ?? LABEL[status] ?? status}
    </span>
  );
}

/* ---------- Stat tile ---------- */
/* KPI card: coloured icon chip, label, big value, optional delta pill and mini bar chart */
export function Stat({ label, value, hint, icon: Icon, color = 'blue', bars, delta }) {
  const a = ACCENT[color] || ACCENT.blue;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={cx('grid h-10 w-10 place-items-center rounded-full', a.soft)}>{Icon && <Icon size={18} />}</span>
        {delta != null && (
          <span className={cx('rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold text-white', delta >= 0 ? 'bg-emerald-500' : 'bg-rose-500')}>
            {delta >= 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[0.8125rem] font-medium text-slate-500 dark:text-slate-400">{label}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular dark:text-white">{value}</div>
        </div>
        {bars && <MiniBars data={bars} color={a.bar} />}
      </div>
      {hint && <div className="mt-2 border-t border-dashed border-line pt-2 text-xs text-slate-500 dark:border-white/[0.07] dark:text-slate-400">{hint}</div>}
    </Card>
  );
}

export function MiniBars({ data, color = 'bg-prod-500' }) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex h-10 items-end gap-[3px]" aria-hidden="true">
      {data.map((v, i) => (
        <span key={i} className={cx('w-[0.3125rem] rounded-sm', color, i === data.length - 1 ? '' : 'opacity-70')} style={{ height: `${Math.max(12, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

/* ---------- Progress / meter ---------- */
export function Meter({ value, max, tone }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = tone || (pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500');
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]">
      <div className={cx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- Table ---------- */
export function Table({ columns, rows, empty, rowKey = (r) => r.id, onRowClick }) {
  if (!rows.length) return <EmptyState {...(empty || {})} />;
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-[0.7812rem] text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
            {columns.map((c) => (
              <th key={c.key} className={cx('px-5 py-3 font-semibold', c.align === 'right' && 'text-right')}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cx('border-b border-slate-100 last:border-0 transition hover:bg-slate-50/70 dark:border-white/[0.04] dark:hover:bg-white/[0.02]', onRowClick && 'cursor-pointer')}
            >
              {columns.map((c) => (
                <td key={c.key} className={cx('px-5 py-3.5 align-middle', c.align === 'right' && 'text-right tabular', c.className)}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', text }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-[10px] bg-slate-100 text-slate-400 dark:bg-white/[0.05]">
        <Icon size={24} />
      </span>
      <div className="mt-4 font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{text}</p>}
    </div>
  );
}

/* ---------- Form controls ---------- */
export const inputCls =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-prod-500 focus:ring-4 focus:ring-prod-500/10 dark:border-white/10 dark:bg-white/[0.04]';
export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.6875rem] text-slate-500">{hint}</span>}
    </label>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  /* Lock page scroll behind the dialog */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  /* Portal to <body>: the page wrapper is animated, which would otherwise trap a fixed dialog inside it */
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('animate-rise relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-lg border border-line bg-white shadow-2xl dark:border-white/10 dark:bg-ink-900', width)}>
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 dark:border-white/[0.06]">
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
        {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="animate-rise flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-xl dark:border-white/10 dark:bg-ink-800">
            {t.kind === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Info size={18} className="text-sky-500" />}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Small bits ---------- */
export function Mono({ children, className }) {
  return <span className={cx('font-mono text-[0.7812rem] font-semibold', className)}>{children}</span>;
}
