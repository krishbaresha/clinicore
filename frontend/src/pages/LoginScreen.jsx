import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSignIn } from "@clerk/clerk-react";
import { useAuth } from "../hooks/useAuth.js";
import { dbUsers, dbClinic } from "../api/db.js";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Dedicated sub-component that safely consumes Clerk's useSignIn hook only when ClerkProvider is active
function ClerkSignInBridge({ onReady }) {
  const { isLoaded, signIn, setActive } = useSignIn();
  useEffect(() => {
    if (isLoaded && signIn && setActive) {
      onReady({ isLoaded, signIn, setActive });
    }
  }, [isLoaded, signIn, setActive, onReady]);
  return null;
}

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // Safe Clerk state passed from bridge
  const [clerkAuth, setClerkAuth] = useState(null);
  const isClerkLoaded = Boolean(clerkAuth?.isLoaded);
  const signIn = clerkAuth?.signIn || null;
  const setActive = clerkAuth?.setActive || null;

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

    // 1. If Clerk is configured and user typed an email, attempt Clerk verification first
    if (CLERK_PUBLISHABLE_KEY && isClerkLoaded && identifier.includes("@")) {
      try {
        const result = await signIn.create({
          identifier: identifier.trim(),
          password: password,
        });

        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          // Link local session mirror
          const localMatch = dbUsers.findByEmail(identifier.trim());
          if (localMatch) {
            login(identifier, password);
          }
          navigate("/dashboard", { replace: true });
          setLoading(false);
          return;
        }
      } catch (clerkErr) {
        console.warn("Clerk auth failed, attempting fallback local verification:", clerkErr);
      }
    }

    // 2. Local SHA-256 Auth & Offline Verification Fallback
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
      {CLERK_PUBLISHABLE_KEY && <ClerkSignInBridge onReady={setClerkAuth} />}
      {/* Decorative Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-gradient-to-b from-teal-100/70 via-emerald-50/40 to-transparent blur-3xl -z-10 pointer-events-none" />

      {/* Top Floating Navigation Bar */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between py-2 px-1 relative z-20">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-3.5 py-2 rounded-2xl bg-white/80 hover:bg-white border border-teal-100 text-teal-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all hover:border-teal-300 cursor-pointer active:scale-95"
        >
          <span className="material-symbols-outlined text-base text-teal-700">arrow_back</span>
          <span>Back to Home</span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-teal-950 hover:from-purple-950 hover:to-slate-950 text-white font-black text-xs flex items-center gap-2 shadow-md shadow-purple-900/20 transition-all cursor-pointer active:scale-95 border border-purple-500/30"
          title="Switch to Super Admin Command Center & Remote Licensing"
        >
          <span className="material-symbols-outlined text-base text-purple-300">admin_panel_settings</span>
          <span>Super Admin Login</span>
        </button>
      </header>

      <main className="w-full max-w-md mx-auto my-auto relative z-10 py-4" aria-label="Staff Login">
        {/* Glassmorphism Card */}
        <div className="bg-white/90 backdrop-blur-xl border border-teal-100/90 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-teal-900/5 flex flex-col items-center">
          
          {/* Brand Logo */}
          <div className="flex flex-col items-center gap-2 mb-6 text-center">
            <div className="p-3.5 rounded-3xl bg-white border border-teal-100 shadow-md flex items-center justify-center">
              <img
                src="/favicon.svg"
                alt="CliniCore Logo"
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-md transition-transform hover:scale-105"
              />
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="text-2xl font-black tracking-tight text-teal-950">CliniCore</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  Staff Portal
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-500 truncate max-w-[280px] mt-0.5">
                {clinicData?.name || "Medical Clinic & Pharmacy"}
              </p>
            </div>
          </div>

          {/* Welcome Text */}
          <div className="text-center mb-6 w-full">
            <h2 className="text-xl font-black text-teal-950 tracking-tight">Staff Portal Login</h2>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Enter your doctor or staff credentials to access your terminal.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
            {/* Email / Phone */}
            <div>
              <label htmlFor="identifier" className="block text-xs font-bold text-gray-700 mb-1.5">
                Email or Phone
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg select-none">
                  person
                </span>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  inputMode="email"
                  enterKeyHint="next"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username email"
                  placeholder="Enter email or phone"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-teal-600 focus:bg-white rounded-2xl pl-10 pr-4 py-3.5 text-sm text-gray-900 focus:outline-none transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg select-none">
                  lock
                </span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  enterKeyHint="go"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-teal-600 focus:bg-white rounded-2xl pl-10 pr-4 py-3.5 text-sm text-gray-900 focus:outline-none transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center animate-shake">
                {error}
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
              className="w-full p-3 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-teal-50 hover:from-purple-100 hover:to-teal-100 border border-purple-200/80 text-purple-950 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-xs cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-lg bg-purple-200 text-purple-900 flex items-center justify-center text-xs group-hover:bg-purple-700 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
              </div>
              <span className="flex-1 text-left">Switch to Super Admin Portal</span>
              <span className="material-symbols-outlined text-purple-700 text-sm group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="w-full max-w-md mx-auto text-center py-3 text-xs text-gray-400 font-medium relative z-20">
        <span>© 2026 ClinicFlow Hybrid OS • </span>
        <button
          type="button"
          onClick={() => navigate("/live-queue")}
          className="text-teal-700 hover:underline font-bold cursor-pointer"
        >
          Live OPD Waiting Queue
        </button>
      </footer>
    </div>
  );
}
