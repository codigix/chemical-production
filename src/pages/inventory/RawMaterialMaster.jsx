import { useMemo, useState } from 'react';
import { Boxes, Search, AlertTriangle, IndianRupee, ShieldAlert, MapPin, Download } from 'lucide-react';
import { useStore, available } from '../../store/StoreContext';
import { Card, PageHeader, Badge, Mono, Table, Stat, Meter, Button, inputCls, fmtNum, cx, useToast } from '../../components/ui';
import { MaterialRowActions, NewMaterialButton } from '../../components/rowActions';
import { MATERIAL_CATEGORIES, MATERIAL_TYPES, hazardClass, categoryOf, materialTypeOf } from '../../store/rules';

const HAZARD_TONE = {
  Hazardous: 'bg-rose-50 text-rose-700 ring-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
  'Non-hazardous': 'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
};

export default function RawMaterialMaster() {
  const { state } = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [stock, setStock] = useState('All');
  const [mtype, setMtype] = useState('All');

  const rows = useMemo(() => state.materials.filter((m) => {
    const text = `${m.code} ${m.name} ${m.grade || ''} ${m.supplier || ''} ${m.location || ''}`.toLowerCase();
    const low = available(m) < m.reorder;
    return (!q || text.includes(q.toLowerCase()))
      && (cat === 'All' || categoryOf(m.category) === cat)
      && (mtype === 'All' || materialTypeOf(m.type) === mtype)
      && (stock === 'All' ? m.active !== false : stock === 'Inactive' ? m.active === false : m.active !== false && (stock === 'Low' ? low : !low));
  }), [state.materials, q, cat, stock, mtype]);

  const low = state.materials.filter((m) => available(m) < m.reorder).length;
  const hazardous = state.materials.filter((m) => hazardClass(m.hazard) === 'Hazardous').length;
  const value = state.materials.reduce((t, m) => t + m.onHand * (m.rate || 0), 0);
  const categories = ['All', ...MATERIAL_CATEGORIES.filter((c) => state.materials.some((m) => categoryOf(m.category) === c))];

  /* Download the master list as CSV */
  const exportCsv = () => {
    const head = ['Code', 'Name', 'Category', 'Grade', 'Unit', 'HSN', 'Hazard', 'Supplier', 'Rate', 'Reorder', 'Location', 'On hand', 'Reserved', 'Available'];
    const lines = rows.map((m) => [m.code, m.name, categoryOf(m.category), m.grade || '', m.unit, m.hsn || '', hazardClass(m.hazard), m.supplier || '', m.rate || 0, m.reorder, m.location || '', m.onHand, m.reserved, available(m)]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'raw-material-master.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Material master exported as CSV');
  };

  return (
    <>
      <PageHeader module="inventory" title="Raw Material Master" subtitle="Master list of every raw material: specification, safety, purchase and storage details."
        actions={<><Button variant="ghost" icon={Download} onClick={exportCsv}>Export CSV</Button><NewMaterialButton /></>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total Materials" value={state.materials.length} icon={Boxes} color="blue" hint={`${categories.length - 1} categories`} />
        <Stat label="Below Reorder Level" value={low} icon={AlertTriangle} color="red" hint="Need purchase soon" />
        <Stat label="Hazardous Materials" value={hazardous} icon={ShieldAlert} color="orange" hint="Handle as per MSDS" />
        <Stat label="Stock Value" value={`₹ ${fmtNum(Math.round(value))}`} icon={IndianRupee} color="teal" hint="On hand × standard rate" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between dark:border-white/[0.06]">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
            {categories.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={cx('shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  cat === c ? 'bg-prod-500 text-white' : 'text-slate-500 hover:bg-prod-50 hover:text-prod-500 dark:hover:bg-white/[0.06]')}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select className={cx(inputCls, 'lg:w-44')} value={mtype} onChange={(e) => setMtype(e.target.value)} aria-label="Material type filter">
              <option value="All">All types</option>
              {MATERIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className={cx(inputCls, 'lg:w-40')} value={stock} onChange={(e) => setStock(e.target.value)} aria-label="Stock filter">
              <option value="All">All stock</option>
              <option value="Low">Below reorder</option>
              <option value="OK">Healthy</option>
              <option value="Inactive">Inactive (deactivated)</option>
            </select>
            <div className="relative lg:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={cx(inputCls, 'pl-9')} placeholder="Search code, name, supplier…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        </div>

        <Table
          rowKey={(m) => m.code}
          rows={rows}
          empty={{ icon: Boxes, title: 'No materials match', text: 'Change the filters or add a new raw material.' }}
          columns={[
            { key: 'code', label: 'Code', render: (m) => <Mono className="text-prod-500">{m.code}</Mono> },
            { key: 'name', label: 'Material', render: (m) => (
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">{m.name}{m.active === false && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">Inactive</span>}</div>
                <div className="text-xs text-slate-500"><span className={materialTypeOf(m.type) === 'Packing Material' ? 'font-semibold text-orange-600' : 'font-semibold text-prod-500'}>{materialTypeOf(m.type) === 'Packing Material' ? 'PM' : 'RM'}</span> · {m.grade || '—'}{m.hsn && <> · HSN {m.hsn}</>}</div>
              </div>
            ) },
            { key: 'cat', label: 'Category', render: (m) => <span className="rounded-md bg-prod-50 px-2 py-0.5 text-xs font-semibold text-prod-500 dark:bg-prod-500/15">{categoryOf(m.category)}</span> },
            { key: 'hz', label: 'Hazard', render: (m) => (
              <span className={cx('inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ring-1 ring-inset', HAZARD_TONE[hazardClass(m.hazard)])}>{hazardClass(m.hazard)}</span>
            ) },
            { key: 'sup', label: 'Supplier / Rate', render: (m) => (
              <div><div className="text-sm">{m.supplier || '—'}</div><div className="text-xs text-slate-500">{m.rate ? `₹ ${m.rate} / ${m.unit}` : 'No rate'}</div></div>
            ) },
            { key: 'loc', label: 'Location', render: (m) => <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300"><MapPin size={13} className="text-slate-400" />{m.location || '—'}</span> },
            { key: 'av', label: 'Available', align: 'right', render: (m) => <span><b>{fmtNum(available(m))}</b> <span className="text-xs text-slate-400">{m.unit}</span></span> },
            { key: 'lvl', label: 'Stock level', className: 'w-40', render: (m) => (
              <div>
                <Meter value={available(m)} max={m.reorder * 3} tone={available(m) < m.reorder ? 'bg-rose-500' : 'bg-prod-500'} />
                <div className="mt-1 flex justify-between text-[0.6875rem] text-slate-400"><span>Reorder {fmtNum(m.reorder)}</span>
                  {available(m) < m.reorder ? <span className="font-semibold text-rose-600">Low</span> : <span className="font-semibold text-emerald-600">OK</span>}</div>
              </div>
            ) },
            { key: 'act', label: 'Actions', align: 'right', render: (m) => <MaterialRowActions m={m} /> },
          ]}
        />
      </Card>
    </>
  );
}
