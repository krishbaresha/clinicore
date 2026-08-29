/**
 * Phase 3 Module D: Privacy-Safe Telemetry & Diagnostic Snapshot Logger
 * Implements PII redaction for CNIC, Phone, Passwords, Tokens, and diagnostic logging.
 */

export interface TelemetryLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'audit';
  category: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface DiagnosticSnapshot {
  systemVersion: string;
  nodeVersion: string;
  uptimeSeconds: number;
  memoryUsage: NodeJS.MemoryUsage;
  totalLogsLogged: number;
  recentLogs: TelemetryLogEntry[];
}

/**
 * Regex patterns for PII redaction.
 */
const CNIC_REGEX = /\b(\d{5})[-]?(\d{7})[-]?(\d{1})\b/g;
const PHONE_REGEX = /(?:\+?92|0)[-]?3\d{2}[-]?\d{7}\b/g;
const BEARER_TOKEN_REGEX = /Bearer\s+\S+/gi;

const SENSITIVE_KEY_PATTERNS = [
  /pass(?:word)?/i,
  /secret/i,
  /token/i,
  /auth(?:orization)?/i,
  /api[_-]?key/i,
  /cred(?:ential)?s?/i,
  /cnic/i,
  /phone/i,
  /mobile/i,
];

/**
 * Redacts string containing CNIC, phone numbers, or tokens.
 */
export function redactPIIString(text: string): string {
  if (typeof text !== 'string') return text;

  let redacted = text;

  // Redact Bearer tokens
  redacted = redacted.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED]');

  // Redact CNIC: 41304-1234567-1 -> 41304-*******-1
  redacted = redacted.replace(CNIC_REGEX, (_match, p1, _p2, p3) => `${p1}-*******-${p3}`);

  // Redact Phone: 0300-1234567 or +923001234567 -> 0300-***4567
  redacted = redacted.replace(PHONE_REGEX, (phoneMatch) => {
    const digits = phoneMatch.replace(/\D/g, '');
    if (digits.length >= 10) {
      const prefix = phoneMatch.startsWith('+92') ? '+923' : phoneMatch.substring(0, 4);
      const suffix = digits.slice(-4);
      return `${prefix}-***${suffix}`;
    }
    return '[REDACTED_PHONE]';
  });

  return redacted;
}

/**
 * Recursively redacts PII and sensitive keys from any JS object, array, or primitive.
 */
export function redactPII<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return redactPIIString(data) as unknown as T;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactPII(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const redactedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

      if (isSensitiveKey) {
        if (typeof value === 'string' && (/cnic/i.test(key) || /phone/i.test(key) || /mobile/i.test(key))) {
          redactedObj[key] = redactPIIString(value);
        } else {
          redactedObj[key] = '[REDACTED]';
        }
      } else {
        redactedObj[key] = redactPII(value);
      }
    }
    return redactedObj as T;
  }

  return data;
}

/**
 * Privacy-safe Telemetry & Audit Logging Service.
 */
export class TelemetryService {
  private logs: TelemetryLogEntry[] = [];
  private maxLogs: number;
  private startTime: number;

  constructor(maxLogs = 500) {
    this.maxLogs = maxLogs;
    this.startTime = Date.now();
  }

  /**
   * Log an event with automatic PII redaction on message and metadata.
   */
  public log(level: TelemetryLogEntry['level'], category: string, message: string, metadata?: Record<string, any>): TelemetryLogEntry {
    const sanitizedMessage = redactPIIString(message);
    const sanitizedMetadata = metadata ? redactPII(metadata) : undefined;

    const entry: TelemetryLogEntry = {
      id: `TLOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message: sanitizedMessage,
      metadata: sanitizedMetadata,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    return entry;
  }

  public info(category: string, message: string, metadata?: Record<string, any>): TelemetryLogEntry {
    return this.log('info', category, message, metadata);
  }

  public warn(category: string, message: string, metadata?: Record<string, any>): TelemetryLogEntry {
    return this.log('warn', category, message, metadata);
  }

  public error(category: string, message: string, metadata?: Record<string, any>): TelemetryLogEntry {
    return this.log('error', category, message, metadata);
  }

  public audit(category: string, message: string, metadata?: Record<string, any>): TelemetryLogEntry {
    return this.log('audit', category, message, metadata);
  }

  public getLogs(): TelemetryLogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
  }

  /**
   * Generates system diagnostic snapshot.
   */
  public getDiagnosticSnapshot(): DiagnosticSnapshot {
    return {
      systemVersion: 'ClinicFlow-v3.4.0',
      nodeVersion: process.version,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsage: process.memoryUsage(),
      totalLogsLogged: this.logs.length,
      recentLogs: this.logs.slice(-20),
    };
  }
}
