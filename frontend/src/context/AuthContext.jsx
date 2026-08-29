import { createContext, useState, useEffect } from "react";
import { getSession, login as apiLogin, logout as apiLogout } from "../api/auth.js";
import { dbClinic } from "../api/db.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);   // { userId, name, role, clinic_id, is_owner, can_view_financials }
  const [clinic, setClinic] = useState(null);   // clinic record
  const [loading, setLoading] = useState(true);

  // Restore session on mount — getSession validates against DB record
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session);
      setClinic(dbClinic.get());
    } else {
      setUser(null);
    }
    setLoading(false);

    // Cross-tab and live storage watcher for auth session invalidation
    const handleStorageChange = (e) => {
      if (e.key === "cf_users_v5" || e.key === "cf_session" || e.key === "cf_auth_session") {
        const active = getSession();
        setUser(active);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("clinicflow_status_update", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("clinicflow_status_update", handleStorageChange);
    };
  }, []);

  async function login(identifier, password) {
    const result = await apiLogin(identifier, password);
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
    // Re-validate session against DB — picks up any role/permission changes
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
