# CliniCore — Production Modules & Specifications

> **System Phase:** Production Release (v5.0) — All core modules, desktop sync engines, and cashbooks are fully built, tested (140/140 tests passing), and deployed to the Hostinger VPS.

---

## 1. Active Modules Overview

### 🩺 OPD Consultation & Token Queue
- **Live Doctor Queue:** Walk-ins are assigned a sequential token number.
- **Consultation Entry:** Vitals (BP, Pulse, Temp), clinical notes, and brand-specific remedies.
- **Doctor Queue Isolation:** Ensures privacy between chambers (e.g. Doctor 1 vs Doctor 2).
- **Printable OPD Token:** 80mm ESC/POS thermal tokens.

### 💊 Counter POS (Pharmacy & Retail Store)
- **Direct Sale Checkout:** Real-time stock checking, automatic unit pricing, and overall discounts.
- **B2B Wholesale Mode:** Custom party accounts, credit balance tracking, and ledger postings.
- **Void Invoice Authorization:** void-sale audits require manager approval with secure PIN.

### 📦 4-Level Stock Ledger & Logistics
- **Purchase GRN (Goods Received Note):** Tracks supplier invoice numbers, carrier details, and logistics billing.
- **Stock Movement Ledger:** Reconciles SKU counts across Godowns, Warehouses, Counter, and In-Transit.

### 📊 CashBook & Z-Reports
- **Double-Entry Cashbook Ledger:** Chronological debit/credit postings.
- **Automated Z-Report (Day Closing):** Aggregates daily inflows, outflows, variance logs, and dispatches Z-Reports to WhatsApp.

### 🔒 Granular Access & Tab Security
- **Super Admin Portal:** Access locked via Master Passcode (`KB2026`).
- **Tab Locks:** Restricts sensitive developer panels, database backups, and software licensing.
