import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ClinicFlow Uncaught App Error:", error, errorInfo);

    // Auto-reload once if dynamic import chunk hash changed after new deployment
    if (
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Importing a module script failed")
    ) {
      const hasReloaded = sessionStorage.getItem("cf_chunk_retry");
      if (!hasReloaded) {
        sessionStorage.setItem("cf_chunk_retry", "true");
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    sessionStorage.removeItem("cf_chunk_retry");
    window.location.reload();
  };

  handleResetStorage = () => {
    try {
      sessionStorage.clear();
      window.location.href = "/login";
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-4 font-sans selection:bg-teal-600 selection:text-white">
          <div className="w-full max-w-md bg-white border border-teal-100 rounded-3xl p-8 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center mx-auto shadow-sm">
              <span className="material-symbols-outlined text-3xl">refresh</span>
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">App Session Ready</h2>
              <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                A new update or offline cache was loaded. Tap below to resume immediately.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={this.handleReload}
                className="w-full min-h-[46px] bg-teal-700 hover:bg-teal-800 text-white font-black text-xs py-3 rounded-2xl shadow-md shadow-teal-900/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <span className="material-symbols-outlined text-base">cached</span>
                <span>Reload ClinicFlow</span>
              </button>

              <button
                onClick={this.handleResetStorage}
                className="w-full py-2.5 text-[11px] font-bold text-slate-500 hover:text-teal-800 transition-colors cursor-pointer"
              >
                Clear Temp Session &amp; Go to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
