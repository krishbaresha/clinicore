# 🏥 ClinicFlow Frontend (React 19 + Vite 8 + Tailwind CSS)

This directory contains the production Single Page Application (SPA) and Offline-First Progressive Web App (PWA) client for **ClinicFlow (CliniCore)**.

---

## 🛠️ Tech Stack

- **Framework:** React 19 SPA (`react`, `react-dom`, `react-router-dom` v7)
- **Bundler:** Vite 8.2.1 (Ultra-fast Hot Module Replacement & production chunking)
- **Styling:** Tailwind CSS v4 with Glassmorphism and UI/UX Pro Max tokens
- **Icons:** Material Symbols Outlined & Lucide React
- **Linter & Code Quality:** Oxlint (strict AST analysis) & Custom Hook Scan Pipeline

---

## 🚀 Development Scripts

```bash
# Start local development server with /api proxy
npm run dev

# Run oxlint AST static analysis
npm run lint

# Execute full automated test battery (308 tests across 32 test suites)
npm test

# Build production distribution bundle to /dist
npm run build

# Preview production build locally
npm run preview
```

---

## 📁 Key Frontend Directories

- `src/api/db.js` — In-memory memoized cache + $O(1)$ local storage database engine.
- `src/api/auth.js` — Session authentication, SHA-256 digests, and RBAC guards.
- `src/api/syncEngine.js` — Offline outbox queue & mutex-locked cloud synchronization.
- `src/utils/thermalPrinter.js` — Low-ink 80mm ESC/POS thermal receipt formatter.
- `src/utils/imageCompressor.js` — Client-side canvas JPEG compressor for patient clinical records.
- `src/pages/` — 20+ modular lazy-loaded screens for OPD, POS, EMR, Inventory, Godowns, Purchases, and Super Admin.
- `src/components/` — Reusable dialogs, photo lightboxes, stock ledgers, and shortcut cheatsheets.
