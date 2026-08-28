<div align="center">

# 🏥 ClinicFlow (CliniCore) Hybrid V2.5
### **Enterprise OPD Clinical Management, Multi-Warehouse Pharmacy POS & Wholesale Distribution Engine**
*Designed & Engineered for Dr. Muhammad Asif Ashraf Khan Clinic & Wholesale Medical Store (Hyderabad & Interior Sindh)*

[![Test Suite](https://img.shields.io/badge/Tests-308%2F308%20Passing%20(100%25)-10b981.svg?style=for-the-badge&logo=vitest&logoColor=white)](https://github.com/krishbaresha/clinicore)
[![Code Quality](https://img.shields.io/badge/Oxlint-0%20Errors%20(Strict%20AST)-0ea5e9.svg?style=for-the-badge&logo=eslint&logoColor=white)](https://github.com/krishbaresha/clinicore)
[![Build Status](https://img.shields.io/badge/Vite%208.2.1-Production%20Ready%20(<1s)-8b5cf6.svg?style=for-the-badge&logo=vite&logoColor=white)](https://github.com/krishbaresha/clinicore)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline--First%20ServiceWorker-f59e0b.svg?style=for-the-badge&logo=pwa&logoColor=white)](https://github.com/krishbaresha/clinicore)
[![Thermal Printing](https://img.shields.io/badge/ESC%2FPOS-80mm%20Low--Ink%20Engine-14b8a6.svg?style=for-the-badge&logo=print&logoColor=white)](https://github.com/krishbaresha/clinicore)
[![Dual Engine](https://img.shields.io/badge/Desktop%20Hybrid-React%20%2B%20SQLite%20%2B%20MySQL-6366f1.svg?style=for-the-badge&logo=electron&logoColor=white)](https://github.com/krishbaresha/clinicore)

---

</div>

## 📌 Executive Summary

**ClinicFlow (CliniCore)** is a mission-critical, enterprise-grade clinical management and pharmacy distribution software suite. Built with an **offline-first hybrid architecture**, it seamlessly bridges high-speed OPD patient consultations, rapid retail POS counter dispensing, multi-godown wholesale distribution across Interior Sindh, and 2-way synchronized cloud reporting.

Originally developed to modernize legacy MS Access (`DrCreate.xlsm` / `AshrafKhan.accdb`) workflows, ClinicFlow provides instantaneous sub-millisecond local operations with zero network dependency, automatic background cloud synchronization, and strict role-based access control (RBAC).

---

## 🏛️ System Architecture

```text
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                CLINICFLOW CORE ENGINE                                 │
├───────────────────────────────┬───────────────────────────────────────────────────────┤
│ 🖥️ CLIENT-SIDE SPA (VITE/REACT) │ ⚡ In-Memory $O(1)$ Hash Map Cache (_ID_MAP_CACHE)    │
│                               │ 💾 Auto-Hydrated LocalStorage + IndexedDB Database     │
│                               │ 📱 Service Worker Tiered PWA Cache (Full Offline Ops) │
├───────────────────────────────┼───────────────────────────────────────────────────────┤
│ 🖨️ HARDWARE PRINT ENGINE      │ 🧾 80mm ESC/POS Thermal Slip Formatter                │
│                               │ 🛡️ Strict escapeHtml() XSS Injection Neutralization   │
│                               │ 📉 Low-Ink High-Contrast Thermal Matrix Layout        │
├───────────────────────────────┼───────────────────────────────────────────────────────┤
│ ☁️ CLOUD SYNC & REPLICATION   │ 🔄 Local Mutation Outbox Queue (Offline Resilience)   │
│                               │ 🔒 Mutex-Locked pullLatestCloudState Reconciler       │
│                               │ 🌐 VPS MySQL / REST Gateway (api.clinicore.me)        │
├───────────────────────────────┼───────────────────────────────────────────────────────┤
│ 🏢 RBAC & SECURITY            │ 🔐 SHA-256 Deterministic Password Hashing             │
│                               │ 🚫 Brute-Force Rate Limiter & Lockout Defense         │
│                               │ 👁️ Role-Scoped Warehouse & Confidential Revenue Views │
└───────────────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 🌟 Core Functional Subsystems

### 1. 🩺 OPD Consultation, Queue & Patient Lifecycle
* **Daily Auto-Reset Token Engine:** Automatic daily token sequencing (`#01`, `#02`, ...) with token issuance, doctor fee selection, procedure fee add-ons, and patient ledger balance settlement.
* **Strict Doctor Queue Isolation:** Doctor consultation portals exclusively display their own assigned patients (`waiting` $\rightarrow$ `in_consultation` $\rightarrow$ `completed` / `completed_reports_pending`).
* **Clinical Vitals HUD:** Real-time capture and persistence of Blood Pressure (Sys/Dia), Pulse (bpm), Temperature (°F), SpO2 (%), and Weight (kg) with clinical color-coded thresholds.
* **EMR & Reports Lightbox:** Client-side canvas JPEG photo compression for lab/X-ray attachments with full optical zoom, rotation, and visit timeline history.

### 2. 🛒 High-Speed Pharmacy POS Terminal (`/pos`)
* **100% Keyboard-Driven Command Deck:** Full F1–F11 hotkey support for sub-second counter dispensing without touching the mouse.
* **2D Grid Arrow Key Navigation:** Seamless arrow navigation across inventory search results and active cart items.
* **Multi-Tier Discount Engine:** Line-item percentage/flat discounts combined with overall bill-level trade discounts.
* **Anti-Theft Counter Stock Guard:** Real-time stock verification prevents selling items with insufficient counter stock and guides operators to request godown transfers.
* **Flexible Payment Modes:** Full Cash in Hand, Walk-in vs. Linked OPD Patient, Credit / Udhaar with automatic Patient Ledger balance updates, and Instant Last-Bill Reprint (`F10`).

### 3. 📦 Medical Store Inventory & Catalog Management (`/store`)
* **Company-Specific Medicine Filtering:** Pre-indexed mapping for 28+ leading pharma manufacturers (`BM Pvt LTD`, `Paul Brooks`, `Dr. Willmar Schwabe`, `MEKTUM`, `BLOSSOM`, `Dr. Reckeweg`, `Kamal`, `Ashraf`, `HFP`, etc.).
* **Multi-Unit Packaging Breakdown:** Full hierarchy support (`Box` $\rightarrow$ `Strips/Packs` $\rightarrow$ `Single Tablets/Units`) with automatic unit price and margin calculations.
* **Reorder & Low Stock Alerts:** Real-time monitoring of items below minimum thresholds with 1-click filter toggles (`[Low Stock]` / `[Out of Stock]`).
* **Admin-Guarded Item Edit & Delete:** Secure catalog modification and permanent deletion protected by Admin Passcode authorization (`KB2026`).
* **Bulk CSV Import & Export:** Compatible with DrCreate and legacy MS Access spreadsheets.

### 4. 🏢 Multi-Warehouse & Central Godown Distribution (`/warehouse`)
* **Multi-Location Inventory Scoping:** Distinct isolation between **Medical Store Counter (`wh_str`)**, **Main Central Godown (`wh_001`)**, and custom secondary godowns.
* **Staff Warehouse Scoping:** Godown incharge staff (e.g. Raza, Usama) are restricted exclusively to their assigned facility stock.
* **Two-Way Stock Transfers:** Instant replenishment workflows from Godown to Store Counter with audit transfer logs.
* **Wholesale B2B Invoicing:** Wholesale invoice generation with Bilty / Transport tracking, freight charges, and Party Udhaar credit ledgers.

### 5. 🚚 Inward Purchases & Supplier Ledgers (`/purchases`)
* **Company Purchase Bill (GRN) Form:** Rapid voucher entry matching MS Access layout with automatic stock addition to Godown.
* **Bidirectional Supplier Code Auto-Fill:** Typing supplier codes or company names instantly populates credit balances, contact persons, and supplier accounts.
* **Supplier Payable Ledgers:** Real-time tracking of supplier balances with payment recording and invoice reversal guards.

### 6. 📖 DrCreate 4-Level Stock Ledger & Blind Audit
* **4-Level Hierarchical Inspection:** Category $\rightarrow$ SKU $\rightarrow$ Timeline Activity $\rightarrow$ Voucher Drill-down.
* **Zero-Pilferage Blind Physical Stock Audit:** Bias-free physical stock counts where shelf quantities are verified without showing system numbers upfront.

### 7. 📊 Financial Reports, Day Closing & 12:00 Z-Report (`/reports`)
* **Automated Day-End Closing:** Summary calculation of Total Patient Fees, Pharmacy Cash, Bank Collections, Expenses, and Net Balance.
* **Cash Drawer Reconciliation:** Real-time variance tracking between System Expected Cash and Actual Physical Drawer Cash.
* **One-Click WhatsApp Closing Report:** Formatted financial day-end summaries ready for direct sharing with clinic owners.

### 8. 🛡️ Super Admin Command Center & Licensing (`/admin`)
* **Godown Registry & Valuation Inspector:** Create, edit, and inspect godown locations and total inventory valuations.
* **Staff User Management:** Role-based staff account provisioning with credential hashing.
* **Software Licensing Engine:** Evaluates trial status, grace periods, and selective module feature kill-switches.

---

## ⌨️ Master Keyboard Shortcuts Cheatsheet

| Shortcut | Action | Scope |
|---|---|---|
| `Alt + 1` | Open Main Clinic Dashboard | Global |
| `Alt + 2` | Open Patient Registration | Global |
| `Alt + 3` | Open Today's Reception Queue | Global |
| `Alt + 4` | Open Medical Store POS Terminal | Global |
| `Alt + 5` | Open Doctor Consultation OPD Queue | Global |
| `Alt + 6` | Open Store Inventory Catalog | Global |
| `Alt + 7` | Open Sales Log & Returns | Global |
| `Alt + 8` | Open Inward Purchases & GRN Bills | Global |
| `Alt + 9` | Open Godown & Wholesale Distribution | Global |
| `Alt + 0` | Open Patients & EMR Directory | Global |
| `F12` / `Shift + ?` | Toggle Master Shortcuts Cheatsheet Modal | Global |
| `Escape` | Dismiss any open modal, drawer, or dialog | Global |
| `F1` / `Alt + S` | Focus Medicine Search Bar | POS Terminal |
| `F2` / `F9` / `Ctrl + Enter` | Fast Checkout & Print Bill | POS Terminal |
| `F3` | Toggle Brand / Company Filter Mode | POS Terminal |
| `F4` | Toggle Walk-In vs Linked OPD Prescription | POS Terminal |
| `F6` | Toggle Payment Mode (Cash vs Credit / Udhaar) | POS Terminal |
| `F7` | Focus Bill Discount (Rs) | POS Terminal |
| `F8` | Focus Tendered Cash Given | POS Terminal |
| `F10` | Instant Reprint Last Printed Bill | POS Terminal |
| `F11` / `Alt + C` | Clear Cart & Start Fresh Bill | POS Terminal |

---

## 🛠️ Tech Stack & Tooling

* **Frontend Framework:** React 19 SPA with React Router DOM (v7)
* **Build Tooling:** Vite 8.2.1 with High-Speed Rollup Chunker (<1s compilation)
* **Styling & Design System:** Tailwind CSS (v4) with custom Glassmorphism tokens & UI/UX Pro Max standards
* **Linting & AST Inspection:** Oxlint (Strict AST, 0 undeclared variables) & Custom Hook Scan Pipeline
* **Local Storage & Cache:** In-memory memoized `_ID_MAP_CACHE` + `_COLLECTION_CACHE` with O(1) retrieval
* **Offline PWA:** Service Worker with Tiered Cache & Network Fallback
* **Thermal Printing:** Native Canvas 80mm ESC/POS Rasterizer & Thermal Slip Engine
* **Cloud Sync Gateway:** REST API on Hostinger VPS (Ubuntu 24.04 LTS, Nginx, Node.js daemon, MySQL 8)

---

## 🚀 Getting Started

### Prerequisites
* **Node.js:** `v18.0.0` or higher
* **npm:** `v9.0.0` or higher

### Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/krishbaresha/clinicore.git
   cd clinicore
   ```

2. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Start local development server:**
   ```bash
   npm run dev
   ```
   *The application will launch at `http://localhost:5173` with automatic `/api` proxying to the cloud sync gateway.*

---

## 🧪 Verification & Automated Testing Pipeline

ClinicFlow enforces a **Mandatory Pre-Push Validation Pipeline** to guarantee zero-regression, zero-guess code preservation:

```bash
# 1. Run Strict AST Identifier Linter
npx oxlint --quiet

# 2. Run AST React Hook & Router Symbol Validator
node scripts/scan_imports_and_hooks.mjs

# 3. Execute Full 32-Suite Test Battery (308 Tests)
npm test

# 4. Compile Clean Production Build
npm run build
```

### Current Test Suite Status
```text
======================================================
📊 TEST SUITE EXECUTION SUMMARY
======================================================
Total Test Suites : 32 Suites
Total Tests Run   : 308 Tests
Tests Passed      : 308 ✅ (100% Success Rate)
Tests Failed      : 0 🎉
Compilation Time  : 986 ms (Clean Exit Code 0)
======================================================
```

---

## 📄 Project Documentation Index

Full architectural specifications and business domain documents are maintained under the [`/context`](file:///e:/Soft/DrCreate/ClinicFlow/context/) directory:

* [`00_README_Index.md`](file:///e:/Soft/DrCreate/ClinicFlow/context/00_README_Index.md) — Documentation Sitemap & Index
* [`01_PRD.md`](file:///e:/Soft/DrCreate/ClinicFlow/context/01_PRD.md) — Product Requirements Document
* [`03_TRD_Architecture.md`](file:///e:/Soft/DrCreate/ClinicFlow/context/03_TRD_Architecture.md) — Technical Architecture & Database Specs
* [`04_Screens_and_Sitemap.md`](file:///e:/Soft/DrCreate/ClinicFlow/context/04_Screens_and_Sitemap.md) — Screen Blueprints & Route Registry
* [`09_Progress_Log.md`](file:///e:/Soft/DrCreate/ClinicFlow/context/09_Progress_Log.md) — Milestones Log (Milestones 1–53)
* [`12_Desktop_Offline_First_Sync_Architecture.md`](file:///e:/Soft/DrCreate/ClinicFlow/context/12_Desktop_Offline_First_Sync_Architecture.md) — SQLite & Offline Sync Specs
* [`15_ClinicFlow_Complete_User_Manual_Hinglish.md`](file:///e:/Soft/DrCreate/ClinicFlow/context/15_ClinicFlow_Complete_User_Manual_Hinglish.md) — Master User Manual

---

## 🔒 Security & Data Privacy

* **Sanitization:** All printable and export templates use strict `escapeHtml()` sanitization against XSS.
* **Financial Arithmetic:** All calculations use `Number.isFinite()` and `Math.max(0, ...)` bounds to prevent `NaN` or negative drift.
* **Session Authorization:** Authenticated against cryptographically hashed digests with automatic expired session purges.

---

<div align="center">
  <sub>Built with ❤️ for <strong>Dr. Muhammad Asif Ashraf Khan Clinic & Wholesale Medical Store</strong></sub><br/>
  <sub>Powered by <strong>CliniCore Hybrid V2.5</strong> • Hyderabad & Interior Sindh</sub>
</div>
