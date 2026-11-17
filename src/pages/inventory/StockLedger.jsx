import { useEffect, useState } from 'react';
import { MaterialRowActions, LedgerRowActions, NewMaterialButton } from '../../components/rowActions';
import { BookText, ArrowDownLeft, ArrowUpRight, Boxes, MapPin, Lock } from 'lucide-react';
import { useStore, available, ledgerBalance } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Badge, Mono, Table, Stat, Meter, inputCls, fmtNum, fmtDateTime, cx } from '../../components/ui';

export default function StockLedger({ params = {} }) {
  const { state } = useStore();
  const [code, setCode] = useState(params.code || 'ALL');
  useEffect(() => { if (params.code) setCode(params.code); }, [params.code]);
  const [type, setType] = useState('ALL');
  const mat = (c) => state.materials.find((m) => m.code === c);
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
        <CardHeader title="Stock balances" subtitle="Available = on hand − reserved" icon={Boxes} tone="inventory" />
        <Table
          rowKey={(m) => m.code}
          rows={state.materials}
          onRowClick={(m) => setCode(m.code)}
          columns={[
            { key: 'code', label: 'Code', render: (m) => <Mono>{m.code}</Mono> },
            { key: 'name', label: 'Material', render: (m) => <div><div className="font-medium">{m.name}{m.active === false && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">Inactive</span>}</div><div className="flex items-center gap-1 text-[0.6875rem] text-slate-400"><MapPin size={11} />{m.location}</div></div> },
            { key: 'oh', label: 'On hand', align: 'right', render: (m) => `${fmtNum(m.onHand)} ${m.unit}` },
            { key: 'rs', label: 'Reserved', align: 'right', render: (m) => (m.reserved ? <span className="text-indigo-600">{fmtNum(m.reserved)}</span> : <span className="text-slate-300">0</span>) },
            { key: 'av', label: 'Available', align: 'right', render: (m) => <b>{fmtNum(available(m))}</b> },
            { key: 'lg', label: 'Ledger check', render: (m) => {
              const bal = ledgerBalance(state, m.code);
              return Math.abs(bal - m.onHand) < 0.001
                ? <span className="text-xs font-semibold text-emerald-600">✓ Matches ({fmtNum(bal)})</span>
                : <span className="text-xs font-semibold text-rose-600" title="On hand does not equal IN − OUT">⚠ Ledger {fmtNum(bal)}</span>;
            } },
            { key: 'lvl', label: 'Level vs reorder', className: 'w-44', render: (m) => <div><Meter value={available(m)} max={m.reorder * 3} tone={available(m) < m.reorder ? 'bg-rose-500' : 'bg-prod-500'} /><div className="mt-1 text-[0.6875rem] text-slate-400">Reorder at {fmtNum(m.reorder)}</div></div> },
            { key: 'st', label: 'Status', render: (m) => (available(m) < m.reorder ? <Badge status="Shortage">Below reorder</Badge> : <Badge status="Received">Healthy</Badge>) },
            /* stopPropagation so clicks in the buttons / pop-ups don't trigger the row filter */
            { key: 'act', label: 'Actions', align: 'right', render: (m) => <span onClick={(e) => e.stopPropagation()}><MaterialRowActions m={m} /></span> },
          ]}
        />
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-inv-50 text-inv-700 dark:bg-inv-500/10 dark:text-inv-500"><BookText size={18} /></span>
            <div><h3 className="text-[0.9375rem] font-semibold">Movements</h3><p className="text-xs text-slate-500">{rows.length} entries</p></div>
          </div>
          <div className="flex gap-2">
            <select className={cx(inputCls, 'sm:w-56')} value={code} onChange={(e) => setCode(e.target.value)}>
              <option value="ALL">All materials</option>
              {state.materials.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
            </select>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-white/[0.05]">
              {['ALL', 'IN', 'OUT'].map((t) => (
                <button key={t} onClick={() => setType(t)} className={cx('rounded-lg px-3 text-xs font-semibold transition', type === t ? 'bg-white shadow-sm dark:bg-ink-800' : 'text-slate-500')}>{t === 'ALL' ? 'All' : t}</button>
              ))}
            </div>
          </div>
        </div>
        <Table
          rows={rows}
          empty={{ icon: BookText, title: 'No movements match' }}
          columns={[
            { key: 'id', label: 'Entry', render: (l) => <Mono className="text-slate-400">{l.id}</Mono> },
            { key: 'd', label: 'Date', render: (l) => <span className="whitespace-nowrap">{fmtDateTime(l.date)}</span> },
            { key: 'm', label: 'Material', render: (l) => mat(l.code)?.name },
            { key: 't', label: 'Type', render: (l) => <Badge status={l.type} /> },
            { key: 'q', label: 'Qty', align: 'right', render: (l) => <b className={l.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>{l.type === 'IN' ? '+' : '−'}{fmtNum(l.qty)}</b> },
            { key: 'b', label: 'Balance', align: 'right', render: (l) => `${fmtNum(l.balance)} ${mat(l.code)?.unit}` },
            { key: 'r', label: 'Reference', render: (l) => <span className="text-xs text-slate-500">{l.ref}</span> },
            { key: 'act', label: 'Actions', align: 'right', render: (l) => <LedgerRowActions entry={l} /> },
          ]}
        />
      </Card>
    </>
  );
}
