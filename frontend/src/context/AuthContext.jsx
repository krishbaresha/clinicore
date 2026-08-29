import { createContext, useState, useEffect } from "react";
import { getSession, login as apiLogin, logout as apiLogout, getActiveCashier, setActiveCashier as apiSetActiveCashier } from "../api/auth.js";
import { dbClinic } from "../api/db.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);   // { userId, name, role, clinic_id, is_owner, can_view_financials }
  const [clinic, setClinic] = useState(null);   // clinic record
  const [loading, setLoading] = useState(true);
  const [activeCashier, setActiveCashierState] = useState(() => getActiveCashier());

  // Restore session on mount — getSession validates against DB record
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session);
      setClinic(dbClinic.get());
    } else {
      setUser(null);
    }
    setActiveCashierState(getActiveCashier());
    setLoading(false);

    // Cross-tab and live storage watcher for auth session invalidation
    const handleStorageChange = (e) => {
      if (!e || e.key === "cf_users_v5" || e.key === "cf_session" || e.key === "cf_auth_session") {
        const active = getSession();
        setUser(active);
      }
      if (!e || e.key === "cf_active_cashier" || e.key === "cf_pos_active_operator") {
        setActiveCashierState(getActiveCashier());
      }
    };

    const handleCashierChange = (e) => {
      if (e?.detail) {
        setActiveCashierState(e.detail);
      } else {
        setActiveCashierState(getActiveCashier());
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("clinicflow_status_update", handleStorageChange);
    window.addEventListener("clinicflow_cashier_changed", handleCashierChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("clinicflow_status_update", handleStorageChange);
      window.removeEventListener("clinicflow_cashier_changed", handleCashierChange);
    };
  }, []);

  async function login(identifier, password) {
    const result = await apiLogin(identifier, password);
    if (result.success) {
      setUser(result.user);
      setClinic(dbClinic.get());
      const updatedCashier = apiSetActiveCashier({
        id: result.user.userId || result.user.id,
        name: result.user.name,
        role: result.user.role,
      });
      setActiveCashierState(updatedCashier);
    }
    return result;
  }

  function logout() {
    apiLogout();
    setUser(null);
    setClinic(null);
  }

  function switchCashier(staff) {
    const updated = apiSetActiveCashier(staff);
    setActiveCashierState(updated);
    return updated;
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
    <AuthContext.Provider value={{ user, clinic, loading, activeCashier, switchCashier, login, logout, refreshClinic, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

