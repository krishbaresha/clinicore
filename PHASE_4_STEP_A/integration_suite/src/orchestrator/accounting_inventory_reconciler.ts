/**
 * PHASE 4 STEP A: Accounting & Inventory Reconciler Engine
 * Verifies that total stock cost valuation matches general ledger inventory valuation account,
 * and total POS cash matches cashbook drawer balance.
 */

import { JournalEngine } from '../../../../PHASE_3_MODULE_C/finance_governance_engine/src/accounting/journal_engine.ts';
import { FEFOBatchAllocator, type BatchRecord } from '../../../../PHASE_3_MODULE_B/pharmacy_wholesale_engine/src/fefo/batch_allocator.ts';

export interface ReconciliationReport {
  timestamp: string;
  isInventoryBalanced: boolean;
  inventoryValuationStock: number;
  inventoryValuationGL: number;
  inventoryVariance: number;
  isCashDrawerBalanced: boolean;
  posCashCollected: number;
  cashbookDrawerBalance: number;
  cashVariance: number;
  auditPassed: boolean;
  discrepancies: string[];
}

export class AccountingInventoryReconciler {
  private journalEngine: JournalEngine;
  private batchAllocator: FEFOBatchAllocator;

  constructor(journalEngine: JournalEngine, batchAllocator: FEFOBatchAllocator) {
    this.journalEngine = journalEngine;
    this.batchAllocator = batchAllocator;
  }

  /**
   * Reconciles inventory stock valuation against GL Account 1300 (Inventory Assets)
   * and POS Cash Collections against GL Account 1010 (Cash in Hand / Drawer).
   */
  public reconcile(posCashCollected: number, batches: BatchRecord[]): ReconciliationReport {
    const timestamp = new Date().toISOString();
    const discrepancies: string[] = [];

    // 1. Calculate Stock Valuation from batches (sum of quantity * tradePrice)
    const inventoryValuationStock = batches.reduce((total, batch) => {
      return total + (batch.quantity * batch.tradePrice);
    }, 0);

    // 2. Get GL Inventory Account 1300 balance
    // Debit balance in 1300 = Inventory Assets
    const inventoryValuationGL = this.journalEngine.getAccountBalance('1300');
    const inventoryVariance = Math.abs(inventoryValuationStock - inventoryValuationGL);
    const isInventoryBalanced = inventoryVariance < 0.01;

    if (!isInventoryBalanced) {
      discrepancies.push(
        `Inventory Valuation Mismatch: Stock Valuation Rs. ${inventoryValuationStock.toFixed(2)} vs GL Account 1300 Rs. ${inventoryValuationGL.toFixed(2)} (Variance: Rs. ${inventoryVariance.toFixed(2)})`
      );
    }

    // 3. Reconcile Cash Drawer Balance GL Account 1010 vs total POS cash collected
    const cashbookDrawerBalance = this.journalEngine.getAccountBalance('1010');
    const cashVariance = Math.abs(posCashCollected - cashbookDrawerBalance);
    const isCashDrawerBalanced = cashVariance < 0.01;

    if (!isCashDrawerBalanced) {
      discrepancies.push(
        `Cash Drawer Mismatch: POS Cash Collected Rs. ${posCashCollected.toFixed(2)} vs Cashbook Drawer Balance GL Account 1010 Rs. ${cashbookDrawerBalance.toFixed(2)} (Variance: Rs. ${cashVariance.toFixed(2)})`
      );
    }

    const auditPassed = isInventoryBalanced && isCashDrawerBalanced;

    return {
      timestamp,
      isInventoryBalanced,
      inventoryValuationStock,
      inventoryValuationGL,
      inventoryVariance,
      isCashDrawerBalanced,
      posCashCollected,
      cashbookDrawerBalance,
      cashVariance,
      auditPassed,
      discrepancies,
    };
  }
}
