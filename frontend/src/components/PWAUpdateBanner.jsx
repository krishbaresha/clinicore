import { usePWAUpdate } from "../hooks/usePWAUpdate.js";
import { useState } from "react";

/**
 * PWAUpdateBanner — Prominent Auto-Updating Modal & Notification Deck
 * Displays a 5-second countdown warning before applying live OTA updates seamlessly.
 */
export default function PWAUpdateBanner() {
  const { updateAvailable, isUpdating, applyUpdate, newVersion } = usePWAUpdate();
  const [dismissed, setDismissed] = useState(() => {
    try {
      const dismissedVer = localStorage.getItem("cf_dismissed_version");
      return Boolean(dismissedVer && dismissedVer === newVersion);
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    try {
      if (newVersion) localStorage.setItem("cf_dismissed_version", newVersion);
    } catch (_) {}
    setDismissed(true);
  };

  const handleApply = () => {
    try {
      if (newVersion) localStorage.setItem("cf_dismissed_version", newVersion);
    } catch (_) {}
    applyUpdate();
  };

  if (!updateAvailable || dismissed || !newVersion) {
    return null;
  }

  const versionLabel = newVersion.startsWith("v") ? newVersion : `v${newVersion}`;

  return (
    <aside aria-label="Application Update Notification" className="fixed top-5 right-5 left-5 md:left-auto md:w-[420px] z-[99999] animate-in fade-in slide-in-from-top-6 duration-300">
      <div className="bg-slate-900/98 backdrop-blur-xl text-white border-2 border-teal-500 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex flex-col gap-3 ring-2 ring-teal-500/30">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0 text-teal-400">
            <span className="material-symbols-outlined text-2xl animate-spin-slow">
              sync
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <span>Update Available</span>
                <span className="text-[10px] uppercase font-bold bg-teal-500/30 text-teal-300 px-2 py-0.5 rounded-full border border-teal-500/40">
                  {versionLabel} LIVE
                </span>
              </h4>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                title="Dismiss"
              >
                <span className="material-symbols-outlined text-lg leading-none">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              A newer verified release <strong className="text-teal-400">{versionLabel}</strong> is available with live fixes. Click below to upgrade seamlessly without losing any offline data.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Later
          </button>

          <button
            onClick={handleApply}
            disabled={isUpdating}
            className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-500/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Applying Update...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">rocket_launch</span>
                <span>Update Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
