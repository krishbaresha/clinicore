import assert from 'node:assert';
import { CanonicalServer, LocalClientNode } from '../simulator.ts';

export async function runOfflineRecoveryTest(): Promise<void> {
  console.log('--- STARTING SCENARIO 2: Offline Outbox Reconnection & Idempotency Deduplication ---');

  const server = new CanonicalServer();
  const desktop = new LocalClientNode('DESKTOP-MOBILE-CLINIC-01');

  // Step 1: Disconnect client network connection
  console.log('1. Simulating network link failure (isOnline = false)...');
  desktop.isOnline = false;

  // Step 2: Enqueue 5 offline invoice mutations into local outbox
  console.log('2. Enqueuing 5 offline wholesale invoice transactions into local WAL outbox...');
  const sharedIdempotencyKeys: string[] = [];

  for (let i = 1; i <= 5; i++) {
    const invId = `INV-2026-OFF-${100 + i}`;
    const key = `IDEM-KEY-OFFLINE-INVOICE-${100 + i}`;
    sharedIdempotencyKeys.push(key);

    desktop.createOrUpdateRecord(
      'STOCK_INVOICE',
      invId,
      {
        partyCode: 'PTY-108',
        partyName: 'Sindh Medical Distributors',
        city: 'Interior Sindh',
        totalAmount: 15000 * i,
        paymentMode: 'Party Udhaar (Credit)'
      },
      'CREATE',
      key
    );
  }

  assert.strictEqual(desktop.outbox.length, 5);
  assert.strictEqual(desktop.outbox.filter(item => item.status === 'PENDING').length, 5);

  // Attempting to flush while offline should yield 0 flushed records
  const offlineFlush = desktop.flushOutbox(server);
  assert.strictEqual(offlineFlush.flushedCount, 0, 'No outbox items should flush while offline');
  assert.strictEqual(server.currentCursor, 0, 'Server cursor should remain at 0');
  console.log('✓ Offline outbox transaction queuing confirmed (5 items pending in WAL queue).');

  // Step 3: Re-establish network connectivity
  console.log('3. Re-establishing network connection (isOnline = true)...');
  desktop.isOnline = true;

  // Step 4: Flush outbox after reconnection
  console.log('4. Flushing queued outbox mutations to Canonical Server upon reconnection...');
  const onlineFlush = desktop.flushOutbox(server);
  assert.strictEqual(onlineFlush.flushedCount, 5);
  assert.strictEqual(onlineFlush.duplicateCount, 0);
  assert.strictEqual(server.currentCursor, 5, 'Server cursor should now be 5');
  assert.strictEqual(desktop.outbox.filter(item => item.status === 'SYNCED').length, 5);
  console.log('✓ Reconnection outbox flush successful (5 mutations committed to server).');

  // Step 5: Simulate network retry / duplicate push scenario with identical idempotency keys
  console.log('5. Simulating network ACK loss retry (re-sending same 5 outbox items)...');
  
  // Force reset outbox item statuses to PENDING to simulate a client retry caused by missing ACK
  for (const item of desktop.outbox) {
    item.status = 'PENDING';
  }

  const retryFlush = desktop.flushOutbox(server);
  assert.strictEqual(retryFlush.flushedCount, 5, 'Retry flush should process 5 items');
  assert.strictEqual(retryFlush.duplicateCount, 5, 'All 5 items must be flagged as duplicates by server idempotency store');
  assert.strictEqual(server.currentCursor, 5, 'Server cursor MUST NOT increment on duplicate idempotency key retries');
  assert.strictEqual(server.changeLog.length, 5, 'Server change log length MUST remain 5');

  console.log('✓ Network retry idempotency deduplication verified (0 duplicate records created on server).\n');
}
