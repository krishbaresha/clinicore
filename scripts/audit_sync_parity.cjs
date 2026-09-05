const fs = require('fs');

const dbContent = fs.readFileSync('frontend/src/api/db.js', 'utf8');
const serverContent = fs.readFileSync('backend/server.js', 'utf8');
const syncEngineContent = fs.readFileSync('frontend/src/api/syncEngine.js', 'utf8');
const sqlContent = fs.readFileSync('database/production_schema.sql', 'utf8');

// 1. Extract KEYS from db.js
const keysMatch = dbContent.match(/export const KEYS = \{([\s\S]*?)\};/);
const keys = {};
if (keysMatch) {
  const lines = keysMatch[1].split('\n');
  lines.forEach(line => {
    const m = line.match(/([A-Z_0-9]+):\s*["']([^"']+)["']/);
    if (m) keys[m[1]] = m[2];
  });
}

// 2. Extract outbox enqueues from db.js
const outboxEntities = new Set();
const outboxLines = dbContent.split('\n');
outboxLines.forEach(l => {
  const m = l.match(/dbOutbox\.enqueue\(\s*["']([^"']+)["']/);
  if (m) outboxEntities.add(m[1]);
});

// 3. Extract ENTITY_TO_KEY from server.js
const serverEntityMatch = serverContent.match(/const ENTITY_TO_KEY = \{([\s\S]*?)\};/);
const serverEntityMap = {};
if (serverEntityMatch) {
  const lines = serverEntityMatch[1].split('\n');
  lines.forEach(line => {
    const m = line.match(/([a-zA-Z0-9_]+):\s*["']([^"']+)["']/);
    if (m) serverEntityMap[m[1]] = m[2];
  });
}

// 4. Extract syncKeys from syncEngine.js
const syncKeysMatch = syncEngineContent.match(/const syncKeys = \[([\s\S]*?)\];/);
const syncKeys = [];
if (syncKeysMatch) {
  const lines = syncKeysMatch[1].split('\n');
  lines.forEach(line => {
    const m = line.match(/["']([^"']+)["']/);
    if (m) syncKeys.push(m[1]);
  });
}

// 5. Extract SQL tables
const sqlTables = [];
const sqlRe = /CREATE TABLE (?:IF NOT EXISTS )?([a-zA-Z0-9_]+)/gi;
let sm;
while ((sm = sqlRe.exec(sqlContent)) !== null) {
  sqlTables.push(sm[1]);
}

console.log('--- 1. Storage KEYS in db.js ---');
console.log(keys);

console.log('\n--- 2. Distinct Outbox Enqueue Entities in db.js ---');
console.log(Array.from(outboxEntities));

console.log('\n--- 3. ENTITY_TO_KEY in server.js ---');
console.log(serverEntityMap);

console.log('\n--- 4. syncKeys in syncEngine.js ---');
console.log(syncKeys);

console.log('\n--- 5. SQL Tables in production_schema.sql ---');
console.log(sqlTables);

// Parity analysis:
console.log('\n=== PARITY GAPS: Outbox Entities NOT in server.js ENTITY_TO_KEY ===');
Array.from(outboxEntities).forEach(e => {
  const norm = e.toLowerCase().replace(/^cf_/, '').replace(/_v\d+$/, '');
  if (!serverEntityMap[e] && !serverEntityMap[norm]) {
    console.log(`MISSING IN SERVER: "${e}" (normalized: "${norm}")`);
  }
});

console.log('\n=== PARITY GAPS: Storage KEYS NOT in syncEngine.js syncKeys ===');
Object.entries(keys).forEach(([k, v]) => {
  if (v.startsWith('cf_') && !['cf_seeded_v16_vps_primary', 'cf_auth_session', 'cf_sync_outbox_v1', 'cf_admin_master_passcode', 'cf_admin_tab_pin', 'cf_admin_tab_security'].includes(v)) {
    if (!syncKeys.includes(v)) {
      console.log(`MISSING IN SYNC ENGINE: KEYS.${k} -> "${v}"`);
    }
  }
});
