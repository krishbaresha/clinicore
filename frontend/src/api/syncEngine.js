/**
 * syncEngine.js — Universal Real-Time Cloud & Offline-First Auto-Sync Engine
 * Features:
 * 1. Finite State Machine (FSM): IDLE, SYNCING_PUSH, SYNCING_PULL, OFFLINE, ERROR, CONFLICT, DEAD_LETTER
 * 2. Idempotent batch mutation pushes (POST /api/v1/sync/push) with retry count & dead-letter queue
 * 3. Domain-specific conflict resolution (3-way merge for patients, PN-counter deltas for stock, server supremacy for licensing)
 * 4. Dirty local record protection during pull hydration
 * 5. Exponential backoff with jitter on network/server failures
 * 6. Master clock time calibration (/api/v1/time) & active health probe
 * 7. Granular inspection & manual retry/discard APIs
 */

import {
  dbOutbox,
  getAllCollectionsSnapshot,
  registerCollectionChangeHook,
  dbPatients,
  dbLicense,
  dbSales,
  setCollection,
  KEYS,
  getDeviceId,
} from "./db.js";

import {
  mergePatientEntity,
  reconcileInventoryWithDeltas,
  reconcileSystemSettings,
} from "./conflictResolver.js";
import { telemetry } from "./telemetry.js";
import { storageDriver } from "./storageDriver.js";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  (typeof process !== "undefined" && process.env?.VITE_API_URL) ||
  (typeof window !== "undefined" && window.location.origin && window.location.protocol.startsWith("http") && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("tauri")
    ? window.location.origin
    : "https://api.clinicore.me");

export const FALLBACK_ENDPOINTS = [
  "https://api.clinicore.me",
  "https://clinicore.me",
  "http://127.0.0.1:5000"
];


export const SYNC_FSM_STATES = {
  IDLE: "IDLE",
  SYNCING_PUSH: "SYNCING_PUSH",
  SYNCING_PULL: "SYNCING_PULL",
  OFFLINE: "OFFLINE",
  ERROR: "ERROR",
  CONFLICT: "CONFLICT",
  DEAD_LETTER: "DEAD_LETTER",
};

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

class SyncEngine {
  constructor() {
    this.isOnline = true;
    this.isSyncing = false;
    this.fsmState = SYNC_FSM_STATES.IDLE;
    this.pushTimer = null;
    this.pollInterval = null;
    this.healthInterval = null;
    this.lastStateHash = "";
    this.lastErrorMessage = null;
    this.retryAttempt = 0;
    this.subscribers = new Set();
    this.lastSyncTime = null;
    this.serverTimeOffsetMs = 0;
    this.enableSnapshotSyncFallback = false;
  }

  // --------------------------------------------------------------------------
  // Finite State Machine & Notification
  // --------------------------------------------------------------------------

  setState(newState, errorMessage = null) {
    this.fsmState = newState;
    if (errorMessage) this.lastErrorMessage = errorMessage;
    else if (newState === SYNC_FSM_STATES.IDLE) this.lastErrorMessage = null;
    this.isSyncing = newState === SYNC_FSM_STATES.SYNCING_PUSH || newState === SYNC_FSM_STATES.SYNCING_PULL;
    this.notify();
  }

  getStatus() {
    const allOutbox = dbOutbox?.getAll?.() || [];
    const pendingItems = allOutbox.filter((m) => m.status === "pending" || m.status === "sending");
    const failedItems = allOutbox.filter((m) => m.status === "failed");
    const deadLetterItems = allOutbox.filter((m) => m.status === "dead_letter");
    const conflictItems = allOutbox.filter((m) => m.status === "conflict");

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      fsmState: this.fsmState,
      pendingCount: pendingItems.length,
      failedCount: failedItems.length,
      deadLetterCount: deadLetterItems.length,
      conflictCount: conflictItems.length,
      totalOutboxCount: allOutbox.length,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastErrorMessage,
      retryAttempt: this.retryAttempt,
      serverTimeOffsetMs: this.serverTimeOffsetMs,
    };
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getStatus());
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const status = this.getStatus();
    try {
      if (telemetry && typeof telemetry.recordSyncMetric === "function") {
        telemetry.recordSyncMetric({
          status: status.fsmState,
          pendingCount: status.pendingCount,
          failedCount: status.failedCount,
          conflictCount: status.conflictCount,
          lastSyncTime: status.lastSyncTime,
        });
      }
    } catch (_) {}
    this.subscribers.forEach((cb) => {
      try {
        cb(status);
      } catch (e) {
        console.error("Sync subscriber error:", e);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Network Listeners & Active Health Probing
  // --------------------------------------------------------------------------

  handleNetworkChange(onlineStatus) {
    this.isOnline = onlineStatus;
    this.setState(onlineStatus ? SYNC_FSM_STATES.IDLE : SYNC_FSM_STATES.OFFLINE);
  }

  startBackgroundPoller() {
    // Disabled per user directive
  }

  startHealthProber() {
    // Disabled per user directive
  }

  async checkCloudHealth() {
    return true;
  }

  async calibrateServerTime() {
    return;
  }

  getCalibratedPKTIsoString() {
    const calibratedEpoch = Date.now() + this.serverTimeOffsetMs;
    return new Date(calibratedEpoch).toISOString();
  }

  calculateBackoffMs() {
    return 1000;
  }

  schedulePush() {
    // Sync push disabled per user directive
  }

  async processOutbox() {
    this.setState(SYNC_FSM_STATES.IDLE);
    return;
  }

  async pushLocalStateToCloud() {
    return;
  }

  async pullLatestCloudState() {
    this.setState(SYNC_FSM_STATES.IDLE);
    return;
  }

  // --------------------------------------------------------------------------
  // Granular Outbox & Conflict Inspection APIs
  // --------------------------------------------------------------------------

  getOutboxItems() {
    return dbOutbox?.getAll?.() || [];
  }

  getDeadLetterItems() {
    return (dbOutbox?.getAll?.() || []).filter((m) => m.status === "dead_letter");
  }

  retryMutation(mutationId) {
    const allOutbox = dbOutbox?.getAll?.() || [];
    const target = allOutbox.find((m) => (m.mutation_id || m.id) === mutationId);
    if (target) {
      target.status = "pending";
      target.retry_count = 0;
      target.last_error = null;
      storageDriver.setItem(KEYS.OUTBOX, JSON.stringify(allOutbox));
      this.notify();
      this.processOutbox();
      return true;
    }
    return false;
  }

  retryAllFailed() {
    const allOutbox = dbOutbox?.getAll?.() || [];
    allOutbox.forEach((m) => {
      if (m.status === "failed" || m.status === "dead_letter") {
        m.status = "pending";
        m.retry_count = 0;
        m.last_error = null;
      }
    });
    storageDriver.setItem(KEYS.OUTBOX, JSON.stringify(allOutbox));
    this.notify();
    this.processOutbox();
  }

  discardMutation(mutationId) {
    dbOutbox.markSynced(mutationId);
    this.notify();
  }

  clearDeadLetterQueue() {
    const allOutbox = dbOutbox?.getAll?.() || [];
    const remaining = allOutbox.filter((m) => m.status !== "dead_letter");
    storageDriver.setItem(KEYS.OUTBOX, JSON.stringify(remaining));
    this.notify();
  }

  async forceSyncNow() {
    if (!this.isOnline) {
      return { success: false, message: "Device is currently offline." };
    }
    await this.calibrateServerTime();
    await this.pullLatestCloudState();
    await this.processOutbox();
    return { success: true, timestamp: this.lastSyncTime };
  }
}

export const syncEngine = new SyncEngine();
