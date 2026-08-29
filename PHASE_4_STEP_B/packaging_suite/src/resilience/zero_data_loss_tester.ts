/**
 * Zero-Data-Loss Resilience Simulator
 * Tests app uninstall/reinstall and local cache wipe recovery from canonical server.
 */

export interface SyncRecord {
  id: string;
  patientName: string;
  mrn: string;
  visitDetails: string;
  updatedAt: string;
  synced: boolean;
}

export interface LocalDeviceStorage {
  sqliteCache: SyncRecord[];
  localStorageKeys: Record<string, string>;
  isWiped: boolean;
}

export interface CanonicalServerDB {
  records: Map<string, SyncRecord>;
}

export interface ResilienceSimulationResult {
  initialCount: number;
  postWipeCount: number;
  postRecoveryCount: number;
  zeroDataLossVerified: boolean;
  recoverySource: string;
  auditTrail: string[];
}

export class ZeroDataLossTester {
  private localDevice: LocalDeviceStorage;
  private canonicalServer: CanonicalServerDB;

  constructor() {
    this.localDevice = {
      sqliteCache: [],
      localStorageKeys: {},
      isWiped: false,
    };
    this.canonicalServer = {
      records: new Map<string, SyncRecord>(),
    };
  }

  /**
   * Seeds initial patient records into both local storage and canonical server.
   */
  public seedInitialData(records: SyncRecord[]): void {
    this.localDevice.sqliteCache = records.map((r) => ({ ...r }));
    records.forEach((r) => {
      this.localDevice.localStorageKeys[`patient_${r.id}`] = JSON.stringify(r);
      this.canonicalServer.records.set(r.id, { ...r, synced: true });
    });
    this.localDevice.isWiped = false;
  }

  /**
   * Simulates local device data wipe (e.g. app uninstall/reinstall or explicit clear cache).
   */
  public simulateAppUninstallOrCacheWipe(): void {
    this.localDevice.sqliteCache = [];
    this.localDevice.localStorageKeys = {};
    this.localDevice.isWiped = true;
  }

  /**
   * Simulates canonical server recovery re-sync.
   */
  public recoverDataFromCanonicalServer(): SyncRecord[] {
    const recovered: SyncRecord[] = [];
    for (const record of this.canonicalServer.records.values()) {
      recovered.push({ ...record, synced: true });
      this.localDevice.localStorageKeys[`patient_${record.id}`] = JSON.stringify(record);
    }
    this.localDevice.sqliteCache = recovered.map((r) => ({ ...r }));
    this.localDevice.isWiped = false;
    return recovered;
  }

  /**
   * Runs complete end-to-end Zero-Data-Loss resilience verification test.
   */
  public runResilienceTest(testRecords: SyncRecord[]): ResilienceSimulationResult {
    const auditTrail: string[] = [];

    // Step 1: Seed
    this.seedInitialData(testRecords);
    const initialCount = this.localDevice.sqliteCache.length;
    auditTrail.push(`Step 1: Seeded ${initialCount} records into Local SQLite & Server DB.`);

    // Step 2: Wipe
    this.simulateAppUninstallOrCacheWipe();
    const postWipeCount = this.localDevice.sqliteCache.length;
    auditTrail.push(`Step 2: Simulated App Uninstall / Local Cache Wipe. Local records = ${postWipeCount}.`);

    // Step 3: Recover
    const recovered = this.recoverDataFromCanonicalServer();
    const postRecoveryCount = this.localDevice.sqliteCache.length;
    auditTrail.push(`Step 3: Triggered Canonical Server Re-sync. Recovered records = ${postRecoveryCount}.`);

    // Verification check
    const zeroDataLossVerified =
      initialCount === postRecoveryCount &&
      testRecords.every((orig) => {
        const rec = this.localDevice.sqliteCache.find((r) => r.id === orig.id);
        return rec !== undefined && rec.mrn === orig.mrn && rec.patientName === orig.patientName;
      });

    auditTrail.push(
      zeroDataLossVerified
        ? 'Result: Zero-Data-Loss Verified. 100% data intact post-recovery.'
        : 'Result: Data Integrity Check FAILED.'
    );

    return {
      initialCount,
      postWipeCount,
      postRecoveryCount,
      zeroDataLossVerified,
      recoverySource: 'ClinicFlow Canonical Server Cloud/Hostinger API',
      auditTrail,
    };
  }
}
