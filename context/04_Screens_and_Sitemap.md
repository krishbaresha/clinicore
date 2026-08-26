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

