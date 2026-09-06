/**
 * scripts/test.js
 * Comprehensive Security, RBAC, Super Admin & Software Licensing Test Suite
 */

if (typeof window === "undefined" || !globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null,
  };
}

if (typeof window === "undefined" || !globalThis.sessionStorage) {
  const sessionStore = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => sessionStore.get(k) || null,
    setItem: (k, v) => sessionStore.set(k, String(v)),
    removeItem: (k) => sessionStore.delete(k),
    clear: () => sessionStore.clear(),
  };
}

globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  location: { pathname: "/dashboard" },
};

import {
  resetDatabaseToDemoData,
  dbClinic,
  dbUsers,
  dbWarehouses,
  dbInventory,
  dbPurchases,
  dbSales,
  dbB2BSales,
  dbExpenses,
  dbVisits,
  dbPatients,
  dbCashBook,
  dbLicense,
  dbOutbox,
  hashPassword,
} from "../src/api/db.js";

import {
  login,
  logout,
  getSession,
  checkAuthorization,
  assertAuthorized,
  getAdminPasscode,
  verifyAdminPasscode,
} from "../src/api/auth.js";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function suite(name, fn) {
  console.log(`\n======================================================`);
  console.log(`🛡️ QA SUITE: ${name}`);
  console.log(`======================================================`);
  try {
    await fn();
  } catch (err) {
    console.error(`💥 Suite Failure in "${name}":`, err.message);
  }
}

export async function runSecurityQASuite() {
  console.log("🚀 Starting ClinicFlow Security, RBAC, Admin & Licensing QA Suite...\n");

  // Reset database to clean known state
  resetDatabaseToDemoData();

  // =========================================================================
  // SECTION 1: AUTHENTICATION & SESSION MANAGEMENT
  // =========================================================================
  await suite("1. Authentication & Session Management", () => {
    // 1.1 Password Hashing verification
    const rawPass = "Secret@2026";
    const hashed = hashPassword(rawPass);
    assert(hashed && hashed.startsWith("hashed_") && hashed.length >= 15, "Password hashing produces deterministic 'hashed_' digest");
    assert(hashed === hashPassword(rawPass), "hashPassword is idempotent and deterministic");
    assert(hashed !== hashPassword("Secret@2027"), "Different passwords produce different hashes");

    // 1.2 User setup with hashed passwords
    const doctorUser = {
      id: "user_doc_test",
      name: "Dr. Test Doctor",
      email: "doctor.test@clinicflow.com",
      phone: "03001234567",
      role: "doctor",
      is_owner: false,
      can_view_financials: true,
      status: "active",
      password: hashPassword("DocPass123"),
    };
    dbUsers.add(doctorUser);

    const receptionistUser = {
      id: "user_rec_test",
      name: "Receptionist Test",
      email: "rec.test@clinicflow.com",
      phone: "03007654321",
      role: "receptionist",
      is_owner: false,
      can_view_financials: false,
      status: "active",
      password: hashPassword("RecPass123"),
    };
    dbUsers.add(receptionistUser);

    const disabledUser = {
      id: "user_disabled_test",
      name: "Disabled Staff",
      email: "disabled@clinicflow.com",
      phone: "03009999999",
      role: "pharmacist",
      is_owner: false,
      can_view_financials: false,
      status: "disabled",
      password: hashPassword("DisabledPass123"),
    };
    dbUsers.add(disabledUser);

    // 1.3 Login with Valid Credentials
    const loginDoc = login("doctor.test@clinicflow.com", "DocPass123");
    assert(loginDoc.success === true && loginDoc.user?.userId === "user_doc_test", "Login with valid email and password succeeds");
    assert(loginDoc.user.role === "doctor", "Login returns correct role");
    assert(Boolean(loginDoc.user.sessionToken), "Login generates unique session token");

    // 1.4 Session Restore and Validation against DB
    const session = getSession();
    assert(session && session.userId === "user_doc_test", "getSession successfully restores active session");
    assert(session.name === "Dr. Test Doctor", "Session contains accurate user name");

    // 1.5 Active Operator Switching (Login as receptionist)
    const loginRec = login("rec.test@clinicflow.com", "RecPass123");
    assert(loginRec.success === true && loginRec.user?.userId === "user_rec_test", "Switching operator to receptionist succeeds");
    const recSession = getSession();
    assert(recSession.userId === "user_rec_test" && recSession.can_view_financials === false, "Active session reflects receptionist permissions");

    // 1.6 Login with Invalid Credentials
    const badLogin = login("doctor.test@clinicflow.com", "WrongPassword!");
    assert(badLogin.success === false && badLogin.error?.code === "INVALID_CREDENTIALS", "Login with invalid password fails with INVALID_CREDENTIALS");

    // 1.7 Disabled Account Login Blockade
    const disabledLogin = login("disabled@clinicflow.com", "DisabledPass123");
    assert(disabledLogin.success === false && disabledLogin.error?.code === "ACCOUNT_DISABLED", "Disabled user cannot log in");

    // 1.8 Zombie / Deactivated Session Purge
    // Log back in as doctor, then deactivate doctor in DB
    login("doctor.test@clinicflow.com", "DocPass123");
    assert(getSession() !== null, "Session active before deactivation");
    dbUsers.update("user_doc_test", { status: "inactive" });
    const purgedSession = getSession();
    assert(purgedSession === null, "getSession detects deactivated DB account and purges zombie session");

    // Re-enable doctor for subsequent tests
    dbUsers.update("user_doc_test", { status: "active" });

    // 1.9 Logout
    login("doctor.test@clinicflow.com", "DocPass123");
    logout();
    assert(getSession() === null, "logout() cleanly removes session storage and local storage tokens");
  });

  // =========================================================================
  // SECTION 2: ROLE-BASED ACCESS CONTROL (RBAC)
  // =========================================================================
  await suite("2. Role-Based Access Control (RBAC)", () => {
    // 2.1 Doctor isolation in OPD Queue
    const doc1 = dbUsers.add({
      name: "Dr. Kashif Khan",
      email: "doc.kashif@clinicflow.com",
      role: "doctor",
      password: hashPassword("123456"),
      status: "active",
      can_view_financials: true,
    });
    const doc2 = dbUsers.add({
      name: "Dr. Asif Khan",
      email: "doc.asif@clinicflow.com",
      role: "doctor",
      password: hashPassword("123456"),
      status: "active",
      can_view_financials: true,
    });

    const patient1 = dbPatients.add({ full_name: "Patient For Doc1", phone: "03001111111" });
    const patient2 = dbPatients.add({ full_name: "Patient For Doc2", phone: "03002222222" });

    const todayStr = new Date().toISOString().split("T")[0];

    dbVisits.add({
      patient_id: patient1.id,
      doctor_id: doc1.id,
      visit_date: todayStr,
      status: "waiting",
      fee_amount: 500,
    });

    dbVisits.add({
      patient_id: patient2.id,
      doctor_id: doc2.id,
      visit_date: todayStr,
      status: "waiting",
      fee_amount: 600,
    });

    const doc1Queue = dbVisits.getTodayQueue(doc1.id);
    const doc2Queue = dbVisits.getTodayQueue(doc2.id);

    assert(doc1Queue.length === 1 && doc1Queue[0].doctor_id === doc1.id, "Dr. Kashif sees ONLY their assigned waiting visits");
    assert(doc2Queue.length === 1 && doc2Queue[0].doctor_id === doc2.id, "Dr. Asif sees ONLY their assigned waiting visits");
    assert(doc1Queue[0].patient_id === patient1.id, "Dr. Kashif queue matches Patient 1");
    assert(doc2Queue[0].patient_id === patient2.id, "Dr. Asif queue matches Patient 2");

    // 2.2 Non-financial staff checkAuthorization & assertAuthorized
    const recUser = dbUsers.add({
      name: "Receptionist Front Desk",
      email: "rec.frontdesk@clinicflow.com",
      role: "receptionist",
      password: hashPassword("RecPass123"),
      status: "active",
      can_view_financials: false,
      is_owner: false,
    });
    login("rec.frontdesk@clinicflow.com", "RecPass123"); // can_view_financials: false
    const recAuthCheck = checkAuthorization([], true); // require financials
    assert(recAuthCheck.authorized === false && recAuthCheck.error?.code === "FORBIDDEN_FINANCIALS", "Receptionist without financial clearance is denied financial access");

    let threwError = false;
    try {
      assertAuthorized([], true);
    } catch (e) {
      threwError = true;
      assert(e.message.includes("Financial clearance required"), "assertAuthorized throws error for non-financial staff");
    }
    assert(threwError === true, "assertAuthorized threw expected forbidden error");

    // 2.3 Warehouse Incharge scoping (Raza vs Usama)
    const whCentral = dbWarehouses.add({ name: "Central Godown Latifabad", code: "WH-LAT", status: "active" });
    const whCity = dbWarehouses.add({ name: "City Main Godown", code: "WH-CTY", status: "active" });

    const userRaza = dbUsers.add({
      name: "Raza Incharge",
      email: "raza.wh@clinicflow.com",
      role: "warehouse_incharge",
      assigned_warehouse_id: whCentral.id,
      password: hashPassword("WhPass123"),
      status: "active",
      is_owner: false,
    });

    const userUsama = dbUsers.add({
      name: "Usama Incharge",
      email: "usama.wh@clinicflow.com",
      role: "warehouse_incharge",
      assigned_warehouse_id: whCity.id,
      password: hashPassword("WhPass123"),
      status: "active",
      is_owner: false,
    });

    // Test Scoped Inventory helper
    const itemA = dbInventory.add({
      medicine_name: "Panadol 500mg",
      item_code: "PAN-500",
      company_name: "GSK",
      total_base_stock: 100,
      warehouse_stock: 70,
      store_stock: 30,
    });

    dbInventory.setStockForLocation(itemA.id, 50, whCentral.id);
    dbInventory.setStockForLocation(itemA.id, 20, whCity.id);

    const scopedRaza = dbInventory.getScopedInventory(userRaza);
    const itemInRaza = scopedRaza.find((i) => i.id === itemA.id);
    assert(itemInRaza && itemInRaza.scoped_stock === 50, "Raza sees ONLY Central Godown stock (50 units)");

    const scopedUsama = dbInventory.getScopedInventory(userUsama);
    const itemInUsama = scopedUsama.find((i) => i.id === itemA.id);
    assert(itemInUsama && itemInUsama.scoped_stock === 20, "Usama sees ONLY City Godown stock (20 units)");

    // Test Login session retains assigned_warehouse_id
    login("raza.wh@clinicflow.com", "WhPass123");
    const razaSession = getSession();
    assert(razaSession.assigned_warehouse_id === whCentral.id, "Raza session accurately stores assigned_warehouse_id");
  });

  // =========================================================================
  // SECTION 3: SUPER ADMIN & DEVELOPER PANEL (/admin)
  // =========================================================================
  await suite("3. Super Admin & Developer Panel (/admin)", () => {
    // 3.1 Passcode verification
    const defaultCode = getAdminPasscode();
    assert(defaultCode === "KB2026", "Default admin passcode is KB2026");
    assert(verifyAdminPasscode("KB2026") === true, "verifyAdminPasscode validates default passcode");
    assert(verifyAdminPasscode("WrongCode") === false, "verifyAdminPasscode rejects invalid passcode");

    // Custom passcode support
    localStorage.setItem("cf_admin_master_passcode", "DEV_MASTER_99");
    assert(getAdminPasscode() === "DEV_MASTER_99", "Custom admin passcode correctly fetched from storage");
    assert(verifyAdminPasscode("DEV_MASTER_99") === true, "Custom passcode verification succeeds");
    assert(verifyAdminPasscode("KB2026") === false, "Old passcode no longer valid after change");
    localStorage.removeItem("cf_admin_master_passcode"); // reset

    // 3.2 Staff User CRUD with Password Hashing
    const newStaff = dbUsers.add({
      name: "Audit Pharmacist",
      role: "pharmacist",
      email: "audit.pharm@clinicflow.com",
      phone: "03112233445",
      password: hashPassword("AuditPass@123"),
      can_view_financials: true,
      status: "active",
    });
    assert(newStaff && newStaff.id, "Admin successfully creates staff user");
    assert(newStaff.password.startsWith("hashed_"), "Staff password is stored hashed");

    const updatedStaff = dbUsers.update(newStaff.id, { specialization: "Senior Clinical Pharmacist" });
    assert(updatedStaff.specialization === "Senior Clinical Pharmacist", "Admin successfully updates staff user");

    const userCountBefore = dbUsers.getAll().length;
    dbUsers.delete(newStaff.id);
    const userCountAfter = dbUsers.getAll().length;
    assert(userCountAfter === userCountBefore - 1, "Admin successfully deletes staff user");

    // 3.3 Godown Registration, Editing, Valuation & Deletion Protection
    const testGodown = dbWarehouses.add({
      name: "Test Transit Hub",
      code: "WH-TRN",
      location: "Latifabad Unit 7",
      incharge_name: "Ahmed",
      phone: "03451234567",
      status: "active",
    });
    assert(testGodown && testGodown.id, "Godown registration successful");

    const editedGodown = dbWarehouses.update(testGodown.id, { incharge_name: "Ahmed Raza" });
    assert(editedGodown.incharge_name === "Ahmed Raza", "Godown edit successful");

    // Stock valuation calculation
    const allInv = dbInventory.getAll();
    let totalValuation = 0;
    allInv.forEach((item) => {
      const cost = Number(item.cost_price_per_box || item.cost_price || 0);
      const qty = Number(item.total_base_stock || item.stock_qty || 0);
      totalValuation += cost * qty;
    });
    assert(Number.isFinite(totalValuation) && totalValuation >= 0, "Stock valuation calculates finite positive currency number");

    // 3.4 Custom Date Range Filtering without UTC Day Shift
    const customStart = "2026-03-01";
    const customEnd = "2026-03-31";

    const testVisit = dbVisits.add({
      patient_id: "p_test",
      visit_date: "2026-03-15T14:30:00",
      fee_amount: 500,
    });

    const visits = dbVisits.getAll();
    const filteredVisits = visits.filter((v) => {
      const d = (v.visit_date || "").split("T")[0];
      return d >= customStart && d <= customEnd;
    });
    assert(filteredVisits.some((v) => v.id === testVisit.id), "Custom date range includes exact local date without UTC day shift");
  });

  // =========================================================================
  // SECTION 4: UNRESTRICTED PERPETUAL LIFETIME SOFTWARE ENGINE
  // =========================================================================
  await suite("4. Unrestricted Perpetual Lifetime Software Engine", () => {
    // 4.1 Default Active Lifetime Status
    localStorage.removeItem("clinicflow_license");
    let licState = dbLicense.evaluateStatus();
    assert(licState.status === "active" && licState.isLocked === false, "Default fresh setup has active, unlocked license status");
    assert(licState.isWarning === false, "No warning active in perpetual lifetime mode");
    assert(licState.isGrace === false, "No grace period active in perpetual lifetime mode");

    // 4.2 Lifetime Policy Settings
    const lic = dbLicense.get();
    assert(lic.is_lifetime === true, "is_lifetime is true");
    assert(lic.license_mode === "lifetime", "license_mode is lifetime");
    assert(lic.hardware_lock_enabled === false, "Hardware machine lock is disabled");

    // 4.3 Guaranteed Unrestricted Features
    assert(licState.isFeatureBlocked("pos") === false, "POS is never blocked");
    assert(licState.isFeatureBlocked("inventory") === false, "Inventory is never blocked");
    assert(licState.isFeatureBlocked("consultation") === false, "Doctor Consultation is never blocked");
    assert(licState.isFeatureBlocked("reports") === false, "Reports are never blocked");

    // 4.4 Resilient to Any Updates
    dbLicense.update({ license_status: "active" });
    licState = dbLicense.evaluateStatus();
    assert(licState.status === "active" && licState.isLocked === false, "Remains active after update");
  });

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log(`\n======================================================`);
  console.log(`📊 SECURITY & RBAC QA AUDIT COMPLETE`);
  console.log(`======================================================`);
  console.log(`Total Tests Run : ${totalTests}`);
  console.log(`Tests Passed   : ${passedTests} ✅`);
  console.log(`Tests Failed   : ${failedTests} ${failedTests === 0 ? "🎉" : "❌"}`);
  console.log(`======================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (process.argv[1] && process.argv[1].endsWith("test.js")) {
  runSecurityQASuite();
}
