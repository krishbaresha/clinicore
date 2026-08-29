/**
 * PHASE 3 MODULE D VERIFICATION SUITE
 * Comprehensive verification for Executive Reporting, CWE-1236 CSV Defense,
 * Telemetry PII Redaction, and Disaster Recovery / Backup Engine.
 */

import assert from 'node:assert';
import {
  getExecutiveFinancialSummary,
  getDayClosingSummary,
  getInventoryAnalytics,
  escapeCSV,
} from './reporting_telemetry_engine/src/reports/analytics_engine.ts';

import type {
  FinancialSaleRecord,
  FinancialExpenseRecord,
  DayClosingTransaction,
  InventoryItemRecord,
} from './reporting_telemetry_engine/src/reports/analytics_engine.ts';

import {
  TelemetryService,
  redactPII,
  redactPIIString,
} from './reporting_telemetry_engine/src/telemetry/telemetry_service.ts';

import {
  BackupEngine,
} from './reporting_telemetry_engine/src/backup/backup_engine.ts';

console.log('--------------------------------------------------');
console.log('🧪 RUNNING PHASE 3 MODULE D VERIFICATION SUITE');
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
// SECTION 1: EXECUTIVE REPORTING & CSV INJECTION DEFENSE (CWE-1236)
// ---------------------------------------------------------------------------
console.log('\n📊 Section 1: Executive Analytics & CSV Defense (CWE-1236)');

runTest('Executive Financial Summary & Profit/Loss Calculation', () => {
  const sales: FinancialSaleRecord[] = [
    { id: 'S1', grossAmount: 1000, discountAmount: 100, netAmount: 900, costOfGoodsSold: 500, category: 'opd', timestamp: '2026-08-30' },
    { id: 'S2', grossAmount: 2500, discountAmount: 200, netAmount: 2300, costOfGoodsSold: 1200, category: 'pharmacy_retail', timestamp: '2026-08-30' },
    { id: 'S3', grossAmount: 5000, discountAmount: 500, netAmount: 4500, costOfGoodsSold: 3000, category: 'pharmacy_wholesale', timestamp: '2026-08-30' },
  ];

  const expenses: FinancialExpenseRecord[] = [
    { id: 'E1', category: 'Utilities', amount: 800, description: 'Electricity Bill', timestamp: '2026-08-30' },
    { id: 'E2', category: 'Salaries', amount: 1200, description: 'Assistant Stipend', timestamp: '2026-08-30' },
  ];

  const summary = getExecutiveFinancialSummary(sales, expenses);

  assert.strictEqual(summary.grossRevenue, 8500);
  assert.strictEqual(summary.totalDiscounts, 800);
  assert.strictEqual(summary.netRevenue, 7700);
  assert.strictEqual(summary.costOfGoodsSold, 4700);
  assert.strictEqual(summary.grossProfit, 3000);
  assert.strictEqual(summary.totalExpenses, 2000);
  assert.strictEqual(summary.netProfit, 1000);
  assert.strictEqual(summary.opdRevenue, 900);
  assert.strictEqual(summary.pharmacyRetailRevenue, 2300);
  assert.strictEqual(summary.pharmacyWholesaleRevenue, 4500);
  assert.strictEqual(summary.netProfitMarginPercentage, 12.99); // (1000 / 7700) * 100 = 12.987 -> 12.99
});

runTest('Day Closing Summary Payment Mode Breakdown', () => {
  const transactions: DayClosingTransaction[] = [
    { id: 'T1', paymentMode: 'cash', module: 'opd', amount: 1500, timestamp: '2026-08-30' },
    { id: 'T2', paymentMode: 'card', module: 'pharmacy', amount: 2000, timestamp: '2026-08-30' },
    { id: 'T3', paymentMode: 'bank_transfer', module: 'pharmacy', amount: 3500, timestamp: '2026-08-30' },
    { id: 'T4', paymentMode: 'party_credit', module: 'pharmacy', amount: 5000, timestamp: '2026-08-30' },
  ];

  const summary = getDayClosingSummary(transactions);

  assert.strictEqual(summary.totalCollection, 12000);
  assert.strictEqual(summary.cashCollection, 1500);
  assert.strictEqual(summary.cardCollection, 2000);
  assert.strictEqual(summary.bankTransferCollection, 3500);
  assert.strictEqual(summary.partyCreditCollection, 5000);
  assert.strictEqual(summary.opdCollection, 1500);
  assert.strictEqual(summary.pharmacyCollection, 10500);
  assert.strictEqual(summary.transactionCount, 4);
});

runTest('Inventory Analytics, Stock Valuation & Low/Expiry Alerts', () => {
  const items: InventoryItemRecord[] = [
    { id: 'I1', name: 'Paracetamol 500mg', stockQty: 100, minStockLevel: 20, unitCost: 5, unitPrice: 10, expiryDate: '2027-12-31' },
    { id: 'I2', name: 'Amoxicillin Syrup', stockQty: 5, minStockLevel: 10, unitCost: 50, unitPrice: 80, expiryDate: '2026-09-05' }, // Low stock & near expiry
    { id: 'I3', name: 'Omeprazole 20mg', stockQty: 15, minStockLevel: 15, unitCost: 12, unitPrice: 20, expiryDate: '2026-09-15' }, // Low stock & near expiry
  ];

  const analytics = getInventoryAnalytics(items, 30);

  assert.strictEqual(analytics.totalItemTypes, 3);
  assert.strictEqual(analytics.totalUnitsInStock, 120);
  assert.strictEqual(analytics.totalValuationCost, 930); // (100*5 + 5*50 + 15*12) = 500 + 250 + 180 = 930
  assert.strictEqual(analytics.totalValuationRetail, 1700); // (100*10 + 5*80 + 15*20) = 1000 + 400 + 300 = 1700
  assert.strictEqual(analytics.potentialProfit, 770);
  assert.strictEqual(analytics.lowStockItemsCount, 2);
  assert.strictEqual(analytics.nearExpiryItemsCount, 2);
});

runTest('CWE-1236 CSV Formula Injection Escaping', () => {
  assert.strictEqual(escapeCSV('=1+1'), '"\'=1+1"');
  assert.strictEqual(escapeCSV('+cmd|\'/c calc\'!A1'), '"\'+cmd|\'/c calc\'!A1"');
  assert.strictEqual(escapeCSV('-SUM(A1:A10)'), '"\'-SUM(A1:A10)"');
  assert.strictEqual(escapeCSV('@SUM(1,2)'), '"\'@SUM(1,2)"');
  assert.strictEqual(escapeCSV('Dr. Kashif'), 'Dr. Kashif');
  assert.strictEqual(escapeCSV('Quoted "Text"'), '"Quoted ""Text"""');
  assert.strictEqual(escapeCSV('Field, with comma'), '"Field, with comma"');
});

// ---------------------------------------------------------------------------
// SECTION 2: TELEMETRY & PII REDACTION SERVICE
// ---------------------------------------------------------------------------
console.log('\n🔒 Section 2: Privacy-Safe Telemetry & PII Redaction');

runTest('CNIC Redaction in Strings & Payload Metadata', () => {
  const rawString = 'Patient CNIC is 41304-1234567-1 visiting clinic.';
  const redactedStr = redactPIIString(rawString);
  assert.strictEqual(redactedStr, 'Patient CNIC is 41304-*******-1 visiting clinic.');

  const payload = {
    patientName: 'Ali Ahmed',
    cnic: '41304-7654321-9',
    details: 'Verified CNIC 41304-7654321-9 successfully',
  };

  const redactedPayload = redactPII(payload);
  assert.strictEqual(redactedPayload.cnic, '41304-*******-9');
  assert.strictEqual(redactedPayload.details, 'Verified CNIC 41304-*******-9 successfully');
});

runTest('Phone Number Redaction in Strings & Objects', () => {
  const rawText = 'Contact doctor at 0300-1234567 or +923009876543 immediately.';
  const redactedStr = redactPIIString(rawText);

  assert.ok(!redactedStr.includes('0300-1234567'));
  assert.ok(!redactedStr.includes('+923009876543'));
  assert.ok(redactedStr.includes('0300-***4567'));
  assert.ok(redactedStr.includes('+923-***6543'));

  const obj = {
    phone: '0300-1234567',
    doctorPhone: '0333-7654321',
  };
  const redactedObj = redactPII(obj);
  assert.strictEqual(redactedObj.phone, '0300-***4567');
  assert.strictEqual(redactedObj.doctorPhone, '0333-***4321');
});

runTest('Passwords & Auth Tokens Redaction', () => {
  const credentialsPayload = {
    username: 'drkashif',
    password: 'SuperSecretPassword123!',
    authToken: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
    apiKey: 'sk-prod-9923842938492384',
  };

  const sanitized = redactPII(credentialsPayload);

  assert.strictEqual(sanitized.password, '[REDACTED]');
  assert.strictEqual(sanitized.authToken, '[REDACTED]');
  assert.strictEqual(sanitized.apiKey, '[REDACTED]');
  assert.strictEqual(sanitized.username, 'drkashif');
});

runTest('TelemetryService Audit Logging & Diagnostic Snapshot', () => {
  const telemetry = new TelemetryService();
  telemetry.info('AUTH', 'User drkashif logged in', { phone: '0300-1234567' });
  telemetry.error('DATABASE', 'Connection error with token Bearer secret123token', { password: 'myPassWord!' });

  const logs = telemetry.getLogs();
  assert.strictEqual(logs.length, 2);
  assert.strictEqual(logs[0].metadata?.phone, '0300-***4567');
  assert.strictEqual(logs[1].message, 'Connection error with token Bearer [REDACTED]');
  assert.strictEqual(logs[1].metadata?.password, '[REDACTED]');

  const snapshot = telemetry.getDiagnosticSnapshot();
  assert.strictEqual(snapshot.systemVersion, 'ClinicFlow-v3.4.0');
  assert.strictEqual(snapshot.totalLogsLogged, 2);
  assert.strictEqual(snapshot.recentLogs.length, 2);
});

// ---------------------------------------------------------------------------
// SECTION 3: DISASTER RECOVERY & TRIPLE-LAYER BACKUP ENGINE
// ---------------------------------------------------------------------------
console.log('\n💾 Section 3: Disaster Recovery & Encrypted Backup Engine (.cfbak)');

const SECRET_PASSPHRASE = 'ClinicFlowSecureMasterKey2026!';

const sampleDatabaseDump = {
  clinicName: 'Dr. Muhammad Kashif Khan Clinic',
  patients: [
    { id: 'P101', name: 'Tariq Mehmood', cnic: '41304-1111111-1' },
    { id: 'P102', name: 'Zahida Parveen', cnic: '41304-2222222-2' },
  ],
  financials: {
    totalSales: 150000,
    totalExpenses: 45000,
  },
};

runTest('Backup Package Creation & Structure (.cfbak)', () => {
  const packageJsonStr = BackupEngine.createBackupPackage(sampleDatabaseDump, SECRET_PASSPHRASE);
  const pkg = JSON.parse(packageJsonStr);

  assert.ok(pkg.header);
  assert.ok(pkg.ciphertext);
  assert.ok(pkg.iv);
  assert.ok(pkg.checksum);

  assert.strictEqual(pkg.header.version, 'v3.4.0');
  assert.strictEqual(pkg.header.schemaVersion, '2026.1');
  assert.ok(pkg.header.backupId.startsWith('CFBAK-'));
});

runTest('Backup Integrity Verification & Decryption', () => {
  const packageJsonStr = BackupEngine.createBackupPackage(sampleDatabaseDump, SECRET_PASSPHRASE);

  const verification = BackupEngine.verifyBackupPackage(packageJsonStr);
  assert.strictEqual(verification.isValid, true);
  assert.ok(verification.metadata);

  const restored = BackupEngine.restoreBackupPackage(packageJsonStr, SECRET_PASSPHRASE);
  assert.deepStrictEqual(restored.data, sampleDatabaseDump);
  assert.strictEqual(restored.metadata.backupId, verification.metadata.backupId);
});

runTest('Tampered Payload & Invalid Checksum Rejection', () => {
  const packageJsonStr = BackupEngine.createBackupPackage(sampleDatabaseDump, SECRET_PASSPHRASE);
  const parsed = JSON.parse(packageJsonStr);

  // Tamper with ciphertext
  parsed.ciphertext = parsed.ciphertext.substring(0, parsed.ciphertext.length - 4) + 'AAAA';
  const tamperedJsonStr = JSON.stringify(parsed);

  const verification = BackupEngine.verifyBackupPackage(tamperedJsonStr);
  assert.strictEqual(verification.isValid, false);
  assert.ok(verification.error?.includes('SHA-256 Checksum mismatch'));

  assert.throws(() => {
    BackupEngine.restoreBackupPackage(tamperedJsonStr, SECRET_PASSPHRASE);
  }, /Restoration Aborted/);
});

runTest('Incorrect Passphrase Rejection', () => {
  const packageJsonStr = BackupEngine.createBackupPackage(sampleDatabaseDump, SECRET_PASSPHRASE);

  assert.throws(() => {
    BackupEngine.restoreBackupPackage(packageJsonStr, 'WrongPassword123!');
  }, /Decryption failed/);
});

runTest('Pre-Restore Rollback Checkpoint & Recovery', () => {
  const initialSystemState = { activeQueue: ['P101', 'P102'], totalRevenueToday: 5000 };

  // Create rollback checkpoint
  const checkpoint = BackupEngine.createRollbackCheckpoint(initialSystemState);
  assert.ok(checkpoint.checkpointId.startsWith('CHKPT-'));
  assert.ok(checkpoint.checksum);

  // Simulate state mutation during failed restore attempt
  let currentSystemState: any = { activeQueue: [], totalRevenueToday: 0 };

  // Revert state using rollback checkpoint
  currentSystemState = BackupEngine.restoreFromCheckpoint(checkpoint);
  assert.deepStrictEqual(currentSystemState, initialSystemState);
});

// ---------------------------------------------------------------------------
// SUMMARY & VERIFICATION RESULTS
// ---------------------------------------------------------------------------
console.log('\n--------------------------------------------------');
console.log(`🎉 ALL ${passedTests}/${totalTests} VERIFICATION TESTS PASSED CLEANLY!`);
console.log('--------------------------------------------------');
