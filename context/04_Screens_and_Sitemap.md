# CliniCore — Screens & Sitemap

---

## 1. Global Sitemap & Routes

| Route | Screen Name | Access Level | Description |
|---|---|---|---|
| `/login` | Staff Login | Public / Staff | Bootstrap login using Email + Password. |
| `/dashboard` | Executive Dashboard | Doctor / Admin | Bento-grid showing today's statistics, collections, and queues. |
| `/reception/register` | Patient Registration | Receptionist / Admin | Register new patients with automatic sequential MR Card Numbers. |
| `/reception/queue` | Reception Queue | Receptionist / Admin | Live patient token queue manager, turn switcher, and late waiver settings. |
| `/doctor/queue` | Doctor Queue | Doctor Only | Chamber isolated patient waiting queues. |
| `/doctor/consultation/:id` | Doctor Consultation | Doctor Only | Vitals logs, prescription builder, follow-up scheduler, and camera capture. |
| `/patients` | Patients Directory | All Staff | Omni-search directory showing outstanding patient dues (Udhaar). |
| `/patients/:id` | Patient Profile | All Staff | Interactive timeline of all past visits, HD Lightbox, and pharmacy receipts. |
| `/fees` | Financial Register | Admin / Accountant | Three-Tab Register: Daily Cash Drawer Z-Report, Expense Journal CashBook, and Analytics. |
| `/store/pos` | Counter POS | Pharmacist / Admin | Retail sales screen, B2B wholesale invoicing, overall discounts, and party codes. |
| `/store/inventory` | Inventory & Ledger | Pharmacist / Admin | Item catalog, multi-unit ratios, bulk import, and 4-Level Stock Ledger. |
| `/store/sales-log` | Store Sales Log | Pharmacist / Admin | History of sales invoices, return processing, and receipt reprints. |
| `/warehouse` | Godown & Logistics | Warehouse Incharge | Internal stock transfers, B2B party accounts, and Godown matrices. |
| `/purchases` | Supplier Purchases | Warehouse / Admin | Supplier ledger, GRN (Goods Received Notes) logs, and Account registration. |
| `/receipt-studio` | Thermal Receipt Studio | Super Admin Only | Customize receipt headers, logos, and print templates. |
| `/admin` | Master Control Panel | Super Admin Only | Strict Master Passcode protected panel for backups, staff audits, and configs. |

---

## 2. Dynamic Tab Security & Step-Up PIN Engine

### Dual-Key Access Model:
1. **Master Passcode (`cf_admin_master_passcode`):** Protects access to the main `/admin` route.
2. **Sub-Tab PIN (`cf_admin_tab_pin`):** Protects specific sub-tabs (Licensing, Background Services, Backups) inside the control panel.
3. **Step-Up Verification:** Accessing locked sub-tabs triggers a prompt for the Sub-Tab Security PIN, preventing staff members from altering security policies.

---

## 3. Screen Layout & Bento Design System
- **Colors:** Deep Teal (`#0F766E`) primary accents, Mint Emerald success highlights, Charcoal slate text, and Soft glassmorphic containers.
- **Doctor Switcher:** Quick-access profile switcher in the top bar allows doctors to swap active chambers without a full system logout.

---

## 4. Pure Keyboard-Driven POS Control Deck & 2D Grid Navigation

- **Master Hotkey Suite:**
  - `F1` / `Alt + S`: Focus Medicine Search Bar
  - `F2` / `Ctrl + Enter`: Complete Sale & Instant 80mm Print
  - `F3`: Toggle Company Brand Filter vs Global Search
  - `F4`: Link Today's OPD Doctor Prescription
  - `F6`: Toggle Cash vs Credit / Udhaar
  - `F7`: Focus Additional Bill Discount (Rs.)
  - `F8`: Focus Cash Given / Tendered
  - `F10`: Instant Reprint Last Receipt
  - `F11` / `Alt + C`: Clear Cart & Start New Bill
  - `Escape`: Close Modals / Clear Search
- **2D Arrow-Key Grid Navigation:**
  - `ArrowDown` / `ArrowUp`: Seamless vertical jump across Search ⇄ Cart Items (Quantity / Discount) ⇄ Overall Bill Discount ⇄ Cash Given ⇄ Checkout Button.
  - `ArrowRight` / `ArrowLeft`: Seamless horizontal jump between item Quantity and Discount % fields without touching the mouse.

---

## 5. Full Application Keyboard Navigation Engine (Milestone 37)

- **Global Navigation Hotkeys (Any Screen):**
  - `Alt + 1`: Executive Dashboard (`/dashboard`)
  - `Alt + 2`: Patient Registration (`/reception/register`)
  - `Alt + 3`: Reception Queue (`/reception/queue`)
  - `Alt + 4`: Doctor OPD Queue & Consultation (`/doctor/queue`)
  - `Alt + 5`: Counter POS (`/store/pos`)
  - `Alt + 6`: Store Inventory & Stock Ledger (`/store`)
  - `Alt + 7`: Sales Log & Returns (`/store/sales`)
  - `Alt + 8`: Company Purchases (GRN) (`/store/purchases`)
  - `Alt + 9`: Central Warehouse & Wholesale (`/store/warehouse`)
  - `Alt + 0`: Patients & EMR Directory (`/patients`)
  - `Alt + F`: Fees & CashBook (`/fees`)
  - `F12` or `Shift + ?`: Live Keyboard Shortcuts Cheatsheet Modal
  - `Escape`: Universal modal/drawer dismiss

- **Doctor Chamber & Consultation Hotkeys:**
  - `ArrowUp` / `ArrowDown`: Navigate waiting patient queue cards
  - `Enter`: Call highlighted patient into consultation room
  - `F1`: Focus Chief Complaints / History
  - `F2` or `Ctrl + Enter`: Save Consultation & Instant Print Prescription (80mm / A4)
  - `F3`: Add new prescription medicine row
  - `F4`: Focus Follow-up days
  - `F8`: Focus Lab Tests / Clinical Advice

- **Reception Desk & Registration Hotkeys:**
  - `F1`: Focus Patient Phone / CNIC / Name search bar
  - `Enter`: Tabular forward movement across registration form inputs
  - `F2` or `Ctrl + Enter`: Save Registration & Instant Print OPD Token Receipt
  - `F3`: Toggle between New Patient Registration and Search Mode

- **Warehouse & Supplier Purchases (GRN) Hotkeys:**
  - `F1`: Focus Supplier / Party search selector
  - `F2` or `Ctrl + Enter`: Save GRN / Sale Invoice & Instant Print Thermal Receipt
  - `F3`: Add new invoice item line
  - `F4`: Toggle Cash vs Credit / Udhaar
  - `2D Arrow Keys`: Cell-to-cell navigation (Item ⇄ Qty ⇄ Rate ⇄ Disc) in invoice tables


