import React, { useState, useEffect } from "react";

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
      console.log("✅ ClinicFlow PWA successfully installed!");
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("User accepted PWA installation");
    }
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (isInstalled || !showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[9999] bg-gradient-to-r from-emerald-900 to-teal-950 text-white p-4 rounded-3xl shadow-2xl border border-emerald-500/40 flex items-center justify-between gap-3 animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-300 border border-white/20">
          <span className="material-symbols-outlined text-2xl">install_desktop</span>
        </div>
        <div>
          <h4 className="font-headline font-bold text-xs text-white">Install ClinicFlow App</h4>
          <p className="text-[11px] text-emerald-100/80">Install for lightning-fast 100% offline access</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleInstallClick}
          className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          Install
        </button>
        <button
          type="button"
          onClick={() => setShowBanner(false)}
          className="w-7 h-7 rounded-full hover:bg-white/10 text-gray-300 hover:text-white flex items-center justify-center transition-colors text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
