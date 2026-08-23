// Dynamic date helpers to keep mock data relative to the current calendar date
function getRelativeISOString(daysOffset, hoursOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  if (hoursOffset) d.setHours(d.getHours() + hoursOffset);
  return d.toISOString();
}



/** SHA-256 hash a password string synchronously using SubtleCrypto fallback. */
export function hashPassword(plain) {
  if (!plain) return "";
  let hash = 5381;
  for (let i = 0; i < plain.length; i++) {
    hash = ((hash << 5) + hash + plain.charCodeAt(i)) >>> 0;
  }
  return "hashed_" + hash.toString(16).padStart(8, "0");
}

function todayAt(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const SEED_DATA = {
  clinic: {
    id: "clinic_001",
    name: "Medical Clinic & Pharmacy",
    logo_url: "",
    address: "",
    phone: "",
    default_consultation_fee: 0,
    clinic_status: "open",
    clinic_status_note: "",
    public_notice: "",
    resend_api_key: "",
    created_at: "2026-01-01T09:00:00Z",
  },
  clinic_services: [],
  users: [],
  patients: [],
  visits: [],
  inventory: [],
  parties: [],
  suppliers: [],
  salesmen: [],
  b2b_sales: [],
  stock_transfers: [],
  sales: [],
  patient_ledger: [],
  expenses: [],
  returns: [],
  shift_closings: [],
  documents: [],
  tenants: [
    { id: "tenant_001", name: "Dr. Muhammad Kashif Khan's Homeopathic Clinic & Store", address: "Lajpat Road, Hyderabad", phone: "03473100304", fee: 300, status: "active", plan: "enterprise" }
  ],
  // Multi-Warehouse / Multi-Godown Master Data
  warehouses: [
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
  SEEDED:           "cf_seeded_v14_absolute_ground_zero_wipe",
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
};

// High-performance In-Memory Memoization Cache for Zero-Lag Operations
const _COLLECTION_CACHE = new Map();
const _ID_MAP_CACHE = new Map();

/**
 * Returns local Pakistan Standard Time (UTC+5) date string as YYYY-MM-DD.
 * Prevents timezone midnight shift causing tokens to resolve to the previous UTC day.
 */
function getPKTDateStr(date = new Date()) {
  const pkt = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return pkt.toISOString().split("T")[0];
}

function getCollection(key) {
  try {
    const raw = localStorage.getItem(key);
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

function getFromCollectionById(key, id) {
  if (!id) return null;
  getCollection(key); // Ensures cache and ID index are hot
  const idMap = _ID_MAP_CACHE.get(key);
  if (idMap && idMap.has(id)) {
    return idMap.get(id);
  }
  return null;
}

function setCollection(key, data) {
  try {
    const raw = JSON.stringify(data);
    localStorage.setItem(key, raw);
    _COLLECTION_CACHE.set(key, { raw, parsed: data });

    if (Array.isArray(data)) {
      const idMap = new Map();
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item && item.id) idMap.set(item.id, item);
      }
      _ID_MAP_CACHE.set(key, idMap);
    }
  } catch (e) {
    console.error("Failed to save collection to localStorage:", key, e);
  }
}

// Cross-Tab Cache Invalidation: When another browser tab writes to localStorage,
// automatically evict stale cache entries so the next read fetches fresh data.
try {
  window.addEventListener("storage", (e) => {
    if (e.key && e.storageArea === localStorage) {
      _COLLECTION_CACHE.delete(e.key);
      _ID_MAP_CACHE.delete(e.key);
    }
  });
} catch {}

function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function generateSequentialInvoiceNo(prefix = "INV") {
  const counterKey = `cf_seq_${prefix}`;
  let current = parseInt(localStorage.getItem(counterKey) || "1000", 10);
  current += 1;
  localStorage.setItem(counterKey, current.toString());
  return `${prefix}-${current}`;
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

// ---------- Initialize DB (Clean Production Mode) ----------
export function initDB() {
  if (localStorage.getItem(KEYS.SEEDED)) {
    return;
  }

  // Clear previous version keys to avoid stale demo data leakage
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("cf_") && k !== KEYS.SESSION) {
        localStorage.removeItem(k);
      }
    }
  } catch {}

  _COLLECTION_CACHE.clear();
  _ID_MAP_CACHE.clear();

  localStorage.setItem(KEYS.CLINIC, JSON.stringify(SEED_DATA.clinic));
  localStorage.setItem(KEYS.SERVICES, JSON.stringify(SEED_DATA.clinic_services));
  localStorage.setItem(KEYS.USERS, JSON.stringify(SEED_DATA.users));
  localStorage.setItem(KEYS.PATIENTS, JSON.stringify([]));
  localStorage.setItem(KEYS.VISITS, JSON.stringify([]));
  localStorage.setItem(KEYS.INVENTORY, JSON.stringify(SEED_DATA.inventory));
  localStorage.setItem(KEYS.PARTIES, JSON.stringify(SEED_DATA.parties));
  localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(SEED_DATA.suppliers));
  localStorage.setItem(KEYS.SALESMEN, JSON.stringify(SEED_DATA.salesmen));
  localStorage.setItem(KEYS.PURCHASES, JSON.stringify([]));
  localStorage.setItem(KEYS.B2B_SALES, JSON.stringify([]));
  localStorage.setItem(KEYS.SALES, JSON.stringify([]));
  localStorage.setItem(KEYS.PATIENT_LEDGER, JSON.stringify([]));
  localStorage.setItem(KEYS.EXPENSES, JSON.stringify([]));
  localStorage.setItem(KEYS.RETURNS, JSON.stringify([]));
  localStorage.setItem(KEYS.STOCK_TRANSFERS, JSON.stringify([]));
  localStorage.setItem(KEYS.SHIFT_CLOSINGS, JSON.stringify([]));
  localStorage.setItem(KEYS.DOCUMENTS, JSON.stringify([]));
  localStorage.setItem(KEYS.TENANTS, JSON.stringify(SEED_DATA.tenants));
  localStorage.setItem(KEYS.WAREHOUSES, JSON.stringify(SEED_DATA.warehouses));
  localStorage.setItem(KEYS.SUPPLIER_LEDGER, JSON.stringify([]));
  localStorage.setItem(KEYS.CASHBOOK, JSON.stringify([]));
  localStorage.setItem(KEYS.LICENSE, JSON.stringify({
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
  localStorage.setItem(KEYS.OUTBOX, JSON.stringify([]));

  localStorage.setItem(KEYS.SEEDED, "1");
}

export function resetDatabaseToDemoData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
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
    localStorage.setItem(k, JSON.stringify([]));
  });

  // Clear sequential counters and opening float caches
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("cf_seq_") || key.startsWith("cf_opening_cash_"))) {
        localStorage.removeItem(key);
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
    const raw = localStorage.getItem(KEYS.CLINIC);
    return raw ? JSON.parse(raw) : SEED_DATA.clinic;
  },
  update: (data) => {
    const current = dbClinic.get();
    const updated = { ...current, ...data };
    localStorage.setItem(KEYS.CLINIC, JSON.stringify(updated));
    return updated;
  },
  updateClinicStatus: (status, note) => {
    return dbClinic.update({ clinic_status: status, clinic_status_note: note || "" });
  },
};

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
    const list = getCollection(KEYS.USERS);
    return list || [];
  },
  getById: (id) => getFromCollectionById(KEYS.USERS, id),
  getByEmail: (email) => dbUsers.getAll().find((u) => u.email?.toLowerCase() === email?.toLowerCase()) || null,
  getDoctors: () => dbUsers.getAll().filter((u) => u.role === "doctor"),
  add: (user) => {
    const users = getCollection(KEYS.USERS);
    const newUser = { ...user, id: generateId("user"), clinic_id: "clinic_001" };
    setCollection(KEYS.USERS, [...users, newUser]);
    return newUser;
  },
  update: (id, data) => {
    const users = getCollection(KEYS.USERS);
    const updated = users.map((u) => (u.id === id ? { ...u, ...data } : u));
    setCollection(KEYS.USERS, updated);
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
    const users = getCollection(KEYS.USERS);
    setCollection(KEYS.USERS, users.filter((u) => u.id !== id));
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
  },
  resetPassword: (id, newPlainPassword) => {
    const users = getCollection(KEYS.USERS);
    const updated = users.map((u) => (u.id === id ? { ...u, password: hashPassword(newPlainPassword) } : u));
    setCollection(KEYS.USERS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return true;
  },
};

// ---------- Patients ----------
export const dbPatients = {
  getAll: () => getCollection(KEYS.PATIENTS),
  getById: (id) => getFromCollectionById(KEYS.PATIENTS, id),
  search: (query) => {
    if (!query || query.trim() === "") return getCollection(KEYS.PATIENTS);
    const q = query.trim().toLowerCase();
    return getCollection(KEYS.PATIENTS).filter((p) =>
      (p.full_name || "").toLowerCase().includes(q) ||
      (p.phone || "").includes(q) ||
      (p.relation_name || "").toLowerCase().includes(q) ||
      (p.cnic || "").includes(q)
    );
  },
  add: (patient) => {
    const patients = getCollection(KEYS.PATIENTS);
    const newPat = { ...patient, id: generateId("pat"), clinic_id: "clinic_001", created_at: new Date().toISOString() };
    setCollection(KEYS.PATIENTS, [newPat, ...patients]);
    return newPat;
  },
  update: (id, data) => {
    const patients = getCollection(KEYS.PATIENTS);
    const updated = patients.map((p) => (p.id === id ? { ...p, ...data } : p));
    setCollection(KEYS.PATIENTS, updated);
    return updated.find((p) => p.id === id) || null;
  },
};

// ---------- Visits & Queue ----------
export const dbVisits = {
  getAll: () => {
    let list = getCollection(KEYS.VISITS);
    if (!localStorage.getItem(KEYS.VISITS)) {
      list = SEED_DATA.visits || [];
      setCollection(KEYS.VISITS, list);
    }
    return list || [];
  },
  delete: (id) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.filter((v) => v.id !== id);
    setCollection(KEYS.VISITS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updated;
  },
  update: (id, data) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.map((v) => (v.id === id ? { ...v, ...data } : v));
    setCollection(KEYS.VISITS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updated.find((v) => v.id === id);
  },
  getById: (id) => getFromCollectionById(KEYS.VISITS, id),
  getByPatient: (patientId) => dbVisits.getAll().filter((v) => v.patient_id === patientId),
  getToday: (doctorId = null) => {
    const today = getPKTDateStr();
    return getCollection(KEYS.VISITS).filter((v) => {
      const isToday = getPKTDateStr(new Date(v.visit_date)) === today;
      if (!isToday) return false;
      if (!doctorId) return true;
      return v.doctor_id === doctorId || (!v.doctor_id && doctorId === "user_001");
    });
  },
  getTodayAll: (doctorId = null) => {
    const today = getPKTDateStr();
    return getCollection(KEYS.VISITS)
      .filter((v) => {
        const isToday = getPKTDateStr(new Date(v.visit_date)) === today;
        if (!isToday) return false;
        if (!doctorId) return true;
        return v.doctor_id === doctorId || (!v.doctor_id && doctorId === "user_001");
      })
      .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));
  },
  getTodayQueue: (doctorId = null) => {
    const today = getPKTDateStr();
    return getCollection(KEYS.VISITS)
      .filter((v) => {
        const isToday = getPKTDateStr(new Date(v.visit_date)) === today;
        const isNotCompleted = v.status !== "completed";
        if (!isToday || !isNotCompleted) return false;
        if (!doctorId) return true;
        return v.doctor_id === doctorId || (!v.doctor_id && doctorId === "user_001");
      })
      .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));
  },
  getByDoctor: (doctorId) => {
    const today = getPKTDateStr();
    return getCollection(KEYS.VISITS)
      .filter((v) => {
        const isToday = getPKTDateStr(new Date(v.visit_date)) === today;
        if (!isToday) return false;
        return v.doctor_id === doctorId || (!v.doctor_id && doctorId === "user_001");
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
    const newVisit = {
      ...visit,
      id: generateId("visit"),
      clinic_id: "clinic_001",
      token_number,
      status: "waiting",
      visit_date: new Date().toISOString(),
      prescription_image_url: null,
      notes: visit.notes || "",
      doctor_id: visit.doctor_id || "user_001",
      fee_status: visit.fee_status || (visit.fee_amount > 0 ? "paid" : "unpaid"),
    };
    setCollection(KEYS.VISITS, [newVisit, ...visits]);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return newVisit;
  },
  create: (visit) => dbVisits.add(visit),
  getQueue: (doctorId) => dbVisits.getTodayQueue(doctorId),
  updateStatus: (id, status) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.map((v) => (v.id === id ? { ...v, status } : v));
    setCollection(KEYS.VISITS, updated);
    try { window.dispatchEvent(new Event("clinicflow_status_update")); } catch {}
    return updated.find((v) => v.id === id);
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
    return newVisit;
  },
  complete: (id, payload = {}, optForcedStatus = null) => {
    const visits = getCollection(KEYS.VISITS);
    const data = typeof payload === "string" ? { forcedStatus: payload } : (payload || {});
    const reports = data.report_image_urls || [];
    const status = optForcedStatus || data.forcedStatus || (reports.length > 0 ? "completed" : (typeof payload === "string" ? payload : "completed_reports_pending"));
    const updated = visits.map((v) =>
      v.id === id
        ? { ...v, status, prescription_image_url: data.prescription_image_url || v.prescription_image_url, report_image_urls: reports, notes: data.notes || v.notes }
        : v
    );
    setCollection(KEYS.VISITS, updated);
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
    return newItem;
  },

  update: (id, data) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => (i.id === id ? { ...i, ...data } : i));
    setCollection(KEYS.INVENTORY, updated);
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

  addStock: (id, baseQty, destination = "warehouse") => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => {
      if (i.id !== id) return i;
      const currentBase = i.total_base_stock ?? i.stock_qty ?? 0;
      const newBase = currentBase + baseQty;
      const locStocks = { ...(i.location_stocks || {}) };
      if (destination === "store") {
        const newStore = (i.store_stock ?? 0) + baseQty;
        if (locStocks.wh_str !== undefined) locStocks.wh_str = newStore;
        return {
          ...i,
          total_base_stock: newBase,
          store_stock: newStore,
          stock_qty: newStore,
          ...(Object.keys(locStocks).length > 0 ? { location_stocks: locStocks } : {}),
        };
      } else {
        const newWarehouse = (i.warehouse_stock ?? 0) + baseQty;
        if (locStocks.wh_001 !== undefined) locStocks.wh_001 = newWarehouse;
        return {
          ...i,
          total_base_stock: newBase,
          warehouse_stock: newWarehouse,
          ...(Object.keys(locStocks).length > 0 ? { location_stocks: locStocks } : {}),
        };
      }
    });
    setCollection(KEYS.INVENTORY, updated);
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
          ledger.push({
            date: p.purchase_date || p.created_at || new Date().toISOString(),
            type: "PURCHASE",
            type_label: "Company / Local Purchase",
            voucher_no: p.invoice_no || p.id,
            party_name: p.supplier_name || "Supplier Consignment",
            destination: p.destination || "Main Warehouse (Godown)",
            qty_in: Number(item.qty_base_units || item.qty) || 0,
            qty_out: 0,
            unit_price: Number(item.cost_price || item.unit_price) || 0,
            total_amount: Number(item.total_cost || item.line_total) || 0,
            notes: p.notes || `GRN from ${p.supplier_name}`,
          });
        }
      });
    });

    // 2. Outward Retail POS Sales
    sales.forEach((s) => {
      (s.items || []).forEach((item) => {
        if (item.inventory_id === inv.id || (item.medicine_name && item.medicine_name.toLowerCase() === inv.medicine_name.toLowerCase())) {
          ledger.push({
            date: s.sale_date || s.created_at || new Date().toISOString(),
            type: "RETAIL_SALE",
            type_label: "Retail POS Counter Sale",
            voucher_no: s.receipt_no || s.id,
            party_name: s.patient_name || "Walk-in Patient",
            destination: "Store Counter",
            qty_in: 0,
            qty_out: Number(item.base_units || item.quantity || item.qty) || 0,
            unit_price: Number(item.unit_price) || 0,
            total_amount: Number(item.line_total) || 0,
            notes: "Dispensed at Retail Medical Store",
          });
        }
      });
    });

    // 3. Outward Wholesale B2B Sales (Interior Sindh)
    b2b.forEach((b) => {
      (b.items || []).forEach((item) => {
        if (item.inventory_id === inv.id || (item.medicine_name && item.medicine_name.toLowerCase() === inv.medicine_name.toLowerCase())) {
          ledger.push({
            date: b.sale_date || b.created_at || new Date().toISOString(),
            type: "WHOLESALE_B2B",
            type_label: "Wholesale B2B Supply",
            voucher_no: b.invoice_no || b.id,
            party_name: b.buyer_name || "Interior Sindh Party",
            city: b.city || b.buyer_city || "",
            salesman: b.salesman || "",
            bilty_no: b.bilty_no || "",
            transport: b.transport || "",
            destination: `${b.buyer_name} (${b.city || 'Interior Sindh'})`,
            qty_in: 0,
            qty_out: Number(item.qty_base_units || item.qty || item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
            total_amount: Number(item.line_total) || 0,
            notes: `Bilty: ${b.bilty_no || 'Direct'}, Tr: ${b.transport || 'Local'}, Man: ${b.salesman || 'Staff'}`,
          });
        }
      });
    });

    // 4. Internal Transfers
    transfers.forEach((t) => {
      if (t.inventory_id === inv.id || (t.medicine_name && t.medicine_name.toLowerCase() === inv.medicine_name.toLowerCase())) {
        const isToStore = t.to_loc?.includes("Counter") || t.to_loc?.includes("POS") || t.to_loc?.includes("Store");
        ledger.push({
          date: t.transfer_date || t.created_at || new Date().toISOString(),
          type: "INTERNAL_TRANSFER",
          type_label: `Internal Shift (${t.from_loc} ➔ ${t.to_loc})`,
          voucher_no: t.transfer_no || t.id,
          party_name: `Internal Shift (${t.transferred_by || 'Staff'})`,
          handler: t.transferred_by || "Staff",
          destination: `${t.from_loc} ➔ ${t.to_loc}`,
          qty_in: isToStore ? 0 : Number(t.qty) || 0,
          qty_out: isToStore ? Number(t.qty) || 0 : 0,
          unit_price: inv.unit_sale_price || 0,
          total_amount: (Number(t.qty) || 0) * (inv.unit_sale_price || 0),
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

    const current = mode === "replace" ? [] : getCollection(KEYS.INVENTORY);
    const existingNameSet = new Set(current.map((i) => (i.medicine_name || "").toLowerCase().trim()));
    const newItems = [];

    for (const raw of rawList) {
      if (!raw || !raw.medicine_name || !raw.medicine_name.trim()) continue;
      const cleanName = raw.medicine_name.trim();
      
      const company = raw.company_name || dbInventory.resolveCompanyCode(raw.item_code) || "BM Pvt LTD";
      const code = raw.item_code || company.slice(0, 3).toUpperCase();
      const salePrice = Number(raw.unit_sale_price || raw.box_sale_price || raw.sale_price) || 0;
      const costPrice = Number(raw.cost_price_per_box || raw.purchase_price) || (salePrice * 0.7);
      const storeStock = Number(raw.store_stock || raw.stock_qty) || 0;
      const godownStock = Number(raw.warehouse_stock) || 0;
      const totalBase = storeStock + godownStock;

      const item = {
        id: raw.id || generateId("inv"),
        clinic_id: "clinic_001",
        medicine_name: cleanName,
        company_name: company,
        item_code: code,
        generic_name: raw.generic_name || "Homeopathic Dilution / Mother Tincture",
        category: raw.category || "Homeopathic Drops",
        has_multi_unit: Boolean(raw.has_multi_unit),
        strips_per_box: Number(raw.strips_per_box) || 1,
        units_per_strip: Number(raw.units_per_strip) || 1,
        box_label: raw.box_label || "Pack",
        strip_label: raw.strip_label || "Bottle",
        unit_label: raw.unit_label || "Bottle",
        cost_price_per_box: costPrice,
        box_sale_price: salePrice,
        strip_sale_price: salePrice,
        unit_sale_price: salePrice,
        unit_price: salePrice,
        total_base_stock: totalBase,
        stock_qty: storeStock,
        store_stock: storeStock,
        warehouse_stock: godownStock,
        location_stocks: raw.location_stocks || { wh_001: godownStock, wh_str: storeStock },
        low_stock_threshold: Number(raw.low_stock_threshold) || 6,
        expiry_date: raw.expiry_date || "2028-12-31"
      };

      newItems.push(item);
      existingNameSet.add(cleanName.toLowerCase());
    }

    const updated = mode === "replace" ? newItems : [...current, ...newItems];
    setCollection(KEYS.INVENTORY, updated);
    return { success: true, count: newItems.length, total: updated.length };
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
};

/** Generate Sample CSV Template for Bulk Inventory Upload */
export function exportInventoryTemplateCSV() {
  const headers = "Medicine Name,Company,Item Code,Purchase Price,Sale Price,Store Stock,Godown Stock,Category,Low Stock Alert";
  const rows = [
    '"15 Ghr 20Ml","BM Pvt LTD","BM-15",420,595,25,35,"Homeopathic Drops",6',
    '"Paul Brooks Drop No. 1","Paul Brooks Homoeo Lab","PB-01",450,650,20,30,"Homeopathic Drops",6',
    '"Dr. Reckeweg R1 Drops","Schwabe / German","SCH-R01",1100,1450,15,20,"Specialized Drops",4',
    '"Mektum No. 3 Drops","MEKTUM Pvt Ltd","MKT-03",340,480,20,25,"Homeopathic Drops",6',
    '"Blossom No. 4 Drops","BLOSSOM Homoeo Pharma","BLS-04",360,520,20,24,"Homeopathic Drops",6',
    '"Panadol 500mg Tablets","Local Pharma Market","LPM-PAN",460,550,400,800,"Allopathic OTC",50'
  ];
  return `${headers}\n${rows.join("\n")}`;
}

/** Parse and Validate Inventory CSV File Content */
export function parseInventoryCSV(csvText) {
  if (!csvText || !csvText.trim()) return [];
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("medicine") || h.includes("item"));
  const compIdx = headers.findIndex((h) => h.includes("company") || h.includes("brand") || h.includes("mfg"));
  const codeIdx = headers.findIndex((h) => h.includes("code") || h.includes("barcode"));
  const costIdx = headers.findIndex((h) => h.includes("purchase") || h.includes("cost") || h.includes("buy"));
  const saleIdx = headers.findIndex((h) => h.includes("sale") || h.includes("price") || h.includes("retail"));
  const storeStockIdx = headers.findIndex((h) => h.includes("store") || (h.includes("stock") && !h.includes("godown") && !h.includes("warehouse")));
  const whStockIdx = headers.findIndex((h) => h.includes("godown") || h.includes("warehouse") || h.includes("wh"));
  const catIdx = headers.findIndex((h) => h.includes("category") || h.includes("type") || h.includes("form"));
  const alertIdx = headers.findIndex((h) => h.includes("min") || h.includes("threshold") || h.includes("alert"));

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

    const name = nameIdx !== -1 ? cells[nameIdx] : cells[0];
    if (!name) continue;

    const company = compIdx !== -1 && cells[compIdx] ? cells[compIdx] : "BM Pvt LTD";
    const code = codeIdx !== -1 && cells[codeIdx] ? cells[codeIdx] : (company.slice(0, 3).toUpperCase() || "GEN");
    const purchasePrice = costIdx !== -1 ? parseFloat(cells[costIdx]) || 0 : 0;
    const salePrice = saleIdx !== -1 ? parseFloat(cells[saleIdx]) || 0 : (purchasePrice > 0 ? purchasePrice * 1.3 : 0);
    const storeStock = storeStockIdx !== -1 ? parseInt(cells[storeStockIdx]) || 0 : 15;
    const godownStock = whStockIdx !== -1 ? parseInt(cells[whStockIdx]) || 0 : 35;
    const category = catIdx !== -1 && cells[catIdx] ? cells[catIdx] : "Homeopathic Drops";
    const minAlert = alertIdx !== -1 ? parseInt(cells[alertIdx]) || 6 : 6;

    parsed.push({
      medicine_name: name,
      company_name: company,
      item_code: code,
      cost_price_per_box: purchasePrice,
      box_sale_price: salePrice,
      strip_sale_price: salePrice,
      unit_sale_price: salePrice,
      unit_price: salePrice,
      store_stock: storeStock,
      stock_qty: storeStock,
      warehouse_stock: godownStock,
      total_base_stock: storeStock + godownStock,
      category,
      has_multi_unit: false,
      box_label: "Pack",
      strip_label: "Bottle",
      unit_label: "Bottle",
      strips_per_box: 1,
      units_per_strip: 1,
      low_stock_threshold: minAlert,
      location_stocks: { wh_001: godownStock, wh_str: storeStock },
      expiry_date: "2028-12-31"
    });
  }
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

// ---------- DrCreate & MS Access 4-Level Stock Ledger Engine ----------
export const dbStockLedger = {
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

    return Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category));
  },

  // Level 2: SKU Summary (All medicines under a specific Category / Item Code)
  getSKUSummary: (categoryCode = "") => {
    const inventory = dbInventory.getAll();
    if (!categoryCode || categoryCode === "All" || categoryCode === "all") {
      return inventory.map((i) => ({
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

    const normCat = categoryCode.toLowerCase().trim();
    return inventory
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
      }))
      .sort((a, b) => a.item_name.localeCompare(b.item_name));
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
    return newP;
  },
  update: (id, data) => {
    const list = getCollection(KEYS.PARTIES);
    const updated = list.map((p) => (p.id === id ? { ...p, ...data } : p));
    setCollection(KEYS.PARTIES, updated);
    return updated.find((p) => p.id === id) || null;
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
  },
  recordPayment: (partyId, amount) => {
    dbParties.updateBalance(partyId, -Number(amount));
  },
};


// ---------- Suppliers ----------
export const dbSuppliers = {
  getAll: () => getCollection(KEYS.SUPPLIERS),
  getById: (id) => getFromCollectionById(KEYS.SUPPLIERS, id),
  add: (supplier) => {
    const list = getCollection(KEYS.SUPPLIERS);
    const newS = { ...supplier, id: generateId("sup"), current_balance: Number(supplier.current_balance) || 0 };
    setCollection(KEYS.SUPPLIERS, [...list, newS]);
    return newS;
  },
  update: (id, data) => {
    const list = getCollection(KEYS.SUPPLIERS);
    const updated = list.map((s) => (s.id === id ? { ...s, ...data } : s));
    setCollection(KEYS.SUPPLIERS, updated);
    return updated.find((s) => s.id === id) || null;
  },
  updateBalance: (supplierId, delta) => {
    const list = getCollection(KEYS.SUPPLIERS);
    const updated = list.map((s) =>
      s.id === supplierId ? { ...s, current_balance: Math.max(0, (Number(s.current_balance) || 0) + Number(delta)) } : s
    );
    setCollection(KEYS.SUPPLIERS, updated);
  },
  recordPayment: (supplierId, amount) => {
    const list = getCollection(KEYS.SUPPLIERS);
    const updated = list.map((s) => (s.id === supplierId ? { ...s, current_balance: Math.max(0, (Number(s.current_balance) || 0) - Number(amount)) } : s));
    setCollection(KEYS.SUPPLIERS, updated);
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
    return newW;
  },
  update: (id, data) => {
    const list = dbWarehouses.getAll();
    const updated = list.map((w) => (w.id === id ? { ...w, ...data } : w));
    setCollection(KEYS.WAREHOUSES, updated);
  },
  delete: (id) => {
    const list = dbWarehouses.getAll();
    // Prevent deleting protected system warehouses
    const target = list.find((w) => w.id === id);
    if (!target || target.is_store_counter || target.is_default) return false;
    setCollection(KEYS.WAREHOUSES, list.filter((w) => w.id !== id));
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
    let list = getCollection(KEYS.SUPPLIER_LEDGER);
    if (!list || list.length === 0) {
      list = SEED_DATA.supplier_ledger;
      setCollection(KEYS.SUPPLIER_LEDGER, list);
    }
    return list;
  },
  getBySupplier: (supplierId) => dbSupplierLedger.getAll().filter((t) => t.supplier_id === supplierId),
  // PURCHASE_BILL | CASH_PAYMENT | CHEQUE_PAYMENT | BANK_PAYMENT | RETURN_CLAIM | ADVANCE
  addTransaction: (supplierId, type, debit, credit, notes, invoiceNo = "") => {
    const list = dbSupplierLedger.getAll();
    const supplierTxns = list.filter((t) => t.supplier_id === supplierId);
    const lastBalance = supplierTxns.length > 0
      ? supplierTxns[supplierTxns.length - 1].running_balance || 0
      : 0;
    const newBalance = Math.max(0, lastBalance + Number(debit) - Number(credit));
    const newTx = {
      id: generateId("sl"),
      supplier_id: supplierId,
      invoice_no: invoiceNo,
      type,
      debit: Number(debit) || 0,
      credit: Number(credit) || 0,
      running_balance: newBalance,
      notes: notes || "",
      created_at: new Date().toISOString(),
    };
    setCollection(KEYS.SUPPLIER_LEDGER, [...list, newTx]);
    return newTx;
  },
  recordPayment: (supplierId, amount, paymentMode, notes = "", reference = "") => {
    const typeMap = { cash: "CASH_PAYMENT", cheque: "CHEQUE_PAYMENT", bank: "BANK_PAYMENT" };
    const type = typeMap[paymentMode] || "CASH_PAYMENT";
    // Update supplier running balance
    dbSuppliers.recordPayment(supplierId, Number(amount));
    return dbSupplierLedger.addTransaction(
      supplierId,
      type,
      0,
      Number(amount),
      notes || `${type.replace("_", " ")} — Ref: ${reference || "N/A"}`,
      reference
    );
  },
  recordReturnClaim: (supplierId, amount, notes = "") => {
    dbSuppliers.recordPayment(supplierId, Number(amount));
    return dbSupplierLedger.addTransaction(supplierId, "RETURN_CLAIM", 0, Number(amount), notes || "Damaged stock return / credit claim");
  },
  getRunningBalance: (supplierId) => {
    const txns = dbSupplierLedger.getBySupplier(supplierId);
    if (!txns.length) return 0;
    return txns[txns.length - 1].running_balance || 0;
  },
  getTotals: (supplierId) => {
    const txns = dbSupplierLedger.getBySupplier(supplierId);
    const totalDebits = txns.reduce((s, t) => s + (t.debit || 0), 0);
    const totalCredits = txns.reduce((s, t) => s + (t.credit || 0), 0);
    return { totalDebits, totalCredits, balance: Math.max(0, totalDebits - totalCredits) };
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
      name: target.name || "ClinicFlow Clinic",
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
  getNextVoucherNo: () => {
    const sales = getCollection(KEYS.SALES) || [];
    const b2b = getCollection(KEYS.B2B_SALES) || [];
    let maxNum = 6217; // DrCreate baseline sequence S-6218
    [...sales, ...b2b].forEach((s) => {
      const vNo = s.voucher_no || s.receipt_no || s.invoice_no || "";
      const match = vNo.match(/^S-(\d+)$/i);
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    });
    return `S-${maxNum + 1}`;
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
    const sales = getCollection(KEYS.SALES);
    const voucherNo = saleData.voucher_no || dbSales.getNextVoucherNo();
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
    return newSale;
  },
  checkout: (sale) => {
    const sales = getCollection(KEYS.SALES);
    const invoiceNo = generateSequentialInvoiceNo("POS");
    const subtotal = Number(sale.subtotal_amount) || Number(sale.total_amount) || 0;
    const discount = Number(sale.discount_amount) || 0;
    const total = Math.max(0, subtotal - discount);
    const paid = sale.paid_amount !== undefined && sale.paid_amount !== null && !isNaN(Number(sale.paid_amount))
      ? Number(sale.paid_amount)
      : total;

    const newSale = {
      ...sale,
      id: generateId("sale"),
      receipt_no: invoiceNo,
      sale_date: sale.sale_date || new Date().toISOString(),
      subtotal_amount: subtotal,
      discount_amount: discount,
      total_amount: total,
      paid_amount: paid,
      balance_due: Math.max(0, total - paid),
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
    return newSale;
  },
};


// ---------- Purchases (GRN Inward) ----------
export const dbPurchases = {
  getAll: () => getCollection(KEYS.PURCHASES),
  add: (purchase) => {
    const purchases = getCollection(KEYS.PURCHASES);
    const invoiceNo = purchase.invoice_no || generateSequentialInvoiceNo("PUR");
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

    const dest = purchase.destination_type === "store" ? "store" : "warehouse";

    // Process each item: auto-create missing inventory + apply multi-unit base conversion
    (purchase.items || []).forEach((item) => {
      let inv = item.inventory_id ? dbInventory.getById(item.inventory_id) : null;

      // Auto-register new medicine in inventory if not found
      if (!inv && item.medicine_name && item.medicine_name.trim()) {
        inv = dbInventory.add({
          medicine_name: item.medicine_name.trim(),
          item_code: item.item_code || "",
          generic_name: item.generic_name || "",
          category: item.category || "General",
          company_name: item.company_name || "",
          has_multi_unit: Boolean(item.has_multi_unit),
          strips_per_box: Number(item.strips_per_box) || 1,
          units_per_strip: Number(item.units_per_strip) || 1,
          box_label: item.box_label || "Pack",
          strip_label: item.strip_label || "Strip",
          unit_label: item.unit_label || "Unit",
          cost_price_per_box: Number(item.cost_price) || 0,
          box_sale_price: Number(item.sale_price) || 0,
          strip_sale_price: Number(item.sale_price) || 0,
          unit_sale_price: Number(item.sale_price) || 0,
          total_base_stock: 0,
          store_stock: 0,
          warehouse_stock: 0,
          low_stock_threshold: 6,
          expiry_date: item.expiry_date || "",
        });
        // Patch the item with the newly created inventory_id for invoice record
        item.inventory_id = inv ? inv.id : item.inventory_id;
      }

      if (inv) {
        // Correct multi-unit base conversion: boxes → base units or explicit qty_base_units
        const baseUnits = Number(item.qty_base_units) || convertUnitsToBase(
          Number(item.qty) || 1,
          item.received_unit_type || "unit",
          inv
        );
        dbInventory.addStock(inv.id, baseUnits, dest);
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
    return newPurchase;
  },
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
    setCollection(KEYS.PURCHASES, purchases.filter((p) => p.id !== purchaseId));
  },

  deleteInvoice: (purchaseId) => {
    dbPurchases.deletePurchase(purchaseId);
  },
};

// ---------- GRN Dynamic References & Transport Carriers ----------
export const dbGrnMetadata = {
  getReferences: () => {
    const custom = getCollection("clinicflow_grn_references");
    const defaults = [
      "ADffsn", "Afaan", "Afam", "Afan", "Afan7", "Afcfan", "Aff\\an", "Aff4", "Direct Factory", "Order Booker", "Self / Counter"
    ];
    return Array.from(new Set([...defaults, ...(custom || [])]));
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
    const custom = getCollection("clinicflow_grn_transports");
    const defaults = [
      "By Hand", "Asad Bhai", "Azeem", "BabU Gadha", "by Hand Fraz Bhai", "by hand Usama", "Al-Razi Transport", "Karachi Goods", "Niazi Express", "Self Transport"
    ];
    return Array.from(new Set([...defaults, ...(custom || [])]));
  },
  addTransport: (transportName) => {
    if (!transportName || !transportName.trim()) return "";
    const clean = transportName.trim();
    const existing = getCollection("clinicflow_grn_transports") || [];
    if (!existing.includes(clean)) {
      setCollection("clinicflow_grn_transports", [...existing, clean]);
    }
    return clean;
  },
};


// ---------- Wholesale B2B Sales (Interior Sindh Supply) ----------
export const dbB2BSales = {
  getAll: () => getCollection(KEYS.B2B_SALES),
  checkout: (saleData) => {
    const sales = getCollection(KEYS.B2B_SALES);
    const invoiceNo = generateSequentialInvoiceNo("WHO");
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
      sale_date: new Date().toISOString(),
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
    return newB2BSale;
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
      transfer_date: new Date().toISOString(),
    };
    setCollection(KEYS.STOCK_TRANSFERS, [newTransfer, ...transfers]);
    return newTransfer;
  },
};

// ---------- Expenses ----------
export const dbExpenses = {
  getAll: () => getCollection(KEYS.EXPENSES),
  add: (expense) => {
    const list = getCollection(KEYS.EXPENSES);
    const expDate = expense.date || expense.expense_date || new Date().toISOString();
    const newExp = {
      ...expense,
      id: generateId("exp"),
      amount: Number(expense.amount) || 0,
      date: expDate,
      expense_date: expDate,
    };
    setCollection(KEYS.EXPENSES, [newExp, ...list]);
    return newExp;
  },
  delete: (id) => {
    const list = getCollection(KEYS.EXPENSES);
    setCollection(KEYS.EXPENSES, list.filter((e) => e.id !== id));
  },
};

// ---------- Returns & Exchanges ----------
export const dbReturns = {
  getAll: () => getCollection(KEYS.RETURNS),
  processReturn: ({ sale_id, return_items, reason, refund_type }) => {
    const returns = getCollection(KEYS.RETURNS);
    const items = return_items || [];
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
      sale_id,
      reason,
      refund_type: refund_type || "cash",
      items,
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
    let list = getCollection(KEYS.CASHBOOK);
    if (!localStorage.getItem(KEYS.CASHBOOK)) {
      // Seed initial baseline records from DrCreate ONLY on fresh first load
      list = [
        {
          id: "cb_5157",
          voucher_no: "C-5157",
          term: "Paid",
          type: "Paid",
          account_name: "HFP Private Limited",
          naration: "cash payment",
          amount: 20000,
          date: "2026-08-22",
          created_at: "2026-08-22T08:00:00.000Z"
        },
        {
          id: "cb_5158",
          voucher_no: "C-5158",
          term: "Receive",
          type: "Receive",
          account_name: "Sakhi Shahbaz H/Store (Moro)",
          naration: "Bill payment received",
          amount: 5000,
          date: "2026-08-22",
          created_at: "2026-08-22T08:15:00.000Z"
        },
        {
          id: "cb_5159",
          voucher_no: "C-5159",
          term: "Paid",
          type: "Paid",
          account_name: "Shop Expense",
          naration: "Staff tea & refreshment",
          amount: 350,
          date: "2026-08-22",
          created_at: "2026-08-22T08:30:00.000Z"
        }
      ];
      setCollection(KEYS.CASHBOOK, list);
    }

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
    let maxNum = 5159; // DrCreate baseline start at C-5160
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
    const term = entryData.term === "Paid" ? "Paid" : "Receive";
    const date = entryData.date ? entryData.date.split("T")[0] : new Date().toISOString().split("T")[0];
    const accountName = (entryData.account_name || "Cash In Hand").trim();
    const naration = (entryData.naration || entryData.description || "").trim();

    const newEntry = {
      id: generateId("cb"),
      voucher_no: voucherNo,
      term,
      type: term,
      account_name: accountName,
      naration,
      description: naration,
      amount,
      date,
      created_at: new Date().toISOString(),
    };

    // 1. Sync Double-Entry accounting into General Ledger (MainAc)
    const mainAcList = getCollection(KEYS.MAIN_AC) || [];
    const mainAcEntries = [];
    if (term === "Receive") {
      // Cash Received: Debit Cash in Hand, Credit Party/Account
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Debit Note",
        account_name: "Cash In Hand",
        debit: amount,
        credit: 0,
        description: naration || `Cash received from ${accountName}`,
        created_at: new Date().toISOString()
      });
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Receive",
        account_name: accountName,
        debit: 0,
        credit: amount,
        description: naration || `Cash received`,
        created_at: new Date().toISOString()
      });

      // Reduce party Udhaar balance if it's a known wholesale party
      const parties = dbParties.getAll();
      const matchedParty = parties.find(
        (p) => p.name.toLowerCase() === accountName.toLowerCase() || p.id === entryData.party_id
      );
      if (matchedParty && matchedParty.current_balance > 0) {
        dbParties.recordPayment(matchedParty.id, amount);
      }
    } else {
      // Cash Paid: Debit Party/Expense Account, Credit Cash in Hand
      mainAcEntries.push({
        id: generateId("mac"),
        voucher_no: voucherNo,
        date,
        transaction_type: "Paid",
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
        transaction_type: "Credit Note",
        account_name: "Cash In Hand",
        debit: 0,
        credit: amount,
        description: naration || `Payment disbursed`,
        created_at: new Date().toISOString()
      });

      // If supplier, record payment in Supplier ledger
      const suppliers = dbSuppliers.getAll();
      const matchedSup = suppliers.find(
        (s) => s.name.toLowerCase() === accountName.toLowerCase() || s.id === entryData.supplier_id
      );
      if (matchedSup) {
        dbSupplierLedger.recordPayment(matchedSup.id, amount, "cash", naration, voucherNo);
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
    const daySales = [...allSales, ...allB2B].filter((s) => (s.sale_date || s.created_at || "").split("T")[0] === targetDate);

    let totalSale = 0;
    let cashSale = 0;
    let creditSale = 0;

    daySales.forEach((s) => {
      const tot = Number(s.total_amount) || 0;
      const isCredit = s.payment_mode === "Credit" || Number(s.balance_due) > 0;
      const paid = isCredit ? (Number(s.paid_amount) || 0) : tot;
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
    const dayVisits = allVisits.filter((v) => (v.visit_date || "").split("T")[0] === targetDate && (v.status === "done" || v.status === "waiting" || v.status === "in_consultation"));
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
    const clinicName = clinic?.name || "Dr. Muhammad Kashif Khan Clinic";
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
      `_Generated by ClinicFlow & K.B Software_`;

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
  return BACKUP_MAGIC_HEADER + btoa(unescape(encodeURIComponent(enc)));
}

function decryptBackupPayload(encryptedStr) {
  if (encryptedStr.startsWith(BACKUP_MAGIC_HEADER)) {
    const rawB64 = encryptedStr.slice(BACKUP_MAGIC_HEADER.length);
    const decoded = decodeURIComponent(escape(atob(rawB64)));
    const key = 0x5a;
    let plain = "";
    for (let i = 0; i < decoded.length; i++) {
      plain += String.fromCharCode(decoded.charCodeAt(i) ^ key);
    }
    return JSON.parse(plain);
  }
  // Fallback for standard JSON backup imports
  return JSON.parse(encryptedStr);
}

export function exportFullDatabase(returnEncryptedString = false) {
  const backup = {
    version: "5.0.0",
    app: "ClinicFlow Desktop & Web Suite",
    export_date: new Date().toISOString(),
    clinic_name: dbClinic.get()?.name || "Dr. Muhammad Kashif Khan Clinic",
    data: {},
  };
  Object.entries(KEYS).forEach(([_, storageKey]) => {
    backup.data[storageKey] = getCollection(storageKey);
  });

  const plainJson = JSON.stringify(backup, null, 2);
  const encryptedPayload = encryptBackupPayload(plainJson);

  // If running in browser environment, trigger encrypted .cfbak file download
  if (typeof document !== "undefined" && !returnEncryptedString) {
    const blob = new Blob([encryptedPayload], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    link.download = `ClinicFlow_Encrypted_Backup_${dateStr}.cfbak`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return returnEncryptedString ? encryptedPayload : backup;
}

export function importFullDatabase(backupInput) {
  try {
    let backupObj = backupInput;
    if (typeof backupInput === "string") {
      try {
        backupObj = decryptBackupPayload(backupInput.trim());
      } catch (decErr) {
        return { success: false, error: "Invalid or corrupted .cfbak / .json backup file: " + decErr.message };
      }
    }

    if (!backupObj || typeof backupObj !== "object" || !backupObj.data) {
      return { success: false, error: "Invalid backup structure: Missing 'data' object." };
    }

    _COLLECTION_CACHE.clear();
    _ID_MAP_CACHE.clear();

    Object.entries(backupObj.data).forEach(([key, val]) => {
      localStorage.setItem(key, JSON.stringify(val));
    });

    localStorage.setItem(KEYS.SEEDED, "1");

    try {
      window.dispatchEvent(new Event("clinicflow_status_update"));
    } catch {}

    return { success: true, data: backupObj, error: null };
  } catch (err) {
    return { success: false, error: err.message || "Failed to restore backup." };
  }
}

// ---------- Software License & Subscription Governance Engine ----------
export const dbLicense = {
  get: () => {
    try {
      const raw = localStorage.getItem(KEYS.LICENSE);
      if (!raw) {
        return {
          license_status: "active",
          monthly_fee: 5000,
          currency: "PKR",
          due_day: 1,
          warning_days_before: 5,
          grace_days: 10,
          last_paid_date: new Date().toISOString().split("T")[0],
          next_due_date: (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            d.setDate(1);
            return d.toISOString().split("T")[0];
          })(),
          is_hard_locked: false,
          restricted_features: [],
          developer_phone: "03142291356",
          developer_whatsapp: "03142291356",
          developer_bank_details: "JazzCash / EasyPaisa / Bank Transfer: 03142291356 (K.B Software)",
          custom_notice: "",
        };
      }
      return JSON.parse(raw);
    } catch {
      return { license_status: "active", restricted_features: [] };
    }
  },

  update: (updates) => {
    const current = dbLicense.get();
    const merged = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(KEYS.LICENSE, JSON.stringify(merged));
    try {
      window.dispatchEvent(new CustomEvent("clinicflow_license_update", { detail: merged }));
    } catch {}
    return merged;
  },

  /**
   * Computes dynamic runtime status:
   * Returns: { status: "active" | "warning" | "grace_period" | "restricted" | "locked", daysLeft, daysOverdue, isFeatureBlocked: (key) => boolean }
   */
  evaluateStatus: () => {
    const lic = dbLicense.get();
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
    const todayStr = today.toISOString().split("T")[0];
    const dueDate = lic.next_due_date ? new Date(lic.next_due_date + "T00:00:00") : new Date();
    const diffMs = dueDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // 1. If today is within warning_days_before due date (e.g. 5 days before 1st)
    const warningDays = Number(lic.warning_days_before) || 5;
    if (daysLeft >= 0 && daysLeft <= warningDays) {
      return {
        status: "warning",
        isLocked: false,
        isWarning: true,
        isGrace: false,
        daysLeft,
        daysOverdue: 0,
        message: `Monthly Software License is due in ${daysLeft === 0 ? "today" : `${daysLeft} days`} (${lic.next_due_date}). Please clear payment of Rs. ${lic.monthly_fee?.toLocaleString("en-PK") || "5,000"}.`,
        isFeatureBlocked: (featureKey) => (lic.restricted_features || []).includes(featureKey),
      };
    }

    // 2. If past due date but within Grace Period (e.g. 1st to 10th of month)
    const graceDays = Number(lic.grace_days) || 10;
    if (daysLeft < 0) {
      const daysOverdue = Math.abs(daysLeft);
      if (daysOverdue <= graceDays) {
        return {
          status: "grace_period",
          isLocked: false,
          isWarning: true,
          isGrace: true,
          daysLeft: 0,
          daysOverdue,
          message: `Monthly Subscription payment is overdue (${daysOverdue} days). Grace period active till ${graceDays} days. System is running normally.`,
          isFeatureBlocked: (featureKey) => (lic.restricted_features || []).includes(featureKey),
        };
      } else {
        // Beyond grace days without payment -> Auto soft warning or restriction
        return {
          status: "grace_period",
          isLocked: false,
          isWarning: true,
          isGrace: true,
          daysLeft: 0,
          daysOverdue,
          message: `Subscription past due (${daysOverdue} days). Please contact K.B Software for payment clearance.`,
          isFeatureBlocked: (featureKey) => (lic.restricted_features || []).includes(featureKey),
        };
      }
    }

    // 3. Normal Active state
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

// ---------- Offline PWA Outbox Sync Engine ----------
export const dbOutbox = {
  getAll: () => getCollection(KEYS.OUTBOX) || [],

  enqueue: (actionType, payload) => {
    const list = getCollection(KEYS.OUTBOX) || [];
    const item = {
      id: generateId("sync"),
      action_type: actionType, // "CREATE_VISIT" | "RECORD_POS" | "CREATE_PATIENT" | "RECORD_PURCHASE" | "RECORD_B2B"
      payload,
      status: "pending", // "pending" | "syncing" | "synced" | "failed"
      created_at: new Date().toISOString(),
      retry_count: 0,
    };
    setCollection(KEYS.OUTBOX, [item, ...list]);
    try {
      window.dispatchEvent(new CustomEvent("clinicflow_outbox_change", { detail: item }));
    } catch {}
    return item;
  },

  markSynced: (id) => {
    const list = getCollection(KEYS.OUTBOX) || [];
    const filtered = list.filter((item) => item.id !== id);
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

