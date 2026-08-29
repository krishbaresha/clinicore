# 05 — Pharmacy Inventory, Batch Tracking & FEFO Rules

> **System:** CliniCore / ClinicFlow Master Architecture  

---

## 1. Stock Movement Event Sourcing
All inventory changes MUST originate from discrete stock movements (`stock_movements`):
- `PURCHASE_RECEIPT` (+Stock)
- `POS_SALE` (-Stock)
- `B2B_SALE` (-Stock)
- `CUSTOMER_RETURN` (+Stock)
- `SUPPLIER_RETURN` (-Stock)
- `GODOWN_TRANSFER` (Warehouse -> Store)
- `STOCK_ADJUSTMENT` (+/- Variance)
- `EXPIRED_QUARANTINE` (-Available Stock)

## 2. FEFO Batch Allocation Rule
When items are added to POS or B2B sales cart, the inventory engine selects batches strictly ordered by:
1. `expiry_date ASC` (Earliest Expiry First)
2. `created_at ASC` (FIFO fallback for identical expiry)
3. Exclude batches where `expiry_date < TODAY` or `is_quarantined = true`.
