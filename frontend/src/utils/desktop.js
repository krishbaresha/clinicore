/**
 * desktop.js — Detection helper for Tauri / Standalone Desktop App mode.
 */

export function isDesktopApp() {
  if (typeof window === "undefined") return false;

  return Boolean(
    window.__TAURI__ ||
    window.__TAURI_INTERNALS__ ||
    window.location.protocol === "tauri:" ||
    window.location.protocol === "file:" ||
    window.location.hostname === "tauri.localhost" ||
    window.isDesktop === true ||
    (typeof navigator !== "undefined" &&
      navigator.userAgent &&
      (navigator.userAgent.includes("Tauri") || navigator.userAgent.includes("Electron"))) ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_MODE === "desktop")
  );
}
