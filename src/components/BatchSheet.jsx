import { Printer } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { Button, fmtDate } from './ui';

const num = (n) => (n === '' || n == null ? '' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 3 }));

/* Open the sheet in a new window with the app's styles and print it */
export function printElement(id, title = 'Batch Sheet') {
  const el = document.getElementById(id);
  if (!el) return;
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) return;
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join('');
  w.document.write(`<!doctype html><html><head><title>${title}</title>${styles}
    <style>body{background:#fff;padding:24px;font-family:Inter,system-ui,sans-serif} @page{size:A4;margin:12mm}</style></head>
    <body>${el.outerHTML}</body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* already printed */ } }, 600);
}

/*
  Paper-style SOP / batch sheet:
  - SOP template (no order): blank Batch No, MFG date, Actual qty, Check list
  - Production order: quantities scaled to the order's batches; filled from the submission when present
*/
export default function BatchSheet({ sop, order, id = 'batch-sheet' }) {
  const { state } = useStore();
  if (!sop) return null;
  const mat = (c) => state.materials.find((m) => m.code === c);
  const factor = order ? order.batches : 1;
  const sub = order?.submission;
  const actualOf = (group, code) => sub?.lines?.find((l) => l.group === group && l.code === code);
  const company = state.company?.name || 'COMPANY NAME';
  const ref = Number(sop.refBatch) || 0;
  const batchQty = sop.batchSize * factor;
  /* Std quantities: the order's own list when it has one, else SOP × batches */
  const own = order?.lines?.length ? order.lines : null;
  const rmRows = own ? own.filter((l) => l.group !== 'PM').map((l) => ({ code: l.code, std: l.qty })) : sop.materials.map((l) => ({ code: l.code, std: l.qty * factor }));
  const pmRows = own ? own.filter((l) => l.group === 'PM').map((l) => ({ code: l.code, std: l.qty })) : (sop.packing || []).map((l) => ({ code: l.code, std: l.qty * factor }));

  const cell = 'border border-slate-500 px-2 py-1.5';
  const head = `${cell} bg-slate-100 text-left font-bold`;

  return (
    <div id={id} className="bg-white text-[0.8rem] text-slate-900">
      <table className="w-full border-collapse">
        <tbody>
          <tr><td colSpan={5} className={`${cell} text-center text-[0.95rem] font-bold tracking-wide`}>{company}</td></tr>
          <tr><td className={`${cell} w-[38%] font-bold`}>PRODUCT NAME:</td><td colSpan={4} className={`${cell} font-semibold`}>{sop.product} <span className="text-slate-500">({sop.id} · {sop.version})</span></td></tr>
          <tr><td className={`${cell} font-bold`}>BATCH NO:</td><td colSpan={4} className={cell}>{sub?.batchNo || order?.id || ''}</td></tr>
          <tr><td className={`${cell} font-bold`}>BATCH SIZE:</td><td colSpan={4} className={cell}>{num(batchQty)} {sop.unit}{order && order.batches > 1 ? ` (${order.batches} × ${num(sop.batchSize)})` : ''}</td></tr>
        </tbody>
      </table>

      {/* Bill of raw material */}
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr>
            <th colSpan={2} className={head}>BILL OF RAW MATERIAL</th>
            <th className={head} />
            <th colSpan={2} className={head}>MFG DATE: <span className="font-normal">{sub?.mfgDate ? fmtDate(sub.mfgDate) : ''}</span></th>
          </tr>
          <tr>
            <th className={`${head} w-14`}>SR NO</th>
            <th className={head}>INGREDIENT</th>
            <th className={`${head} w-32 text-right`}>STD QTY IN KG</th>
            <th className={`${head} w-28 text-right`}>ACTUAL QTY</th>
            <th className={`${head} w-24 text-center`}>CHECK LIST</th>
          </tr>
        </thead>
        <tbody>
          {rmRows.map((l, i) => {
            const a = actualOf('RM', l.code);
            return (
              <tr key={`rm-${i}`}>
                <td className={`${cell} text-right`}>{i + 1}</td>
                <td className={cell}>{(mat(l.code)?.name || l.code).toUpperCase()}</td>
                <td className={`${cell} text-right tabular`}>{num(l.std)}</td>
                <td className={`${cell} text-right tabular`}>{a ? num(a.actual) : ''}</td>
                <td className={`${cell} text-center`}>{a?.checked ? '✓' : ''}</td>
              </tr>
            );
          })}
          <tr className="font-bold">
            <td className={cell} /><td className={cell}>TOTAL</td>
            <td className={`${cell} text-right tabular`}>{num(rmRows.reduce((t, l) => t + l.std, 0))}</td>
            <td className={`${cell} text-right tabular`}>{sub?.lines ? num(sub.lines.filter((l) => l.group === 'RM').reduce((t, l) => t + Number(l.actual || 0), 0)) : ''}</td>
            <td className={cell} />
          </tr>
        </tbody>
      </table>

      {/* Reference quantity table (e.g. std qty for 200 LTR) */}
      {ref > 0 && (
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              <th className={`${head} w-14`}>SR NO</th>
              <th className={head}>NAME OF MATERIAL</th>
              <th className={`${head} w-56 text-right`}>STD QTY FOR {num(ref)} LTR</th>
            </tr>
          </thead>
          <tbody>
            {sop.materials.map((l, i) => (
              <tr key={`ref-${i}`}>
                <td className={`${cell} text-right`}>{i + 1}</td>
                <td className={cell}>{(mat(l.code)?.name || l.code).toUpperCase()}</td>
                <td className={`${cell} text-right tabular`}>{num(Math.round((l.qty * ref / sop.batchSize) * 1000) / 1000)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Packing material */}
      {pmRows.length > 0 && (
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              <th colSpan={5} className={head}>PACKING MATERIAL{sop.packSize ? ` FOR ${sop.packSize} PACK` : ''}</th>
            </tr>
            <tr>
              <th className={`${head} w-14`}>SR NO</th>
              <th className={head}>MATERIAL</th>
              <th className={`${head} w-32 text-right`}>STD QTY</th>
              <th className={`${head} w-28 text-right`}>ACTUAL QTY</th>
              <th className={`${head} w-24 text-center`}>CHECK LIST</th>
            </tr>
          </thead>
          <tbody>
            {pmRows.map((l, i) => {
              const a = actualOf('PM', l.code);
              return (
                <tr key={`pm-${i}`}>
                  <td className={`${cell} text-right`}>{i + 1}</td>
                  <td className={cell}>{(mat(l.code)?.name || l.code).toUpperCase()}</td>
                  <td className={`${cell} text-right tabular`}>{num(l.std)} {mat(l.code)?.unit}</td>
                  <td className={`${cell} text-right tabular`}>{a ? num(a.actual) : ''}</td>
                  <td className={`${cell} text-center`}>{a?.checked ? '✓' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Process steps */}
      {sop.steps?.length > 0 && (
        <table className="mt-3 w-full border-collapse">
          <thead><tr><th colSpan={2} className={head}>PROCESS STEPS</th></tr></thead>
          <tbody>
            {sop.steps.map((st, i) => (
              <tr key={`st-${i}`}><td className={`${cell} w-14 text-right`}>{i + 1}</td><td className={cell}>{st}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <table className="mt-3 w-full border-collapse">
        <tbody>
          <tr>
            {['PREPARED BY', 'CHECKED BY (STOCK)', 'APPROVED BY (OFFICE)'].map((h) => (
              <td key={h} className={`${cell} h-16 w-1/3 align-top text-[0.7rem] font-bold`}>{h}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function PrintButton({ target = 'batch-sheet', title }) {
  return <Button variant="ghost" icon={Printer} onClick={() => printElement(target, title)}>Print</Button>;
}
