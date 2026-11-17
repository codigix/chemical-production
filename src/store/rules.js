/* When a record may still be edited or deleted. Returns null if allowed, otherwise the reason (shown as a tooltip). */

const EARLY = ['Draft', 'Shortage', 'Ready'];
const IN_FLIGHT = ['Pull Out Requested', 'Material Issued', 'Production Verified', 'SOP Submitted', 'Stock Verified'];

export const orderEditBlock = (o) =>
  EARLY.includes(o.status) ? null : 'Only Draft, Shortage or Ready orders can be changed';

export const sopEditBlock = (state, sop) =>
  state.orders.some((o) => o.sopId === sop.id && IN_FLIGHT.includes(o.status)) ? 'SOP is used by an order in progress' : null;

export const sopDeleteBlock = (state, sop) =>
  state.orders.some((o) => o.sopId === sop.id) ? 'SOP is used by production orders' : null;

export const requestBlock = (r) =>
  r.status === 'Pending' ? null : `Request is already ${r.status}`;

export const poBlock = (p) =>
  p.status === 'Ordered' ? null : 'PO already received. GRN is posted to the ledger';

export const issueRevertBlock = (r) =>
  r.status === 'Issued' ? null : r.status === 'Pending' ? 'Not issued yet' : 'Production has already received this material';

export const submissionBlock = (o) =>
  o.status === 'SOP Submitted' ? null : 'Already checked by the stock person';

export const stockCheckBlock = (o) =>
  o.status === 'Stock Verified' ? null : 'Already accepted by the office';

/* Where a material is used + what Delete may do: 'delete' (never used) | 'deactivate' (history only) | 'blocked' (in active use) */
export function materialUsage(state, m) {
  const has = (items) => (items || []).some((x) => x.code === m.code);
  const sops = state.sops.filter((s) => has(s.materials) || has(s.packing));
  const openPOs = state.purchases.filter((p) => p.status === 'Ordered' && has(p.items));
  const pendingReqs = state.requests.filter((r) => ['Pending', 'PO Raised', 'Issued'].includes(r.status) && has(r.items));
  const entries = state.ledger.filter((l) => l.code === m.code).length;
  const blockers = [
    sops.length && `Used in SOP ${sops.map((s) => `${s.id} (${s.product})`).join(', ')}`,
    openPOs.length && `On open purchase order ${openPOs.map((p) => p.id).join(', ')}`,
    pendingReqs.length && `On open material request ${pendingReqs.map((r) => r.id).join(', ')}`,
    m.reserved > 0 && `${m.reserved} ${m.unit} reserved for production`,
  ].filter(Boolean);
  const mode = blockers.length ? 'blocked' : (m.onHand > 0 || entries > 0) ? 'deactivate' : 'delete';
  return { sops, openPOs, pendingReqs, entries, blockers, mode };
}
export const isActive = (m) => m.active !== false;

export const materialDeleteBlock = (state, m) => {
  if (state.sops.some((s) => s.materials.some((x) => x.code === m.code))) return 'Used in an SOP';
  if (m.onHand > 0 || m.reserved > 0) return 'Material still has stock';
  if (state.ledger.some((l) => l.code === m.code)) return 'Material has ledger history';
  return null;
};

export const POSTED = 'Posted ledger entries cannot be changed';

/* Raw material master dropdowns (kept separate: Category never contains hazard values) */
export const MATERIAL_CATEGORIES = ['Acid', 'Alkali', 'Salt', 'Oxidiser', 'Mineral', 'Solvent', 'Additive', 'General'];
export const HAZARD_CLASSES = ['Hazardous', 'Non-hazardous'];

/* Normalise any stored value (incl. older ones like "Corrosive") to one of HAZARD_CLASSES */
/* Raw material vs packing material (separate from Category) */
export const MATERIAL_TYPES = ['Raw Material', 'Packing Material'];
export const materialTypeOf = (t) => (t === 'Packing Material' ? 'Packing Material' : 'Raw Material');

export const hazardClass =(h) => (!h || h === 'Non-hazardous' ? 'Non-hazardous' : 'Hazardous');
export const categoryOf = (c) => (MATERIAL_CATEGORIES.includes(c) ? c : 'General');
