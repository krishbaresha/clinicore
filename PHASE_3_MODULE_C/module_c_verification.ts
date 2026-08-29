/**
 * Verification Test Suite for Phase 3 Module C:
 * Financial Accounting, Multi-Warehouse & Governance Engine
 */

import assert from 'node:assert';
import { JournalEngine } from './finance_governance_engine/src/accounting/journal_engine.ts';
import { GodownService } from './finance_governance_engine/src/warehouse/godown_service.ts';
import { ApprovalEngine } from './finance_governance_engine/src/governance/approval_engine.ts';

console.log('===============================================================');
console.log('Starting Phase 3 Module C Verification Suite');
console.log('===============================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(testName: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`[PASS] Test ${totalTests}: ${testName}`);
  } catch (err: any) {
    console.error(`[FAIL] Test ${totalTests}: ${testName}`);
    console.error(`       Error: ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// TEST GROUP 1: JOURNAL ENGINE (DOUBLE-ENTRY & REVERSALS & PERIOD LOCKS)
// ---------------------------------------------------------------------------

runTest('Journal Engine - Enforces Total Debit === Total Credit for balanced entry', () => {
  const journal = new JournalEngine();

  const entry = journal.createEntry({
    id: 'JE-001',
    entry_date: '2026-08-15',
    description: 'Wholesale Purchase Payment to BM Pvt LTD',
    lines: [
      { account_code: '1010', account_name: 'Cash in Hand', debit: 0, credit: 50000, memo: 'Payment' },
      { account_code: '5010', account_name: 'Inventory Expense', debit: 50000, credit: 0, memo: 'Medicine Inventory' },
    ],
  });

  assert.strictEqual(entry.id, 'JE-001');
  assert.strictEqual(entry.is_posted, true);

  const tb = journal.getTrialBalance();
  assert.strictEqual(tb.is_balanced, true);
  assert.strictEqual(tb.grand_total_debit, 50000);
  assert.strictEqual(tb.grand_total_credit, 50000);
  assert.strictEqual(tb.variance, 0);
});

runTest('Journal Engine - Rejects Unbalanced Entry (debit !== credit)', () => {
  const journal = new JournalEngine();

  assert.throws(
    () => {
      journal.createEntry({
        id: 'JE-UNBALANCED',
        entry_date: '2026-08-16',
        description: 'Unbalanced Purchase Entry',
        lines: [
          { account_code: '1010', account_name: 'Cash in Hand', debit: 0, credit: 40000 },
          { account_code: '5010', account_name: 'Inventory Expense', debit: 50000, credit: 0 },
        ],
      });
    },
    (err: Error) => {
      assert(err.message.includes('Unbalanced journal entry'));
      return true;
    }
  );
});

runTest('Journal Engine - Closed Period Guard blocks new entry creation', () => {
  const journal = new JournalEngine();
  journal.closePeriod('2026-07');

  assert.strictEqual(journal.isPeriodClosed('2026-07-20'), true);
  assert.strictEqual(journal.isPeriodClosed('2026-08-01'), false);

  assert.throws(
    () => {
      journal.createEntry({
        id: 'JE-CLOSED-01',
        entry_date: '2026-07-28',
        description: 'Late July Entry',
        lines: [
          { account_code: '1010', account_name: 'Cash', debit: 0, credit: 1000 },
          { account_code: '5010', account_name: 'Expense', debit: 1000, credit: 0 },
        ],
      });
    },
    (err: Error) => {
      assert(err.message.includes("closed period '2026-07'"));
      return true;
    }
  );
});

runTest('Journal Engine - Non-Destructive Compensating Reversal creation & Trial Balance Reconcilation', () => {
  const journal = new JournalEngine();

  // 1. Post original entry
  const original = journal.createEntry({
    id: 'JE-WRONG-01',
    entry_date: '2026-08-10',
    description: 'Wrong Cash Sale Posting',
    lines: [
      { account_code: '1010', account_name: 'Cash in Hand', debit: 12000, credit: 0 },
      { account_code: '4010', account_name: 'Sales Revenue', debit: 0, credit: 12000 },
    ],
  });

  assert.strictEqual(original.id, 'JE-WRONG-01');

  // 2. Post Reversal entry
  const reversal = journal.reverseEntry('JE-WRONG-01', 'JE-REV-01', '2026-08-11', 'Incorrect revenue entry correction');

  assert.strictEqual(reversal.entry_type, 'REVERSAL');
  assert.strictEqual(reversal.reference_id, 'JE-WRONG-01');
  assert.strictEqual(reversal.lines[0].debit, 0); // Original debit 12000 became credit 12000
  assert.strictEqual(reversal.lines[0].credit, 12000);
  assert.strictEqual(reversal.lines[1].debit, 12000); // Original credit 12000 became debit 12000
  assert.strictEqual(reversal.lines[1].credit, 0);

  // 3. Verify Trial Balance net zero balance for both accounts
  const tb = journal.getTrialBalance();
  assert.strictEqual(tb.is_balanced, true);
  assert.strictEqual(tb.grand_total_debit, 24000);
  assert.strictEqual(tb.grand_total_credit, 24000);

  const cashAcc = tb.items.find((i) => i.account_code === '1010');
  assert.strictEqual(cashAcc?.net_balance, 0); // 12000 debit - 12000 credit = 0 net

  const revAcc = tb.items.find((i) => i.account_code === '4010');
  assert.strictEqual(revAcc?.net_balance, 0);
});

// ---------------------------------------------------------------------------
// TEST GROUP 2: MULTI-WAREHOUSE & GODOWN SERVICE (RBAC & STOCK TRANSFERS)
// ---------------------------------------------------------------------------

runTest('Godown Service - Scopes stock levels between Primary Store and Secondary Godowns', () => {
  const godown = new GodownService();

  // Set stock in Primary Store
  godown.setStock('wh-main-01', 'MED-PARACETAMOL', 'Paracetamol 500mg', 'BATCH-2026A', 150);

  // Set stock in Secondary Godown
  godown.setStock('wh-godown-01', 'MED-PARACETAMOL', 'Paracetamol 500mg', 'BATCH-2026B', 500);

  assert.strictEqual(godown.getStock('wh-main-01', 'MED-PARACETAMOL', 'BATCH-2026A'), 150);
  assert.strictEqual(godown.getStock('wh-godown-01', 'MED-PARACETAMOL', 'BATCH-2026B'), 500);

  // Scoped stock checking
  assert.strictEqual(godown.getScopedStock('MED-PARACETAMOL', 'PRIMARY_STORE'), 150);
  assert.strictEqual(godown.getScopedStock('MED-PARACETAMOL', 'SECONDARY_GODOWN'), 500);
  assert.strictEqual(godown.getScopedStock('MED-PARACETAMOL'), 650); // Total across all godowns
});

runTest('Godown Service - Inter-Godown Stock Transfer Dispatcher Delta Math', () => {
  const godown = new GodownService();

  godown.setStock('wh-godown-01', 'MED-AUGMENTIN', 'Augmentin 625mg', 'BATCH-AUG-99', 200);
  godown.setStock('wh-main-01', 'MED-AUGMENTIN', 'Augmentin 625mg', 'BATCH-AUG-99', 50);

  // Transfer 75 units from Secondary Godown -> Main Store by STORE_MANAGER
  const transferResult = godown.dispatchStockTransfer({
    id: 'TRF-1001',
    from_warehouse_id: 'wh-godown-01',
    to_warehouse_id: 'wh-main-01',
    medicine_id: 'MED-AUGMENTIN',
    medicine_name: 'Augmentin 625mg',
    batch_number: 'BATCH-AUG-99',
    quantity: 75,
    initiated_by_user_id: 'usr-mgr-01',
    user_role: 'STORE_MANAGER',
  });

  assert.strictEqual(transferResult.status, 'COMPLETED');
  assert.strictEqual(transferResult.out_record.event_type, 'GODOWN_TRANSFER_OUT');
  assert.strictEqual(transferResult.out_record.previous_qty, 200);
  assert.strictEqual(transferResult.out_record.new_qty, 125); // 200 - 75 = 125

  assert.strictEqual(transferResult.in_record.event_type, 'GODOWN_TRANSFER_IN');
  assert.strictEqual(transferResult.in_record.previous_qty, 50);
  assert.strictEqual(transferResult.in_record.new_qty, 125); // 50 + 75 = 125

  // Verify stored balances after transfer
  assert.strictEqual(godown.getStock('wh-godown-01', 'MED-AUGMENTIN', 'BATCH-AUG-99'), 125);
  assert.strictEqual(godown.getStock('wh-main-01', 'MED-AUGMENTIN', 'BATCH-AUG-99'), 125);
});

runTest('Godown Service - Rejects transfer with insufficient stock', () => {
  const godown = new GodownService();
  godown.setStock('wh-godown-01', 'MED-PANADOL', 'Panadol', 'BATCH-P1', 20);

  assert.throws(
    () => {
      godown.dispatchStockTransfer({
        id: 'TRF-EXCEEDS',
        from_warehouse_id: 'wh-godown-01',
        to_warehouse_id: 'wh-main-01',
        medicine_id: 'MED-PANADOL',
        medicine_name: 'Panadol',
        batch_number: 'BATCH-P1',
        quantity: 50, // Requesting 50, only 20 available
        initiated_by_user_id: 'usr-mgr-01',
        user_role: 'ADMIN',
      });
    },
    (err: Error) => {
      assert(err.message.includes('Insufficient stock'));
      return true;
    }
  );
});

runTest('Godown Service - RBAC Location Validation blocks unauthorized role access', () => {
  const godown = new GodownService();

  // PHARMACIST cannot write directly to SECONDARY_GODOWN
  assert.strictEqual(godown.validateWarehouseAccess('PHARMACIST', 'wh-main-01', 'WRITE'), true);
  assert.strictEqual(godown.validateWarehouseAccess('PHARMACIST', 'wh-godown-01', 'WRITE'), false);

  // DISPENSER cannot perform write operations in secondary godown
  assert.strictEqual(godown.validateWarehouseAccess('DISPENSER', 'wh-godown-01', 'READ'), true);
  assert.strictEqual(godown.validateWarehouseAccess('DISPENSER', 'wh-godown-01', 'TRANSFER'), false);
});

// ---------------------------------------------------------------------------
// TEST GROUP 3: GOVERNANCE & DOCTOR APPROVAL ENGINE
// ---------------------------------------------------------------------------

runTest('Approval Engine - Evaluates policy thresholds (>15% discount, >10 write-off units)', () => {
  const engine = new ApprovalEngine();

  // 1. Discount 10% (within 15% limit -> auto approved)
  const eval1 = engine.evaluateThreshold({
    action_type: 'BILL_DISCOUNT',
    entity_id: 'BILL-001',
    discount_percentage: 10,
    requested_by_user_id: 'sales-01',
    reason: 'Regular customer',
  });
  assert.strictEqual(eval1.requires_governance, false);

  // 2. Discount 20% (> 15% limit -> requires governance)
  const eval2 = engine.evaluateThreshold({
    action_type: 'BILL_DISCOUNT',
    entity_id: 'BILL-002',
    discount_percentage: 20,
    requested_by_user_id: 'sales-01',
    reason: 'VIP Special Bulk Discount',
  });
  assert.strictEqual(eval2.requires_governance, true);
  assert(eval2.reason?.includes('Discount rate of 20% exceeds doctor approval threshold of 15%'));

  // 3. Stock write-off 5 units (within 10 units limit -> auto approved)
  const eval3 = engine.evaluateThreshold({
    action_type: 'STOCK_WRITE_OFF',
    entity_id: 'WO-001',
    write_off_units: 5,
    requested_by_user_id: 'pharmacy-01',
    reason: 'Damaged packaging',
  });
  assert.strictEqual(eval3.requires_governance, false);

  // 4. Stock write-off 25 units (> 10 units limit -> requires governance)
  const eval4 = engine.evaluateThreshold({
    action_type: 'STOCK_WRITE_OFF',
    entity_id: 'WO-002',
    write_off_units: 25,
    requested_by_user_id: 'pharmacy-01',
    reason: 'Expired batch disposal',
  });
  assert.strictEqual(eval4.requires_governance, true);
  assert(eval4.reason?.includes('exceeds maximum threshold of 10 units'));
});

runTest('Approval Engine - State Machine Transitions (PENDING -> APPROVED / REJECTED)', () => {
  const engine = new ApprovalEngine();

  // Submit high discount request
  const req = engine.submitRequest('REQ-DISC-01', {
    action_type: 'BILL_DISCOUNT',
    entity_id: 'BILL-100',
    discount_percentage: 25,
    requested_by_user_id: 'sales-02',
    reason: 'Wholesale B2B volume purchase discount request',
  });

  assert.strictEqual(req.status, 'PENDING');
  assert.strictEqual(req.requires_governance, true);

  // Doctor approves request
  const approvedReq = engine.approveRequest('REQ-DISC-01', 'dr-kashif-khan', 'Approved after reviewing margin');
  assert.strictEqual(approvedReq.status, 'APPROVED');
  assert.strictEqual(approvedReq.reviewed_by, 'dr-kashif-khan');

  // Submit write-off request & reject it
  const req2 = engine.submitRequest('REQ-WO-01', {
    action_type: 'STOCK_WRITE_OFF',
    entity_id: 'WO-500',
    write_off_units: 50,
    requested_by_user_id: 'store-01',
    reason: 'Discrepancy write off',
  });

  assert.strictEqual(req2.status, 'PENDING');
  const rejectedReq = engine.rejectRequest('REQ-WO-01', 'dr-kashif-khan', 'Physical recount required first');
  assert.strictEqual(rejectedReq.status, 'REJECTED');
});

runTest('Approval Engine - Idempotency & Duplicate Execution Lock Guard', () => {
  const engine = new ApprovalEngine();

  // 1. Submit and approve request
  engine.submitRequest('REQ-EXEC-01', {
    action_type: 'BILL_DISCOUNT',
    entity_id: 'BILL-999',
    discount_percentage: 18,
    requested_by_user_id: 'sales-01',
    reason: 'Special concession',
  });

  engine.approveRequest('REQ-EXEC-01', 'dr-kashif-khan');

  let executionCounter = 0;

  // 2. Execute action first time (should succeed)
  engine.executeApprovedAction('REQ-EXEC-01', (req) => {
    executionCounter++;
  });

  assert.strictEqual(executionCounter, 1);
  assert.strictEqual(engine.getRequest('REQ-EXEC-01')?.is_executed, true);

  // 3. Attempt duplicate execution (MUST fail due to duplicate lock)
  assert.throws(
    () => {
      engine.executeApprovedAction('REQ-EXEC-01', (req) => {
        executionCounter++;
      });
    },
    (err: Error) => {
      assert(err.message.includes('GOVERNANCE_DUPLICATE_LOCK'));
      return true;
    }
  );

  // Assert execution counter remained 1 (no duplicate execution occurred)
  assert.strictEqual(executionCounter, 1);
});

console.log('\n===============================================================');
console.log(`Phase 3 Module C Verification Summary: ${passedTests}/${totalTests} Passed`);
console.log('===============================================================\n');
