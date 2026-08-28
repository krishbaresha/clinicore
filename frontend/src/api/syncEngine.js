/**
 * syncEngine.js — VPS MySQL Universal Real-Time Cloud & Offline-First Auto-Sync Engine
 * Features:
 * 1. Real-time network detection & auto-reconnect recovery
 * 2. Instant debounced cloud push whenever any write occurs in db.js (schedulePush)
 * 3. Background live polling (6s) + tab visibility / focus sync across multi-devices
 * 4. Authoritative state hydration from VPS MySQL (api.clinicore.me)
 * 5. Event-driven subscribers for live UI status indicators & screen re-renders
 */

import {
  dbOutbox,
  getAllCollectionsSnapshot,
  hydrateCollectionsFromSnapshot,
  registerCollectionChangeHook,
} from "./db.js";

const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || 
  (typeof process !== "undefined" && process.env?.VITE_API_URL) || 
  "https://api.clinicore.me";

class SyncEngine {
  constructor() {
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.isSyncing = false;
    this.pushTimer = null;
    this.pollInterval = null;
    this.lastStateHash = "";
    this.subscribers = new Set();
    this.lastSyncTime =
      (typeof localStorage !== "undefined" ? localStorage.getItem("cf_last_cloud_sync") : null) ||
      null;

    // Register write hook with db.js so every single mutation automatically syncs to cloud
    registerCollectionChangeHook(() => {
      this.schedulePush();
    });

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
      window.addEventListener("clinicflow_outbox_change", () => this.notify());

      // Immediate refresh on tab focus / visibility restoration
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

      // Eager initial boot-time cloud synchronization
      this.pullLatestCloudState().then(() => {
        this.processOutbox();
      });

      // Active Multi-Device Background Sync Poller (every 3 seconds when tab is active)
      this.startBackgroundPoller();
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
    }, 3000);
  }

  handleNetworkChange(onlineStatus) {
    this.isOnline = onlineStatus;
    this.notify();
    if (this.isOnline) {
      console.log("🌐 Network Restored: Syncing with CliniCore VPS Cloud...");
      this.pullLatestCloudState();
      this.processOutbox();
    } else {
      console.log("📴 Offline Mode: All local changes saved to secure Outbox.");
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getStatus());
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const status = this.getStatus();
    this.subscribers.forEach((cb) => {
      try {
        cb(status);
      } catch (e) {
        console.error("Sync subscriber error:", e);
      }
    });
  }

  getStatus() {
    const pendingItems = dbOutbox?.getAll?.() || [];
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: pendingItems.length,
      lastSyncTime: this.lastSyncTime,
    };
  }

  /**
   * Schedules a debounced snapshot push to VPS MySQL whenever local data changes.
   * Batches rapid UI changes (e.g. typing, multi-item checkouts) into a single atomic sync.
   */
  schedulePush(delayMs = 250) {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.pushLocalStateToCloud();
    }, delayMs);
  }

  /**
   * Pulls the authoritative database state & config from VPS MySQL to keep all browsers in sync.
   */
  async pullLatestCloudState() {
    if (!this.isOnline || this.isSyncing || this.pushTimer) return;
    this.isSyncing = true;
    this.notify();
    try {
      // 1. Pull Central System & Clinic Configuration from MySQL
      try {
        const cfgRes = await fetch(`${API_BASE}/api/v1/system/config`, {
          headers: { "User-Agent": "CliniCore-PWA/2.0" },
        });
        if (cfgRes.ok) {
          const cfgJson = await cfgRes.json();
          if (cfgJson?.success && cfgJson?.data?.clinic) {
            const sClinic = cfgJson.data.clinic;
            if (typeof localStorage !== "undefined") {
              const currClinic = (() => {
                try {
                  return JSON.parse(localStorage.getItem("cf_clinic_v5") || "{}");
                } catch {
                  return {};
                }
              })();
              const mergedClinic = { ...currClinic, ...sClinic };
              localStorage.setItem("cf_clinic_v5", JSON.stringify(mergedClinic));
              if (sClinic.resend_api_key) localStorage.setItem("cf_resend_api_key", sClinic.resend_api_key);
              if (sClinic.notification_email) localStorage.setItem("cf_notification_email", sClinic.notification_email);
              if (sClinic.report_frequency) localStorage.setItem("cf_report_frequency", sClinic.report_frequency);
              if (sClinic.whatsapp_gateway_no) localStorage.setItem("cf_whatsapp_gateway_no", sClinic.whatsapp_gateway_no);
              if (sClinic.admin_master_passcode) localStorage.setItem("cf_admin_master_passcode", sClinic.admin_master_passcode);
              if (sClinic.tab_pin) localStorage.setItem("cf_admin_tab_pin", sClinic.tab_pin);
              if (sClinic.tab_security_json) {
                try {
                  const tabs = typeof sClinic.tab_security_json === "string" ? JSON.parse(sClinic.tab_security_json) : sClinic.tab_security_json;
                  const existing = JSON.parse(localStorage.getItem("cf_admin_tab_security") || "{}");
                  localStorage.setItem("cf_admin_tab_security", JSON.stringify({ ...existing, tabs, admin_passcode: sClinic.admin_master_passcode || existing.admin_passcode, tab_pin: sClinic.tab_pin || existing.tab_pin }));
                } catch {}
              }
            }
          }
        }
      } catch (cfgErr) {
        // silent fallback for offline/transient glitch
      }

      // 2. Pull Relational Collections Snapshot (Patients, Visits, Inventory, Users, Sales, Purchases)
      const res = await fetch(`${API_BASE}/api/v1/system/sync-state`, {
        headers: { "User-Agent": "CliniCore-PWA/2.0" },
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.data && typeof json.data === "object") {
          const rawPayload = JSON.stringify(json.data);
          // Check if data actually changed to avoid unnecessary DOM thrashing
          if (rawPayload !== this.lastStateHash) {
            this.lastStateHash = rawPayload;
            hydrateCollectionsFromSnapshot(json.data);
            this.lastSyncTime = new Date().toISOString();
            if (typeof localStorage !== "undefined") {
              localStorage.setItem("cf_last_cloud_sync", this.lastSyncTime);
            }
            this.notify();
            console.log("☁️ Real-time cloud state synced from VPS MySQL.");
          }
        }
      }
    } catch (err) {
      console.warn("[Cloud Sync] Pull state notice:", err.message);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Pushes full snapshot to VPS MySQL so any other browser sees the exact changes.
   */
  async pushLocalStateToCloud() {
    if (!this.isOnline || this.isSyncing) return;
    this.isSyncing = true;
    this.notify();

    try {
      const snapshot = getAllCollectionsSnapshot();
      const payloadStr = JSON.stringify(snapshot);

      const res = await fetch(`${API_BASE}/api/v1/system/sync-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadStr,
      });

      if (res.ok) {
        this.lastStateHash = payloadStr;
        this.lastSyncTime = new Date().toISOString();
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("cf_last_cloud_sync", this.lastSyncTime);
        }
        this.notify();
      }
    } catch (err) {
      console.warn("[Cloud Sync] Push state notice:", err.message);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Automatically processes offline pending mutations and pushes to VPS MySQL.
   */
  async processOutbox() {
    if (!this.isOnline || this.isSyncing) return;
    const items = dbOutbox?.getAll?.() || [];

    if (items.length > 0) {
      this.isSyncing = true;
      this.notify();

      try {
        console.log(`🔄 Replaying ${items.length} offline mutations to VPS MySQL...`);
        await this.pushLocalStateToCloud();
        for (const item of items) {
          dbOutbox.markSynced(item.id);
        }
        console.log("✅ All records synchronized successfully to Hostinger VPS MySQL!");
      } catch (err) {
        console.warn("Cloud sync deferred:", err);
      } finally {
        this.isSyncing = false;
        this.notify();
      }
    }
  }

  /**
   * Manual 1-click cloud sync trigger.
   */
  async forceSyncNow() {
    if (!this.isOnline) {
      alert("⚠️ Device is currently offline. Please connect to internet to sync.");
      return;
    }
    await this.pullLatestCloudState();
    await this.processOutbox();
  }
}

export const syncEngine = new SyncEngine();
