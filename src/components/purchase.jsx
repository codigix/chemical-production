import { useState } from 'react';
import { Plus, FileText, Trash2, Send, Save, Truck, Trophy } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { Button, Modal, Field, Mono, inputCls, fmtNum, fmtDate, cx, useToast } from './ui';
import { navigate } from '../router';

/*
  Shared purchase flow used by:
  Purchase Requirements · RFQ & Quotation · Purchase Orders
  Requirement → RFQ → supplier quotes (compare, L1) → PO → GRN
*/
export const SUPPLIERS = ['Gujarat Alkalies Ltd.', 'Deepak Chem Traders', 'Aarti Industrial Supply', 'Shree Ram Acids', 'National Peroxide Co.'];
export const poValue = (items) => items.reduce((s, it) => s + Number(it.qty) * Number(it.rate || 0), 0);
const isoIn = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

/* Steps strip shown on all three pages */
export function PurchaseSteps({ active }) {
  const steps = [
    { key: 'req', label: 'Requirement', to: 'inventory/purchase' },
    { key: 'rfq', label: 'RFQ & Quotation', to: 'inventory/rfq' },
    { key: 'po', label: 'Purchase Order', to: 'inventory/purchase-orders' },
    { key: 'grn', label: 'GRN / Stock In', to: 'inventory/stock-in' },
  ];
  const ai = steps.findIndex((s) => s.key === active);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2 dark:border-white/[0.07] dark:bg-ink-900">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          {i > 0 && <span className={cx('h-px w-6', i <= ai ? 'bg-prod-500' : 'bg-slate-200 dark:bg-white/10')} />}
          <button onClick={() => navigate(s.to)}
            className={cx('flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              i === ai ? 'bg-prod-500 text-white' : i < ai ? 'text-prod-600 hover:bg-prod-50 dark:text-prod-300' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.04]')}>
            <span className={cx('grid h-5 w-5 place-items-center rounded-full text-[0.625rem]', i === ai ? 'bg-white/20' : i < ai ? 'bg-prod-50 dark:bg-white/10' : 'bg-slate-100 dark:bg-white/[0.06]')}>{i < ai ? '✓' : i + 1}</span>
            {s.label}
          </button>
        </div>
      ))}
    </div>
  );
}

export function usePurchaseFlow() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const mat = (c) => state.materials.find((m) => m.code === c);
  const rateOf = (code) => Number(mat(code)?.rate) || 0;
  const activeSup = (state.suppliers || []).filter((x) => x.active !== false).map((x) => x.name);
  /* material's preferred supplier if still active, else the first active supplier */
  const supplierOf = (code) => (activeSup.includes(mat(code)?.supplier) ? mat(code).supplier : activeSup[0] || mat(code)?.supplier || SUPPLIERS[0]);
  const rfqs = state.rfqs || [];
  const activeMats = state.materials.filter((m) => m.active !== false);

  /* ---------- PO ---------- */
  const [po, setPo] = useState(null); // { reqId, rfqId, items, supplier, expected }
  /* Active suppliers from the Supplier Master (plus the one already on the PO) */
  const supplierOptions = [...new Set([...(state.suppliers || []).filter((x) => x.active !== false).map((x) => x.name), po?.supplier].filter(Boolean))];
  const openPoFromReq = (r) => setPo({ reqId: r.id, supplier: supplierOf(r.items[0]?.code), expected: isoIn(5), items: r.items.map((it) => ({ ...it, required: it.qty, rate: rateOf(it.code) })) });
  const openPoBlank = () => setPo({ reqId: null, supplier: supplierOf(activeMats[0]?.code), expected: isoIn(5), items: [{ code: activeMats[0]?.code, qty: 100, rate: rateOf(activeMats[0]?.code) }] });
  const short = !!po?.items.some((it) => it.required != null && Number(it.qty) < it.required);
  const setItem = (i, patch) => setPo({ ...po, items: po.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const raise = () => {
    dispatch('RAISE_PO', { ...po, items: po.items.map((it) => ({ code: it.code, qty: Number(it.qty), rate: Number(it.rate) })) });
    toast(po.rfqId ? `Purchase order raised from ${po.rfqId}` : 'Purchase order raised');
    setPo(null);
    navigate('inventory/purchase-orders');
  };

  /* ---------- RFQ ---------- */
  const [rfqForm, setRfqForm] = useState(null); // { reqId, items, suppliers, dueDate, notes }
  const openRfqFromReq = (r) => setRfqForm({ reqId: r.id, items: r.items.map((it) => ({ code: it.code, qty: it.qty })), suppliers: [...new Set(r.items.map((it) => supplierOf(it.code)))], dueDate: isoIn(3), notes: '' });
  const openRfqBlank = () => setRfqForm({ reqId: null, items: [{ code: activeMats[0]?.code, qty: 100 }], suppliers: [supplierOf(activeMats[0]?.code)], dueDate: isoIn(3), notes: '' });
  const rfqValid = rfqForm && rfqForm.suppliers.length > 0 && rfqForm.dueDate && rfqForm.items.length > 0 && rfqForm.items.every((it) => it.code && Number(it.qty) > 0);
  const sendRfq = () => {
    dispatch('CREATE_RFQ', { ...rfqForm, items: rfqForm.items.map((it) => ({ code: it.code, qty: Number(it.qty) })) });
    toast(`RFQ sent to ${rfqForm.suppliers.length} supplier(s)`);
    setRfqForm(null);
    navigate('inventory/rfq');
  };

  /* ---------- Quotes ---------- */
  const [quoting, setQuoting] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [pick, setPick] = useState('');
  const curRfq = rfqs.find((x) => x.id === quoting);
  const openQuotes = (rfq) => {
    const q = {};
    rfq.suppliers.forEach((s) => { q[s] = { rates: { ...(rfq.quotes?.[s]?.rates || {}) }, days: rfq.quotes?.[s]?.days ?? '', terms: rfq.quotes?.[s]?.terms ?? '' }; });
    setQuotes(q); setQuoting(rfq.id);
    /* pre-select the saved choice, else L1 */
    setPick(rfq.selected || '');
  };
  const quoteTotal = (rfq, s, src = quotes) => {
    const q = src[s];
    if (!q || rfq.items.some((it) => !(Number(q.rates?.[it.code]) > 0))) return null;
    return rfq.items.reduce((t, it) => t + Number(it.qty) * Number(q.rates[it.code]), 0);
  };
  const cleanQuotes = () => Object.fromEntries(Object.entries(quotes)
    .filter(([, q]) => Object.values(q.rates).some((v) => Number(v) > 0))
    .map(([s, q]) => [s, { rates: Object.fromEntries(Object.entries(q.rates).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])), days: q.days === '' ? '' : Number(q.days), terms: q.terms }]));
  const saveQuotes = () => { dispatch('SAVE_QUOTES', { rfqId: curRfq.id, quotes: cleanQuotes() }); toast(`Quotes saved on ${curRfq.id}`); setQuoting(null); };
  const poFromQuote = () => {
    const rfq = curRfq;
    const q = quotes[pick];
    dispatch('SAVE_QUOTES', { rfqId: rfq.id, quotes: cleanQuotes() });
    setQuoting(null);
    setPo({ reqId: rfq.reqId, rfqId: rfq.id, supplier: pick, expected: Number(q.days) > 0 ? isoIn(Number(q.days)) : isoIn(5),
      items: rfq.items.map((it) => ({ code: it.code, qty: it.qty, required: rfq.reqId ? it.qty : undefined, rate: Number(q.rates[it.code]) })) });
  };

  /* ---------- Modals ---------- */
  const matOptions = (cur) => state.materials.filter((m) => m.active !== false || m.code === cur);

  const modals = (
    <>
      {/* Raise PO */}
      <Modal open={!!po} onClose={() => setPo(null)} title="Raise purchase order" width="max-w-2xl"
        subtitle={po?.rfqId ? `From ${po.rfqId}${po.reqId ? ` · requirement ${po.reqId}` : ''} · selected quote` : po?.reqId ? `Against requirement ${po.reqId}` : 'Direct purchase'}
        footer={<><Button variant="ghost" onClick={() => setPo(null)}>Cancel</Button><Button variant="inventory" icon={FileText} onClick={raise} disabled={!po?.items.length || short || po.items.some((it) => !(Number(it.qty) > 0))}>Raise PO</Button></>}>
        {po && (
          <>
            {po.rfqId && <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Trophy size={14} />Rates and delivery taken from {po.supplier}'s quote on {po.rfqId}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Supplier"><select className={inputCls} value={po.supplier} disabled={!!po.rfqId} onChange={(e) => setPo({ ...po, supplier: e.target.value })}>{supplierOptions.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Expected delivery"><input type="date" className={inputCls} value={po.expected} onChange={(e) => setPo({ ...po, expected: e.target.value })} /></Field>
            </div>
            <div className="mt-5 grid grid-cols-[1fr_110px_110px_32px] gap-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500"><span>Material</span><span>Qty</span><span>Rate ₹</span><span /></div>
            <div className="mt-2 space-y-2">
              {po.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_110px_32px] gap-2">
                  <select className={inputCls} value={it.code} disabled={!!po.reqId || !!po.rfqId}
                    onChange={(e) => {
                      const code = e.target.value;
                      const items = po.items.map((x, j) => (j === i ? { ...x, code, rate: rateOf(code) } : x));
                      setPo({ ...po, items, ...(i === 0 ? { supplier: supplierOf(code) } : {}) });
                    }}>
                    {matOptions(it.code).map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}{m.rate ? ` (₹${m.rate}/${m.unit})` : ' (no rate)'}</option>)}
                  </select>
                  <div>
                    <input type="number" min="0" step="any" className={cx(inputCls, it.required != null && Number(it.qty) < it.required && 'border-rose-400')} value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} />
                    {it.required != null && <div className={cx('mt-1 text-[0.6875rem] font-semibold', Number(it.qty) < it.required ? 'text-rose-600' : 'text-slate-500')}>Required {fmtNum(it.required)} {mat(it.code)?.unit}</div>}
                  </div>
                  <input type="number" className={inputCls} value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} />
                  {!po.reqId && !po.rfqId ? <button className="text-slate-400 hover:text-rose-500" onClick={() => setPo({ ...po, items: po.items.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 size={16} /></button> : <span />}
                </div>
              ))}
            </div>
            {!po.reqId && !po.rfqId && <Button size="sm" variant="soft" icon={Plus} className="mt-2" onClick={() => setPo({ ...po, items: [...po.items, { code: activeMats[0]?.code, qty: 100, rate: rateOf(activeMats[0]?.code) }] })}>Add line</Button>}
            <div className="mt-5 flex items-center justify-between rounded-lg bg-inv-50 px-4 py-3 dark:bg-inv-500/10">
              <span className="text-sm font-semibold text-inv-700 dark:text-inv-100">PO value</span>
              <span className="text-lg font-extrabold tabular text-inv-700 dark:text-inv-100">₹ {fmtNum(Math.round(poValue(po.items)))}</span>
            </div>
            {po.reqId && short && <p className="mt-2 text-xs font-semibold text-rose-600">A line is below the quantity Production needs. Order at least the required quantity.</p>}
          </>
        )}
      </Modal>

      {/* Create RFQ */}
      <Modal open={!!rfqForm} onClose={() => setRfqForm(null)} title="Create RFQ" width="max-w-2xl"
        subtitle={rfqForm?.reqId ? `Request for quotation against requirement ${rfqForm.reqId}` : 'Request for quotation'}
        footer={<><Button variant="ghost" onClick={() => setRfqForm(null)}>Cancel</Button><Button variant="inventory" icon={Send} onClick={sendRfq} disabled={!rfqValid}>Send RFQ{rfqForm?.suppliers.length ? ` to ${rfqForm.suppliers.length} supplier${rfqForm.suppliers.length > 1 ? 's' : ''}` : ''}</Button></>}>
        {rfqForm && (
          <>
            <Section n={1} title="Materials">
              <div className="overflow-hidden rounded-lg border border-line dark:border-white/[0.07]">
                {rfqForm.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm last:border-0 dark:border-white/[0.05]">
                    {rfqForm.reqId ? (
                      <span className="flex-1"><Mono className="mr-2 text-slate-400">{it.code}</Mono>{mat(it.code)?.name}</span>
                    ) : (
                      <select className={cx(inputCls, 'h-9 flex-1')} value={it.code} onChange={(e) => setRfqForm({ ...rfqForm, items: rfqForm.items.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)) })}>
                        {matOptions(it.code).map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
                      </select>
                    )}
                    {rfqForm.reqId
                      ? <b className="tabular">{fmtNum(it.qty)} {mat(it.code)?.unit}</b>
                      : <input type="number" min="0" step="any" className={cx(inputCls, 'h-9 w-28')} value={it.qty} onChange={(e) => setRfqForm({ ...rfqForm, items: rfqForm.items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) })} />}
                    <span className="w-20 text-right text-xs text-slate-400">std ₹{fmtNum(rateOf(it.code))}</span>
                    {!rfqForm.reqId && <button className="text-slate-400 hover:text-rose-500" onClick={() => setRfqForm({ ...rfqForm, items: rfqForm.items.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>}
                  </div>
                ))}
              </div>
              {!rfqForm.reqId && <Button size="sm" variant="soft" icon={Plus} className="mt-2" onClick={() => setRfqForm({ ...rfqForm, items: [...rfqForm.items, { code: activeMats[0]?.code, qty: 100 }] })}>Add material</Button>}
            </Section>
            <Section n={2} title="Suppliers" right={<span className="text-[0.6875rem] text-slate-400">{rfqForm.suppliers.length} selected · pick 2+ to compare</span>}>
              <div className="grid gap-2 sm:grid-cols-2">
                {supplierOptions.map((s) => {
                  const on = rfqForm.suppliers.includes(s);
                  return (
                    <label key={s} className={cx('flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm transition', on ? 'border-inv-500 bg-inv-50 dark:bg-inv-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10')}>
                      <input type="checkbox" className="h-4 w-4 accent-[#2E37A4]" checked={on}
                        onChange={(e) => setRfqForm({ ...rfqForm, suppliers: e.target.checked ? [...rfqForm.suppliers, s] : rfqForm.suppliers.filter((x) => x !== s) })} />
                      <span className="flex-1">{s}</span>
                      {rfqForm.items.some((it) => supplierOf(it.code) === s) && <span className="rounded bg-emerald-50 px-1.5 text-[0.625rem] font-bold text-emerald-700">Master</span>}
                    </label>
                  );
                })}
              </div>
            </Section>
            <Section n={3} title="Terms">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Quote due by"><input type="date" className={inputCls} value={rfqForm.dueDate} onChange={(e) => setRfqForm({ ...rfqForm, dueDate: e.target.value })} /></Field>
                <Field label="Notes to suppliers"><input className={inputCls} placeholder="e.g. delivery to Unit 1, 30 days credit" value={rfqForm.notes} onChange={(e) => setRfqForm({ ...rfqForm, notes: e.target.value })} /></Field>
              </div>
            </Section>
          </>
        )}
      </Modal>

      {/* Quotes: enter + compare */}
      <Modal open={!!curRfq} onClose={() => setQuoting(null)} width="max-w-5xl"
        title={curRfq && `Quotation · ${curRfq.id}`}
        subtitle={curRfq && `${curRfq.reqId ? `Requirement ${curRfq.reqId} · ` : ''}quote due ${fmtDate(curRfq.dueDate)}${curRfq.notes ? ` · ${curRfq.notes}` : ''}`}
        footer={curRfq && (curRfq.status === 'PO Raised'
          ? <Button variant="ghost" onClick={() => setQuoting(null)}>Close</Button>
          : <>
            <Button variant="ghost" onClick={() => setQuoting(null)}>Cancel</Button>
            <Button variant="soft" icon={Save} onClick={saveQuotes}>Save quotes</Button>
            <Button variant="inventory" icon={FileText} disabled={!pick || quoteTotal(curRfq, pick) == null} onClick={poFromQuote}>{pick ? `Raise PO · ${pick}` : 'Select a supplier'}</Button>
          </>)}>
        {curRfq && <QuoteTable rfq={curRfq} quotes={quotes} setQuotes={setQuotes} pick={pick} setPick={setPick} quoteTotal={quoteTotal} mat={mat} rateOf={rateOf} />}
      </Modal>
    </>
  );

  return { state, dispatch, toast, mat, rateOf, rfqs, quoteTotal, openPoFromReq, openPoBlank, openRfqFromReq, openRfqBlank, openQuotes, modals };
}

function Section({ n, title, right, children }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-prod-500 text-[0.625rem] text-white">{n}</span>{title}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}

function QuoteTable({ rfq, quotes, setQuotes, pick, setPick, quoteTotal, mat, rateOf }) {
  const locked = rfq.status === 'PO Raised';
  const totals = rfq.suppliers.map((s) => quoteTotal(rfq, s)).filter((t) => t != null);
  const best = totals.length ? Math.min(...totals) : null;
  const quoted = rfq.suppliers.filter((s) => quoteTotal(rfq, s) != null).length;
  /* lowest rate per material across suppliers */
  const bestRate = (code) => {
    const rs = rfq.suppliers.map((s) => Number(quotes[s]?.rates?.[code])).filter((v) => v > 0);
    return rs.length ? Math.min(...rs) : null;
  };
  return (
    <>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Suppliers quoted" value={`${quoted} / ${rfq.suppliers.length}`} />
        <MiniStat label="Lowest total (L1)" value={best != null ? `₹ ${fmtNum(Math.round(best))}` : '—'} tone="emerald" />
        <MiniStat label="Selected" value={pick || rfq.selected || '—'} tone="indigo" />
      </div>
      <div className="overflow-x-auto rounded-lg border border-line dark:border-white/[0.07]">
        {/* Comparative statement: suppliers side by side (columns), materials as rows */}
        <table className="w-full text-sm" style={{ minWidth: `${16 + rfq.suppliers.length * 13}rem` }}>
          <thead>
            <tr className="bg-inv-50/70 text-[0.75rem] font-semibold text-slate-700 dark:bg-white/[0.03] dark:text-slate-300">
              <th className="sticky left-0 z-10 w-64 bg-inv-50 px-3 py-2.5 text-left dark:bg-ink-900">Material</th>
              {rfq.suppliers.map((s) => {
                const total = quoteTotal(rfq, s);
                return (
                  <th key={s} onClick={() => !locked && total != null && setPick(s)}
                    className={cx('border-l border-line px-3 py-2.5 text-left align-top dark:border-white/[0.06]', !locked && total != null && 'cursor-pointer', pick === s && 'bg-inv-100/70 dark:bg-inv-500/15')}>
                    <label className="flex items-start gap-2">
                      <input type="radio" name="pick" className="mt-0.5 h-4 w-4 accent-[#2E37A4]" disabled={locked || total == null} checked={pick === s} onChange={() => setPick(s)} />
                      <span>
                        <span className="block text-[0.8125rem]">{s}</span>
                        {rfq.selected === s && <span className="rounded bg-emerald-50 px-1.5 text-[0.625rem] font-bold text-emerald-700">PO {rfq.poId}</span>}
                      </span>
                    </label>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* one row per material: rate per supplier */}
            {rfq.items.map((it) => (
              <tr key={it.code} className="border-t border-line dark:border-white/[0.05]">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-ink-900">
                  <div className="font-medium">{mat(it.code)?.name}</div>
                  <div className="text-[0.6875rem] text-slate-400">{fmtNum(it.qty)} {mat(it.code)?.unit} · ₹/{mat(it.code)?.unit} · std ₹{fmtNum(rateOf(it.code))}</div>
                </td>
                {rfq.suppliers.map((s) => {
                  const q = quotes[s] || { rates: {}, days: '' };
                  const r = q.rates?.[it.code] ?? '';
                  const diff = Number(r) > 0 && rateOf(it.code) ? Math.round(((Number(r) - rateOf(it.code)) / rateOf(it.code)) * 100) : null;
                  const low = Number(r) > 0 && Number(r) === bestRate(it.code);
                  return (
                    <td key={s} className={cx('border-l border-line px-3 py-2 dark:border-white/[0.06]', pick === s && 'bg-inv-50/60 dark:bg-inv-500/10')}>
                      <input type="number" min="0" step="any" className={cx(inputCls, 'h-9', low && 'border-emerald-400 bg-emerald-50/50')} placeholder="Rate ₹" value={r} disabled={locked}
                        onChange={(e) => setQuotes({ ...quotes, [s]: { ...q, rates: { ...q.rates, [it.code]: e.target.value } } })} />
                      <div className="mt-0.5 flex justify-between text-[0.6562rem]">
                        {diff != null ? <span className={cx('font-semibold', diff > 0 ? 'text-rose-600' : 'text-emerald-600')}>{diff > 0 ? '+' : ''}{diff}% vs std{low ? ' · lowest' : ''}</span> : <span />}
                        {Number(r) > 0 && <span className="text-slate-400">₹ {fmtNum(Math.round(Number(r) * it.qty))}</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* delivery days */}
            <tr className="border-t border-line dark:border-white/[0.05]">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium dark:bg-ink-900"><span className="inline-flex items-center gap-1.5"><Truck size={13} className="text-slate-400" />Delivery days</span></td>
              {rfq.suppliers.map((s) => {
                const q = quotes[s] || { rates: {}, days: '' };
                return (
                  <td key={s} className={cx('border-l border-line px-3 py-2 dark:border-white/[0.06]', pick === s && 'bg-inv-50/60 dark:bg-inv-500/10')}>
                    <input type="number" min="0" className={cx(inputCls, 'h-9')} placeholder="Days" value={q.days} disabled={locked} onChange={(e) => setQuotes({ ...quotes, [s]: { ...q, days: e.target.value } })} />
                  </td>
                );
              })}
            </tr>
            {/* totals */}
            <tr className="border-t-2 border-line bg-slate-50/70 dark:border-white/[0.08] dark:bg-white/[0.02]">
              <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 font-bold dark:bg-ink-900">Total ₹</td>
              {rfq.suppliers.map((s) => {
                const total = quoteTotal(rfq, s);
                const isBest = total != null && total === best;
                return (
                  <td key={s} onClick={() => !locked && total != null && setPick(s)}
                    className={cx('border-l border-line px-3 py-2.5 dark:border-white/[0.06]', !locked && total != null && 'cursor-pointer', isBest && 'bg-emerald-50 dark:bg-emerald-500/10', pick === s && 'ring-2 ring-inset ring-prod-500')}>
                    {total == null ? <span className="text-xs text-slate-400">Not quoted</span>
                      : <>
                        <b className="tabular text-base">₹ {fmtNum(Math.round(total))}</b>
                        {isBest && <span className="ml-1.5 rounded bg-emerald-500 px-1.5 py-0.5 text-[0.625rem] font-bold text-white">L1</span>}
                        {best != null && !isBest && <div className="text-[0.6562rem] text-rose-500">+₹ {fmtNum(Math.round(total - best))} vs L1</div>}
                      </>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {!locked && <p className="mt-3 text-xs text-slate-500">Type each supplier's rate as their quote arrives and <b>Save quotes</b>. When ready, pick a supplier column (L1 = lowest total) and <b>Raise PO</b>; the PO opens with that supplier's rates and delivery date.</p>}
    </>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.03]">
      <div className="text-[0.6562rem] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={cx('truncate font-bold', tone === 'emerald' && 'text-emerald-600', tone === 'indigo' && 'text-prod-600 dark:text-prod-300')}>{value}</div>
    </div>
  );
}
