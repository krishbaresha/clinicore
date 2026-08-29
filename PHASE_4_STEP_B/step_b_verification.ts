/**
 * PHASE 4 STEP B VERIFICATION SUITE
 * Comprehensive packaging configuration and Zero-Data-Loss resilience assertions.
 */

import assert from 'node:assert';
import path from 'node:path';

import { TauriInstallerBuilder } from './packaging_suite/src/desktop/tauri_installer_builder.ts';
import { ExpoBundleBuilder } from './packaging_suite/src/mobile/expo_bundle_builder.ts';
import { ZeroDataLossTester } from './packaging_suite/src/resilience/zero_data_loss_tester.ts';
import type { SyncRecord } from './packaging_suite/src/resilience/zero_data_loss_tester.ts';

console.log('--------------------------------------------------');
console.log('🧪 RUNNING PHASE 4 STEP B VERIFICATION SUITE');
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
// SECTION 1: DESKTOP TAURI INSTALLER BUILD SPECIFICATIONS
// ---------------------------------------------------------------------------
console.log('\n💻 Section 1: Desktop Tauri Windows Installer Specs');

runTest('Tauri Installer Name & Package Output Target', () => {
  const builder = new TauriInstallerBuilder();
  const buildResult = builder.buildInstaller();

  assert.strictEqual(buildResult.success, true);
  assert.strictEqual(buildResult.installerName, 'ClinicFlow_Setup.exe');
  assert.ok(buildResult.artifactPath.endsWith('ClinicFlow_Setup.exe'));
});

runTest('Single-Instance Lock Specification & Key Resolution', () => {
  const builder = new TauriInstallerBuilder();
  const spec = builder.getSingleInstanceSpec();

  assert.strictEqual(spec.enabled, true);
  assert.strictEqual(spec.lockKey, 'clinicflow_single_instance_mutex_v1');
  assert.strictEqual(spec.actionOnDuplicate, 'FOCUS_EXISTING_WINDOW_AND_EMIT_SHOW');
});

runTest('System Tray Handler Configuration', () => {
  const builder = new TauriInstallerBuilder();
  const traySpec = builder.getSystemTraySpec();

  assert.strictEqual(traySpec.enabled, true);
  assert.strictEqual(traySpec.iconPath, 'assets/tray_icon.png');
  assert.ok(traySpec.menuItems.includes('Open ClinicFlow'));
  assert.ok(traySpec.menuItems.includes('Exit'));
});

runTest('Offline SQLite DB Path Resolution (Default AppData vs Custom Override)', () => {
  const builder = new TauriInstallerBuilder();

  // Test Default Path Resolution
  const defaultDbPath = builder.resolveSqliteDbPath();
  assert.ok(defaultDbPath.includes('ClinicFlow\\Data\\clinicflow_offline.sqlite'));

  // Test Custom Override Path
  const customPath = 'D:\\ClinicData\\custom_offline.sqlite';
  const resolvedCustom = builder.resolveSqliteDbPath(customPath);
  assert.strictEqual(path.normalize(resolvedCustom), path.normalize(customPath));
});

// ---------------------------------------------------------------------------
// SECTION 2: DOCTOR MOBILE APP EXPO BUNDLE BUILD SPECIFICATIONS
// ---------------------------------------------------------------------------
console.log('\n📱 Section 2: Doctor Mobile App Expo Packaging Specs');

runTest('Expo Package Output Targets (APK & iOS Bundle ID)', () => {
  const mobileBuilder = new ExpoBundleBuilder();
  const result = mobileBuilder.buildBundle();

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.androidApkName, 'ClinicFlow_Doctor.apk');
  assert.strictEqual(result.iosBundleId, 'com.clinicflow.doctormobile');
});

runTest('Push Notification Channel Initializer Specification', () => {
  const mobileBuilder = new ExpoBundleBuilder();
  const channel = mobileBuilder.initializePushNotificationChannel();

  assert.strictEqual(channel.id, 'urgent_patient_alerts');
  assert.strictEqual(channel.importance, 'MAX');
  assert.strictEqual(channel.sound, 'patient_alert.wav');
  assert.deepStrictEqual(channel.vibrationPattern, [0, 250, 250, 250]);
});

runTest('Biometric Authentication Guard Configuration', () => {
  const mobileBuilder = new ExpoBundleBuilder();
  const biometrics = mobileBuilder.getBiometricConfig();

  assert.strictEqual(biometrics.enabled, true);
  assert.strictEqual(biometrics.securityLevel, 'STRONG');
  assert.strictEqual(biometrics.fallbackToPasscode, true);
  assert.ok(biometrics.biometricTypes.includes('FINGERPRINT'));
  assert.ok(biometrics.biometricTypes.includes('FACE_ID'));
});

// ---------------------------------------------------------------------------
// SECTION 3: ZERO-DATA-LOSS RESILIENCE SIMULATION
// ---------------------------------------------------------------------------
console.log('\n🛡️ Section 3: Zero-Data-Loss Resilience Simulation');

runTest('App Uninstall / Local Cache Wipe Recovery Assertion', () => {
  const tester = new ZeroDataLossTester();

  const mockPatientRecords: SyncRecord[] = [
    {
      id: 'REC_001',
      patientName: 'Kashif Ali',
      mrn: 'MRN-HYD-2026-001',
      visitDetails: 'Follow-up consultation for Hypertension',
      updatedAt: '2026-08-30T01:00:00Z',
      synced: true,
    },
    {
      id: 'REC_002',
      patientName: 'Zubair Khan',
      mrn: 'MRN-HYD-2026-002',
      visitDetails: 'Wholesale Homoeopathic Medicine Invoice #1042',
      updatedAt: '2026-08-30T01:05:00Z',
      synced: true,
    },
    {
      id: 'REC_003',
      patientName: 'Ayesha Bibi',
      mrn: 'MRN-HYD-2026-003',
      visitDetails: 'Acute Fever OPD Consultation',
      updatedAt: '2026-08-30T01:10:00Z',
      synced: true,
    },
  ];

  const result = tester.runResilienceTest(mockPatientRecords);

  assert.strictEqual(result.initialCount, 3);
  assert.strictEqual(result.postWipeCount, 0);
  assert.strictEqual(result.postRecoveryCount, 3);
  assert.strictEqual(result.zeroDataLossVerified, true);
  assert.ok(result.recoverySource.includes('Canonical Server'));
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n--------------------------------------------------');
console.log(`✨ VERIFICATION COMPLETE: ${passedTests}/${totalTests} Tests Passed Cleanly`);
console.log('--------------------------------------------------');
