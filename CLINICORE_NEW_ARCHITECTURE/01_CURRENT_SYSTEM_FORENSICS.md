# 01 — Current System Forensics & Audit

> **System:** CliniCore / ClinicFlow Master Architecture  
> **Client:** H/Dr. Asif Ashraf Khan Clinic & Wholesale Pharmacy  
> **Audit Date:** August 29, 2026  
> **Scope:** Codebase, Database DDL, Existing API, and Legacy Datasets (`AshrafKhan.accdb`, `DrCreate.xlsm`)  

---

## 1. Codebase Structure & Components

The legacy system consists of three architectural layers:

```text
e:\Soft\DrCreate\ClinicFlow\
├── backend/                  # PHP 8.3 Custom REST API Gateway
│   ├── public/index.php      # Micro-router & CORS origin dispatcher
│   ├── src/Config/           # Database PDO connection & .env loader
│   ├── src/Controllers/      # Auth, Patient, Visit, Sync, System, Finance controllers
│   ├── src/Middleware/       # AuthMiddleware & RBACMiddleware guards
│   ├── src/Services/         # MutationService (ACID transactional domain logic)
│   └── src/Utils/            # JWT, RateLimiter, Validator, Response helpers
├── frontend/                 # React 19 + Vite 8.2 + Tailwind CSS SPA
│   ├── src/api/db.js         # In-memory _COLLECTION_CACHE & LocalStorage engine
│   ├── src/api/syncEngine.js # 7-State FSM background cloud poller (4000ms)
│   ├── src/api/auth.js       # User session state & permission matrix
│   └── src/pages/            # 20+ Lazy-loaded UI portal views
└── Cache/                    # Historical Legacy Data (2 Years Production Data)
    ├── AshrafKhan.accdb      # MS Access database (12.29 MB)
    └── DrCreate.xlsm         # Excel VBA workbook (macro-enabled)
```

---

## 2. Empirical Audit of Historical Data Sources

### A. MS Access Production Database (`Cache/AshrafKhan.accdb` — 12.29 MB)

Direct inspection via OLEDB 16.0 extracted the following canonical record counts and schema structure:

| Table Name | Row Count | Key Columns | Business Domain |
| :--- | :--- | :--- | :--- |
| **`MainAc`** | **29,009** | `ID`, `Date`, `Voucher No`, `Account Name`, `Transaction Type`, `Description`, `Debit`, `Credit` | General Ledger & Double-Entry Financial Journal |
| **`Mainpro`** | **25,765** | `ID`, `Date`, `Voucher No`, `Transaction Type`, `Item name`, `Description`, `In`, `Out`, `Ref`, `Rate`, `Gross`, `Disc%`, `Disc0`, `Net` | Itemized Stock Movement & Line-Item Ledger |
| **`Vou`** | **12,757** | `ID`, `Pur`, `Sal`, `Cas` | Sequential Master Voucher Numbering Registry |
| **`Invextra`** | **7,590** | `ID`, `Date`, `Voucher No`, `Type`, `Account Name`, `Term`, `Term/Ac`, `Bilty`, `Transport`, `SaleMan`, `Net Amount`, `Cash Received` | Sales/Purchase Invoice Headers, Salesman & Bilty Transport Metadata |
| **`Inventory`** | **4,237** | `ID`, `Item Name`, `Item Code`, `Naration`, `Minimum Level`, `Sale Price`, `Purchase Price` | Product SKU Master Catalogue |
| **`CashBook`** | **4,236** | `ID`, `Voucher No`, `Date`, `Account Name`, `Description`, `Amout`, `Type` | Cash In / Cash Out Journal |
| **`Accounts`** | **263** | `ID`, `Account Name`, `Account No`, `Naration`, `Account Type` | Wholesale Parties, Suppliers & Account Master Registry |
| **`Other`** | **247** | `ID`, `Refference`, `Transport` | Transport Bilty & Goods Forwarding Partners |
| **`Appointment`** | **46** | `ID`, `Doctor`, `patient contact`, `Patient age`, `gender`, `Charges`, `Date`, `token no`, `Patient Name`, `Status` | Historical OPD Queue & Patient Appointments |

### B. Excel Workbook (`Cache/DrCreate.xlsm`)

ZIP archive XML parsing revealed 7 worksheets containing shared string lookup tables for accounts (`Account Name`, `Account Type`, `Total Accounts`), inventory catalogues (`Item Name`, `Item Code`, `Minimum Level`), and invoice calculations (`Gross`, `Disc`, `Net Amount`, `Rate`, `Cash Received`, `Change`).

---

## 3. Structural Strengths & Defects in Current PHP/React App

### Strengths:
1. **Decimal-Safe Arithmetic**: `arithmetic.js` handles financial math without floating-point errors.
2. **Keyboard Ergonomics**: POS control deck features F1-F11 hotkeys and 2D arrow key grid navigation.
3. **Thermal Printing Engine**: Low-ink 80mm ESC/POS thermal receipt formatting with sanitized DOM lightbox previews.
4. **Domain Services**: `MutationService.php` executes multi-table ACID transactions for sales, purchases, and patient visits.

### Technical Defects Identified for Architecture Upgrade:
1. **Browser LocalStorage Dependency**: Frontend `db.js` relies heavily on browser `localStorage`. Clearing browser data wipes local state. **Target Fix:** Replace with local SQLite database inside desktop Tauri shell.
2. **Polling Overhead**: Background poller (`syncEngine.js`) requests `GET /api/v1/system/sync-state` every 4000ms. **Target Fix:** Replace with WebSocket / Server-Sent Events (SSE) + monotonic change cursor (`?cursor=N`).
3. **PHP Backend Scalability**: PHP 8.3 FPM requires web server configuration. **Target Fix:** Migrate backend to Node.js/TypeScript (NestJS/Fastify) + PostgreSQL.
