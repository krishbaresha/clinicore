import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getInitials } from "../utils/formatters.js";
import { dbClinic, exportFullDatabase } from "../api/db.js";

// Integrated Role Navigation — Single Desk Receptionist/Cashier/Staff unified portal vs Doctor Owner portal
const UNIFIED_DESK_NAV = [
  { label: "Dashboard",         icon: "dashboard",          path: "/dashboard" },
  { label: "Register Patient",  icon: "how_to_reg",         path: "/reception/register" },
  { label: "Today's Queue",     icon: "event_note",         path: "/reception/queue" },
  { label: "Live TV Screen",    icon: "tv",                 path: "/live", target: "_blank" },
  { label: "POS / Pharmacy",    icon: "point_of_sale",      path: "/store/pos" },
  { label: "Sales Audit & Returns", icon: "receipt_long",   path: "/store/sales" },
  { label: "Company Purchases", icon: "local_shipping",     path: "/store/purchases" },
  { label: "Central Warehouse", icon: "warehouse",          path: "/store/warehouse" },
  { label: "Store Inventory",   icon: "inventory_2",        path: "/store" },
  { label: "Pending Reports",   icon: "pending_actions",    path: "/reception/pending-reports" },
  { label: "Patients",          icon: "group",              path: "/patients" },
  { label: "Fees & Reports",    icon: "payments",           path: "/fees" },
  { label: "Settings",          icon: "settings",           path: "/settings", spacer: true },
];

const NAV_BY_ROLE = {
  receptionist: UNIFIED_DESK_NAV,
  cashier: UNIFIED_DESK_NAV,
  pharmacist: UNIFIED_DESK_NAV,
  doctor: [
    { label: "Dashboard (Revenue)", icon: "dashboard",     path: "/dashboard" },
    { label: "My OPD Queue",        icon: "queue",         path: "/doctor/queue" },
    { label: "Live TV Screen",       icon: "tv",            path: "/live", target: "_blank" },
    { label: "Patients & EMR",      icon: "group",         path: "/patients" },
    { label: "Fees & Analytics",    icon: "payments",      path: "/fees" },
    { label: "Settings",            icon: "settings",      path: "/settings", spacer: true },
  ],
};

// Fallback nav for admin / unknown roles — show all unified modules
const NAV_DEFAULT = [
  { label: "Dashboard",         icon: "dashboard",          path: "/dashboard" },
  { label: "Register Patient",  icon: "how_to_reg",         path: "/reception/register" },
  { label: "Today's Queue",     icon: "event_note",         path: "/reception/queue" },
  { label: "Live TV Screen",    icon: "tv",                 path: "/live", target: "_blank" },
  { label: "POS / Pharmacy",    icon: "point_of_sale",      path: "/store/pos" },
  { label: "Sales Audit & Returns", icon: "receipt_long",   path: "/store/sales" },
  { label: "Company Purchases", icon: "local_shipping",     path: "/store/purchases" },
  { label: "Central Warehouse", icon: "warehouse",          path: "/store/warehouse" },
  { label: "Store Inventory",   icon: "inventory_2",        path: "/store" },
  { label: "Pending Reports",   icon: "pending_actions",    path: "/reception/pending-reports" },
  { label: "My Queue",          icon: "queue",              path: "/doctor/queue" },
  { label: "Patients",          icon: "group",              path: "/patients" },
  { label: "Fees & Reports",    icon: "payments",           path: "/fees" },
  { label: "Settings",          icon: "settings",           path: "/settings", spacer: true },
];

// Mobile bottom nav — always shows most-used cross-role items
const MOBILE_NAV = [
  { label: "Home",     icon: "home",         path: "/dashboard" },
  { label: "Queue",    icon: "queue",        path: "/doctor/queue" },
  { label: "Register", icon: "how_to_reg",   path: "/reception/register" },
  { label: "Store",    icon: "point_of_sale",path: "/store/pos" },
  { label: "Patients", icon: "group",        path: "/patients" },
];

function NavItems({ items, onItemClick }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.path} className={item.spacer ? "mt-4" : ""}>
          {item.target === "_blank" ? (
            <a
              href={item.path}
              target="_blank"
              rel="noreferrer"
              onClick={onItemClick}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 nav-item hover:bg-teal-50 hover:text-teal-800 text-slate-700"
            >
              <span className="material-symbols-outlined text-teal-600">{item.icon}</span>
              <span className="font-body-md text-body-md flex items-center justify-between flex-1">
                {item.label}
                <span className="material-symbols-outlined text-xs text-gray-400">open_in_new</span>
              </span>
            </a>
          ) : (
            <NavLink
              to={item.path}
              end={item.path === "/store" || item.end}
              onClick={onItemClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 ${
                  isActive ? "nav-item-active" : "nav-item"
                }`
              }
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-body-md text-body-md">{item.label}</span>
            </NavLink>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function SidebarLayout({ children }) {
  const { user, clinic, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Build nav items — hide Settings for non-owner users (route is also guarded)
  const rawNavItems = (user?.role && NAV_BY_ROLE[user.role]) || NAV_DEFAULT;
  const navItems = user?.is_owner ? rawNavItems : rawNavItems.filter((item) => item.path !== "/settings");

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function SidebarContent({ onItemClick }) {
    return (
      <>
        {/* Logo */}
        <div className="px-5 mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            medical_services
          </span>
          <h1 className="font-bold text-xl text-primary truncate">{clinic?.name || "ClinicFlow"}</h1>
        </div>

        {/* User Chip */}
        {user && (
          <div className="mx-2 mb-4 flex items-center gap-2 bg-surface-container-low/50 rounded-xl px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-secondary-container text-primary flex items-center justify-center font-bold text-xs shrink-0">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-on-surface truncate">{user.name}</p>
              <p className="text-xs text-outline capitalize">{user.role}</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2">
          <NavItems items={navItems} onItemClick={onItemClick} />
        </nav>

        {/* Logout */}
        <div className="px-2 mt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-error hover:bg-error-container/30 rounded-xl transition-colors text-sm font-medium"
          >
            <span className="material-symbols-outlined">logout</span>
            Logout
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-x-hidden">
      {/* ── Desktop Sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-[260px] border-r border-white/20 backdrop-blur-xl bg-white/70 shadow-[0_8px_32px_0_rgba(15,118,110,0.08)] z-50 py-5">
        <SidebarContent onItemClick={undefined} />
      </aside>

      {/* ── Mobile Top App Bar ───────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 w-full flex justify-between items-center px-4 py-3 bg-background/80 backdrop-blur-md border-b border-outline-variant/30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1 text-on-surface-variant hover:bg-surface-container-high rounded-full focus:outline-none flex items-center justify-center"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            medical_services
          </span>
          <span className="font-bold text-base text-primary">{clinic?.name || "ClinicFlow"}</span>
        </div>
        {user && (
          <div className="w-9 h-9 rounded-full bg-secondary-container text-primary flex items-center justify-center font-bold text-xs">
            {getInitials(user.name)}
          </div>
        )}
      </header>

      {/* ── Mobile Sidebar Drawer ─────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex flex-col w-[260px] max-w-[80vw] h-full bg-white/95 backdrop-blur-xl border-r border-white/20 shadow-2xl z-10 py-5">
            <div className="px-5 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
                <span className="font-bold text-base text-primary truncate max-w-[140px]">{clinic?.name || "ClinicFlow"}</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-full hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>
            <SidebarContent onItemClick={() => setMobileMenuOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main Content Area ────────────────────────────── */}
      <main className="flex-1 md:ml-[260px] min-h-screen pb-24 md:pb-8 min-w-0 w-full">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation ─────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-45 bg-surface/90 backdrop-blur-lg rounded-t-xl border-t border-white/20 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <ul className="flex justify-around items-center h-16 px-2">
          {MOBILE_NAV.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center px-3 py-1 rounded-xl touch-manipulation transition-colors ${
                    isActive
                      ? "bg-primary-container text-on-primary-container"
                      : "text-on-surface-variant"
                  }`
                }
              >
                <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                <span className="text-xs mt-0.5 font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
