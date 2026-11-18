import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, Scale, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import { useStore, available } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Badge, Mono, Table, Stat, inputCls, fmtNum, fmtDateTime, cx } from '../../components/ui';
import { LedgerRowActions } from '../../components/rowActions';

const r3 = (n) => Math.round(Number(n || 0) * 1000) / 1000;

/* Where a movement came from, read from its reference */
const sourceOf = (l) => {
  if (/^Opening/i.test(l.ref)) return 'Opening stock';
  if (/GRN-/.test(l.ref)) return 'Purchase (GRN)';
  if (/Direct/i.test(l.ref)) return 'Direct stock in';
  if (l.type === 'OUT' && /PRD-/.test(l.ref)) return 'Production (office acceptance)';
  return l.type === 'IN' ? 'Stock in' : 'Stock out';
};

/*
  Stock Movement: read-only view of the ledger.
  Running balance is rebuilt per material in chronological order (oldest → newest),
  then shown newest first. Each entry's stored balance is checked against it. No movement is changed.
*/
export default function StockMovement({ params = {} }) {
  const { state } = useStore();
  const [code, setCode] = useState(params.code || 'ALL');
  const [type, setType] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { if (params.code) setCode(params.code); }, [params.code]);

  const mat = (c) => state.materials.find((m) => m.code === c);
  const idNum = (id) => parseInt(String(id).split('-').pop(), 10) || 0;

  /* 1. chronological order, 2. running balance per material, 3. compare with the stored balance */
  const rows = useMemo(() => {
    const sorted = [...state.ledger].sort((a, b) => (a.date === b.date ? idNum(a.id) - idNum(b.id) : a.date < b.date ? -1 : 1));
    const run = {};
    const withRun = sorted.map((l) => {
      const before = run[l.code] || 0;
      const after = r3(before + (l.type === 'IN' ? l.qty : -l.qty));
      run[l.code] = after;
      return { ...l, before, running: after, ok: Math.abs(after - Number(l.balance)) < 0.001, source: sourceOf(l) };
    });
    return withRun.reverse(); // newest first, only after the running balance is calculated
  }, [state.ledger]);

  const filtered = rows.filter((l) =>
    (code === 'ALL' || l.code === code)
    && (type === 'ALL' || l.type === type)
    && (!from || l.date.slice(0, 10) >= from)
    && (!to || l.date.slice(0, 10) <= to)
    && (!q || `${l.id} ${l.ref} ${mat(l.code)?.name || ''}`.toLowerCase().includes(q.toLowerCase())));

  const inQty = r3(filtered.filter((l) => l.type === 'IN').reduce((t, l) => t + l.qty, 0));
  const outQty = r3(filtered.filter((l) => l.type === 'OUT').reduce((t, l) => t + l.qty, 0));
  const mismatches = rows.filter((l) => !l.ok).length;

  /* Summary for one material: opening + IN − OUT = closing; closing − reserved = available */
  const m = code !== 'ALL' ? mat(code) : null;
  const own = m ? rows.filter((l) => l.code === code) : [];
  const opening = r3(own.filter((l) => l.source === 'Opening stock').reduce((t, l) => t + l.qty, 0));
  const ownIn = r3(own.filter((l) => l.type === 'IN' && l.source !== 'Opening stock').reduce((t, l) => t + l.qty, 0));
  const ownOut = r3(own.filter((l) => l.type === 'OUT').reduce((t, l) => t + l.qty, 0));
  const closing = r3(opening + ownIn - ownOut);

  return (
    <>
      <PageHeader module="inventory" title="Stock Movement" subtitle="Every IN and OUT with a running balance per material, rebuilt from the ledger oldest to newest. Read only." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Movements shown" value={filtered.length} icon={ArrowLeftRight} color="blue" hint={`${rows.length} in the ledger`} />
        <Stat label="Total IN" value={`+${fmtNum(inQty)}`} icon={ArrowDownLeft} color="teal" hint="For the current filter" />
        <Stat label="Total OUT" value={`−${fmtNum(outQty)}`} icon={ArrowUpRight} color="red" hint="For the current filter" />
        <Stat label="Balance check" value={mismatches ? `${mismatches} mismatch` : 'All match'} icon={mismatches ? AlertTriangle : CheckCircle2} color={mismatches ? 'orange' : 'teal'} hint="Stored balance vs running balance" />
      </div>

      {m && (
        <Card className="mb-6 p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Scale size={16} className="text-prod-500" />
            <span className="font-semibold">{m.name}</span><Mono className="text-slate-400">{m.code}</Mono>
          </div>
          <div className="grid gap-3 text-center sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['Opening', fmtNum(opening), ''],
              ['+ IN', `+${fmtNum(ownIn)}`, 'text-emerald-600'],
              ['− OUT', `−${fmtNum(ownOut)}`, 'text-rose-600'],
              ['= Closing', fmtNum(closing), Math.abs(closing - m.onHand) < 0.001 ? 'text-slate-900 dark:text-white' : 'text-rose-600'],
              ['− Reserved', `−${fmtNum(m.reserved)}`, 'text-indigo-600'],
              ['= Available', fmtNum(available(m)), 'text-prod-500'],
            ].map(([k, v, c]) => (
              <div key={k} className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.03]">
                <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">{k}</div>
                <div className={cx('mt-1 text-lg font-bold tabular', c)}>{v} <span className="text-xs font-normal text-slate-400">{m.unit}</span></div>
              </div>
            ))}
          </div>
          {Math.abs(closing - m.onHand) >= 0.001 && (
            <p className="mt-3 text-xs font-semibold text-rose-600">Closing balance from movements ({fmtNum(closing)}) differs from the stock record ({fmtNum(m.onHand)}).</p>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Movements" subtitle="Newest first · running balance calculated oldest to newest, per material" icon={ArrowLeftRight} />
        <div className="grid gap-2 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr_1.2fr] dark:border-white/[0.06]">
          <select className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} aria-label="Material">
            <option value="ALL">All materials</option>
            {state.materials.map((x) => <option key={x.code} value={x.code}>{x.code} · {x.name}</option>)}
          </select>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
            <option value="ALL">IN and OUT</option><option value="IN">IN only</option><option value="OUT">OUT only</option>
          </select>
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={cx(inputCls, 'pl-9')} placeholder="Entry, GRN, order…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Table
          rows={filtered}
          empty={{ icon: ArrowLeftRight, title: 'No movements match', text: 'Change the filters.' }}
          columns={[
            { key: 'id', label: 'Entry', render: (l) => <Mono className="text-slate-400">{l.id}</Mono> },
            { key: 'd', label: 'Date', render: (l) => <span className="whitespace-nowrap">{fmtDateTime(l.date)}</span> },
            { key: 'm', label: 'Material', render: (l) => <div><div className="font-medium">{mat(l.code)?.name ?? l.code}</div><Mono className="text-xs text-slate-400">{l.code}</Mono></div> },
            { key: 's', label: 'Source', render: (l) => <div><Badge status={l.type} /><div className="mt-1 text-[0.6875rem] text-slate-500">{l.source}</div></div> },
            { key: 'b4', label: 'Before', align: 'right', render: (l) => <span className="text-slate-500">{fmtNum(l.before)}</span> },
            { key: 'in', label: 'IN', align: 'right', render: (l) => (l.type === 'IN' ? <b className="text-emerald-600">+{fmtNum(l.qty)}</b> : <span className="text-slate-300">—</span>) },
            { key: 'out', label: 'OUT', align: 'right', render: (l) => (l.type === 'OUT' ? <b className="text-rose-600">−{fmtNum(l.qty)}</b> : <span className="text-slate-300">—</span>) },
            { key: 'bal', label: 'Balance', align: 'right', render: (l) => (
              <div>
                <b>{fmtNum(l.running)}</b> <span className="text-xs text-slate-400">{mat(l.code)?.unit}</span>
                {!l.ok && <div className="text-[0.6875rem] font-semibold text-rose-600">stored {fmtNum(l.balance)}</div>}
              </div>
            ) },
            { key: 'chk', label: 'Check', render: (l) => (l.ok
              ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={13} />OK</span>
              : <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><AlertTriangle size={13} />Mismatch</span>) },
            { key: 'r', label: 'Reference', render: (l) => <span className="text-xs text-slate-500">{l.ref}</span> },
            { key: 'act', label: 'Actions', align: 'right', render: (l) => <LedgerRowActions entry={l} /> },
          ]}
        />
      </Card>
    </>
  );
}
