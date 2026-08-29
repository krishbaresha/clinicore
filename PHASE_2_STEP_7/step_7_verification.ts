import { runMultiClientSyncTest } from './e2e_suite/src/tests/multi_client_sync.test.ts';
import { runOfflineRecoveryTest } from './e2e_suite/src/tests/offline_recovery.test.ts';
import { runDisasterRecoveryTest } from './e2e_suite/src/tests/disaster_recovery.test.ts';

async function main() {
  console.log('================================================================');
  console.log('  CLINICFLOW PHASE 2 STEP 7: E2E CONCURRENCY & RECOVERY SUITE  ');
  console.log('================================================================\n');

  try {
    const startTime = Date.now();

    // 1. Scenario 1: Multi-Device Concurrency & Auto-Sync
    await runMultiClientSyncTest();

    // 2. Scenario 2: Offline Outbox Reconnection & Idempotency Deduplication
    await runOfflineRecoveryTest();

    // 3. Scenario 3: Disaster Recovery & Full Cache Loss Re-Hydration
    await runDisasterRecoveryTest();

    const duration = Date.now() - startTime;

    console.log('================================================================');
    console.log(`🎉 ALL 3 E2E TEST SCENARIOS PASSED CLEANLY IN ${duration}ms!`);
    console.log('================================================================');
  } catch (err) {
    console.error('❌ E2E VERIFICATION SUITE FAILED:', err);
    process.exit(1);
  }
}

main();
