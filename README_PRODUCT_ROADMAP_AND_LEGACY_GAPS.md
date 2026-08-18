# ClinicFlow Product Roadmap, Legacy Comparison & Financial Rules

**Purpose:** make ClinicFlow a safe replacement for the legacy DrCreate Excel/Access workflow without copying its fragility.

## 1. Legacy-to-ClinicFlow capability map

| Legacy DrCreate capability | ClinicFlow today | Replacement gap / decision |
|---|---|---|
| Appointment registration, doctor, patient, token, fee | Present and improved: doctor-specific queue and receipt | Preserve daily token sequence per doctor; confirm whether the legacy numbering was clinic-wide or doctor-wide. |
| Patient lookup by contact and past details | Present and improved: name, relation, phone profile | Add duplicate merge, correct date-of-birth/age history, allergy/chronic-condition flags. |
| Appointment printing | Present as registration receipt | Doctor must approve actual thermal/A4 format and language. |
| CashBook and MainAc entries | Partial | Add a real immutable cash ledger and account statement; do not treat dashboard totals as accounting records. |
| Accounts/party ledger | Partial: supplier and patient credit concepts | Add account master, doctor settlement, supplier statement, patient credit statement, and opening balances. |
| Inventory, purchases, sales | Present and richer | Add batch/expiry/FEFO, stock adjustment approval, damaged/expired stock and physical stock count. |
| Purchase/sale voucher and invoice printing | Partial | Add documented invoice numbering, void/refund workflow, tax configuration, and printable purchase/credit note. |
| Daily report / account balances | Partial: dashboards and EOD | Add day book, cash book, profit/margin, doctor-wise and payment-method reports. |
| Warehouse / product movement | Present in demo | Define locations, transfer approval, receiving, reconciliation, and audit trail before production. |
| Access/Excel historical data | Missing | Build a one-time import, reconciliation report, and signed migration acceptance. |

## 2. Features ClinicFlow already improves

- Separate queues for multiple doctors.
- Patient identification using relation name, reducing same-name mistakes.
- Photo-first prescription/report record suitable for a handwriting-based clinic.
- Reception can complete report uploads later without making the doctor wait.
- Walk-in and visit-linked pharmacy sales.
- Dynamic procedures, EOD denomination count, warehouse transfer, supplier purchase and return concepts.

## 3. Missing features required for a true replacement

### P0 — required before real clinic use

1. Shared server database, real staff accounts, server-side permissions, and image storage.
2. Reliable backup/restore, audit log, soft-delete, and a tested disaster recovery procedure.
3. Immutable financial ledger and payment-method separation: cash, card, bank transfer, JazzCash/Easypaisa, credit.
4. Migration from DrCreate with opening balances, patient history, stock, suppliers, and financial reconciliation.
5. Pharmacy batch/expiry tracking, expired-sale block, and stock adjustment controls.
6. Documented void/refund/discount controls with user, time, reason, and manager approval.

### P1 — build after P0

1. Doctor-specific fees, follow-up rules, discount/waiver categories, doctor settlement/commission report.
2. Appointment calendar, doctor leave/availability, emergency/VIP queue bump with reason.
3. WhatsApp token/receipt/follow-up reminders, with opt-in and delivery log.
4. CSV/PDF export for patients, fee report, cash book, inventory, purchases, sales, and ledgers.
5. Searchable clinical tags: allergy, chronic condition, blood group, important alert.
6. Patient duplicate merge and record correction workflow.

### P2 — only after real usage proves need

- Patient online booking, multi-branch, offline sync, lab integrations, FBR integration, mobile app, analytics/AI assistance.

## 4. Financial source of truth

Never calculate money from UI cards alone. Every money-changing event creates an immutable **financial transaction** with a source record and a user.

### Required transaction fields

`id, clinic_id, occurred_at, source_type, source_id, transaction_type, payment_method, amount_paisa, debit_account, credit_account, entered_by, approved_by, reason, voided_at, void_reason, created_at`.

### Required event posting rules

| Event | Financial effect |
|---|---|
| OPD fee paid in cash | Debit Cash Drawer; Credit OPD Fee Revenue |
| OPD fee paid by wallet/card/bank | Debit that clearing account; Credit OPD Fee Revenue |
| Pharmacy sale paid | Debit payment method; Credit Pharmacy Sales Revenue |
| Pharmacy sale on credit | Debit Patient Receivable; Credit Pharmacy Sales Revenue |
| Supplier stock purchase on credit | Debit Inventory Asset; Credit Supplier Payable |
| Supplier cash payment | Debit Supplier Payable; Credit Cash Drawer |
| Expense paid | Debit Expense Category; Credit payment method |
| Refund | Debit original revenue/returns account; Credit original payment method |
| Stock adjustment | No cash entry automatically; create an inventory movement with reason and approval. |

### End-of-day cash formula

`Expected cash = opening cash + cash OPD fees + cash POS sales + cash credit recoveries - cash refunds - cash expenses - cash supplier payments - bank deposits`

Card, bank, JazzCash/Easypaisa, and credit sales must **not** be counted as drawer cash. Lock a closing after owner/cashier confirmation; corrections must be a separate adjustment, never an edit/delete.

### Financial acceptance tests

- A discount requires amount, reason, user, and timestamp.
- A void never disappears; it references the original receipt and requires a reason/approval.
- A refund cannot exceed its original paid amount or returned quantity.
- Inventory cannot go negative unless owner-approved override is recorded.
- EOD closing has no unexplained variance; every variance is acknowledged with a reason.
- Reports reconcile: POS sales + OPD fees + recoveries - refunds/expenses = cash movement by payment method.

## 5. Controlled roadmap

### Phase A — demo validation (now)

Use the demo checklist, collect doctor feedback, freeze the required workflow, and create print samples. No backend work or speculative features.

### Phase B — specification freeze

Create one approved workflow document with: role permissions, forms, fields, reports, printer formats, financial rules, migration fields, and explicit non-goals. The doctor signs off on it.

### Phase C — production foundation

Build database schema, API, authentication, RBAC, file storage, audit log, test suite, backup, monitoring and deployment. No screen may call localStorage after this phase.

### Phase D — core replacement

Implement/retest: registration, queue, consultation/photos, patient profile, OPD fees, POS, purchase, inventory, returns, cash book, EOD, reports, printing.

### Phase E — migration and pilot

Import a copy of DrCreate data; reconcile counts/balances/stock; train staff; run in parallel for 2–4 weeks; resolve discrepancies; only then make ClinicFlow the primary system.

### Phase F — paid rollout

Enable support, backups, service monitoring, feature requests, and a written change-control process.

## 6. No-guess programming rules

An AI/developer must first update the approved workflow/specification before coding any change that affects patient data, money, stock, access, or printing. A change request must contain:

1. user role and exact user story;
2. before/after workflow;
3. affected records and financial/inventory effect;
4. validation rules and error messages;
5. tests and acceptance criteria;
6. migration/backfill and rollback plan, if schema changes.

If any item is unknown, stop and ask. Do not invent medical, accounting, tax, or pharmacy rules.
