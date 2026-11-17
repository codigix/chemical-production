import { useEffect, useState } from 'react';
import { LedgerRowActions } from '../../components/rowActions';
import { PackagePlus, Truck, ArrowDownToLine, CheckCircle2, Building2, CalendarDays, FileText, IndianRupee } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Button, Badge, Field, Mono, Table, EmptyState, inputCls, fmtNum, fmtDate, fmtDateTime, cx, useToast } from '../../components/ui';

const money = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function RmStockIn({ params }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const open = state.purchases.filter((p) => p.status === 'Ordered');
  const [mode, setMode] = useState('grn');
  const [poId, setPoId] = useState(params.po || open[0]?.id || '');
  const po = state.purchases.find((p) => p.id === poId && p.status === 'Ordered');
  const [recv, setRecv] = useState([]); // received qty per PO line (by position)
  const [grnNo, setGrnNo] = useState('');
  const [direct, setDirect] = useState({ code: state.materials[0]?.code, qty: '', ref: '' });
  const mat = (c) => state.materials.find((m) => m.code === c);

  useEffect(() => {
    if (!po) return;
    setRecv(po.items.map((it) => it.qty));
    setGrnNo(`GRN-${po.id.split('-').pop()}`);
  }, [poId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Line calculations */
  const lines = po ? po.items.map((it, i) => {
    const received = Number(recv[i]) || 0;
    const rate = Number(it.rate) || 0;
    return { ...it, i, rate, received, pending: it.qty - received, orderedValue: it.qty * rate, receivedValue: received * rate };
  }) : [];
  const totals = lines.reduce((t, l) => ({
    orderedQty: t.orderedQty + l.qty, receivedQty: t.receivedQty + l.received,
    orderedValue: t.orderedValue + l.orderedValue, receivedValue: t.receivedValue + l.receivedValue,
  }), { orderedQty: 0, receivedQty: 0, orderedValue: 0, receivedValue: 0 });
  const invalid = lines.some((l) => l.received < 0) || totals.receivedQty <= 0;

  const postGrn = () => {
    dispatch('RECEIVE_GRN', { purchaseId: po.id, grnNo, items: lines.map((l) => ({ code: l.code, qty: l.received, rate: l.rate })) });
    toast(`${grnNo} posted · ${fmtNum(totals.receivedQty)} received · ${money(totals.receivedValue)}`);
    const next = open.find((p) => p.id !== po.id);
    setPoId(next?.id || '');
  };
  const postDirect = () => {
    dispatch('DIRECT_STOCK_IN', direct);
    toast('Stock in posted');
    setDirect({ ...direct, qty: '', ref: '' });
  };

  const recent = state.ledger.filter((l) => l.type === 'IN').slice(0, 12);

  return (
    <>
      <PageHeader module="inventory" icon={PackagePlus} title="RM Stock In" subtitle="Receive goods against a purchase order (GRN) or post a direct stock entry." />

      <Card className="mb-6">
        <div className="flex gap-1 border-b border-slate-100 p-2 dark:border-white/[0.06]">
          {[['grn', 'Receive against PO', Truck], ['direct', 'Direct stock in', ArrowDownToLine]].map(([k, l, I]) => (
            <button key={k} onClick={() => setMode(k)} className={cx('flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition', mode === k ? 'bg-inv-50 text-inv-700 dark:bg-inv-500/10 dark:text-inv-100' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.03]')}>
              <I size={16} />{l}
            </button>
          ))}
        </div>

        {mode === 'grn' ? (
          open.length === 0 ? (
            <EmptyState icon={Truck} title="No open purchase orders" text="Raise a PO from Raw Material Purchase first." />
          ) : (
            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Purchase order">
                  <select className={inputCls} value={po?.id || ''} onChange={(e) => setPoId(e.target.value)}>
                    <option value="" disabled>Select PO</option>
                    {open.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.supplier}</option>)}
                  </select>
                </Field>
                <Field label="GRN number"><input className={inputCls} value={grnNo} onChange={(e) => setGrnNo(e.target.value)} /></Field>
              </div>

              {po && (
                <>
                  {/* PO summary */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      [Building2, 'Supplier', po.supplier],
                      [CalendarDays, 'Expected', fmtDate(po.expected)],
                      [FileText, 'Requirement', po.reqId || 'Direct purchase'],
                      [IndianRupee, 'PO value', money(totals.orderedValue)],
                    ].map(([I, k, v]) => (
                      <div key={k} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/[0.03]">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prod-50 text-prod-500 dark:bg-prod-500/15"><I size={16} /></span>
                        <div className="min-w-0"><div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">{k}</div><div className="truncate text-sm font-semibold">{v}</div></div>
                      </div>
                    ))}
                  </div>

                  {/* Lines */}
                  <div className="overflow-x-auto rounded-lg border border-line scrollbar-thin dark:border-white/[0.07]">
                    <table className="w-full min-w-[52rem] text-left text-sm">
                      <thead>
                        <tr className="bg-prod-50/70 text-[0.78rem] text-slate-700 dark:bg-white/[0.03] dark:text-slate-300">
                          <th className="px-3 py-2.5 font-semibold">#</th>
                          <th className="px-3 py-2.5 font-semibold">Material</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Rate</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Ordered</th>
                          <th className="w-36 px-3 py-2.5 font-semibold">Received</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Pending</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l) => {
                          const m = mat(l.code);
                          return (
                            <tr key={l.i} className="border-t border-line dark:border-white/[0.05]">
                              <td className="px-3 py-3 text-slate-400">{l.i + 1}</td>
                              <td className="px-3 py-3">
                                <div className="font-medium text-slate-900 dark:text-white">{m?.name ?? l.code}</div>
                                <div className="text-[0.72rem] text-slate-500"><Mono className="text-prod-500">{l.code}</Mono> · On hand {fmtNum(m?.onHand)} {m?.unit}</div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular">₹{l.rate} <span className="text-xs text-slate-400">/ {m?.unit}</span></td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular">{fmtNum(l.qty)} <span className="text-xs text-slate-400">{m?.unit}</span></td>
                              <td className="px-3 py-3">
                                <input type="number" min="0" className={cx(inputCls, 'h-9')} value={recv[l.i] ?? ''} aria-label={`Received quantity for ${m?.name}`}
                                  onChange={(e) => setRecv(recv.map((v, j) => (j === l.i ? e.target.value : v)))} />
                              </td>
                              <td className={cx('whitespace-nowrap px-3 py-3 text-right tabular font-semibold',
                                l.pending > 0 ? 'text-orange-600' : l.pending < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                {l.pending > 0 ? `${fmtNum(l.pending)} short` : l.pending < 0 ? `${fmtNum(-l.pending)} excess` : 'Full'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right tabular font-semibold">{money(l.receivedValue)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-line bg-slate-50 font-semibold dark:border-white/10 dark:bg-white/[0.03]">
                          <td className="px-3 py-3" colSpan={3}>Total · {lines.length} line{lines.length === 1 ? '' : 's'}</td>
                          <td className="px-3 py-3 text-right tabular">{fmtNum(totals.orderedQty)}</td>
                          <td className="px-3 py-3 tabular">{fmtNum(totals.receivedQty)}</td>
                          <td className="px-3 py-3 text-right text-xs text-slate-500">PO {money(totals.orderedValue)}</td>
                          <td className="px-3 py-3 text-right tabular text-prod-500">{money(totals.receivedValue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500">Rates come from the purchase order. Received quantity defaults to the ordered quantity; change it if the delivery was short or excess. Lines with 0 are not stocked in.</p>
                  <Button variant="inventory" icon={CheckCircle2} className="w-full" onClick={postGrn} disabled={!grnNo || invalid}>
                    Post GRN and stock in · {money(totals.receivedValue)}
                  </Button>
                </>
              )}
            </div>
          )
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
            <Field label="Material">
              <select className={inputCls} value={direct.code} onChange={(e) => setDirect({ ...direct, code: e.target.value })}>
                {state.materials.filter((m) => m.active !== false).map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
              </select>
            </Field>
            <Field label={`Quantity (${mat(direct.code)?.unit})`}><input type="number" className={inputCls} value={direct.qty} onChange={(e) => setDirect({ ...direct, qty: e.target.value })} /></Field>
            <Field label="Reference"><input className={inputCls} value={direct.ref} placeholder="Challan / note" onChange={(e) => setDirect({ ...direct, ref: e.target.value })} /></Field>
            <Button variant="inventory" icon={ArrowDownToLine} disabled={!(Number(direct.qty) > 0)} onClick={postDirect}>Post stock in</Button>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Recent stock in" subtitle="Latest IN entries in the stock ledger" icon={ArrowDownToLine} />
        <Table
          rows={recent}
          empty={{ title: 'No receipts yet' }}
          columns={[
            { key: 'd', label: 'Date', render: (l) => <span className="whitespace-nowrap text-slate-500">{fmtDateTime(l.date)}</span> },
            { key: 'm', label: 'Material', render: (l) => <div><div className="font-medium">{mat(l.code)?.name}</div><Mono className="text-xs text-slate-400">{l.code}</Mono></div> },
            { key: 'q', label: 'Qty', align: 'right', render: (l) => <span className="font-semibold text-emerald-600">+{fmtNum(l.qty)} <span className="text-xs font-normal text-slate-400">{mat(l.code)?.unit}</span></span> },
            { key: 'rate', label: 'Rate', align: 'right', render: (l) => (l.rate != null ? `₹${l.rate}` : <span className="text-slate-300">—</span>) },
            { key: 'val', label: 'Value', align: 'right', render: (l) => (l.value != null ? <b>{money(l.value)}</b> : <span className="text-slate-300">—</span>) },
            { key: 'r', label: 'Ref', render: (l) => <span className="text-xs text-slate-500">{l.ref}</span> },
            { key: 'act', label: 'Actions', align: 'right', render: (l) => <LedgerRowActions entry={l} /> },
          ]}
        />
      </Card>

      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wider text-slate-500">Open purchase orders · {open.length}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {open.map((p) => (
          <button key={p.id} onClick={() => { setMode('grn'); setPoId(p.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-left">
            <Card className={cx('p-4 transition hover:-translate-y-0.5', po?.id === p.id && 'ring-4 ring-inv-500/20')}>
              <div className="flex items-center justify-between"><Mono>{p.id}</Mono><Badge status={p.status} /></div>
              <div className="mt-1 text-sm font-medium">{p.supplier}</div>
              <div className="text-xs text-slate-500">{p.items.length} line(s) · {money(p.items.reduce((t, it) => t + it.qty * (it.rate || 0), 0))}</div>
            </Card>
          </button>
        ))}
      </div>
    </>
  );
}
