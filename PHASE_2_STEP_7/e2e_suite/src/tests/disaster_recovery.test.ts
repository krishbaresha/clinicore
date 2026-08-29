import assert from 'node:assert';
import { CanonicalServer, LocalClientNode } from '../simulator.ts';

export async function runDisasterRecoveryTest(): Promise<void> {
  console.log('--- STARTING SCENARIO 3: Disaster Recovery & Full Cache Loss Re-Hydration ---');

  const server = new CanonicalServer();
  const seedClient = new LocalClientNode('SEED-DATA-GENERATOR');

  // Step 1: Seed 50 historical records on Canonical Server across Patients, Consultations, and Invoices
  console.log('1. Seeding 50 historical change sequence records onto Canonical Server...');
  for (let i = 1; i <= 20; i++) {
    seedClient.createOrUpdateRecord(
      'PATIENT',
      `PT-REHYD-${1000 + i}`,
      {
        name: `Patient Name ${i}`,
        age: 20 + i,
        phone: `0300999${1000 + i}`,
        city: i % 2 === 0 ? 'Hyderabad' : 'Interior Sindh'
      },
      'CREATE'
    );
  }

  for (let i = 1; i <= 15; i++) {
    seedClient.createOrUpdateRecord(
      'OPD_CONSULTATION',
      `OPD-REHYD-${2000 + i}`,
      {
        patientId: `PT-REHYD-${1000 + i}`,
        doctor: 'Dr. Muhammad Kashif Khan',
        fee: 1500,
        diagnosis: 'ENT / Routine Checkup'
      },
      'CREATE'
    );
  }

  for (let i = 1; i <= 15; i++) {
    seedClient.createOrUpdateRecord(
      'STOCK_INVOICE',
      `INV-REHYD-${3000 + i}`,
      {
        partyCode: `PTY-${i}`,
        brandCompany: 'BM Pvt LTD',
        totalAmount: 25000 + i * 500
      },
      'CREATE'
    );
  }

  seedClient.flushOutbox(server);

  assert.strictEqual(server.currentCursor, 50, 'Canonical Server cursor should reach 50');
  assert.strictEqual(server.entities.size, 50, 'Canonical Server entity count should be 50');
  console.log('✓ Canonical Server seeded with 50 sequential change records.');

  // Step 2: Initialize Desktop C client and sync state
  console.log('2. Desktop C connects and syncs initial state...');
  const desktopC = new LocalClientNode('DESKTOP-C-DISASTER-RECOVERY-NODE');
  desktopC.syncWithServer(server);

  assert.strictEqual(desktopC.localEntities.size, 50);
  assert.strictEqual(desktopC.lastSyncedCursor, 50);

  // Step 3: Simulate Total Disaster / Disk Corruption / Local DB Cache Loss
  console.log('3. SIMULATING HARD DRIVE CORRUPTION & TOTAL CACHE LOSS on Desktop C...');
  desktopC.wipeLocalStorage();

  assert.strictEqual(desktopC.localEntities.size, 0, 'Local entities must be wiped (0 records)');
  assert.strictEqual(desktopC.outbox.length, 0, 'Outbox must be wiped');
  assert.strictEqual(desktopC.lastSyncedCursor, 0, 'Synced cursor reset to 0');
  console.log('⚠️ Desktop C local database wiped completely (0 entities in storage).');

  // Step 4: Execute Full Disaster Recovery Re-Hydration Pipeline
  console.log('4. Initiating Full State Re-Hydration pipeline from Canonical Server (cursor 0 -> 50)...');
  const rehydRes = desktopC.rehydrateFromCanonical(server);

  assert.strictEqual(rehydRes.rehydratedCount, 50, '50 records should be rehydrated from canonical log');
  assert.strictEqual(desktopC.lastSyncedCursor, 50, 'Desktop C cursor restored to 50');
  assert.strictEqual(desktopC.localEntities.size, 50, 'Desktop C local entities restored to 50');

  // Step 5: Verify 100% Data Parity between Desktop C local state and Canonical Server central DB
  console.log('5. Auditing 100% data parity between Desktop C local state and Canonical Server state...');
  for (const [entityId, serverData] of server.entities.entries()) {
    const clientData = desktopC.localEntities.get(entityId);
    assert.ok(clientData, `Desktop C must possess entity ${entityId}`);
    assert.strictEqual(clientData.id, serverData.id);
    for (const key of Object.keys(serverData)) {
      if (key === '_updatedAtSequence') continue;
      assert.strictEqual(
        clientData[key],
        serverData[key],
        `Field '${key}' on entity ${entityId} must match canonical server value`
      );
    }
  }

  console.log('✓ Total cache loss recovery & 100% data parity re-hydration verified successfully.\n');
}
