import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import seed from '../data/seed.json';
import { hazardClass, categoryOf, materialTypeOf } from './rules';

/*
  JSON data store. No database and no backend.
  - Starts from src/data/seed.json
  - The working copy is kept in localStorage so changes survive a refresh
  - "Export JSON" in the top bar downloads the current state as a .json file
*/

const STORAGE_KEY = 'chemflow.store.v1';
const clone = (o) => JSON.parse(JSON.stringify(o));
const now = () => new Date().toISOString();
const nextId = (list, prefix, start = 1) => {
  const nums = list.map((x) => parseInt(String(x.id).split('-').pop(), 10)).filter(Number.isFinite);
  const n = (nums.length ? Math.max(...nums) + 1 : start).toString().padStart(4, '0');
  return `${prefix}-${n}`;
};

/* Order lifecycle used across both modules */
export const ORDER_FLOW = [
  'Draft',
  'Ready',
  'Pull Out Requested',
  'Material Issued',
  'Production Verified',
  'SOP Submitted',
  'Stock Verified',
  'Accepted',
];

export const available = (m) => m.onHand - m.reserved;

/* Stock per the ledger = all IN − all OUT movements for the material */
export function ledgerBalance(state, code) {
  return Math.round(state.ledger.filter((l) => l.code === code).reduce((t, l) => t + (l.type === 'IN' ? l.qty : -l.qty), 0) * 1000) / 1000;
}
export const ledgerEntries = (state, code) => state.ledger.filter((l) => l.code === code).length;

/* SOP bill of raw + packing material scaled to a number of batches: [{ code, group: 'RM'|'PM', qty }] */
export function sopLines(state, sopId, batches) {
  const sop = state.sops.find((s) => s.id === sopId);
  if (!sop) return [];
  const b = Number(batches) || 0;
  const r3 = (n) => Math.round(n * 1000) / 1000;
  return [
    ...sop.materials.map((l) => ({ code: l.code, group: 'RM', qty: r3(l.qty * b) })),
    ...(sop.packing || []).map((l) => ({ code: l.code, group: 'PM', qty: r3(l.qty * b) })),
  ];
}

/* Keep only complete, positive lines: [{ code, group, qty }] */
function cleanLines(lines) {
  return (lines || []).filter((l) => l.code && Number(l.qty) > 0)
    .map((l) => ({ code: l.code, group: l.group === 'PM' ? 'PM' : 'RM', qty: Math.round(Number(l.qty) * 1000) / 1000 }));
}

/* Raw-material requirement for an order: required vs available per material */
export function requirementFor(state, order) {
  /* Order's own material list (edited on the order) wins; otherwise the SOP's BOM × batches */
  const lines = order.lines?.length ? order.lines.map((l) => ({ code: l.code, group: l.group || 'RM', total: Number(l.qty) || 0 })) : sopLines(state, order.sopId, order.batches).map((l) => ({ ...l, total: l.qty }));
  return lines.map((line) => {
    const mat = state.materials.find((m) => m.code === line.code);
    const required = Math.round(line.total * 1000) / 1000;
    const avail = mat ? available(mat) : 0;
    return { code: line.code, group: line.group, name: mat?.name ?? line.code, unit: mat?.unit ?? '', required, available: avail, shortage: Math.max(0, Math.round((required - avail) * 1000) / 1000) };
  });
}

/* Editable master-data fields of a raw material */
function materialFields(p) {
  return {
    name: p.name, unit: p.unit, type: materialTypeOf(p.type), category: categoryOf(p.category), grade: p.grade || '', hsn: p.hsn || '',
    hazard: hazardClass(p.hazard), supplier: p.supplier || '', rate: Number(p.rate) || 0,
    reorder: Number(p.reorder) || 0, location: p.location || '',
  };
}

function log(s, module, msg) {
  s.activity.unshift({ t: now(), module, msg });
  s.activity = s.activity.slice(0, 60);
}
function stamp(order, status, by) {
  order.status = status;
  order.history = order.history || [];
  order.history.push({ status, t: now(), by });
}
function postLedger(s, code, type, qty, ref, rate) {
  const mat = s.materials.find((m) => m.code === code);
  const entry = { id: nextId(s.ledger, 'LG'), date: now(), code, type, qty, ref, balance: mat.onHand };
  if (rate != null) { entry.rate = Number(rate); entry.value = Math.round(Number(rate) * qty * 100) / 100; }
  s.ledger.unshift(entry);
}

function reducer(state, action) {
  if (action.type === 'REPLACE') return normalize(clone(action.data));
  const s = clone(state);
  const p = action.payload || {};
  const order = p.orderId ? s.orders.find((o) => o.id === p.orderId) : null;

  switch (action.type) {
    /* ---------------- Production ---------------- */
    case 'CREATE_ORDER': {
      const id = nextId(s.orders, 'PRD', 1001);
      s.orders.unshift({
        id, sopId: p.sopId, batches: Number(p.batches), plannedDate: p.plannedDate, priority: p.priority, status: 'Draft', createdAt: now(),
        lines: cleanLines(p.lines), history: [{ status: 'Draft', t: now(), by: 'Production' }],
      });
      log(s, 'production', `Production order ${id} created`);
      return s;
    }
    case 'CREATE_SOP': {
      const id = nextId(s.sops, 'SOP', 400);
      s.sops.push({ id, ...p.sop });
      log(s, 'production', `SOP ${id} · ${p.sop.product} added`);
      return s;
    }
    case 'CHECK_RM': {
      const lines = requirementFor(s, order);
      const short = lines.some((l) => l.shortage > 0);
      order.lastCheck = { t: now(), short };
      if (order.status === 'Draft' || order.status === 'Shortage' || order.status === 'Ready') {
        stamp(order, short ? 'Shortage' : 'Ready', 'Production');
      }
      log(s, 'production', `RM check for ${order.id}: ${short ? 'shortage found' : 'all materials available'}`);
      return s;
    }
    case 'SEND_PURCHASE_REQ': {
      const items = requirementFor(s, order).filter((l) => l.shortage > 0).map((l) => ({ code: l.code, qty: l.shortage }));
      const id = nextId(s.requests, 'MR');
      s.requests.unshift({ id, type: 'PURCHASE', orderId: order.id, items, status: 'Pending', createdAt: now() });
      stamp(order, 'Awaiting Purchase', 'Production');
      order.purchaseReqId = id;
      log(s, 'production', `Purchase requirement ${id} sent to Inventory for ${order.id}`);
      return s;
    }
    case 'REQUEST_PULL_OUT': {
      const items = requirementFor(s, order).map((l) => ({ code: l.code, qty: l.required }));
      const id = nextId(s.requests, 'MR');
      s.requests.unshift({ id, type: 'PULL_OUT', orderId: order.id, items, status: 'Pending', createdAt: now() });
      order.pullOutReqId = id;
      stamp(order, 'Pull Out Requested', 'Production');
      log(s, 'production', `Material pull out ${id} requested for ${order.id}`);
      return s;
    }
    case 'VERIFY_ISSUED': {
      const req = s.requests.find((r) => r.id === order.pullOutReqId);
      if (req) { req.status = 'Received by Production'; req.receivedNote = p.note; }
      stamp(order, 'Production Verified', p.by || 'Production');
      log(s, 'production', `Issued material verified by Production for ${order.id}`);
      return s;
    }
    case 'SUBMIT_SOP': {
      /* Batch sheet: batch no, MFG date, actual qty + checklist per line */
      order.submission = {
        actualYield: Number(p.actualYield), notes: p.notes, t: now(),
        batchNo: p.batchNo, mfgDate: p.mfgDate, lines: p.lines || [],
      };
      stamp(order, 'SOP Submitted', 'Production');
      log(s, 'production', `SOP for ${order.id} submitted for office acceptance`);
      return s;
    }

    /* ---------------- Inventory ---------------- */
    case 'RAISE_PO': {
      const id = nextId(s.purchases, 'PUR');
      s.purchases.unshift({ id, supplier: p.supplier, expected: p.expected, items: p.items, reqId: p.reqId || null, status: 'Ordered', date: now() });
      if (p.reqId) {
        const req = s.requests.find((r) => r.id === p.reqId);
        if (req) { req.status = 'PO Raised'; req.purchaseId = id; }
      }
      log(s, 'inventory', `Purchase order ${id} raised with ${p.supplier}`);
      return s;
    }
    case 'RECEIVE_GRN': {
      const po = s.purchases.find((x) => x.id === p.purchaseId);
      const grn = p.grnNo || `GRN-${po.id.split('-').pop()}`;
      /* p.items line up with po.items by position: [{ code, qty (received), rate }] */
      p.items.forEach((it) => {
        const qty = Number(it.qty) || 0;
        if (qty <= 0) return;
        const mat = s.materials.find((m) => m.code === it.code);
        mat.onHand += qty;
        postLedger(s, it.code, 'IN', qty, `${grn} · ${po.id}`, it.rate);
      });
      po.received = p.items.map((it, i) => ({ code: it.code, ordered: po.items[i]?.qty ?? 0, qty: Number(it.qty) || 0, rate: Number(it.rate) || 0 }));
      po.receivedValue = po.received.reduce((t, r) => t + r.qty * r.rate, 0);
      po.status = 'Received';
      po.grnNo = grn;
      po.receivedAt = now();
      if (po.reqId) {
        const req = s.requests.find((r) => r.id === po.reqId);
        if (req) {
          req.status = 'Received';
          const o = s.orders.find((x) => x.id === req.orderId);
          if (o && o.status === 'Awaiting Purchase') stamp(o, 'Draft', 'Inventory');
        }
      }
      log(s, 'inventory', `${grn} received against ${po.id}. RM stock updated`);
      return s;
    }
    case 'DIRECT_STOCK_IN': {
      const mat = s.materials.find((m) => m.code === p.code);
      mat.onHand += Number(p.qty);
      postLedger(s, p.code, 'IN', Number(p.qty), p.ref || 'Direct stock in');
      log(s, 'inventory', `${p.qty} ${mat.unit} of ${mat.name} stocked in`);
      return s;
    }
    case 'ISSUE_PULL_OUT': {
      const req = s.requests.find((r) => r.id === p.reqId);
      /* Confirm issue = stock OUT from the store: on hand goes down and an OUT entry is posted in Stock Movement */
      req.items.forEach((it) => {
        const mat = s.materials.find((m) => m.code === it.code);
        mat.onHand = Math.round((mat.onHand - it.qty) * 1000) / 1000;
        postLedger(s, it.code, 'OUT', it.qty, `${req.orderId} · ${req.id} · issued to production`);
      });
      req.stockOut = true;
      req.status = 'Issued';
      req.issuedBy = p.issuedBy;
      req.issuedAt = now();
      const o = s.orders.find((x) => x.id === req.orderId);
      if (o) stamp(o, 'Material Issued', 'Inventory');
      log(s, 'inventory', `Material for ${req.orderId} issued by ${p.issuedBy}`);
      return s;
    }
    case 'STOCK_VERIFY': {
      order.stockCheck = { by: p.by, remarks: p.remarks, checks: p.checks, t: now() };
      stamp(order, 'Stock Verified', p.by);
      log(s, 'inventory', `Stock person ${p.by} verified ${order.id}`);
      return s;
    }
    case 'OFFICE_ACCEPT': {
      const req = s.requests.find((r) => r.id === order.pullOutReqId);
      /* Stock already posted OUT at issue (new flow) → nothing more to deduct here.
         Older issues that only reserved stock are posted OUT now, as before. */
      if (!req?.stockOut) (req?.items || []).forEach((it) => {
        const mat = s.materials.find((m) => m.code === it.code);
        /* the only point where stock leaves: on hand − issued qty = balance (rounded to 3 decimals, e.g. 1650 − 340.5) */
        mat.reserved = Math.max(0, Math.round((mat.reserved - it.qty) * 1000) / 1000);
        mat.onHand = Math.round((mat.onHand - it.qty) * 1000) / 1000;
        postLedger(s, it.code, 'OUT', it.qty, `${order.id} · ${req.id}`);
      });
      if (req) req.status = 'Closed';
      order.acceptance = { by: p.by, signature: p.signature, t: now() };
      stamp(order, 'Accepted', p.by);
      log(s, 'inventory', `Office accepted SOP for ${order.id}. JSON stock records updated`);
      return s;
    }
    /* ---------------- Edit / Delete ---------------- */
    case 'UPDATE_ORDER': {
      const lines = cleanLines(p.patch.lines);
      const changedRecipe = p.patch.sopId !== order.sopId || Number(p.patch.batches) !== order.batches
        || JSON.stringify(lines) !== JSON.stringify(order.lines || []);
      Object.assign(order, { ...p.patch, batches: Number(p.patch.batches), lines });
      if (changedRecipe && ['Shortage', 'Ready'].includes(order.status)) stamp(order, 'Draft', 'Production');
      log(s, 'production', `Production order ${order.id} edited`);
      return s;
    }
    case 'DELETE_ORDER': {
      s.orders = s.orders.filter((o) => o.id !== p.orderId);
      log(s, 'production', `Production order ${p.orderId} deleted`);
      return s;
    }
    case 'UPDATE_SOP': {
      const i = s.sops.findIndex((x) => x.id === p.id);
      s.sops[i] = { ...s.sops[i], ...p.sop, id: p.id };
      log(s, 'production', `SOP ${p.id} edited`);
      return s;
    }
    case 'DELETE_SOP': {
      s.sops = s.sops.filter((x) => x.id !== p.id);
      log(s, 'production', `SOP ${p.id} deleted`);
      return s;
    }
    case 'UPDATE_REQUEST': {
      const req = s.requests.find((r) => r.id === p.reqId);
      req.items = p.items.map((it) => ({ code: it.code, qty: Number(it.qty) }));
      log(s, 'production', `Request ${req.id} edited`);
      return s;
    }
    case 'DELETE_REQUEST': {
      const req = s.requests.find((r) => r.id === p.reqId);
      const o = s.orders.find((x) => x.id === req.orderId);
      if (o && req.type === 'PULL_OUT') { delete o.pullOutReqId; stamp(o, 'Ready', 'Production'); }
      if (o && req.type === 'PURCHASE') { delete o.purchaseReqId; stamp(o, 'Shortage', 'Production'); }
      s.requests = s.requests.filter((r) => r.id !== p.reqId);
      log(s, 'production', `Request ${p.reqId} cancelled`);
      return s;
    }
    case 'UPDATE_PO': {
      const po = s.purchases.find((x) => x.id === p.purchaseId);
      Object.assign(po, { supplier: p.supplier, expected: p.expected, items: p.items.map((it) => ({ code: it.code, qty: Number(it.qty), rate: Number(it.rate) })) });
      log(s, 'inventory', `Purchase order ${po.id} edited`);
      return s;
    }
    case 'DELETE_PO': {
      const po = s.purchases.find((x) => x.id === p.purchaseId);
      if (po.reqId) {
        const req = s.requests.find((r) => r.id === po.reqId);
        if (req) { req.status = 'Pending'; delete req.purchaseId; }
      }
      s.purchases = s.purchases.filter((x) => x.id !== p.purchaseId);
      log(s, 'inventory', `Purchase order ${p.purchaseId} deleted`);
      return s;
    }
    case 'REVERT_ISSUE': {
      const req = s.requests.find((r) => r.id === p.reqId);
      req.items.forEach((it) => {
        const mat = s.materials.find((m) => m.code === it.code);
        if (req.stockOut) {
          /* Stock went OUT on issue → bring it back with a reversal IN entry */
          mat.onHand = Math.round((mat.onHand + it.qty) * 1000) / 1000;
          postLedger(s, it.code, 'IN', it.qty, `${req.orderId} · ${req.id} · issue reversed`);
        } else {
          mat.reserved = Math.max(0, mat.reserved - it.qty);
        }
      });
      req.status = 'Pending';
      delete req.issuedBy; delete req.issuedAt; delete req.stockOut;
      const o = s.orders.find((x) => x.id === req.orderId);
      if (o) stamp(o, 'Pull Out Requested', 'Inventory');
      log(s, 'inventory', `Issue of ${req.id} reversed, stock un-reserved`);
      return s;
    }
    case 'UPDATE_SUBMISSION': {
      order.submission = { ...order.submission, actualYield: Number(p.actualYield), notes: p.notes };
      log(s, 'production', `SOP submission for ${order.id} edited`);
      return s;
    }
    case 'WITHDRAW_SUBMISSION': {
      delete order.submission;
      stamp(order, 'Production Verified', 'Production');
      log(s, 'production', `SOP submission for ${order.id} withdrawn`);
      return s;
    }
    case 'UPDATE_STOCK_CHECK': {
      order.stockCheck = { ...order.stockCheck, by: p.by, remarks: p.remarks };
      log(s, 'inventory', `Stock check for ${order.id} edited`);
      return s;
    }
    case 'REVERT_STOCK_CHECK': {
      delete order.stockCheck;
      stamp(order, 'SOP Submitted', 'Inventory');
      log(s, 'inventory', `Stock check for ${order.id} reversed`);
      return s;
    }
    case 'CREATE_MATERIAL': {
      /* RM-xxx for raw materials, PM-xxx for packing materials */
      const prefix = p.type === 'Packing Material' ? 'PM' : 'RM';
      const nums = s.materials.filter((m) => m.code.startsWith(`${prefix}-`)).map((m) => parseInt(m.code.split('-').pop(), 10)).filter(Number.isFinite);
      const code = `${prefix}-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
      s.materials.push({ code, ...materialFields(p), onHand: 0, reserved: 0 });
      log(s, 'inventory', `Raw material ${code} · ${p.name} added`);
      return s;
    }
    case 'UPDATE_MATERIAL': {
      const mat = s.materials.find((m) => m.code === p.code);
      Object.assign(mat, materialFields(p));
      log(s, 'inventory', `Raw material ${p.code} edited`);
      return s;
    }
    case 'DEACTIVATE_MATERIAL': {
      const mat = s.materials.find((m) => m.code === p.code);
      mat.active = false;
      mat.deactivatedAt = now();
      log(s, 'inventory', `Raw material ${p.code} deactivated (ledger history kept)`);
      return s;
    }
    case 'RESTORE_MATERIAL': {
      const mat = s.materials.find((m) => m.code === p.code);
      mat.active = true;
      delete mat.deactivatedAt;
      log(s, 'inventory', `Raw material ${p.code} restored`);
      return s;
    }
    case 'DELETE_MATERIAL': {
      s.materials = s.materials.filter((m) => m.code !== p.code);
      log(s, 'inventory', `Raw material ${p.code} deleted`);
      return s;
    }
    default:
      return state;
  }
}

/* Bring older saved/imported data in line with the current dropdown values */
function normalize(data) {
  const MASTER_KEYS = ['category', 'grade', 'hsn', 'hazard', 'supplier', 'rate'];
  data.materials = (data.materials || []).map((m) => {
    /* Data saved before the master fields existed: fill only the missing ones from the seed (same code) */
    const base = seed.materials.find((x) => x.code === m.code && x.name === m.name) || {};
    const filled = { ...m };
    MASTER_KEYS.forEach((k) => { if (filled[k] === undefined || filled[k] === '') filled[k] = base[k] ?? filled[k]; });
    return { ...filled, rate: Number(filled.rate) || 0, type: materialTypeOf(filled.type ?? base.type), category: categoryOf(filled.category), hazard: hazardClass(filled.hazard) };
  });
  /* Add seed materials / SOPs that older saved data doesn't have yet (e.g. the new batch-sheet SOP) */
  data.ledger = data.ledger || [];
  seed.materials.forEach((m) => {
    if (!data.materials.some((x) => x.code === m.code)) data.materials.push({ ...m, type: materialTypeOf(m.type) });
  });
  /* Every material with stock must have ledger history: bring in the seed's entries for codes the ledger has never seen */
  seed.ledger.forEach((e) => {
    const m = data.materials.find((x) => x.code === e.code);
    if (m && !data.ledger.some((l) => l.code === e.code)) {
      seed.ledger.filter((x) => x.code === e.code).forEach((x) => data.ledger.push({ ...x, id: nextId(data.ledger, 'LG') }));
    }
  });
  data.sops = data.sops || [];
  seed.sops.forEach((sp) => { if (!data.sops.some((x) => x.id === sp.id)) data.sops.push(sp); });
  if (!data.company) data.company = seed.company;
  /* One-off repair: POs raised before the fix were rounded up to the nearest 50.
     Only open (Ordered) POs linked to a requirement, and only lines that hold exactly that rounded figure. */
  (data.purchases || []).forEach((po) => {
    if (po.status !== 'Ordered' || !po.reqId) return;
    const req = (data.requests || []).find((r) => r.id === po.reqId);
    if (!req) return;
    po.items = po.items.map((it) => {
      const need = req.items.find((x) => x.code === it.code)?.qty;
      return need != null && need !== it.qty && it.qty === Math.ceil(need / 50) * 50 ? { ...it, qty: need } : it;
    });
  });
  return data;
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* ignore and fall back to seed */ }
  return normalize(clone(seed));
}

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, [state]);

  const api = useMemo(() => ({
    state,
    dispatch: (type, payload) => dispatch({ type, payload }),
    reset: () => dispatch({ type: 'REPLACE', data: seed }),
    replace: (data) => dispatch({ type: 'REPLACE', data }),
  }), [state]);

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);
