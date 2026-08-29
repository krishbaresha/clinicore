/**
 * PHASE 5 STEP A VERIFICATION SUITE
 * Production Infrastructure & VPS Deployment Auditor Assertions
 */

import assert from 'node:assert';

import { NginxConfigBuilder } from './vps_deployment_suite/src/vps/nginx_config_builder.ts';
import { SystemdServiceBuilder } from './vps_deployment_suite/src/vps/systemd_service_builder.ts';
import { PgTuningConfig } from './vps_deployment_suite/src/vps/pg_tuning_config.ts';
import { OffsiteBackupCron } from './vps_deployment_suite/src/vps/offsite_backup_cron.ts';

console.log('--------------------------------------------------');
console.log('🧪 RUNNING PHASE 5 STEP A VERIFICATION SUITE');
console.log('--------------------------------------------------');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// SECTION 1: NGINX PRODUCTION REVERSE PROXY GENERATOR SPECIFICATIONS
// ---------------------------------------------------------------------------
console.log('\n🌐 Section 1: Production Nginx Reverse Proxy Generator Specs');

runTest('Nginx TLS 1.3 & HTTP/2 Directives Assertion', () => {
  const nginxBuilder = new NginxConfigBuilder();
  const config = nginxBuilder.generateConfig();

  assert.ok(config.includes('ssl_protocols TLSv1.3 TLSv1.2;'), 'Must specify TLS 1.3 and 1.2');
  assert.ok(config.includes('listen 443 ssl http2;'), 'Must specify http2 support');
  assert.ok(config.includes('Strict-Transport-Security'), 'Must include HSTS security header');
});

runTest('Nginx Rate Limiting & Connections Assertion', () => {
  const nginxBuilder = new NginxConfigBuilder({ rateLimitReqPerSec: 50, rateLimitBurst: 30 });
  const config = nginxBuilder.generateConfig();

  assert.ok(config.includes('limit_req_zone $binary_remote_addr zone=clinicore_api_limit:10m rate=50r/s;'), 'Must set rate limit zone to 50r/s');
  assert.ok(config.includes('limit_req zone=clinicore_api_limit burst=30 nodelay;'), 'Must include burst=30 parameter');
});

runTest('Nginx WebSocket Sync Proxy Protocol Headers Assertion', () => {
  const nginxBuilder = new NginxConfigBuilder();
  const config = nginxBuilder.generateConfig();

  assert.ok(config.includes('location /api/v1/sync'), 'Must include WebSocket sync location');
  assert.ok(config.includes('proxy_set_header Upgrade $http_upgrade;'), 'Must include Upgrade header');
  assert.ok(config.includes('proxy_set_header Connection "upgrade";'), 'Must include Connection upgrade header');
  assert.ok(config.includes('proxy_read_timeout 86400s;'), 'Must configure long read timeout for sync connections');
});

runTest('Nginx Config Validation Method', () => {
  const nginxBuilder = new NginxConfigBuilder();
  const validation = nginxBuilder.validateConfig();

  assert.strictEqual(validation.valid, true, 'Default generated config must be valid');
  assert.strictEqual(validation.errors.length, 0, 'Should have zero validation errors');
});

// ---------------------------------------------------------------------------
// SECTION 2: UBUNTU SYSTEMD SERVICE UNIT GENERATOR SPECIFICATIONS
// ---------------------------------------------------------------------------
console.log('\n⚙️ Section 2: Ubuntu Systemd Service Unit Generator Specs');

runTest('Systemd Unit Core Configuration & Auto-Restart Assertion', () => {
  const systemdBuilder = new SystemdServiceBuilder({ serviceName: 'clinicore-api' });
  const unitFile = systemdBuilder.generateUnitFile();

  assert.ok(unitFile.includes('Description=ClinicFlow Production API Daemon'), 'Must contain service description');
  assert.ok(unitFile.includes('ExecStart=/usr/bin/node /opt/clinicore/dist/server.js'), 'Must contain correct ExecStart');
  assert.ok(unitFile.includes('Restart=always'), 'Must specify Restart=always');
  assert.ok(unitFile.includes('RestartSec=5s'), 'Must specify RestartSec=5s');
});

runTest('Systemd Journald Logging Assertion', () => {
  const systemdBuilder = new SystemdServiceBuilder();
  const unitFile = systemdBuilder.generateUnitFile();

  assert.ok(unitFile.includes('StandardOutput=journal'), 'Must direct standard output to journald');
  assert.ok(unitFile.includes('StandardError=journal'), 'Must direct standard error to journald');
  assert.ok(unitFile.includes('SyslogIdentifier=clinicore-api'), 'Must set SyslogIdentifier');
});

runTest('Systemd Security Sandboxing Assertion', () => {
  const systemdBuilder = new SystemdServiceBuilder();
  const unitFile = systemdBuilder.generateUnitFile();

  assert.ok(unitFile.includes('ProtectSystem=strict'), 'Must specify ProtectSystem=strict');
  assert.ok(unitFile.includes('ProtectHome=true'), 'Must specify ProtectHome=true');
  assert.ok(unitFile.includes('NoNewPrivileges=true'), 'Must specify NoNewPrivileges=true');
  assert.ok(unitFile.includes('PrivateTmp=true'), 'Must specify PrivateTmp=true');
});

runTest('Systemd Unit Validation Method', () => {
  const systemdBuilder = new SystemdServiceBuilder();
  const validation = systemdBuilder.validateUnitFile();

  assert.strictEqual(validation.valid, true, 'Default generated unit file must be valid');
  assert.strictEqual(validation.errors.length, 0);
});

// ---------------------------------------------------------------------------
// SECTION 3: POSTGRESQL 16 PRODUCTION CONFIGURATION TUNER SPECIFICATIONS
// ---------------------------------------------------------------------------
console.log('\n🐘 Section 3: PostgreSQL 16 Production Config Tuner Specs');

runTest('PostgreSQL Memory Tuning (RAM Calculation)', () => {
  const pgTuner16Gb = new PgTuningConfig({ totalRamGb: 16, maxConnections: 100 });
  const config16Gb = pgTuner16Gb.generateConfig();

  assert.strictEqual(config16Gb.shared_buffers, '4096MB', '16GB RAM shared_buffers should be 4096MB (25%)');
  assert.strictEqual(config16Gb.effective_cache_size, '12288MB', '16GB RAM effective_cache_size should be 12288MB (75%)');
  assert.strictEqual(config16Gb.wal_level, 'replica', 'wal_level must be replica');
  assert.strictEqual(config16Gb.max_connections, '100', 'max_connections must be 100');

  const pgTuner32Gb = new PgTuningConfig({ totalRamGb: 32, maxConnections: 200 });
  const config32Gb = pgTuner32Gb.generateConfig();
  assert.strictEqual(config32Gb.shared_buffers, '8192MB', '32GB RAM shared_buffers should be 8192MB (25%)');
});

runTest('PostgreSQL Storage & Worker Tuning Assertion', () => {
  const pgTuner = new PgTuningConfig({ storageType: 'NVMe', cpuCores: 8 });
  const config = pgTuner.generateConfig();

  assert.strictEqual(config.random_page_cost, '1.1', 'NVMe random_page_cost should be 1.1');
  assert.strictEqual(config.effective_io_concurrency, '200', 'NVMe effective_io_concurrency should be 200');
  assert.strictEqual(config.max_worker_processes, '8', 'max_worker_processes should match cpuCores (8)');
});

runTest('PostgreSQL Config Validation Method', () => {
  const pgTuner = new PgTuningConfig();
  const validation = pgTuner.validateConfig();

  assert.strictEqual(validation.valid, true, 'Default PostgreSQL tuning config must be valid');
  assert.strictEqual(validation.errors.length, 0);
});

// ---------------------------------------------------------------------------
// SECTION 4: AUTOMATED OFFSITE BACKUP CRON GENERATOR SPECIFICATIONS
// ---------------------------------------------------------------------------
console.log('\n🔒 Section 4: Automated Offsite Backup Cron Generator Specs');

runTest('Backup Cron Script AES-256 Encryption Directive Assertion', () => {
  const backupCron = new OffsiteBackupCron();
  const script = backupCron.generateBackupScript();

  assert.ok(script.includes('openssl enc -aes-256-cbc'), 'Script must include OpenSSL AES-256-CBC command');
  assert.ok(script.includes('-pbkdf2'), 'Script must include PBKDF2 key derivation parameter');
  assert.ok(script.includes('-iter 100000'), 'Script must use high iteration count (100,000)');
});

runTest('Backup Cron Script Remote Vault Sync & Retention Cleanup', () => {
  const backupCron = new OffsiteBackupCron({ remoteVaultTarget: 'remote_vault:offsite_backups', retentionDays: 14 });
  const script = backupCron.generateBackupScript();

  assert.ok(script.includes('rclone copy'), 'Script must include remote vault upload');
  assert.ok(script.includes('remote_vault:offsite_backups'), 'Script must reference specified remote vault target');
  assert.ok(script.includes('RETENTION_DAYS=14'), 'Script must specify RETENTION_DAYS=14');
  assert.ok(script.includes('-mtime +${RETENTION_DAYS}'), 'Script must purge old backups with find -mtime');
});

runTest('Crontab Schedule Specification Assertion', () => {
  const backupCron = new OffsiteBackupCron({ cronSchedule: '0 3 * * *' });
  const cronEntry = backupCron.generateCrontabEntry();

  assert.ok(cronEntry.startsWith('0 3 * * *'), 'Crontab entry must start with specified cron schedule (0 3 * * *)');
  assert.ok(cronEntry.includes('/opt/clinicore/scripts/clinicore_offsite_backup.sh'), 'Crontab entry must target script path');
});

runTest('Backup Script Validation Method', () => {
  const backupCron = new OffsiteBackupCron();
  const validation = backupCron.validateBackupScript();

  assert.strictEqual(validation.valid, true, 'Default generated backup script must be valid');
  assert.strictEqual(validation.errors.length, 0);
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n==================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} VERIFICATION ASSERTIONS PASSED CLEANLY!`);
console.log('==================================================\n');
