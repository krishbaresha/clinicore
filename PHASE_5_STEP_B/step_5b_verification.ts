/**
 * PHASE 5 STEP B VERIFICATION SUITE
 * Executing Master Release Certification Checks & Administrator Operations Manual Verification.
 */

import assert from 'node:assert';
import { MasterReleaseAuditor } from './certification_suite/src/certification/master_release_auditor.ts';
import type { VoucherEntry, BatchItem, TestSuiteItem } from './certification_suite/src/certification/master_release_auditor.ts';
import { AdminOperationsGuide } from './certification_suite/src/documentation/admin_operations_guide.ts';

console.log('--------------------------------------------------');
console.log('🧪 RUNNING PHASE 5 STEP B VERIFICATION SUITE');
console.log('--------------------------------------------------');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// SECTION 1: PRODUCTION READINESS MASTER RELEASE AUDITOR ASSERTIONS
// ---------------------------------------------------------------------------
console.log('\n🏆 Section 1: Production Readiness Master Release Auditor');

runTest('Zero Data Loss Audit Assertion', () => {
  const auditor = new MasterReleaseAuditor();

  const syncRecords = [
    { id: 'SYNC_001', synced: true, checksum: 'sha256_abc123', expectedChecksum: 'sha256_abc123' },
    { id: 'SYNC_002', synced: true, checksum: 'sha256_def456', expectedChecksum: 'sha256_def456' },
    { id: 'SYNC_003', synced: true, checksum: 'sha256_ghi789', expectedChecksum: 'sha256_ghi789' },
  ];

  const result = auditor.auditZeroDataLoss(syncRecords);

  assert.strictEqual(result.isZeroDataLossVerified, true);
  assert.strictEqual(result.totalRecordsChecked, 3);
  assert.strictEqual(result.unsyncedRecordsCount, 0);
  assert.strictEqual(result.checksumMatch, true);
  assert.ok(result.details.includes('Zero Data Loss verified'));
});

runTest('Double-Entry Accounting Trial Balance Equality Assertion', () => {
  const auditor = new MasterReleaseAuditor();

  const vouchers: VoucherEntry[] = [
    { voucherId: 'VOUCH-101', debit: 150000.0, credit: 0, description: 'Initial Cash Deposit' },
    { voucherId: 'VOUCH-102', debit: 0, credit: 150000.0, description: 'Capital Account Credit' },
    { voucherId: 'VOUCH-103', debit: 45000.50, credit: 0, description: 'Medicine Stock Purchase' },
    { voucherId: 'VOUCH-104', debit: 0, credit: 45000.50, description: 'Supplier Accounts Payable' },
  ];

  const result = auditor.auditTrialBalanceEquality(vouchers);

  assert.strictEqual(result.isEqual, true);
  assert.strictEqual(result.totalDebit, 195000.50);
  assert.strictEqual(result.totalCredit, 195000.50);
  assert.strictEqual(result.variance, 0);
  assert.strictEqual(result.vouchersChecked, 4);
  assert.ok(result.details.includes('Trial Balance EQUAL'));
});

runTest('FEFO Stock Accuracy & Expiry Sorting Assertion', () => {
  const auditor = new MasterReleaseAuditor();

  const batches: BatchItem[] = [
    { batchId: 'B-001', itemCode: 'MED-PAN-500', expiryDate: '2026-09-15', quantity: 100 },
    { batchId: 'B-002', itemCode: 'MED-PAN-500', expiryDate: '2026-12-01', quantity: 250 },
    { batchId: 'B-003', itemCode: 'MED-PAN-500', expiryDate: '2027-05-10', quantity: 500 },
    { batchId: 'B-004', itemCode: 'MED-PAN-500', expiryDate: '2026-01-01', quantity: 50, quarantined: true },
  ];

  const result = auditor.auditFEFOStockAccuracy(batches, '2026-08-30');

  assert.strictEqual(result.isFEFOValid, true);
  assert.strictEqual(result.sortedCorrectly, true);
  assert.strictEqual(result.totalBatchesChecked, 4);
  assert.strictEqual(result.quarantinedQuantity, 50);
  assert.strictEqual(result.activeAvailableQuantity, 850);
  assert.strictEqual(result.negativeStockDetected, false);
  assert.ok(result.details.includes('FEFO Stock Audit Passed'));
});

runTest('100% Test Suite Passage Assertion', () => {
  const auditor = new MasterReleaseAuditor();

  const testSuites: TestSuiteItem[] = [
    { suiteName: 'Phase 2: Database & Core Sync Engine', total: 45, passed: 45, failed: 0 },
    { suiteName: 'Phase 3: Clinical OPD & Pharmacy POS', total: 60, passed: 60, failed: 0 },
    { suiteName: 'Phase 4: Hardware & Packaging Suite', total: 35, passed: 35, failed: 0 },
    { suiteName: 'Phase 5: Master Release Certification', total: 10, passed: 10, failed: 0 },
  ];

  const result = auditor.auditTestSuitePassage(testSuites);

  assert.strictEqual(result.allPassed, true);
  assert.strictEqual(result.passRatePercentage, 100);
  assert.strictEqual(result.totalTests, 150);
  assert.strictEqual(result.passedTests, 150);
  assert.strictEqual(result.failedTests, 0);
  assert.strictEqual(result.suitesCount, 4);
  assert.ok(result.details.includes('100% Test Suite Passage Verified'));
});

runTest('Master Release Certification Aggregate Verification', () => {
  const auditor = new MasterReleaseAuditor();

  const syncRecords = [
    { id: 'SYNC_001', synced: true, checksum: 'abc', expectedChecksum: 'abc' },
  ];
  const vouchers: VoucherEntry[] = [
    { voucherId: 'V-1', debit: 5000, credit: 5000 },
  ];
  const batches: BatchItem[] = [
    { batchId: 'B-1', itemCode: 'MED-1', expiryDate: '2026-11-01', quantity: 20 },
  ];
  const testSuites: TestSuiteItem[] = [
    { suiteName: 'Master Verification', total: 5, passed: 5, failed: 0 },
  ];

  const report = auditor.certifyRelease(syncRecords, vouchers, batches, testSuites, '2026-08-30');

  assert.strictEqual(report.certified, true);
  assert.strictEqual(report.appVersion, 'v1.0.0-GOLD-RELEASE');
  assert.ok(report.summary.includes('MASTER CERTIFICATION PASSED'));
  assert.strictEqual(report.zeroDataLoss.isZeroDataLossVerified, true);
  assert.strictEqual(report.trialBalance.isEqual, true);
  assert.strictEqual(report.fefoStock.isFEFOValid, true);
  assert.strictEqual(report.testSuite.allPassed, true);
});

// ---------------------------------------------------------------------------
// SECTION 2: SYSTEM ADMINISTRATOR OPERATIONS MANUAL ASSERTIONS
// ---------------------------------------------------------------------------
console.log('\n📖 Section 2: System Administrator Operations Manual');

runTest('Local Installation Manual Section Assertion', () => {
  const guide = new AdminOperationsGuide();
  const section = guide.getLocalInstallationGuide();

  assert.strictEqual(section.sectionId, 'local_installation');
  assert.strictEqual(section.title, 'Local Server & Environment Installation Manual');
  assert.ok(section.steps.length >= 5);
  assert.ok(section.commandSnippets && section.commandSnippets.length > 0);
});

runTest('Desktop Windows Setup Section Assertion', () => {
  const guide = new AdminOperationsGuide();
  const section = guide.getDesktopSetupGuide();

  assert.strictEqual(section.sectionId, 'desktop_setup');
  assert.strictEqual(section.title, 'Desktop Windows Application & Thermal Printer Setup');
  assert.ok(section.steps.some((s) => s.includes('ClinicFlow_Setup.exe')));
  assert.ok(section.steps.some((s) => s.includes('80mm ESC/POS')));
  assert.ok(section.steps.some((s) => s.includes('clinicflow_offline.sqlite')));
});

runTest('Doctor Mobile Pairing Section Assertion', () => {
  const guide = new AdminOperationsGuide();
  const section = guide.getDoctorMobilePairingGuide();

  assert.strictEqual(section.sectionId, 'doctor_mobile_pairing');
  assert.strictEqual(section.title, 'Doctor Mobile App (Android/iOS) Pairing Procedure');
  assert.ok(section.steps.some((s) => s.includes('ClinicFlow_Doctor.apk')));
  assert.ok(section.steps.some((s) => s.includes('QR code')));
  assert.ok(section.steps.some((s) => s.includes('urgent_patient_alerts')));
});

runTest('Backup & Restore Procedures Section Assertion', () => {
  const guide = new AdminOperationsGuide();
  const section = guide.getBackupRestoreGuide();

  assert.strictEqual(section.sectionId, 'backup_restore');
  assert.strictEqual(section.title, 'Backup & Disaster Recovery Restore Manual');
  assert.ok(section.steps.some((s) => s.includes('mysqldump')));
  assert.ok(section.commandSnippets && section.commandSnippets.some((c) => c.includes('mysqldump')));
});

runTest('Complete Operations Manual Markdown Generation Assertion', () => {
  const guide = new AdminOperationsGuide();
  const manual = guide.generateFullManual();

  assert.ok(manual.includes('# ClinicFlow System Administrator Operations Manual'));
  assert.ok(manual.includes('Local Server & Environment Installation Manual'));
  assert.ok(manual.includes('Desktop Windows Application & Thermal Printer Setup'));
  assert.ok(manual.includes('Doctor Mobile App (Android/iOS) Pairing Procedure'));
  assert.ok(manual.includes('Backup & Disaster Recovery Restore Manual'));
  assert.ok(manual.includes('Handover Certified by ClinicFlow Master Release Auditor'));
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n--------------------------------------------------');
console.log(`✨ VERIFICATION COMPLETE: ${passedTests}/${totalTests} Tests Passed Cleanly`);
console.log('--------------------------------------------------');
