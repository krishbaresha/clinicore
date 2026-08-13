import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getInitials } from "../utils/formatters.js";

// Navigation items matching the Sitemap exactly (04_Screens_and_Sitemap.md §1)
const NAV_ITEMS = [
  { label: "Dashboard",       icon: "dashboard",         path: "/dashboard" },
  { label: "Patients",        icon: "group",             path: "/patients"  },
  { label: "New Visit",       icon: "medical_services",  path: "/visits/new" },
  { label: "Fees & Reports",  icon: "payments",          path: "/fees"       },
  { label: "Medical Store",   icon: "inventory_2",       path: "/store"      },
  { label: "Settings",        icon: "settings",          path: "/settings",  spacer: true },
];

export default function SidebarLayout({ children }) {
  const { user, clinic, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-x-hidden">
      {/* ── Desktop Sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-[260px] border-r border-white/20 backdrop-blur-xl bg-white/70 shadow-[0_8px_32px_0_rgba(15,118,110,0.08)] z-50 py-md">
        {/* Logo */}
        <div className="px-md mb-lg flex items-center gap-xs">
          <span
            className="material-symbols-outlined text-primary text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            medical_services
          </span>
          <h1 className="font-headline-md text-headline-md font-bold text-primary">
            {clinic?.name || "ClinicFlow"}
          </h1>
        </div>

        {/* User Chip */}
        {user && (
          <div className="mx-xs mb-md flex items-center gap-xs bg-surface-container-low/50 rounded-lg px-xs py-2">
            <div className="w-10 h-10 rounded-full bg-secondary-container text-primary flex items-center justify-center font-bold text-sm shrink-0">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="font-label-md text-label-md text-on-surface font-bold truncate">{user.name}</p>
              <p className="font-body-sm text-body-sm text-outline capitalize">{user.role}</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.path} className={item.spacer ? "mt-lg" : ""}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 transition-colors duration-150 ${
                      isActive ? "nav-item-active" : "nav-item"
                    }`
                  }
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span className="font-body-md text-body-md">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout */}
        <div className="px-xs mt-md">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-error hover:bg-error-container/30 rounded-lg transition-colors font-body-md text-body-md"
          >
            <span className="material-symbols-outlined">logout</span>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Mobile Top App Bar ───────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 w-full flex justify-between items-center px-sm py-3 bg-background/80 backdrop-blur-md border-b border-outline-variant/30">
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
          <span className="font-headline-md text-headline-md font-bold text-primary">{clinic?.name || "ClinicFlow"}</span>
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
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <aside className="relative flex flex-col w-[260px] max-w-[80vw] h-full bg-white/95 backdrop-blur-xl border-r border-white/20 shadow-2xl z-10 py-md transition-transform duration-300">
            {/* Close Button & Brand */}
            <div className="px-md mb-lg flex items-center justify-between">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  medical_services
                </span>
                <span className="font-headline-md text-headline-md font-bold text-primary truncate max-w-[140px]">
                  {clinic?.name || "ClinicFlow"}
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-full hover:bg-surface-container-high flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* User Chip */}
            {user && (
              <div className="mx-xs mb-md flex items-center gap-xs bg-surface-container-low/50 rounded-lg px-xs py-2">
                <div className="w-10 h-10 rounded-full bg-secondary-container text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {getInitials(user.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface font-bold truncate">{user.name}</p>
                  <p className="font-body-sm text-body-sm text-outline capitalize">{user.role}</p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-2">
              <ul className="space-y-1">
                {NAV_ITEMS.map((item) => (
                  <li key={item.path} className={item.spacer ? "mt-lg" : ""}>
                    <NavLink
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 transition-colors duration-150 ${
                          isActive ? "nav-item-active" : "nav-item"
                        }`
                      }
                    >
                      <span className="material-symbols-outlined">{item.icon}</span>
                      <span className="font-body-md text-body-md">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Logout */}
            <div className="px-xs mt-md">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-error hover:bg-error-container/30 rounded-lg transition-colors font-body-md text-body-md"
              >
                <span className="material-symbols-outlined">logout</span>
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content Area ────────────────────────────── */}
      <main className="flex-1 md:ml-[260px] min-h-screen pb-20 md:pb-0 min-w-0">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation ─────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-45 bg-surface/90 backdrop-blur-lg rounded-t-xl border-t border-white/20 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <ul className="flex justify-around items-center h-16 px-2">
          {[
            { label: "Home",     icon: "home",         path: "/dashboard"  },
            { label: "Patients", icon: "group",        path: "/patients"   },
            { label: "Add",      icon: "add_circle",   path: "/visits/new" },
            { label: "Store",    icon: "storefront",   path: "/store"      },
            { label: "Reports",  icon: "assessment",   path: "/fees"       },
          ].map((item) => (
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
                <span className="font-label-md text-label-md mt-0.5">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
