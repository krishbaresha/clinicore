import { Navigate } from "react-router-dom";

/** ClinicSettings has been permanently deprecated as requested by user. Redirects to /dashboard. */
export default function ClinicSettings() {
  return <Navigate to="/dashboard" replace />;
}
