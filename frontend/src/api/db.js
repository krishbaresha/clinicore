// Dynamic date helpers to keep mock data relative to the current calendar date
function getRelativeISOString(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString();
}

function getRelativeDateString(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split("T")[0];
}

const SEED_DATA = {
  clinic: {
    id: "clinic_001",
    name: "Dr. Ahmed's Clinic",
    logo_url: "",
    address: "Auto Bhan Road, Hyderabad, Sindh, Pakistan",
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
      name: "Dr. Ahmed Raza",
      role: "doctor",
      phone: "03001234567",
      email: "dr.ahmed@example.com",
      // Default password: 'password' — same as the seed script
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
  ],
  patients: [
    {
      id: "pat_001",
      clinic_id: "clinic_001",
      full_name: "Muhammad Bilal",
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
      phone: "03007779988",
      cnic: "",
      age: 58,
      gender: "male",
      created_at: "2022-11-20T09:15:00Z",
    },
  ],
  visits: [
    {
      id: "visit_001",
      patient_id: "pat_001",
      clinic_id: "clinic_001",
      visit_date: getRelativeISOString(-5),
      symptoms: "Fever, sore throat, body ache",
      diagnosis: "Viral flu",
      fee_amount: 800,
      follow_up_date: getRelativeDateString(-2),
      notes: "Advised rest and fluids",
    },
    {
      id: "visit_002",
      patient_id: "pat_001",
      clinic_id: "clinic_001",
      visit_date: getRelativeISOString(0), // Today!
      symptoms: "Persistent cough, mild chest discomfort",
      diagnosis: "Bronchitis",
      fee_amount: 1000,
      follow_up_date: getRelativeDateString(10), // 10 days from now
      notes: "Patient returned after 2 years — history retrieved successfully",
    },
    {
      id: "visit_003",
      patient_id: "pat_002",
      clinic_id: "clinic_001",
      visit_date: getRelativeISOString(-2),
      symptoms: "Headache, dizziness",
      diagnosis: "Low blood pressure",
      fee_amount: 900,
      follow_up_date: null,
      notes: "",
    },
    {
      id: "visit_004",
      patient_id: "pat_003",
      clinic_id: "clinic_001",
      visit_date: getRelativeISOString(-10),
      symptoms: "Joint pain, difficulty walking",
      diagnosis: "Early-stage arthritis",
      fee_amount: 1200,
      follow_up_date: getRelativeDateString(-3),
      notes: "Referred for X-ray",
    },
  ],
  prescription_items: [
    { id: "rx_001", visit_id: "visit_001", medicine_name: "Panadol",          dosage: "1 tablet, twice daily",    duration: "5 days"  },
    { id: "rx_002", visit_id: "visit_001", medicine_name: "Amoxicillin 500mg", dosage: "1 capsule, 3 times daily", duration: "7 days"  },
    { id: "rx_003", visit_id: "visit_002", medicine_name: "Ascoril Syrup",     dosage: "10ml, twice daily",        duration: "6 days"  },
    { id: "rx_004", visit_id: "visit_003", medicine_name: "Ferrous Sulphate",  dosage: "1 tablet daily",           duration: "30 days" },
    { id: "rx_005", visit_id: "visit_004", medicine_name: "Voltral SR",        dosage: "1 tablet, twice daily",    duration: "10 days" },
  ],
  store_inventory: [
    { id: "inv_001", clinic_id: "clinic_001", medicine_name: "Panadol",          stock_qty: 120, unit_price: 8,   low_stock_threshold: 20 },
    { id: "inv_002", clinic_id: "clinic_001", medicine_name: "Amoxicillin 500mg", stock_qty: 15,  unit_price: 25,  low_stock_threshold: 20 },
    { id: "inv_003", clinic_id: "clinic_001", medicine_name: "Ascoril Syrup",     stock_qty: 40,  unit_price: 180, low_stock_threshold: 10 },
    { id: "inv_004", clinic_id: "clinic_001", medicine_name: "Ferrous Sulphate",  stock_qty: 8,   unit_price: 12,  low_stock_threshold: 15 },
  ],
  store_sales: [
    { id: "sale_001", clinic_id: "clinic_001", inventory_id: "inv_001", quantity_sold: 2, sale_amount: 16,  sale_date: getRelativeISOString(-1),  linked_visit_id: null        },
    { id: "sale_002", clinic_id: "clinic_001", inventory_id: "inv_003", quantity_sold: 1, sale_amount: 180, sale_date: getRelativeISOString(0),   linked_visit_id: "visit_002" },
  ],
};

// Keys used in localStorage
const KEYS = {
  SEEDED:     "cf_seeded_v3",
  CLINIC:     "cf_clinic",
  USERS:      "cf_users",
  PATIENTS:   "cf_patients",
  VISITS:     "cf_visits",
  PRESCRIPTIONS: "cf_prescription_items",
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
  // If seeded version 3 is already active, return
  if (localStorage.getItem(KEYS.SEEDED) === "1") return;
  
  // Clean old seeds to avoid data version conflicts
  localStorage.removeItem("cf_seeded");
  localStorage.removeItem("cf_seeded_v2");
  
  localStorage.setItem(KEYS.CLINIC,        JSON.stringify(SEED_DATA.clinic));
  localStorage.setItem(KEYS.USERS,         JSON.stringify(SEED_DATA.users));
  localStorage.setItem(KEYS.PATIENTS,      JSON.stringify(SEED_DATA.patients));
  localStorage.setItem(KEYS.VISITS,        JSON.stringify(SEED_DATA.visits));
  localStorage.setItem(KEYS.PRESCRIPTIONS, JSON.stringify(SEED_DATA.prescription_items));
  localStorage.setItem(KEYS.INVENTORY,     JSON.stringify(SEED_DATA.store_inventory));
  localStorage.setItem(KEYS.SALES,         JSON.stringify(SEED_DATA.store_sales));
  localStorage.setItem(KEYS.SERVICES,      JSON.stringify(SEED_DATA.clinic_services));
  localStorage.setItem(KEYS.SEEDED, "1");
}

// ---------- Generic helpers ----------

function getCollection(key)         { return JSON.parse(localStorage.getItem(key) || "[]"); }
function setCollection(key, arr)    { localStorage.setItem(key, JSON.stringify(arr)); }
function getRecord(key)             { return JSON.parse(localStorage.getItem(key) || "null"); }
function setRecord(key, obj)        { localStorage.setItem(key, JSON.stringify(obj)); }
function generateId(prefix)         { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

// ---------- Clinic ----------
export const dbClinic = {
  get:    ()     => getRecord(KEYS.CLINIC),
  update: (data) => { setRecord(KEYS.CLINIC, { ...getRecord(KEYS.CLINIC), ...data }); },
};

// ---------- Users ----------
export const dbUsers = {
  getAll:   ()         => getCollection(KEYS.USERS),
  getById:  (id)       => getCollection(KEYS.USERS).find((u) => u.id === id) || null,
  getByEmail: (email)  => getCollection(KEYS.USERS).find((u) => u.email === email) || null,
  add: (user) => {
    const users = getCollection(KEYS.USERS);
    const newUser = { ...user, id: generateId("user") };
    setCollection(KEYS.USERS, [...users, newUser]);
    return newUser;
  },
};

// ---------- Patients ----------
export const dbPatients = {
  getAll: () => getCollection(KEYS.PATIENTS),
  getById: (id) => getCollection(KEYS.PATIENTS).find((p) => p.id === id) || null,
  search: (query) => {
    if (!query || query.trim() === "") return getCollection(KEYS.PATIENTS);
    const q = query.trim().toLowerCase();
    return getCollection(KEYS.PATIENTS).filter(
      (p) => p.full_name.toLowerCase().includes(q) || p.phone.includes(q)
    );
  },
  add: (patient) => {
    const patients = getCollection(KEYS.PATIENTS);
    const newPatient = { ...patient, id: generateId("pat"), clinic_id: "clinic_001", created_at: new Date().toISOString() };
    setCollection(KEYS.PATIENTS, [...patients, newPatient]);
    return newPatient;
  },
};

// ---------- Visits ----------
export const dbVisits = {
  getAll: () => getCollection(KEYS.VISITS),
  getById: (id) => getCollection(KEYS.VISITS).find((v) => v.id === id) || null,
  getByPatient: (patientId) =>
    getCollection(KEYS.VISITS)
      .filter((v) => v.patient_id === patientId)
      .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)),
  add: (visit) => {
    const visits = getCollection(KEYS.VISITS);
    const newVisit = { ...visit, id: generateId("visit"), clinic_id: "clinic_001", visit_date: new Date().toISOString() };
    setCollection(KEYS.VISITS, [...visits, newVisit]);
    return newVisit;
  },
};

// ---------- Prescription Items ----------
export const dbPrescriptions = {
  getByVisit: (visitId) => getCollection(KEYS.PRESCRIPTIONS).filter((r) => r.visit_id === visitId),
  addBulk: (visitId, items) => {
    const existing = getCollection(KEYS.PRESCRIPTIONS);
    const newItems = items.map((item) => ({ ...item, id: generateId("rx"), visit_id: visitId }));
    setCollection(KEYS.PRESCRIPTIONS, [...existing, ...newItems]);
    return newItems;
  },
};

// ---------- Store Inventory ----------
export const dbInventory = {
  getAll: () => getCollection(KEYS.INVENTORY),
  getById: (id) => getCollection(KEYS.INVENTORY).find((i) => i.id === id) || null,
  getLowStock: () => getCollection(KEYS.INVENTORY).filter((i) => i.stock_qty <= i.low_stock_threshold),
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

// ---------- Store Sales ----------
export const dbSales = {
  getAll: () => getCollection(KEYS.SALES),
  add: (sale) => {
    const sales = getCollection(KEYS.SALES);
    const newSale = { ...sale, id: generateId("sale"), clinic_id: "clinic_001", sale_date: new Date().toISOString() };
    setCollection(KEYS.SALES, [...sales, newSale]);
    // Automatically deduct stock
    dbInventory.deductStock(sale.inventory_id, sale.quantity_sold);
    return newSale;
  },
};

// ---------- Patient Documents ----------
export const dbDocuments = {
  getAll: () => getCollection(KEYS.DOCUMENTS),
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
  }
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
  }
};
