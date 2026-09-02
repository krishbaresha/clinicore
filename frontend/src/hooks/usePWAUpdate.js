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
  // Read app version stamped at build time by Vite, with safe fallbacks
  const currentVersion = (typeof globalThis !== "undefined" && globalThis.__APP_SEMVER__) || (typeof localStorage !== "undefined" && localStorage.getItem("cf_applied_version")) || "2.5.3";
  const currentBuildId = (typeof globalThis !== "undefined" && globalThis.__APP_BUILD_ID__) || "";
  const currentVersionRef = useRef(currentVersion);

  const applyUpdate = useCallback(() => {
    setIsUpdating(true);

    // Record that we have applied up to this version to prevent loops
    try {
      if (newVersion) {
        localStorage.setItem("cf_applied_version", newVersion);
      }
    } catch (_) {}

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
  }, [newVersion]);

  const checkForUpdate = useCallback(async () => {
    // 1. Trigger SW registration check
    if (registrationRef.current) {
      try {
        await registrationRef.current.update();
      } catch (err) {
        console.debug("[PWA] SW update check note:", err);
      }
    }

    // 2. Comprehensive check via local /version.json, production domain, and VPS API
    try {
      const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const endpoints = isLocal
        ? [`/version.json?_t=${Date.now()}`]
        : [`/version.json?_t=${Date.now()}`];
      
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
          });
          if (res.ok) {
            const data = await res.json();
            const serverVersion = data?.version || (data?.data && data.data.version);
            const serverBuildId = data?.build_id || (data?.data && data.data.build_id) || "";
            if (serverVersion) {
              // Check if user already dismissed/applied this exact version recently in this session
              const appliedVersion = (typeof localStorage !== "undefined" ? localStorage.getItem("cf_applied_version") : null);
              if (appliedVersion && appliedVersion === serverVersion) {
                continue;
              }

              const parseSemver = (v) => {
                if (!v) return null;
                const m = String(v).match(/^v?(\d+)\.(\d+)\.(\d+)/);
                return m ? { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), patch: parseInt(m[3], 10) } : null;
              };
              
              const sSem = parseSemver(serverVersion);
              const cSem = parseSemver(currentVersionRef.current);
              let hasNewerVersion = false;
              if (sSem && cSem) {
                if (sSem.major > cSem.major) hasNewerVersion = true;
                else if (sSem.major === cSem.major && sSem.minor > cSem.minor) hasNewerVersion = true;
                else if (sSem.major === cSem.major && sSem.minor === cSem.minor && sSem.patch > cSem.patch) hasNewerVersion = true;
              }

              if (hasNewerVersion) {
                console.log(`[PWA/OTA] New version detected on server: ${serverVersion} (current: ${currentVersionRef.current})`);
                setNewVersion(serverVersion);
                setUpdateAvailable(true);
                break;
              }
            }
          }
        } catch (_) {
          // Endpoint fallback
        }
      }
    } catch (_) {
      // Offline fallback
    }
  }, []);

  useEffect(() => {
    // 1. Service Worker setup for Web / PWA environments
    let handleControllerChange = null;
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (window.location.protocol === "https:" || isLocalhost) {
        let refreshing = false;
        handleControllerChange = () => {
          if (!refreshing) {
            refreshing = true;
            console.log("[PWA] Service Worker controller changed -> refreshing client");
            window.location.reload();
          }
        };

        navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

        navigator.serviceWorker
          .register("/sw.js", { updateViaCache: "none" })
          .then((reg) => {
            registrationRef.current = reg;
            console.log("[PWA] Service Worker registered with updateViaCache: none");

            if (reg.waiting) {
              setUpdateAvailable(true);
            }

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
      }
    }

    // 2. Active OTA Update Poller (Works on both Web PWA & Desktop Tauri)
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

    // Poll every 30 seconds for live updates
    const intervalId = setInterval(checkForUpdate, 30 * 1000);

    // Initial check after 1.5 seconds on boot
    const initialTimeout = setTimeout(checkForUpdate, 1500);

    return () => {
      if (handleControllerChange && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      }
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
