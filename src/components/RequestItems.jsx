import { useStore } from '../store/StoreContext';
import { fmtNum } from './ui';

/* Material chips for a request: "Sulphuric Acid 98% · 900 kg" */
export default function RequestItems({ items, max = 4 }) {
  const { state } = useStore();
  const mat = (c) => state.materials.find((m) => m.code === c);
  const shown = items.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((it) => (
        <span key={it.code} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[0.7188rem] dark:bg-white/[0.06]">
          <span className="text-slate-600 dark:text-slate-300">{mat(it.code)?.name ?? it.code}</span>
          <span className="tabular font-semibold">{fmtNum(it.qty)} {mat(it.code)?.unit}</span>
        </span>
      ))}
      {items.length > max && <span className="text-[0.6875rem] text-slate-400">+{items.length - max} more</span>}
    </div>
  );
}
