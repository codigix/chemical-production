import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import seed from '../data/seed.json';

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

/* Raw-material requirement for an order: required vs available per material */
export function requirementFor(state, order) {
  const sop = state.sops.find((s) => s.id === order.sopId);
  if (!sop) return [];
  return sop.materials.map((line) => {
    const mat = state.materials.find((m) => m.code === line.code);
    const required = line.qty * order.batches;
    const avail = mat ? available(mat) : 0;
    return { code: line.code, name: mat?.name ?? line.code, unit: mat?.unit ?? '', required, available: avail, shortage: Math.max(0, required - avail) };
  });
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
function postLedger(s, code, type, qty, ref) {
  const mat = s.materials.find((m) => m.code === code);
  s.ledger.unshift({ id: nextId(s.ledger, 'LG'), date: now(), code, type, qty, ref, balance: mat.onHand });
}

function reducer(state, action) {
  if (action.type === 'REPLACE') return clone(action.data);
  const s = clone(state);
  const p = action.payload || {};
  const order = p.orderId ? s.orders.find((o) => o.id === p.orderId) : null;

  switch (action.type) {
    /* ---------------- Production ---------------- */
    case 'CREATE_ORDER': {
      const id = nextId(s.orders, 'PRD', 1001);
      s.orders.unshift({ id, sopId: p.sopId, batches: Number(p.batches), plannedDate: p.plannedDate, priority: p.priority, status: 'Draft', createdAt: now(), history: [{ status: 'Draft', t: now(), by: 'Production' }] });
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
      order.submission = { actualYield: Number(p.actualYield), notes: p.notes, t: now() };
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
      p.items.forEach((it) => {
        const mat = s.materials.find((m) => m.code === it.code);
        mat.onHand += Number(it.qty);
        postLedger(s, it.code, 'IN', Number(it.qty), `${grn} · ${po.id}`);
      });
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
      req.items.forEach((it) => {
        const mat = s.materials.find((m) => m.code === it.code);
        mat.reserved += it.qty;
      });
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
      (req?.items || []).forEach((it) => {
        const mat = s.materials.find((m) => m.code === it.code);
        mat.reserved = Math.max(0, mat.reserved - it.qty);
        mat.onHand -= it.qty;
        postLedger(s, it.code, 'OUT', it.qty, `${order.id} · ${req.id}`);
      });
      if (req) req.status = 'Closed';
      order.acceptance = { by: p.by, signature: p.signature, t: now() };
      stamp(order, 'Accepted', p.by);
      log(s, 'inventory', `Office accepted SOP for ${order.id}. JSON stock records updated`);
      return s;
    }
    default:
      return state;
  }
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore and fall back to seed */ }
  return clone(seed);
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
