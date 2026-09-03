import { useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import { getSession, getActiveCashier } from "../api/auth.js";
import { dbClinic } from "../api/db.js";

/** Hook for consuming the auth context in any component safely with fallback session support. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;

  // Resilient Fallback if called during HMR or transient component mount
  const sessionUser = getSession();
  const activeCashier = getActiveCashier();
  const clinic = dbClinic.get();

  return {
    user: sessionUser,
    clinic,
    loading: false,
    activeCashier: activeCashier || (sessionUser ? { id: sessionUser.id, name: sessionUser.name, role: sessionUser.role } : null),
    switchCashier: () => {},
    login: async () => ({ success: false }),
    logout: () => {},
    refreshClinic: () => {},
    refreshUser: () => {},
    loginWithPin: async () => ({ success: false }),
  };
}
