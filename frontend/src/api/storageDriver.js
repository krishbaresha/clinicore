/**
 * ClinicFlow Unified Storage Driver
 * 
 * Auto-detects runtime environment:
 * - Tauri Desktop → reads/writes JSON files to PC hard drive (unlimited storage)
 * - Browser/PWA   → falls back to localStorage (10MB limit)
 * 
 * All operations are synchronous from the caller's perspective because
 * the in-memory _COLLECTION_CACHE in db.js handles hot reads.
 * Disk writes are fire-and-forget async (Rust IPC) with sync cache update.
 */

// Detect if running inside Tauri Desktop
export const isTauri = typeof window !== "undefined" && Boolean(window.__TAURI__);

// Tauri invoke helper — uses window.__TAURI__ directly (no npm package needed)
let _invoke = null;

async function getInvoke() {
  if (_invoke) return _invoke;
  if (isTauri && window.__TAURI__?.core?.invoke) {
    _invoke = window.__TAURI__.core.invoke;
    return _invoke;
  }
  return null;
}

// Pre-load invoke on module init (non-blocking)
if (isTauri) {
  getInvoke().catch(() => {});
}

/**
 * Synchronous disk cache — mirrors what's on disk so getItem() is instant.
 * Populated on app startup via initDiskCache(), then kept in sync by setItem().
 */
const _diskCache = new Map();
let _diskCacheReady = false;
let _diskCachePromise = null;

/**
 * Initialize disk cache by reading all collection files from disk into memory.
 * Call this once at app startup before initDB().
 */
export async function initDiskCache() {
  if (!isTauri) {
    _diskCacheReady = true;
    return;
  }

  const invoke = await getInvoke();
  if (!invoke) {
    _diskCacheReady = true;
    return;
  }

  try {
    // Get all existing collection keys from disk
    const keys = await invoke("list_collection_keys");
    
    // Read each collection file into cache
    for (const key of keys) {
      try {
        const raw = await invoke("read_collection", { key });
        if (raw && raw.length > 0) {
          _diskCache.set(key, raw);
        }
      } catch (e) {
        console.warn(`[StorageDriver] Failed to read ${key} from disk:`, e);
      }
    }
    
    console.log(`[StorageDriver] Loaded ${_diskCache.size} collections from disk`);
  } catch (e) {
    console.warn("[StorageDriver] Failed to list disk collections:", e);
  }

  _diskCacheReady = true;
}

/**
 * Wait for disk cache to be ready. Used by initDB() on startup.
 */
export async function waitForDiskCache() {
  if (_diskCacheReady) return;
  if (!_diskCachePromise) {
    _diskCachePromise = initDiskCache();
  }
  return _diskCachePromise;
}

/**
 * Unified Storage Driver — drop-in replacement for localStorage.
 * 
 * In Tauri: reads from memory cache (populated from disk on startup),
 *           writes to both memory cache AND disk asynchronously.
 * In Browser: direct localStorage pass-through.
 */
export const storageDriver = {
  /**
   * Read a value by key. Always synchronous (reads from cache).
   * @param {string} key - Collection key (e.g., "cf_patients_v5")
   * @returns {string|null} - Raw JSON string or null
   */
  getItem(key) {
    if (isTauri) {
      const cached = _diskCache.get(key);
      return cached || null;
    }
    return localStorage.getItem(key);
  },

  /**
   * Write a value by key. Synchronous cache update + async disk write.
   * @param {string} key - Collection key
   * @param {string} value - Raw JSON string
   */
  setItem(key, value) {
    if (isTauri) {
      // Update memory cache immediately (synchronous)
      _diskCache.set(key, value);
      
      // Write to disk asynchronously (fire-and-forget)
      getInvoke().then(invoke => {
        if (invoke) {
          invoke("write_collection", { key, value }).catch(e => {
            console.error(`[StorageDriver] Disk write failed for ${key}:`, e);
          });
        }
      });
      return;
    }
    localStorage.setItem(key, value);
  },

  /**
   * Remove a value by key.
   * @param {string} key - Collection key
   */
  removeItem(key) {
    if (isTauri) {
      _diskCache.delete(key);
      
      getInvoke().then(invoke => {
        if (invoke) {
          invoke("remove_collection", { key }).catch(e => {
            console.error(`[StorageDriver] Disk remove failed for ${key}:`, e);
          });
        }
      });
      return;
    }
    localStorage.removeItem(key);
  },

  /**
   * Get the total number of stored keys.
   */
  get length() {
    if (isTauri) {
      return _diskCache.size;
    }
    return localStorage.length;
  },

  /**
   * Get key at index (for iteration).
   */
  key(index) {
    if (isTauri) {
      const keys = Array.from(_diskCache.keys());
      return keys[index] || null;
    }
    return localStorage.key(index);
  },
};

/**
 * Get the absolute path where data files are stored (Tauri only).
 * Returns null in browser mode.
 */
export async function getDataPath() {
  if (!isTauri) return null;
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return await invoke("get_data_path");
  } catch {
    return null;
  }
}
