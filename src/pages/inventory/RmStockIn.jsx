import { useEffect, useState } from 'react';
import { PackagePlus, Truck, ArrowDownToLine, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Button, Badge, Field, Mono, Table, EmptyState, inputCls, fmtNum, fmtDateTime, cx, useToast } from '../../components/ui';

export default function RmStockIn({ params }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const open = state.purchases.filter((p) => p.status === 'Ordered');
  const [mode, setMode] = useState('grn');
  const [poId, setPoId] = useState(params.po || open[0]?.id || '');
  const po = state.purchases.find((p) => p.id === poId && p.status === 'Ordered');
  const [recv, setRecv] = useState({});
  const [grnNo, setGrnNo] = useState('');
  const [direct, setDirect] = useState({ code: state.materials[0]?.code, qty: '', ref: '' });
  const mat = (c) => state.materials.find((m) => m.code === c);

  useEffect(() => {
    if (!po) return;
    setRecv(Object.fromEntries(po.items.map((it) => [it.code, it.qty])));
    setGrnNo(`GRN-${po.id.split('-').pop()}`);
  }, [poId]); // eslint-disable-line react-hooks/exhaustive-deps

  const postGrn = () => {
    dispatch('RECEIVE_GRN', { purchaseId: po.id, grnNo, items: po.items.map((it) => ({ code: it.code, qty: Number(recv[it.code] || 0) })) });
    toast(`${grnNo} posted. Stock updated`);
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card>
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
              <div className="space-y-4 p-5">
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
                    <div className="rounded-lg border border-slate-100 dark:border-white/[0.06]">
                      <div className="grid grid-cols-[1fr_100px_120px] gap-3 border-b border-slate-100 px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/[0.06]">
                        <span>Material</span><span className="text-right">Ordered</span><span>Received</span>
                      </div>
                      {po.items.map((it) => (
                        <div key={it.code} className="grid grid-cols-[1fr_100px_120px] items-center gap-3 px-4 py-2.5">
                          <div><div className="text-sm font-medium">{mat(it.code)?.name}</div><div className="text-[0.6875rem] text-slate-400">On hand {fmtNum(mat(it.code)?.onHand)} {mat(it.code)?.unit}</div></div>
                          <span className="tabular text-right text-sm">{fmtNum(it.qty)}</span>
                          <input type="number" className={inputCls} value={recv[it.code] ?? ''} onChange={(e) => setRecv({ ...recv, [it.code]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                    <Button variant="inventory" icon={CheckCircle2} className="w-full" onClick={postGrn} disabled={!grnNo}>Post GRN and stock in</Button>
                  </>
                )}
              </div>
            )
          ) : (
            <div className="space-y-4 p-5">
              <Field label="Material">
                <select className={inputCls} value={direct.code} onChange={(e) => setDirect({ ...direct, code: e.target.value })}>
                  {state.materials.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`Quantity (${mat(direct.code)?.unit})`}><input type="number" className={inputCls} value={direct.qty} onChange={(e) => setDirect({ ...direct, qty: e.target.value })} /></Field>
                <Field label="Reference"><input className={inputCls} value={direct.ref} placeholder="Challan / note" onChange={(e) => setDirect({ ...direct, ref: e.target.value })} /></Field>
              </div>
              <Button variant="inventory" icon={ArrowDownToLine} className="w-full" disabled={!(Number(direct.qty) > 0)} onClick={postDirect}>Post stock in</Button>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent stock in" subtitle="Latest IN entries in the stock ledger" icon={ArrowDownToLine} tone="inventory" />
          <Table
            rows={recent}
            empty={{ title: 'No receipts yet' }}
            columns={[
              { key: 'd', label: 'Date', render: (l) => <span className="whitespace-nowrap text-slate-500">{fmtDateTime(l.date)}</span> },
              { key: 'm', label: 'Material', render: (l) => mat(l.code)?.name },
              { key: 'q', label: 'Qty', align: 'right', render: (l) => <span className="font-semibold text-emerald-600">+{fmtNum(l.qty)}</span> },
              { key: 'r', label: 'Ref', render: (l) => <span className="text-xs text-slate-500">{l.ref}</span> },
            ]}
          />
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wider text-slate-500">Open purchase orders · {open.length}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {open.map((p) => (
          <button key={p.id} onClick={() => { setMode('grn'); setPoId(p.id); }} className="text-left">
            <Card className={cx('p-4 transition hover:-translate-y-0.5', po?.id === p.id && 'ring-4 ring-inv-500/20')}>
              <div className="flex items-center justify-between"><Mono>{p.id}</Mono><Badge status={p.status} /></div>
              <div className="mt-1 text-sm font-medium">{p.supplier}</div>
              <div className="text-xs text-slate-500">{p.items.length} line(s)</div>
            </Card>
          </button>
        ))}
      </div>
    </>
  );
}
