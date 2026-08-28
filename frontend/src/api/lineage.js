/**
 * lineage.js — Automatic Record Lineage & Distributed Provenance Tracking
 */

import { APP_CONFIG } from '../utils/version.js';
import { getDeviceId } from './db.js';

export function getActiveSessionUser() {
  if (typeof sessionStorage === 'undefined' && typeof localStorage === 'undefined') {
    return { id: 'system', name: 'System Automated', role: 'system' };
  }
  try {
    const raw = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('cf_session')) ||
                (typeof localStorage !== 'undefined' && localStorage.getItem('cf_session'));
    if (raw) {
      const sess = JSON.parse(raw);
      return {
        id: sess.userId || sess.id || sess.username || 'system',
        name: sess.name || sess.username || 'Staff User',
        role: sess.role || 'staff',
      };
    }
  } catch (_) {}
  return { id: 'system', name: 'System Automated', role: 'system' };
}

export function decorateRecordLineage(record, operation = 'CREATE') {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;

  const now = new Date().toISOString();
  const deviceId = typeof getDeviceId === 'function' ? getDeviceId() : 'dev_unknown';
  const user = getActiveSessionUser();

  if (operation === 'CREATE') {
    return {
      ...record,
      _client_version: record._client_version || APP_CONFIG.SEMVER,
      _build_id: record._build_id || APP_CONFIG.BUILD_ID,
      _device_id: record._device_id || deviceId,
      _origin_node: record._origin_node || deviceId,
      _created_by: record._created_by || user.id,
      _created_by_name: record._created_by_name || user.name,
      _created_at: record._created_at || record.created_at || now,
      _schema_version: record._schema_version || APP_CONFIG.SCHEMA_VERSION,
      _lineage_hops: Number.isFinite(record._lineage_hops) ? record._lineage_hops : 0,
      created_at: record.created_at || now,
      updated_at: record.updated_at || now,
      _updated_by: user.id,
    };
  }

  return {
    ...record,
    updated_at: now,
    _updated_at: now,
    _updated_by: user.id,
    _last_modified_device: deviceId,
    _client_version: APP_CONFIG.SEMVER,
    _build_id: APP_CONFIG.BUILD_ID,
    _lineage_hops: (Number.isFinite(record._lineage_hops) ? record._lineage_hops : 0) + 1,
  };
}

export function stripLineageMetadata(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  const {
    _client_version,
    _build_id,
    _device_id,
    _origin_node,
    _created_by,
    _created_by_name,
    _created_at,
    _updated_at,
    _updated_by,
    _last_modified_device,
    _schema_version,
    _lineage_hops,
    ...clean
  } = record;
  return clean;
}
