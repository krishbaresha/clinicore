import { createContext, useContext, useState, useEffect } from "react";
import { getSession, login as apiLogin, logout as apiLogout } from "../api/auth.js";
import { dbClinic } from "../api/db.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);   // { userId, name, role, clinic_id }
  const [clinic, setClinic] = useState(null);   // clinic record
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session);
      setClinic(dbClinic.get());
    }
    setLoading(false);
  }, []);

  function login(identifier, password) {
    const result = apiLogin(identifier, password);
    if (result.success) {
      setUser(result.user);
      setClinic(dbClinic.get());
    }
    return result;
  }

  function logout() {
    apiLogout();
    setUser(null);
    setClinic(null);
  }

  function refreshClinic() {
    setClinic(dbClinic.get());
  }

  function refreshUser() {
    const session = getSession();
    if (session) {
      setUser(session);
    }
  }

  return (
    <AuthContext.Provider value={{ user, clinic, loading, login, logout, refreshClinic, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook for consuming the auth context in any component. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
