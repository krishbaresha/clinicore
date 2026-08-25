import { usePWAUpdate } from "../hooks/usePWAUpdate.js";
import { useState } from "react";

/**
 * PWAUpdateBanner — Floating toast notification when a new production release is ready.
 */
export default function PWAUpdateBanner() {
  const { updateAvailable, isUpdating, applyUpdate, newVersion } = usePWAUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) {
    return null;
  }

  return (
    <aside aria-label="Application Update Notification" className="fixed bottom-20 md:bottom-5 right-4 md:right-5 left-4 md:left-auto z-[9999] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-teal-500/40 rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 ring-1 ring-white/10">
        <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center shrink-0 text-teal-400">
          <span className="material-symbols-outlined text-2xl animate-spin-slow">
            sync
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <span>ClinicFlow Update Available</span>
              <span className="text-[10px] uppercase font-bold bg-teal-500/30 text-teal-300 px-1.5 py-0.5 rounded-full border border-teal-500/40">
                Live
              </span>
            </h4>
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-400 hover:text-white transition-colors p-0.5 rounded-lg hover:bg-slate-800"
              title="Dismiss for now"
            >
              <span className="material-symbols-outlined text-lg leading-none">close</span>
            </button>
          </div>

          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            A new version with the latest improvements has been deployed. Click to update seamlessly.
          </p>

          {newVersion && (
            <p className="text-[10px] font-mono text-teal-400/80 mt-1">
              Build: {newVersion}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={applyUpdate}
              disabled={isUpdating}
              className="px-3.5 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-lg shadow-teal-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isUpdating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">rocket_launch</span>
                  <span>Update Now</span>
                </>
              )}
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
