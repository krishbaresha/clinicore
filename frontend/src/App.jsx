import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { initDB } from "./api/db.js";
import { AuthProvider } from "./context/AuthContext.jsx";
import { useAuth } from "./hooks/useAuth.js";
import SidebarLayout from "./layouts/SidebarLayout.jsx";

// Pages — existing
import LoginScreen               from "./pages/LoginScreen.jsx";
import Dashboard                 from "./pages/Dashboard.jsx";
import PatientsList              from "./pages/PatientsList.jsx";
import PatientProfile            from "./pages/PatientProfile.jsx";
import AddNewPatient             from "./pages/AddNewPatient.jsx";
import FeesReports               from "./pages/FeesReports.jsx";
import MedicalStoreInventory     from "./pages/MedicalStoreInventory.jsx";
import ClinicSettings            from "./pages/ClinicSettings.jsx";

// Pages — NEW (real clinic workflow screens)
import PatientRegistration       from "./pages/PatientRegistration.jsx";
import ReceptionQueue            from "./pages/ReceptionQueue.jsx";
import PendingReports            from "./pages/PendingReports.jsx";
import DoctorQueue               from "./pages/DoctorQueue.jsx";
import ConsultationScreen        from "./pages/ConsultationScreen.jsx";
import MedicalStorePOS           from "./pages/MedicalStorePOS.jsx";
import SupplierPurchases         from "./pages/SupplierPurchases.jsx";
import MedicalStoreSalesLog      from "./pages/MedicalStoreSalesLog.jsx";
import WarehouseManagement       from "./pages/WarehouseManagement.jsx";
import PublicLiveQueue           from "./pages/PublicLiveQueue.jsx";
import LandingPage               from "./pages/LandingPage.jsx";

/**
 * ProtectedRoute — wraps pages that require a logged-in session.
 * Redirects to /login if no session found.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
}

/**
 * OwnerRoute — restricts page to clinic owner only.
 * Non-owner users get redirected to dashboard.
 */
function OwnerRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)         return <Navigate to="/login" replace />;
  if (!user.is_owner) return <Navigate to="/dashboard" replace />;
  return children;
}

/**
 * AuthenticatedLayout — wraps protected pages in the SidebarLayout.
 */
function AuthenticatedLayout({ children }) {
  return (
    <ProtectedRoute>
      <SidebarLayout>{children}</SidebarLayout>
    </ProtectedRoute>
  );
}

/**
 * OwnerLayout — wraps owner-only pages in the SidebarLayout.
 */
function OwnerLayout({ children }) {
  return (
    <OwnerRoute>
      <SidebarLayout>{children}</SidebarLayout>
    </OwnerRoute>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages (No Login Required) */}
      <Route path="/"        element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login"   element={<LoginScreen />} />
      <Route path="/live"    element={<PublicLiveQueue />} />
      <Route path="/display" element={<PublicLiveQueue />} />

      {/* ─── Reception / Counter Flow ─────────────────────────── */}
      <Route path="/reception/register"        element={<AuthenticatedLayout><PatientRegistration /></AuthenticatedLayout>} />
      <Route path="/reception/queue"           element={<AuthenticatedLayout><ReceptionQueue /></AuthenticatedLayout>} />
      <Route path="/reception/pending-reports" element={<AuthenticatedLayout><PendingReports /></AuthenticatedLayout>} />

      {/* ─── Doctor Flow ──────────────────────────────────────── */}
      <Route path="/doctor/queue"                   element={<AuthenticatedLayout><DoctorQueue /></AuthenticatedLayout>} />
      <Route path="/doctor/consultation/:visitId"   element={<AuthenticatedLayout><ConsultationScreen /></AuthenticatedLayout>} />

      {/* ─── Medical Store ─────────────────────────────────────── */}
      <Route path="/store/pos"       element={<AuthenticatedLayout><MedicalStorePOS /></AuthenticatedLayout>} />
      <Route path="/store/purchases" element={<AuthenticatedLayout><SupplierPurchases /></AuthenticatedLayout>} />
      <Route path="/store/sales"     element={<AuthenticatedLayout><MedicalStoreSalesLog /></AuthenticatedLayout>} />
      <Route path="/store/warehouse" element={<AuthenticatedLayout><WarehouseManagement /></AuthenticatedLayout>} />
      <Route path="/store"           element={<AuthenticatedLayout><MedicalStoreInventory /></AuthenticatedLayout>} />

      {/* ─── Shared / General ──────────────────────────────────── */}
      <Route path="/dashboard"   element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
      <Route path="/patients"    element={<AuthenticatedLayout><PatientsList /></AuthenticatedLayout>} />
      <Route path="/patients/new" element={<AuthenticatedLayout><AddNewPatient /></AuthenticatedLayout>} />
      <Route path="/patients/:id" element={<AuthenticatedLayout><PatientProfile /></AuthenticatedLayout>} />
      <Route path="/fees"        element={<AuthenticatedLayout><FeesReports /></AuthenticatedLayout>} />
      <Route path="/settings"    element={<OwnerLayout><ClinicSettings /></OwnerLayout>} />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  // Seed the localStorage DB once on very first load (bumped to v4 to force re-seed with new schema)
  useEffect(() => { initDB(); }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
