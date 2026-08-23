# ClinicFlow — Screens, Sitemap & Shared Design System

> **Note for AI tools (Stitch / Antigravity):** This is the single source of truth for page names, navigation structure, and design tokens. Every screen generated — whether by Stitch or hand-coded in Antigravity — must use these exact page names and this exact design system so the final app feels like ONE product, not stitched-together mismatched screens.

---

## 1. Global Design System (use on every screen)

- **Product name:** ClinicFlow (always shown in top-left of sidebar/navbar with a simple medical-cross or pulse-line icon)
- **Color palette:**
  - Primary: Teal / Medical Blue (`#0F766E` or similar deep teal)
  - Accent: Soft cyan/mint for highlights and success states
  - Background: Very light gray/off-white (`#F8FAFC`), with glassmorphism cards (semi-transparent white, subtle blur, soft shadow)
  - Alert/low-stock: Amber/orange
  - Error: Soft red
- **Typography:** Clean modern sans-serif (Inter, Poppins, or similar). Headings semi-bold, body regular.
- **Layout style:** Bento-grid dashboard cards on the Dashboard screen; clean table/list views elsewhere; rounded corners (`rounded-2xl`), soft shadows, generous whitespace.
- **Navigation:** Persistent left sidebar (desktop) / bottom nav or hamburger (mobile). Nav items are **role-based** — each role sees only their relevant items, in this order:
  - **Receptionist:** Dashboard, Register Patient, Today's Queue, Pending Reports, Patients, Fees & Reports, Settings
  - **Doctor:** Dashboard, My Queue, Patients, Fees & Reports, Settings
  - **Pharmacist:** Medical Store POS, Inventory, Settings (no access to Dashboard, Patients, or Fees — pharmacist never sees medical/financial-consultation data)

## 2. Full Sitemap (Current WebApp Routes)

```text
/login                        → Staff Login (Secure Credentials & Protected Access)
/dashboard                    → Executive Clinic & Pharmacy Dashboard
/reception/register           → Patient Registration & OPD Token Generation
/reception/queue               → Today's Live Reception Queue & Token Manager
/reception/pending-reports     → Pending Report Uploads (Counter)
/doctor/queue                  → Doctor's Live Queue (Multi-Doctor Isolated)
/doctor/consultation/:visitId  → Consultation Screen (Camera Capture & Compression)
/patients                      → Patients Directory & Khata Balances
/patients/:id                  → Patient Profile (Timeline, Khata, Instant Token & Closing Time Photo Upload)
/fees                          → Fees & Financial Reports (Day-End Z-Report & Denominations)
/store/inventory             → Medical Store Inventory Catalog, Stock Ledger, Multi-Unit Ratios, Bulk CSV Upload
/store/pos                   → Medical Store POS (Retail & Prescription-Linked Sales, Receipts)
/store/sales (or /store/sales-log) → Store Sales Log, Receipts & Returns/Exchanges
/store/warehouse (or /warehouse)   → Godown Warehouse Management (Stock, Transfers, B2B, Ledger)
/purchases                     → Supplier Purchases & Inward Goods (GRN, Invoices, Ledger)
/public/queue, /live, /display → [DISABLED by user preference] Public Waiting TV Token Display
/clinic, /dr-asif              → [DISABLED by user preference] Patient Mobile Live Turn Tracker
/settings                      → Clinic Settings, Staff Accounts, Doctor Roster, Backup/Restore
/developer (or /super-admin)   → Developer Multi-Tenant Master Admin Panel
```

### Module Breakdown:

1. **Reception / Counter (`/reception/register`, `/reception/queue`, `/reception/pending-reports`):**
   - Multi-field search (Name, Relation Name, Phone) with keyboard navigation.
   - Pre-filled search query for brand-new patient registration.
   - Multi-doctor dropdown with doctor-specific fee auto-fill.
   - 80mm OPD Token generation and auto-print.
   - Live queue status monitor (Waiting, In Room, Done, Skipped, Re-issued).
   - Late patient re-issuance to end of queue (`Rs. 0` waiver tracking).
   - Deferred report photo upload counter.
   - **🆕 Live Dues Alert:** When searching an existing patient, their outstanding Udhaar balance shows prominently on the search card and selected patient banner with a 1-click "Collect / Settle Dues" modal (80mm thermal payment receipt).

2. **Doctor Terminal (`/doctor/queue`, `/doctor/consultation/:visitId`):**
   - **Isolated Queue per Doctor:** Doctor 1 (H/Dr. Muhammad Kashif Khan) and Doctor 2 (Dr. Asif Ashraf) see strictly their own assigned OPD consultation patients in `/doctor/queue` and on their dashboard stats.
   - Photo-first consultation capture with client-side canvas compression (1280px, ~120KB).
   - Two-stage completion: "Complete Visit" or "Complete & Forward Reports to Reception".
   - **🆕 Doctor Switcher Toggle:** Top-bar switcher on doctor terminals allowing doctors sharing a device to toggle their active terminal in one click without full logout.
   - **🆕 1-Click Queue Handover (at Reception):** Receptionist or Admin can transfer all pending tokens from one doctor to another when a doctor leaves early or is absent, with audit note.

3. **Patient Management & Profile (`/patients`, `/patients/:id`):**
   - Complete visit timeline across all years with thumbnail previews.
   - Medical HD Lightbox (50%-350% optical zoom, 90° rotation, drag-pan, print).
   - **Direct Report & Prescription Attachment:** Allows clinic staff to upload / replace prescription photos and multiple lab/X-ray report photos directly onto any past visit timeline with instant canvas compression and live persistence.
   - Instant in-profile OPD Token issuance modal (`+ New Visit & Token`).
   - Patient Khata Udhaar tracking and payment collection.
   - **Visit-Linked Pharmacy Receipts:** Displays any medicines dispensed and POS sales receipts linked to each specific OPD visit, with item breakdown, paid/udhaar status, and 80mm thermal receipt viewer & reprint.

4. **Medical Store POS & Sales Log (`/store/pos`, `/store/sales-log`):**
   - Standalone walk-in sales + prescription-linked sales with side-by-side Rx viewer.
   - Multi-unit packaging selection (Box, Strip, Unit/Tablet/Bottle).
   - Cash, Card, Bank, and Patient Khata Udhaar checkout.
   - Instant 80mm Thermal Receipt generation via iframe stream.
   - Returns, exchanges, and refund processing.
   - **🆕 Dual-Mode Medicine Search:**
     - **Mode A — Company-Filtered Mode:** Enter company code (e.g. `BM`, `PB`, `SCH`, `MKT`, `BLS`) or select company from dropdown in Field 1. Field 2 then shows ONLY medicines of that company — no cross-brand confusion possible. `Ctrl+M` or `F3` toggles mode.
     - **Mode B — Global Search Mode:** Omni-search across all brands. Results show prominent color-coded Company Brand Badges (e.g. `[BM Pvt LTD]`, `[Paul Brooks]`, `[Schwabe]`, `[MEKTUM]`, `[BLOSSOM]`) next to medicine names so identical names across brands are clearly differentiated.

5. **Godown & Wholesale Supply (`/warehouse`):**
   - Tab 1: **🆕 Godown / Warehouses Master:** CRUD for multiple godowns (name, location, incharge, code). View per-godown valuation & stock levels.
   - Tab 2: **🆕 Multi-Godown Stock Matrix:** Per-item stock breakdown across all godowns and store counter (`Godown 1`, `Godown 2`, `Store Counter`, `Total`).
   - Tab 3: **🆕 Enhanced Internal Transfers:** Dynamic `From Location` and `To Location` dropdowns supporting Godown-to-Godown and Godown-to-Store transfers (not just warehouse ↔ store).
   - Tab 4: B2B Wholesale Supply (Interior Sindh Party billing with Bilty #, Transport, Salesman, and Invoice Print).
     - **Party Code Auto-Fill:** Entering or selecting Party Code (e.g. `001`, `PTY-108`) instantly auto-populates Party Name, City, Phone, Address, Salesman, and displays real-time Outstanding Udhaar & Credit Limit.
     - **🆕 Dual-Mode Company/Brand Medicine Search (same as POS):** Company-Filtered Mode (company code/dropdown + filtered medicines) or Global Search Mode (all medicines with brand badges).
     - **🆕 Source Godown Selector:** Specify which godown to dispatch stock from in B2B billing; stock deduction is applied to the selected source godown.
     - **Payment Modes:** `Party Udhaar (Credit)`, `Full Cash In Hand`, and `Cheque / Bank Transfer` (with Cheque #, Bank Name, Clearance Date, and Amount fields).
     - **Overall Bill-Level Discounts:** Supports applying overall flat Rs. discount and overall percentage (%) discount on the entire invoice subtotal in addition to line item discounts.
   - Tab 5: Party Ledger Master with Custom Party Codes (`1044`, `PTY-108`) and balance recovery.

6. **Supplier Purchases (`/store/purchases`):**
   - Inward Goods Received Notes (GRN) with supplier balances, item lines, batch numbers, and thermal purchase invoice print.
   - **Dynamic Company & Manufacturer-Specific Medicine Filtering:**
     - Selecting an Account / Supplier (e.g. `BM Pvt LTD`, `Paul Brooks`, `Schwabe`, `MEKTUM`, `BLOSSOM`, `Eagle Homoeo & Harbal Pharma`, etc.) automatically isolates and filters the medicine options in both **`Purchase GRN _Form` (Tab 1)** and **`Receive New Stock Entry` (Tab 4)**.
     - Only medicines belonging to the selected manufacturing brand are shown in the product combobox / dropdown, preventing cross-brand confusion and ensuring correct SKU rate and company tagging.
     - Provides clear visual indicators (`Showing X items for [Company Name]`) and optional `[Show All Brands]` override.
   - **🆕 Two-Way Supplier Ledger:**
   - **🆕 DrCreate & MS Access Account Registration Form (`ACCOUNT REGISTRATION _FORM`):**
     - Single-screen master registration for Wholesale Parties, Medicine Suppliers, Salesmen, and Financial Heads.
     - Auto sequential `Account No` assignment (`#1, #2, ..., #263, #270...`).
     - Fast <kbd>Enter</kbd> submit with auto-focus looping for rapid bulk data entry.
     - Selection & Edit Mode: Click any account from the Chart of Accounts list to load into the form and update records across `dbAccounts`, `dbParties`, and `dbSuppliers`.
   - **🆕 Chart Of Accounts Modal (`Chart Of Accounts _List`):**
     - Full ledger directory with live search and filter by `Account Type` / Sindh Territory route.
     - 80mm ESC/POS thermal printing (`printChartOfAccountsReceipt`).
     - 1-Click CSV / Excel Export.
     - 1-Click Direct Import of all 262 legacy accounts from `AshrafKhan.accdb`.
   - **🆕 DrCreate & MS Access Purchase GRN Form (`Purchase GRN _Form`):**
       - Header banner matching DrCreate with Voucher No auto sequencing (`P-1001, P-1002, ..., P-1382`).
       - Basic Info: Date, Voucher No, GRN No (Challan #), Dynamic Reference (rep/order booker with `[+ New]` custom add & persistent storage), Account Name (searchable pharma suppliers/distributors), Naration, Payment Mode (`Cash` / `Credit`), Dynamic Transport Carrier (with `[+ New Carrier]` custom add & persistent storage), Bilty #, and Destination (`warehouse` / `store`).
       - Cart Detail (Rapid Entry Bar): Dynamic company-filtered Product Code & Name, Qty, Rate, Gross, Disc %, Disc 0, Net Amount with auto calculation and <kbd>Enter</kbd> submit auto-focus loop.
       - Itemized Grid Table with fixed sticky headers, max-height container, and smooth auto-scrolling to newly added products.
       - **`Purchase GRN _List` Modal (`Show List`):** View all historical GRNs with search, filter, 80mm ESC/POS thermal printing (`printPurchaseGRNReceipt`), and CSV / Excel export.
   - **🆕 DrCreate & MS Access Sale Invoice Form (`SALE INVOICE _Form` & `SALE INVOICE _List`):**
       - Header banner matching DrCreate with Voucher No auto sequencing (`S-1001, ..., S-6218, S-6219...`).
       - Basic Info: Date, Voucher No, GRN No, Reference (Rep/Booker `ExpandableCombobox` with `[+ New]`), Account Name (`ExpandableCombobox` with 260+ wholesale customers/parties auto-populating Phone/Naration and City/Type), Naration, Type (City), Payment Mode (`Cash` / `Credit` toggle), Company Filter (`BM Pvt LTD`, `Paul Brooks`, etc.), Transport (`[+ New Carrier]`), and Bilty #.
       - Cart Detail (Fast Keyboard Entry & Auto Rate Bar): Product Code auto-lookup (typing `BM-01`, `001`, `BIO-21` auto-loads Medicine Name, Sale Rate, default 40% discount, and focuses Qty), Product Name `ExpandableCombobox`, Qty, Rate, Gross, Disc %, Disc 0, Net Amount with live arithmetic and <kbd>Enter</kbd> submit looping.
       - Itemized Grid Table with fixed sticky headers and auto-scrolling.
       - **`SALE INVOICE _List` Modal (`Show List`):** Historical sale invoices logbook with live search, Credit/Cash filter, 1-click 80mm ESC/POS thermal printing (`printSaleInvoiceReceipt`), and CSV / Excel export (`dbSales.exportCSV`).
   - **🆕 DrCreate 4-Level Interactive Stock Ledger (`Stock Ledger _List` & `Item Date History`):**
     - **Level 1 (`Catogery Summery`):** Grouped summary by Company/Brand Prefix (`BM`, `BL`, `BHP`, `AK`, etc.) with total quantity aggregation.
     - **Level 2 (`SKU Summery`):** List of all medicines (SKUs) under the selected brand with live stock quantities.
     - **Level 3 (`Transactional Ledger`):** Daily chronological movement timeline (`Date`, `Total In`, `Total Out`, `Net Balance`).
     - **Level 4 (`Item Date History` Modal):** Deepest voucher breakdown showing exact Purchase GRNs (`P-1`) and Sale Invoices (`S-3964`), rates, line discounts (`Disc%`, `Disc0`), gross, and net amounts.
     - 80mm ESC/POS thermal print slip (`printStockLedgerReceipt`) & 1-Click CSV Export.
     - Integrated into both `MedicalStoreInventory` and `WarehouseManagement`.

7. **Finance, CashBook & Day-End Cashier Closing (`/fees`):**
   - **Streamlined 3-Tab Architecture (Zero-Clutter & Error-Free):**
     - **Tab 1: 💵 Daily Cash Register & Z-Report (`zreport`):**
       - Date selector with configurable **Opening Cash Float (صبح کا ابتدائی کیش)** to avoid false-negative drawer deficits.
       - Real-time Bento summaries: `(+) Inflows` (OPD Fees + POS Pharmacy + Wholesale Cash + CashBook Receipts), `(-) Outflows` (Daily Expenses + Supplier Cash + Returns Refunds + CashBook Payments), and `(=) Net Cash Drawer in Hand` ($\text{Opening} + \text{Inflows} - \text{Outflows}$).
       - Physical denomination cash count (`Rs. 5000, 1000, 500, 100, 50, 20, 10`) with live variance audit (Balanced, Surplus, Shortage).
       - 1-Click 80mm ESC/POS Thermal Z-Report printing & WhatsApp summary share.
       - Saved Shift Closings log with instant reprint and permanent deletion.
     - **Tab 2: 📖 CashBook & Expense Journal (`cashbook`):**
       - Embedded inline double-entry voucher form (Date, Auto-increment Voucher `C-5160`, Term toggle: `Receive` vs `Paid`, Searchable Account Select with party Udhaar balance, Amount, Narration presets, 80mm slip auto-print).
       - Side-by-side / unified Receipts (Debit) vs Payments (Credit) tables with instant Delete and Print buttons.
       - Daily summary (Total Debit, Total Credit, Day Net Balance) + CSV Export.
     - **Tab 3: 📈 OPD Consultation Trends (`opd_analytics`):**
       - Daily, Weekly, and Monthly doctor fee collections and patient visit bar charts with doctor isolation filtering.
     - Interactive controls: `WhatsApp No` input + `Send WhatsApp` 1-click share, Date picker, Day of Week display, `Load` button, and `Print` 80mm slip button.

8. **Public & TV Displays (`/public/queue`, `/clinic`):**
   - Waiting room TV board with voice announcements and live turn ticker for patient smartphones.

9. **Clinic Settings & Governance (`/settings`):**
   - Clinic identity, default consultation fee, and branding setup.
   - Staff accounts & Role-Based Access Control (RBAC).
   - **Principal Doctor Transfer:** Current Principal Owner Doctor (`is_owner: true`) can delegate or transfer Principal Doctor ownership status to another Doctor in the clinic with double confirmation and instant permission refresh.

10. **Super Admin Master Command & Audit Center (`/admin`):**
   - **Access Scope:** Strictly accessible ONLY from the public Landing Page (`/`) footer/header or direct protected URL. Removed from all internal clinic portals (Doctor Chamber, Reception, Store POS, Inventory, etc.) and Login Screen.
   - **Dual-Key Isolation & Step-Up Security Engine:**
     - **Key 1 (Master Super Admin Login Passcode):** Controls portal entry to `/admin` with custom update and storage (`cf_admin_master_passcode`).
     - **Key 2 (Sub-Tab Delegation Security PIN):** Independent secret PIN (`cf_admin_tab_pin`) allowing clinic owners to lock/hide sensitive sub-tabs (Licensing, APIs, Backups) before delegating the screen to staff.
     - **Step-Up Authentication Modal:** "Tab Security" management tool is strictly protected behind Master PIN challenge verification to prevent unauthorized rule changes or password exposure.
   - **Tab 1: 📊 Executive Multi-Godown & Clinic Audits:**
     - Time-period filters: `Last 6 Months (حالیہ چھ ماہ)`, `1-Year Annual Audit (سالانہ آڈٹ)`, `Last 30 Days`, `All Time`, or `Custom Date Range`.
     - Multi-Godown isolation: `All Godowns (Combined)` or individual (`Central Godown`, `Sub Godown 2`, `Store Counter`).
     - Full valuation, profit/loss breakdown, supplier outflows, retail inflows, B2B wholesale recoveries, Excel `.xls` export, and 80mm low-ink audit print.
   - **Tab 2: 👥 Staff & Doctor Master Access (Password Reset & Management):**
     - Add new Doctors and Staff.
     - Edit / Deactivate / Delete accounts.
     - **Direct Password Reset:** Super admin can reset passwords for ANY doctor or staff member without needing their old password.
   - **Tab 3: 🏥 Clinic Identity & Urdu Localization:** Direct master editing of clinic metadata and CMS hero copy.
   - **Tab 4: ⚡ Automated Background Services & API Keys:**
     - Resend Email API Key configuration for automated dispatch of end-of-day and periodic financial reports.
     - WhatsApp Gateway settings and automated schedule trigger.
   - **Tab 5: 🏢 Multi-Tenant SaaS Master Management:** Provision and switch between client clinics.
   - **Tab 6: 💾 System Backup & Restore Engine:** Encrypted `.cfbak` / JSON snapshot backup, restore rollback, clean production setup (0 transactions), and database integrity tools.

### Medical Store — Inventory
- Table: medicine name, stock qty, unit price, status (In Stock / Low Stock badge).
- "Add Medicine" button.

### Clinic Settings
- Clinic name, logo upload, address — used on printable receipts.
- User management (add receptionist/doctor/pharmacist accounts).

## 4. Consistency Rules for AI Tools

1. Every screen shares the same sidebar navigation, in the same order, with the same icons.
2. Every button that performs the same action (e.g. "Save") uses the same label and same color across screens — don't vary "Save" vs "Submit" vs "Confirm" for the same action type.
3. Every data table (Patients, Inventory, Sales) uses the same table style/component.
4. Card components (Dashboard stat cards, Patient Profile cards) share the same glassmorphism style defined in Section 1.
5. Use the same field names across screens and docs: "Fee" (not "Charges" or "Bill"), "Visit" (not "Appointment" or "Consultation"), "Medicine" (not "Drug" or "Item").
