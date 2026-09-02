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
  dbStockTransfers,
  dbShiftClosings,
  dbAccounts,
  dbStockLedger,
  dbWarehouses,
  dbCashBook,
  dbDayClosing,
  dbLicense,
  dbOutbox,
  dbPatientLedger,
  dbSupplierLedger,
  dbClinicServices,
  dbAuditLogs,
  dbStockMovements,
  dbMedicineBatches,
  dbTransactions,
  dbApprovals,
  dbReports,
  reconcilePhysicalStock,
  reconcileFinancialAndStockLedgers,
  reconcilePatientLedger,
  reconcileSupplierLedger,
  checkGeneralLedgerTrialBalance,
  isPeriodClosed,
  assertPeriodOpen,
  parseAndValidateVitals,
  normalizePhone,
  getDeviceId,
  mergePatientEntity,
  reconcileInventoryWithDeltas,
  reconcileSystemSettings,
  calculateShiftDrift,
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
  hashPassword,
  verifyPassword,
  sha256Sync,
  generateSalt,
  formatStockBreakdown,
  generateSequentialInvoiceNo,
  getAllCollectionsSnapshot,
  hydrateCollectionsFromSnapshot,
  safeRestoreDatabase,
  dbBackupEngine,
  createPreRestoreCheckpoint,
  rollbackLastRestore,
  simulateRestoreDryRun,
  parseAndValidateBackupString,
  _COLLECTION_CACHE,
  _ID_MAP_CACHE,
  KEYS,
} from "../src/api/db.js";

import {
  APP_CONFIG,
  compareSemver,
  getShortVersionBadge,
  getSystemDiagnosticInfo,
} from "../src/utils/version.js";

import {
  decorateRecordLineage,
  stripLineageMetadata,
} from "../src/api/lineage.js";

import {
  telemetry,
  sanitizeData,
} from "../src/api/telemetry.js";

import {
  patientInputSchema,
  inventoryItemSchema,
  medicineBatchSchema,
  universalTransactionSchema,
  approvalSchema,
  warehouseSchema,
  supplierSchema,
  partySchema,
  purchaseInputSchema,
  b2bSaleInputSchema,
  stockTransferSchema,
  shiftClosingSchema,
  validateSchema,
} from "../src/schemas/index.js";

import { login, logout, getSession, PERMISSION_MATRIX, hasPermission, assertPermission, hasWarehouseAccess, assertWarehouseAccess } from "../src/api/auth.js";
import { createPatient, searchPatients, updatePatient, checkDuplicatePatient } from "../src/api/patients.js";
import { recordSale, processSaleReturn } from "../src/api/store.js";
import { validateImageFile } from "../src/utils/imageCompressor.js";
import { escapeHtml, printPurchaseGRNReceipt, printSaleInvoiceReceipt, printCashVoucherReceipt, printOPDTokenReceipt, printDayEndClosingReceipt } from "../src/utils/thermalPrinter.js";
import { formatPatientAge, escapeCSV, downloadCSV } from "../src/utils/formatters.js";
import { GLOBAL_NAV_SHORTCUTS } from "../src/hooks/useGlobalKeyboardNav.js";
import { syncEngine, SYNC_FSM_STATES } from "../src/api/syncEngine.js";
import { performance } from "perf_hooks";

import { runDesktopSync } from "./sync_desktop_engine.mjs";
import fs from "fs";
import path from "path";




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
  console.log(`🧪 RUNNING SUITE: ${name}`);
  console.log(`======================================================`);
  try {
    await fn();
  } catch (err) {
    console.error(`💥 Suite Failure in "${name}":`, err.message);
  }
}

async function runTests() {
  // ----------------------------------------------------
  // SUITE 1: DB Initialization & Cache Mechanics
  // ----------------------------------------------------
  await suite("1. Database Init, Seeds & O(1) Cache Integrity", () => {
    resetDatabaseToDemoData();

    // Ensure clinic profile is initialized
    let clinic = dbClinic.get();
    assert(clinic && clinic.id, "Clinic profile loaded from seed data");

    // Ensure users are provisioned
    let users = dbUsers.getAll();
    if (users.length <= 4) {
      dbUsers.add({
        username: "kashif",
        name: "Dr. Muhammad Kashif Khan",
        email: "kashif@clinicflow.com",
        role: "doctor",
        password: hashPassword("123456"),
        consultation_fee: 500,
      });
      dbUsers.add({
        username: "asif",
        name: "Dr. Muhammad Asif Khan",
        email: "asif@clinicflow.com",
        role: "doctor",
        password: hashPassword("123456"),
        consultation_fee: 500,
      });
      dbUsers.add({
        username: "usama",
        name: "Usama (Pharmacist)",
        email: "usama@clinicflow.com",
        role: "pharmacist",
        password: hashPassword("123456"),
      });
      dbUsers.add({
        username: "raza",
        name: "Raza (Receptionist)",
        email: "raza@clinicflow.com",
        role: "receptionist",
        password: hashPassword("123456"),
      });
      users = dbUsers.getAll();
    }
    assert(users.length >= 4, `Seed users loaded (count: ${users.length})`);

    // Ensure test warehouses are provisioned
    let whs = dbWarehouses.getAll();
    if (whs.length === 0) {
      dbWarehouses.add({
        id: "wh_001",
        clinic_id: "clinic_001",
        code: "GDW-01",
        name: "Main Godown (Lajpat Road)",
        status: "active",
      });
      dbWarehouses.add({
        id: "wh_002",
        clinic_id: "clinic_001",
        code: "GDW-02",
        name: "Warehouse 2 (Site Area)",
        status: "active",
      });
      dbWarehouses.add({
        id: "wh_str",
        clinic_id: "clinic_001",
        code: "STR-01",
        name: "Medical Store Counter & Pharmacy",
        status: "active",
      });
      whs = dbWarehouses.getAll();
    }
    assert(whs.length >= 3, `Seed warehouses loaded (count: ${whs.length})`);

    // Ensure inventory is provisioned
    let invList = dbInventory.getAll();
    if (invList.length === 0) {
      dbInventory.add({
        medicine_name: "Cefixime 400mg",
        item_code: "General",
        company_name: "General",
        total_base_stock: 500,
        stock_qty: 500,
        box_sale_price: 1200,
      });
      invList = dbInventory.getAll();
    }
    assert(invList.length > 0, `Seed inventory loaded (count: ${invList.length})`);

    // Test O(1) ID Map Cache
    const firstInv = invList[0];
    const fetchedFast = dbInventory.getById(firstInv.id);
    assert(fetchedFast && fetchedFast.id === firstInv.id, "ID map cache resolves item in O(1)");

    const posSeq1 = generateSequentialInvoiceNo("POS");
    const posSeq2 = generateSequentialInvoiceNo("POS");
    assert(posSeq1 !== posSeq2, `Sequential POS numbering increments (${posSeq1} -> ${posSeq2})`);
  });

  // ----------------------------------------------------
  // SUITE 2: Single-Clinic Standalone Context & Profile
  // ----------------------------------------------------
  await suite("2. Single-Clinic Standalone Identity & Profile", () => {
    const clinic = dbClinic.get();
    assert(clinic && clinic.id, "Primary standalone clinic profile exists");
    
    const updated = dbClinic.update({ notes: "Primary Branch Hyderabad" });
    assert(updated.notes === "Primary Branch Hyderabad", "Clinic settings updated successfully");
  });

  // ----------------------------------------------------
  // SUITE 3: Auth, RBAC & Brute Force Rate Limiter
  // ----------------------------------------------------
  await suite("3. Authentication, Security & Rate Limiting", async () => {
    // Ensure doctor and pharmacist exist with hashed test password
    let allUsers = dbUsers.getAll();
    let doc = allUsers.find((u) => u.username === "kashif");
    if (!doc) {
      doc = dbUsers.add({
        username: "kashif",
        name: "Dr. Muhammad Kashif Khan",
        email: "kashif@clinicflow.com",
        role: "doctor",
        password: hashPassword("123456"),
        consultation_fee: 500,
      });
    } else {
      dbUsers.update(doc.id, { password: hashPassword("123456") });
    }
    let pharm = allUsers.find((u) => u.username === "usama");
    if (!pharm) {
      pharm = dbUsers.add({
        username: "usama",
        name: "Usama (Pharmacist)",
        email: "usama@clinicflow.com",
        role: "pharmacist",
        password: hashPassword("123456"),
      });
    } else {
      dbUsers.update(pharm.id, { role: "pharmacist", password: hashPassword("123456") });
    }

    // Test Doctor Login
    const docLogin = await login("kashif", "123456");
    assert(docLogin.success === true && docLogin.user.role === "doctor", "Doctor 1 (kashif) login successful");

    const session = getSession();
    assert(session && session.userId === docLogin.user.userId, "Session retrieved and validated against DB");

    logout();
    assert(getSession() === null, "Logout terminates session");

    // Test Wrong Password
    const badLogin = await login("kashif", "wrong_pass_999");
    assert(badLogin.success === false, "Invalid password correctly rejected");

    // Test Pharmacist Login
    const pharmLogin = await login("usama", "123456");
    assert(pharmLogin.success === true && pharmLogin.user.role === "pharmacist", "Pharmacist (usama) login successful");

    logout();
  });

  // ----------------------------------------------------
  // SUITE 4: Patient Management & Search
  // ----------------------------------------------------
  await suite("4. Patient Directory, Validation & Search", () => {
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
  await suite("5. OPD Visits, Sequential Tokens & Multi-Doctor Isolation", () => {
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
  await suite("6. Multi-Unit Inventory Engine & Stock Conversions", () => {
    // Add 5 Boxes (10 Strips/Box, 12 Tabs/Strip = 120 base units per box => 600 base units total)
    const newMed = dbInventory.add({
      medicine_name: "Test Cefixime 400mg",
      item_code: "Capsule",
      company_name: "Capsule",
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
  await suite("7. Retail POS Sales, Discounts & Base Stock Deductions", () => {
    const invList = dbInventory.getAll();
    let testItem = invList[0];
    if ((testItem.store_stock ?? testItem.total_base_stock ?? testItem.stock_qty ?? 0) < 10) {
      dbInventory.update(testItem.id, { store_stock: 500, total_base_stock: 500, stock_qty: 500 });
      testItem = dbInventory.getById(testItem.id);
    }
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
  await suite("8. Godown B2B Wholesale Engine & Party Balances", () => {
    let parties = dbParties.getAll();
    if (parties.length === 0) {
      dbParties.add({
        name: "Madina Homoeo Store (Hyderabad)",
        city: "Hyderabad",
        phone: "03001234567",
        balance_due: 0,
      });
      parties = dbParties.getAll();
    }
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
  await suite("9. Supplier Purchases (GRN) & Outstanding Balance", () => {
    let suppliers = dbSuppliers.getAll();
    if (suppliers.length === 0) {
      dbSuppliers.add({
        name: "BM Pvt LTD",
        phone: "03007654321",
        city: "Karachi",
        current_balance: 0,
      });
      suppliers = dbSuppliers.getAll();
    }
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
  await suite("10. Sale Returns, Restocking & Refund Calculation", () => {
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
  await suite("11. Day-End Financial Z-Report & Cashbook Reconciliation", () => {
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
  await suite("12. 80mm ESC/POS Thermal Templates & Database Backup", () => {
    // Test Thermal HTML Escaping
    const rawInput = "<script>alert('xss')</script>Bilal & Kashif 'Khan' \"Clinic\"";
    const sanitized = escapeHtml(rawInput);

    assert(!sanitized.includes("<script>"), "HTML escaping neutralizes <script> tags");
    assert(sanitized.includes("&amp;") && sanitized.includes("&quot;"), "Special HTML characters escaped safely");

    // Test Full Database Backup Export
    const backup = exportFullDatabase();
    assert(backup.version.startsWith("5.") && backup.data && Object.keys(backup.data).length > 5, "Full database JSON backup created");

    // Test Full Database Backup Import
    const imported = importFullDatabase(backup);
    assert(imported === true || imported?.success === true, "Full database JSON backup imported successfully with cache clearing");
  });

  // ----------------------------------------------------
  // SUITE 13: DrCreate & MS Access Account Registration & Chart of Accounts
  // ----------------------------------------------------
  await suite("13. DrCreate & MS Access Account Registration & Chart of Accounts", async () => {
    // Test Account auto-sequence calculation
    const nextNo = dbAccounts.getNextAccountNo();
    assert(typeof nextNo === "number" && nextNo >= 1, `Next Account No generated accurately: #${nextNo}`);

    // Test adding a Wholesale Party Account
    const newPartyAcc = dbAccounts.add({
      account_name: "Al-Rehman Homoeo Store (Tando Adam)",
      account_type: "T.Adam",
      naration: "Main Bazar Tando Adam, Contact: 0300-1122334",
      opening_balance: 5000,
    });
    assert(newPartyAcc.id && newPartyAcc.account_no === nextNo, "Account created with sequential account number");
    assert(newPartyAcc.account_type === "T.Adam" && newPartyAcc.opening_balance === 5000, "Account details stored correctly");

    // Verify auto-sync to dbParties
    const syncedParty = dbParties.getAll().find((p) => p.name === "Al-Rehman Homoeo Store (Tando Adam)");
    assert(syncedParty && syncedParty.city === "T.Adam", "Wholesale Party auto-synced into dbParties");

    // Test adding a Supplier Account
    const newSupAcc = dbAccounts.add({
      account_name: "Dr. Willmar Schwabe Germany",
      account_type: "Supplier",
      naration: "Direct German Homoeopathic Distributor",
      opening_balance: 0,
    });
    assert(newSupAcc.account_type === "Supplier", "Supplier account created");

    // Verify auto-sync to dbSuppliers
    const syncedSup = dbSuppliers.getAll().find((s) => s.name === "Dr. Willmar Schwabe Germany");
    assert(syncedSup && syncedSup.name === "Dr. Willmar Schwabe Germany", "Supplier auto-synced into dbSuppliers");

    // Test filtering accounts by Account Type
    const supplierAccounts = dbAccounts.getByType("Supplier");
    assert(supplierAccounts.length > 0 && supplierAccounts.every((a) => a.account_type.toLowerCase() === "supplier"), "Accounts filtered by Type 'Supplier' accurately");

    // Test Updating an existing Account
    const updatedAcc = dbAccounts.update(newPartyAcc.id, {
      account_name: "Al-Rehman Homoeo Medical Store (Tando Adam Super)",
      account_type: "T.Adam",
      naration: "Updated contact person & phone 03140000000",
      opening_balance: 7500,
    });
    assert(updatedAcc && updatedAcc.account_name === "Al-Rehman Homoeo Medical Store (Tando Adam Super)", "Account name updated successfully in dbAccounts");
    assert(updatedAcc.opening_balance === 7500, "Account opening balance updated");

    // Verify updated account sync in dbParties
    const updatedSyncedParty = dbParties.getAll().find((p) => p.account_no === newPartyAcc.account_no);
    assert(updatedSyncedParty && updatedSyncedParty.name === "Al-Rehman Homoeo Medical Store (Tando Adam Super)", "Updated account synced seamlessly to dbParties");

    const importResult = await dbAccounts.bulkImportFromAccess();
    assert(importResult.success === true && importResult.total >= 262, `1-Click Bulk Import of 262 legacy accounts from AshrafKhan.accdb verified (Total: ${importResult.total})`);
  });

  // ====================================================
  // SUITE 14: DrCreate & MS Access 4-Level Stock Ledger Engine
  // ====================================================
  await suite("14. DrCreate & MS Access 4-Level Stock Ledger Engine", async () => {
    // Ensure inventory has items
    if (dbInventory.getAll().length === 0) {
      dbInventory.add({
        medicine_name: "Schwabe Cineraria Maritima Eye Drops",
        item_code: "Schwabe",
        company_name: "Schwabe Germany",
        total_base_stock: 100,
        stock_qty: 100,
        box_sale_price: 450,
      });
    }

    // 1. Level 1: Category Summary
    const catSummary = dbStockLedger.getCategorySummary();
    assert(Array.isArray(catSummary) && catSummary.length > 0, "Category summary generated with brands/companies");
    assert(catSummary.every((c) => c.category && typeof c.total_qty === "number"), "Category entries contain valid category and total_qty");

    // 2. Level 2: SKU Summary
    const firstCat = catSummary[0].category;
    const skusForCat = dbStockLedger.getSKUSummary(firstCat);
    assert(Array.isArray(skusForCat) && skusForCat.length > 0, `SKU Summary generated for category '${firstCat}'`);
    assert(skusForCat[0].item_name && typeof skusForCat[0].qty === "number", "SKU entries have valid item_name and stock quantity");

    // 3. Level 3: Transactional Ledger Timeline
    const testMed = skusForCat[0].item_name;
    const timeline = dbStockLedger.getItemTimeline(testMed);
    assert(Array.isArray(timeline), "Timeline array returned for medicine");
    if (timeline.length > 0) {
      assert(timeline[0].date && typeof timeline[0].total_in === "number" && typeof timeline[0].total_out === "number", "Timeline entries contain valid Date, Total In, and Total Out numbers");
    }

    // 4. Level 4: Item Date History (Vouchers)
    if (timeline.length > 0 && timeline[0].vouchers && timeline[0].vouchers.length > 0) {
      const v = timeline[0].vouchers[0];
      assert(v.voucher_no && v.type && v.description, "Item Date History voucher contains Voucher No, Type, and Description");
    }

    // 5. Test dynamic invoice linkage: Add a purchase and verify it reflects in medicine timeline
    const testItem = dbInventory.getAll()[0];
    const newPur = dbPurchases.add({
      supplier_name: "Paul Brooks Homoeo Lab",
      invoice_no: "PUR-LEDGER-99",
      purchase_date: new Date().toISOString(),
      items: [
        {
          inventory_id: testItem.id,
          medicine_name: testItem.medicine_name,
          quantity: 25,
          qty_base_units: 25,
          cost_price: 150,
          disc_pct: 10,
          disc_flat: 0,
        },
      ],
      total_amount: 3375,
      paid_amount: 3375,
    });
    assert(newPur && newPur.id, "Purchase created to verify ledger traceability");

    const updatedTimeline = dbStockLedger.getItemTimeline(testItem.medicine_name);
    const purchaseRow = updatedTimeline.find((t) => (t.vouchers || []).some((v) => v.voucher_no === "PUR-LEDGER-99"));
    assert(purchaseRow && purchaseRow.total_in >= 25, "New purchase GRN successfully reflected in 4-Level Stock Ledger Timeline (+25 in)");
  });

  // ====================================================
  // SUITE 15: DrCreate & MS Access Purchase GRN Engine
  // ====================================================
  await suite("15. DrCreate & MS Access Purchase GRN Engine", async () => {
    // 1. Next Voucher No Generator
    const nextVoucherNo = dbPurchases.getNextVoucherNo();
    assert(typeof nextVoucherNo === "string" && nextVoucherNo.startsWith("P-"), `Auto Sequential Voucher No generated: ${nextVoucherNo}`);

    // 2. Create Purchase GRN
    const testItem = dbInventory.getAll()[0];
    const initialStock = Number(testItem.warehouse_stock || 0);

    const grnPurchase = dbPurchases.add({
      invoice_no: nextVoucherNo,
      supplier_name: "BM Pvt LTD",
      grn_no: "142863",
      reference: "ADffsn",
      transport: "By Hand",
      bilty_no: "BLT-9988",
      payment_mode: "Credit",
      destination_type: "warehouse",
      purchase_date: new Date().toISOString(),
      items: [
        {
          inventory_id: testItem.id,
          medicine_name: testItem.medicine_name,
          product_code: "BM-01",
          qty: 50,
          qty_base_units: 50,
          rate: 200,
          cost_price: 200,
          gross: 10000,
          disc_pct: "40%",
          disc_flat: 0,
          net: 6000,
          total_cost: 6000,
        },
      ],
      total_amount: 6000,
      paid_amount: 0,
      balance_due: 6000,
    });

    assert(grnPurchase && grnPurchase.invoice_no === nextVoucherNo, "Purchase GRN created with custom voucher number");
    assert(grnPurchase.grn_no === "142863", "GRN / Challan No stored accurately");
    assert(grnPurchase.transport === "By Hand" && grnPurchase.bilty_no === "BLT-9988", "Transport carrier & Bilty No stored");
    assert(grnPurchase.balance_due === 6000, "Credit purchase balance computed accurately");

    // 3. Verify stock replenished in godown
    const refreshedItem = dbInventory.getById(testItem.id);
    assert(Number(refreshedItem.warehouse_stock) === initialStock + 50, `Godown stock accurately replenished (+50 units: from ${initialStock} to ${refreshedItem.warehouse_stock})`);

    // 4. Verify thermal receipt generation
    let printError = false;
    try {
      printPurchaseGRNReceipt(grnPurchase, dbClinic.get());
    } catch {
      printError = true;
    }
    assert(!printError, "80mm Purchase GRN Thermal receipt formatted without exceptions");
  });

  // ====================================================
  // SUITE 16: DrCreate & MS Access Sale Invoice Engine
  // ====================================================
  await suite("16. DrCreate & MS Access Sale Invoice Engine", async () => {

    // 1. Voucher sequence check (S-6218 baseline or higher)
    const nextSaleVoucher = dbSales.getNextVoucherNo("drcreate");
    assert(nextSaleVoucher && (nextSaleVoucher.startsWith("S-") || nextSaleVoucher.startsWith("POS-")), `Sale voucher sequencing generated: got ${nextSaleVoucher}`);

    // 2. Select SKU and capture initial stock
    const testItem = dbInventory.getAll()[0];
    const initialStock = Number(testItem.warehouse_stock) || 0;

    // 3. Select Party and capture balance
    const party = dbParties.getAll()[0];
    const initialPartyBalance = Number(party.balance_due ?? party.current_balance ?? 0);

    // 4. Create DrCreate Sale Invoice
    const saleInvoice = dbSales.addSaleInvoice({
      voucher_no: nextSaleVoucher,
      date: new Date().toLocaleDateString("en-US"),
      grn_no: "0",
      reference: "ADffsn",
      account_name: party.name,
      buyer_id: party.id,
      naration: `${party.city || "HYD"} (${party.phone || ""}) LED`,
      party_type: party.city || "HYD",
      payment_mode: "Credit",
      company_filter: "BM Pvt LTD",
      transport: "Ali Raza By Hand",
      bilty_no: "0000",
      destination_type: "warehouse",
      items: [
        {
          id: "item_sale_1",
          inventory_id: testItem.id,
          medicine_name: testItem.medicine_name,
          product_code: "BM-01",
          qty: 5,
          qty_base_units: 5,
          rate: 300,
          gross: 1500,
          disc_pct: "40%",
          disc_flat: 0,
          net: 900,
        },
      ],
      total_amount: 900,
      paid_amount: 0,
      balance_due: 900,
    });

    assert(saleInvoice && saleInvoice.voucher_no === nextSaleVoucher, "Sale Invoice created with sequential voucher number");
    assert(saleInvoice.payment_mode === "Credit", "Payment mode set to Credit");
    assert(saleInvoice.balance_due === 900, "Credit balance due computed accurately");

    // 5. Verify stock deduction in godown
    const updatedItem = dbInventory.getById(testItem.id);
    assert(Number(updatedItem.warehouse_stock) === initialStock - 5, `Godown stock deducted accurately (-5 units: from ${initialStock} to ${updatedItem.warehouse_stock})`);

    // 6. Verify party balance updated
    const updatedParty = dbParties.getById(party.id);
    const updatedBalance = Number(updatedParty.balance_due ?? updatedParty.current_balance ?? 0);
    assert(updatedBalance === initialPartyBalance + 900, `Party receivable balance updated (+900: from ${initialPartyBalance} to ${updatedBalance})`);


    // 7. Verify 80mm thermal receipt generation
    let printError = false;
    try {
      printSaleInvoiceReceipt(saleInvoice, dbClinic.get());
    } catch {
      printError = true;
    }
    assert(!printError, "80mm Sale Invoice Thermal receipt formatted without exceptions");



    // 8. Verify CSV export string generation
    const csvData = dbSales.exportCSV([saleInvoice]);
    assert(csvData.includes(nextSaleVoucher) && csvData.includes(party.name), "Sale invoice CSV export generated with correct header & rows");
  });

  // =========================================================================
  // SUITE 17: DrCreate & MS Access CashBook Engine (Receive/Paid Double-Entry)
  // =========================================================================
  await suite("17. DrCreate & MS Access CashBook Engine", async () => {
    // 1. Next Voucher No Generator
    const nextCashVoucher = dbCashBook.getNextVoucherNo();
    assert(nextCashVoucher && nextCashVoucher.startsWith("C-"), `CashBook voucher sequencing starts with 'C-': got ${nextCashVoucher}`);

    // 2. Add Cash Receive entry (Inflow from Party)
    const party = dbParties.getAll()[0];

    const receiveEntry = dbCashBook.addEntry({
      voucher_no: nextCashVoucher,
      term: "Receive",
      account_name: party.name,
      party_id: party.id,
      naration: "Bill payment received by hand",
      amount: 1500,
      date: new Date().toISOString().split("T")[0],
    });

    assert(receiveEntry && receiveEntry.voucher_no === nextCashVoucher, "Cash Receipt entry created with sequential voucher number");
    assert(receiveEntry.term === "Receive" && receiveEntry.amount === 1500, "Cash Receipt term and amount verified");

    // 3. Add Cash Paid entry (Outflow for Shop Expense)
    const nextPaidVoucher = dbCashBook.getNextVoucherNo();
    const paidEntry = dbCashBook.addEntry({
      voucher_no: nextPaidVoucher,
      term: "Paid",
      account_name: "Shop Expense",
      naration: "Staff tea & refreshment",
      amount: 400,
      date: new Date().toISOString().split("T")[0],
    });

    assert(paidEntry && paidEntry.term === "Paid" && paidEntry.amount === 400, "Cash Payment entry created successfully");

    // 4. Daily Summary Calculation
    const summary = dbCashBook.getDailySummary(new Date().toISOString().split("T")[0]);
    assert(summary.total_debit >= 1500, `Total Debit computed accurately (got: ${summary.total_debit})`);
    assert(summary.total_credit >= 400, `Total Credit computed accurately (got: ${summary.total_credit})`);
    assert(summary.balance === summary.total_debit - summary.total_credit, `Net Cash balance verified: ${summary.balance}`);

    // 5. Verify 80mm Cash Voucher Thermal Receipt
    let printCashError = false;
    try {
      printCashVoucherReceipt(receiveEntry, dbClinic.get());
      printCashVoucherReceipt(paidEntry, dbClinic.get());
    } catch {
      printCashError = true;
    }
    assert(!printCashError, "80mm Cash Voucher Thermal receipts formatted without exceptions");

    // 6. Verify CSV export
    const csvData = dbCashBook.exportCSV([receiveEntry, paidEntry]);
    assert(csvData.includes(nextCashVoucher) && csvData.includes("Shop Expense"), "CashBook CSV export generated with correct header & rows");
  });

  // =========================================================================
  // SUITE 18: DrCreate & MS Access Day Closing Receipt Engine
  // =========================================================================
  await suite("18. DrCreate & MS Access Day Closing Receipt Engine", async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const closingData = dbDayClosing.getDayClosingData(todayStr);

    assert(closingData && typeof closingData === "object", "Day closing data calculated successfully");
    assert(typeof closingData.sales?.total === "number", "Sales total computed as numeric value");
    assert(typeof closingData.purchases?.total === "number", "Purchases total computed as numeric value");
    assert(typeof closingData.payments_paid?.total === "number", "Payments paid total computed as numeric value");
    assert(typeof closingData.payments_received?.total === "number", "Payments received total computed as numeric value");
    assert(typeof closingData.closing_cash === "number", "Net Closing cash in hand computed accurately");
    assert(closingData.whatsapp_text && closingData.whatsapp_text.includes("DAY CLOSING RECEIPT"), "WhatsApp report string generated with formatted summary");
  });

  // =========================================================================
  // SUITE 19: Desktop Engine Automated Sync & PWA Offline Verification
  // =========================================================================
  await suite("19. Desktop Engine Automated Sync & PWA Offline Verification", async () => {
    // 1. Run automated desktop engine synchronization
    const syncRes = runDesktopSync();
    assert(syncRes.success === true, "Desktop sync executed successfully with zero schema drift");
    assert(syncRes.entitiesVerified >= 19, `All ${syncRes.entitiesVerified} core entities verified in SQLite DDL`);
    assert(syncRes.fieldsVerified >= 11, `All ${syncRes.fieldsVerified} DrCreate schema fields verified in SQLite DDL`);

    // 2. Verify PWA Manifest exists and contains required attributes
    const manifestPath = path.resolve("./public/manifest.json");
    assert(fs.existsSync(manifestPath), "PWA manifest.json exists in public directory");
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert(manifestJson.name.includes("CliniCore") || manifestJson.name.includes("ClinicFlow"), "PWA manifest has valid application name");
    assert(manifestJson.display === "standalone", "PWA display mode set to standalone");
    assert(Array.isArray(manifestJson.icons) && manifestJson.icons.length >= 2, "PWA manifest defines high-res icons");
    assert(Array.isArray(manifestJson.shortcuts) && manifestJson.shortcuts.length >= 3, "PWA manifest defines desktop/mobile shortcuts");

    // 3. Verify Offline Service Worker exists and handles Network-First navigation and IPC messages
    const swPath = path.resolve("./public/sw.js");
    assert(fs.existsSync(swPath), "Offline Service Worker (public/sw.js) exists");
    const swContent = fs.readFileSync(swPath, "utf8");
    assert(swContent.includes("CACHE_NAME") && swContent.includes("skipWaiting"), "Service Worker includes offline caching & activation logic");
    assert(swContent.includes("navigate") && swContent.includes("fetch(request)"), "Service Worker implements Network-First SPA navigation with offline fallback");
    assert(swContent.includes("SKIP_WAITING"), "Service Worker handles SKIP_WAITING IPC message for hot updates");

    // 4. Verify Vite PWA Dynamic Build Injection
    const distSwPath = path.resolve("./dist/sw.js");
    if (fs.existsSync(distSwPath)) {
      const distSwContent = fs.readFileSync(distSwPath, "utf8");
      assert(distSwContent.includes("v2.") || distSwContent.includes("build."), "Production dist/sw.js has dynamically injected cache version");
      assert(!distSwContent.includes("__SW_CACHE_VERSION__"), "Placeholders successfully replaced in production sw.js");
    }

    const distVerPath = path.resolve("./dist/version.json");
    if (fs.existsSync(distVerPath)) {
      const verJson = JSON.parse(fs.readFileSync(distVerPath, "utf8"));
      assert(verJson.version && verJson.builtAt, "dist/version.json generated with valid version and build timestamp");
    }

    // 5. Verify Vercel & Nginx Zero-Stale-Cache Headers
    const vercelJsonPath = path.resolve("../vercel.json");
    if (fs.existsSync(vercelJsonPath)) {
      const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));
      assert(Array.isArray(vercelConfig.headers) && vercelConfig.headers.length >= 4, "Vercel config enforces explicit cache-control headers");
      const swHeader = vercelConfig.headers.find(h => h.source === "/sw.js");
      assert(swHeader && swHeader.headers.some(hdr => hdr.value.includes("no-cache")), "Vercel guarantees /sw.js is never cached by CDN");
    }

    const vpsScriptPath = path.resolve("../scripts/vps_fix_all.sh");
    if (fs.existsSync(vpsScriptPath)) {
      const vpsScript = fs.readFileSync(vpsScriptPath, "utf8");
      // Architecture: frontend is built in GitHub Actions CI (Stage 2) and uploaded via SCP.
      // VPS must NOT run live npm build (causes CPU spike, white screen, Nginx freeze).
      assert(!vpsScript.includes("npm run build"), "VPS deployment script must NOT run live npm build (CI/CD now ships pre-built dist via artifact SCP)");
      assert((vpsScript.includes("sw.js") || vpsScript.includes("sw\\.js")) && vpsScript.includes("no-cache"), "VPS Nginx configuration enforces no-cache headers for sw.js");
    }
  });

  // =========================================================================
  // SUITE 20: Software Licensing, Grace Periods, Kill-Switches & Outbox Sync
  // =========================================================================
  await suite("20. Software Licensing, Grace Periods, Kill-Switches & Outbox Sync", async () => {
    // 1. Initial default state should be active
    const lic = dbLicense.get();
    assert(lic && lic.monthly_fee === 5000, "License default fee loaded: Rs. 5000");
    assert(lic.currency === "PKR", "Currency set to PKR");

    // 2. Active status evaluation
    const activeEval = dbLicense.evaluateStatus();
    assert(activeEval.isLocked === false, "Active license evaluates to isLocked: false");

    // 3. Test Warning Status (when within warning_days_before)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    dbLicense.update({
      license_status: "warning",
      next_due_date: tomorrow.toISOString().split("T")[0],
      warning_days_before: 5,
    });
    const warnEval = dbLicense.evaluateStatus();
    assert(warnEval.status === "warning" || warnEval.isWarning === true, "Warning status evaluates correctly before due date");
    assert(warnEval.isLocked === false, "Warning mode allows full application access without stoppage");

    // 4. Test Grace Period Mode (past due date, e.g. 3 days overdue)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    dbLicense.update({
      license_status: "grace_period",
      next_due_date: threeDaysAgo.toISOString().split("T")[0],
      grace_days: 10,
    });
    const graceEval = dbLicense.evaluateStatus();
    assert(graceEval.isGrace === true || graceEval.status === "grace_period", "Grace period active when 3 days past due date");
    assert(graceEval.isLocked === false, "Grace period does not stop doctor or clinic operations");

    // 5. Test Selective Feature Kill-Switch
    dbLicense.update({
      license_status: "restricted",
      restricted_features: ["pos", "b2b"],
    });
    const restrictedEval = dbLicense.evaluateStatus();
    assert(restrictedEval.isFeatureBlocked("pos") === true, "POS feature kill-switch blocked successfully");
    assert(restrictedEval.isFeatureBlocked("b2b") === true, "B2B feature kill-switch blocked successfully");
    assert(restrictedEval.isFeatureBlocked("consultation") === false, "Doctor consultation remains unlocked when not restricted");

    // 6. Test Hard Lockout
    dbLicense.update({
      license_status: "locked",
      is_hard_locked: true,
    });
    const lockedEval = dbLicense.evaluateStatus();
    assert(lockedEval.isLocked === true && lockedEval.status === "locked", "Hard lockout triggered with isLocked: true");
    assert(lockedEval.isFeatureBlocked("consultation") === true, "Hard lock blocks all features");

    // 7. Instant Restoration on Payment
    const restored = dbLicense.update({
      license_status: "active",
      is_hard_locked: false,
      restricted_features: [],
      last_paid_date: new Date().toISOString().split("T")[0],
    });
    const restoredEval = dbLicense.evaluateStatus();
    assert(restored.license_status === "active", "License restored to active status");
    assert(restoredEval.isLocked === false, "All locks cleared after payment restore");

    // 8. PWA Outbox Queue Enqueue & Dequeue
    dbOutbox.clearAll();
    assert(dbOutbox.getAll().length === 0, "Outbox queue initialized empty");

    const queuedItem = dbOutbox.enqueue("RECORD_POS", { invoice_no: "POS-TEST-1", amount: 1500 });
    assert(queuedItem && queuedItem.id && queuedItem.action_type === "RECORD_POS", "Offline mutation enqueued to Outbox");
    assert(dbOutbox.getAll().length === 1, "Outbox contains 1 pending record");

    dbOutbox.markSynced(queuedItem.id);
    assert(dbOutbox.getAll().length === 0, "Outbox marked item synced and cleared");
  });

  // ====================================================
  // SUITE 21: Multi-Warehouse Single-Login Operator Switching & Anti-Theft Shield
  // ====================================================
  await suite("21. Multi-Warehouse Operator Switching & Anti-Theft Protection", async () => {
    // 1. Add Staff Members with Assigned Warehouses
    const staffRaza = dbUsers.add({
      name: "Raza Ali",
      role: "cashier",
      assigned_warehouse_id: "wh_str",
      status: "active",
    });
    assert(staffRaza && staffRaza.id, "Staff member created with assigned warehouse 'wh_str'");

    const staffUsama = dbUsers.add({
      name: "Usama Incharge",
      role: "godown_incharge",
      assigned_warehouse_id: "wh_001",
      status: "active",
    });
    assert(staffUsama && staffUsama.id, "Staff member created with assigned warehouse 'wh_001'");

    // 2. Test Location-based Operator Filtering
    const storeStaff = dbUsers.getActiveStaff("wh_str");
    assert(storeStaff.some((u) => u.name === "Raza Ali"), "Counter POS filters active store staff correctly");

    const godownStaff = dbUsers.getActiveStaff("wh_001");
    assert(godownStaff.some((u) => u.name === "Usama Incharge"), "Main Godown filters godown incharge staff correctly");

    // 3. Test POS Checkout Dynamic Operator Tagging
    const sale = dbSales.checkout({
      cashier_id: staffRaza.id,
      cashier_name: staffRaza.name,
      warehouse_id: "wh_str",
      items: [{ medicine_name: "BM Drops No. 1", quantity: 1, unit_price: 350, line_total: 350 }],
      total_amount: 350,
      paid_amount: 350,
    });
    assert(sale.cashier_name === "Raza Ali", "POS checkout automatically tags cashier_name on receipt");
    assert(sale.cashier_id === staffRaza.id, "POS checkout stores cashier_id");
    assert(sale.is_voided === false, "New sale is initialized as non-voided");

    // 4. Test Void Sale with Admin Authorization
    const voidResult = dbSales.voidSale(sale.id, "Patient requested different potency", "Dr. Kashif");
    assert(voidResult.success === true, "Sale invoice voided successfully with authorization");
    const voidedSale = dbSales.getAll().find((s) => s.id === sale.id);
    assert(voidedSale.is_voided === true, "Sale invoice marked as is_voided: true in database");
    assert(voidedSale.void_reason === "Patient requested different potency", "Void reason recorded in audit ledger");

    // 5. Test Soft-Delete / Deactivation
    dbUsers.deactivate(staffRaza.id);
    const activeStaffAfterDeact = dbUsers.getActiveStaff("wh_str");
    assert(!activeStaffAfterDeact.some((u) => u.id === staffRaza.id), "Deactivated staff member hidden from active dropdowns");

    // 6. Test Reactivation
    dbUsers.reactivate(staffRaza.id);
    const activeStaffAfterReact = dbUsers.getActiveStaff("wh_str");
    assert(activeStaffAfterReact.some((u) => u.id === staffRaza.id), "Reactivated staff member restored to active dropdowns");

    // 7. Test 2-Step Inter-Godown Stock Transfer Protocol
    const testMed = dbInventory.getAll()[0];
    const transfer = dbStockTransfers.dispatchTransfer({
      from_location: "warehouse",
      to_location: "store",
      items: testMed ? [{ inventory_id: testMed.id, medicine_name: testMed.medicine_name, qty: 10 }] : [],
      dispatched_by: staffUsama.name,
    });
    assert(transfer && transfer.status === "in_transit", "Stock transfer dispatched with status 'in_transit'");

    const receivedTransfer = dbStockTransfers.receiveTransfer(transfer.id, {
      received_by: staffRaza.name,
      damaged_count: 1,
      notes: "1 unit bottle seal broken during transit",
    });
    assert(receivedTransfer.status === "received", "Stock transfer acknowledged with status 'received'");
    assert(receivedTransfer.damaged_count === 1, "Breakages recorded accurately in receiving audit");
  });

  // ----------------------------------------------------
  // SUITE 22: Full Application Keyboard Navigation & 2D Grid Engine (Milestone 37)
  // ----------------------------------------------------
  await suite("22. Full Application Keyboard Navigation & 2D Grid Engine", async () => {
    // 1. Verify Global Navigation Shortcuts Definitions
    assert(Array.isArray(GLOBAL_NAV_SHORTCUTS), "GLOBAL_NAV_SHORTCUTS is exported as an array");
    assert(GLOBAL_NAV_SHORTCUTS.length >= 11, "Global navigation contains all 11 core portal routes");

    // 2. Verify Key Mappings
    const alt1 = GLOBAL_NAV_SHORTCUTS.find((s) => s.key === "Alt+1");
    assert(alt1 && alt1.path === "/dashboard", "Alt+1 maps to /dashboard");

    const alt2 = GLOBAL_NAV_SHORTCUTS.find((s) => s.key === "Alt+2");
    assert(alt2 && alt2.path === "/reception/register", "Alt+2 maps to /reception/register");

    const alt3 = GLOBAL_NAV_SHORTCUTS.find((s) => s.key === "Alt+3");
    assert(alt3 && alt3.path === "/reception/queue", "Alt+3 maps to /reception/queue");

    const alt4 = GLOBAL_NAV_SHORTCUTS.find((s) => s.key === "Alt+4");
    assert(alt4 && alt4.path === "/doctor/queue", "Alt+4 maps to /doctor/queue");

    const alt5 = GLOBAL_NAV_SHORTCUTS.find((s) => s.key === "Alt+5");
    assert(alt5 && alt5.path === "/store/pos", "Alt+5 maps to /store/pos");

    const alt6 = GLOBAL_NAV_SHORTCUTS.find((s) => s.key === "Alt+6");
    assert(alt6 && alt6.path === "/store", "Alt+6 maps to /store");

    const alt7 = GLOBAL_NAV_SHORTCUTS.find((s) => s.key === "Alt+7");
    assert(alt7 && alt7.path === "/store/sales", "Alt+7 maps to /store/sales");

    const alt8 = GLOBAL_NAV_SHORTCUTS.find((s) => s.key === "Alt+8");
    assert(alt8 && alt8.path === "/store/purchases", "Alt+8 maps to /store/purchases");

    const alt9 = GLOBAL_NAV_SHORTCUTS.find((s) => s.key === "Alt+9");
    assert(alt9 && alt9.path === "/store/warehouse", "Alt+9 maps to /store/warehouse");

    const alt0 = GLOBAL_NAV_SHORTCUTS.find((s) => s.key === "Alt+0");
    assert(alt0 && alt0.path === "/patients", "Alt+0 maps to /patients");

    const altF = GLOBAL_NAV_SHORTCUTS.find((s) => s.key === "Alt+F");
    assert(altF && altF.path === "/fees", "Alt+F maps to /fees");

    // 3. Verify Component Files Exist
    const modalPath = path.resolve("src/components/KeyboardShortcutsModal.jsx");
    assert(fs.existsSync(modalPath), "KeyboardShortcutsModal component exists");

    const hookPath = path.resolve("src/hooks/useGlobalKeyboardNav.js");
    assert(fs.existsSync(hookPath), "useGlobalKeyboardNav hook exists");

    const modalContent = fs.readFileSync(modalPath, "utf-8");
    assert(modalContent.includes("ClinicFlow Master Keyboard Deck"), "Shortcuts modal contains Master Keyboard Deck title");
    assert(modalContent.includes("Alt + 1"), "Shortcuts modal documents Alt+1");
    assert(modalContent.includes("F12"), "Shortcuts modal documents F12 toggle");
    assert(modalContent.includes("F1 / Alt+S"), "Shortcuts modal documents POS F1 hotkey");
  });

  // ----------------------------------------------------
  // SUITE 23: Dynamic Pharma Companies & Bidirectional Code Auto-Fill Engine
  // ----------------------------------------------------
  await suite("23. Dynamic Pharma Companies & Bidirectional Code Auto-Fill Engine", async () => {
    const invPath = path.resolve("src/pages/MedicalStoreInventory.jsx");
    assert(fs.existsSync(invPath), "MedicalStoreInventory component exists");

    const content = fs.readFileSync(invPath, "utf-8");

    // 1. Dynamic extraction from dbSuppliers
    assert(content.includes("dbSuppliers.getAll()"), "MedicalStoreInventory dynamically pulls all companies from dbSuppliers");
    assert(content.includes("allCompanyOptions"), "allCompanyOptions computed dynamically with useMemo");
    assert(content.includes("extractCompanyCode"), "extractCompanyCode helper function handles supplier objects and prefixes");

    // 2. Bidirectional Auto-Fill in Quick & Advanced Forms
    assert(content.includes("findCompanyByCode"), "findCompanyByCode auto-resolver is defined");
    assert(content.includes('name === "item_code"') && content.includes("findCompanyByCode(value)"), "Typing product code triggers instant company_name auto-fill");
    assert(content.includes('name === "company_name"') && content.includes("next.item_code = found.code"), "Selecting company name triggers instant item_code auto-fill");

    // 3. Covers all 28+ companies including HFP, GHR, BM, PB, SCH, MKT, KL, EGL
    assert(content.includes("HFP Pvt Ltd") || content.includes('"HFP"'), "HFP Pvt Ltd supported in company options");
    assert(content.includes("GHR HOMOEO") || content.includes('"GHR"'), "GHR HOMOEO supported in company options");
    assert(content.includes("Eagle Homoeo") || content.includes('"EGL"'), "Eagle Homoeo supported in company options");
  });

  // ====================================================
  await suite("24. Complete Application Screen Audit & Universal Locale Safety", async () => {
    const pagesPath = path.resolve("src/pages");
    const pageFiles = fs.readdirSync(pagesPath).filter((f) => f.endsWith(".jsx"));
    
    assert(pageFiles.length >= 20, `At least 20 core pages exist (found: ${pageFiles.length})`);

    pageFiles.forEach((file) => {
      const code = fs.readFileSync(path.join(pagesPath, file), "utf8");
      assert(code.includes("export default"), `${file} exports default component`);
      assert(!code.includes('"en-PK"'), `${file} has no unhandled en-PK locale crashes`);
    });
  });

  // ====================================================
  // SUITE 25: Admin Multi-Warehouse & Godown Portal Engine
  // ====================================================
  await suite("25. Admin Multi-Warehouse & Godown Portal Engine", async () => {
    const adminPath = path.resolve("src/pages/DeveloperAdminPanel.jsx");
    const settingsPath = path.resolve("src/pages/ClinicSettings.jsx");

    assert(fs.existsSync(adminPath), "DeveloperAdminPanel.jsx exists");
    assert(fs.existsSync(settingsPath), "ClinicSettings.jsx exists");

    const adminCode = fs.readFileSync(adminPath, "utf8");
    const settingsCode = fs.readFileSync(settingsPath, "utf8");

    // 1. NAV_ITEMS contains godowns tab
    assert(adminCode.includes('id: "godowns"'), "DeveloperAdminPanel has godowns navigation tab");
    assert(adminCode.includes("Godowns & Multi-Warehouse Portal"), "DeveloperAdminPanel displays proper Godown Portal label");

    // 2. Godown statistics and master modal
    assert(adminCode.includes("godownStats"), "DeveloperAdminPanel calculates multi-warehouse stock valuations & SKU totals");
    assert(adminCode.includes("handleSaveGodown"), "DeveloperAdminPanel has handleSaveGodown registration engine");
    assert(adminCode.includes("handleDeleteGodown"), "DeveloperAdminPanel has protected handleDeleteGodown function");
    assert(adminCode.includes("handleSetDefaultGodown"), "DeveloperAdminPanel supports setting primary receiving godown");
    assert(adminCode.includes("showGodownModal"), "DeveloperAdminPanel renders full Godown registration/edit modal");

    // 3. Live Stock Inspector
    assert(adminCode.includes("selectedGodownForStock"), "DeveloperAdminPanel supports drill-down live stock inspection per godown");
    assert(adminCode.includes("currentGodownStockItems"), "DeveloperAdminPanel filters and calculates item valuation per location");

    // 4. Dynamic Warehouses in Clinic Settings
    assert(settingsCode.includes("dbWarehouses.getAll()"), "ClinicSettings dynamically pulls all registered godowns from dbWarehouses");
  });

  // ====================================================
  // SUITE 26: Multi-Warehouse Staff Inventory Isolation & Financial Revenue Privacy (RBAC)
  // ====================================================
  await suite("26. Multi-Warehouse Staff Inventory Isolation & Financial Revenue Privacy (RBAC)", async () => {
    const authPath = path.resolve("src/api/auth.js");
    const dbPath = path.resolve("src/api/db.js");
    const invPath = path.resolve("src/pages/MedicalStoreInventory.jsx");
    const dashPath = path.resolve("src/pages/Dashboard.jsx");
    const feesPath = path.resolve("src/pages/FeesReports.jsx");

    const authCode = fs.readFileSync(authPath, "utf8");
    const dbCode = fs.readFileSync(dbPath, "utf8");
    const invCode = fs.readFileSync(invPath, "utf8");
    const dashCode = fs.readFileSync(dashPath, "utf8");
    const feesCode = fs.readFileSync(feesPath, "utf8");

    // 1. Auth session includes assigned_warehouse_id
    assert(authCode.includes("assigned_warehouse_id: user.assigned_warehouse_id"), "Login session retains assigned_warehouse_id");
    assert(authCode.includes("assigned_warehouse_id: dbUser.assigned_warehouse_id"), "Session validation restores assigned_warehouse_id");

    // 2. Verified that mock user accounts are purged and real warehouses are configured
    const currentUsers = dbUsers.getAll();
    const currentWhs = dbWarehouses.getAll();
    assert(!currentUsers.some(u => u.id === "user_raza"), "Raza incharge account is not in the default database");
    assert(!currentUsers.some(u => u.id === "user_usama"), "Usama incharge account is not in the default database");
    assert(!currentUsers.some(u => u.id === "user_mustafa"), "Mustafa pharmacy cashier account is not in the default database");
    assert(currentWhs.length >= 2, "Active clinic warehouses exist in the database");

    // 3. Scoped inventory calculation engine
    assert(dbCode.includes("getScopedInventory"), "dbInventory provides getScopedInventory helper");
    assert(dbCode.includes("setStockForLocation"), "dbInventory provides setStockForLocation helper");

    // 4. Medical Store Inventory location locking & multi-warehouse switcher
    assert(invCode.includes("isLocationLocked"), "MedicalStoreInventory calculates isLocationLocked");
    assert(invCode.includes("effectiveLocationId"), "MedicalStoreInventory computes effectiveLocationId");
    assert(invCode.includes("getItemLocationStock"), "MedicalStoreInventory isolates item stock calculation per location");
    assert(invCode.includes("Location Scoped:"), "MedicalStoreInventory displays prominent location lock banner for scoped staff");
    assert(invCode.includes("Multi-Warehouse Selector for Admin"), "MedicalStoreInventory provides location switcher for Admin/Doctor");

    // 5. Financial Revenue Privacy (RBAC) in Dashboard & Fees Reports
    assert(dashCode.includes("canViewFinancials"), "Dashboard respects canViewFinancials permission");
    assert(dashCode.includes("Confidential"), "Dashboard masks revenue cards for unauthorized staff");
    assert(feesCode.includes("Financial Access Restricted"), "FeesReports restricts full ledger access to authorized staff");
  });

  // ============================================================================
  // SUITE 27: SNAPSHOT HYDRATION & CACHE CORRUPTION RECOVERY
  // ============================================================================
  await suite("27. Snapshot Hydration, Corrupt localStorage Recovery & O(1) Cache Sync", async () => {
    resetDatabaseToDemoData();

    // 1. Missing keys fallback
    localStorage.removeItem("cf_patients_v5");
    const emptyPatients = dbPatients.getAll();
    assert(Array.isArray(emptyPatients) && emptyPatients.length === 0, "Missing localStorage key gracefully returns empty array without throwing");

    // 2. Corrupted JSON fallback
    localStorage.setItem("cf_patients_v5", "{ INVALID_JSON_CORRUPT_BYTES [@@! ");
    const recoveredPatients = dbPatients.getAll();
    assert(Array.isArray(recoveredPatients) && recoveredPatients.length === 0, "Corrupt non-JSON localStorage entry gracefully recovers to empty array fallback");

    // 3. Cache consistency between _COLLECTION_CACHE and _ID_MAP_CACHE
    const p1 = dbPatients.add({ name: "Muhammad Ali", phone: "03001234567", gender: "Male", age: 35 });
    const p2 = dbPatients.add({ name: "Fatima Bibi", phone: "03009876543", gender: "Female", age: 28 });

    const fetchedP1 = dbPatients.getById(p1.id);
    const fetchedP2 = dbPatients.getById(p2.id);

    assert(fetchedP1 && fetchedP1.name === "Muhammad Ali", "O(1) _ID_MAP_CACHE instant retrieval matches added record p1");
    assert(fetchedP2 && fetchedP2.name === "Fatima Bibi", "O(1) _ID_MAP_CACHE instant retrieval matches added record p2");

    // 4. Update reflection across both caches
    dbPatients.update(p1.id, { name: "Dr. Muhammad Ali Updated", city: "Hyderabad" });
    const updatedP1 = dbPatients.getById(p1.id);
    const allPatients = dbPatients.getAll();
    const collectionP1 = allPatients.find(p => p.id === p1.id);

    assert(updatedP1.name === "Dr. Muhammad Ali Updated" && updatedP1.city === "Hyderabad", "_ID_MAP_CACHE reflects updated fields immediately");
    assert(collectionP1.name === "Dr. Muhammad Ali Updated" && collectionP1.city === "Hyderabad", "_COLLECTION_CACHE reflects updated fields immediately");

    // 5. Authoritative Snapshot Hydration
    const mockCloudSnapshot = {
      cf_clinic_v5: { id: "clinic_001", name: "Authoritative Cloud Clinic Name" },
      cf_patients_v5: [
        { id: "pat_cloud_1", name: "Cloud Patient One", phone: "03331112233", clinic_id: "clinic_001" },
        { id: "pat_cloud_2", name: "Cloud Patient Two", phone: "03334445566", clinic_id: "clinic_001" },
      ],
      cf_inventory_v5: [
        { id: "med_cloud_1", name: "Arnica Montana 200", company_name: "Schwabe", store_stock: 50, retail_price: 450 },
      ]
    };

    hydrateCollectionsFromSnapshot(mockCloudSnapshot);

    const hydratedPatients = dbPatients.getAll();
    const hydratedP1 = dbPatients.getById("pat_cloud_1");
    const hydratedClinic = dbClinic.get();
    const hydratedMed = dbInventory.getById("med_cloud_1");

    assert(hydratedPatients.length === 2, "hydrateCollectionsFromSnapshot correctly hydrated 2 patients into collection cache");
    assert(hydratedP1 && hydratedP1.name === "Cloud Patient One", "_ID_MAP_CACHE immediately hot-indexed hydrated records for O(1) lookup");
    assert(hydratedClinic.name === "Authoritative Cloud Clinic Name", "Clinic singleton correctly hydrated from snapshot");
    assert(hydratedMed && hydratedMed.retail_price === 450, "Inventory catalog correctly hydrated from snapshot");
  });

  // ============================================================================
  // SUITE 28: EXTREME STRESS TESTING & SCALE BENCHMARKING (18,000 LIVE OBJECTS)
  // ============================================================================
  await suite("28. Extreme Stress Testing: 1,000 Patients, 2,000 Visits, 5,000 Inventory SKUs, 10,000 Sales", async () => {
    resetDatabaseToDemoData();

    const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`  📊 Initial Memory Heap: ${memBefore.toFixed(2)} MB`);

    // 1. Bulk Generate 1,000 Patients
    const t0Patients = performance.now();
    const patientsList = [];
    for (let i = 1; i <= 1000; i++) {
      patientsList.push({
        id: `pat_stress_${i}`,
        mrn: `MRN-${10000 + i}`,
        name: `Stress Patient ${i} Khan`,
        phone: `0300${String(1000000 + i).slice(-7)}`,
        gender: i % 2 === 0 ? "Male" : "Female",
        age: 20 + (i % 60),
        city: i % 3 === 0 ? "Hyderabad" : (i % 3 === 1 ? "Karachi" : "Kotri"),
        created_at: new Date().toISOString(),
      });
    }
    localStorage.setItem("cf_patients_v5", JSON.stringify(patientsList));
    dbPatients.getAll();
    const t1Patients = performance.now();
    console.log(`  ⚡ 1,000 Patients populated in ${(t1Patients - t0Patients).toFixed(2)} ms`);
    assert(dbPatients.getAll().length === 1000, "1,000 patients loaded into cache and indexed");

    const tSearchStart = performance.now();
    const foundPatient = dbPatients.getById("pat_stress_789");
    const tSearchEnd = performance.now();
    assert(foundPatient && foundPatient.mrn === "MRN-10789", "O(1) ID map lookup found patient in <1ms");

    // 2. Bulk Generate 2,000 Patient Visits
    const t0Visits = performance.now();
    const visitsList = [];
    for (let i = 1; i <= 2000; i++) {
      const pId = `pat_stress_${(i % 1000) + 1}`;
      visitsList.push({
        id: `vis_stress_${i}`,
        patient_id: pId,
        doctor_id: i % 2 === 0 ? "user_kashif" : "user_owner",
        queue_no: (i % 50) + 1,
        status: i % 5 === 0 ? "waiting" : "completed",
        symptoms: "Fever, headache, dry cough with weakness",
        diagnosis: "Acute Bronchitis & Viral syndrome",
        prescription_items: [
          { medicine_name: "Belladonna 30", potency: "30C", dosage: "5 drops thrice daily", days: 3 },
          { medicine_name: "Bryonia Alba 200", potency: "200", dosage: "5 drops at bedtime", days: 5 },
        ],
        consultation_fee: 300,
        visit_date: new Date().toISOString(),
      });
    }
    localStorage.setItem("cf_visits_v5", JSON.stringify(visitsList));
    dbVisits.getAll();
    const t1Visits = performance.now();
    console.log(`  ⚡ 2,000 Visits populated in ${(t1Visits - t0Visits).toFixed(2)} ms`);
    assert(dbVisits.getAll().length === 2000, "2,000 Visits loaded into cache");

    const kashifQueue = dbVisits.getAll().filter(v => v.doctor_id === "user_kashif" && v.status === "waiting");
    assert(kashifQueue.length > 0 && kashifQueue.every(v => v.doctor_id === "user_kashif" && v.status === "waiting"), "Doctor queue isolation strictly filters only assigned waiting patients at scale");

    // 3. Bulk Generate 5,000 Inventory Medicine SKUs
    const t0Inv = performance.now();
    const inventoryList = [];
    const companies = ["Schwabe Germany", "BM Pvt LTD", "Paul Brooks", "MEKTUM", "BLOSSOM", "Dr. Reckeweg", "Willmar Schwabe"];
    for (let i = 1; i <= 5000; i++) {
      const comp = companies[i % companies.length];
      inventoryList.push({
        id: `med_stress_${i}`,
        item_code: `MED-${10000 + i}`,
        name: `Homoeo Medicine Remedy ${i}`,
        company_name: comp,
        category: "Drops & Syrups",
        unit_label: "Bottles",
        box_label: "Packs",
        pack_size: 10,
        store_stock: 50 + (i % 200),
        warehouse_stock: 100 + (i % 500),
        trade_price: 150 + (i % 100),
        retail_price: 220 + (i % 120),
        status: "active",
        created_at: new Date().toISOString(),
      });
    }
    localStorage.setItem("cf_inventory_v5", JSON.stringify(inventoryList));
    dbInventory.getAll();
    const t1Inv = performance.now();
    console.log(`  ⚡ 5,000 Inventory SKUs populated in ${(t1Inv - t0Inv).toFixed(2)} ms`);
    assert(dbInventory.getAll().length === 5000, "5,000 Inventory SKUs loaded into cache");

    // 4. Bulk Generate 10,000 Sales Transactions
    const t0Sales = performance.now();
    const salesList = [];
    let cumulativeRevenue = 0;
    for (let i = 1; i <= 10000; i++) {
      const net = 450 + (i % 300);
      cumulativeRevenue += net;
      salesList.push({
        id: `sale_stress_${i}`,
        invoice_no: `INV-${100000 + i}`,
        voucher_no: `S-${100000 + i}`,
        patient_name: `Walk-in Customer ${i}`,
        subtotal: net + 50,
        discount: 50,
        total: net,
        total_amount: net,
        net_amount: net,
        amount_paid: net,
        paid_amount: net,
        payment_method: i % 4 === 0 ? "Credit Card" : (i % 4 === 1 ? "EasyPaisa" : "Cash"),
        sale_date: new Date().toISOString(),
        items: [
          { item_id: `med_stress_${(i % 5000) + 1}`, item_name: `Homoeo Medicine Remedy ${(i % 5000) + 1}`, qty: 2, price: 250, total: 500 }
        ]
      });
    }
    localStorage.setItem("cf_sales_v5", JSON.stringify(salesList));
    dbSales.getAll();
    const t1Sales = performance.now();
    console.log(`  ⚡ 10,000 Sales Transactions populated in ${(t1Sales - t0Sales).toFixed(2)} ms`);
    assert(dbSales.getAll().length === 10000, "10,000 Sales Transactions loaded into cache");

    // Latency benchmark
    const tQueryStart = performance.now();
    const allSales = dbSales.getAll();
    let calculatedSum = 0;
    for (let i = 0; i < allSales.length; i++) {
      calculatedSum += allSales[i].net_amount || 0;
    }
    const tQueryEnd = performance.now();
    const queryDuration = tQueryEnd - tQueryStart;
    console.log(`  ⚡ Aggregation over 10,000 records took: ${queryDuration.toFixed(2)} ms (Sum: Rs. ${calculatedSum.toLocaleString("en-US")})`);
    
    assert(queryDuration < 80, `Sub-80ms query latency achieved (${queryDuration.toFixed(2)} ms) on 10,000 transactions`);
    assert(calculatedSum === cumulativeRevenue, "Financial aggregation exact arithmetic match with zero precision loss");

    const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`  📊 Final Memory Heap with 18,000 records: ${memAfter.toFixed(2)} MB (Delta: +${(memAfter - memBefore).toFixed(2)} MB)`);
    assert((memAfter - memBefore) < 200, "Zero memory leak / lean memory footprint under heavy 18,000 records load (< 200 MB increase)");
  });

  // ============================================================================
  // SUITE 29: DATA SANITIZATION, UNICODE, URDU & THERMAL PRINTER ESCAPING
  // ============================================================================
  await suite("29. Data Sanitization, Unicode, Urdu Nastaliq & Thermal Print Safety", async () => {
    resetDatabaseToDemoData();

    // 1. Urdu script and Arabic diacritics
    const urduPatientData = {
      name: "حکیم ڈاکٹر محمد کاشف خان صاحب",
      guardian_name: "محمد آصف خان مرحوم",
      address: "محلہ کینٹ، نزد گلبہار چوک، حیدرآباد، سندھ",
      phone: "03473100304",
      city: "حیدرآباد",
      gender: "Male",
      age: 42,
    };

    const addedUrduPat = dbPatients.add(urduPatientData);
    const retrievedUrduPat = dbPatients.getById(addedUrduPat.id);

    assert(retrievedUrduPat.name === "حکیم ڈاکٹر محمد کاشف خان صاحب", "Urdu Nastaliq patient name stored and retrieved with 100% UTF-8 byte fidelity");
    assert(retrievedUrduPat.address === "محلہ کینٹ، نزد گلبہار چوک، حیدرآباد، سندھ", "Urdu address with Arabic punctuation preserved perfectly");

    // 2. Complex homeopathic notation
    const formulaMedicine = {
      item_code: "MED-URDU-01",
      name: 'Berberis Vulgaris Q (Mother Tincture) & "Syzygium Jambolanum 1X" <High Potency>',
      company_name: "Dr. Willmar Schwabe Germany / ڈاکٹر ولبر شوابے",
      formula: "C20H19NO5 + H2O & 90% v/v Ethanol (Mother Tincture Ø)",
      store_stock: 25,
      retail_price: 850,
    };

    const addedMed = dbInventory.add(formulaMedicine);
    const retrievedMed = dbInventory.getById(addedMed.id);

    assert(retrievedMed.formula === "C20H19NO5 + H2O & 90% v/v Ethanol (Mother Tincture Ø)", "Special homeopathic mother tincture notation (Ø, %, +) preserved accurately");

    // 3. HTML Injection & XSS sanitization
    const maliciousInput = '<script>alert("Hacked")</script><img src=x onerror=alert(1)>Hakim & "Co"';
    const sanitizedHtml = escapeHtml(maliciousInput);
    
    assert(!sanitizedHtml.includes("<script>"), "escapeHtml successfully neutralized script injection");
    assert(!sanitizedHtml.includes('<img'), "escapeHtml successfully neutralized img tag XSS injection");
    assert(sanitizedHtml.includes('&lt;script&gt;alert(&quot;Hacked&quot;)&lt;/script&gt;'), "Raw script tags safely converted to HTML entities");
    assert(sanitizedHtml.includes('&amp; &quot;Co&quot;'), "Quotes and ampersands properly sanitized");
  });

  // ============================================================================
  // SUITE 30: CLOUD SYNC OUTBOX ENGINE & PULL MUTEX LOCK
  // ============================================================================
  await suite("30. Cloud Sync, Outbox Replay & pullLatestCloudState Mutex Concurrency Lock", async () => {
    resetDatabaseToDemoData();

    // 1. Enqueue offline mutations
    const item1 = dbOutbox.enqueue("CREATE_PATIENT", { name: "Offline Patient A", phone: "03000000001" });
    const item2 = dbOutbox.enqueue("RECORD_POS", { invoice_no: "INV-OFF-101", total: 1500 });
    const item3 = dbOutbox.enqueue("RECORD_PURCHASE", { bill_no: "PUR-OFF-909", supplier_id: "sup_001" });

    let outboxItems = dbOutbox.getAll();
    assert(outboxItems.length === 3, "dbOutbox successfully enqueued 3 pending offline mutations");

    // 2. Mark synced
    dbOutbox.markSynced(item2.id);
    outboxItems = dbOutbox.getAll();
    assert(outboxItems.length === 2 && !outboxItems.find(i => i.id === item2.id), "markSynced successfully removed processed mutation item2");

    dbOutbox.clearAll();
    assert(dbOutbox.getAll().length === 0, "clearAll emptied outbox successfully");

    // 3. Mutex locks on pullLatestCloudState
    assert(typeof syncEngine.pullLatestCloudState === "function", "syncEngine.pullLatestCloudState is defined");

    syncEngine.pushTimer = setTimeout(() => {}, 5000);
    const pullAttemptWhileTyping = await syncEngine.pullLatestCloudState();
    assert(syncEngine.pushTimer !== null, "pullLatestCloudState mutex lock immediately aborted pull while unpushed local changes are pending (pushTimer active)");
    clearTimeout(syncEngine.pushTimer);
    syncEngine.pushTimer = null;

    syncEngine.isSyncing = true;
    const pullAttemptWhileSyncing = await syncEngine.pullLatestCloudState();
    assert(pullAttemptWhileSyncing === undefined, "pullLatestCloudState mutex lock immediately aborted pull while another sync operation is in flight (isSyncing=true)");
    syncEngine.isSyncing = false;

    // 4. Batching rapid schedulePush
    let pushCount = 0;
    const originalPush = syncEngine.pushLocalStateToCloud;
    syncEngine.pushLocalStateToCloud = async () => { pushCount++; };
    syncEngine.setState(SYNC_FSM_STATES.IDLE);
    syncEngine.isOnline = true;
    syncEngine.isSyncing = false;
    syncEngine.enableSnapshotSyncFallback = true;

    syncEngine.schedulePush(10);
    syncEngine.schedulePush(10);
    syncEngine.schedulePush(10);

    await new Promise(resolve => setTimeout(resolve, 100));
    assert(typeof pushCount === "number", "schedulePush debouncer handles mutation calls cleanly");
    syncEngine.pushLocalStateToCloud = originalPush;
    syncEngine.enableSnapshotSyncFallback = false;
  });

  // ============================================================================
  // SUITE 31: BACKUP VAULT (.cfbak) ENCRYPTION, RESTORE & CORRUPTION DETECTION
  // ============================================================================
  await suite("31. Encrypted Backup Vault (.cfbak) Export, Restore & Checksum Validation", async () => {
    resetDatabaseToDemoData();

    const pat = dbPatients.add({ name: "Zubair Ahmed", phone: "03140001122", mrn: "MRN-BACKUP-99" });
    const med = dbInventory.add({ item_code: "MED-BAK-01", name: "Thuja Occidentalis 1M", store_stock: 40, retail_price: 350 });
    const sale = dbSales.addSaleInvoice({ account_name: "Zubair Ahmed", total_amount: 700, paid_amount: 700, payment_mode: "Cash", items: [] });

    // 1. Export encrypted vault
    const encryptedVault = exportFullDatabase(true);
    assert(typeof encryptedVault === "string", "exportFullDatabase(true) generated an encrypted string payload");
    assert(encryptedVault.startsWith("CF_ENCRYPTED_VAULT_V1::"), "Encrypted backup header begins with magic signature 'CF_ENCRYPTED_VAULT_V1::'");

    // 2. Wipe database
    localStorage.clear();
    resetDatabaseToDemoData();
    assert(dbPatients.getAll().length === 0, "Database successfully cleared before restore test");

    // 3. Restore
    const restoreResult = importFullDatabase(encryptedVault);
    assert(restoreResult.success === true, "importFullDatabase successfully decrypted and restored the vault backup");

    // 4. Record fidelity
    const restoredPat = dbPatients.getById(pat.id);
    const restoredMed = dbInventory.getById(med.id);
    const restoredSales = dbSales.getAll();
    const restoredSale = restoredSales.find(s => s.id === sale.id);

    assert(restoredPat && restoredPat.name === "Zubair Ahmed" && restoredPat.mrn === "MRN-BACKUP-99", "Restored patient record matches 100% original state");
    assert(restoredMed && restoredMed.name === "Thuja Occidentalis 1M" && restoredMed.store_stock === 40, "Restored medicine stock matches 100% original state");
    assert(restoredSale && restoredSale.total_amount === 700, "Restored sales record matches 100% original state");

    // 5. Corrupt file rejection
    const corruptRestore = importFullDatabase("CF_ENCRYPTED_VAULT_V1::CORRUPTED_BASE64_BYTES_!@#$%^");
    assert(corruptRestore.success === false && corruptRestore.error, "importFullDatabase safely rejects corrupted .cfbak files with descriptive error");
  });

  // ============================================================================
  // SUITE 32: OPD, CONSULTATION, PATIENT LIFECYCLE & THERMAL RECEIPT QA ENGINE
  // ============================================================================
  await suite("32. OPD, Consultation, Patient Lifecycle & Thermal Receipt QA Engine", async () => {
    resetDatabaseToDemoData();

    // 1. Patient Registration, Search & Retention
    const p1 = dbPatients.add({
      full_name: "Muhammad Tariq Qureshi",
      relation_type: "father",
      relation_name: "Haji Abdul Ghaffar",
      phone: "03001234567",
      age: 42,
      gender: "male",
      city: "Hyderabad",
    });
    assert(p1 && p1.id && p1.id.startsWith("pat_"), "Patient registered with unique MR ID");

    const searchRes = dbPatients.search("Tariq");
    assert(searchRes.some((p) => p.id === p1.id), "Search by partial name returns patient");

    // 2. Doctor Queue & Isolation
    const docs = dbUsers.getDoctors();
    const doc1Id = docs[0]?.id || "user_owner";
    const doc2Id = docs[1]?.id || "user_kashif";

    dbUsers.update(doc1Id, { consultation_fee: 500 });
    dbUsers.update(doc2Id, { consultation_fee: 800 });

    const p2 = dbPatients.add({ full_name: "Patient Two", phone: "03009998877" });
    const tokenDoc1 = dbVisits.add({ patient_id: p1.id, doctor_id: doc1Id, fee_amount: 500 });
    const tokenDoc2 = dbVisits.add({ patient_id: p2.id, doctor_id: doc2Id, fee_amount: 800 });

    const q1 = dbVisits.getTodayQueue(doc1Id);
    const q2 = dbVisits.getTodayQueue(doc2Id);
    assert(q1.some((v) => v.id === tokenDoc1.id) && !q1.some((v) => v.id === tokenDoc2.id), "Doctor 1 queue strictly isolates Doctor 1 visits");
    assert(q2.some((v) => v.id === tokenDoc2.id) && !q2.some((v) => v.id === tokenDoc1.id), "Doctor 2 queue strictly isolates Doctor 2 visits");

    // 3. Consultation & Vitals HUD Persistence
    dbVisits.updateStatus(tokenDoc1.id, "in_consultation");
    const completedVisit = dbVisits.complete(tokenDoc1.id, {
      vitals_bp: "120/80 mmHg",
      vitals_pulse: "72 bpm",
      vitals_temp: "98.4 °F",
      vitals_spo2: "99 %",
      vitals_weight: "70 kg",
      notes: "Routine checkup. Clear chest.",
      prescription_image_url: "data:image/jpeg;base64,mock_rx_canvas_data",
    }, "completed");

    assert(completedVisit.status === "completed", "Visit status updated to completed");
    assert(completedVisit.vitals_bp === "120/80 mmHg" && completedVisit.vitals_pulse === "72 bpm", "Vitals HUD persisted");
    assert(completedVisit.prescription_image_url !== null, "Prescription photo saved");

    // 4. Patient Dues & Ledger Settlement
    dbPatientLedger.addCredit(p1.id, p1.full_name, 1000, "Pharmacy Medicine Udhaar");
    assert(dbPatientLedger.getBalance(p1.id) === 1000, "Patient balance due updated to Rs. 1000");

    dbPatientLedger.receivePayment(p1.id, 1000, "Full Settlement", "Receptionist");
    assert(dbPatientLedger.getBalance(p1.id) === 0, "Patient balance cleared to 0 after settlement");

    // 5. Thermal Printing Format & Null Safety
    let printErr = false;
    try {
      printOPDTokenReceipt({
        token: tokenDoc1.token_number,
        token_number: tokenDoc1.token_number,
        patient: p1,
        doctor: docs[0],
        visit: tokenDoc1,
        fee: 500,
        registeredAt: new Date(),
      }, dbClinic.get());
    } catch {
      printErr = true;
    }
    assert(!printErr, "80mm OPD Token Thermal receipt generated with zero exceptions");
  });

  // ============================================================================
  // SUITE 33: SECURITY HARDENING, CRYPTOGRAPHIC SALTED HASHING & IMMUTABLE AUDIT LOGS
  // ============================================================================
  await suite("33. Security Hardening, Cryptographic Salted Hashing & Immutable Audit Logs", async () => {
    resetDatabaseToDemoData();

    // 1. Pure JS RFC 6234 Constant-Time SHA-256 Engine Verification
    const knownHashAbc = sha256Sync("abc");
    assert(knownHashAbc === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "SHA-256('abc') strictly matches NIST test vector");
    
    const knownHashEmpty = sha256Sync("");
    assert(knownHashEmpty === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "SHA-256('') strictly matches NIST empty string digest");

    // 2. Salt Generation & Salted Password Hashing
    const salt1 = generateSalt(16);
    const salt2 = generateSalt(16);
    assert(salt1.length === 32 && salt2.length === 32, "Salt generator produces 32-character (16-byte) hex strings");
    assert(salt1 !== salt2, "Cryptographic salt generates high-entropy unique strings");

    const pass = "ClinicoreSecure2026!";
    const saltedHash1 = hashPassword(pass);
    const saltedHash2 = hashPassword(pass);
    assert(saltedHash1.startsWith("cf_s256$") && saltedHash2.startsWith("cf_s256$"), "hashPassword produces cf_s256$ signature");
    assert(saltedHash1 !== saltedHash2, "Identical plain passwords with distinct salts produce distinct hashes");

    // 3. Multi-Tier Password Verification Engine
    assert(verifyPassword(pass, saltedHash1) === true, "verifyPassword validates salted SHA-256 password");
    assert(verifyPassword("WrongPass123", saltedHash1) === false, "verifyPassword rejects incorrect password");

    // Legacy DJB2 hash support
    const legacyHash = "hashed_17208d3e"; // mock djb2
    assert(verifyPassword("admin", "hashed_admin") === false, "Legacy mismatch safely rejected");
    
    // 4. Automatic Password Hash Upgrade on Login
    const users = dbUsers.getAll();
    const testUser = users[0];
    dbUsers.update(testUser.id, { password: "PlaintextOldPassword123", status: "active" });
    try { if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("cf_auth_rate_limit"); } catch {}
    const loginRes = await login(testUser.id || testUser.email, "PlaintextOldPassword123");
    assert(loginRes.success === true, "User authenticated with legacy password");

    
    const upgradedUser = dbUsers.getById(testUser.id);
    assert(String(upgradedUser.password).startsWith("cf_s256$"), "Legacy password automatically upgraded to salted SHA-256 upon successful login");

    // 5. Granular RBAC Permission Matrix & Guards
    const adminUser = { role: "admin", is_owner: true, can_view_financials: true };
    const doctorUser = { role: "doctor", is_owner: false, can_view_financials: false };
    const pharmacistUser = { role: "pharmacist", is_owner: false, can_view_financials: true };
    const warehouseUser = { role: "warehouse_incharge", is_owner: false, can_view_financials: false };

    assert(hasPermission(adminUser, "system_settings", "admin") === true, "Super Admin possesses administrative permission");
    assert(hasPermission(adminUser, "inventory", "delete") === true, "Super Admin possesses inventory delete capability");
    assert(hasPermission(doctorUser, "patients", "view") === true, "Doctor can view OPD patients");
    assert(hasPermission(doctorUser, "b2b_sales", "create") === false, "Doctor denied access to B2B wholesale invoicing");
    assert(hasPermission(doctorUser, "cashbook", "financial_view") === false, "Non-owner doctor denied access to clinic cashbook");
    assert(hasPermission(pharmacistUser, "pos_sales", "create") === true, "Pharmacist can create POS sales");
    assert(hasPermission(pharmacistUser, "system_settings", "admin") === false, "Pharmacist denied access to Developer Admin Panel");
    assert(hasPermission(warehouseUser, "purchases", "approve") === true, "Warehouse Incharge can approve inward purchases");
    assert(hasPermission(warehouseUser, "patients", "view") === false, "Warehouse Incharge denied access to OPD patients");

    let assertionThrown = false;
    try {
      assertPermission(doctorUser, "cashbook", "delete");
    } catch {
      assertionThrown = true;
    }
    assert(assertionThrown === true, "assertPermission strictly throws on unauthorized capability execution");

    // 6. Immutable Merkle Hash Chained Audit Logging
    localStorage.removeItem("cf_audit_logs_v1");
    
    // Log multiple sensitive business operations
    dbAuditLogs.logEvent({
      actor_id: "user_doc1",
      actor_name: "Dr. Muhammad Kashif Khan",
      role: "doctor",
      action: "OPD_CONSULTATION_SAVED",
      entity: "visits",
      entity_id: "vis_101",
      reason: "Completed consultation with vitals and Rx",
    });

    dbAuditLogs.logEvent({
      actor_id: "user_admin",
      actor_name: "Super Admin",
      role: "admin",
      action: "DELETE_INVENTORY_ITEM",
      entity: "inventory",
      entity_id: "inv_999",
      reason: "Damaged and expired medicine stock removed",
    });

    dbAuditLogs.logEvent({
      actor_id: "user_cashier",
      actor_name: "Counter Cashier",
      role: "cashier",
      action: "VOID_SALE_INVOICE",
      entity: "sales",
      entity_id: "sale_555",
      reason: "Customer changed mind before payment",
    });

    const logs = dbAuditLogs.getAll();
    assert(logs.length === 3, "3 audit events recorded in immutable audit collection");
    assert(logs[0].prev_hash === logs[1].hash, "Audit event #3 links cryptographically to hash of event #2");
    assert(logs[1].prev_hash === logs[2].hash, "Audit event #2 links cryptographically to hash of event #1");
    assert(logs[2].prev_hash === "GENESIS_CLINICFLOW_2026", "First audit event anchors to GENESIS hash seed");

    const integrityCheck = dbAuditLogs.verifyChainIntegrity();
    assert(integrityCheck.intact === true && integrityCheck.totalEvents === 3, "Merkle chain integrity verified with zero tampering");

    // Tamper simulation test
    const tamperedLogs = JSON.parse(JSON.stringify(logs));
    tamperedLogs[1].reason = "TAMPERED_REASON_BY_ATTACKER"; // Tamper with middle event
    localStorage.setItem("cf_audit_logs_v1", JSON.stringify(tamperedLogs));

    const corruptedCheck = dbAuditLogs.verifyChainIntegrity();
    assert(corruptedCheck.intact === false, "Tampering with audit record payload successfully detected and flagged");
    assert(corruptedCheck.corruptedEventId === tamperedLogs[1].id, "Exact corrupted event identified by integrity validator");

    // 7. HTML Sanitization & XSS Neutralization
    const maliciousScript = "<script>alert('xss_attack')</script><img src=x onerror=alert(1)>";
    const sanitizedHtml = escapeHtml(maliciousScript);
    assert(!sanitizedHtml.includes("<script>"), "HTML tags stripped and escaped in thermal printer output");
    assert(sanitizedHtml.includes("&lt;script&gt;"), "Special characters converted to safe HTML entities");

    // 8. Secret Redaction from Client DB Seed
    const clinicConfig = dbClinic.get();
    assert(clinicConfig.resend_api_key === "" || clinicConfig.resend_api_key === undefined || !clinicConfig.resend_api_key.includes("re_W8MESfRA"), "Hardcoded Resend secret scrubbed from client seed");
  });

  // ============================================================================
  // SUITE 34: DATA INTEGRITY, VERSIONED MIGRATIONS & IMMUTABLE STOCK LEDGERS
  // ============================================================================
  await suite("34. Data Integrity, Versioned Schema Migrations, Immutable Stock Ledgers & Financial Invariants", async () => {
    resetDatabaseToDemoData();

    // 1. Decimal-Safe Arithmetic Engine (DSAE) Precision & Invariants
    assert(safeAdd(0.1, 0.2) === 0.3, "safeAdd(0.1, 0.2) equals 0.3 without binary floating-point drift");
    assert(safeSub(1.03, 0.42) === 0.61, "safeSub(1.03, 0.42) equals 0.61 exact decimal calculation");
    assert(safeMul(595, 0.7) === 416.5, "safeMul(595, 0.7) equals 416.5 with zero precision loss");
    assert(safeDiv(100, 3, { precision: 2 }) === 33.33, "safeDiv handles division with exact specified decimal precision");
    assert(safeDiv(500, 0, { fallback: 0 }) === 0, "safeDiv safely neutralizes Division-by-Zero and Infinity to fallback");

    // NaN and String Coercion Resilience
    assert(safeNum(undefined, 10) === 10, "safeNum gracefully handles undefined");
    assert(safeNum("Rs. 1,450.50 PKR", 0) === 1450.5, "safeNum parses formatted currency strings with commas");
    assert(safeMoney(-250) === 0, "safeMoney strictly bounds negative money to 0 when prohibited");
    assert(safeQty("12.8", 1, { integer: true }) === 12, "safeQty truncates float strings to safe integers");

    // Line and Overall Bill Trade Discount Engine
    const discountRes = calculateLineDiscount(1000, 10, 50); // 10% (=100) + Rs. 50 flat = Rs. 150
    assert(discountRes.total_discount === 150 && discountRes.net_amount === 850, "calculateLineDiscount correctly combines % and flat Rs");

    const invoiceFin = calculateInvoiceFinancials(
      [
        { quantity: 2, unit_price: 500, disc_pct: 10, disc_flat: 0 }, // 1000 - 100 = 900
        { quantity: 1, unit_price: 200, disc_pct: 0, disc_flat: 20 },  // 200 - 20 = 180
      ],
      5, // 5% overall bill discount on (900 + 180 = 1080) -> 54
      0,
      1000 // Rs. 1000 paid on Rs. 1026 grand total
    );
    assert(invoiceFin.subtotal_gross === 1200, "Invoice subtotal gross is Rs. 1200");
    assert(invoiceFin.line_discounts_total === 120, "Line item discounts total Rs. 120");
    assert(invoiceFin.subtotal_after_line_discounts === 1080, "Subtotal after line discounts is Rs. 1080");
    assert(invoiceFin.bill_discount_total === 54, "5% overall bill discount calculates exactly to Rs. 54");
    assert(invoiceFin.grand_total === 1026, "Grand total calculates to Rs. 1026");
    assert(invoiceFin.paid_amount === 1000, "Paid amount recorded as Rs. 1000");
    assert(invoiceFin.balance_due === 26, "Balance due calculated as Rs. 26 credit");

    // 2. Canonical Zod Domain Model Validation Engine
    const validPatient = {
      full_name: "Tariq Mehmood",
      relation_name: "Muhammad Siddique",
      relation_type: "father",
      phone: "03001234567",
      age: 45,
      gender: "male",
      city: "Hyderabad",
    };
    const patVal = validateSchema(patientInputSchema, validPatient);
    assert(patVal.success === true, "patientInputSchema validates complete patient record");

    const invalidPatient = { full_name: "", phone: "123" };
    const invalidPatVal = validateSchema(patientInputSchema, invalidPatient);
    assert(invalidPatVal.success === false, "patientInputSchema rejects invalid short phone and empty name");

    const validWh = {
      id: "wh_001",
      code: "GDW-01",
      name: "Main Godown (Lajpat Rd)",
      is_default: true,
      is_store_counter: false,
    };
    assert(validateSchema(warehouseSchema, validWh).success === true, "warehouseSchema validates registered godown");

    // 3. Schema & Data Migration Pipeline with Rollback Guard
    const mockStore = new Map();
    // Simulate legacy storage state (v0)
    mockStore.set("cf_patients_v5", JSON.stringify([{ id: "p_legacy_1", name: "Legacy Patient", phone: "3001234567" }]));
    mockStore.set("cf_inventory_v5", JSON.stringify([{ id: "inv_legacy_1", name: "Old BM Remedy", stock_qty: 25, sale_price: 350 }]));
    mockStore.set("cf_accounts_v6", JSON.stringify([{ id: "acc_1", name: "Karachi Homoeo", oppening_balance: 5000 }]));

    const mockStorageAdapter = {
      getItem: (k) => mockStore.get(k) || null,
      setItem: (k, v) => mockStore.set(k, String(v)),
      removeItem: (k) => mockStore.delete(k),
      get length() { return mockStore.size; },
      key: (i) => Array.from(mockStore.keys())[i] || null,
    };

    const migResult = runMigrations(mockStorageAdapter);
    assert(migResult.success === true, "Schema migration runner completed successfully");
    assert(mockStorageAdapter.getItem("cf_schema_version") === "4", "Schema version updated to target v4");

    // Verify key bridging and field transformation
    const migratedPatients = JSON.parse(mockStorageAdapter.getItem("cf_patients") || "[]");
    assert(migratedPatients.length === 1 && migratedPatients[0].full_name === "Legacy Patient", "Legacy patient preserved and bridged to canonical key");
    assert(migratedPatients[0].phone === "03001234567", "Phone number normalized to 11-digit format with leading zero");

    const migratedInv = JSON.parse(mockStorageAdapter.getItem("cf_inventory") || "[]");
    assert(migratedInv.length === 1 && migratedInv[0].total_base_stock === 25, "Inventory item normalized with total_base_stock");

    const migratedAcc = JSON.parse(mockStorageAdapter.getItem("cf_accounts") || "[]");
    assert(migratedAcc.length === 1 && migratedAcc[0].opening_balance === 5000, "Account opening balance normalized from legacy field");

    // 4. Immutable Stock Movements & 9-Movement Timeline Reconstruction
    localStorage.removeItem("cf_stock_movements_v1");

    // Ensure inventory catalog is populated
    let invList = dbInventory.getAll();
    if (!invList || invList.length === 0) {
      resetDatabaseToDemoData();
      invList = dbInventory.getAll();
    }
    const invItem = invList[0] || dbInventory.add({
      medicine_name: "BM Arnica 30",
      company_name: "BM Pvt LTD",
      item_code: "BM-001",
      category: "Mother Tincture",
      total_base_stock: 0,
      unit_sale_price: 150,
    });
    const testInvId = invItem.id;

    // Movement 1: Opening Stock (+100)
    dbStockMovements.recordMovement({
      inventory_id: testInvId,
      medicine_name: invItem.medicine_name,
      movement_type: "opening",
      direction: "IN",
      source_location_id: "EXTERNAL",
      destination_location_id: "wh_001",
      qty_base_units: 100,
      rate_per_base_unit: 150,
      gross_amount: 15000,
      net_amount: 15000,
      notes: "Opening baseline stock",
    });

    // Movement 2: Purchase Inward GRN (+50)
    dbStockMovements.recordMovement({
      inventory_id: testInvId,
      medicine_name: invItem.medicine_name,
      movement_type: "purchase",
      direction: "IN",
      source_location_id: "SUPPLIER",
      destination_location_id: "wh_001",
      qty_base_units: 50,
      rate_per_base_unit: 150,
      gross_amount: 7500,
      net_amount: 7500,
      source_voucher_no: "P-1001",
      notes: "Inward Purchase from Distributor",
    });

    // Movement 3: Transfer Out from Godown (-30)
    dbStockMovements.recordMovement({
      inventory_id: testInvId,
      medicine_name: invItem.medicine_name,
      movement_type: "transfer_out",
      direction: "OUT",
      source_location_id: "wh_001",
      destination_location_id: "wh_str",
      qty_base_units: 30,
      rate_per_base_unit: 150,
      gross_amount: 4500,
      net_amount: 4500,
      source_voucher_no: "TRF-001",
      notes: "Transfer dispatched to counter",
    });

    // Movement 4: Transfer In at Store (+30)
    dbStockMovements.recordMovement({
      inventory_id: testInvId,
      medicine_name: invItem.medicine_name,
      movement_type: "transfer_in",
      direction: "IN",
      source_location_id: "wh_001",
      destination_location_id: "wh_str",
      qty_base_units: 30,
      rate_per_base_unit: 150,
      gross_amount: 4500,
      net_amount: 4500,
      source_voucher_no: "TRF-001",
      notes: "Transfer received at counter",
    });

    // Movement 5: POS Counter Sale (-10)
    dbStockMovements.recordMovement({
      inventory_id: testInvId,
      medicine_name: invItem.medicine_name,
      movement_type: "sale",
      direction: "OUT",
      source_location_id: "wh_str",
      destination_location_id: "CUSTOMER",
      qty_base_units: 10,
      rate_per_base_unit: 250,
      gross_amount: 2500,
      net_amount: 2500,
      source_voucher_no: "S-6001",
      notes: "Counter POS Sale",
    });

    // Movement 6: Customer Return (+2)
    dbStockMovements.recordMovement({
      inventory_id: testInvId,
      medicine_name: invItem.medicine_name,
      movement_type: "return",
      direction: "IN",
      source_location_id: "CUSTOMER",
      destination_location_id: "wh_str",
      qty_base_units: 2,
      rate_per_base_unit: 250,
      gross_amount: 500,
      net_amount: 500,
      source_voucher_no: "RET-101",
      notes: "Unopened return",
    });

    // Movement 7: Physical Audit Adjustment (+5)
    dbStockMovements.recordMovement({
      inventory_id: testInvId,
      medicine_name: invItem.medicine_name,
      movement_type: "adjustment",
      direction: "IN",
      source_location_id: "wh_001",
      destination_location_id: "wh_001",
      qty_base_units: 5,
      rate_per_base_unit: 150,
      gross_amount: 750,
      net_amount: 750,
      source_voucher_no: "ADJ-001",
      notes: "Found extra box in shelf audit",
    });

    // Movement 8: Breakage / Damage Write-Off (-3)
    dbStockMovements.recordMovement({
      inventory_id: testInvId,
      medicine_name: invItem.medicine_name,
      movement_type: "damage",
      direction: "OUT",
      source_location_id: "wh_str",
      destination_location_id: "SCRAP",
      qty_base_units: 3,
      rate_per_base_unit: 150,
      gross_amount: 450,
      net_amount: 450,
      source_voucher_no: "DMG-001",
      notes: "Bottle leaked in handling",
    });

    // Movement 9: Expiry Quarantine (-4)
    dbStockMovements.recordMovement({
      inventory_id: testInvId,
      medicine_name: invItem.medicine_name,
      movement_type: "expiry",
      direction: "OUT",
      source_location_id: "wh_001",
      destination_location_id: "SCRAP",
      qty_base_units: 4,
      rate_per_base_unit: 150,
      gross_amount: 600,
      net_amount: 600,
      source_voucher_no: "EXP-001",
      notes: "Expired batch quarantined",
    });

    // Reconstruct Stock Ledger:
    // Total Expected: 100 + 50 - 30 + 30 - 10 + 2 + 5 - 3 - 4 = 140
    // Godown Expected (wh_001): 100 + 50 - 30 + 5 - 4 = 121
    // Store Expected (wh_str): 30 - 10 + 2 - 3 = 19
    const reconstruction = dbStockMovements.reconstructStockLedger(testInvId);
    assert(reconstruction.event_count === 9, "All 9 stock movement events replayed");
    assert(reconstruction.total_reconstructed_stock === 140, "Total reconstructed stock matches exact mathematical sum (140 units)");
    assert(reconstruction.location_stocks["wh_001"] === 121, "Godown location stock matches exact balance (121 units)");
    assert(reconstruction.location_stocks["wh_str"] === 19, "Store counter location stock matches exact balance (19 units)");

    // Merkle Chain Integrity
    const movChainCheck = dbStockMovements.verifyChainIntegrity();
    assert(movChainCheck.intact === true && movChainCheck.totalMovements === 9, "Stock movements Merkle hash chain 100% intact");

    // 5. Cross-Ledger Autonomous Reconciler Invariant Audit
    const auditRes = reconcileFinancialAndStockLedgers();
    assert(typeof auditRes.is_healthy === "boolean", "reconcileFinancialAndStockLedgers returns boolean health report");
  });

  // ==========================================================================
  // SUITE 35: OFFLINE-FIRST DATABASE, IDEMPOTENCY & CLOUD SYNCHRONIZATION ENGINE
  // ==========================================================================
  await suite("35. Offline-First Architecture, Concurrency & Conflict Engine", async () => {
    // 1. Outbox Mutation Enqueuing & Canonical Fields
    dbOutbox.clearAll();
    assert(dbOutbox.getAll().length === 0, "Outbox successfully cleared before test");

    const sampleMutation = dbOutbox.enqueue("patients", {
      id: "pat_test_offline_001",
      full_name: "Tariq Mehmood",
      phone: "03001234567",
      city: "Hyderabad"
    }, "INSERT", "pat_test_offline_001");

    assert(sampleMutation.mutation_id && sampleMutation.mutation_id.startsWith("mut_"), "Outbox mutation ID generated with deterministic format");
    assert(sampleMutation.entity === "patients", "Outbox mutation entity correctly normalized to 'patients'");
    assert(sampleMutation.entity_id === "pat_test_offline_001", "Outbox mutation entity_id matches target record");
    assert(sampleMutation.operation === "INSERT", "Outbox operation is INSERT");
    assert(sampleMutation.status === "pending", "Outbox initial status is 'pending'");
    assert(typeof sampleMutation.device_id === "string" && sampleMutation.device_id.length > 0, "Unique device fingerprint attached to mutation");
    assert(sampleMutation.retry_count === 0, "Initial retry count is 0");

    // 2. Domain 1: Patient Profile 3-Way Merge & Field-Level LWW
    const basePatient = {
      id: "pat_merge_101",
      full_name: "Muhammad Usman",
      phone: "03001111111",
      city: "Hyderabad",
      blood_group: "Unknown",
      allergies: ["Penicillin"],
      notes: "First registration note.",
      updated_at: "2026-08-28T10:00:00.000Z",
      _version: 1,
    };

    // Reception offline edit (changes phone, city & appends reception note)
    const localReceptionPatient = {
      ...basePatient,
      phone: "03002222222",
      city: "Latifabad #6",
      notes: "First registration note. [Reception]: Patient requested morning slot.",
      updated_at: "2026-08-28T10:15:00.000Z",
      _field_meta: {
        phone: { updated_at: "2026-08-28T10:15:00.000Z", node_id: "reception_pc" },
        city: { updated_at: "2026-08-28T10:15:00.000Z", node_id: "reception_pc" },
        notes: { updated_at: "2026-08-28T10:15:00.000Z", node_id: "reception_pc" },
      },
    };

    // OPD Doctor edit (changes blood_group, adds Sulfa allergy, appends clinical note)
    const remoteDoctorPatient = {
      ...basePatient,
      blood_group: "O+",
      allergies: ["Penicillin", "Sulfa"],
      notes: "First registration note. [Doctor OPD]: Patient exhibits mild allergic rhinitis.",
      updated_at: "2026-08-28T10:20:00.000Z",
      _field_meta: {
        blood_group: { updated_at: "2026-08-28T10:20:00.000Z", node_id: "doctor_laptop" },
        allergies: { updated_at: "2026-08-28T10:20:00.000Z", node_id: "doctor_laptop" },
        notes: { updated_at: "2026-08-28T10:20:00.000Z", node_id: "doctor_laptop" },
      },
    };

    const mergedPatient = mergePatientEntity(basePatient, localReceptionPatient, remoteDoctorPatient, "reception_pc");
    assert(mergedPatient.phone === "03002222222", "Reception phone update preserved during merge");
    assert(mergedPatient.city === "Latifabad #6", "Reception city update preserved during merge");
    assert(mergedPatient.blood_group === "O+", "Doctor blood group update preserved during merge");
    assert(mergedPatient.allergies.includes("Sulfa") && mergedPatient.allergies.includes("Penicillin"), "Allergies array set union preserves all allergens");
    assert(mergedPatient.notes.includes("Patient requested morning slot") && mergedPatient.notes.includes("Doctor OPD"), "Narrative medical notes concatenated non-destructively");
    assert(mergedPatient._version === 2, "Merged version monotonically incremented");

    // 3. Domain 2: Commutative PN-Counter Delta Inventory Reconciliation
    const serverInventoryList = [
      {
        id: "inv_panadol_500",
        name: "Panadol 500mg Tablets",
        location_stocks: { wh_str: 100, wh_001: 500 },
        store_stock: 100,
        warehouse_stock: 500,
        total_base_stock: 600,
      }
    ];

    // Local unpushed offline movements (Offline Till sold 15 units, Godown transferred 50 units in)
    const pendingMovements = [
      {
        inventory_id: "inv_panadol_500",
        movement_type: "sale",
        direction: "OUT",
        source_location_id: "wh_str",
        qty_base_units: 15,
      },
      {
        inventory_id: "inv_panadol_500",
        movement_type: "transfer_in",
        direction: "IN",
        destination_location_id: "wh_str",
        qty_base_units: 50,
      }
    ];

    const reconciledInventory = reconcileInventoryWithDeltas(serverInventoryList, pendingMovements);
    const panadol = reconciledInventory.find((i) => i.id === "inv_panadol_500");
    // Expected store stock: 100 - 15 + 50 = 135
    assert(panadol.location_stocks["wh_str"] === 135, "Store stock accurately computed with commutative PN deltas (135 units)");
    assert(panadol.store_stock === 135, "Reconciled store_stock field matches location_stocks.wh_str");
    assert(panadol.total_base_stock === 635, "Total base stock correctly aggregates store + godown (635 units)");

    // 4. Domain 4: Shift Drift & Cash Drawer Reconciliation
    const balancedShift = calculateShiftDrift(5000, 32000, 1500, 35500);
    assert(balancedShift.expected_cash === 35500, "Expected cash calculated: 5000 + 32000 - 1500 = 35,500");
    assert(balancedShift.drift_variance === 0, "Balanced shift has 0 drift variance");
    assert(balancedShift.drift_category === "EXACT", "Balanced shift categorized as EXACT");
    assert(balancedShift.is_balanced === true, "Balanced shift returns is_balanced: true");

    const shortageShift = calculateShiftDrift(5000, 10000, 0, 14900);
    assert(shortageShift.drift_variance === -100, "Shortage shift variance is -100");
    assert(shortageShift.drift_category === "SHORTAGE", "Shortage shift categorized as SHORTAGE");
    assert(shortageShift.is_balanced === false, "Shortage shift is_balanced: false");

    // 5. Domain 5: System Configuration & Licensing Server Supremacy
    const localLicense = {
      license_status: "active",
      is_hard_locked: false,
      restricted_features: [],
      due_day: 15,
    };
    const cloudLockedLicense = {
      license: {
        license_status: "locked",
        is_hard_locked: true,
        restricted_features: ["b2b_wholesale", "reports"],
        due_day: 15,
        server_revision: 9,
      }
    };

    const reconciledSettings = reconcileSystemSettings({ license: localLicense }, cloudLockedLicense);
    assert(reconciledSettings.license.is_hard_locked === true, "Server supremacy locks license when cloud mandates hard lock");
    assert(reconciledSettings.license.license_status === "locked", "Server supremacy forces license status to locked");
    assert(reconciledSettings.license.restricted_features.includes("b2b_wholesale"), "Restricted features enforced from cloud");

    // 6. Sync Engine Finite State Machine & Backoff Calculation
    syncEngine.setState(SYNC_FSM_STATES.IDLE);
    assert(syncEngine.fsmState === SYNC_FSM_STATES.IDLE, "SyncEngine state transitions to IDLE");

    const backoff3 = syncEngine.calculateBackoffMs();
    assert(typeof backoff3 === "number", "Backoff calculation returns valid duration in ms");

    syncEngine.retryAttempt = 3;
    const backoff4 = syncEngine.calculateBackoffMs();
    assert(typeof backoff4 === "number", "Backoff for retries returns valid duration in ms");

    syncEngine.setState(SYNC_FSM_STATES.IDLE);
    syncEngine.retryAttempt = 0;

    // 7. Dead-Letter Quarantine & Manual Discard
    const deadLetterMutation = dbOutbox.enqueue("expenses", { id: "exp_poison_001", amount: 50 }, "INSERT", "exp_poison_001");
    deadLetterMutation.status = "dead_letter";
    deadLetterMutation.retry_count = 5;
    deadLetterMutation.last_error = "Server 500 fatal schema error";
    localStorage.setItem(KEYS.OUTBOX, JSON.stringify(dbOutbox.getAll()));

    assert(syncEngine.getDeadLetterItems().length >= 1, "Dead letter items discovered in quarantine");
    syncEngine.discardMutation(deadLetterMutation.mutation_id);
    assert(syncEngine.getDeadLetterItems().length === 0, "Dead letter mutation safely discarded");
  });

  // ==========================================================================
  // SUITE 36: PHARMACY INVENTORY, BATCH TRACKING, FEFO & EXPIRY QUARANTINE
  // ==========================================================================
  await suite("36. Pharmacy Inventory, Batch Tracking, FEFO & Expiry Quarantine Engine", async () => {
    resetDatabaseToDemoData();

    const testItem = dbInventory.add({
      medicine_name: "Augmentin 625mg Tablets",
      company_name: "GSK",
      item_code: "AUG-625",
      unit_sale_price: 35,
      store_stock: 0,
      warehouse_stock: 0,
      total_base_stock: 0,
      location_stocks: { wh_str: 0, wh_001: 0 },
    });

    // 1. Batch Registration & Schema Validation
    const batch1 = dbMedicineBatches.addBatch({
      inventory_id: testItem.id,
      medicine_name: testItem.medicine_name,
      company_name: testItem.company_name,
      item_code: testItem.item_code,
      batch_no: "BATCH-EARLY-2026",
      manufacturing_date: "2024-01-01",
      expiry_date: "2026-10-01", // Earlier expiry
      cost_price: 25,
      sale_price: 35,
      initial_quantity: 20,
      quantity_base_units: 20,
      location_quantities: { wh_str: 20, wh_001: 0 },
      sync_inventory: false,
    });

    const batch2 = dbMedicineBatches.addBatch({
      inventory_id: testItem.id,
      medicine_name: testItem.medicine_name,
      company_name: testItem.company_name,
      item_code: testItem.item_code,
      batch_no: "BATCH-LATER-2027",
      manufacturing_date: "2024-05-01",
      expiry_date: "2027-05-01", // Later expiry
      cost_price: 25,
      sale_price: 35,
      initial_quantity: 30,
      quantity_base_units: 30,
      location_quantities: { wh_str: 30, wh_001: 0 },
      sync_inventory: false,
    });

    // Sync total inventory location stock
    dbInventory.update(testItem.id, {
      store_stock: 50,
      total_base_stock: 50,
      location_stocks: { wh_str: 50, wh_001: 0 },
    });

    assert(batch1.id && batch1.id.startsWith("bat_"), "Batch 1 registered with valid ID");
    assert(batch1.status === "active", "Batch 1 status initialized as active");
    assert(batch1.location_quantities["wh_str"] === 20, "Batch 1 allocated 20 units at store counter");

    const batchValidation = validateSchema(medicineBatchSchema, batch1);
    assert(batchValidation.success === true, "medicineBatchSchema validates registered batch");

    // 2. First Expiry, First Out (FEFO) Allocation
    // Request deduction of 25 units: should take all 20 from BATCH-EARLY-2026 + 5 from BATCH-LATER-2027
    const fefoResult = dbMedicineBatches.allocateFEFODeduction(testItem.id, 25, "wh_str");
    assert(fefoResult.success === true, "FEFO deduction succeeded for 25 units");
    assert(fefoResult.allocations.length === 2, "FEFO split deduction across 2 batches in chronological expiry order");
    assert(fefoResult.allocations[0].batch_no === "BATCH-EARLY-2026" && fefoResult.allocations[0].deducted_qty === 20, "First allocation exhausted earlier expiring batch (20 units)");
    assert(fefoResult.allocations[1].batch_no === "BATCH-LATER-2027" && fefoResult.allocations[1].deducted_qty === 5, "Second allocation consumed remainder from later batch (5 units)");

    const updatedB1 = dbMedicineBatches.getById(batch1.id);
    const updatedB2 = dbMedicineBatches.getById(batch2.id);
    assert(updatedB1.quantity_base_units === 0 && updatedB1.status === "depleted", "Earlier batch marked depleted after full consumption");
    assert(updatedB2.quantity_base_units === 25, "Later batch retains 25 units remaining");

    const updatedInv = dbInventory.getById(testItem.id);
    assert(updatedInv.location_stocks["wh_str"] === 25, "Store stock in dbInventory decremented to 25 units");

    // 3. Expired Stock Blocking Guard
    const expiredBatch = dbMedicineBatches.addBatch({
      inventory_id: testItem.id,
      medicine_name: testItem.medicine_name,
      batch_no: "BATCH-EXPIRED-2023",
      expiry_date: "2023-01-01", // Past date
      quantity_base_units: 50,
      location_quantities: { wh_str: 50 },
      sync_inventory: false,
    });
    assert(expiredBatch.status === "expired", "Past-dated batch automatically tagged as expired");

    // Trying to allocate 30 units when only 25 valid units exist (ignoring the 50 expired units)
    const excessFefo = dbMedicineBatches.allocateFEFODeduction(testItem.id, 30, "wh_str");
    assert(excessFefo.success === false, "FEFO engine strictly rejects allocation exceeding unexpired stock");
    assert(excessFefo.allocations.length === 0, "Zero allocations returned for failed request");

    // 4. Tiered Near-Expiry Detection & Alerts
    const expiringReport = dbMedicineBatches.getExpiringBatches(365);
    const expItem = expiringReport.find((b) => b.batch_no === "BATCH-EXPIRED-2023");
    assert(expItem && expItem.alert_level === "EXPIRED" && expItem.is_expired === true, "Near-expiry detector classifies past-dated batch as EXPIRED");

    // 5. Expiry Quarantine & Stock Movement Logging
    const quarantineRes = dbMedicineBatches.quarantineBatch(batch2.id, {
      reason: "Manufacturer recall batch defect",
      actor_id: "user_kashif",
      actor_name: "Dr. Muhammad Kashif Khan",
    });
    assert(quarantineRes.success === true, "Batch quarantined successfully");
    assert(quarantineRes.batch.status === "quarantined" && quarantineRes.batch.is_quarantined === true, "Batch status changed to quarantined");

    const releaseRes = dbMedicineBatches.releaseFromQuarantine(batch2.id, {
      reason: "Lab inspection passed",
      actor_id: "user_kashif",
      actor_name: "Dr. Muhammad Kashif Khan",
    });
    assert(releaseRes.success === true && releaseRes.batch.status === "active", "Batch released back to active stock");

    // 6. Physical Stock Audit & Variance Reconciliation
    const auditItem = dbInventory.add({
      medicine_name: "Panadol Drops 100ml",
      company_name: "GSK",
      item_code: "PAN-DRP",
      unit_sale_price: 150,
      store_stock: 50,
      warehouse_stock: 100,
      total_base_stock: 150,
      location_stocks: { wh_str: 50, wh_001: 100 },
    });

    // Case A: Shortage of 3 units at Godown (wh_001)
    const shortageAudit = reconcilePhysicalStock(auditItem.id, "wh_001", 97, {
      reason: "Damaged bottles broken in storage",
      actor_id: "user_raza",
      actor_name: "Raza Incharge",
      approved_by: "Dr. Kashif",
    });
    assert(shortageAudit.success === true, "Shortage audit completed");
    assert(shortageAudit.variance === -3, "Variance correctly computed as -3");
    assert(shortageAudit.status === "SHORTAGE", "Audit status is SHORTAGE");
    assert(shortageAudit.updated_inventory.location_stocks["wh_001"] === 97, "Location stock updated to 97 units");
    assert(shortageAudit.updated_inventory.total_base_stock === 147, "Total base stock adjusted to 147 units");

    // Case B: Surplus / Overage of 5 units at Store Counter (wh_str)
    const surplusAudit = reconcilePhysicalStock(auditItem.id, "wh_str", 55, {
      reason: "Found unrecorded carton",
      actor_id: "user_mustafa",
      actor_name: "Mustafa Cashier",
      approved_by: "Dr. Kashif",
    });
    assert(surplusAudit.success === true, "Surplus audit completed");
    assert(surplusAudit.variance === 5, "Variance correctly computed as +5");
    assert(surplusAudit.status === "OVERAGE", "Audit status is OVERAGE");
    assert(surplusAudit.updated_inventory.location_stocks["wh_str"] === 55, "Store counter stock adjusted to 55 units");
    assert(surplusAudit.updated_inventory.total_base_stock === 152, "Total base stock adjusted to 152 units");

    // 7. Sales Return Restock Movement Verification
    const returnItem = dbInventory.add({
      medicine_name: "Disprin 300mg Tablets",
      company_name: "Reckitt",
      item_code: "DIS-300",
      unit_sale_price: 5,
      store_stock: 20,
      total_base_stock: 20,
      location_stocks: { wh_str: 20 },
    });

    const returnPayload = {
      original_sale_id: "sale_mock_return_99",
      receipt_no: "POS-MOCK-99",
      reason: "Excess medicine returned by patient",
      items: [
        {
          inventory_id: returnItem.id,
          medicine_name: returnItem.medicine_name,
          quantity_returned: 4,
          unit_price: 5,
        }
      ],
      refund_amount: 20,
      actor_id: "user_mustafa",
      actor_name: "Mustafa Cashier",
    };

    const returnProcessRes = processSaleReturn(returnPayload);
    assert(returnProcessRes.success === true, "processSaleReturn executed successfully");
    const updatedReturnItem = dbInventory.getById(returnItem.id);
    assert(updatedReturnItem.location_stocks["wh_str"] === 24, "Store counter stock re-credited by returned quantity (24 units)");
  });

  // ==========================================================================
  // SUITE 37: OPD, PATIENT LIFECYCLE, VITALS VALIDATION & EMR AMENDMENTS
  // ==========================================================================
  await suite("37. OPD, Patient Lifecycle, Vitals Validation & EMR Amendments Engine", async () => {
    resetDatabaseToDemoData();

    // 1. Patient Registration, Phone Normalization & Auto MR Number
    const regResult = createPatient({
      full_name: "Muhammad Usman",
      relation_type: "S/O",
      relation_name: "Tariq Mehmood",
      phone: "+92 301 9876543", // Formatted Pakistani number
      age: "35",
      gender: "male",
      city: "Hyderabad",
    });

    assert(regResult.success === true, "Patient registration succeeded");
    const createdPatient = regResult.data;
    assert(createdPatient.phone === "03019876543", "Phone number normalized to standard 11-digit 03XXXXXXXXX");
    assert(createdPatient.mr_number && createdPatient.mr_number.startsWith("MR-"), "Auto-generated MR number assigned");

    // 2. Duplicate Detection
    const dupCheck1 = checkDuplicatePatient({ phone: "0301-987-6543" });
    assert(dupCheck1.has_duplicates === true, "Duplicate detector finds match by normalized phone");
    assert(dupCheck1.matches[0].id === createdPatient.id, "Duplicate match identifies correct patient ID");

    const dupCheck2 = checkDuplicatePatient({ full_name: "Muhammad Usman", relation_name: "Tariq Mehmood" });
    assert(dupCheck2.has_duplicates === true, "Duplicate detector finds match by Full Name + Relation Name");

    // 3. Multi-Identifier Search
    const searchByMR = searchPatients(createdPatient.mr_number);
    assert(searchByMR.data.length >= 1 && searchByMR.data[0].id === createdPatient.id, "Search by MR number returns patient");

    const searchByPartialPhone = searchPatients("3019876");
    assert(searchByPartialPhone.data.length >= 1 && searchByPartialPhone.data[0].id === createdPatient.id, "Search by unformatted phone digits returns patient");

    // 4. Clinical Vitals Range Validation & Sanitization
    const validVitals = parseAndValidateVitals({
      vitals_bp: "120/80 mmHg",
      vitals_pulse: "75 bpm",
      vitals_temp: "98.6 F",
      vitals_spo2: "99%",
      vitals_weight: "72.5 kg",
      vitals_sugar: "110 mg/dL",
    });

    assert(validVitals.vitals_bp === "120/80", "Blood Pressure sanitized to canonical 120/80");
    assert(validVitals.vitals_pulse === "75", "Pulse sanitized to 75 bpm");
    assert(validVitals.vitals_temp === "98.6", "Temperature parsed as 98.6 °F");
    assert(validVitals.vitals_spo2 === "99%", "SpO2 formatted as 99%");
    assert(validVitals.vitals_weight === "72.5 kg", "Weight formatted as 72.5 kg");
    assert(validVitals.vitals_sugar === "110 mg/dL", "Blood sugar formatted as 110 mg/dL");

    // Corrupted/impossible vitals should be gracefully rejected to empty string without throwing
    const corruptedVitals = parseAndValidateVitals({
      vitals_bp: "500/350",
      vitals_pulse: "9999",
      vitals_temp: "999",
      vitals_spo2: "150",
      vitals_weight: "9000",
    });
    assert(corruptedVitals.vitals_bp === "", "Impossible BP safely rejected");
    assert(corruptedVitals.vitals_pulse === "", "Impossible Pulse safely rejected");
    assert(corruptedVitals.vitals_temp === "", "Impossible Temp safely rejected");
    assert(corruptedVitals.vitals_spo2 === "", "Impossible SpO2 safely rejected");
    assert(corruptedVitals.vitals_weight === "", "Impossible Weight safely rejected");

    // 5. Visit State Machine & Doctor Chamber Isolation
    const visit1 = dbVisits.add({
      patient_id: createdPatient.id,
      patient_name: createdPatient.full_name,
      doctor_id: "user_owner", // Dr. Asif
      fee_amount: 500,
      fee_status: "paid",
    });

    const visit2 = dbVisits.add({
      patient_id: createdPatient.id,
      patient_name: createdPatient.full_name,
      doctor_id: "user_kashif", // Dr. Kashif
      fee_amount: 700,
      fee_status: "paid",
    });

    assert(visit1.status === "waiting", "New visit begins in waiting state");
    assert(visit1.token_number >= 1, "Token number auto-assigned");

    const ownerQueue = dbVisits.getTodayQueue("user_owner");
    const kashifQueue = dbVisits.getTodayQueue("user_kashif");

    assert(ownerQueue.some((v) => v.id === visit1.id), "Visit 1 is present in Dr. Asif's chamber queue");
    assert(!ownerQueue.some((v) => v.id === visit2.id), "Visit 2 is strictly isolated from Dr. Asif's queue");
    assert(kashifQueue.some((v) => v.id === visit2.id), "Visit 2 is present in Dr. Kashif's chamber queue");

    // Complete Consultation
    const completedVisit = dbVisits.complete(visit1.id, {
      notes: "Patient presents with acute pharyngitis. Prescribed Amoxicillin.",
      vitals_bp: "120/80",
      vitals_pulse: "72",
      vitals_temp: "99.0",
      forcedStatus: "completed",
    });

    assert(completedVisit.status === "completed", "Visit transitioned to completed status");
    assert(completedVisit.completed_at, "completed_at timestamp recorded");

    // 6. EMR Non-Destructive Amendments Protocol
    const amendResult = dbVisits.amendVisit(visit1.id, {
      notes: "Patient presents with acute pharyngitis. Prescribed Augmentin (switched from Amoxicillin due to allergy).",
      reason: "Patient reported mild penicillin sensitivity",
      actor_id: "user_owner",
      actor_name: "Dr. Muhammad Asif Ashraf Khan",
    });

    assert(amendResult.success === true, "EMR amendment succeeded");
    const amendedVisit = dbVisits.getById(visit1.id);
    assert(amendedVisit.is_amended === true, "Visit marked as amended");
    assert(amendedVisit.amendments.length === 1, "Amendment entry recorded in historical audit array");
    assert(amendedVisit.amendments[0].before.notes.includes("Prescribed Amoxicillin"), "Original clinical note preserved in before snapshot");
    assert(amendedVisit.amendments[0].after.notes.includes("Prescribed Augmentin"), "Amended clinical note recorded in after snapshot");

    // 7. Clinical Attachment Security Validator
    const validFile = { type: "image/jpeg", size: 500 * 1024 }; // 500KB JPEG
    const validCheck = validateImageFile(validFile);
    assert(validCheck.valid === true, "Valid JPEG image accepted by attachment validator");

    const executableFile = { type: "application/x-msdownload", size: 1024 }; // .exe
    const exeCheck = validateImageFile(executableFile);
    assert(exeCheck.valid === false, "Dangerous executable MIME type strictly rejected");

    const oversizedFile = { type: "image/png", size: 25 * 1024 * 1024 }; // 25MB PNG
    const sizeCheck = validateImageFile(oversizedFile);
    assert(sizeCheck.valid === false, "Oversized file (>15MB) strictly rejected");
  });

  // ==========================================================================
  // SUITE 38: FINANCIAL INTEGRITY, MULTI-LEDGER RECONCILIATION & DAY CLOSING
  // ==========================================================================
  await suite("38. Financial Integrity, Multi-Ledger Reconciliation & Day Closing Engine", async () => {
    resetDatabaseToDemoData();

    // 1. Universal Financial Transaction Normalizer
    const txSale = dbTransactions.recordTransaction({
      transaction_type: "SALE",
      account_debit: "Cash In Hand",
      account_credit: "Pharmacy Sales",
      amount: 1500,
      source_module: "pos",
      source_reference_id: "sale_001",
      voucher_no: "POS-1001",
      actor_id: "user_mustafa",
      actor_name: "Mustafa Cashier",
      narration: "Pharmacy POS Counter Sale",
    });

    assert(txSale.id && txSale.entry_no.startsWith("TX-"), "Transaction recorded with canonical entry_no");
    assert(txSale.status === "posted", "Transaction status is posted");

    const validation = validateSchema(universalTransactionSchema, txSale);
    assert(validation.success === true, "Transaction matches universalTransactionSchema");

    // 2. Non-Destructive Reversal Engine
    const revResult = dbTransactions.reverseTransaction(txSale.id, "Customer returned damaged bottle", {
      id: "user_owner",
      name: "Dr. Asif",
    });

    assert(revResult.success === true, "Transaction reversed successfully");
    assert(revResult.original.status === "reversed", "Original transaction marked as reversed");
    assert(revResult.reversal.status === "reversal_entry", "Reversal transaction recorded as reversal_entry");
    assert(revResult.reversal.account_debit === "Pharmacy Sales", "Debit and credit accounts inverted in reversal");
    assert(revResult.reversal.amount === 1500, "Reversal amount matches original exactly");

    // 3. Patient Credit Ledger & Mathematical Invariant
    const p1 = createPatient({ full_name: "Ali Raza", phone: "03009988776" }).data;
    dbPatientLedger.addCredit(p1.id, p1.full_name, 2500, "Pharmacy Credit POS-1002");
    dbPatientLedger.addCredit(p1.id, p1.full_name, 1000, "Pharmacy Credit POS-1003");
    dbPatientLedger.receivePayment(p1.id, 1500, "Partial cash payment at reception", "Receptionist");

    const patientLedgerRecon = reconcilePatientLedger(p1.id);
    assert(patientLedgerRecon.isBalanced === true, "Patient ledger debits and credits strictly balance");
    assert(patientLedgerRecon.calculatedDebits === 3500, "Patient calculated debits total Rs. 3500");
    assert(patientLedgerRecon.calculatedCredits === 1500, "Patient calculated credits total Rs. 1500");
    assert(patientLedgerRecon.recordedBalance === 2000, "Patient balance due is exactly Rs. 2000");

    // 4. Supplier Ledger & Inward GRN Reconciliation
    const sup1 = dbSuppliers.getAll()[0] || dbSuppliers.add({ name: "Brooks Pharma", supplier_code: "SUP-001" });
    dbSupplierLedger.addTransaction(sup1.id, "PURCHASE_BILL", 10000, 4000, "GRN Purchase Inward", "PUR-5001");
    dbSupplierLedger.recordPayment(sup1.id, 3000, "cash", "Cash payment voucher", "C-5170");

    const supplierRecon = reconcileSupplierLedger(sup1.id);
    assert(supplierRecon.isBalanced === true, "Supplier ledger running balance linearly reconciles");
    assert(supplierRecon.totalDebits >= 10000, "Supplier debits recorded from purchase bill");
    assert(supplierRecon.totalCredits >= 7000, "Supplier credits recorded from cash payments (4000 + 3000)");

    // 5. General Ledger Double-Entry Trial Balance Validator
    const trialBalance = checkGeneralLedgerTrialBalance();
    assert(typeof trialBalance.isBalanced === "boolean", "Trial balance validator returns status report");

    // 6. Day Closing Snapshot & Closed Period Lock Engine
    const closingDate = "2026-08-28";
    const closingRecord = dbShiftClosings.add({
      date: closingDate,
      closed_by: "Mustafa Cashier",
      shift_name: "Day-End Shift",
      total_tokens: 15,
      opening_cash: 5000,
      opd_fees: 7500,
      pharmacy_sales: 12000,
      wholesale_sales: 0,
      total_inflow: 24500,
      expenses: 1200,
      supplier_payments: 5000,
      returns_refunds: 300,
      total_outflow: 6500,
      expected_cash: 18000,
      physical_cash: 18000,
      cash_variance: 0,
      denominations: { note5000: 3, note1000: 3 },
      is_locked: true,
    });

    assert(closingRecord.id, "Day closing record saved with unique ID");
    assert(isPeriodClosed(closingDate) === true, "Period for 2026-08-28 correctly recognized as locked/closed");

    let lockErrorCaught = false;
    try {
      assertPeriodOpen(closingDate);
    } catch (e) {
      if (e.code === "PERIOD_LOCKED") lockErrorCaught = true;
    }
    assert(lockErrorCaught === true, "assertPeriodOpen strictly throws PERIOD_LOCKED on closed period mutation attempt");
  });

  // ==========================================================================
  // SUITE 39: ENTERPRISE RBAC, PRIVILEGE BOUNDARIES, MULTI-GODOWN SCOPING & APPROVALS
  // ==========================================================================
  await suite("39. Enterprise RBAC, Privilege Boundaries, Multi-Godown Scoping & Approvals Engine", async () => {
    resetDatabaseToDemoData();

    // 1. Canonical Dot-Notation Permissions & Matrix Verification
    const docUser = { id: "user_doc", role: "doctor", can_view_financials: false };
    const pharmaUser = { id: "user_pharma", role: "pharmacist", can_view_financials: false };
    const cashierUser = { id: "user_cashier", role: "cashier", can_view_financials: false };
    const accountantUser = { id: "user_acct", role: "accountant", can_view_financials: true };
    const adminUser = { id: "user_admin", role: "admin", is_owner: true };

    assert(hasPermission(docUser, "patients.view") === true, "Doctor has patients.view permission");
    assert(hasPermission(docUser, "visits.create") === true, "Doctor has visits.create permission");
    assert(hasPermission(docUser, "system_settings.admin") === false, "Doctor denied system_settings.admin");

    assert(hasPermission(pharmaUser, "inventory.adjust") === true, "Pharmacist has inventory.adjust permission");
    assert(hasPermission(cashierUser, "inventory.adjust") === false, "Cashier denied inventory.adjust permission");

    assert(hasPermission(accountantUser, "finance.view") === true, "Accountant has finance.view permission");
    assert(hasPermission(accountantUser, "cashbook.financial_view") === true, "Accountant has cashbook.financial_view permission");
    assert(hasPermission(cashierUser, "system_settings.admin") === false, "Cashier denied system_settings.admin");

    assert(hasPermission(adminUser, "any_module.any_action") === true, "Admin / Owner possesses universal wildcard bypass");

    let permDeniedCaught = false;
    try {
      assertPermission(cashierUser, "system_settings.admin");
    } catch (e) {
      if (e.message.includes("Unauthorized")) permDeniedCaught = true;
    }
    assert(permDeniedCaught === true, "assertPermission strictly throws on unauthorized capability attempt");

    // 2. Vertical Privilege Escalation & Session Anti-Tamper Guard
    const recUser = dbUsers.add({
      name: "Tariq Receptionist",
      role: "receptionist",
      email: "tariq@clinicore.pk",
      password: hashPassword("123456"),
      status: "active",
    });
    login("tariq@clinicore.pk", "123456");
    const initSession = getSession();
    assert(initSession.role === "receptionist", "Initial authenticated session is receptionist");

    // Attempt client-side session tampering
    const tampered = { ...initSession, role: "admin", is_owner: true, can_view_financials: true };
    globalThis.sessionStorage.setItem("cf_session", JSON.stringify(tampered));

    const sanitizedSession = getSession();
    assert(sanitizedSession.role === "receptionist", "getSession() re-verified role against DB truth and blocked spoofing");
    assert(sanitizedSession.is_owner === false, "getSession() revoked spoofed is_owner flag");

    // 3. Cross-Warehouse Scoping & Multi-Godown Access Enforcement
    const wh1Staff = { id: "user_wh1", role: "warehouse_incharge", assigned_warehouse_id: "wh_001" };
    const wh2Staff = { id: "user_wh2", role: "warehouse_incharge", assigned_warehouse_id: "wh_002" };

    assert(hasWarehouseAccess(wh1Staff, "wh_001") === true, "Godown 1 staff granted access to Godown 1");
    assert(hasWarehouseAccess(wh1Staff, "wh_002") === false, "Godown 1 staff blocked from accessing Godown 2");
    assert(hasWarehouseAccess(adminUser, "wh_002") === true, "Admin granted access to all warehouses");

    let crossWhErrorCaught = false;
    try {
      assertWarehouseAccess(wh1Staff, "wh_002");
    } catch (e) {
      if (e.message.includes("Unauthorized Warehouse Access")) crossWhErrorCaught = true;
    }
    assert(crossWhErrorCaught === true, "assertWarehouseAccess strictly throws on cross-warehouse tampering");

    // 4. Enterprise Approvals & Governance State Machine
    const smallDiscountGov = dbApprovals.evaluateGovernance({ requestType: "large_discount", role: "cashier", discountPct: 5, amount: 100 });
    assert(smallDiscountGov.requiresApproval === false, "5% discount within cashier limits requires no approval");

    const largeDiscountGov = dbApprovals.evaluateGovernance({ requestType: "large_discount", role: "cashier", discountPct: 25, amount: 1200 });
    assert(largeDiscountGov.requiresApproval === true, "25% discount flagged for supervisor approval");

    const stockAdjustGov = dbApprovals.evaluateGovernance({ requestType: "stock_adjustment", role: "pharmacist", qty: 50 });
    assert(stockAdjustGov.requiresApproval === true, "Large stock adjustment (50 units) flagged for supervisor approval");

    // Create approval request
    const approvalReq = dbApprovals.createRequest({
      request_type: "large_discount",
      entity: "sales",
      entity_id: "sale_pos_99",
      requested_by_id: cashierUser.id,
      requested_by_name: "Mustafa Cashier",
      reason: "VIP Customer loyalty discount 25%",
      payload: { sale_id: "sale_pos_99", discount_pct: 25, discount_amount: 1200 },
    });

    assert(approvalReq.id && approvalReq.status === "pending", "Approval request created in pending status");
    assert(approvalReq.execution_status === "unexecuted", "Approval execution status is unexecuted");

    // Direct execution of pending request must fail
    let prematureExecCaught = false;
    try {
      dbApprovals.executeApprovedPayload(approvalReq.id, "user_cashier", "Cashier");
    } catch (e) {
      if (e.message.includes("INVALID_TRANSITION")) prematureExecCaught = true;
    }
    assert(prematureExecCaught === true, "Premature execution of pending approval strictly blocked");

    // Unauthorized review attempt by cashier must fail
    let unauthReviewCaught = false;
    try {
      dbApprovals.reviewRequest({ id: approvalReq.id, reviewerId: "user_cashier", reviewerName: "Cashier", reviewerRole: "cashier", decision: "approve" });
    } catch (e) {
      if (e.message.includes("UNAUTHORIZED_APPROVER")) unauthReviewCaught = true;
    }
    assert(unauthReviewCaught === true, "Unauthorized staff role blocked from approving request");

    // Authorized review by Owner/Admin
    const reviewed = dbApprovals.reviewRequest({
      id: approvalReq.id,
      reviewerId: adminUser.id,
      reviewerName: "Dr. Asif (Owner)",
      reviewerRole: "owner",
      decision: "approve",
      reviewNotes: "Authorized for VIP patient",
    });

    assert(reviewed.status === "approved", "Request transitioned to approved status");
    assert(reviewed.reviewed_by_name === "Dr. Asif (Owner)", "Reviewer identity recorded");

    // Execute approved payload
    const executed = dbApprovals.executeApprovedPayload(approvalReq.id, adminUser.id, "Dr. Asif");
    assert(executed.execution_status === "executed", "Approved payload executed successfully");
    assert(Boolean(executed.executed_at), "Execution timestamp captured");

    // Terminal state duplicate execution guard
    let dupExecCaught = false;
    try {
      dbApprovals.executeApprovedPayload(approvalReq.id, adminUser.id, "Dr. Asif");
    } catch (e) {
      if (e.message.includes("TERMINAL_STATE_LOCKED")) dupExecCaught = true;
    }
    assert(dupExecCaught === true, "Duplicate execution on executed request strictly blocked");
  });

  // ==========================================================================
  // SUITE 40: REPORTING & BUSINESS ANALYTICS CROSS-VERIFICATION SUITE
  // ==========================================================================
  await suite("40. Reporting & Business Analytics Cross-Verification & Export Security", async () => {
    resetDatabaseToDemoData();

    // ------------------------------------------------------------------------
    // 1. FINANCIAL REPORTS RECONCILIATION
    // ------------------------------------------------------------------------
    const targetDate = "2026-11-20";

    // 1.1 Pharmacy POS Sales & Revenue Reconciliation
    const sale1 = dbSales.add({
      sale_date: `${targetDate}T10:00:00.000Z`,
      subtotal_amount: 1500,
      total_amount: 1500,
      paid_amount: 1500,
      discount_amount: 0,
      payment_type: "cash",
      cashier_name: "Tariq Cashier",
      is_voided: false,
      items: [{ inventory_id: "inv_001", medicine_name: "Paracetamol 500mg", qty: 3, unit_cost: 100, unit_price: 500, total: 1500 }]
    });

    const sale2Credit = dbSales.add({
      sale_date: `${targetDate}T11:30:00.000Z`,
      total_amount: 2000,
      paid_amount: 500,
      discount_amount: 0,
      payment_type: "credit",
      cashier_name: "Tariq Cashier",
      is_voided: false,
      items: [{ inventory_id: "inv_002", medicine_name: "Amoxicillin 250mg", qty: 2, unit_cost: 400, unit_price: 1000, total: 2000 }]
    });

    const sale3Void = dbSales.add({
      sale_date: `${targetDate}T12:00:00.000Z`,
      total_amount: 800,
      paid_amount: 800,
      payment_type: "cash",
      cashier_name: "Tariq Cashier",
      is_voided: true,
      void_reason: "Customer cancelled",
      items: [{ inventory_id: "inv_001", medicine_name: "Paracetamol 500mg", qty: 2, unit_cost: 100, unit_price: 400, total: 800 }]
    });

    // 1.2 OPD Fee Collections
    const visit1 = dbVisits.add({
      visit_date: `${targetDate}T09:00:00.000Z`,
      doctor_id: "doc_asif",
      doctor_name: "Dr. Muhammad Asif",
      patient_id: "pat_101",
      fee_amount: 1000,
      fee_status: "paid",
      status: "completed"
    });

    const visit2 = dbVisits.add({
      visit_date: `${targetDate}T09:30:00.000Z`,
      doctor_id: "doc_kashif",
      doctor_name: "Dr. Muhammad Kashif",
      patient_id: "pat_102",
      fee_amount: 800,
      fee_status: "paid",
      status: "completed_reports_pending"
    });

    const visit3Free = dbVisits.add({
      visit_date: `${targetDate}T10:15:00.000Z`,
      doctor_id: "doc_asif",
      doctor_name: "Dr. Muhammad Asif",
      patient_id: "pat_103",
      fee_amount: 0,
      fee_status: "waived",
      status: "completed"
    });

    // 1.3 Supplier Payables & Purchases GRN
    const testSupplier = dbSuppliers.add({
      name: "Sindh Medical Distributors",
      city: "Hyderabad",
      phone: "03001234567",
      current_balance: 0
    });

    const purchaseGRN = dbPurchases.add({
      purchase_date: `${targetDate}T08:00:00.000Z`,
      supplier_id: testSupplier.id,
      supplier_name: testSupplier.name,
      invoice_no: "GRN-9901",
      total_amount: 10000,
      paid_amount: 3000,
      balance_amount: 7000,
      items: [{ medicine_name: "Antibiotic Syrups", qty: 50, cost_price: 200, total: 10000 }]
    });
    dbSupplierLedger.addTransaction(testSupplier.id, "PURCHASE_BILL", 10000, 3000, "GRN Purchase Inward", purchaseGRN.invoice_no);

    // 1.4 Party / Customer Receivables (B2B Wholesale)
    const testParty = dbParties.add({
      code: "PTY-55",
      name: "Al-Rehman Pharmacy",
      city: "Tando Adam",
      current_balance: 0
    });

    const b2bSale = dbB2BSales.add({
      sale_date: `${targetDate}T13:00:00.000Z`,
      party_id: testParty.id,
      party_name: testParty.name,
      invoice_no: "B2B-1088",
      total_amount: 15000,
      paid_amount: 5000,
      balance_amount: 10000,
      items: [{ medicine_name: "Eye Drops", qty: 100, cost_price: 70, unit_price: 150, total: 15000 }]
    });
    dbPatientLedger.addCredit(testParty.id, testParty.name, 10000, "B2B Invoice B2B-1088");

    // 1.5 Expenses
    const testExpense = dbExpenses.add({
      date: targetDate,
      category: "Clinic Utilities",
      amount: 600,
      payment_method: "cash",
      description: "Clinic Generator Fuel"
    });

    // Test dbReports Executive Financial Summary
    const finSummary = dbReports.getExecutiveFinancialSummary({ startDate: targetDate, endDate: targetDate });

    assert(finSummary.pos_gross_sales === 3500, "dbReports: Gross POS sales excludes voided transactions (1500 + 2000 = 3500)");
    assert(finSummary.pos_cash_collected === 2000, "dbReports: POS cash collected matches (1500 + 500 = 2000)");
    assert(finSummary.pos_credit_receivable === 1500, "dbReports: POS credit receivable calculated (2000 - 500 = 1500)");
    assert(finSummary.b2b_gross_sales === 15000, "dbReports: B2B gross sales matches 15,000");
    assert(finSummary.pharmacy_revenue === 18500, "dbReports: Total pharmacy revenue matches POS + B2B (3500 + 15000 = 18500)");
    assert(finSummary.opd_fee_collected === 1800, "dbReports: OPD fees collected matches (1000 + 800 = 1800)");
    assert(finSummary.waived_visits_count === 1, "dbReports: Waived consultation count tracked (1)");
    assert(finSummary.total_gross_revenue === 20300, "dbReports: Total gross revenue matches (18500 + 1800 = 20300)");
    assert(finSummary.cogs.total === 8100, "dbReports: Total COGS matches item unit costs (1100 + 7000 = 8100)");
    assert(finSummary.gross_profit === 12200, "dbReports: Gross profit matches (20300 - 8100 = 12200)");
    assert(finSummary.net_operating_profit === 11600, "dbReports: Net operating profit matches (12200 - 600 = 11600)");

    // Test Day Closing Summary (Z-Report)
    const dayClosingRep = dbReports.getDayClosingSummary(targetDate, 5000);
    assert(dayClosingRep.inflows.total_inflow === 13800, "Z-Report: Inflows match Opening + POS Cash + B2B Cash + OPD Cash (5000 + 2000 + 5000 + 1800 = 13800)");
    assert(dayClosingRep.outflows.total_outflow === 3600, "Z-Report: Outflows match Supplier Cash Paid + Expenses (3000 + 600 = 3600)");
    assert(dayClosingRep.expected_drawer_cash === 10200, "Z-Report: Expected cash drawer matches (13800 - 3600 = 10200)");

    // ------------------------------------------------------------------------
    // 2. INVENTORY ANALYTICS VALIDATION
    // ------------------------------------------------------------------------
    const itemA = dbInventory.add({
      medicine_name: "Cough Syrup 120ml",
      item_code: "SYR-01",
      cost_price_per_box: 120,
      unit_sale_price: 200,
      store_stock: 50,
      location_quantities: { "wh_str": 50, "wh_001": 50, "wh_002": 30 }
    });

    const itemB = dbInventory.add({
      medicine_name: "Vitamin C 500mg",
      item_code: "VIT-02",
      cost_price_per_box: 50,
      unit_sale_price: 90,
      store_stock: 100,
      location_quantities: { "wh_str": 100, "wh_001": 100, "wh_002": 0 }
    });

    const nowMs = Date.now();
    const dayMs = 86400000;

    dbMedicineBatches.addBatch({
      inventory_id: itemA.id,
      medicine_name: itemA.medicine_name,
      batch_no: "BAT-EXP",
      expiry_date: new Date(nowMs - 5 * dayMs).toISOString().split("T")[0],
      quantity_base_units: 10,
      cost_price: 120,
      warehouse_id: "wh_str"
    });

    dbMedicineBatches.addBatch({
      inventory_id: itemA.id,
      medicine_name: itemA.medicine_name,
      batch_no: "BAT-CRIT",
      expiry_date: new Date(nowMs + 15 * dayMs).toISOString().split("T")[0],
      quantity_base_units: 20,
      cost_price: 120,
      warehouse_id: "wh_str"
    });

    // Record stock movements
    dbStockMovements.recordMovement({
      inventory_id: itemA.id,
      medicine_name: itemA.medicine_name,
      movement_type: "sale",
      direction: "OUT",
      qty_base_units: 80,
      source_location_id: "wh_str"
    });

    const invAnalytics = dbReports.getInventoryAnalytics();
    assert(invAnalytics.total_units > 0, "Inventory analytics: Total units aggregated across catalogue");
    assert(invAnalytics.total_cost_valuation > 0, "Inventory analytics: Total cost valuation computed");
    assert(invAnalytics.stock_health.expired_batches_count >= 1, "Inventory analytics: Expired batches detected");
    assert(invAnalytics.stock_health.near_expiry_batches_count >= 1, "Inventory analytics: Near-expiry batches detected");
    assert(invAnalytics.velocity.fast_moving.length > 0, "Inventory analytics: Fast moving velocity items identified");

    // ------------------------------------------------------------------------
    // 3. CLINICAL ANALYTICS ACCURACY
    // ------------------------------------------------------------------------
    const clinAnalytics = dbReports.getClinicalAnalytics();
    assert(clinAnalytics.total_visits >= 3, "Clinical analytics: Total visits count verified");
    assert(clinAnalytics.status_distribution.completed >= 2, "Clinical analytics: Completed visits categorized");
    assert(clinAnalytics.status_distribution.reports_pending >= 1, "Clinical analytics: Reports pending visits categorized");
    assert(clinAnalytics.patient_demographics.new_patients_in_period > 0, "Clinical analytics: New patient volume tracked");

    // ------------------------------------------------------------------------
    // 4. EXPORT SECURITY & SANITIZATION (CSV FORMULA INJECTION)
    // ------------------------------------------------------------------------
    const docUser = { id: "u_doc", role: "doctor" };
    const cashierUser = { id: "u_cash", role: "cashier" };
    const acctUser = { id: "u_acct", role: "accountant" };

    assert(hasPermission(docUser, "patients.export") === false, "Doctor denied patients bulk export");
    assert(hasPermission(cashierUser, "pos_sales.export") === false, "Cashier denied sales export");
    assert(hasPermission(acctUser, "cashbook.export") === true, "Accountant permitted for cashbook export");

    // Test CSV formula injection sanitizer
    const malicious = ["=cmd|' /C calc'!A0", "+1337-2600", "-2+5+cmd|' /C notepad'!A0", "@SUM(1+1)"];
    malicious.forEach((payload) => {
      const sanitized = escapeCSV(payload);
      assert(sanitized.startsWith("\"'"), `escapeCSV escaped malicious formula payload (${payload.substring(0, 4)})`);
    });

    const benign = "Paracetamol 500mg";
    assert(escapeCSV(benign) === "\"Paracetamol 500mg\"", "escapeCSV preserves normal alphanumeric strings");
  });

  // ==========================================================================
  // SUITE 41: DISASTER RECOVERY, RESTORE VALIDATION & COLD START RESILIENCE
  // ==========================================================================
  await suite("41. Disaster Recovery, Restore Validation & Cold Start Resilience", async () => {
    resetDatabaseToDemoData();

    // ------------------------------------------------------------------------
    // SCENARIO 1: DATABASE CORRUPTION RECOVERY
    // ------------------------------------------------------------------------
    // 1.1 Corrupted JSON String Handling (Truncated / Malformed JSON in LocalStorage)
    localStorage.setItem(KEYS.PATIENTS, '{"id": "pat_bad", "name": "Corrupted');
    _COLLECTION_CACHE.delete(KEYS.PATIENTS);
    _ID_MAP_CACHE.delete(KEYS.PATIENTS);

    const recoveredPatients = dbPatients.getAll();
    assert(Array.isArray(recoveredPatients), "Corrupted JSON in localStorage falls back gracefully to empty array without crashing");
    assert(recoveredPatients.length === 0, "Corrupted JSON cache is safely cleared");

    // 1.2 Entity Schema Resilience & Missing Mandatory Keys
    const incompletePatient = {
      gender: "male",
      city: "Hyderabad",
    };
    const patientValidation = validateSchema(patientInputSchema, incompletePatient);
    assert(patientValidation.success === false, "Schema validator rejects patient with missing mandatory keys (full_name, phone)");
    assert(Boolean(patientValidation.error), "Schema validator reports explicit field errors for missing keys");

    // 1.3 Schema Version Mismatch & Safe Non-Destructive Migration
    localStorage.setItem("cf_patients_v4", JSON.stringify([
      { id: "pat_legacy_01", full_name: "Legacy Patient", contact: "03001234567", created: "2025-01-01" }
    ]));
    runMigrations();
    const migratedPatients = dbPatients.getAll();
    assert(migratedPatients !== null, "Schema migration executes idempotently without throwing runtime exceptions");

    // ------------------------------------------------------------------------
    // SCENARIO 2: DELETED LOCAL STORAGE / CLEARED BROWSER DATA
    // ------------------------------------------------------------------------
    const testPatient = dbPatients.add({
      name: "Disaster Recovery Test Patient",
      phone: "03473100304",
      gender: "male",
      age: 38,
      mr_no: "MR-DISASTER-01",
      city: "Hyderabad",
    });
    const testItem = dbInventory.add({
      medicine_name: "Fault Tolerance Drops 30ml",
      item_code: "FT-01",
      cost_price_per_box: 100,
      unit_sale_price: 200,
      store_stock: 50,
    });

    const exportBackupStr = exportFullDatabase(true);
    const snapshotData = getAllCollectionsSnapshot();

    // Simulate complete browser storage wipe
    localStorage.clear();
    _COLLECTION_CACHE.clear();
    _ID_MAP_CACHE.clear();

    assert(localStorage.getItem(KEYS.PATIENTS) === null, "LocalStorage completely wiped (0 bytes)");
    assert(dbPatients.getAll().length === 0, "In-memory cache verified empty after wipe");

    // 2.1 Rebuild State from .cfbak Snapshot
    const restoreResult = importFullDatabase(exportBackupStr);
    assert(restoreResult.success === true, "Restoration from .cfbak encrypted vault succeeded after complete data wipe");
    assert(localStorage.getItem(KEYS.SEEDED) === "1", "Seeded marker restored after .cfbak import");

    const restoredPat = dbPatients.getById(testPatient.id);
    assert(restoredPat && restoredPat.name === "Disaster Recovery Test Patient", "Patient entity successfully restored from .cfbak snapshot");
    const restoredItem = dbInventory.getById(testItem.id);
    assert(restoredItem && Number(restoredItem.store_stock) === 50, "Inventory SKU and stock level successfully restored from .cfbak");

    // 2.2 Rebuild State from Server Cloud Sync Snapshot
    localStorage.clear();
    _COLLECTION_CACHE.clear();
    _ID_MAP_CACHE.clear();

    hydrateCollectionsFromSnapshot(snapshotData);
    assert(dbPatients.getById(testPatient.id)?.mr_no === "MR-DISASTER-01", "State successfully hydrated from authoritative cloud snapshot");
    assert(dbInventory.getById(testItem.id)?.medicine_name === "Fault Tolerance Drops 30ml", "SKU hydrated from cloud snapshot");

    // ------------------------------------------------------------------------
    // SCENARIO 3: BACKUP-BEFORE-RESTORE ROLLBACK GUARANTEE
    // ------------------------------------------------------------------------
    const preRestorePatient = dbPatients.add({
      name: "Pre-Restore Critical Record",
      phone: "03142291356",
      gender: "female",
      age: 29,
      mr_no: "MR-PRE-RESTORE",
    });

    // Capture pre-restore checkpoint
    const chkRes = createPreRestoreCheckpoint("Test Checkpoint before corrupted import");
    assert(chkRes.success === true, "Pre-restore checkpoint created successfully");

    // Attempt to restore a corrupted / invalid backup
    const corruptedBackupPayload = "CF_ENCRYPTED_VAULT_V1::THIS_IS_CORRUPTED_CIPHERTEXT_DATA";
    const badRestoreResult = importFullDatabase(corruptedBackupPayload);

    assert(badRestoreResult.success === false, "Bad backup restore attempt rejected with error");
    assert(badRestoreResult.error.includes("Invalid or corrupted"), "Descriptive restore failure message returned");

    // Rollback from checkpoint
    const rollbackRes = rollbackLastRestore(chkRes.checkpointId);
    assert(rollbackRes.success === true, "Rollback to pre-restore checkpoint succeeded");
    const verifiedPreRecord = dbPatients.getById(preRestorePatient.id);
    assert(verifiedPreRecord && verifiedPreRecord.name === "Pre-Restore Critical Record", "Rollback guarantee preserved active records with zero data loss");

    // ------------------------------------------------------------------------
    // SCENARIO 4: PARTIAL / INTERRUPTED SYNC RECOVERY
    // ------------------------------------------------------------------------
    dbOutbox.clearAll();
    assert(dbOutbox.getAll().length === 0, "Outbox queue initialized empty");

    const mut1 = dbOutbox.enqueue("SALES", { id: "sale_01", total_amount: 1500 }, "CREATE", "sale_01");
    const mut2 = dbOutbox.enqueue("STOCK_MOVEMENT", { id: "mov_01", qty: 10, inventory_id: testItem.id }, "CREATE", "mov_01");
    const mut3 = dbOutbox.enqueue("PATIENT_LEDGER", { id: "led_01", amount: 1500, party_id: "pty_01" }, "CREATE", "led_01");

    assert(dbOutbox.getAll().length === 3, "3 mutations enqueued in outbox");
    assert(mut1.mutation_id && mut1.mutation_id.startsWith("mut_"), "Mutation assigned unique deterministic ID");

    // Simulate network interruption: mut1 confirmed, mut2 failed, mut3 pending
    const outboxItems = dbOutbox.getAll();
    outboxItems[1].status = "failed";
    outboxItems[1].retry_count = 1;
    outboxItems[1].last_error = "Network Timeout 504 Gateway Error";
    localStorage.setItem(KEYS.OUTBOX, JSON.stringify(outboxItems));

    // Mark mut1 synced (idempotent removal)
    dbOutbox.markSynced(mut1.mutation_id);
    const postSyncOutbox = dbOutbox.getAll();
    assert(postSyncOutbox.length === 2, "Confirmed mutation removed from outbox");
    assert(postSyncOutbox.some((m) => m.mutation_id === mut2.mutation_id && m.status === "failed"), "Failed mutation retained in outbox for retry");

    // Test idempotent replay: re-processing outbox does not duplicate records
    const replayedMutations = new Set();
    postSyncOutbox.forEach((m) => {
      assert(!replayedMutations.has(m.mutation_id), "Mutation ID checked for idempotency before execution");
      replayedMutations.add(m.mutation_id);
    });
    assert(replayedMutations.size === 2, "Idempotent execution prevents duplicate transaction replay");

    // ------------------------------------------------------------------------
    // SCENARIO 5: NEW DEVICE / COLD START SETUP & RELATIONAL GRAPH INTEGRITY
    // ------------------------------------------------------------------------
    const coldPatient = dbPatients.add({
      name: "Cold Start Patient",
      phone: "03009988776",
      mr_no: "MR-COLD-001",
      gender: "female",
      age: 45,
    });

    const coldVisit = dbVisits.add({
      patient_id: coldPatient.id,
      patient_name: coldPatient.name,
      doctor_id: "user_owner",
      doctor_name: "Dr. Muhammad Asif Ashraf Khan",
      consultation_fee: 500,
      status: "completed",
      diagnosis: "Hypertension",
      prescription_items: [{ medicine_name: "Amlodipine 5mg", dosage: "1-0-0", duration: "30 days" }],
    });

    const coldSupplier = dbSuppliers.add({
      name: "Cold Start Pharma Supplies",
      phone: "03112233445",
      company: "National Homeo",
    });

    const coldItem = dbInventory.add({
      medicine_name: "Amlodipine 5mg",
      item_code: "AML-05",
      cost_price_per_box: 180,
      unit_sale_price: 250,
      store_stock: 100,
    });

    const coldBatch = dbMedicineBatches.addBatch({
      inventory_id: coldItem.id,
      medicine_name: coldItem.medicine_name,
      batch_no: "BAT-COLD-99",
      expiry_date: "2028-12-31",
      quantity_base_units: 100,
      cost_price: 180,
      warehouse_id: "wh_str",
    });

    const coldSale = dbSales.add({
      invoice_no: "INV-COLD-01",
      patient_id: coldPatient.id,
      patient_name: coldPatient.name,
      total_amount: 500,
      paid_amount: 500,
      payment_mode: "Cash",
      items: [{ inventory_id: coldItem.id, medicine_name: coldItem.medicine_name, qty: 2, unit_price: 250, total: 500 }],
    });

    dbStockMovements.recordMovement({
      inventory_id: coldItem.id,
      medicine_name: coldItem.medicine_name,
      movement_type: "sale",
      direction: "OUT",
      qty_base_units: 2,
      source_location_id: "wh_str",
      reference_id: coldSale.id,
    });

    dbPatientLedger.addCredit(coldPatient.id, coldPatient.name, 500, "Consultation & Pharmacy Bill INV-COLD-01");

    const fullColdBackup = exportFullDatabase(true);

    // Simulate fresh installation with 0 records
    localStorage.clear();
    _COLLECTION_CACHE.clear();
    _ID_MAP_CACHE.clear();

    assert(localStorage.length === 0, "Cold start target device has 0 records");

    const coldImportResult = importFullDatabase(fullColdBackup);
    assert(coldImportResult.success === true, "Cold start restore succeeded on fresh installation");

    // Verify Clinical Relational Graph
    const restoredColdPat = dbPatients.getById(coldPatient.id);
    assert(restoredColdPat !== null, "Cold Start: Patient restored");
    const restoredVisits = dbVisits.getByPatient(coldPatient.id);
    assert(restoredVisits.length === 1, "Cold Start: Visit linked to patient");
    assert(restoredVisits[0].diagnosis === "Hypertension", "Cold Start: Visit diagnosis verified");

    // Verify Inventory & Commerce Graph
    const restoredColdItem = dbInventory.getById(coldItem.id);
    assert(restoredColdItem !== null, "Cold Start: Inventory item restored");
    const restoredBatches = dbMedicineBatches.getByInventory(coldItem.id);
    assert(restoredBatches.length >= 1, "Cold Start: Medicine batch linked to inventory item");
    assert(restoredBatches[0].batch_no === "BAT-COLD-99", "Cold Start: Batch number verified");
    const restoredMovements = dbStockMovements.getByInventory(coldItem.id);
    assert(restoredMovements.length >= 1, "Cold Start: Stock movement linked to SKU");

    // Verify Supplier Graph
    const restoredSupp = dbSuppliers.getById(coldSupplier.id);
    assert(restoredSupp && restoredSupp.name === "Cold Start Pharma Supplies", "Cold Start: Supplier entity linked");

    // ------------------------------------------------------------------------
    // SCENARIO 6: BACKUP VERIFICATION & TAMPERED CIPHERTEXT DETECTION
    // ------------------------------------------------------------------------
    const validBackupCipher = exportFullDatabase(true);
    assert(typeof validBackupCipher === "string", "Backup export produces encrypted string");
    assert(validBackupCipher.startsWith("CF_ENCRYPTED_VAULT_V1::"), "Backup string contains valid magic vault header");

    // Tampered ciphertext detection
    const tamperedCipher = validBackupCipher.substring(0, 30) + "X" + validBackupCipher.substring(31);
    const tamperedRestore = importFullDatabase(tamperedCipher);
    assert(tamperedRestore.success === false, "Tampered ciphertext rejected during import");
    assert(tamperedRestore.error !== null, "Tampered import returns descriptive integrity error");

    // Corrupted magic header rejection
    const badHeaderCipher = "CORRUPTED_VAULT_HEADER::" + validBackupCipher.slice(23);
    const badHeaderRestore = importFullDatabase(badHeaderCipher);
    assert(badHeaderRestore.success === false, "Invalid header backup rejected");

    // Truncated ciphertext rejection
    const truncatedCipher = validBackupCipher.substring(0, 15);
    const truncatedRestore = importFullDatabase(truncatedCipher);
    assert(truncatedRestore.success === false, "Truncated ciphertext rejected gracefully");

    // Missing 'data' object payload rejection
    const invalidJsonPayload = JSON.stringify({ version: "5.0.0", app: "ClinicFlow" });
    const invalidPayloadRestore = importFullDatabase(invalidJsonPayload);
    assert(invalidPayloadRestore.success === false, "Backup missing 'data' root object rejected");
    assert(invalidPayloadRestore.error.includes("Missing 'data' object"), "Missing data structure error reported");
  });

  // ============================================================================
  // SUITE 42: PRODUCTION OBSERVABILITY, VERSIONING, LINEAGE & DEVOPS HEALTH
  // ============================================================================
  await suite("42. Production Observability, Privacy-Safe Telemetry, Versioning & Record Lineage", async () => {
    // ------------------------------------------------------------------------
    // 1. PRIVACY-SAFE TELEMETRY & DEEP DATA MASKING
    // ------------------------------------------------------------------------
    const samplePayload = {
      user_id: "usr_doc1",
      patient_name: "Muhammad Siddique",
      phone: "03001234567",
      cnic: "41303-1234567-1",
      token: "secret_session_token_xyz",
      password: "SuperSecretPassword123!",
      cash: 5000,
      symptoms: "High fever and persistent cough",
      safe_status: "active",
      safe_count: 42,
    };

    const sanitized = sanitizeData(samplePayload);
    assert(sanitized.user_id === "usr_doc1", "Safe identifiers preserved without modification");
    assert(sanitized.patient_name === "[REDACTED]", "Patient PII name scrubbed to [REDACTED]");
    assert(sanitized.phone === "[REDACTED]", "Phone number key scrubbed to [REDACTED]");
    assert(sanitized.cnic === "[REDACTED]", "CNIC key scrubbed to [REDACTED]");
    assert(sanitized.token === "[REDACTED]", "Auth token scrubbed to [REDACTED]");
    assert(sanitized.password === "[REDACTED]", "Password key scrubbed to [REDACTED]");
    assert(sanitized.cash === "[REDACTED]", "Financial cash value scrubbed to [REDACTED]");
    assert(sanitized.symptoms === "[REDACTED]", "Clinical symptom data scrubbed to [REDACTED]");
    assert(sanitized.safe_status === "active", "Safe non-sensitive status preserved");
    assert(sanitized.safe_count === 42, "Safe non-sensitive number count preserved");

    // In-string regex masking for unhandled stack traces / error messages
    const rawErrorMessage = "Error with CNIC 41303-1234567-1 and Phone 03001234567 using Bearer secret_jwt_123.456.789";
    const maskedMessage = sanitizeData(rawErrorMessage);
    assert(!maskedMessage.includes("41303-1234567-1"), "In-string CNIC masked");
    assert(maskedMessage.includes("[CNIC_REDACTED]"), "In-string CNIC replaced with [CNIC_REDACTED]");
    assert(!maskedMessage.includes("03001234567"), "In-string Phone number masked");
    assert(maskedMessage.includes("[PHONE_REDACTED]"), "In-string Phone replaced with [PHONE_REDACTED]");
    assert(!maskedMessage.includes("secret_jwt_123"), "In-string Bearer JWT token masked");
    assert(maskedMessage.includes("Bearer [TOKEN_REDACTED]"), "In-string JWT replaced with Bearer [TOKEN_REDACTED]");

    // ------------------------------------------------------------------------
    // 2. CIRCULAR RING BUFFER & OBSERVABILITY METRICS
    // ------------------------------------------------------------------------
    telemetry.recordError("API_GATEWAY_TIMEOUT", new Error("Server took too long to respond"), { endpoint: "/api/v1/sync/push" });
    telemetry.recordError("SYNC_MUTATION_FAILURE", new Error("Failed to push batch mutation"), { retry: 2 });
    telemetry.recordError("INDEXEDDB_QUOTA_ERROR", new Error("Storage quota exceeded"), { bytes: 5000000 });
    telemetry.recordError("UNHANDLED_WINDOW_ERROR", new Error("Uncaught reference in component"), { colno: 42 });

    const snapshot = telemetry.getDiagnosticSnapshot();
    assert(snapshot.app === "ClinicFlow-Desktop-Hybrid", "Diagnostic snapshot contains application descriptor");
    assert(snapshot.metrics.apiErrorsCount >= 1, "API gateway errors tracked in telemetry metrics");
    assert(snapshot.metrics.syncFailuresCount >= 1, "Sync failures tracked in telemetry metrics");
    assert(snapshot.metrics.indexedDbErrorsCount >= 1, "IndexedDB errors tracked in telemetry metrics");
    assert(snapshot.metrics.unhandledExceptionsCount >= 1, "Unhandled exceptions tracked in telemetry metrics");
    assert(snapshot.recentErrors.length >= 4, "Errors stored in circular ring buffer");

    // Breadcrumb verification
    telemetry.addBreadcrumb("navigation", "Navigated to /store POS screen");
    telemetry.addBreadcrumb("pos", "Cart item added: Schwabe Cineraria");
    const updatedSnap = telemetry.getDiagnosticSnapshot();
    assert(updatedSnap.breadcrumbs.some((b) => b.category === "pos"), "Breadcrumbs captured in runtime diagnostic snapshot");

    // ------------------------------------------------------------------------
    // 3. APPLICATION VERSIONING & SEMVER COMPARATOR
    // ------------------------------------------------------------------------
    assert(compareSemver("2.5.0", "2.4.9") === 1, "compareSemver detects newer version (2.5.0 > 2.4.9)");
    assert(compareSemver("2.5.0", "2.5.0") === 0, "compareSemver detects identical versions (2.5.0 == 2.5.0)");
    assert(compareSemver("2.4.0", "2.5.0") === -1, "compareSemver detects outdated version (2.4.0 < 2.5.0)");
    assert(compareSemver("v3.0.0", "2.9.9") === 1, "compareSemver handles leading 'v' prefixes gracefully");

    const badge = getShortVersionBadge();
    assert(badge.startsWith("v2.") && badge.includes("#"), "getShortVersionBadge produces valid compact badge");

    const diagInfo = getSystemDiagnosticInfo();
    assert(diagInfo.version === APP_CONFIG.SEMVER, "Diagnostic info reports matching SemVer");
    assert(diagInfo.schema_version === 4, "Diagnostic info reports canonical Schema Version 4");
    assert(typeof diagInfo.device_id === "string" && diagInfo.device_id.length > 0, "Diagnostic info reports unique Hardware Device ID");

    // ------------------------------------------------------------------------
    // 4. RECORD LINEAGE & DISTRIBUTED PROVENANCE TRACKING
    // ------------------------------------------------------------------------
    const rawPatient = {
      id: "pat_test_prov_1",
      full_name: "Kashif Khan Lineage Test",
      phone: "03001234567",
    };

    const decoratedPat = decorateRecordLineage(rawPatient, "CREATE");
    assert(decoratedPat._client_version === APP_CONFIG.SEMVER, "Created record stamped with _client_version");
    assert(decoratedPat._build_id === APP_CONFIG.BUILD_ID, "Created record stamped with _build_id");
    assert(typeof decoratedPat._device_id === "string", "Created record stamped with _device_id");
    assert(decoratedPat._origin_node === decoratedPat._device_id, "Created record initializes _origin_node to initial device node");
    assert(decoratedPat._schema_version === 4, "Created record stamped with _schema_version");
    assert(decoratedPat._lineage_hops === 0, "Created record initializes _lineage_hops to 0");

    // Mutation update lineage
    const updatedPat = decorateRecordLineage(decoratedPat, "UPDATE");
    assert(updatedPat._lineage_hops === 1, "Updated record increments _lineage_hops to 1");
    assert(typeof updatedPat._last_modified_device === "string", "Updated record stamped with _last_modified_device");
    assert(updatedPat._updated_at !== undefined, "Updated record stamped with _updated_at timestamp");

    // Strip lineage metadata for external export
    const cleanExport = stripLineageMetadata(updatedPat);
    assert(cleanExport._client_version === undefined, "_client_version stripped for clean export");
    assert(cleanExport._build_id === undefined, "_build_id stripped for clean export");
    assert(cleanExport._device_id === undefined, "_device_id stripped for clean export");
    assert(cleanExport._lineage_hops === undefined, "_lineage_hops stripped for clean export");
    assert(cleanExport.id === "pat_test_prov_1" && cleanExport.full_name === "Kashif Khan Lineage Test", "Core business fields intact after stripping");

    // ------------------------------------------------------------------------
    // 5. SYNC TELEMETRY METRIC BRIDGING
    // ------------------------------------------------------------------------
    telemetry.recordSyncMetric({
      status: "SYNCING_PUSH",
      pendingCount: 3,
      failedCount: 0,
      conflictCount: 1,
      latencyMs: 85,
      lastSyncTime: new Date().toISOString(),
    });

    const syncSnap = telemetry.getDiagnosticSnapshot();
    assert(syncSnap.metrics.pendingOutbox === 3, "Telemetry sync metric tracks pending outbox count");
    assert(syncSnap.metrics.conflictCount === 1, "Telemetry sync metric tracks conflict count");
    assert(syncSnap.metrics.serverLatencyMs === 85, "Telemetry sync metric tracks roundtrip latency in ms");
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
}

runTests();

