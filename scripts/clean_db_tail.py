import re

file_path = "e:/Soft/DrCreate/ClinicFlow/frontend/src/api/db.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

before = content[:content.index("warehouses: [")]
cache_marker = "const _COLLECTION_CACHE = new Map();"
after = content[content.index(cache_marker):]

clean_tail = """warehouses: [
    {
      id: "wh_001",
      clinic_id: "clinic_001",
      code: "GDW-01",
      name: "Main Godown (Lajpat Road)",
      location: "Lajpat Road, Hyderabad",
      incharge_name: "Raza",
      phone: "03009998877",
      is_default: true,
      is_store_counter: false,
      status: "active",
      notes: "Primary wholesale storage godown",
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "wh_002",
      clinic_id: "clinic_001",
      code: "GDW-02",
      name: "Secondary Godown (Site Area)",
      location: "Site Area, Hyderabad",
      incharge_name: "Usama",
      phone: "03221234567",
      is_default: false,
      is_store_counter: false,
      status: "active",
      notes: "Overflow and bulk dry storage",
      created_at: "2024-06-01T00:00:00Z"
    },
    {
      id: "wh_str",
      clinic_id: "clinic_001",
      code: "STR-01",
      name: "Medical Store Counter (POS)",
      location: "Lajpat Road, Main Counter",
      incharge_name: "Clinic & Pharmacy Counter",
      phone: "03111234567",
      is_default: false,
      is_store_counter: true,
      status: "active",
      notes: "Retail counter and POS dispensing",
      created_at: "2024-01-01T00:00:00Z"
    }
  ],
  supplier_ledger: []
};

// ---------- Storage Keys ----------
const KEYS = {
  SEEDED:           "cf_seeded_v10_absolute_ground_zero",
  CLINIC:           "cf_clinic_v5",
  SERVICES:         "cf_services_v5",
  USERS:            "cf_users_v5",
  PATIENTS:         "cf_patients_v5",
  VISITS:           "cf_visits_v5",
  INVENTORY:        "cf_inventory_v5",
  PARTIES:          "cf_parties_v5",
  SUPPLIERS:        "cf_suppliers_v5",
  SALESMEN:         "cf_salesmen_v5",
  PURCHASES:        "cf_purchases_v5",
  B2B_SALES:        "cf_b2b_sales_v5",
  SALES:            "cf_sales_v5",
  PATIENT_LEDGER:   "cf_patient_ledger_v5",
  EXPENSES:         "cf_expenses_v5",
  RETURNS:          "cf_returns_v5",
  STOCK_TRANSFERS:  "cf_stock_transfers_v5",
  SHIFT_CLOSINGS:   "cf_shift_closings_v5",
  DOCUMENTS:        "cf_documents_v5",
  TENANTS:          "cf_tenants_v5",
  SESSION:          "cf_auth_session",
  // v6 Multi-Module Additions
  WAREHOUSES:       "cf_warehouses_v6",
  SUPPLIER_LEDGER:  "cf_supplier_ledger_v6",
  ACCOUNTS:         "cf_accounts_v6",
  CASHBOOK:         "cf_cashbook_v6",
  MAIN_AC:          "cf_main_ac_v6",
};

// High-performance In-Memory Memoization Cache for Zero-Lag Operations
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(before + clean_tail + after)

print("DB.JS CLEANED AND GROUND ZERO SEED KEY SET SUCCESSFULLY!")
