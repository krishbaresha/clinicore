import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { initDB } from "./api/db.js";
import { AuthProvider } from "./context/AuthContext.jsx";
import { useAuth } from "./hooks/useAuth.js";
import SidebarLayout from "./layouts/SidebarLayout.jsx";

// Lazy-loaded routes for ultra-fast bundle loading & low memory footprint
const LoginScreen           = lazy(() => import("./pages/LoginScreen.jsx"));
const Dashboard             = lazy(() => import("./pages/Dashboard.jsx"));
const PatientsList          = lazy(() => import("./pages/PatientsList.jsx"));
const PatientProfile        = lazy(() => import("./pages/PatientProfile.jsx"));
const AddNewPatient         = lazy(() => import("./pages/AddNewPatient.jsx"));
const FeesReports           = lazy(() => import("./pages/FeesReports.jsx"));
const MedicalStoreInventory = lazy(() => import("./pages/MedicalStoreInventory.jsx"));
const ClinicSettings        = lazy(() => import("./pages/ClinicSettings.jsx"));

const PatientRegistration   = lazy(() => import("./pages/PatientRegistration.jsx"));
const ReceptionQueue        = lazy(() => import("./pages/ReceptionQueue.jsx"));
const PendingReports        = lazy(() => import("./pages/PendingReports.jsx"));
const DoctorQueue           = lazy(() => import("./pages/DoctorQueue.jsx"));
const ConsultationScreen    = lazy(() => import("./pages/ConsultationScreen.jsx"));
const MedicalStorePOS       = lazy(() => import("./pages/MedicalStorePOS.jsx"));
const SupplierPurchases     = lazy(() => import("./pages/SupplierPurchases.jsx"));
const MedicalStoreSalesLog  = lazy(() => import("./pages/MedicalStoreSalesLog.jsx"));
const WarehouseManagement   = lazy(() => import("./pages/WarehouseManagement.jsx"));
const PublicLiveQueue       = lazy(() => import("./pages/PublicLiveQueue.jsx"));
const LandingPage           = lazy(() => import("./pages/LandingPage.jsx"));
const ClinicPublicPage      = lazy(() => import("./pages/ClinicPublicPage.jsx"));
const DeveloperAdminPanel   = lazy(() => import("./pages/DeveloperAdminPanel.jsx"));

function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-teal-700">
      <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-700 rounded-full animate-spin" />
      <div className="text-xs font-bold tracking-wider uppercase text-teal-800 animate-pulse">Loading Screen...</div>
    </div>
  );
}

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
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Public & Super-Admin Pages (No Login Required) */}
        <Route path="/"            element={<LandingPage />} />
        <Route path="/landing"     element={<LandingPage />} />
        <Route path="/clinic"      element={<ClinicPublicPage />} />
        <Route path="/dr-asif"     element={<ClinicPublicPage />} />
        <Route path="/super-admin" element={<DeveloperAdminPanel />} />
        <Route path="/developer"   element={<DeveloperAdminPanel />} />
        <Route path="/login"       element={<LoginScreen />} />
        <Route path="/live"        element={<PublicLiveQueue />} />
        <Route path="/display"     element={<PublicLiveQueue />} />

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
        <Route path="/purchases"       element={<Navigate to="/store/purchases" replace />} />
        <Route path="/store/sales"     element={<AuthenticatedLayout><MedicalStoreSalesLog /></AuthenticatedLayout>} />
        <Route path="/store/sales-log" element={<Navigate to="/store/sales" replace />} />
        <Route path="/store/warehouse" element={<AuthenticatedLayout><WarehouseManagement /></AuthenticatedLayout>} />
        <Route path="/warehouse"       element={<Navigate to="/store/warehouse" replace />} />
        <Route path="/store"           element={<AuthenticatedLayout><MedicalStoreInventory /></AuthenticatedLayout>} />

        {/* ─── Shared / General ──────────────────────────────────── */}
        <Route path="/dashboard"   element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
        <Route path="/patients"    element={<AuthenticatedLayout><PatientsList /></AuthenticatedLayout>} />
        <Route path="/patients/new" element={<AuthenticatedLayout><AddNewPatient /></AuthenticatedLayout>} />
        <Route path="/patients/:id" element={<AuthenticatedLayout><PatientProfile /></AuthenticatedLayout>} />
        <Route path="/fees"        element={<AuthenticatedLayout><FeesReports /></AuthenticatedLayout>} />
        <Route path="/public/queue" element={<Navigate to="/live" replace />} />
        <Route path="/settings"    element={<OwnerLayout><ClinicSettings /></OwnerLayout>} />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
