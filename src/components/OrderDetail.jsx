import { useStore, requirementFor } from '../store/StoreContext';
import { Modal, Badge, Mono, Button, fmtNum, fmtDate, fmtDateTime, cx } from './ui';
import BatchSheet, { PrintButton } from './BatchSheet';
import OrderFlow from './OrderFlow';

/* Read-only order view shared by several screens */
export default function OrderDetail({ orderId, onClose }) {
  const { state } = useStore();
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return null;
  const sop = state.sops.find((s) => s.id === order.sopId);
  const lines = requirementFor(state, order);

  return (
    <Modal open onClose={onClose} width="max-w-4xl" title={<span className="flex items-center gap-2"><Mono className="text-base">{order.id}</Mono><Badge status={order.status} /></span>} subtitle={`${sop?.product} · ${sop?.id} ${sop?.version}`}
      footer={<><PrintButton target={`sheet-${order.id}`} title={`Batch sheet ${order.id}`} /><Button variant="ghost" onClick={onClose}>Close</Button></>}>
      <div className="space-y-6">
        <details className="group rounded-lg border border-line dark:border-white/[0.07]" open={!!order.submission}>
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-prod-500">
            Batch sheet {order.submission ? `· Batch ${order.submission.batchNo || order.id}` : '(not submitted yet)'}
          </summary>
          <div className="overflow-x-auto border-t border-line p-3 dark:border-white/[0.07]"><BatchSheet sop={sop} order={order} id={`sheet-${order.id}`} /></div>
        </details>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Batches', order.batches],
            ['Output', `${fmtNum(order.batches * (sop?.batchSize || 0))} ${sop?.unit}`],
            ['Planned', fmtDate(order.plannedDate)],
            ['Priority', <Badge key="p" status={order.priority} />],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.03]">
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">{k}</div>
              <div className="mt-1 font-semibold">{v}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-100 p-4 dark:border-white/[0.06]"><OrderFlow status={order.status} /></div>

        <div>
          <h4 className="mb-2 text-sm font-semibold">Raw material requirement</h4>
          <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-white/[0.06]">
            {lines.map((l) => (
              <div key={l.code} className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-sm last:border-0 dark:border-white/[0.05]">
                <span><Mono className="mr-2 text-slate-400">{l.code}</Mono>{l.name}</span>
                <span className="tabular font-semibold">{fmtNum(l.required)} {l.unit}</span>
              </div>
            ))}
          </div>
        </div>

        {order.history?.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold">Timeline</h4>
            <ol className="relative ml-2 border-l border-slate-200 dark:border-white/10">
              {[...order.history].reverse().map((h, i) => (
                <li key={i} className="mb-4 ml-5 last:mb-0">
                  <span className={cx('absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-ink-900', i === 0 ? 'bg-prod-500' : 'bg-slate-300')} />
                  <div className="flex flex-wrap items-center gap-2 text-sm"><Badge status={h.status} /><span className="text-slate-500">by {h.by}</span></div>
                  <div className="mt-0.5 text-xs text-slate-400">{fmtDateTime(h.t)}</div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {order.acceptance?.signature && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Office signature · {order.acceptance.by}</div>
            <img src={order.acceptance.signature} alt="Office signature" className="mt-2 h-20 rounded-lg bg-white" />
          </div>
        )}
      </div>
    </Modal>
  );
}
