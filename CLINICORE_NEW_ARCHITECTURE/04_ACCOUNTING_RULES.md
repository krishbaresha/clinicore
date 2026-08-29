# 04 — Financial & Double-Entry Accounting Rules

> **System:** CliniCore / ClinicFlow Master Architecture  

---

## 1. Double-Entry Accounting Invariant
Every financial transaction MUST generate balanced debit and credit entries in the general ledger:

$$\sum \text{Debits} = \sum \text{Credits}$$

## 2. Transaction Types & Journal Entries
- **POS Cash Sale**: Debit `Cash Drawer`, Credit `Pharmacy Sales Revenue`.
- **Wholesale Party Udhaar Sale**: Debit `Party Receivables (Party Ledger)`, Credit `Wholesale Sales Revenue`.
- **Supplier Credit Purchase**: Debit `Inventory Valuation`, Credit `Supplier Payables (Supplier Ledger)`.
- **Expense Payment**: Debit `Expense Account`, Credit `Cash Drawer`.
- **OPD Consultation Fee**: Debit `Cash Drawer`, Credit `OPD Consultation Revenue`.

## 3. Closed Period & Non-Destructive Reversals
- Closed accounting periods (`is_period_closed`) block backdated edits.
- Corrections must be performed via compensating reversal transactions (`REVERSAL`) with inverted debit/credit lines. Direct balance editing is strictly prohibited.
