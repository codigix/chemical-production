import { useEffect, useRef, useState } from 'react';
import { Menu, Download, Upload, RotateCcw, Moon, Sun, Bell, Search, Plus, ChevronDown } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { NAV } from '../nav';
import { navigate } from '../router';
import { useToast, cx } from './ui';

const ALL_PAGES = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

export default function Topbar({ onMenu, dark, onToggleTheme }) {
  const { state, reset, replace } = useStore();
  const toast = useToast();
  const fileRef = useRef(null);
  const searchRef = useRef(null);
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);

  /* Ctrl/⌘ + K focuses the search box */
  useEffect(() => {
    const on = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const results = q
    ? ALL_PAGES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
    : [];

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chemflow-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('JSON data exported');
  };

  const importJson = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.materials || !data.orders) throw new Error('bad');
      replace(data);
      toast('JSON data imported');
    } catch {
      toast('That file is not valid ChemFlow JSON', 'info');
    }
    e.target.value = '';
  };

  const pending = state.requests.filter((r) => r.status === 'Pending').length;
  const iconBtn = 'relative grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-slate-600 transition hover:border-prod-500/40 hover:text-prod-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300';

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white dark:border-white/[0.07] dark:bg-ink-900">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button onClick={onMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-white/10" aria-label="Open menu">
          <Menu size={20} />
        </button>

        {/* Search */}
        <div className="relative hidden w-full max-w-sm sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Search screens"
            className="h-9.5 w-full rounded-lg border border-line bg-slate-50 pl-9 pr-14 text-[0.8125rem] outline-none transition placeholder:text-slate-400 focus:border-prod-500 focus:bg-white dark:border-white/10 dark:bg-white/[0.04]"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line bg-white px-1.5 py-0.5 text-[0.6562rem] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.06]">Ctrl K</kbd>
          {focus && results.length > 0 && (
            <div className="absolute inset-x-0 top-11 overflow-hidden rounded-lg border border-line bg-white shadow-xl dark:border-white/10 dark:bg-ink-800">
              {results.map((r) => (
                <button key={r.path} onMouseDown={() => { navigate(r.path); setQ(''); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.8125rem] hover:bg-prod-50 dark:hover:bg-white/[0.05]">
                  <r.icon size={15} className="text-prod-500" />
                  <span className="flex-1">{r.label}</span>
                  <span className="text-[0.6875rem] text-slate-400">{r.group}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => navigate('production/orders', { new: 1 })} className="hidden h-9 items-center gap-1.5 rounded-lg bg-prod-500 px-3 text-[0.8125rem] font-semibold text-white hover:bg-prod-600 md:inline-flex">
            <Plus size={15} /> New Order
          </button>
          <button className={iconBtn} onClick={exportJson} title="Export JSON" aria-label="Export JSON"><Download size={16} /></button>
          <button className={iconBtn} onClick={() => fileRef.current?.click()} title="Import JSON" aria-label="Import JSON"><Upload size={16} /></button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importJson} />
          <button className={iconBtn} onClick={() => { reset(); toast('Dummy data reset'); }} title="Reset dummy data" aria-label="Reset dummy data"><RotateCcw size={16} /></button>
          <a href="#/inventory/requests" className={iconBtn} aria-label="Pending requests" title="Pending requests">
            <Bell size={16} />
            {pending > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[0.5625rem] font-bold text-white">{pending}</span>}
          </a>
          <button onClick={onToggleTheme} className={iconBtn} aria-label="Toggle theme" title="Toggle theme">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="ml-1 flex items-center gap-2 border-l border-line pl-3 dark:border-white/10">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-prod-500 text-xs font-bold text-white">PM</span>
            <div className={cx('hidden leading-tight xl:block')}>
              <div className="text-[0.8125rem] font-semibold text-slate-900 dark:text-white">Plant Manager</div>
              <div className="text-[0.6875rem] text-slate-500">Admin</div>
            </div>
            <ChevronDown size={14} className="hidden text-slate-400 xl:block" />
          </div>
        </div>
      </div>
    </header>
  );
}
