import { lazy } from "react";

/**
 * lazyWithRetry — Enterprise Dynamic Import Chunk Failure Invalidation & Auto-Retry Engine.
 * When Vite deploys a new production build, chunk hashes change (e.g. ReceiptStudio-Bw12qQV4.js -> ReceiptStudio-C4x7.js).
 * If a client has an open session or stale service-worker cache, dynamic import throws:
 * "Failed to fetch dynamically imported module" / "ChunkLoadError".
 * 
 * This utility:
 * 1. Catches the dynamic import error.
 * 2. Checks if a reload attempt was already performed in the current browser session.
 * 3. Purges any stale Service Worker caches to prevent stale chunk traps.
 * 4. Auto-reloads the page to instantly fetch the new HTML entrypoint and fresh chunks.
 * 5. Provides zero-lag seamless recovery without ever showing a blank white screen.
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem("cf_chunk_reload") || "false"
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem("cf_chunk_reload", "false");
      return component;
    } catch (error) {
      console.warn("[PWA / Chunk Engine] Dynamic chunk load error detected:", error);
      if (!pageHasAlreadyBeenForceRefreshed) {
        // Marks that we tried a force reload once
        window.sessionStorage.setItem("cf_chunk_reload", "true");

        // Purge SW caches before reload to guarantee fresh chunk fetch
        if (typeof window !== "undefined" && "caches" in window) {
          try {
            const keys = await window.caches.keys();
            await Promise.all(keys.map((k) => window.caches.delete(k)));
            console.log("[PWA / Chunk Engine] Cleared cache storage before chunk reload");
          } catch (_) {}
        }

        window.location.reload();
        return new Promise(() => {}); // Prevent React from unmounting before reload completes
      }

      // If it still fails after reload, throw so ErrorBoundary renders the user recovery card
      throw error;
    }
  });
}
