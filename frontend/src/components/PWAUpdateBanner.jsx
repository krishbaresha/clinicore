import { usePWAUpdate } from "../hooks/usePWAUpdate.js";
import { useState, useEffect } from "react";

/**
 * PWAUpdateBanner — Prominent Auto-Updating Modal & Notification Deck
 * Displays a 5-second countdown warning before applying live OTA updates seamlessly.
 */
export default function PWAUpdateBanner() {
  const { updateAvailable, isUpdating, applyUpdate, newVersion } = usePWAUpdate();
  const [dismissed, setDismissed] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!updateAvailable || dismissed || paused || isUpdating) return;
    if (countdown <= 0) {
      applyUpdate();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [updateAvailable, dismissed, paused, countdown, isUpdating, applyUpdate]);

  if (!updateAvailable || dismissed) {
    return null;
  }

  return (
    <aside aria-label="Application Update Notification" className="fixed top-5 right-5 left-5 md:left-auto md:w-[420px] z-[99999] animate-in fade-in slide-in-from-top-6 duration-300">
      <div className="bg-slate-900/98 backdrop-blur-xl text-white border-2 border-teal-500 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex flex-col gap-3 ring-2 ring-teal-500/30">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0 text-teal-400">
            <span className="material-symbols-outlined text-2xl animate-spin">
              sync
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <span>Auto-Update In Progress</span>
                <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 animate-pulse">
                  {countdown > 0 ? `Applying in ${countdown}s` : 'Updating now...'}
                </span>
              </h4>
              <button
                onClick={() => { setPaused(true); setDismissed(true); }}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
                title="Dismiss"
              >
                <span className="material-symbols-outlined text-lg leading-none">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              New verified update <strong className="text-teal-400">{newVersion || "v2.5.1"}</strong> is live. Software will auto-restart to apply all fixes without losing any data.
            </p>
          </div>
        </div>

        {/* Visual Progress Bar for 5s Countdown */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-gradient-to-r from-teal-400 to-emerald-400 h-full transition-all duration-1000 ease-linear"
            style={{ width: `${Math.max(0, (5 - countdown) / 5) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={() => setPaused(!paused)}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            {paused ? "Resume Auto-Update" : "Pause"}
          </button>

          <button
            onClick={applyUpdate}
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
                <span>Update Now ({countdown}s)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
