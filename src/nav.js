import {
  LayoutDashboard, ClipboardList, BookOpenCheck, Gauge, PackageOpen, FileCheck2, History,
  Boxes, ShoppingCart, PackagePlus, Inbox, PackageMinus, ScanSearch, Stamp, BookText,
} from 'lucide-react';

/* Menu bar: only the two existing modules, Production and Inventory. */
export const NAV = [
  {
    module: 'production',
    label: 'Production',
    items: [
      { path: 'production/orders', label: 'Production Orders', icon: ClipboardList, desc: 'Create and track production orders' },
      { path: 'production/sop', label: 'SOP Management', icon: BookOpenCheck, desc: 'Standard operating procedures and recipes (BOM)' },
      { path: 'production/rm-stock', label: 'RM Stock Availability', icon: Gauge, desc: 'Check raw material requirement against inventory' },
      { path: 'production/pull-out', label: 'Material Pull Out Request', icon: PackageOpen, desc: 'Request material and verify what was issued' },
      { path: 'production/sop-submission', label: 'SOP Submission', icon: FileCheck2, desc: 'Submit completed SOPs for office acceptance' },
      { path: 'production/history', label: 'Material Request History', icon: History, desc: 'All purchase and pull out requests' },
    ],
  },
  {
    module: 'inventory',
    label: 'Inventory',
    items: [
      { path: 'inventory/materials', color: 'teal', label: 'Raw Material Master', icon: Boxes, desc: 'Master list of raw materials' },
      { path: 'inventory/purchase', label: 'Raw Material Purchase', icon: ShoppingCart, desc: 'Purchase requirements and purchase orders' },
      { path: 'inventory/stock-in', label: 'RM Stock In', icon: PackagePlus, desc: 'Receive GRN and add stock' },
      { path: 'inventory/requests', label: 'Production Material Requests', icon: Inbox, desc: 'Requests coming from Production' },
      { path: 'inventory/pull-out', label: 'Raw Material Pull Out', icon: PackageMinus, desc: 'Issue material to production' },
      { path: 'inventory/stock-verification', label: 'Stock Person Verification', icon: ScanSearch, desc: 'Physical check of submitted SOPs' },
      { path: 'inventory/office-acceptance', label: 'SOP Office Acceptance', icon: Stamp, desc: 'Office signature and final acceptance' },
      { path: 'inventory/ledger', label: 'Stock Ledger', icon: BookText, desc: 'Stock balances and movements' },
    ],
  },
];

export const DASHBOARD = { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard };

export const findNav = (path) => {
  for (const g of NAV) {
    const item = g.items.find((i) => i.path === path);
    if (item) return { ...item, module: g.module, group: g.label };
  }
  return null;
};
