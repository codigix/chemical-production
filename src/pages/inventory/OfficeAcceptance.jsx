import { useEffect, useRef, useState } from 'react';
import { Stamp, PenLine, Eraser, BadgeCheck, Eye, Database } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Card, CardHeader, PageHeader, Button, Badge, Modal, Field, Mono, Table, EmptyState, inputCls, fmtNum, fmtDateTime, useToast } from '../../components/ui';
import OrderDetail from '../../components/OrderDetail';
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
  /* Per material: on hand now − issued qty = balance after acceptance (same maths as the ledger OUT entry) */
  const r3 = (n) => Math.round(Number(n || 0) * 1000) / 1000;
  const movements = cur ? (reqOf(cur)?.items || []).map((it) => {
    const m = mat(it.code);
    const onHand = m?.onHand ?? 0;
    return { code: it.code, name: m?.name ?? it.code, unit: m?.unit ?? '', onHand, out: it.qty, after: r3(onHand - it.qty) };
  }) : [];

  const accept = () => {
    dispatch('OFFICE_ACCEPT', { orderId: cur.id, by, signature: sig });
    toast(`${cur.id} accepted. JSON stock records updated`);
    setCur(null);
  };

  return (
    <>
      <PageHeader module="inventory" icon={Stamp} title="SOP Office Acceptance" subtitle="Final office sign-off. On acceptance the issued material is posted out of the stock ledger." />

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

      <Modal open={!!cur} onClose={() => setCur(null)} width="max-w-2xl" title={cur && `Office acceptance · ${cur.id}`} subtitle={cur && sopOf(cur)?.product}
        footer={<><Button variant="ghost" onClick={() => setCur(null)}>Cancel</Button><Button variant="inventory" icon={BadgeCheck} disabled={!sig || !by || movements.some((mv) => mv.after < 0)} onClick={accept}>Accept & update stock</Button></>}>
        {cur && (
          <>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Stock movement on acceptance</span>
              <span className="text-xs text-slate-500">Stock leaves the ledger only when you accept. Until then it is only reserved.</span>
            </div>
            {/* On hand − stock OUT = balance, per material, exactly what the ledger OUT entry will record */}
            <div className="overflow-x-auto rounded-lg border border-line dark:border-white/[0.07]">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="bg-prod-50/70 text-left text-[0.75rem] font-semibold text-slate-700 dark:bg-white/[0.03] dark:text-slate-300">
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2 text-right">On hand now</th>
                    <th className="px-3 py-2 text-right">Stock OUT</th>
                    <th className="px-3 py-2 text-right">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mv) => (
                    <tr key={mv.code} className="border-t border-line dark:border-white/[0.05]">
                      <td className="px-3 py-2">
                        <div className="font-medium">{mv.name}</div>
                        <div className="text-[0.6875rem] text-slate-400">{mv.code}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular">{fmtNum(mv.onHand)} <span className="text-xs text-slate-400">{mv.unit}</span></td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular font-semibold text-rose-600">−{fmtNum(mv.out)} <span className="text-xs font-normal text-slate-400">{mv.unit}</span></td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right tabular font-semibold ${mv.after < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                        {fmtNum(mv.after)} <span className="text-xs font-normal text-slate-400">{mv.unit}</span>
                        <div className="text-[0.6875rem] font-normal text-slate-400">{fmtNum(mv.onHand)} − {fmtNum(mv.out)} = {fmtNum(mv.after)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {movements.some((mv) => mv.after < 0) && (
              <p className="mt-2 text-xs font-semibold text-rose-600">A balance would go below zero: check the stock ledger before accepting.</p>
            )}
            <Field label="Accepted by" className="mt-4"><input className={inputCls} value={by} onChange={(e) => setBy(e.target.value)} /></Field>
            <div className="mt-4 text-xs font-semibold text-slate-600 dark:text-slate-300">Signature</div>
            <div className="mt-1.5"><SignaturePad onChange={setSig} /></div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Database size={13} className="text-inv-500" />Saved to the JSON stock records on acceptance.</div>
          </>
        )}
      </Modal>

      {viewing && <OrderDetail orderId={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
