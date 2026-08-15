import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password,   setPassword]   = useState("");
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);

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
    <div
      className="min-h-screen flex items-center justify-center p-sm"
      style={{ background: "linear-gradient(135deg, #f7faf8 0%, #d4f0eb 50%, #e0e3e1 100%)" }}
    >
      <main className="w-full max-w-md mx-auto" aria-label="Login">
        {/* Glassmorphism Card */}
        <div className="glass-card w-full p-lg flex flex-col items-center">

          {/* Brand */}
          <div className="flex items-center gap-xs mb-xl">
            <span
              className="material-symbols-outlined text-primary text-5xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              medical_services
            </span>
            <h1 className="font-headline-lg text-headline-lg font-bold text-primary">
              ClinicFlow
            </h1>
          </div>

          {/* Welcome Text */}
          <div className="text-center mb-md w-full">
            <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">Welcome Back</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Please log in to your account.
            </p>
          </div>

          {/* Login Form */}
          <form
            id="login-form"
            onSubmit={handleSubmit}
            className="w-full flex flex-col gap-sm"
            noValidate
          >
            {/* Email / Phone */}
            <div className="flex flex-col gap-xs">
              <label
                htmlFor="identifier"
                className="font-label-md text-label-md text-on-surface-variant ml-1"
              >
                Email or Phone
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline select-none">
                  person
                </span>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="dr.asif@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-xs">
              <label
                htmlFor="password"
                className="font-label-md text-label-md text-on-surface-variant ml-1"
              >
                Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline select-none">
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
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p
                role="alert"
                className="text-error font-body-sm text-body-sm text-center mt-xs"
              >
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col items-center gap-sm mt-xs">
              <button
                id="login-btn"
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center"
              >
                {loading ? "Logging in…" : "Login"}
                {!loading && (
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
