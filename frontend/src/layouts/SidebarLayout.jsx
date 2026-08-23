// ClinicFlow Master Enterprise Responsive Layout & Collapsible Navigation Engine v2.5
// Built with UI/UX Pro Max standards for high-performance medical workflows
import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { getInitials } from "../utils/formatters.js";
import { dbClinic, exportFullDatabase } from "../api/db.js";
import PullToRefresh from "../components/PullToRefresh.jsx";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";
import LicenseBanner from "../components/LicenseBanner.jsx";
import { syncEngine } from "../api/syncEngine.js";
import { useTranslation } from "react-i18next";

// 1. Unified Front Desk & Medical Store Operator (Receptionist + Pharmacist / Cashier)
const UNIFIED_DESK_NAV = [
  { label: "Dashboard", icon: "dashboard", path: "/dashboard" },
  { label: "Register Patient", icon: "how_to_reg", path: "/reception/register" },
  { label: "Today's Queue", icon: "event_note", path: "/reception/queue" },
  { label: "Counter POS", icon: "point_of_sale", path: "/store/pos" },
  { label: "Store Inventory", icon: "inventory_2", path: "/store" },
  { label: "Sales Log & Returns", icon: "receipt_long", path: "/store/sales" },
  { label: "Purchases & Inward", icon: "local_shipping", path: "/store/purchases" },
  { label: "Warehouse & Wholesale", icon: "warehouse", path: "/store/warehouse" },
  { label: "Pending Reports", icon: "pending_actions", path: "/reception/pending-reports" },
  { label: "Patients & EMR", icon: "group", path: "/patients" },
  { label: "Fees & CashBook", icon: "payments", path: "/fees" },
];

// 2. Warehouse & Wholesale Distribution Portal
const WAREHOUSE_NAV = [
  { label: "Dashboard", icon: "dashboard", path: "/dashboard" },
  { label: "Godown & Wholesale", icon: "warehouse", path: "/store/warehouse" },
  { label: "Company Purchases (GRN)", icon: "add_business", path: "/store/purchases" },
  { label: "Store Counter Inventory", icon: "inventory_2", path: "/store" },
  { label: "Fees & CashBook", icon: "payments", path: "/fees" },
];

// 3. Doctor — Strict Consultation-Only Portal (3 tabs only)
// Rule: Doctor ke pas sirf apna consultation data dikhe
const DOCTOR_NAV = [
  { label: "Dashboard", icon: "dashboard", path: "/dashboard" },
  { label: "Doctor Consultation", icon: "stethoscope", path: "/doctor/queue" },
  { label: "Patients & EMR", icon: "group", path: "/patients" },
];

const NAV_BY_ROLE = {
  receptionist: UNIFIED_DESK_NAV,
  cashier: UNIFIED_DESK_NAV,
  pharmacist: UNIFIED_DESK_NAV,
  warehouse: WAREHOUSE_NAV,
  doctor: DOCTOR_NAV,
};

// Fallback nav for owner / admin — full multi-portal switcher
const NAV_DEFAULT = [
  { label: "Dashboard", icon: "dashboard", path: "/dashboard" },
  { label: "Register Patient", icon: "how_to_reg", path: "/reception/register" },
  { label: "Today's Queue", icon: "event_note", path: "/reception/queue" },
  { label: "Doctor OPD Queue", icon: "queue", path: "/doctor/queue" },
  { label: "Retail POS", icon: "point_of_sale", path: "/store/pos" },
  { label: "Sales Log & Returns", icon: "receipt_long", path: "/store/sales" },
  { label: "Purchases (GRN)", icon: "local_shipping", path: "/store/purchases" },
  { label: "Central Warehouse & B2B", icon: "warehouse", path: "/store/warehouse" },
  { label: "Store Inventory", icon: "inventory_2", path: "/store" },
  { label: "Patients & EMR", icon: "group", path: "/patients" },
  { label: "Fees & CashBook", icon: "payments", path: "/fees" },
  { label: "Clinic Settings", icon: "settings", path: "/settings", spacer: true },
];

export default function SidebarLayout({ children }) {
  const { user, clinic, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Desktop Collapsible Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return localStorage.getItem("cf_sidebar_expanded") !== "false";
  });
  
  // Mobile Slide-over Drawer State
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Native PWA Deferred Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Live PWA Cloud Sync Status State
  const [syncState, setSyncState] = useState(() => syncEngine.getStatus());

  useEffect(() => {
    const unsub = syncEngine.subscribe(setSyncState);
    return unsub;
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        console.log("PWA Installed successfully");
      }
      setDeferredPrompt(null);
    } else {
      alert(
        "📱 To install ClinicFlow as a Native Desktop / Mobile App:\n\n" +
        "1. Chrome / Edge Desktop: Click the Install icon in your address bar (top-right).\n" +
        "2. Android Chrome: Tap Menu (⋮) ➔ 'Install App' or 'Add to Home Screen'.\n" +
        "3. Apple iOS Safari: Tap Share (📤) ➔ 'Add to Home Screen'."
      );
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem("cf_sidebar_expanded", next.toString());
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Background Automated Backup Timer — runs silently across Doctor/Cashier/Reception desks
  useEffect(() => {
    async function checkAndRunAutoBackup() {
      const c = dbClinic.get();
      if (!c || !c.backup_email || c.backup_frequency === "manual") return;

      const intervalHours = Number(c.backup_interval_hours) || (c.backup_frequency === "daily" ? 24 : c.backup_frequency === "weekly" ? 168 : 720);
      const intervalMs = intervalHours * 60 * 60 * 1000;
      const lastBackupMs = c.last_email_backup ? new Date(c.last_email_backup).getTime() : 0;
      const nowMs = Date.now();

      if (nowMs - lastBackupMs >= intervalMs) {
        try {
          const backup = exportFullDatabase();
          const backupStr = JSON.stringify(backup, null, 2);
          const targetEmails = c.backup_email.split(",").map((e) => e.trim()).filter(Boolean);
          const resendKey = c.resend_api_key;
          if (!resendKey) return; // No API key configured — skip email backup silently

          const base64Content = btoa(unescape(encodeURIComponent(backupStr)));
          const resendPayload = {
            from: "ClinicFlow Backup <onboarding@resend.dev>",
            to: targetEmails,
            subject: `🏥 ClinicFlow Auto Backup - ${c.name || "Clinic"} (${new Date().toLocaleDateString("en-PK")})`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #ccfbf1;">
                <h2 style="color: #0f766e; margin-top: 0;">🏥 Automated Clinic Backup (Every ${intervalHours} Hours)</h2>
                <p><strong>Clinic:</strong> ${c.name || "ClinicFlow Clinic"}</p>
                <p><strong>Triggered At:</strong> ${new Date().toLocaleString("en-PK")}</p>
                <p><strong>Summary:</strong> Patients: ${backup.data.patients?.length || 0} | Sales: ${backup.data.sales?.length || 0} | Purchases: ${backup.data.purchases?.length || 0}</p>
                <p style="background: #e0f2fe; color: #0369a1; padding: 12px; border-radius: 8px; font-weight: bold;">
                  📎 Your automated clinic database backup is attached as a <code>.json</code> file!
                </p>
              </div>
            `,
            attachments: [{ filename: `ClinicFlow_AutoBackup_${new Date().toISOString().split("T")[0]}.json`, content: base64Content }]
          };

          let res;
          try {
            res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify(resendPayload)
            });
          } catch (fetchErr) {
            console.warn("Backup email send failed (CORS or network):", fetchErr.message);
            return;
          }

          if (res.ok) {
            dbClinic.update({ last_email_backup: new Date().toISOString() });
          }
        } catch (err) {
          console.warn("Background auto-backup failed silently:", err);
        }
      }
    }

    // Check every 3 minutes
    checkAndRunAutoBackup();
    const timer = setInterval(checkAndRunAutoBackup, 3 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Build nav items — ensure Admin / Owner gets full settings access
  const isAdminOrOwner = user?.is_owner || user?.role === "admin" || user?.role === "owner" || user?.userId === "user_admin";
  const rawNavItems = (user?.role && NAV_BY_ROLE[user.role]) || NAV_DEFAULT;
  const navItems = isAdminOrOwner ? rawNavItems : rawNavItems.filter((item) => item.path !== "/settings");

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const { t } = useTranslation();

  // Shared Nav List Renderer
  function NavigationList({ isFullWidth = true, onItemClick }) {
    return (
      <ul className="space-y-1">
        {navItems.map((item) => {
          // Dynamic translation lookup
          let displayLabel = item.label;
          if (item.path === "/dashboard") displayLabel = t("nav.dashboard", item.label);
          else if (item.path === "/reception/queue" || item.path === "/reception/register") displayLabel = t("nav.receptionQueue", item.label);
          else if (item.path === "/doctor/queue") displayLabel = t("nav.doctorQueue", item.label);
          else if (item.path === "/store/pos") displayLabel = t("nav.storePos", item.label);
          else if (item.path === "/store/warehouse") displayLabel = t("nav.warehouse", item.label);
          else if (item.path === "/store/purchases") displayLabel = t("nav.purchases", item.label);
          else if (item.path === "/patients") displayLabel = t("nav.patients", item.label);
          else if (item.path === "/fees") displayLabel = t("nav.fees", item.label);
          else if (item.path === "/settings") displayLabel = t("nav.settings", item.label);

          return (
            <li key={item.path} className={item.spacer ? "mt-3 pt-3 border-t border-teal-50" : ""}>
              <NavLink
                to={item.path}
                end={item.path === "/store" || item.end}
                onClick={onItemClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-teal-700 to-teal-600 text-white shadow-md shadow-teal-700/20 font-bold"
                      : "text-slate-600 hover:bg-teal-50 hover:text-teal-950 font-medium"
                  } ${!isFullWidth ? "justify-center px-0" : ""}`
                }
                title={!isFullWidth ? displayLabel : undefined}
              >
                <span className={`material-symbols-outlined text-xl flex-shrink-0 ${
                  !isFullWidth ? "text-2xl" : ""
                }`}>
                  {item.icon}
                </span>

                {isFullWidth && (
                  <span className="text-xs tracking-tight truncate flex-1">
                    {displayLabel}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf9] text-slate-800 font-sans selection:bg-teal-600 selection:text-white flex flex-col">
      
      {/* ── Top License & Subscription Reminder Banner ── */}
      <LicenseBanner />

      {/* ── Top Header Bar (Fixed & Consistent Across Devices) ── */}
      <header className="border-b border-teal-100 bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-xs h-16 flex items-center px-4 sm:px-6 justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Sidebar Open/Close Toggle Button */}
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileDrawerOpen(true);
              } else {
                toggleSidebar();
              }
            }}
            className="p-2 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <span className="material-symbols-outlined text-xl">
              {sidebarOpen ? "menu_open" : "menu"}
            </span>
          </button>

          {/* Brand Logo & Clinic Info */}
          <div className="flex items-center gap-2.5">
            <img
              src="/clinic-logo.png"
              alt="Clinic Logo"
              className="h-10 w-auto max-w-[120px] object-contain rounded-xl drop-shadow-xs"
              onError={(e) => {
                e.target.style.display = "none";
                if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
              }}
            />
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-700 to-teal-500 hidden items-center justify-center text-white font-black shadow-md shadow-teal-700/20">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                medical_services
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-teal-950 tracking-tight">CliniCore</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200">
                  HYBRID V2.5
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[160px] sm:max-w-xs">
                {clinic?.name || "Dr. Muhammad Kashif Khan Clinic"}
              </p>
            </div>
          </div>
        </div>

        {/* Right Header User Chip & Quick Action Links */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* PWA Cloud Sync Status Badge */}
          <button
            onClick={() => syncEngine.forceSyncNow()}
            className={`px-2.5 py-1.5 rounded-2xl text-[11px] font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
              !syncState.isOnline
                ? "bg-amber-50 text-amber-900 border-amber-200"
                : syncState.isSyncing
                ? "bg-teal-50 text-teal-800 border-teal-200 animate-pulse"
                : syncState.pendingCount > 0
                ? "bg-blue-50 text-blue-900 border-blue-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
            }`}
            title={
              !syncState.isOnline
                ? `Offline: ${syncState.pendingCount} records stored locally in outbox`
                : syncState.isSyncing
                ? "Syncing records to cloud..."
                : syncState.pendingCount > 0
                ? `${syncState.pendingCount} pending records in outbox (Click to sync)`
                : "Cloud Sync Active & In Lockstep"
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                !syncState.isOnline
                  ? "bg-amber-500 animate-ping"
                  : syncState.isSyncing
                  ? "bg-teal-600 animate-spin"
                  : "bg-emerald-500"
              }`}
            />
            <span className="hidden lg:inline">
              {!syncState.isOnline
                ? `Offline (${syncState.pendingCount})`
                : syncState.isSyncing
                ? "Syncing..."
                : syncState.pendingCount > 0
                ? `Sync (${syncState.pendingCount})`
                : "Cloud Live"}
            </span>
          </button>

          <LanguageSwitcher />



          {user && (
            <div className="flex items-center gap-2 bg-teal-50/80 border border-teal-100 rounded-2xl px-2.5 sm:px-3 py-1.5 shadow-xs">
              <div className="w-7 h-7 rounded-full bg-teal-700 text-white flex items-center justify-center font-black text-[11px] shadow-xs">
                {getInitials(user.name)}
              </div>
              <div className="hidden sm:block text-left min-w-0 pr-1">
                <p className="font-bold text-xs text-teal-950 truncate max-w-[120px]">{user.name}</p>
                <p className="text-[9.5px] font-bold text-teal-700 capitalize leading-none">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out / Exit Portal"
                className="p-1 text-rose-600 hover:text-white hover:bg-rose-600 rounded-xl transition-all flex items-center justify-center border border-rose-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Body with Collapsible Desktop Sidebar ── */}
      <div className="flex flex-1 relative min-w-0">

        {/* ── Desktop Left Sidebar Menu ── */}
        <aside
          className={`
            hidden md:flex flex-col justify-between
            bg-white border-r border-teal-100 shadow-sm
            transition-all duration-300 ease-in-out fixed top-16 bottom-0 left-0 z-30
            ${sidebarOpen ? "w-[280px]" : "w-[80px]"}
          `}
        >
          {/* Navigation Items */}
          <div className="p-3.5 space-y-2 overflow-y-auto flex-1 touch-scroll">
            <div className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 ${!sidebarOpen ? "text-center" : ""}`}>
              {sidebarOpen ? "Clinic & Store Menu" : "•"}
            </div>

            <NavigationList isFullWidth={sidebarOpen} onItemClick={undefined} />
          </div>

          {/* Bottom Sidebar Footer */}
          <div className="p-3 border-t border-teal-50 flex flex-col gap-2 bg-slate-50/60">
            {sidebarOpen ? (
              <>
                {/* Install App Trigger Button in Sidebar */}
                <button
                  onClick={handleInstallPWA}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-2xl transition-all text-xs font-bold shadow-xs cursor-pointer"
                  title="Install ClinicFlow App"
                >
                  <span className="material-symbols-outlined text-base text-emerald-700">install_desktop</span>
                  <span>Install Desktop App</span>
                </button>

                <div className="flex items-center justify-between w-full px-2 pt-1">
                  <div className="text-[11px] font-bold text-slate-500">
                    {clinic?.name?.split(" ")[0] || "ClinicFlow"} OS
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer"
                    title="Collapse Sidebar"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleInstallPWA}
                  className="w-full p-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors flex items-center justify-center cursor-pointer border border-emerald-200"
                  title="Install Desktop App"
                >
                  <span className="material-symbols-outlined text-base text-emerald-700">install_desktop</span>
                </button>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="w-full p-1.5 rounded-xl hover:bg-teal-100 text-teal-800 transition-colors flex items-center justify-center cursor-pointer"
                  title="Expand Sidebar"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Mobile Slide-over Drawer (Always Fully Expanded & Beautiful) ── */}
        {mobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop Blur Overlay */}
            <div
              onClick={() => setMobileDrawerOpen(false)}
              className="fixed inset-0 bg-teal-950/60 backdrop-blur-sm transition-opacity"
            />

            {/* Slide-out Drawer Panel */}
            <aside className="relative flex flex-col w-[300px] max-w-[85vw] h-full bg-white shadow-2xl z-10 animate-slide-right">
              {/* Drawer Top Header */}
              <div className="p-4 border-b border-teal-100 flex items-center justify-between bg-gradient-to-r from-teal-50/80 to-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-700/20">
                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      medical_services
                    </span>
                  </div>
                  <div>
                    <h2 className="font-black text-sm text-teal-950 tracking-tight">ClinicFlow</h2>
                    <p className="text-[10px] text-slate-500 font-medium truncate max-w-[160px]">
                      {clinic?.name || "Clinic"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-teal-100 text-slate-500 hover:text-teal-900 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Staff Profile Card inside Mobile Drawer */}
              {user && (
                <div className="mx-3 mt-3 p-3 bg-teal-50/80 border border-teal-100 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-teal-950 truncate">{user.name}</p>
                      <p className="text-[10px] font-bold text-teal-700 capitalize leading-none">{user.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
                    title="Sign Out"
                  >
                    <span className="material-symbols-outlined text-base">logout</span>
                  </button>
                </div>
              )}

              {/* Navigation Items (Fully expanded with labels) */}
              <div className="p-3 overflow-y-auto flex-1 touch-scroll">
                <NavigationList isFullWidth={true} onItemClick={() => setMobileDrawerOpen(false)} />
              </div>

              {/* Mobile Drawer Bottom Actions */}
              <div className="p-3 border-t border-teal-50 bg-slate-50/60 space-y-2">
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    handleInstallPWA();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-2xl transition-all text-xs font-bold shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-emerald-700">install_mobile</span>
                  <span>Install App on Phone</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-2xl transition-all text-xs font-bold shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  <span>Sign Out / Exit Portal</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* ── Main Content Area with Dynamic Desktop Margin & Natural Scrolling ── */}
        <main
          className={`
            flex-1 min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 pb-24 md:pb-12
            transition-all duration-300 ease-in-out
            ${sidebarOpen ? "md:ml-[280px]" : "md:ml-[80px]"}
          `}
        >
          <PullToRefresh>
            {children}
          </PullToRefresh>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (Fast 1-Thumb Touch Targets) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-40 bg-white/95 backdrop-blur-lg border-t border-teal-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <ul className="flex justify-around items-center h-16 px-1">
          {navItems.slice(0, 4).map((item) => (
            <li key={item.path} className="flex-1 min-w-[50px] text-center">
              <NavLink
                to={item.path}
                end={item.path === "/store" || item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all ${
                    isActive
                      ? "text-teal-800 font-black bg-teal-50"
                      : "text-slate-500 font-semibold hover:text-teal-700"
                  }`
                }
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">{item.label.split(" ")[0]}</span>
              </NavLink>
            </li>
          ))}
          <li className="flex-1 min-w-[50px] text-center">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-teal-800 font-black hover:bg-teal-50 transition-all w-full cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
              <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
