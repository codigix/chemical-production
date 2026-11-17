# chemical-production

ChemFlow UI for the **Production** and **Inventory** modules of the chemical plant ERP.

- React (JSX) + Tailwind CSS v4 + Lucide React icons, served by Vite
- Dummy JSON data only. No backend, no database, no new modules.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Data

- Seed data: `src/data/seed.json` (materials, SOPs, orders, requests, purchases, ledger, activity)
- The working copy is kept in the browser (localStorage), so changes survive a refresh.
- Top bar: **Export JSON** downloads the current data, **Import** loads a JSON file, **Reset** goes back to the seed.
- All workflow actions live in one reducer: `src/store/StoreContext.jsx`.

## Menu

| Production | Inventory |
|---|---|
| Production Orders | Raw Material Purchase |
| SOP Management | RM Stock In |
| RM Stock Availability | Production Material Requests |
| Material Pull Out Request | Raw Material Pull Out |
| SOP Submission | Stock Person Verification |
| Material Request History | SOP Office Acceptance |
| | Stock Ledger |

## Workflow

```
Production Order / SOP → Check RM Stock
   ├─ Shortage  → Purchase Requirement → (Inventory) PO → GRN / RM Stock In → re-check
   └─ Available → Material Pull Out (Inventory issues, stock reserved)
                 → Production verifies issued material → SOP Submission
                 → Stock Person Check → Office Signature & Acceptance
                 → Stock ledger OUT posted, JSON records updated
```

## Structure

```
src/
  App.jsx                 layout + routes (hash router in router.js)
  nav.js                  menu definition
  store/StoreContext.jsx  JSON store + workflow actions
  data/seed.json          dummy data
  components/             ui kit, sidebar, top bar, order stepper, order detail
  pages/production/       6 production screens
  pages/inventory/        7 inventory screens
  pages/Dashboard.jsx     overview + workflow map
```
