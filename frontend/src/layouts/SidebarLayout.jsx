import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { getInitials } from "../utils/formatters.js";
import { dbClinic, exportFullDatabase } from "../api/db.js";

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
  { label: "Patients", icon: "group", path: "/patients" },
  { label: "Fees & CashBook", icon: "payments", path: "/fees" },
  { label: "Live TV Screen", icon: "tv", path: "/live", target: "_blank" },
  { label: "Settings", icon: "settings", path: "/settings", spacer: true },
];

// 2. Warehouse & Wholesale Distribution Portal
const WAREHOUSE_NAV = [
  { label: "Godown & Wholesale", icon: "warehouse", path: "/store/warehouse" },
  { label: "Company Purchases (GRN)", icon: "add_business", path: "/store/purchases" },
  { label: "Store Counter Inventory", icon: "inventory_2", path: "/store" },
  { label: "Fees & CashBook", icon: "payments", path: "/fees" },
  { label: "Settings", icon: "settings", path: "/settings", spacer: true },
];

// 3. Doctor Consultation Portal
const DOCTOR_NAV = [
  { label: "Dashboard", icon: "dashboard", path: "/dashboard" },
  { label: "My OPD Queue", icon: "queue", path: "/doctor/queue" },
  { label: "Patients & EMR", icon: "group", path: "/patients" },
  { label: "Fees & Reports", icon: "payments", path: "/fees" },
  { label: "Settings", icon: "settings", path: "/settings", spacer: true },
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
  { label: "Live TV Screen", icon: "tv", path: "/live", target: "_blank" },
  { label: "Retail POS", icon: "point_of_sale", path: "/store/pos" },
  { label: "Sales Log & Returns", icon: "receipt_long", path: "/store/sales" },
  { label: "Purchases (GRN)", icon: "local_shipping", path: "/store/purchases" },
  { label: "Central Warehouse & B2B", icon: "warehouse", path: "/store/warehouse" },
  { label: "Store Inventory", icon: "inventory_2", path: "/store" },
  { label: "Patients & EMR", icon: "group", path: "/patients" },
  { label: "Fees & CashBook", icon: "payments", path: "/fees" },
  { label: "Settings", icon: "settings", path: "/settings", spacer: true },
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
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 ${isActive ? "nav-item-active" : "nav-item"
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
        <div className="px-5 mb-4 flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            medical_services
          </span>
          <h1 className="font-bold text-lg text-primary truncate">{clinic?.name || "ClinicFlow"}</h1>
        </div>

        {/* User Chip with Quick Logout Button */}
        {user && (
          <div className="mx-2 mb-3 flex items-center justify-between gap-2 bg-teal-50/80 border border-teal-100 rounded-2xl px-3 py-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {getInitials(user.name)}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-xs text-gray-900 truncate">{user.name}</p>
                <p className="text-[10px] font-semibold text-teal-700 capitalize">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out / Switch User"
              className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-600 rounded-xl transition-all flex items-center justify-center shrink-0 border border-rose-200"
            >
              <span className="material-symbols-outlined text-base">logout</span>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 touch-scroll">
          <NavItems items={navItems} onItemClick={onItemClick} />
        </nav>

        {/* Logout Pinned Bottom */}
        <div className="px-2 mt-auto pt-2 border-t border-gray-200 shrink-0 bg-white/90">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-xl transition-all text-xs font-bold shadow-xs"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Sign Out / Exit Portal
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

      {/* ── Mobile & Tablet Top App Bar with Direct 1-Click Logout ── */}
      <header className="md:hidden sticky top-0 z-40 w-full flex justify-between items-center px-3 py-2.5 bg-white/95 backdrop-blur-md border-b border-teal-100 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 text-gray-700 hover:bg-teal-50 rounded-xl focus:outline-none flex items-center justify-center"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <span className="material-symbols-outlined text-teal-700 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            medical_services
          </span>
          <span className="font-bold text-sm text-teal-950 truncate max-w-[140px] sm:max-w-[220px]">{clinic?.name || "ClinicFlow"}</span>
        </div>

        {user && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              title="Sign Out Portal"
              className="flex items-center gap-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white px-2.5 py-1 rounded-xl text-xs font-bold border border-rose-200 transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span className="hidden sm:inline">Logout</span>
            </button>
            <div className="w-7 h-7 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-[10px] shadow-xs">
              {getInitials(user.name)}
            </div>
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

      {/* ── Mobile Bottom Navigation (Identical to PC Sidebar Tabs) ─────── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-45 bg-white/95 backdrop-blur-lg border-t border-teal-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <ul className="flex justify-around items-center h-16 px-1 overflow-x-auto">
          {navItems.map((item) => (
            <li key={item.path} className="flex-1 min-w-[54px] text-center">
              {item.target === "_blank" ? (
                <a
                  href={item.path}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-gray-500 font-medium hover:text-teal-700 transition-all"
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">{item.label.split(" ")[0]}</span>
                </a>
              ) : (
                <NavLink
                  to={item.path}
                  end={item.path === "/store" || item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all ${
                      isActive
                        ? "text-teal-800 font-black bg-teal-50"
                        : "text-gray-500 font-medium hover:text-teal-700"
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">{item.label.split(" ")[0]}</span>
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
