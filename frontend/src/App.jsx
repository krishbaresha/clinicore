import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { initDB, dbPatients } from "./api/db.js";
import { AuthProvider } from "./context/AuthContext.jsx";
import { useAuth } from "./hooks/useAuth.js";
import SidebarLayout from "./layouts/SidebarLayout.jsx";
import LicenseGuard from "./components/LicenseGuard.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

import { lazyWithRetry } from "./utils/lazyWithRetry.js";

// Lazy-loaded routes with auto-retry on dynamic chunk update / cache mismatch
const LoginScreen           = lazyWithRetry(() => import("./pages/LoginScreen.jsx"));
const Dashboard             = lazyWithRetry(() => import("./pages/Dashboard.jsx"));
const PatientsList          = lazyWithRetry(() => import("./pages/PatientsList.jsx"));
const PatientProfile        = lazyWithRetry(() => import("./pages/PatientProfile.jsx"));
const AddNewPatient         = lazyWithRetry(() => import("./pages/AddNewPatient.jsx"));
const FeesReports           = lazyWithRetry(() => import("./pages/FeesReports.jsx"));
const MedicalStoreInventory = lazyWithRetry(() => import("./pages/MedicalStoreInventory.jsx"));
const ClinicSettings        = lazyWithRetry(() => import("./pages/ClinicSettings.jsx"));

const PatientRegistration   = lazyWithRetry(() => import("./pages/PatientRegistration.jsx"));
const ReceptionQueue        = lazyWithRetry(() => import("./pages/ReceptionQueue.jsx"));
const PendingReports        = lazyWithRetry(() => import("./pages/PendingReports.jsx"));
const DoctorQueue           = lazyWithRetry(() => import("./pages/DoctorQueue.jsx"));
const ConsultationScreen    = lazyWithRetry(() => import("./pages/ConsultationScreen.jsx"));
const MedicalStorePOS       = lazyWithRetry(() => import("./pages/MedicalStorePOS.jsx"));
const SupplierPurchases     = lazyWithRetry(() => import("./pages/SupplierPurchases.jsx"));
const MedicalStoreSalesLog  = lazyWithRetry(() => import("./pages/MedicalStoreSalesLog.jsx"));
const WarehouseManagement   = lazyWithRetry(() => import("./pages/WarehouseManagement.jsx"));
const PublicLiveQueue       = lazyWithRetry(() => import("./pages/PublicLiveQueue.jsx"));
const LandingPage           = lazyWithRetry(() => import("./pages/LandingPage.jsx"));
const ClinicPublicPage      = lazyWithRetry(() => import("./pages/ClinicPublicPage.jsx"));
const DeveloperAdminPanel   = lazyWithRetry(() => import("./pages/DeveloperAdminPanel.jsx"));
const ReceiptStudio         = lazyWithRetry(() => import("./pages/ReceiptStudio.jsx"));

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
  if (!user) return <Navigate to="/login" replace />;
  const isAdminOrOwner = user.is_owner || user.role === "admin" || user.role === "owner" || user.userId === "user_admin";
  if (!isAdminOrOwner) return <Navigate to="/dashboard" replace />;
  return children;
}

/**
 * AdminOrOwnerRoute — Senior Engineering Guard for High-Privilege Tools like Receipt Studio.
 * Requires user to be logged in as Owner/Admin OR authenticated via Super Admin Master Passcode.
 */
function AdminOrOwnerRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  
  const isSuperAdminAuthed = typeof sessionStorage !== "undefined" && sessionStorage.getItem("cf_dev_auth") === "true";
  const isAdminOrOwner = user && (user.is_owner || user.role === "admin" || user.role === "owner" || user.userId === "user_admin");

  if (!isSuperAdminAuthed && !isAdminOrOwner) {
    // If not authenticated as Admin/Owner, redirect to login
    return <Navigate to="/login" replace />;
  }
  return children;
}

/**
 * AuthenticatedLayout — wraps protected pages in the SidebarLayout.
 */
function AuthenticatedLayout({ children }) {
  return (
    <ProtectedRoute>
      <LicenseGuard>
        <SidebarLayout>{children}</SidebarLayout>
      </LicenseGuard>
    </ProtectedRoute>
  );
}

/**
 * OwnerLayout — wraps owner-only pages in the SidebarLayout.
 */
function OwnerLayout({ children }) {
  return (
    <OwnerRoute>
      <LicenseGuard>
        <SidebarLayout>{children}</SidebarLayout>
      </LicenseGuard>
    </OwnerRoute>
  );
}

/**
 * AdminProtectedLayout — wraps admin/owner pages in the SidebarLayout with strict permission check.
 */
function AdminProtectedLayout({ children }) {
  return (
    <AdminOrOwnerRoute>
      <LicenseGuard>
        <SidebarLayout>{children}</SidebarLayout>
      </LicenseGuard>
    </AdminOrOwnerRoute>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Public & Admin Landing Pages */}
        <Route path="/"            element={<LandingPage />} />
        <Route path="/landing"     element={<LandingPage />} />
        <Route path="/admin"       element={<DeveloperAdminPanel />} />
        <Route path="/developer-admin" element={<DeveloperAdminPanel />} />
        <Route path="/developer"   element={<DeveloperAdminPanel />} />
        <Route path="/login"       element={<LoginScreen />} />

        {/* ─── High-Security Thermal Receipt Studio (Admin / Owner Only) ─── */}
        <Route path="/receipt-studio" element={<AdminProtectedLayout><ReceiptStudio /></AdminProtectedLayout>} />

        {/* ─── Disabled Pages (Can be re-enabled in future if needed) ─── */}
        {/* <Route path="/clinic"      element={<ClinicPublicPage />} /> */}
        {/* <Route path="/dr-asif"     element={<ClinicPublicPage />} /> */}
        {/* <Route path="/live"        element={<PublicLiveQueue />} /> */}
        {/* <Route path="/display"     element={<PublicLiveQueue />} /> */}
        <Route path="/clinic"      element={<Navigate to="/login" replace />} />
        <Route path="/dr-asif"     element={<Navigate to="/login" replace />} />
        <Route path="/live"        element={<Navigate to="/dashboard" replace />} />
        <Route path="/display"     element={<Navigate to="/dashboard" replace />} />
        <Route path="/public/queue" element={<Navigate to="/dashboard" replace />} />

        {/* ─── Reception / Counter Flow ─────────────────────────── */}
        <Route path="/reception/register"        element={<AuthenticatedLayout><PatientRegistration /></AuthenticatedLayout>} />
        <Route path="/reception/queue"           element={<AuthenticatedLayout><ReceptionQueue /></AuthenticatedLayout>} />
        <Route path="/reception/pending-reports" element={<AuthenticatedLayout><PendingReports /></AuthenticatedLayout>} />

        {/* ─── Doctor Flow ──────────────────────────────────────── */}
        <Route path="/doctor/queue"                   element={<AuthenticatedLayout><DoctorQueue /></AuthenticatedLayout>} />
        <Route path="/doctor/consultation/:visitId"   element={<AuthenticatedLayout><ConsultationScreen /></AuthenticatedLayout>} />

        {/* ─── Medical Store ─────────────────────────────────────── */}
        <Route path="/pos"             element={<Navigate to="/store/pos" replace />} />
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
        <Route path="/settings"    element={<OwnerLayout><ClinicSettings /></OwnerLayout>} />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function App() {
  // Seed DB and run automated retention lifecycle check (purge patients inactive > 24 months)
  useEffect(() => {
    initDB();
    try {
      // Auto-purge patient profiles with 0 visits in the last 2 years (24 months)
      dbPatients.autoPurgeExpiredPatients(24);
    } catch (e) {
      console.warn("Retention lifecycle check deferred:", e);
    }
  }, []);

  const content = (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );

  if (CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/login">
        {content}
      </ClerkProvider>
    );
  }

  return content;
}

