/**
 * version.js — Centralized Application Runtime Version & System Diagnostics
 */

import { getDeviceId } from '../api/db.js';

const g = typeof globalThis !== 'undefined' ? globalThis : {};

export const APP_CONFIG = Object.freeze({
  NAME: 'ClinicFlow (CliniCore) OS',
  SEMVER: typeof g.__APP_SEMVER__ !== 'undefined' ? g.__APP_SEMVER__ : '2.5.38',
  BUILD_HASH: typeof g.__APP_BUILD_HASH__ !== 'undefined' ? g.__APP_BUILD_HASH__ : '7113938',
  BUILD_DATE: typeof g.__APP_BUILD_DATE__ !== 'undefined' ? g.__APP_BUILD_DATE__ : '20260906',
  BUILD_ID: typeof g.__APP_BUILD_ID__ !== 'undefined' ? g.__APP_BUILD_ID__ : '20260906.7113938',
  FULL_VERSION: typeof g.__APP_FULL_VERSION__ !== 'undefined' ? g.__APP_FULL_VERSION__ : 'v2.5.38+build.20260906.7113938',
  BUILD_TIME: typeof g.__APP_BUILD_TIME__ !== 'undefined' ? g.__APP_BUILD_TIME__ : '2026-09-06T00:00:00.000Z',
  SCHEMA_VERSION: typeof g.__TARGET_SCHEMA_VERSION__ !== 'undefined' ? g.__TARGET_SCHEMA_VERSION__ : 4,
  MIN_SERVER_SCHEMA_VERSION: typeof g.__MIN_SERVER_SCHEMA_VERSION__ !== 'undefined' ? g.__MIN_SERVER_SCHEMA_VERSION__ : 3,
});

export function getShortVersionBadge() {
  return 'v' + APP_CONFIG.SEMVER + ' #' + APP_CONFIG.BUILD_HASH;
}

export function getSystemDiagnosticInfo() {
  return {
    app_name: APP_CONFIG.NAME,
    version: APP_CONFIG.SEMVER,
    full_version: APP_CONFIG.FULL_VERSION,
    build_id: APP_CONFIG.BUILD_ID,
    build_hash: APP_CONFIG.BUILD_HASH,
    build_time: APP_CONFIG.BUILD_TIME,
    schema_version: APP_CONFIG.SCHEMA_VERSION,
    device_id: typeof getDeviceId === 'function' ? getDeviceId() : 'dev_unknown',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Test',
    screen_resolution: typeof window !== 'undefined' && window.screen ? window.screen.width + 'x' + window.screen.height : 'Headless/Test',
    storage_type: typeof localStorage !== 'undefined' ? 'LocalStorage+IndexedDB' : 'Memory',
    online_status: typeof navigator !== 'undefined' ? (navigator.onLine ? 'ONLINE' : 'OFFLINE') : 'ONLINE',
  };
}

export function compareSemver(v1, v2) {
  const p1 = String(v1 || '0.0.0').replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = String(v2 || '0.0.0').replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export function getEffectiveVersion() {
  const codeVer = APP_CONFIG.SEMVER || '2.5.38';
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('cf_applied_version');
      if (stored && compareSemver(stored, codeVer) > 0) {
        return stored;
      }
      localStorage.setItem('cf_applied_version', codeVer);
    }
  } catch (_) {}
  return codeVer;
}

export function setEffectiveVersion(version) {
  if (!version) return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cf_applied_version', version);
    }
  } catch (_) {}
}
