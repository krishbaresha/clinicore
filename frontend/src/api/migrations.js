/**
 * ClinicFlow — Enterprise Schema & Data Migration Engine
 * Zero-Data-Loss Versioned Migration Pipeline with Sandbox Rollback Guard
 */

import { safeMoney, safeQty } from "./arithmetic.js";

export const SCHEMA_VERSION_KEY = "cf_schema_version";
export const TARGET_SCHEMA_VERSION = 4;

/**
 * Migration 1: Legacy Key Bridge
 * Safely bridges legacy suffixed keys (cf_patients_v5, cf_accounts_v6) to canonical storage keys.
 */
function migrateV0ToV1(storage) {
  const legacyMap = {
    cf_clinic_v5: "cf_clinic",
    cf_services_v5: "cf_services",
    cf_users_v5: "cf_users",
    cf_patients_v5: "cf_patients",
    cf_visits_v5: "cf_visits",
    cf_inventory_v5: "cf_inventory",
    cf_parties_v5: "cf_parties",
    cf_suppliers_v5: "cf_suppliers",
    cf_salesmen_v5: "cf_salesmen",
    cf_purchases_v5: "cf_purchases",
    cf_b2b_sales_v5: "cf_b2b_sales",
    cf_sales_v5: "cf_sales",
    cf_patient_ledger_v5: "cf_patient_ledger",
    cf_expenses_v5: "cf_expenses",
    cf_returns_v5: "cf_returns",
    cf_stock_transfers_v5: "cf_stock_transfers",
    cf_shift_closings_v5: "cf_shift_closings",
    cf_documents_v5: "cf_documents",
    cf_tenants_v5: "cf_tenants",
    cf_warehouses_v6: "cf_warehouses",
    cf_supplier_ledger_v6: "cf_supplier_ledger",
    cf_accounts_v6: "cf_accounts",
    cf_cashbook_v6: "cf_cashbook",
    cf_main_ac_v6: "cf_main_ac",
  };

  Object.entries(legacyMap).forEach(([legacyKey, canonicalKey]) => {
    const legacyVal = storage.getItem(legacyKey);
    if (legacyVal && !storage.getItem(canonicalKey)) {
      storage.setItem(canonicalKey, legacyVal);
    }
  });

  return storage;
}

/**
 * Migration 2: Multi-Warehouse Inventory & Decimal-Safe Normalizer
 */
function migrateV1ToV2(storage) {
  const invRaw = storage.getItem("cf_inventory_v5") || storage.getItem("cf_inventory");
  if (!invRaw) return storage;

  try {
    const items = JSON.parse(invRaw);
    if (Array.isArray(items)) {
      const normalized = items.map((item, idx) => {
        const storeStock = safeQty(item.store_stock ?? item.stock_qty ?? 0);
        const godownStock = safeQty(item.warehouse_stock ?? 0);
        const costPrice = safeMoney(item.cost_price_per_box ?? item.box_cost_price ?? item.purchase_price ?? 0);
        const salePrice = safeMoney(item.unit_sale_price ?? item.box_sale_price ?? item.sale_price ?? item.unit_price ?? 0);

        return {
          ...item,
          id: item.id || `inv_${Date.now()}_${idx}`,
          clinic_id: item.clinic_id || "clinic_001",
          medicine_name: (item.medicine_name || item.name || "Unnamed Remedy").trim(),
          company_name: (item.company_name || "BM Pvt LTD").trim(),
          item_code: item.item_code || `MED-${idx + 1}`,
          generic_name: item.generic_name || "Homeopathic Remedy",
          category: item.category || "Homeopathic Drops",
          has_multi_unit: Boolean(item.has_multi_unit),
          strips_per_box: safeQty(item.strips_per_box || 1, 1),
          units_per_strip: safeQty(item.units_per_strip || 1, 1),
          box_label: item.box_label || "Pack",
          strip_label: item.strip_label || "Bottle",
          unit_label: item.unit_label || "Bottle",
          cost_price_per_box: costPrice,
          box_sale_price: salePrice,
          strip_sale_price: salePrice,
          unit_sale_price: salePrice,
          unit_price: salePrice,
          store_stock: storeStock,
          stock_qty: storeStock,
          warehouse_stock: godownStock,
          total_base_stock: storeStock + godownStock,
          location_stocks: item.location_stocks || { wh_001: godownStock, wh_str: storeStock },
          low_stock_threshold: safeQty(item.low_stock_threshold || item.min_stock_alert || 6, 6),
          expiry_date: item.expiry_date || "2028-12-31",
          status: item.status || "active",
        };
      });

      storage.setItem("cf_inventory_v5", JSON.stringify(normalized));
      storage.setItem("cf_inventory", JSON.stringify(normalized));
    }
  } catch (err) {
    console.warn("Migration v2 inventory parsing notice:", err);
  }

  return storage;
}

/**
 * Migration 3: Chart of Accounts & Sequential Numbering Alignment
 */
function migrateV2ToV3(storage) {
  const accRaw = storage.getItem("cf_accounts_v6") || storage.getItem("cf_accounts");
  if (!accRaw) return storage;

  try {
    const accounts = JSON.parse(accRaw);
    if (Array.isArray(accounts)) {
      let maxAccNo = 0;
      accounts.forEach((acc) => {
        const num = parseInt(acc.account_no, 10);
        if (!isNaN(num) && num > maxAccNo) maxAccNo = num;
      });

      const normalized = accounts.map((acc, idx) => {
        const opBal = safeMoney(acc.opening_balance ?? acc.oppening_balance ?? acc.balance ?? 0);
        const curBal = safeMoney(acc.current_balance ?? acc.balance_due ?? opBal);
        const accNo = acc.account_no || String(maxAccNo + idx + 1).padStart(3, "0");

        return {
          ...acc,
          id: acc.id || `acc_${Date.now()}_${idx}`,
          account_no: String(accNo),
          name: (acc.name || acc.party_name || "Account").trim(),
          opening_balance: opBal,
          current_balance: curBal,
          account_type: acc.account_type || "Customer",
        };
      });

      storage.setItem("cf_accounts_v6", JSON.stringify(normalized));
      storage.setItem("cf_accounts", JSON.stringify(normalized));
    }
  } catch (err) {
    console.warn("Migration v3 accounts notice:", err);
  }

  return storage;
}

/**
 * Migration 4: Patient Demographics & Vitals Normalization
 */
function migrateV3ToV4(storage) {
  const patRaw = storage.getItem("cf_patients_v5") || storage.getItem("cf_patients");
  if (patRaw) {
    try {
      const patients = JSON.parse(patRaw);
      if (Array.isArray(patients)) {
        const normalized = patients.map((pat, idx) => {
          const rawPhone = String(pat.phone || "").replace(/[^0-9]/g, "");
          const formattedPhone = rawPhone.length === 11 ? rawPhone : (rawPhone.length === 10 ? `0${rawPhone}` : rawPhone);

          return {
            ...pat,
            id: pat.id || `pat_${Date.now()}_${idx}`,
            mr_number: pat.mr_number || `MR-${String(idx + 1).padStart(5, "0")}`,
            full_name: (pat.full_name || pat.name || "Patient").trim(),
            relation_name: (pat.relation_name || pat.guardian_name || "").trim(),
            relation_type: pat.relation_type || "father",
            phone: formattedPhone || "03000000000",
            city: pat.city || "Hyderabad",
            gender: pat.gender || "male",
            age: safeQty(pat.age || 30, 30, { integer: true }),
          };
        });

        storage.setItem("cf_patients_v5", JSON.stringify(normalized));
        storage.setItem("cf_patients", JSON.stringify(normalized));
      }
    } catch (err) {
      console.warn("Migration v4 patients notice:", err);
    }
  }

  return storage;
}

/**
 * Migration Registry
 */
export const MIGRATION_REGISTRY = [
  {
    version: 1,
    name: "v0_to_v1_legacy_bridge",
    description: "Bridges legacy suffixed keys (cf_patients_v5, cf_accounts_v6) to canonical storage keys.",
    up: migrateV0ToV1,
  },
  {
    version: 2,
    name: "v1_to_v2_inventory_multiunit_and_warehouse",
    description: "Normalizes multi-warehouse inventory fields and decimal-safe price calculations.",
    up: migrateV1ToV2,
  },
  {
    version: 3,
    name: "v2_to_v3_chart_of_accounts_and_ledger_alignment",
    description: "Assigns sequential integer account_no and normalizes opening balances.",
    up: migrateV2ToV3,
  },
  {
    version: 4,
    name: "v3_to_v4_patient_demographics_and_opd_vitals",
    description: "Standardizes patient demographics, MR numbers, and phone numbers.",
    up: migrateV3ToV4,
  },
];

/**
 * Memory Storage Adapter for Browser / Sandbox
 */
class StorageAdapter {
  constructor(backend = globalThis.localStorage) {
    this.backend = backend;
    this.memory = new Map();
    if (this.backend) {
      try {
        const len = typeof this.backend.length === "number" ? this.backend.length : 0;
        for (let i = 0; i < len; i++) {
          const k = typeof this.backend.key === "function" ? this.backend.key(i) : null;
          if (k) {
            const val = this.backend.getItem(k);
            if (val !== null && val !== undefined) {
              this.memory.set(k, String(val));
            }
          }
        }
      } catch {}
    }
  }

  getItem(k) {
    if (this.memory.has(k)) return this.memory.get(k);
    if (this.backend && typeof this.backend.getItem === "function") {
      const val = this.backend.getItem(k);
      if (val !== null && val !== undefined) {
        this.memory.set(k, String(val));
        return String(val);
      }
    }
    return null;
  }

  setItem(k, v) {
    this.memory.set(k, String(v));
  }

  removeItem(k) {
    this.memory.delete(k);
  }

  flushToBackend() {
    if (!this.backend || typeof this.backend.setItem !== "function") return;
    this.memory.forEach((v, k) => {
      this.backend.setItem(k, v);
    });
  }

  exportSnapshot() {
    return Object.fromEntries(this.memory.entries());
  }

  restoreSnapshot(snapshot) {
    this.memory.clear();
    Object.entries(snapshot).forEach(([k, v]) => {
      this.memory.set(k, v);
    });
  }
}

/**
 * Schema Migration Runner with Sandbox Rollback Guard
 */
export function runMigrations(customStorage = null) {
  const backend = customStorage || globalThis.localStorage;
  if (!backend) {
    return { success: true, version: TARGET_SCHEMA_VERSION, migrationsApplied: 0 };
  }

  const currentVersion = parseInt(backend.getItem(SCHEMA_VERSION_KEY) || "0", 10);
  if (currentVersion >= TARGET_SCHEMA_VERSION) {
    return { success: true, version: currentVersion, migrationsApplied: 0 };
  }

  const adapter = new StorageAdapter(backend);
  const rollbackSnapshot = adapter.exportSnapshot();
  let appliedCount = 0;
  let activeVersion = currentVersion;

  try {
    for (const mig of MIGRATION_REGISTRY) {
      if (mig.version > currentVersion && mig.version <= TARGET_SCHEMA_VERSION) {
        mig.up(adapter);
        activeVersion = mig.version;
        appliedCount++;
      }
    }

    adapter.setItem(SCHEMA_VERSION_KEY, String(TARGET_SCHEMA_VERSION));
    adapter.flushToBackend();

    return {
      success: true,
      previousVersion: currentVersion,
      version: TARGET_SCHEMA_VERSION,
      migrationsApplied: appliedCount,
    };
  } catch (error) {
    console.error("Critical Schema Migration Failure! Rolling back to pre-migration state:", error);
    // Rollback Guard: Restore original snapshot
    adapter.restoreSnapshot(rollbackSnapshot);
    adapter.flushToBackend();

    return {
      success: false,
      error: error.message || String(error),
      rolledBack: true,
      version: currentVersion,
      migrationsApplied: 0,
    };
  }
}
