# PHASE 07 — Smart POS Stock Replenishment

## Goal
Prevent the operator from losing the current bill when medicine stock is insufficient.

## First
Audit existing:
- inventory
- locations
- purchases
- suppliers
- stock movements
- payments
- payables
- POS cart
- sale/bill state
- audit logs

Reuse existing concepts where possible.

## Desired workflow

POS detects insufficient stock.

Show:
- Store/POS stock
- Warehouse stock
- total available

### Option A — Warehouse transfer
If warehouse has stock:
- choose quantity
- create transfer record
- decrease warehouse
- increase store
- preserve current bill/cart
- continue billing

### Option B — Local emergency purchase
If no stock:
- vendor
- medicine
- quantity
- unit cost
- payment status
- paid/unpaid/partial if supported
- create purchase
- create payable if unpaid
- increase stock
- preserve current bill/cart
- continue billing

## Accounting rule
Inventory movement and cash/payment are separate records.

Unpaid purchase:
- inventory increases
- payable increases
- cash does not decrease

Later payment:
- payable decreases
- payment recorded

## Acceptance
A walk-in or OPD/token customer must NOT have to re-enter the entire bill after replenishment.
