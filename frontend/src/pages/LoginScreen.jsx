import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSignIn } from "@clerk/clerk-react";
import { useAuth } from "../hooks/useAuth.js";
import { dbUsers, dbClinic } from "../api/db.js";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // Safe Clerk hook access
  let isClerkLoaded = false;
  let signIn = null;
  let setActive = null;
  try {
    if (CLERK_PUBLISHABLE_KEY) {
      const clerkSignInObj = useSignIn();
      isClerkLoaded = clerkSignInObj.isLoaded;
      signIn = clerkSignInObj.signIn;
      setActive = clerkSignInObj.setActive;
    }
  } catch (err) {
    console.warn("Clerk context not available, using local auth engine", err);
  }

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [clinicData, setClinicData] = useState(null);

  useEffect(() => {
    setUsersList(dbUsers.getAll() || []);
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

  function handleQuickLogin(email, pass) {
    setIdentifier(email);
    setPassword(pass);
    setError("");
    setLoading(true);
    const result = login(email, pass);
    setLoading(false);
    if (result.success) {
      navigate("/dashboard", { replace: true });
    } else {
      setError(result.error?.message || "Login failed");
    }
  }

  return (
    <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-4 selection:bg-teal-600 selection:text-white relative overflow-hidden font-sans">
      {/* Decorative Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-gradient-to-b from-teal-100/70 via-emerald-50/40 to-transparent blur-3xl -z-10 pointer-events-none" />

      <main className="w-full max-w-md mx-auto relative z-10" aria-label="Staff Login">
        {/* Glassmorphism Card */}
        <div className="bg-white/90 backdrop-blur-xl border border-teal-100/90 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-teal-900/5 flex flex-col items-center">
          
          {/* Brand Logo */}
          <div className="flex flex-col items-center gap-2 mb-6 text-center">
            <div className="p-2 rounded-2xl bg-white/80 border border-teal-50 shadow-xs flex items-center justify-center">
              <img
                src="/clinic-logo.png"
                alt="Clinic Logo"
                className="h-24 sm:h-28 w-auto max-w-[260px] object-contain drop-shadow-md transition-transform hover:scale-105"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
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
                  autoComplete="username"
                  placeholder="Enter your email"
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
                className="w-full bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-extrabold py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-teal-700/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Authenticating..." : "Login to Terminal"}
                {!loading && <span className="material-symbols-outlined text-lg">arrow_forward</span>}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
