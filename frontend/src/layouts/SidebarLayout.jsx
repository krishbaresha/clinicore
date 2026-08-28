// ClinicFlow Master Enterprise Responsive Layout & Collapsible Navigation Engine v2.5
// Built with UI/UX Pro Max standards for high-performance medical workflows
import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  UserPlus,
  Calendar,
  CreditCard,
  Boxes,
  Receipt,
  Truck,
  Building2,
  Clock,
  Users,
  Wallet,
  Settings,
  Shield,
  Stethoscope,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Download,
  Smartphone,
  Activity,
  Hospital,
  Keyboard
} from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { getInitials } from "../utils/formatters.js";
import { dbClinic, dbPatients, dbSales, dbInventory, dbUsers, exportFullDatabase } from "../api/db.js";
import { generateCliniCoreEmailTemplate } from "../utils/emailTemplate.js";
import PullToRefresh from "../components/PullToRefresh.jsx";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";
import LicenseBanner from "../components/LicenseBanner.jsx";
import KeyboardShortcutsModal from "../components/KeyboardShortcutsModal.jsx";
import { useGlobalKeyboardNav } from "../hooks/useGlobalKeyboardNav.js";
import { syncEngine } from "../api/syncEngine.js";
import { useTranslation } from "react-i18next";

function getNavIcon(iconName, className = "w-5 h-5") {
  switch (iconName) {
    case "dashboard": return <LayoutDashboard className={className} />;
    case "how_to_reg":
    case "person_add": return <UserPlus className={className} />;
    case "event_note": return <Calendar className={className} />;
    case "point_of_sale": return <CreditCard className={className} />;
    case "inventory_2": return <Boxes className={className} />;
    case "receipt_long": return <Receipt className={className} />;
    case "local_shipping": return <Truck className={className} />;
    case "warehouse":
    case "add_business": return <Building2 className={className} />;
    case "pending_actions": return <Clock className={className} />;
    case "group":
    case "queue": return <Users className={className} />;
    case "payments": return <Wallet className={className} />;
    case "settings": return <Settings className={className} />;
    case "admin_panel_settings": return <Shield className={className} />;
    case "stethoscope": return <Stethoscope className={className} />;
    default: return <Activity className={className} />;
  }
}

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
  { label: "Super Admin Panel", icon: "admin_panel_settings", path: "/admin" },
];

const NAV_SHORTCUTS_MAP = {
  "/dashboard": "Alt+1",
  "/reception/register": "Alt+2",
  "/reception/queue": "Alt+3",
  "/doctor/queue": "Alt+4",
  "/store/pos": "Alt+5",
  "/store": "Alt+6",
  "/store/sales": "Alt+7",
  "/store/purchases": "Alt+8",
  "/store/warehouse": "Alt+9",
  "/patients": "Alt+0",
  "/fees": "Alt+F",
};

export default function SidebarLayout({ children }) {
  const { user, clinic, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isShortcutsModalOpen, setIsShortcutsModalOpen, closeShortcutsModal } = useGlobalKeyboardNav();

  // Desktop Collapsible Sidebar State (Default compact on tablet 768-1199px to prevent horizontal scroll)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("cf_sidebar_expanded");
    if (saved !== null) return saved === "true";
    return typeof window !== "undefined" ? window.innerWidth >= 1200 : true;
  });
  
  // Mobile Slide-over Drawer State
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Native PWA Deferred Prompt & Installation State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://") ||
      localStorage.getItem("cf_pwa_installed") === "true"
    );
  });

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

    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true ||
        document.referrer.includes("android-app://");
      if (isStandalone) {
        setIsPWAInstalled(true);
        localStorage.setItem("cf_pwa_installed", "true");
      }
    };

    checkStandalone();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const mediaHandler = (e) => {
      if (e.matches) {
        setIsPWAInstalled(true);
        localStorage.setItem("cf_pwa_installed", "true");
      }
    };
    try {
      mediaQuery.addEventListener("change", mediaHandler);
    } catch (_) {
      mediaQuery.addListener(mediaHandler);
    }

    const appInstalledHandler = () => {
      setIsPWAInstalled(true);
      localStorage.setItem("cf_pwa_installed", "true");
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", appInstalledHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      try {
        mediaQuery.removeEventListener("change", mediaHandler);
      } catch (_) {
        mediaQuery.removeListener(mediaHandler);
      }
      window.removeEventListener("appinstalled", appInstalledHandler);
    };
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
        "📱 To install CliniCore as a Native Desktop / Mobile App:\n\n" +
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

  // Background Automated Backup & 9:00 PM Shift-End Scheduler Engine
  useEffect(() => {
    let isExecuting = false;

    async function checkAndRunAutoBackup() {
      if (isExecuting) return;

      const c = dbClinic.get() || {};
      const targetEmail = (c.notification_email || c.backup_email || localStorage.getItem("cf_notification_email") || "drasifhosting@gmail.com").trim();
      const resendKey = (c.resend_api_key || localStorage.getItem("cf_resend_api_key") || "re_W8MESfRA_HrgbjEaM47s2w3XD25tREey8").trim();
      const frequency = c.report_frequency || c.backup_frequency || localStorage.getItem("cf_report_frequency") || "daily_9pm";

      if (!targetEmail || !resendKey || frequency === "manual") return;

      const getPKTDate = () => {
        const d = new Date();
        const utc = d.getTime() + d.getTimezoneOffset() * 60 * 1000;
        return new Date(utc + 5 * 60 * 60 * 1000);
      };
      const getPKTDateStr = (pktDate) => {
        const y = pktDate.getFullYear();
        const m = String(pktDate.getMonth() + 1).padStart(2, "0");
        const d = String(pktDate.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      };

      const now = getPKTDate();
      const todayDateStr = getPKTDateStr(now); // Strict Pakistan YYYY-MM-DD
      const currentHour = now.getHours(); // Pakistan 0-23
      const lastDailyReportDate = c.last_daily_report_date || localStorage.getItem("cf_last_daily_report_date");
      const lastBackupMs = c.last_email_backup ? new Date(c.last_email_backup).getTime() : 0;
      const nowMs = now.getTime();

      const lastTriggeredFreq = localStorage.getItem("cf_last_triggered_frequency");
      const isNewFreq = lastTriggeredFreq !== frequency;
      const isAlreadySent = lastDailyReportDate === todayDateStr && !isNewFreq;

      let shouldTrigger = false;
      let triggerReason = "";

      if (frequency === "every_1m" || frequency === "test_1min") {
        const intervalMs = 10 * 1000; // 10 seconds for instant verification
        if (nowMs - lastBackupMs >= intervalMs) {
          shouldTrigger = true;
          triggerReason = "🧪 Live Automation Verification Test";
        }
      } else if (frequency.startsWith("custom_interval:")) {
        const mins = parseInt(frequency.split(":")[1]) || 5;
        const intervalMs = mins * 60 * 1000;
        if (nowMs - lastBackupMs >= intervalMs) {
          shouldTrigger = true;
          triggerReason = `Custom ${mins} Minutes Interval Audit`;
        }
      } else if (frequency.startsWith("custom_time:")) {
        const timeStr = frequency.substring(frequency.indexOf(":") + 1);
        const tParts = timeStr.split(":");
        const targetHour = parseInt(tParts[0]) || 21;
        const targetMin = parseInt(tParts[1]) || 0;
        const currentMin = now.getMinutes();

        // Trigger if current local clock matches or exceeds target time AND report not sent for this config today
        if ((currentHour > targetHour || (currentHour === targetHour && currentMin >= targetMin)) && !isAlreadySent) {
          shouldTrigger = true;
          triggerReason = `Custom Daily ${timeStr} Clock Closure`;
        }
      } else if (frequency === "daily_9pm" || frequency === "daily") {
        if (currentHour >= 21 && !isAlreadySent) {
          shouldTrigger = true;
          triggerReason = "Daily 9:00 PM Shift End Closure";
        }
      } else if (frequency === "daily_10pm") {
        if (currentHour >= 22 && !isAlreadySent) {
          shouldTrigger = true;
          triggerReason = "Daily 10:00 PM Late Night Closure";
        }
      } else if (frequency === "daily_8pm") {
        if (currentHour >= 20 && !isAlreadySent) {
          shouldTrigger = true;
          triggerReason = "Daily 8:00 PM Evening Shift Closure";
        }
      } else if (frequency === "every_12h") {
        const intervalMs = 12 * 60 * 60 * 1000;
        if (nowMs - lastBackupMs >= intervalMs) {
          shouldTrigger = true;
          triggerReason = "Every 12 Hours Audit";
        }
      } else if (frequency === "every_6h") {
        const intervalMs = 6 * 60 * 60 * 1000;
        if (nowMs - lastBackupMs >= intervalMs) {
          shouldTrigger = true;
          triggerReason = "Every 6 Hours High Volume Audit";
        }
      } else if (frequency === "hourly") {
        const intervalMs = 1 * 60 * 60 * 1000;
        if (nowMs - lastBackupMs >= intervalMs) {
          shouldTrigger = true;
          triggerReason = "Hourly Real-Time System Audit";
        }
      } else if (frequency === "weekly_saturday") {
        if (now.getDay() === 6 && currentHour >= 21 && !isAlreadySent) {
          shouldTrigger = true;
          triggerReason = "Weekly Saturday Summary";
        }
      } else if (frequency === "monthly") {
        const isEndOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate();
        if (isEndOfMonth && currentHour >= 21 && !isAlreadySent) {
          shouldTrigger = true;
          triggerReason = "Monthly Executive Closure";
        }
      } else {
        const intervalHours = Number(c.backup_interval_hours) || 24;
        const intervalMs = intervalHours * 60 * 60 * 1000;
        if (nowMs - lastBackupMs >= intervalMs) {
          shouldTrigger = true;
          triggerReason = `Every ${intervalHours} Hours Backup`;
        }
      }

      if (!shouldTrigger) return;

      const addAutomationLog = (status, reason, msg) => {
        try {
          const raw = localStorage.getItem("cf_automation_execution_logs") || "[]";
          const logs = JSON.parse(raw);
          logs.unshift({
            timestamp: new Date().toISOString(),
            status,
            reason,
            message: msg
          });
          localStorage.setItem("cf_automation_execution_logs", JSON.stringify(logs.slice(0, 10)));
          window.dispatchEvent(new Event("cf_automation_logs_updated"));
        } catch (e) {
          console.error(e);
        }
      };

      isExecuting = true;
      console.log(`[AutoBackup] Triggering automated background backup dispatch: ${triggerReason}...`);
      addAutomationLog("pending", triggerReason, "Initiating database encryption and preparing payload...");

      try {
        const encryptedBackupStr = exportFullDatabase(true);
        const base64Content = btoa(unescape(encodeURIComponent(encryptedBackupStr)));
        const dateStr = todayDateStr;
        const timeTag = now.toTimeString().split(" ")[0].replace(/:/g, "");
        const filename = `CliniCore_Encrypted_Backup_${dateStr}_${timeTag}.cfbak`;
        const sizeBytes = new Blob([encryptedBackupStr]).size;
        const timestampStr = now.toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" });

        const apiUrl = import.meta.env.VITE_API_URL || "https://api.clinicore.me";

        // 1. Stage backup on server to create authoritative 1-click download link
        let downloadUrl = `${apiUrl}/api/v1/system/download-backup?file=${encodeURIComponent(filename)}`;
        try {
          const prepRes = await fetch(`${apiUrl}/api/v1/system/prepare-backup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, content: base64Content }),
          });
          const prepData = await prepRes.json().catch(() => null);
          if (prepData?.success && prepData?.data?.download_url) {
            downloadUrl = prepData.data.download_url;
          }
        } catch (prepErr) {
          console.warn("[AutoBackup] VPS staging warning:", prepErr.message);
        }

        // 2. Fetch live metrics
        const allPatients = dbPatients.getAll() || [];
        const allSales = dbSales.getAll() || [];
        const allInventory = dbInventory.getAll() || [];
        const allUsers = dbUsers.getAll() || [];

        const totalInflows = allSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
        const totalStockValuation = allInventory.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.sale_price) || 0)), 0);

        // 3. Generate HTML email template
        const emailHtml = generateCliniCoreEmailTemplate({
          clinicName: c.name || "Dr. Muhammad Asif Ashraf Khan Clinic & Wholesale",
          targetEmail,
          dateStr,
          timestampStr,
          totalInflows,
          totalStockValuation,
          staffCount: allUsers.length,
          patientsCount: allPatients.length,
          backupFilename: filename,
          backupSizeBytes: sizeBytes,
          downloadUrl,
          frequencyLabel: triggerReason,
          isTestPing: false,
        });

        // 4. Relay securely through VPS backend to bypass browser CORS
        const res = await fetch(`${apiUrl}/api/v1/system/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: resendKey,
            from: "CliniCore System <backup@clinicore.me>",
            to: [targetEmail],
            subject: `🏥 CliniCore Encrypted System Audit & Vault Backup (${dateStr})`,
            html: emailHtml,
            attachments: [
              {
                filename,
                content: base64Content,
              },
            ],
          }),
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data?.success) {
          console.log(`✅ [AutoBackup] Success! Scheduled backup delivered to ${targetEmail}`);
          addAutomationLog("success", triggerReason, `Backup successfully delivered to ${targetEmail} (Resend ID: ${data?.id || "N/A"})`);
          dbClinic.update({
            last_daily_report_date: todayDateStr,
            last_email_backup: now.toISOString(),
          });
          try {
            localStorage.setItem("cf_last_daily_report_date", todayDateStr);
            localStorage.setItem("cf_last_triggered_frequency", frequency);
          } catch {}
        } else {
          console.warn("[AutoBackup] Resend Dispatch Response:", data);
          const errMsg = data?.message || data?.error || "Unknown Resend API error";
          addAutomationLog("failed", triggerReason, `Resend API Error: ${errMsg}`);
        }
      } catch (err) {
        console.warn("[AutoBackup] Background automated backup encountered error:", err.message);
        addAutomationLog("failed", triggerReason, `System/Network Error: ${err.message}`);
      } finally {
        isExecuting = false;
      }
    }

    // Check immediately on mount, and then every 15 seconds
    checkAndRunAutoBackup();
    const timer = setInterval(checkAndRunAutoBackup, 15 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Countdown Broadcast Engine (1-second tick with memoized config)
  useEffect(() => {
    let cachedClinic = dbClinic.get() || {};
    const handleClinicUpdate = () => {
      cachedClinic = dbClinic.get() || {};
    };
    window.addEventListener("clinicflow_status_update", handleClinicUpdate);

    const tickInterval = setInterval(() => {
      const c = cachedClinic;
      const targetEmail = (c.notification_email || c.backup_email || "").trim();
      const resendKey = (c.resend_api_key || "").trim();
      const frequency = c.report_frequency || c.backup_frequency || "daily_9pm";

      if (!targetEmail || !resendKey || frequency === "manual") {
        window.dispatchEvent(new CustomEvent("cf_automation_tick", { detail: null }));
        return;
      }

      const getPKTDate = () => {
        const d = new Date();
        const utc = d.getTime() + d.getTimezoneOffset() * 60 * 1000;
        return new Date(utc + 5 * 60 * 60 * 1000);
      };
      const getPKTDateStr = (pktDate) => {
        const y = pktDate.getFullYear();
        const m = String(pktDate.getMonth() + 1).padStart(2, "0");
        const d = String(pktDate.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      };

      const now = getPKTDate();
      const nowMs = now.getTime();
      const lastBackupMs = c.last_email_backup ? new Date(c.last_email_backup).getTime() : 0;
      const lastDailyReportDate = c.last_daily_report_date;
      const todayDateStr = getPKTDateStr(now);

      let secondsLeft = 0;
      let label = "";

      if (frequency === "every_1m" || frequency === "test_1min") {
        const intervalMs = 10 * 1000;
        secondsLeft = Math.max(0, Math.ceil((lastBackupMs + intervalMs - nowMs) / 1000));
        label = "Testing Mode (10s threshold)";
      } else if (frequency.startsWith("custom_interval:")) {
        const mins = parseInt(frequency.split(":")[1]) || 5;
        const intervalMs = mins * 60 * 1000;
        secondsLeft = Math.max(0, Math.ceil((lastBackupMs + intervalMs - nowMs) / 1000));
        label = `Every ${mins} Minutes`;
      } else {
        // Daily clock times
        let targetHour = 21;
        let targetMin = 0;
        if (frequency === "daily_10pm") {
          targetHour = 22;
        } else if (frequency === "daily_8pm") {
          targetHour = 20;
        } else if (frequency.startsWith("custom_time:")) {
          const timeStr = frequency.substring(frequency.indexOf(":") + 1);
          const tParts = timeStr.split(":");
          targetHour = parseInt(tParts[0]) || 21;
          targetMin = parseInt(tParts[1]) || 0;
        }

        const targetDate = new Date(now);
        targetDate.setHours(targetHour, targetMin, 0, 0);

        if (lastDailyReportDate === todayDateStr) {
          targetDate.setDate(targetDate.getDate() + 1);
        } else if (nowMs >= targetDate.getTime()) {
          targetDate.setTime(nowMs);
        }

        secondsLeft = Math.max(0, Math.ceil((targetDate.getTime() - nowMs) / 1000));
        label = `Daily at ${String(targetHour).padStart(2, "0")}:${String(targetMin).padStart(2, "0")}`;
      }

      window.dispatchEvent(new CustomEvent("cf_automation_tick", {
        detail: { secondsLeft, label, frequency }
      }));
    }, 1000);

    return () => {
      clearInterval(tickInterval);
      window.removeEventListener("clinicflow_status_update", handleClinicUpdate);
    };
  }, []);

  // Build nav items — ensure Admin / Owner gets full settings & super admin panel
  const isAdminOrOwner = user?.is_owner || user?.role === "admin" || user?.role === "owner" || user?.userId === "user_admin";
  const rawNavItems = (user?.role && NAV_BY_ROLE[user.role]) || NAV_DEFAULT;
  const navItems = rawNavItems.filter((item) => {
    if ((item.path === "/settings" || item.path === "/admin") && !isAdminOrOwner) return false;
    return true;
  });

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const { t } = useTranslation();

  // Shared Nav List Renderer with 44px touch targets & glassmorphism
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
            <li key={item.path} className={item.spacer ? "mt-3 pt-3 border-t border-slate-200/60" : ""}>
              <NavLink
                to={item.path}
                end={item.path === "/store" || item.end}
                onClick={onItemClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 min-h-[44px] px-3.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-teal-700 to-teal-600 text-white shadow-sm shadow-teal-700/20 font-bold"
                      : "text-slate-600 hover:bg-teal-50/80 hover:text-teal-950 font-medium"
                  } ${!isFullWidth ? "justify-center px-0" : ""}`
                }
                title={!isFullWidth ? displayLabel : undefined}
              >
                <span className={`flex-shrink-0 flex items-center justify-center ${
                  !isFullWidth ? "w-6 h-6" : "w-5 h-5"
                }`}>
                  {getNavIcon(item.icon, !isFullWidth ? "w-6 h-6" : "w-5 h-5")}
                </span>

                {isFullWidth && (
                  <span className="text-xs tracking-tight truncate flex-1">
                    {displayLabel}
                  </span>
                )}
                {isFullWidth && NAV_SHORTCUTS_MAP[item.path] && (
                  <kbd className="hidden xl:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-100/90 text-slate-500 border border-slate-200/80 rounded shadow-2xs">
                    {NAV_SHORTCUTS_MAP[item.path]}
                  </kbd>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="h-screen w-screen max-h-screen max-w-full overflow-hidden bg-[#f8fafc] text-slate-800 font-sans selection:bg-teal-600 selection:text-white flex flex-col">
      
      {/* ── Top License & Subscription Reminder Banner ── */}
      <LicenseBanner />

      {/* ── Top Header Bar (Translucent Glassmorphic Engine - Fixed Topbar) ── */}
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-md z-40 shadow-xs h-16 flex items-center px-4 sm:px-6 justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Sidebar Open/Close Toggle Button with 44px ergonomic touch target */}
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileDrawerOpen(true);
              } else {
                toggleSidebar();
              }
            }}
            className="w-10 h-10 rounded-xl bg-teal-50/80 hover:bg-teal-100 text-teal-800 border border-teal-200/70 transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-95 touch-target-44"
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand Logo & Clinic Info */}
          <div className="flex items-center gap-2.5">
            <img
              src="/favicon.svg"
              alt="CliniCore Logo"
              className="h-9 w-9 object-contain rounded-xl drop-shadow-xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-slate-900 tracking-tight">CliniCore</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200/60">
                  HYBRID V2.5
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[160px] sm:max-w-xs">
                {clinic?.name || "Dr. Muhammad Asif Ashraf Khan Clinic"}
              </p>
            </div>
          </div>
        </div>

        {/* Right Header User Chip & Quick Action Links */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* PWA Cloud Sync Status Badge */}
          <button
            onClick={() => syncEngine.forceSyncNow()}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
              !syncState.isOnline
                ? "bg-amber-50/90 text-amber-900 border-amber-200"
                : syncState.isSyncing
                ? "bg-teal-50/90 text-teal-800 border-teal-200 animate-pulse"
                : syncState.pendingCount > 0
                ? "bg-blue-50/90 text-blue-900 border-blue-200"
                : "bg-emerald-50/90 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
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

          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-bold border border-teal-200/80 bg-teal-50/70 hover:bg-teal-100 text-teal-900 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
            title="Master Keyboard Shortcuts Deck (F12)"
          >
            <Keyboard className="w-4 h-4 text-teal-700" />
            <span className="hidden sm:inline">Shortcuts</span>
            <kbd className="hidden lg:inline-block px-1.5 py-0.2 bg-teal-200/80 text-teal-950 text-[10px] font-mono font-bold rounded">
              F12
            </kbd>
          </button>

          <LanguageSwitcher compact={true} />

          {user && (
            <div className="flex items-center gap-2 bg-white/80 border border-slate-200/70 rounded-xl px-2.5 sm:px-3 py-1 shadow-xs backdrop-blur-xs min-h-[38px]">
              <div className="w-7 h-7 rounded-full bg-teal-700 text-white flex items-center justify-center font-black text-[11px] shadow-xs shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="hidden sm:block text-left min-w-0 pr-1">
                <p className="font-bold text-xs text-slate-900 truncate max-w-[120px]">{user.name}</p>
                <p className="text-[9.5px] font-bold text-teal-700 capitalize leading-none">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out / Exit Portal"
                className="w-7 h-7 text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg transition-all flex items-center justify-center border border-rose-200 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Body with Fixed Collapsible Desktop Sidebar & Scoped Scrollable Content ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* ── Desktop Left Sidebar Menu (Fixed, naturally flexed, independent inner scroll) ── */}
        <aside
          className={`
            hidden md:flex flex-col justify-between h-full flex-shrink-0
            bg-white/85 backdrop-blur-md border-r border-slate-200/70 shadow-xs
            transition-all duration-300 ease-in-out z-30
            ${sidebarOpen ? "w-[280px]" : "w-[80px]"}
          `}
        >
          {/* Navigation Items */}
          <div className="p-3 space-y-2 overflow-y-auto flex-1 touch-scroll custom-scrollbar">
            <div className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 ${!sidebarOpen ? "text-center" : ""}`}>
              {sidebarOpen ? "Clinic & Store Menu" : "•"}
            </div>

            <NavigationList isFullWidth={sidebarOpen} onItemClick={undefined} />
          </div>

          {/* Bottom Sidebar Footer */}
          <div className="p-3 border-t border-slate-200/60 flex flex-col gap-2 bg-slate-50/60 backdrop-blur-xs flex-shrink-0">
            {sidebarOpen ? (
              <>
                {/* Install App Trigger Button in Sidebar (Only if NOT installed) */}
                {!isPWAInstalled && (
                  <button
                    onClick={handleInstallPWA}
                    className="w-full flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-2 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-950 border border-emerald-200/80 rounded-xl transition-all text-xs font-bold shadow-xs cursor-pointer active:scale-98"
                    title="Install CliniCore App"
                  >
                    <Download className="w-4 h-4 text-emerald-700" />
                    <span>Install Desktop App</span>
                  </button>
                )}

                <div className="flex items-center justify-between w-full px-2 pt-1">
                  <div className="text-[11px] font-bold text-slate-600">
                    {clinic?.name?.split(" ")[0] || "CliniCore"} OS
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer"
                    title="Collapse Sidebar"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {!isPWAInstalled && (
                  <button
                    onClick={handleInstallPWA}
                    className="w-full h-11 rounded-xl bg-emerald-50/90 hover:bg-emerald-100 text-emerald-900 transition-colors flex items-center justify-center cursor-pointer border border-emerald-200/80 active:scale-95"
                    title="Install CliniCore App"
                  >
                    <Download className="w-4 h-4 text-emerald-700" />
                  </button>
                )}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="w-full p-1.5 rounded-lg hover:bg-teal-100 text-teal-800 transition-colors flex items-center justify-center cursor-pointer"
                  title="Expand Sidebar"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Mobile Slide-over Drawer with Framer-Motion AnimatePresence ── */}
        <AnimatePresence>
          {mobileDrawerOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex">
              {/* Backdrop Blur Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMobileDrawerOpen(false)}
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              />

              {/* Slide-out Drawer Panel */}
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative flex flex-col w-[300px] max-w-[85vw] h-full bg-white/95 backdrop-blur-xl border-r border-slate-200/70 shadow-2xl z-10"
              >
                {/* Drawer Top Header */}
                <div className="p-4 border-b border-slate-200/60 flex items-center justify-between bg-gradient-to-r from-teal-50/80 to-white flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-700/20">
                      <Hospital className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-black text-sm text-slate-900 tracking-tight">CliniCore</h2>
                      <p className="text-[10px] text-slate-500 font-medium truncate max-w-[160px]">
                        {clinic?.name || "Clinic"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileDrawerOpen(false)}
                    className="w-10 h-10 rounded-xl hover:bg-teal-100 text-slate-500 hover:text-teal-900 transition-colors cursor-pointer flex items-center justify-center touch-target-44"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Staff Profile Card inside Mobile Drawer */}
                {user && (
                  <div className="mx-3 mt-3 p-3 bg-teal-50/80 border border-teal-200/60 rounded-xl flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                        {getInitials(user.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-900 truncate">{user.name}</p>
                        <p className="text-[10px] font-bold text-teal-700 capitalize leading-none">{user.role}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200 cursor-pointer"
                      title="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Navigation Items (Fully expanded with labels) */}
                <div className="p-3 overflow-y-auto flex-1 touch-scroll custom-scrollbar">
                  <NavigationList isFullWidth={true} onItemClick={() => setMobileDrawerOpen(false)} />
                </div>

                {/* Mobile Drawer Bottom Actions */}
                <div className="p-3 border-t border-slate-200/60 bg-slate-50/60 space-y-2 flex-shrink-0">
                  {!isPWAInstalled && (
                    <button
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        handleInstallPWA();
                      }}
                      className="w-full flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 rounded-xl transition-all text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 text-emerald-700" />
                      <span>Install App on Phone</span>
                    </button>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200/80 rounded-xl transition-all text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out / Exit Portal</span>
                  </button>
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* ── Main Content Area (THE ONLY INDEPENDENT SCROLLABLE CONTAINER) ── */}
        <main
          id="main-content-viewport"
          className="flex-1 h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-12 custom-scrollbar focus:outline-none"
          tabIndex={-1}
        >
          <PullToRefresh>
            {children}
          </PullToRefresh>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (Fast 1-Thumb 44px Touch Targets) ── */}
      <nav className="md:hidden flex-shrink-0 z-40 bg-white/85 backdrop-blur-lg border-t border-slate-200/70 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <ul className="flex justify-around items-center h-16 px-1">
          {navItems.slice(0, 4).map((item) => (
            <li key={item.path} className="flex-1 min-w-[50px] text-center">
              <NavLink
                to={item.path}
                end={item.path === "/store" || item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[44px] ${
                    isActive
                      ? "text-teal-800 font-black bg-teal-50/80"
                      : "text-slate-500 font-semibold hover:text-teal-700"
                  }`
                }
              >
                {getNavIcon(item.icon, "w-5 h-5")}
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">{item.label.split(" ")[0]}</span>
              </NavLink>
            </li>
          ))}
          <li className="flex-1 min-w-[50px] text-center">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-teal-800 font-black hover:bg-teal-50/80 transition-all w-full cursor-pointer min-h-[44px]"
            >
              <Menu className="w-6 h-6" />
              <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* ── Global Master Keyboard Shortcuts Cheatsheet Modal (F12) ── */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={closeShortcutsModal}
      />
    </div>
  );
}
