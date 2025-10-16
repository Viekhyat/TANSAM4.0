# TANSAM Visualizer

A React + Vite web app for quickly importing datasets, exploring fields, and building chart-driven dashboards entirely in the browser. All data, chart configurations, and auth state are persisted in `localStorage` so you can experiment freely without a backend.

## Features
- Drag & drop import for CSV, XLSX, and JSON files with automatic schema/type inference
- Google Sheets support via public CSV share links (auto-transforms standard share URLs)
- Preview tables with sticky headers, type badges, and the first 50 rows of data
- Chart builder with live Recharts preview for Line, Bar, Area, Scatter, Pie, Donut, and Radar charts
- Aggregation controls (none, sum, avg, min, max) plus Top N filtering
- Save datasets and charts to `localStorage`; edit/duplicate/delete charts from the dashboard
- Export any chart preview as PNG using `html2canvas`
- Mock authentication (email/password stored locally) with guarded routes
- Seeded sample datasets and charts on first run for immediate exploration

## Project Structure
```
.
├── public/samples/         # Seed datasets
├── src/
│   ├── pages/              # Login, Data, Visualize, Dashboard, 404
│   ├── providers/          # Auth & Store contexts
│   ├── ui/                 # DataPreviewTable, ChartRenderer
│   ├── utils/              # Data parsing + chart data helpers
│   ├── App.jsx             # Routes + layout
│   └── main.jsx            # App bootstrap
└── tailwind.config.js      # Tailwind configuration
```

## Getting Started
```bash
npm install
npm run dev
```

Visit `http://localhost:5173` and log in with any non-empty email/password combination. Sample datasets and charts will be seeded automatically the first time `localStorage.datasets` and `localStorage.charts` are empty.

## Building for Production
```bash
npm run build
npm run preview
```

## Authentication
- Mock login: any email and password sign you in
- Logout clears `localStorage.auth` but keeps datasets and charts

## Resetting Local Storage
Clear the following keys in your browser console to reset the app state:
```js
localStorage.removeItem('auth');
localStorage.removeItem('datasets');
localStorage.removeItem('charts');
```
Reload the page afterwards to trigger the sample seed data again.
