import { useEffect, useState } from 'react';
import { MaterialRowActions, LedgerRowActions, NewMaterialButton } from '../../components/rowActions';
import { BookText, ArrowDownLeft, ArrowUpRight, Boxes, MapPin, Lock } from 'lucide-react';
import { useStore, available, ledgerBalance } from '../../store/StoreContext';
import { navigate } from '../../router';
import { Card, CardHeader, PageHeader, Badge, Mono, Table, Stat, Meter, inputCls, fmtNum, fmtDateTime, cx } from '../../components/ui';

/*
  Stock level from AVAILABLE stock vs reorder level:
  Out of stock (0) · Below reorder (< reorder) · Low stock (< 1.5 × reorder) · Healthy
*/
export function stockLevel(m) {
  const av = m.onHand - m.reserved;
  if (av <= 0) return { key: 'out', label: 'Out of stock', bar: 'bg-rose-600', dot: 'bg-rose-600', badge: 'bg-rose-100 text-rose-800 ring-rose-600/30 dark:bg-rose-500/20 dark:text-rose-200' };
  if (av < m.reorder) return { key: 'below', label: 'Below reorder', bar: 'bg-rose-500', dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 ring-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300' };
  if (av < m.reorder * 1.5) return { key: 'low', label: 'Low stock', bar: 'bg-amber-500', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300' };
  return { key: 'ok', label: 'Healthy', bar: 'bg-emerald-500', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300' };
}

export default function StockLedger({ params = {} }) {
  const { state } = useStore();
  const [code, setCode] = useState(params.code || 'ALL');
  useEffect(() => { if (params.code) setCode(params.code); }, [params.code]);
  const [type, setType] = useState('ALL');
  const mat = (c) => state.materials.find((m) => m.code === c);
  /* Total IN and total OUT per material from the ledger movements */
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const totals = (code) => state.ledger.filter((l) => l.code === code).reduce((t, l) => (
    l.type === 'IN' ? { ...t, inQty: r3(t.inQty + l.qty) } : { ...t, outQty: r3(t.outQty + l.qty) }
  ), { inQty: 0, outQty: 0 });
  const rows = state.ledger.filter((l) => (code === 'ALL' || l.code === code) && (type === 'ALL' || l.type === type));
  const totalIn = state.ledger.filter((l) => l.type === 'IN' && l.ref !== 'Opening stock').length;
  const totalOut = state.ledger.filter((l) => l.type === 'OUT').length;
  const reserved = state.materials.filter((m) => m.reserved > 0).length;

  return (
    <>
      <PageHeader module="inventory" icon={BookText} title="Stock Ledger" subtitle="Current balances and every stock movement, kept in the JSON store."
        actions={<NewMaterialButton />} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Raw materials" value={state.materials.length} icon={Boxes} color="blue" />
        <Stat label="Stock in entries" value={totalIn} hint="Excluding opening stock" icon={ArrowDownLeft} color="teal" />
        <Stat label="Stock out entries" value={totalOut} hint="Posted on office acceptance" icon={ArrowUpRight} color="red" />
        <Stat label="With reservations" value={reserved} hint="Issued, awaiting acceptance" icon={Lock} color="orange" />
      </div>

      <Card className="mb-6">
        <CardHeader title="Stock balances" subtitle="Quantity available in stock per material · click a row for its IN/OUT movements" icon={Boxes} tone="inventory"
          action={<button onClick={() => navigate('inventory/movements')} className="text-[0.8125rem] font-semibold text-prod-500 hover:underline">Stock Movement →</button>} />
        <Table
          rowKey={(m) => m.code}
          rows={state.materials}
          onRowClick={(m) => navigate('inventory/movements', { code: m.code })}
          columns={[
            { key: 'code', label: 'Code', render: (m) => <Mono>{m.code}</Mono> },
            { key: 'name', label: 'Material', render: (m) => <div><div className="font-medium">{m.name}{m.active === false && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">Inactive</span>}</div><div className="flex items-center gap-1 text-[0.6875rem] text-slate-400"><MapPin size={11} />{m.location}</div></div> },
            /* Only the quantity available in stock (IN/OUT detail lives on the Stock Movement page) */
            { key: 'av', label: 'Available stock', align: 'right', render: (m) => (
              <span><b className="text-base">{fmtNum(available(m))}</b> <span className="text-xs text-slate-400">{m.unit}</span></span>
            ) },
            /* Ledger check: stock record must equal IN − OUT; explains the gap to Available when stock is reserved */
            { key: 'lg', label: 'Ledger check', render: (m) => {
              const bal = ledgerBalance(state, m.code);
              const ok = Math.abs(bal - m.onHand) < 0.001;
              return (
                <div title="Ledger balance = all IN − all OUT for this material">
                  {ok
                    ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">✓ Matches ledger</span>
                    : <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">⚠ Mismatch</span>}
                  <div className="text-[0.6875rem] text-slate-500">
                    {ok ? `Ledger ${fmtNum(bal)} ${m.unit}` : `Record ${fmtNum(m.onHand)} ≠ ledger ${fmtNum(bal)}`}
                    {ok && m.reserved > 0 && <> · {fmtNum(m.reserved)} issued, not yet accepted</>}
                  </div>
                </div>
              );
            } },
            /* Level vs reorder: available against reorder level, with numbers */
            { key: 'lvl', label: 'Level vs reorder', className: 'w-48', render: (m) => {
              const lv = stockLevel(m);
              return (
                <div>
                  <Meter value={available(m)} max={Math.max(m.reorder * 2, 1)} tone={lv.bar} />
                  <div className="mt-1 flex justify-between text-[0.6875rem] text-slate-500">
                    <span>{fmtNum(available(m))} / {fmtNum(m.reorder)} {m.unit}</span>
                    <span className="font-semibold">{m.reorder > 0 ? `${Math.round((available(m) / m.reorder) * 100)}%` : '—'}</span>
                  </div>
                </div>
              );
            } },
            { key: 'st', label: 'Status', render: (m) => {
              const lv = stockLevel(m);
              return <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold ring-1 ring-inset', lv.badge)}><span className={cx('h-1.5 w-1.5 rounded-full', lv.dot)} />{lv.label}</span>;
            } },
            /* stopPropagation so clicks in the buttons / pop-ups don't trigger the row filter */
            { key: 'act', label: 'Actions', align: 'right', render: (m) => <span onClick={(e) => e.stopPropagation()}><MaterialRowActions m={m} /></span> },
          ]}
        />
      </Card>
      {/* Movements moved to their own page: Inventory → Stock Movement */}
    </>
  );
}
