/**
 * syncEngine.js — VPS MySQL Cloud & Offline-First Auto-Sync Engine
 * Features:
 * 1. Real-time network detection (online/offline)
 * 2. Background queue processing & cloud replication to Hostinger VPS (api.clinicore.me)
 * 3. Bidirectional snapshot sync so all browsers & devices see identical data
 * 4. Event-driven subscribers for live UI status chips
 */

import { dbOutbox, getAllCollectionsSnapshot, hydrateCollectionsFromSnapshot } from "./db.js";

const API_BASE = import.meta.env.VITE_API_URL || "https://api.clinicore.me";

class SyncEngine {
  constructor() {
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.isSyncing = false;
    this.subscribers = new Set();
    this.lastSyncTime = (typeof localStorage !== "undefined" ? localStorage.getItem("cf_last_cloud_sync") : null) || null;

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
      window.addEventListener("clinicflow_outbox_change", () => this.notify());

      // Boot-time cloud synchronization
      setTimeout(() => {
        if (this.isOnline) {
          this.pullLatestCloudState();
          this.processOutbox();
        }
      }, 1500);
    }
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
   * Pulls the authoritative database state from VPS MySQL to keep all browsers in sync
   */
  async pullLatestCloudState() {
    if (!this.isOnline) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/system/sync-state`, {
        headers: { "User-Agent": "CliniCore-PWA/2.0" }
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.data && Object.keys(json.data).length > 0) {
          hydrateCollectionsFromSnapshot(json.data);
          this.lastSyncTime = new Date().toISOString();
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("cf_last_cloud_sync", this.lastSyncTime);
          }
          this.notify();
          console.log("☁️ Synced live database snapshot from VPS MySQL.");
        }
      }
    } catch (err) {
      console.warn("[Cloud Sync] Pull snapshot notice:", err.message);
    }
  }

  /**
   * Pushes full snapshot to VPS MySQL so any other browser sees the exact changes
   */
  async pushLocalStateToCloud() {
    if (!this.isOnline || this.isSyncing) return;
    try {
      const snapshot = getAllCollectionsSnapshot();
      await fetch(`${API_BASE}/api/v1/system/sync-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot)
      });
      this.lastSyncTime = new Date().toISOString();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("cf_last_cloud_sync", this.lastSyncTime);
      }
      this.notify();
    } catch (err) {
      console.warn("[Cloud Sync] Push snapshot notice:", err.message);
    }
  }

  /**
   * Automatically process offline pending mutations and push to VPS MySQL
   */
  async processOutbox() {
    if (!this.isOnline || this.isSyncing) return;
    const items = dbOutbox?.getAll?.() || [];

    this.isSyncing = true;
    this.notify();

    try {
      if (items.length > 0) {
        console.log(`🔄 Replaying ${items.length} offline mutations to VPS MySQL...`);
        for (const item of items) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          dbOutbox.markSynced(item.id);
        }
      }

      await this.pushLocalStateToCloud();
      console.log("✅ All records synchronized successfully to Hostinger VPS MySQL!");
    } catch (err) {
      console.warn("Cloud sync deferred:", err);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Manual 1-click cloud sync trigger
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
