import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
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
      setError(result.error.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-4 selection:bg-teal-600 selection:text-white relative overflow-hidden font-sans">
      {/* Decorative Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-gradient-to-b from-teal-100/70 via-emerald-50/40 to-transparent blur-3xl -z-10 pointer-events-none" />

      <main className="w-full max-w-md mx-auto relative z-10" aria-label="Staff Login">
        {/* Glassmorphism Card */}
        <div className="bg-white/85 backdrop-blur-xl border border-teal-100/90 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-teal-900/5 flex flex-col items-center">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-700 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-700/25">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                medical_services
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black tracking-tight text-teal-950">ClinicFlow</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  Staff
                </span>
              </div>
              <p className="text-[11px] font-semibold text-gray-500">Clinical Operating System</p>
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
                  autoComplete="username"
                  placeholder="doctor@example.com / 0300..."
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-teal-600 focus:bg-white rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-900 focus:outline-none transition-all"
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
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-teal-600 focus:bg-white rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-900 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="pt-2">
              <button
                id="login-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-extrabold py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-teal-700/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Authenticating..." : "Login to Terminal"}
                {!loading && <span className="material-symbols-outlined text-lg">arrow_forward</span>}
              </button>
            </div>
          </form>

          {/* Quick Return Link */}
          <div className="mt-6 pt-6 border-t border-gray-100 w-full flex items-center justify-between text-xs text-gray-500 font-medium">
            <Link to="/" className="hover:text-teal-700 transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">home</span>
              Home
            </Link>
            <Link to="/clinic" className="hover:text-teal-700 transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">medical_services</span>
              Doctor Clinic Site
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
