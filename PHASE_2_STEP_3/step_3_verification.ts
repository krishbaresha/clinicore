import { AppServer } from './api_scaffold/src/app.ts';
import { AuthMiddleware } from './api_scaffold/src/middleware/auth.middleware.ts';

async function runStep3Verification() {
  console.log('=== PHASE 2 STEP 3: API ENDPOINTS, MUTATION GATEWAY & SYNC CURSOR SCAFFOLD VERIFICATION ===\n');

  const app = new AppServer();

  // ------------------------------------------------------------------
  // TEST 1: ROUTE VALIDATION (400 Bad Request & 404 Not Found)
  // ------------------------------------------------------------------
  console.log('--- TEST 1: Route Payload & Query Validation ---');

  // 1a: Invalid Login Payload
  const invalidLoginRes = await app.handleRequest({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {},
    body: { email: 'admin@clinicore.pk' }, // Missing password
  });
  console.log(`[PASS] 1a Login Missing Password Status (Expected 400): ${invalidLoginRes.status}`);
  if (invalidLoginRes.status !== 400 || !invalidLoginRes.body.error.includes('password')) {
    throw new Error('Test 1a failed: Login validation should reject missing password with 400');
  }

  // 1b: Invalid Sync Pull Cursor
  const validToken = AuthMiddleware.generateToken('usr_admin_001', 'cln_master_001', 'admin');
  const invalidCursorRes = await app.handleRequest({
    method: 'GET',
    url: '/api/v1/sync/pull?cursor=abc',
    headers: { authorization: `Bearer ${validToken}` },
  });
  console.log(`[PASS] 1b Sync Pull Invalid Cursor Status (Expected 400): ${invalidCursorRes.status}`);
  if (invalidCursorRes.status !== 400) {
    throw new Error('Test 1b failed: Sync pull should reject non-numeric cursor with 400');
  }

  // 1c: Invalid Sync Push Mutations Format
  const invalidPushRes = await app.handleRequest({
    method: 'POST',
    url: '/api/v1/sync/push',
    headers: { authorization: `Bearer ${validToken}` },
    body: { mutations: [{ mutation_id: 'm1' }] }, // Missing idempotency_key
  });
  console.log(`[PASS] 1c Sync Push Missing Idempotency Key Status (Expected 400): ${invalidPushRes.status}`);
  if (invalidPushRes.status !== 400 || !invalidPushRes.body.error.includes('idempotency_key')) {
    throw new Error('Test 1c failed: Sync push should reject missing idempotency_key with 400');
  }

  // 1d: Invalid Approval Request Missing Reason
  const invalidApprovalRes = await app.handleRequest({
    method: 'POST',
    url: '/api/v1/approvals/request',
    headers: { authorization: `Bearer ${validToken}` },
    body: { action_type: 'DISCOUNT_OVERRIDE', target_entity: 'b2b_sale', entity_id: 'sale_101' }, // Missing reason
  });
  console.log(`[PASS] 1d Approval Missing Reason Status (Expected 400): ${invalidApprovalRes.status}`);
  if (invalidApprovalRes.status !== 400 || !invalidApprovalRes.body.error.includes('reason')) {
    throw new Error('Test 1d failed: Approval request should reject missing reason with 400');
  }

  // 1e: Non-Existent Route
  const notFoundRes = await app.handleRequest({
    method: 'GET',
    url: '/api/v1/unknown/endpoint',
    headers: {},
  });
  console.log(`[PASS] 1e Non-existent Route Status (Expected 404): ${notFoundRes.status}`);
  if (notFoundRes.status !== 404) {
    throw new Error('Test 1e failed: Unknown route should return 404');
  }

  // ------------------------------------------------------------------
  // TEST 2: AUTHENTICATION TOKEN CHECKING (401 Unauthorized vs 200 OK)
  // ------------------------------------------------------------------
  console.log('\n--- TEST 2: Authentication & Token Authorization ---');

  // 2a: Missing Bearer Token on Protected Endpoint
  const noTokenRes = await app.handleRequest({
    method: 'GET',
    url: '/api/v1/sync/pull?cursor=0',
    headers: {},
  });
  console.log(`[PASS] 2a Protected Route Without Token Status (Expected 401): ${noTokenRes.status}`);
  if (noTokenRes.status !== 401) {
    throw new Error('Test 2a failed: Protected route without token must return 401');
  }

  // 2b: Invalid JWT Token Signature
  const tamperedTokenRes = await app.handleRequest({
    method: 'GET',
    url: '/api/v1/sync/pull?cursor=0',
    headers: { authorization: 'Bearer invalid.tampered.token' },
  });
  console.log(`[PASS] 2b Invalid JWT Signature Status (Expected 401): ${tamperedTokenRes.status}`);
  if (tamperedTokenRes.status !== 401) {
    throw new Error('Test 2b failed: Invalid JWT token must return 401');
  }

  // 2c: Valid Login Request to issue Token
  const loginRes = await app.handleRequest({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {},
    body: { username: 'admin@clinicore.pk', password: 'KB2026' },
  });
  console.log(`[PASS] 2c Login Execution Status (Expected 200): ${loginRes.status}`);
  console.log(`[PASS] Issued JWT Token: ${loginRes.body.token?.slice(0, 30)}...`);
  if (loginRes.status !== 200 || !loginRes.body.success || !loginRes.body.token) {
    throw new Error('Test 2c failed: Valid login must return 200 with JWT token');
  }

  const userJwtToken = loginRes.body.token;

  // 2d: Access Protected Endpoint with Valid Token
  const authorizedPullRes = await app.handleRequest({
    method: 'GET',
    url: '/api/v1/sync/pull?cursor=0',
    headers: { authorization: `Bearer ${userJwtToken}` },
  });
  console.log(`[PASS] 2d Protected Route With Valid Token Status (Expected 200): ${authorizedPullRes.status}`);
  if (authorizedPullRes.status !== 200 || !authorizedPullRes.body.success) {
    throw new Error('Test 2d failed: Protected route with valid token must return 200');
  }

  // ------------------------------------------------------------------
  // TEST 3: IDEMPOTENCY KEY DEDUPLICATION & MUTATION GATEWAY
  // ------------------------------------------------------------------
  console.log('\n--- TEST 3: Mutation Gateway & Idempotency Deduplication ---');

  const mutationBatch = {
    mutations: [
      {
        mutation_id: 'mut_sale_001',
        idempotency_key: 'IDEM-KEY-SALE-9901',
        entity_type: 'b2b_sale',
        action: 'INSERT',
        payload: { id: 'sale_9901', total_amount: 15000, party_code: 'PTY-108' },
      },
    ],
  };

  // 3a: Initial Push of Mutation
  const firstPushRes = await app.handleRequest({
    method: 'POST',
    url: '/api/v1/sync/push',
    headers: { authorization: `Bearer ${userJwtToken}` },
    body: mutationBatch,
  });
  console.log(`[PASS] 3a Initial Push Status (Expected 200): ${firstPushRes.status}`);
  console.log(`[PASS] Initial Push Result Status:`, firstPushRes.body.results[0].status);
  if (
    firstPushRes.status !== 200 ||
    firstPushRes.body.results[0].status !== 'SUCCESS' ||
    firstPushRes.body.results[0].cursor !== 1
  ) {
    throw new Error('Test 3a failed: Initial mutation push must return status SUCCESS with cursor 1');
  }

  // 3b: Duplicate Push of Same Idempotency Key
  const duplicatePushRes = await app.handleRequest({
    method: 'POST',
    url: '/api/v1/sync/push',
    headers: { authorization: `Bearer ${userJwtToken}` },
    body: mutationBatch,
  });
  console.log(`[PASS] 3b Duplicate Push Status (Expected 200): ${duplicatePushRes.status}`);
  console.log(`[PASS] Duplicate Push Result Status (Expected DUPLICATE):`, duplicatePushRes.body.results[0].status);
  if (
    duplicatePushRes.status !== 200 ||
    duplicatePushRes.body.results[0].status !== 'DUPLICATE'
  ) {
    throw new Error('Test 3b failed: Re-submitting same idempotency key must return status DUPLICATE');
  }

  // Verify that cursor sequence was NOT incremented by duplicate push
  if (app.cursorStore.getLatestCursor() !== 1) {
    throw new Error('Test 3b failed: Duplicate push should not assign new cursor');
  }

  // ------------------------------------------------------------------
  // TEST 4: MONOTONIC CHANGE CURSOR PULL
  // ------------------------------------------------------------------
  console.log('\n--- TEST 4: Monotonic Change Cursor Pull ---');

  // Push batch of 2 new mutations
  const secondBatch = {
    mutations: [
      {
        mutation_id: 'mut_patient_002',
        idempotency_key: 'IDEM-KEY-PAT-002',
        entity_type: 'patients',
        action: 'INSERT',
        payload: { id: 'pat_002', name: 'Muhammad Ali', city: 'Hyderabad' },
      },
      {
        mutation_id: 'mut_inv_003',
        idempotency_key: 'IDEM-KEY-INV-003',
        entity_type: 'inventory',
        action: 'UPDATE',
        payload: { id: 'inv_003', stock: 120 },
      },
    ],
  };

  const secondPushRes = await app.handleRequest({
    method: 'POST',
    url: '/api/v1/sync/push',
    headers: { authorization: `Bearer ${userJwtToken}` },
    body: secondBatch,
  });
  console.log(`[PASS] Second Push Processed Count: ${secondPushRes.body.processed_count}`);
  console.log(`[PASS] Latest Global Cursor: ${secondPushRes.body.current_cursor}`);

  // Create an Approval Request (which appends cursor 4)
  const approvalRes = await app.handleRequest({
    method: 'POST',
    url: '/api/v1/approvals/request',
    headers: { authorization: `Bearer ${userJwtToken}` },
    body: {
      action_type: 'CREDIT_LIMIT_OVERRIDE',
      target_entity: 'parties',
      entity_id: 'PTY-108',
      reason: 'Urgent medical inventory dispatch approval requested by Dr. Kashif',
    },
  });
  console.log(`[PASS] Approval Request Status: ${approvalRes.status}, Approval ID: ${approvalRes.body.approval_id}`);

  // 4a: Pull changes with cursor=0 (returns all 4 changes)
  const pullAllRes = await app.handleRequest({
    method: 'GET',
    url: '/api/v1/sync/pull?cursor=0',
    headers: { authorization: `Bearer ${userJwtToken}` },
  });
  console.log(`[PASS] 4a Pull cursor=0 Returned Count (Expected 4): ${pullAllRes.body.changes.length}`);
  if (pullAllRes.body.changes.length !== 4) {
    throw new Error('Test 4a failed: Pull cursor=0 should return all 4 change records');
  }

  // 4b: Monotonic Delta Pull with cursor=1 (returns changes with cursor > 1, i.e., cursors 2, 3, 4)
  const deltaPullRes = await app.handleRequest({
    method: 'GET',
    url: '/api/v1/sync/pull?cursor=1',
    headers: { authorization: `Bearer ${userJwtToken}` },
  });
  console.log(`[PASS] 4b Delta Pull cursor=1 Returned Count (Expected 3): ${deltaPullRes.body.changes.length}`);
  const cursorsReturned = deltaPullRes.body.changes.map((c: any) => c.cursor);
  console.log(`[PASS] Returned Cursors (Strictly > 1):`, cursorsReturned);

  if (deltaPullRes.body.changes.length !== 3 || cursorsReturned[0] !== 2 || cursorsReturned[2] !== 4) {
    throw new Error('Test 4b failed: Delta pull cursor=1 should strictly return records for cursors 2, 3, 4');
  }

  // 4c: Pull with cursor=4 (returns 0 new changes)
  const latestPullRes = await app.handleRequest({
    method: 'GET',
    url: '/api/v1/sync/pull?cursor=4',
    headers: { authorization: `Bearer ${userJwtToken}` },
  });
  console.log(`[PASS] 4c Pull cursor=4 Returned Count (Expected 0): ${latestPullRes.body.changes.length}`);
  if (latestPullRes.body.changes.length !== 0 || latestPullRes.body.has_more !== false) {
    throw new Error('Test 4c failed: Pull cursor=4 should return 0 new changes');
  }

  // ------------------------------------------------------------------
  // TEST 5: HTTP LISTENER WIRE OVER-THE-NETWORK INTEGRATION
  // ------------------------------------------------------------------
  console.log('\n--- TEST 5: HTTP Server Listener Wire Verification ---');

  const server = app.createHttpServer();
  const PORT = 3456;

  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[PASS] HTTP Test Server Listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  try {
    const httpResponse = await fetch(`http://127.0.0.1:${PORT}/api/v1/sync/pull?cursor=2`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${userJwtToken}`,
      },
    });

    const data: any = await httpResponse.json();
    console.log(`[PASS] HTTP Network Fetch Status (Expected 200): ${httpResponse.status}`);
    console.log(`[PASS] Network Response Changes Count: ${data.changes?.length}`);

    if (httpResponse.status !== 200 || data.changes?.length !== 2) {
      throw new Error('Test 5 failed: HTTP wire fetch did not return expected status and payload');
    }
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('[PASS] HTTP Test Server Closed Cleanly');
        resolve();
      });
    });
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL PHASE 2 STEP 3 API ENDPOINT & SYNC CURSOR VERIFICATION TESTS PASSED');
  console.log('========================================================================');
}

runStep3Verification().catch((err) => {
  console.error('STEP 3 VERIFICATION FAILED:', err);
  process.exit(1);
});
