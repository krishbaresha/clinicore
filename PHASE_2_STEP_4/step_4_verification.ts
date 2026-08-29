import { SqliteOutboxEngine } from './desktop_scaffold/src/db/sqlite_outbox.ts';
import { TauriAppShell } from './desktop_scaffold/src/tauri/app_shell.ts';
import fs from 'node:fs';
import path from 'node:path';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runStep4Verification() {
  console.log('===============================================================');
  console.log('🧪 Starting Phase 2 Step 4 Automated Verification Suite');
  console.log('===============================================================\n');

  const testDbPath = path.resolve('./test_step4_outbox.db');

  // Clean up any stale test database files before starting
  const cleanupFiles = () => {
    try { if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath); } catch {}
    try { if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`); } catch {}
    try { if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`); } catch {}
  };

  cleanupFiles();

  let passedTests = 0;
  let totalTests = 0;

  try {
    // ------------------------------------------------------------------------
    // TEST 1: SQLite WAL Mode Initialization & Schema Integrity
    // ------------------------------------------------------------------------
    totalTests++;
    console.log('🔹 [Test 1] SQLite WAL Mode Initialization & Schema Integrity');
    const engine = new SqliteOutboxEngine(testDbPath);
    engine.initialize();

    const journalMode = engine.getJournalMode();
    console.log(`   - Verified Journal Mode: PRAGMA journal_mode = '${journalMode}'`);
    assert(journalMode.toLowerCase() === 'wal', `Expected WAL mode, got '${journalMode}'`);

    const initialPendingCount = engine.countByStatus('PENDING');
    assert(initialPendingCount === 0, `Expected 0 pending mutations initially, got ${initialPendingCount}`);
    console.log('   ✅ Test 1 PASSED: SQLite initialized cleanly in WAL mode.');
    passedTests++;

    // ------------------------------------------------------------------------
    // TEST 2: Outbox Insertion & Idempotency Key Preservation
    // ------------------------------------------------------------------------
    totalTests++;
    console.log('\n🔹 [Test 2] Outbox Insertion & Idempotency Key Deduplication');
    const mut1 = engine.enqueueMutation({
      idempotency_key: 'idem_pat_001',
      entity_type: 'PATIENT',
      payload: { mr_number: 'MR-00101', name: 'Muhammad Ali', phone: '03001234567' },
    });

    console.log(`   - Enqueued Mutation 1 (id: ${mut1.mutation_id}, key: ${mut1.idempotency_key})`);
    assert(mut1.status === 'PENDING', `Expected status PENDING, got ${mut1.status}`);

    const mut2 = engine.enqueueMutation({
      idempotency_key: 'idem_pos_101',
      entity_type: 'POS_SALE',
      payload: { invoice_id: 'INV-2026-88', total: 1500, items_count: 3 },
    });

    console.log(`   - Enqueued Mutation 2 (id: ${mut2.mutation_id}, key: ${mut2.idempotency_key})`);
    assert(engine.countByStatus('PENDING') === 2, `Expected 2 pending mutations, got ${engine.countByStatus('PENDING')}`);

    // Re-enqueue mutation with same idempotency key
    const mut1Duplicate = engine.enqueueMutation({
      idempotency_key: 'idem_pat_001',
      entity_type: 'PATIENT',
      payload: { mr_number: 'MR-00101', name: 'Muhammad Ali', phone: '03001234567' },
    });

    console.log(`   - Deduplicated Re-enqueue attempt (returned id: ${mut1Duplicate.mutation_id})`);
    assert(mut1Duplicate.mutation_id === mut1.mutation_id, 'Idempotency deduplication failed: returned different mutation_id');
    assert(engine.countByStatus('PENDING') === 2, 'Total pending count increased on duplicate idempotency key!');
    console.log('   ✅ Test 2 PASSED: Outbox insertion & idempotency key deduplication verified.');
    passedTests++;

    // ------------------------------------------------------------------------
    // TEST 3: Outbox Status Transitions (PENDING -> SYNCING -> SYNCED)
    // ------------------------------------------------------------------------
    totalTests++;
    console.log('\n🔹 [Test 3] Outbox Status Transitions & Pending Queries');
    
    // Transition mut1 to SYNCING
    const syncingMut1 = engine.updateStatus(mut1.mutation_id, 'SYNCING');
    assert(syncingMut1?.status === 'SYNCING', `Expected status SYNCING, got ${syncingMut1?.status}`);

    // Mark mut1 as SYNCED
    const syncedMut1 = engine.markSynced(mut1.mutation_id);
    assert(syncedMut1?.status === 'SYNCED', `Expected status SYNCED, got ${syncedMut1?.status}`);

    const remainingPending = engine.getPendingMutations();
    console.log(`   - Remaining Pending/Syncing mutations count: ${remainingPending.length}`);
    assert(remainingPending.length === 1, `Expected 1 pending mutation remaining, got ${remainingPending.length}`);
    assert(remainingPending[0].mutation_id === mut2.mutation_id, 'Remaining mutation is not mut2');
    
    console.log('   ✅ Test 3 PASSED: Outbox status transitions verified.');
    passedTests++;

    // ------------------------------------------------------------------------
    // TEST 4: Offline Queue Persistence Across Simulated App Restart
    // ------------------------------------------------------------------------
    totalTests++;
    console.log('\n🔹 [Test 4] Offline Queue Persistence Across Simulated App Restart');
    console.log('   - Simulating desktop app shutdown & SQLite close...');
    engine.close();

    console.log('   - Re-opening SQLite WAL database from disk after restart...');
    const reinitializedEngine = new SqliteOutboxEngine(testDbPath);
    reinitializedEngine.initialize();

    assert(reinitializedEngine.getJournalMode().toLowerCase() === 'wal', 'Journal mode lost after restart!');
    assert(reinitializedEngine.countByStatus() === 2, `Expected total 2 records in DB, got ${reinitializedEngine.countByStatus()}`);
    assert(reinitializedEngine.countByStatus('SYNCED') === 1, `Expected 1 SYNCED record, got ${reinitializedEngine.countByStatus('SYNCED')}`);
    assert(reinitializedEngine.countByStatus('PENDING') === 1, `Expected 1 PENDING record, got ${reinitializedEngine.countByStatus('PENDING')}`);

    const restoredMut2 = reinitializedEngine.getMutationByIdempotencyKey('idem_pos_101');
    assert(restoredMut2 !== null, 'Restored mutation 2 is null');
    assert(restoredMut2?.payload.invoice_id === 'INV-2026-88', `Payload corrupted after restart: ${JSON.stringify(restoredMut2?.payload)}`);

    console.log('   - Payload & state survived simulated application restart with 100% fidelity.');
    reinitializedEngine.close();
    console.log('   ✅ Test 4 PASSED: Offline queue persistence verified.');
    passedTests++;

    // ------------------------------------------------------------------------
    // TEST 5: Tauri Desktop Shell IPC Bridge Invocation & Event Emitter
    // ------------------------------------------------------------------------
    totalTests++;
    console.log('\n🔹 [Test 5] Tauri Desktop Shell IPC Bridge Invocation & Events');
    const shell = new TauriAppShell(testDbPath);

    let dbInitEventFired = false;
    let outboxEnqueuedEventFired = false;

    shell.listen('db_initialized', (data) => {
      dbInitEventFired = true;
      console.log(`   - Received Tauri Shell Event 'db_initialized': ${JSON.stringify(data)}`);
    });

    shell.listen('outbox_enqueued', (data) => {
      outboxEnqueuedEventFired = true;
      console.log(`   - Received Tauri Shell Event 'outbox_enqueued': ${data.idempotency_key}`);
    });

    // Invoke init_offline_db via Tauri IPC
    const initRes = await shell.invoke<{ success: boolean; journal_mode: string }>('init_offline_db', {
      dbPath: testDbPath,
    });

    assert(initRes.success === true, 'init_offline_db IPC failed');
    assert(initRes.journal_mode.toLowerCase() === 'wal', `IPC journal mode mismatch: ${initRes.journal_mode}`);
    assert(dbInitEventFired === true, 'db_initialized event did not fire!');

    // Invoke enqueue_outbox_mutation via Tauri IPC
    const ipcEnqueued = await shell.invoke<any>('enqueue_outbox_mutation', {
      idempotency_key: 'idem_opd_303',
      entity_type: 'OPD_VISIT',
      payload: { visit_id: 'VIS-991', fee: 1000, doctor: 'Dr. Kashif Khan' },
    });

    assert(ipcEnqueued.mutation_id !== undefined, 'enqueue_outbox_mutation IPC failed');
    assert(outboxEnqueuedEventFired === true, 'outbox_enqueued event did not fire!');

    // Invoke get_outbox_pending via Tauri IPC
    const pendingList = await shell.invoke<any[]>('get_outbox_pending', { limit: 10 });
    console.log(`   - IPC pending count returned: ${pendingList.length}`);
    assert(pendingList.length >= 2, `Expected at least 2 pending items, got ${pendingList.length}`);

    console.log('   ✅ Test 5 PASSED: Tauri Desktop IPC bridge commands & event bus verified.');
    passedTests++;

    // ------------------------------------------------------------------------
    // TEST 6: Thermal Printer Hardware Interface Hooks (80mm ESC/POS)
    // ------------------------------------------------------------------------
    totalTests++;
    console.log('\n🔹 [Test 6] Thermal Printer Hardware Interface Hooks');
    let printCompletedEventFired = false;

    shell.listen('hardware_print_completed', (data) => {
      printCompletedEventFired = true;
      console.log(`   - Received Tauri Shell Event 'hardware_print_completed': Job ID ${data.print_job_id}`);
    });

    const printResult = await shell.invoke<any>('print_thermal_receipt', {
      receipt_type: 'OPD_TOKEN',
      patient_name: 'Zainab Bibi',
      doctor_name: 'Dr. Muhammad Kashif Khan',
      token_number: '05',
      items: [{ name: 'OPD Consultation Fee', qty: 1, price: 1000, total: 1000 }],
      total_amount: 1000,
    });

    assert(printResult.success === true, 'Thermal print job failed');
    assert(printResult.paper_width === '80mm', `Expected 80mm paper width, got ${printResult.paper_width}`);
    assert(printResult.status === 'PRINTED', `Expected PRINTED status, got ${printResult.status}`);
    assert(printResult.escpos_bytes > 100, `ESC/POS byte output too small: ${printResult.escpos_bytes}`);
    assert(printCompletedEventFired === true, 'hardware_print_completed event did not fire');

    console.log(`   - ESC/POS Print Job Output: Width=${printResult.paper_width}, Lines=${printResult.line_count}, Bytes=${printResult.escpos_bytes}`);

    // Test Hardware Status IPC Command
    const hwStatus = await shell.invoke<any>('get_hardware_status');
    assert(hwStatus.printer.status === 'ONLINE', `Expected printer ONLINE, got ${hwStatus.printer.status}`);
    assert(hwStatus.offline_db.status === 'ONLINE', `Expected offline_db ONLINE, got ${hwStatus.offline_db.status}`);
    assert(hwStatus.offline_db.journal_mode.toLowerCase() === 'wal', `Expected WAL mode in status, got ${hwStatus.offline_db.journal_mode}`);

    console.log(`   - Hardware Status: Printer=${hwStatus.printer.model} (${hwStatus.printer.status}), DB=${hwStatus.offline_db.status} [${hwStatus.offline_db.journal_mode}]`);

    shell.close();
    console.log('   ✅ Test 6 PASSED: Thermal printer hardware interface hooks verified.');
    passedTests++;

  } finally {
    cleanupFiles();
  }

  console.log('\n===============================================================');
  console.log(`🎉 VERIFICATION COMPLETE: ${passedTests}/${totalTests} Test Suites PASSED (100%)`);
  console.log('===============================================================\n');
}

runStep4Verification().catch((err) => {
  console.error('💥 STEP 4 VERIFICATION FAILED:', err);
  process.exit(1);
});
