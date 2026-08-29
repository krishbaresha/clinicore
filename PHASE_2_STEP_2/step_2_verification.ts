import { AuthService } from './backend_scaffold/src/services/auth.service.ts';
import { AccountingService } from './backend_scaffold/src/services/accounting.service.ts';
import { InventoryService } from './backend_scaffold/src/services/inventory.service.ts';
import { SyncService } from './backend_scaffold/src/services/sync.service.ts';

async function runStep2Verification() {
  console.log('=== PHASE 2 STEP 2: BACKEND ARCHITECTURE & SERVICE SCAFFOLD VERIFICATION ===\n');

  // Test 1: Password Hashing & Verification
  console.log('--- TEST 1: AuthService Password Hashing & Verification ---');
  const plainPass = 'KB2026';
  const hashedPass = AuthService.hashPassword(plainPass);
  const isValidPass = AuthService.verifyPassword(plainPass, hashedPass);
  const isInvalidPass = AuthService.verifyPassword('WrongPass', hashedPass);

  console.log(`[PASS] Plain Password: ${plainPass}`);
  console.log(`[PASS] Hashed Password: ${hashedPass}`);
  console.log(`[PASS] Verification (Correct Password): ${isValidPass}`);
  console.log(`[PASS] Verification (Wrong Password): ${!isInvalidPass}`);
  if (!isValidPass || isInvalidPass) {
    throw new Error('AuthService password verification failed!');
  }

  // Test 2: Double-Entry Accounting Invariant
  console.log('\n--- TEST 2: AccountingService Double-Entry Invariants ---');
  const balancedLines = [
    { accountId: 'acc_cash', debit: 500.0, credit: 0 },
    { accountId: 'acc_sales', debit: 0, credit: 500.0 },
  ];
  const balancedResult = AccountingService.validateDoubleEntryBalance(balancedLines);
  console.log(`[PASS] Balanced Entry Result (Sum Debits == Sum Credits):`, balancedResult);

  const unbalancedLines = [
    { accountId: 'acc_cash', debit: 500.0, credit: 0 },
    { accountId: 'acc_sales', debit: 0, credit: 450.0 },
  ];
  const unbalancedResult = AccountingService.validateDoubleEntryBalance(unbalancedLines);
  console.log(`[PASS] Unbalanced Entry Result (Variance = 50):`, unbalancedResult);

  if (!balancedResult.isValid || unbalancedResult.isValid) {
    throw new Error('AccountingService double-entry validation failed!');
  }

  // Test 3: Inventory FEFO Batch Sorting & Stock Math
  console.log('\n--- TEST 3: InventoryService FEFO Sorting & Delta Math ---');
  const batches = [
    { id: 'b1', inventoryId: 'i1', batchNumber: 'B2026-02', expiryDate: '2026-12-31', quantityAvailable: 20, isQuarantined: false },
    { id: 'b2', inventoryId: 'i1', batchNumber: 'B2026-01', expiryDate: '2026-09-30', quantityAvailable: 15, isQuarantined: false },
    { id: 'b3', inventoryId: 'i1', batchNumber: 'B2026-EX', expiryDate: '2025-01-01', quantityAvailable: 50, isQuarantined: false }, // Expired
  ];
  const sortedFEFO = InventoryService.sortBatchesFEFO(batches);
  console.log('[PASS] Sorted FEFO Batches (Oldest Non-Expired First):', sortedFEFO);

  if (sortedFEFO.length !== 2 || sortedFEFO[0].batchNumber !== 'B2026-01') {
    throw new Error('InventoryService FEFO batch sorting failed!');
  }

  const newQty = InventoryService.calculateStockDelta(100, 'POS_SALE', 15);
  console.log(`[PASS] Stock Delta Math (100 - 15 = ${newQty}):`, newQty === 85);
  if (newQty !== 85) {
    throw new Error('InventoryService stock delta math failed!');
  }

  // Test 4: Sync Idempotency Caching
  console.log('\n--- TEST 4: SyncService Idempotency Cache Deduplication ---');
  const idempotencyMap = new Map();
  idempotencyMap.set('KEY-MUT-001', { response: { success: true, saleId: 'sale_123' }, status: 200 });

  const dupCheck1 = SyncService.isDuplicateMutation(idempotencyMap, 'KEY-MUT-001');
  const dupCheck2 = SyncService.isDuplicateMutation(idempotencyMap, 'KEY-MUT-NEW');

  console.log('[PASS] Duplicate Key Detection:', dupCheck1);
  console.log('[PASS] New Key Detection:', dupCheck2);

  if (!dupCheck1.isDuplicate || dupCheck2.isDuplicate) {
    throw new Error('SyncService idempotency deduplication failed!');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 2 STEP 2 SCAFFOLD VERIFICATION TESTS PASSED');
  console.log('======================================================');
}

runStep2Verification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
