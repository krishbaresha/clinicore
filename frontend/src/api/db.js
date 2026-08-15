// Dynamic date helpers to keep mock data relative to the current calendar date
function getRelativeISOString(daysOffset, hoursOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  if (hoursOffset) d.setHours(d.getHours() + hoursOffset);
  return d.toISOString();
}

function getRelativeDateString(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split("T")[0];
}

// Today at a given hour
function todayAt(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const SEED_DATA = {
  clinic: {
    id: "clinic_001",
    name: "Dr. Asif Ashraf's Clinic",
    logo_url: "",
    address: "Lajpat Road, Hyderabad",
    phone: "03001234567",
    default_consultation_fee: 800,
    created_at: "2023-01-10T09:00:00Z",
  },
  clinic_services: [
    { id: "ser_001", clinic_id: "clinic_001", service_name: "ECG", price: 1500 },
    { id: "ser_002", clinic_id: "clinic_001", service_name: "Nebulization", price: 300 },
    { id: "ser_003", clinic_id: "clinic_001", service_name: "Dressing", price: 500 },
  ],
  users: [
    {
      id: "user_001",
      clinic_id: "clinic_001",
      name: "Dr. Asif Ashraf",
      role: "doctor",
      phone: "03001234567",
      email: "dr.asif@example.com",
      password: "password",
    },
    {
      id: "user_002",
      clinic_id: "clinic_001",
      name: "Sana Malik",
      role: "receptionist",
      phone: "03111234567",
      email: "sana.reception@example.com",
      password: "password",
    },
    {
      id: "user_003",
      clinic_id: "clinic_001",
      name: "Kamran Iqbal",
      role: "pharmacist",
      phone: "03221234567",
      email: "kamran.store@example.com",
      password: "password",
    },
    {
      id: "user_004",
      clinic_id: "clinic_001",
      name: "Dr. Fatima Khan",
      role: "doctor",
      phone: "03009998877",
      email: "dr.fatima@example.com",
      password: "password",
    },
  ],
  patients: [
    {
      id: "pat_001",
      clinic_id: "clinic_001",
      full_name: "Muhammad Bilal",
      relation_name: "Abdul Rasheed",
      relation_type: "father",
      phone: "03211112233",
      cnic: "41304-1234567-1",
      age: 34,
      gender: "male",
      created_at: "2023-03-15T10:00:00Z",
    },
    {
      id: "pat_002",
      clinic_id: "clinic_001",
      full_name: "Ayesha Siddiqui",
      relation_name: "Farhan Siddiqui",
      relation_type: "husband",
      phone: "03451112244",
      cnic: "41306-7654321-2",
      age: 27,
      gender: "female",
      created_at: "2024-06-01T11:30:00Z",
    },
    {
      id: "pat_003",
      clinic_id: "clinic_001",
      full_name: "Abdul Ghani",
      relation_name: "Karim Bakhsh",
      relation_type: "father",
      phone: "03007779988",
      cnic: "",
      age: 58,
      gender: "male",
      created_at: "2022-11-20T09:15:00Z",
    },
    {
      id: "pat_004",
      clinic_id: "clinic_001",
      full_name: "Muhammad Bilal",
      relation_name: "Ashfaq Hussain",
      relation_type: "father",
      phone: "03339990011",
      cnic: "41304-9876543-3",
      age: 22,
      gender: "male",
      created_at: "2025-02-10T10:00:00Z",
    },
    {
      id: "pat_005",
      clinic_id: "clinic_001",
      full_name: "Krish Baresha",
      relation_name: "Ravi Baresha",
      relation_type: "father",
      phone: "03338887766",
      cnic: "41304-5554433-2",
      age: 25,
      gender: "male",
      created_at: "2025-02-10T10:00:00Z",
    },
  ],
  visits: [
    {
      id: "visit_001",
      patient_id: "pat_001",
      clinic_id: "clinic_001",
      doctor_id: "user_001",
      token_number: 4,
      visit_type: "new",
      status: "completed",
      visit_date: "2023-03-15T10:05:00Z",
      fee_amount: 800,
      prescription_image_url: "/mock-images/rx_visit_001.jpg",
      report_image_urls: [],
      follow_up_date: "2023-03-22",
      notes: "",
    },
    {
      id: "visit_002",
      patient_id: "pat_001",
      clinic_id: "clinic_001",
      doctor_id: "user_001",
      token_number: 9,
      visit_type: "follow_up",
      status: "completed",
      visit_date: "2025-07-10T16:20:00Z",
      fee_amount: 1000,
      prescription_image_url: "/mock-images/rx_visit_002.jpg",
      report_image_urls: ["/mock-images/report_visit_002_1.jpg"],
      follow_up_date: "2025-07-20",
      notes: "Patient returned after 2 years — history retrieved successfully",
    },
    {
      id: "visit_003",
      patient_id: "pat_002",
      clinic_id: "clinic_001",
      doctor_id: "user_004",
      token_number: 2,
      visit_type: "new",
      status: "completed",
      visit_date: "2024-06-01T11:35:00Z",
      fee_amount: 900,
      prescription_image_url: "/mock-images/rx_visit_003.jpg",
      report_image_urls: [],
      follow_up_date: null,
      notes: "",
    },
    {
      id: "visit_004",
      patient_id: "pat_003",
      clinic_id: "clinic_001",
      doctor_id: "user_001",
      token_number: 1,
      visit_type: "new",
      status: "completed_reports_pending",
      visit_date: "2022-11-20T09:20:00Z",
      fee_amount: 1200,
      prescription_image_url: "/mock-images/rx_visit_004.jpg",
      report_image_urls: [],
      follow_up_date: "2022-12-05",
      notes: "Referred for X-ray — pending report upload",
    },
    {
      id: "visit_005",
      patient_id: "pat_004",
      clinic_id: "clinic_001",
      doctor_id: "user_001",
      token_number: 10,
      visit_type: "new",
      status: "waiting",
      visit_date: todayAt(14, 0),
      fee_amount: 800,
      prescription_image_url: null,
      report_image_urls: [],
      follow_up_date: null,
      notes: "Assigned to Dr. Asif Ashraf — token #10",
    },
    {
      id: "visit_006",
      patient_id: "pat_002",
      clinic_id: "clinic_001",
      doctor_id: "user_001",
      token_number: 8,
      visit_type: "follow_up",
      status: "in_consultation",
      visit_date: todayAt(13, 30),
      fee_amount: 1000,
      prescription_image_url: null,
      report_image_urls: [],
      follow_up_date: null,
      notes: "",
    },
    {
      id: "visit_007",
      patient_id: "pat_003",
      clinic_id: "clinic_001",
      doctor_id: "user_001",
      token_number: 7,
      visit_type: "follow_up",
      status: "completed",
      visit_date: todayAt(12, 0),
      fee_amount: 1200,
      prescription_image_url: "/mock-images/rx_visit_004.jpg",
      report_image_urls: [],
      follow_up_date: null,
      notes: "",
    },
    {
      id: "visit_008",
      patient_id: "pat_005",
      clinic_id: "clinic_001",
      doctor_id: "user_004",
      token_number: 11,
      visit_type: "new",
      status: "waiting",
      visit_date: todayAt(14, 15),
      fee_amount: 800,
      prescription_image_url: null,
      report_image_urls: [],
      follow_up_date: null,
      notes: "Assigned to Dr. Fatima Khan — token #11",
    },
  ],
  store_inventory: [
    { id: "inv_001", clinic_id: "clinic_001", medicine_name: "Panadol",          unit_label: "strip",  stock_qty: 120, unit_price: 8,   low_stock_threshold: 20 },
    { id: "inv_002", clinic_id: "clinic_001", medicine_name: "Amoxicillin 500mg", unit_label: "pack",   stock_qty: 15,  unit_price: 25,  low_stock_threshold: 20 },
    { id: "inv_003", clinic_id: "clinic_001", medicine_name: "Ascoril Syrup",     unit_label: "bottle", stock_qty: 40,  unit_price: 180, low_stock_threshold: 10 },
    { id: "inv_004", clinic_id: "clinic_001", medicine_name: "Ferrous Sulphate",  unit_label: "strip",  stock_qty: 8,   unit_price: 12,  low_stock_threshold: 15 },
  ],
  store_sales: [
    {
      id: "sale_001",
      clinic_id: "clinic_001",
      visit_id: "visit_002",
      items: [
        { inventory_id: "inv_003", medicine_name: "Ascoril Syrup", unit_label: "bottle", quantity: 1, unit_price: 180, line_total: 180 },
        { inventory_id: "inv_001", medicine_name: "Panadol",       unit_label: "strip",  quantity: 2, unit_price: 8,   line_total: 16  },
      ],
      subtotal_amount: 196,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 196,
      sale_date: getRelativeISOString(-5),
    },
    {
      id: "sale_002",
      clinic_id: "clinic_001",
      visit_id: null, // Walk-in Customer
      items: [
        { inventory_id: "inv_001", medicine_name: "Panadol", unit_label: "strip", quantity: 5, unit_price: 8, line_total: 40 }
      ],
      subtotal_amount: 40,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 40,
      sale_date: getRelativeISOString(-2),
    },
    {
      id: "sale_003",
      clinic_id: "clinic_001",
      visit_id: "visit_001",
      items: [
        { inventory_id: "inv_003", medicine_name: "Ascoril Syrup", unit_label: "bottle", quantity: 2, unit_price: 180, line_total: 360 }
      ],
      subtotal_amount: 360,
      discount_amount: 50,
      tax_amount: 0,
      total_amount: 310,
      sale_date: getRelativeISOString(-1),
    },
  ],
};

// Keys used in localStorage
const KEYS = {
  SEEDED:     "cf_seeded_v6",   // bumped to v6 for multi-doctor seed update
  CLINIC:     "cf_clinic",
  USERS:      "cf_users",
  PATIENTS:   "cf_patients",
  VISITS:     "cf_visits",
  INVENTORY:  "cf_store_inventory",
  SALES:      "cf_store_sales",
  DOCUMENTS:  "cf_documents",
  SERVICES:   "cf_clinic_services",
};

/** Ensure the localStorage DB is initialized with seed data on first load. */
export function initDB() {
  if (!localStorage.getItem(KEYS.DOCUMENTS)) {
    localStorage.setItem(KEYS.DOCUMENTS, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEYS.SERVICES)) {
    localStorage.setItem(KEYS.SERVICES, JSON.stringify([]));
  }

  // If seeded version 6 is already active, return
  if (localStorage.getItem(KEYS.SEEDED) === "1") return;

  // Clean old seeds to avoid data version conflicts
  ["cf_seeded", "cf_seeded_v2", "cf_seeded_v3", "cf_seeded_v4", "cf_seeded_v5"].forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem("cf_prescription_items"); // old schema, no longer used

  localStorage.setItem(KEYS.CLINIC,     JSON.stringify(SEED_DATA.clinic));
  localStorage.setItem(KEYS.USERS,      JSON.stringify(SEED_DATA.users));
  localStorage.setItem(KEYS.PATIENTS,   JSON.stringify(SEED_DATA.patients));
  localStorage.setItem(KEYS.VISITS,     JSON.stringify(SEED_DATA.visits));
  localStorage.setItem(KEYS.INVENTORY,  JSON.stringify(SEED_DATA.store_inventory));
  localStorage.setItem(KEYS.SALES,      JSON.stringify(SEED_DATA.store_sales));
  localStorage.setItem(KEYS.SERVICES,   JSON.stringify(SEED_DATA.clinic_services));
  localStorage.setItem(KEYS.SEEDED, "1");
}

// ---------- Generic helpers ----------
function getCollection(key)      { return JSON.parse(localStorage.getItem(key) || "[]"); }
function setCollection(key, arr) { localStorage.setItem(key, JSON.stringify(arr)); }
function getRecord(key)          { return JSON.parse(localStorage.getItem(key) || "null"); }
function setRecord(key, obj)     { localStorage.setItem(key, JSON.stringify(obj)); }
function generateId(prefix)      { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

// ---------- Clinic ----------
export const dbClinic = {
  get:    ()     => getRecord(KEYS.CLINIC),
  update: (data) => { setRecord(KEYS.CLINIC, { ...getRecord(KEYS.CLINIC), ...data }); },
};

// ---------- Users ----------
export const dbUsers = {
  getAll:     ()        => getCollection(KEYS.USERS),
  getById:    (id)      => getCollection(KEYS.USERS).find((u) => u.id === id) || null,
  getByEmail: (email)   => getCollection(KEYS.USERS).find((u) => u.email === email) || null,
  getByPhone: (phone)   => getCollection(KEYS.USERS).find((u) => u.phone === phone) || null,
  add: (user) => {
    const users = getCollection(KEYS.USERS);
    const newUser = { ...user, id: generateId("user") };
    setCollection(KEYS.USERS, [...users, newUser]);
    return newUser;
  },
};

// ---------- Patients ----------
export const dbPatients = {
  getAll:  ()   => getCollection(KEYS.PATIENTS),
  getById: (id) => getCollection(KEYS.PATIENTS).find((p) => p.id === id) || null,

  search: (query) => {
    if (!query || query.trim() === "") return getCollection(KEYS.PATIENTS);
    const q = query.trim().toLowerCase();
    return getCollection(KEYS.PATIENTS).filter((p) =>
      (p.full_name    || "").toLowerCase().includes(q) ||
      (p.relation_name|| "").toLowerCase().includes(q) ||
      (p.phone        || "").includes(q)
    );
  },

  add: (patient) => {
    const patients = getCollection(KEYS.PATIENTS);
    const newPatient = {
      ...patient,
      id: generateId("pat"),
      clinic_id: "clinic_001",
      created_at: new Date().toISOString(),
    };
    setCollection(KEYS.PATIENTS, [...patients, newPatient]);
    return newPatient;
  },

  update: (id, data) => {
    const patients = getCollection(KEYS.PATIENTS);
    const updated = patients.map((p) => (p.id === id ? { ...p, ...data } : p));
    setCollection(KEYS.PATIENTS, updated);
  },
};

// ---------- Visits ----------
export const dbVisits = {
  getAll:  ()   => getCollection(KEYS.VISITS),
  getById: (id) => getCollection(KEYS.VISITS).find((v) => v.id === id) || null,

  getByPatient: (patientId) =>
    getCollection(KEYS.VISITS)
      .filter((v) => v.patient_id === patientId)
      .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)),

  /** Doctor's live queue: today's visits with status waiting or in_consultation, ordered by token_number.
   *  Filters by doctorId if provided.
   */
  getTodayQueue: (doctorId) => {
    const today = new Date().toISOString().split("T")[0];
    return getCollection(KEYS.VISITS)
      .filter((v) => {
        const vDate = v.visit_date.split("T")[0];
        const isToday = vDate === today && (v.status === "waiting" || v.status === "in_consultation");
        if (!isToday) return false;
        if (doctorId) return v.doctor_id === doctorId;
        return true;
      })
      .sort((a, b) => a.token_number - b.token_number);
  },

  /** All of today's visits for the reception queue view. */
  getTodayAll: () => {
    const today = new Date().toISOString().split("T")[0];
    return getCollection(KEYS.VISITS)
      .filter((v) => v.visit_date.split("T")[0] === today)
      .sort((a, b) => a.token_number - b.token_number);
  },

  /** Visits awaiting report uploads by reception */
  getPendingReports: () => {
    return getCollection(KEYS.VISITS).filter((v) => v.status === "completed_reports_pending");
  },

  /** Generate the next atomic token for today. */
  nextTokenNumber: () => {
    const today = new Date().toISOString().split("T")[0];
    const todayVisits = getCollection(KEYS.VISITS).filter(
      (v) => v.visit_date.split("T")[0] === today
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
      report_image_urls: [],
    };
    setCollection(KEYS.VISITS, [...visits, newVisit]);
    return newVisit;
  },

  updateStatus: (id, status) => {
    const visits = getCollection(KEYS.VISITS);
    const updated = visits.map((v) => (v.id === id ? { ...v, status } : v));
    setCollection(KEYS.VISITS, updated);
    return updated.find((v) => v.id === id);
  },

  /** Complete a visit — saves prescription photo + report photos.
   *  If forcedStatus is provided, uses that explicitly ('completed' vs 'completed_reports_pending').
   *  Otherwise, defaults to 'completed' if report_image_urls > 0, else 'completed_reports_pending'.
   */
  complete: (id, { prescription_image_url, report_image_urls, notes, forcedStatus }) => {
    const visits = getCollection(KEYS.VISITS);
    const reports = report_image_urls || [];
    const status = forcedStatus || (reports.length > 0 ? "completed" : "completed_reports_pending");
    const updated = visits.map((v) =>
      v.id === id
        ? { ...v, status, prescription_image_url, report_image_urls: reports, notes: notes || v.notes }
        : v
    );
    setCollection(KEYS.VISITS, updated);
    return updated.find((v) => v.id === id);
  },

  /** Attach missing report photos to a completed_reports_pending visit, marking it completed. */
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

  /** Skip a visit — moves status to skipped (can be recalled). */
  skip: (id) => {
    const visits = getCollection(KEYS.VISITS);
    // bump token to end of today's queue
    const today = new Date().toISOString().split("T")[0];
    const maxToken = visits
      .filter((v) => v.visit_date.split("T")[0] === today)
      .reduce((max, v) => Math.max(max, v.token_number || 0), 0);
    const updated = visits.map((v) =>
      v.id === id ? { ...v, status: "skipped", token_number: maxToken + 1 } : v
    );
    setCollection(KEYS.VISITS, updated);
    return updated.find((v) => v.id === id);
  },
};

// ---------- Store Inventory ----------
export const dbInventory = {
  getAll:      ()   => getCollection(KEYS.INVENTORY),
  getById:     (id) => getCollection(KEYS.INVENTORY).find((i) => i.id === id) || null,
  getLowStock: ()   => getCollection(KEYS.INVENTORY).filter((i) => i.stock_qty <= i.low_stock_threshold),

  search: (query) => {
    if (!query || query.trim() === "") return getCollection(KEYS.INVENTORY);
    const q = query.trim().toLowerCase();
    return getCollection(KEYS.INVENTORY).filter((i) =>
      (i.medicine_name || "").toLowerCase().includes(q)
    );
  },

  add: (item) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const newItem = { ...item, id: generateId("inv"), clinic_id: "clinic_001" };
    setCollection(KEYS.INVENTORY, [...inventory, newItem]);
    return newItem;
  },

  deductStock: (id, qty) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) =>
      i.id === id ? { ...i, stock_qty: Math.max(0, i.stock_qty - qty) } : i
    );
    setCollection(KEYS.INVENTORY, updated);
  },

  update: (id, data) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => (i.id === id ? { ...i, ...data } : i));
    setCollection(KEYS.INVENTORY, updated);
  },
};

// ---------- Store Sales (cart-style with discounts and walk-in support) ----------
export const dbSales = {
  getAll: () => getCollection(KEYS.SALES),

  /**
   * Checkout a cart.
   * sale = { visit_id (nullable), items: [{ inventory_id, medicine_name, unit_label, quantity, unit_price, line_total }], discount_amount, tax_amount }
   * Deducts stock for each item and records one sale record for the whole cart.
   */
  checkout: (sale) => {
    const sales = getCollection(KEYS.SALES);
    const subtotal_amount = (sale.items || []).reduce((sum, item) => sum + item.line_total, 0);
    const discount_amount = Number(sale.discount_amount) || 0;
    const tax_amount = Number(sale.tax_amount) || 0;
    const total_amount = Math.max(0, subtotal_amount - discount_amount + tax_amount);

    const newSale = {
      ...sale,
      id: generateId("sale"),
      clinic_id: "clinic_001",
      visit_id: sale.visit_id || null,
      subtotal_amount,
      discount_amount,
      tax_amount,
      total_amount,
      sale_date: new Date().toISOString(),
    };
    setCollection(KEYS.SALES, [...sales, newSale]);
    // Deduct stock for each line item
    (sale.items || []).forEach((item) => {
      dbInventory.deductStock(item.inventory_id, item.quantity);
    });
    return newSale;
  },
};

// ---------- Patient Documents (legacy — kept for any existing usage) ----------
export const dbDocuments = {
  getAll:       ()          => getCollection(KEYS.DOCUMENTS),
  getByPatient: (patientId) => getCollection(KEYS.DOCUMENTS).filter((d) => d.patient_id === patientId),
  add: (doc) => {
    const docs = getCollection(KEYS.DOCUMENTS);
    const newDoc = { ...doc, id: generateId("doc"), uploaded_at: new Date().toISOString() };
    setCollection(KEYS.DOCUMENTS, [...docs, newDoc]);
    return newDoc;
  },
  delete: (id) => {
    const docs = getCollection(KEYS.DOCUMENTS);
    setCollection(KEYS.DOCUMENTS, docs.filter((d) => d.id !== id));
  },
};

// ---------- Clinic Services Catalog ----------
export const dbClinicServices = {
  getAll: () => getCollection(KEYS.SERVICES),
  add: (service) => {
    const services = getCollection(KEYS.SERVICES);
    const newService = { ...service, id: generateId("ser") };
    setCollection(KEYS.SERVICES, [...services, newService]);
    return newService;
  },
  delete: (id) => {
    const services = getCollection(KEYS.SERVICES);
    setCollection(KEYS.SERVICES, services.filter((s) => s.id !== id));
  },
};
