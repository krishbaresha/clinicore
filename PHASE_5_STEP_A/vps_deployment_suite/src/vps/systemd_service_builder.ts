/**
 * Production Systemd Service Unit Builder
 * Generates Ubuntu systemd service unit files (clinicore-api.service) featuring auto-restart,
 * journald logging, environment isolation, and strict security sandboxing.
 */

export interface SystemdServiceOptions {
  serviceName?: string;
  description?: string;
  user?: string;
  group?: string;
  workingDirectory?: string;
  execStart?: string;
  nodeEnv?: string;
  port?: number;
  restartSec?: number;
  memoryLimitMb?: number;
  environmentVars?: Record<string, string>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class SystemdServiceBuilder {
  private serviceName: string;
  private description: string;
  private user: string;
  private group: string;
  private workingDirectory: string;
  private execStart: string;
  private nodeEnv: string;
  private port: number;
  private restartSec: number;
  private memoryLimitMb: number;
  private environmentVars: Record<string, string>;

  constructor(options: SystemdServiceOptions = {}) {
    this.serviceName = options.serviceName || 'clinicore-api';
    this.description = options.description || 'ClinicFlow Production API Daemon';
    this.user = options.user || 'clinicore';
    this.group = options.group || 'clinicore';
    this.workingDirectory = options.workingDirectory || '/opt/clinicore';
    this.execStart = options.execStart || '/usr/bin/node /opt/clinicore/dist/server.js';
    this.nodeEnv = options.nodeEnv || 'production';
    this.port = options.port || 3001;
    this.restartSec = options.restartSec || 5;
    this.memoryLimitMb = options.memoryLimitMb || 2048;
    this.environmentVars = options.environmentVars || {};
  }

  public generateUnitFile(): string {
    const envLines = Object.entries(this.environmentVars)
      .map(([k, v]) => `Environment="${k}=${v}"`)
      .join('\n');

    return `[Unit]
Description=${this.description}
After=network.target postgresql.service
Wants=postgresql.service
Documentation=https://github.com/krishbaresha/clinicore

[Service]
Type=simple
User=${this.user}
Group=${this.group}
WorkingDirectory=${this.workingDirectory}
ExecStart=${this.execStart}

# Environment Variables
Environment=NODE_ENV=${this.nodeEnv}
Environment=PORT=${this.port}
${envLines ? envLines + '\n' : ''}
# Auto-Restart Policy
Restart=always
RestartSec=${this.restartSec}s
StartLimitIntervalSec=300
StartLimitBurst=5

# Resource Management
MemoryMax=${this.memoryLimitMb}M
MemoryHigh=${Math.floor(this.memoryLimitMb * 0.85)}M
CPUWeight=100
LimitNOFILE=65536

# Security Sandboxing & Hardening
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
NoNewPrivileges=true
ProtectControlGroups=true
ProtectKernelModules=true
ProtectKernelTunables=true
RestrictRealtime=true
RestrictNamespaces=true
CapabilityBoundingSet=
ReadWritePaths=${this.workingDirectory}/storage ${this.workingDirectory}/logs /tmp

# Process & Logging Architecture
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${this.serviceName}
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30s

[Install]
WantedBy=multi-user.target
`;
  }

  public validateUnitFile(unitContent?: string): ValidationResult {
    const content = unitContent || this.generateUnitFile();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content.includes('Restart=always')) {
      errors.push('Missing Restart=always policy');
    }
    if (!content.includes('ProtectSystem=strict') && !content.includes('ProtectSystem=full')) {
      errors.push('Missing ProtectSystem security sandboxing');
    }
    if (!content.includes('NoNewPrivileges=true')) {
      errors.push('Missing NoNewPrivileges security assertion');
    }
    if (!content.includes('PrivateTmp=true')) {
      errors.push('Missing PrivateTmp security sandbox directive');
    }
    if (!content.includes('StandardOutput=journal')) {
      errors.push('Missing journald logging standard output specification');
    }
    if (!content.includes('WantedBy=multi-user.target')) {
      warnings.push('Missing WantedBy=multi-user.target install section parameter');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  public getSummary(): {
    serviceName: string;
    execStart: string;
    restartPolicy: string;
    sandboxed: boolean;
    user: string;
  } {
    return {
      serviceName: `${this.serviceName}.service`,
      execStart: this.execStart,
      restartPolicy: `always (delay=${this.restartSec}s)`,
      sandboxed: true,
      user: `${this.user}:${this.group}`,
    };
  }
}
