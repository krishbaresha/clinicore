/**
 * ClinicFlow Master Release Auditor
 * Production Readiness Auditor verifying:
 * 1. Zero Data Loss (Sync integrity & checksum match)
 * 2. Double-Entry Trial Balance Equality (Debit === Credit balance invariant)
 * 3. FEFO Stock Accuracy (Ascending expiry order & quarantine separation)
 * 4. 100% Test Suite Passage (Zero failing tests across all modules)
 */

export interface ZeroDataLossAuditResult {
  isZeroDataLossVerified: boolean;
  totalRecordsChecked: number;
  unsyncedRecordsCount: number;
  checksumMatch: boolean;
  details: string;
}

export interface TrialBalanceAuditResult {
  isEqual: boolean;
  totalDebit: number;
  totalCredit: number;
  variance: number;
  vouchersChecked: number;
  details: string;
}

export interface FEFOAuditResult {
  isFEFOValid: boolean;
  sortedCorrectly: boolean;
  totalBatchesChecked: number;
  expiredQuantity: number;
  quarantinedQuantity: number;
  activeAvailableQuantity: number;
  negativeStockDetected: boolean;
  details: string;
}

export interface TestSuiteAuditResult {
  allPassed: boolean;
  passRatePercentage: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  suitesCount: number;
  details: string;
}

export interface MasterCertificationReport {
  certified: boolean;
  appVersion: string;
  timestamp: string;
  zeroDataLoss: ZeroDataLossAuditResult;
  trialBalance: TrialBalanceAuditResult;
  fefoStock: FEFOAuditResult;
  testSuite: TestSuiteAuditResult;
  summary: string;
}

export interface VoucherEntry {
  voucherId: string;
  debit: number;
  credit: number;
  accountId?: string;
  description?: string;
}

export interface BatchItem {
  batchId: string;
  itemCode: string;
  expiryDate: string; // ISO format: YYYY-MM-DD
  quantity: number;
  quarantined?: boolean;
}

export interface TestSuiteItem {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
}

export class MasterReleaseAuditor {
  private appVersion: string = 'v1.0.0-GOLD-RELEASE';

  /**
   * Verifies Zero Data Loss across local cache, offline sync queue, and database records.
   */
  public auditZeroDataLoss(
    syncRecords: Array<{ id: string; synced: boolean; checksum?: string; expectedChecksum?: string }>
  ): ZeroDataLossAuditResult {
    const totalRecordsChecked = syncRecords.length;
    const unsynced = syncRecords.filter((r) => !r.synced);
    const unsyncedRecordsCount = unsynced.length;

    let checksumMatch = true;
    for (const record of syncRecords) {
      if (record.checksum && record.expectedChecksum && record.checksum !== record.expectedChecksum) {
        checksumMatch = false;
        break;
      }
    }

    const isZeroDataLossVerified = unsyncedRecordsCount === 0 && checksumMatch;

    return {
      isZeroDataLossVerified,
      totalRecordsChecked,
      unsyncedRecordsCount,
      checksumMatch,
      details: isZeroDataLossVerified
        ? `Zero Data Loss verified across ${totalRecordsChecked} records. 100% synced, checksums match.`
        : `Zero Data Loss audit failed: ${unsyncedRecordsCount} unsynced records, checksum match = ${checksumMatch}.`,
    };
  }

  /**
   * Verifies Double-Entry Accounting Trial Balance Equality (Total Debit === Total Credit).
   */
  public auditTrialBalanceEquality(vouchers: VoucherEntry[]): TrialBalanceAuditResult {
    const vouchersChecked = vouchers.length;
    let totalDebit = 0;
    let totalCredit = 0;

    for (const v of vouchers) {
      totalDebit += Number.isFinite(v.debit) ? Math.max(0, v.debit) : 0;
      totalCredit += Number.isFinite(v.credit) ? Math.max(0, v.credit) : 0;
    }

    // Rounding to 2 decimal places to avoid IEEE floating point inaccuracies
    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;
    const variance = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
    const isEqual = variance === 0;

    return {
      isEqual,
      totalDebit,
      totalCredit,
      variance,
      vouchersChecked,
      details: isEqual
        ? `Trial Balance EQUAL. Total Debit: Rs. ${totalDebit.toLocaleString()} | Total Credit: Rs. ${totalCredit.toLocaleString()} (Variance: 0.00).`
        : `Trial Balance MISMATCH! Total Debit: Rs. ${totalDebit.toLocaleString()} | Total Credit: Rs. ${totalCredit.toLocaleString()} (Variance: Rs. ${variance}).`,
    };
  }

  /**
   * Verifies FEFO (First-Expired, First-Out) Stock Accuracy and Quarantine Isolation.
   */
  public auditFEFOStockAccuracy(batches: BatchItem[], currentDate: string = '2026-08-30'): FEFOAuditResult {
    const totalBatchesChecked = batches.length;
    let expiredQuantity = 0;
    let quarantinedQuantity = 0;
    let activeAvailableQuantity = 0;
    let negativeStockDetected = false;

    // Check expiry order per item code
    const groupedByItem: Record<string, BatchItem[]> = {};
    for (const b of batches) {
      if (b.quantity < 0) {
        negativeStockDetected = true;
      }
      if (!groupedByItem[b.itemCode]) {
        groupedByItem[b.itemCode] = [];
      }
      groupedByItem[b.itemCode].push(b);
    }

    let sortedCorrectly = true;
    for (const itemCode of Object.keys(groupedByItem)) {
      const activeItemBatches = groupedByItem[itemCode].filter((b) => !b.quarantined);
      for (let i = 0; i < activeItemBatches.length - 1; i++) {
        if (new Date(activeItemBatches[i].expiryDate) > new Date(activeItemBatches[i + 1].expiryDate)) {
          sortedCorrectly = false;
          break;
        }
      }
    }

    const currentTs = new Date(currentDate).getTime();
    for (const b of batches) {
      const isExpired = new Date(b.expiryDate).getTime() < currentTs;
      if (b.quarantined) {
        quarantinedQuantity += Math.max(0, b.quantity);
      } else if (isExpired) {
        expiredQuantity += Math.max(0, b.quantity);
      } else {
        activeAvailableQuantity += Math.max(0, b.quantity);
      }
    }

    const isFEFOValid = sortedCorrectly && !negativeStockDetected;

    return {
      isFEFOValid,
      sortedCorrectly,
      totalBatchesChecked,
      expiredQuantity,
      quarantinedQuantity,
      activeAvailableQuantity,
      negativeStockDetected,
      details: isFEFOValid
        ? `FEFO Stock Audit Passed. ${totalBatchesChecked} batches verified. Expiry sorting: OK, Quarantined: ${quarantinedQuantity}, Active: ${activeAvailableQuantity}, Negative stock: NONE.`
        : `FEFO Stock Audit Failed. Expiry sorting OK: ${sortedCorrectly}, Negative stock: ${negativeStockDetected}.`,
    };
  }

  /**
   * Verifies 100% Test Suite Passage across all system verification modules.
   */
  public auditTestSuitePassage(suites: TestSuiteItem[]): TestSuiteAuditResult {
    const suitesCount = suites.length;
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const s of suites) {
      totalTests += s.total;
      passedTests += s.passed;
      failedTests += s.failed;
    }

    const passRatePercentage = totalTests > 0 ? Math.round((passedTests / totalTests) * 10000) / 100 : 100;
    const allPassed = failedTests === 0 && totalTests > 0;

    return {
      allPassed,
      passRatePercentage,
      totalTests,
      passedTests,
      failedTests,
      suitesCount,
      details: allPassed
        ? `100% Test Suite Passage Verified. ${passedTests}/${totalTests} tests passed across ${suitesCount} test suites (${passRatePercentage}%).`
        : `Test Suite Failure! ${failedTests}/${totalTests} tests failed across ${suitesCount} test suites (${passRatePercentage}% pass rate).`,
    };
  }

  /**
   * Conducts master release audit combining all 4 certification checks.
   */
  public certifyRelease(
    syncRecords: Array<{ id: string; synced: boolean; checksum?: string; expectedChecksum?: string }>,
    vouchers: VoucherEntry[],
    batches: BatchItem[],
    testSuites: TestSuiteItem[],
    currentDate: string = '2026-08-30'
  ): MasterCertificationReport {
    const zeroDataLoss = this.auditZeroDataLoss(syncRecords);
    const trialBalance = this.auditTrialBalanceEquality(vouchers);
    const fefoStock = this.auditFEFOStockAccuracy(batches, currentDate);
    const testSuite = this.auditTestSuitePassage(testSuites);

    const certified =
      zeroDataLoss.isZeroDataLossVerified &&
      trialBalance.isEqual &&
      fefoStock.isFEFOValid &&
      testSuite.allPassed;

    const timestamp = new Date().toISOString();
    const summary = certified
      ? `🏆 MASTER CERTIFICATION PASSED (${this.appVersion}). Production Readiness Certified with Zero Data Loss, Balanced Trial Balance, Strict FEFO Allocation, and 100% Test Passage.`
      : `⚠️ MASTER CERTIFICATION FAILED (${this.appVersion}). One or more release gates failed certification. Check audit sub-reports.`;

    return {
      certified,
      appVersion: this.appVersion,
      timestamp,
      zeroDataLoss,
      trialBalance,
      fefoStock,
      testSuite,
      summary,
    };
  }
}
