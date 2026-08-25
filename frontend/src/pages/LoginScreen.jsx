import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { dbClinic } from "../api/db.js";

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [clinicData, setClinicData] = useState(null);

  useEffect(() => {
    setClinicData(dbClinic.get() || {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || !password.trim()) {
      setError("Please enter both email/phone and password.");
      return;
    }
    setLoading(true);

    const result = login(identifier, password);
    setLoading(false);
    if (result.success) {
      navigate("/dashboard", { replace: true });
    } else {
      setError(result.error?.message || "Invalid email/username or password.");
    }
  }

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col justify-between p-4 sm:p-6 selection:bg-teal-600 selection:text-white relative overflow-hidden font-sans">
      {/* Decorative Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-gradient-to-b from-teal-100/70 via-emerald-50/40 to-transparent blur-3xl -z-10 pointer-events-none" />

      {/* Top Floating Navigation Bar */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between py-2 px-1 relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-800 flex items-center justify-center text-white shadow-md shadow-teal-900/20 font-black text-sm">
            C+
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-teal-950 leading-tight">CliniCore</h1>
            <p className="text-[10px] text-teal-700 font-bold uppercase tracking-wider">Clinical OS</p>
          </div>
        </div>

        <button
          onClick={() => navigate("/public-queue")}
          className="text-xs font-bold text-teal-800 hover:text-teal-950 bg-white hover:bg-teal-50/80 border border-teal-200/80 px-3 py-1.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm text-teal-600">live_tv</span>
          <span>Live Queue Display</span>
        </button>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md mx-auto my-auto py-6 relative z-20">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-xl shadow-teal-950/5 border border-teal-100/80">
          
          {/* Clinic Branding */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 mx-auto flex items-center justify-center text-teal-800 mb-3 shadow-inner">
              <span className="material-symbols-outlined text-3xl">local_hospital</span>
            </div>
            <h2 className="text-xl font-black text-teal-950 tracking-tight">
              {clinicData?.name || "Dr. Muhammad Asif Ashraf Khan Clinic"}
            </h2>
            <p className="text-xs text-teal-700/80 font-medium mt-1">
              Staff &amp; Doctor Terminal Login
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                Staff ID / Email / Phone
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. dr.kashif or 03473100304"
                  className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-teal-950 transition-all outline-none"
                  autoFocus
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-teal-600 text-lg">
                  person
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-teal-950 transition-all outline-none"
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-teal-600 text-lg">
                  lock
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-base shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2">
              <button
                id="login-btn"
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-extrabold py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-teal-700/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
              >
                {loading ? "Authenticating..." : "Login to Terminal"}
                {!loading && <span className="material-symbols-outlined text-lg">arrow_forward</span>}
              </button>
            </div>
          </form>

          {/* Quick Switch to Super Admin Button */}
          <div className="w-full mt-5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="w-full p-3 rounded-2xl bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 hover:from-teal-100 hover:to-emerald-100 border border-teal-200/90 text-teal-950 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-xs cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-lg bg-teal-200/80 text-teal-900 flex items-center justify-center text-xs group-hover:bg-teal-700 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
              </div>
              <span className="flex-1 text-left">Switch to Super Admin Portal</span>
              <span className="material-symbols-outlined text-teal-700 text-sm group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="w-full max-w-md mx-auto text-center py-3 text-xs text-gray-400 font-medium relative z-20">
        <span>© 2026 CliniCore Hybrid OS • Engineered by K.B Software</span>
      </footer>
    </div>
  );
}
