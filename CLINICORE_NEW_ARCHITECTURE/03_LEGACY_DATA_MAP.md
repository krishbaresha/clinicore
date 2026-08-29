# 03 — Legacy Data Mapping & ETL Specification

> **System:** CliniCore / ClinicFlow Master Architecture  
> **Client:** H/Dr. Asif Ashraf Khan Clinic & Wholesale Pharmacy  
> **Source Files:** `Cache/AshrafKhan.accdb` (12.29 MB MS Access), `Cache/DrCreate.xlsm` (Excel VBA Workbook)  
> **Target Database:** Canonical PostgreSQL Database on VPS  

---

## 1. Legacy Data Mapping Invariants

1. **Historical Preservation**: All 29,009 financial transactions (`MainAc`) and 25,765 stock entries (`Mainpro`) represent 2 years of real production operations. They MUST NOT be truncated, deleted, or merged lossily.
2. **Staging Schema Isolation**: Legacy data is imported into a dedicated staging schema (`staging_legacy`) before validation and transformation into canonical production PostgreSQL tables.
3. **Audit Provenance**: Every imported record is tagged with lineage metadata:
   - `_legacy_source`: `"AshrafKhan.accdb"` or `"DrCreate.xlsm"`
   - `_legacy_table`: Original MS Access table name
   - `_legacy_id`: Original MS Access primary key ID

---

## 2. Table-by-Table Mapping Matrix

### A. Parties, Suppliers & Accounts (`Accounts` -> `parties` / `suppliers`)
- **Source**: `AshrafKhan.accdb` table `Accounts` (263 rows)
- **Source Columns**: `ID`, `Account Name`, `Account No`, `Naration`, `Account Type`
- **Target Table**: `parties` (Wholesale B2B) and `suppliers` (Pharma Distributors)
- **Transformation Rules**:
  - `Account Type == 'Party' / 'Customer'` -> Insert into `parties` (`party_code` = `Account No`, `name` = `Account Name`)
  - `Account Type == 'Supplier' / 'Company'` -> Insert into `suppliers` (`name` = `Account Name`)
  - `Account Type == 'Expense' / 'Cash'` -> Map to Chart of Accounts (`accounts`)

### B. Product Inventory Catalogue (`Inventory` -> `inventory`)
- **Source**: `AshrafKhan.accdb` table `Inventory` (4,237 rows)
- **Source Columns**: `ID`, `Item Name`, `Item Code`, `Naration`, `Minimum Level`, `Sale Price`, `Purchase Price`
- **Target Table**: `inventory`
- **Transformation Rules**:
  - `id` = UUID v4 (map original `ID` to `_legacy_id`)
  - `sku_code` = `Item Code` (fallback to `SKU-` + `ID` if null)
  - `name` = `Item Name`
  - `purchase_price_unit` = `Purchase Price`
  - `retail_price_unit` = `Sale Price`
  - `min_reorder_qty` = `Minimum Level`

### C. Master Invoices & Headers (`Invextra` & `Vou` -> `b2b_sales` & `purchases`)
- **Source**: `AshrafKhan.accdb` table `Invextra` (7,590 rows) and `Vou` (12,757 rows)
- **Source Columns**: `ID`, `Date`, `Voucher No`, `Type`, `Account Name`, `Term`, `SalesMan`, `Net Amount`, `Cash Received`
- **Target Tables**: `b2b_sales` (Sales Invoices) & `purchases` (Supplier Purchases)
- **Transformation Rules**:
  - `Type == 'Sale'` -> Insert into `b2b_sales` (`invoice_number` = `Voucher No`, `gross_amount` = `Net Amount`, `cash_paid` = `Cash Received`)
  - `Type == 'Purchase'` -> Insert into `purchases` (`invoice_number` = `Voucher No`, `total_amount` = `Net Amount`)

### D. Itemized Stock Ledger (`Mainpro` -> `stock_movements` & invoice items)
- **Source**: `AshrafKhan.accdb` table `Mainpro` (25,765 rows)
- **Source Columns**: `ID`, `Date`, `Voucher No`, `Transaction Type`, `Item name`, `In`, `Out`, `Rate`, `Gross`, `Disc%`, `Net`
- **Target Tables**: `b2b_sale_items`, `purchase_items`, `stock_movements`
- **Transformation Rules**:
  - `In > 0` -> Movement type `PURCHASE_RECEIPT` / `ADJUSTMENT_IN`
  - `Out > 0` -> Movement type `POS_SALE` / `B2B_SALE`
  - Reconcile line item quantity with `inventory` SKU references.

### E. Financial Journal (`MainAc` & `CashBook` -> `cashbook` & `patient_ledger` / `supplier_ledger`)
- **Source**: `AshrafKhan.accdb` table `MainAc` (29,009 rows) & `CashBook` (4,236 rows)
- **Source Columns**: `ID`, `Date`, `Voucher No`, `Account Name`, `Transaction Type`, `Description`, `Debit`, `Credit`
- **Target Tables**: `cashbook`, `patient_ledger`, `supplier_ledger`
- **Transformation Rules**:
  - Enforce invariant: `SUM(Debit) == SUM(Credit)`.
  - Import as immutable audit ledger entries tagged with historical timestamps.

---

## 3. Automated Import & Validation Pipeline (ETL)

```text
+-----------------------+
| AshrafKhan.accdb      |
| DrCreate.xlsm         |
+-----------+-----------+
            |
            v
+-----------------------+
|  Staging Schema       |  1. Parse & Dump Raw Records
|  (staging_legacy)     |
+-----------+-----------+
            |
            v
+-----------------------+
| Validation & Cleanse  |  2. Reconcile Null SKUs, Duplicate Voucher IDs,
| (import_validator.py) |     and Floating-Point Precision
+-----------+-----------+
            |
            v
+-----------------------+
| Canonical PostgreSQL  |  3. Transactional Insert into Production
| (vps_canonical_db)    |     Database with Lineage Metadata
+-----------------------+
```
