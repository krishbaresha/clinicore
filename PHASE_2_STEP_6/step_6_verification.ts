import assert from 'node:assert';
import {
  AccdbExtractor,
  type RawAccountRecord,
  type RawInventoryRecord,
  type RawInvextraRecord,
  type RawMainproRecord,
  type RawMainAcRecord,
  type RawCashBookRecord,
  type RawAppointmentRecord
} from './etl_pipeline/src/extractors/accdb_extractor.ts';

import {
  StagingValidator,
  type ValidationSummary
} from './etl_pipeline/src/validators/staging_validator.ts';

import {
  CanonicalMapper,
  type CanonicalBundle
} from './etl_pipeline/src/transformers/canonical_mapper.ts';

console.log('=== STARTING PHASE 2 STEP 6 ETL PIPELINE VERIFICATION SUITE ===\n');

// 1. Prepare Mock Staging Raw MS Access Records (AshrafKhan.accdb dataset)
const rawAccounts: RawAccountRecord[] = [
  { ID: 101, 'Account Name': 'Al-Madina Medical Store', 'Account No': 'PTY-101', 'Account Type': 'Party', Naration: 'Wholesale Client Hyderabad' },
  { ID: 102, 'Account Name': 'Bismillah Pharmacy', 'Account No': '', 'Account Type': 'Customer', Naration: 'Missing Party Code Test' },
  { ID: 201, 'Account Name': 'Schwabe Pakistan', 'Account No': 'SUP-201', 'Account Type': 'Supplier' },
  { ID: 202, 'Account Name': 'BM Private Limited', 'Account No': 'SUP-202', 'Account Type': 'Company' },
  { ID: 301, 'Account Name': 'Utility Expense', 'Account No': 'EXP-301', 'Account Type': 'Expense' }
];

const rawInventory: RawInventoryRecord[] = [
  { ID: 5001, 'Item Name': 'Cineraria Maritima Drops', 'Item Code': 'BM-CIN-01', 'Sale Price': 350, 'Purchase Price': 220, 'Minimum Level': 10 },
  { ID: 5002, 'Item Name': 'Alpha-HA Drops 30ml', 'Item Code': 'SCH-ALP-30', 'Sale Price': 650, 'Purchase Price': 450, 'Minimum Level': 5 },
  { ID: 5003, 'Item Name': 'Legacy Uncoded Syrup', 'Item Code': '', 'Sale Price': 180, 'Purchase Price': 110, 'Minimum Level': 2 } // Missing SKU
];

const rawInvextra: RawInvextraRecord[] = [
  { ID: 8001, Date: '2026-03-15', 'Voucher No': 'VOU-SALE-001', Type: 'Sale', 'Account Name': 'Al-Madina Medical Store', SalesMan: 'Kamran', 'Net Amount': 12500, 'Cash Received': 5000 },
  { ID: 8002, Date: '2026-03-16', 'Voucher No': 'VOU-PURCH-002', Type: 'Purchase', 'Account Name': 'Schwabe Pakistan', 'Net Amount': 45000, 'Cash Received': 45000 }
];

const rawMainpro: RawMainproRecord[] = [
  { ID: 9001, Date: '2026-03-15', 'Voucher No': 'VOU-SALE-001', 'Transaction Type': 'B2B Sale', 'Item name': 'Cineraria Maritima Drops', In: 0, Out: 20, Rate: 350, Gross: 7000, Net: 7000 },
  { ID: 9002, Date: '2026-03-16', 'Voucher No': 'VOU-PURCH-002', 'Transaction Type': 'Purchase Receipt', 'Item name': 'Alpha-HA Drops 30ml', In: 100, Out: 0, Rate: 450, Gross: 45000, Net: 45000 }
];

const rawMainAc: RawMainAcRecord[] = [
  // Balanced Voucher VOU-SALE-001 (Debit 12500 = Credit 12500)
  { ID: 7001, Date: '2026-03-15', 'Voucher No': 'VOU-SALE-001', 'Account Name': 'Al-Madina Medical Store', Description: 'B2B Sale Invoice', Debit: 12500, Credit: 0 },
  { ID: 7002, Date: '2026-03-15', 'Voucher No': 'VOU-SALE-001', 'Account Name': 'Sales Revenue Account', Description: 'B2B Sale Invoice', Debit: 0, Credit: 12500 },

  // Unbalanced Voucher VOU-UNBAL-999 (Debit 5000 != Credit 3000)
  { ID: 7003, Date: '2026-03-17', 'Voucher No': 'VOU-UNBAL-999', 'Account Name': 'Cash Account', Description: 'Unbalanced entry test', Debit: 5000, Credit: 0 },
  { ID: 7004, Date: '2026-03-17', 'Voucher No': 'VOU-UNBAL-999', 'Account Name': 'Miscellaneous Income', Description: 'Unbalanced entry test', Debit: 0, Credit: 3000 }
];

const rawCashBook: RawCashBookRecord[] = [
  { ID: 4001, Date: '2026-03-15', 'Voucher No': 'CB-001', 'Account Name': 'Al-Madina Medical Store', Description: 'Cash recovery', Debit: 5000, Credit: 0 },
  { ID: 4002, Date: '2026-03-15', 'Voucher No': 'CB-001', 'Account Name': 'Cash Account', Description: 'Cash recovery', Debit: 0, Credit: 5000 }
];

const rawAppointments: RawAppointmentRecord[] = [
  { ID: 3001, 'Patient Name': 'Tariq Mehmood', Phone: '03001234567', 'Appointment Date': '2026-03-20 17:30', Doctor: 'H/Dr. Asif Ashraf Khan', Status: 'CONFIRMED', Notes: 'Chronic allergy checkup' }
];

// --- TEST 1: extraction from staging records into memory ---
console.log('[TEST 1/3] Testing MS Access ACCDB Raw Extractor & Staging Lineage...');
const extractor = new AccdbExtractor('AshrafKhan.accdb');
const stagedData = extractor.extractAll({
  Accounts: rawAccounts,
  Inventory: rawInventory,
  Invextra: rawInvextra,
  Mainpro: rawMainpro,
  MainAc: rawMainAc,
  CashBook: rawCashBook,
  Appointment: rawAppointments
});

assert.strictEqual(stagedData.accounts.length, 5, 'Should extract 5 accounts');
assert.strictEqual(stagedData.inventory.length, 3, 'Should extract 3 inventory items');
assert.strictEqual(stagedData.invextra.length, 2, 'Should extract 2 invextra records');
assert.strictEqual(stagedData.mainpro.length, 2, 'Should extract 2 mainpro records');
assert.strictEqual(stagedData.mainAc.length, 4, 'Should extract 4 mainAc records');
assert.strictEqual(stagedData.cashBook.length, 2, 'Should extract 2 cashBook records');
assert.strictEqual(stagedData.appointments.length, 1, 'Should extract 1 appointment record');

// Check lineage metadata presence
for (const acc of stagedData.accounts) {
  assert.strictEqual(acc._legacy_source, 'AshrafKhan.accdb');
  assert.strictEqual(acc._legacy_table, 'Accounts');
  assert.ok(acc._legacy_id !== undefined, 'Legacy ID must be attached');
}
console.log('✓ Staging extraction and provenance tagging verified cleanly.');

// --- TEST 2: validation rules ---
console.log('\n[TEST 2/3] Testing Staging Validator Invariants (Missing SKUs, Unbalanced Transactions, Missing Party Codes)...');
const validator = new StagingValidator();
const valSummary: ValidationSummary = validator.validate(stagedData);

assert.strictEqual(valSummary.isValid, false, 'Validation should fail due to intentional errors');
assert.strictEqual(valSummary.metrics.missingSkuCount, 1, 'Validator must detect 1 missing SKU');
assert.strictEqual(valSummary.metrics.unbalancedVouchersCount, 1, 'Validator must detect 1 unbalanced voucher');
assert.strictEqual(valSummary.metrics.missingPartyCodeCount, 1, 'Validator must detect 1 missing party code');

// Verify error codes
const skuErr = valSummary.errors.find((e) => e.code === 'MISSING_SKU');
assert.ok(skuErr, 'Must contain MISSING_SKU error');
assert.strictEqual(skuErr.legacyId, 5003);

const unbalErr = valSummary.errors.find((e) => e.code === 'UNBALANCED_TRANSACTION');
assert.ok(unbalErr, 'Must contain UNBALANCED_TRANSACTION error');
assert.strictEqual(unbalErr.details?.voucherNo, 'VOU-UNBAL-999');

const partyErr = valSummary.errors.find((e) => e.code === 'MISSING_PARTY_CODE');
assert.ok(partyErr, 'Must contain MISSING_PARTY_CODE error');
assert.strictEqual(partyErr.legacyId, 102);

// Check automatic SKU fallback warning
const skuWarn = valSummary.warnings.find((w) => w.code === 'SKU_AUTO_GENERATED');
assert.ok(skuWarn, 'Must contain SKU_AUTO_GENERATED warning');
assert.strictEqual(skuWarn.suggestedValue, 'SKU-5003');

console.log(`✓ Validation engine detected ${valSummary.errors.length} expected errors & ${valSummary.warnings.length} warnings cleanly.`);

// --- TEST 3: canonical transformation & _legacy_id lineage preservation ---
console.log('\n[TEST 3/3] Testing Canonical Schema Transformation & _legacy_id Lineage Preservation...');
const mapper = new CanonicalMapper();
const canonicalBundle: CanonicalBundle = mapper.transform(stagedData);

// Assert Party & Supplier mappings
assert.strictEqual(canonicalBundle.parties.length, 2, 'Should map 2 parties');
assert.strictEqual(canonicalBundle.suppliers.length, 2, 'Should map 2 suppliers');
assert.strictEqual(canonicalBundle.parties[0].party_code, 'PTY-101');
assert.strictEqual(canonicalBundle.parties[0]._legacy_id, 101);
assert.strictEqual(canonicalBundle.parties[0]._legacy_source, 'AshrafKhan.accdb');

// Assert Inventory SKU generation & lineage fallback
assert.strictEqual(canonicalBundle.inventory.length, 3);
const fallbackItem = canonicalBundle.inventory.find((i) => i._legacy_id === 5003);
assert.ok(fallbackItem, 'Item 5003 must exist in canonical output');
assert.strictEqual(fallbackItem.sku_code, 'SKU-5003', 'Fallback SKU must be auto-assigned SKU-5003');
assert.strictEqual(fallbackItem._legacy_table, 'Inventory');

// Assert B2B Sales & Purchase Invoice Headers
assert.strictEqual(canonicalBundle.b2bSales.length, 1);
assert.strictEqual(canonicalBundle.b2bSales[0].invoice_number, 'VOU-SALE-001');
assert.strictEqual(canonicalBundle.b2bSales[0].gross_amount, 12500);
assert.strictEqual(canonicalBundle.b2bSales[0]._legacy_id, 8001);

assert.strictEqual(canonicalBundle.purchases.length, 1);
assert.strictEqual(canonicalBundle.purchases[0].invoice_number, 'VOU-PURCH-002');
assert.strictEqual(canonicalBundle.purchases[0]._legacy_id, 8002);

// Assert Stock Movements
assert.strictEqual(canonicalBundle.stockMovements.length, 2);
assert.strictEqual(canonicalBundle.stockMovements[0].movement_type, 'B2B_SALE');
assert.strictEqual(canonicalBundle.stockMovements[1].movement_type, 'PURCHASE_RECEIPT');

// Assert Financial Ledger Entries
assert.strictEqual(canonicalBundle.cashbook.length, 6, 'Should combine MainAc (4) and CashBook (2)');
for (const entry of canonicalBundle.cashbook) {
  assert.ok(entry._legacy_id !== undefined);
  assert.ok(['MainAc', 'CashBook'].includes(entry._legacy_table));
}

// Assert Appointments
assert.strictEqual(canonicalBundle.appointments.length, 1);
assert.strictEqual(canonicalBundle.appointments[0].patient_name, 'Tariq Mehmood');
assert.strictEqual(canonicalBundle.appointments[0]._legacy_id, 3001);

console.log('✓ Canonical transformation and _legacy_id lineage preservation verified cleanly across all tables.');
console.log('\n=== ALL PHASE 2 STEP 6 ETL SUITE TESTS PASSED SUCCESSFULLY ===');
