import assert from 'node:assert';
import { CanonicalServer, LocalClientNode } from '../simulator.ts';

export async function runMultiClientSyncTest(): Promise<void> {
  console.log('--- STARTING SCENARIO 1: Multi-Device Concurrency & Auto-Sync ---');

  const server = new CanonicalServer();
  const desktopA = new LocalClientNode('DESKTOP-A-OPD-RECEPTION');
  const desktopB = new LocalClientNode('DESKTOP-B-PHARMACY-STORE');

  // Step 1: Desktop A creates a new Patient Record locally
  console.log('1. Desktop A creates Patient Record [PT-2026-9001] locally...');
  const patientData = {
    name: 'Muhammad Tariq Khan',
    phone: '03001234567',
    city: 'Hyderabad',
    age: 42,
    gender: 'M'
  };
  desktopA.createOrUpdateRecord('PATIENT', 'PT-2026-9001', patientData, 'CREATE');

  assert.strictEqual(desktopA.localEntities.size, 1);
  assert.strictEqual(desktopB.localEntities.size, 0, 'Desktop B should not have record prior to sync');

  // Step 2: Desktop A flushes outbox to Canonical Server
  console.log('2. Desktop A pushes record to Canonical Server...');
  const flushRes = desktopA.flushOutbox(server);
  assert.strictEqual(flushRes.flushedCount, 1);
  assert.strictEqual(server.currentCursor, 1, 'Canonical Server cursor should increment to 1');
  assert.strictEqual(server.entities.size, 1, 'Server central DB should hold 1 entity');

  // Step 3: Desktop B performs Auto-Sync (Delta Pull)
  console.log('3. Desktop B triggers auto-sync (pulls changes since cursor 0)...');
  const syncResB = desktopB.syncWithServer(server);
  assert.strictEqual(syncResB.pulledCount, 1);
  assert.strictEqual(desktopB.lastSyncedCursor, 1);
  assert.strictEqual(desktopB.localEntities.size, 1, 'Desktop B should now possess the synced patient record');

  const syncedPatientB = desktopB.localEntities.get('PT-2026-9001');
  assert.strictEqual(syncedPatientB?.name, 'Muhammad Tariq Khan');
  assert.strictEqual(syncedPatientB?.phone, '03001234567');
  console.log('✓ Desktop A -> Canonical Server -> Desktop B multi-device propagation verified.');

  // Step 4: Test Concurrent Mutations (Desktop A updates phone, Desktop B updates address)
  console.log('4. Testing concurrent edits: Desktop A updates phone, Desktop B updates city...');
  desktopA.createOrUpdateRecord('PATIENT', 'PT-2026-9001', { phone: '03339998877' }, 'UPDATE');
  desktopB.createOrUpdateRecord('PATIENT', 'PT-2026-9001', { city: 'Latifabad, Hyderabad' }, 'UPDATE');

  // Desktop A syncs first
  desktopA.syncWithServer(server);
  assert.strictEqual(server.currentCursor, 2);

  // Desktop B syncs next
  desktopB.syncWithServer(server);
  assert.strictEqual(server.currentCursor, 3);

  // Both clients pull latest state to achieve convergence
  desktopA.syncWithServer(server);
  desktopB.syncWithServer(server);

  const finalA = desktopA.localEntities.get('PT-2026-9001');
  const finalB = desktopB.localEntities.get('PT-2026-9001');

  assert.strictEqual(finalA?.phone, '03339998877');
  assert.strictEqual(finalA?.city, 'Latifabad, Hyderabad');
  assert.deepStrictEqual(finalA, finalB, 'Desktop A and Desktop B states MUST be 100% identical after convergence');

  console.log('✓ Concurrent multi-device state convergence verified successfully.\n');
}
