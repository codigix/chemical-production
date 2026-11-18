import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { available } from '../store/StoreContext';
import { Mono, inputCls, fmtNum, cx } from './ui';

/*
  Material field on an order line: type the name / code manually, matching
  materials from the Raw Material Master are listed while typing (▾ shows all).
  The list is portalled so the table's scroll box doesn't clip it.
*/
export default function MaterialCombo({ options, all, value, onChange, placeholder, newName, onNew }) {
  const sel = all.find((m) => m.code === value);
  const label = (m) => `${m.code} · ${m.name}`;
  const shown = () => (sel ? label(sel) : newName || '');
  const [text, setText] = useState(shown);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [box, setBox] = useState(null);
  const wrap = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { setText(shown()); }, [value, newName]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = text.trim().toLowerCase();
  const filtered = !t || (sel && text === label(sel)) ? options
    : options.filter((m) => `${m.code} ${m.name} ${m.category || ''}`.toLowerCase().includes(t));

  const place = () => { const r = wrap.current?.getBoundingClientRect(); if (r) setBox({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 300) }); };
  useEffect(() => {
    if (!open) return undefined;
    place();
    const onDoc = (e) => { if (!wrap.current?.contains(e.target) && !listRef.current?.contains(e.target)) closeRef.current(); };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDoc);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); document.removeEventListener('mousedown', onDoc); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Leaving the field: a name/code match selects it; any other typed name is kept as a NEW material */
  const norm = (v) => String(v).toLowerCase().replace(/[·\s]+/g, ' ').trim();
  const findExact = () => {
    const n = norm(text);
    if (!n) return null;
    return options.find((m) => [m.code, m.name, label(m), `${m.code} ${m.name}`].some((v) => norm(v) === n))
      /* typed "RM-006 …" → the code wins */
      || options.find((m) => n.startsWith(`${norm(m.code)} `) || n === norm(m.code));
  };
  const close = () => {
    setOpen(false);
    const exact = findExact();
    if (exact) { if (exact.code !== value) onChange(exact.code); setText(label(exact)); }
    else if (sel && text === label(sel)) setText(label(sel));
    else if (text.trim()) onNew(text.trim());
    else setText(shown());
  };
  const isNew = !value && !!newName;
  const closeRef = useRef(close);
  closeRef.current = close;
  const pick = (m) => { onChange(m.code); setText(label(m)); setOpen(false); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && filtered[hi]) pick(filtered[hi]); else close(); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); close(); }
  };

  return (
    <div ref={wrap} className="relative">
      <input className={cx(inputCls, 'h-9 pr-8', isNew ? 'border-sky-400 pr-14' : !value && 'border-amber-300')} placeholder={placeholder} value={text}
        onChange={(e) => { setText(e.target.value); setHi(0); setOpen(true); }}
        onFocus={(e) => e.target.select()}
        onKeyDown={onKey} aria-label="Material" />
      <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => { if (open) close(); else { setHi(0); setOpen(true); } }}
        className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-400 hover:text-prod-500">
        <ChevronDown size={15} className={cx('transition', open && 'rotate-180')} />
      </button>
      {isNew && !open && <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 rounded bg-sky-100 px-1 text-[0.5625rem] font-bold uppercase text-sky-700">New</span>}
      {open && box && createPortal(
        <div ref={listRef} style={{ position: 'fixed', left: box.left, top: box.top, width: box.width }}
          className="z-[200] max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-ink-800">
          {/* Manual entry: use the typed name as a new material */}
          {t && !findExact() && !(sel && text === label(sel)) && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); onNew(text.trim()); }}
              className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm text-sky-700 hover:bg-sky-50 dark:border-white/[0.06] dark:text-sky-300 dark:hover:bg-white/[0.04]">
              <Plus size={14} />Use “<b>{text.trim()}</b>” as a new material <span className="ml-auto text-[0.6875rem] text-slate-400">added to master on save</span>
            </button>
          )}
          {filtered.length === 0
            ? <div className="px-3 py-3 text-center text-xs text-slate-400">No material in the master matches “{text}”</div>
            : filtered.map((m, i) => (
              <button key={m.code} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)} onMouseEnter={() => setHi(i)}
                className={cx('flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm', i === hi && 'bg-prod-50 dark:bg-white/[0.06]')}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="text-[0.6875rem] text-slate-400"><Mono>{m.code}</Mono> · {m.category || 'General'} · {m.unit}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-right">
                  <span className="text-[0.6875rem] text-slate-500">{fmtNum(available(m))} {m.unit} avail.</span>
                  {m.code === value && <Check size={14} className="text-prod-500" />}
                </span>
              </button>
            ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

