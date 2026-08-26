/**
 * CliniCore / ClinicFlow PWA Service Worker — Robust Auto-Sync & Offline-First Engine
 * Build Version: __SW_CACHE_VERSION__
 * Built At: __SW_BUILD_TIME__
 */

const BUILD_VERSION = '__SW_CACHE_VERSION__';
const CACHE_NAME = `clinicflow-pwa-${BUILD_VERSION.startsWith('__') ? 'dev-local' : BUILD_VERSION}`;

const CORE_STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.json',
  '/favicon.png',
  '/favicon.svg',
  '/clinic-logo.png'
];

// 1. Install Event: Pre-cache core shell and immediately skip waiting
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use no-cache to ensure freshly fetched core assets
      const cachePromises = CORE_STATIC_ASSETS.map((asset) => {
        return fetch(asset, { cache: 'no-cache' })
          .then((response) => {
            if (response && response.status === 200) {
              return cache.put(asset, response);
            }
          })
          .catch((err) => {
            console.warn(`[SW] Pre-cache skip for optional asset: ${asset}`, err);
          });
      });
      return Promise.all(cachePromises);
    })
  );
});

// 2. Activate Event: Purge old caches and immediately claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('clinicflow-pwa-')) {
            console.log(`[SW] Purging outdated cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Message Event: IPC between React client and Service Worker
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((k) => caches.delete(k)));
      }).then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      })
    );
  }

  if (event.data.type === 'GET_SW_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        version: BUILD_VERSION,
        cacheName: CACHE_NAME
      });
    }
  }
});

// 4. Fetch Event: Intelligent multi-tier caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests, API backend calls, or extension protocols
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Bypass service worker for backend API and direct PHP endpoints
  if (url.pathname.startsWith('/api/') || url.pathname.includes('index.php')) {
    return;
  }

  // Tier A: SPA Navigation (HTML pages) -> Network-First with Offline Cache Fallback
  // When online, this guarantees users immediately receive the newest index.html with fresh chunk hashes
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          return fallback || new Response(
            '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h2>Offline Mode</h2><p>ClinicFlow is working offline. Connect to internet for updates.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Tier B: Content-Hashed Vite Assets (/assets/*) -> Cache-First with 404 Auto-Invalidate
  // Since Vite asset filenames have unique cryptographic hashes (e.g. index-C1j6_HiN.js), if in cache they're guaranteed exact
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          } else if (networkResponse && (networkResponse.status === 404 || networkResponse.status === 403)) {
            // New deployment removed old asset hash -> purge outdated cache
            console.warn(`[SW] Missing asset detected (${request.url}), purging outdated cache.`);
            caches.keys().then((keys) => {
              keys.forEach((k) => {
                if (k.startsWith('clinicflow-pwa-')) caches.delete(k);
              });
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Tier C: Version & Manifest files (/version.json, /manifest.json) -> Network-First (No Cache)
  if (url.pathname === '/version.json' || url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Tier D: General static icons, fonts, public files -> Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
