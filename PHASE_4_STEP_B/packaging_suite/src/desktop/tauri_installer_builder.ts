/**
 * Tauri Windows Desktop Installer Build Configuration & Runtime Helpers
 * Package target: ClinicFlow_Setup.exe
 */

import path from 'node:path';
import os from 'node:os';

export interface TauriBuildConfig {
  appName: string;
  version: string;
  executableName: string;
  identifier: string;
  targetOs: 'windows' | 'macos' | 'linux';
  windowsConfig: {
    installerName: string;
    singleInstance: boolean;
    singleInstanceLockKey: string;
    systemTrayEnabled: boolean;
    trayIconPath: string;
    trayTitle: string;
    sqliteConfig: {
      dbFilename: string;
      appDataSubfolder: string;
      customPathOverride?: string;
    };
  };
}

export interface TauriBuildResult {
  success: boolean;
  artifactPath: string;
  installerName: string;
  singleInstanceLockSpec: string;
  sqlitePath: string;
  trayConfigured: boolean;
  buildLog: string[];
}

export class TauriInstallerBuilder {
  private config: TauriBuildConfig;

  constructor(customConfig?: Partial<TauriBuildConfig>) {
    this.config = {
      appName: 'ClinicFlow Desktop Engine',
      version: '1.4.0',
      executableName: 'ClinicFlow',
      identifier: 'com.clinicflow.desktop',
      targetOs: 'windows',
      windowsConfig: {
        installerName: 'ClinicFlow_Setup.exe',
        singleInstance: true,
        singleInstanceLockKey: 'clinicflow_single_instance_mutex_v1',
        systemTrayEnabled: true,
        trayIconPath: 'assets/tray_icon.png',
        trayTitle: 'ClinicFlow OPD & Wholesale Engine',
        sqliteConfig: {
          dbFilename: 'clinicflow_offline.sqlite',
          appDataSubfolder: 'ClinicFlow\\Data',
        },
      },
      ...customConfig,
    };
  }

  public getBuildConfig(): TauriBuildConfig {
    return { ...this.config };
  }

  /**
   * Resolves the authoritative offline SQLite DB path based on OS standards and custom overrides.
   */
  public resolveSqliteDbPath(customOverride?: string): string {
    if (customOverride && customOverride.trim() !== '') {
      return path.normalize(customOverride);
    }
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, this.config.windowsConfig.sqliteConfig.appDataSubfolder, this.config.windowsConfig.sqliteConfig.dbFilename);
  }

  /**
   * Generates single-instance lock specification.
   */
  public getSingleInstanceSpec(): { enabled: boolean; lockKey: string; actionOnDuplicate: string } {
    return {
      enabled: this.config.windowsConfig.singleInstance,
      lockKey: this.config.windowsConfig.singleInstanceLockKey,
      actionOnDuplicate: 'FOCUS_EXISTING_WINDOW_AND_EMIT_SHOW',
    };
  }

  /**
   * Generates System Tray Handler configuration.
   */
  public getSystemTraySpec(): { enabled: boolean; iconPath: string; menuItems: string[] } {
    return {
      enabled: this.config.windowsConfig.systemTrayEnabled,
      iconPath: this.config.windowsConfig.trayIconPath,
      menuItems: ['Open ClinicFlow', 'OPD Queue Status', 'Sync Status', 'Separator', 'Exit'],
    };
  }

  /**
   * Simulates the Tauri build execution pipeline generating ClinicFlow_Setup.exe.
   */
  public buildInstaller(): TauriBuildResult {
    const logs: string[] = [];
    logs.push(`Initializing Tauri Windows Installer Build v${this.config.version}...`);
    logs.push(`Configuring Single Instance Mutex: ${this.config.windowsConfig.singleInstanceLockKey}`);
    logs.push(`Configuring System Tray Icon: ${this.config.windowsConfig.trayIconPath}`);

    const sqlitePath = this.resolveSqliteDbPath();
    logs.push(`Resolved Offline SQLite path: ${sqlitePath}`);

    const artifactPath = path.join(process.cwd(), 'dist', 'installers', this.config.windowsConfig.installerName);
    logs.push(`Bundle compiled successfully -> ${artifactPath}`);

    return {
      success: true,
      artifactPath,
      installerName: this.config.windowsConfig.installerName,
      singleInstanceLockSpec: this.config.windowsConfig.singleInstanceLockKey,
      sqlitePath,
      trayConfigured: this.config.windowsConfig.systemTrayEnabled,
      buildLog: logs,
    };
  }
}
