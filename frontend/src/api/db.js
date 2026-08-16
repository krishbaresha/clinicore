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
      is_owner: true,
      can_view_financials: true,
      specialization: "General Physician / M.B.B.S",
      room_number: "Room 1 (General OPD)",
      consultation_fee: 800,
      phone: "03001234567",
      email: "dr.asif@example.com",
      password: "password",
    },
    {
      id: "user_002",
      clinic_id: "clinic_001",
      name: "Sana Malik",
      role: "receptionist",
      is_owner: false,
      can_view_financials: true,
      phone: "03111234567",
      email: "sana.reception@example.com",
      password: "password",
    },
    {
      id: "user_003",
      clinic_id: "clinic_001",
      name: "Kamran Iqbal",
      role: "pharmacist",
      is_owner: false,
      can_view_financials: false,
      phone: "03221234567",
      email: "kamran.store@example.com",
      password: "password",
    },
    {
      id: "user_004",
      clinic_id: "clinic_001",
      name: "Dr. Fatima Khan",
      role: "doctor",
      is_owner: false,
      can_view_financials: false,
      specialization: "Gynecologist & Lady Doctor",
      room_number: "Room 2 (Gyne & Female OPD)",
      consultation_fee: 1000,
      phone: "03009998877",
      email: "dr.fatima@example.com",
      password: "password",
    },
    {
      id: "user_005",
      clinic_id: "clinic_001",
      name: "Dr. Tariq Mahmood",
      role: "doctor",
      is_owner: false,
      can_view_financials: false,
      specialization: "Child Specialist / Pediatrician",
      room_number: "Room 3 (Children OPD)",
      consultation_fee: 900,
      phone: "03335551122",
      email: "dr.tariq@example.com",
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
    {
      id: "inv_001",
      clinic_id: "clinic_001",
      medicine_name: "Panadol 500mg",
      category: "Tablet",
      strength: "500mg",
      has_multi_unit: true,
      strips_per_box: 10,
      units_per_strip: 12,
      box_label: "Box",
      strip_label: "Strip",
      unit_label: "Tablet",
      cost_price_per_box: 600,
      box_sale_price: 900,
      strip_sale_price: 96,
      unit_sale_price: 8,
      total_base_stock: 600,
      stock_qty: 600,
      unit_price: 8,
      cost_price: 5.5,
      low_stock_threshold: 120,
      supplier_id: "sup_001",
      batch_no: "BAT-9981",
      expiry_date: getRelativeDateString(180)
    },
    {
      id: "inv_002",
      clinic_id: "clinic_001",
      medicine_name: "Amoxicillin 500mg",
      category: "Capsule",
      strength: "500mg",
      has_multi_unit: true,
      strips_per_box: 10,
      units_per_strip: 10,
      box_label: "Pack",
      strip_label: "Strip",
      unit_label: "Capsule",
      cost_price_per_box: 1800,
      box_sale_price: 2400,
      strip_sale_price: 250,
      unit_sale_price: 28,
      total_base_stock: 150,
      stock_qty: 150,
      unit_price: 25,
      cost_price: 18,
      low_stock_threshold: 50,
      supplier_id: "sup_002",
      batch_no: "BAT-4412",
      expiry_date: getRelativeDateString(25)
    },
    {
      id: "inv_003",
      clinic_id: "clinic_001",
      medicine_name: "Ascoril Syrup",
      category: "Syrup / Suspension",
      strength: "120ml",
      has_multi_unit: false,
      strips_per_box: 1,
      units_per_strip: 1,
      box_label: "Box",
      strip_label: "Bottle",
      unit_label: "Bottle",
      cost_price_per_box: 130,
      box_sale_price: 180,
      strip_sale_price: 180,
      unit_sale_price: 180,
      total_base_stock: 40,
      stock_qty: 40,
      unit_price: 180,
      cost_price: 130,
      low_stock_threshold: 10,
      supplier_id: "sup_001",
      batch_no: "BAT-1102",
      expiry_date: getRelativeDateString(360)
    },
    {
      id: "inv_004",
      clinic_id: "clinic_001",
      medicine_name: "Ferrous Sulphate",
      category: "Tablet",
      strength: "200mg",
      has_multi_unit: true,
      strips_per_box: 10,
      units_per_strip: 10,
      box_label: "Box",
      strip_label: "Strip",
      unit_label: "Tablet",
      cost_price_per_box: 700,
      box_sale_price: 1000,
      strip_sale_price: 110,
      unit_sale_price: 12,
      total_base_stock: 80,
      stock_qty: 80,
      unit_price: 12,
      cost_price: 8.5,
      low_stock_threshold: 100,
      supplier_id: "sup_003",
      batch_no: "BAT-3091",
      expiry_date: getRelativeDateString(15)
    },
  ],
  suppliers: [
    { id: "sup_001", name: "Getz Pharma Distribution", contact_person: "Tariq Mahmood", phone: "0300-8881122", address: "Site Area, Hyderabad", balance_due: 45000 },
    { id: "sup_002", name: "Searle Medical Agencies",   contact_person: "Zubair Ahmed",  phone: "0321-4445566", address: "Saddar, Hyderabad", balance_due: 18500 },
    { id: "sup_003", name: "AGP Pharma Traders",        contact_person: "Rashid Ali",    phone: "0333-7776655", address: "Latifabad, Hyderabad", balance_due: 0 },
  ],
  purchases: [
    {
      id: "pur_001",
      supplier_id: "sup_001",
      supplier_name: "Getz Pharma Distribution",
      invoice_no: "INV-2026-881",
      purchase_date: getRelativeISOString(-10),
      total_amount: 50000,
      paid_amount: 5000,
      balance_due: 45000,
      payment_status: "partial", // paid, unpaid, partial
      items: [
        { medicine_name: "Panadol 500mg", batch_no: "BAT-9981", expiry_date: getRelativeDateString(180), qty: 150, cost_price: 5.5, sale_price: 8, line_total: 825 },
        { medicine_name: "Ascoril Syrup", batch_no: "BAT-1102", expiry_date: getRelativeDateString(360), qty: 50, cost_price: 130, sale_price: 180, line_total: 6500 }
      ]
    }
  ],
  patient_ledgers: [
    {
      id: "pledge_001",
      patient_id: "pat_001",
      patient_name: "Muhammad Bilal",
      total_credit: 1200,
      total_paid: 400,
      balance_due: 800,
      transactions: [
        { id: "tx_1", date: getRelativeISOString(-3), description: "Pharmacy POS Sale #sale_001 (Udhaar)", amount: 1200, type: "debit" },
        { id: "tx_2", date: getRelativeISOString(-1), description: "Cash Payment Received", amount: 400, type: "credit" }
      ]
    }
  ],
  store_sales: [
    {
      id: "sale_001",
      clinic_id: "clinic_001",
      visit_id: "visit_002",
      payment_type: "cash", // cash, card, credit, partial
      amount_paid: 196,
      balance_due: 0,
      items: [
        { inventory_id: "inv_003", medicine_name: "Ascoril Syrup", unit_label: "bottle", quantity: 1, unit_price: 180, line_total: 180, batch_no: "BAT-1102" },
        { inventory_id: "inv_001", medicine_name: "Panadol 500mg", unit_label: "strip",  quantity: 2, unit_price: 8,   line_total: 16, batch_no: "BAT-9981"  },
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
      payment_type: "cash",
      amount_paid: 40,
      balance_due: 0,
      items: [
        { inventory_id: "inv_001", medicine_name: "Panadol 500mg", unit_label: "strip", quantity: 5, unit_price: 8, line_total: 40, batch_no: "BAT-9981" }
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
      payment_type: "cash",
      amount_paid: 310,
      balance_due: 0,
      items: [
        { inventory_id: "inv_003", medicine_name: "Ascoril Syrup", unit_label: "bottle", quantity: 2, unit_price: 180, line_total: 360, batch_no: "BAT-1102" }
      ],
      subtotal_amount: 360,
      discount_amount: 50,
      tax_amount: 0,
      total_amount: 310,
      sale_date: getRelativeISOString(-1),
    },
  ],
  store_expenses: [
    { id: "exp_001", date: getRelativeISOString(-1), category: "Tea & Refreshment", amount: 180, description: "Tea for pharmacy staff", recorded_by: "Kamran Iqbal" },
    { id: "exp_002", date: getRelativeISOString(-3), category: "Electricity & Utilities", amount: 2500, description: "Monthly pharmacy AC & lighting bill", recorded_by: "Sana Malik" },
    { id: "exp_003", date: getRelativeISOString(-5), category: "Delivery & Freight", amount: 350, description: "Rider delivery charge for urgent medicine stock", recorded_by: "Kamran Iqbal" }
  ],
  store_returns: [
    {
      id: "ret_001",
      sale_id: "sale_002",
      patient_name: "Muhammad Bilal",
      return_date: getRelativeISOString(-1),
      reason: "Doctor changed prescription formula",
      refund_type: "cash",
      refund_amount: 16,
      items: [
        { medicine_name: "Panadol 500mg", unit_label: "strip", quantity_returned: 2, base_units_returned: 24, refund_price: 16 }
      ]
    }
  ]
};

// Keys used in localStorage
const KEYS = {
  SEEDED:          "cf_seeded_v11",   // bumped to v11 for doctor financial permission controls
  CLINIC:          "cf_clinic",
  USERS:           "cf_users",
  PATIENTS:        "cf_patients",
  VISITS:          "cf_visits",
  INVENTORY:       "cf_store_inventory",
  SALES:           "cf_store_sales",
  DOCUMENTS:       "cf_documents",
  SERVICES:        "cf_clinic_services",
  SUPPLIERS:       "cf_suppliers",
  PURCHASES:       "cf_purchases",
  PATIENT_LEDGER:  "cf_patient_ledgers",
  EXPENSES:        "cf_store_expenses",
  RETURNS:         "cf_store_returns",
  STOCK_TRANSFERS: "cf_stock_transfers",
  B2B_SALES:       "cf_b2b_sales",
};

/** Atomic Sequential Invoice / Voucher Generator with distinct prefixes */
export function generateSequentialInvoiceNo(prefix = "INV") {
  const currentYear = new Date().getFullYear();
  const counterKey = `cf_seq_${prefix}_${currentYear}`;
  let count = Number(localStorage.getItem(counterKey) || 0) + 1;
  localStorage.setItem(counterKey, String(count));
  const serial = String(count).padStart(4, "0");
  return `${prefix}-${currentYear}-${serial}`;
}

/** Force reset database to clean demo data */
export function resetDatabaseToDemoData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  ["cf_seeded", "cf_seeded_v2", "cf_seeded_v3", "cf_seeded_v4", "cf_seeded_v5", "cf_seeded_v6", "cf_seeded_v7", "cf_seeded_v8"].forEach((k) => localStorage.removeItem(k));
  
  localStorage.setItem(KEYS.CLINIC,         JSON.stringify(SEED_DATA.clinic));
  localStorage.setItem(KEYS.USERS,          JSON.stringify(SEED_DATA.users));
  localStorage.setItem(KEYS.PATIENTS,       JSON.stringify(SEED_DATA.patients));
  localStorage.setItem(KEYS.VISITS,         JSON.stringify(SEED_DATA.visits));
  localStorage.setItem(KEYS.INVENTORY,      JSON.stringify(SEED_DATA.store_inventory));
  localStorage.setItem(KEYS.SALES,          JSON.stringify(SEED_DATA.store_sales));
  localStorage.setItem(KEYS.SERVICES,       JSON.stringify(SEED_DATA.clinic_services));
  localStorage.setItem(KEYS.SUPPLIERS,      JSON.stringify(SEED_DATA.suppliers));
  localStorage.setItem(KEYS.PURCHASES,      JSON.stringify(SEED_DATA.purchases));
  localStorage.setItem(KEYS.PATIENT_LEDGER, JSON.stringify(SEED_DATA.patient_ledgers));
  localStorage.setItem(KEYS.EXPENSES,       JSON.stringify(SEED_DATA.store_expenses));
  localStorage.setItem(KEYS.RETURNS,        JSON.stringify(SEED_DATA.store_returns));
  localStorage.setItem(KEYS.STOCK_TRANSFERS, JSON.stringify([]));
  localStorage.setItem(KEYS.B2B_SALES,       JSON.stringify([]));
  localStorage.setItem(KEYS.SEEDED, "1");
}

/** Ensure the localStorage DB is initialized with seed data on first load. */
export function initDB() {
  if (!localStorage.getItem(KEYS.DOCUMENTS)) {
    localStorage.setItem(KEYS.DOCUMENTS, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEYS.SERVICES)) {
    localStorage.setItem(KEYS.SERVICES, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEYS.STOCK_TRANSFERS)) {
    localStorage.setItem(KEYS.STOCK_TRANSFERS, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEYS.B2B_SALES)) {
    localStorage.setItem(KEYS.B2B_SALES, JSON.stringify([]));
  }

  // If seeded version 9 is already active, return
  if (localStorage.getItem(KEYS.SEEDED) === "1") return;

  // Otherwise, clear and re-seed clean mock data
  resetDatabaseToDemoData();
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
  update: (id, data) => {
    const users = getCollection(KEYS.USERS);
    const updated = users.map((u) => (u.id === id ? { ...u, ...data } : u));
    setCollection(KEYS.USERS, updated);
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

  /** Re-issue a new token for a late skipped patient at the END of the queue with Rs. 0 fee (Pre-paid link). */
  reissueLateToken: (visitId) => {
    const visits = getCollection(KEYS.VISITS);
    const originalVisit = visits.find((v) => v.id === visitId);
    if (!originalVisit) return null;

    // 1. Mark original visit as 'skipped_reissued'
    const updatedVisits = visits.map((v) =>
      v.id === visitId ? { ...v, status: "skipped_reissued" } : v
    );
    setCollection(KEYS.VISITS, updatedVisits);

    // 2. Issue a NEW fresh token for today at the end of the queue with fee_amount = 0 (Pre-paid)
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
      fee_amount: 0, // Zero fee because fee was already paid on originalVisit
      fee_waived_reason: `Re-issued from Skipped Token #${originalVisit.token_number} (Already Paid)`,
      original_visit_id: originalVisit.id,
      prescription_image_url: null,
      report_image_urls: [],
      notes: `Late Arrival — Re-issued from Token #${originalVisit.token_number}`,
    };

    setCollection(KEYS.VISITS, [...getCollection(KEYS.VISITS), newVisit]);
    return newVisit;
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

// ---------- Multi-Unit Inventory Helpers ----------
export function convertUnitsToBase(qty, unitType, item) {
  const quantity = Number(qty) || 0;
  if (!item || !item.has_multi_unit) return quantity;

  const stripsPerBox = Number(item.strips_per_box) || 1;
  const unitsPerStrip = Number(item.units_per_strip) || 1;

  if (unitType === "box") {
    return quantity * (stripsPerBox * unitsPerStrip);
  } else if (unitType === "strip") {
    return quantity * unitsPerStrip;
  }
  return quantity; // "unit" / tablet
}

export function formatStockBreakdown(item) {
  if (!item) return "0 Units";
  const baseStock = Math.max(0, Number(item.total_base_stock ?? item.stock_qty) || 0);

  if (!item.has_multi_unit) {
    const label = item.unit_label || "unit";
    return `${baseStock} ${label}${baseStock === 1 ? "" : "s"}`;
  }

  const stripsPerBox = Number(item.strips_per_box) || 1;
  const unitsPerStrip = Number(item.units_per_strip) || 1;
  const unitsPerBox = stripsPerBox * unitsPerStrip;

  if (unitsPerBox <= 1) {
    return `${baseStock} ${item.unit_label || "Tablet"}s`;
  }

  const boxes = Math.floor(baseStock / unitsPerBox);
  const remAfterBoxes = baseStock % unitsPerBox;
  const strips = Math.floor(remAfterBoxes / unitsPerStrip);
  const looseUnits = remAfterBoxes % unitsPerStrip;

  const parts = [];
  if (boxes > 0) parts.push(`${boxes} ${item.box_label || "Box"}${boxes > 1 ? "es" : ""}`);
  if (strips > 0) parts.push(`${strips} ${item.strip_label || "Strip"}${strips > 1 ? "s" : ""}`);
  if (looseUnits > 0 || parts.length === 0) parts.push(`${looseUnits} ${item.unit_label || "Tablet"}${looseUnits > 1 ? "s" : ""}`);

  return `${parts.join(", ")} (${baseStock} Total ${item.unit_label || "Tablet"}s)`;
}

export function formatStockShort(item) {
  if (!item) return "0 Units";
  const baseStock = Math.max(0, Number(item.total_base_stock ?? item.stock_qty) || 0);
  if (!item.has_multi_unit) {
    return `${baseStock} ${item.unit_label || "unit"}`;
  }

  const stripsPerBox = Number(item.strips_per_box) || 1;
  const unitsPerStrip = Number(item.units_per_strip) || 1;
  const unitsPerBox = stripsPerBox * unitsPerStrip;

  const boxes = Math.floor(baseStock / unitsPerBox);
  const remAfterBoxes = baseStock % unitsPerBox;
  const strips = Math.floor(remAfterBoxes / unitsPerStrip);
  const loose = remAfterBoxes % unitsPerStrip;

  const parts = [];
  if (boxes > 0) parts.push(`${boxes} Box`);
  if (strips > 0) parts.push(`${strips} Strip`);
  if (loose > 0 || parts.length === 0) parts.push(`${loose} ${item.unit_label || "Tab"}`);

  return parts.join(", ");
}

// ---------- Store Inventory ----------
export const dbInventory = {
  getAll:      ()   => getCollection(KEYS.INVENTORY),
  getById:     (id) => getCollection(KEYS.INVENTORY).find((i) => i.id === id) || null,
  getLowStock: ()   => getCollection(KEYS.INVENTORY).filter((i) => (i.total_base_stock ?? i.stock_qty) <= (i.low_stock_threshold || 20)),

  search: (query) => {
    if (!query || query.trim() === "") return getCollection(KEYS.INVENTORY);
    const q = query.trim().toLowerCase();
    return getCollection(KEYS.INVENTORY).filter((i) =>
      (i.medicine_name || "").toLowerCase().includes(q)
    );
  },

  add: (item) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const stripsPerBox = Number(item.strips_per_box) || 10;
    const unitsPerStrip = Number(item.units_per_strip) || 12;

    let baseStock = Number(item.total_base_stock);
    if (isNaN(baseStock) || baseStock === undefined) {
      baseStock = item.has_multi_unit
        ? (Number(item.stock_qty) || 0) * (stripsPerBox * unitsPerStrip)
        : (Number(item.stock_qty) || 0);
    }

    const newItem = {
      ...item,
      id: generateId("inv"),
      clinic_id: "clinic_001",
      has_multi_unit: Boolean(item.has_multi_unit),
      strips_per_box: stripsPerBox,
      units_per_strip: unitsPerStrip,
      box_label: item.box_label || "Box",
      strip_label: item.strip_label || "Strip",
      unit_label: item.unit_label || "Tablet",
      cost_price_per_box: Number(item.cost_price_per_box) || 0,
      box_sale_price: Number(item.box_sale_price) || 0,
      strip_sale_price: Number(item.strip_sale_price) || 0,
      unit_sale_price: Number(item.unit_sale_price) || Number(item.unit_price) || 0,
      total_base_stock: baseStock,
      stock_qty: baseStock,
      unit_price: Number(item.unit_sale_price) || Number(item.unit_price) || 0,
      low_stock_threshold: Number(item.low_stock_threshold) || 20,
    };
    setCollection(KEYS.INVENTORY, [...inventory, newItem]);
    return newItem;
  },

  deductStock: (id, baseQty) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => {
      if (i.id !== id) return i;
      const currentBase = i.total_base_stock ?? i.stock_qty ?? 0;
      const newBase = Math.max(0, currentBase - baseQty);
      const currentStore = i.store_stock ?? currentBase;
      const newStore = Math.max(0, currentStore - baseQty);
      return {
        ...i,
        total_base_stock: newBase,
        stock_qty: newStore,
        store_stock: newStore,
      };
    });
    setCollection(KEYS.INVENTORY, updated);
  },

  addStock: (id, baseQty) => {
    const inventory = getCollection(KEYS.INVENTORY);
    const updated = inventory.map((i) => {
      if (i.id !== id) return i;
      const currentBase = i.total_base_stock ?? i.stock_qty ?? 0;
      const newBase = currentBase + baseQty;
      const currentWarehouse = i.warehouse_stock ?? currentBase;
      const newWarehouse = currentWarehouse + baseQty;
      return {
        ...i,
        total_base_stock: newBase,
        warehouse_stock: newWarehouse,
        stock_qty: i.store_stock ?? newBase,
      };
    });
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
    // Deduct stock for each line item (converting to base units if needed)
    (sale.items || []).forEach((item) => {
      const invItem = dbInventory.getById(item.inventory_id);
      const baseQty = item.base_units_deducted || convertUnitsToBase(item.quantity, item.selected_unit_type || "unit", invItem);
      dbInventory.deductStock(item.inventory_id, baseQty);
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

// ---------- Pharma Suppliers ----------
export const dbSuppliers = {
  getAll: () => getCollection(KEYS.SUPPLIERS),
  getById: (id) => getCollection(KEYS.SUPPLIERS).find((s) => s.id === id) || null,
  add: (supplier) => {
    const suppliers = getCollection(KEYS.SUPPLIERS);
    const newSup = { ...supplier, id: generateId("sup"), balance_due: 0 };
    setCollection(KEYS.SUPPLIERS, [...suppliers, newSup]);
    return newSup;
  },
  recordPayment: (supplierId, paymentAmount) => {
    const suppliers = getCollection(KEYS.SUPPLIERS);
    const sup = suppliers.find((s) => s.id === supplierId);
    const amt = Number(paymentAmount) || 0;
    const updated = suppliers.map((s) =>
      s.id === supplierId
        ? { ...s, balance_due: Math.max(0, (s.balance_due || 0) - amt) }
        : s
    );
    setCollection(KEYS.SUPPLIERS, updated);

    // Auto-record Supplier Khata Payment in Clinic Daily Expenses
    if (amt > 0) {
      dbExpenses.add({
        category: "Supplier Khata Payment",
        amount: amt,
        expense_date: new Date().toISOString(),
        notes: `Cash Payment to Distributor (${sup?.name || "Pharma Supplier"})`
      });
    }
  },
};

// ---------- Company Purchases (Stock Receiving & Bills) ----------
export const dbPurchases = {
  getAll: () => getCollection(KEYS.PURCHASES),
  add: (purchase) => {
    const purchases = getCollection(KEYS.PURCHASES);
    const suppliers = getCollection(KEYS.SUPPLIERS);

    const total_amount = Number(purchase.total_amount) || 0;
    const paid_amount = Number(purchase.paid_amount) || 0;
    const balance_due = Math.max(0, total_amount - paid_amount);
    const payment_status = balance_due === 0 ? "paid" : paid_amount > 0 ? "partial" : "unpaid";

    const newPurchase = {
      ...purchase,
      id: generateId("pur"),
      total_amount,
      paid_amount,
      balance_due,
      payment_status,
      purchase_date: new Date().toISOString(),
    };

    setCollection(KEYS.PURCHASES, [...purchases, newPurchase]);

    // Auto-record Supplier Payment in Clinic Daily Expenses if paid upfront cash
    if (paid_amount > 0) {
      dbExpenses.add({
        category: "Stock Purchase Cash Payment",
        amount: paid_amount,
        expense_date: new Date().toISOString(),
        notes: `Bill #${newPurchase.invoice_no || newPurchase.id} (${newPurchase.supplier_name || "Supplier"})`
      });
    }

    // Update Supplier Balance
    if (balance_due > 0 && purchase.supplier_id) {
      const updatedSuppliers = suppliers.map((s) =>
        s.id === purchase.supplier_id
          ? { ...s, balance_due: (s.balance_due || 0) + balance_due }
          : s
      );
      setCollection(KEYS.SUPPLIERS, updatedSuppliers);
    }

    // Add or update items in inventory
    (purchase.items || []).forEach((item) => {
      const invList = dbInventory.getAll();
      const existing = invList.find((i) => i.medicine_name.toLowerCase() === item.medicine_name.toLowerCase());
      
      const receivedUnitType = item.received_unit_type || (item.has_multi_unit ? "box" : "unit");
      const baseQtyAdded = convertUnitsToBase(Number(item.qty), receivedUnitType, existing || item);

      if (existing) {
        dbInventory.addStock(existing.id, baseQtyAdded);
        dbInventory.update(existing.id, {
          cost_price_per_box: Number(item.cost_price) || existing.cost_price_per_box,
          box_sale_price: Number(item.sale_price) || existing.box_sale_price,
          unit_sale_price: Number(item.unit_sale_price) || existing.unit_sale_price,
          strip_sale_price: Number(item.strip_sale_price) || existing.strip_sale_price,
          batch_no: item.batch_no || existing.batch_no,
          expiry_date: item.expiry_date || existing.expiry_date,
        });
      } else {
        const stripsPerBox = Number(item.strips_per_box) || 10;
        const unitsPerStrip = Number(item.units_per_strip) || 12;
        dbInventory.add({
          medicine_name: item.medicine_name,
          category: item.category || "Tablet",
          strength: item.strength || "",
          has_multi_unit: Boolean(item.has_multi_unit ?? true),
          strips_per_box: stripsPerBox,
          units_per_strip: unitsPerStrip,
          box_label: item.box_label || "Box",
          strip_label: item.strip_label || "Strip",
          unit_label: item.unit_label || "Tablet",
          cost_price_per_box: Number(item.cost_price) || 0,
          box_sale_price: Number(item.sale_price) || 0,
          strip_sale_price: Number(item.strip_sale_price) || 0,
          unit_sale_price: Number(item.unit_sale_price) || 0,
          total_base_stock: baseQtyAdded,
          stock_qty: baseQtyAdded,
          low_stock_threshold: 20,
          supplier_id: purchase.supplier_id,
          batch_no: item.batch_no,
          expiry_date: item.expiry_date,
        });
      }
    });

    return newPurchase;
  },

  deleteInvoice: (id) => {
    const purchases = getCollection(KEYS.PURCHASES);
    const target = purchases.find((p) => p.id === id || p.invoice_no === id);
    if (!target) return;

    // 1. Revert Supplier Balance Due
    if (target.supplier_id && target.balance_due > 0) {
      const suppliers = getCollection(KEYS.SUPPLIERS);
      const updatedSuppliers = suppliers.map((s) =>
        s.id === target.supplier_id
          ? { ...s, balance_due: Math.max(0, (s.balance_due || 0) - target.balance_due) }
          : s
      );
      setCollection(KEYS.SUPPLIERS, updatedSuppliers);
    }

    // 2. Revert/Deduct Added Inventory Stock
    (target.items || []).forEach((item) => {
      const invList = dbInventory.getAll();
      const existing = invList.find((i) => i.medicine_name.toLowerCase() === item.medicine_name.toLowerCase());
      if (existing) {
        const receivedUnitType = item.received_unit_type || (item.has_multi_unit ? "box" : "unit");
        const baseQty = convertUnitsToBase(Number(item.qty), receivedUnitType, existing);
        dbInventory.deductStock(existing.id, baseQty);
      }
    });

    // 3. Remove purchase record
    setCollection(KEYS.PURCHASES, purchases.filter((p) => p.id !== target.id));
  },
};

// ---------- Patient Credit / Udhaar Ledger ----------
export const dbPatientLedger = {
  getAll: () => getCollection(KEYS.PATIENT_LEDGER),
  getByPatient: (patientId) => getCollection(KEYS.PATIENT_LEDGER).find((l) => l.patient_id === patientId) || null,
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
  receivePayment: (patientId, amount) => {
    const ledgers = getCollection(KEYS.PATIENT_LEDGER);
    const tx = {
      id: generateId("tx"),
      date: new Date().toISOString(),
      description: "Cash Payment Received",
      amount: Number(amount),
      type: "credit",
    };
    const updated = ledgers.map((l) =>
      l.patient_id === patientId
        ? {
            ...l,
            total_paid: (l.total_paid || 0) + Number(amount),
            balance_due: Math.max(0, l.balance_due - Number(amount)),
            transactions: [tx, ...(l.transactions || [])],
          }
        : l
    );
    setCollection(KEYS.PATIENT_LEDGER, updated);
  },
};

// ---------- Pharmacy Daily Expenses (Kharchay) ----------
export const dbExpenses = {
  getAll: () => getCollection(KEYS.EXPENSES),
  add: (expense) => {
    const list = getCollection(KEYS.EXPENSES);
    const newExp = {
      ...expense,
      id: generateId("exp"),
      amount: Number(expense.amount) || 0,
      date: expense.date || new Date().toISOString()
    };
    setCollection(KEYS.EXPENSES, [newExp, ...list]);
    return newExp;
  },
  delete: (id) => {
    const list = getCollection(KEYS.EXPENSES);
    setCollection(KEYS.EXPENSES, list.filter((e) => e.id !== id));
  }
};

// ---------- Sales Returns & Exchanges ----------
export const dbReturns = {
  getAll: () => getCollection(KEYS.RETURNS),
  processReturn: ({ sale_id, return_items, reason, refund_type }) => {
    const sales = getCollection(KEYS.SALES);
    const targetSale = sales.find((s) => s.id === sale_id);
    if (!targetSale) throw new Error("Sale receipt not found.");

    // Proportional discount factor: if receipt had a discount, scale line refunds proportionally
    const saleSubtotal = Number(targetSale.subtotal_amount) || Number(targetSale.total_amount) || 1;
    const saleNetTotal = Number(targetSale.total_amount) || saleSubtotal;
    const discountRatio = saleSubtotal > 0 ? (saleNetTotal / saleSubtotal) : 1;

    let totalRefundAmount = 0;
    const processedReturnItems = [];

    (return_items || []).forEach((rItem) => {
      const invItem = dbInventory.getById(rItem.inventory_id);
      const qtyReturned = Number(rItem.quantity_returned) || 0;
      if (qtyReturned <= 0) return;

      const baseUnitsReturned = rItem.base_units_returned || convertUnitsToBase(qtyReturned, rItem.selected_unit_type || "unit", invItem);
      
      // Restock inventory automatically
      if (invItem) {
        dbInventory.addStock(invItem.id, baseUnitsReturned);
      }

      const grossPrice = (Number(rItem.unit_price) || 0) * qtyReturned;
      const itemLineRefund = Number((grossPrice * discountRatio).toFixed(2));
      totalRefundAmount += itemLineRefund;

      processedReturnItems.push({
        inventory_id: rItem.inventory_id,
        medicine_name: rItem.medicine_name,
        selected_unit_type: rItem.selected_unit_type,
        unit_label: rItem.unit_label,
        quantity_returned: qtyReturned,
        base_units_returned: baseUnitsReturned,
        refund_price: itemLineRefund
      });
    });

    totalRefundAmount = Number(totalRefundAmount.toFixed(2));

    const returns = getCollection(KEYS.RETURNS);
    const newReturn = {
      id: generateId("ret"),
      sale_id,
      patient_name: targetSale.patient_name || "Walk-in Customer",
      return_date: new Date().toISOString(),
      reason: reason || "Customer request",
      refund_type: refund_type || "cash",
      refund_amount: totalRefundAmount,
      items: processedReturnItems
    };

    setCollection(KEYS.RETURNS, [newReturn, ...returns]);

    // Auto-record cash refund in daily expenses
    if (refund_type === "cash" && totalRefundAmount > 0) {
      dbExpenses.add({
        category: "Sales Return Refund",
        amount: totalRefundAmount,
        expense_date: new Date().toISOString(),
        notes: `Cash Refund for Sale Receipt #${targetSale.id}`
      });
    }

    // If refund_type is credit and targetSale had balance_due / linkedPatient
    if (refund_type === "credit" && targetSale.patient_name) {
      const patients = getCollection(KEYS.PATIENTS);
      const patient = patients.find((p) => p.full_name.toLowerCase() === targetSale.patient_name.toLowerCase());
      if (patient) {
        dbPatientLedger.receivePayment(patient.id, totalRefundAmount);
      }
    }

    return newReturn;
  }
};

// ---------- Internal Stock Transfers (Warehouse -> Store) ----------
export const dbStockTransfers = {
  getAll: () => getCollection(KEYS.STOCK_TRANSFERS),
  transfer: (data) => {
    // data = { inventory_id, medicine_name, qty, from_loc, to_loc, notes, transferred_by }
    const transfers = getCollection(KEYS.STOCK_TRANSFERS);
    const transferNo = generateSequentialInvoiceNo("TRF");
    const newTransfer = {
      ...data,
      id: generateId("trf"),
      transfer_no: transferNo,
      transfer_date: new Date().toISOString(),
    };
    setCollection(KEYS.STOCK_TRANSFERS, [newTransfer, ...transfers]);

    // Move inventory stock from warehouse to store
    const inv = dbInventory.getById(data.inventory_id);
    if (inv) {
      const qty = Number(data.qty) || 0;
      const wStock = Math.max(0, (inv.warehouse_stock ?? inv.total_base_stock ?? inv.stock_qty ?? 0) - qty);
      const sStock = Math.max(0, (inv.store_stock ?? 0) + qty);
      dbInventory.update(inv.id, {
        warehouse_stock: wStock,
        store_stock: sStock,
        total_base_stock: wStock + sStock,
        stock_qty: sStock, // store stock active for retail POS
      });
    }
    return newTransfer;
  },
};

// ---------- Wholesale B2B Sales (Warehouse -> Other Clinics / Chemists) ----------
export const dbB2BSales = {
  getAll: () => getCollection(KEYS.B2B_SALES),
  checkout: (saleData) => {
    // saleData = { buyer_name, buyer_phone, buyer_address, items: [...], total_amount, paid_amount, balance_due, payment_type: "cash"|"credit" }
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

    setCollection(KEYS.B2B_SALES, [newB2BSale, ...sales]);

    // Deduct stock from Warehouse Stock
    (saleData.items || []).forEach((item) => {
      const inv = dbInventory.getById(item.inventory_id);
      if (inv) {
        const qty = Number(item.qty_base_units || item.quantity || item.qty) || 0;
        const wStock = Math.max(0, (inv.warehouse_stock ?? inv.total_base_stock ?? inv.stock_qty ?? 0) - qty);
        const sStock = inv.store_stock ?? 0;
        dbInventory.update(inv.id, {
          warehouse_stock: wStock,
          total_base_stock: wStock + sStock,
        });
      }
    });

    // If Credit, update Buyer Khata Ledger
    if (balanceDue > 0 && saleData.buyer_id) {
      dbPatientLedger.addCredit(saleData.buyer_id, saleData.buyer_name, balanceDue, `Wholesale Invoice #${invoiceNo}`);
    }

    return newB2BSale;
  },
};

/** Export entire clinic database to a standalone JSON object for backup (Includes 100% Data, Photos & Sequences) */
export function exportFullDatabase() {
  const backup = {
    version: "3.6.0",
    export_date: new Date().toISOString(),
    clinic_name: dbClinic.get()?.name || "ClinicFlow",
    data: {},
    all_cf_keys: {}
  };

  // Export ALL localStorage keys starting with "cf_" (includes all collections, photos, sequence counters & settings)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("cf_")) {
      try {
        const raw = localStorage.getItem(key);
        backup.all_cf_keys[key] = raw ? JSON.parse(raw) : null;
      } catch {
        backup.all_cf_keys[key] = localStorage.getItem(key);
      }
    }
  }

  // Populate explicit data object for backward compatibility
  Object.entries(KEYS).forEach(([_, storageKey]) => {
    try {
      const raw = localStorage.getItem(storageKey);
      backup.data[storageKey] = raw ? JSON.parse(raw) : null;
    } catch {
      backup.data[storageKey] = null;
    }
  });

  return backup;
}

/** Restore/Import clinic database from a JSON backup file without data loss or corruption */
export function importFullDatabase(backupObj) {
  if (!backupObj || typeof backupObj !== "object" || (!backupObj.data && !backupObj.all_cf_keys)) {
    throw new Error("Invalid backup file format. Must contain valid data object.");
  }

  // Restore all "cf_" prefixed keys (collections, images, sequence counters, settings)
  if (backupObj.all_cf_keys) {
    Object.entries(backupObj.all_cf_keys).forEach(([storageKey, value]) => {
      if (value !== null && value !== undefined) {
        localStorage.setItem(storageKey, typeof value === "object" ? JSON.stringify(value) : value);
      }
    });
  }

  // Fallback for older legacy backups
  if (backupObj.data) {
    Object.entries(backupObj.data).forEach(([storageKey, value]) => {
      if (value !== null && value !== undefined) {
        localStorage.setItem(storageKey, typeof value === "object" ? JSON.stringify(value) : value);
      }
    });
  }

  localStorage.setItem(KEYS.SEEDED, "1");
  return true;
}


