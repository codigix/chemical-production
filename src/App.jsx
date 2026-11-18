import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { useRoute } from './router';
import { findNav } from './nav';

import Dashboard from './pages/Dashboard';
import ProductionOrders from './pages/production/ProductionOrders';
import SopManagement from './pages/production/SopManagement';
import RmStockAvailability from './pages/production/RmStockAvailability';
import PullOutRequest from './pages/production/PullOutRequest';
import SopSubmission from './pages/production/SopSubmission';
import RequestHistory from './pages/production/RequestHistory';
import RawMaterialMaster from './pages/inventory/RawMaterialMaster';
import RawMaterialPurchase from './pages/inventory/RawMaterialPurchase';
import RmStockIn from './pages/inventory/RmStockIn';
import ProductionRequests from './pages/inventory/ProductionRequests';
import RawMaterialPullOut from './pages/inventory/RawMaterialPullOut';
import StockVerification from './pages/inventory/StockVerification';
import OfficeAcceptance from './pages/inventory/OfficeAcceptance';
import StockLedger from './pages/inventory/StockLedger';
import StockMovement from './pages/inventory/StockMovement';

const PAGES = {
  dashboard: Dashboard,
  'production/orders': ProductionOrders,
  'production/sop': SopManagement,
  'production/rm-stock': RmStockAvailability,
  'production/pull-out': PullOutRequest,
  'production/sop-submission': SopSubmission,
  'production/history': RequestHistory,
  'inventory/materials': RawMaterialMaster,
  'inventory/purchase': RawMaterialPurchase,
  'inventory/stock-in': RmStockIn,
  'inventory/requests': ProductionRequests,
  'inventory/pull-out': RawMaterialPullOut,
  'inventory/stock-verification': StockVerification,
  'inventory/office-acceptance': OfficeAcceptance,
  'inventory/ledger': StockLedger,
  'inventory/movements': StockMovement,
};

export default function App() {
  const { path, params } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('chemflow.theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('chemflow.theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);

  const Page = PAGES[path] || Dashboard;
  const nav = findNav(path);

  useEffect(() => {
    document.title = `${nav ? nav.label : 'Dashboard'} · ChemFlow`;
  }, [nav]);

  return (
    <div className="min-h-screen">
      <Sidebar current={PAGES[path] ? path : 'dashboard'} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-[16.25rem]">
        <Topbar onMenu={() => setMenuOpen(true)} dark={dark} onToggleTheme={() => setDark((d) => !d)} />
        <main className="min-h-[calc(100vh-4rem)]">
          <div key={path} className="animate-rise mx-auto max-w-[90rem] px-4 py-6 sm:px-6">
            <Page params={params} />
          </div>
        </main>
      </div>
    </div>
  );
}
