import {
  safeNum,
  safeMoney,
  safeQty,
  safeAdd,
  safeSub,
  safeMul,
  safeDiv,
  calculateLineDiscount,
  calculateInvoiceFinancials,
} from "./arithmetic.js";
import { runMigrations, SCHEMA_VERSION_KEY, TARGET_SCHEMA_VERSION, MIGRATION_REGISTRY } from "./migrations.js";
import {
  mergePatientEntity,
  reconcileInventoryWithDeltas,
  reconcileSystemSettings,
  calculateShiftDrift,
} from "./conflictResolver.js";
import { decorateRecordLineage, stripLineageMetadata, getActiveSessionUser } from "./lineage.js";
import { telemetry } from "./telemetry.js";
import { storageDriver, isTauri, waitForDiskCache, getDataPath } from "./storageDriver.js";
import { downloadCSV } from "../utils/formatters.js";

// Re-export arithmetic & conflict resolution helpers for consumer modules
export {
  safeNum,
  safeMoney,
  safeQty,
  safeAdd,
  safeSub,
  safeMul,
  safeDiv,
  calculateLineDiscount,
  calculateInvoiceFinancials,
  runMigrations,
  SCHEMA_VERSION_KEY,
  TARGET_SCHEMA_VERSION,
  mergePatientEntity,
  reconcileInventoryWithDeltas,
  reconcileSystemSettings,
  calculateShiftDrift,
  decorateRecordLineage,
  stripLineageMetadata,
  getActiveSessionUser,
  telemetry,
};

// Dynamic date helpers to keep mock data relative to the current calendar date
function getRelativeISOString(daysOffset, hoursOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  if (hoursOffset) d.setHours(d.getHours() + hoursOffset);
  return d.toISOString();
}



/**
 * Cryptographically Secure Salt Generator (16-byte hex)
 */
export function generateSalt(byteLength = 16) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  let salt = "";
  for (let i = 0; i < byteLength * 2; i++) {
    salt += Math.floor(Math.random() * 16).toString(16);
  }
  return salt;
}

/**
 * Pure JavaScript RFC 6234 Compliant Constant-Time Synchronous SHA-256 Engine.
 * Operates synchronously in Browser, Node.js, Web Worker, and PWA offline contexts.
 */
export function sha256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = "length";
  let i, j;
  let result = "";

  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [];
  const k = [];
  let primeCounter = 0;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += "\x80";
  while ((ascii[lengthProperty] % 64) - 56) ascii += "\x00";
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return ""; // Non-ASCII safeguard
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = [...hash];

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0)) | 0;
      const temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    const current = hash[i];
    for (j = 28; j >= 0; j -= 4) {
      result += ((current >>> j) & 0xf).toString(16);
    }
  }
  return result;
}

/**
 * WebCrypto API Asynchronous SHA-256 Helper
 */
export async function sha256WebCrypto(message) {
  if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Sync(message);
}

/**
 * Synchronous Salted SHA-256 Password Hasher.
 * Produces format: cf_s256$<salt>$<hash_hex>
 */
export function hashPassword(plain, explicitSalt = null) {
  if (!plain) return "";
  const salt = explicitSalt || generateSalt(16);
  const digest = sha256Sync(salt + "::" + plain);
  return `cf_s256$${salt}$${digest}`;
}

/**
 * Multi-tier Password Verifier supporting modern Salted SHA-256, legacy DJB2, raw SHA-256, and plaintext.
 */
export function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;
  const input = String(plainPassword).trim();
  const stored = String(storedHash).trim();

  // 1. Modern Salted SHA-256 (cf_s256$<salt>$<hash>)
  if (stored.startsWith("cf_s256$")) {
    const parts = stored.split("$");
    if (parts.length === 3) {
      const salt = parts[1];
      const targetHash = parts[2];
      const computedHash = sha256Sync(salt + "::" + input);
      return computedHash === targetHash;
    }
  }

  // 2. Legacy DJB2 hash (hashed_xxxxxxxx)
  if (stored.startsWith("hashed_")) {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
    }
    const legacyHash = "hashed_" + hash.toString(16).padStart(8, "0");
    return stored === legacyHash;
  }

  // 3. Raw SHA-256 (64 hex characters)
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    return sha256Sync(input).toLowerCase() === stored.toLowerCase();
  }

  // 4. Plaintext matching
  return stored === input;
}

import MASTER_MEDICINES from "./master_medicines_seed.json" with { type: "json" };
import MASTER_SUPPLIERS from "./master_suppliers_seed.json" with { type: "json" };
import MASTER_PARTIES from "./master_parties_seed.json" with { type: "json" };
import MASTER_ACCOUNTS from "./master_accounts_seed.json" with { type: "json" };

function todayAt(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const DEFAULT_WAREHOUSES = [];

const SEED_DATA = {
  clinic: {
    id: "clinic_001",
    name: "H/Dr.Asif Ashraf Khan Clinic Medical Store",
    logo_url: "",
    address: "Lajpat Road, Hyderabad, Sindh",
    phone: "03473100304",
    default_consultation_fee: 300,
    clinic_status: "open",
    clinic_status_note: "",
    public_notice: "",
    resend_api_key: "",
    notification_email: "drasifhosting@gmail.com",
    report_frequency: "daily_9pm",
    created_at: new Date().toISOString(),
  },
  clinic_services: [],
  users: [
    {
      id: "user_admin_001",
      name: "Clinic Administrator",
      role: "admin",
      pin: hashPassword("7860"),
      password: hashPassword("7860"),
      password_hash: hashPassword("7860"),
      is_owner: true,
      is_principal_doctor: false,
      can_view_financials: true,
      can_give_discounts: true,
      max_discount_pct: 100,
      status: "active",
      created_at: new Date().toISOString(),
    }
  ],
  patients: [],
  visits: [],
  inventory: [],
  parties: [],
  suppliers: [],
  accounts: [],
  salesmen: [],
  b2b_sales: [],
  stock_transfers: [],
  sales: [],
  patient_ledger: [],
  expenses: [],
  returns: [],
  shift_closings: [],
  documents: [],
  tenants: [],
  warehouses: DEFAULT_WAREHOUSES,
  supplier_ledger: []
};

// ---------- Storage Keys ----------
export const KEYS = {
  SEEDED:           "cf_seeded_v16_vps_primary",
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
  LICENSE:          "cf_license_config_v1",
  OUTBOX:           "cf_sync_outbox_v1",
  AUDIT_LOGS:       "cf_audit_logs_v1",
  STOCK_MOVEMENTS:  "cf_stock_movements_v1",
  MEDICINE_BATCHES: "cf_medicine_batches_v1",
  TRANSACTIONS:     "cf_transactions_v1",
  APPROVALS:        "cf_approvals_v1",
  ADMIN_MASTER_PASSCODE: "cf_admin_master_passcode",
  ADMIN_TAB_PIN:         "cf_admin_tab_pin",
  ADMIN_TAB_SECURITY:    "cf_admin_tab_security",
  CATEGORIES:            "cf_medicine_categories_v1",
  COMPANIES:             "cf_medicine_companies_v1",
};

// High-performance In-Memory Memoization Cache for Zero-Lag Operations
export const _COLLECTION_CACHE = new Map();
export const _ID_MAP_CACHE = new Map();
let _collectionChangeHook = null;

let _statusUpdateScheduled = false;
export function notifyStatusUpdate() {
  if (_statusUpdateScheduled) return;
  _statusUpdateScheduled = true;
  const dispatch = () => {
    _statusUpdateScheduled = false;
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("clinicflow_status_update"));
      }
    } catch {}
  };
  if (typeof queueMicrotask === "function") {
    queueMicrotask(dispatch);
  } else {
    setTimeout(dispatch, 0);
  }
}

export function registerCollectionChangeHook(cb) {
  _collectionChangeHook = cb;
}

/**
 * Returns local Pakistan Standard Time (UTC+5) date string as YYYY-MM-DD.
 * Prevents timezone midnight shift causing tokens to resolve to the previous UTC day.
 */
function getPKTDateStr(date = new Date()) {
  const d = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date(date);
  if (!d || isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  return pkt.toISOString().split("T")[0];
}

export function getCollection(key) {
  try {
    const raw = storageDriver.getItem(key);
    if (!raw) return [];

    const cached = _COLLECTION_CACHE.get(key);
    if (cached && cached.raw === raw) {
      return cached.parsed;
    }

    const parsed = JSON.parse(raw);
    _COLLECTION_CACHE.set(key, { raw, parsed });

    if (Array.isArray(parsed)) {
      const idMap = new Map();
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (item && item.id) idMap.set(item.id, item);
      }
      _ID_MAP_CACHE.set(key, idMap);
    }

    return parsed;
  } catch {
    return [];
  }
}

export function getFromCollectionById(key, id) {
  if (!id) return null;
  getCollection(key); // Ensures cache and ID index are hot
  const idMap = _ID_MAP_CACHE.get(key);
  if (idMap && idMap.has(id)) {
    return idMap.get(id);
  }
  return null;
}

export function getScopedRecordById(key, id) {
  const record = getFromCollectionById(key, id);
  if (!record) return null;
  const user = getActiveSessionUser();
  if (user && (user.role === "warehouse" || user.role === "warehouse_incharge") && !user.is_owner && user.role !== "admin") {
    const userWh = user.assigned_warehouse_id;
    if (userWh && record.warehouse_id && record.warehouse_id !== userWh) {
      return null; // Fail closed: DENY cross-warehouse access to WH-B record for WH-A user
    }
  }
  return record;
}

export function setCollection(key, data) {
  try {
    const raw = JSON.stringify(data);
    const cached = _COLLECTION_CACHE.get(key);
    if (cached && cached.raw === raw) {
      return; // Deduplicate writes to prevent infinite event loop triggers!
    }
    _COLLECTION_CACHE.set(key, { raw, parsed: data });

    if (Array.isArray(data)) {
      const idMap = new Map();
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item && item.id) idMap.set(item.id, item);
      }
      _ID_MAP_CACHE.set(key, idMap);
    }

    storageDriver.setItem(key, raw);

    notifyStatusUpdate();

    if (_syncChannel) {
      try {
        _syncChannel.postMessage({ type: "SYNC_COLLECTION", key, timestamp: Date.now() });
      } catch {}
    }

    if (typeof _collectionChangeHook === "function") {
      try {
        _collectionChangeHook(key, data);
      } catch (hookErr) {
        console.warn("Collection change hook warning:", hookErr);
      }
    }
  } catch (e) {
    console.error("Failed to save collection to localStorage:", key, e);
  }
}

// Instant Cross-Tab Real-Time Live Sync Engine via BroadcastChannel & Storage Events
let _syncChannel = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    _syncChannel = new BroadcastChannel("clinicflow_realtime_sync");
    _syncChannel.onmessage = (event) => {
      if (event?.data?.key) {
        _COLLECTION_CACHE.delete(event.data.key);
        _ID_MAP_CACHE.delete(event.data.key);
      } else {
        _COLLECTION_CACHE.clear();
        _ID_MAP_CACHE.clear();
      }
      notifyStatusUpdate();
    };
  }
} catch (bcErr) {
  console.warn("BroadcastChannel not supported:", bcErr);
}

// Cross-Tab Cache Invalidation & Instant Reactive UI Dispatch
try {
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key && e.storageArea === localStorage) {
        _COLLECTION_CACHE.delete(e.key);
        _ID_MAP_CACHE.delete(e.key);
        notifyStatusUpdate();
      }
    });
  }
} catch {}

function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Factory Reset — wipes ALL local app data (all cf_* keys).
 * Used by Admin panel before importing a backup or doing a fresh VPS pull.
 * After calling this, the next syncEngine.pullLatestCloudState() will re-hydrate from VPS.
 */
export function factoryResetAllData() {
  try {
    // Collect all cf_* keys first (avoid modifying during iteration)
    const keysToRemove = [];
    for (let i = 0; i < storageDriver.length; i++) {
      const k = storageDriver.key(i);
      if (k && (k.startsWith("cf_") || k.startsWith("clinicflow_"))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => storageDriver.removeItem(k));

    // Wipe in-memory caches
    _COLLECTION_CACHE.clear();
    _ID_MAP_CACHE.clear();

    // Seed clean empty database arrays (0 inventory, 0 suppliers, 0 sales, 0 patients)
    storageDriver.setItem(KEYS.CLINIC, JSON.stringify(SEED_DATA.clinic));
    storageDriver.setItem(KEYS.USERS, JSON.stringify(SEED_DATA.users));
    storageDriver.setItem(KEYS.PATIENTS, JSON.stringify([]));
    storageDriver.setItem(KEYS.VISITS, JSON.stringify([]));
    storageDriver.setItem(KEYS.INVENTORY, JSON.stringify([]));
    storageDriver.setItem(KEYS.PARTIES, JSON.stringify([]));
    storageDriver.setItem(KEYS.SUPPLIERS, JSON.stringify([]));
    storageDriver.setItem(KEYS.SALESMEN, JSON.stringify([]));
    storageDriver.setItem(KEYS.PURCHASES, JSON.stringify([]));
    storageDriver.setItem(KEYS.B2B_SALES, JSON.stringify([]));
    storageDriver.setItem(KEYS.SALES, JSON.stringify([]));
    storageDriver.setItem(KEYS.PATIENT_LEDGER, JSON.stringify([]));
    storageDriver.setItem(KEYS.EXPENSES, JSON.stringify([]));

    // Notify all tabs
    if (_syncChannel) {
      try { _syncChannel.postMessage({ type: "FACTORY_RESET" }); } catch {}
    }
    notifyStatusUpdate();
    return true;
  } catch (e) {
    console.error("Factory reset failed:", e);
    return false;
  }
}

export function generateSequentialInvoiceNo(prefix = "INV") {
  const normPrefix = (prefix || "INV").toUpperCase();
  const counterKey = `cf_seq_${normPrefix}`;
  let currentSeq = parseInt(storageDriver.getItem(counterKey) || "1000", 10);
  if (isNaN(currentSeq) || currentSeq < 1000) currentSeq = 1000;

  // Scan all relevant database collections to find the absolute maximum numeric index already used
  let maxExisting = 0;
  const scanCollections = [];

  if (["POS", "INV", "WS", "WHO", "B2B", "SAL", "S", "W"].includes(normPrefix)) {
    scanCollections.push(getCollection(KEYS.SALES) || []);
    scanCollections.push(getCollection(KEYS.B2B_SALES) || []);
  } else if (["PUR", "GRN", "P"].includes(normPrefix)) {
    scanCollections.push(getCollection(KEYS.PURCHASES) || []);
  } else if (["REC", "PAY", "CBK"].includes(normPrefix)) {
    scanCollections.push(getCollection(KEYS.CASHBOOK) || []);
    scanCollections.push(getCollection(KEYS.SUPPLIER_LEDGER) || []);
  } else if (["TRF"].includes(normPrefix)) {
    scanCollections.push(getCollection(KEYS.STOCK_TRANSFERS) || []);
  }

  scanCollections.forEach((coll) => {
    (coll || []).forEach((item) => {
      const vNo = item.voucher_no || item.invoice_no || item.receipt_no || item.transfer_no || item.reference || "";
      if (typeof vNo === "string" && vNo.trim()) {
        const matches = vNo.match(/(\d+)/g);
        if (matches && matches.length > 0) {
          const num = parseInt(matches[matches.length - 1], 10);
          if (Number.isFinite(num) && num > maxExisting && num < 100000000) {
            maxExisting = num;
          }
        }
      }
    });
  });

  const nextVal = Math.max(currentSeq, maxExisting) + 1;
  storageDriver.setItem(counterKey, nextVal.toString());
  return `${normPrefix}-${nextVal}`;
}

export function formatStockBreakdown(item) {
  if (!item) return "0 In Stock";
  const wStock = item.warehouse_stock ?? 0;
  const sStock = item.store_stock ?? (item.stock_qty ?? 0);
  return `Godown: ${wStock} ${item.box_label || 'Packs'} | Counter: ${sStock} ${item.unit_label || 'Units'}`;
}

export function formatStockShort(item) {
  if (!item) return "0 Units";
  const sStock = item.store_stock ?? (item.stock_qty ?? 0);
  return `${sStock} ${item.unit_label || 'Units'}`;
}

// ---------- Initialize DB (Versioned Non-Destructive Migration Mode) ----------
export function initDB() {
  // 1. Run automated versioned schema migrations first
  try {
    runMigrations();
  } catch (migErr) {
    console.error("Schema migration runtime notice:", migErr);
  }

  // Mandatory One-Time Clean Purge of All Old Data & Accounts (Zero-Record Master Setup)
  try {
    if (!storageDriver.getItem("cf_purged_zero_v17")) {
      storageDriver.setItem(KEYS.PATIENTS, JSON.stringify([]));
      storageDriver.setItem(KEYS.VISITS, JSON.stringify([]));
      storageDriver.setItem(KEYS.INVENTORY, JSON.stringify([]));
      storageDriver.setItem(KEYS.PARTIES, JSON.stringify([]));
      storageDriver.setItem(KEYS.SUPPLIERS, JSON.stringify([]));
      storageDriver.setItem(KEYS.SALESMEN, JSON.stringify([]));
      storageDriver.setItem(KEYS.PURCHASES, JSON.stringify([]));
      storageDriver.setItem(KEYS.B2B_SALES, JSON.stringify([]));
      storageDriver.setItem(KEYS.SALES, JSON.stringify([]));
      storageDriver.setItem(KEYS.PATIENT_LEDGER, JSON.stringify([]));
      storageDriver.setItem(KEYS.EXPENSES, JSON.stringify([]));
      storageDriver.setItem(KEYS.RETURNS, JSON.stringify([]));
      storageDriver.setItem(KEYS.STOCK_TRANSFERS, JSON.stringify([]));
      storageDriver.setItem(KEYS.SHIFT_CLOSINGS, JSON.stringify([]));
      storageDriver.setItem(KEYS.DOCUMENTS, JSON.stringify([]));
      storageDriver.setItem(KEYS.WAREHOUSES, JSON.stringify([]));
      storageDriver.setItem(KEYS.ACCOUNTS, JSON.stringify([]));
      storageDriver.setItem(KEYS.SUPPLIER_LEDGER, JSON.stringify([]));
      storageDriver.setItem(KEYS.CASHBOOK, JSON.stringify([]));
      storageDriver.setItem(KEYS.STOCK_MOVEMENTS, JSON.stringify([]));
      storageDriver.setItem(KEYS.AUDIT_LOGS, JSON.stringify([]));
      storageDriver.setItem(KEYS.USERS, JSON.stringify(SEED_DATA.users));
      _COLLECTION_CACHE.clear();
      _ID_MAP_CACHE.clear();
      storageDriver.setItem("cf_purged_zero_v17", "1");
    }
  } catch (e) {}

  // 2. If already seeded or has existing clinical records, ensure essentials and return safely
  if (storageDriver.getItem(KEYS.SEEDED)) {
    return;
  }

  // Check if existing data is present in storage before creating defaults
  const hasExistingData = Boolean(
    storageDriver.getItem(KEYS.PATIENTS) ||
    storageDriver.getItem(KEYS.USERS) ||
    storageDriver.getItem(KEYS.INVENTORY) ||
    storageDriver.getItem("cf_patients_v5")
  );

  if (!hasExistingData) {
    _COLLECTION_CACHE.clear();
    _ID_MAP_CACHE.clear();

    storageDriver.setItem(KEYS.CLINIC, JSON.stringify(SEED_DATA.clinic));
    storageDriver.setItem(KEYS.SERVICES, JSON.stringify(SEED_DATA.clinic_services));
    storageDriver.setItem(KEYS.USERS, JSON.stringify(SEED_DATA.users));
    storageDriver.setItem(KEYS.PATIENTS, JSON.stringify([]));
    storageDriver.setItem(KEYS.VISITS, JSON.stringify([]));
    storageDriver.setItem(KEYS.INVENTORY, JSON.stringify([]));
    storageDriver.setItem(KEYS.PARTIES, JSON.stringify([]));
    storageDriver.setItem(KEYS.SUPPLIERS, JSON.stringify([]));
    storageDriver.setItem(KEYS.SALESMEN, JSON.stringify([]));
    storageDriver.setItem(KEYS.PURCHASES, JSON.stringify([]));
    storageDriver.setItem(KEYS.B2B_SALES, JSON.stringify([]));
    storageDriver.setItem(KEYS.SALES, JSON.stringify([]));
    storageDriver.setItem(KEYS.PATIENT_LEDGER, JSON.stringify([]));
    storageDriver.setItem(KEYS.EXPENSES, JSON.stringify([]));
    storageDriver.setItem(KEYS.RETURNS, JSON.stringify([]));
    storageDriver.setItem(KEYS.STOCK_TRANSFERS, JSON.stringify([]));
    storageDriver.setItem(KEYS.SHIFT_CLOSINGS, JSON.stringify([]));
    storageDriver.setItem(KEYS.DOCUMENTS, JSON.stringify([]));
    storageDriver.setItem(KEYS.TENANTS, JSON.stringify([]));
    storageDriver.setItem(KEYS.WAREHOUSES, JSON.stringify([]));
    storageDriver.setItem(KEYS.ACCOUNTS, JSON.stringify([]));
    storageDriver.setItem(KEYS.SUPPLIER_LEDGER, JSON.stringify([]));
    storageDriver.setItem(KEYS.CASHBOOK, JSON.stringify([]));
    storageDriver.setItem(KEYS.STOCK_MOVEMENTS, JSON.stringify([]));
    storageDriver.setItem(KEYS.AUDIT_LOGS, JSON.stringify([]));
  } else {
    // Ensure essential singletons and collections exist if missing
    if (!storageDriver.getItem(KEYS.CLINIC)) {
      storageDriver.setItem(KEYS.CLINIC, JSON.stringify(SEED_DATA.clinic));
    }
  }
  // PERMANENT PURGE: Clean all pre-seeded dummy parties, accounts, and godowns
  try {
    const rawUsers = storageDriver.getItem(KEYS.USERS);
    if (rawUsers) {
      const parsedUsers = JSON.parse(rawUsers);
      const cleanedUsers = parsedUsers.filter(u => u.email !== "admin@clinicore.pk" && u.id !== "user_admin");
      if (cleanedUsers.length !== parsedUsers.length) {
        storageDriver.setItem(KEYS.USERS, JSON.stringify(cleanedUsers));
        _COLLECTION_CACHE.delete(KEYS.USERS);
      }
    }
    
    // Purge mock parties
    storageDriver.setItem(KEYS.PARTIES, JSON.stringify([]));
    _COLLECTION_CACHE.delete(KEYS.PARTIES);

    // Purge mock accounts
    storageDriver.setItem(KEYS.ACCOUNTS, JSON.stringify([]));
    _COLLECTION_CACHE.delete(KEYS.ACCOUNTS);

    // Purge mock warehouses
    storageDriver.setItem(KEYS.WAREHOUSES, JSON.stringify([]));
    _COLLECTION_CACHE.delete(KEYS.WAREHOUSES);
  } catch (err) {}

  storageDriver.setItem(KEYS.LICENSE, JSON.stringify({
    license_status: "active", // "active" | "warning" | "grace_period" | "restricted" | "locked"
    monthly_fee: 5000,
    currency: "PKR",
    billing_cycle: "monthly",
    due_day: 1, // 1st of month
    warning_days_before: 5, // Show warning 5 days before due date
    grace_days: 10, // Grace period till 10th of month (no disruption)
    last_paid_date: new Date().toISOString().split("T")[0],
    next_due_date: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      return d.toISOString().split("T")[0];
    })(),
    is_hard_locked: false,
    restricted_features: [], // e.g. ["pos", "b2b", "reports", "consultation"]
    developer_phone: "03142291356",
    developer_whatsapp: "03142291356",
    developer_bank_details: "JazzCash / EasyPaisa / Bank Transfer: 03142291356 (K.B Software)",
    custom_notice: "",
    updated_at: new Date().toISOString(),
  }));
  storageDriver.setItem(KEYS.OUTBOX, JSON.stringify([]));

  storageDriver.setItem(KEYS.SEEDED, "1");
}

export function resetDatabaseToDemoData() {
  Object.values(KEYS).forEach((k) => storageDriver.removeItem(k));
  _COLLECTION_CACHE.clear();
  _ID_MAP_CACHE.clear();
  initDB();
  try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
}

/**
 * Detach all mock transactions (Visits, Sales, Purchases, CashBook, Expenses, Returns, Patients)
 * Keeps Master Data: Clinic Info, Users/Logins, Master Accounts, Medicine Catalog, Parties, Suppliers, Salesmen, Warehouses.
 */
export function clearAllTransactionalData() {
  const transactionalKeys = [
    KEYS.PATIENTS,
    KEYS.VISITS,
    KEYS.SALES,
    KEYS.B2B_SALES,
    KEYS.PURCHASES,
    KEYS.CASHBOOK,
    KEYS.EXPENSES,
    KEYS.RETURNS,
    KEYS.STOCK_TRANSFERS,
    KEYS.SHIFT_CLOSINGS,
    KEYS.SUPPLIER_LEDGER,
    KEYS.PATIENT_LEDGER,
    KEYS.DOCUMENTS,
  ];

  // Set all transactional tables to clean empty arrays
  transactionalKeys.forEach((k) => {
    storageDriver.setItem(k, JSON.stringify([]));
  });

  // Clear sequential counters and opening float caches
  try {
    for (let i = storageDriver.length - 1; i >= 0; i--) {
      const key = storageDriver.key(i);
      if (key && (key.startsWith("cf_seq_") || key.startsWith("cf_opening_cash_"))) {
        storageDriver.removeItem(key);
      }
    }
  } catch {}

  _COLLECTION_CACHE.clear();
  _ID_MAP_CACHE.clear();

  try {
    window.dispatchEvent(new Event("clinicflow_status_update"));
  } catch {}

  return { success: true, message: "Mock transactions detached. Clean zero-transaction setup active." };
}

// ---------- Clinic ----------
export const dbClinic = {
  get: () => {
    const raw = storageDriver.getItem(KEYS.CLINIC);
    let clinic = raw ? JSON.parse(raw) : { ...SEED_DATA.clinic };
    if (typeof window !== "undefined") {
      if (!clinic.resend_api_key) {
        clinic.resend_api_key = localStorage.getItem("cf_resend_api_key") || "";
      }
      if (!clinic.notification_email) {
        clinic.notification_email = localStorage.getItem("cf_notification_email") || "drasifhosting@gmail.com";
      }
      if (!clinic.report_frequency) {
        clinic.report_frequency = localStorage.getItem("cf_report_frequency") || "daily_9pm";
      }
      if (!clinic.whatsapp_gateway_no) {
        clinic.whatsapp_gateway_no = localStorage.getItem("cf_whatsapp_gateway_no") || "03473100304";
      }
      if (clinic.max_discount_limit_pct === undefined || clinic.max_discount_limit_pct === null) {
        clinic.max_discount_limit_pct = Number(localStorage.getItem("cf_max_discount_limit_pct")) || 28;
      }
    }
    return clinic;
  },
  update: (data) => {
    const current = dbClinic.get();
    const updated = { ...current, ...data };
    storageDriver.setItem(KEYS.CLINIC, JSON.stringify(updated));
    if (typeof window !== "undefined") {
      if (updated.resend_api_key !== undefined) localStorage.setItem("cf_resend_api_key", updated.resend_api_key);
      if (updated.notification_email !== undefined) localStorage.setItem("cf_notification_email", updated.notification_email);
      if (updated.report_frequency !== undefined) localStorage.setItem("cf_report_frequency", updated.report_frequency);
      if (updated.whatsapp_gateway_no !== undefined) localStorage.setItem("cf_whatsapp_gateway_no", updated.whatsapp_gateway_no);
      if (updated.max_discount_limit_pct !== undefined) localStorage.setItem("cf_max_discount_limit_pct", String(updated.max_discount_limit_pct));
    }
    try {
      window.dispatchEvent(new Event("clinicflow_status_update"));
    } catch {}
    if (typeof _collectionChangeHook === "function") {
      try {
        _collectionChangeHook(KEYS.CLINIC, updated);
      } catch {}
    }
    return updated;
  },

  updateClinicStatus: (status, note) => {
    return dbClinic.update({ clinic_status: status, clinic_status_note: note || "" });
  },
};

export function getMaxDiscountLimit() {
  try {
    const c = dbClinic.get();
    const val = Number(c?.max_discount_limit_pct);
    if (!isNaN(val) && val >= 0) return val;
  } catch {}
  return 28;
}

// ---------- Clinic Services ----------
export const dbClinicServices = {
  getAll: () => getCollection(KEYS.SERVICES),
  add: (service) => {
    const list = getCollection(KEYS.SERVICES);
    const newS = { ...service, id: generateId("ser"), clinic_id: "clinic_001" };
    setCollection(KEYS.SERVICES, [...list, newS]);
    return newS;
  },
  update: (id, data) => {
    const list = getCollection(KEYS.SERVICES);
    const updated = list.map((s) => (s.id === id ? { ...s, ...data } : s));
    setCollection(KEYS.SERVICES, updated);
  },
  delete: (id) => {
    const list = getCollection(KEYS.SERVICES);
    setCollection(KEYS.SERVICES, list.filter((s) => s.id !== id));
  },
};

// ---------- Users / Staff ----------
export const dbUsers = {
  getAll: () => {
    let list = getCollection(KEYS.USERS);
    // Purge legacy sample/demo doctor & staff profiles
    const DUMMY_IDS = ["user_1788046718402_3dsjz", "user_1788052208532_ojsa5", "user_1788052290147_6vdcm", "user_1788052389491_3eqmr", "user_1788052242123_oypkr"];
    if (Array.isArray(list) && list.length > 0) {
      list = list.filter((u) => !DUMMY_IDS.includes(u.id));
    }
    if (!list || list.length === 0) {
      list = SEED_DATA.users;
      setCollection(KEYS.USERS, list);
    }
    // Ensure primary admin account is always present and clean of doctor flags
    const hasAdmin = list.some((u) => u.id === "user_admin_001" || u.role === "admin" || u.role === "owner" || u.is_owner);
    if (!hasAdmin) {
      list = [...SEED_DATA.users, ...list];
      setCollection(KEYS.USERS, list);
    } else {
      // Auto-sanitize existing admin account in cache if previously saved with is_principal_doctor
      const adminIdx = list.findIndex((u) => u.id === "user_admin_001" || u.name === "Clinic Administrator");
      if (adminIdx !== -1 && list[adminIdx].is_principal_doctor) {
        list[adminIdx] = { ...list[adminIdx], is_principal_doctor: false, role: "admin" };
        setCollection(KEYS.USERS, list);
      }
    }
    return list;
  },
  getById: (id) => getFromCollectionById(KEYS.USERS, id),
  getByEmail: (email) => dbUsers.getAll().find((u) => u.email?.toLowerCase() === email?.toLowerCase()) || null,
  getDoctors: () => dbUsers.getAll().filter((u) => u.role === "doctor" && u.id !== "user_admin_001" && u.name !== "Clinic Administrator" && u.status !== "inactive" && u.status !== "deactivated"),
  getActiveStaff: (warehouseId = null) => {
    const all = dbUsers.getAll().filter((u) => u.status !== "inactive" && u.status !== "deactivated");
    if (!warehouseId) return all;
    return all.filter((u) => 
      !u.assigned_warehouse_id || 
      u.assigned_warehouse_id === warehouseId || 
      u.is_owner || 
      u.role === "admin" || 
      u.role === "owner"
    );
  },
  deactivate: (id) => {
    const users = getCollection(KEYS.USERS);
    const updated = users.map((u) => (u.id === id ? { ...u, status: "inactive", deactivated_at: new Date().toISOString() } : u));
    setCollection(KEYS.USERS, updated);
    const updatedRecord = updated.find((u) => u.id === id);
    if (updatedRecord && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("users", updatedRecord, "UPDATE", id);
    }
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return true;
  },
  reactivate: (id) => {
    const users = getCollection(KEYS.USERS);
    const updated = users.map((u) => (u.id === id ? { ...u, status: "active", deactivated_at: null } : u));
    setCollection(KEYS.USERS, updated);
    const updatedRecord = updated.find((u) => u.id === id);
    if (updatedRecord && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("users", updatedRecord, "UPDATE", id);
    }
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return true;
  },
  add: (user) => {
    const users = getCollection(KEYS.USERS);
    const passPlain = user.password || user.pin || "";
    const passHash = passPlain ? (passPlain.startsWith("cf_s256$") ? passPlain : hashPassword(passPlain)) : "";
    const newUser = { 
      ...user, 
      id: user.id || generateId("user"), 
      clinic_id: "clinic_001", 
      status: user.status || "active",
      assigned_warehouse_id: user.assigned_warehouse_id || "",
      can_give_discounts: user.can_give_discounts ?? true,
      max_discount_pct: Number(user.max_discount_pct) || 15,
      password: passHash,
      password_hash: passHash,
      created_at: new Date().toISOString()
    };
    setCollection(KEYS.USERS, [...users, newUser]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("users", newUser, "CREATE", newUser.id);
    }
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return newUser;
  },
  update: (id, data) => {
    const users = getCollection(KEYS.USERS);
    let updatedUser = null;
    const existingUser = dbUsers.getById(id);
    const updated = users.map((u) => {
      if (u.id === id || String(u.id) === String(id)) {
        let patch = { ...data };
        if (patch.password && !patch.password.startsWith("cf_s256$")) {
          const plain = String(patch.password).trim();
          patch.password_hash = hashPassword(plain);
          patch.password = patch.password_hash;
          patch.pin = plain;
          patch.plain_pin = plain;
          patch.cashier_pin = plain;
        } else if (patch.password_hash) {
          patch.password = patch.password_hash;
        }
        if (patch.pin) {
          const plainPin = String(patch.pin).trim();
          patch.plain_pin = plainPin;
          patch.cashier_pin = plainPin;
          if (!patch.password) {
            patch.password_hash = hashPassword(plainPin);
            patch.password = patch.password_hash;
          }
        }
        updatedUser = { ...u, ...patch };
        return updatedUser;
      }
      return u;
    });
    setCollection(KEYS.USERS, updated);
    if (updatedUser && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("users", updatedUser, "UPDATE", id);
    }
    if (existingUser) {
      const sanitizedBefore = { ...existingUser };
      delete sanitizedBefore.password;
      delete sanitizedBefore.password_hash;
      const sanitizedAfter = { ...updatedUser };
      delete sanitizedAfter.password;
      delete sanitizedAfter.password_hash;
      dbAuditLogs.logEvent({
        action: "UPDATE_USER_ACCOUNT",
        entity: "users",
        entity_id: id,
        before: sanitizedBefore,
        after: sanitizedAfter,
        reason: `Updated user profile/role for ${existingUser.name || id}`,
      });
    }
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updatedUser;
  },
  resetPassword: (id, newPlainPassword) => {
    if (!id || !newPlainPassword) return null;
    const plain = String(newPlainPassword).trim();
    const salted = hashPassword(plain);
    return dbUsers.update(id, {
      password: salted,
      password_hash: salted,
      pin: plain,
      plain_pin: plain,
      cashier_pin: plain,
    });
  },
  updateDoctorStatus: (doctorId, status, note, room) => {
    const users = getCollection(KEYS.USERS);
    const updated = users.map((u) =>
      u.id === doctorId
        ? { ...u, availability_status: status, status_note: note ?? u.status_note, room_number: room ?? u.room_number }
        : u
    );
    setCollection(KEYS.USERS, updated);
  },
  setPrincipalDoctor: (newPrincipalDoctorId) => {
    const users = dbUsers.getAll();
    const updated = users.map((u) => {
      if (u.id === newPrincipalDoctorId) {
        return { ...u, is_owner: true, can_view_financials: true, role: "doctor" };
      } else if (u.is_owner) {
        return { ...u, is_owner: false };
      }
      return u;
    });
    setCollection(KEYS.USERS, updated);
    return updated;
  },
  // Doctor Queue Handover: Transfer all pending waiting tokens from one doctor to another
  handoverDoctorQueue: (fromDoctorId, toDoctorId, auditNote = "") => {
    const visits = getCollection(KEYS.VISITS);
    const today = getPKTDateStr();
    let transferredCount = 0;
    const updated = visits.map((v) => {
      const isToday = getPKTDateStr(new Date(v.visit_date)) === today;
      const isPending = v.status === "waiting" || v.status === "in_consultation";
      if (isToday && isPending && v.doctor_id === fromDoctorId) {
        transferredCount++;
        return {
          ...v,
          doctor_id: toDoctorId,
          handover_note: auditNote || `Transferred from Dr. ${fromDoctorId} to Dr. ${toDoctorId}`,
          handover_at: new Date().toISOString(),
        };
      }
      return v;
    });
    setCollection(KEYS.VISITS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return transferredCount;
  },
  delete: (id) => {
    const existing = dbUsers.getById(id);
    const users = getCollection(KEYS.USERS);
    setCollection(KEYS.USERS, users.filter((u) => u.id !== id));
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("users", { id }, "DELETE", id);
    }
    if (existing) {
      const sanitized = { ...existing };
      delete sanitized.password;
      delete sanitized.password_hash;
      dbAuditLogs.logEvent({
        action: "DELETE_USER_ACCOUNT",
        entity: "users",
        entity_id: id,
        before: sanitized,
        after: null,
        reason: `Deleted user account ${existing.name || id} (${existing.role})`,
      });
    }
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
  },
};

// ---------- Clinical Vitals Sanitization & Range Validator ----------
export function parseAndValidateVitals(raw = {}) {
  const clean = {
    vitals_bp: "",
    vitals_pulse: "",
    vitals_temp: "",
    vitals_spo2: "",
    vitals_weight: "",
    vitals_sugar: "",
  };

  if (raw.vitals_bp) {
    const bpStr = String(raw.vitals_bp).trim();
    const match = bpStr.match(/^(\d{2,3})\s*[\/\-]\s*(\d{2,3})(?:\s*mmHg)?$/i);
    if (match) {
      const sys = parseInt(match[1], 10);
      const dia = parseInt(match[2], 10);
      if (sys >= 50 && sys <= 260 && dia >= 30 && dia <= 160 && sys > dia) {
        clean.vitals_bp = `${sys}/${dia}`;
      }
    }
  }

  if (raw.vitals_pulse) {
    const val = parseInt(String(raw.vitals_pulse).replace(/\D/g, ""), 10);
    if (Number.isFinite(val) && val >= 30 && val <= 250) {
      clean.vitals_pulse = String(val);
    }
  }

  if (raw.vitals_temp) {
    const num = parseFloat(String(raw.vitals_temp).replace(/[^\d.]/g, ""));
    if (Number.isFinite(num)) {
      if (num >= 90.0 && num <= 110.0) {
        clean.vitals_temp = num.toFixed(1);
      } else if (num >= 32.0 && num <= 43.0) {
        clean.vitals_temp = ((num * 9 / 5) + 32).toFixed(1);
      }
    }
  }

  if (raw.vitals_spo2) {
    const val = parseInt(String(raw.vitals_spo2).replace(/\D/g, ""), 10);
    if (Number.isFinite(val) && val >= 50 && val <= 100) {
      clean.vitals_spo2 = `${val}%`;
    }
  }

  if (raw.vitals_weight) {
    const val = parseFloat(String(raw.vitals_weight).replace(/[^\d.]/g, ""));
    if (Number.isFinite(val) && val >= 0.5 && val <= 350.0) {
      clean.vitals_weight = `${val.toFixed(1)} kg`;
    }
  }

  if (raw.vitals_sugar) {
    const val = parseInt(String(raw.vitals_sugar).replace(/\D/g, ""), 10);
    if (Number.isFinite(val) && val >= 20 && val <= 1000) {
      clean.vitals_sugar = `${val} mg/dL`;
    }
  }

  return clean;
}

export function normalizePhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length === 12) {
    return "0" + digits.slice(2);
  }
  if (digits.length === 10 && !digits.startsWith("0")) {
    return "0" + digits;
  }
  return digits;
}

// ---------- Patients ----------
export const dbPatients = {
  getAll: () => getCollection(KEYS.PATIENTS),
  getById: (id) => getFromCollectionById(KEYS.PATIENTS, id),
  search: (query) => {
    if (!query || query.trim() === "") return getCollection(KEYS.PATIENTS);
    const q = query.trim().toLowerCase();
    const qClean = normalizePhone(q);
    return getCollection(KEYS.PATIENTS).filter((p) => {
      const pPhoneClean = normalizePhone(p.phone);
      return (
        (p.full_name || "").toLowerCase().includes(q) ||
        (p.mr_number || "").toLowerCase().includes(q) ||
        (p.phone || "").includes(q) ||
        (qClean && pPhoneClean && pPhoneClean.includes(qClean)) ||
        (p.relation_name || "").toLowerCase().includes(q) ||
        (p.cnic || "").includes(q)
      );
    });
  },
  add: (patient) => {
    const patients = getCollection(KEYS.PATIENTS);
    const nextSeq = patients.length + 1;
    const mrNumber = patient.mr_number || `MR-${String(nextSeq).padStart(5, "0")}`;
    const cleanPhone = normalizePhone(patient.phone) || patient.phone || "";
    const newPat = {
      ...patient,
      id: generateId("pat"),
      clinic_id: "clinic_001",
      mr_number: mrNumber,
      phone: cleanPhone,
      created_at: new Date().toISOString(),
    };
    setCollection(KEYS.PATIENTS, [newPat, ...patients]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("patients", newPat, "CREATE", newPat.id);
    }
    return newPat;
  },
  update: (id, data) => {
    const patients = getCollection(KEYS.PATIENTS);
    const updated = patients.map((p) => (p.id === id ? { ...p, ...data } : p));
    setCollection(KEYS.PATIENTS, updated);
    const updatedRecord = updated.find((p) => p.id === id);
    if (updatedRecord && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("patients", updatedRecord, "UPDATE", id);
    }
    return updatedRecord || null;
  },
  delete: (id) => {
    // 1. Remove patient record
    const patients = getCollection(KEYS.PATIENTS);
    setCollection(KEYS.PATIENTS, patients.filter((p) => p.id !== id));
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("patients", { id }, "DELETE", id);
    }

    // 2. Cascade delete visits and prescription photos
    const visits = getCollection(KEYS.VISITS);
    setCollection(KEYS.VISITS, visits.filter((v) => v.patient_id !== id));

    // 3. Cascade delete patient documents
    const docs = getCollection(KEYS.DOCUMENTS);
    setCollection(KEYS.DOCUMENTS, docs.filter((d) => d.patient_id !== id));

    // 4. Cascade delete patient ledger entries
    const ledger = getCollection(KEYS.PATIENT_LEDGER);
    setCollection(KEYS.PATIENT_LEDGER, ledger.filter((l) => l.patient_id !== id));

    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return true;
  },
  bulkWipeout: (ids = []) => {
    if (!ids || ids.length === 0) return 0;
    const idSet = new Set(ids);

    const patients = getCollection(KEYS.PATIENTS);
    setCollection(KEYS.PATIENTS, patients.filter((p) => !idSet.has(p.id)));

    const visits = getCollection(KEYS.VISITS);
    setCollection(KEYS.VISITS, visits.filter((v) => !idSet.has(v.patient_id)));

    const docs = getCollection(KEYS.DOCUMENTS);
    setCollection(KEYS.DOCUMENTS, docs.filter((d) => !idSet.has(d.patient_id)));

    const ledger = getCollection(KEYS.PATIENT_LEDGER);
    setCollection(KEYS.PATIENT_LEDGER, ledger.filter((l) => !idSet.has(l.patient_id)));

    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return ids.length;
  },
  // Auto-Purge patients with no visits older than retentionMonths (default: 12 or 24 months)
  autoPurgeExpiredPatients: (retentionMonths = 24) => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

    const allVisits = getCollection(KEYS.VISITS);
    const allPatients = getCollection(KEYS.PATIENTS);

    // Map each patient's latest visit date
    const latestVisitMap = new Map();
    allVisits.forEach((v) => {
      const vDate = new Date(v.visit_date || v.created_at || 0);
      if (!latestVisitMap.has(v.patient_id) || vDate > latestVisitMap.get(v.patient_id)) {
        latestVisitMap.set(v.patient_id, vDate);
      }
    });

    const expiredPatientIds = [];
    allPatients.forEach((p) => {
      const lastVisit = latestVisitMap.get(p.id) || new Date(p.created_at || 0);
      if (lastVisit < cutoffDate) {
        expiredPatientIds.push(p.id);
      }
    });

    if (expiredPatientIds.length > 0) {
      console.log(`🧹 Auto-Retention Lifecycle: Purging ${expiredPatientIds.length} inactive patients older than ${retentionMonths} months...`);
      dbPatients.bulkWipeout(expiredPatientIds);
    }
    return expiredPatientIds.length;
  },
};

// ---------- Visits & Queue ----------
export const dbVisits = {
  getAll: () => {
    let list = getCollection(KEYS.VISITS);
    if (!storageDriver.getItem(KEYS.VISITS)) {
      list = SEED_DATA.visits || [];
      setCollection(KEYS.VISITS, list);
    }
    return list || [];
  },
  delete: (id) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.filter((v) => v.id !== id);
    setCollection(KEYS.VISITS, updated);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("visits", { id }, "DELETE", id);
    }
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updated;
  },
  update: (id, data) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.map((v) => (v.id === id ? { ...v, ...data } : v));
    setCollection(KEYS.VISITS, updated);
    const updatedRecord = updated.find((v) => v.id === id);
    if (updatedRecord && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("visits", updatedRecord, "UPDATE", id);
    }
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updatedRecord || null;
  },
  getById: (id) => getFromCollectionById(KEYS.VISITS, id),
  getByPatient: (patientId) => dbVisits.getAll().filter((v) => v.patient_id === patientId),
  getToday: (doctorId = null) => {
    const today = getPKTDateStr();
    return getCollection(KEYS.VISITS).filter((v) => {
      const isToday = getPKTDateStr(new Date(v.visit_date)) === today;
      if (!isToday) return false;
      if (!doctorId) return true;
      return v.doctor_id === doctorId || (!v.doctor_id && (doctorId === "user_owner" || doctorId === "user_001")) || (v.doctor_id === "user_001" && doctorId === "user_owner");
    });
  },
  getTodayAll: (doctorId = null) => {
    const today = getPKTDateStr();
    const rawVisits = getCollection(KEYS.VISITS) || [];
    const patients = getCollection(KEYS.PATIENTS) || [];
    const patientMap = new Map();
    for (let i = 0; i < patients.length; i++) {
      if (patients[i] && patients[i].id) patientMap.set(patients[i].id, patients[i]);
    }
    const users = getCollection(KEYS.USERS) || [];
    const userMap = new Map();
    for (let i = 0; i < users.length; i++) {
      if (users[i] && users[i].id) userMap.set(users[i].id, users[i]);
    }

    return rawVisits
      .filter((v) => {
        const isToday = getPKTDateStr(new Date(v.visit_date)) === today;
        if (!isToday) return false;
        if (!doctorId) return true;
        return v.doctor_id === doctorId || (!v.doctor_id && (doctorId === "user_owner" || doctorId === "user_001")) || (v.doctor_id === "user_001" && doctorId === "user_owner");
      })
      .map((v) => {
        const pat = patientMap.get(v.patient_id);
        const doc = userMap.get(v.doctor_id);
        return {
          ...v,
          patient_name: v.patient_name || pat?.full_name || pat?.name || "Patient",
          patient_phone: v.patient_phone || pat?.phone || "",
          patient_mr_number: v.patient_mr_number || pat?.mr_number || "",
          doctor_name: v.doctor_name || doc?.name || "Doctor",
        };
      })
      .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));
  },
  getTodayQueue: (doctorId = null) => {
    const today = getPKTDateStr();
    return getCollection(KEYS.VISITS)
      .filter((v) => {
        const isToday = getPKTDateStr(new Date(v.visit_date)) === today;
        const isQueueStatus = v.status === "waiting" || v.status === "in_consultation" || v.status === "skipped";
        if (!isToday || !isQueueStatus) return false;
        if (!doctorId) return true;
        return v.doctor_id === doctorId || (!v.doctor_id && (doctorId === "user_owner" || doctorId === "user_001")) || (v.doctor_id === "user_001" && doctorId === "user_owner");
      })
      .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));
  },
  getByDoctor: (doctorId) => {
    const today = getPKTDateStr();
    return getCollection(KEYS.VISITS)
      .filter((v) => {
        const isToday = getPKTDateStr(new Date(v.visit_date)) === today;
        if (!isToday) return false;
        return v.doctor_id === doctorId || (!v.doctor_id && (doctorId === "user_owner" || doctorId === "user_001")) || (v.doctor_id === "user_001" && doctorId === "user_owner");
      })
      .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));
  },
  getPendingReports: () => {
    return getCollection(KEYS.VISITS).filter((v) => v.status === "completed_reports_pending");
  },
  nextTokenNumber: () => {
    const today = getPKTDateStr();
    const todayVisits = getCollection(KEYS.VISITS).filter(
      (v) => getPKTDateStr(new Date(v.visit_date)) === today
    );
    const maxToken = todayVisits.reduce((max, v) => Math.max(max, v.token_number || 0), 0);
    return maxToken + 1;
  },
  add: (visit) => {
    const visits = getCollection(KEYS.VISITS);
    const token_number = dbVisits.nextTokenNumber();
    const activeCashier = typeof window !== "undefined" && typeof window.getActiveCashier === "function" ? window.getActiveCashier() : null;
    const cashierId = visit.cashier_id || visit.active_cashier_id || activeCashier?.id || "user_admin";
    const cashierName = visit.cashier_name || visit.active_cashier_name || activeCashier?.name || "Front Desk";

    const pat = visit.patient_id ? dbPatients.getById(visit.patient_id) : null;
    const doc = visit.doctor_id ? dbUsers.getById(visit.doctor_id) : null;
    const patName = visit.patient_name || pat?.full_name || pat?.name || "Patient";

    const newVisit = {
      ...visit,
      id: generateId("visit"),
      clinic_id: "clinic_001",
      token_number,
      patient_name: patName,
      doctor_name: visit.doctor_name || doc?.name || "Doctor",
      status: visit.status || "waiting",
      visit_date: visit.visit_date || new Date().toISOString(),
      prescription_image_url: null,
      notes: visit.notes || "",
      doctor_id: visit.doctor_id || "user_owner",
      fee_status: visit.fee_status || (visit.fee_amount > 0 ? "paid" : "unpaid"),
      cashier_id: cashierId,
      cashier_name: cashierName,
      active_cashier_id: cashierId,
      active_cashier_name: cashierName,
    };
    setCollection(KEYS.VISITS, [newVisit, ...visits]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("visits", newVisit, "CREATE", newVisit.id);
    }
    dbAuditLogs.logEvent({
      action: "PATIENT_REGISTERED",
      entity: "visits",
      entity_id: newVisit.id,
      actor_id: cashierId,
      actor_name: cashierName,
      reason: `Registered patient ${newVisit.patient_name || 'Patient'} for OPD Token #${newVisit.token_number} (Fee: Rs. ${newVisit.fee_amount || 0})`,
      after: newVisit,
    });
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return newVisit;
  },
  create: (visit) => dbVisits.add(visit),
  getQueue: (doctorId) => dbVisits.getTodayQueue(doctorId),
  updateStatus: (id, status) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.map((v) => (v.id === id ? { ...v, status } : v));
    setCollection(KEYS.VISITS, updated);
    const updatedRecord = updated.find((v) => v.id === id);
    if (updatedRecord && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("visits", updatedRecord, "UPDATE", id);
    }
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updatedRecord || null;
  },
  amendVisit: (id, { notes, vitals, diagnosis, reason, actor_id, actor_name } = {}) => {
    const visits = getCollection(KEYS.VISITS);
    const target = visits.find((v) => v.id === id);
    if (!target) return { success: false, error: "Visit not found" };

    const amendments = [...(target.amendments || [])];
    const beforeSnapshot = {
      notes: target.notes || "",
      vitals_bp: target.vitals_bp || "",
      vitals_pulse: target.vitals_pulse || "",
      vitals_temp: target.vitals_temp || "",
      vitals_spo2: target.vitals_spo2 || "",
      vitals_weight: target.vitals_weight || "",
      vitals_sugar: target.vitals_sugar || "",
      diagnosis: target.diagnosis || "",
    };

    const cleanVitals = vitals ? parseAndValidateVitals(vitals) : {};

    const afterSnapshot = {
      notes: notes !== undefined ? notes : target.notes || "",
      vitals_bp: cleanVitals.vitals_bp || target.vitals_bp || "",
      vitals_pulse: cleanVitals.vitals_pulse || target.vitals_pulse || "",
      vitals_temp: cleanVitals.vitals_temp || target.vitals_temp || "",
      vitals_spo2: cleanVitals.vitals_spo2 || target.vitals_spo2 || "",
      vitals_weight: cleanVitals.vitals_weight || target.vitals_weight || "",
      vitals_sugar: cleanVitals.vitals_sugar || target.vitals_sugar || "",
      diagnosis: diagnosis !== undefined ? diagnosis : target.diagnosis || "",
    };

    const newAmendment = {
      amendment_id: generateId("amd"),
      timestamp: new Date().toISOString(),
      actor_id: actor_id || "doctor",
      actor_name: actor_name || "Doctor",
      reason: reason || "Clinical note/vitals amendment",
      before: beforeSnapshot,
      after: afterSnapshot,
    };

    amendments.push(newAmendment);

    const updated = visits.map((v) =>
      v.id === id
        ? {
            ...v,
            ...afterSnapshot,
            amendments,
            is_amended: true,
            updated_at: new Date().toISOString(),
          }
        : v
    );

    setCollection(KEYS.VISITS, updated);
    const updatedRecord = updated.find((v) => v.id === id);
    if (updatedRecord && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("visits", updatedRecord, "UPDATE", id);
    }
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return { success: true, data: updatedRecord };
  },
  reissueLateToken: (visitId) => {
    const visits = getCollection(KEYS.VISITS);
    const originalVisit = visits.find((v) => v.id === visitId);
    if (!originalVisit) return null;
    const updatedVisits = visits.map((v) =>
      v.id === visitId ? { ...v, status: "skipped_reissued" } : v
    );
    setCollection(KEYS.VISITS, updatedVisits);
    const token_number = dbVisits.nextTokenNumber();
    const newVisit = {
      id: "visit_" + Date.now(),
      patient_id: originalVisit.patient_id,
      clinic_id: originalVisit.clinic_id || "clinic_001",
      doctor_id: originalVisit.doctor_id,
      token_number,
      visit_type: originalVisit.visit_type || "new",
      status: "waiting",
      visit_date: new Date().toISOString(),
      fee_amount: 0,
      fee_waived_reason: `Re-issued from Skipped Token #${originalVisit.token_number} (Already Paid)`,
      original_visit_id: originalVisit.id,
      prescription_image_url: null,
      report_image_urls: [],
      notes: `Late Arrival — Re-issued from Token #${originalVisit.token_number}`,
    };
    setCollection(KEYS.VISITS, [...getCollection(KEYS.VISITS), newVisit]);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return newVisit;
  },
  complete: (id, payload = {}, optForcedStatus = null) => {
    const visits = getCollection(KEYS.VISITS);
    const data = typeof payload === "string" ? { forcedStatus: payload } : (payload || {});
    const existing = visits.find((v) => v.id === id);
    const reports = data.report_image_urls !== undefined ? data.report_image_urls : (existing?.report_image_urls || []);
    const status = optForcedStatus || data.forcedStatus || (reports.length > 0 ? "completed" : (typeof payload === "string" ? payload : "completed_reports_pending"));
    const updated = visits.map((v) =>
      v.id === id
        ? {
            ...v,
            status,
            completed_at: status === "completed" ? (v.completed_at || new Date().toISOString()) : v.completed_at,
            prescription_image_url: data.prescription_image_url !== undefined ? data.prescription_image_url : v.prescription_image_url,
            report_image_urls: reports,
            notes: data.notes !== undefined ? data.notes : v.notes,
            vitals_bp: data.vitals_bp !== undefined ? data.vitals_bp : v.vitals_bp,
            vitals_pulse: data.vitals_pulse !== undefined ? data.vitals_pulse : v.vitals_pulse,
            vitals_temp: data.vitals_temp !== undefined ? data.vitals_temp : v.vitals_temp,
            vitals_spo2: data.vitals_spo2 !== undefined ? data.vitals_spo2 : v.vitals_spo2,
            vitals_weight: data.vitals_weight !== undefined ? data.vitals_weight : v.vitals_weight,
            updated_at: new Date().toISOString(),
          }
        : v
    );
    setCollection(KEYS.VISITS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updated.find((v) => v.id === id);
  },
  addReports: (id, newReportPhotos) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.map((v) => {
      if (v.id !== id) return v;
      const combinedReports = [...(v.report_image_urls || []), ...(newReportPhotos || [])];
      return {
        ...v,
        report_image_urls: combinedReports,
        status: "completed",
      };
    });
    setCollection(KEYS.VISITS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updated.find((v) => v.id === id);
  },
  skip: (id) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.map((v) => (v.id === id ? { ...v, status: "skipped" } : v));
    setCollection(KEYS.VISITS, updated);
    return updated.find((v) => v.id === id);
  },
};

export function convertUnitsToBase(qty, unitType, item) {
  if (!item || !item.has_multi_unit) return Number(qty) || 0;
  const stripsPerBox = Number(item.strips_per_box) || 1;
  const unitsPerStrip = Number(item.units_per_strip) || 1;
  const unitsPerBox = stripsPerBox * unitsPerStrip;

  if (unitType === "box") return (Number(qty) || 0) * unitsPerBox;
  if (unitType === "strip") return (Number(qty) || 0) * unitsPerStrip;
  return Number(qty) || 0;
}

// Curated multi-company homeopathic and OTC medicine catalog
export const MULTI_COMPANY_INVENTORY_SEEDS = [];

// ---------- Inventory Engine ----------
export const dbInventory = {
  getAll: () => {
    return getCollection(KEYS.INVENTORY) || [];
  },
  getById: (id) => {
    return getFromCollectionById(KEYS.INVENTORY, id);
  },
  findByName: (name) => {
    if (!name) return null;
    const n = name.trim().toLowerCase();
    const all = dbInventory.getAll();
    return all.find((i) => (i.medicine_name || "").trim().toLowerCase() === n) || null;
  },
  getLowStock: () => dbInventory.getAll().filter((i) => (i.total_base_stock ?? i.stock_qty) <= (i.low_stock_threshold || 6)),
  getByCompany: (companyName) => {
    if (!companyName || companyName === "all") return dbInventory.getAll();
    return dbInventory.getAll().filter((i) => (i.company_name || "").toLowerCase() === companyName.toLowerCase());
  },
  // Company code resolver — returns trimmed string
  resolveCompanyCode: (code) => {
    if (!code) return null;
    return code.trim();
  },
  // Get distinct list of all company names for dropdowns
  getCompanyList: () => {
    const all = dbInventory.getAll();
    const seen = new Set();
    const result = [];
    for (const item of all) {
      const c = item.company_name;
      if (c && !seen.has(c)) { seen.add(c); result.push(c); }
    }
    return result.sort();
  },
  // Per-warehouse stock: returns location_stocks map. Falls back to legacy fields if not set.
  getLocationStock: (item, warehouseId) => {
    if (!item) return 0;
    if (item.location_stocks && typeof item.location_stocks === "object") {
      return Number(item.location_stocks[warehouseId]) || 0;
    }
    // Legacy fallback
    if (warehouseId === "wh_str") return item.store_stock ?? (item.stock_qty ?? 0);
    if (warehouseId === "wh_001") return item.warehouse_stock ?? 0;
    return 0;
  },
  // Scoped inventory getter based on user role and assigned location
  getScopedInventory: (userOrWhId = null) => {
    const all = dbInventory.getAll();
    let whId = "";
    if (typeof userOrWhId === "string") {
      whId = userOrWhId;
    } else if (userOrWhId && typeof userOrWhId === "object") {
      if (userOrWhId.is_owner || userOrWhId.role === "admin" || userOrWhId.role === "doctor") {
        return all;
      }
      whId = userOrWhId.assigned_warehouse_id || "";
    }
    if (!whId) {
      return all;
    }
    return all.map((item) => {
      const locQty = dbInventory.getLocationStock(item, whId);
      return {
        ...item,
        scoped_stock: locQty,
        current_location_stock: locQty,
        stock_qty: locQty,
        store_stock: whId === "wh_str" ? locQty : 0,
        warehouse_stock: whId !== "wh_str" ? locQty : 0,
        total_base_stock: locQty,
      };
    });
  },
  // Set stock quantity directly for a specific warehouse
  setStockForLocation: (id, qty, warehouseId = "wh_001") => {
    const inventory = getCollection(KEYS.INVENTORY);
    const q = Math.max(0, Number(qty) || 0);
    const updated = inventory.map((i) => {
      if (i.id !== id) return i;
      const locStocks = { ...(i.location_stocks || { wh_001: i.warehouse_stock ?? 0, wh_str: i.store_stock ?? (i.stock_qty ?? 0) }) };
      locStocks[warehouseId] = q;
      const newWarehouseTotal = Object.entries(locStocks)
        .filter(([k]) => k !== "wh_str")
        .reduce((sum, [, v]) => sum + Number(v), 0);
      const storeStock = Number(locStocks["wh_str"]) || 0;
      return {
        ...i,
        location_stocks: locStocks,
        warehouse_stock: newWarehouseTotal,
        store_stock: storeStock,
        stock_qty: storeStock,
        total_base_stock: newWarehouseTotal + storeStock,
      };
    });
    setCollection(KEYS.INVENTORY, updated);
  },
  // Deduct stock from a specific warehouse/location
  deductStockFromLocation: (id, baseQty, warehouseId = "wh_001") => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => {
      if (i.id !== id) return i;
      const locStocks = { ...(i.location_stocks || { wh_001: i.warehouse_stock ?? 0, wh_str: i.store_stock ?? (i.stock_qty ?? 0) }) };
      locStocks[warehouseId] = Math.max(0, (Number(locStocks[warehouseId]) || 0) - baseQty);
      const newWarehouseTotal = Object.entries(locStocks)
        .filter(([k]) => k !== "wh_str")
        .reduce((sum, [, v]) => sum + Number(v), 0);
      const storeStock = Number(locStocks["wh_str"]) || 0;
      return {
        ...i,
        location_stocks: locStocks,
        warehouse_stock: newWarehouseTotal,
        store_stock: storeStock,
        stock_qty: storeStock,
        total_base_stock: newWarehouseTotal + storeStock,
      };
    });
    setCollection(KEYS.INVENTORY, updated);
  },
  // Transfer between any two warehouse/store locations
  transferBetweenLocations: (id, qty, fromWarehouseId, toWarehouseId, notes = "", transferredBy = "Staff") => {
    const inv = dbInventory.getById(id);
    if (!inv) return null;
    const q = Math.max(0, Number(qty) || 0);
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => {
      if (i.id !== id) return i;
      const locStocks = { ...(i.location_stocks || { wh_001: i.warehouse_stock ?? 0, wh_str: i.store_stock ?? (i.stock_qty ?? 0) }) };
      locStocks[fromWarehouseId] = Math.max(0, (Number(locStocks[fromWarehouseId]) || 0) - q);
      locStocks[toWarehouseId] = (Number(locStocks[toWarehouseId]) || 0) + q;
      const newWarehouseTotal = Object.entries(locStocks)
        .filter(([k]) => k !== "wh_str")
        .reduce((sum, [, v]) => sum + Number(v), 0);
      const storeStock = Number(locStocks["wh_str"]) || 0;
      return {
        ...i,
        location_stocks: locStocks,
        warehouse_stock: newWarehouseTotal,
        store_stock: storeStock,
        stock_qty: storeStock,
        total_base_stock: newWarehouseTotal + storeStock,
      };
    });
    setCollection(KEYS.INVENTORY, updated);
    // Log the transfer
    const warehouses = dbWarehouses.getAll();
    const fromName = warehouses.find((w) => w.id === fromWarehouseId)?.name || fromWarehouseId;
    const toName = warehouses.find((w) => w.id === toWarehouseId)?.name || toWarehouseId;
    dbStockTransfers.transfer({
      inventory_id: inv.id,
      medicine_name: inv.medicine_name,
      qty: q,
      from_loc: fromName,
      to_loc: toName,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      notes: notes || `Stock Transfer: ${fromName} ➔ ${toName}`,
      transferred_by: transferredBy,
    });
    return true;
  },

  search: (query, companyFilter = "all") => {
    let list = dbInventory.getAll();
    if (companyFilter && companyFilter !== "all") {
      list = list.filter((i) => (i.company_name || "").toLowerCase() === companyFilter.toLowerCase());
    }
    if (!query || query.trim() === "") {
      // Even with no query, merge duplicates in full list
      return dbInventory._deduplicateForPOS(list);
    }
    const q = query.trim().toLowerCase();
    const filtered = list.filter((i) =>
      (i.medicine_name || "").toLowerCase().includes(q) ||
      (i.item_code || "").toLowerCase().includes(q) ||
      (i.category || "").toLowerCase().includes(q) ||
      (i.company_name || "").toLowerCase().includes(q)
    );
    return dbInventory._deduplicateForPOS(filtered);
  },

  /**
   * POS Display Deduplication:
   * Merges inventory records that have the same medicine_name + company_name + unit_sale_price
   * into a single POS search result with combined store_stock.
   * The merged record keeps the first matching ID (so cart deduction still targets a real record).
   * Actual inventory data is NOT modified — this is a read/display-only operation.
   */
  _deduplicateForPOS: (list) => {
    const seen = new Map();
    const result = [];
    for (const item of list) {
      const key = `${(item.medicine_name || "").trim().toLowerCase()}|${(item.company_name || "").trim().toLowerCase()}|${Number(item.unit_sale_price || item.sale_price || 0)}`;
      if (seen.has(key)) {
        // Merge: add stock to the first occurrence
        const existing = seen.get(key);
        existing.store_stock = (existing.store_stock ?? 0) + (item.store_stock ?? item.stock_qty ?? 0);
        existing.stock_qty = existing.store_stock;
        existing.warehouse_stock = (existing.warehouse_stock ?? 0) + (item.warehouse_stock ?? 0);
        existing.total_base_stock = existing.store_stock + existing.warehouse_stock;
        // Track merged IDs so we can still deduct from primary
        existing._merged_ids = existing._merged_ids || [];
        existing._merged_ids.push(item.id);
      } else {
        const clone = { ...item };
        seen.set(key, clone);
        result.push(clone);
      }
    }
    return result;
  },


  add: (item) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const stripsPerBox = Number(item.strips_per_box) || 1;
    const unitsPerStrip = Number(item.units_per_strip) || 1;

    let baseStock = Number(item.total_base_stock);
    if (isNaN(baseStock) || baseStock === undefined) {
      baseStock = Number(item.stock_qty) || 0;
    }

    const wStock = Number(item.warehouse_stock) || Math.floor(baseStock * 0.7);
    const sStock = Number(item.store_stock) || (baseStock - wStock);

    const newItem = {
      ...item,
      id: generateId("inv"),
      clinic_id: "clinic_001",
      has_multi_unit: Boolean(item.has_multi_unit),
      strips_per_box: stripsPerBox,
      units_per_strip: unitsPerStrip,
      box_label: item.box_label || "Pack",
      strip_label: item.strip_label || "Bottle",
      unit_label: item.unit_label || "Bottle",
      cost_price_per_box: Number(item.cost_price_per_box) || Number(item.purchase_price) || 0,
      box_sale_price: Number(item.box_sale_price) || Number(item.sale_price) || 0,
      strip_sale_price: Number(item.strip_sale_price) || Number(item.sale_price) || 0,
      unit_sale_price: Number(item.unit_sale_price) || Number(item.sale_price) || 0,
      total_base_stock: baseStock,
      stock_qty: sStock,
      store_stock: sStock,
      warehouse_stock: wStock,
      low_stock_threshold: Number(item.low_stock_threshold) || 6,
    };
    setCollection(KEYS.INVENTORY, [...inventory, newItem]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("inventory", newItem, "CREATE", newItem.id);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clinicflow_status_update"));
    }
    return newItem;
  },

  update: (id, data) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => (i.id === id ? { ...i, ...data } : i));
    setCollection(KEYS.INVENTORY, updated);
    const updatedRecord = updated.find((i) => i.id === id);
    if (updatedRecord && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("inventory", updatedRecord, "UPDATE", id);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clinicflow_status_update"));
    }
    return updatedRecord || null;
  },

  delete: (id, reason = "Inventory SKU deleted") => {
    const existing = dbInventory.getById(id);
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.filter((i) => i.id !== id);
    setCollection(KEYS.INVENTORY, updated);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("inventory", { id }, "DELETE", id);
    }
    if (existing) {
      dbAuditLogs.logEvent({
        action: "DELETE_INVENTORY_ITEM",
        entity: "inventory",
        entity_id: id,
        before: existing,
        after: null,
        reason: reason || `Deleted inventory item: ${existing.medicine_name || id}`,
      });
    }
    return true;
  },

  deductStock: (id, baseQty) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => {
      if (i.id !== id) return i;
      const currentBase = i.total_base_stock ?? i.stock_qty ?? 0;
      const newBase = Math.max(0, currentBase - baseQty);
      const currentStore = i.store_stock ?? currentBase;
      const newStore = Math.max(0, currentStore - baseQty);
      // Keep location_stocks['wh_str'] (store counter) in sync
      const locStocks = { ...(i.location_stocks || {}) };
      if (locStocks.wh_str !== undefined) {
        locStocks.wh_str = Math.max(0, (Number(locStocks.wh_str) || 0) - baseQty);
      }
      return {
        ...i,
        total_base_stock: newBase,
        stock_qty: newStore,
        store_stock: newStore,
        ...(Object.keys(locStocks).length > 0 ? { location_stocks: locStocks } : {}),
      };
    });
    setCollection(KEYS.INVENTORY, updated);
  },

  /**
   * Batched deduction — applies multiple stock deductions in one in-memory pass
   * and executes exactly ONE setCollection call. Replaces per-item deductStock
   * loops in checkout flows to eliminate $O(N x M) disk serialization.
   * @param {Array<{id: string, baseQty: number}>} deductions
   * @param {string} location — 'store' (POS) or 'warehouse' (B2B Godown)
   */
  bulkDeductStock: (deductions, location = "store") => {
    if (!deductions || deductions.length === 0) return;
    // Build a quick lookup of how much to deduct per inventory ID
    const deductMap = new Map();
    for (const d of deductions) {
      if (!d.id || !d.baseQty) continue;
      deductMap.set(d.id, (deductMap.get(d.id) || 0) + Number(d.baseQty));
    }
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => {
      const qty = deductMap.get(i.id);
      if (!qty) return i;
      const locStocks = { ...(i.location_stocks || {}) };
      if (location === "store") {
        const newStore = Math.max(0, (i.store_stock ?? i.stock_qty ?? 0) - qty);
        const currentWarehouse = i.warehouse_stock ?? 0;
        if (locStocks.wh_str !== undefined) locStocks.wh_str = newStore;
        return {
          ...i,
          store_stock: newStore,
          stock_qty: newStore,
          total_base_stock: Math.max(0, currentWarehouse + newStore),
          ...(Object.keys(locStocks).length > 0 ? { location_stocks: locStocks } : {}),
        };
      } else {
        const newWarehouse = Math.max(0, (i.warehouse_stock ?? 0) - qty);
        const currentStore = i.store_stock ?? i.stock_qty ?? 0;
        if (locStocks.wh_001 !== undefined) locStocks.wh_001 = newWarehouse;
        return {
          ...i,
          warehouse_stock: newWarehouse,
          total_base_stock: Math.max(0, newWarehouse + currentStore),
          ...(Object.keys(locStocks).length > 0 ? { location_stocks: locStocks } : {}),
        };
      }
    });
    // Single disk write for the entire inventory collection
    setCollection(KEYS.INVENTORY, updated);
  },

  addStock: (id, baseQty, destination = "store") => {
    const qty = Number(baseQty) || 0;
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => {
      if (i.id !== id) return i;
      const currentBase = Number(i.total_base_stock ?? i.stock_qty ?? i.store_stock ?? 0);
      const newBase = currentBase + qty;
      const currentStore = Number(i.store_stock ?? i.stock_qty ?? currentBase);
      const currentWarehouse = Number(i.warehouse_stock ?? 0);
      const locStocks = { ...(i.location_stocks || {}) };

      if (destination === "warehouse") {
        const newWarehouse = currentWarehouse + qty;
        if (locStocks.wh_001 !== undefined) locStocks.wh_001 = newWarehouse;
        return {
          ...i,
          total_base_stock: newBase,
          warehouse_stock: newWarehouse,
          store_stock: currentStore,
          stock_qty: currentStore,
          ...(Object.keys(locStocks).length > 0 ? { location_stocks: locStocks } : {}),
        };
      } else {
        const newStore = currentStore + qty;
        if (locStocks.wh_str !== undefined) locStocks.wh_str = newStore;
        return {
          ...i,
          total_base_stock: newBase,
          store_stock: newStore,
          stock_qty: newStore,
          warehouse_stock: currentWarehouse,
          ...(Object.keys(locStocks).length > 0 ? { location_stocks: locStocks } : {}),
        };
      }
    });
    setCollection(KEYS.INVENTORY, updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clinicflow_status_update"));
    }
  },

  transferWarehouseToStore: (id, qty, notes = "", transferred_by = "Store Staff") => {
    const inv = dbInventory.getById(id);
    if (!inv) return null;
    const q = Number(qty) || 0;
    const wStock = Math.max(0, (inv.warehouse_stock ?? 0) - q);
    const sStock = (inv.store_stock ?? 0) + q;
    dbInventory.update(id, {
      warehouse_stock: wStock,
      store_stock: sStock,
      total_base_stock: wStock + sStock,
      stock_qty: sStock,
    });
    dbStockTransfers.transfer({
      inventory_id: inv.id,
      medicine_name: inv.medicine_name,
      qty: q,
      from_loc: "Main Warehouse (Godown)",
      to_loc: "Medical Store Counter (POS)",
      notes: notes || "Internal Replenishment (Godown ➔ Store)",
      transferred_by: transferred_by || "Store Staff"
    });
  },

  transferStoreToWarehouse: (id, qty, notes = "", transferred_by = "Store Staff") => {
    const inv = dbInventory.getById(id);
    if (!inv) return null;
    const q = Number(qty) || 0;
    const sStock = Math.max(0, (inv.store_stock ?? 0) - q);
    const wStock = (inv.warehouse_stock ?? 0) + q;
    dbInventory.update(id, {
      warehouse_stock: wStock,
      store_stock: sStock,
      total_base_stock: wStock + sStock,
      stock_qty: sStock,
    });
    dbStockTransfers.transfer({
      inventory_id: inv.id,
      medicine_name: inv.medicine_name,
      qty: q,
      from_loc: "Medical Store Counter (POS)",
      to_loc: "Main Warehouse (Godown)",
      notes: notes || "Stock Return (Store ➔ Godown)",
      transferred_by: transferred_by || "Store Staff"
    });
  },

  getProductMovement: (inventoryId) => {
    const inv = dbInventory.getById(inventoryId);
    if (!inv) return null;

    const purchases = dbPurchases.getAll();
    const sales = dbSales.getAll();
    const b2b = dbB2BSales.getAll();
    const transfers = dbStockTransfers.getAll();

    const ledger = [];

    // 1. Inward Purchases
    purchases.forEach((p) => {
      (p.items || []).forEach((item) => {
        if (item.inventory_id === inv.id || (item.medicine_name && item.medicine_name.toLowerCase() === inv.medicine_name.toLowerCase())) {
          const inQty = Number(item.qty_base_units || item.quantity_received || item.qty || item.quantity) || 0;
          ledger.push({
            date: p.purchase_date || p.created_at || new Date().toISOString(),
            type: "PURCHASE",
            type_label: "Company / Local Purchase",
            voucher_no: p.invoice_no || p.id,
            party_name: p.supplier_name || p.company_name || "Supplier Consignment",
            destination: p.destination || "Main Warehouse (Godown)",
            qty_in: inQty,
            qty_out: 0,
            quantity: inQty,
            unit_price: Number(item.cost_price || item.purchase_price || item.unit_price) || 0,
            total_amount: Number(item.total_cost || item.line_total || (inQty * Number(item.cost_price || 0))) || 0,
            notes: p.notes || `GRN from ${p.supplier_name || 'Supplier'}`,
          });
        }
      });
    });

    // 2. Outward Retail POS Sales
    sales.forEach((s) => {
      (s.items || []).forEach((item) => {
        if (item.inventory_id === inv.id || (item.medicine_name && item.medicine_name.toLowerCase() === inv.medicine_name.toLowerCase())) {
          let resolvedPartyName = s.account_name || s.patient_name || s.customer_name || s.buyer_name || s.party_name || s.patient?.full_name || s.patient?.name || "";
          if (!resolvedPartyName && s.patient_id) {
            const pat = dbPatients.getById(s.patient_id);
            if (pat) resolvedPartyName = pat.full_name || pat.name || "";
          }
          if (!resolvedPartyName && s.visit_id) {
            const vis = dbVisits.getById(s.visit_id);
            if (vis) resolvedPartyName = vis.patient_name || (vis.patient_id ? dbPatients.getById(vis.patient_id)?.full_name : "") || "";
          }
          if (!resolvedPartyName || resolvedPartyName === "Walk-in Patient") {
            if (s.token_no || s.token_number) {
              resolvedPartyName = `OPD Token #${s.token_no || s.token_number}`;
            } else if (!resolvedPartyName) {
              resolvedPartyName = "Walk-in Customer";
            }
          }

          const outQty = Number(item.qty_base_units || item.base_units || item.quantity || item.qty) || 0;
          ledger.push({
            date: s.sale_date || s.created_at || new Date().toISOString(),
            type: "RETAIL_SALE",
            type_label: "Retail POS Counter Sale",
            voucher_no: s.voucher_no || s.receipt_no || s.invoice_no || s.id,
            party_name: resolvedPartyName,
            destination: "Store Counter",
            qty_in: 0,
            qty_out: outQty,
            quantity: -outQty,
            unit_price: Number(item.unit_price || item.unit_sale_price || item.box_sale_price) || 0,
            total_amount: Number(item.line_total || item.total_amount || (outQty * Number(item.unit_price || 0))) || 0,
            notes: "Dispensed at Retail Medical Store",
          });
        }
      });
    });

    // 3. Outward Wholesale B2B Sales (Interior Sindh)
    b2b.forEach((b) => {
      (b.items || []).forEach((item) => {
        if (item.inventory_id === inv.id || (item.medicine_name && item.medicine_name.toLowerCase() === inv.medicine_name.toLowerCase())) {
          const outQty = Number(item.qty_base_units || item.base_units || item.qty || item.quantity) || 0;
          ledger.push({
            date: b.sale_date || b.created_at || new Date().toISOString(),
            type: "WHOLESALE_B2B",
            type_label: "Wholesale B2B Supply",
            voucher_no: b.invoice_no || b.voucher_no || b.id,
            party_name: b.buyer_name || b.party_name || b.account_name || "Interior Sindh Party",
            city: b.city || b.buyer_city || "",
            salesman: b.salesman || "",
            bilty_no: b.bilty_no || "",
            transport: b.transport || "",
            destination: `${b.buyer_name || b.party_name || 'Party'} (${b.city || 'Interior Sindh'})`,
            qty_in: 0,
            qty_out: outQty,
            quantity: -outQty,
            unit_price: Number(item.unit_price || item.box_sale_price) || 0,
            total_amount: Number(item.line_total || (outQty * Number(item.unit_price || 0))) || 0,
            notes: `Bilty: ${b.bilty_no || 'Direct'}, Tr: ${b.transport || 'Local'}, Man: ${b.salesman || 'Staff'}`,
          });
        }
      });
    });

    // 4. Internal Transfers
    transfers.forEach((t) => {
      if (t.inventory_id === inv.id || (t.medicine_name && t.medicine_name.toLowerCase() === inv.medicine_name.toLowerCase())) {
        const isToStore = t.to_loc?.includes("Counter") || t.to_loc?.includes("POS") || t.to_loc?.includes("Store");
        const tQty = Number(t.qty || t.quantity) || 0;
        ledger.push({
          date: t.transfer_date || t.created_at || new Date().toISOString(),
          type: "INTERNAL_TRANSFER",
          type_label: `Internal Shift (${t.from_loc} ➔ ${t.to_loc})`,
          voucher_no: t.transfer_no || t.id,
          party_name: `Internal Shift (${t.transferred_by || 'Staff'})`,
          handler: t.transferred_by || "Staff",
          destination: `${t.from_loc} ➔ ${t.to_loc}`,
          qty_in: isToStore ? 0 : tQty,
          qty_out: isToStore ? tQty : 0,
          quantity: isToStore ? -tQty : tQty,
          unit_price: inv.unit_sale_price || inv.box_sale_price || 0,
          total_amount: tQty * (inv.unit_sale_price || inv.box_sale_price || 0),
          notes: t.notes || `Stock shifted by ${t.transferred_by || 'Staff'}`,
        });
      }
    });

    ledger.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      item: inv,
      summary: {
        warehouse_stock: inv.warehouse_stock ?? 0,
        store_stock: inv.store_stock ?? (inv.stock_qty ?? 0),
        total_base_stock: inv.total_base_stock ?? (inv.stock_qty ?? 0),
        total_purchased: ledger.filter((l) => l.type === "PURCHASE").reduce((sum, l) => sum + l.qty_in, 0),
        total_sold_retail: ledger.filter((l) => l.type === "RETAIL_SALE").reduce((sum, l) => sum + l.qty_out, 0),
        total_sold_wholesale: ledger.filter((l) => l.type === "WHOLESALE_B2B").reduce((sum, l) => sum + l.qty_out, 0),
      },
      transactions: ledger,
    };
  },

  getAccessCatalog: async () => {
    try {
      const module = await import("../assets/legacy_access_inventory.json");
      return Array.isArray(module.default) ? module.default : (Array.isArray(module) ? module : []);
    } catch {
      return [];
    }
  },
  /**
   * Bulk Ingestion Engine for CSV/Excel & Custom Lists
   * Efficiently batches array normalization and executes a single disk write pass.
   * @param {Array<Object>} rawList - Array of items to import
   * @param {string} mode - 'merge' (append/update existing) or 'replace'
   */
  bulkImport: (rawList, mode = "merge") => {
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return { success: false, count: 0, total: 0, message: "No items provided" };
    }

    let current = mode === "replace" ? [] : (getCollection(KEYS.INVENTORY) || []);
    let addedCount = 0;
    let updatedCount = 0;

    for (const raw of rawList) {
      if (!raw || !raw.medicine_name || !raw.medicine_name.trim()) continue;
      
      const { name: cleanName, packing: extractedPacking } = extractSmartPackingAndName(raw.medicine_name, raw.packing || raw.unit_label);
      if (!cleanName) continue;

      const rawComp = raw.company_name || dbInventory.resolveCompanyCode(raw.company_code || raw.item_code) || "BM Pvt LTD";
      const company = toTitleCaseClean(rawComp) || "BM Pvt LTD";
      const compCode = raw.company_code ? raw.company_code.toUpperCase().trim() : (raw.item_code ? raw.item_code.toUpperCase().trim() : (company.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "GEN"));
      const itemCode = raw.item_code ? raw.item_code.toUpperCase().trim() : compCode;
      
      // Auto-register company in dbSuppliers & dbCompanies if not already registered (deduplicated)
      if (company && company.trim()) {
        const compClean = company.trim();
        const existingSuppliers = dbSuppliers.getAll() || [];
        const supplierExists = existingSuppliers.some(
          (s) => (s.name || "").toLowerCase().trim() === compClean.toLowerCase() ||
                 (s.supplier_code || "").toLowerCase().trim() === compCode.toLowerCase()
        );
        if (!supplierExists) {
          dbSuppliers.add({
            name: compClean,
            supplier_code: compCode || `SUP-${Math.floor(100 + Math.random() * 900)}`,
            phone: "",
            city: "Hyderabad",
            address: "Pharma Market",
            current_balance: 0,
            status: "active",
          });
        }

        if (typeof dbCompanies !== "undefined" && dbCompanies.getAll) {
          const existingComps = dbCompanies.getAll() || [];
          const compExists = existingComps.some(
            (c) => (c.name || "").toLowerCase().trim() === compClean.toLowerCase() ||
                   (c.code || "").toLowerCase().trim() === compCode.toLowerCase()
          );
          if (!compExists) {
            try {
              dbCompanies.add({
                name: compClean,
                code: compCode,
                category: "Allopathy / Homeopathy",
                status: "active"
              });
            } catch {}
          }
        }
      }

      const salePrice = Number(raw.unit_sale_price || raw.box_sale_price || raw.sale_price) || 0;
      const costPrice = Number(raw.cost_price_per_box || raw.purchase_price || raw.cost_price) || 0;
      const storeStock = Number(raw.store_stock ?? raw.stock_qty ?? 0);
      const godownStock = Number(raw.warehouse_stock ?? 0);
      const totalBase = storeStock + godownStock;
      const packing = extractedPacking || normalizePackingUnit(raw.packing || raw.unit_label) || "Standard Pack";
      const rawDesc = raw.product_description || raw.generic_name || raw.description || "";
      const desc = toTitleCaseClean(rawDesc);
      const rawCat = raw.category || "Homeopathic Medicine";
      const category = toTitleCaseClean(rawCat);
      const minAlert = Number(raw.low_stock_threshold) || 6;

      const existingIdx = current.findIndex(
        (i) => (i.medicine_name || "").toLowerCase().trim() === cleanName.toLowerCase() &&
               ((i.company_name || "").toLowerCase().trim() === company.toLowerCase() || !i.company_name)
      );

      if (existingIdx !== -1 && mode !== "replace") {
        current[existingIdx] = {
          ...current[existingIdx],
          medicine_name: cleanName,
          company_name: company,
          company_code: compCode || current[existingIdx].company_code,
          item_code: itemCode || current[existingIdx].item_code,
          product_description: desc || current[existingIdx].product_description,
          generic_name: desc || current[existingIdx].generic_name,
          category: category || current[existingIdx].category,
          unit_label: packing || current[existingIdx].unit_label,
          cost_price_per_box: costPrice || current[existingIdx].cost_price_per_box,
          box_sale_price: salePrice || current[existingIdx].box_sale_price,
          strip_sale_price: salePrice || current[existingIdx].strip_sale_price,
          unit_sale_price: salePrice || current[existingIdx].unit_sale_price,
          unit_price: salePrice || current[existingIdx].unit_price,
          store_stock: storeStock > 0 ? storeStock : current[existingIdx].store_stock,
          stock_qty: storeStock > 0 ? storeStock : current[existingIdx].stock_qty,
          warehouse_stock: godownStock > 0 ? godownStock : current[existingIdx].warehouse_stock,
          total_base_stock: totalBase > 0 ? totalBase : current[existingIdx].total_base_stock,
          location_stocks: {
            wh_str: storeStock > 0 ? storeStock : (current[existingIdx].location_stocks?.wh_str || current[existingIdx].store_stock || 0),
            ...(godownStock > 0 ? { wh_001: godownStock } : (current[existingIdx].location_stocks?.wh_001 ? { wh_001: current[existingIdx].location_stocks.wh_001 } : {}))
          },
          low_stock_threshold: minAlert,
        };
        updatedCount++;
      } else {
        const newItem = {
          id: raw.id || generateId("inv"),
          clinic_id: "clinic_001",
          medicine_name: cleanName,
          company_name: company,
          company_code: compCode,
          item_code: itemCode,
          product_description: desc,
          generic_name: desc || "Homeopathic Dilution / Mother Tincture",
          naration: desc,
          category: category,
          has_multi_unit: Boolean(raw.has_multi_unit),
          strips_per_box: Number(raw.strips_per_box) || 1,
          units_per_strip: Number(raw.units_per_strip) || 1,
          box_label: "Pack",
          strip_label: packing,
          unit_label: packing,
          cost_price_per_box: costPrice,
          box_sale_price: salePrice,
          strip_sale_price: salePrice,
          unit_sale_price: salePrice,
          unit_price: salePrice,
          total_base_stock: totalBase,
          stock_qty: storeStock,
          store_stock: storeStock,
          warehouse_stock: godownStock,
          location_stocks: { wh_str: storeStock, ...(godownStock > 0 ? { wh_001: godownStock } : {}) },
          low_stock_threshold: minAlert,
          expiry_date: raw.expiry_date || "2028-12-31"
        };
        current.push(newItem);
        addedCount++;
      }
    }

    // Deterministic Sort before saving
    current.sort((a, b) => {
      const compA = (a.company_name || "").toLowerCase();
      const compB = (b.company_name || "").toLowerCase();
      if (compA !== compB) {
        return compA.localeCompare(compB, undefined, { numeric: true, sensitivity: "base" });
      }
      const nameA = (a.medicine_name || "").toLowerCase();
      const nameB = (b.medicine_name || "").toLowerCase();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
    });

    setCollection(KEYS.INVENTORY, current);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return { success: true, count: addedCount + updatedCount, added: addedCount, updated: updatedCount, total: current.length };
  },

  /**
   * 1-Click Direct MS Access Migration Engine
   * Directly maps and ingests all 4,236 real medicines from AshrafKhan.accdb.
   */
  bulkImportFromAccess: async (limit = 4236, defaultStock = { store: 15, godown: 35 }) => {
    let rawCatalog = [];
    try {
      const module = await import("../assets/legacy_access_inventory.json");
      rawCatalog = Array.isArray(module.default) ? module.default : (Array.isArray(module) ? module : []);
    } catch {
      rawCatalog = [];
    }

    if (rawCatalog.length === 0) {
      return { success: false, count: 0, message: "Legacy Access JSON catalog not found" };
    }

    const current = getCollection(KEYS.INVENTORY);
    const existingNameSet = new Set(current.map((i) => (i.medicine_name || "").toLowerCase().trim()));
    const itemsToImport = [];

    const sliceList = rawCatalog.slice(0, limit);
    for (const leg of sliceList) {
      const name = (leg.medicine_name || "").trim();
      if (!name || existingNameSet.has(name.toLowerCase())) continue;

      let company = "BM Pvt LTD";
      const code = (leg.item_code || "").trim().toUpperCase();
      const nLower = name.toLowerCase();

      if (code === "GHR" || nLower.includes("ghr")) company = "BM Pvt LTD";
      else if (code === "BM" || nLower.includes("bm ")) company = "BM Pvt LTD";
      else if (code === "PB" || nLower.includes("brooks") || nLower.includes("paul")) company = "Paul Brooks Homoeo Lab";
      else if (code === "SCH" || nLower.includes("schwabe") || nLower.includes("reckeweg") || nLower.includes("german")) company = "Schwabe / German";
      else if (code === "MKT" || nLower.includes("mektum")) company = "MEKTUM Pvt Ltd";
      else if (code === "BLS" || nLower.includes("blossom")) company = "BLOSSOM Homoeo Pharma";
      else if (code === "LPM" || nLower.includes("panadol") || nLower.includes("amoxil")) company = "Local Pharma Market";

      const salePrice = Number(leg.sale_price) || 0;
      const purchasePrice = Number(leg.purchase_price) || (salePrice > 0 ? salePrice * 0.7 : 0);
      const storeStock = defaultStock?.store ?? 15;
      const godownStock = defaultStock?.godown ?? 35;
      const totalBase = storeStock + godownStock;

      itemsToImport.push({
        id: generateId("acc"),
        clinic_id: "clinic_001",
        medicine_name: name,
        company_name: company,
        item_code: code || "GHR",
        generic_name: "Homeopathic Dilution / Mother Tincture",
        category: nLower.includes("syp") || nLower.includes("syrup") ? "Syrup / Suspension" : "Homeopathic Drops",
        has_multi_unit: false,
        strips_per_box: 1,
        units_per_strip: 1,
        box_label: "Pack",
        strip_label: "Bottle",
        unit_label: "Bottle",
        cost_price_per_box: purchasePrice,
        box_sale_price: salePrice,
        strip_sale_price: salePrice,
        unit_sale_price: salePrice,
        unit_price: salePrice,
        total_base_stock: totalBase,
        stock_qty: storeStock,
        store_stock: storeStock,
        warehouse_stock: godownStock,
        location_stocks: { wh_001: godownStock, wh_str: storeStock },
        low_stock_threshold: Number(leg.low_stock_threshold) || 6,
        expiry_date: "2028-12-31",
      });

      existingNameSet.add(name.toLowerCase());
    }

    const updated = [...current, ...itemsToImport];
    setCollection(KEYS.INVENTORY, updated);
    return { success: true, count: itemsToImport.length, total: updated.length };
  },

  /** Direct synchronous catalog loader for lightning-fast autocomplete */
  getAccessCatalog: async () => {
    try {
      const module = await import("../assets/legacy_access_inventory.json");
      return Array.isArray(module.default) ? module.default : (Array.isArray(module) ? module : []);
    } catch {
      return [];
    }
  },
};

/** Generate Sample CSV Template for Bulk Inventory Upload */
/** Generate Sample CSV Template for Bulk Inventory Upload with Company Code & Item Code */
export function exportInventoryTemplateCSV() {
  const headers = "S/R No,Medicine Name,Description,Packing,Company Name,Company Code,Item Code,Cost Price,Retail Price,Medical Store Stock,Stock Level Alert,Category";
  const rows = [
    '1,"AMPHOSCA (FEMALE)","Homeopathic Tablets 60s","60 TABS","LEHNING FRANCE","LEH","LEH-01",1400,1990,20,5,"Tablets"',
    '2,"BIOCARDE DROPS","Cardiac Drops 30ml","30 ML","LEHNING FRANCE","LEH","LEH-02",950,1340,25,5,"Drops"',
    '3,"DIACURE CAPSULES","Diabetes Support 60s","60 CAPS","LEHNING FRANCE","LEH","LEH-03",1550,2190,15,5,"Capsules"',
    '4,"TONIC VEGETAL SYRUP","Herbal Restorative Syrup 250ml","250 ML","LEHNING FRANCE","LEH","LEH-04",1450,2040,15,5,"Syrup"',
    '5,"L-COMPLEXES","Drops & Tabs Combo Set","30 ML / 60 TABS","LEHNING FRANCE","LEH","LEH-05",900,1290,20,5,"Combination"',
    '6,"MOTHER TINCTURES","Homeopathic Dilution 1000ml","1000 ML","LEHNING FRANCE","LEH","LEH-06",12800,18000,5,2,"Mother Tinctures"'
  ];
  return `${headers}\n${rows.join("\n")}`;
}

/**
 * Smart Title Casing that preserves medical potencies, acronyms and Roman numerals
 */
export function toTitleCaseClean(str) {
  if (!str || typeof str !== "string") return "";
  const trimmed = str.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  // Preserved medical abbreviations, potencies & units
  const preserveExact = new Set([
    "Q", "Ø", "1X", "2X", "3X", "4X", "5X", "6X", "12X", "30X", "200X",
    "3C", "6C", "12C", "30C", "200C", "1M", "10M", "50M", "CM",
    "BM", "SCH", "PB", "MKT", "BLS", "LPM", "GHR", "DHU", "WSG", "SBL",
    "ML", "TABS", "CAPS", "GMS", "MG", "MCG", "KG", "IU",
    "IV", "IM", "POS", "SKU", "MRP", "OPD"
  ]);

  return trimmed
    .split(" ")
    .map((word) => {
      const upper = word.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (preserveExact.has(upper)) {
        return word.toUpperCase();
      }
      if (/\d+[a-zA-Z]+|[a-zA-Z]+\d+/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Standardize packing string: e.g. "10ml" -> "10 ML", "60tabs" -> "60 TABS", "capsule 20" -> "20 CAPS"
 */
export function normalizePackingUnit(packStr) {
  if (!packStr || typeof packStr !== "string") return "";
  let clean = packStr.trim().replace(/[()]/g, "").trim();

  // Inverted: "capsule 20", "tabs 75", "caps 20", "bottle 120ml"
  const invertedMatch = clean.match(/^([a-zA-Z]+)\s*(\d+(?:\.\d+)?(?:\s*[a-zA-Z]+)?)$/i);
  if (invertedMatch) {
    const rawUnit = invertedMatch[1].toLowerCase();
    const num = invertedMatch[2].trim();
    let unitLabel = "PACK";
    if (rawUnit.includes("cap")) unitLabel = "CAPS";
    else if (rawUnit.includes("tab")) unitLabel = "TABS";
    else if (rawUnit.includes("drop")) unitLabel = "DROPS";
    else if (rawUnit.includes("sachet")) unitLabel = "SACHETS";
    else if (rawUnit.includes("bot")) unitLabel = "BOTTLE";
    else unitLabel = rawUnit.toUpperCase();
    return `${num} ${unitLabel}`.replace(/\s+/g, " ").trim();
  }

  // Standard: "120ml", "120 ML", "75tabs", "75 TABS", "350gms", "350 GMS"
  const unitMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+.*)$/);
  if (unitMatch) {
    const num = unitMatch[1];
    let unit = unitMatch[2].trim().toUpperCase();
    if (unit === "ML" || unit === "MLS" || unit === "MILLILITER" || unit === "MILLILITRES") unit = "ML";
    else if (unit === "TAB" || unit === "TABS" || unit === "TABLET" || unit === "TABLETS") unit = "TABS";
    else if (unit === "CAP" || unit === "CAPS" || unit === "CAPSULE" || unit === "CAPSULES") unit = "CAPS";
    else if (unit === "GM" || unit === "GMS" || unit === "GRAM" || unit === "GRAMS" || unit === "G") unit = "GMS";
    else if (unit === "DROP" || unit === "DROPS") unit = "DROPS";
    else if (unit === "SACHET" || unit === "SACHETS") unit = "SACHETS";
    return `${num} ${unit}`;
  }

  return clean.toUpperCase();
}

/**
 * Smart Regex Packing & Product Name Extractor:
 * If packing is embedded in product name (e.g. "hepakent sugarfree 120ml", "gastric plus with podina 75tabs", "Endura Mens Essential capsule 20"),
 * extracts packing, normalizes it, strips it from name, and returns sanitized clean name and packing.
 */
export function extractSmartPackingAndName(rawName, existingPacking = "") {
  if (!rawName || typeof rawName !== "string") {
    return { name: "", packing: normalizePackingUnit(existingPacking) || "Standard Pack" };
  }

  let name = rawName.trim();
  let extractedPacking = existingPacking ? normalizePackingUnit(existingPacking) : "";

  // 1. Check for inverted pattern at end of name: " ... capsule 20" or " ... tabs 60" or " ... bottle 120ml"
  const invertedRegex = /(?:[-–—,\s(]+)?\b(capsules?|caps?|tablets?|tabs?|drops?|sachets?|bottles?)\s*(\d+(?:\.\d+)?(?:\s*(?:ml|mg|gm|g|tabs?|caps?))?)\b\)?$/i;
  const invertedMatch = name.match(invertedRegex);
  if (invertedMatch) {
    const rawUnit = invertedMatch[1].toLowerCase();
    const num = invertedMatch[2].trim();
    let unitLabel = "CAPS";
    if (rawUnit.includes("tab")) unitLabel = "TABS";
    else if (rawUnit.includes("drop")) unitLabel = "DROPS";
    else if (rawUnit.includes("sachet")) unitLabel = "SACHETS";
    else if (rawUnit.includes("bot")) unitLabel = "BOTTLE";
    
    if (!extractedPacking) {
      extractedPacking = `${num} ${unitLabel}`.replace(/\s+/g, " ").trim();
    }
    name = name.slice(0, invertedMatch.index).trim();
  }

  // 2. Check for standard trailing quantity + unit pattern: " ... 120ml" or " ... 75tabs" or " ... (250 ML)" or " ... 350gms"
  if (!invertedMatch) {
    const standardRegex = /(?:[-–—,\s(]+)?\b(\d+(?:\.\d+)?)\s*(ml|mls|milliliters?|millilitres?|ltr|liters?|litres?|tabs?|tablets?|caps?|capsules?|gms?|grams?|g|drops?|sachets?|puffs?|iu|mg|mcg|kg)\b\)?$/i;
    const stdMatch = name.match(standardRegex);
    if (stdMatch) {
      if (!extractedPacking) {
        extractedPacking = normalizePackingUnit(`${stdMatch[1]} ${stdMatch[2]}`);
      }
      name = name.slice(0, stdMatch.index).trim();
    }
  }

  // Strip trailing punctuation like hyphens, commas, open brackets if left after removal
  name = name.replace(/[-–—,(/]+$/, "").trim();
  name = toTitleCaseClean(name);

  if (!extractedPacking) {
    extractedPacking = "Standard Pack";
  }

  return {
    name,
    packing: extractedPacking
  };
}

/** Parse, Sanitize, Clean, and Validate Inventory CSV File Content with Smart Auto-Sort & Categorization */
export function parseInventoryCSV(csvText) {
  if (!csvText || !csvText.trim()) return [];
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const rawHeaders = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  
  // Robust Column Header Resolution
  const nameIdx = rawHeaders.findIndex((h) => h === "medicine name" || h === "item name" || h === "product name" || (h.includes("name") && !h.includes("company") && !h.includes("incharge")));
  const descIdx = rawHeaders.findIndex((h) => h.includes("description") || h.includes("generic") || h.includes("formula") || h.includes("naration"));
  const packIdx = rawHeaders.findIndex((h) => h.includes("packing") || h.includes("pack") || h.includes("unit label") || h.includes("size") || h.includes("volume"));
  
  // Company & Code Indexes
  const compIdx = rawHeaders.findIndex((h) => (h === "company name" || h === "company" || h.includes("brand") || h.includes("mfg") || h.includes("manufacturer")) && !h.includes("code"));
  const compCodeIdx = rawHeaders.findIndex((h) => h === "company code" || h === "comp code" || h === "mfg code" || (h.includes("company") && h.includes("code")));
  const itemCodeIdx = rawHeaders.findIndex((h) => h === "item code" || h === "sku" || h === "barcode" || (h.includes("item") && h.includes("code")) || (h === "code" && compCodeIdx !== -1));
  const fallbackCodeIdx = rawHeaders.findIndex((h) => h === "item code" || h === "code" || h.includes("item code") || h.includes("barcode") || h.includes("sku"));
  
  // Cost Index (must be distinct from Retail / Sale)
  const costIdx = rawHeaders.findIndex((h) => h.includes("cost") || h.includes("purchase") || h.includes("buy") || h === "cp");
  
  // Sale / Retail Index (prioritize retail or sale over generic price)
  let saleIdx = rawHeaders.findIndex((h) => h.includes("retail") || h.includes("sale") || h.includes("mrp") || h === "sp");
  if (saleIdx === -1) {
    saleIdx = rawHeaders.findIndex((h, idx) => h.includes("price") && idx !== costIdx);
  }
  
  // Stock Indexes
  const storeStockIdx = rawHeaders.findIndex((h) => h.includes("medical store stock") || h.includes("store stock") || h.includes("store") || (h.includes("stock") && !h.includes("godown") && !h.includes("warehouse") && !h.includes("alert") && !h.includes("level")));
  const whStockIdx = rawHeaders.findIndex((h) => h.includes("godown") || h.includes("warehouse") || h.includes("wh stock"));
  const alertIdx = rawHeaders.findIndex((h) => h.includes("alert") || h.includes("min") || h.includes("threshold") || h.includes("level"));
  const catIdx = rawHeaders.findIndex((h) => h.includes("category") || h.includes("group") || h.includes("type"));

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = [];
    let cur = "";
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { cells.push(cur.trim()); cur = ""; }
      else cur += char;
    }
    cells.push(cur.trim());

    // If S/R No is column 0, name is column 1
    const rawNameCell = nameIdx !== -1 ? cells[nameIdx] : (cells[1] || cells[0]);
    if (!rawNameCell || rawNameCell.toLowerCase() === "medicine name" || rawNameCell.toLowerCase() === "null") continue;

    const rawDesc = descIdx !== -1 && cells[descIdx] ? cells[descIdx] : "";
    const rawPacking = packIdx !== -1 && cells[packIdx] ? cells[packIdx] : "";
    const rawComp = compIdx !== -1 && cells[compIdx] ? cells[compIdx] : "BM Pvt LTD";
    const rawCompCode = compCodeIdx !== -1 && cells[compCodeIdx] ? cells[compCodeIdx].toUpperCase().trim() : "";
    const rawItemCode = itemCodeIdx !== -1 && cells[itemCodeIdx] ? cells[itemCodeIdx].toUpperCase().trim() : (fallbackCodeIdx !== -1 && cells[fallbackCodeIdx] ? cells[fallbackCodeIdx].toUpperCase().trim() : "");

    // Run Smart Extraction & Title Casing
    const { name: cleanName, packing: cleanPacking } = extractSmartPackingAndName(rawNameCell, rawPacking);
    if (!cleanName) continue;

    const description = toTitleCaseClean(rawDesc);
    const company = toTitleCaseClean(rawComp) || "BM Pvt LTD";
    const companyCode = rawCompCode || (company.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "GEN");
    const itemCode = rawItemCode || companyCode;
    
    const purchasePrice = costIdx !== -1 && cells[costIdx] ? (parseFloat(cells[costIdx]) || 0) : 0;
    const salePrice = saleIdx !== -1 && cells[saleIdx] ? (parseFloat(cells[saleIdx]) || 0) : (purchasePrice > 0 ? purchasePrice : 0);
    
    const storeStock = storeStockIdx !== -1 && cells[storeStockIdx] ? (parseInt(cells[storeStockIdx]) || 0) : 0;
    const godownStock = whStockIdx !== -1 && cells[whStockIdx] ? (parseInt(cells[whStockIdx]) || 0) : 0;
    const totalBase = storeStock + godownStock;
    
    const rawCat = catIdx !== -1 && cells[catIdx] ? cells[catIdx] : "";
    const category = toTitleCaseClean(rawCat);
    const minAlert = alertIdx !== -1 && cells[alertIdx] ? (parseInt(cells[alertIdx]) || 6) : 6;

    parsed.push({
      medicine_name: cleanName,
      product_description: description,
      generic_name: description || "Homeopathic Dilution / Mother Tincture",
      naration: description,
      packing: cleanPacking,
      unit_label: cleanPacking,
      strip_label: cleanPacking,
      box_label: "Pack",
      company_name: company,
      company_code: companyCode,
      item_code: itemCode,
      cost_price: purchasePrice,
      cost_price_per_box: purchasePrice,
      purchase_price: purchasePrice,
      box_sale_price: salePrice,
      strip_sale_price: salePrice,
      unit_sale_price: salePrice,
      unit_price: salePrice,
      store_stock: storeStock,
      stock_qty: storeStock,
      warehouse_stock: godownStock,
      total_base_stock: totalBase,
      category,
      has_multi_unit: false,
      strips_per_box: 1,
      units_per_strip: 1,
      low_stock_threshold: minAlert,
      location_stocks: { wh_str: storeStock, ...(godownStock > 0 ? { wh_001: godownStock } : {}) },
      expiry_date: "2028-12-31"
    });
  }

  // Multi-Tier Deterministic Sorting: Primary by Company (A-Z), Secondary by Medicine Name (A-Z)
  parsed.sort((a, b) => {
    const compA = (a.company_name || "").toLowerCase();
    const compB = (b.company_name || "").toLowerCase();
    if (compA !== compB) {
      return compA.localeCompare(compB, undefined, { numeric: true, sensitivity: "base" });
    }
    const nameA = (a.medicine_name || "").toLowerCase();
    const nameB = (b.medicine_name || "").toLowerCase();
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
  });

  return parsed;
}


// ---------- Unified Chart of Accounts (DrCreate & Access Accounting Engine) ----------
export const dbAccounts = {
  getAll: () => getCollection(KEYS.ACCOUNTS) || [],
  getById: (id) => getFromCollectionById(KEYS.ACCOUNTS, id),
  getByAccountNo: (no) => {
    const num = Number(no);
    return dbAccounts.getAll().find((a) => Number(a.account_no) === num) || null;
  },
  getByType: (type) => {
    if (!type || type === "All" || type === "all") return dbAccounts.getAll();
    return dbAccounts.getAll().filter((a) => (a.account_type || "").toLowerCase() === type.toLowerCase());
  },
  getNextAccountNo: () => {
    const list = dbAccounts.getAll();
    if (!list.length) return 1;
    const maxNo = list.reduce((max, a) => Math.max(max, Number(a.account_no) || 0), 0);
    return maxNo + 1;
  },
  add: (accountData) => {
    const list = dbAccounts.getAll();
    const nextNo = accountData.account_no ? Number(accountData.account_no) : dbAccounts.getNextAccountNo();
    const openingBal = Number(accountData.opening_balance || accountData.oppening_balance) || 0;
    const newAccount = {
      id: generateId("acc"),
      account_no: nextNo,
      account_name: (accountData.account_name || "").trim(),
      account_type: (accountData.account_type || "Customer").trim(),
      naration: (accountData.naration || "").trim(),
      opening_balance: openingBal,
      created_at: accountData.date || new Date().toISOString(),
    };

    // If Type is Supplier, sync with dbSuppliers
    if (newAccount.account_type.toLowerCase() === "supplier") {
      const existingSup = dbSuppliers.getAll().find((s) => s.name.toLowerCase() === newAccount.account_name.toLowerCase());
      if (!existingSup) {
        dbSuppliers.add({
          name: newAccount.account_name,
          contact_person: newAccount.naration || "Supplier Contact",
          phone: "03000000000",
          city: "Hyderabad / Kar",
          current_balance: openingBal,
          account_no: nextNo,
        });
      }
    } else if (newAccount.account_type.toLowerCase() !== "cash" && newAccount.account_type.toLowerCase() !== "expense" && newAccount.account_type.toLowerCase() !== "capital") {
      // Sync with Wholesale dbParties
      const existingParty = dbParties.getAll().find((p) => p.name.toLowerCase() === newAccount.account_name.toLowerCase());
      if (!existingParty) {
        dbParties.add({
          name: newAccount.account_name,
          city: newAccount.account_type,
          phone: "03000000000",
          address: `${newAccount.account_type}, Sindh`,
          salesman: "C/O Waheed Bhai",
          credit_limit: 100000,
          balance_due: openingBal,
          account_no: nextNo,
        });
      }
    }

    setCollection(KEYS.ACCOUNTS, [newAccount, ...list]);
    return newAccount;
  },
  bulkImportFromAccess: async () => {
    try {
      let legacyAccounts = [];
      try {
        const legacyAccountsModule = await import("../assets/legacy_access_accounts.json", { with: { type: "json" } });
        legacyAccounts = legacyAccountsModule.default || legacyAccountsModule;
      } catch {
        const legacyAccountsModule = await import("../assets/legacy_access_accounts.json");
        legacyAccounts = legacyAccountsModule.default || legacyAccountsModule;
      }
      if (!Array.isArray(legacyAccounts) || legacyAccounts.length === 0) {
        throw new Error("No legacy account records found in asset dictionary.");
      }


      const existing = dbAccounts.getAll();
      const existingNames = new Set(existing.map((a) => a.account_name.toLowerCase().trim()));
      const existingNos = new Set(existing.map((a) => Number(a.account_no)));

      let addedCount = 0;
      const toAdd = [];

      for (const item of legacyAccounts) {
        const nameKey = item.account_name.toLowerCase().trim();
        if (!existingNames.has(nameKey)) {
          let assignedNo = Number(item.account_no);
          if (existingNos.has(assignedNo)) {
            assignedNo = Math.max(...existingNos, 0) + 1;
          }
          existingNos.add(assignedNo);
          existingNames.add(nameKey);

          const newAcc = {
            id: generateId("acc"),
            account_no: assignedNo,
            account_name: item.account_name,
            account_type: item.account_type || "Customer",
            naration: item.naration || "",
            opening_balance: 0,
            created_at: new Date().toISOString(),
          };
          toAdd.push(newAcc);
          addedCount++;

          // Sync to dbParties if route/customer
          if (item.account_type && !["supplier", "cash", "expense", "capital"].includes(item.account_type.toLowerCase())) {
            const hasParty = dbParties.getAll().some((p) => p.name.toLowerCase() === item.account_name.toLowerCase());
            if (!hasParty) {
              dbParties.add({
                name: item.account_name,
                city: item.account_type,
                phone: "03000000000",
                address: `${item.account_type}, Sindh`,
                salesman: "C/O Waheed Bhai",
                credit_limit: 100000,
                balance_due: 0,
                account_no: assignedNo,
              });
            }
          } else if (item.account_type && item.account_type.toLowerCase() === "supplier") {
            const hasSup = dbSuppliers.getAll().some((s) => s.name.toLowerCase() === item.account_name.toLowerCase());
            if (!hasSup) {
              dbSuppliers.add({
                name: item.account_name,
                contact_person: item.naration || "Supplier Contact",
                phone: "03000000000",
                city: "Hyderabad / Kar",
                current_balance: 0,
                account_no: assignedNo,
              });
            }
          }
        }
      }

      if (toAdd.length > 0) {
        setCollection(KEYS.ACCOUNTS, [...toAdd, ...existing]);
      }
      return { success: true, count: addedCount, total: dbAccounts.getAll().length };
    } catch (err) {
      console.error("Access account bulk import failed:", err);
      return { success: false, error: err.message };
    }
  },
  exportCSV: (accountsList, filename = "Chart_Of_Accounts.csv") => {
    const list = accountsList || dbAccounts.getAll();
    let csv = "Account No,Account Name,Account Type,Naration,Opening Balance\n";
    list.forEach((a) => {
      const name = `"${(a.account_name || "").replace(/"/g, '""')}"`;
      const type = `"${(a.account_type || "").replace(/"/g, '""')}"`;
      const nar = `"${(a.naration || "").replace(/"/g, '""')}"`;
      csv += `${a.account_no || ""},${name},${type},${nar},${a.opening_balance || 0}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  update: (id, accountData) => {
    const list = dbAccounts.getAll();
    const existing = list.find((a) => a.id === id || String(a.account_no) === String(id));
    if (!existing) return null;

    const oldName = existing.account_name;

    const updated = {
      ...existing,
      account_name: accountData.account_name !== undefined ? accountData.account_name.trim() : existing.account_name,
      account_no: accountData.account_no !== undefined ? Number(accountData.account_no) : existing.account_no,
      account_type: accountData.account_type !== undefined ? accountData.account_type.trim() : existing.account_type,
      naration: accountData.naration !== undefined ? accountData.naration.trim() : existing.naration,
      opening_balance: accountData.opening_balance !== undefined ? Number(accountData.opening_balance) : existing.opening_balance,
    };

    const newList = list.map((a) => (a.id === existing.id ? updated : a));
    setCollection(KEYS.ACCOUNTS, newList);

    // Sync updates to dbParties if applicable
    if (updated.account_type.toLowerCase() !== "supplier" && !["cash", "expense", "capital"].includes(updated.account_type.toLowerCase())) {
      const parties = dbParties.getAll();
      const matchedParty = parties.find((p) => Number(p.account_no) === Number(updated.account_no) || p.name.toLowerCase() === oldName.toLowerCase());
      if (matchedParty) {
        dbParties.update(matchedParty.id, {
          name: updated.account_name,
          city: updated.account_type,
          account_no: updated.account_no,
        });
      }
    }

    // Sync updates to dbSuppliers if applicable
    if (updated.account_type.toLowerCase() === "supplier") {
      const suppliers = dbSuppliers.getAll();
      const matchedSup = suppliers.find((s) => Number(s.account_no) === Number(updated.account_no) || s.name.toLowerCase() === oldName.toLowerCase());
      if (matchedSup) {
        dbSuppliers.update(matchedSup.id, {
          name: updated.account_name,
          account_no: updated.account_no,
        });
      }
    }

    return updated;
  },
  delete: (id) => {
    const list = dbAccounts.getAll();
    const filtered = list.filter((a) => a.id !== id && String(a.account_no) !== String(id));
    setCollection(KEYS.ACCOUNTS, filtered);
    return true;
  },
};

// ---------- Medicine Categories Engine ----------
// By default empty: categories are user-defined and dynamically discovered from active inventory
export const DEFAULT_STANDARD_CATEGORIES = [];

export const dbCategories = {
  getAll: () => {
    const saved = getCollection(KEYS.CATEGORIES);
    const seen = new Set();
    const result = [];

    // 1. Add custom saved categories
    (saved || []).forEach((c) => {
      const name = typeof c === "string" ? c.trim() : (c?.name || "").trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        result.push(name);
      }
    });

    // 2. Add standard categories (if configured)
    (DEFAULT_STANDARD_CATEGORIES || []).forEach((name) => {
      if (!seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        result.push(name);
      }
    });

    // 3. Add any categories from active inventory
    const inv = getCollection(KEYS.INVENTORY) || [];
    inv.forEach((item) => {
      const cat = (item.category || "").trim();
      if (cat && !seen.has(cat.toLowerCase())) {
        seen.add(cat.toLowerCase());
        result.push(cat);
      }
    });

    return result;
  },
  add: (categoryName) => {
    if (!categoryName || !categoryName.trim()) return false;
    const clean = categoryName.trim();
    const current = getCollection(KEYS.CATEGORIES) || [];
    const exists = current.some((c) => {
      const n = typeof c === "string" ? c : c?.name;
      return (n || "").toLowerCase().trim() === clean.toLowerCase();
    });
    if (!exists) {
      setCollection(KEYS.CATEGORIES, [...current, { id: generateId("cat"), name: clean, created_at: new Date().toISOString() }]);
      notifyStatusUpdate();
    }
    return clean;
  },
  reset: () => {
    setCollection(KEYS.CATEGORIES, []);
    notifyStatusUpdate();
    return true;
  },
};

// ---------- Medicine Companies Engine ----------
export const dbCompanies = {
  getAll: () => {
    const saved = getCollection(KEYS.COMPANIES);
    const seen = new Set();
    const result = [];

    // 1. Add custom saved companies
    (saved || []).forEach((c) => {
      const name = typeof c === "string" ? c.trim() : (c?.name || "").trim();
      const code = typeof c === "object" ? (c?.code || "").trim().toUpperCase() : "";
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        result.push({
          id: c?.id || generateId("cmp"),
          name,
          code: code || name.substring(0, 3).toUpperCase(),
        });
      }
    });

    // 2. Add companies from dbSuppliers
    const suppliers = getCollection(KEYS.SUPPLIERS) || [];
    suppliers.forEach((s) => {
      const name = (s.name || "").trim();
      const code = (s.supplier_code || s.code || "").trim().toUpperCase();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        result.push({
          id: s.id || generateId("sup"),
          name,
          code: code || name.substring(0, 3).toUpperCase(),
        });
      }
    });

    // 3. Add any companies from active inventory (excluding dummy sample fallbacks)
    const inv = getCollection(KEYS.INVENTORY) || [];
    inv.forEach((item) => {
      const comp = (item.company_name || "").trim();
      const code = (item.item_code || "").trim().toUpperCase();
      if (comp && comp !== "BM Pvt LTD" && comp !== "BM Pvt Ltd" && !seen.has(comp.toLowerCase())) {
        seen.add(comp.toLowerCase());
        result.push({
          id: `cmp_inv_${seen.size}`,
          name: comp,
          code: code || comp.substring(0, 3).toUpperCase(),
        });
      }
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  },
  add: (companyName, companyCode = "") => {
    if (!companyName || !companyName.trim()) return null;
    const cleanName = companyName.trim();
    const cleanCode = (companyCode || "").trim().toUpperCase() || cleanName.substring(0, 3).toUpperCase();
    const current = getCollection(KEYS.COMPANIES) || [];
    const existing = current.find((c) => {
      const n = typeof c === "string" ? c : c?.name;
      return (n || "").toLowerCase().trim() === cleanName.toLowerCase();
    });
    if (!existing) {
      const newCompany = {
        id: generateId("cmp"),
        name: cleanName,
        code: cleanCode,
        created_at: new Date().toISOString(),
      };
      setCollection(KEYS.COMPANIES, [...current, newCompany]);

      // Also ensure it is registered in dbSuppliers so it shows up in Supplier Directory & Purchases
      try {
        const supList = getCollection(KEYS.SUPPLIERS) || [];
        const hasSup = supList.some((s) => (s.name || "").toLowerCase().trim() === cleanName.toLowerCase());
        if (!hasSup) {
          const newSup = {
            id: generateId("sup"),
            name: cleanName,
            supplier_code: cleanCode,
            company_name: cleanName,
            contact_person: `${cleanName} Rep`,
            phone: "",
            address: "",
            city: "Hyderabad",
            current_balance: 0,
            balance_due: 0,
            created_at: new Date().toISOString(),
          };
          setCollection(KEYS.SUPPLIERS, [...supList, newSup]);
        }
      } catch {}

      notifyStatusUpdate();
      return newCompany;
    }
    return typeof existing === "object" ? existing : { name: cleanName, code: cleanCode };
  },
  delete: (idOrName) => {
    const current = getCollection(KEYS.COMPANIES) || [];
    const filtered = current.filter((c) => {
      if (typeof c === "string") return c.toLowerCase() !== String(idOrName).toLowerCase();
      return c.id !== idOrName && c.name?.toLowerCase() !== String(idOrName).toLowerCase();
    });
    setCollection(KEYS.COMPANIES, filtered);
    notifyStatusUpdate();
    return true;
  },
};

// ---------- Immutable Stock Movements & Event-Sourced Ledger Engine ----------
export const dbStockMovements = {
  getAll: () => getCollection(KEYS.STOCK_MOVEMENTS) || [],
  getByInventory: (inventoryId) => (getCollection(KEYS.STOCK_MOVEMENTS) || []).filter((m) => m.inventory_id === inventoryId),

  recordMovement: (movementData) => {
    const movements = dbStockMovements.getAll();
    const prevHash = movements.length > 0 ? movements[movements.length - 1].hash : "GENESIS_CLINICFLOW_2026";
    const timestamp = movementData.timestamp || new Date().toISOString();
    const seq = movements.length + 1;
    const movId = movementData.movement_id || `mov_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const activeCashier = typeof window !== "undefined" && typeof window.getActiveCashier === "function" ? window.getActiveCashier() : null;
    const actorId = movementData.actor_id || movementData.active_cashier_id || activeCashier?.id || "system";
    const actorName = movementData.actor_name || movementData.active_cashier_name || activeCashier?.name || "System";

    const payload = {
      movement_id: movId,
      sequence_no: seq,
      timestamp,
      prev_hash: prevHash,
      inventory_id: movementData.inventory_id,
      medicine_name: movementData.medicine_name || "",
      company_name: movementData.company_name || "",
      item_code: movementData.item_code || "",
      batch_no: movementData.batch_no || "DEFAULT",
      expiry_date: movementData.expiry_date || "2028-12-31",
      movement_type: movementData.movement_type || "adjustment",
      direction: movementData.direction || (["purchase", "transfer_in", "return", "opening"].includes(movementData.movement_type) ? "IN" : "OUT"),
      source_location_id: movementData.source_location_id || "EXTERNAL",
      destination_location_id: movementData.destination_location_id || "wh_str",
      selected_unit_type: movementData.selected_unit_type || "unit",
      qty_selected_unit: safeQty(movementData.qty_selected_unit || movementData.qty_base_units || 1),
      qty_base_units: safeQty(movementData.qty_base_units || movementData.qty_selected_unit || 1),
      rate_per_base_unit: safeMoney(movementData.rate_per_base_unit || 0),
      gross_amount: safeMoney(movementData.gross_amount || 0),
      discount_amount: safeMoney(movementData.discount_amount || 0),
      net_amount: safeMoney(movementData.net_amount || 0),
      source_voucher_type: movementData.source_voucher_type || "MANUAL",
      source_voucher_no: movementData.source_voucher_no || "",
      source_voucher_id: movementData.source_voucher_id || "",
      actor_id: actorId,
      actor_name: actorName,
      active_cashier_id: actorId,
      active_cashier_name: actorName,
      notes: movementData.notes || "",
    };

    const hashStr = sha256Sync(prevHash + "::" + JSON.stringify(payload));
    const event = { ...payload, hash: hashStr };

    movements.push(event);
    setCollection(KEYS.STOCK_MOVEMENTS, movements);

    if (["write_off", "adjustment", "quarantine", "damage", "expiry"].includes(movementData.movement_type)) {
      dbAuditLogs.logEvent({
        action: "STOCK_WRITE_OFF",
        entity: "inventory",
        entity_id: movementData.inventory_id || movId,
        actor_id: actorId,
        actor_name: actorName,
        reason: `${movementData.movement_type.toUpperCase()} for ${movementData.medicine_name || 'Item'} (Batch: ${movementData.batch_no || 'DEFAULT'}, Qty: ${movementData.qty_base_units || 1}) - ${movementData.notes || 'Stock adjustment'}`,
        after: event,
      });
    }

    try {
      dbOutbox.enqueue("STOCK_MOVEMENT", event);
    } catch {}

    return event;
  },

  verifyChainIntegrity: () => {
    const movements = dbStockMovements.getAll();
    if (movements.length === 0) return { intact: true, totalMovements: 0 };

    let expectedPrevHash = "GENESIS_CLINICFLOW_2026";
    for (let i = 0; i < movements.length; i++) {
      const cur = movements[i];
      if (cur.prev_hash !== expectedPrevHash) {
        return {
          intact: false,
          corruptedMovementId: cur.movement_id,
          reason: `Broken chain link at index ${i}. Expected prev_hash ${expectedPrevHash}, got ${cur.prev_hash}`,
        };
      }
      const { hash, ...body } = cur;
      const computedHash = sha256Sync(expectedPrevHash + "::" + JSON.stringify(body));
      if (computedHash !== hash) {
        return {
          intact: false,
          corruptedMovementId: cur.movement_id,
          reason: `Invalid cryptographic hash at index ${i}. Computed ${computedHash}, stored ${hash}`,
        };
      }
      expectedPrevHash = hash;
    }
    return { intact: true, totalMovements: movements.length };
  },

  reconstructStockLedger: (targetInventoryId = null, asOfDate = null) => {
    const movements = dbStockMovements.getAll();
    const maxTimestamp = asOfDate ? new Date(asOfDate).getTime() : Infinity;

    const filtered = movements
      .filter((m) => (!targetInventoryId || m.inventory_id === targetInventoryId) && new Date(m.timestamp).getTime() <= maxTimestamp)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() || a.sequence_no - b.sequence_no);

    let runningTotalStock = 0;
    const runningLocationStock = new Map();
    const dailyTimelineMap = new Map();

    for (const event of filtered) {
      const isIncoming = event.direction === "IN";
      const delta = isIncoming ? event.qty_base_units : -event.qty_base_units;
      runningTotalStock = safeAdd(runningTotalStock, delta);

      if (event.direction === "IN") {
        if (event.destination_location_id && event.destination_location_id !== "CUSTOMER" && event.destination_location_id !== "SCRAP") {
          const cur = runningLocationStock.get(event.destination_location_id) || 0;
          runningLocationStock.set(event.destination_location_id, safeAdd(cur, event.qty_base_units));
        }
      } else if (event.direction === "OUT") {
        if (event.source_location_id && event.source_location_id !== "EXTERNAL") {
          const cur = runningLocationStock.get(event.source_location_id) || 0;
          runningLocationStock.set(event.source_location_id, safeSub(cur, event.qty_base_units));
        }
      } else if (event.direction === "TRANSFER") {
        if (event.source_location_id && event.source_location_id !== "EXTERNAL") {
          const cur = runningLocationStock.get(event.source_location_id) || 0;
          runningLocationStock.set(event.source_location_id, safeSub(cur, event.qty_base_units));
        }
        if (event.destination_location_id && event.destination_location_id !== "CUSTOMER" && event.destination_location_id !== "SCRAP") {
          const cur = runningLocationStock.get(event.destination_location_id) || 0;
          runningLocationStock.set(event.destination_location_id, safeAdd(cur, event.qty_base_units));
        }
      }

      const dateObj = new Date(event.timestamp);
      const dateKey = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString("en-GB") : String(event.timestamp).split("T")[0];

      if (!dailyTimelineMap.has(dateKey)) {
        dailyTimelineMap.set(dateKey, {
          date: dateKey,
          raw_date: dateObj,
          total_in: 0,
          total_out: 0,
          vouchers: [],
        });
      }

      const dayEntry = dailyTimelineMap.get(dateKey);
      if (isIncoming) {
        dayEntry.total_in = safeAdd(dayEntry.total_in, event.qty_base_units);
      } else {
        dayEntry.total_out = safeAdd(dayEntry.total_out, event.qty_base_units);
      }

      dayEntry.vouchers.push({
        date: dateKey,
        voucher_no: event.source_voucher_no || event.movement_id,
        type: event.movement_type.toUpperCase(),
        description: event.notes || `${event.movement_type} (${event.source_voucher_no || event.movement_id})`,
        in_qty: isIncoming ? event.qty_base_units : 0,
        out_qty: !isIncoming ? event.qty_base_units : 0,
        rate: event.rate_per_base_unit,
        gross: event.gross_amount,
        disc_pct: event.discount_amount > 0 ? "Disc" : "-",
        disc_flat: event.discount_amount,
        net: event.net_amount,
        running_balance_snapshot: runningTotalStock,
      });
    }

    const timeline = Array.from(dailyTimelineMap.values()).sort((a, b) => b.raw_date - a.raw_date);

    return {
      inventory_id: targetInventoryId,
      as_of_date: asOfDate,
      total_reconstructed_stock: runningTotalStock,
      location_stocks: Object.fromEntries(runningLocationStock.entries()),
      daily_timeline: timeline,
      event_count: filtered.length,
    };
  },
};

// ---------- Cross-Ledger Autonomous Reconciliation Engine ----------
export function reconcileFinancialAndStockLedgers() {
  const inventoryList = dbInventory.getAll();
  const stockMovements = dbStockMovements.getAll();
  const salesList = dbSales.getAll();

  const anomalies = [];

  if (stockMovements.length > 0) {
    inventoryList.forEach((item) => {
      const recon = dbStockMovements.reconstructStockLedger(item.id);
      if (recon.event_count > 0) {
        const recordedStock = safeQty(item.total_base_stock ?? item.stock_qty);
        if (Math.abs(recon.total_reconstructed_stock - recordedStock) > 0.001) {
          anomalies.push({
            domain: "INVENTORY_STOCK_DRIFT",
            severity: "HIGH",
            entity_id: item.id,
            entity_name: item.medicine_name,
            recorded_value: recordedStock,
            reconstructed_value: recon.total_reconstructed_stock,
            drift: safeSub(recordedStock, recon.total_reconstructed_stock),
            fix_action: "AUTO_SYNCHRONIZE_ITEM_BASE_STOCK",
          });
        }
      }
    });
  }

  salesList.forEach((sale) => {
    if (!sale.is_voided) {
      const netTotal = safeMoney(sale.net_amount || sale.total_amount || sale.total || 0);
      const paid = safeMoney(sale.paid_amount || sale.amount_paid || 0);
      const due = safeMoney(sale.balance_due || sale.due_amount || 0);
      if (Math.abs(safeSub(netTotal, safeAdd(paid, due))) > 0.05) {
        anomalies.push({
          domain: "SALE_INVOICE_BALANCE_MISMATCH",
          severity: "MEDIUM",
          entity_id: sale.id,
          voucher_no: sale.voucher_no || sale.receipt_no,
          net_total: netTotal,
          paid_plus_due: safeAdd(paid, due),
        });
      }
    }
  });

  return {
    is_healthy: anomalies.length === 0,
    timestamp: new Date().toISOString(),
    total_anomalies: anomalies.length,
    anomalies,
  };
}

// ---------- Patient Ledger Reconciliation Engine ----------
export function reconcilePatientLedger(patientId) {
  const ledger = dbPatientLedger.getByPatient(patientId);
  if (!ledger) {
    return { isBalanced: true, discrepancy: 0, recordedBalance: 0, expectedBalance: 0 };
  }

  const txns = ledger.transactions || [];
  let calculatedDebits = 0;
  let calculatedCredits = 0;

  for (const tx of txns) {
    const amt = safeMoney(tx.amount);
    if (tx.type === "debit") {
      calculatedDebits = safeAdd(calculatedDebits, amt);
    } else if (tx.type === "credit") {
      calculatedCredits = safeAdd(calculatedCredits, amt);
    }
  }

  const expectedBalance = Math.max(0, safeSub(calculatedDebits, calculatedCredits));
  const recordedBalance = safeMoney(ledger.balance_due);
  const discrepancy = safeSub(recordedBalance, expectedBalance);

  return {
    patient_id: patientId,
    recordedTotalCredit: safeMoney(ledger.total_credit),
    calculatedDebits,
    recordedTotalPaid: safeMoney(ledger.total_paid),
    calculatedCredits,
    recordedBalance,
    expectedBalance,
    discrepancy,
    isBalanced: Math.abs(discrepancy) < 0.001,
  };
}

// ---------- Supplier Ledger Reconciliation Engine ----------
export function reconcileSupplierLedger(supplierId) {
  const allTxns = dbSupplierLedger.getBySupplier(supplierId);
  const sortedTxns = [...allTxns].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );

  let cumulativeBalance = 0;
  let totalDebits = 0;
  let totalCredits = 0;
  const repairedTxns = [];

  for (const tx of sortedTxns) {
    const debit = safeMoney(tx.debit);
    const credit = safeMoney(tx.credit);
    totalDebits = safeAdd(totalDebits, debit);
    totalCredits = safeAdd(totalCredits, credit);
    cumulativeBalance = Math.max(0, safeSub(safeAdd(cumulativeBalance, debit), credit));
    repairedTxns.push({ ...tx, running_balance: cumulativeBalance });
  }

  const supplier = dbSuppliers.getById(supplierId);
  const recordedBalance = safeMoney(supplier?.current_balance || 0);
  const discrepancy = safeSub(recordedBalance, cumulativeBalance);

  return {
    supplier_id: supplierId,
    totalDebits,
    totalCredits,
    computedRunningBalance: cumulativeBalance,
    recordedSupplierBalance: recordedBalance,
    discrepancy,
    isBalanced: Math.abs(safeSub(Math.max(0, safeSub(totalDebits, totalCredits)), cumulativeBalance)) < 0.001,
    repairedTxns,
  };
}

// ---------- General Ledger Double-Entry Trial Balance Validator ----------
export function checkGeneralLedgerTrialBalance() {
  const mainAc = getCollection(KEYS.MAIN_AC) || [];
  let totalDebit = 0;
  let totalCredit = 0;

  mainAc.forEach((entry) => {
    totalDebit = safeAdd(totalDebit, safeMoney(entry.debit));
    totalCredit = safeAdd(totalCredit, safeMoney(entry.credit));
  });

  const diff = safeSub(totalDebit, totalCredit);

  return {
    totalDebit,
    totalCredit,
    difference: diff,
    isBalanced: Math.abs(diff) < 0.001,
  };
}

// ---------- Financial Period Closing Lock Guard ----------
export function isPeriodClosed(dateStr) {
  if (!dateStr) return false;
  const targetDate = String(dateStr).split("T")[0];
  const closings = getCollection(KEYS.SHIFT_CLOSINGS) || [];
  return closings.some((c) => {
    const cDate = (c.date || c.shift_date || c.closed_at || "").split("T")[0];
    return cDate === targetDate && c.is_locked !== false;
  });
}

export function assertPeriodOpen(dateStr) {
  if (isPeriodClosed(dateStr)) {
    const err = new Error(`Financial period for ${String(dateStr).split("T")[0]} is closed and locked. Post an adjustment on the current open date.`);
    err.code = "PERIOD_LOCKED";
    throw err;
  }
}

// ---------- Universal Financial Transactions Journal Engine ----------
export const dbTransactions = {
  getAll: () => getCollection(KEYS.TRANSACTIONS) || [],
  getById: (id) => (getCollection(KEYS.TRANSACTIONS) || []).find((t) => t.id === id) || null,
  getByDate: (dateStr) => {
    const target = (dateStr || "").split("T")[0];
    return (getCollection(KEYS.TRANSACTIONS) || []).filter((t) => (t.date || "").split("T")[0] === target);
  },
  recordTransaction: (tx) => {
    const list = getCollection(KEYS.TRANSACTIONS) || [];
    const entryNo = tx.entry_no || `TX-${new Date().getFullYear()}-${String(list.length + 1).padStart(5, "0")}`;
    const amount = safeMoney(tx.amount);
    if (amount <= 0) {
      throw new Error("Transaction amount must be strictly positive");
    }

    const newTx = {
      id: tx.id || generateId("tx"),
      entry_no: entryNo,
      date: tx.date || new Date().toISOString(),
      transaction_type: tx.transaction_type,
      account_debit: tx.account_debit || "Cash In Hand",
      account_credit: tx.account_credit || "General Revenue",
      amount,
      source_module: tx.source_module || "cashbook",
      source_reference_id: tx.source_reference_id || "",
      voucher_no: tx.voucher_no || "",
      party_id: tx.party_id || null,
      party_name: tx.party_name || "",
      actor_id: tx.actor_id || "system",
      actor_name: tx.actor_name || "System",
      status: tx.status || "posted",
      reversal_of_id: tx.reversal_of_id || null,
      narration: tx.narration || "",
      created_at: new Date().toISOString(),
    };

    setCollection(KEYS.TRANSACTIONS, [newTx, ...list]);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return newTx;
  },
  reverseTransaction: (txId, reason = "Reversal Voucher", actor = { id: "system", name: "System" }) => {
    const list = getCollection(KEYS.TRANSACTIONS) || [];
    const target = list.find((t) => t.id === txId);
    if (!target) return { success: false, error: "Transaction not found" };
    if (target.status === "reversed") return { success: false, error: "Transaction already reversed" };

    const reversalTx = {
      id: generateId("tx"),
      entry_no: `TX-${new Date().getFullYear()}-${String(list.length + 1).padStart(5, "0")}`,
      date: new Date().toISOString(),
      transaction_type: "REVERSAL",
      account_debit: target.account_credit,
      account_credit: target.account_debit,
      amount: target.amount,
      source_module: "reversal",
      source_reference_id: target.id,
      voucher_no: `REV-${target.voucher_no || target.entry_no}`,
      party_id: target.party_id,
      party_name: target.party_name,
      actor_id: actor.id || "system",
      actor_name: actor.name || "System",
      status: "reversal_entry",
      reversal_of_id: target.id,
      narration: `Reversal: ${reason} (Original Ref: ${target.entry_no})`,
      created_at: new Date().toISOString(),
    };

    const updatedTarget = {
      ...target,
      status: "reversed",
      reversed_at: new Date().toISOString(),
      reversal_id: reversalTx.id,
    };

    const updatedList = [reversalTx, ...list.map((t) => (t.id === target.id ? updatedTarget : t))];
    setCollection(KEYS.TRANSACTIONS, updatedList);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return { success: true, reversal: reversalTx, original: updatedTarget };
  },
};

// ---------- Enterprise Approvals & Governance Workflow Engine ----------
export const dbApprovals = {
  getAll: () => getCollection(KEYS.APPROVALS) || [],
  getById: (id) => (getCollection(KEYS.APPROVALS) || []).find((a) => a.id === id) || null,
  getByStatus: (status = "pending") => (getCollection(KEYS.APPROVALS) || []).filter((a) => a.status === status),
  getPendingCount: () => (getCollection(KEYS.APPROVALS) || []).filter((a) => a.status === "pending").length,
  getByRequestor: (requestorId) => (getCollection(KEYS.APPROVALS) || []).filter((a) => a.requested_by_id === requestorId),
  getByType: (requestType) => (getCollection(KEYS.APPROVALS) || []).filter((a) => a.request_type === requestType),

  evaluateGovernance: ({ requestType, role, amount = 0, discountPct = 0, qty = 0 }) => {
    if (["owner", "admin"].includes(role)) {
      return { requiresApproval: false, reason: "Authorized role bypass" };
    }

    const rules = {
      max_discount_pct: 15,
      max_discount_amount: 500,
      max_stock_adjust_qty: 10,
    };

    if (requestType === "large_discount") {
      if (discountPct > rules.max_discount_pct) {
        return {
          requiresApproval: true,
          reason: `Discount of ${discountPct}% exceeds maximum allowed limit (${rules.max_discount_pct}%) without supervisor approval.`,
        };
      }
      if (amount > rules.max_discount_amount) {
        return {
          requiresApproval: true,
          reason: `Discount amount of Rs. ${amount} exceeds Rs. ${rules.max_discount_amount} supervisor threshold.`,
        };
      }
    }

    if (requestType === "stock_adjustment") {
      if (Math.abs(qty) > rules.max_stock_adjust_qty) {
        return {
          requiresApproval: true,
          reason: `Stock adjustment of ${Math.abs(qty)} units exceeds threshold of ${rules.max_stock_adjust_qty} units.`,
        };
      }
    }

    if (["sale_reversal", "purchase_reversal"].includes(requestType)) {
      return {
        requiresApproval: true,
        reason: `Reversals and voids require supervisor verification and approval.`,
      };
    }

    if (requestType === "ledger_adjustment") {
      return {
        requiresApproval: true,
        reason: `Direct ledger debit/credit override requires supervisor authorization.`,
      };
    }

    return { requiresApproval: false };
  },

  createRequest: (input) => {
    const list = getCollection(KEYS.APPROVALS) || [];
    const newId = generateId("appr");
    const now = new Date().toISOString();

    const record = {
      ...input,
      id: input.id || newId,
      status: "pending",
      requested_at: input.requested_at || now,
      reviewed_by_id: null,
      reviewed_by_name: null,
      reviewed_at: null,
      review_notes: null,
      execution_status: "unexecuted",
      executed_at: null,
      execution_error: null,
      execution_result: null,
    };

    setCollection(KEYS.APPROVALS, [record, ...list]);
    try {
      window.dispatchEvent(new CustomEvent("clinicflow_approvals_change", { detail: { id: record.id, status: "pending" } }));
      window.dispatchEvent(new Event("clinicflow_status_update"));
    } catch {}

    return record;
  },

  reviewRequest: ({ id, reviewerId, reviewerName, reviewerRole = "admin", decision, reviewNotes = "" }) => {
    const isApproverRole = ["admin", "owner", "manager"].includes(reviewerRole);
    if (!isApproverRole) {
      throw new Error(`UNAUTHORIZED_APPROVER: Role '${reviewerRole}' cannot approve or reject requests.`);
    }

    const list = getCollection(KEYS.APPROVALS) || [];
    const existing = list.find((a) => a.id === id);
    if (!existing) throw new Error(`Approval request #${id} not found.`);
    if (existing.status !== "pending") {
      throw new Error(`TERMINAL_STATE_LOCKED: Approval request is already in '${existing.status}' status.`);
    }

    const now = new Date().toISOString();
    const updated = {
      ...existing,
      status: decision === "approve" ? "approved" : "rejected",
      reviewed_by_id: reviewerId,
      reviewed_by_name: reviewerName,
      reviewed_at: now,
      review_notes: reviewNotes,
    };

    setCollection(KEYS.APPROVALS, list.map((a) => (a.id === id ? updated : a)));
    try {
      window.dispatchEvent(new CustomEvent("clinicflow_approvals_change", { detail: { id, status: updated.status } }));
      window.dispatchEvent(new Event("clinicflow_status_update"));
    } catch {}

    return updated;
  },

  executeApprovedPayload: (id, executorId = "system", executorName = "System") => {
    const list = getCollection(KEYS.APPROVALS) || [];
    const request = list.find((a) => a.id === id);
    if (!request) throw new Error(`Approval request #${id} not found.`);
    if (request.status !== "approved") {
      throw new Error(`INVALID_TRANSITION: Cannot execute request ${id}: Must be in 'approved' status.`);
    }
    if (request.execution_status === "executed") {
      throw new Error(`TERMINAL_STATE_LOCKED: Approval request #${id} has already been executed.`);
    }

    const finalState = {
      ...request,
      execution_status: "executed",
      executed_at: new Date().toISOString(),
      executed_by_id: executorId,
      executed_by_name: executorName,
      execution_result: { executed: true, timestamp: new Date().toISOString() },
      execution_error: null,
    };

    setCollection(KEYS.APPROVALS, list.map((a) => (a.id === id ? finalState : a)));
    try {
      window.dispatchEvent(new CustomEvent("clinicflow_approvals_change", { detail: { id, execution_status: "executed" } }));
      window.dispatchEvent(new Event("clinicflow_status_update"));
    } catch {}

    return finalState;
  },

  cancelRequest: (id, cancelledById = "system", reason = "Cancelled by requestor") => {
    const list = getCollection(KEYS.APPROVALS) || [];
    const existing = list.find((a) => a.id === id);
    if (!existing || existing.status !== "pending") {
      throw new Error(`TERMINAL_STATE_LOCKED: Cannot cancel approval request #${id}`);
    }

    const updated = {
      ...existing,
      status: "cancelled",
      review_notes: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by_id: cancelledById,
    };

    setCollection(KEYS.APPROVALS, list.map((a) => (a.id === id ? updated : a)));
    try {
      window.dispatchEvent(new CustomEvent("clinicflow_approvals_change", { detail: { id, status: "cancelled" } }));
      window.dispatchEvent(new Event("clinicflow_status_update"));
    } catch {}

    return updated;
  },
};

// ---------- Enterprise Batch Tracking & Expiry Management Engine ----------
export const dbMedicineBatches = {
  getAll: () => getCollection(KEYS.MEDICINE_BATCHES) || [],
  getById: (id) => getFromCollectionById(KEYS.MEDICINE_BATCHES, id),
  getByInventoryId: (inventoryId) => {
    const all = getCollection(KEYS.MEDICINE_BATCHES) || [];
    return all.filter((b) => b.inventory_id === inventoryId);
  },
  getByInventory: (inventoryId) => {
    return dbMedicineBatches.getByInventoryId(inventoryId);
  },

  addBatch: (batchData) => {
    const all = getCollection(KEYS.MEDICINE_BATCHES) || [];
    const id = batchData.id || `bat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();
    const today = now.split("T")[0];

    const initialQty = safeQty(batchData.initial_quantity || batchData.quantity_base_units || 0);
    const currentQty = safeQty(batchData.quantity_base_units || initialQty);
    const locQuantities = { ...(batchData.location_quantities || {}) };

    if (Object.keys(locQuantities).length === 0) {
      const targetWh = batchData.warehouse_id || "wh_001";
      locQuantities[targetWh] = currentQty;
    }

    const expiryDate = batchData.expiry_date || "2028-12-31";
    let status = "active";
    if (currentQty === 0) status = "depleted";
    else if (expiryDate < today) status = "expired";

    const newBatch = {
      id,
      clinic_id: batchData.clinic_id || "clinic_001",
      inventory_id: batchData.inventory_id,
      medicine_name: batchData.medicine_name || "Medicine Item",
      company_name: batchData.company_name || "",
      item_code: batchData.item_code || "",
      batch_no: batchData.batch_no || `BATCH-${Date.now().toString().slice(-4)}`,
      manufacturing_date: batchData.manufacturing_date || today,
      expiry_date: expiryDate,
      cost_price: safeMoney(batchData.cost_price || 0),
      sale_price: safeMoney(batchData.sale_price || 0),
      initial_quantity: initialQty,
      quantity_base_units: currentQty,
      location_quantities: locQuantities,
      supplier_id: batchData.supplier_id || null,
      supplier_name: batchData.supplier_name || null,
      purchase_invoice_no: batchData.purchase_invoice_no || null,
      status,
      is_quarantined: Boolean(batchData.is_quarantined),
      quarantine_reason: batchData.quarantine_reason || null,
      quarantined_at: batchData.quarantined_at || null,
      quarantined_by: batchData.quarantined_by || null,
      created_at: now,
      updated_at: now,
    };

    setCollection(KEYS.MEDICINE_BATCHES, [newBatch, ...all]);

    if (batchData.sync_inventory !== false) {
      const inv = dbInventory.getById(batchData.inventory_id);
      if (inv) {
        dbInventory.addStock(inv.id, currentQty, batchData.warehouse_id || "godown");
      }
    }

    return newBatch;
  },

  update: (id, updates) => {
    const all = getCollection(KEYS.MEDICINE_BATCHES) || [];
    const index = all.findIndex((b) => b.id === id);
    if (index === -1) return null;

    const updated = {
      ...all[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    all[index] = updated;
    setCollection(KEYS.MEDICINE_BATCHES, all);
    return updated;
  },

  bulkUpdate: (updatedBatches) => {
    const all = getCollection(KEYS.MEDICINE_BATCHES) || [];
    const updateMap = new Map(updatedBatches.map((b) => [b.id, b]));
    const nextList = all.map((b) => updateMap.get(b.id) || b);
    setCollection(KEYS.MEDICINE_BATCHES, nextList);
  },

  allocateFEFODeduction: (inventoryId, requiredBaseQty, warehouseId = "wh_str") => {
    const today = new Date().toISOString().split("T")[0];
    const batches = dbMedicineBatches.getByInventoryId(inventoryId);

    const candidates = batches.filter((b) => {
      const locQty = Number(b.location_quantities?.[warehouseId]) || 0;
      return (
        locQty > 0 &&
        !b.is_quarantined &&
        b.status !== "quarantined" &&
        b.status !== "depleted" &&
        b.expiry_date >= today
      );
    });

    candidates.sort((a, b) => {
      const diff = new Date(a.expiry_date) - new Date(b.expiry_date);
      if (diff !== 0) return diff;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    let remaining = safeQty(requiredBaseQty);
    const allocations = [];
    const modifiedBatches = [];

    for (const batch of candidates) {
      if (remaining <= 0) break;
      const avail = Number(batch.location_quantities[warehouseId]) || 0;
      const take = Math.min(remaining, avail);

      const nextLocQty = safeSub(avail, take);
      const nextTotalQty = safeSub(batch.quantity_base_units, take);

      const updatedBatch = {
        ...batch,
        quantity_base_units: Math.max(0, nextTotalQty),
        location_quantities: {
          ...batch.location_quantities,
          [warehouseId]: nextLocQty,
        },
        status: nextTotalQty <= 0 ? "depleted" : batch.status,
        updated_at: new Date().toISOString(),
      };

      allocations.push({
        batch_id: batch.id,
        batch_no: batch.batch_no,
        expiry_date: batch.expiry_date,
        cost_price: batch.cost_price,
        sale_price: batch.sale_price,
        deducted_qty: take,
        warehouse_id: warehouseId,
      });

      modifiedBatches.push(updatedBatch);
      remaining = safeSub(remaining, take);
    }

    if (remaining > 0) {
      return {
        success: false,
        error: `Insufficient unexpired batch stock for item. Needed ${requiredBaseQty}, but only ${requiredBaseQty - remaining} available.`,
        allocations: [],
      };
    }

    dbMedicineBatches.bulkUpdate(modifiedBatches);
    dbInventory.deductStockFromLocation(inventoryId, requiredBaseQty, warehouseId);

    return { success: true, allocations };
  },

  getExpiringBatches: (daysThreshold = 90, warehouseId = null) => {
    const now = new Date();
    const targetDate = new Date(now.getTime() + daysThreshold * 86400000);
    const targetStr = targetDate.toISOString().split("T")[0];

    const batches = (getCollection(KEYS.MEDICINE_BATCHES) || []).filter((b) => {
      if (b.status === "depleted" || (b.quantity_base_units || 0) <= 0) return false;
      if (warehouseId && (b.location_quantities?.[warehouseId] || 0) <= 0) return false;
      return b.expiry_date <= targetStr;
    });

    return batches.map((b) => {
      const expDate = new Date(b.expiry_date);
      const diffDays = Math.ceil((expDate - now) / 86400000);
      let alertLevel = "SAFE";
      if (diffDays < 0) alertLevel = "EXPIRED";
      else if (diffDays <= 30) alertLevel = "CRITICAL_30";
      else if (diffDays <= 60) alertLevel = "WARNING_60";
      else if (diffDays <= 90) alertLevel = "ADVISORY_90";

      return {
        ...b,
        days_to_expiry: diffDays,
        alert_level: alertLevel,
        is_expired: diffDays < 0,
      };
    });
  },

  quarantineBatch: (batchId, { reason, actor_id, actor_name } = {}) => {
    const batch = dbMedicineBatches.getById(batchId);
    if (!batch) return { success: false, error: "Batch not found" };

    const updated = dbMedicineBatches.update(batchId, {
      status: "quarantined",
      is_quarantined: true,
      quarantine_reason: reason || "Quality / Expiry Quarantine",
      quarantined_at: new Date().toISOString(),
      quarantined_by: actor_name || "Admin",
    });

    dbStockMovements.recordMovement({
      inventory_id: batch.inventory_id,
      medicine_name: batch.medicine_name,
      item_code: batch.item_code,
      batch_no: batch.batch_no,
      expiry_date: batch.expiry_date,
      movement_type: "damage",
      direction: "OUT",
      source_location_id: "wh_001",
      destination_location_id: "SCRAP",
      qty_base_units: batch.quantity_base_units,
      rate_per_base_unit: batch.cost_price,
      gross_amount: safeMul(batch.quantity_base_units, batch.cost_price),
      net_amount: safeMul(batch.quantity_base_units, batch.cost_price),
      source_voucher_type: "QUARANTINE_ORDER",
      source_voucher_no: `QRT-${Date.now().toString().slice(-6)}`,
      actor_id: actor_id || "admin",
      actor_name: actor_name || "Admin",
      notes: `Quarantined batch ${batch.batch_no}: ${reason || "Expired stock"}`,
    });

    return { success: true, batch: updated };
  },

  releaseFromQuarantine: (batchId, { reason, actor_id, actor_name } = {}) => {
    const batch = dbMedicineBatches.getById(batchId);
    if (!batch) return { success: false, error: "Batch not found" };

    const updated = dbMedicineBatches.update(batchId, {
      status: "active",
      is_quarantined: false,
      quarantine_reason: null,
      quarantined_at: null,
      quarantined_by: null,
    });

    dbStockMovements.recordMovement({
      inventory_id: batch.inventory_id,
      medicine_name: batch.medicine_name,
      item_code: batch.item_code,
      batch_no: batch.batch_no,
      expiry_date: batch.expiry_date,
      movement_type: "adjustment",
      direction: "IN",
      source_location_id: "SCRAP",
      destination_location_id: "wh_001",
      qty_base_units: batch.quantity_base_units,
      rate_per_base_unit: batch.cost_price,
      gross_amount: safeMul(batch.quantity_base_units, batch.cost_price),
      net_amount: safeMul(batch.quantity_base_units, batch.cost_price),
      source_voucher_no: `REL-${Date.now().toString().slice(-6)}`,
      actor_id: actor_id || "admin",
      actor_name: actor_name || "Admin",
      notes: `Released batch ${batch.batch_no} from quarantine: ${reason || "Inspected and cleared"}`,
    });

    return { success: true, batch: updated };
  },
};

// ---------- Physical Stock Audit & Variance Reconciliation Engine ----------
export function reconcilePhysicalStock(inventoryId, warehouseId, physicalCount, {
  reason = "Physical stock count variance",
  actor_id = "admin",
  actor_name = "Admin",
  approved_by = null,
} = {}) {
  const inv = dbInventory.getById(inventoryId);
  if (!inv) return { success: false, error: "Inventory item not found." };

  const locStocks = { ...(inv.location_stocks || {}) };
  const systemCount = safeQty(locStocks[warehouseId] || (warehouseId === "wh_str" ? inv.store_stock : inv.warehouse_stock) || 0);
  const counted = safeQty(physicalCount);
  const variance = safeSub(counted, systemCount);

  if (variance === 0) {
    return {
      success: true,
      variance: 0,
      system_count: systemCount,
      physical_count: counted,
      status: "EXACT",
      message: "Physical count perfectly matches system ledger.",
    };
  }

  locStocks[warehouseId] = counted;
  const newStoreStock = safeQty(locStocks["wh_str"] || 0);
  const newWarehouseStock = Object.entries(locStocks)
    .filter(([k]) => k !== "wh_str")
    .reduce((sum, [, v]) => safeAdd(sum, safeQty(v)), 0);

  const updatedInv = {
    ...inv,
    location_stocks: locStocks,
    store_stock: newStoreStock,
    warehouse_stock: newWarehouseStock,
    total_base_stock: safeAdd(newStoreStock, newWarehouseStock),
    stock_qty: newStoreStock,
    updated_at: new Date().toISOString(),
  };

  dbInventory.update(inventoryId, updatedInv);

  const isSurplus = variance > 0;
  dbStockMovements.recordMovement({
    inventory_id: inventoryId,
    medicine_name: inv.medicine_name || inv.name,
    company_name: inv.company_name,
    item_code: inv.item_code,
    movement_type: "adjustment",
    direction: isSurplus ? "IN" : "OUT",
    source_location_id: isSurplus ? "AUDIT_SURPLUS" : warehouseId,
    destination_location_id: isSurplus ? warehouseId : "AUDIT_SHORTAGE",
    qty_base_units: Math.abs(variance),
    rate_per_base_unit: inv.unit_sale_price || inv.retail_price || 0,
    gross_amount: safeMul(Math.abs(variance), inv.unit_sale_price || inv.retail_price || 0),
    net_amount: safeMul(Math.abs(variance), inv.unit_sale_price || inv.retail_price || 0),
    source_voucher_type: "STOCK_AUDIT_ADJUSTMENT",
    source_voucher_no: `AUD-${Date.now().toString().slice(-6)}`,
    actor_id,
    actor_name,
    notes: `${reason} (System: ${systemCount}, Physical: ${counted}, Variance: ${variance})${approved_by ? ` - Approved by ${approved_by}` : ""}`,
  });

  return {
    success: true,
    variance,
    system_count: systemCount,
    physical_count: counted,
    status: isSurplus ? "OVERAGE" : "SHORTAGE",
    updated_inventory: updatedInv,
  };
}

// ---------- DrCreate & MS Access 4-Level Stock Ledger Engine ----------
export const dbStockLedger = {
  // Reconstruct stock ledger from immutable events or fallback to transaction scan
  reconstruct: (targetInventoryId, asOfDate) => dbStockMovements.reconstructStockLedger(targetInventoryId, asOfDate),
  reconcile: () => reconcileFinancialAndStockLedgers(),
  // Level 1: Category Summary (Grouped by Item Code / Company)
  getCategorySummary: () => {
    const inventory = dbInventory.getAll();
    const map = new Map();

    inventory.forEach((item) => {
      const code = (item.item_code || item.company_name || "General").trim();
      const qty = Number(item.total_base_stock || item.stock_qty || 0);
      if (!map.has(code)) {
        map.set(code, {
          category: code,
          company_name: item.company_name || code,
          total_qty: 0,
          item_count: 0,
        });
      }
      const entry = map.get(code);
      entry.total_qty += qty;
      entry.item_count += 1;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.category.localeCompare(b.category, undefined, { numeric: true, sensitivity: "base" })
    );
  },

  // Level 2: SKU Summary (All medicines under a specific Category / Item Code)
  getSKUSummary: (categoryCode = "") => {
    const inventory = dbInventory.getAll();
    let items = [];
    if (!categoryCode || categoryCode === "All" || categoryCode === "all") {
      items = inventory.map((i) => ({
        id: i.id,
        item_name: i.medicine_name,
        item_code: i.item_code || "General",
        company_name: i.company_name || "",
        qty: Number(i.total_base_stock || i.stock_qty || 0),
        store_stock: Number(i.store_stock || 0),
        warehouse_stock: Number(i.warehouse_stock || 0),
        unit_price: i.box_sale_price || i.unit_sale_price || 0,
      }));
    } else {
      const normCat = categoryCode.toLowerCase().trim();
      items = inventory
        .filter((i) => (i.item_code || "").toLowerCase().trim() === normCat || (i.company_name || "").toLowerCase().trim() === normCat)
        .map((i) => ({
          id: i.id,
          item_name: i.medicine_name,
          item_code: i.item_code || "General",
          company_name: i.company_name || "",
          qty: Number(i.total_base_stock || i.stock_qty || 0),
          store_stock: Number(i.store_stock || 0),
          warehouse_stock: Number(i.warehouse_stock || 0),
          unit_price: i.box_sale_price || i.unit_sale_price || 0,
        }));
    }

    return items.sort((a, b) => {
      // Natural sorting: compare item_code first if distinct, else item_name
      if (a.item_code && b.item_code && a.item_code !== b.item_code) {
        const codeCmp = a.item_code.localeCompare(b.item_code, undefined, { numeric: true, sensitivity: "base" });
        if (codeCmp !== 0) return codeCmp;
      }
      return (a.item_name || "").localeCompare(b.item_name || "", undefined, { numeric: true, sensitivity: "base" });
    });
  },

  // Level 3: Transactional Ledger (Chronological daily timeline for a medicine)
  getItemTimeline: (medicineNameOrId) => {
    if (!medicineNameOrId) return [];
    const inv = dbInventory.getAll().find((i) => i.id === medicineNameOrId || i.medicine_name.toLowerCase() === medicineNameOrId.toLowerCase());
    const targetName = inv ? inv.medicine_name.toLowerCase() : medicineNameOrId.toLowerCase();
    const targetId = inv ? inv.id : null;

    const timelineMap = new Map();

    const addEvent = (dateRaw, qtyIn, qtyOut, voucherDetails) => {
      const d = dateRaw ? new Date(dateRaw) : new Date();
      const dateKey = !isNaN(d.getTime()) ? d.toLocaleDateString("en-GB") : String(dateRaw).split("T")[0];
      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, {
          date: dateKey,
          raw_date: d,
          total_in: 0,
          total_out: 0,
          vouchers: [],
        });
      }
      const entry = timelineMap.get(dateKey);
      entry.total_in += Number(qtyIn) || 0;
      entry.total_out += Number(qtyOut) || 0;
      if (voucherDetails) entry.vouchers.push(voucherDetails);
    };

    // 1. Scan Purchases (Inward GRN)
    const purchases = dbPurchases.getAll();
    purchases.forEach((p) => {
      (p.items || []).forEach((it) => {
        if ((targetId && it.inventory_id === targetId) || (it.medicine_name && it.medicine_name.toLowerCase() === targetName)) {
          const qty = Number(it.qty_base_units || it.qty || it.quantity) || 1;
          const rate = Number(it.cost_price || it.purchase_price || it.unit_price) || 0;
          const gross = qty * rate;
          const discPct = Number(it.disc_pct || it.disc_percent) || 0;
          const discFlat = Number(it.disc_flat || it.discount_amount) || 0;
          const net = Math.max(0, gross - (gross * (discPct / 100)) - discFlat);

          addEvent(p.purchase_date || p.created_at, qty, 0, {
            date: p.purchase_date || p.created_at,
            voucher_no: p.invoice_no || "PUR-GRN",
            type: "Purchase",
            description: `Item Purchased From Supplier ${p.supplier_name || "Supplier"}`,
            in_qty: qty,
            out_qty: 0,
            rate,
            gross,
            disc_pct: discPct > 0 ? `${discPct}%` : "-",
            disc_flat: discFlat,
            net,
          });
        }
      });
    });

    // 2. Scan B2B Wholesale Sales (Outward)
    const b2b = dbB2BSales.getAll();
    b2b.forEach((sale) => {
      (sale.items || []).forEach((it) => {
        if ((targetId && it.inventory_id === targetId) || (it.medicine_name && it.medicine_name.toLowerCase() === targetName)) {
          const qty = Number(it.qty_base_units || it.qty || it.quantity) || 1;
          const rate = Number(it.unit_price || it.sale_price) || 0;
          const gross = qty * rate;
          const discPct = Number(it.disc_pct || it.disc_percent) || 0;
          const discFlat = Number(it.disc_flat || it.discount_amount) || 0;
          const net = Number(it.line_total) || Math.max(0, gross - (gross * (discPct / 100)) - discFlat);

          addEvent(sale.sale_date || sale.created_at, 0, qty, {
            date: sale.sale_date || sale.created_at,
            voucher_no: sale.invoice_no || "WHO-B2B",
            type: "Sale",
            description: `Item Sold To Customer ${sale.buyer_name || "Party"} [${sale.city || "Sindh"}]`,
            in_qty: 0,
            out_qty: qty,
            rate,
            gross,
            disc_pct: discPct > 0 ? `${discPct}%` : "-",
            disc_flat: discFlat,
            net,
          });
        }
      });
    });

    // 3. Scan Retail POS Sales (Outward)
    const pos = dbSales.getAll();
    pos.forEach((sale) => {
      (sale.items || []).forEach((it) => {
        if ((targetId && it.inventory_id === targetId) || (it.medicine_name && it.medicine_name.toLowerCase() === targetName)) {
          const qty = Number(it.base_units || it.quantity || it.qty) || 1;
          const rate = Number(it.unit_price) || 0;
          const gross = qty * rate;
          const net = Number(it.line_total) || gross;

          addEvent(sale.sale_date || sale.created_at, 0, qty, {
            date: sale.sale_date || sale.created_at,
            voucher_no: sale.receipt_no || "POS-SALE",
            type: "Sale",
            description: `Item Sold To Counter Customer (${sale.patient_name || "Retail Patient"})`,
            in_qty: 0,
            out_qty: qty,
            rate,
            gross,
            disc_pct: "-",
            disc_flat: 0,
            net,
          });
        }
      });
    });

    // If no dynamic vouchers yet, synthesize baseline opening balance entry
    if (timelineMap.size === 0 && inv) {
      const stock = Number(inv.total_base_stock || inv.stock_qty || 0);
      if (stock > 0) {
        addEvent(inv.created_at || "2024-01-01T00:00:00Z", stock, 0, {
          date: inv.created_at || "2024-01-01T00:00:00Z",
          voucher_no: "OPEN-BAL",
          type: "Opening Stock",
          description: `Initial Baseline Opening Inventory Stock for ${inv.medicine_name}`,
          in_qty: stock,
          out_qty: 0,
          rate: inv.cost_price_per_box || inv.unit_sale_price || 0,
          gross: stock * (inv.cost_price_per_box || inv.unit_sale_price || 0),
          disc_pct: "-",
          disc_flat: 0,
          net: stock * (inv.cost_price_per_box || inv.unit_sale_price || 0),
        });
      }
    }

    return Array.from(timelineMap.values()).sort((a, b) => b.raw_date - a.raw_date);
  },

  // Level 4: Item Date History (Individual voucher breakdown for a selected date)
  getDateVouchers: (medicineNameOrId, dateStr) => {
    const timeline = dbStockLedger.getItemTimeline(medicineNameOrId);
    const dayEntry = timeline.find((t) => t.date === dateStr || (t.raw_date && t.raw_date.toISOString().split("T")[0] === dateStr));
    return dayEntry ? dayEntry.vouchers : [];
  },

  exportCSV: (medicineName, timeline, filename = "") => {
    const fn = filename || `Stock_Ledger_${medicineName.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
    let csv = `Stock Ledger for: "${medicineName}"\n`;
    csv += `Date,Total In,Total Out,Net Movement\n`;
    (timeline || []).forEach((row) => {
      const net = (row.total_in || 0) - (row.total_out || 0);
      csv += `"${row.date}",${row.total_in || 0},${row.total_out || 0},${net}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fn);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

// ---------- Interior Sindh Wholesale Parties ----------
export const dbParties = {
  getAll: () => getCollection(KEYS.PARTIES),


  getById: (id) => getFromCollectionById(KEYS.PARTIES, id),
  getByCity: (city) => getCollection(KEYS.PARTIES).filter((p) => (p.city || "").toLowerCase() === (city || "").toLowerCase()),
  add: (party) => {
    const list = getCollection(KEYS.PARTIES);
    const newP = { ...party, id: generateId("pty"), balance_due: Number(party.balance_due) || 0 };
    setCollection(KEYS.PARTIES, [newP, ...list]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("parties", newP, "CREATE", newP.id);
    }
    return newP;
  },
  update: (id, data) => {
    const list = getCollection(KEYS.PARTIES);
    const updated = list.map((p) => (p.id === id ? { ...p, ...data } : p));
    setCollection(KEYS.PARTIES, updated);
    const updatedRecord = updated.find((p) => p.id === id);
    if (updatedRecord && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("parties", updatedRecord, "UPDATE", id);
    }
    return updatedRecord || null;
  },
  updateBalance: (id, delta) => {
    const list = getCollection(KEYS.PARTIES);
    const updated = list.map((p) => {
      if (p.id === id) {
        const cur = Number(p.balance_due ?? p.current_balance ?? 0);
        const newBal = Math.max(0, cur + Number(delta));
        return { ...p, balance_due: newBal, current_balance: newBal };
      }
      return p;
    });
    setCollection(KEYS.PARTIES, updated);
    const updatedRecord = updated.find((p) => p.id === id);
    if (updatedRecord && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("parties", updatedRecord, "UPDATE", id);
    }
  },
  recordPayment: (partyId, amount, paymentMode = "Cash", notes = "", actorName = "Staff", bankName = "", chequeNo = "") => {
    const amt = Number(amount) || 0;
    if (amt <= 0) return null;
    const party = dbParties.getById(partyId);
    if (!party) return null;

    const previousBalance = Number(party.balance_due ?? party.current_balance ?? 0);
    const remainingBalance = Math.max(0, previousBalance - amt);

    dbParties.updateBalance(partyId, -amt);
    const updatedParty = dbParties.getById(partyId);

    // Sync into matched dbAccounts if existing
    const allAccs = dbAccounts.getAll();
    const acc = allAccs.find((a) => (a.account_name || "").toLowerCase() === (party.name || "").toLowerCase());
    if (acc) {
      dbAccounts.update(acc.id, { opening_balance: remainingBalance });
    }

    const partyLedgers = getCollection(KEYS.PARTY_LEDGER) || [];
    const receiptNo = generateSequentialInvoiceNo("REC");
    const paymentRecord = {
      id: generateId("rec"),
      receipt_no: receiptNo,
      party_id: partyId,
      party_name: party.name || party.party_name || "Wholesale Party",
      city: party.city || party.territory || "Hyderabad",
      amount: amt,
      payment_mode: paymentMode,
      bank_name: bankName ? toTitleCase(bankName) : "",
      cheque_no: chequeNo ? String(chequeNo).trim() : "",
      previous_balance: previousBalance,
      remaining_balance: remainingBalance,
      notes: notes || `Udhaar cash recovery from ${party.name}`,
      collected_by: actorName,
      created_at: new Date().toISOString(),
      date: new Date().toLocaleDateString("en-US"),
    };

    setCollection(KEYS.PARTY_LEDGER, [paymentRecord, ...partyLedgers]);

    // Auto-record CashBook Inflow Entry
    if (typeof dbCashBook !== "undefined" && dbCashBook.add) {
      dbCashBook.add({
        type: "INCOME",
        category: "UDHAAR_RECOVERY",
        title: `Udhaar Payment Received — ${party.name}`,
        amount: amt,
        payment_mode: paymentMode,
        party_id: partyId,
        party_name: party.name,
        notes: notes || `Credit repayment received from ${party.name} (${party.city || "Sindh"})`,
        recorded_by: actorName,
        date: new Date().toLocaleDateString("en-US"),
      });
    }

    try {
      window.dispatchEvent(new Event("clinicflow_status_update"));
    } catch {}
    return paymentRecord;
  },
  delete: (id) => {
    const list = getCollection(KEYS.PARTIES) || [];
    const target = list.find((p) => p.id === id);
    const updated = list.filter((p) => p.id !== id);
    setCollection(KEYS.PARTIES, updated);
    if (target && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("parties", target, "DELETE", id);
    }
    return true;
  },
};

// ---------- Wholesale Party Credit Ledger ----------
export const dbPartyLedger = {
  getAll: () => getCollection(KEYS.PARTY_LEDGER) || [],
  getByParty: (partyId) => {
    if (!partyId) return [];
    const party = dbParties.getById(partyId);
    const partyName = party ? (party.name || "").toLowerCase() : "";

    const payments = (getCollection(KEYS.PARTY_LEDGER) || []).filter(
      (l) => l.party_id === partyId || (partyName && (l.party_name || "").toLowerCase() === partyName)
    );
    const b2bSales = (getCollection(KEYS.B2B_SALES) || []).filter(
      (s) => s.buyer_id === partyId || s.party_id === partyId || (partyName && (s.buyer_name || s.account_name || "").toLowerCase() === partyName)
    );
    const posSales = (getCollection(KEYS.SALES) || []).filter(
      (s) => s.billing_type === "wholesale_party" && (s.buyer_id === partyId || (partyName && (s.account_name || "").toLowerCase() === partyName))
    );

    const combined = [
      ...payments.map((p) => ({ ...p, tx_type: "PAYMENT", sort_date: p.created_at || p.date })),
      ...b2bSales.map((s) => ({ ...s, tx_type: "INVOICE", receipt_no: s.invoice_no || s.voucher_no, amount: s.total_amount, sort_date: s.sale_date || s.created_at })),
      ...posSales.map((s) => ({ ...s, tx_type: "INVOICE", receipt_no: s.voucher_no || s.invoice_no, amount: s.total_amount, sort_date: s.sale_date || s.created_at })),
    ];
    return combined.sort((a, b) => new Date(b.sort_date || 0) - new Date(a.sort_date || 0));
  },
};


// ---------- Suppliers ----------
export const dbSuppliers = {
  getAll: () => {
    const list = getCollection(KEYS.SUPPLIERS) || [];
    let changed = false;
    const normalized = list.map((s, idx) => {
      if (!s.supplier_code) {
        changed = true;
        const codeNum = String(idx + 1).padStart(3, "0");
        return { ...s, supplier_code: `SUP-${codeNum}` };
      }
      return s;
    });
    if (changed) {
      setCollection(KEYS.SUPPLIERS, normalized);
    }
    return normalized;
  },
  getById: (id) => getFromCollectionById(KEYS.SUPPLIERS, id),
  getByCode: (code) => {
    if (!code) return null;
    const clean = String(code).trim().toLowerCase();
    const list = dbSuppliers.getAll();
    return list.find(
      (s) =>
        (s.supplier_code && s.supplier_code.toLowerCase() === clean) ||
        (s.code && s.code.toLowerCase() === clean) ||
        (s.id && s.id.toLowerCase() === clean) ||
        (s.account_no && String(s.account_no).toLowerCase() === clean) ||
        (s.name && s.name.toLowerCase() === clean)
    ) || null;
  },
  getNextSupplierCode: () => {
    const list = getCollection(KEYS.SUPPLIERS) || [];
    const maxNum = list.reduce((max, s) => {
      const match = (s.supplier_code || "").match(/SUP-(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        return n > max ? n : max;
      }
      return max;
    }, 0);
    return `SUP-${String(maxNum + 1).padStart(3, "0")}`;
  },
  add: (supplier) => {
    const list = dbSuppliers.getAll();
    const nextCode = supplier.supplier_code || supplier.code || dbSuppliers.getNextSupplierCode();
    const newS = {
      ...supplier,
      id: generateId("sup"),
      supplier_code: nextCode,
      current_balance: Number(supplier.current_balance || supplier.balance_due || supplier.opening_balance) || 0,
      created_at: supplier.created_at || new Date().toISOString(),
    };
    setCollection(KEYS.SUPPLIERS, [...list, newS]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("suppliers", newS, "CREATE", newS.id);
    }
    return newS;
  },
  update: (id, data) => {
    const list = dbSuppliers.getAll();
    const updated = list.map((s) => (s.id === id ? { ...s, ...data } : s));
    setCollection(KEYS.SUPPLIERS, updated);
    const updatedRecord = updated.find((s) => s.id === id);
    if (updatedRecord && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("suppliers", updatedRecord, "UPDATE", id);
    }
    return updatedRecord || null;
  },
  updateBalance: (supplierId, delta) => {
    const list = dbSuppliers.getAll();
    const cleanTarget = String(supplierId || "").toLowerCase().trim();
    const updated = list.map((s) => {
      const sId = String(s.id || "").toLowerCase().trim();
      const sCode = String(s.supplier_code || s.code || "").toLowerCase().trim();
      const sName = String(s.name || "").toLowerCase().trim();
      if (sId === cleanTarget || sCode === cleanTarget || sName === cleanTarget) {
        const cur = Number(s.current_balance ?? s.balance_due ?? s.balance ?? 0);
        const newBal = Math.max(0, cur + Number(delta));
        return { ...s, current_balance: newBal, balance_due: newBal, balance: newBal };
      }
      return s;
    });
    setCollection(KEYS.SUPPLIERS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
  },
  recordPayment: (supplierId, amount) => {
    const list = dbSuppliers.getAll();
    const cleanTarget = String(supplierId || "").toLowerCase().trim();
    const amt = Number(amount) || 0;
    const updated = list.map((s) => {
      const sId = String(s.id || "").toLowerCase().trim();
      const sCode = String(s.supplier_code || s.code || "").toLowerCase().trim();
      const sName = String(s.name || "").toLowerCase().trim();
      if (sId === cleanTarget || sCode === cleanTarget || sName === cleanTarget) {
        const cur = Number(s.current_balance ?? s.balance_due ?? s.balance ?? 0);
        const newBal = Math.max(0, cur - amt);
        return { ...s, current_balance: newBal, balance_due: newBal, balance: newBal };
      }
      return s;
    });
    setCollection(KEYS.SUPPLIERS, updated);

    // Also auto-settle FIFO on unpaid purchase invoices for this supplier
    try {
      const purchases = getCollection(KEYS.PURCHASES) || [];
      let remAmt = amt;
      const updatedPurchases = purchases.map((p) => {
        const pSupId = String(p.supplier_id || "").toLowerCase().trim();
        const pSupName = String(p.supplier_name || "").toLowerCase().trim();
        if (remAmt > 0 && (pSupId === cleanTarget || pSupName === cleanTarget)) {
          const invDue = Number(p.balance_due) || 0;
          if (invDue > 0) {
            const payThis = Math.min(remAmt, invDue);
            remAmt -= payThis;
            const newPaid = (Number(p.paid_amount) || 0) + payThis;
            const newDue = Math.max(0, invDue - payThis);
            return { ...p, paid_amount: newPaid, balance_due: newDue };
          }
        }
        return p;
      });
      setCollection(KEYS.PURCHASES, updatedPurchases);
    } catch {}

    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
  },
  delete: (id) => {
    const list = dbSuppliers.getAll();
    setCollection(KEYS.SUPPLIERS, list.filter((s) => s.id !== id));
    return true;
  },
};


// ---------- Warehouses / Multi-Godown Engine ----------
export const dbWarehouses = {
  getAll: () => {
    let list = getCollection(KEYS.WAREHOUSES);
    if (!list || list.length === 0) {
      list = SEED_DATA.warehouses;
      setCollection(KEYS.WAREHOUSES, list);
    }
    return list;
  },
  getById: (id) => getCollection(KEYS.WAREHOUSES).find((w) => w.id === id) || null,
  getGodowns: () => dbWarehouses.getAll().filter((w) => !w.is_store_counter),
  getStoreCounter: () => dbWarehouses.getAll().find((w) => w.is_store_counter) || null,
  getDefault: () => dbWarehouses.getAll().find((w) => w.is_default) || dbWarehouses.getGodowns()[0] || null,
  add: (warehouse) => {
    const list = dbWarehouses.getAll();
    const codeNum = String(list.filter((w) => !w.is_store_counter).length + 1).padStart(2, "0");
    const newW = {
      ...warehouse,
      id: generateId("wh"),
      clinic_id: "clinic_001",
      code: warehouse.code || `GDW-${codeNum}`,
      is_default: false,
      is_store_counter: false,
      status: warehouse.status || "active",
      created_at: new Date().toISOString(),
    };
    setCollection(KEYS.WAREHOUSES, [...list, newW]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("warehouses", newW, "CREATE", newW.id);
    }
    return newW;
  },
  update: (id, data) => {
    const list = dbWarehouses.getAll();
    let updatedGodown = null;
    const updated = list.map((w) => {
      if (w.id === id) {
        updatedGodown = { ...w, ...data };
        return updatedGodown;
      }
      return w;
    });
    setCollection(KEYS.WAREHOUSES, updated);
    if (updatedGodown && typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("warehouses", updatedGodown, "UPDATE", id);
    }
    return updatedGodown;
  },
  delete: (id) => {
    const list = dbWarehouses.getAll();
    // Prevent deleting protected system warehouses
    const target = list.find((w) => w.id === id);
    if (!target || target.is_store_counter || target.is_default) return false;
    setCollection(KEYS.WAREHOUSES, list.filter((w) => w.id !== id));
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("warehouses", { id }, "DELETE", id);
    }
    return true;
  },
  // Get aggregated stock valuation per warehouse
  getStockValuation: (warehouseId) => {
    const inventory = dbInventory.getAll();
    let totalUnits = 0;
    let totalValue = 0;
    for (const item of inventory) {
      const qty = dbInventory.getLocationStock(item, warehouseId);
      totalUnits += qty;
      totalValue += qty * (item.cost_price_per_box || item.unit_sale_price || 0);
    }
    return { totalUnits, totalValue };
  },
};

// ---------- Salesmen ----------
export const dbSalesmen = {
  getAll: () => getCollection(KEYS.SALESMEN),
  getById: (id) => getFromCollectionById(KEYS.SALESMEN, id),
  add: (sm) => {
    const list = getCollection(KEYS.SALESMEN);
    const newSm = { ...sm, id: generateId("sm") };
    setCollection(KEYS.SALESMEN, [...list, newSm]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("salesmen", newSm, "CREATE", newSm.id);
    }
    return newSm;
  },
};


// ---------- Patient Credit / Udhaar Ledger ----------
export const dbPatientLedger = {
  getAll: () => getCollection(KEYS.PATIENT_LEDGER),
  getByPatient: (patientId) => getCollection(KEYS.PATIENT_LEDGER).find((l) => l.patient_id === patientId) || null,
  // Quick helper: returns outstanding balance for a patient, 0 if none
  getBalance: (patientId) => {
    if (!patientId) return 0;
    const ledger = dbPatientLedger.getByPatient(patientId);
    return ledger ? Math.max(0, ledger.balance_due || 0) : 0;
  },
  // Returns all patients with outstanding dues > 0
  getWithDues: () => getCollection(KEYS.PATIENT_LEDGER).filter((l) => (l.balance_due || 0) > 0),
  addCredit: (patientId, patientName, amount, description) => {
    const ledgers = getCollection(KEYS.PATIENT_LEDGER);
    const existing = ledgers.find((l) => l.patient_id === patientId);

    const tx = {
      id: generateId("tx"),
      date: new Date().toISOString(),
      description: description || "Pharmacy Purchase Udhaar",
      amount: Number(amount),
      type: "debit",
    };

    if (existing) {
      const updated = ledgers.map((l) =>
        l.patient_id === patientId
          ? {
              ...l,
              total_credit: l.total_credit + Number(amount),
              balance_due: l.balance_due + Number(amount),
              transactions: [tx, ...(l.transactions || [])],
            }
          : l
      );
      setCollection(KEYS.PATIENT_LEDGER, updated);
    } else {
      const newLedger = {
        id: generateId("pledge"),
        patient_id: patientId,
        patient_name: patientName,
        total_credit: Number(amount),
        total_paid: 0,
        balance_due: Number(amount),
        transactions: [tx],
      };
      setCollection(KEYS.PATIENT_LEDGER, [...ledgers, newLedger]);
    }
  },
  receivePayment: (patientId, amount, paymentNote = "Cash Payment Received", collectedBy = "Reception") => {
    const ledgers = getCollection(KEYS.PATIENT_LEDGER);
    const tx = {
      id: generateId("tx"),
      date: new Date().toISOString(),
      description: paymentNote,
      amount: Number(amount),
      type: "credit",
      collected_by: collectedBy,
    };
    const updated = ledgers.map((l) =>
      l.patient_id === patientId
        ? {
            ...l,
            total_paid: (l.total_paid || 0) + Number(amount),
            balance_due: Math.max(0, l.balance_due - Number(amount)),
            last_payment_date: new Date().toISOString(),
            last_payment_by: collectedBy,
            transactions: [tx, ...(l.transactions || [])],
          }
        : l
    );
    setCollection(KEYS.PATIENT_LEDGER, updated);
    return tx;
  },
};


// ---------- Two-Way Supplier Ledger Engine ----------
export const dbSupplierLedger = {
  getAll: () => {
    const list = getCollection(KEYS.SUPPLIER_LEDGER);
    if (!list || list.length === 0) {
      return SEED_DATA.supplier_ledger || [];
    }
    return Array.isArray(list) ? list : [];
  },
  getBySupplier: (supplierIdOrObj) => {
    if (!supplierIdOrObj) return [];
    let id = "";
    let name = "";
    let code = "";
    if (typeof supplierIdOrObj === "object") {
      id = String(supplierIdOrObj.id || "").toLowerCase().trim();
      name = String(supplierIdOrObj.name || "").toLowerCase().trim();
      code = String(supplierIdOrObj.supplier_code || supplierIdOrObj.code || "").toLowerCase().trim();
    } else {
      id = String(supplierIdOrObj).toLowerCase().trim();
    }
    const all = dbSupplierLedger.getAll() || [];
    return all.filter((t) => {
      if (!t) return false;
      const tId = String(t.supplier_id || "").toLowerCase().trim();
      const tName = String(t.supplier_name || "").toLowerCase().trim();
      const tCode = String(t.supplier_code || "").toLowerCase().trim();
      if (id && (tId === id || tCode === id || tName === id)) return true;
      if (code && (tId === code || tCode === code)) return true;
      if (name && (tName === name || tId === name)) return true;
      return false;
    });
  },
  // PURCHASE_BILL | CASH_PAYMENT | CHEQUE_PAYMENT | BANK_PAYMENT | RETURN_CLAIM | ADVANCE
  addTransaction: (supplierId, type, debit, credit, notes, invoiceNo = "", supplierName = "") => {
    const list = dbSupplierLedger.getAll();
    const supplierTxns = dbSupplierLedger.getBySupplier(supplierId);
    const lastBalance = supplierTxns.length > 0
      ? Number(supplierTxns[supplierTxns.length - 1].running_balance) || 0
      : 0;
    const netDelta = (Number(debit) || 0) - (Number(credit) || 0);
    const newBalance = Math.max(0, lastBalance + netDelta);
    const newTx = {
      id: generateId("sl"),
      supplier_id: supplierId,
      supplier_name: supplierName || "",
      invoice_no: invoiceNo || "",
      type: type || "CASH_PAYMENT",
      debit: Number(debit) || 0,
      credit: Number(credit) || 0,
      running_balance: newBalance,
      notes: notes || "",
      created_at: new Date().toISOString(),
    };
    setCollection(KEYS.SUPPLIER_LEDGER, [...list, newTx]);
    return newTx;
  },
  recordPayment: (supplierIdOrObj, amount, paymentMode, notes = "", reference = "") => {
    const typeMap = { cash: "CASH_PAYMENT", cheque: "CHEQUE_PAYMENT", bank: "BANK_PAYMENT" };
    const type = typeMap[paymentMode] || "CASH_PAYMENT";
    let supplierId = typeof supplierIdOrObj === "object" ? (supplierIdOrObj.id || supplierIdOrObj.name) : supplierIdOrObj;
    let supplierName = typeof supplierIdOrObj === "object" ? (supplierIdOrObj.name || "") : "";
    if (!supplierName) {
      const found = dbSuppliers.getById(supplierId) || dbSuppliers.getByCode(supplierId);
      if (found) {
        supplierId = found.id;
        supplierName = found.name;
      }
    }
    // Update supplier running balance & settle FIFO purchase invoice dues
    if (dbSuppliers && dbSuppliers.recordPayment) {
      dbSuppliers.recordPayment(supplierId, Number(amount));
    }
    return dbSupplierLedger.addTransaction(
      supplierId,
      type,
      0,
      Number(amount) || 0,
      notes || `${type.replace("_", " ")} — Ref: ${reference || "N/A"}`,
      reference,
      supplierName
    );
  },
  recordReturnClaim: (supplierId, amount, notes = "") => {
    if (dbSuppliers && dbSuppliers.recordPayment) {
      dbSuppliers.recordPayment(supplierId, Number(amount));
    }
    return dbSupplierLedger.addTransaction(supplierId, "RETURN_CLAIM", 0, Number(amount) || 0, notes || "Damaged stock return / credit claim");
  },
  getRunningBalance: (supplierId) => {
    const txns = dbSupplierLedger.getBySupplier(supplierId);
    if (!txns.length) return 0;
    return Number(txns[txns.length - 1].running_balance) || 0;
  },
  getTotals: (supplierId) => {
    const txns = dbSupplierLedger.getBySupplier(supplierId);
    const totalDebits = txns.reduce((s, t) => s + (Number(t.debit) || 0), 0);
    const totalCredits = txns.reduce((s, t) => s + (Number(t.credit) || 0), 0);
    return {
      totalDebits: Number.isFinite(totalDebits) ? totalDebits : 0,
      totalCredits: Number.isFinite(totalCredits) ? totalCredits : 0,
      balance: Math.max(0, (totalDebits || 0) - (totalCredits || 0)),
    };
  },
};

// ---------- Documents ----------
export const dbDocuments = {
  getAll: () => getCollection(KEYS.DOCUMENTS),
  getByPatient: (patientId) => getCollection(KEYS.DOCUMENTS).filter((d) => d.patient_id === patientId),
  add: (doc) => {
    const list = getCollection(KEYS.DOCUMENTS);
    const newDoc = { ...doc, id: generateId("doc"), created_at: new Date().toISOString() };
    setCollection(KEYS.DOCUMENTS, [newDoc, ...list]);
    return newDoc;
  },
  delete: (id) => {
    const list = getCollection(KEYS.DOCUMENTS);
    setCollection(KEYS.DOCUMENTS, list.filter((d) => d.id !== id));
  },
};

// ---------- Tenants ----------
export const dbTenants = {
  getAll: () => getCollection(KEYS.TENANTS),
  getById: (id) => getCollection(KEYS.TENANTS).find((t) => t.id === id) || null,
  add: (tenant) => {
    const list = getCollection(KEYS.TENANTS);
    const newT = { ...tenant, id: generateId("tenant") };
    setCollection(KEYS.TENANTS, [...list, newT]);
    return newT;
  },
  update: (id, data) => {
    const list = getCollection(KEYS.TENANTS);
    const updated = list.map((t) => (t.id === id ? { ...t, ...data } : t));
    setCollection(KEYS.TENANTS, updated);
  },
  delete: (id) => {
    const list = getCollection(KEYS.TENANTS);
    setCollection(KEYS.TENANTS, list.filter((t) => t.id !== id));
  },
  switchToTenant: (id) => {
    const target = dbTenants.getById(id);
    if (!target) return false;
    dbClinic.update({
      name: target.name || "CliniCore Clinic",
      address: target.address || "Main City Clinic",
      phone: target.phone || "03001234567",
      default_consultation_fee: Number(target.fee) || 500,
    });
    return true;
  },
};

// ---------- Store & Wholesale Sales (Retail POS & DrCreate Sale Invoice) ----------
export const dbSales = {
  getAll: () => getCollection(KEYS.SALES),
  getById: (id) => getScopedRecordById(KEYS.SALES, id),
  getNextVoucherNo: (billingType = "patient") => {
    if (billingType === "wholesale_party" || billingType === "b2b") {
      return generateSequentialInvoiceNo("WS");
    }
    return generateSequentialInvoiceNo("POS");
  },
  exportCSV: (salesList, filename = "Sale_Invoice_List.csv") => {
    const list = salesList || getCollection(KEYS.SALES);
    let csv = "Voucher No,Date,Account Name,Reference,Territory/City,Mode,Transport,Bilty No,Items Count,Total Bill,Paid,Balance Due\n";
    list.forEach((s) => {
      const vNo = `"${(s.voucher_no || s.receipt_no || s.invoice_no || '').replace(/"/g, '""')}"`;
      const date = `"${(s.sale_date || s.created_at || '').split('T')[0]}"`;
      const acc = `"${(s.account_name || s.customer_name || '').replace(/"/g, '""')}"`;
      const ref = `"${(s.reference || '').replace(/"/g, '""')}"`;
      const city = `"${(s.party_type || s.city || '').replace(/"/g, '""')}"`;
      const mode = `"${(s.payment_mode || 'Cash').replace(/"/g, '""')}"`;
      const tr = `"${(s.transport || '').replace(/"/g, '""')}"`;
      const bil = `"${(s.bilty_no || '').replace(/"/g, '""')}"`;
      const itCnt = (s.items || []).length;
      csv += `${vNo},${date},${acc},${ref},${city},${mode},${tr},${bil},${itCnt},${s.total_amount || 0},${s.paid_amount || 0},${s.balance_due || 0}\n`;
    });
    if (typeof document !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return csv;
  },
  addSaleInvoice: (saleData) => {
    const sales = getCollection(KEYS.SALES) || [];
    const b2b = getCollection(KEYS.B2B_SALES) || [];
    const allSales = [...sales, ...b2b];

    // Check if provided voucher_no is already taken by an existing sale
    let voucherNo = (saleData.voucher_no || saleData.invoice_no || saleData.receipt_no || "").trim();
    const isDuplicate = voucherNo && allSales.some((s) => {
      const existing = (s.voucher_no || s.invoice_no || s.receipt_no || "").trim();
      return existing && existing.toLowerCase() === voucherNo.toLowerCase();
    });

    if (!voucherNo || isDuplicate) {
      voucherNo = dbSales.getNextVoucherNo(saleData.billing_type);
    }
    const totalAmount = Number(saleData.total_amount) || 0;
    const isCredit = saleData.payment_mode === "Credit";
    const paidAmount = isCredit ? (Number(saleData.paid_amount) || 0) : totalAmount;
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    const newSale = {
      ...saleData,
      id: generateId("sale"),
      voucher_no: voucherNo,
      receipt_no: voucherNo,
      invoice_no: voucherNo,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      sale_date: saleData.sale_date || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Deduct stock from Godown warehouse (or Store counter)
    const dest = saleData.destination_type === "store" ? "store" : "warehouse";
    const deductions = (saleData.items || []).reduce((acc, item) => {
      const inv = item.inventory_id ? dbInventory.getById(item.inventory_id) : dbInventory.findByName(item.medicine_name);
      if (inv) {
        const qty = Number(item.qty_base_units || item.qty || item.quantity) || 1;
        acc.push({ id: inv.id, baseQty: qty });
      }
      return acc;
    }, []);
    if (deductions.length > 0) {
      dbInventory.bulkDeductStock(deductions, dest);
    }

    // Update Customer Khata / Udhaar balance if Credit sale
    if (isCredit && balanceDue > 0 && saleData.account_name) {
      const parties = dbParties.getAll();
      const matchedParty = parties.find(
        (p) => p.name.toLowerCase() === saleData.account_name.toLowerCase() || p.id === saleData.buyer_id
      );
      if (matchedParty) {
        dbParties.updateBalance(matchedParty.id, balanceDue);
      }
    }

    setCollection(KEYS.SALES, [newSale, ...sales]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("pos_sales", newSale, "CREATE", newSale.id);
    }
    return newSale;
  },
  checkout: (sale) => {
    const sales = getCollection(KEYS.SALES) || [];
    const b2b = getCollection(KEYS.B2B_SALES) || [];
    const allSales = [...sales, ...b2b];

    let invoiceNo = (sale.voucher_no || sale.invoice_no || sale.receipt_no || "").trim();
    const isDuplicate = invoiceNo && allSales.some((s) => {
      const existing = (s.voucher_no || s.invoice_no || s.receipt_no || "").trim();
      return existing && existing.toLowerCase() === invoiceNo.toLowerCase();
    });

    if (!invoiceNo || isDuplicate) {
      invoiceNo = generateSequentialInvoiceNo("POS");
    }
    const subtotal = Number(sale.subtotal_amount) || Number(sale.total_amount) || 0;
    const discount = Number(sale.discount_amount) || 0;
    const total = Math.max(0, subtotal - discount);
    const paid = sale.paid_amount !== undefined && sale.paid_amount !== null && !isNaN(Number(sale.paid_amount))
      ? Number(sale.paid_amount)
      : total;

    const activeCashier = typeof window !== "undefined" && typeof window.getActiveCashier === "function" ? window.getActiveCashier() : null;
    const cashierId = sale.cashier_id || sale.active_cashier_id || activeCashier?.id || "user_admin";
    const cashierName = sale.cashier_name || sale.active_cashier_name || activeCashier?.name || "Counter Staff";

    const newSale = {
      ...sale,
      id: generateId("sale"),
      receipt_no: invoiceNo,
      cashier_id: cashierId,
      cashier_name: cashierName,
      active_cashier_id: cashierId,
      active_cashier_name: cashierName,
      warehouse_id: sale.warehouse_id || "wh_str",
      sale_date: sale.sale_date || new Date().toISOString(),
      subtotal_amount: subtotal,
      discount_amount: discount,
      total_amount: total,
      paid_amount: paid,
      balance_due: Math.max(0, total - paid),
      is_voided: Boolean(sale.is_voided),
    };

    // Batched deduction: single in-memory pass + one disk write
    const deductions = (sale.items || []).reduce((acc, item) => {
      const inv = dbInventory.getById(item.inventory_id);
      if (inv) {
        const baseUnits = Number(item.base_units || item.base_units_deducted || item.qty_base_units || item.quantity || item.qty || 1);
        acc.push({ id: inv.id, baseQty: baseUnits });
      }
      return acc;
    }, []);
    if (deductions.length > 0) dbInventory.bulkDeductStock(deductions, "store");

    setCollection(KEYS.SALES, [newSale, ...sales]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("pos_sales", newSale, "CREATE", newSale.id);
    }

    dbAuditLogs.logEvent({
      action: "POS_MEDICINE_SALE",
      entity: "sales",
      entity_id: newSale.id,
      actor_id: cashierId,
      actor_name: cashierName,
      reason: `Sold ${newSale.items?.length || 0} item(s) to ${newSale.patient_name || 'Walk-in'} for Rs. ${newSale.total_amount} (Receipt #${newSale.receipt_no})`,
      after: newSale,
    });

    if (discount > 0) {
      dbAuditLogs.logEvent({
        action: "DISCOUNT_GRANTED",
        entity: "sales",
        entity_id: newSale.id,
        actor_id: cashierId,
        actor_name: cashierName,
        reason: `Discount of Rs. ${discount} granted on invoice ${newSale.receipt_no}`,
        after: { receipt_no: newSale.receipt_no, discount_amount: discount, total_amount: total },
      });
    }

    return newSale;
  },
  voidSale: (saleId, voidReason, authorizedBy = "Doctor / Admin") => {
    const sales = getCollection(KEYS.SALES);
    const target = sales.find((s) => s.id === saleId || s.receipt_no === saleId);
    if (!target) return { success: false, error: "Sale invoice not found" };
    if (target.is_voided) return { success: false, error: "Invoice is already voided" };

    // Restock items back to inventory
    (target.items || []).forEach((item) => {
      if (item.inventory_id) {
        const baseQty = Number(item.base_units || item.base_units_deducted || item.qty_base_units || item.quantity || item.qty || 1);
        dbInventory.addStock(item.inventory_id, baseQty, target.destination_type === "warehouse" ? "warehouse" : "store");
      }
    });

    const updated = sales.map((s) =>
      s.id === target.id
        ? {
            ...s,
            is_voided: true,
            voided_at: new Date().toISOString(),
            void_reason: voidReason || "Cancelled with authorization",
            voided_by: authorizedBy,
          }
        : s
    );
     setCollection(KEYS.SALES, updated);
     if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
       dbOutbox.enqueue("pos_sales", { id: target.id, is_voided: true, void_reason: voidReason }, "DELETE", target.id);
     }
     dbAuditLogs.logEvent({
       action: "VOID_SALE_INVOICE",
       entity: "sales",
       entity_id: target.id,
       before: target,
       after: { ...target, is_voided: true, void_reason: voidReason, voided_by: authorizedBy },
       reason: voidReason || `Voided invoice ${target.receipt_no || target.id}`,
     });
     try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
     return { success: true, data: target };
  },
  add: (sale) => {
    return dbSales.checkout(sale);
  },
};


// ---------- Purchases (GRN Inward) ----------
export const dbPurchases = {
  getAll: () => getCollection(KEYS.PURCHASES),
  getById: (id) => getScopedRecordById(KEYS.PURCHASES, id),
  add: (purchase) => {
    const purchases = getCollection(KEYS.PURCHASES) || [];

    let invoiceNo = (purchase.invoice_no || purchase.voucher_no || purchase.receipt_no || "").trim();
    const isDuplicate = invoiceNo && purchases.some((p) => {
      const existing = (p.invoice_no || p.voucher_no || p.receipt_no || "").trim();
      return existing && existing.toLowerCase() === invoiceNo.toLowerCase();
    });

    if (!invoiceNo || isDuplicate) {
      invoiceNo = generateSequentialInvoiceNo("PUR");
    }
    const totalAmount = Number(purchase.total_amount) || 0;
    const paidAmount = Number(purchase.paid_amount) || 0;
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    const newPurchase = {
      ...purchase,
      id: generateId("pur"),
      invoice_no: invoiceNo,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      purchase_date: purchase.purchase_date || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Default to 'store' if destination_type is 'store' or not explicitly 'warehouse'
    const dest = purchase.destination_type === "warehouse" ? "warehouse" : "store";

    // Process each item: auto-create missing inventory + apply multi-unit base conversion
    (purchase.items || []).forEach((item) => {
      let inv = item.inventory_id ? dbInventory.getById(item.inventory_id) : null;

      // If no inventory_id, look up existing item by name (case-insensitive)
      if (!inv && item.medicine_name && item.medicine_name.trim()) {
        inv = dbInventory.findByName(item.medicine_name.trim());
      }

      // Auto-register new medicine in inventory if still not found
      if (!inv && item.medicine_name && item.medicine_name.trim()) {
        const initialCost = Number(item.cost_price || item.rate || item.tp_rate) || 0;
        const initialSale = Number(item.sale_price || item.retail_price || item.box_sale_price) || (initialCost > 0 ? initialCost * 1.2 : 0);
        inv = dbInventory.add({
          medicine_name: item.medicine_name.trim(),
          item_code: item.item_code || item.product_code || "",
          generic_name: item.generic_name || item.product_description || "",
          product_description: item.product_description || item.generic_name || "",
          category: item.category || "Medicine",
          company_name: item.company_name || purchase.supplier_name || "General Pharma",
          has_multi_unit: Boolean(item.has_multi_unit),
          strips_per_box: Number(item.strips_per_box) || 1,
          units_per_strip: Number(item.units_per_strip) || 1,
          box_label: item.box_label || item.packing || "Pack",
          strip_label: item.strip_label || "Strip",
          unit_label: item.unit_label || item.packing || "Unit",
          cost_price: initialCost,
          cost_price_per_box: initialCost,
          box_sale_price: initialSale,
          strip_sale_price: initialSale,
          unit_sale_price: initialSale,
          sale_price: initialSale,
          total_base_stock: 0,
          store_stock: 0,
          stock_qty: 0,
          warehouse_stock: 0,
          low_stock_threshold: 6,
          expiry_date: item.expiry_date || item.exp_date || "",
        });
        // Patch the item with the newly created inventory_id for invoice record
        item.inventory_id = inv ? inv.id : item.inventory_id;
      }

      if (inv) {
        // Correct multi-unit base conversion: boxes → base units or explicit qty_base_units
        const baseUnits = Number(item.qty_base_units) || convertUnitsToBase(
          Number(item.qty || item.paid_qty || 1) + Number(item.bonus_qty || 0),
          item.received_unit_type || "unit",
          inv
        );
        dbInventory.addStock(inv.id, baseUnits, dest);

        // Auto-update inventory cost rates & retail prices if new rates are received in GRN
        const newCostRate = Number(item.rate || item.cost_price || item.tp_rate) || 0;
        const newSalePrice = Number(item.sale_price || item.retail_price) || 0;
        const rateUpdates = {};

        if (newCostRate > 0) {
          rateUpdates.cost_price_per_box = newCostRate;
          rateUpdates.cost_price = newCostRate;
          rateUpdates.last_purchase_rate = newCostRate;
        }
        if (newSalePrice > 0) {
          rateUpdates.unit_sale_price = newSalePrice;
          rateUpdates.box_sale_price = newSalePrice;
          rateUpdates.sale_price = newSalePrice;
        }
        if (item.expiry_date || item.exp_date) {
          rateUpdates.expiry_date = item.expiry_date || item.exp_date;
        }
        if (Object.keys(rateUpdates).length > 0) {
          dbInventory.update(inv.id, rateUpdates);
        }
      }

    });

    // Update supplier running balance
    if (purchase.supplier_id) {
      if (balanceDue > 0) {
        dbSuppliers.updateBalance(purchase.supplier_id, balanceDue);
      }
      // Auto-log PURCHASE_BILL transaction in the two-way supplier ledger
      dbSupplierLedger.addTransaction(
        purchase.supplier_id,
        "PURCHASE_BILL",
        totalAmount,  // debit
        paidAmount,   // credit (immediate cash payment, if any)
        `Purchase Bill — ${newPurchase.invoice_no} | Supplier: ${purchase.supplier_name || "Distributor"}`,
        newPurchase.invoice_no
      );
    }

    setCollection(KEYS.PURCHASES, [newPurchase, ...purchases]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("purchases", newPurchase, "CREATE", newPurchase.id);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clinicflow_status_update"));
    }
    return newPurchase;
  },
  create: (purchase) => dbPurchases.add(purchase),
  getNextVoucherNo: () => {
    const list = getCollection(KEYS.PURCHASES);
    if (!list.length) return "P-1001";
    let maxNum = 1000;
    list.forEach((p) => {
      const v = p.invoice_no || p.voucher_no || "";
      const match = v.match(/P-(\d+)/i);
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    });
    return `P-${maxNum + 1}`;
  },
  exportCSV: (purchasesList, filename = "Purchase_GRN_List.csv") => {
    const list = purchasesList || getCollection(KEYS.PURCHASES);
    let csv = "Voucher No,Date,Supplier Name,GRN No,Reference,Transport,Bilty No,Items Count,Total Bill,Paid,Balance Due\n";
    list.forEach((p) => {
      const vNo = `"${(p.invoice_no || p.voucher_no || '').replace(/"/g, '""')}"`;
      const date = `"${(p.purchase_date || '').split('T')[0]}"`;
      const sup = `"${(p.supplier_name || p.account_name || '').replace(/"/g, '""')}"`;
      const grn = `"${(p.grn_no || '').replace(/"/g, '""')}"`;
      const ref = `"${(p.reference || '').replace(/"/g, '""')}"`;
      const tr = `"${(p.transport || '').replace(/"/g, '""')}"`;
      const bil = `"${(p.bilty_no || '').replace(/"/g, '""')}"`;
      const itCnt = (p.items || []).length;
      csv += `${vNo},${date},${sup},${grn},${ref},${tr},${bil},${itCnt},${p.total_amount || 0},${p.paid_amount || 0},${p.balance_due || 0}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  deletePurchase: (purchaseId) => {
    const purchases = getCollection(KEYS.PURCHASES);
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (purchase) {
      const dest = purchase.destination_type === "store" ? "store" : "warehouse";
      (purchase.items || []).forEach((item) => {
        if (item.inventory_id) {
          const inv = dbInventory.getById(item.inventory_id);
          const baseUnits = Number(item.qty_base_units) || (inv ? convertUnitsToBase(Number(item.qty) || 1, item.received_unit_type || "unit", inv) : Number(item.qty) || 1);
          if (dest === "store") {
            dbInventory.deductStock(item.inventory_id, baseUnits);
          } else {
            dbInventory.deductStockFromLocation(item.inventory_id, baseUnits, purchase.destination_id || "wh_001");
          }
        }
      });
      if (purchase.supplier_id && Number(purchase.balance_due) > 0) {
        dbSuppliers.updateBalance(purchase.supplier_id, -Number(purchase.balance_due));
      }
      dbAuditLogs.logEvent({
        action: "DELETE_PURCHASE_GRN",
        entity: "purchases",
        entity_id: purchaseId,
        before: purchase,
        after: null,
        reason: `Reversed and deleted inward purchase GRN ${purchase.invoice_no || purchaseId}`,
      });
    }
    setCollection(KEYS.PURCHASES, purchases.filter((p) => p.id !== purchaseId));
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
  },

  deleteInvoice: (purchaseId) => {
    dbPurchases.deletePurchase(purchaseId);
  },
};

// ---------- GRN Dynamic References & Transport Carriers ----------
export const dbGrnMetadata = {
  getReferences: () => {
    const custom = getCollection("clinicflow_grn_references") || [];
    const registeredUsers = (dbUsers.getAll() || []).map((u) => u.name || u.full_name).filter(Boolean);
    const defaults = registeredUsers.length > 0 ? registeredUsers : ["Clinic Administrator"];
    return Array.from(new Set([...defaults, ...custom]));
  },
  addReference: (refName) => {
    if (!refName || !refName.trim()) return "";
    const clean = refName.trim();
    const existing = getCollection("clinicflow_grn_references") || [];
    if (!existing.includes(clean)) {
      setCollection("clinicflow_grn_references", [...existing, clean]);
    }
    return clean;
  },
  getTransports: () => {
    const custom = getCollection("clinicflow_grn_transports") || [];
    const dirtyJunk = ["BabU Gadha", "by Hand Fraz Bhai", "by hand Usama", "Asad Bhai", "Azeem", "Al-razi Transport"];
    
    // Purge old dirty/sample entries and convert all saved entries to clean Title Case
    const cleanedCustom = (custom || [])
      .map((raw) => toTitleCase(raw))
      .filter((t) => t && !dirtyJunk.includes(t));
    
    // Save back cleaned custom array to permanently wipe legacy junk from localStorage
    if (JSON.stringify(cleanedCustom) !== JSON.stringify(custom)) {
      setCollection("clinicflow_grn_transports", Array.from(new Set(cleanedCustom)));
    }

    const map = new Map();
    ["By Hand", ...cleanedCustom].forEach((raw) => {
      const title = toTitleCase(raw);
      if (title && !map.has(title.toLowerCase())) {
        map.set(title.toLowerCase(), title);
      }
    });
    return Array.from(map.values());
  },
  addTransport: (transportName) => {
    if (!transportName || !transportName.trim()) return "";
    const cleanTitle = toTitleCase(transportName);
    if (!cleanTitle) return "";
    const existing = getCollection("clinicflow_grn_transports") || [];
    const normalizedExisting = (existing || []).map((e) => toTitleCase(e)).filter(Boolean);
    if (!normalizedExisting.some((e) => e.toLowerCase() === cleanTitle.toLowerCase())) {
      setCollection("clinicflow_grn_transports", [...normalizedExisting, cleanTitle]);
    }
    return cleanTitle;
  },
};

export const dbTransports = dbGrnMetadata;


// ---------- Wholesale B2B Sales (Interior Sindh Supply) ----------
export const dbB2BSales = {
  getAll: () => getCollection(KEYS.B2B_SALES),
  getById: (id) => getScopedRecordById(KEYS.B2B_SALES, id),
  checkout: (saleData) => {
    const sales = getCollection(KEYS.B2B_SALES) || [];
    const posSales = getCollection(KEYS.SALES) || [];
    const allSales = [...sales, ...posSales];

    let invoiceNo = (saleData.invoice_no || saleData.voucher_no || saleData.receipt_no || "").trim();
    const isDuplicate = invoiceNo && allSales.some((s) => {
      const existing = (s.invoice_no || s.voucher_no || s.receipt_no || "").trim();
      return existing && existing.toLowerCase() === invoiceNo.toLowerCase();
    });

    if (!invoiceNo || isDuplicate) {
      invoiceNo = generateSequentialInvoiceNo("WS");
    }
    const paidAmount = Number(saleData.paid_amount) || 0;
    const totalAmount = Number(saleData.total_amount) || 0;
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    const newB2BSale = {
      ...saleData,
      id: generateId("b2b"),
      invoice_no: invoiceNo,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      sale_date: saleData.sale_date || new Date().toISOString(),
    };

    // Batched godown deduction: single in-memory pass + one disk write
    const deductions = (saleData.items || []).reduce((acc, item) => {
      const inv = dbInventory.getById(item.inventory_id);
      if (inv) {
        const qty = Number(item.qty_base_units || item.quantity || item.qty) || 0;
        if (qty > 0) acc.push({ id: inv.id, baseQty: qty });
      }
      return acc;
    }, []);
    if (deductions.length > 0) dbInventory.bulkDeductStock(deductions, "warehouse");

    if (balanceDue > 0 && saleData.buyer_id) {
      dbParties.updateBalance(saleData.buyer_id, balanceDue);
    }

    setCollection(KEYS.B2B_SALES, [newB2BSale, ...sales]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("b2b_sales", newB2BSale, "CREATE", newB2BSale.id);
    }
    return newB2BSale;
  },
  add: (saleData) => {
    return dbB2BSales.checkout(saleData);
  },
};

// ---------- Internal Stock Transfers ----------
export const dbStockTransfers = {
  getAll: () => getCollection(KEYS.STOCK_TRANSFERS),
  transfer: (data) => {
    const transfers = getCollection(KEYS.STOCK_TRANSFERS);
    const transferNo = generateSequentialInvoiceNo("TRF");
    const newTransfer = {
      ...data,
      id: generateId("trf"),
      transfer_no: transferNo,
      status: data.status || "completed", // "completed" | "in_transit" | "received"
      transfer_date: new Date().toISOString(),
    };
    setCollection(KEYS.STOCK_TRANSFERS, [newTransfer, ...transfers]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("stock_movements", newTransfer, "CREATE", newTransfer.id);
    }
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return newTransfer;
  },
  dispatchTransfer: (data) => {
    const transfers = getCollection(KEYS.STOCK_TRANSFERS);
    const transferNo = generateSequentialInvoiceNo("TRF");
    const newTransfer = {
      ...data,
      id: generateId("trf"),
      transfer_no: transferNo,
      status: "in_transit",
      dispatched_at: new Date().toISOString(),
      transfer_date: new Date().toISOString(),
    };
    // Deduct stock from source warehouse
    (data.items || []).forEach((it) => {
      if (it.inventory_id) {
        const qty = Number(it.qty || it.quantity || 1);
        const fromLoc = data.from_warehouse_id || data.from_location || "wh_001";
        if (fromLoc === "store" || fromLoc === "wh_str") {
          dbInventory.deductStock(it.inventory_id, qty);
        } else {
          dbInventory.deductStockFromLocation(it.inventory_id, qty, fromLoc);
        }
      }
    });
    setCollection(KEYS.STOCK_TRANSFERS, [newTransfer, ...transfers]);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return newTransfer;
  },
  receiveTransfer: (transferId, { received_by = "Incharge", damaged_count = 0, notes = "" } = {}) => {
    const transfers = getCollection(KEYS.STOCK_TRANSFERS);
    const target = transfers.find((t) => t.id === transferId);
    if (!target || target.status === "received") return null;

    // Add stock to destination location
    (target.items || []).forEach((it) => {
      if (it.inventory_id) {
        const totalQty = Number(it.qty || it.quantity || 1);
        const actualReceived = Math.max(0, totalQty - Number(damaged_count || 0));
        if (actualReceived > 0) {
          dbInventory.addStock(it.inventory_id, actualReceived, target.to_location || "store");
        }
      }
    });

    const updated = transfers.map((t) =>
      t.id === transferId
        ? {
            ...t,
            status: "received",
            received_at: new Date().toISOString(),
            received_by,
            damaged_count: Number(damaged_count) || 0,
            receiving_notes: notes,
          }
        : t
    );
    setCollection(KEYS.STOCK_TRANSFERS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updated.find((t) => t.id === transferId);
  },
};

// ---------- Expenses ----------
export const dbExpenses = {
  getAll: () => getCollection(KEYS.EXPENSES),
  getById: (id) => getScopedRecordById(KEYS.EXPENSES, id),
  add: (expense) => {
    const list = getCollection(KEYS.EXPENSES);
    const sessionUser = getActiveSessionUser();

    let whId = expense.warehouse_id;
    if (sessionUser && (sessionUser.role === "warehouse" || sessionUser.role === "warehouse_incharge") && !sessionUser.is_owner && sessionUser.role !== "admin") {
      const userWh = sessionUser.assigned_warehouse_id;
      if (!userWh) {
        throw new Error("Unauthorized: Missing active warehouse context for expense allocation.");
      }
      if (expense.warehouse_id && expense.warehouse_id !== userWh) {
        throw new Error(`Unauthorized: Expense warehouse_id mismatch. User assigned to '${userWh}' cannot allocate expenses to '${expense.warehouse_id}'.`);
      }
      whId = userWh;
    } else {
      whId = whId || sessionUser?.assigned_warehouse_id || "wh_primary";
    }

    const expDate = expense.date || expense.expense_date || new Date().toISOString();
    const newExp = {
      ...expense,
      id: generateId("exp"),
      warehouse_id: whId,
      amount: Number(expense.amount) || 0,
      date: expDate,
      expense_date: expDate,
    };
    setCollection(KEYS.EXPENSES, [newExp, ...list]);
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("expenses", newExp, "CREATE", newExp.id);
    }
    return newExp;
  },
  delete: (id) => {
    const list = getCollection(KEYS.EXPENSES);
    setCollection(KEYS.EXPENSES, list.filter((e) => e.id !== id));
    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("expenses", { id }, "DELETE", id);
    }
  },
};

// ---------- Returns & Exchanges ----------
export const dbReturns = {
  getAll: () => getCollection(KEYS.RETURNS),
  processReturn: ({ sale_id, original_sale_id, return_items, items: rawItems, reason, refund_type }) => {
    const returns = getCollection(KEYS.RETURNS);
    const items = return_items || rawItems || [];
    const refundAmount = items.reduce((sum, it) => {
      const qty = Number(it.quantity_returned || it.qty || it.quantity) || 0;
      const price = Number(it.unit_price) || 0;
      return sum + (qty * price);
    }, 0);

    // Restock returned items back to store counter stock
    items.forEach((it) => {
      if (it.inventory_id) {
        const baseUnits = Number(it.base_units || it.base_units_deducted || it.quantity_returned || it.qty || 1);
        dbInventory.addStock(it.inventory_id, baseUnits, "store");
      }
    });

    const newRet = {
      id: generateId("ret"),
      sale_id: sale_id || original_sale_id,
      reason,
      refund_type: refund_type || "cash",
      items,
      returned_items: items,
      refund_amount: refundAmount,
      return_date: new Date().toISOString(),
    };
    setCollection(KEYS.RETURNS, [newRet, ...returns]);
    return newRet;
  },
};

// ---------- Shift Closings ----------
export const dbShiftClosings = {
  getAll: () => getCollection(KEYS.SHIFT_CLOSINGS) || [],
  getByDate: (dateStr) => {
    const all = getCollection(KEYS.SHIFT_CLOSINGS) || [];
    return all.filter((c) => c.date === dateStr);
  },
  add: (closingData) => {
    const closings = getCollection(KEYS.SHIFT_CLOSINGS) || [];
    const newRecord = {
      ...closingData,
      id: generateId("shift"),
      closed_at: new Date().toISOString(),
    };
    setCollection(KEYS.SHIFT_CLOSINGS, [newRecord, ...closings]);
    return newRecord;
  },
  delete: (id) => {
    const closings = getCollection(KEYS.SHIFT_CLOSINGS) || [];
    setCollection(KEYS.SHIFT_CLOSINGS, closings.filter((c) => c.id !== id));
  }
};

// ---------- DrCreate & MS Access CashBook Engine ----------
export const dbCashBook = {
  getAll: (filters = {}) => {
    // VPS-Primary: CashBook starts empty on fresh install.
    // All real entries come from VPS via syncEngine pull.
    // Do NOT inject fake baseline entries.
    let list = getCollection(KEYS.CASHBOOK) || [];

    let filtered = [...list];
    if (filters.date) {
      const dateStr = filters.date.split("T")[0];
      filtered = filtered.filter((r) => (r.date || "").split("T")[0] === dateStr);
    }
    if (filters.term && filters.term !== "All") {
      filtered = filtered.filter((r) => (r.term || r.type || "").toLowerCase() === filters.term.toLowerCase());
    }
    if (filters.account_name) {
      const query = filters.account_name.toLowerCase();
      filtered = filtered.filter((r) => (r.account_name || "").toLowerCase().includes(query));
    }
    return filtered;
  },

  getNextVoucherNo: () => {
    const list = getCollection(KEYS.CASHBOOK) || [];
    let maxNum = 5000; // Start at C-5001 on fresh install
    list.forEach((entry) => {
      const v = entry.voucher_no || "";
      const match = v.match(/^C-(\d+)$/i);
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    });
    return `C-${maxNum + 1}`;
  },

  addEntry: (entryData) => {
    const list = getCollection(KEYS.CASHBOOK) || [];
    const voucherNo = entryData.voucher_no || dbCashBook.getNextVoucherNo();
    const amount = Math.max(0, Number(entryData.amount) || 0);
    const actionType = entryData.action_type || (entryData.term === "Paid" ? "supplier_payment" : "party_wasooli");
    const paymentMode = entryData.payment_mode || (actionType.includes("credit") ? "Credit" : "Cash");
    const term = (actionType === "party_credit_sale" || actionType === "supplier_credit_purchase" || entryData.term === "Credit")
      ? "Credit"
      : (entryData.term === "Paid" || actionType === "supplier_payment" || actionType === "supplier_cash_purchase" || actionType === "shop_expense")
        ? "Paid"
        : "Receive";
    const date = entryData.date ? entryData.date.split("T")[0] : new Date().toISOString().split("T")[0];
    const accountName = (entryData.account_name || "Cash In Hand").trim();
    const naration = (entryData.naration || entryData.description || "").trim();

    const newEntry = {
      id: generateId("cb"),
      voucher_no: voucherNo,
      term,
      type: term,
      action_type: actionType,
      payment_mode: paymentMode,
      bank_name: entryData.bank_name || undefined,
      cheque_no: entryData.cheque_no || undefined,
      account_name: accountName,
      party_id: entryData.party_id || undefined,
      supplier_id: entryData.supplier_id || undefined,
      category: entryData.category || (
        actionType === "party_wasooli" ? "Party Wasooli" :
        actionType === "party_credit_sale" ? "Party Credit Sale" :
        actionType === "party_cash_sale" ? "Party Cash Sale" :
        actionType === "supplier_payment" ? "Supplier Payment" :
        actionType === "supplier_credit_purchase" ? "Company Credit Purchase" :
        actionType === "supplier_cash_purchase" ? "Company Cash Purchase" :
        "Shop Expense"
      ),
      naration,
      description: naration,
      amount,
      date,
      created_at: new Date().toISOString(),
    };

    // 1. Sync Double-Entry accounting into General Ledger (MainAc)
    const mainAcList = getCollection(KEYS.MAIN_AC) || [];
    const mainAcEntries = [];

    if (actionType === "party_credit_sale") {
      // Party took stock on credit: Debit Party Account, Credit Sales
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Debit Note",
        account_name: accountName,
        debit: amount,
        credit: 0,
        description: naration || `Stock given on credit to ${accountName}`,
        created_at: new Date().toISOString()
      });
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Credit Note",
        account_name: "Sales Account",
        debit: 0,
        credit: amount,
        description: naration || `Credit sale`,
        created_at: new Date().toISOString()
      });

      // Increase Party Udhaar Balance
      const parties = dbParties.getAll();
      const matchedParty = parties.find(
        (p) => (p.name || "").toLowerCase() === accountName.toLowerCase() || p.id === entryData.party_id
      );
      if (matchedParty) {
        dbParties.updateBalance(matchedParty.id, amount);
      }
    } else if (actionType === "supplier_credit_purchase") {
      // Bought stock on credit from Company: Debit Purchases, Credit Supplier
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Debit Note",
        account_name: "Inventory Purchases",
        debit: amount,
        credit: 0,
        description: naration || `Stock received on credit from ${accountName}`,
        created_at: new Date().toISOString()
      });
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Credit Note",
        account_name: accountName,
        debit: 0,
        credit: amount,
        description: naration || `Supplier payable credit accrued`,
        created_at: new Date().toISOString()
      });

      // Increase Supplier Payable Balance
      const suppliers = dbSuppliers.getAll();
      const matchedSup = suppliers.find(
        (s) => (s.name || "").toLowerCase() === accountName.toLowerCase() || s.id === entryData.supplier_id
      );
      if (matchedSup) {
        dbSuppliers.updateBalance(matchedSup.id, amount);
      }
    } else if (actionType === "supplier_cash_purchase") {
      // Bought stock on spot Cash: Debit Purchases, Credit Cash in Hand
      const cashAc = paymentMode.includes("Bank") ? "Bank Account" : "Cash In Hand";
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Debit Note",
        account_name: "Inventory Purchases",
        debit: amount,
        credit: 0,
        description: naration || `Stock purchased on cash from ${accountName}`,
        created_at: new Date().toISOString()
      });
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Paid",
        account_name: cashAc,
        debit: 0,
        credit: amount,
        description: naration || `Cash paid for stock`,
        created_at: new Date().toISOString()
      });
      // Supplier credit balance is unchanged because cash was paid on the spot
    } else if (actionType === "party_cash_sale") {
      // Sold stock for spot cash: Debit Cash in Hand, Credit Sales
      const cashAc = paymentMode.includes("Bank") ? "Bank Account" : "Cash In Hand";
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Receive",
        account_name: cashAc,
        debit: amount,
        credit: 0,
        description: naration || `Cash sale to ${accountName}`,
        created_at: new Date().toISOString()
      });
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Credit Note",
        account_name: "Sales Account",
        debit: 0,
        credit: amount,
        description: naration || `Cash sale revenue`,
        created_at: new Date().toISOString()
      });
      // Party balance is unchanged because cash was received on the spot
    } else if (term === "Receive") {
      // Party Udhaar Wasooli: Debit Cash in Hand, Credit Party Account
      const cashAc = paymentMode.includes("Bank") ? "Bank Account" : "Cash In Hand";
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Receive",
        account_name: cashAc,
        debit: amount,
        credit: 0,
        description: naration || `Cash received from ${accountName}`,
        created_at: new Date().toISOString()
      });
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Credit Note",
        account_name: accountName,
        debit: 0,
        credit: amount,
        description: naration || `Udhaar wasooli received`,
        created_at: new Date().toISOString()
      });

      // Reduce party Udhaar balance if it's a known wholesale party wasooli
      const parties = dbParties.getAll();
      const matchedParty = parties.find(
        (p) => (p.name || "").toLowerCase() === accountName.toLowerCase() || p.id === entryData.party_id
      );
      if (matchedParty) {
        dbParties.recordPayment(matchedParty.id, amount, paymentMode, naration, entryData.cashier);
      }
    } else {
      // Paid (Supplier Debt Payment / Shop Expense)
      const cashAc = paymentMode.includes("Bank") ? "Bank Account" : "Cash In Hand";
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Debit Note",
        account_name: accountName,
        debit: amount,
        credit: 0,
        description: naration || `Payment to ${accountName}`,
        created_at: new Date().toISOString()
      });
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Paid",
        account_name: cashAc,
        debit: 0,
        credit: amount,
        description: naration || `Payment disbursed`,
        created_at: new Date().toISOString()
      });

      // If supplier, reduce Supplier payable balance
      const suppliers = dbSuppliers.getAll();
      const matchedSup = suppliers.find(
        (s) => (s.name || "").toLowerCase() === accountName.toLowerCase() || s.id === entryData.supplier_id
      );
      if (matchedSup) {
        dbSuppliers.recordPayment(matchedSup.id, amount);
      }
    }

    setCollection(KEYS.MAIN_AC, [...mainAcEntries, ...mainAcList]);
    setCollection(KEYS.CASHBOOK, [newEntry, ...list]);
    return newEntry;
  },

  deleteEntry: (idOrVoucher) => {
    const list = getCollection(KEYS.CASHBOOK) || [];
    const target = list.find((e) => e.id === idOrVoucher || e.voucher_no === idOrVoucher);
    if (!target) return false;
    const updated = list.filter((e) => e.id !== target.id && e.voucher_no !== target.voucher_no);
    setCollection(KEYS.CASHBOOK, updated);

    // Also remove from MainAc
    const mainAcList = getCollection(KEYS.MAIN_AC) || [];
    setCollection(KEYS.MAIN_AC, mainAcList.filter((m) => m.voucher_no !== target.voucher_no));

    dbAuditLogs.logEvent({
      action: "DELETE_CASHBOOK_ENTRY",
      entity: "cashbook",
      entity_id: target.id || target.voucher_no,
      before: target,
      after: null,
      reason: `Deleted cash voucher ${target.voucher_no} (${target.term} Rs. ${target.amount})`,
    });

    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return true;
  },

  getDailySummary: (dateStr) => {
    const targetDate = dateStr ? dateStr.split("T")[0] : new Date().toISOString().split("T")[0];
    const all = dbCashBook.getAll();
    const dayEntries = all.filter((r) => (r.date || "").split("T")[0] === targetDate);

    const receiveEntries = dayEntries.filter((r) => (r.term || r.type) === "Receive");
    const paidEntries = dayEntries.filter((r) => (r.term || r.type) === "Paid");

    const totalDebit = receiveEntries.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalCredit = paidEntries.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const balance = totalDebit - totalCredit;

    return {
      date: targetDate,
      total_debit: totalDebit,
      total_credit: totalCredit,
      balance,
      receive_entries: receiveEntries,
      paid_entries: paidEntries,
    };
  },

  exportCSV: (entriesList, filename = "CashBook_Transactions.csv") => {
    const list = entriesList || dbCashBook.getAll();
    let csv = "Voucher No,Date,Term,Account Name,Naration,Debit (Receive),Credit (Paid)\n";
    list.forEach((e) => {
      const vNo = `"${(e.voucher_no || '').replace(/"/g, '""')}"`;
      const date = `"${(e.date || '').split('T')[0]}"`;
      const term = `"${(e.term || e.type || 'Receive').replace(/"/g, '""')}"`;
      const acc = `"${(e.account_name || '').replace(/"/g, '""')}"`;
      const nar = `"${(e.naration || e.description || '').replace(/"/g, '""')}"`;
      const isRec = (e.term || e.type) === "Receive";
      const debit = isRec ? (Number(e.amount) || 0) : 0;
      const credit = !isRec ? (Number(e.amount) || 0) : 0;
      csv += `${vNo},${date},${term},${acc},${nar},${debit},${credit}\n`;
    });
    if (typeof document !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return csv;
  }
};

// ---------- DrCreate & MS Access Day Closing Receipt Engine ----------
export const dbDayClosing = {
  getDayClosingData: (dateStr) => {
    const targetDate = dateStr ? dateStr.split("T")[0] : new Date().toISOString().split("T")[0];

    // 1. Sales (POS + B2B + DrCreate Sale Invoices)
    const allSales = dbSales.getAll() || [];
    const allB2B = dbB2BSales.getAll() || [];
    const daySales = [...allSales, ...allB2B].filter(
      (s) => !s.is_voided && (s.sale_date || s.created_at || "").split("T")[0] === targetDate
    );

    let totalSale = 0;
    let cashSale = 0;
    let creditSale = 0;

    daySales.forEach((s) => {
      const tot = Number(s.total_amount) || 0;
      const isCredit = s.payment_mode === "Credit" || Number(s.balance_due) > 0;
      const paid = isCredit ? (Number(s.paid_amount || s.amount_paid) || 0) : tot;
      totalSale += tot;
      cashSale += paid;
      if (isCredit) {
        creditSale += Math.max(0, tot - paid);
      }
    });

    // 2. Purchases (GRN Inward)
    const allPurchases = dbPurchases.getAll() || [];
    const dayPurchases = allPurchases.filter((p) => (p.purchase_date || p.created_at || "").split("T")[0] === targetDate);

    let totalPurchase = 0;
    let cashPurchase = 0;
    let creditPurchase = 0;

    dayPurchases.forEach((p) => {
      const tot = Number(p.total_amount) || 0;
      const isCredit = p.payment_mode === "Credit" || Number(p.balance_due) > 0;
      const paid = isCredit ? (Number(p.paid_amount) || 0) : tot;
      totalPurchase += tot;
      cashPurchase += paid;
      if (isCredit) {
        creditPurchase += Math.max(0, tot - paid);
      }
    });

    // 3. CashBook Payments Paid (Outflows)
    const cashbookAll = dbCashBook.getAll() || [];
    const dayCashPaid = cashbookAll.filter((c) => (c.date || "").split("T")[0] === targetDate && (c.term || c.type) === "Paid");
    
    // Also include Expenses collection if any, deduplicating identical vouchers
    const allExpenses = dbExpenses.getAll() || [];
    const dayExpenses = allExpenses.filter((e) => (e.expense_date || e.date || "").split("T")[0] === targetDate);

    // Merge payments paid items
    const paymentsPaidList = [
      ...dayCashPaid.map((c) => ({
        account_name: c.account_name || "General Expense",
        amount: Number(c.amount) || 0,
        naration: c.naration || c.description || "",
        voucher_no: c.voucher_no || "",
      })),
      ...dayExpenses
        .filter((e) => !dayCashPaid.some((c) => c.voucher_no === e.id || (c.account_name === e.category && Math.abs(c.amount - Number(e.amount)) < 0.01)))
        .map((e) => ({
          account_name: e.category || "Shop Expense",
          amount: Number(e.amount) || 0,
          naration: e.description || "",
          voucher_no: e.id || "",
        })),
    ];
    const totalPaymentPaid = paymentsPaidList.reduce((sum, item) => sum + item.amount, 0);

    // 4. CashBook Payments Received (Inflows) + OPD Consultations
    const dayCashReceive = cashbookAll.filter((c) => (c.date || "").split("T")[0] === targetDate && (c.term || c.type) === "Receive");
    const allVisits = dbVisits.getAll() || [];
    const dayVisits = allVisits.filter(
      (v) => (v.visit_date || "").split("T")[0] === targetDate && (v.status === "completed" || v.status === "completed_reports_pending" || v.status === "waiting" || v.status === "in_consultation" || v.status === "done")
    );
    const totalOpdFees = dayVisits.reduce((sum, v) => sum + (Number(v.fee_amount) || 0), 0);

    const paymentsReceiveList = [
      ...dayCashReceive.map((c) => ({
        account_name: c.account_name || "Party Cash",
        amount: Number(c.amount) || 0,
        naration: c.naration || c.description || "",
        voucher_no: c.voucher_no || "",
      })),
    ];
    if (totalOpdFees > 0) {
      paymentsReceiveList.unshift({
        account_name: "OPD Doctor Consultation Fees",
        amount: totalOpdFees,
        naration: `${dayVisits.length} Patients OPD Visits`,
        voucher_no: `OPD-${dayVisits.length}`,
      });
    }
    const totalPaymentReceive = paymentsReceiveList.reduce((sum, item) => sum + item.amount, 0);

    // 5. Closing Cash (Net Cash In Hand for the day)
    const closingCash = cashSale + totalPaymentReceive - cashPurchase - totalPaymentPaid;

    // 6. Generate WhatsApp Message Text
    const clinic = dbClinic.get();
    const clinicName = clinic?.name || "H/Dr.Asif Ashraf Khan Clinic";
    const waText = `*📋 DAY CLOSING RECEIPT — ${targetDate}*\n` +
      `*🏥 ${clinicName}*\n\n` +
      `*💰 SALE:*\n` +
      `• Total Sale: Rs. ${totalSale.toLocaleString()}\n` +
      `• Cash Sale: Rs. ${cashSale.toLocaleString()}\n` +
      `• Credit (Udhaar): Rs. ${creditSale.toLocaleString()}\n\n` +
      `*📦 PURCHASE:*\n` +
      `• Total Purchase: Rs. ${totalPurchase.toLocaleString()}\n` +
      `• Cash Purchase: Rs. ${cashPurchase.toLocaleString()}\n` +
      `• Credit (Payable): Rs. ${creditPurchase.toLocaleString()}\n\n` +
      `*🔻 PAYMENT PAID (Outflow):* Rs. ${totalPaymentPaid.toLocaleString()}\n` +
      paymentsPaidList.slice(0, 5).map(p => `  - ${p.account_name}: Rs. ${p.amount.toLocaleString()}`).join("\n") +
      (paymentsPaidList.length > 5 ? `\n  ...and ${paymentsPaidList.length - 5} more` : '') + `\n\n` +
      `*🔺 PAYMENT RECEIVE (Inflow):* Rs. ${totalPaymentReceive.toLocaleString()}\n` +
      paymentsReceiveList.slice(0, 5).map(p => `  + ${p.account_name}: Rs. ${p.amount.toLocaleString()}`).join("\n") +
      (paymentsReceiveList.length > 5 ? `\n  ...and ${paymentsReceiveList.length - 5} more` : '') + `\n\n` +
      `*💵 CLOSING CASH IN HAND: Rs. ${closingCash.toLocaleString()}*\n\n` +
      `_Generated by CliniCore & K.B Software_`;

    return {
      date: targetDate,
      sales: {
        total: totalSale,
        cash: cashSale,
        credit: creditSale,
      },
      purchases: {
        total: totalPurchase,
        cash: cashPurchase,
        credit: creditPurchase,
      },
      payments_paid: {
        total: totalPaymentPaid,
        items: paymentsPaidList,
      },
      payments_received: {
        total: totalPaymentReceive,
        items: paymentsReceiveList,
      },
      closing_cash: closingCash,
      whatsapp_text: waText,
    };
  }
};

const BACKUP_MAGIC_HEADER = "CF_ENCRYPTED_VAULT_V1::";

/** Simple obfuscation / cipher to protect backup payload against plain text inspection */
function encryptBackupPayload(plainStr) {
  const key = 0x5a;
  let enc = "";
  for (let i = 0; i < plainStr.length; i++) {
    enc += String.fromCharCode(plainStr.charCodeAt(i) ^ key);
  }
  let b64 = "";
  try {
    if (typeof Buffer !== "undefined") {
      b64 = Buffer.from(enc, "binary").toString("base64");
    } else {
      b64 = btoa(unescape(encodeURIComponent(enc)));
    }
  } catch {
    b64 = btoa(unescape(encodeURIComponent(enc)));
  }
  return BACKUP_MAGIC_HEADER + b64;
}

function decryptBackupPayload(encryptedStr) {
  if (typeof encryptedStr !== "string") {
    throw new Error("Encrypted payload must be a string.");
  }
  const trimmed = encryptedStr.trim();
  if (trimmed.startsWith(BACKUP_MAGIC_HEADER)) {
    const rawB64 = trimmed.slice(BACKUP_MAGIC_HEADER.length);
    if (!rawB64 || rawB64.length < 4) {
      throw new Error("Corrupted or truncated ciphertext payload.");
    }
    let decoded = "";
    try {
      if (typeof Buffer !== "undefined") {
        decoded = Buffer.from(rawB64, "base64").toString("binary");
      } else {
        decoded = decodeURIComponent(escape(atob(rawB64)));
      }
    } catch {
      throw new Error("Corrupted base64 encoding in vault payload.");
    }
    const key = 0x5a;
    let plain = "";
    for (let i = 0; i < decoded.length; i++) {
      plain += String.fromCharCode(decoded.charCodeAt(i) ^ key);
    }
    try {
      return JSON.parse(plain);
    } catch {
      throw new Error("Decrypted payload is not valid JSON.");
    }
  }
  // Fallback for standard JSON backup imports
  return JSON.parse(trimmed);
}

const CHECKPOINT_META_KEY = "cf_restore_checkpoints_meta";
const MAX_CHECKPOINTS_RETAINED = 3;

export function createPreRestoreCheckpoint(reason = "Pre-Restore Safety Checkpoint") {
  try {
    if (typeof localStorage === "undefined") return { success: false, error: "LocalStorage unavailable." };
    const timestamp = Date.now();
    const checkpointId = `cf_chk_${timestamp}`;
    const snapshot = {};

    for (let i = 0; i < storageDriver.length; i++) {
      const k = storageDriver.key(i);
      if (k && !k.startsWith("cf_chk_") && k !== CHECKPOINT_META_KEY) {
        snapshot[k] = storageDriver.getItem(k);
      }
    }

    const payloadStr = JSON.stringify(snapshot);
    storageDriver.setItem(checkpointId, payloadStr);

    let metaList = [];
    try {
      metaList = JSON.parse(storageDriver.getItem(CHECKPOINT_META_KEY) || "[]");
    } catch {
      metaList = [];
    }

    metaList.unshift({
      id: checkpointId,
      timestamp,
      created_at: new Date(timestamp).toISOString(),
      reason,
      total_keys: Object.keys(snapshot).length,
      byte_size: payloadStr.length,
    });

    while (metaList.length > MAX_CHECKPOINTS_RETAINED) {
      const expired = metaList.pop();
      if (expired && expired.id) {
        storageDriver.removeItem(expired.id);
      }
    }

    storageDriver.setItem(CHECKPOINT_META_KEY, JSON.stringify(metaList));
    return { success: true, checkpointId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function rollbackLastRestore(targetCheckpointId = null) {
  try {
    if (typeof localStorage === "undefined") return { success: false, error: "LocalStorage unavailable." };
    let metaList = [];
    try {
      metaList = JSON.parse(storageDriver.getItem(CHECKPOINT_META_KEY) || "[]");
    } catch {
      metaList = [];
    }

    if (metaList.length === 0) {
      return { success: false, error: "No rollback checkpoints available." };
    }

    const target = targetCheckpointId
      ? metaList.find((m) => m.id === targetCheckpointId)
      : metaList[0];

    if (!target) {
      return { success: false, error: "Target checkpoint not found." };
    }

    const rawSnapshot = storageDriver.getItem(target.id);
    if (!rawSnapshot) {
      return { success: false, error: "Checkpoint snapshot data is missing or corrupted." };
    }

    const snapshot = JSON.parse(rawSnapshot);

    const keysToRemove = [];
    for (let i = 0; i < storageDriver.length; i++) {
      const k = storageDriver.key(i);
      if (k && !k.startsWith("cf_chk_") && k !== CHECKPOINT_META_KEY) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => storageDriver.removeItem(k));

    Object.entries(snapshot).forEach(([k, v]) => {
      if (v !== null && v !== undefined) {
        storageDriver.setItem(k, v);
      }
    });

    _COLLECTION_CACHE.clear();
    _ID_MAP_CACHE.clear();

    try {
      window.dispatchEvent(new Event("clinicflow_status_update"));
    } catch {}

    return { success: true, restoredCheckpointId: target.id, restoredAt: target.created_at };
  } catch (err) {
    return { success: false, error: `Rollback failed: ${err.message}` };
  }
}

export function parseAndValidateBackupString(rawInput) {
  if (!rawInput || typeof rawInput !== "string") {
    return { valid: false, error: "Empty or invalid backup payload string." };
  }

  let parsed = null;
  const trimmed = rawInput.trim();

  try {
    parsed = decryptBackupPayload(trimmed);
  } catch (e) {
    return { valid: false, error: `Invalid or corrupted .cfbak / .json backup file: ${e.message}` };
  }

  if (!parsed || typeof parsed !== "object" || !parsed.data || typeof parsed.data !== "object") {
    return { valid: false, error: "Invalid backup structure: Missing 'data' object." };
  }

  const backupSchemaVersion = parseInt(
    parsed.schema_version ?? parsed.data?.[SCHEMA_VERSION_KEY] ?? (parsed.version?.startsWith("5") ? TARGET_SCHEMA_VERSION : 1),
    10
  );

  if (backupSchemaVersion > TARGET_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Incompatible newer backup version (v${backupSchemaVersion}). Current system supports up to v${TARGET_SCHEMA_VERSION}. Please update software first.`,
    };
  }

  if (parsed.checksum_sha256) {
    const { checksum_sha256, ...body } = parsed;
    const computed = sha256Sync(JSON.stringify(body));
    if (computed !== checksum_sha256) {
      return {
        valid: false,
        error: "Cryptographic integrity check failed: Tampered or corrupted backup payload.",
      };
    }
  }

  return {
    valid: true,
    manifest: {
      format_version: parsed.format_version || parsed.version || "2.0.0",
      app: parsed.app || "CliniCore Desktop & Web Suite",
      export_date: parsed.export_date || new Date().toISOString(),
      clinic_name: parsed.clinic_name || "H/Dr.Asif Ashraf Khan Clinic",
      schema_version: backupSchemaVersion,
      checksum_sha256: parsed.checksum_sha256 || null,
      data: parsed.data,
    },
  };
}

export function simulateRestoreDryRun(backupInput) {
  const parseResult = typeof backupInput === "string"
    ? parseAndValidateBackupString(backupInput)
    : (backupInput && backupInput.data ? { valid: true, manifest: backupInput } : { valid: false, error: "Invalid backup structure: Missing 'data' object." });

  if (!parseResult.valid || !parseResult.manifest) {
    return {
      valid: false,
      can_restore: false,
      critical_errors: [parseResult.error || "Validation failed."],
      warnings: [],
      diffs: {},
      summary: { total_current_records: 0, total_incoming_records: 0, total_added: 0, total_overwritten: 0, total_deleted: 0 },
      sanitized_payload: null,
    };
  }

  const manifest = parseResult.manifest;
  const warnings = [];
  const criticalErrors = [];
  const diffs = {};
  let totalCurrent = 0;
  let totalIncoming = 0;
  let totalAdded = 0;
  let totalOverwritten = 0;
  let totalDeleted = 0;

  const sandboxMemory = new Map();
  Object.entries(manifest.data).forEach(([k, v]) => {
    sandboxMemory.set(k, typeof v === "string" ? v : JSON.stringify(v));
  });

  const sandboxAdapter = {
    getItem: (k) => sandboxMemory.get(k) || null,
    setItem: (k, v) => sandboxMemory.set(k, String(v)),
    removeItem: (k) => sandboxMemory.delete(k),
  };

  const sourceSchemaVersion = manifest.schema_version;
  const requiresMigration = sourceSchemaVersion < TARGET_SCHEMA_VERSION;

  if (requiresMigration && Array.isArray(MIGRATION_REGISTRY)) {
    try {
      for (const mig of MIGRATION_REGISTRY) {
        if (mig.version > sourceSchemaVersion && mig.version <= TARGET_SCHEMA_VERSION) {
          mig.up(sandboxAdapter);
        }
      }
      sandboxAdapter.setItem(SCHEMA_VERSION_KEY, String(TARGET_SCHEMA_VERSION));
    } catch (migErr) {
      criticalErrors.push(`Sandbox schema migration failed (v${sourceSchemaVersion} -> v${TARGET_SCHEMA_VERSION}): ${migErr.message}`);
    }
  }

  Object.entries(KEYS).forEach(([collectionName, storageKey]) => {
    const liveRaw = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
    let liveItems = [];
    try { liveItems = liveRaw ? JSON.parse(liveRaw) : []; } catch { liveItems = []; }
    if (!Array.isArray(liveItems)) liveItems = liveItems ? [liveItems] : [];

    const incomingRaw = sandboxAdapter.getItem(storageKey);
    let incomingItems = [];
    try { incomingItems = incomingRaw ? JSON.parse(incomingRaw) : []; } catch { incomingItems = []; }
    if (!Array.isArray(incomingItems)) incomingItems = incomingItems ? [incomingItems] : [];

    const liveIdSet = new Set(liveItems.map((item) => item?.id).filter(Boolean));
    let added = 0;
    let overwritten = 0;
    const sampleAdded = [];
    const sampleOverwritten = [];

    incomingItems.forEach((item) => {
      if (!item || !item.id) return;
      if (liveIdSet.has(item.id)) {
        overwritten++;
        if (sampleOverwritten.length < 3) sampleOverwritten.push(item.id);
      } else {
        added++;
        if (sampleAdded.length < 3) sampleAdded.push(item.id);
      }
    });

    const deleted = Math.max(0, liveItems.length - overwritten);

    totalCurrent += liveItems.length;
    totalIncoming += incomingItems.length;
    totalAdded += added;
    totalOverwritten += overwritten;
    totalDeleted += deleted;

    diffs[storageKey] = {
      key: storageKey,
      name: collectionName,
      current_count: liveItems.length,
      incoming_count: incomingItems.length,
      added_count: added,
      overwritten_count: overwritten,
      deleted_count: deleted,
      sample_added_ids: sampleAdded,
      sample_overwritten_ids: sampleOverwritten,
    };
  });

  return {
    valid: criticalErrors.length === 0,
    can_restore: criticalErrors.length === 0,
    requires_migration: requiresMigration,
    source_schema_version: sourceSchemaVersion,
    target_schema_version: TARGET_SCHEMA_VERSION,
    clinic_name: manifest.clinic_name,
    export_date: manifest.export_date,
    diffs,
    summary: {
      total_current_records: totalCurrent,
      total_incoming_records: totalIncoming,
      total_added: totalAdded,
      total_overwritten: totalOverwritten,
      total_deleted: totalDeleted,
    },
    warnings,
    critical_errors: criticalErrors,
    sanitized_payload: manifest,
  };
}

export function exportFullDatabase(returnEncryptedString = false) {
  const collectionsData = {};
  const recordCounts = {};

  Object.entries(KEYS).forEach(([collName, storageKey]) => {
    // Exclude runtime session credentials from backup archive
    if (storageKey === KEYS.SESSION) return;
    const val = getCollection(storageKey);
    collectionsData[storageKey] = val;
    recordCounts[collName] = Array.isArray(val) ? val.length : (val ? 1 : 0);
  });

  const payloadToSign = {
    version: "5.2.0",
    format_version: "2.0.0",
    schema_version: TARGET_SCHEMA_VERSION,
    app: "CliniCore Desktop & Web Suite",
    export_date: new Date().toISOString(),
    clinic_name: dbClinic.get()?.name || "H/Dr.Asif Ashraf Khan Clinic",
    manifest: {
      total_collections: Object.keys(collectionsData).length,
      record_counts: recordCounts,
    },
    data: collectionsData,
  };

  const backupJsonToSign = JSON.stringify(payloadToSign);
  const checksum = sha256Sync(backupJsonToSign);

  const backup = {
    ...payloadToSign,
    checksum_sha256: checksum,
  };

  const plainJson = JSON.stringify(backup);
  const encryptedPayload = encryptBackupPayload(plainJson);

  if (typeof document !== "undefined" && !returnEncryptedString) {
    const blob = new Blob([encryptedPayload], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    link.download = `CliniCore_Encrypted_Backup_${dateStr}.cfbak`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return returnEncryptedString ? encryptedPayload : backup;
}

export function importFullDatabase(backupInput, options = { skipCheckpoint: false }) {
  try {
    const dryRun = simulateRestoreDryRun(backupInput);
    if (!dryRun.can_restore || !dryRun.sanitized_payload) {
      return {
        success: false,
        checkpoint_id: null,
        data: null,
        error: dryRun.critical_errors.join(" | ") || "Invalid backup structure: Missing 'data' object.",
      };
    }

    let checkpointId = null;
    if (!options.skipCheckpoint && typeof localStorage !== "undefined") {
      const chkRes = createPreRestoreCheckpoint(`Pre-Restore of backup dated ${dryRun.export_date}`);
      if (chkRes.success) {
        checkpointId = chkRes.checkpointId;
      }
    }

    const sandboxMemory = new Map();
    Object.entries(dryRun.sanitized_payload.data).forEach(([k, v]) => {
      sandboxMemory.set(k, typeof v === "string" ? v : JSON.stringify(v));
    });

    const sandboxAdapter = {
      getItem: (k) => sandboxMemory.get(k) || null,
      setItem: (k, v) => sandboxMemory.set(k, String(v)),
      removeItem: (k) => sandboxMemory.delete(k),
    };

    let migrationsApplied = 0;
    if (dryRun.requires_migration && Array.isArray(MIGRATION_REGISTRY)) {
      try {
        for (const mig of MIGRATION_REGISTRY) {
          if (mig.version > dryRun.source_schema_version && mig.version <= TARGET_SCHEMA_VERSION) {
            mig.up(sandboxAdapter);
            migrationsApplied++;
          }
        }
        sandboxAdapter.setItem(SCHEMA_VERSION_KEY, String(TARGET_SCHEMA_VERSION));
      } catch (migErr) {
        return {
          success: false,
          checkpoint_id: checkpointId,
          data: null,
          error: `Migration failed during restore: ${migErr.message}`,
        };
      }
    }

    _COLLECTION_CACHE.clear();
    _ID_MAP_CACHE.clear();

    sandboxMemory.forEach((val, key) => {
      storageDriver.setItem(key, val);
    });

    storageDriver.setItem(KEYS.SEEDED, "1");
    storageDriver.setItem(SCHEMA_VERSION_KEY, String(TARGET_SCHEMA_VERSION));

    try {
      window.dispatchEvent(new Event("clinicflow_status_update"));
    } catch {}

    // CRITICAL: Transmit full restored backup to VPS MySQL database so relational tables (users, patients, inventory, visits, etc.) get populated on VPS!
    try {
      const API_BASE =
        (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
        (typeof window !== "undefined" && window.location.origin && !window.location.hostname.includes("localhost")
          ? window.location.origin
          : typeof window !== "undefined" && window.location.hostname === "localhost"
          ? "http://127.0.0.1:5000"
          : "https://clinicore.me");

      const collectionsSnapshot = getAllCollectionsSnapshot();
      fetch(`${API_BASE}/api/v1/system/restore-backup-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collections: collectionsSnapshot,
          metadata: { restored_at: new Date().toISOString(), source: "ui_backup_upload" }
        })
      }).then(async (res) => {
        if (res.ok) {
          console.log("[Restore Cloud Sync] Successfully restored database to VPS MySQL!");
        } else {
          console.warn("[Restore Cloud Sync] VPS restore response:", res.status);
        }
      }).catch((err) => {
        console.warn("[Restore Cloud Sync] Failed to post backup to VPS:", err);
      });
    } catch (syncErr) {
      console.warn("[Restore Sync] Failed to post backup state:", syncErr);
    }

    return {
      success: true,
      checkpoint_id: checkpointId,
      migrations_applied: migrationsApplied,
      data: dryRun.sanitized_payload,
      error: null,
    };
  } catch (err) {
    return { success: false, checkpoint_id: null, data: null, error: err.message || "Failed to restore backup." };
  }
}

export const safeRestoreDatabase = importFullDatabase;

export const dbBackupEngine = {
  createBackup: (options = { returnEncrypted: false }) => exportFullDatabase(options.returnEncrypted),
  verifyIntegrity: (backupPayload) => {
    const res = parseAndValidateBackupString(backupPayload);
    return { isValid: res.valid, error: res.error, manifest: res.manifest };
  },
  simulateDryRun: (backupPayload) => simulateRestoreDryRun(backupPayload),
  restoreBackup: (backupPayload, options) => safeRestoreDatabase(backupPayload, options),
  createCheckpoint: (reason) => createPreRestoreCheckpoint(reason),
  rollback: (checkpointId) => rollbackLastRestore(checkpointId),
};

/**
 * Returns a complete key-value dictionary of all collections for VPS MySQL cloud sync
 */
export function getAllCollectionsSnapshot() {
  const snapshot = {};
  Object.entries(KEYS).forEach(([_, storageKey]) => {
    snapshot[storageKey] = getCollection(storageKey);
  });
  return snapshot;
}

/**
 * Hydrates local memory cache & localStorage from authoritative VPS MySQL snapshot
 */
export function hydrateCollectionsFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  _COLLECTION_CACHE.clear();
  _ID_MAP_CACHE.clear();

  Object.entries(snapshot).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      const parsed = typeof val === "string" ? (() => { try { return JSON.parse(val); } catch { return val; } })() : val;
      const raw = typeof val === "string" ? val : JSON.stringify(val);
      _COLLECTION_CACHE.set(key, { raw, parsed });
      if (Array.isArray(parsed)) {
        const idMap = new Map();
        for (const item of parsed) {
          if (item && item.id) idMap.set(item.id, item);
        }
        _ID_MAP_CACHE.set(key, idMap);
      }
      if (typeof localStorage !== "undefined") {
        try {
          storageDriver.setItem(key, raw);
        } catch {}
      }
    }
  });

  try {
    if (_syncChannel) {
      _syncChannel.postMessage({ type: "HYDRATE_ALL", timestamp: Date.now() });
    }
    window.dispatchEvent(new Event("clinicflow_status_update"));
    window.dispatchEvent(new Event("clinicflow_data_synced"));
  } catch {}
}

// ---------- Software License & Subscription Governance Engine ----------
export const dbLicense = {
  get: () => {
    try {
      const raw = storageDriver.getItem(KEYS.LICENSE);
      if (!raw) {
        const initialDevId = getDeviceId();
        const defaultPolicy = {
          license_status: "active",
          monthly_fee: 5000,
          currency: "PKR",
          due_day: 1,
          warning_days_before: 5,
          grace_days: 10,
          hardware_lock_enabled: true,
          authorized_machine_id: initialDevId,
          last_paid_date: new Date().toISOString().split("T")[0],
          next_due_date: (() => {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            return d.toISOString().split("T")[0];
          })(),
          is_hard_locked: false,
          restricted_features: [],
          developer_phone: "03142291356",
          developer_whatsapp: "03142291356",
          developer_bank_details: "JazzCash / EasyPaisa / Bank Transfer: 03142291356 (K.B Software)",
          custom_notice: "",
        };
        try {
          storageDriver.setItem(KEYS.LICENSE, JSON.stringify(defaultPolicy));
        } catch {}
        return defaultPolicy;
      }
      const parsed = JSON.parse(raw);
      // If hardware lock is enabled but not bound yet, automatically lock to the first installing machine
      if (parsed.hardware_lock_enabled !== false && !parsed.authorized_machine_id) {
        parsed.hardware_lock_enabled = true;
        parsed.authorized_machine_id = getDeviceId();
        try {
          storageDriver.setItem(KEYS.LICENSE, JSON.stringify(parsed));
        } catch {}
      }
      return parsed;
    } catch {
      return { license_status: "active", restricted_features: [], hardware_lock_enabled: true };
    }
  },

  update: (updates) => {
    const current = dbLicense.get();
    const merged = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    storageDriver.setItem(KEYS.LICENSE, JSON.stringify(merged));
    try {
      window.dispatchEvent(new CustomEvent("clinicflow_license_update", { detail: merged }));
      window.dispatchEvent(new Event("clinicflow_status_update"));
    } catch {}
    if (typeof _collectionChangeHook === "function") {
      try {
        _collectionChangeHook(KEYS.LICENSE, merged);
      } catch {}
    }
    return merged;
  },

  /**
   * Computes dynamic runtime status:
   */
  evaluateStatus: () => {
    const lic = dbLicense.get();
    const currentDevId = getDeviceId();

    // 0. HARDWARE ANTI-COPY & MACHINE LOCK GUARD
    if (lic.hardware_lock_enabled && lic.authorized_machine_id) {
      if (lic.authorized_machine_id !== currentDevId) {
        return {
          status: "locked",
          isLocked: true,
          isWarning: false,
          isGrace: false,
          daysLeft: 0,
          daysOverdue: 1,
          message: "🚫 UNAUTHORIZED MACHINE DETECTED: This software license is cryptographically bound to a specific authorized PC/Laptop hardware. Copying or running on another computer is strictly prohibited. Please contact K.B Software (03142291356) for machine re-authorization.",
          isFeatureBlocked: () => true,
        };
      }
    }

    if (lic.is_hard_locked || lic.license_status === "locked") {
      return {
        status: "locked",
        isLocked: true,
        isWarning: false,
        isGrace: false,
        daysLeft: 0,
        daysOverdue: 1,
        message: lic.custom_notice || "Software access is temporarily suspended. Please contact K.B Software to renew your monthly license.",
        isFeatureBlocked: () => true,
      };
    }

    if (lic.license_status === "restricted") {
      return {
        status: "restricted",
        isLocked: false,
        isWarning: true,
        isGrace: true,
        daysLeft: 0,
        daysOverdue: 1,
        restrictedFeatures: lic.restricted_features || [],
        message: lic.custom_notice || "Selected software features have been restricted by the developer due to pending monthly subscription.",
        isFeatureBlocked: (featureKey) => (lic.restricted_features || []).includes(featureKey),
      };
    }

    const today = new Date();
    const dueDate = lic.next_due_date ? new Date(lic.next_due_date + "T00:00:00") : new Date();
    const diffMs = dueDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const graceDays = Number(lic.grace_days) || 10;

    // 1. Explicit Warning Mode (Developer manually activated Warning or scheduled)
    if (lic.license_status === "warning") {
      return {
        status: "warning",
        isLocked: false,
        isWarning: true,
        isGrace: false,
        daysLeft: Math.max(0, daysLeft),
        daysOverdue: 0,
        message: lic.custom_notice || `Monthly Software License is due in ${daysLeft <= 0 ? "today" : `${daysLeft} days`} (${lic.next_due_date || "End of Month"}). Please clear payment of Rs. ${Number(lic.monthly_fee || 5000).toLocaleString("en-US")}.`,
        isFeatureBlocked: (featureKey) => (lic.restricted_features || []).includes(featureKey),
      };
    }

    // 2. Explicit Grace Period Mode
    if (lic.license_status === "grace_period") {
      const daysOverdue = daysLeft < 0 ? Math.abs(daysLeft) : 1;
      return {
        status: "grace_period",
        isLocked: false,
        isWarning: true,
        isGrace: true,
        daysLeft: 0,
        daysOverdue,
        message: lic.custom_notice || `Monthly Subscription payment is overdue (${daysOverdue} days). Grace period active till ${graceDays} days. System is running normally.`,
        isFeatureBlocked: (featureKey) => (lic.restricted_features || []).includes(featureKey),
      };
    }

    // 3. If past due date without manual override (overdue)
    if (daysLeft < 0) {
      const daysOverdue = Math.abs(daysLeft);
      return {
        status: "grace_period",
        isLocked: false,
        isWarning: true,
        isGrace: true,
        daysLeft: 0,
        daysOverdue,
        message: lic.custom_notice || `Monthly Subscription payment is overdue (${daysOverdue} days). Grace period active till ${graceDays} days. System is running normally.`,
        isFeatureBlocked: (featureKey) => (lic.restricted_features || []).includes(featureKey),
      };
    }

    // 4. Normal Active state (Full Access, no warning notices)
    return {
      status: "active",
      isLocked: false,
      isWarning: false,
      isGrace: false,
      daysLeft,
      daysOverdue: 0,
      message: "",
      isFeatureBlocked: (featureKey) => (lic.restricted_features || []).includes(featureKey),
    };
  }
};

// ---------- Unique Device Fingerprint Engine ----------
export function getDeviceId() {
  try {
    if (typeof localStorage !== "undefined") {
      let devId = storageDriver.getItem("cf_device_fingerprint");
      if (!devId) {
        devId = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
        storageDriver.setItem("cf_device_fingerprint", devId);
      }
      return devId;
    }
  } catch {}
  return "dev_unknown";
}

// ---------- Offline PWA Outbox Sync Engine ----------
export const dbOutbox = {
  getAll: () => getCollection(KEYS.OUTBOX) || [],

  enqueue: (actionTypeOrEntity, payload, operation = "UPDATE", entityId = "") => {
    const list = getCollection(KEYS.OUTBOX) || [];
    const mutId = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const entityName = actionTypeOrEntity.toLowerCase().replace(/^cf_/, "").replace(/_v\d+$/, "");

    const item = {
      mutation_id: mutId,
      id: mutId, // Backwards compatibility
      entity: entityName,
      entity_id: entityId || payload?.id || "",
      operation: operation.toUpperCase(),
      action_type: actionTypeOrEntity, // Backwards compatibility
      payload,
      status: "pending", // "pending" | "sending" | "confirmed" | "failed" | "conflict" | "dead_letter"
      created_at: new Date().toISOString(),
      device_id: getDeviceId(),
      user_id: payload?.user_id || payload?.actor_id || "system",
      retry_count: 0,
      last_error: null,
      server_version: null,
    };

    setCollection(KEYS.OUTBOX, [item, ...list]);
    try {
      window.dispatchEvent(new CustomEvent("clinicflow_outbox_change", { detail: item }));
    } catch {}
    return item;
  },

  markSynced: (id) => {
    const list = getCollection(KEYS.OUTBOX) || [];
    const filtered = list.filter((item) => (item.mutation_id !== id && item.id !== id));
    setCollection(KEYS.OUTBOX, filtered);
    try {
      window.dispatchEvent(new CustomEvent("clinicflow_outbox_change"));
    } catch {}
  },

  clearAll: () => {
    setCollection(KEYS.OUTBOX, []);
    try {
      window.dispatchEvent(new CustomEvent("clinicflow_outbox_change"));
    } catch {}
  }
};

function computeAuditHash(prevHash, payload) {
  const content = (prevHash || "GENESIS_CLINICFLOW_2026") + "::" + JSON.stringify(payload);
  return sha256Sync(content);
}

export const dbAuditLogs = {
  getAll: () => {
    return getCollection(KEYS.AUDIT_LOGS) || [];
  },

  getById: (id) => {
    return getFromCollectionById(KEYS.AUDIT_LOGS, id);
  },

  getByEntity: (entity, entityId = null) => {
    const all = dbAuditLogs.getAll();
    return all.filter((l) => {
      if (l.entity !== entity) return false;
      if (entityId && l.entity_id !== entityId) return false;
      return true;
    });
  },

  getByActor: (actorId) => {
    const all = dbAuditLogs.getAll();
    return all.filter((l) => l.actor_id === actorId);
  },

  getByDateRange: (startDateStr, endDateStr) => {
    const all = dbAuditLogs.getAll();
    const start = new Date(startDateStr).getTime();
    const end = new Date(endDateStr).getTime() + (24 * 60 * 60 * 1000 - 1);
    return all.filter((l) => {
      const t = new Date(l.timestamp).getTime();
      return t >= start && t <= end;
    });
  },

  search: (query) => {
    if (!query || !query.trim()) return dbAuditLogs.getAll();
    const q = query.toLowerCase().trim();
    return dbAuditLogs.getAll().filter((l) =>
      (l.action || "").toLowerCase().includes(q) ||
      (l.actor_name || "").toLowerCase().includes(q) ||
      (l.reason || "").toLowerCase().includes(q) ||
      (l.entity || "").toLowerCase().includes(q) ||
      (l.entity_id || "").toLowerCase().includes(q)
    );
  },

  logEvent: ({
    actor_id = null,
    actor_name = null,
    role = null,
    action = "UNKNOWN_ACTION",
    entity = "general",
    entity_id = "",
    before = null,
    after = null,
    reason = "Operational update",
    session_token = "",
  }) => {
    let finalActorId = actor_id;
    let finalActorName = actor_name;
    let finalRole = role;
    let finalSessionToken = session_token;

    if (!finalActorId && typeof sessionStorage !== "undefined") {
      try {
        const rawSess = sessionStorage.getItem("cf_session") || storageDriver.getItem("cf_session");
        if (rawSess) {
          const sess = JSON.parse(rawSess);
          finalActorId = sess.userId || "system";
          finalActorName = sess.name || "System Automated";
          finalRole = sess.role || "system";
          finalSessionToken = sess.sessionToken || "";
        }
      } catch {}
    }

    const existingLogs = getCollection(KEYS.AUDIT_LOGS) || [];
    const lastEntry = existingLogs.length > 0 ? existingLogs[0] : null;
    const prevHash = lastEntry ? (lastEntry.hash || "GENESIS_CLINICFLOW_2026") : "GENESIS_CLINICFLOW_2026";

    const timestamp = new Date().toISOString();
    const id = "aud_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const device_id = getDeviceId();

    const payloadForHashing = {
      id,
      actor_id: finalActorId || "user_system",
      actor_name: finalActorName || "System Staff",
      role: finalRole || "system",
      action: String(action || "UNKNOWN_ACTION").toUpperCase(),
      entity: String(entity || "general").toLowerCase(),
      entity_id: String(entity_id || ""),
      timestamp,
      before: before ? JSON.parse(JSON.stringify(before)) : null,
      after: after ? JSON.parse(JSON.stringify(after)) : null,
      reason: String(reason || "Operational update").trim(),
      device_id,
      session_token: finalSessionToken || "",
    };

    const currentHash = computeAuditHash(prevHash, payloadForHashing);

    const eventRecord = {
      ...payloadForHashing,
      prev_hash: prevHash,
      hash: currentHash,
    };

    setCollection(KEYS.AUDIT_LOGS, [eventRecord, ...existingLogs]);

    if (typeof dbOutbox !== "undefined" && dbOutbox.enqueue) {
      dbOutbox.enqueue("AUDIT_LOG", eventRecord);
    }

    return eventRecord;
  },

  verifyChainIntegrity: () => {
    const logs = getCollection(KEYS.AUDIT_LOGS) || [];
    if (logs.length === 0) return { intact: true, totalEvents: 0, corruptedIndex: -1 };

    let expectedPrevHash = "GENESIS_CLINICFLOW_2026";
    for (let i = logs.length - 1; i >= 0; i--) {
      const entry = logs[i];
      if (entry.prev_hash !== expectedPrevHash) {
        return {
          intact: false,
          totalEvents: logs.length,
          corruptedIndex: i,
          corruptedEventId: entry.id,
          reason: `Broken chain link at event ${entry.id}. Expected prev_hash ${expectedPrevHash}, found ${entry.prev_hash}`
        };
      }

      const { prev_hash, hash, ...payload } = entry;
      const recomputed = computeAuditHash(prev_hash, payload);
      if (recomputed !== hash) {
        return {
          intact: false,
          totalEvents: logs.length,
          corruptedIndex: i,
          corruptedEventId: entry.id,
          reason: `Hash mismatch at event ${entry.id}. Record payload has been tampered with.`
        };
      }
      expectedPrevHash = hash;
    }

    return { intact: true, totalEvents: logs.length, corruptedIndex: -1 };
  },

  exportCSV: (customList = null, filename = "ClinicFlow_Audit_Trail.csv") => {
    const list = customList || dbAuditLogs.getAll();
    let csv = "Timestamp,Log ID,Actor Name,Role,Action,Entity,Entity ID,Reason,Device ID,Hash\n";
    list.forEach((l) => {
      const ts = `"${l.timestamp}"`;
      const id = `"${l.id}"`;
      const actor = `"${(l.actor_name || '').replace(/"/g, '""')}"`;
      const role = `"${l.role || ''}"`;
      const act = `"${l.action || ''}"`;
      const ent = `"${l.entity || ''}"`;
      const entId = `"${(l.entity_id || '').replace(/"/g, '""')}"`;
      const rsn = `"${(l.reason || '').replace(/"/g, '""')}"`;
      const dev = `"${l.device_id || ''}"`;
      const h = `"${l.hash || ''}"`;
      csv += `${ts},${id},${actor},${role},${act},${ent},${entId},${rsn},${dev},${h}\n`;
    });

    if (typeof document !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return csv;
  }
};

// ============================================================================
// 25. UNIFIED ENTERPRISE REPORTING & BUSINESS ANALYTICS ENGINE (dbReports)
// ============================================================================
/**
 * Auto-Capitalizes text into clean Title Case (e.g., "by hand" -> "By Hand")
 */
export function toTitleCase(str) {
  if (!str || typeof str !== "string") return "";
  const cleaned = str.trim();
  if (!cleaned) return "";
  const upperAcronyms = ["TCS", "B2B", "GRN", "VIP", "POS", "HBL", "MCB", "UBL", "ABL", "BOP", "NBP", "JS", "NRSP", "KMBL"];
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (!word) return "";
      const upper = word.toUpperCase();
      if (upperAcronyms.includes(upper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export const dbReports = {
  /**
   * Helper: Filter records across multiple dimensions (Date Range, Warehouse, Doctor, Cashier, Payment Mode)
   */
  filterByScope: (records = [], dateField = "date", filters = {}) => {
    const { startDate, endDate, warehouseId, doctorId, cashierId, paymentMode, companyName } = filters;
    return (records || []).filter((item) => {
      if (!item) return false;
      const d = (item[dateField] || item.created_at || item.sale_date || item.purchase_date || item.visit_date || "").split("T")[0];
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;

      if (warehouseId && warehouseId !== "all") {
        const wh = item.warehouse_id || item.destination_id || item.destination_warehouse_id;
        if (wh && wh !== warehouseId) return false;
      }

      if (doctorId && item.doctor_id && item.doctor_id !== doctorId) return false;
      if (cashierId && item.cashier_id && item.cashier_id !== cashierId) return false;
      if (companyName && item.company_name && !item.company_name.toLowerCase().includes(companyName.toLowerCase())) return false;

      if (paymentMode && paymentMode !== "all") {
        const mode = (item.payment_mode || item.payment_type || (item.balance_due > 0 ? "credit" : "cash")).toLowerCase();
        if (mode !== paymentMode.toLowerCase()) return false;
      }

      return true;
    });
  },

  /**
   * 1. Executive Business Health & Financial Summary (P&L, COGS, Revenue, Margins)
   */
  getExecutiveFinancialSummary: (filters = {}) => {
    const rawSales = dbSales.getAll() || [];
    const rawB2B = dbB2BSales.getAll() || [];
    const rawPurchases = dbPurchases.getAll() || [];
    const rawVisits = dbVisits.getAll() || [];
    const rawExpenses = dbExpenses.getAll() || [];
    const rawReturns = dbReturns.getAll() || [];

    const activeSales = dbReports.filterByScope(rawSales, "sale_date", filters).filter((s) => !s.is_voided);
    const activeB2B = dbReports.filterByScope(rawB2B, "sale_date", filters).filter((b) => !b.is_voided);
    const activePurchases = dbReports.filterByScope(rawPurchases, "purchase_date", filters);
    const activeVisits = dbReports.filterByScope(rawVisits, "visit_date", filters);
    const activeExpenses = dbReports.filterByScope(rawExpenses, "date", filters);
    const activeReturns = dbReports.filterByScope(rawReturns, "return_date", filters);

    // Revenue streams
    const posGrossSales = activeSales.reduce((sum, s) => safeAdd(sum, s.total_amount || 0), 0);
    const posCashCollected = activeSales.reduce((sum, s) => safeAdd(sum, s.paid_amount || 0), 0);
    const posCreditReceivable = activeSales.reduce((sum, s) => safeAdd(sum, safeSub(s.total_amount || 0, s.paid_amount || 0)), 0);

    const b2bGrossSales = activeB2B.reduce((sum, b) => safeAdd(sum, b.total_amount || 0), 0);
    const b2bCashCollected = activeB2B.reduce((sum, b) => safeAdd(sum, b.paid_amount || 0), 0);
    const b2bCreditReceivable = activeB2B.reduce((sum, b) => safeAdd(sum, b.balance_amount || safeSub(b.total_amount || 0, b.paid_amount || 0)), 0);

    const totalPharmacyRevenue = safeAdd(posGrossSales, b2bGrossSales);

    // OPD Collections & Doctor breakdown
    let opdFeeCollected = 0;
    let waivedVisitsCount = 0;
    const doctorRevenueMap = {};

    activeVisits.forEach((v) => {
      const fee = Number(v.fee_amount) || 0;
      const isPaid = v.fee_status === "paid" || (!v.fee_status && fee > 0);
      if (isPaid) {
        opdFeeCollected = safeAdd(opdFeeCollected, fee);
        const docId = v.doctor_id || "doc_unassigned";
        const docName = v.doctor_name || "Doctor";
        if (!doctorRevenueMap[docId]) {
          doctorRevenueMap[docId] = { doctor_id: docId, doctor_name: docName, visits_count: 0, revenue: 0 };
        }
        doctorRevenueMap[docId].visits_count += 1;
        doctorRevenueMap[docId].revenue = safeAdd(doctorRevenueMap[docId].revenue, fee);
      } else {
        waivedVisitsCount += 1;
      }
    });

    const totalGrossRevenue = safeAdd(totalPharmacyRevenue, opdFeeCollected);

    // Cost of Goods Sold (COGS) calculation from itemized sales lines
    let posCOGS = 0;
    activeSales.forEach((s) => {
      (s.items || []).forEach((it) => {
        const cost = Number(it.unit_cost || it.cost_price || 0);
        const qty = Number(it.qty || it.quantity || 0);
        posCOGS = safeAdd(posCOGS, safeMul(cost, qty));
      });
    });

    let b2bCOGS = 0;
    activeB2B.forEach((b) => {
      (b.items || []).forEach((it) => {
        const cost = Number(it.cost_price || it.unit_cost || 0);
        const qty = Number(it.qty || it.quantity || 0);
        b2bCOGS = safeAdd(b2bCOGS, safeMul(cost, qty));
      });
    });

    const totalCOGS = safeAdd(posCOGS, b2bCOGS);
    const grossProfit = safeSub(totalGrossRevenue, totalCOGS);
    const grossMarginPct = totalGrossRevenue > 0 ? safeNum(safeMul(safeDiv(grossProfit, totalGrossRevenue), 100)) : 0;

    // Expenses & Outflows
    const totalExpenses = activeExpenses.reduce((sum, e) => safeAdd(sum, e.amount || 0), 0);
    const totalReturnsRefunded = activeReturns.reduce((sum, r) => safeAdd(sum, r.refund_amount || r.total_amount || 0), 0);
    const totalPurchasesGRN = activePurchases.reduce((sum, p) => safeAdd(sum, p.total_amount || 0), 0);
    const supplierPurchasesPaid = activePurchases.reduce((sum, p) => safeAdd(sum, p.paid_amount || 0), 0);

    const netOperatingProfit = safeSub(grossProfit, safeAdd(totalExpenses, totalReturnsRefunded));

    // Outstanding Ledgers
    const patientOutstanding = (dbPatientLedger.getAll() || []).reduce((sum, p) => safeAdd(sum, Math.max(0, p.balance_due || 0)), 0);
    const supplierPayables = (dbSuppliers.getAll() || []).reduce((sum, s) => safeAdd(sum, Math.max(0, s.current_balance || s.balance_due || 0)), 0);
    const partyReceivables = (dbParties.getAll() || []).reduce((sum, p) => safeAdd(sum, Math.max(0, p.current_balance || p.balance_due || 0)), 0);

    return {
      date_range: { startDate: filters.startDate || "all", endDate: filters.endDate || "all" },
      pos_gross_sales: posGrossSales,
      pos_cash_collected: posCashCollected,
      pos_credit_receivable: posCreditReceivable,
      b2b_gross_sales: b2bGrossSales,
      b2b_cash_collected: b2bCashCollected,
      b2b_credit_receivable: b2bCreditReceivable,
      pharmacy_revenue: totalPharmacyRevenue,
      opd_fee_collected: opdFeeCollected,
      waived_visits_count: waivedVisitsCount,
      doctor_revenue: Object.values(doctorRevenueMap),
      total_gross_revenue: totalGrossRevenue,
      cogs: { pos: posCOGS, b2b: b2bCOGS, total: totalCOGS },
      gross_profit: grossProfit,
      gross_margin_pct: grossMarginPct,
      operating_expenses: totalExpenses,
      returns_refunded: totalReturnsRefunded,
      purchases_grn_total: totalPurchasesGRN,
      supplier_purchases_paid: supplierPurchasesPaid,
      net_operating_profit: netOperatingProfit,
      patient_outstanding: patientOutstanding,
      supplier_payables: supplierPayables,
      party_receivables: partyReceivables,
    };
  },

  /**
   * 2. Comprehensive Day Closing & Cashbook (Z-Report)
   */
  getDayClosingSummary: (dateStr = new Date().toISOString().split("T")[0], openingCash = 0) => {
    const filters = { startDate: dateStr, endDate: dateStr };
    const fin = dbReports.getExecutiveFinancialSummary(filters);

    const cashInflow = safeAdd(safeAdd(openingCash, fin.pos_cash_collected), safeAdd(fin.b2b_cash_collected, fin.opd_fee_collected));
    const cashOutflow = safeAdd(safeAdd(fin.supplier_purchases_paid, fin.operating_expenses), fin.returns_refunded);
    const expectedDrawerCash = safeSub(cashInflow, cashOutflow);

    return {
      date: dateStr,
      opening_cash: openingCash,
      inflows: {
        pos_cash_sales: fin.pos_cash_collected,
        b2b_cash_sales: fin.b2b_cash_collected,
        opd_consultation_fees: fin.opd_fee_collected,
        total_inflow: cashInflow,
      },
      outflows: {
        supplier_cash_payments: fin.supplier_purchases_paid,
        operating_expenses: fin.operating_expenses,
        sales_refunds: fin.returns_refunded,
        total_outflow: cashOutflow,
      },
      expected_drawer_cash: expectedDrawerCash,
      reconciliation: {
        is_locked: isPeriodClosed(dateStr),
        gross_sales: safeAdd(fin.pos_gross_sales, fin.b2b_gross_sales),
        opd_fees: fin.opd_fee_collected,
      },
    };
  },

  /**
   * 3. Inventory & Stock Movement Analytics (Valuation, Expiry, Dead Stock, Velocity)
   */
  getInventoryAnalytics: (filters = {}) => {
    const invList = dbInventory.getAll() || [];
    const movements = dbStockMovements.getAll() || [];
    const warehouses = dbWarehouses.getAll() || [];

    // Multi-Warehouse Valuation
    const warehouseValuations = {};
    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let totalUnits = 0;

    const targetWhId = filters.warehouseId && filters.warehouseId !== "all" ? filters.warehouseId : null;

    invList.forEach((item) => {
      const cost = Number(item.cost_price_per_box || item.cost_price || 0);
      const retail = Number(item.unit_sale_price || item.box_sale_price || item.unit_price || 0);

      // Store Counter Stock
      const storeQty = Number(item.store_stock ?? (item.location_quantities?.wh_str || 0));
      if (!warehouseValuations["wh_str"]) {
        warehouseValuations["wh_str"] = { id: "wh_str", name: "Medical Store Counter", units: 0, cost_value: 0, retail_value: 0 };
      }
      warehouseValuations["wh_str"].units += storeQty;
      warehouseValuations["wh_str"].cost_value = safeAdd(warehouseValuations["wh_str"].cost_value, safeMul(storeQty, cost));
      warehouseValuations["wh_str"].retail_value = safeAdd(warehouseValuations["wh_str"].retail_value, safeMul(storeQty, retail));

      // Godowns Stock
      warehouses.forEach((w) => {
        const locQty = Number(item.location_quantities?.[w.id] || (w.id === "wh_001" ? item.warehouse_stock || 0 : 0));
        if (!warehouseValuations[w.id]) {
          warehouseValuations[w.id] = { id: w.id, name: w.name || w.code, units: 0, cost_value: 0, retail_value: 0 };
        }
        warehouseValuations[w.id].units += locQty;
        warehouseValuations[w.id].cost_value = safeAdd(warehouseValuations[w.id].cost_value, safeMul(locQty, cost));
        warehouseValuations[w.id].retail_value = safeAdd(warehouseValuations[w.id].retail_value, safeMul(locQty, retail));
      });

      const itemTotalUnits = targetWhId
        ? (targetWhId === "wh_str" ? storeQty : Number(item.location_quantities?.[targetWhId] || 0))
        : Number(item.total_base_stock ?? item.stock_qty ?? safeAdd(storeQty, Number(item.warehouse_stock || 0)));

      totalUnits += itemTotalUnits;
      totalCostValuation = safeAdd(totalCostValuation, safeMul(itemTotalUnits, cost));
      totalRetailValuation = safeAdd(totalRetailValuation, safeMul(itemTotalUnits, retail));
    });

    // Stock Health: Low stock (< 6) & Out of stock
    const lowStockItems = [];
    const outOfStockItems = [];
    invList.forEach((item) => {
      const q = Number(item.total_base_stock ?? item.stock_qty ?? 0);
      if (q <= 0) outOfStockItems.push(item);
      else if (q <= (item.min_reorder_level || 6)) lowStockItems.push(item);
    });

    // Expiry Analysis
    const expiryReport = dbMedicineBatches.getExpiringBatches(90, targetWhId);
    const expiredBatches = expiryReport.filter((b) => b.is_expired || b.alert_level === "EXPIRED");
    const nearExpiryBatches = expiryReport.filter((b) => !b.is_expired && b.alert_level !== "EXPIRED");

    // Movement Velocity & Dead Stock (>90 days 0 OUT movements)
    const nowMs = Date.now();
    const ninetyDaysAgo = new Date(nowMs - 90 * 86400000).toISOString();
    const outMovementByItem = {};

    movements.forEach((m) => {
      if (m.direction === "OUT" && (!m.created_at || m.created_at >= ninetyDaysAgo)) {
        outMovementByItem[m.inventory_id] = (outMovementByItem[m.inventory_id] || 0) + Number(m.qty_base_units || 0);
      }
    });

    const deadStockItems = [];
    const velocityRanked = [];

    invList.forEach((item) => {
      const currentQty = Number(item.total_base_stock ?? item.stock_qty ?? 0);
      const totalOut = outMovementByItem[item.id] || 0;

      if (currentQty > 0 && totalOut === 0) {
        deadStockItems.push(item);
      }

      velocityRanked.push({
        id: item.id,
        name: item.medicine_name,
        company: item.company_name,
        current_stock: currentQty,
        total_out_qty: totalOut,
      });
    });

    velocityRanked.sort((a, b) => b.total_out_qty - a.total_out_qty);
    const fastMoving = velocityRanked.slice(0, 10);
    const slowMoving = velocityRanked.filter((i) => i.current_stock > 0 && i.total_out_qty <= 5);

    // Stock Transfers analytics
    const rawTransfers = dbStockTransfers.getAll() || [];
    const inTransitTransfers = rawTransfers.filter((t) => t.status === "in_transit");
    const receivedTransfers = rawTransfers.filter((t) => t.status === "received");
    const totalBreakageUnits = receivedTransfers.reduce((sum, t) => sum + (Number(t.damaged_count) || 0), 0);

    return {
      total_units: totalUnits,
      total_cost_valuation: totalCostValuation,
      total_retail_valuation: totalRetailValuation,
      unrealized_gross_margin: safeSub(totalRetailValuation, totalCostValuation),
      warehouses_breakdown: Object.values(warehouseValuations),
      stock_health: {
        low_stock_count: lowStockItems.length,
        out_of_stock_count: outOfStockItems.length,
        dead_stock_count: deadStockItems.length,
        expired_batches_count: expiredBatches.length,
        near_expiry_batches_count: nearExpiryBatches.length,
      },
      velocity: {
        fast_moving: fastMoving,
        slow_moving: slowMoving,
      },
      transfers: {
        in_transit_count: inTransitTransfers.length,
        received_count: receivedTransfers.length,
        total_breakage_units: totalBreakageUnits,
      },
    };
  },

  /**
   * 4. Clinical & Doctor Performance Analytics
   */
  getClinicalAnalytics: (filters = {}) => {
    const rawVisits = dbVisits.getAll() || [];
    const visits = dbReports.filterByScope(rawVisits, "visit_date", filters);
    const patients = dbPatients.getAll() || [];

    const totalVisits = visits.length;
    const completedCount = visits.filter((v) => v.status === "completed").length;
    const waitingCount = visits.filter((v) => v.status === "waiting").length;
    const inConsultationCount = visits.filter((v) => v.status === "in_consultation").length;
    const reportsPendingCount = visits.filter((v) => v.status === "completed_reports_pending").length;
    const skippedCount = visits.filter((v) => v.status === "skipped" || v.status === "skipped_reissued").length;

    // Patient frequency (New vs Returning)
    const patientVisitsMap = {};
    rawVisits.forEach((v) => {
      patientVisitsMap[v.patient_id] = (patientVisitsMap[v.patient_id] || 0) + 1;
    });

    let newPatientsCount = 0;
    let returningPatientsCount = 0;

    visits.forEach((v) => {
      const priorCount = patientVisitsMap[v.patient_id] || 1;
      if (priorCount <= 1) newPatientsCount += 1;
      else returningPatientsCount += 1;
    });

    const newPatientRatio = totalVisits > 0 ? safeNum(safeMul(safeDiv(newPatientsCount, totalVisits), 100)) : 0;
    const repeatPatientRatio = totalVisits > 0 ? safeNum(safeMul(safeDiv(returningPatientsCount, totalVisits), 100)) : 0;

    return {
      total_visits: totalVisits,
      status_distribution: {
        completed: completedCount,
        waiting: waitingCount,
        in_consultation: inConsultationCount,
        reports_pending: reportsPendingCount,
        skipped: skippedCount,
      },
      patient_demographics: {
        total_patients_registered: patients.length,
        new_patients_in_period: newPatientsCount,
        returning_patients_in_period: returningPatientsCount,
        new_patient_ratio: newPatientRatio,
        repeat_patient_ratio: repeatPatientRatio,
      },
    };
  },
};

/**
 * Granular & Full Database Purge & Master Reset Management
 */
export const dbDatabaseManagement = {
  purgeEntity: (entityKey) => {
    if (KEYS[entityKey]) {
      setCollection(KEYS[entityKey], []);
      storageDriver.setItem(KEYS[entityKey], JSON.stringify([]));
      window.dispatchEvent(new Event("clinicflow_status_update"));
      window.dispatchEvent(new Event("storage"));
      return true;
    }
    return false;
  },

  resetDatabase: (categories = ["patients", "sales", "purchases", "expenses"]) => {
    const keyMap = {
      patients: [KEYS.PATIENTS, KEYS.VISITS, KEYS.PATIENT_LEDGER],
      sales: [KEYS.SALES, KEYS.B2B_SALES, KEYS.SHIFT_CLOSINGS],
      purchases: [KEYS.PURCHASES, KEYS.SUPPLIER_LEDGER, KEYS.STOCK_MOVEMENTS, KEYS.STOCK_TRANSFERS],
      expenses: [KEYS.EXPENSES, KEYS.CASHBOOK],
    };

    categories.forEach((cat) => {
      const keysToClear = keyMap[cat];
      if (keysToClear) {
        keysToClear.forEach((k) => {
          setCollection(k, []);
          storageDriver.setItem(k, JSON.stringify([]));
        });
      }
    });

    window.dispatchEvent(new Event("clinicflow_status_update"));
    window.dispatchEvent(new Event("storage"));
    return true;
  },
};

/**
 * Bulk Import & Export Helper Suite with Automatic Deduplication
 */
export function exportSuppliersTemplateCSV() {
  const csv = "Company Name,Supplier Code,Phone,City,Address,Current Balance\n\"BM Pvt LTD\",\"BM\",\"03001234567\",\"Hyderabad\",\"Lajpat Road\",0\n\"GHR Homoepathic\",\"GHR\",\"03007654321\",\"Karachi\",\"Market Road\",0\n";
  downloadCSV("Suppliers_Companies_Template.csv", csv);
}

export function exportPartiesTemplateCSV() {
  const csv = "Party Name,Party Code,Phone,City,Address,Salesman,Current Balance\n\"Muslim Medical Store\",\"PTY-001\",\"03009988776\",\"Hyderabad\",\"Station Road\",\"Usama\",0\n\"Asus Pharmacy\",\"PTY-002\",\"03005544332\",\"Interior Sindh\",\"Main Bazaar\",\"Mustafa\",0\n";
  downloadCSV("Wholesale_Parties_Template.csv", csv);
}

export function exportInventoryGodownsTemplateCSV() {
  exportInventoryTemplateCSV();
}

export function bulkImportSuppliers(csvText) {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return { count: 0, updated: 0, added: 0 };

  const currentSuppliers = dbSuppliers.getAll() || [];
  let added = 0;
  let updated = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((cell) => cell.replace(/^"(.*)"$/, "$1").trim());
    if (!row[0]) continue;
    const name = row[0];
    const code = row[1] || "";
    const phone = row[2] || "";
    const city = row[3] || "";
    const address = row[4] || "";
    const balance = Number(row[5]) || 0;

    const existing = currentSuppliers.find(
      (s) => s.name.toLowerCase().trim() === name.toLowerCase().trim() || (code && s.supplier_code && s.supplier_code.toLowerCase().trim() === code.toLowerCase().trim())
    );

    if (existing) {
      dbSuppliers.update(existing.id, {
        name,
        supplier_code: code || existing.supplier_code,
        phone: phone || existing.phone,
        city: city || existing.city,
        address: address || existing.address,
        current_balance: balance || existing.current_balance,
      });
      updated++;
    } else {
      dbSuppliers.add({
        name,
        supplier_code: code || "SUP-" + Math.floor(100 + Math.random() * 900),
        phone,
        city,
        address,
        current_balance: balance,
        status: "active",
      });
      added++;
    }
  }

  try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
  return { count: added + updated, added, updated };
}

export function bulkImportParties(csvText) {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return { count: 0, updated: 0, added: 0 };

  const currentParties = dbParties.getAll() || [];
  let added = 0;
  let updated = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((cell) => cell.replace(/^"(.*)"$/, "$1").trim());
    if (!row[0]) continue;
    const name = row[0];
    const code = row[1] || `PTY-${i}`;
    const phone = row[2] || "";
    const city = row[3] || "";
    const address = row[4] || "";
    const salesman = row[5] || "";
    const balance = Number(row[6]) || 0;

    const existing = currentParties.find(
      (p) => p.name.toLowerCase().trim() === name.toLowerCase().trim() || (code && p.party_code && p.party_code.toLowerCase().trim() === code.toLowerCase().trim())
    );

    if (existing) {
      dbParties.update(existing.id, {
        name,
        party_code: code,
        phone: phone || existing.phone,
        city: city || existing.city,
        address: address || existing.address,
        salesman_name: salesman || existing.salesman_name,
        current_balance: balance || existing.current_balance,
      });
      updated++;
    } else {
      dbParties.add({
        name,
        party_code: code,
        phone,
        city,
        address,
        salesman_name: salesman,
        current_balance: balance,
        status: "active",
      });
      added++;
    }
  }

  try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
  return { count: added + updated, added, updated };
}

export function bulkImportInventoryWithGodowns(csvText) {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return { count: 0, updated: 0, added: 0 };

  const currentItems = dbInventory.getAll() || [];
  let added = 0;
  let updated = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((cell) => cell.replace(/^"(.*)"$/, "$1").trim());
    if (!row[0] && !row[1]) continue;

    let srNo = "";
    let name = "";
    let desc = "";
    let packing = "";
    let company = "";
    let companyCode = "";
    let costPrice = 0;
    let retailPrice = 0;
    let storeStock = 0;
    let minAlert = 6;
    let category = "";

    if (row.length >= 12 && !isNaN(Number(row[0]))) {
      // 12-column format: S/R No, Medicine Name, Description, Packing, Company Name, Company Code, Item Code, Cost Price, Retail Price, Medical Store Stock, Stock Level Alert, Category
      srNo = row[0];
      name = row[1];
      desc = row[2] || "";
      packing = row[3] || "Pack";
      company = row[4] || "BM Pvt LTD";
      companyCode = row[5] || "";
      const itemCodeVal = row[6] || "";
      costPrice = Number(row[7]) || 0;
      retailPrice = Number(row[8]) || 0;
      storeStock = Number(row[9]) || 0;
      minAlert = Number(row[10]) || 6;
      category = row[11] || "General";
    } else if (row.length >= 11 && !isNaN(Number(row[0]))) {
      // 11-column format: S/R No, Medicine Name, Description, Packing, Company Name, Item Code, Cost Price, Retail Price, Medical Store Stock, Stock Level Alert, Category
      srNo = row[0];
      name = row[1];
      desc = row[2] || "";
      packing = row[3] || "Pack";
      company = row[4] || "BM Pvt LTD";
      companyCode = row[5] || "";
      costPrice = Number(row[6]) || 0;
      retailPrice = Number(row[7]) || 0;
      storeStock = Number(row[8]) || 0;
      minAlert = Number(row[9]) || 6;
      category = row[10] || "General";
    } else {
      // Legacy fallback mapping
      name = row[0];
      desc = row[1] || "";
      packing = row[2] || "Pack";
      company = row[3] || "BM Pvt LTD";
      companyCode = row[4] || "";
      costPrice = Number(row[5]) || 0;
      retailPrice = Number(row[6]) || 0;
      storeStock = Number(row[7]) || 0;
      minAlert = Number(row[8]) || 6;
      category = row[9] || "General";
    }

    if (!name) continue;

    const existing = currentItems.find(
      (item) => item.medicine_name.toLowerCase().trim() === name.toLowerCase().trim() &&
        (item.company_name || "").toLowerCase().trim() === company.toLowerCase().trim()
    );

    if (existing) {
      dbInventory.update(existing.id, {
        medicine_name: name,
        description: desc || existing.description,
        unit_label: packing || existing.unit_label,
        company_name: company,
        item_code: companyCode || existing.item_code,
        cost_price: costPrice || existing.cost_price,
        cost_price_per_box: costPrice || existing.cost_price_per_box,
        unit_sale_price: retailPrice || existing.unit_sale_price,
        box_sale_price: retailPrice || existing.box_sale_price,
        store_stock: storeStock,
        quantity: storeStock,
        total_base_stock: storeStock,
        low_stock_threshold: minAlert,
        category: category || existing.category,
      });
      updated++;
    } else {
      dbInventory.add({
        medicine_name: name,
        description: desc,
        unit_label: packing,
        company_name: company,
        item_code: companyCode,
        cost_price: costPrice,
        cost_price_per_box: costPrice,
        unit_sale_price: retailPrice,
        box_sale_price: retailPrice,
        store_stock: storeStock,
        quantity: storeStock,
        total_base_stock: storeStock,
        low_stock_threshold: minAlert,
        category: category || "General",
        status: "active",
      });
      added++;
    }
  }

  try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
  return { count: added + updated, added, updated };
}

export function bulkImportInventory(csvText) {
  return bulkImportInventoryWithGodowns(csvText);
}



