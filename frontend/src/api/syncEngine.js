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
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.isSyncing = false;
    this.fsmState = this.isOnline ? SYNC_FSM_STATES.IDLE : SYNC_FSM_STATES.OFFLINE;
    this.pushTimer = null;
    this.pollInterval = null;
    this.healthInterval = null;
    this.lastStateHash = "";
    this.lastErrorMessage = null;
    this.retryAttempt = 0;
    this.subscribers = new Set();
    this.lastSyncTime =
      (typeof localStorage !== "undefined" ? storageDriver.getItem("cf_last_cloud_sync") : null) || null;
    this.serverTimeOffsetMs = 0;
    this.enableSnapshotSyncFallback = true;

    // Register write hook with db.js for automatic debounced synchronization
    registerCollectionChangeHook(() => {
      this.schedulePush(150);
    });

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
      window.addEventListener("clinicflow_outbox_change", () => this.notify());

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && this.isOnline) {
          this.pullLatestCloudState();
        }
      });

      window.addEventListener("focus", () => {
        if (this.isOnline) {
          this.pullLatestCloudState();
        }
      });

      // Eager initial boot-time sync & clock calibration
      this.calibrateServerTime().then(() => {
        this.pullLatestCloudState().then(() => {
          this.processOutbox();
        });
      });

      this.startBackgroundPoller();
      this.startHealthProber();
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

  // --------------------------------------------------------------------------
  // Network Listeners & Active Health Probing
  // --------------------------------------------------------------------------

  handleNetworkChange(onlineStatus) {
    this.isOnline = onlineStatus;
    if (this.isOnline) {
      this.setState(SYNC_FSM_STATES.IDLE);
      this.retryAttempt = 0;
      this.calibrateServerTime();
      this.pullLatestCloudState();
      this.processOutbox();
    } else {
      this.setState(SYNC_FSM_STATES.OFFLINE);
    }
  }

  startBackgroundPoller() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        this.isOnline &&
        !this.isSyncing &&
        !this.pushTimer
      ) {
        this.pullLatestCloudState();
      }
    }, 4000);
  }

  startHealthProber() {
    if (this.healthInterval) clearInterval(this.healthInterval);
    this.healthInterval = setInterval(() => {
      if (!this.isSyncing) {
        this.checkCloudHealth();
      }
    }, 15000);
  }

  async checkCloudHealth() {
    try {
      const endpoints = [
        `${API_BASE}/api/v1/time`,
        "https://api.clinicore.me/api/v1/time",
        "https://clinicore.me/api/v1/time",
      ];
      let reachable = false;
      for (const ep of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(ep, { signal: controller.signal, cache: "no-store" });
          clearTimeout(timeoutId);
          if (res.ok) {
            reachable = true;
            break;
          }
        } catch (_) {}
      }

      if (reachable) {
        if (!this.isOnline) this.handleNetworkChange(true);
      } else {
        if (this.isOnline && typeof navigator !== "undefined" && !navigator.onLine) {
          this.handleNetworkChange(false);
        }
      }
    } catch {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        this.handleNetworkChange(false);
      }
    }
  }

  async calibrateServerTime() {
    try {
      const startMs = Date.now();
      const res = await fetch(`${API_BASE}/api/v1/time`);
      if (res.ok) {
        const json = await res.json();
        const endMs = Date.now();
        const latency = (endMs - startMs) / 2;
        if (json?.data?.epoch_ms) {
          const serverEpoch = json.data.epoch_ms + latency;
          this.serverTimeOffsetMs = serverEpoch - Date.now();
        }
      }
    } catch {}
  }

  getCalibratedPKTIsoString() {
    const calibratedEpoch = Date.now() + this.serverTimeOffsetMs;
    return new Date(calibratedEpoch).toISOString();
  }

  // --------------------------------------------------------------------------
  // Push Pipeline (Batched Mutations & Idempotency)
  // --------------------------------------------------------------------------

  schedulePush(delayMs = 250) {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.processOutbox();
    }, delayMs);
  }

  calculateBackoffMs() {
    const exp = Math.min(this.retryAttempt, 5);
    const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, exp));
    const jitter = Math.random() * 500;
    return delay + jitter;
  }

  async processOutbox() {
    if (!this.isOnline || this.isSyncing) return;
    const allOutbox = dbOutbox?.getAll?.() || [];
    // Reset any orphaned "sending" items from prior crashes to "pending"
    const pendingMutations = allOutbox.filter((m) => m.status === "pending" || m.status === "failed" || m.status === "sending");

    if (pendingMutations.length === 0) {
      if (this.enableSnapshotSyncFallback) {
        await this.pushLocalStateToCloud();
      }
      return;
    }

    this.setState(SYNC_FSM_STATES.SYNCING_PUSH);

    try {
      // 1. Mark batch as sending
      const sendingIds = new Set(pendingMutations.map((m) => m.mutation_id || m.id));
      const inFlightOutbox = (dbOutbox?.getAll?.() || []).map((m) => {
        if (sendingIds.has(m.mutation_id || m.id)) {
          return { ...m, status: "sending" };
        }
        return m;
      });
      storageDriver.setItem(KEYS.OUTBOX, JSON.stringify(inFlightOutbox));
      this.notify();

      // 2. Transmit batch to /api/v1/sync/push
      const token = storageDriver.getItem("cf_vps_jwt");
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/v1/sync/push`, {
        method: "POST",
        headers,
        body: JSON.stringify({ mutations: pendingMutations }),
      });

      if (res.ok) {
        const json = await res.json();
        const resultsMap = new Map((json?.data?.results || []).map((r) => [r.mutation_id, r]));

        // Read fresh outbox to prevent clobbering in-flight user entries
        const freshOutbox = dbOutbox?.getAll?.() || [];
        const updatedOutbox = freshOutbox.filter((m) => {
          const mId = m.mutation_id || m.id;
          if (!sendingIds.has(mId)) return true; // Keep newly created mutations intact!
          const resItem = resultsMap.get(mId);
          if (resItem) {
            if (resItem.status === "confirmed") return false; // Successfully synced -> remove
            if (resItem.status === "rejected") {
              m.status = "dead_letter";
              m.last_error = resItem.reason || "Rejected by server";
              return true;
            }
          }
          return false; // Default remove successfully acknowledged
        });

        storageDriver.setItem(KEYS.OUTBOX, JSON.stringify(updatedOutbox));
        this.retryAttempt = 0;
        this.lastSyncTime = new Date().toISOString();
        if (typeof localStorage !== "undefined") {
          storageDriver.setItem("cf_last_cloud_sync", this.lastSyncTime);
        }
        this.setState(SYNC_FSM_STATES.IDLE);
      } else {
        throw new Error(`Sync push server error (${res.status})`);
      }
    } catch (err) {
      console.warn("Outbox push notice:", err.message);
      this.retryAttempt++;

      // Update retry count and check for dead letter threshold
      const updatedOutbox = (dbOutbox?.getAll?.() || []).map((m) => {
        if (m.status === "sending") {
          const retries = (m.retry_count || 0) + 1;
          return {
            ...m,
            status: retries >= MAX_RETRIES ? "dead_letter" : "failed",
            retry_count: retries,
            last_error: err.message,
          };
        }
        return m;
      });

      storageDriver.setItem(KEYS.OUTBOX, JSON.stringify(updatedOutbox));
      const hasDeadLetters = updatedOutbox.some((m) => m.status === "dead_letter");
      this.setState(hasDeadLetters ? SYNC_FSM_STATES.DEAD_LETTER : SYNC_FSM_STATES.ERROR, err.message);

      // Schedule exponential backoff retry
      const backoffMs = this.calculateBackoffMs();
      setTimeout(() => {
        if (this.isOnline && !this.isSyncing) this.processOutbox();
      }, backoffMs);
    }
  }

  async pushLocalStateToCloud() {
    if (!this.isOnline) return;
    try {
      const snapshot = getAllCollectionsSnapshot();
      const payloadStr = JSON.stringify(snapshot);

      if (payloadStr === this.lastStateHash) return;

      const token = storageDriver.getItem("cf_vps_jwt");
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/v1/system/sync-state`, {
        method: "POST",
        headers,
        body: payloadStr,
      });

      if (res.ok) {
        this.lastStateHash = payloadStr;
        this.lastSyncTime = new Date().toISOString();
        if (typeof localStorage !== "undefined") {
          storageDriver.setItem("cf_last_cloud_sync", this.lastSyncTime);
        }
        this.notify();
      }
    } catch (err) {
      console.warn("[Cloud Sync] Snapshot push notice:", err.message);
    }
  }

  // --------------------------------------------------------------------------
  // Pull Pipeline (Domain 3-Way Merge & Dirty Record Protection)
  // --------------------------------------------------------------------------

  async pullLatestCloudState() {
    if (!this.isOnline || this.isSyncing || this.pushTimer) return;
    this.setState(SYNC_FSM_STATES.SYNCING_PULL);

    try {
      // 1. Pull Config & Licensing (Domain 5: Server Supremacy)
      try {
        const token = storageDriver.getItem("cf_vps_jwt");
        const headers = {
          "User-Agent": "CliniCore-PWA/2.0",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const cfgRes = await fetch(`${API_BASE}/api/v1/system/config`, {
          headers,
        });
        if (cfgRes.ok) {
          const cfgJson = await cfgRes.json();
          if (cfgJson?.success && cfgJson?.data?.clinic) {
            const sClinic = cfgJson.data.clinic;
            const currentLic = dbLicense.get();
            const reconciled = reconcileSystemSettings(
              { clinic: sClinic, license: currentLic },
              { clinic: sClinic, license: cfgJson.data.license || currentLic }
            );
            if (reconciled.license) {
              storageDriver.setItem(KEYS.LICENSE, JSON.stringify(reconciled.license));
            }
          }
        }
      } catch {}

      // 2. Pull Relational State from VPS Single Source of Truth
      const token = storageDriver.getItem("cf_vps_jwt");
      const headers = {
        "User-Agent": "CliniCore-PWA/2.0",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/v1/system/sync-state`, {
        headers,
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.data && typeof json.data === "object") {
          const remoteData = json.data;

          // ── VPS-PRIMARY AUTHORITY: Overwrite local data with VPS data ──
          // VPS is the single source of truth. All collections are overwritten.
          // Exception: records with pending outbox mutations are protected
          //   (their pending-write fields are preserved locally until sync confirms).

          // Get IDs of records with pending mutations (protect dirty local records)
          const pendingOutbox = dbOutbox?.getAll?.() || [];
          const pendingIds = new Set(
            pendingOutbox
              .filter((m) => m.status === "pending" || m.status === "sending")
              .map((m) => m.entity_id || m.payload?.id)
              .filter(Boolean)
          );

          // ── A. Patients — VPS wins; protect records with pending outbox mutations ──
          if (Array.isArray(remoteData[KEYS.PATIENTS])) {
            const localPatients = dbPatients.getAll();
            const localMap = new Map(localPatients.map((p) => [p.id, p]));
            const merged = remoteData[KEYS.PATIENTS].map((remPat) => {
              if (pendingIds.has(remPat.id) && localMap.has(remPat.id)) {
                // Merge: VPS base + local pending edits on top
                return mergePatientEntity(remPat, localMap.get(remPat.id), remPat, getDeviceId());
              }
              return remPat;
            });
            // Add any local-only patients not yet pushed (pending creates)
            for (const locPat of localPatients) {
              if (!remoteData[KEYS.PATIENTS].find((p) => p.id === locPat.id) && pendingIds.has(locPat.id)) {
                merged.push(locPat);
              }
            }
            setCollection(KEYS.PATIENTS, merged);
            storageDriver.setItem("cf_patients_base_sync", JSON.stringify(merged));
          }

          // ── B. All other collections — direct VPS overwrite ──
          const directOverwriteKeys = [
            KEYS.INVENTORY,
            KEYS.SALES,
            KEYS.B2B_SALES,
            KEYS.PURCHASES,
            KEYS.EXPENSES,
            KEYS.VISITS,
            KEYS.PARTIES,
            KEYS.SUPPLIERS,
            KEYS.SALESMEN,
            KEYS.CASHBOOK,
            KEYS.STOCK_TRANSFERS,
            KEYS.SHIFT_CLOSINGS,
            KEYS.PATIENT_LEDGER,
            KEYS.SUPPLIER_LEDGER,
            KEYS.RETURNS,
            KEYS.STOCK_MOVEMENTS,
            KEYS.WAREHOUSES,
            KEYS.USERS,
            KEYS.CLINIC,
          ];

          const catalogKeys = new Set([KEYS.INVENTORY, KEYS.PARTIES, KEYS.SUPPLIERS, KEYS.ACCOUNTS, KEYS.WAREHOUSES]);

          for (const key of directOverwriteKeys) {
            if (remoteData[key] !== undefined && remoteData[key] !== null) {
              const remoteVal = remoteData[key];
              if (Array.isArray(remoteVal)) {
                if (remoteVal.length === 0 && catalogKeys.has(key)) {
                  // If VPS returns empty array for catalog items, do NOT wipe local master catalog seeds!
                  continue;
                }
                
                // Merge any in-flight pending outbox items that haven't been acknowledged on server yet
                const localItems = (typeof localStorage !== "undefined" ? JSON.parse(storageDriver.getItem(key) || "[]") : []);
                const remoteIds = new Set(remoteVal.map((r) => r && r.id).filter(Boolean));
                const pendingLocals = Array.isArray(localItems)
                  ? localItems.filter((it) => it && it.id && pendingIds.has(it.id) && !remoteIds.has(it.id))
                  : [];
                
                const finalCollection = [...pendingLocals, ...remoteVal];
                setCollection(key, finalCollection);
              } else if (remoteVal && typeof remoteVal === "object" && !Array.isArray(remoteVal)) {
                // Singleton object (clinic config)
                storageDriver.setItem(key, JSON.stringify(remoteVal));
              }
            }
          }

          this.lastSyncTime = new Date().toISOString();
          if (typeof localStorage !== "undefined") {
            storageDriver.setItem("cf_last_cloud_sync", this.lastSyncTime);
          }
          try {
            window.dispatchEvent(new Event("clinicflow_status_update"));
            window.dispatchEvent(new Event("storage"));
          } catch (e) {}
          this.setState(SYNC_FSM_STATES.IDLE);
        }
      } else {
        if (res.status === 401) {
          storageDriver.removeItem("cf_vps_jwt");
          this.setState(SYNC_FSM_STATES.IDLE);
        } else {
          this.setState(SYNC_FSM_STATES.ERROR, `Pull error: HTTP ${res.status}`);
        }
      }
    } catch (err) {
      console.warn("[Cloud Sync] Pull state notice:", err.message);
      this.setState(SYNC_FSM_STATES.ERROR, err.message);
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
    await this.calibrateServerTime();
    await this.pullLatestCloudState();
    await this.processOutbox();
    return { success: true, timestamp: this.lastSyncTime };
  }
}

export const syncEngine = new SyncEngine();
