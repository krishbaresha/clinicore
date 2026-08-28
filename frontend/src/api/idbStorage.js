/**
 * ClinicFlow — Lightweight IndexedDB Vault Storage Engine
 * High-capacity asynchronous storage for Outbox Mutations, Document Blobs, and Offline Snapshots.
 */

const DB_NAME = "ClinicFlow_Vault_v1";
const DB_VERSION = 1;

let _dbPromise = null;

function getIndexedDBInstance() {
  if (typeof indexedDB !== "undefined") return indexedDB;
  if (typeof window !== "undefined" && window.indexedDB) return window.indexedDB;
  if (typeof globalThis !== "undefined" && globalThis.indexedDB) return globalThis.indexedDB;
  return null;
}

/**
 * Opens or initializes the ClinicFlow IndexedDB instance.
 */
export function openIDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const idb = getIndexedDBInstance();
    if (!idb) {
      // Fallback for environments where IndexedDB is unavailable
      resolve(null);
      return;
    }

    try {
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Outbox Mutations Store
        if (!db.objectStoreNames.contains("outbox")) {
          const outboxStore = db.createObjectStore("outbox", { keyPath: "mutation_id" });
          outboxStore.createIndex("status", "status", { unique: false });
          outboxStore.createIndex("created_at", "created_at", { unique: false });
          outboxStore.createIndex("entity", "entity", { unique: false });
        }

        // 2. Document & Image Blobs Store
        if (!db.objectStoreNames.contains("documents_blobs")) {
          const docStore = db.createObjectStore("documents_blobs", { keyPath: "id" });
          docStore.createIndex("patient_id", "patient_id", { unique: false });
        }

        // 3. Immutable Audit Ledger Store
        if (!db.objectStoreNames.contains("audit_ledger")) {
          const auditStore = db.createObjectStore("audit_ledger", { keyPath: "id" });
          auditStore.createIndex("timestamp", "timestamp", { unique: false });
        }

        // 4. Large Snapshots Store
        if (!db.objectStoreNames.contains("snapshots")) {
          db.createObjectStore("snapshots", { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn("IndexedDB open request error, falling back to memory:", request.error);
        resolve(null);
      };
      request.onblocked = () => {
        console.warn("IndexedDB upgrade blocked by another active tab.");
        resolve(null);
      };
    } catch (err) {
      console.warn("IndexedDB initialization exception:", err);
      resolve(null);
    }
  });

  return _dbPromise;
}

/**
 * Stores a record in a specified IndexedDB store.
 */
export async function idbSet(storeName, item) {
  const db = await openIDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.put(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Retrieves a record by primary key.
 */
export async function idbGet(storeName, key) {
  const db = await openIDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Retrieves all records from a specified store.
 */
export async function idbGetAll(storeName) {
  const db = await openIDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Queries a store by index.
 */
export async function idbQueryByIndex(storeName, indexName, queryValue) {
  const db = await openIDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(queryValue);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Deletes a record from a store.
 */
export async function idbDelete(storeName, key) {
  const db = await openIDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Clears an entire store.
 */
export async function idbClear(storeName) {
  const db = await openIDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
