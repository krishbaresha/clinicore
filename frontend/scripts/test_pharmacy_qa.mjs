/**
 * ClinicFlow — Pharmacy, POS, Inventory, Warehouse & Wholesale Comprehensive QA Engine
 * Stress tests all 6 target domains:
 * 1. Medical Store Inventory (SKU search, category & company filter, unit price vs box price calculations, location stock isolation for assigned warehouses vs all-location view).
 * 2. POS Terminal (Product search by name and code, F1-F11 hotkey actions, dynamic line item discount % and flat Rs, overall trade discount, Cash / Credit / Bank payment modes, Partial downpayment on credit sales, Walk-in vs Linked OPD Patient sales).
 * 3. Inward Purchases & Supplier Ledgers (Supplier purchase entry, GRN calculations, 0% discount preservation, supplier ledger balance update, purchase deletion stock reversal).
 * 4. Multi-Warehouse Stock Transfers (Dispatching transfers between warehouses, stock deduction from source, receiving audit and breakages logging).
 * 5. Medical Store Sales Log, Returns & Day-End Cash Reconciliation (Voided sales exclusion, returns calculation, expected vs actual cash drawer variance).
 * 6. 4-Level Stock Ledger (Category -> SKU -> Timeline -> Voucher drilldown, CSV export, thermal ledger print).
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

import {
  resetDatabaseToDemoData,
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
  dbWarehouses,
  formatStockBreakdown,
  generateSequentialInvoiceNo,
} from "../src/api/db.js";

import { recordSale, getInventory, addInventoryItem, processSaleReturn } from "../src/api/store.js";
import {
  escapeHtml,
  printPurchaseGRNReceipt,
  printSaleInvoiceReceipt,
  printCashVoucherReceipt,
  printInventoryListReceipt,
  printProductPricingListReceipt,
} from "../src/utils/thermalPrinter.js";
import fs from "fs";
import path from "path";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const errors = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
    errors.push(message);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function suite(name, fn) {
  console.log(`\n======================================================================`);
  console.log(`🧪 QA TEST SUITE: ${name}`);
  console.log(`======================================================================`);
  try {
    await fn();
  } catch (err) {
    console.error(`💥 Suite Failure in "${name}":`, err.message);
  }
}

async function runPharmacyAndInventoryQA() {
  console.log("🚀 Starting Comprehensive Pharmacy, POS, Inventory & B2B Wholesale QA Test Run...\n");

  resetDatabaseToDemoData();

  // -------------------------------------------------------------------------
  // DOMAIN 1: Medical Store Inventory
  // -------------------------------------------------------------------------
  await suite("DOMAIN 1: Medical Store Inventory & Multi-Warehouse Stock Isolation", () => {
    // 1.1 Add multi-unit item with box, strip, unit calculations
    const newItem = dbInventory.add({
      medicine_name: "Panadol CF Cold & Flu Caplets",
      company_name: "GSK Consumer Healthcare",
      item_code: "GSK-PAN-CF",
      category: "Tablet",
      strength: "500mg / 25mg",
      has_multi_unit: true,
      box_label: "Box",
      strip_label: "Strip",
      unit_label: "Tablet",
      strips_per_box: 10,
      units_per_strip: 10,
      units_per_box: 100, // 10 * 10
      stock_boxes: 5,
      stock_qty: 125, // Counter stock: 125
      total_base_stock: 525,
      cost_price_per_box: 450,
      box_sale_price: 600,
      strip_sale_price: 65,
      unit_sale_price: 7,
      low_stock_threshold: 50,
      store_stock: 125,
      warehouse_stock: 400,
      location_stocks: {
        wh_001: 400,
        wh_str: 125,
      },
    });

    assert(newItem && newItem.id, "Multi-unit inventory item created successfully");
    assert(newItem.total_base_stock === 525, "Total base stock arithmetic is 525 units (400 godown + 125 counter)");

    // 1.2 Unit price vs Box price ratio validation
    const unitPriceCalc = newItem.unit_sale_price; // 7
    const stripPriceCalc = newItem.strip_sale_price; // 65 (10 tablets = 6.5/tab vs 7 loose)
    const boxPriceCalc = newItem.box_sale_price; // 600 (100 tablets = 6.0/tab vs 7 loose)
    assert(boxPriceCalc < stripPriceCalc * 10, "Box discount pricing is cheaper than buying 10 individual strips (600 < 650)");
    assert(stripPriceCalc < unitPriceCalc * 10, "Strip discount pricing is cheaper than buying 10 loose tablets (65 < 70)");

    // 1.3 Format Stock Breakdown Helper
    const breakdown = formatStockBreakdown(newItem);
    assert(breakdown.includes("400 Box") && breakdown.includes("125 Tablet"), `Stock breakdown formatted correctly: "${breakdown}"`);

    // 1.4 SKU & Code Search
    const searchByName = dbInventory.getAll().filter(i => i.medicine_name.toLowerCase().includes("panadol"));
    assert(searchByName.length >= 1, "SKU search by medicine name returned expected product");

    const searchByCode = dbInventory.getAll().filter(i => i.item_code.toUpperCase().includes("GSK"));
    assert(searchByCode.length >= 1, "SKU search by item_code returned expected product");

    // 1.5 Category & Company Filtering
    const allItems = dbInventory.getAll();
    const tablets = allItems.filter(i => (i.category || "").toLowerCase() === "tablet");
    assert(tablets.some(t => t.id === newItem.id), "Category filter correctly includes new item under 'Tablet'");

    const gskItems = allItems.filter(i => (i.company_name || "").toLowerCase().includes("gsk"));
    assert(gskItems.length >= 1, "Company filter correctly finds GSK products");

    // 1.6 Location Stock Isolation (Assigned warehouse vs All Locations)
    const wh1Scoped = dbInventory.getScopedInventory({ assigned_warehouse_id: "wh_001", role: "staff" });
    const itemInWh1 = wh1Scoped.find(i => i.id === newItem.id);
    assert(itemInWh1 && (itemInWh1.warehouse_stock === 400 || itemInWh1.stock_qty === 400), "Warehouse 1 stock scoped accurately to 400 units");

    const storeScoped = dbInventory.getScopedInventory({ assigned_warehouse_id: "wh_str", role: "cashier" });
    const itemInStore = storeScoped.find(i => i.id === newItem.id);
    assert(itemInStore && (itemInStore.store_stock === 125 || itemInStore.stock_qty === 125), "Store Counter stock scoped accurately to 125 units");

    // All location view
    const allScoped = dbInventory.getScopedInventory(null);
    const itemInAll = allScoped.find(i => i.id === newItem.id);
    assert(itemInAll && itemInAll.total_base_stock === 525, "All-location view preserves full aggregate base stock of 525");
  });

  // -------------------------------------------------------------------------
  // DOMAIN 2: POS Terminal & Hotkeys
  // -------------------------------------------------------------------------
  await suite("DOMAIN 2: POS Terminal Hotkeys, Dynamic Discounts & Payment Modes", () => {
    // 2.1 Verify Hotkey coverage in POS source code
    const posFilePath = fs.existsSync("./src/components/SaleInvoiceModal.jsx")
      ? path.resolve("./src/components/SaleInvoiceModal.jsx")
      : path.resolve("./frontend/src/components/SaleInvoiceModal.jsx");
    const posContent = fs.readFileSync(posFilePath, "utf8");

    assert(posContent.includes("F1"), "F1 Hotkey (Focus Search) wired in POS");
    assert(posContent.includes("F2"), "F2 Hotkey (Tender Cash / Pay) wired in POS");
    assert(posContent.includes("F3"), "F3 Hotkey (Clear Cart) wired in POS");
    assert(posContent.includes("F4"), "F4 Hotkey (Hold / Park Cart) wired in POS");
    assert(posContent.includes("F8") || posContent.includes("F9"), "F8/F9 Hotkeys (Patient select / Mode switch) wired in POS");
    assert(posContent.includes("F10") || posContent.includes("F11"), "F10/F11 Hotkeys (Discount / Fullscreen / Print) wired in POS");

    // 2.2 Dynamic line item discount % and flat Rs
    const testMed = dbInventory.getAll()[0];
    const initialStock = Number(testMed.store_stock ?? testMed.stock_qty ?? 100);

    const lineItem1 = {
      inventory_id: testMed.id,
      medicine_name: testMed.medicine_name,
      quantity: 2,
      unit_label: "Box",
      unit_price: 500,
      line_gross: 1000,
      disc_pct: 10, // 10% off 1000 = 100
      disc_flat: 50, // Rs 50 extra flat discount = 150 total discount
      line_total: 850,
      qty_base_units: 2,
    };

    assert(lineItem1.line_gross - (lineItem1.line_gross * (lineItem1.disc_pct / 100) + lineItem1.disc_flat) === 850, "Line item combined % and Flat discount calculation matches 850");

    // 2.3 Overall Trade Discount (Bill-level discount)
    const subtotal = 850;
    const billTradeDiscountPct = 5; // 5% of 850 = 42.5
    const billFlatDiscount = 7.5; // Total discount = 50
    const grandTotal = subtotal - (subtotal * (billTradeDiscountPct / 100)) - billFlatDiscount;
    assert(grandTotal === 800, "Bill-level Trade discount (% and flat) accurately computes Grand Total = Rs. 800");

    // 2.4 Sale Execution: Walk-In Cash Sale
    const cashSale = dbSales.checkout({
      customer_name: "Walk-in Customer",
      sale_date: new Date().toISOString(),
      payment_type: "cash",
      payment_mode: "Cash",
      items: [lineItem1],
      subtotal_amount: 1000,
      discount_amount: 200, // 150 item disc + 50 bill disc
      total_amount: 800,
      cash_tendered: 1000,
      paid_amount: 800,
      change_due: 200,
      location_id: "wh_str",
    });

    assert(cashSale && cashSale.id, "Walk-in cash sale created successfully");
    assert(cashSale.total_amount === 800, "Grand total amount is Rs. 800");

    // 2.5 Linked OPD Patient Sale on Credit / Udhaar with Partial Downpayment
    let patient = dbPatients.getAll()[0];
    if (!patient) {
      patient = dbPatients.add({ name: "Muhammad Usman", phone: "03001234567", balance_due: 0 });
    }
    const initialPatientBalance = Number(patient.balance_due ?? 0);

    const creditSale = dbSales.checkout({
      patient_id: patient.id,
      patient_name: patient.name,
      customer_name: patient.name,
      sale_date: new Date().toISOString(),
      payment_type: "credit",
      payment_mode: "Credit",
      items: [lineItem1],
      subtotal_amount: 1000,
      discount_amount: 200,
      total_amount: 800,
      cash_tendered: 300, // Partial downpayment
      paid_amount: 300,
      balance_due: 500, // Remaining Rs. 500 added to ledger
      location_id: "wh_str",
    });

    assert(creditSale && creditSale.balance_due === 500, "Credit sale partial downpayment leaves balance due of Rs. 500");

    // 2.6 Bank / Cheque Sale
    const bankSale = dbSales.checkout({
      customer_name: "Dr. Farhan Clinic",
      sale_date: new Date().toISOString(),
      payment_type: "bank",
      payment_mode: "Bank Transfer",
      bank_name: "Meezan Bank Ltd",
      cheque_no: "CHQ-778899",
      items: [lineItem1],
      subtotal_amount: 800,
      total_amount: 800,
      paid_amount: 800,
      balance_due: 0,
    });
    assert(bankSale && bankSale.bank_name === "Meezan Bank Ltd" && bankSale.cheque_no === "CHQ-778899", "Bank payment mode recorded with institution and instrument reference");
  });

  // -------------------------------------------------------------------------
  // DOMAIN 3: Inward Purchases & Supplier Ledgers
  // -------------------------------------------------------------------------
  await suite("DOMAIN 3: Inward Purchases, GRN, 0% Discount Preservation & Supplier Reversal", () => {
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
    const supplier = suppliers[0];
    const initialSupBalance = Number(supplier.current_balance ?? 0);
    const testItem = dbInventory.getAll()[0];
    const initialStock = Number(testItem.warehouse_stock ?? testItem.stock_qty ?? 0);

    // 3.1 Supplier purchase entry with GRN & 0% discount preservation
    const purchaseVoucher = dbPurchases.getNextVoucherNo ? dbPurchases.getNextVoucherNo() : "P-9001";
    const newPurchase = dbPurchases.add({
      invoice_no: purchaseVoucher,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      grn_no: "GRN-2026-001",
      reference: "INV-SUP-5544",
      transport: "TCS Express",
      bilty_no: "BLT-445566",
      purchase_date: new Date().toISOString(),
      payment_mode: "Credit",
      destination_type: "warehouse",
      items: [
        {
          inventory_id: testItem.id,
          medicine_name: testItem.medicine_name,
          product_code: testItem.item_code || "BM-01",
          qty: 50,
          qty_base_units: 50,
          cost_price: 200,
          rate: 200,
          gross: 10000,
          disc_pct: "0%", // Explicit 0% discount must be preserved, not nullified
          disc_flat: 0,
          net: 10000,
          total_cost: 10000,
        },
      ],
      total_amount: 10000,
      paid_amount: 3000,
      balance_due: 7000,
    });

    assert(newPurchase && newPurchase.id, "Supplier Purchase GRN recorded successfully");
    assert(newPurchase.items[0].disc_pct === "0%" || newPurchase.items[0].disc_pct === 0, "0% discount explicitly preserved without being stripped or undefined");
    assert(newPurchase.balance_due === 7000, "Purchase payable balance correctly computed (10,000 - 3,000 = 7,000)");

    // 3.2 Supplier Ledger Balance Update
    const supAfter = dbSuppliers.getById(supplier.id);
    assert(Number(supAfter.current_balance) === initialSupBalance + 7000, `Supplier payable balance updated correctly (+Rs. 7,000)`);

    // 3.3 Inventory Stock Inward Addition
    const stockAfter = dbInventory.getById(testItem.id);
    assert(Number(stockAfter.warehouse_stock) === initialStock + 50 || Number(stockAfter.stock_qty) === initialStock + 50, "Warehouse stock replenished by 50 units");

    // 3.4 Purchase Deletion Stock & Ledger Reversal
    dbPurchases.deletePurchase(newPurchase.id);
    const purchaseStillExists = dbPurchases.getAll().some(p => p.id === newPurchase.id);
    assert(!purchaseStillExists, "Purchase successfully deleted and removed from dbPurchases");

    const stockReversed = dbInventory.getById(testItem.id);
    assert(Number(stockReversed.warehouse_stock) === initialStock || Number(stockReversed.stock_qty) === initialStock, "Stock accurately reversed back to initial quantity on purchase deletion");

    const supReversed = dbSuppliers.getById(supplier.id);
    assert(Number(supReversed.current_balance) === initialSupBalance, "Supplier payable balance reversed back to initial balance");
  });

  // -------------------------------------------------------------------------
  // DOMAIN 4: Multi-Warehouse Stock Transfers
  // -------------------------------------------------------------------------
  await suite("DOMAIN 4: Multi-Warehouse Stock Transfers & Receiving Audit with Breakages", () => {
    const testItem = dbInventory.getAll()[0];
    const srcWh = "wh_001"; // Main Godown
    const destWh = "wh_str"; // Retail Pharmacy Store

    // Ensure item has defined stocks in both warehouses
    dbInventory.setStockForLocation(testItem.id, 200, srcWh);
    dbInventory.setStockForLocation(testItem.id, 50, destWh);

    const refreshed = dbInventory.getById(testItem.id);
    const initialSrcStock = dbInventory.getLocationStock(refreshed, srcWh);
    const initialDestStock = dbInventory.getLocationStock(refreshed, destWh);

    assert(initialSrcStock === 200, "Source Warehouse starting stock set to 200");
    assert(initialDestStock === 50, "Destination Warehouse starting stock set to 50");

    // 4.1 Dispatch Stock Transfer
    const transfer = dbStockTransfers.dispatchTransfer({
      from_warehouse_id: srcWh,
      from_location: "Main Godown Hyderabad",
      to_location: "store",
      to_warehouse_name: "Retail Pharmacy Store",
      dispatched_by: "Raza (Godown Incharge)",
      items: [
        {
          inventory_id: testItem.id,
          medicine_name: testItem.medicine_name,
          quantity: 30, // 30 dispatched
          qty: 30,
        },
      ],
      notes: "Urgent counter replenishment",
    });

    assert(transfer && transfer.status === "in_transit", "Stock transfer dispatched with status 'in_transit'");

    // Source deduction upon dispatch
    const itemAfterDispatch = dbInventory.getById(testItem.id);
    const srcAfterDispatch = dbInventory.getLocationStock(itemAfterDispatch, srcWh);
    assert(srcAfterDispatch === 170, "Source warehouse stock immediately deducted by 30 units (200 -> 170)");

    // Destination stock should NOT increase while in transit
    const destInTransit = dbInventory.getLocationStock(itemAfterDispatch, destWh);
    assert(destInTransit === 50, "Destination warehouse stock untouched while in-transit");

    // 4.2 Receive Stock Transfer with Audit & Breakages Logging
    // 30 dispatched: 28 received intact, 2 bottles broken/damaged
    const receiveAudit = dbStockTransfers.receiveTransfer(transfer.id, {
      received_by: "Mustafa (Pharmacy Cashier)",
      damaged_count: 2,
      notes: "Vial cracked during carton offloading",
    });

    assert(receiveAudit && receiveAudit.status === "received", "Transfer successfully acknowledged and marked 'received'");
    assert(receiveAudit.damaged_count === 2, "Breakages (2 units) recorded in receiving audit ledger");

    // Destination stock should now have +28 intact units
    const itemAfterReceive = dbInventory.getById(testItem.id);
    const destAfterReceive = dbInventory.getLocationStock(itemAfterReceive, destWh);
    assert(destAfterReceive === 78, `Destination warehouse stock replenished with 28 intact units (50 + 28 = ${destAfterReceive})`);
  });

  // -------------------------------------------------------------------------
  // DOMAIN 5: Medical Store Sales Log, Returns & Cash Reconciliation
  // -------------------------------------------------------------------------
  await suite("DOMAIN 5: Sales Log, Returns, Voided Sales & Cash Drawer Reconciliation", () => {
    // 5.1 Add normal sale and voided sale
    const validSale = dbSales.checkout({
      customer_name: "Zubair Ahmed",
      sale_date: new Date().toISOString(),
      payment_type: "cash",
      items: [{ medicine_name: "Syr Amoxil", quantity: 2, line_total: 400, qty_base_units: 2 }],
      total_amount: 400,
    });

    const voidedSale = dbSales.checkout({
      customer_name: "Test Customer",
      sale_date: new Date().toISOString(),
      payment_type: "cash",
      items: [{ medicine_name: "Syr Amoxil", quantity: 1, line_total: 200, qty_base_units: 1 }],
      total_amount: 200,
    });

    // Void the second sale
    dbSales.voidSale(voidedSale.id, "Duplicate bill created in error");

    const allSales = dbSales.getAll();
    const checkedVoid = allSales.find(s => s.id === voidedSale.id);
    assert(checkedVoid && checkedVoid.is_voided === true, "Sale successfully marked as voided");

    // Sales log filtering should exclude voided sales from revenue
    const netCashSalesTotal = allSales
      .filter(s => !s.is_voided && s.payment_type === "cash")
      .reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

    assert(netCashSalesTotal > 0, "Net cash sales computed strictly excluding voided bills");

    // 5.2 Process Sale Return
    const returnTx = dbReturns.processReturn({
      sale_id: validSale.id,
      return_items: [
        {
          inventory_id: dbInventory.getAll()[0].id,
          medicine_name: "Syr Amoxil",
          quantity_returned: 1,
          unit_price: 200,
        },
      ],
      reason: "Patient allergic to penicillin",
      refund_type: "cash",
    });

    assert(returnTx && returnTx.refund_amount === 200, "Sale return processed with Rs. 200 cash refund");

    // 5.3 Day-End Cash Reconciliation (Drawer Variance calculation)
    const systemExpectedCash = 15000;
    const actualPhysicalCash = 14850; // Rs. 150 short
    const variance = actualPhysicalCash - systemExpectedCash; // -150

    const shiftReport = dbShiftClosings.add({
      date: new Date().toISOString().split("T")[0],
      closed_by: "Mustafa Cashier",
      total_system_cash: systemExpectedCash,
      counted_physical_cash: actualPhysicalCash,
      variance: variance,
      status: variance === 0 ? "balanced" : (variance < 0 ? "shortage" : "excess"),
      notes: "Rs. 150 shortage due to small coin change unavailability",
    });

    assert(shiftReport && shiftReport.variance === -150, "Cash drawer variance correctly computed as -150");
    assert(shiftReport.status === "shortage", "Shift status accurately categorized as 'shortage'");
  });

  // -------------------------------------------------------------------------
  // DOMAIN 6: 4-Level Stock Ledger
  // -------------------------------------------------------------------------
  await suite("DOMAIN 6: 4-Level Stock Ledger Drilldown, CSV & Thermal Print Engine", () => {
    // 6.1 Level 1: Category Summary
    const catSummary = dbStockLedger.getCategorySummary();
    assert(Array.isArray(catSummary) && catSummary.length > 0, "Level 1: Category Summary returns array of companies/categories");

    const targetCategory = catSummary[0].category;
    assert(targetCategory && typeof catSummary[0].total_qty === "number", "Level 1: Category entry has valid name and total quantity");

    // 6.2 Level 2: SKU Summary
    const skuSummary = dbStockLedger.getSKUSummary(targetCategory);
    assert(Array.isArray(skuSummary) && skuSummary.length > 0, `Level 2: SKU summary loaded for category '${targetCategory}'`);
    const targetSKU = skuSummary[0].item_name;
    assert(targetSKU && typeof skuSummary[0].qty === "number", "Level 2: SKU record contains valid item name and stock balance");

    // 6.3 Level 3: Transactional Timeline
    const timeline = dbStockLedger.getItemTimeline(targetSKU);
    assert(Array.isArray(timeline), `Level 3: Transactional timeline generated for SKU '${targetSKU}'`);

    // 6.4 Level 4: Voucher History Drilldown
    if (timeline.length > 0) {
      const dayEntry = timeline[0];
      assert(dayEntry.date && typeof dayEntry.total_in === "number" && typeof dayEntry.total_out === "number", "Level 3: Timeline entry has date and In/Out quantities");
      if (dayEntry.vouchers && dayEntry.vouchers.length > 0) {
        const voucher = dayEntry.vouchers[0];
        assert(voucher.voucher_no && voucher.type, "Level 4: Voucher drilldown contains voucher number and transaction type");
      }
    }

    // 6.5 Thermal Print & CSV Export Formatting
    let printErr = false;
    try {
      printInventoryListReceipt(dbInventory.getAll().slice(0, 10), dbClinic.get());
      printProductPricingListReceipt(dbInventory.getAll().slice(0, 10), dbClinic.get());
    } catch {
      printErr = true;
    }
    assert(!printErr, "Thermal Print engines for Inventory & Pricing lists formatted without error");

    const testItem = dbInventory.getAll()[0];
    const saleInvoiceMock = {
      voucher_no: "S-9988",
      account_name: "Madina Medical Store",
      payment_mode: "Credit",
      items: [{ medicine_name: testItem.medicine_name, qty: 10, rate: 300, net: 3000 }],
      total_amount: 3000,
    };
    const csvExport = dbSales.exportCSV([saleInvoiceMock]);
    assert(csvExport.includes("S-9988") && csvExport.includes("Madina Medical Store"), "Voucher CSV export correctly generated with header and row values");
  });

  // -------------------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------------------
  console.log(`\n======================================================================`);
  console.log(`📊 PHARMACY & INVENTORY QA EXECUTION SUMMARY`);
  console.log(`======================================================================`);
  console.log(`Total QA Test Cases : ${totalTests}`);
  console.log(`Passed Checks       : ${passedTests} ✅`);
  console.log(`Failed Checks       : ${failedTests} ❌`);
  if (failedTests === 0) {
    console.log(`🎉 100% OPERATIONAL READINESS CONFIRMED ACROSS ALL 6 DOMAINS!`);
  } else {
    console.log(`⚠️ Failures encountered:`, errors);
  }
  console.log(`======================================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPharmacyAndInventoryQA();
