file_path = "e:/Soft/DrCreate/ClinicFlow/frontend/src/api/db.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

import re

# 1. Update SEEDED key
content = re.sub(r'SEEDED:\s*"[^"]+"', 'SEEDED:           "cf_seeded_v14_absolute_ground_zero_wipe"', content)

# 2. Clean dbAccounts.getAll
old_accounts_pattern = re.compile(r"export const dbAccounts = \{\s*getAll: \(\) => \{[\s\S]*?return list;\s*\},", re.MULTILINE)
new_accounts = """export const dbAccounts = {
  getAll: () => getCollection(KEYS.ACCOUNTS) || [],"""
content = old_accounts_pattern.sub(new_accounts, content)

# 3. Add initDB at the end if not present
init_db_code = """

// ---------- Initialize DB (Ground Zero Clean Production Mode) ----------
export function initDB() {
  if (localStorage.getItem(KEYS.SEEDED)) {
    return;
  }

  // Clear all previous keys to wipe stale demo cache
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("cf_") || k === "cf_session")) {
        localStorage.removeItem(k);
      }
    }
  } catch {}

  _COLLECTION_CACHE.clear();
  _ID_MAP_CACHE.clear();

  localStorage.setItem(KEYS.CLINIC, JSON.stringify(SEED_DATA.clinic));
  localStorage.setItem(KEYS.SERVICES, JSON.stringify([]));
  localStorage.setItem(KEYS.USERS, JSON.stringify([]));
  localStorage.setItem(KEYS.PATIENTS, JSON.stringify([]));
  localStorage.setItem(KEYS.VISITS, JSON.stringify([]));
  localStorage.setItem(KEYS.INVENTORY, JSON.stringify([]));
  localStorage.setItem(KEYS.PARTIES, JSON.stringify([]));
  localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify([]));
  localStorage.setItem(KEYS.SALESMEN, JSON.stringify([]));
  localStorage.setItem(KEYS.PURCHASES, JSON.stringify([]));
  localStorage.setItem(KEYS.B2B_SALES, JSON.stringify([]));
  localStorage.setItem(KEYS.SALES, JSON.stringify([]));
  localStorage.setItem(KEYS.PATIENT_LEDGER, JSON.stringify([]));
  localStorage.setItem(KEYS.EXPENSES, JSON.stringify([]));
  localStorage.setItem(KEYS.RETURNS, JSON.stringify([]));
  localStorage.setItem(KEYS.STOCK_TRANSFERS, JSON.stringify([]));
  localStorage.setItem(KEYS.SHIFT_CLOSINGS, JSON.stringify([]));
  localStorage.setItem(KEYS.DOCUMENTS, JSON.stringify([]));
  localStorage.setItem(KEYS.TENANTS, JSON.stringify(SEED_DATA.tenants || []));
  localStorage.setItem(KEYS.WAREHOUSES, JSON.stringify(SEED_DATA.warehouses || []));
  localStorage.setItem(KEYS.SUPPLIER_LEDGER, JSON.stringify([]));
  localStorage.setItem(KEYS.ACCOUNTS, JSON.stringify([]));
  localStorage.setItem(KEYS.CASHBOOK, JSON.stringify([]));

  localStorage.setItem(KEYS.SEEDED, "1");
}

export function resetDatabaseToDemoData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem("cf_session");
  _COLLECTION_CACHE.clear();
  _ID_MAP_CACHE.clear();
  initDB();
  try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
}

// Auto-run initDB immediately
try {
  initDB();
} catch {}
"""

if "export function initDB" not in content:
    content += init_db_code

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: DB.JS GROUND ZERO WITH initDB CONFIGURED!")
