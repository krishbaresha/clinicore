import { useState, useEffect, useCallback, useRef } from "react";

/**
 * usePWAUpdate — Enterprise PWA Lifecycle & Live Hot-Update Engine.
 * 
 * Automatically detects code pushes on GitHub/Vercel/VPS:
 * 1. Registers Service Worker with `updateViaCache: 'none'`.
 * 2. Actively polls `reg.update()` and `/version.json` on focus, online, and interval.
 * 3. Catches waiting workers and triggers seamless instant client upgrade.
 * 4. Guarantees installed mobile/desktop PWAs never stay on stale caches.
 */
export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const registrationRef = useRef(null);
  const currentVersionRef = useRef(
    (typeof globalThis !== "undefined" && globalThis.__APP_SEMVER__)
      ? globalThis.__APP_SEMVER__
      : (typeof globalThis !== "undefined" && globalThis.__APP_BUILD_VERSION__)
        ? globalThis.__APP_BUILD_VERSION__
        : "2.5.0"
  );

  const applyUpdate = useCallback(() => {
    setIsUpdating(true);

    if (registrationRef.current && registrationRef.current.waiting) {
      // Send SKIP_WAITING to the waiting service worker
      registrationRef.current.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    // Clear any chunk reload throttle locks
    try {
      window.sessionStorage.removeItem("cf_chunk_reload");
    } catch (_) {}

    // Short timeout to let skipWaiting take effect before reloading
    setTimeout(() => {
      window.location.reload();
    }, 400);
  }, []);

  const checkForUpdate = useCallback(async () => {
    // 1. Trigger SW registration check
    if (registrationRef.current) {
      try {
        await registrationRef.current.update();
      } catch (err) {
        console.debug("[PWA] SW update check note:", err);
      }
    }

    // 2. Comprehensive check via local /version.json and VPS /api/v1/system/version
    try {
      const vpsApiUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ? import.meta.env.VITE_API_URL : "https://api.clinicore.me";
      const endpoints = [`/version.json?_t=${Date.now()}`, `${vpsApiUrl}/api/v1/system/version?_t=${Date.now()}`];
      
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
          });
          if (res.ok) {
            const data = await res.json();
            const versionString = data?.version || (data?.data && data.data.version);
            if (versionString) {
              const parseSemver = (v) => {
                if (!v) return null;
                const m = String(v).match(/^v?(\d+)\.(\d+)\.(\d+)/);
                return m ? { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), patch: parseInt(m[3], 10) } : null;
              };
              if (!currentVersionRef.current) {
                currentVersionRef.current = versionString;
              } else {
                const server = parseSemver(versionString);
                const client = parseSemver(currentVersionRef.current);
                let hasSemanticUpdate = false;
                if (server && client) {
                  hasSemanticUpdate = (server.major > client.major || (server.major === client.major && server.minor > client.minor) || (server.major === client.major && server.minor === client.minor && server.patch > client.patch));
                } else {
                  hasSemanticUpdate = versionString !== currentVersionRef.current;
                }
                if (hasSemanticUpdate) {
                  console.log(`[PWA/OTA] New version detected on server: ${versionString} (current: ${currentVersionRef.current})`);
                  setNewVersion(versionString);
                  setUpdateAvailable(true);
                  break;
                }
              }
            }
          }
        } catch (_) {
          // Endpoint fallback
        }
      }
    } catch (_) {
      // Silent fail if completely offline
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Prevent SW in unsupported insecure contexts except localhost
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (window.location.protocol !== "https:" && !isLocalhost) {
      return;
    }

    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        console.log("[PWA] Service Worker controller changed -> refreshing client");
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    // Register Service Worker with zero HTTP cache
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        registrationRef.current = reg;
        console.log("[PWA] Service Worker registered with updateViaCache: none");

        // If a worker is already waiting to activate
        if (reg.waiting) {
          setUpdateAvailable(true);
        }

        // Detect when a new service worker is installing/installed
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("[PWA] New content is available; please refresh.");
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker registration failed:", err);
      });

    // Event listeners for active update polling
    const onFocus = () => checkForUpdate();
    const onOnline = () => checkForUpdate();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Poll every 5 minutes while open
    const intervalId = setInterval(checkForUpdate, 5 * 60 * 1000);

    // Initial check after 3 seconds
    const initialTimeout = setTimeout(checkForUpdate, 3000);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(intervalId);
      clearTimeout(initialTimeout);
    };
  }, [checkForUpdate]);

  return {
    updateAvailable,
    newVersion,
    isUpdating,
    applyUpdate,
    checkForUpdate,
  };
}
