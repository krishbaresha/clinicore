# CliniCore — Product Requirements Document (PRD)

> **Core System Name:** CliniCore (Web App + Desktop Hybrid Engine)
> **Active Principal Doctor / Owner:** Dr. Muhammad Asif Ashraf Khan (Hyderabad & Interior Sindh)

---

## 1. Vision & Core Promise
CliniCore is a high-performance, medical-grade hybrid software designed for clinics and wholesale/retail homeopathic medicine stores. It provides:
1. **Universal Real-time Synchronization:** Ensures data entered in any browser worldwide instantly syncs to the Hostinger VPS MySQL database.
2. **Offline-First Resilience:** In-memory client caching with background sync queue allows clinic and counter POS operations to continue even during internet outages.
3. **Medical Store & Wholesale POS:** Tracks retail sales, supplier GRNs, double-entry cashbooks, and a 4-level stock ledger.
4. **Isolated Doctor Queues:** Direct patient assignments with isolated queues per doctor chamber.

---

## 2. Target Users
* **Principal Doctor (Dr. Muhammad Asif Ashraf Khan):** Full system owner with master permissions to access financial reports, adjust licenses, and manage granular tab security.
* **Associate Doctors:** Manage their assigned patient queues and record consultation notes without seeing other chambers' collections.
* **Counter Sales Staff / Cashiers:** Process POS sales, manage counter-specific cash drawers, and void sales with manager authorization.
* **Warehouse / Godown Incharges:** Receive supplier purchases, track inventory transfers, and reconcile batch stock.

---

## 3. Product Scope & Core Modules

### 🩺 OPD Consultation & Token Queue
- **Isolated Queues:** Patients registered at reception are assigned to specific doctors. Doctors only see their assigned patients.
- **Consultation Cards:** Doctors log vitals, clinical symptoms, diagnoses, brand-specific homeopathic remedies, and follow-up dates.

### 💊 Counter POS & Pharmacy Sales
- **Wholesale Party Code Auto-Fill:** Typing/selecting a B2B Party Code instantly populates customer details and credit balances.
- **Brand Tags for Medicine Search:** Displays manufacturing company labels (`[BM Pvt LTD]`, `[Paul Brooks]`, etc.) to prevent brand selection confusion.
- **Overall Bill-level Discounts:** Supports percentage and flat trade discounts on POS checkouts.

### 📦 4-Level Stock Ledger & GRNs
- **GRN/Challan Tracking:** Reconciles supplier purchases, logistics billing, and carrier bilty numbers.
- **Stock Ledger Timeline:** Reconciles SKU status across 4 distinct levels: Counter, Warehouse, Godowns, and In-Transit.

### 💰 CashBook & Z-Reports
- **Double-Entry Ledger:** Tracks cash receipt inflows and payment outflows.
- **Automated Z-Reports:** Reconciles opening cash float, total daily inflows, and physical counts with automated WhatsApp/Email dispatch.
