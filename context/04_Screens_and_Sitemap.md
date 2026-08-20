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
/login                        → Staff Login & 1-Click Terminal Switcher
/dashboard                    → Executive Clinic & Pharmacy Dashboard
/reception/register           → Patient Registration & OPD Token Generation
/reception/queue               → Today's Live Reception Queue & Token Manager
/reception/pending-reports     → Pending Report Uploads (Counter)
/doctor/queue                  → Doctor's Live Queue (Multi-Doctor Isolated)
/doctor/consultation/:visitId  → Consultation Screen (Camera Capture & Compression)
/patients                      → Patients Directory & Khata Balances
/patients/:id                  → Patient Profile (Timeline, Khata, Instant Token & Closing Time Photo Upload)
/fees                          → Fees & Financial Reports (Day-End Z-Report & Denominations)
/store/pos                     → Medical Store POS (Cart, Walk-in / Linked Rx, Discounts, Udhaar)
/store                         → Medical Store Inventory (Multi-Unit Stock & Re-order Alerts)
/store/sales (or /store/sales-log) → Store Sales Log, Receipts & Returns/Exchanges
/store/warehouse (or /warehouse)   → Godown Warehouse Management (Stock, B2B Supply, Transfers, Party Ledgers)
/store/purchases (or /purchases)   → Supplier Purchases & Inward Goods (GRN, Invoices, Ledger)
/public/queue (or /live)       → Public Waiting Area TV Token Display
/clinic (or /dr-asif)          → Patient Mobile Live Turn Tracker
/settings                      → Clinic Settings, Staff Accounts, Backup/Restore
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

2. **Doctor Terminal (`/doctor/queue`, `/doctor/consultation/:visitId`):**
   - **Isolated Queue per Doctor:** Doctor 1 (H/Dr. Muhammad Kashif Khan) and Doctor 2 (Dr. Asif Ashraf) see strictly their own assigned OPD consultation patients in `/doctor/queue` and on their dashboard stats.
   - Photo-first consultation capture with client-side canvas compression (1280px, ~120KB).
   - Two-stage completion: "Complete Visit" or "Complete & Forward Reports to Reception".

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

5. **Godown & Wholesale Supply (`/warehouse`):**
   - Tab 1: Godown Master Stock & Low-Stock Alerts.
   - Tab 2: Internal Stock Transfers (Godown ⇄ Store Counter).
   - Tab 3: B2B Wholesale Supply (Interior Sindh Party billing with Bilty #, Transport, Salesman, and Invoice Print).
     - **Party Code Auto-Fill:** Entering or selecting Party Code (e.g. `001`, `PTY-108`) instantly auto-populates Party Name, City, Phone, Address, Salesman, and displays real-time Outstanding Udhaar & Credit Limit.
     - **Company / Brand Medicine Filter:** Allows selecting manufacturing company (e.g. `BM Pvt LTD`, `Paul Brooks`, `Schwabe`, `MEKTUM`, `BLOSSOM`); medicine selection strictly isolates items from the chosen company to eliminate confusion when same medicine names exist across different brands.
     - **Payment Modes:** `Party Udhaar (Credit)`, `Full Cash In Hand`, and `Cheque / Bank Transfer` (with Cheque #, Bank Name, Clearance Date, and Amount fields).
     - **Overall Bill-Level Discounts:** Supports applying overall flat Rs. discount and overall percentage (%) discount on the entire invoice subtotal in addition to line item discounts.
   - Tab 4: Party Ledger Master with Custom Party Codes (`1044`, `PTY-108`) and balance recovery.

6. **Supplier Purchases (`/purchases`):**
   - Inward Goods Received Notes (GRN) with supplier balances, item lines, batch numbers, and thermal purchase invoice print.
   - **Company / Supplier-Specific Medicine Filter:** Selecting a supplier automatically filters godown medicines to only show products from that specific manufacturer/supplier.

7. **Finance & Day-End Cashier Closing (`/fees`):**
   - Daily shift closings with physical denomination cash count (`Rs. 5000, 1000, 500, 100, 50, 20, 10`).
   - Automated cash drawer variance calculation (Balanced, Surplus, Shortage).
   - 80mm Daily Z-Report Roznamcha Thermal Print.

8. **Public & TV Displays (`/public/queue`, `/clinic`):**
   - Waiting room TV board with voice announcements and live turn ticker for patient smartphones.

9. **Clinic Settings & Governance (`/settings`):**
   - Clinic identity, default consultation fee, and branding setup.
   - Staff accounts & Role-Based Access Control (RBAC).
   - **Principal Doctor Transfer:** Current Principal Owner Doctor (`is_owner: true`) can delegate or transfer Principal Doctor ownership status to another Doctor in the clinic with double confirmation and instant permission refresh.

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
