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
  const currentVersionRef = useRef(typeof __APP_BUILD_VERSION__ !== "undefined" ? __APP_BUILD_VERSION__ : null);

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

    // 2. Fallback check via /version.json
    try {
      const res = await fetch(`/version.json?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.version) {
          if (!currentVersionRef.current) {
            currentVersionRef.current = data.version;
          } else if (data.version !== currentVersionRef.current) {
            console.log(`[PWA] New version detected on server: ${data.version} (current: ${currentVersionRef.current})`);
            setNewVersion(data.version);
            setUpdateAvailable(true);
          }
        }
      }
    } catch (_) {
      // Silent fail if offline
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
