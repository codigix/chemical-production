import { useEffect, useRef, useState } from 'react';
import { Stamp, PenLine, Eraser, BadgeCheck, Eye, Database } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Button, Badge, Modal, Field, Mono, Table, EmptyState, inputCls, fmtNum, fmtDateTime, useToast } from '../../components/ui';
import OrderDetail from '../../components/OrderDetail';
import OrderFlow from '../../components/OrderFlow';
import BatchSheet from '../../components/BatchSheet';
import { AcceptedRowActions } from '../../components/rowActions';

/* Simple signature pad on a canvas, saved as a PNG data URL in the JSON */
function SignaturePad({ onChange }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e1b4b';
  }, []);
  const pos = (e) => {
    const r = ref.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const down = (e) => { drawing.current = true; const ctx = ref.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(...pos(e)); ref.current.setPointerCapture(e.pointerId); };
  const move = (e) => { if (!drawing.current) return; const ctx = ref.current.getContext('2d'); ctx.lineTo(...pos(e)); ctx.stroke(); };
  const up = () => { if (!drawing.current) return; drawing.current = false; onChange(ref.current.toDataURL('image/png')); };
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); onChange(null); };
  return (
    <div>
      <div className="relative rounded-lg border-2 border-dashed border-inv-500/30 bg-white">
        <canvas ref={ref} className="h-36 w-full touch-none cursor-crosshair" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
        <span className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-1 text-[0.6875rem] text-slate-400"><PenLine size={12} />Sign here</span>
      </div>
      <button type="button" onClick={clear} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-500"><Eraser size={13} />Clear</button>
    </div>
  );
}

export default function OfficeAcceptance() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [cur, setCur] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [by, setBy] = useState('Office Manager');
  const [sig, setSig] = useState(null);

  const queue = state.orders.filter((o) => o.status === 'Stock Verified');
  const accepted = state.orders.filter((o) => o.status === 'Accepted');
  const sopOf = (o) => state.sops.find((s) => s.id === o.sopId);
  const mat = (c) => state.materials.find((m) => m.code === c);
  const reqOf = (o) => state.requests.find((r) => r.id === o.pullOutReqId);
  const accept = () => {
    dispatch('OFFICE_ACCEPT', { orderId: cur.id, by, signature: sig });
    toast(`${cur.id} SOP confirmed and signed`);
    setCur(null);
  };

  return (
    <>
      <PageHeader module="inventory" icon={Stamp} title="SOP Office Acceptance" subtitle="Final office sign-off: signature and SOP confirmation. Stock is not changed here (it goes OUT at issue)." />

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Awaiting signature · {queue.length}</h2>
      {queue.length === 0 ? (
        <Card className="mb-8"><EmptyState icon={Stamp} title="Nothing to sign" text="SOPs appear here after the stock person verifies them." /></Card>
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {queue.map((o) => (
            <Card key={o.id} className="relative overflow-hidden p-5">
              <Stamp size={110} className="absolute -bottom-6 -right-6 text-inv-500 opacity-[0.07]" />
              <div className="flex items-center justify-between"><Mono>{o.id}</Mono><Badge status={o.status} /></div>
              <div className="mt-2 text-lg font-bold">{sopOf(o)?.product}</div>
              <div className="mt-1 text-sm text-slate-500">Yield {fmtNum(o.submission?.actualYield)} {sopOf(o)?.unit} · checked by {o.stockCheck?.by}</div>
              <div className="mt-4 flex gap-2">
                <Button variant="ghost" icon={Eye} onClick={() => setViewing(o.id)}>Details</Button>
                <Button variant="inventory" icon={PenLine} className="flex-1" onClick={() => { setCur(o); setSig(null); }}>Sign & accept</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="Accepted SOPs" subtitle="Signed off and posted to the stock ledger" icon={BadgeCheck} tone="inventory" />
        <Table
          rows={accepted}
          empty={{ title: 'No accepted SOPs yet' }}
          columns={[
            { key: 'id', label: 'Order', render: (o) => <Mono>{o.id}</Mono> },
            { key: 'p', label: 'Product', render: (o) => sopOf(o)?.product },
            { key: 'y', label: 'Yield', align: 'right', render: (o) => `${fmtNum(o.submission?.actualYield)} ${sopOf(o)?.unit}` },
            { key: 'b', label: 'Signed by', render: (o) => o.acceptance?.by },
            { key: 'sig', label: 'Signature', render: (o) => (o.acceptance?.signature ? <img src={o.acceptance.signature} alt="" className="h-9 rounded bg-white px-1" /> : '—') },
            { key: 't', label: 'Accepted', render: (o) => <span className="whitespace-nowrap text-slate-500">{fmtDateTime(o.acceptance?.t)}</span> },
            { key: 'v', label: 'Actions', align: 'right', render: (o) => <AcceptedRowActions order={o} /> },
          ]}
        />
      </Card>

      <Modal open={!!cur} onClose={() => setCur(null)} width="max-w-4xl" title={cur && `Office acceptance · ${cur.id}`} subtitle={cur && sopOf(cur)?.product}
        footer={<><Button variant="ghost" onClick={() => setCur(null)}>Cancel</Button><Button variant="inventory" icon={BadgeCheck} disabled={!sig || !by} onClick={accept}>Sign & confirm SOP</Button></>}>
        {/* Signature + SOP confirmation only — no stock movement here (stock OUT was posted at issue) */}
        {cur && (
          <>
            <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3 dark:bg-white/[0.03]">
              {/* Product details of this order */}
              <div className="border-b border-line pb-3 sm:col-span-3 dark:border-white/[0.07]">
                <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Product</div>
                <div className="text-base font-bold">{sopOf(cur)?.product || '—'}</div>
                <div className="text-xs text-slate-500">
                  {cur.sopId} · {sopOf(cur)?.version} · {cur.batches} batch × {fmtNum(sopOf(cur)?.batchSize)} {sopOf(cur)?.unit} = planned {fmtNum(cur.batches * (sopOf(cur)?.batchSize || 0))} {sopOf(cur)?.unit}
                </div>
              </div>
              <div><div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Batch no.</div><div className="font-semibold">{String(cur.submission?.batchNo || '').trim() || cur.id}</div></div>
              <div><div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Actual yield</div><div className="font-semibold">{fmtNum(cur.submission?.actualYield)} {sopOf(cur)?.unit}</div></div>
              <div><div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Stock checked by</div><div className="font-semibold">{cur.stockCheck?.by || '—'}</div></div>
            </div>
            {/* ---------- View only: full process of this order ---------- */}
            <div className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Full process <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.625rem] normal-case tracking-normal text-slate-500 dark:bg-white/[0.06]">View only</span>
            </div>
            <div className="mt-2 rounded-lg border border-line p-4 dark:border-white/[0.07]"><OrderFlow status={cur.status} /></div>

            {/* Stock movement already posted at issue (read-only, from the Stock Movement ledger) */}
            <div className="mt-4 mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Stock movement · {reqOf(cur)?.id} <span className="font-normal text-slate-400">Store → Production</span></span>
              <span className="text-[0.6875rem] text-emerald-600">✓ Posted OUT at issue{reqOf(cur)?.issuedAt ? ` · ${fmtDateTime(reqOf(cur).issuedAt)}` : ''} · acceptance does not change stock</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-line dark:border-white/[0.07]">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[0.75rem] font-semibold text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2">Ledger entry</th>
                    <th className="px-3 py-2 text-right">Stock OUT</th>
                    <th className="px-3 py-2 text-right">Balance after issue</th>
                    <th className="px-3 py-2 text-right">Stock now</th>
                  </tr>
                </thead>
                <tbody>
                  {(reqOf(cur)?.items || []).map((it) => {
                    const m = mat(it.code);
                    const req = reqOf(cur);
                    const entry = state.ledger.find((l) => l.code === it.code && l.type === 'OUT' && String(l.ref || '').includes(req.id));
                    return (
                      <tr key={it.code} className="border-t border-line dark:border-white/[0.05]">
                        <td className="px-3 py-2"><div className="font-medium">{m?.name}</div><div className="text-[0.6875rem] text-slate-400">{it.code}</div></td>
                        <td className="px-3 py-2 text-xs">{entry ? <><Mono>{entry.id}</Mono><div className="text-[0.6875rem] text-slate-400">{fmtDateTime(entry.date)}</div></> : <span className="text-slate-400">—</span>}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular font-semibold text-rose-600">−{fmtNum(it.qty)} <span className="text-xs font-normal text-slate-400">{m?.unit}</span></td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular">{entry ? <>{fmtNum(entry.balance)} <span className="text-xs text-slate-400">{m?.unit}</span></> : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular font-semibold">{fmtNum(m?.onHand)} <span className="text-xs font-normal text-slate-400">{m?.unit}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Who did each step */}
            {cur.history?.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Timeline</div>
                <ol className="relative ml-2 border-l border-slate-200 dark:border-white/10">
                  {cur.history.map((h, i) => (
                    <li key={i} className="mb-3 ml-5 last:mb-0">
                      <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-prod-500 ring-4 ring-white dark:ring-ink-900" />
                      <div className="flex flex-wrap items-center gap-2 text-sm"><Badge status={h.status} /><span className="text-xs text-slate-500">by {h.by}</span><span className="text-[0.6875rem] text-slate-400">{fmtDateTime(h.t)}</span></div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Submitted batch sheet */}
            <details className="mt-4 rounded-lg border border-line dark:border-white/[0.07]">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold text-prod-500">Batch sheet (submitted SOP)</summary>
              <div className="overflow-x-auto border-t border-line p-3 dark:border-white/[0.07]"><BatchSheet sop={sopOf(cur)} order={cur} id={`accept-sheet-${cur.id}`} /></div>
            </details>

            <div className="mt-5 border-t border-line pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/[0.07]">Office sign-off</div>
            <Field label="Accepted by" className="mt-2"><input className={inputCls} value={by} onChange={(e) => setBy(e.target.value)} /></Field>
            <div className="mt-4 text-xs font-semibold text-slate-600 dark:text-slate-300">Signature</div>
            <div className="mt-1.5"><SignaturePad onChange={setSig} /></div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Database size={13} className="text-inv-500" />Signature and SOP confirmation are saved to the JSON records.</div>
          </>
        )}
      </Modal>

      {viewing && <OrderDetail orderId={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
