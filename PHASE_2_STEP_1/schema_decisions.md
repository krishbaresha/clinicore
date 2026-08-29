# Phase 2 — Step 1: Schema Architecture Decisions

> **System:** CliniCore / ClinicFlow Master Architecture  
> **Phase:** Phase 2 — Step 1 (Canonical PostgreSQL & Staging Schema Design)  

---

## 1. Schema Design Principles & Reconciliation

The DDL schemas (`backend_schema.sql` and `staging_schema.sql`) were reconciled directly against all 12 authoritative context files:

1. **PostgreSQL Canonical Authority (`14_DATABASE_SCHEMA.md` & `19_DECISIONS.md`)**:
   - Primary Keys: Native UUID v4 (`UUID PRIMARY KEY DEFAULT gen_random_uuid()`).
   - Monetary Amounts: `NUMERIC(15,2)` preventing floating-point rounding errors.
   - Stock Quantities: `NUMERIC(12,3)` supporting partial unit decimal stock balances.
   - Monotonic Change Cursor: Global Sequence `sync_cursor_seq` incrementing on every row mutation.

2. **Double-Entry Accounting Invariant (`04_ACCOUNTING_RULES.md`)**:
   - `journal_entries` enforces strict mathematical balance check constraint:
     `CONSTRAINT chk_double_entry_balance CHECK (total_debit = total_credit)`
   - Balance editing is strictly prohibited; immutable ledger lines with debit/credit checks.

3. **Event-Sourced Inventory & FEFO (`05_INVENTORY_RULES.md`)**:
   - `stock_movements` table captures all stock mutations as discrete immutable movement events (`PURCHASE_RECEIPT`, `POS_SALE`, `B2B_SALE`, `STOCK_ADJUSTMENT`, etc.).
   - `medicine_batches` indexes `(inventory_id, expiry_date, quantity_available)` for FEFO First Expiry First Out allocation.

4. **Staging Schema (`03_LEGACY_DATA_MAP.md`)**:
   - `staging_legacy` schema contains 7 un-transformed tables matching `AshrafKhan.accdb` tables (`Accounts`, `Inventory`, `Invextra`, `Mainpro`, `MainAc`, `CashBook`, `Appointment`).
   - Fields track `validation_status`, `mapping_status`, and `validation_errors` JSONB arrays without modifying raw data.
