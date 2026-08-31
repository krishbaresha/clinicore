# ClinicCore — Smart POS Stock Replenishment Specification

*Verified and Documented in Phase 07 (Smart POS Stock Replenishment).*

---

## 1. Objective & Operational Requirement
During fast-paced retail or OPD consultation checkout, a cashier/pharmacist may encounter a medicine with insufficient **Counter / POS Stock** while having stock in a **Warehouse / Godown** or needing an **Emergency Local Purchase**.

**CRITICAL MANDATE**: The operator **MUST NOT** lose the active cart, patient selection, OPD token, entered quantities, or custom discount context during replenishment.

---

## 2. Replenishment Decision Flow

```
                     [POS Cart Item: Qty > Store Stock]
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │  Smart Stock-Out Replenish Modal │
                    │  - Current Store Stock: X       │
                    │  - Available in Godown: Y       │
                    │  - Total Clinic Stock:  X + Y   │
                    └────────────────┬────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
       [Option A: Godown Transfer]             [Option B: Local Emergency Purchase]
  - Source: Godown (wh_001)               - Vendor: Selected / Cash Supplier
  - Destination: Store Counter (wh_str)   - Qty & Unit Cost entered
  - Qty: Transfer count                   - Status: Paid / Unpaid (Accounts Payable)
                 │                                       │
                 ▼                                       ▼
     [Create Stock Transfer]                  [Create Purchase & Stock Movement]
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     │
                                     ▼
                      [Return to Active POS Cart]
                      - Cart items & totals intact
                      - Item stock replenished
                      - Complete Sale without re-entry
```

---

## 3. Strict Accounting Separation Rules
1. **Physical Inventory Movement $\neq$ Cash Outflow**:
   - Creating an emergency purchase increases inventory immediately.
   - If marked **Unpaid**:
     - `cf_purchases_v5` balance is marked as `balance_payable`.
     - `cf_supplier_ledger_v5` records an open payable against the supplier.
     - Cash in hand / Cash drawer does **NOT** decrease.
   - When payment is made later:
     - Cash drawer / Cashbook expense is recorded.
     - Supplier ledger payable decreases.
     - Original purchase record remains intact.
