import { useState } from 'react';
import { ShoppingCart, Plus, FileText, PackagePlus, Trash2, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Button, Badge, Modal, Field, Mono, Table, EmptyState, inputCls, fmtNum, fmtDate, fmtDateTime, useToast } from '../../components/ui';
import RequestItems from '../../components/RequestItems';
import { navigate } from '../../router';

const SUPPLIERS = ['Gujarat Alkalies Ltd.', 'Deepak Chem Traders', 'Aarti Industrial Supply', 'Shree Ram Acids', 'National Peroxide Co.'];
const RATES = { 'RM-001': 9.5, 'RM-002': 4.2, 'RM-003': 38, 'RM-004': 46, 'RM-005': 7.8, 'RM-006': 0.4, 'RM-007': 92, 'RM-008': 21 };
const value = (items) => items.reduce((s, it) => s + Number(it.qty) * Number(it.rate || 0), 0);

export default function RawMaterialPurchase() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [po, setPo] = useState(null); // { reqId, items, supplier, expected }
  const pendingReqs = state.requests.filter((r) => r.type === 'PURCHASE' && r.status === 'Pending');
  const mat = (c) => state.materials.find((m) => m.code === c);
  const inAWeek = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);

  const openFromReq = (r) => setPo({ reqId: r.id, supplier: SUPPLIERS[0], expected: inAWeek, items: r.items.map((it) => ({ ...it, qty: Math.ceil(it.qty / 50) * 50, rate: RATES[it.code] ?? 10 })) });
  const openBlank = () => setPo({ reqId: null, supplier: SUPPLIERS[0], expected: inAWeek, items: [{ code: state.materials[0].code, qty: 100, rate: RATES[state.materials[0].code] ?? 10 }] });
  const setItem = (i, patch) => setPo({ ...po, items: po.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const raise = () => {
    dispatch('RAISE_PO', { ...po, items: po.items.map((it) => ({ code: it.code, qty: Number(it.qty), rate: Number(it.rate) })) });
    setPo(null);
    toast('Purchase order raised');
  };

  return (
    <>
      <PageHeader module="inventory" icon={ShoppingCart} title="Raw Material Purchase" subtitle="Turn Production's purchase requirements into purchase orders, then receive them through GRN."
        actions={<Button variant="inventory" icon={Plus} onClick={openBlank}>New purchase order</Button>} />

      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
        <AlertTriangle size={15} className="text-amber-500" /> Purchase requirements from Production · {pendingReqs.length}
      </h2>
      {pendingReqs.length === 0 ? (
        <Card className="mb-8"><EmptyState icon={ShoppingCart} title="No open requirements" text="When Production finds a shortage, the requirement lands here." /></Card>
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pendingReqs.map((r) => (
            <Card key={r.id} className="border-l-4 border-l-amber-400 p-5">
              <div className="flex items-center justify-between"><Mono>{r.id}</Mono><Badge status={r.status} /></div>
              <div className="mt-1 text-sm text-slate-500">For order <Mono className="text-prod-600">{r.orderId}</Mono> · {fmtDateTime(r.createdAt)}</div>
              <div className="mt-3"><RequestItems items={r.items} /></div>
              <Button variant="inventory" icon={FileText} className="mt-4 w-full" onClick={() => openFromReq(r)}>Raise PO</Button>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="Purchase orders" subtitle={`${state.purchases.length} total`} icon={FileText} tone="inventory" />
        <Table
          rows={state.purchases}
          empty={{ icon: FileText, title: 'No purchase orders yet' }}
          columns={[
            { key: 'id', label: 'PO', render: (p) => <Mono>{p.id}</Mono> },
            { key: 'supplier', label: 'Supplier', render: (p) => <span className="font-medium">{p.supplier}</span> },
            { key: 'items', label: 'Materials', render: (p) => <RequestItems items={p.items} max={2} /> },
            { key: 'val', label: 'Value', align: 'right', render: (p) => `₹ ${fmtNum(Math.round(value(p.items)))}` },
            { key: 'req', label: 'Requirement', render: (p) => (p.reqId ? <Mono className="text-prod-600">{p.reqId}</Mono> : <span className="text-xs text-slate-400">Direct</span>) },
            { key: 'exp', label: 'Expected', render: (p) => fmtDate(p.expected) },
            { key: 'st', label: 'Status', render: (p) => <Badge status={p.status} /> },
            { key: 'a', label: '', align: 'right', render: (p) => p.status === 'Ordered'
              ? <Button size="sm" variant="inventory" icon={PackagePlus} onClick={() => navigate('inventory/stock-in', { po: p.id })}>Receive GRN</Button>
              : <Mono className="text-emerald-600">{p.grnNo}</Mono> },
          ]}
        />
      </Card>

      <Modal open={!!po} onClose={() => setPo(null)} title="Raise purchase order" subtitle={po?.reqId ? `Against requirement ${po.reqId}` : 'Direct purchase'} width="max-w-2xl"
        footer={<><Button variant="ghost" onClick={() => setPo(null)}>Cancel</Button><Button variant="inventory" icon={FileText} onClick={raise} disabled={!po?.items.length}>Raise PO</Button></>}>
        {po && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Supplier"><select className={inputCls} value={po.supplier} onChange={(e) => setPo({ ...po, supplier: e.target.value })}>{SUPPLIERS.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Expected delivery"><input type="date" className={inputCls} value={po.expected} onChange={(e) => setPo({ ...po, expected: e.target.value })} /></Field>
            </div>
            <div className="mt-5 grid grid-cols-[1fr_110px_110px_32px] gap-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">
              <span>Material</span><span>Qty</span><span>Rate ₹</span><span />
            </div>
            <div className="mt-2 space-y-2">
              {po.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_110px_32px] gap-2">
                  <select className={inputCls} value={it.code} disabled={!!po.reqId} onChange={(e) => setItem(i, { code: e.target.value, rate: RATES[e.target.value] ?? 10 })}>
                    {state.materials.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
                  </select>
                  <input type="number" className={inputCls} value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} />
                  <input type="number" className={inputCls} value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} />
                  {!po.reqId && <button className="text-slate-400 hover:text-rose-500" onClick={() => setPo({ ...po, items: po.items.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 size={16} /></button>}
                </div>
              ))}
            </div>
            {!po.reqId && <Button size="sm" variant="soft" icon={Plus} className="mt-2" onClick={() => setPo({ ...po, items: [...po.items, { code: state.materials[0].code, qty: 100, rate: RATES[state.materials[0].code] ?? 10 }] })}>Add line</Button>}
            <div className="mt-5 flex items-center justify-between rounded-lg bg-inv-50 px-4 py-3 dark:bg-inv-500/10">
              <span className="text-sm font-semibold text-inv-700 dark:text-inv-100">PO value</span>
              <span className="text-lg font-extrabold tabular text-inv-700 dark:text-inv-100">₹ {fmtNum(Math.round(value(po.items)))}</span>
            </div>
            {po.reqId && <p className="mt-2 text-xs text-slate-500">Quantities are rounded up to the nearest 50 {mat(po.items[0]?.code)?.unit}. Adjust if needed.</p>}
          </>
        )}
      </Modal>
    </>
  );
}
