# ClinicCore — Relational Data Model & Schema Dictionary

*Verified and Documented in Phase 07 (Data Model & Inventory Architecture).*

---

## 1. Core Collections & Entity Relationships

```
                     ┌───────────────────┐
                     │     Suppliers     │
                     └─────────┬─────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
         ┌─────────────┐ ┌───────────┐ ┌─────────────┐
         │  Inventory  │ │ Purchases │ │ Supplier    │
         │   (SKUs)    │ │ (Invoices)│ │  Ledger     │
         └──────┬──────┘ └─────┬─────┘ └─────────────┘
                │              │
        ┌───────┴───────┐      │
        ▼               ▼      ▼
┌──────────────┐ ┌───────────────────┐
│  Warehouses  │ │  Stock Movements  │
│  (Locations) │ │     (Ledger)      │
└──────────────┘ └─────────┬─────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
         ┌─────────────┐       ┌─────────────┐
         │  POS Sales  │       │  B2B Sales  │
         │ (Walk-in)   │       │  (Parties)  │
         └─────────────┘       └─────────────┘
```

---

## 2. Core Entity Definitions

### A. `Inventory` (`cf_inventory_v5`)
- `id`, `name`, `generic_name`, `company`, `category`, `unit`, `unit_price`, `cost_price`
- `stock_locations`: Map of location IDs to quantities `{ "wh_001": 50, "wh_str": 10 }`
- `total_stock`: Derived sum of all locations
- `min_threshold`, `reorder_level`

### B. `Warehouses` (`cf_warehouses_v6`)
- `id`: Unique identifier (e.g. `wh_str` for Retail Counter, `wh_001` for Main Godown)
- `name`, `code`, `is_store_counter`, `is_default`, `status`

### C. `StockMovements` (`cf_stock_movements_v5`)
- `id`, `medicine_id`, `movement_type` (`"SALE_POS"`, `"PURCHASE"`, `"WAREHOUSE_TRANSFER"`, `"ADJUSTMENT"`)
- `from_location_id`, `to_location_id`, `quantity`, `reference_id`, `timestamp`, `created_by`

### D. `Purchases` & `SupplierLedger` (`cf_purchases_v5`, `cf_supplier_ledger_v5`)
- `id`, `supplier_id`, `invoice_no`, `items`, `gross_total`, `tax`, `discount`, `net_total`
- `paid_amount`, `balance_payable`, `payment_status` (`"PAID"`, `"UNPAID"`, `"PARTIAL"`)
