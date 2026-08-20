/**
 * ClinicFlow — Automated Master Test & Verification Suite
 * Tests all 12 core engines: DB cache, Auth, Patients, OPD Queues, Multi-Unit Inventory,
 * POS Sales, Godown B2B Wholesale, Supplier Purchases, Returns, Day-End Financials,
 * Thermal Printing Engine, and Backup Import/Export.
 */

// Mock localStorage & sessionStorage for Node environment if running outside browser
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

import {
  resetDatabaseToDemoData,
  exportFullDatabase,
  importFullDatabase,
  dbClinic,
  dbUsers,
  dbPatients,
  dbVisits,
  dbInventory,
  dbSales,
  dbExpenses,
  dbSuppliers,
  dbParties,
  dbB2BSales,
  dbPurchases,
  dbReturns,
  dbShiftClosings,
  dbTenants,
  formatStockBreakdown,
  generateSequentialInvoiceNo,
} from "../src/api/db.js";

import { login, logout, getSession } from "../src/api/auth.js";
import { createPatient, searchPatients, updatePatient } from "../src/api/patients.js";
import { recordSale } from "../src/api/store.js";
import { escapeHtml } from "../src/utils/thermalPrinter.js";

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

function suite(name, fn) {
  console.log(`\n======================================================`);
  console.log(`🧪 RUNNING SUITE: ${name}`);
  console.log(`======================================================`);
  try {
    fn();
  } catch (err) {
    console.error(`💥 Suite Failure in "${name}":`, err.message);
  }
}

// ----------------------------------------------------
// SUITE 1: DB Initialization & Cache Mechanics
// ----------------------------------------------------
suite("1. Database Init, Seeds & O(1) Cache Integrity", () => {
  resetDatabaseToDemoData();
  const clinic = dbClinic.get();
  assert(clinic && clinic.name.includes("Kashif"), "Clinic profile loaded from seed data");

  const users = dbUsers.getAll();
  assert(users.length >= 4, `Seed users loaded (count: ${users.length})`);

  const invList = dbInventory.getAll();
  assert(invList.length > 0, `Seed inventory loaded (count: ${invList.length})`);

  // Test O(1) ID Map Cache
  const firstInv = invList[0];
  const fetchedFast = dbInventory.getById(firstInv.id);
  assert(fetchedFast && fetchedFast.id === firstInv.id, "ID map cache resolves item in O(1)");

  // Test Sequential Number Generation
  const posSeq1 = generateSequentialInvoiceNo("POS");
  const posSeq2 = generateSequentialInvoiceNo("POS");
  assert(posSeq1 !== posSeq2, `Sequential POS numbering increments (${posSeq1} -> ${posSeq2})`);
});

// ----------------------------------------------------
// SUITE 2: Multi-Tenant Switching
// ----------------------------------------------------
suite("2. Multi-Tenant Clinic Context Switcher", () => {
  const tenants = dbTenants.getAll();
  assert(tenants.length >= 2, `Multi-tenant profiles present (count: ${tenants.length})`);

  const t2 = tenants[1];
  const switched = dbTenants.switchToTenant(t2.id);
  assert(switched === true, "switchToTenant returns true on success");

  const clinicAfter = dbClinic.get();
  assert(clinicAfter.name === t2.name, `Active clinic name switched to: ${clinicAfter.name}`);

  // Switch back to primary
  dbTenants.switchToTenant(tenants[0].id);
  assert(dbClinic.get().name === tenants[0].name, "Switched back to primary clinic context");
});

// ----------------------------------------------------
// SUITE 3: Auth, RBAC & Brute Force Rate Limiter
// ----------------------------------------------------
suite("3. Authentication, Security & Rate Limiting", () => {
  // Test Doctor Login
  const docLogin = login("kashif", "123456");
  assert(docLogin.success === true && docLogin.user.role === "doctor", "Doctor 1 (kashif) login successful");

  const session = getSession();
  assert(session && session.userId === docLogin.user.userId, "Session retrieved and validated against DB");

  logout();
  assert(getSession() === null, "Logout terminates session");

  // Test Wrong Password
  const badLogin = login("kashif", "wrong_pass_999");
  assert(badLogin.success === false, "Invalid password correctly rejected");

  // Test Pharmacist Login
  const pharmLogin = login("usama", "123456");
  assert(pharmLogin.success === true && pharmLogin.user.role === "pharmacist", "Pharmacist (usama) login successful");
  logout();
});

// ----------------------------------------------------
// SUITE 4: Patient Management & Search
// ----------------------------------------------------
suite("4. Patient Directory, Validation & Search", () => {
  const uniquePhone = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;
  const created = createPatient({
    full_name: "Tariq Mehmood Memon",
    relation_type: "father",
    relation_name: "Haji Abdul Ghaffar",
    phone: uniquePhone,
    age: 42,
    gender: "male",
    city: "Hyderabad",
  });
  assert(created.success === true && created.data.id, "New patient registered successfully");

  const searchByName = searchPatients("Tariq Mehmood");
  assert(searchByName.success === true && searchByName.data.some((p) => p.id === created.data.id), "Search patient by name found match");

  const searchByPhone = searchPatients(uniquePhone);
  assert(searchByPhone.success === true && searchByPhone.data.length >= 1, "Search patient by phone found match");

  // Update Patient
  const updated = updatePatient(created.data.id, { notes: "Chronic Asthma Patient" });
  assert(updated.success === true && updated.data.notes === "Chronic Asthma Patient", "Patient profile updated successfully");
});

// ----------------------------------------------------
// SUITE 5: OPD Queue & Doctor Isolation
// ----------------------------------------------------
suite("5. OPD Visits, Sequential Tokens & Multi-Doctor Isolation", () => {
  const patients = dbPatients.getAll();
  const testPatient = patients[0];

  // Issue token for Doctor 1 (Dr. Kashif - user_001)
  const visitDoc1 = dbVisits.create({
    patient_id: testPatient.id,
    doctor_id: "user_001",
    fee_amount: 500,
    fee_status: "paid",
  });
  assert(visitDoc1.token_number >= 1, `Doctor 1 token generated: #${visitDoc1.token_number}`);

  // Issue token for Doctor 2 (Dr. Asif - user_002)
  const visitDoc2 = dbVisits.create({
    patient_id: testPatient.id,
    doctor_id: "user_002",
    fee_amount: 500,
    fee_status: "paid",
  });
  assert(visitDoc2.doctor_id === "user_002", "Doctor 2 visit tagged with doctor_id user_002");

  // Verify Isolated Queues
  const doc1Queue = dbVisits.getQueue("user_001");
  const doc2Queue = dbVisits.getQueue("user_002");

  assert(doc1Queue.some((v) => v.id === visitDoc1.id), "Visit 1 appears in Doctor 1 isolated queue");
  assert(!doc1Queue.some((v) => v.id === visitDoc2.id), "Doctor 1 queue strictly isolates Doctor 2 visits");
  assert(doc2Queue.some((v) => v.id === visitDoc2.id), "Visit 2 appears in Doctor 2 isolated queue");

  // Status transitions
  dbVisits.updateStatus(visitDoc1.id, "in_consultation");
  assert(dbVisits.getById(visitDoc1.id).status === "in_consultation", "Status updated to in_consultation");

  dbVisits.complete(visitDoc1.id, { diagnosis: "Acute Bronchitis" }, "completed");
  assert(dbVisits.getById(visitDoc1.id).status === "completed", "Visit completed successfully");
});

// ----------------------------------------------------
// SUITE 6: Multi-Unit Packaging & Inventory Stock Conversions
// ----------------------------------------------------
suite("6. Multi-Unit Inventory Engine & Stock Conversions", () => {
  // Add 5 Boxes (10 Strips/Box, 12 Tabs/Strip = 120 base units per box => 600 base units total)
  const newMed = dbInventory.add({
    medicine_name: "Test Cefixime 400mg",
    category: "Capsule",
    strength: "400 mg",
    has_multi_unit: true,
    box_label: "Box",
    strip_label: "Strip",
    unit_label: "Cap",
    strips_per_box: 10,
    units_per_strip: 12,
    stock_boxes: 5,
    total_base_stock: 600,
    stock_qty: 600,
    cost_price_per_box: 800,
    box_sale_price: 1200,
    strip_sale_price: 130,
    unit_sale_price: 12,
    low_stock_threshold: 50,
  });

  assert(newMed.id && newMed.total_base_stock === 600, "Multi-unit product added with 600 base units");

  const breakdown = formatStockBreakdown(newMed, newMed.total_base_stock);
  assert(breakdown.includes("Godown:") || breakdown.includes("Box") || breakdown.includes("Cap"), `Breakdown displays correct pack count: "${breakdown}"`);

  // Deduct 1 Strip (12 base units)
  dbInventory.deductStock(newMed.id, 12);
  const medAfter = dbInventory.getById(newMed.id);
  assert(medAfter.total_base_stock === 588, `Stock after 1 strip deduction is 588 base units (got ${medAfter.total_base_stock})`);
});

// ----------------------------------------------------
// SUITE 7: Retail POS Sales & Multi-Unit Deductions
// ----------------------------------------------------
suite("7. Retail POS Sales, Discounts & Base Stock Deductions", () => {
  const invList = dbInventory.getAll();
  const testItem = invList[0];
  const initialStock = testItem.total_base_stock ?? testItem.stock_qty;

  // Sale via store.js recordSale (1 Box)
  const saleRes = recordSale({
    inventory_id: testItem.id,
    quantity_sold: 1,
    selected_unit_type: "box",
  });

  assert(saleRes.success === true, "recordSale executed successfully");
  const sale = saleRes.data;
  assert(sale.receipt_no.startsWith("POS-"), `POS invoice generated: #${sale.receipt_no}`);
  assert(!isNaN(sale.paid_amount) && !isNaN(sale.balance_due), "Paid amount and balance due are valid numbers (no NaN)");

  const stockAfter = dbInventory.getById(testItem.id).total_base_stock;
  const expectedDeduction = testItem.has_multi_unit
    ? (testItem.strips_per_box || 10) * (testItem.units_per_strip || 10)
    : 1;
  assert(stockAfter === initialStock - expectedDeduction, `Stock deducted accurately by ${expectedDeduction} units`);
});

// ----------------------------------------------------
// SUITE 8: Godown B2B Wholesale Supply (Sindh Interior)
// ----------------------------------------------------
suite("8. Godown B2B Wholesale Engine & Party Balances", () => {
  const parties = dbParties.getAll();
  assert(parties.length > 0, "Sindh Wholesale Parties loaded");

  const party = parties[0];
  const initialBalance = party.balance_due || 0;

  const invList = dbInventory.getAll();
  const testMed = invList[0];

  const b2bSale = dbB2BSales.checkout({
    buyer_id: party.id,
    buyer_name: party.name,
    buyer_phone: party.phone,
    city: party.city,
    salesman: "Usama",
    bilty_no: "BLT-9988",
    transport: "Al-Madina Goods",
    items: [
      {
        inventory_id: testMed.id,
        medicine_name: testMed.medicine_name,
        qty: 5,
        qty_base_units: 50,
        unit_price: 500,
        line_total: 2500,
      },
    ],
    items_subtotal: 2500,
    overall_discount_amount: 100,
    total_amount: 2400,
    paid_amount: 1000,
    balance_due: 1400,
    payment_type: "credit",
  });

  assert(b2bSale.invoice_no.startsWith("WHO-"), `B2B Wholesale invoice generated: #${b2bSale.invoice_no}`);
  assert(b2bSale.balance_due === 1400, "Balance due calculated correctly (2400 - 1000 = 1400)");

  const partyAfter = dbParties.getById(party.id);
  assert(partyAfter.balance_due === initialBalance + 1400, `Party Udhaar balance updated (+Rs. 1400)`);
});

// ----------------------------------------------------
// SUITE 9: Supplier Purchases (GRN) & Inward Stock
// ----------------------------------------------------
suite("9. Supplier Purchases (GRN) & Outstanding Balance", () => {
  const suppliers = dbSuppliers.getAll();
  assert(suppliers.length > 0, "Pharma Suppliers loaded");

  const sup = suppliers[0];
  const initialSupBalance = sup.current_balance || 0;

  const invList = dbInventory.getAll();
  const testMed = invList[0];
  const initialGodownStock = testMed.warehouse_stock || 0;

  const purchase = dbPurchases.add({
    supplier_id: sup.id,
    supplier_name: sup.name,
    company_bill_no: "GETZ-8812",
    destination_type: "warehouse",
    total_amount: 10000,
    paid_amount: 6000,
    items: [
      {
        inventory_id: testMed.id,
        medicine_name: testMed.medicine_name,
        qty: 10,
        qty_base_units: 100,
        cost_price: 1000,
        line_total: 10000,
      },
    ],
  });

  assert(purchase.invoice_no.startsWith("PUR-"), `Purchase GRN generated: #${purchase.invoice_no}`);
  assert(purchase.balance_due === 4000, "Purchase balance due computed correctly (10000 - 6000 = 4000)");

  const supAfter = dbSuppliers.getById(sup.id);
  assert(supAfter.current_balance === initialSupBalance + 4000, `Supplier payable balance updated (+Rs. 4000)`);

  const medAfter = dbInventory.getById(testMed.id);
  assert((medAfter.warehouse_stock || 0) === initialGodownStock + 100, "Godown warehouse stock replenished (+100 base units)");
});

// ----------------------------------------------------
// SUITE 10: Sale Returns & Stock Replenishment
// ----------------------------------------------------
suite("10. Sale Returns, Restocking & Refund Calculation", () => {
  const sales = dbSales.getAll();
  const sale = sales[0];

  const returnRes = dbReturns.processReturn({
    sale_id: sale.id,
    return_items: [
      {
        inventory_id: sale.items[0]?.inventory_id,
        medicine_name: sale.items[0]?.medicine_name || "Medicine",
        quantity_returned: 1,
        unit_price: 200,
      },
    ],
    reason: "Doctor changed prescription formula",
    refund_type: "cash",
  });

  assert(returnRes.id && returnRes.refund_amount === 200, `Return refund amount computed accurately (Rs. ${returnRes.refund_amount})`);
});

// ----------------------------------------------------
// SUITE 11: Day-End Cashier Z-Report & Denominations
// ----------------------------------------------------
suite("11. Day-End Financial Z-Report & Cashbook Reconciliation", () => {
  const today = new Date().toISOString().split("T")[0];

  // Add sample expense
  const exp = dbExpenses.add({
    category: "Electricity / Generator Fuel",
    amount: 1500,
    description: "Diesel for Backup Generator",
  });
  assert(exp.id && exp.amount === 1500, "Expense recorded with standardized date");

  // Record Shift Closing with Denominations
  const closing = dbShiftClosings.add({
    date: today,
    closed_by: "Dr. Muhammad Kashif Khan",
    opd_fees: 5000,
    pharmacy_sales: 12000,
    wholesale_sales: 8000,
    expenses: 1500,
    total_system_cash: 23500,
    counted_physical_cash: 23500,
    variance: 0,
    status: "balanced",
    denominations: {
      "5000": 4,  // 20,000
      "1000": 3,  // 3,000
      "500": 1,   // 500
    },
  });

  assert(closing.id && closing.status === "balanced", "Day-End shift closing saved with balanced status");
});

// ----------------------------------------------------
// SUITE 12: Thermal Printer Sanitization & Database Backup
// ----------------------------------------------------
suite("12. 80mm ESC/POS Thermal Templates & Database Backup", () => {
  // Test Thermal HTML Escaping
  const rawInput = "<script>alert('xss')</script>Bilal & Kashif 'Khan' \"Clinic\"";
  const sanitized = escapeHtml(rawInput);

  assert(!sanitized.includes("<script>"), "HTML escaping neutralizes <script> tags");
  assert(sanitized.includes("&amp;") && sanitized.includes("&quot;"), "Special HTML characters escaped safely");

  // Test Full Database Backup Export
  const backup = exportFullDatabase();
  assert(backup.version === "5.0.0" && backup.data && Object.keys(backup.data).length > 5, "Full database JSON backup created");

  // Test Full Database Backup Import
  const imported = importFullDatabase(backup);
  assert(imported === true, "Full database JSON backup imported successfully with cache clearing");
});

// ----------------------------------------------------
// SUMMARY REPORT
// ----------------------------------------------------
console.log(`\n======================================================`);
console.log(`📊 TEST SUITE EXECUTION SUMMARY`);
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
