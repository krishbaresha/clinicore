import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, Suspense } from "react";
import { initDB, dbPatients } from "./api/db.js";
import { waitForDiskCache } from "./api/storageDriver.js";
import { AuthProvider } from "./context/AuthContext.jsx";
import { useAuth } from "./hooks/useAuth.js";
import SidebarLayout from "./layouts/SidebarLayout.jsx";
import LicenseGuard from "./components/LicenseGuard.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import PWAUpdateBanner from "./components/PWAUpdateBanner.jsx";

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
const SaleInvoicePOSPage    = lazyWithRetry(() => import("./pages/SaleInvoicePOSPage.jsx"));
const SupplierPurchases     = lazyWithRetry(() => import("./pages/SupplierPurchases.jsx"));
const MedicalStoreSalesLog  = lazyWithRetry(() => import("./pages/MedicalStoreSalesLog.jsx"));
const WarehouseManagement   = lazyWithRetry(() => import("./pages/WarehouseManagement.jsx"));
const PublicLiveQueue       = lazyWithRetry(() => import("./pages/PublicLiveQueue.jsx"));
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
 * AdminOrOwnerRoute — Strict Super Admin Developer Guard for Receipt Studio.
 * Requires user to be authenticated in Super Admin Panel via Developer Master Passcode.
 */
function AdminOrOwnerRoute({ children }) {
  const { loading } = useAuth();
  if (loading) return null;
  
  const isSuperAdminAuthed = typeof sessionStorage !== "undefined" && sessionStorage.getItem("cf_dev_auth") === "true";

  if (!isSuperAdminAuthed) {
    // If not authenticated via Super Admin Master Passcode, bounce to Super Admin login
    return <Navigate to="/admin" replace />;
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

import { isDesktopApp } from "./utils/desktop.js";

const GodAdminPanel          = lazyWithRetry(() => import("./pages/GodAdminPanel.jsx"));

import { canAccessRoutePath, getDefaultRouteForRole } from "./config/permissions.js";
import { useLocation } from "react-router-dom";

/**
 * RoleProtectedRoute — Restricts route access using canonical permissions policy.
 * Non-permitted roles fail-closed and redirect to their default home portal.
 */
function RoleProtectedRoute({ allowedRoles, targetPath, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const pathToCheck = targetPath || location.pathname;
  const isAuthorized = canAccessRoutePath(user, pathToCheck);

  if (!isAuthorized) {
    const target = getDefaultRouteForRole(user.role);
    return <Navigate to={target} replace />;
  }
  return children;
}

function AppRoutes() {
  const desktopMode = isDesktopApp();

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Public & Admin Landing Pages */}
        <Route path="/"            element={<Navigate to="/login" replace />} />
        <Route path="/landing"     element={<Navigate to="/login" replace />} />
        <Route path="/admin"       element={<DeveloperAdminPanel />} />
        <Route path="/developer-admin" element={<DeveloperAdminPanel />} />
        <Route path="/developer"   element={<DeveloperAdminPanel />} />
        <Route path="/god-admin"   element={<AdminProtectedLayout><GodAdminPanel /></AdminProtectedLayout>} />
        <Route path="/login"       element={<LoginScreen />} />

        {/* ─── High-Security Thermal Receipt Studio (Super Admin Master Passcode Only) ─── */}
        <Route path="/receipt-studio" element={<AdminOrOwnerRoute><ReceiptStudio /></AdminOrOwnerRoute>} />

        {/* ─── Public Waiting Room Live Queue Display (TV / Fullscreen Lounge) ─── */}
        <Route path="/live"         element={<PublicLiveQueue />} />
        <Route path="/display"      element={<PublicLiveQueue />} />
        <Route path="/public/queue" element={<PublicLiveQueue />} />

        {/* ─── Reception / Counter Flow (Receptionist / Admin) ─────────────────────────── */}
        <Route path="/reception/register"        element={<AuthenticatedLayout><RoleProtectedRoute allowedRoles={['receptionist', 'admin', 'owner', 'manager']}><PatientRegistration /></RoleProtectedRoute></AuthenticatedLayout>} />
        <Route path="/reception/queue"           element={<AuthenticatedLayout><RoleProtectedRoute allowedRoles={['receptionist', 'admin', 'owner', 'manager']}><ReceptionQueue /></RoleProtectedRoute></AuthenticatedLayout>} />
        <Route path="/reception/pending-reports" element={<AuthenticatedLayout><RoleProtectedRoute allowedRoles={['receptionist', 'admin', 'owner', 'manager']}><PendingReports /></RoleProtectedRoute></AuthenticatedLayout>} />

        {/* ─── Doctor Flow (Doctor / Admin) ──────────────────────────────────────── */}
        <Route path="/doctor/queue"                   element={<AuthenticatedLayout><RoleProtectedRoute allowedRoles={['doctor', 'admin', 'owner']}><DoctorQueue /></RoleProtectedRoute></AuthenticatedLayout>} />
        <Route path="/doctor/consultation/:visitId"   element={<AuthenticatedLayout><RoleProtectedRoute allowedRoles={['doctor', 'admin', 'owner']}><ConsultationScreen /></RoleProtectedRoute></AuthenticatedLayout>} />

        {/* ─── Medical Store (Cashier / Pharmacist / Admin) ─────────────────────────── */}
        <Route path="/pos"             element={<Navigate to="/store/pos" replace />} />
        <Route path="/store/pos"       element={<AuthenticatedLayout><RoleProtectedRoute allowedRoles={['cashier', 'pharmacist', 'admin', 'owner', 'manager']}><SaleInvoicePOSPage /></RoleProtectedRoute></AuthenticatedLayout>} />
        <Route path="/store/purchases" element={<AuthenticatedLayout><RoleProtectedRoute allowedRoles={['pharmacist', 'warehouse', 'admin', 'owner', 'manager']}><SupplierPurchases /></RoleProtectedRoute></AuthenticatedLayout>} />
        <Route path="/purchases"       element={<Navigate to="/store/purchases" replace />} />
        <Route path="/store/sales"     element={<AuthenticatedLayout><RoleProtectedRoute allowedRoles={['cashier', 'pharmacist', 'admin', 'owner', 'manager']}><MedicalStoreSalesLog /></RoleProtectedRoute></AuthenticatedLayout>} />
        <Route path="/store/sales-log" element={<Navigate to="/store/sales" replace />} />
        <Route path="/store/warehouse" element={<AuthenticatedLayout><RoleProtectedRoute allowedRoles={['warehouse', 'pharmacist', 'admin', 'owner', 'manager']}><WarehouseManagement /></RoleProtectedRoute></AuthenticatedLayout>} />
        <Route path="/warehouse"       element={<Navigate to="/store/warehouse" replace />} />
        <Route path="/store"           element={<AuthenticatedLayout><RoleProtectedRoute allowedRoles={['pharmacist', 'warehouse', 'admin', 'owner', 'manager']}><MedicalStoreInventory /></RoleProtectedRoute></AuthenticatedLayout>} />

        {/* ─── Shared / General ──────────────────────────────────── */}
        <Route path="/dashboard"   element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
        <Route path="/patients"    element={<AuthenticatedLayout><PatientsList /></AuthenticatedLayout>} />
        <Route path="/patients/new" element={<AuthenticatedLayout><AddNewPatient /></AuthenticatedLayout>} />
        <Route path="/patients/:id" element={<AuthenticatedLayout><PatientProfile /></AuthenticatedLayout>} />
        <Route path="/fees"        element={<AuthenticatedLayout><FeesReports /></AuthenticatedLayout>} />
        <Route path="/settings"    element={<Navigate to="/dashboard" replace />} />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  const [storageReady, setStorageReady] = useState(false);

  // Seed DB and run automated retention lifecycle check (purge patients inactive > 24 months)
  useEffect(() => {
    let mounted = true;
    async function setupStorage() {
      try {
        await Promise.race([
          waitForDiskCache(),
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]);
        initDB();

        if (mounted) setStorageReady(true);

        try {
          // Auto-purge patient profiles with 0 visits in the last 2 years (24 months)
          dbPatients.autoPurgeExpiredPatients(24);
        } catch (e) {
          console.warn("Retention lifecycle check deferred:", e);
        }
      } catch (err) {
        console.error("Storage setup failed:", err);
        if (mounted) setStorageReady(true);
      }
    }
    setupStorage();

    // Global fail-safe timeout (1.5s max) to guarantee app unblocks on all mobile browsers
    const fallbackTimer = setTimeout(() => {
      if (mounted) setStorageReady(true);
    }, 1500);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
    };
  }, []);

  if (!storageReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white font-sans">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-sm font-semibold tracking-wide text-slate-400 uppercase">ClinicFlow</p>
          <p className="text-xs text-slate-500 mt-1">Initializing Secure Storage...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <PWAUpdateBanner />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

