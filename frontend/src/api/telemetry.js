/**
 * telemetry.js — Production Observability, Privacy-Safe Error Tracking & Sync Health
 */

import { APP_CONFIG } from '../utils/version.js';

const TELEMETRY_CONFIG = {
  APP_NAME: 'ClinicFlow-Desktop-Hybrid',
  MAX_RING_BUFFER: 50,
  BATCH_FLUSH_INTERVAL_MS: 30000,
  MAX_BATCH_SIZE: 15,
};

// Masking Regexes
const PATTERNS = {
  CNIC: /\b\d{5}[-\s]?\d{7}[-\s]?\d\b/g,
  PHONE_PK: /\b(?:(?:\+92|0092|0)?3[0-9]{2})[-\s]?[0-9]{7}\b/g,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  JWT_BEARER: /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi,
  CARD_NUM: /\b(?:\d[ -]*?){13,16}\b/g,
};

const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /token/i,
  /auth/i,
  /secret/i,
  /cnic/i,
  /phone/i,
  /mobile/i,
  /patient_?name/i,
  /guardian/i,
  /symptoms/i,
  /diagnosis/i,
  /prescription/i,
  /balance/i,
  /cash/i,
  /total/i,
];

export function sanitizeData(data, depth = 0) {
  if (depth > 5) return '[MAX_DEPTH]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return data
      .replace(PATTERNS.JWT_BEARER, 'Bearer [TOKEN_REDACTED]')
      .replace(PATTERNS.CNIC, '[CNIC_REDACTED]')
      .replace(PATTERNS.PHONE_PK, '[PHONE_REDACTED]')
      .replace(PATTERNS.EMAIL, '[EMAIL_REDACTED]')
      .replace(PATTERNS.CARD_NUM, '[CARD_REDACTED]');
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const scrubbed = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
      if (isSensitiveKey) {
        scrubbed[key] = '[REDACTED]';
      } else {
        scrubbed[key] = sanitizeData(value, depth + 1);
      }
    }
    return scrubbed;
  }

  return String(data);
}

class TelemetryEngine {
  constructor() {
    this.buffer = [];
    this.breadcrumbs = [];
    this.metrics = {
      apiErrorsCount: 0,
      syncFailuresCount: 0,
      unhandledExceptionsCount: 0,
      indexedDbErrorsCount: 0,
      lastSuccessfulSync: null,
      serverLatencyMs: 0,
      pendingOutbox: 0,
      failedMutations: 0,
      conflictCount: 0,
      networkStatus: typeof navigator !== 'undefined' ? (navigator.onLine ? 'online' : 'offline') : 'online',
    };
    this.subscribers = new Set();
    this.isInitialized = false;
    this.flushTimer = null;
  }

  init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    try {
      const stored = sessionStorage.getItem('cf_telemetry_ring');
      if (stored) {
        this.buffer = JSON.parse(stored).slice(-TELEMETRY_CONFIG.MAX_RING_BUFFER);
      }
    } catch (_) {}

    window.addEventListener('error', (event) => {
      this.recordError('UNHANDLED_WINDOW_ERROR', event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.recordError('UNHANDLED_PROMISE_REJECTION', event.reason || 'Unhandled rejection', {
        reasonType: typeof event.reason,
      });
    });

    window.addEventListener('online', () => {
      this.metrics.networkStatus = 'online';
      this.addBreadcrumb('network', 'Connection state changed: ONLINE');
    });

    window.addEventListener('offline', () => {
      this.metrics.networkStatus = 'offline';
      this.addBreadcrumb('network', 'Connection state changed: OFFLINE');
    });
  }

  addBreadcrumb(category, message, metadata = {}) {
    const item = {
      timestamp: new Date().toISOString(),
      category,
      message: sanitizeData(message),
      metadata: sanitizeData(metadata),
    };
    this.breadcrumbs.push(item);
    if (this.breadcrumbs.length > 25) {
      this.breadcrumbs.shift();
    }
  }

  recordError(type, error, extra = {}) {
    const errorObj = error instanceof Error ? error : new Error(String(error || 'Unknown error'));
    const entry = {
      id: 'err_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      type,
      name: errorObj.name || 'Error',
      message: sanitizeData(errorObj.message || 'Unknown error'),
      stack: sanitizeData(errorObj.stack || ''),
      extra: sanitizeData(extra),
      breadcrumbs: [...this.breadcrumbs],
      appVersion: APP_CONFIG.FULL_VERSION,
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      url: typeof window !== 'undefined' ? window.location?.pathname : '/',
    };

    if (type.includes('API')) this.metrics.apiErrorsCount++;
    if (type.includes('SYNC')) this.metrics.syncFailuresCount++;
    if (type.includes('INDEXEDDB')) this.metrics.indexedDbErrorsCount++;
    if (type.includes('UNHANDLED')) this.metrics.unhandledExceptionsCount++;

    this.pushToBuffer(entry);
    this.notifySubscribers();
  }

  recordSyncMetric({ status, pendingCount, failedCount, conflictCount, latencyMs, lastSyncTime }) {
    if (pendingCount !== undefined) this.metrics.pendingOutbox = pendingCount;
    if (failedCount !== undefined) this.metrics.failedMutations = failedCount;
    if (conflictCount !== undefined) this.metrics.conflictCount = conflictCount;
    if (latencyMs) this.metrics.serverLatencyMs = Math.round(latencyMs);
    if (lastSyncTime) this.metrics.lastSuccessfulSync = lastSyncTime;

    this.addBreadcrumb('sync', 'Sync status: ' + status + ', Pending: ' + (pendingCount || 0) + ', Failed: ' + (failedCount || 0));
    this.notifySubscribers();
  }

  pushToBuffer(entry) {
    this.buffer.push(entry);
    if (this.buffer.length > TELEMETRY_CONFIG.MAX_RING_BUFFER) {
      this.buffer.shift();
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('cf_telemetry_ring', JSON.stringify(this.buffer));
      }
    } catch (_) {}
  }

  getDiagnosticSnapshot() {
    return {
      app: TELEMETRY_CONFIG.APP_NAME,
      version: APP_CONFIG.FULL_VERSION,
      build_id: APP_CONFIG.BUILD_ID,
      schema_version: APP_CONFIG.SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      metrics: { ...this.metrics },
      recentErrors: [...this.buffer],
      breadcrumbs: [...this.breadcrumbs],
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Test',
      screenResolution: typeof window !== 'undefined' && window.screen ? window.screen.width + 'x' + window.screen.height : 'N/A',
    };
  }

  exportDiagnosticBundleAsJson() {
    const data = this.getDiagnosticSnapshot();
    if (typeof Blob === 'undefined' || typeof document === 'undefined') return data;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clinicflow_telemetry_' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    return data;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    try {
      callback(this.getDiagnosticSnapshot());
    } catch (_) {}
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers() {
    const snapshot = this.getDiagnosticSnapshot();
    this.subscribers.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (_) {}
    });
  }
}

export const telemetry = new TelemetryEngine();
telemetry.init();
