/**
 * syncEngine.js — Universal Real-Time Cloud & Offline-First Auto-Sync Engine
 * Features:
 * 1. Finite State Machine (FSM): IDLE, SYNCING_PUSH, SYNCING_PULL, OFFLINE, ERROR, CONFLICT, DEAD_LETTER
 * 2. Idempotent batch mutation pushes (POST /api/v1/sync/push) with retry count & dead-letter queue
 * 3. Domain-specific conflict resolution and safe pull hydration
 * 4. Automatic periodic heartbeat beacon (POST /api/v1/telemetry/heartbeat)
 * 5. Background state poller on window focus & online event
 * 6. Multi-device fleet telemetry and real-time synchronization
 */

import {
  dbOutbox,
  KEYS,
  getDeviceId,
} from "./db.js";

import { telemetry } from "./telemetry.js";
import { storageDriver } from "./storageDriver.js";

export function getActiveServerUrl() {
  try {
    if (typeof localStorage !== "undefined") {
      const custom = localStorage.getItem("cf_custom_api_url");
      if (custom && custom.trim()) return custom.trim().replace(/\/$/, "");
    }
  } catch (_) {}
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location.origin && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1") && !window.location.hostname.includes("tauri")) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "https://api.clinicore.me";
}

export const FALLBACK_ENDPOINTS = [
  "https://api.clinicore.me",
  "https://clinicore.me",
  "http://77.37.45.233:5000",
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

class SyncEngine {
  constructor() {
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.isSyncing = false;
    this.fsmState = SYNC_FSM_STATES.IDLE;
    this.pushTimer = null;
    this.pollInterval = null;
    this.heartbeatInterval = null;
    this.lastStateHash = "";
    this.lastErrorMessage = null;
    this.retryAttempt = 0;
    this.subscribers = new Set();
    this.lastSyncTime = typeof localStorage !== "undefined" ? localStorage.getItem("cf_last_sync_time") || null : null;
    this.serverTimeOffsetMs = 0;
    this.init();
  }

  init() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.handleNetworkChange(true);
        this.forceSyncNow();
      });
      window.addEventListener("offline", () => {
        this.handleNetworkChange(false);
      });
      window.addEventListener("focus", () => {
        if (this.isOnline) {
          this.pullLatestCloudState();
          this.processOutbox();
        }
      });
      this.startBackgroundPoller();
    }
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

  handleNetworkChange(onlineStatus) {
    this.isOnline = onlineStatus;
    this.setState(onlineStatus ? SYNC_FSM_STATES.IDLE : SYNC_FSM_STATES.OFFLINE);
  }

  // --------------------------------------------------------------------------
  // Heartbeat Telemetry & Background Poller
  // --------------------------------------------------------------------------

  async sendDeviceHeartbeat() {
    if (!this.isOnline) return;
    try {
      const serverUrl = getActiveServerUrl();
      const devId = typeof getDeviceId === "function" ? getDeviceId() : "dev_unknown";

      let userObj = null;
      try {
        const rawUser = localStorage.getItem("cf_current_user") || sessionStorage.getItem("cf_auth_session");
        if (rawUser) userObj = JSON.parse(rawUser);
      } catch (_) {}

      const allOutbox = dbOutbox?.getAll?.() || [];
      const pendingItems = allOutbox.filter((m) => m.status === "pending" || m.status === "sending");

      const payload = {
        device_id: devId,
        device_name: (typeof window !== "undefined" && window.__TAURI__ ? "Desktop App (Tauri)" : "Web Browser") + (typeof navigator !== "undefined" ? ` (${navigator.platform || "PC"})` : ""),
        user_name: userObj?.name || userObj?.username || "Staff Terminal",
        user_role: userObj?.role || "staff",
        app_version: (typeof globalThis !== "undefined" && globalThis.__APP_SEMVER__) || (typeof localStorage !== "undefined" && localStorage.getItem("cf_applied_version")) || "2.5.9",
        platform: typeof window !== "undefined" && window.__TAURI__ ? "Desktop (Windows Tauri)" : "Web Browser SPA",
        pending_outbox_count: pendingItems.length,
        last_sync_time: this.lastSyncTime || new Date().toISOString(),
      };

      await fetch(`${serverUrl}/api/v1/telemetry/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      }).catch(() => null);
    } catch (_) {}
  }

  schedulePush() {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.processOutbox();
    }, 300);
  }

  startBackgroundPoller() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    // Poll every 25 seconds
    this.pollInterval = setInterval(() => {
      if (this.isOnline && typeof document !== "undefined" && document.visibilityState === "visible") {
        this.pullLatestCloudState();
        this.processOutbox();
      }
    }, 25000);

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendDeviceHeartbeat();
    }, 30000);

    // Initial check after 1.5 seconds
    setTimeout(() => {
      this.pullLatestCloudState();
      this.processOutbox();
      this.sendDeviceHeartbeat();
    }, 1500);
  }

  // --------------------------------------------------------------------------
  // Core Push & Pull Synchronization Workers
  // --------------------------------------------------------------------------

  async processOutbox() {
    if (!this.isOnline || this.isSyncing) return;
    const allOutbox = dbOutbox?.getAll?.() || [];
    const pendingItems = allOutbox.filter((m) => m.status === "pending" || m.status === "sending");
    if (pendingItems.length === 0) return;

    this.setState(SYNC_FSM_STATES.SYNCING_PUSH);
    const serverUrl = getActiveServerUrl();

    try {
      pendingItems.forEach((m) => { m.status = "sending"; });
      storageDriver.setItem(KEYS.OUTBOX, JSON.stringify(allOutbox));

      const res = await fetch(`${serverUrl}/api/v1/sync/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutations: pendingItems }),
        cache: "no-store",
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        const results = json?.data?.results || [];
        const resultMap = new Map(results.map((r) => [r.mutation_id, r]));

        pendingItems.forEach((m) => {
          const mId = m.mutation_id || m.id;
          const r = resultMap.get(mId);
          if (!r || r.status === "confirmed") {
            dbOutbox.markSynced(mId);
          } else if (r.status === "rejected") {
            m.status = "dead_letter";
            m.last_error = r.reason || "Server rejected mutation";
          }
        });

        this.retryAttempt = 0;
        this.lastSyncTime = new Date().toISOString();
        try { localStorage.setItem("cf_last_sync_time", this.lastSyncTime); } catch (_) {}
        this.setState(SYNC_FSM_STATES.IDLE);
      } else {
        pendingItems.forEach((m) => {
          m.status = "failed";
          m.retry_count = (m.retry_count || 0) + 1;
          m.last_error = `HTTP ${res?.status || "network_error"}`;
          if (m.retry_count >= MAX_RETRIES) {
            m.status = "dead_letter";
          }
        });
        storageDriver.setItem(KEYS.OUTBOX, JSON.stringify(allOutbox));
        this.setState(SYNC_FSM_STATES.ERROR, `Push failed: HTTP ${res?.status || "err"}`);
      }
    } catch (err) {
      pendingItems.forEach((m) => {
        m.status = "failed";
        m.retry_count = (m.retry_count || 0) + 1;
        m.last_error = err.message;
      });
      storageDriver.setItem(KEYS.OUTBOX, JSON.stringify(allOutbox));
      this.setState(SYNC_FSM_STATES.ERROR, err.message);
    } finally {
      this.sendDeviceHeartbeat().catch(() => {});
    }
  }

  async pullLatestCloudState() {
    if (!this.isOnline || this.isSyncing) return;
    this.setState(SYNC_FSM_STATES.SYNCING_PULL);
    const serverUrl = getActiveServerUrl();

    try {
      const res = await fetch(`${serverUrl}/api/v1/system/sync-state?_t=${Date.now()}`, {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        const cloudData = json?.data;
        if (cloudData && typeof cloudData === "object") {
          const syncKeys = [
            "cf_patients_v5", "cf_visits_v5", "cf_sales_v5", "cf_b2b_sales_v5",
            "cf_inventory_v5", "cf_purchases_v5", "cf_suppliers_v5", "cf_parties_v5",
            "cf_salesmen_v5", "cf_warehouses_v6", "cf_accounts_v6", "cf_cashbook_v6",
            "cf_expenses_v5", "cf_users_v5", "cf_clinic_v5"
          ];

          for (const k of syncKeys) {
            if (Array.isArray(cloudData[k]) && cloudData[k].length > 0) {
              const localRaw = storageDriver.getItem(k);
              let parsedLocal = [];
              try { parsedLocal = localRaw ? JSON.parse(localRaw) : []; } catch (_) {}

              if (parsedLocal.length === 0) {
                storageDriver.setItem(k, JSON.stringify(cloudData[k]));
              } else {
                const localMap = new Map(parsedLocal.map((item) => [item.id, item]));
                cloudData[k].forEach((serverItem) => {
                  if (serverItem && serverItem.id) {
                    if (!localMap.has(serverItem.id)) {
                      parsedLocal.unshift(serverItem);
                    } else {
                      const existing = localMap.get(serverItem.id);
                      const sTime = new Date(serverItem.updated_at || serverItem.created_at || 0).getTime();
                      const lTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
                      if (sTime >= lTime) {
                        localMap.set(serverItem.id, { ...existing, ...serverItem });
                      }
                    }
                  }
                });
                storageDriver.setItem(k, JSON.stringify(parsedLocal));
              }
            } else if (cloudData[k] && typeof cloudData[k] === "object" && !Array.isArray(cloudData[k])) {
              storageDriver.setItem(k, JSON.stringify(cloudData[k]));
            }
          }
          this.lastSyncTime = new Date().toISOString();
          try { localStorage.setItem("cf_last_sync_time", this.lastSyncTime); } catch (_) {}
        }
        this.setState(SYNC_FSM_STATES.IDLE);
      } else {
        this.setState(SYNC_FSM_STATES.IDLE);
      }
    } catch (err) {
      this.setState(SYNC_FSM_STATES.ERROR, err.message);
    } finally {
      this.sendDeviceHeartbeat().catch(() => {});
    }
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
    await this.pullLatestCloudState();
    await this.processOutbox();
    await this.sendDeviceHeartbeat();
    return { success: true, timestamp: this.lastSyncTime };
  }
}

export const syncEngine = new SyncEngine();
