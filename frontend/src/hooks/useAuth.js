import { useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";

/** Hook for consuming the auth context in any component. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
