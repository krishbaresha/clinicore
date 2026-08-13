import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { initDB } from "./api/db.js";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import SidebarLayout from "./layouts/SidebarLayout.jsx";

// Pages
import LoginScreen               from "./pages/LoginScreen.jsx";
import Dashboard                 from "./pages/Dashboard.jsx";
import PatientsList              from "./pages/PatientsList.jsx";
import PatientProfile            from "./pages/PatientProfile.jsx";
import AddNewPatient             from "./pages/AddNewPatient.jsx";
import NewVisitPrescriptionEntry from "./pages/NewVisitPrescriptionEntry.jsx";
import PrintablePrescriptionView from "./pages/PrintablePrescriptionView.jsx";
import PrintPrescriptionIsolated from "./pages/PrintPrescriptionIsolated.jsx";
import FeesReports               from "./pages/FeesReports.jsx";
import MedicalStoreInventory     from "./pages/MedicalStoreInventory.jsx";
import MedicalStoreSalesLog      from "./pages/MedicalStoreSalesLog.jsx";
import ClinicSettings            from "./pages/ClinicSettings.jsx";

/**
 * ProtectedRoute — wraps pages that require a logged-in session.
 * Redirects to /login if no session found.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null; // Avoid flash before session is restored
  if (!user)   return <Navigate to="/login" replace />;
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

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginScreen />} />

      {/* Authenticated — wrapped in sidebar layout */}
      <Route path="/dashboard" element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
      <Route path="/patients"  element={<AuthenticatedLayout><PatientsList /></AuthenticatedLayout>} />
      <Route path="/patients/new" element={<AuthenticatedLayout><AddNewPatient /></AuthenticatedLayout>} />
      <Route path="/patients/:id" element={<AuthenticatedLayout><PatientProfile /></AuthenticatedLayout>} />
      <Route path="/visits/new"   element={<AuthenticatedLayout><NewVisitPrescriptionEntry /></AuthenticatedLayout>} />

      {/* Print view — no sidebar, clean white page */}
      <Route path="/visits/:id/print" element={
        <ProtectedRoute><PrintablePrescriptionView /></ProtectedRoute>
      } />
      <Route path="/print/prescription/:id" element={
        <ProtectedRoute><PrintPrescriptionIsolated /></ProtectedRoute>
      } />

      <Route path="/fees"         element={<AuthenticatedLayout><FeesReports /></AuthenticatedLayout>} />
      <Route path="/store"        element={<AuthenticatedLayout><MedicalStoreInventory /></AuthenticatedLayout>} />
      <Route path="/store/sales"  element={<AuthenticatedLayout><MedicalStoreSalesLog /></AuthenticatedLayout>} />
      <Route path="/settings"     element={<AuthenticatedLayout><ClinicSettings /></AuthenticatedLayout>} />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
      <Route path="/"  element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  // Seed the localStorage DB once on very first load
  useEffect(() => { initDB(); }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
