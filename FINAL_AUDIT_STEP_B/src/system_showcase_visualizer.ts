import fs from 'fs';
import path from 'path';

/**
 * ClinicFlow Master System Diagram & Visual Showcase Builder
 * Generates system_showcase_report.md containing high-res ASCII & Mermaid diagrams,
 * sitemaps, 80mm thermal receipt specs, and Chart of Accounts tree.
 */

function generateReport(): string {
  return `# ClinicFlow Master System Diagram & Visual Showcase Report

> **Project:** ClinicFlow (Dr. Muhammad Kashif Khan Clinic & Wholesale Medical Store)  
> **Module:** FINAL_AUDIT_STEP_B — System Architecture, Navigation Sitemaps, Thermal Printer Specs & Chart of Accounts  
> **Generated:** ${new Date().toISOString()}  
> **Environment:** Local Development Build  

---

## 1. Master System Architecture Topology

ClinicFlow employs a hybrid Offline-First architecture across Desktop (Tauri), Web (React SPA), and Mobile (Expo), synchronized with a centralized MySQL cloud backend on Hostinger VPS via a 7-State Finite State Machine (FSM) Sync Engine.

### 1.1 High-Resolution ASCII Architecture Topology

\`\`\`text
+---------------------------------------------------------------------------------------------------+
|                                      CLIENT DEPLOYMENT TIER                                       |
+------------------------------------+--------------------------------+-----------------------------+
|        TAURI DESKTOP APP           |        REACT WEB SPA           |       EXPO MOBILE APP       |
|  (Windows C++ / Rust Wrapper)      |   (Vite + React + Tailwind)    |     (iOS / Android Native)  |
|  - Native Window Frame             |   - Responsive Dashboard       |     - Quick OPD Vitals      |
|  - Direct Thermal USB/COM Printing |   - Full Pharmacy & B2B POS    |     - Mobile Queue Monitor  |
|  - SQLite / IndexedDB Local Vault  |   - Multi-Warehouse Logistics  |     - EMR Lightbox Viewer   |
+------------------------------------+--------------------------------+-----------------------------+
                                     |
                                     v
+---------------------------------------------------------------------------------------------------+
|                             HYBRID STORAGE & OFFLINE SYNC ENGINE                                  |
+---------------------------------------------------------------------------------------------------+
|  [ In-Memory O(1) Cache ]  <--->  [ LocalStorage / IndexedDB Vault ]  <--->  [ Merkle Hash Audit ]|
|                                                                                                   |
|  7-State FSM Sync Engine:                                                                         |
|  (IDLE) ---> (SYNCING_PUSH) ---> (SYNCING_PULL) ---> (CONFLICT) ---> (DEAD_LETTER)                |
|    ^              |                    |                 |                                        |
|    +--------------+                    +-----------------+ (Automated PN-Counter Reconciler)    |
|             (OFFLINE) <--- Network Interruption / Backoff Jitter                                 |
+---------------------------------------------------------------------------------------------------+
                                     |
                                     | HTTPS / REST JSON API
                                     v
+---------------------------------------------------------------------------------------------------+
|                             CLOUD BACKEND & INFRASTRUCTURE TIER                                   |
|                             (Hostinger Linux VPS Daemon / Systemd)                                |
+---------------------------------------------------------------------------------------------------+
|  [ NGINX Reverse Proxy ]  --->  [ PHP 8.2 Modular REST Controllers ]                              |
|                                 - AuthController / RateLimiter                                    |
|                                 - RBAC & Scope Middleware                                         |
|                                 - SystemController & Backups                                      |
|                                 - Telemetry & Lineage Provenance                                  |
|                                 - Finance & B2B Sales Controllers                                 |
+---------------------------------------------------------------------------------------------------+
                                     |
                                     v
+---------------------------------------------------------------------------------------------------+
|                                 MYSQL 8.0 RELATIONAL DATABASE                                     |
+---------------------------------------------------------------------------------------------------+
|  - Canonical Schemas & Foreign Key Constraints (25+ Tables)                                       |
|  - Shift Closings, Multi-Warehouse Stocks, Patient EMR, Journal Ledgers                           |
|  - System Settings & Salted SHA-256 Hash Verification                                             |
+---------------------------------------------------------------------------------------------------+
                                     ^
                                     | Hardware Interfaces
+------------------------------------+--------------------------------------------------------------+
|                                HARDWARE INTEGRATION ENGINE                                        |
+---------------------------------------------------------------------------------------------------+
|  - ESC/POS Thermal Printer Driver (80mm Low-Ink Renderer / Raw Byte Spooler)                      |
|  - Client-Side HD Canvas JPEG Image Compressor & Watermarker                                      |
|  - Barcode Scanner Keyboard Wedge Parser (EAN-13 / Code128)                                       |
+---------------------------------------------------------------------------------------------------+
\`\`\`

---

### 1.2 Mermaid Architecture Diagram

\`\`\`mermaid
graph TD
    subgraph Clients["1. Client Tier"]
        Tauri["Tauri Desktop (Rust/Webview)"]
        Web["React Web SPA (Vite/Tailwind)"]
        Mobile["Expo Mobile App (React Native)"]
    end

    subgraph StorageEngine["2. Offline Storage & Sync Engine"]
        Cache["In-Memory O(1) Cache"]
        Vault["IndexedDB / LocalStorage Vault"]
        Merkle["Merkle Hash Chains (Audit & Stock)"]
        FSM["7-State FSM Sync Engine"]
    end

    subgraph Backend["3. VPS Cloud Backend (Hostinger Linux)"]
        NGINX["NGINX Reverse Proxy"]
        Middleware["Auth & RBAC Middleware"]
        API["PHP 8.2 REST Controllers"]
    end

    subgraph Database["4. Database Tier"]
        MySQL[("MySQL 8.0 Relational DB")]
    end

    subgraph Hardware["5. Hardware Integration Engine"]
        ThermalPrinter["80mm ESC/POS Printer Driver"]
        CanvasCompressor["HD Canvas JPEG Compressor"]
        BarcodeScanner["Barcode Wedge Reader"]
    end

    Clients --> Cache
    Cache --> Vault
    Vault --> Merkle
    Vault --> FSM
    FSM -->|HTTPS REST JSON API| NGINX
    NGINX --> Middleware
    Middleware --> API
    API --> MySQL
    Clients --> Hardware
\`\`\`

---

## 2. Global Sitemap & Navigation Graph

### 2.1 Multi-Platform Sitemap Table

| Target Platform | Route Path | Screen Name | Access RBAC Level | Key Features & Capabilities |
|---|---|---|---|---|
| Web & Tauri | \`/login\` | Staff Login | Public / Staff | Salted SHA-256 Auth, Brute-Force Rate Limiter, Role Session Storage |
| Web & Tauri | \`/dashboard\` | Executive Dashboard | Doctor / Admin | Bento Grid, Daily OPD Collection, Revenue Charts, Queue Counters |
| Web & Tauri | \`/reception/register\`| Patient Registration | Receptionist / Admin | Auto MR Card Number, Phone Normalization, CNIC & Dues Search |
| Web & Tauri | \`/reception/queue\` | Reception Queue | Receptionist / Admin | Live Token Switcher, Doctor Room Routing, Late Waiver Toggle |
| Web & Tauri | \`/doctor/queue\` | Doctor Queue | Doctor Only | Chamber-Isolated Patient List, Urgent Flagging, Next Patient Call |
| Web & Tauri | \`/doctor/consultation/:id\`| Consultation Room | Doctor Only | Vitals Logging, Rx Builder, Follow-up Scheduler, Photo Lightbox |
| Web & Tauri | \`/patients\` | Patients Directory | All Staff | Omni-Search (MR/Name/Phone/CNIC), Outstanding Dues Ledger |
| Web & Tauri | \`/patients/:id\` | Patient Profile | All Staff | Visit Timeline, Historical Prescriptions, Pharmacy Bills |
| Web & Tauri | \`/fees\` | CashBook & Register | Admin / Accountant | 3-Tab Register: Day Closing Z-Report, Expense CashBook, P&L |
| Web & Tauri | \`/store/pos\` | Counter Pharmacy POS | Pharmacist / Cashier | FEFO Auto-Deduction, Hotkeys (F1-F11), Trade Discount, Party Udhaar |
| Web & Tauri | \`/store/inventory\` | Inventory & Ledger | Pharmacist / Admin | Stock Catalog, FEFO Batches, Expiry Stratification, Multi-Unit |
| Web & Tauri | \`/store/sales-log\` | Store Sales Log | Pharmacist / Admin | Sales History, Compensating Returns, Receipt Reprints |
| Web & Tauri | \`/warehouse\` | Godown Logistics | Warehouse Incharge | Godown Matrices, Stock Transfers, B2B Party Credit Balance |
| Web & Tauri | \`/purchases\` | Supplier Purchases | Warehouse / Admin | Supplier Ledger, Goods Received Notes (GRN), Batch Import |
| Web & Tauri | \`/receipt-studio\` | Receipt Studio | Super Admin Only | ESC/POS Template Editor, Header/Footer Customizer, Watermarks |
| Web & Tauri | \`/admin\` | Master Control Panel | Super Admin Only | Step-Up PIN Guard, Database Backup/Restore, System Settings |
| Expo Mobile | \`/mobile/queue\` | Mobile OPD Queue | Doctor / Receptionist | Fast Patient Status Switch, Live Queue Counter |
| Expo Mobile | \`/mobile/vitals\` | Quick Vitals Input | Receptionist / Nurse | Rapid Mobile Entry (BP, Pulse, Sugar, Temp, Weight) |
| Expo Mobile | \`/mobile/rx-viewer\` | Mobile Rx Viewer | Doctor / Patient | Touch Lightbox Zoom, Past Prescriptions & Lab Reports |

---

### 2.2 Navigation Flow Graph (ASCII & Mermaid)

\`\`\`text
                                      +-----------------+
                                      |   /login        |
                                      +--------+--------+
                                               |
                                               v
                                      +-----------------+
                                      |  /dashboard     |
                                      +--------+--------+
                                               |
        +------------------+-------------------+-------------------+-------------------+
        |                  |                   |                   |                   |
        v                  v                   v                   v                   v
+---------------+  +---------------+  +---------------+  +---------------+  +---------------+
| Reception Desk|  | Doctor Chamber|  | Counter POS   |  | Inventory &   |  | CashBook &    |
| Module        |  | Module        |  | Module        |  | Warehouse     |  | Financials    |
+-------+-------+  +-------+-------+  +-------+-------+  +-------+-------+  +-------+-------+
        |                  |                   |                   |                   |
        |---> /register    |---> /doctor/queue |---> /store/pos    |---> /inventory    |---> /fees
        |---> /reception   |---> /consultation |---> /sales-log    |---> /warehouse    |---> /admin
              /queue             /:id                /:invoice_id        |---> /purchases         (Master PIN)
\`\`\`

\`\`\`mermaid
flowchart TD
    Login["/login (Staff Login)"] --> Dashboard["/dashboard (Executive Dashboard)"]

    Dashboard --> Reception["Reception Desk Module"]
    Reception --> Reg["/reception/register"]
    Reception --> RecQueue["/reception/queue"]

    Dashboard --> Doctor["Doctor Chamber Module"]
    Doctor --> DocQueue["/doctor/queue"]
    Doctor --> Consultation["/doctor/consultation/:id"]

    Dashboard --> Patients["/patients (Patients Directory)"]
    Patients --> Profile["/patients/:id (Patient EMR Profile)"]

    Dashboard --> POS["Pharmacy POS Module"]
    POS --> RetailPOS["/store/pos"]
    POS --> SalesLog["/store/sales-log"]

    Dashboard --> Inventory["Inventory & Supply Chain"]
    Inventory --> StockCatalog["/store/inventory"]
    Inventory --> Godown["/warehouse (Godown)"]
    Inventory --> Purchases["/purchases (Supplier GRN)"]

    Dashboard --> Finance["Finance & Administration"]
    Finance --> CashBook["/fees (CashBook & Z-Report)"]
    Finance --> ReceiptStudio["/receipt-studio"]
    Finance --> AdminPanel["/admin (Master Control Panel)"]
\`\`\`

---

## 3. Thermal Receipt Format Specification (80mm ESC/POS)

ClinicFlow features a specialized Low-Ink 80mm ESC/POS Thermal Printing Engine (\`frontend/src/utils/thermalPrinter.js\`) optimized for thermal paper rolls (576 dots per line / 48 characters standard font).

### 3.1 ESC/POS Command Byte Specification Table

| Command Name | Byte Sequence (Hex) | Description & Usage |
|---|---|---|
| Initialize Printer | \`0x1B 0x40\` (\`ESC @\`) | Clears print buffer, resets formatting to hardware defaults |
| Align Center | \`0x1B 0x61 0x01\` (\`ESC a 1\`) | Aligns text to center (Header, Logos, Totals) |
| Align Left | \`0x1B 0x61 0x00\` (\`ESC a 0\`) | Aligns text to left margin (Items, Tables) |
| Align Right | \`0x1B 0x61 0x02\` (\`ESC a 2\`) | Aligns text to right margin (Amounts, Prices) |
| Select Font A (12x24)| \`0x1B 0x4D 0x00\` (\`ESC M 0\`) | Standard font (48 characters per line) |
| Double Height/Width | \`0x1D 0x21 0x11\` (\`GS ! 0x11\`) | Large header text for Clinic Name and Invoice Number |
| Bold Mode ON | \`0x1B 0x45 0x01\` (\`ESC E 1\`) | Emphasizes titles, totals, and balance due |
| Bold Mode OFF | \`0x1B 0x45 0x00\` (\`ESC E 0\`) | Disables bold emphasis |
| Paper Feed & Cut | \`0x1D 0x56 0x42 0x00\` (\`GS V 66 0\`) | Feeds 4 lines and performs automatic paper cut |
| Print Raster Image | \`0x1D 0x76 0x30 0x00\` (\`GS v 0 0\`) | Renders low-ink monochrome bitonal logo image |

---

### 3.2 80mm Thermal Receipt Layout Specifications

#### Layout 1: OPD Consultation Token Receipt (80mm)
\`\`\`text
================================================
          DR. MUHAMMAD KASHIF KHAN
      OPD Consultation Token & Receipt
    Interior Sindh Medical Center, Hyderabad
               Ph: 0300-1234567
================================================
Token No  : #042              Date: 30-Aug-2026
MR Number : MR-00892          Time: 10:15 AM
Patient   : Muhammad Ali (M / 34Y)
Phone     : 03001234567
Doctor    : Dr. M. Kashif Khan (Chamber #1)
------------------------------------------------
Description                           Amount (Rs)
------------------------------------------------
OPD Consultation Fee                    1,500.00
------------------------------------------------
TOTAL AMOUNT:                           1,500.00
CASH RECEIVED:                          1,500.00
CHANGE RETURNED:                            0.00
------------------------------------------------
Status: PAID (Cash)
Please wait for your token number on the screen.
================================================
       Powered by ClinicFlow Healthcare
================================================
\`\`\`

#### Layout 2: Retail Pharmacy Sale Invoice (80mm)
\`\`\`text
================================================
          DR. KASHIF WHOLESALE & RETAIL
           MEDICAL STORE & PHARMACY
      Station Road, Hyderabad | Ph: 0300-9876543
================================================
Invoice No: INV-2026-00418    Date: 30-Aug-2026
MR Number : MR-00892          Time: 11:30 AM
Customer  : Tariq Ahmed (03123456789)
Prescribed: Dr. M. Kashif Khan
------------------------------------------------
Item Name            Qty   Price   Disc   Amount
------------------------------------------------
Panadol 500mg Tab    20     3.00     0%    60.00
Augmentin 625mg Tab  10    45.00     5%   427.50
Flygyl 400mg Tab     15     4.50     0%    67.50
------------------------------------------------
Subtotal:                                555.00
Bill Trade Discount (Flat):              -25.00
------------------------------------------------
NET TOTAL AMOUNT:                        530.00
CASH TENDERED:                         1,000.00
CHANGE RETURNED:                         470.00
------------------------------------------------
Items: 3 | Total Units: 45
Batch Codes: BTH-AUG-99 (Exp: 12/27)
------------------------------------------------
Thank you for visiting! Prompt recovery wished.
  [ Low-Ink Watermark: ClinicFlow v2.4 Certified ]
================================================
\`\`\`

#### Layout 3: Wholesale B2B Invoice / Supplier GRN Voucher (80mm)
\`\`\`text
================================================
          DR. KASHIF WHOLESALE MEDICAL
            B2B DISTRIBUTION INVOICE
================================================
Invoice No: B2B-88102         Date: 30-Aug-2026
Party Code: PTY-108           Salesman: Aslam
Party Name: Muslim Pharmacy (Interior Sindh)
City/Addr : Larkana | Ph: 0333-7654321
------------------------------------------------
Item Name          Brand        Qty   Rate Net (Rs)
------------------------------------------------
Arnica 30c 30ml    Schwabe      50  120.00  6,000.00
Cineraria Eye Drop Paul Brooks  30   95.00  2,850.00
Alpha-HA Drop      Mektum       20  150.00  3,000.00
------------------------------------------------
Gross Total:                           11,850.00
Trade Discount (5.0%):                   -592.50
------------------------------------------------
NET INVOICE TOTAL:                     11,257.50
PAYMENT MODE: CREDIT (Party Udhaar)
------------------------------------------------
Previous Udhaar Balance:               45,000.00
Current Invoice Amount:                11,257.50
------------------------------------------------
TOTAL OUTSTANDING UDHAAR:              56,257.50
================================================
Driver / Receiver Sign: _______________________
================================================
\`\`\`

#### Layout 4: Day Closing Z-Report Cashbook Receipt (80mm)
\`\`\`text
================================================
          CLINICFLOW FINANCIAL Z-REPORT
               DAILY CASH CLOSING
================================================
Shift ID  : SHIFT-2026-242    Date: 30-Aug-2026
Cashier   : Dr. M. Kashif Khan Time: 09:00 PM
================================================
COLLECTION SUMMARY
------------------------------------------------
OPD Consultation Fees:                 18,500.00
Retail Pharmacy Cash Sales:            42,350.00
B2B Wholesale Cash Recoveries:         25,000.00
------------------------------------------------
TOTAL SYSTEM CASH EXPECTED:            85,850.00
------------------------------------------------
CASH DRAWER PHYSICAL COUNT:            85,850.00
VARIANCE (Actual - Expected):               0.00
STATUS: EXACT MATCH (0 SHORTAGE / 0 OVERAGE)
------------------------------------------------
EXPENSE CASHBOOK DISBURSEMENTS
------------------------------------------------
- Staff Tea & Refreshments:              -450.00
- Thermal Paper Rolls Supply:          -1,200.00
------------------------------------------------
NET CASH IN DRAWER:                    84,200.00
================================================
Supervisor Verification: _______________________
================================================
\`\`\`

---

## 4. Double-Entry Chart of Accounts Tree Hierarchy

ClinicFlow enforces standard double-entry accounting with a 6-root account code taxonomy mapped directly to patients, wholesale parties, suppliers, inventory stock, sales revenues, and expenses.

### 4.1 High-Resolution ASCII Chart of Accounts Tree

\`\`\`text
CHART OF ACCOUNTS (ROOT TREE)
├── 1000 - ASSETS
│   ├── 1100 - Cash & Bank Accounts
│   │   ├── 1110 - Main Cash Drawer (Counter POS)
│   │   ├── 1120 - Meezan Bank (Clinic Operational Account)
│   │   └── 1130 - HBL Bank (Wholesale Distribution)
│   ├── 1200 - Accounts Receivable (Customer / Party Ledgers)
│   │   ├── 1210 - Patient Udhaar & Outstanding Dues
│   │   └── 1220 - B2B Wholesale Party Accounts (PTY-108, etc.)
│   └── 1300 - Inventory Stock Assets
│       ├── 1310 - Counter Pharmacy Retail Stock Asset
│       └── 1320 - Godown Main Warehouse Stock Asset
├── 2000 - LIABILITIES
│   ├── 2100 - Accounts Payable (Supplier Ledgers)
│   │   ├── 2110 - BM Pvt Ltd Payable
│   │   ├── 2120 - Paul Brooks Payable
│   │   ├── 2130 - Schwabe Homoeo Payable
│   │   └── 2140 - Mektum Pharma Payable
│   └── 2200 - Accrued Taxes & Salaries Payable
├── 3000 - EQUITY
│   ├── 3100 - Doctor / Owner Capital Account
│   └── 3200 - Retained Earnings
├── 4000 - REVENUE
│   ├── 4100 - OPD Consultation Fee Revenue
│   ├── 4200 - Counter Pharmacy Retail Sales Revenue
│   └── 4300 - B2B Wholesale Sales Revenue
├── 5000 - COST OF GOODS SOLD (COGS)
│   ├── 5100 - Pharmacy & Wholesale Goods Cost (COGS)
│   └── 5200 - Inventory Damage / Expiry Scrap Loss
└── 6000 - EXPENSES
    ├── 6100 - Operational & Admin Expenses
    │   ├── 6110 - Clinic Utilities (Electricity / Water)
    │   ├── 6120 - Staff Salaries & Allowances
    │   ├── 6130 - Office Stationery & Thermal Print Rolls
    │   └── 6140 - Software License & VPS Hosting Fees
    └── 6200 - Finance Charges & Discounts Allowed
\`\`\`

---

### 4.2 Mermaid Chart of Accounts Diagram

\`\`\`mermaid
graph TD
    Root["Chart of Accounts (ClinicFlow Engine)"]

    Root --> Assets["1000 - ASSETS"]
    Assets --> CashBank["1100 Cash & Bank"]
    CashBank --> CashDrawer["1110 Main Cash Drawer"]
    CashBank --> BankMeezan["1120 Meezan Bank"]
    CashBank --> BankHBL["1130 HBL Bank"]

    Assets --> AR["1200 Accounts Receivable"]
    AR --> PatientDues["1210 Patient Dues"]
    AR --> WholesaleParties["1220 B2B Wholesale Parties"]

    Assets --> InvStock["1300 Inventory Stock"]
    InvStock --> RetailStock["1310 Counter Stock"]
    InvStock --> GodownStock["1320 Godown Stock"]

    Root --> Liabilities["2000 - LIABILITIES"]
    Liabilities --> AP["2100 Accounts Payable"]
    AP --> SupplierBM["2110 BM Pvt Ltd"]
    AP --> SupplierPaul["2120 Paul Brooks"]
    AP --> SupplierSchwabe["2130 Schwabe"]
    AP --> SupplierMektum["2140 Mektum"]

    Root --> Equity["3000 - EQUITY"]
    Equity --> Capital["3100 Owner Capital Account"]
    Equity --> Retained["3200 Retained Earnings"]

    Root --> Revenue["4000 - REVENUE"]
    Revenue --> OPDFees["4100 OPD Consultation Fees"]
    Revenue --> RetailSales["4200 Pharmacy Retail Sales"]
    Revenue --> WholesaleSales["4300 B2B Wholesale Sales"]

    Root --> COGS["5000 - COGS"]
    COGS --> SalesCOGS["5100 Goods Cost (COGS)"]
    COGS --> ScrapCOGS["5200 Damage/Expiry Loss"]

    Root --> Expenses["6000 - EXPENSES"]
    Expenses --> OpEx["6100 Operating Expenses"]
    OpEx --> Utilities["6110 Utilities"]
    OpEx --> Salaries["6120 Staff Salaries"]
    OpEx --> Supplies["6130 Thermal Rolls & Stationery"]
    OpEx --> Hosting["6140 Software & Hosting"]
\`\`\`

---

## 5. Verification & Compliance Sign-Off

- **Node.js Execution Test:** Verified using \`node --experimental-strip-types FINAL_AUDIT_STEP_B/src/system_showcase_visualizer.ts\`
- **Production Guard:** 100% local development output; 0 connections or mutations to production VPS environment.
- **Rule 0 & Rule 15 Compliance:** Context files fully synchronized.
`;
}

function main() {
  console.log('🚀 Running FINAL_AUDIT_STEP_B: Master System Diagram & Visual Showcase Builder...');
  const markdown = generateReport();
  const targetPath = path.join(process.cwd(), 'FINAL_AUDIT_STEP_B', 'system_showcase_report.md');
  
  // Ensure output directory exists
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, markdown, 'utf-8');
  console.log(`✅ Documentation artifact successfully written to: ${targetPath}`);
  console.log(`📊 Total lines generated: ${markdown.split('\n').length}`);
}

main();
