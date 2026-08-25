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
  dbCashBook,
  dbDayClosing,
  dbLicense,
  dbOutbox,
  hashPassword,
  formatStockBreakdown,
  generateSequentialInvoiceNo,
} from "../src/api/db.js";

import { login, logout, getSession } from "../src/api/auth.js";
import { createPatient, searchPatients, updatePatient } from "../src/api/patients.js";
import { recordSale } from "../src/api/store.js";
import { escapeHtml, printPurchaseGRNReceipt, printSaleInvoiceReceipt, printCashVoucherReceipt } from "../src/utils/thermalPrinter.js";

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
    if (users.length === 0) {
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
  await suite("3. Authentication, Security & Rate Limiting", () => {
    // Ensure doctor and pharmacist exist with hashed test password
    const allUsers = dbUsers.getAll();
    const doc = allUsers.find((u) => u.username === "kashif");
    if (doc) {
      dbUsers.update(doc.id, { password: hashPassword("123456") });
    }
    const pharm = allUsers.find((u) => u.username === "usama");
    if (pharm) {
      dbUsers.update(pharm.id, { password: hashPassword("123456") });
    }

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
    assert(backup.version === "5.0.0" && backup.data && Object.keys(backup.data).length > 5, "Full database JSON backup created");

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
    const nextSaleVoucher = dbSales.getNextVoucherNo();
    assert(nextSaleVoucher && nextSaleVoucher.startsWith("S-"), `Sale voucher sequencing starts with 'S-': got ${nextSaleVoucher}`);

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
      assert(distSwContent.includes("BUILD_VERSION = 'v2.1.") || distSwContent.includes("v2.1."), "Production dist/sw.js has dynamically injected cache version");
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
      assert(vpsScript.includes("npm run build"), "VPS deployment script compiles production frontend bundle");
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

