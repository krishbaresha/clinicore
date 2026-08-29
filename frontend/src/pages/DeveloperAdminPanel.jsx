import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  dbClinic,
  dbUsers,
  dbWarehouses,
  dbInventory,
  dbPurchases,
  dbSales,
  dbB2BSales,
  dbExpenses,
  dbVisits,
  dbPatients,
  dbCashBook,
  dbLicense,
  dbOutbox,
  exportFullDatabase,
  importFullDatabase,
  resetDatabaseToDemoData,
  clearAllTransactionalData,
  hashPassword,
} from "../api/db.js";
import { syncEngine } from "../api/syncEngine.js";
import {
  printExecutiveAuditReceipt,
  printExecutiveAuditDocument,
} from "../utils/thermalPrinter.js";

const DEFAULT_ADMIN_PASSCODE = "KB2026"; // Default Developer Passcode
const DEFAULT_TAB_PIN = "7860"; // Default Tab Lock PIN
const DEFAULT_API_URL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  (typeof window !== "undefined" && window.location.hostname === "localhost" ? "" : "https://api.clinicore.me");

export function getAdminPasscode() {
  try {
    return localStorage.getItem("cf_admin_master_passcode") || DEFAULT_ADMIN_PASSCODE;
  } catch {
    return DEFAULT_ADMIN_PASSCODE;
  }
}

export function setAdminPasscode(pass) {
  try {
    localStorage.setItem("cf_admin_master_passcode", pass);
  } catch {}
}

export function getTabPin() {
  try {
    return localStorage.getItem("cf_admin_tab_pin") || DEFAULT_TAB_PIN;
  } catch {
    return DEFAULT_TAB_PIN;
  }
}

export function setTabPin(pin) {
  try {
    localStorage.setItem("cf_admin_tab_pin", pin);
  } catch {}
}

import { generateCliniCoreEmailTemplate } from "../utils/emailTemplate.js";
export { generateCliniCoreEmailTemplate };

export default function DeveloperAdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [activeTab, setActiveTab] = useState("audits"); // "audits" | "staff" | "clinic" | "apis" | "tenants" | "backups"
  const [toastMsg, setToastMsg] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1200 : true));
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Resend Backup Dispatch & Preview States
  const [isDispatchingBackup, setIsDispatchingBackup] = useState(false);
  const [isPingingApi, setIsPingingApi] = useState(false);
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false);
  const [emailPreviewMode, setEmailPreviewMode] = useState("desktop"); // 'desktop' | 'mobile'
  const [countdownDetail, setCountdownDetail] = useState(null);
  const [selectedFreqType, setSelectedFreqType] = useState(() => {
    const c = dbClinic.get() || {};
    const freq = c.report_frequency || (typeof window !== "undefined" ? localStorage.getItem("cf_report_frequency") || "daily_9pm" : "daily_9pm");
    if (freq.startsWith("custom_time:")) return "custom_time";
    if (freq.startsWith("custom_interval:")) return "custom_interval";
    return freq;
  });
  const [customTimeInput, setCustomTimeInput] = useState(() => {
    const c = dbClinic.get() || {};
    const freq = c.report_frequency || (typeof window !== "undefined" ? localStorage.getItem("cf_report_frequency") || "21:30" : "21:30");
    if (freq.startsWith("custom_time:")) return freq.split(":")[1] || "21:30";
    return "21:30";
  });
  const [customIntervalInput, setCustomIntervalInput] = useState(() => {
    const c = dbClinic.get() || {};
    const freq = c.report_frequency || (typeof window !== "undefined" ? localStorage.getItem("cf_report_frequency") || "15" : "15");
    if (freq.startsWith("custom_interval:")) return parseInt(freq.split(":")[1]) || 15;
    return 15;
  });
  const [emailPreviewHtml, setEmailPreviewHtml] = useState("");
  const [automationLogs, setAutomationLogs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cf_automation_execution_logs") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleTick = (e) => {
      setCountdownDetail(e?.detail || null);
    };
    const handleLogsUpdate = () => {
      try {
        setAutomationLogs(JSON.parse(localStorage.getItem("cf_automation_execution_logs") || "[]"));
      } catch {}
    };
    window.addEventListener("cf_automation_tick", handleTick);
    window.addEventListener("cf_automation_logs_updated", handleLogsUpdate);
    return () => {
      window.removeEventListener("cf_automation_tick", handleTick);
      window.removeEventListener("cf_automation_logs_updated", handleLogsUpdate);
    };
  }, []);

  // Sub-Tab Granular Lock & Hide State
  const [tabSecurity, setTabSecurity] = useState(() => {
    let savedTabs = {
      licensing: { locked: true, hidden: false },
      audits: { locked: false, hidden: false },
      godowns: { locked: false, hidden: false },
      receipt_studio: { locked: false, hidden: false },
      staff: { locked: false, hidden: false },
      clinic: { locked: false, hidden: false },
      apis: { locked: true, hidden: false },
      backups: { locked: true, hidden: false },
    };
    try {
      const saved = localStorage.getItem("cf_admin_tab_security");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tabs) savedTabs = { ...savedTabs, ...parsed.tabs };
      }
    } catch (e) {
      console.error(e);
    }
    return {
      tab_pin: getTabPin(),
      admin_passcode: getAdminPasscode(),
      tabs: savedTabs,
    };
  });

  const [unlockedTabs, setUnlockedTabs] = useState(() => new Set());
  const [tabPinInput, setTabPinInput] = useState("");
  const [tabPinError, setTabPinError] = useState("");
  const [showTabSecurityModal, setShowTabSecurityModal] = useState(false);
  const [showSecurityChallengeModal, setShowSecurityChallengeModal] = useState(false);
  const [challengePinInput, setChallengePinInput] = useState("");
  const [challengePinError, setChallengePinError] = useState("");
  const [showPinText, setShowPinText] = useState(false);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [revealPinInput, setRevealPinInput] = useState("");
  const [revealPinError, setRevealPinError] = useState("");
  const [tempSecurityConfig, setTempSecurityConfig] = useState(null);

  // Master Data States
  const [activeClinic, setActiveClinic] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [warehousesList, setWarehousesList] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [purchasesList, setPurchasesList] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [b2bSalesList, setB2bSalesList] = useState([]);
  const [expensesList, setExpensesList] = useState([]);
  const [visitsList, setVisitsList] = useState([]);
  const [patientsList, setPatientsList] = useState([]);
  const [_cashBookList, setCashBookList] = useState([]);

  // Audit Filter States
  const [auditRange, setAuditRange] = useState("6_months"); // "30_days" | "6_months" | "1_year" | "all_time" | "custom"
  const [auditCustomStart, setAuditCustomStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split("T")[0];
  });
  const [auditCustomEnd, setAuditCustomEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [auditGodown, setAuditGodown] = useState("all"); // "all" | warehouseId
  const [auditSearch, setAuditSearch] = useState("");

  // Staff & Doctor Management Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordModalUser, setResetPasswordModalUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");

  const [staffForm, setStaffForm] = useState({
    name: "",
    role: "doctor",
    email: "",
    phone: "",
    password: "",
    specialization: "General Physician / Homeopath",
    room_number: "Room 1",
    consultation_fee: 500,
    can_view_financials: false,
    is_owner: false,
    availability_status: "available",
  });

  // Godown / Multi-Warehouse Master States
  const [showGodownModal, setShowGodownModal] = useState(false);
  const [editingGodown, setEditingGodown] = useState(null);
  const [godownForm, setGodownForm] = useState({
    name: "",
    code: "",
    location: "Hyderabad, Sindh",
    incharge_name: "",
    phone: "",
    notes: "",
    status: "active",
    is_default: false,
    is_store_counter: false,
  });
  const [selectedGodownForStock, setSelectedGodownForStock] = useState(null);
  const [godownStockSearch, setGodownStockSearch] = useState("");
  const [godownCompanyFilter, setGodownCompanyFilter] = useState("all");
  const [godownSearch, setGodownSearch] = useState("");

  // Clinic Identity Form
  const [clinicForm, setClinicForm] = useState(() => {
    const c = dbClinic.get() || {};
    return {
      name: c.name || "H/Dr.Asif Ashraf Khan Clinic",
      address: c.address || "Lajpat Road, Hyderabad, Sindh",
      phone: c.phone || "03473100304",
      default_consultation_fee: Number(c.default_consultation_fee) || 300,
      clinic_status: c.clinic_status || "open",
      public_notice: c.public_notice || "",
      resend_api_key: c.resend_api_key || (typeof window !== "undefined" ? localStorage.getItem("cf_resend_api_key") || "" : ""),
      notification_email: c.notification_email || c.backup_email || (typeof window !== "undefined" ? localStorage.getItem("cf_notification_email") || "drasifhosting@gmail.com" : "drasifhosting@gmail.com"),
      report_frequency: c.report_frequency || c.backup_frequency || (typeof window !== "undefined" ? localStorage.getItem("cf_report_frequency") || "daily_9pm" : "daily_9pm"),
      whatsapp_gateway_no: c.whatsapp_gateway_no || (typeof window !== "undefined" ? localStorage.getItem("cf_whatsapp_gateway_no") || "03473100304" : "03473100304"),
    };
  });

  // Software Licensing & Remote Control State
  const [licenseForm, setLicenseForm] = useState(() => dbLicense.get());
  const [outboxItems, setOutboxItems] = useState(() => dbOutbox.getAll());
  const [syncState, setSyncState] = useState(() => syncEngine.getStatus());
  const [isSavingLicense, setIsSavingLicense] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const loadData = async (preserveForm = false) => {
    // 1. Fetch authoritative cloud settings from MySQL to synchronize across all devices & browsers
    try {
      const apiUrl = DEFAULT_API_URL;
      const res = await fetch(`${apiUrl}/api/v1/system/config`);
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.data?.clinic) {
          const sClinic = json.data.clinic;
          setActiveClinic(sClinic);

          // Sync remote license policy if stored in cloud MySQL
          if (sClinic.license_policy && !preserveForm) {
            try {
              const remoteLicense = typeof sClinic.license_policy === "string" ? JSON.parse(sClinic.license_policy) : sClinic.license_policy;
              if (remoteLicense && typeof remoteLicense === "object") {
                const mergedLic = dbLicense.update(remoteLicense);
                setLicenseForm(mergedLic);
              }
            } catch (licErr) {
              console.warn("Failed to parse remote license_policy:", licErr);
            }
          }

          if (!preserveForm) {
            const freq = sClinic.report_frequency || "daily_9pm";
            let type = freq;
            if (freq.startsWith("custom_time:")) {
              type = "custom_time";
              setCustomTimeInput(freq.substring(freq.indexOf(":") + 1) || "21:30");
            } else if (freq.startsWith("custom_interval:")) {
              type = "custom_interval";
              setCustomIntervalInput(parseInt(freq.split(":")[1]) || 15);
            }
            setSelectedFreqType(type);

            setClinicForm((prev) => ({
              ...prev,
              name: sClinic.name || prev.name,
              address: sClinic.address || prev.address,
              phone: sClinic.phone || prev.phone,
              default_consultation_fee: Number(sClinic.default_consultation_fee) || prev.default_consultation_fee,
              clinic_status: sClinic.clinic_status || prev.clinic_status,
              public_notice: sClinic.public_notice || prev.public_notice,
              resend_api_key: sClinic.resend_api_key || prev.resend_api_key,
              notification_email: sClinic.notification_email || prev.notification_email,
              report_frequency: sClinic.report_frequency || prev.report_frequency,
              whatsapp_gateway_no: sClinic.whatsapp_gateway_no || prev.whatsapp_gateway_no,
            }));
          }
          if (sClinic.resend_api_key) localStorage.setItem("cf_resend_api_key", sClinic.resend_api_key);
          if (sClinic.notification_email) localStorage.setItem("cf_notification_email", sClinic.notification_email);
          if (sClinic.report_frequency) localStorage.setItem("cf_report_frequency", sClinic.report_frequency);
          if (sClinic.admin_master_passcode) setAdminPasscode(sClinic.admin_master_passcode);
          if (sClinic.tab_pin) setTabPin(sClinic.tab_pin);

          let loadedTabs = null;
          if (sClinic.tab_security_json) {
            try {
              loadedTabs = typeof sClinic.tab_security_json === "string" ? JSON.parse(sClinic.tab_security_json) : sClinic.tab_security_json;
            } catch {}
          }
          const savedSecurity = (() => {
            try {
              return JSON.parse(localStorage.getItem("cf_admin_tab_security") || "{}");
            } catch {
              return {};
            }
          })();
          const mergedSecurity = {
            ...savedSecurity,
            admin_passcode: sClinic.admin_master_passcode || getAdminPasscode(),
            tab_pin: sClinic.tab_pin || getTabPin(),
            tabs: loadedTabs || savedSecurity.tabs || {
              licensing: { locked: true, hidden: false },
              audits: { locked: false, hidden: false },
              staff: { locked: false, hidden: false },
              clinic: { locked: false, hidden: false },
              apis: { locked: true, hidden: false },
              backups: { locked: true, hidden: false },
            }
          };
          setTabSecurity(mergedSecurity);
          localStorage.setItem("cf_admin_tab_security", JSON.stringify(mergedSecurity));
        }
      }
    } catch (syncErr) {
      console.warn("[Cloud Sync] Using local storage config fallback:", syncErr);
    }

    const curr = dbClinic.get() || {};
    setActiveClinic(curr);
    setUsersList(dbUsers.getAll() || []);
    setWarehousesList(dbWarehouses.getAll() || []);
    setInventoryList(dbInventory.getAll() || []);
    setPurchasesList(dbPurchases.getAll() || []);
    setSalesList(dbSales.getAll() || []);
    setB2bSalesList(dbB2BSales.getAll() || []);
    setExpensesList(dbExpenses.getAll() || []);
    setVisitsList(dbVisits.getAll() || []);
    setPatientsList(dbPatients.getAll() || []);
    setCashBookList(dbCashBook.getAll() || []);
    if (!preserveForm) {
      setLicenseForm(dbLicense.get());
    }
    setOutboxItems(dbOutbox.getAll() || []);
  };

  useEffect(() => {
    // Eagerly pre-load authoritative data & cloud state on mount
    loadData();
    if (sessionStorage.getItem("cf_dev_auth") === "true") {
      setIsAuthenticated(true);
    }
    const unsub = syncEngine.subscribe(setSyncState);
    const onStatusUpdate = () => loadData(true);
    window.addEventListener("clinicflow_status_update", onStatusUpdate);
    return () => {
      unsub();
      window.removeEventListener("clinicflow_status_update", onStatusUpdate);
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const input = (passcodeInput || "").trim();

    if (!input) {
      setAuthError("Please enter your Super Admin master passcode.");
      return;
    }

    const now = Date.now();
    let failedAttempts = 0;
    let lockoutUntil = 0;
    try {
      const rlRaw = sessionStorage.getItem("cf_admin_passcode_ratelimit");
      if (rlRaw) {
        const parsed = JSON.parse(rlRaw);
        failedAttempts = parsed.failedAttempts || 0;
        lockoutUntil = parsed.lockoutUntil || 0;
      }
    } catch {}

    if (failedAttempts >= 5 && now < lockoutUntil) {
      const secsLeft = Math.ceil((lockoutUntil - now) / 1000);
      setAuthError(`Too many failed attempts. Super Admin access locked for ${secsLeft} seconds.`);
      return;
    }

    if (now >= lockoutUntil && failedAttempts >= 5) {
      failedAttempts = 0;
      try {
        sessionStorage.setItem("cf_admin_passcode_ratelimit", JSON.stringify({ failedAttempts: 0, lockoutUntil: 0 }));
      } catch {}
    }

    // 1. Authoritative Server Verification (Strict Case-Sensitive)
    try {
      const apiUrl = DEFAULT_API_URL;
      const res = await fetch(`${apiUrl}/api/v1/system/verify-passcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: input }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        sessionStorage.setItem("cf_dev_auth", "true");
        if (data?.data?.token) {
          try { localStorage.setItem("cf_vps_jwt", data.data.token); } catch {}
        }
        try {
          sessionStorage.setItem("cf_admin_passcode_ratelimit", JSON.stringify({ failedAttempts: 0, lockoutUntil: 0 }));
        } catch {}
        setIsAuthenticated(true);
        setAuthError("");
        loadData();
        return;
      }
 else {
        // If server rejected the passcode, stop here immediately!
        failedAttempts++;
        const lockTime = failedAttempts >= 5 ? Date.now() + 60_000 : lockoutUntil;
        try {
          sessionStorage.setItem("cf_admin_passcode_ratelimit", JSON.stringify({ failedAttempts, lockoutUntil: lockTime }));
        } catch {}
        setAuthError(data?.error?.message || (failedAttempts >= 5 ? "Too many failed attempts. Super Admin access locked for 60 seconds." : "Incorrect Super Admin master passcode. Access denied."));
        return;
      }
    } catch (netErr) {
      // 2. Offline Fallback ONLY (Strict Case-Sensitive Match against stored custom passcode)
      const currentAdminPasscode = (getAdminPasscode() || DEFAULT_ADMIN_PASSCODE).trim();
      if (input === currentAdminPasscode) {
        sessionStorage.setItem("cf_dev_auth", "true");
        try {
          sessionStorage.setItem("cf_admin_passcode_ratelimit", JSON.stringify({ failedAttempts: 0, lockoutUntil: 0 }));
        } catch {}
        setIsAuthenticated(true);
        setAuthError("");
        loadData();
        return;
      }
    }

    // Zero Information Leakage: Never expose default or configured passwords
    failedAttempts++;
    const lockTime = failedAttempts >= 5 ? Date.now() + 60_000 : lockoutUntil;
    try {
      sessionStorage.setItem("cf_admin_passcode_ratelimit", JSON.stringify({ failedAttempts, lockoutUntil: lockTime }));
    } catch {}
    setAuthError(failedAttempts >= 5 ? "Too many failed attempts. Super Admin access locked for 60 seconds." : "Incorrect Super Admin master passcode. Access denied.");
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  // ---------------------------------------------------------------------------
  // AUDIT ENGINE (Multi-Godown, 6-Month, 1-Year Range Calculations)
  // ---------------------------------------------------------------------------
  const auditDates = useMemo(() => {
    const now = new Date();
    let start = new Date();
    if (auditRange === "30_days") {
      start.setDate(now.getDate() - 30);
    } else if (auditRange === "6_months") {
      start.setMonth(now.getMonth() - 6);
    } else if (auditRange === "1_year") {
      start.setFullYear(now.getFullYear() - 1);
    } else if (auditRange === "2_years") {
      start.setFullYear(now.getFullYear() - 2);
    } else if (auditRange === "all_time") {
      start = new Date("2020-01-01");
    } else if (auditRange === "custom") {
      return {
        startISO: auditCustomStart ? new Date(auditCustomStart + "T00:00:00").toISOString() : start.toISOString(),
        endISO: auditCustomEnd ? new Date(auditCustomEnd + "T23:59:59").toISOString() : now.toISOString(),
        startDateStr: auditCustomStart || start.toISOString().split("T")[0],
        endDateStr: auditCustomEnd || now.toISOString().split("T")[0],
      };
    }
    return {
      startISO: start.toISOString(),
      endISO: now.toISOString(),
      startDateStr: start.toISOString().split("T")[0],
      endDateStr: now.toISOString().split("T")[0],
    };
  }, [auditRange, auditCustomStart, auditCustomEnd]);

  // Filtered Financial Transactions
  const rangeVisits = useMemo(() => {
    return visitsList.filter((v) => {
      const d = (v.visit_date || "").split("T")[0];
      return d >= auditDates.startDateStr && d <= auditDates.endDateStr;
    });
  }, [visitsList, auditDates]);

  const rangeSales = useMemo(() => {
    return salesList.filter((s) => {
      const d = (s.sale_date || s.created_at || "").split("T")[0];
      return d >= auditDates.startDateStr && d <= auditDates.endDateStr;
    });
  }, [salesList, auditDates]);

  const rangeB2B = useMemo(() => {
    return b2bSalesList.filter((b) => {
      const d = (b.sale_date || b.created_at || "").split("T")[0];
      return d >= auditDates.startDateStr && d <= auditDates.endDateStr;
    });
  }, [b2bSalesList, auditDates]);

  const rangePurchases = useMemo(() => {
    return purchasesList.filter((p) => {
      const d = (p.purchase_date || p.created_at || "").split("T")[0];
      const matchDate = d >= auditDates.startDateStr && d <= auditDates.endDateStr;
      if (!matchDate) return false;
      if (auditGodown !== "all") {
        return (
          p.destination_id === auditGodown ||
          p.destination_warehouse_id === auditGodown ||
          p.destination_type === (auditGodown === "wh_str" ? "store" : "warehouse")
        );
      }
      return true;
    });
  }, [purchasesList, auditDates, auditGodown]);

  const rangeExpenses = useMemo(() => {
    return expensesList.filter((e) => {
      const d = (e.expense_date || e.date || "").split("T")[0];
      return d >= auditDates.startDateStr && d <= auditDates.endDateStr;
    });
  }, [expensesList, auditDates]);

  // Financial Metrics
  const auditMetrics = useMemo(() => {
    const opdFeesTotal = rangeVisits.reduce((sum, v) => sum + (Number(v.fee_amount) || 0), 0);
    const posSalesTotal = rangeSales.reduce((sum, s) => sum + (Number(s.paid_amount ?? s.total_amount) || 0), 0);
    const b2bSalesTotal = rangeB2B.reduce((sum, b) => sum + (Number(b.paid_amount ?? b.total_amount) || 0), 0);
    const totalInflows = opdFeesTotal + posSalesTotal + b2bSalesTotal;

    const supplierPurchasesCash = rangePurchases.reduce((sum, p) => sum + (Number(p.paid_amount ?? p.total_amount) || 0), 0);
    const expensesTotal = rangeExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalOutflows = supplierPurchasesCash + expensesTotal;

    const netOperatingSurplus = totalInflows - totalOutflows;

    // Stock Valuation calculation based on selected godown
    let totalStockValuation = 0;
    let totalUnitsCount = 0;

    inventoryList.forEach((inv) => {
      const cost = Number(inv.cost_price_per_box || inv.cost_price || 0);
      let qty = 0;
      if (auditGodown === "all") {
        qty = Number(inv.total_base_stock ?? inv.stock_qty ?? (Number(inv.warehouse_stock || 0) + Number(inv.store_stock || 0)));
      } else if (auditGodown === "wh_str") {
        qty = Number(inv.store_stock ?? inv.stock_qty ?? 0);
      } else {
        qty = Number(inv.warehouse_stock ?? 0);
      }
      totalUnitsCount += qty;
      totalStockValuation += (qty * cost);
    });

    return {
      opdFeesTotal,
      posSalesTotal,
      b2bSalesTotal,
      totalInflows,
      supplierPurchasesCash,
      expensesTotal,
      totalOutflows,
      netOperatingSurplus,
      totalStockValuation,
      totalUnitsCount,
    };
  }, [rangeVisits, rangeSales, rangeB2B, rangePurchases, rangeExpenses, inventoryList, auditGodown]);

  // Filtered Stock Items Table
  const filteredAuditInventory = useMemo(() => {
    return inventoryList.filter((inv) => {
      if (!auditSearch.trim()) return true;
      const q = auditSearch.toLowerCase();
      return (
        (inv.medicine_name || "").toLowerCase().includes(q) ||
        (inv.company_name || "").toLowerCase().includes(q) ||
        (inv.item_code || "").toLowerCase().includes(q)
      );
    });
  }, [inventoryList, auditSearch]);

  // ---------------------------------------------------------------------------
  // STAFF & DOCTOR ACTIONS
  // ---------------------------------------------------------------------------
  const handleSaveStaff = (e) => {
    e.preventDefault();
    if (!staffForm.name.trim()) return;

    if (editingUser) {
      dbUsers.update(editingUser.id, {
        name: staffForm.name,
        role: staffForm.role,
        email: staffForm.email,
        phone: staffForm.phone,
        specialization: staffForm.specialization,
        room_number: staffForm.room_number,
        consultation_fee: Number(staffForm.consultation_fee) || 0,
        can_view_financials: Boolean(staffForm.can_view_financials),
        assigned_warehouse_id: staffForm.assigned_warehouse_id || "",
        availability_status: staffForm.availability_status,
      });
      showToast(`Updated ${staffForm.name} profile successfully!`);
    } else {
      dbUsers.add({
        name: staffForm.name,
        role: staffForm.role,
        email: staffForm.email || `${staffForm.name.toLowerCase().replace(/\s+/g, "")}@example.com`,
        phone: staffForm.phone,
        password: hashPassword(staffForm.password || "123456"),
        specialization: staffForm.specialization,
        room_number: staffForm.room_number,
        consultation_fee: Number(staffForm.consultation_fee) || 0,
        can_view_financials: Boolean(staffForm.can_view_financials),
        assigned_warehouse_id: staffForm.assigned_warehouse_id || "",
        is_owner: Boolean(staffForm.is_owner),
        availability_status: "available",
      });
      showToast(`Created new staff user: ${staffForm.name}!`);
    }

    setShowAddStaffModal(false);
    setEditingUser(null);
    setStaffForm({
      name: "",
      role: "doctor",
      email: "",
      phone: "",
      password: "",
      specialization: "General Physician / Homeopath",
      room_number: "Room 1",
      consultation_fee: 500,
      can_view_financials: false,
      is_owner: false,
      availability_status: "available",
    });
    loadData();
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    if (!resetPasswordModalUser || !newPasswordInput.trim()) return;

    dbUsers.resetPassword(resetPasswordModalUser.id, newPasswordInput.trim());
    showToast(`✅ Password for ${resetPasswordModalUser.name} updated to "${newPasswordInput.trim()}"!`);
    setResetPasswordModalUser(null);
    setNewPasswordInput("");
    loadData();
  };

  const handleDeleteUser = (id, name) => {
    if (confirm(`Are you sure you want to permanently delete user "${name}"? This cannot be undone.`)) {
      dbUsers.delete(id);
      showToast(`Deleted user: ${name}`);
      loadData();
    }
  };

  // ---------------------------------------------------------------------------
  // GODOWNS & MULTI-WAREHOUSE HANDLERS
  // ---------------------------------------------------------------------------
  const handleSaveGodown = async (e) => {
    if (e) e.preventDefault();
    if (!godownForm.name.trim()) {
      alert("Godown / Warehouse name is required.");
      return;
    }
    if (editingGodown) {
      dbWarehouses.update(editingGodown.id, godownForm);
      if (godownForm.is_default) {
        dbWarehouses.getAll().forEach((w) => {
          if (w.id !== editingGodown.id) dbWarehouses.update(w.id, { is_default: false });
        });
      }
      showToast(`🏢 Godown "${godownForm.name}" updated successfully.`);
    } else {
      const created = dbWarehouses.add(godownForm);
      if (godownForm.is_default) {
        dbWarehouses.getAll().forEach((w) => {
          if (w.id !== created.id) dbWarehouses.update(w.id, { is_default: false });
        });
      }
      showToast(`🏢 Godown "${created.name}" registered successfully.`);
    }
    setShowGodownModal(false);
    setEditingGodown(null);
    setGodownForm({
      name: "",
      code: "",
      location: "Hyderabad, Sindh",
      incharge_name: "",
      phone: "",
      notes: "",
      status: "active",
      is_default: false,
      is_store_counter: false,
    });
    loadData();
    try {
      await syncEngine.pushLocalStateToCloud();
    } catch {}
  };

  const handleDeleteGodown = async (godownId, godownName) => {
    if (!window.confirm(`Are you sure you want to delete Godown "${godownName}"? This action cannot be undone.`)) return;
    const ok = dbWarehouses.delete(godownId);
    if (!ok) {
      alert("⚠️ Cannot delete this godown. System-protected primary locations or active store counters cannot be removed.");
      return;
    }
    showToast(`🗑️ Godown "${godownName}" deleted.`);
    if (selectedGodownForStock === godownId) {
      setSelectedGodownForStock(null);
    }
    loadData();
    try {
      await syncEngine.pushLocalStateToCloud();
    } catch {}
  };

  const handleSetDefaultGodown = async (godownId) => {
    const list = dbWarehouses.getAll();
    list.forEach((w) => {
      dbWarehouses.update(w.id, { is_default: w.id === godownId });
    });
    showToast("⭐ Primary default godown updated.");
    loadData();
    try {
      await syncEngine.pushLocalStateToCloud();
    } catch {}
  };

  // ---------------------------------------------------------------------------
  // CLINIC IDENTITY & API SAVE
  // ---------------------------------------------------------------------------
  const handleSaveClinicSettings = async (e) => {
    e?.preventDefault?.();
    dbClinic.update(clinicForm);
    if (clinicForm.resend_api_key) localStorage.setItem("cf_resend_api_key", clinicForm.resend_api_key.trim());
    if (clinicForm.notification_email) localStorage.setItem("cf_notification_email", clinicForm.notification_email.trim());
    if (clinicForm.report_frequency) localStorage.setItem("cf_report_frequency", clinicForm.report_frequency);
    if (clinicForm.whatsapp_gateway_no) localStorage.setItem("cf_whatsapp_gateway_no", clinicForm.whatsapp_gateway_no.trim());

    try {
      const apiUrl = DEFAULT_API_URL;
      await fetch(`${apiUrl}/api/v1/system/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clinicForm),
      });
      // Also broadcast and push full database snapshot to VPS MySQL
      await syncEngine.pushLocalStateToCloud();
    } catch (e) {
      console.warn("Could not sync config to remote MySQL:", e);
    }

    const frequencyLabels = {
      every_1m: "🧪 Testing Mode: Every 1 Minute (Live Automation Test)",
      daily_9pm: "Daily at 9:00 PM (Shift End Closure)",
      daily_10pm: "Daily at 10:00 PM (Late Night Closure)",
      daily_8pm: "Daily at 8:00 PM (Evening Shift Closure)",
      every_12h: "Every 12 Hours (Twice Daily Audit)",
      every_6h: "Every 6 Hours (High Volume Audit)",
      hourly: "Hourly (Real-Time Background Sync)",
      weekly_saturday: "Weekly on Saturday",
      monthly: "Monthly Executive Report",
      manual: "Manual On-Demand Only",
    };

    const freqName = frequencyLabels[clinicForm.report_frequency] || clinicForm.report_frequency;
    showToast(`✅ Saved! Frequency updated to: ${freqName}`);
    loadData(true);
  };

  const handleManualBackupEmailDispatch = async () => {
    if (!clinicForm.resend_api_key || !clinicForm.resend_api_key.trim()) {
      alert("⚠️ Please enter and save your Resend API Key (re_xxxx) first!");
      return;
    }
    const targetEmail = clinicForm.notification_email?.trim();
    if (!targetEmail) {
      alert("⚠️ Please enter a recipient notification email address!");
      return;
    }

    setIsDispatchingBackup(true);
    showToast("🔐 Encrypting full database vault & staging 1-click download...");

    try {
      const encryptedBackupStr = exportFullDatabase(true);
      const base64Content = btoa(unescape(encodeURIComponent(encryptedBackupStr)));
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeTag = now.toTimeString().split(" ")[0].replace(/:/g, "");
      const filename = `CliniCore_Encrypted_Backup_${dateStr}_${timeTag}.cfbak`;
      const sizeBytes = new Blob([encryptedBackupStr]).size;
      const timestampStr = now.toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" });

      const apiUrl = DEFAULT_API_URL;

      // 1. Stage backup on server to create authoritative 1-click download link
      let downloadUrl = `${apiUrl}/api/v1/system/download-backup?file=${encodeURIComponent(filename)}`;
      try {
        const prepRes = await fetch(`${apiUrl}/api/v1/system/prepare-backup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename,
            content: base64Content,
          }),
        });
        const prepData = await prepRes.json();
        if (prepData?.success && prepData?.data?.download_url) {
          downloadUrl = prepData.data.download_url;
        }
      } catch (prepErr) {
        console.warn("Could not pre-stage backup file on VPS:", prepErr);
      }

      // 2. Generate email template with 1-click download CTA button and timestamp
      const emailHtml = generateCliniCoreEmailTemplate({
        clinicName: clinicForm.name || "Medical Clinic & Pharmacy",
        targetEmail,
        dateStr,
        timestampStr,
        totalInflows: auditMetrics.totalInflows || 0,
        totalStockValuation: auditMetrics.totalStockValuation || 0,
        staffCount: usersList.length || 0,
        patientsCount: patientsList.length || 0,
        backupFilename: filename,
        backupSizeBytes: sizeBytes,
        downloadUrl,
        frequencyLabel: "Manual On-Demand Backup",
        isTestPing: false,
      });

      // 3. Dispatch via Resend API Relay with both 1-click Download Button AND .cfbak attachment!
      const res = await fetch(`${apiUrl}/api/v1/system/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: clinicForm.resend_api_key.trim(),
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
        showToast("✅ Full encrypted .cfbak backup delivered to " + targetEmail);
        alert(`✅ Backup Email Successfully Delivered!\n\nEncrypted database vault (.cfbak) and executive audit delivered to:\n${targetEmail}\n\nBackup Time: ${timestampStr}\nSize: ${(sizeBytes / 1024).toFixed(1)} KB\n\nRecipient can either click the 1-Click Download button inside the email or download the attached file!`);
        if (showEmailPreviewModal) setShowEmailPreviewModal(false);
      } else {
        const rawError = data?.error?.message || data?.message || data?.error || JSON.stringify(data || {});
        const errorMsg = typeof rawError === "string" ? rawError : JSON.stringify(rawError);
        if (errorMsg.includes("You can only send testing emails to your own email address") || errorMsg.includes("only send testing emails") || errorMsg.includes("testing emails")) {
          alert(`💡 Resend Sandbox Notice:\n\nResend Sandbox Key currently allows delivering emails to the email address registered with your Resend account.\n\nTo send to any custom recipient (${targetEmail}), verify your domain on https://resend.com/domains!\n\nEncrypted database backup was generated and validated.`);
        } else {
          alert(`⚠️ Email Dispatch Error:\n${errorMsg}`);
        }
      }
    } catch (err) {
      alert(`⚠️ Email dispatch failed: ${err.message}`);
    } finally {
      setIsDispatchingBackup(false);
    }
  };

  const handleOpenEmailPreview = () => {
    const targetEmail = clinicForm.notification_email?.trim() || "admin@clinicore.pk";
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeTag = now.toTimeString().split(" ")[0].replace(/:/g, "");
    const filename = `CliniCore_Encrypted_Backup_${dateStr}_${timeTag}.cfbak`;
    const apiUrl = DEFAULT_API_URL;
    const downloadUrl = `${apiUrl}/api/v1/system/download-backup?file=${encodeURIComponent(filename)}`;
    
    let sizeBytes = 145000;
    try {
      const encryptedBackupStr = exportFullDatabase(true);
      sizeBytes = new Blob([encryptedBackupStr]).size;
    } catch {}

    const html = generateCliniCoreEmailTemplate({
      clinicName: clinicForm.name || "Medical Clinic & Pharmacy",
      targetEmail,
      dateStr,
      timestampStr: now.toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" }),
      totalInflows: auditMetrics.totalInflows || 0,
      totalStockValuation: auditMetrics.totalStockValuation || 0,
      staffCount: usersList.length || 0,
      patientsCount: patientsList.length || 0,
      backupFilename: filename,
      backupSizeBytes: sizeBytes,
      downloadUrl,
      frequencyLabel: "Live Template Preview",
      isTestPing: false,
    });

    setEmailPreviewHtml(html);
    setShowEmailPreviewModal(true);
  };

  const handleTestPingEmail = async () => {
    if (!clinicForm.resend_api_key || !clinicForm.resend_api_key.trim()) {
      alert("⚠️ Please enter and save your Resend API Key (re_xxxx) first!");
      return;
    }
    const targetEmail = clinicForm.notification_email?.trim();
    if (!targetEmail) {
      alert("⚠️ Please enter a recipient notification email address!");
      return;
    }

    setIsPingingApi(true);
    showToast("📡 Sending Resend API test ping...");

    try {
      const dateStr = new Date().toISOString().split("T")[0];
      const emailHtml = generateCliniCoreEmailTemplate({
        clinicName: clinicForm.name || "Medical Clinic & Pharmacy",
        targetEmail,
        dateStr,
        timestampStr: new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" }),
        isTestPing: true,
      });

      const apiUrl = DEFAULT_API_URL;
      const res = await fetch(`${apiUrl}/api/v1/system/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: clinicForm.resend_api_key.trim(),
          from: "CliniCore System <backup@clinicore.me>",
          to: [targetEmail],
          subject: `✅ CliniCore Resend API Gateway Connectivity Test (${dateStr})`,
          html: emailHtml,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        showToast("✅ Resend Connectivity Test Ping Verified!");
        alert(`✅ Resend Gateway Live!\n\nTest verification ping successfully delivered to:\n${targetEmail}`);
      } else {
        const rawError = data?.error?.message || data?.message || data?.error || JSON.stringify(data || {});
        const errorMsg = typeof rawError === "string" ? rawError : JSON.stringify(rawError);
        if (errorMsg.includes("You can only send testing emails to your own email address") || errorMsg.includes("only send testing emails") || errorMsg.includes("testing emails")) {
          alert(`💡 Resend Sandbox Notice:\n\nResend Sandbox Key currently allows delivering emails to the email address registered with your Resend account.\n\nTo send to any external address (${targetEmail}), verify your domain on https://resend.com/domains!`);
        } else {
          alert(`⚠️ Resend Ping Response:\n${errorMsg}`);
        }
      }
    } catch (err) {
      alert(`⚠️ Test ping failed: ${err.message}`);
    } finally {
      setIsPingingApi(false);
    }
  };

  // ---------------------------------------------------------------------------
  // BACKUP & RESTORE
  // ---------------------------------------------------------------------------
  const handleExportBackup = () => {
    exportFullDatabase();
    showToast("💾 Complete system database snapshot exported as JSON!");
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const jsonStr = evt.target?.result;
      if (typeof jsonStr === "string") {
        const result = importFullDatabase(jsonStr);
        if (result.success) {
          // Force sync to VPS immediately before reloading the window!
          try {
            const { syncEngine } = await import("../api/syncEngine.js");
            if (syncEngine && typeof syncEngine.pushLocalStateToCloud === "function") {
              await syncEngine.pushLocalStateToCloud();
            }
          } catch (syncErr) {
            console.warn("[Restore] Auto-push notice:", syncErr);
          }
          alert("Database snapshot restored successfully and synchronized to Cloud! Reloading system...");
          window.location.reload();
        } else {
          alert("Failed to restore backup: " + result.error);
        }
      }
    };
    reader.readAsText(file);
  };

  // Sub-Tab Security Handlers
  const handleUnlockActiveTab = (e) => {
    e.preventDefault();
    const currentTabPin = getTabPin();
    if (tabPinInput.trim() === currentTabPin.trim()) {
      setUnlockedTabs((prev) => new Set([...prev, activeTab]));
      setTabPinInput("");
      setTabPinError("");
      showToast(`🔓 "${NAV_ITEMS.find(n => n.id === activeTab)?.label}" unlocked successfully.`);
    } else {
      setTabPinError("Incorrect Tab Security PIN. Please try again.");
    }
  };

  const handleLockAllTabs = () => {
    setUnlockedTabs(new Set());
    setTabPinInput("");
    setTabPinError("");
    showToast("🔒 All protected admin tabs re-locked.");
  };

  const handleRevealAllHidden = (e) => {
    e.preventDefault();
    const currentTabPin = getTabPin();
    if (revealPinInput.trim() === currentTabPin.trim()) {
      // Unlock all tabs in session
      setUnlockedTabs(new Set(NAV_ITEMS.map((n) => n.id)));
      setShowRevealModal(false);
      setRevealPinInput("");
      setRevealPinError("");
      showToast("👁️ All hidden modules revealed for this session.");
    } else {
      setRevealPinError("Incorrect Tab Security PIN.");
    }
  };

  const handleOpenTabSecurity = () => {
    setChallengePinInput("");
    setChallengePinError("");
    setShowSecurityChallengeModal(true);
  };

  const handleVerifySecurityChallenge = (e) => {
    e.preventDefault();
    const currentTabPin = getTabPin();
    const masterAdminPasscode = getAdminPasscode();
    const input = challengePinInput.trim();

    // Verify against saved Tab Security PIN or saved Admin Master Passcode
    if (input === currentTabPin.trim() || input === masterAdminPasscode.trim()) {
      setShowSecurityChallengeModal(false);
      setChallengePinInput("");
      setChallengePinError("");
      setShowPinText(false);
      const currSecurity = {
        ...tabSecurity,
        admin_passcode: masterAdminPasscode,
        tab_pin: currentTabPin,
      };
      setTempSecurityConfig(JSON.parse(JSON.stringify(currSecurity)));
      setShowTabSecurityModal(true);
    } else {
      setChallengePinError("Incorrect Security PIN. Access Denied.");
    }
  };

  const handleSaveSecurityConfig = async (e) => {
    e?.preventDefault?.();
    if (!tempSecurityConfig) return;
    
    const newAdminPass = (tempSecurityConfig.admin_passcode || "").trim() || getAdminPasscode();
    const newTabPin = (tempSecurityConfig.tab_pin || "").trim() || getTabPin();

    // 1. Save Admin Passcode
    setAdminPasscode(newAdminPass);

    // 2. Save Sub-Tab Security PIN
    setTabPin(newTabPin);

    const finalConfig = {
      ...tempSecurityConfig,
      admin_passcode: newAdminPass,
      tab_pin: newTabPin,
    };

    setTabSecurity(finalConfig);
    localStorage.setItem("cf_admin_tab_security", JSON.stringify(finalConfig));

    // Update clinic store
    dbClinic.update({
      admin_master_passcode: newAdminPass,
      tab_pin: newTabPin,
    });

    // Persist to VPS MySQL database so all devices and browsers sync automatically
    try {
      const apiUrl = DEFAULT_API_URL;
      await fetch(`${apiUrl}/api/v1/system/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_master_passcode: newAdminPass,
          tab_pin: newTabPin,
          tab_security_json: JSON.stringify(finalConfig.tabs || {}),
        }),
      });
      await syncEngine.pushLocalStateToCloud();
    } catch (err) {
      console.warn("Could not sync security config to remote MySQL:", err);
    }

    setShowTabSecurityModal(false);
    showToast("🛡️ Admin Master Passcode, Tab PIN & Permissions saved to Cloud & Local Storage!");
    loadData();
  };

  // Computed Godown Statistics & Valuations
  const godownStats = useMemo(() => {
    const warehouses = dbWarehouses.getAll() || [];
    const inv = dbInventory.getAll() || [];
    
    let totalValuation = 0;
    let totalUnits = 0;

    const breakdown = warehouses.map((wh) => {
      const val = dbWarehouses.getStockValuation(wh.id);
      const itemsInGodown = inv.filter((i) => {
        const qty = dbInventory.getLocationStock(i, wh.id);
        return qty > 0;
      });
      totalValuation += val.totalValue || 0;
      totalUnits += val.totalUnits || 0;
      return {
        ...wh,
        valuation: val.totalValue || 0,
        unitsCount: val.totalUnits || 0,
        skuCount: itemsInGodown.length,
      };
    });

    return {
      totalValuation,
      totalUnits,
      warehouses: breakdown,
      activeCount: breakdown.filter((w) => w.status !== "inactive").length,
    };
  }, [warehousesList, inventoryList]);

  // Filtered list of items for the selected godown stock inspector
  const currentGodownStockItems = useMemo(() => {
    if (!selectedGodownForStock) return [];
    const inv = dbInventory.getAll() || [];
    const q = (godownStockSearch || "").toLowerCase().trim();
    const comp = godownCompanyFilter;

    return inv.map((item) => {
      const qty = dbInventory.getLocationStock(item, selectedGodownForStock);
      const cost = Number(item.cost_price_per_box || item.unit_cost_price || item.cost_price || 0);
      const sale = Number(item.unit_sale_price || item.sale_price || item.retail_price || 0);
      const val = qty * cost;
      return {
        ...item,
        locationQty: qty,
        unitCost: cost,
        unitSale: sale,
        locationValuation: val,
      };
    }).filter((item) => {
      if (item.locationQty <= 0 && !q) return false;
      const matchesSearch = !q ||
        (item.medicine_name || "").toLowerCase().includes(q) ||
        (item.item_code || "").toLowerCase().includes(q) ||
        (item.company_name || "").toLowerCase().includes(q) ||
        (item.generic_name || "").toLowerCase().includes(q);
      const matchesComp = comp === "all" || (item.company_name || "").toLowerCase() === comp.toLowerCase();
      return matchesSearch && matchesComp;
    });
  }, [selectedGodownForStock, inventoryList, godownStockSearch, godownCompanyFilter]);

  const godownCompanyOptions = useMemo(() => {
    const inv = dbInventory.getAll() || [];
    const set = new Set();
    inv.forEach((i) => {
      if (i.company_name) set.add(i.company_name);
    });
    return Array.from(set).sort();
  }, [inventoryList]);

  const NAV_ITEMS = [
    { id: "licensing", label: "Software Licensing & Remote Control", icon: "vpn_key", badge: "Control" },
    { id: "audits", label: "Multi-Godown & Clinic Audits", icon: "analytics", badge: "Live" },
    { id: "godowns", label: "Godowns & Multi-Warehouse Portal", icon: "warehouse", count: warehousesList.length, badge: "Stock" },
    { id: "receipt_studio", label: "Thermal Receipt Studio & Customizer", icon: "receipt_long", badge: "New" },
    { id: "staff", label: "Doctors & Staff Master", icon: "group", count: usersList.length },
    { id: "clinic", label: "Clinic Identity & Governance", icon: "domain" },
    { id: "apis", label: "Automated Services & Resend API", icon: "mail" },
    { id: "backups", label: "Backup, Restore & Clean Modes", icon: "cloud_sync" },
  ];

  // Filter visible tabs: hide tabs marked as hidden unless unlocked
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    const isHidden = tabSecurity?.tabs?.[item.id]?.hidden;
    if (!isHidden) return true;
    return unlockedTabs.has(item.id);
  });

  const hiddenCount = NAV_ITEMS.length - visibleNavItems.length;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8faf9] flex flex-col justify-between p-4 sm:p-6 selection:bg-teal-600 selection:text-white relative overflow-hidden font-sans">
        {/* Decorative Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-gradient-to-b from-teal-100/70 via-emerald-50/40 to-transparent blur-3xl -z-10 pointer-events-none" />

        {/* Top Header Floating Navigation */}
        <header className="w-full max-w-4xl mx-auto flex items-center justify-between py-2 px-1 relative z-20">
          <Link
            to="/login"
            className="px-3.5 py-2 rounded-2xl bg-white/80 hover:bg-white border border-teal-100 text-teal-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all hover:border-teal-300 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base text-teal-700">arrow_back</span>
            <span>Switch to Staff Login</span>
          </Link>

          <Link
            to="/"
            className="px-3.5 py-2 rounded-2xl bg-white/80 hover:bg-white border border-teal-100 text-teal-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all hover:border-teal-300 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base text-teal-700">home</span>
            <span>Public Home</span>
          </Link>
        </header>

        <main className="w-full max-w-md mx-auto my-auto relative z-10 py-4">
          <div className="w-full bg-white/95 backdrop-blur-xl border border-teal-100/90 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-teal-900/10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-700 to-teal-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-700/25">
              <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
            </div>
            <h2 className="text-2xl font-black text-center text-teal-950 tracking-tight">
              Super Admin Command Center
            </h2>
            <p className="text-xs text-center text-slate-500 mt-1 mb-6 font-medium">
              K.B Software • Complete Multi-Godown, Staff &amp; Periodic Audit Engine
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-teal-900 uppercase tracking-wider mb-1.5">
                  Super Admin Master Passcode
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-600 text-lg select-none">
                    lock
                  </span>
                  <input
                    type={showPinText ? "text" : "password"}
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    enterKeyHint="go"
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    placeholder="Enter Master Passcode"
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl pl-10 pr-12 py-3.5 text-sm text-teal-950 focus:outline-none transition-all font-mono tracking-widest text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinText(!showPinText)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-700 p-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPinText ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center animate-shake">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                className="w-full min-h-[48px] bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-black text-sm py-3.5 rounded-2xl shadow-lg shadow-teal-700/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <span>Unlock Master Super Admin Plane</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </form>

            {/* Quick Switch to Staff Login */}
            <div className="w-full mt-6 pt-4 border-t border-gray-100 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-bold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">badge</span>
                <span>Go to Counter &amp; Doctor Staff Login</span>
              </Link>
            </div>
          </div>
        </main>

        {/* Bottom Footer */}
        <footer className="w-full max-w-md mx-auto text-center py-3 text-xs text-gray-400 font-medium relative z-20">
          <span>© 2026 CliniCore • Master Developer Portal</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf9] text-slate-800 font-sans selection:bg-teal-600 selection:text-white flex flex-col">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-teal-800 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 text-xs font-black flex items-center gap-2 animate-fade-in border border-teal-700">
          <span className="material-symbols-outlined text-base">check_circle</span>
          {toastMsg}
        </div>
      )}

      {/* Top Navbar */}
      <header className="border-b border-teal-100 bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-xs h-16 flex items-center px-3 sm:px-6 justify-between flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileDrawerOpen((prev) => !prev);
              } else {
                setSidebarOpen((prev) => !prev);
              }
            }}
            className="p-2 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors flex items-center justify-center cursor-pointer shadow-xs shrink-0 active:scale-95"
            title="Toggle Menu"
          >
            <span className="material-symbols-outlined text-xl">
              {mobileDrawerOpen || sidebarOpen ? "menu_open" : "menu"}
            </span>
          </button>

          <img
            src="/favicon.svg"
            alt="CliniCore Logo"
            className="h-8 sm:h-10 w-8 sm:w-10 object-contain rounded-xl drop-shadow-xs shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="font-black text-xs sm:text-base text-teal-950 tracking-tight truncate">Admin Command Center</h1>
              <span className="px-1.5 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200 shrink-0">
                MASTER SUITE
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate hidden md:block">
              Active Tenant: <strong className="text-teal-900">{activeClinic?.name || "H/Dr.Asif Ashraf Khan Clinic"}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Tab Security Configuration Button */}
          <button
            onClick={handleOpenTabSecurity}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-2xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Configure Tab Password Protection & Hiding"
          >
            <span className="material-symbols-outlined text-base text-amber-700">shield</span>
            <span className="hidden md:inline">Tab Security</span>
          </button>

          {/* Quick Lock Button if any tab is unlocked */}
          {unlockedTabs.size > 0 && (
            <button
              onClick={handleLockAllTabs}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Lock all currently unlocked protected tabs"
            >
              <span className="material-symbols-outlined text-base text-slate-700">lock</span>
              <span className="hidden md:inline">Re-Lock Tabs ({unlockedTabs.size})</span>
            </button>
          )}

          <Link
            to="/login"
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-2xl text-xs font-bold bg-white hover:bg-teal-50 text-teal-950 border border-teal-200 transition-colors flex items-center gap-1.5 shadow-xs"
            title="Go to Staff & Cashier Login"
          >
            <span className="material-symbols-outlined text-base text-teal-700">badge</span>
            <span className="hidden lg:inline">Staff Login</span>
          </Link>

          <Link
            to="/dashboard"
            className="p-1.5 sm:px-3.5 sm:py-1.5 rounded-2xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 transition-colors flex items-center gap-1.5"
            title="Go to Clinic Dashboard"
          >
            <span className="material-symbols-outlined text-base text-teal-700">dashboard</span>
            <span className="hidden sm:inline">Clinic Dashboard</span>
          </Link>

          <button
            onClick={() => {
              sessionStorage.removeItem("cf_dev_auth");
              setIsAuthenticated(false);
            }}
            className="px-2 sm:px-3 py-1.5 rounded-2xl text-[11px] sm:text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
            title="Lock Super Admin Session"
          >
            <span className="material-symbols-outlined text-sm">lock</span>
            <span>Lock Admin</span>
          </button>
        </div>
      </header>

      {/* Main Body with Collapsible Sidebar */}
      <div className="flex flex-1 relative min-w-0">
        
        {/* Mobile Backdrop */}
        {mobileDrawerOpen && (
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-teal-950/60 backdrop-blur-sm z-50 md:hidden"
          />
        )}

        {/* ── Left Sidebar (Responsive Full Mobile Slide-Over & Desktop Collapse) ── */}
        <aside
          className={`
            fixed md:static top-0 md:top-16 bottom-0 left-0 z-50 md:z-30
            bg-white border-r border-teal-100 shadow-2xl md:shadow-sm
            flex flex-col justify-between transition-all duration-300 ease-in-out
            ${mobileDrawerOpen ? "translate-x-0 w-[280px] max-w-[85vw]" : "-translate-x-full md:translate-x-0"}
            ${sidebarOpen ? "md:w-72" : "md:w-20"}
          `}
        >
          {/* Mobile Drawer Top Banner */}
          <div className="md:hidden p-4 border-b border-teal-100 flex items-center justify-between bg-teal-50/80">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-800">admin_panel_settings</span>
              <span className="text-xs font-black text-teal-950">Super Admin Menu</span>
            </div>
            <button
              onClick={() => setMobileDrawerOpen(false)}
              className="p-1 rounded-xl bg-white border border-teal-200 text-teal-800"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          {/* Navigation Items List */}
          <div className="p-3.5 space-y-1.5 overflow-y-auto flex-1">
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {mobileDrawerOpen || sidebarOpen ? "Control Plane Modules" : "•"}
            </div>

            {visibleNavItems.map((item) => {
              const isActive = activeTab === item.id;
              const isLocked = tabSecurity?.tabs?.[item.id]?.locked && !unlockedTabs.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileDrawerOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer text-left
                    ${
                      isActive
                        ? "bg-teal-700 text-white shadow-md shadow-teal-700/20"
                        : "text-slate-600 hover:bg-teal-50/80 hover:text-teal-950"
                    }
                  `}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <span
                    className={`material-symbols-outlined text-xl flex-shrink-0 ${
                      isActive ? "text-white" : "text-teal-700"
                    }`}
                  >
                    {item.icon}
                  </span>
                  
                  {(mobileDrawerOpen || sidebarOpen) && (
                    <span className="flex-1 truncate tracking-tight">
                      {item.label}
                    </span>
                  )}

                  {(mobileDrawerOpen || sidebarOpen) && isLocked && (
                    <span
                      className={`material-symbols-outlined text-sm ${
                        isActive ? "text-amber-300" : "text-amber-600"
                      }`}
                      title="This module is password protected"
                    >
                      lock
                    </span>
                  )}

                  {(mobileDrawerOpen || sidebarOpen) && !isLocked && item.count !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-teal-100 text-teal-800"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}

                  {(mobileDrawerOpen || sidebarOpen) && !isLocked && item.badge && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Sidebar Footer */}
          <div className="p-3 border-t border-teal-50 flex flex-col gap-2 bg-slate-50/50">
            {/* Hidden Modules Reveal Button */}
            {hiddenCount > 0 && sidebarOpen && (
              <button
                onClick={() => {
                  setRevealPinInput("");
                  setRevealPinError("");
                  setShowRevealModal(true);
                }}
                className="w-full py-2 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Unlock and display hidden modules"
              >
                <span className="material-symbols-outlined text-sm text-amber-700">visibility</span>
                <span>Reveal {hiddenCount} Hidden Tab{hiddenCount > 1 ? "s" : ""}</span>
              </button>
            )}

            {sidebarOpen ? (
              <div className="flex items-center justify-between w-full px-2 pt-1">
                <div className="text-[11px] font-semibold text-slate-500">
                  K.B Super Admin v2.5
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-teal-100 text-teal-800 transition-colors hidden md:block"
                  title="Collapse"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-full p-1.5 rounded-xl hover:bg-teal-100 text-teal-800 transition-colors hidden md:flex items-center justify-center"
                title="Expand"
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            )}
          </div>
        </aside>

        {/* ── Main Content Pane ── */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden space-y-6 pb-24 md:pb-12">
          
          {/* Sub-Tab Password / PIN Challenge Screen */}
          {tabSecurity?.tabs?.[activeTab]?.locked && !unlockedTabs.has(activeTab) ? (
            <div className="bg-white border border-amber-200/80 rounded-3xl p-8 sm:p-12 shadow-xl max-w-lg mx-auto text-center space-y-6 animate-fade-in my-8">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
                <span className="material-symbols-outlined text-3xl font-black">lock</span>
              </div>
              <div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
                  Protected Super Admin Module
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-2">
                  {NAV_ITEMS.find((n) => n.id === activeTab)?.label || "Protected Module"}
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium leading-relaxed">
                  This administrative section is protected by custom password/PIN security. Enter the security PIN to access.
                </p>
              </div>

              <form onSubmit={handleUnlockActiveTab} className="space-y-4 max-w-xs mx-auto">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                    key
                  </span>
                  <input
                    type="password"
                    autoFocus
                    value={tabPinInput}
                    onChange={(e) => {
                      setTabPinInput(e.target.value);
                      setTabPinError("");
                    }}
                    placeholder="Enter Security PIN"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none transition-all font-mono tracking-widest text-center font-bold"
                  />
                </div>

                {tabPinError && (
                  <p className="text-xs font-bold text-rose-600 animate-shake">
                    {tabPinError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-2xl shadow-md shadow-teal-900/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">lock_open</span>
                  <span>Unlock This Module</span>
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* ================================================================= */}
              {/* TAB: SOFTWARE LICENSING, SYNC & DEVELOPER REMOTE CONTROL          */}
              {/* ================================================================= */}
              {activeTab === "licensing" && (() => {
                const evalStatus = dbLicense.evaluateStatus();
                const clinicDocPhone = activeClinic?.phone || clinicForm?.phone || "03473100304";
                const cleanWaPhone = clinicDocPhone.replace(/\D/g, "").replace(/^0/, "92");

                const handleSaveLicense = async (e, customPayload = null) => {
                  if (e) e.preventDefault();
                  setIsSavingLicense(true);
                  try {
                    const target = customPayload || licenseForm;
                    const updated = dbLicense.update(target);
                    setLicenseForm(updated);

                    // Dual persist to VPS MySQL cloud backend
                    const apiUrl = DEFAULT_API_URL;
                    await fetch(`${apiUrl}/api/v1/system/config`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ license_policy: JSON.stringify(updated) }),
                    }).catch((err) => console.warn("[License Policy] Backend sync deferred to syncEngine:", err));

                    showToast("🔐 Software License & Remote Controls Saved & Synced Successfully!");
                  } catch (err) {
                    showToast("⚠️ Error saving license policy: " + err.message);
                  } finally {
                    setIsSavingLicense(false);
                  }
                };

                const handleQuickRestore = async () => {
                  const today = new Date();
                  const nextMonth = new Date(today);
                  nextMonth.setDate(today.getDate() + 30);

                  const restored = {
                    ...licenseForm,
                    license_status: "active",
                    is_hard_locked: false,
                    restricted_features: [],
                    last_paid_date: today.toISOString().split("T")[0],
                    next_due_date: nextMonth.toISOString().split("T")[0],
                    custom_notice: "",
                  };
                  await handleSaveLicense(null, restored);
                  showToast("✅ Payment Received: Full Access Resumed & Restrictions Cleared!");
                };

                const handleManualSyncNow = async () => {
                  setIsSyncingCloud(true);
                  try {
                    await syncEngine.forceSyncNow();
                    setOutboxItems(dbOutbox.getAll() || []);
                    await loadData(true);
                    showToast("🔄 Cloud database sync completed successfully!");
                  } catch (err) {
                    showToast("⚠️ Cloud sync error: " + (err.message || "Failed"));
                  } finally {
                    setIsSyncingCloud(false);
                  }
                };

                return (
                  <div className="space-y-6 animate-fade-in">
                    {/* Header & Status Indicator */}
                    <div className="bg-white border border-teal-100 p-6 rounded-3xl space-y-4 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-teal-950 flex items-center gap-2">
                              <span className="material-symbols-outlined text-teal-700">vpn_key</span>
                              Software Licensing, Subscription &amp; Remote Control
                            </h3>
                            {/* Live Dynamic Status Pill */}
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                              evalStatus.status === "active"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : evalStatus.status === "warning"
                                ? "bg-yellow-50 text-yellow-800 border-yellow-300"
                                : evalStatus.status === "grace_period"
                                ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                                : evalStatus.status === "restricted"
                                ? "bg-orange-50 text-orange-800 border-orange-300 animate-pulse"
                                : "bg-rose-50 text-rose-800 border-rose-300 animate-pulse"
                            }`}>
                              ● {evalStatus.status === "active" ? "Active (Full Access)" : evalStatus.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            Manage monthly client subscription, warning notices, grace period &amp; selective module kill-switches.
                          </p>
                        </div>

                        {/* Quick WhatsApp Reminder Dispatcher */}
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://wa.me/${cleanWaPhone || "923473100304"}?text=${encodeURIComponent(
                              `*📋 SOFTWARE MONTHLY INVOICE / REMINDER*\n` +
                              `*🏥 ${activeClinic?.name || "CliniCore Client"}*\n\n` +
                              `• Monthly Subscription Fee: Rs. ${Number(licenseForm.monthly_fee || 5000).toLocaleString("en-US")}\n` +
                              `• Due Date: ${licenseForm.next_due_date || "1st of Month"}\n` +
                              `• Grace Period: 1st to ${licenseForm.grace_days || 10}th of Month\n` +
                              `• Payment Mode: JazzCash / EasyPaisa / Bank Transfer (03142291356)\n\n` +
                              `_Please share payment receipt screenshot after transfer to keep all services running seamlessly._\n` +
                              `*K.B Software Hyderabad*`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                            title={`Send WhatsApp payment reminder invoice to clinic doctor (${cleanWaPhone || "03473100304"})`}
                          >
                            <span className="material-symbols-outlined text-base">chat</span>
                            <span>Send WhatsApp Invoice</span>
                          </a>
                        </div>
                      </div>

                      {/* Cloud Sync & Outbox Monitor */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-teal-50">
                        <div className="bg-slate-50 border border-teal-100 rounded-2xl p-3.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Network State</span>
                          <span className="text-sm font-black text-teal-950 flex items-center gap-1.5 mt-0.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${syncState.isOnline ? "bg-emerald-500" : "bg-amber-500 animate-ping"}`} />
                            {syncState.isOnline ? "Online & Connected" : "Offline (Local Only)"}
                          </span>
                        </div>

                        <div className="bg-slate-50 border border-teal-100 rounded-2xl p-3.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Offline Outbox Queue</span>
                          <span className="text-sm font-black text-teal-950 mt-0.5 block">
                            {outboxItems.length} Mutations Pending Sync
                          </span>
                        </div>

                        <div className="bg-slate-50 border border-teal-100 rounded-2xl p-3.5 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Background Cloud Worker</span>
                            <span className="text-xs font-bold text-emerald-700 mt-0.5 block">
                              {isSyncingCloud ? "Syncing to VPS..." : syncState.isSyncing ? "Syncing in background..." : "Active & Ready"}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={isSyncingCloud}
                            onClick={handleManualSyncNow}
                            className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 active:scale-95"
                          >
                            {isSyncingCloud ? (
                              <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                            ) : null}
                            <span>Sync Now</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Master License Form */}
                    <form
                      onSubmit={(e) => handleSaveLicense(e)}
                      className="bg-white border border-teal-100 rounded-3xl p-6 space-y-6 shadow-sm"
                    >
                      {/* 1. License Mode Quick Selector */}
                      <div>
                        <label className="block text-xs font-black text-teal-950 uppercase tracking-wider mb-2">
                          1. Software Enforcement Policy &amp; Status Mode
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                          {[
                            {
                              id: "active",
                              title: "Active (Full Access)",
                              desc: "Paid & normal operational mode. No warnings or restrictions.",
                              color: "border-emerald-300 bg-emerald-50/60 text-emerald-950",
                            },
                            {
                              id: "warning",
                              title: "Payment Warning",
                              desc: "Displays gentle non-intrusive reminder banner before due date.",
                              color: "border-yellow-300 bg-yellow-50/60 text-yellow-950",
                            },
                            {
                              id: "grace_period",
                              title: "Grace Period",
                              desc: "Overdue alert banner. Software operates 100% normally without stoppage.",
                              color: "border-amber-300 bg-amber-50/60 text-amber-950",
                            },
                            {
                              id: "restricted",
                              title: "Feature Restricted",
                              desc: "Blocks selected main modules (POS, B2B, Reports) while doctor can see patients.",
                              color: "border-orange-300 bg-orange-50/60 text-orange-950",
                            },
                            {
                              id: "locked",
                              title: "Hard Locked",
                              desc: "Full screen lock. Software access halted until payment confirmed.",
                              color: "border-rose-300 bg-rose-50/60 text-rose-950",
                            },
                          ].map((mode) => {
                            const isSelected = licenseForm.license_status === mode.id;
                            return (
                              <div
                                key={mode.id}
                                onClick={() => setLicenseForm({ ...licenseForm, license_status: mode.id, is_hard_locked: mode.id === "locked" })}
                                className={`border-2 rounded-2xl p-4 cursor-pointer transition-all ${
                                  isSelected
                                    ? `${mode.color} ring-2 ring-teal-600 shadow-md scale-[1.02]`
                                    : "border-slate-200 hover:border-teal-200 bg-white opacity-80 hover:opacity-100"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-black text-xs">{mode.title}</span>
                                  <input
                                    type="radio"
                                    name="license_status"
                                    checked={isSelected}
                                    onChange={() => setLicenseForm({ ...licenseForm, license_status: mode.id, is_hard_locked: mode.id === "locked" })}
                                    className="text-teal-600 focus:ring-teal-500"
                                  />
                                </div>
                                <p className="text-[10.5px] text-slate-500 leading-snug">{mode.desc}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Selective Feature Kill-Switches */}
                      <div className="pt-4 border-t border-teal-50 space-y-3">
                        <div>
                          <label className="block text-xs font-black text-teal-950 uppercase tracking-wider mb-1">
                            2. Selective Module Kill-Switches (Selective Restriction)
                          </label>
                          <p className="text-xs text-slate-500">
                            Developer can toggle specific modules OFF if payment is overdue, leaving the remaining core functions intact.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { key: "pos", label: "Counter POS & Cash Sales", icon: "point_of_sale" },
                            { key: "b2b", label: "Warehouse & Wholesale", icon: "warehouse" },
                            { key: "purchases", label: "Purchases & Inward GRN", icon: "local_shipping" },
                            { key: "reports", label: "Financial Reports & Audits", icon: "query_stats" },
                            { key: "consultation", label: "Doctor OPD Consultation", icon: "stethoscope" },
                            { key: "inventory", label: "Medical Store Inventory Edit", icon: "inventory_2" },
                            { key: "patients", label: "Patient Registration & EMR", icon: "group" },
                            { key: "sales", label: "Sales Log & Returns", icon: "receipt_long" },
                          ].map((feat) => {
                            const isBlocked = (licenseForm.restricted_features || []).includes(feat.key);
                            return (
                              <div
                                key={feat.key}
                                onClick={() => {
                                  const current = licenseForm.restricted_features || [];
                                  const next = isBlocked
                                    ? current.filter((k) => k !== feat.key)
                                    : [...current, feat.key];
                                  setLicenseForm({ ...licenseForm, restricted_features: next });
                                }}
                                className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                                  isBlocked
                                    ? "bg-rose-50 border-rose-300 text-rose-950 font-bold shadow-xs"
                                    : "bg-slate-50 border-slate-200 text-slate-700 hover:border-teal-200"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`material-symbols-outlined text-base ${isBlocked ? "text-rose-600" : "text-slate-500"}`}>
                                    {isBlocked ? "lock" : feat.icon}
                                  </span>
                                  <span className="text-xs">{feat.label}</span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isBlocked}
                                  onChange={() => {}}
                                  className="rounded text-rose-600 focus:ring-rose-500"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Subscription & Billing Parameters */}
                      <div className="pt-4 border-t border-teal-50 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                            Monthly License Fee (PKR)
                          </label>
                          <input
                            type="number"
                            value={licenseForm.monthly_fee}
                            onChange={(e) => setLicenseForm({ ...licenseForm, monthly_fee: Number(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                            Next Payment Due Date
                          </label>
                          <input
                            type="date"
                            value={licenseForm.next_due_date}
                            onChange={(e) => setLicenseForm({ ...licenseForm, next_due_date: e.target.value })}
                            className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                            Grace Period Allowance (Days)
                          </label>
                          <input
                            type="number"
                            value={licenseForm.grace_days}
                            onChange={(e) => setLicenseForm({ ...licenseForm, grace_days: Number(e.target.value) || 10 })}
                            className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950"
                          />
                        </div>
                      </div>

                      {/* 4. Payment Details & Custom Announcement */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                            Developer Payment Accounts / Receiving Info
                          </label>
                          <input
                            type="text"
                            value={licenseForm.developer_bank_details}
                            onChange={(e) => setLicenseForm({ ...licenseForm, developer_bank_details: e.target.value })}
                            className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950 font-mono"
                            placeholder="JazzCash / EasyPaisa / Bank: 03142291356"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                            Custom Warning Notice (Urdu / English)
                          </label>
                          <input
                            type="text"
                            value={licenseForm.custom_notice}
                            onChange={(e) => setLicenseForm({ ...licenseForm, custom_notice: e.target.value })}
                            className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950"
                            placeholder="Optional custom reminder text shown in client header"
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-4 border-t border-teal-50 flex items-center justify-between flex-wrap gap-3">
                        <div className="text-xs text-slate-500 font-medium">
                          Status changes apply instantly across all devices and sync to VPS cloud.
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSavingLicense}
                            onClick={handleQuickRestore}
                            className="px-5 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs rounded-2xl border border-emerald-200 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-base text-emerald-700">task_alt</span>
                            <span>1-Click Mark as Paid &amp; Resume</span>
                          </button>

                          <button
                            type="submit"
                            disabled={isSavingLicense}
                            className="bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-black text-xs px-7 py-3 rounded-2xl transition-all shadow-lg shadow-teal-700/20 cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {isSavingLicense ? (
                              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                            ) : (
                              <span className="material-symbols-outlined text-base">save</span>
                            )}
                            <span>{isSavingLicense ? "Saving & Syncing..." : "Save License Policy"}</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                );
              })()}

          {/* ================================================================= */}
          {/* TAB 1: EXECUTIVE MULTI-GODOWN & CLINIC AUDITS (6-Mo / 1-Yr)       */}
          {/* ================================================================= */}
          {activeTab === "audits" && (
            <div className="space-y-6 animate-fade-in">
              {/* Filter Control Bar */}
              <div className="bg-white border border-teal-100 p-6 rounded-3xl space-y-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-teal-950 flex items-center gap-2">
                      <span className="material-symbols-outlined text-teal-700">query_stats</span>
                      Executive Financial &amp; Multi-Godown Audit
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      Periodic evaluation across {warehousesList.length} Godowns and Clinic OPD Revenue
                    </p>
                  </div>

                  {/* Audit Period Selector */}
                  <div className="w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <div className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-teal-100 min-w-full sm:min-w-0">
                      {[
                        { id: "30_days", label: "30 Days" },
                        { id: "6_months", label: "6 Months (حالیہ چھ ماہ)" },
                        { id: "1_year", label: "1 Year (سالانہ آڈٹ)" },
                        { id: "2_years", label: "2 Years (دو سالہ آڈٹ)" },
                        { id: "all_time", label: "All Time" },
                        { id: "custom", label: "Custom Range" },
                      ].map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setAuditRange(r.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            auditRange === r.id
                              ? "bg-teal-700 text-white shadow-md shadow-teal-700/20"
                              : "text-slate-600 hover:text-teal-950 hover:bg-slate-100"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Audit Export & Dispatch Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-teal-50 bg-teal-50/40 p-3.5 rounded-2xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-900">
                    <span className="material-symbols-outlined text-teal-700 text-base">ios_share</span>
                    <span>Audit Export &amp; Reporting Options:</span>
                  </div>

                  <div className="grid grid-cols-1 xs:grid-cols-3 sm:flex sm:flex-wrap items-center gap-2">
                    {/* Excel XLS File Export */}
                    <button
                      onClick={() => {
                        const godownScopeName = auditGodown === "all" 
                          ? "All Locations" 
                          : (warehousesList.find(w => w.id === auditGodown)?.name || "Store Counter");
                        
                        const periodLabel = auditRange === "30_days" ? "Last 30 Days" :
                          auditRange === "6_months" ? "Last 6 Months" :
                          auditRange === "1_year" ? "1 Year Audit" :
                          auditRange === "2_years" ? "2 Years Audit" :
                          auditRange === "all_time" ? "All Time History" : "Custom Range";

                        // Generate clean formatted Excel XML / HTML Spreadsheet
                        const excelHtml = `
                          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                            <head>
                              <meta charset="utf-8" />
                              <!--[if gte mso 9]>
                              <xml>
                                <x:ExcelWorkbook>
                                  <x:ExcelWorksheets>
                                    <x:ExcelWorksheet>
                                      <x:Name>Executive Audit Summary</x:Name>
                                      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                                    </x:ExcelWorksheet>
                                  </x:ExcelWorksheets>
                                </x:ExcelWorkbook>
                              </xml>
                              <![endif]-->
                              <style>
                                body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
                                table { border-collapse: collapse; width: 100%; }
                                th { background-color: #0f766e; color: #ffffff; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
                                td { padding: 6px 8px; border: 1px solid #e2e8f0; }
                                .header-cell { background-color: #f0fdfa; color: #134e4a; font-weight: bold; }
                                .number-cell { text-align: right; mso-number-format: "#,##0"; }
                                .title-row { font-size: 14pt; font-weight: bold; color: #0f766e; }
                              </style>
                            </head>
                            <body>
                              <table>
                                <tr><td colspan="6" class="title-row">${activeClinic?.name || "H/Dr.Asif Ashraf Khan Clinic"} - Executive Audit Statement</td></tr>
                                <tr><td colspan="6" style="color: #475569;">Period: ${periodLabel} (${auditDates.startDateStr} to ${auditDates.endDateStr}) | Godown Scope: ${godownScopeName}</td></tr>
                                <tr><td colspan="6">Generated On: ${new Date().toLocaleString("en-US")}</td></tr>
                                <tr><td colspan="6"></td></tr>

                                <!-- FINANCIAL KPI SUMMARY -->
                                <tr><th colspan="2">Financial Category</th><th colspan="2" style="text-align: right;">Amount (PKR)</th><th colspan="2">Notes</th></tr>
                                <tr><td colspan="2" class="header-cell">Total Clinic & Store Inflows</td><td colspan="2" class="number-cell" style="font-weight:bold; color:#059669;">${auditMetrics.totalInflows}</td><td colspan="2">OPD + POS + B2B Wholesale</td></tr>
                                <tr><td colspan="2">• OPD Doctor Fees</td><td colspan="2" class="number-cell">${auditMetrics.opdFeesTotal}</td><td colspan="2">Consultation revenue</td></tr>
                                <tr><td colspan="2">• Counter POS Pharmacy Sales</td><td colspan="2" class="number-cell">${auditMetrics.posSalesTotal}</td><td colspan="2">Cash desk sales</td></tr>
                                <tr><td colspan="2">• B2B Wholesale Godown Sales</td><td colspan="2" class="number-cell">${auditMetrics.b2bSalesTotal}</td><td colspan="2">Bulk distribution</td></tr>
                                <tr><td colspan="2" class="header-cell">Total Outflows & Purchases</td><td colspan="2" class="number-cell" style="font-weight:bold; color:#e11d48;">${auditMetrics.totalOutflows}</td><td colspan="2">GRN Bills + Expenses</td></tr>
                                <tr><td colspan="2">• Supplier Purchases (GRN)</td><td colspan="2" class="number-cell">${auditMetrics.supplierPurchasesCash}</td><td colspan="2">Inventory inward costs</td></tr>
                                <tr><td colspan="2">• Operational Expenses</td><td colspan="2" class="number-cell">${auditMetrics.expensesTotal}</td><td colspan="2">Bills, salaries, rent</td></tr>
                                <tr><td colspan="2" style="font-weight:bold; background-color:#ccfbf1;">Net Operating Surplus / Margin</td><td colspan="2" class="number-cell" style="font-weight:bold; color:#0f766e; background-color:#ccfbf1;">${auditMetrics.netOperatingSurplus}</td><td colspan="2" style="background-color:#ccfbf1;">${auditMetrics.netOperatingSurplus >= 0 ? "Net Profit" : "Operating Deficit"}</td></tr>
                                <tr><td colspan="2" class="header-cell">Total Godown Stock Valuation</td><td colspan="2" class="number-cell" style="font-weight:bold;">${auditMetrics.totalStockValuation}</td><td colspan="2">${auditMetrics.totalUnitsCount} Total Units in Stock</td></tr>
                                <tr><td colspan="6"></td></tr>

                                <!-- SKU BREAKDOWN TABLE -->
                                <tr>
                                  <th>SKU Item Code</th>
                                  <th>Medicine Name</th>
                                  <th>Manufacturer / Brand</th>
                                  <th style="text-align: center;">Godown Stock Qty</th>
                                  <th style="text-align: right;">Unit Cost Price (Rs.)</th>
                                  <th style="text-align: right;">Total Stock Valuation (Rs.)</th>
                                </tr>
                                ${filteredAuditInventory.map(i => {
                                  const cost = Number(i.cost_price_per_box || i.cost_price || 0);
                                  const qty = Number(i.warehouse_stock || i.stock_qty || 0);
                                  const val = qty * cost;
                                  return `
                                    <tr>
                                      <td>${i.item_code || "MED"}</td>
                                      <td style="font-weight: bold;">${i.medicine_name || ""}</td>
                                      <td>${i.company_name || ""}</td>
                                      <td style="text-align: center;">${qty}</td>
                                      <td class="number-cell">${cost}</td>
                                      <td class="number-cell" style="font-weight: bold;">${val}</td>
                                    </tr>
                                  `;
                                }).join("")}
                              </table>
                            </body>
                          </html>
                        `;

                        const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `Executive_Audit_${auditDates.startDateStr}_to_${auditDates.endDateStr}.xls`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showToast("📊 Professional Excel Audit File (.xls) downloaded!");
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      title="Download full audit with financial KPIs and stock matrix as Excel spreadsheet"
                    >
                      <span className="material-symbols-outlined text-base">table_view</span>
                      <span>Excel (.xls)</span>
                    </button>

                    {/* 80mm Low-Ink Thermal Slip Script */}
                    <button
                      onClick={() => {
                        const godownScopeName = auditGodown === "all" 
                          ? "All Locations (Godowns + Store)" 
                          : (warehousesList.find(w => w.id === auditGodown)?.name || "Store Counter");
                        
                        const periodLabel = auditRange === "30_days" ? "30 Days Audit" :
                          auditRange === "6_months" ? "6 Months Audit (حالیہ چھ ماہ)" :
                          auditRange === "1_year" ? "1 Year Audit (سالانہ آڈٹ)" :
                          auditRange === "2_years" ? "2 Years Audit (دو سالہ آڈٹ)" :
                          auditRange === "all_time" ? "All Time Audit" : "Custom Period Audit";

                        printExecutiveAuditReceipt({
                          periodLabel,
                          startDateStr: auditDates.startDateStr,
                          endDateStr: auditDates.endDateStr,
                          godownLabel: godownScopeName,
                          metrics: auditMetrics,
                          inventoryItems: filteredAuditInventory,
                        }, activeClinic);
                        showToast("🖨️ 80mm Thermal Audit Slip triggered!");
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      title="Print or share compact 80mm ESC/POS thermal script"
                    >
                      <span className="material-symbols-outlined text-base">receipt_long</span>
                      <span>80mm Thermal Slip</span>
                    </button>

                    {/* A4 / PDF Executive Document Template */}
                    <button
                      onClick={() => {
                        const godownScopeName = auditGodown === "all" 
                          ? "All Godowns & Store Locations Combined" 
                          : (warehousesList.find(w => w.id === auditGodown)?.name || "Store Counter");
                        
                        const periodLabel = auditRange === "30_days" ? "30 Days Executive Audit" :
                          auditRange === "6_months" ? "6 Months Executive Financial & Godown Audit" :
                          auditRange === "1_year" ? "1 Year Executive Annual Audit" :
                          auditRange === "2_years" ? "2 Years Executive Audit Statement" :
                          auditRange === "all_time" ? "Complete Historical Audit" : "Custom Period Audit Statement";

                        printExecutiveAuditDocument({
                          periodLabel,
                          startDateStr: auditDates.startDateStr,
                          endDateStr: auditDates.endDateStr,
                          godownLabel: godownScopeName,
                          metrics: auditMetrics,
                          inventoryItems: filteredAuditInventory,
                        }, activeClinic);
                        showToast("📄 A4 / PDF Audit Document opened for print & export!");
                      }}
                      className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-teal-700/20 transition-all cursor-pointer"
                      title="Generate official A4 / PDF statement with KPI cards, tables & signatures"
                    >
                      <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                      <span>PDF / A4 Statement</span>
                    </button>
                  </div>
                </div>

                {/* Godown Selection & Custom Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-teal-50">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Select Godown / Warehouse</label>
                    <select
                      value={auditGodown}
                      onChange={(e) => setAuditGodown(e.target.value)}
                      className="w-full bg-slate-50 border border-teal-200 text-teal-950 rounded-2xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-teal-600"
                    >
                      <option value="all">
                        🏢 All Locations Combined
                        {warehousesList.length > 0
                          ? ` (${warehousesList.map((w) => w.name).join(" + ")}${" + Store"})`
                          : ""}
                      </option>
                      {warehousesList.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          📍 {wh.name} ({wh.location || "Warehouse"})
                        </option>
                      ))}
                      {warehousesList.length > 0 && (
                        <option value="wh_str">🏬 Store Counter Godown</option>
                      )}
                    </select>
                  </div>

                  {auditRange === "custom" && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Audit Start Date</label>
                        <input
                          type="date"
                          value={auditCustomStart}
                          onChange={(e) => setAuditCustomStart(e.target.value)}
                          className="w-full bg-slate-50 border border-teal-200 text-teal-950 rounded-2xl px-3.5 py-2.5 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Audit End Date</label>
                        <input
                          type="date"
                          value={auditCustomEnd}
                          onChange={(e) => setAuditCustomEnd(e.target.value)}
                          className="w-full bg-slate-50 border border-teal-200 text-teal-950 rounded-2xl px-3.5 py-2.5 text-xs font-bold"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Bento Audit Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white border border-teal-200/90 p-4 sm:p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-[10px] sm:text-[11px] font-bold text-teal-800 uppercase tracking-wider">Total Godown Stock Valuation</div>
                  <div className="text-xl sm:text-2xl font-black text-teal-950 mt-1">
                    Rs. {Number(auditMetrics.totalStockValuation || 0).toLocaleString("en-US")}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-semibold truncate">
                    {Number(auditMetrics.totalUnitsCount || 0).toLocaleString("en-US")} Total Units in Selected Godowns
                  </div>
                </div>

                <div className="bg-white border border-emerald-200/90 p-4 sm:p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Total Clinic &amp; Store Inflows</div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">
                    Rs. {Number(auditMetrics.totalInflows || 0).toLocaleString("en-US")}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-semibold truncate">
                    OPD: Rs. {Number(auditMetrics.opdFeesTotal || 0).toLocaleString("en-US")} | B2B: Rs. {Number(auditMetrics.b2bSalesTotal || 0).toLocaleString("en-US")}
                  </div>
                </div>

                <div className="bg-white border border-rose-200/90 p-4 sm:p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-[10px] sm:text-[11px] font-bold text-rose-800 uppercase tracking-wider">Total Outflows &amp; Purchases</div>
                  <div className="text-xl sm:text-2xl font-black text-rose-950 mt-1">
                    Rs. {Number(auditMetrics.totalOutflows || 0).toLocaleString("en-US")}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-semibold truncate">
                    GRN: Rs. {Number(auditMetrics.supplierPurchasesCash || 0).toLocaleString("en-US")} | Exp: Rs. {Number(auditMetrics.expensesTotal || 0).toLocaleString("en-US")}
                  </div>
                </div>

                <div className="bg-white border border-purple-200/90 p-4 sm:p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-[10px] sm:text-[11px] font-bold text-purple-800 uppercase tracking-wider">Net Operating Margin</div>
                  <div className={`text-xl sm:text-2xl font-black mt-1 ${auditMetrics.netOperatingSurplus >= 0 ? "text-purple-950" : "text-rose-600"}`}>
                    Rs. {Number(auditMetrics.netOperatingSurplus || 0).toLocaleString("en-US")}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-semibold truncate">
                    {auditMetrics.netOperatingSurplus >= 0 ? "✅ Net Operational Profit" : "⚠️ Operating Deficit"}
                  </div>
                </div>
              </div>

              {/* Godown Item Breakdown Table */}
              <div className="bg-white border border-teal-100 rounded-3xl p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="font-black text-teal-950 text-base">Godown SKU Valuation &amp; Quantity Matrix</h4>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search SKU name, company..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="bg-slate-50 border border-teal-200 text-teal-950 rounded-2xl px-4 py-2 text-xs font-semibold w-full sm:w-64 focus:outline-none focus:border-teal-600"
                    />
                    <button
                      onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8," + 
                          ["Item Code,Medicine Name,Company,Godown Qty,Cost Price,Total Valuation"].join(",") + "\n" +
                          filteredAuditInventory.map(i => `"${i.item_code}","${i.medicine_name}","${i.company_name}",${i.warehouse_stock || 0},${i.cost_price_per_box || 0},${(i.warehouse_stock || 0) * (i.cost_price_per_box || 0)}`).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `Godown_Audit_${auditDates.startDateStr}_to_${auditDates.endDateStr}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        showToast("📊 Audit CSV Exported!");
                      }}
                      className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-bold rounded-2xl border border-teal-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <span className="material-symbols-outlined text-base text-teal-700">download</span>
                      Export CSV
                    </button>
                  </div>
                </div>

                <div className="border border-teal-100 rounded-2xl overflow-hidden max-h-96 overflow-y-auto overflow-x-auto w-full">
                  <table className="w-full text-left text-xs min-w-[550px]">
                    <thead className="bg-teal-50/80 text-teal-900 font-black uppercase tracking-wider sticky top-0 z-10 border-b border-teal-100">
                      <tr>
                        <th className="px-3.5 py-3">SKU Code</th>
                        <th className="px-3.5 py-3">Medicine Name</th>
                        <th className="px-3.5 py-3">Manufacturer Brand</th>
                        <th className="px-3.5 py-3 text-center">Godown Stock</th>
                        <th className="px-3.5 py-3 text-right">Unit Cost</th>
                        <th className="px-3.5 py-3 text-right">Stock Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-teal-50 font-medium">
                      {filteredAuditInventory.slice(0, 100).map((inv) => {
                        const cost = Number(inv.cost_price_per_box || inv.cost_price || 0);
                        const qty = Number(inv.warehouse_stock || inv.stock_qty || 0);
                        const val = qty * cost;
                        return (
                          <tr key={inv.id} className="hover:bg-teal-50/40 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-teal-800 font-bold">{inv.item_code || "MED"}</td>
                            <td className="px-4 py-2.5 font-bold text-teal-950">{inv.medicine_name}</td>
                            <td className="px-4 py-2.5 text-slate-600">{inv.company_name || "BM Pvt LTD"}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-teal-900">{qty} {inv.unit_label || "Packs"}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">Rs. {cost.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-black text-teal-950">Rs. {val.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB: GODOWNS & MULTI-WAREHOUSE MASTER PORTAL                      */}
          {/* ================================================================= */}
          {activeTab === "godowns" && (
            <div className="space-y-6 animate-fade-in">
              {/* Header Hero & Bento Stats */}
              <div className="bg-white border border-teal-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-teal-50 pb-6">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-black uppercase tracking-wider mb-2">
                      <span className="material-symbols-outlined text-sm">warehouse</span>
                      Central Storage &amp; Multi-Location Control Plane
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-teal-950 tracking-tight">
                      Godowns &amp; Multi-Warehouse Master Portal
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium max-w-2xl leading-relaxed">
                      Register and manage storage godowns, track exact stock breakdown per location, assign warehouse incharges, and monitor real-time multi-branch inventory valuations.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingGodown(null);
                        setGodownForm({
                          name: "",
                          code: `GDW-0${(warehousesList.filter(w => !w.is_store_counter).length + 1)}`,
                          location: "Hyderabad, Sindh",
                          incharge_name: "",
                          phone: "",
                          notes: "",
                          status: "active",
                          is_default: false,
                          is_store_counter: false,
                        });
                        setShowGodownModal(true);
                      }}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-teal-700/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">add_home_work</span>
                      <span>+ Register New Godown / Warehouse</span>
                    </button>

                    <Link
                      to="/store/warehouse"
                      className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      title="Open Warehouse Transfer & Internal Movements Desk"
                    >
                      <span className="material-symbols-outlined text-base text-teal-700">sync_alt</span>
                      <span>Stock Transfer Desk</span>
                    </Link>
                  </div>
                </div>

                {/* Bento KPI Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="bg-gradient-to-br from-teal-50 to-emerald-50/40 border border-teal-200/80 p-5 rounded-3xl">
                    <div className="flex items-center justify-between text-teal-800">
                      <span className="text-[11px] font-black uppercase tracking-wider">Total Godowns</span>
                      <span className="material-symbols-outlined text-xl">domain</span>
                    </div>
                    <div className="text-2xl font-black text-teal-950 mt-2">
                      {warehousesList.length} <span className="text-xs font-semibold text-teal-700">Locations</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-semibold">
                      {godownStats.activeCount} Active • {warehousesList.filter(w => w.is_store_counter).length} Counter Store
                    </div>
                  </div>

                  <div className="bg-white border border-teal-200/80 p-5 rounded-3xl shadow-xs">
                    <div className="flex items-center justify-between text-emerald-800">
                      <span className="text-[11px] font-black uppercase tracking-wider">Total Stock Valuation</span>
                      <span className="material-symbols-outlined text-xl">payments</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-950 mt-2">
                      Rs. {Number(godownStats.totalValuation || 0).toLocaleString("en-US")}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-semibold">
                      Across all {warehousesList.length} physical locations
                    </div>
                  </div>

                  <div className="bg-white border border-teal-200/80 p-5 rounded-3xl shadow-xs">
                    <div className="flex items-center justify-between text-teal-800">
                      <span className="text-[11px] font-black uppercase tracking-wider">Total Physical Inventory</span>
                      <span className="material-symbols-outlined text-xl">inventory_2</span>
                    </div>
                    <div className="text-2xl font-black text-teal-950 mt-2">
                      {Number(godownStats.totalUnits || 0).toLocaleString("en-US")} <span className="text-xs font-semibold text-slate-500">Units/Packs</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-semibold">
                      {inventoryList.length} Unique Medicine SKUs
                    </div>
                  </div>

                  <div className="bg-white border border-amber-200/80 p-5 rounded-3xl shadow-xs">
                    <div className="flex items-center justify-between text-amber-800">
                      <span className="text-[11px] font-black uppercase tracking-wider">Default Primary Godown</span>
                      <span className="material-symbols-outlined text-xl">star</span>
                    </div>
                    <div className="text-base font-black text-slate-900 mt-2 truncate">
                      {warehousesList.find(w => w.is_default)?.name || warehousesList.find(w => !w.is_store_counter)?.name || "Main Godown"}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-semibold">
                      Code: {warehousesList.find(w => w.is_default)?.code || "GDW-01"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Godown Cards Grid */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-teal-100 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-700">store</span>
                    <span className="text-sm font-black text-teal-950">Registered Storage Facilities &amp; Godowns</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search godown name, code, incharge..."
                      value={godownSearch}
                      onChange={(e) => setGodownSearch(e.target.value)}
                      className="bg-slate-50 border border-teal-200 rounded-2xl px-3.5 py-2 text-xs font-bold text-teal-950 focus:outline-none focus:border-teal-600 w-full sm:w-64"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {godownStats.warehouses
                    .filter((gd) => {
                      const q = (godownSearch || "").toLowerCase();
                      if (!q) return true;
                      return (
                        (gd.name || "").toLowerCase().includes(q) ||
                        (gd.code || "").toLowerCase().includes(q) ||
                        (gd.location || "").toLowerCase().includes(q) ||
                        (gd.incharge_name || "").toLowerCase().includes(q)
                      );
                    })
                    .map((gd) => {
                      const isSelected = selectedGodownForStock === gd.id;
                      return (
                        <div
                          key={gd.id}
                          className={`bg-white rounded-3xl border transition-all duration-200 p-5 space-y-4 shadow-sm hover:shadow-md ${
                            isSelected
                              ? "border-teal-600 ring-2 ring-teal-500/20 bg-teal-50/10"
                              : gd.is_default
                              ? "border-teal-300 ring-1 ring-teal-200"
                              : "border-teal-100"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 ${
                                  gd.is_store_counter
                                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                    : "bg-teal-50 border border-teal-200 text-teal-700"
                                }`}
                              >
                                <span className="material-symbols-outlined text-2xl">
                                  {gd.is_store_counter ? "storefront" : "warehouse"}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-black text-slate-900 text-sm leading-tight truncate">{gd.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                                    {gd.code || gd.id}
                                  </span>
                                  {gd.is_default && (
                                    <span className="text-[9px] font-black bg-teal-700 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                                      PRIMARY
                                    </span>
                                  )}
                                  {gd.is_store_counter && (
                                    <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md uppercase">
                                      POS Counter
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider shrink-0 ${
                                gd.status === "active"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {gd.status || "active"}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 font-medium">Incharge Custodian:</span>
                              <span className="font-bold text-teal-950">{gd.incharge_name || "Central Team"}</span>
                            </div>
                            {gd.phone && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-medium">Contact Phone:</span>
                                <a href={`tel:${gd.phone}`} className="font-mono font-bold text-teal-700 hover:underline">
                                  {gd.phone}
                                </a>
                              </div>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 font-medium">Physical Location:</span>
                              <span className="font-semibold text-slate-800 truncate max-w-[170px]" title={gd.location}>
                                {gd.location || "Hyderabad, Sindh"}
                              </span>
                            </div>
                            <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                              <span className="text-slate-400 font-medium">Stock SKUs / Units:</span>
                              <span className="font-black text-teal-800">
                                {gd.skuCount} SKUs ({Number(gd.unitsCount || 0).toLocaleString("en-US")} Units)
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 font-medium">Estimated Value:</span>
                              <span className="font-black text-emerald-800 text-sm">
                                Rs. {Number(gd.valuation || 0).toLocaleString("en-US")}
                              </span>
                            </div>
                          </div>

                          {gd.notes && (
                            <p className="text-[11px] text-slate-500 italic bg-amber-50/60 border border-amber-100 p-2 rounded-xl">
                              📝 {gd.notes}
                            </p>
                          )}

                          {/* Card Action Buttons */}
                          <div className="pt-2 border-t border-teal-50 flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                setSelectedGodownForStock(isSelected ? null : gd.id);
                                setGodownStockSearch("");
                                setGodownCompanyFilter("all");
                              }}
                              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-teal-800 text-white shadow-md shadow-teal-900/20"
                                  : "bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200"
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {isSelected ? "visibility_off" : "inventory"}
                              </span>
                              <span>{isSelected ? "Hide Stock" : "Inspect Live Stock"}</span>
                            </button>

                            <button
                              onClick={() => {
                                setEditingGodown(gd);
                                setGodownForm({
                                  name: gd.name || "",
                                  code: gd.code || "",
                                  location: gd.location || "",
                                  incharge_name: gd.incharge_name || "",
                                  phone: gd.phone || "",
                                  notes: gd.notes || "",
                                  status: gd.status || "active",
                                  is_default: Boolean(gd.is_default),
                                  is_store_counter: Boolean(gd.is_store_counter),
                                });
                                setShowGodownModal(true);
                              }}
                              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="Edit Godown Details"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>

                            {!gd.is_default && !gd.is_store_counter && (
                              <button
                                onClick={() => handleSetDefaultGodown(gd.id)}
                                className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                                title="Set as Default Primary Godown"
                              >
                                <span className="material-symbols-outlined text-sm">star</span>
                              </button>
                            )}

                            {!gd.is_store_counter && !gd.is_default && (
                              <button
                                onClick={() => handleDeleteGodown(gd.id, gd.name)}
                                className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                                title="Delete Godown"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Drill-down: Live Stock Inspector for Selected Godown */}
              {selectedGodownForStock && (() => {
                const currentGd = warehousesList.find(w => w.id === selectedGodownForStock) || { name: "Godown", code: "GDW" };
                const currentVal = dbWarehouses.getStockValuation(selectedGodownForStock);
                return (
                  <div className="bg-white border-2 border-teal-600/30 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl animate-fade-in">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-teal-100 pb-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider bg-teal-100 text-teal-800 px-3 py-1 rounded-full border border-teal-200">
                            Active Stock Inspector
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-500">
                            ID: {selectedGodownForStock}
                          </span>
                        </div>
                        <h4 className="text-xl font-black text-teal-950 mt-2 flex items-center gap-2">
                          <span className="material-symbols-outlined text-teal-700">inventory_2</span>
                          Stock Inventory in: <span className="text-teal-700">{currentGd.name}</span> ({currentGd.code})
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          Showing live stock count, unit purchase costs, and real-time total valuation for this physical location.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-teal-50 border border-teal-200 px-4 py-2 rounded-2xl text-right">
                          <div className="text-[10px] font-bold text-teal-700 uppercase">Location Valuation</div>
                          <div className="text-base font-black text-teal-950 font-mono">
                            Rs. {Number(currentVal.totalValue || 0).toLocaleString("en-US")}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const csvContent = "data:text/csv;charset=utf-8," + 
                              ["Item Code,Medicine Name,Company,Formula,Location Stock,Unit Cost Price,Total Valuation,Unit Sale Price"].join(",") + "\n" +
                              currentGodownStockItems.map(i => `"${i.item_code}","${i.medicine_name}","${i.company_name || ''}","${i.generic_name || ''}",${i.locationQty},${i.unitCost},${i.locationValuation},${i.unitSale}`).join("\n");
                            const encodedUri = encodeURI(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute("download", `Stock_Report_${currentGd.code}_${new Date().toISOString().split("T")[0]}.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            showToast(`📊 Exported stock report for ${currentGd.name}!`);
                          }}
                          className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base text-emerald-700">download</span>
                          Export Location CSV
                        </button>

                        <button
                          onClick={() => setSelectedGodownForStock(null)}
                          className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="Close Stock Inspector"
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      </div>
                    </div>

                    {/* Search and Company Filter */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 relative">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                          search
                        </span>
                        <input
                          type="text"
                          placeholder="Search medicine name, item code, formula..."
                          value={godownStockSearch}
                          onChange={(e) => setGodownStockSearch(e.target.value)}
                          className="w-full bg-slate-50 border border-teal-200 text-teal-950 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold focus:outline-none focus:border-teal-600 focus:bg-white"
                        />
                      </div>

                      <div>
                        <select
                          value={godownCompanyFilter}
                          onChange={(e) => setGodownCompanyFilter(e.target.value)}
                          className="w-full bg-slate-50 border border-teal-200 text-teal-950 rounded-2xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-teal-600"
                        >
                          <option value="all">🏢 All Manufacturing Brands</option>
                          {godownCompanyOptions.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Stock Table */}
                    <div className="border border-teal-100 rounded-2xl overflow-hidden max-h-96 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[700px]">
                        <thead className="bg-teal-50/90 text-teal-950 font-black uppercase tracking-wider sticky top-0 z-10 border-b border-teal-200">
                          <tr>
                            <th className="px-4 py-3">Item Code</th>
                            <th className="px-4 py-3">Medicine &amp; Formula</th>
                            <th className="px-4 py-3">Company Brand</th>
                            <th className="px-4 py-3 text-center">Stock in Godown</th>
                            <th className="px-4 py-3 text-right">Cost Price</th>
                            <th className="px-4 py-3 text-right">Valuation</th>
                            <th className="px-4 py-3 text-right">Sale Price</th>
                            <th className="px-4 py-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-teal-50 font-medium">
                          {currentGodownStockItems.map((item) => {
                            const isLowStock = item.locationQty <= (item.min_reorder_level || 5);
                            return (
                              <tr key={item.id} className="hover:bg-teal-50/40 transition-colors">
                                <td className="px-4 py-3 font-mono font-bold text-teal-800">{item.item_code || "MED"}</td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-teal-950">{item.medicine_name}</div>
                                  {item.generic_name && (
                                    <div className="text-[10px] text-slate-400 italic">{item.generic_name}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-700">{item.company_name || "BM Pvt LTD"}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2.5 py-1 rounded-full font-black text-xs ${
                                    item.locationQty > 0
                                      ? "bg-teal-100 text-teal-950"
                                      : "bg-rose-100 text-rose-800"
                                  }`}>
                                    {item.locationQty} {item.unit_label || "Units"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-slate-600">
                                  Rs. {item.unitCost.toLocaleString("en-US")}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-black text-teal-950">
                                  Rs. {item.locationValuation.toLocaleString("en-US")}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                                  Rs. {item.unitSale.toLocaleString("en-US")}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {isLowStock ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                                      Low Stock
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                      Healthy
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {currentGodownStockItems.length === 0 && (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl block mb-2 text-slate-300">inventory_2</span>
                                No medicines found matching filter in this godown.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB: THERMAL RECEIPT STUDIO & CUSTOMIZER                          */}
          {/* ================================================================= */}
          {activeTab === "receipt_studio" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />
                <div className="relative z-10 max-w-2xl space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-700/60 border border-teal-500/30 text-teal-200 text-xs font-bold">
                    <span className="material-symbols-outlined text-sm">palette</span>
                    Universal Thermal Print Engine Synchronizer
                  </div>
                  <h3 className="text-2xl font-black tracking-tight text-white">
                    80mm Thermal Receipt Studio &amp; Customizer
                  </h3>
                  <p className="text-sm text-teal-100/80 leading-relaxed font-medium">
                    Customize clinic logos, titles, taglines, phone/address lines, doctor info, paper width, and block drag-and-drop order. All changes made in the Studio dynamically reflect across Counter POS, OPD Tokens, Wholesale Invoices, GRN Vouchers, and Day-End statements.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <Link
                      to="/receipt-studio"
                      className="px-6 py-3 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-teal-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined">launch</span>
                      Open Fullscreen Receipt Studio
                    </Link>
                    <button
                      onClick={() => {
                        const win = window.open("/receipt-studio", "_blank");
                        if (win) win.focus();
                      }}
                      className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all border border-white/20 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined">open_in_new</span>
                      Open in New Tab
                    </button>
                  </div>
                </div>
              </div>

              {/* Feature Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-teal-100 p-5 rounded-3xl shadow-sm space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined">drag_indicator</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Drag &amp; Drop Block Order</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Re-order receipt sections (Logo, Meta Info, Customer, Doctor, Items Table, Totals, Urdu Terms) with instant live preview.
                  </p>
                </div>

                <div className="bg-white border border-teal-100 p-5 rounded-3xl shadow-sm space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined">verified</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Permanent Verified Branding</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Mandatory CliniCore Software and developer contact watermark (<span className="font-mono font-bold text-teal-800">0314-2291356</span>) locked across all prints.
                  </p>
                </div>

                <div className="bg-white border border-teal-100 p-5 rounded-3xl shadow-sm space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined">crop</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Auto-Crop Logo Scanner</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Canvas pixel boundary scanner automatically trims whitespace padding to eliminate paper roll and ink bloat.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: STAFF & DOCTOR MASTER ACCESS (Password Reset, Add, Delete) */}
          {/* ================================================================= */}
          {activeTab === "staff" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white border border-teal-100 p-6 rounded-3xl flex items-center justify-between shadow-sm">
                <div>
                  <h3 className="text-lg font-black text-teal-950 flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-700">badge</span>
                    Doctor &amp; Staff Master Access Directory
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Direct password resets, permission control, and doctor profile management
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setShowAddStaffModal(true);
                  }}
                  className="bg-gradient-to-r from-teal-700 to-teal-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs hover:from-teal-800 hover:to-teal-700 transition-all flex items-center gap-1.5 shadow-lg shadow-teal-700/20 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">person_add</span>
                  Add Doctor / Staff
                </button>
              </div>

              {/* Users Table */}
              <div className="bg-white border border-teal-100 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-teal-50/80 text-teal-900 font-black uppercase tracking-wider border-b border-teal-100">
                    <tr>
                      <th className="px-5 py-3.5">Staff Name</th>
                      <th className="px-5 py-3.5">Role</th>
                      <th className="px-5 py-3.5">Room / Dept</th>
                      <th className="px-5 py-3.5">Email &amp; Phone</th>
                      <th className="px-5 py-3.5">Fee / Financials</th>
                      <th className="px-5 py-3.5 text-right whitespace-nowrap">Master Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-50 font-medium">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-teal-50/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-teal-950 flex items-center gap-2">
                            {u.name}
                            {u.is_owner && (
                              <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                                PRINCIPAL OWNER
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">{u.specialization || "Clinic Staff"}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-3 py-1 rounded-xl text-[11px] font-black capitalize ${
                            u.role === "doctor"
                              ? "bg-teal-100 text-teal-900 border border-teal-200"
                              : u.role === "warehouse"
                              ? "bg-purple-100 text-purple-900 border border-purple-200"
                              : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-teal-950 font-bold">{u.room_number || "Counter"}</td>
                        <td className="px-5 py-3.5">
                          <div className="text-teal-950 font-semibold">{u.email}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{u.phone || "No phone"}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1">
                            {u.role === "doctor" && (
                              <span className="font-bold text-teal-800 font-mono text-xs">Fee: Rs. {u.consultation_fee || 300}</span>
                            )}
                            {u.is_owner ? (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 w-fit">
                                👑 Owner (Full Access)
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedVal = !u.can_view_financials;
                                  dbUsers.update(u.id, { can_view_financials: updatedVal });
                                  setUsersList(dbUsers.getAll());
                                  showToast(`${u.name}: Financial revenue access ${updatedVal ? "ENABLED" : "REVOKED"}`);
                                }}
                                className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-xl border transition-all cursor-pointer w-fit active:scale-95 ${
                                  u.can_view_financials
                                    ? "bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200 shadow-2xs"
                                    : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                                }`}
                                title="Click to toggle financial revenue access for this account"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {u.can_view_financials ? "visibility" : "visibility_off"}
                                </span>
                                <span>{u.can_view_financials ? "Financials: ON" : "Financials: OFF"}</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            {u.role === "doctor" && !u.is_owner && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Designate "${u.name}" as the Principal / Primary Doctor (Owner)?`)) {
                                    dbUsers.setPrincipalDoctor(u.id);
                                    setUsersList(dbUsers.getAll());
                                  }
                                }}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                                title="Make this Doctor the Primary Clinic Owner"
                              >
                                <span className="material-symbols-outlined text-sm text-emerald-700">stars</span>
                                Make Primary
                              </button>
                            )}
                            {u.is_owner && (
                              <span className="bg-amber-100 text-amber-950 font-black px-2.5 py-1 rounded-xl text-[10.5px] border border-amber-300 flex items-center gap-1">
                                ⭐ Primary Doctor
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setResetPasswordModalUser(u);
                                setNewPasswordInput("");
                              }}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                              title="Direct Password Reset"
                            >
                              <span className="material-symbols-outlined text-sm">key</span>
                              Reset Pass
                            </button>
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setStaffForm({
                                  name: u.name,
                                  role: u.role || "doctor",
                                  email: u.email || "",
                                  phone: u.phone || "",
                                  password: "",
                                  specialization: u.specialization || "",
                                  room_number: u.room_number || "Room 1",
                                  consultation_fee: u.consultation_fee || 300,
                                  can_view_financials: Boolean(u.can_view_financials),
                                  is_owner: Boolean(u.is_owner),
                                  availability_status: u.availability_status || "available",
                                });
                                setShowAddStaffModal(true);
                              }}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: CLINIC IDENTITY & PUBLIC SITE CMS                          */}
          {/* ================================================================= */}
          {activeTab === "clinic" && (
            <form onSubmit={handleSaveClinicSettings} className="bg-white border border-teal-100 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm animate-fade-in max-w-4xl mx-auto">
              <div className="border-b border-teal-50 pb-4">
                <h3 className="text-lg font-black text-teal-950 flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-700">domain</span>
                  Master Clinic Branding &amp; Public Website CMS
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Controls landing page hero, doctors directory, thermal receipt headers, and public portal identity
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    Full Clinic &amp; Wholesale Store Name
                  </label>
                  <input
                    type="text"
                    required
                    value={clinicForm.name}
                    onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    Clinic Tagline / Slogan
                  </label>
                  <input
                    type="text"
                    value={clinicForm.tagline || ""}
                    onChange={(e) => setClinicForm({ ...clinicForm, tagline: e.target.value })}
                    placeholder="e.g. Specialized Homeopathic Healthcare & Certified Medicine Store"
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-semibold text-teal-950"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    Public Website Hero Main Title
                  </label>
                  <input
                    type="text"
                    value={clinicForm.hero_title || ""}
                    onChange={(e) => setClinicForm({ ...clinicForm, hero_title: e.target.value })}
                    placeholder="e.g. Specialized Homeopathic Healthcare & Family OPD Clinic in Hyderabad"
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    Public Website Hero Subtitle &amp; Description
                  </label>
                  <textarea
                    rows={2}
                    value={clinicForm.hero_description || ""}
                    onChange={(e) => setClinicForm({ ...clinicForm, hero_description: e.target.value })}
                    placeholder="Brief description for prospective patients visiting the clinic website..."
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-semibold text-teal-950"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    Official Address (City &amp; Street)
                  </label>
                  <input
                    type="text"
                    required
                    value={clinicForm.address}
                    onChange={(e) => setClinicForm({ ...clinicForm, address: e.target.value })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    Official Phone / Mobile
                  </label>
                  <input
                    type="text"
                    value={clinicForm.phone}
                    onChange={(e) => setClinicForm({ ...clinicForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    WhatsApp Inquiry Number
                  </label>
                  <input
                    type="text"
                    value={clinicForm.whatsapp || clinicForm.phone || ""}
                    onChange={(e) => setClinicForm({ ...clinicForm, whatsapp: e.target.value })}
                    placeholder="923142291356"
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    OPD Chamber &amp; Pharmacy Working Hours / Timings
                  </label>
                  <input
                    type="text"
                    value={clinicForm.timings || ""}
                    onChange={(e) => setClinicForm({ ...clinicForm, timings: e.target.value })}
                    placeholder="e.g. Monday – Saturday: 10:00 AM – 10:00 PM | Sunday: 11:00 AM – 4:00 PM"
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-semibold text-teal-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    Default Consultation Fee (Rs.)
                  </label>
                  <input
                    type="number"
                    value={clinicForm.default_consultation_fee}
                    onChange={(e) => setClinicForm({ ...clinicForm, default_consultation_fee: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    Chamber Live Status
                  </label>
                  <select
                    value={clinicForm.clinic_status || "open"}
                    onChange={(e) => setClinicForm({ ...clinicForm, clinic_status: e.target.value })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950"
                  >
                    <option value="open">🟢 Open for OPD Consultation &amp; Pharmacy</option>
                    <option value="closed">🔴 Closed Today</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    Public Notice Banner (Top of Website &amp; TV Screens)
                  </label>
                  <textarea
                    rows={2}
                    value={clinicForm.public_notice}
                    onChange={(e) => setClinicForm({ ...clinicForm, public_notice: e.target.value })}
                    placeholder="Leave blank if no special announcement..."
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-semibold text-teal-950"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-teal-50 flex justify-end">
                <button
                  type="submit"
                  className="bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-black text-xs px-7 py-3 rounded-2xl transition-all shadow-lg shadow-teal-700/20 cursor-pointer"
                >
                  Save Master Clinic &amp; Website CMS
                </button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* TAB 4: AUTOMATED BACKGROUND SERVICES & RESEND EMAIL API           */}
          {/* ================================================================= */}
          {activeTab === "apis" && (
            <form onSubmit={handleSaveClinicSettings} className="bg-white border border-teal-100 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm animate-fade-in max-w-4xl mx-auto">
              <div className="border-b border-teal-50 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-teal-950 flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-700">mark_email_read</span>
                    Automated Background Services &amp; Resend Email API
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Configure Resend email credentials for scheduled daily closing, encrypted .cfbak database vaults, and manual backup dispatches
                  </p>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Gateway Active
                  </span>
                </div>
              </div>

              {/* API Credentials Grid */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    Resend API Key (re_xxxx)
                  </label>
                  <input
                    type="password"
                    placeholder="re_123456789_abcdef..."
                    value={clinicForm.resend_api_key}
                    onChange={(e) => setClinicForm({ ...clinicForm, resend_api_key: e.target.value })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-mono font-bold text-teal-900"
                  />
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 font-medium">
                    <span>Relayed through VPS backend (<code className="text-teal-800 font-bold">api.clinicore.me</code>)</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">verified</span>
                      <span>Verified Domain: <strong>backup@clinicore.me</strong></span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                      Notification Recipient Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. drasifhosting@gmail.com"
                      value={clinicForm.notification_email}
                      onChange={(e) => setClinicForm({ ...clinicForm, notification_email: e.target.value })}
                      className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Automated Report Frequency</span>
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">Live Active</span>
                    </label>
                    <select
                      value={selectedFreqType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedFreqType(val);
                        let nextFreq = val;
                        if (val === "custom_time") {
                          nextFreq = `custom_time:${customTimeInput}`;
                        } else if (val === "custom_interval") {
                          nextFreq = `custom_interval:${customIntervalInput}`;
                        }
                        setClinicForm((prev) => ({ ...prev, report_frequency: nextFreq }));
                        try {
                          localStorage.setItem("cf_report_frequency", nextFreq);
                        } catch {}
                      }}
                      className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950 cursor-pointer shadow-inner"
                    >
                      <option value="every_1m" className="text-amber-700 font-bold bg-amber-50">🧪 Testing Mode: Every 1 Minute (Live Automation Verification)</option>
                      <option value="custom_time">⚙️ Custom Daily Clock Time...</option>
                      <option value="custom_interval">⚙️ Custom Minute Interval...</option>
                      <option value="daily_9pm">🌙 Daily at 9:00 PM (Shift End Closure - Recommended)</option>
                      <option value="daily_10pm">🌙 Daily at 10:00 PM (Late Night Closure)</option>
                      <option value="daily_8pm">🌙 Daily at 8:00 PM (Evening Shift Closure)</option>
                      <option value="every_12h">⏱️ Every 12 Hours (Twice Daily Audit)</option>
                      <option value="every_6h">⏱️ Every 6 Hours (High Volume Audit)</option>
                      <option value="hourly">⚡ Every 1 Hour (Real-Time Background Sync)</option>
                      <option value="weekly_saturday">📅 Weekly on Saturday (Weekly Summary)</option>
                      <option value="monthly">📊 Monthly Executive Report</option>
                      <option value="manual">🚫 Manual On-Demand Only (Off)</option>
                    </select>

                    {/* Custom Clock Time Input */}
                    {selectedFreqType === "custom_time" && (
                      <div className="mt-2.5 space-y-1 animate-fade-in">
                        <label className="block text-[10px] font-bold text-teal-900 uppercase">Set Custom Daily Time (24h format)</label>
                        <input
                          type="time"
                          value={customTimeInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomTimeInput(val);
                            const nextFreq = `custom_time:${val}`;
                            setClinicForm((prev) => ({ ...prev, report_frequency: nextFreq }));
                            try {
                              localStorage.setItem("cf_report_frequency", nextFreq);
                            } catch {}
                          }}
                          className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-teal-950 font-mono shadow-inner"
                        />
                      </div>
                    )}

                    {/* Custom Interval Input */}
                    {selectedFreqType === "custom_interval" && (
                      <div className="mt-2.5 space-y-1 animate-fade-in">
                        <label className="block text-[10px] font-bold text-teal-900 uppercase">Set Custom Interval (in Minutes)</label>
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          value={customIntervalInput}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 15;
                            setCustomIntervalInput(val);
                            const nextFreq = `custom_interval:${val}`;
                            setClinicForm((prev) => ({ ...prev, report_frequency: nextFreq }));
                            try {
                              localStorage.setItem("cf_report_frequency", nextFreq);
                            } catch {}
                          }}
                          className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-teal-950 font-mono shadow-inner"
                        />
                      </div>
                    )}

                    {/* Countdown Display Alert Badge */}
                    {countdownDetail && countdownDetail.secondsLeft !== null && (
                      <div className="mt-3 p-3 bg-gradient-to-r from-teal-950 to-teal-900 border border-teal-800 rounded-2xl flex items-center justify-between text-white shadow-md shadow-teal-950/20">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-teal-300">Next Auto-Email:</span>
                        </div>
                        <span className="text-xs font-black font-mono text-emerald-400 bg-teal-900/60 px-2 py-0.5 rounded-md border border-teal-800">
                          {(() => {
                            const sec = countdownDetail.secondsLeft;
                            if (sec === null || sec === undefined) return "Calculating...";
                            if (sec <= 0) return "Triggering now...";
                            const h = Math.floor(sec / 3600);
                            const m = Math.floor((sec % 3600) / 60);
                            const s = sec % 60;
                            if (h > 0) return `${h}h ${m}m ${s}s`;
                            if (m > 0) return `${m}m ${s}s`;
                            return `${s}s`;
                          })()}
                        </span>
                      </div>
                    )}

                    {/* Live Automation Execution Logs */}
                    {automationLogs.length > 0 && (
                      <div className="mt-3 bg-white border border-teal-100 rounded-2xl p-3 shadow-sm space-y-2 max-h-[200px] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-teal-50 pb-1.5">
                          <span className="text-[10px] font-black uppercase text-teal-900 tracking-wider">Live Execution Logs (Real-time)</span>
                          <button 
                            type="button" 
                            onClick={() => {
                              localStorage.removeItem("cf_automation_execution_logs");
                              setAutomationLogs([]);
                            }}
                            className="text-[9px] font-bold text-red-500 hover:text-red-700 bg-red-50 px-1.5 py-0.5 rounded"
                          >
                            Clear Logs
                          </button>
                        </div>
                        <div className="space-y-1.5 text-[9px] font-medium font-mono">
                          {automationLogs.map((log, idx) => (
                            <div key={idx} className="flex flex-col gap-0.5 border-b border-slate-50 pb-1 last:border-0">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                <span className={`px-1 rounded font-bold uppercase ${
                                  log.status === "success" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                  log.status === "failed" ? "bg-red-50 text-red-600 border border-red-100" :
                                  "bg-amber-50 text-amber-600 border border-amber-100 animate-pulse"
                                }`}>
                                  {log.status}
                                </span>
                              </div>
                              <div className="text-slate-900 font-bold">{log.reason}</div>
                              <div className="text-slate-600 whitespace-pre-wrap">{log.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                    WhatsApp Cloud Gateway Phone No
                  </label>
                  <input
                    type="text"
                    value={clinicForm.whatsapp_gateway_no}
                    onChange={(e) => setClinicForm({ ...clinicForm, whatsapp_gateway_no: e.target.value })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-teal-950 font-mono"
                  />
                </div>
              </div>

              {/* Manual Backup Dispatch Card */}
              <div className="bg-gradient-to-r from-teal-50 via-emerald-50/50 to-teal-50/30 border border-teal-200/80 rounded-3xl p-5 space-y-3.5 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-800 text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-900/20">
                    <span className="material-symbols-outlined text-xl">enhanced_encryption</span>
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-teal-950">
                      Manual On-Demand Backup Email Dispatch
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium mt-0.5">
                      Instantly compile your live database vault, generate a tamper-proof <strong>.cfbak</strong> encrypted backup attachment, format the signature clinical email report matching our web app theme, and deliver directly to <strong>{clinicForm.notification_email || "your inbox"}</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {/* Primary Manual Dispatch Button */}
                  <button
                    type="button"
                    disabled={isDispatchingBackup}
                    onClick={handleManualBackupEmailDispatch}
                    className="px-5 py-3 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 hover:from-emerald-800 hover:to-teal-800 text-white font-black text-xs rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-800/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isDispatchingBackup ? (
                      <>
                        <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                        <span>Compiling &amp; Dispatching .cfbak...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">outgoing_mail</span>
                        <span>Send Real Backup Email (.cfbak Attached)</span>
                      </>
                    )}
                  </button>

                  {/* Direct Local Download Button */}
                  <button
                    type="button"
                    onClick={() => {
                      exportFullDatabase(false);
                      showToast("💾 CliniCore Encrypted .cfbak file downloaded to your computer!");
                    }}
                    className="px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold text-xs rounded-2xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Download a local encrypted copy directly to your Downloads folder"
                  >
                    <span className="material-symbols-outlined text-base text-emerald-700">download</span>
                    <span>Download .cfbak Locally</span>
                  </button>

                  {/* Preview Template Modal Trigger */}
                  <button
                    type="button"
                    onClick={handleOpenEmailPreview}
                    className="px-4 py-3 bg-white border border-teal-300 hover:bg-teal-50 text-teal-950 font-bold text-xs rounded-2xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base text-teal-700">preview</span>
                    <span>Preview Email Template</span>
                  </button>

                  {/* Connectivity Ping Button */}
                  <button
                    type="button"
                    disabled={isPingingApi}
                    onClick={handleTestPingEmail}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {isPingingApi ? (
                      <>
                        <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                        <span>Pinging...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base text-slate-600">sensors</span>
                        <span>Quick Ping Test</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Bottom Action Row */}
              <div className="pt-4 border-t border-teal-50 flex items-center justify-end">
                <button
                  type="submit"
                  className="bg-gradient-to-r from-teal-800 to-teal-700 hover:from-teal-900 hover:to-teal-800 text-white font-black text-xs px-7 py-3 rounded-2xl transition-all shadow-lg shadow-teal-800/20 cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  Save API &amp; Automation Config
                </button>
              </div>
            </form>
          )}




          {/* ================================================================= */}
          {/* TAB 6: BACKUP, RESTORE & DATA MODES                               */}
          {/* ================================================================= */}
          {activeTab === "backups" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in max-w-4xl mx-auto">
              {/* Backup Box */}
              <div className="bg-white border border-teal-100 rounded-3xl p-6 space-y-4 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold border border-teal-200">
                  <span className="material-symbols-outlined text-2xl">enhanced_encryption</span>
                </div>
                <h4 className="font-black text-teal-950 text-base">Export Encrypted Backup (.cfbak)</h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Download a secure, encrypted software backup file (<strong>.cfbak</strong>) containing all clinic records, accounts, sales, purchases, and stock ledger with tamper protection.
                </p>
                <button
                  onClick={handleExportBackup}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-black text-xs py-3.5 rounded-2xl transition-colors shadow-lg shadow-teal-700/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">lock</span>
                  Download .cfbak Encrypted Backup
                </button>
              </div>

              {/* Restore Box */}
              <div className="bg-white border border-teal-100 rounded-3xl p-6 space-y-4 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold border border-purple-200">
                  <span className="material-symbols-outlined text-2xl">upload</span>
                </div>
                <h4 className="font-black text-teal-950 text-base">Restore Encrypted .cfbak / .json</h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Upload a software backup file (<strong>.cfbak</strong> or legacy .json) to restore records or migrate onto a new computer.
                </p>
                <label className="w-full bg-purple-700 hover:bg-purple-800 text-white font-black text-xs py-3.5 rounded-2xl transition-colors shadow-lg shadow-purple-700/20 flex items-center justify-center gap-1.5 cursor-pointer">
                  <span className="material-symbols-outlined text-base">restore</span>
                  Upload &amp; Restore .cfbak File
                  <input type="file" accept=".cfbak,.json" onChange={handleImportBackup} className="hidden" />
                </label>
              </div>

              {/* Database Modes */}
              <div className="md:col-span-2 bg-white border border-teal-100 rounded-3xl p-6 space-y-4 shadow-sm">
                <h4 className="font-black text-teal-950 text-base flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-700">database</span>
                  Database Setup &amp; Clean Mode (0 Transactions)
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Start completely fresh by wiping all mock transactions while preserving your Clinic Profile and 500+ Item Medicine Catalog.
                </p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={async () => {
                      const passcode = prompt("⚠️ WARNING: This will permanently wipe ALL transactional data (Patients, Sales, Bills, CashBook, Purchases, etc.) from BOTH the VPS database and your local browser storage!\n\nThis action cannot be undone.\n\nEnter your Super Admin Master Passcode to confirm:");
                      if (!passcode) return;

                      try {
                        const apiUrl = DEFAULT_API_URL;
                        const res = await fetch(`${apiUrl}/api/v1/system/factory-reset`, {
                          method: "POST",
                          headers: { 
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${localStorage.getItem("cf_vps_jwt") || ""}`
                          },
                          body: JSON.stringify({ passcode }),
                        });

                        const data = await res.json().catch(() => null);

                        if (res.ok && data?.success) {
                          // Wipe local cache
                          const { factoryResetAllData } = await import("../api/db.js");
                          factoryResetAllData();
                          alert("🎉 SUCCESS: Entire database (VPS + Local Storage) has been permanently wiped clean!\n\nSystem will now reload.");
                          window.location.reload();
                        } else {
                          alert("❌ Factory Reset Denied: " + (data?.error?.message || "Incorrect passcode or connection failed."));
                        }
                      } catch (err) {
                        alert("❌ System Error during reset: " + err.message);
                      }
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-5 py-3 rounded-2xl font-black text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-red-600">delete_forever</span>
                    Wipe Entire App Data (VPS + Local Reset)
                  </button>

                  <button
                    onClick={() => {
                      if (confirm("🧹 Detach all mock transactions and activate Clean Production Setup (0 dummy queue patients/bills)?\n\nYour Clinic Profile, Staff Users, Accounts, and Medicine Catalog will stay 100% intact.")) {
                        clearAllTransactionalData();
                        loadData();
                        showToast("✅ Mock data detached! Database is now completely clean (0 transactions).");
                      }
                    }}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-5 py-3 rounded-2xl font-black text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-emerald-700">cleaning_services</span>
                    Detach Mock Data (0 Transactions)
                  </button>

                  <button
                    onClick={() => {
                      if (confirm("⚠️ Are you sure you want to RESET all data back to factory demo state with sample patients and sales?")) {
                        resetDatabaseToDemoData();
                        loadData();
                        showToast("Database reset to demo baseline successfully.");
                      }
                    }}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-5 py-3 rounded-2xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    Reset Factory Demo Data
                  </button>
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </main>
      </div>

      {/* ================================================================= */}
      {/* MODAL: DIRECT PASSWORD RESET (SUPER ADMIN)                        */}
      {/* ================================================================= */}
      {resetPasswordModalUser && (
        <div className="fixed inset-0 bg-teal-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleResetPassword}
            className="bg-white border border-teal-100 rounded-3xl p-6 sm:p-8 max-w-md w-full text-slate-800 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center border-b border-teal-50 pb-3">
              <div>
                <h3 className="font-black text-base text-teal-950 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600">key</span>
                  Direct Password Override
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Setting new portal password for: <strong className="text-teal-950">{resetPasswordModalUser.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordModalUser(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">
                Enter New Password
              </label>
              <input
                type="text"
                required
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="e.g. 123456 or admin2026"
                className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-xs font-mono font-bold text-teal-950"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-teal-50">
              <button
                type="button"
                onClick={() => setResetPasswordModalUser(null)}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: ADD / EDIT STAFF                                           */}
      {/* ================================================================= */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-teal-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveStaff}
            className="bg-white border border-teal-100 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-slate-800 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-teal-50 pb-3">
              <div>
                <h3 className="font-black text-lg text-teal-950">
                  {editingUser ? `Edit Staff: ${editingUser.name}` : "Add Doctor or Staff Member"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Master role and credential assignment</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-teal-950 uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-teal-950 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-teal-950 uppercase tracking-wider mb-1.5">System Role *</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-teal-950 font-bold"
                  >
                    <option value="doctor">Doctor</option>
                    <option value="receptionist">Receptionist / Front Desk</option>
                    <option value="pharmacist">Pharmacist / Counter</option>
                    <option value="cashier">Cashier</option>
                    <option value="warehouse_incharge">Warehouse Incharge / Godown</option>
                    <option value="accountant">Accountant / Finance</option>
                    <option value="b2b_salesman">B2B Salesman / Order Booker</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-teal-950 uppercase tracking-wider mb-1.5">Assigned Godown / Warehouse</label>
                  <select
                    value={staffForm.assigned_warehouse_id || ""}
                    onChange={(e) => setStaffForm({ ...staffForm, assigned_warehouse_id: e.target.value })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-teal-950 font-bold"
                  >
                    <option value="">All Warehouses (Global Access)</option>
                    <option value="wh_str">Medical Store Counter (wh_str)</option>
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name || w.code} ({w.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-teal-950 uppercase tracking-wider mb-1.5">Room / Dept</label>
                <input
                  type="text"
                  value={staffForm.room_number}
                  onChange={(e) => setStaffForm({ ...staffForm, room_number: e.target.value })}
                  className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-teal-950 font-bold"
                />
              </div>

              {staffForm.role === "doctor" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-teal-950 uppercase tracking-wider mb-1.5">Specialization</label>
                    <input
                      type="text"
                      value={staffForm.specialization}
                      onChange={(e) => setStaffForm({ ...staffForm, specialization: e.target.value })}
                      className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-teal-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-teal-950 uppercase tracking-wider mb-1.5">Consultation Fee (Rs.)</label>
                    <input
                      type="number"
                      value={staffForm.consultation_fee}
                      onChange={(e) => setStaffForm({ ...staffForm, consultation_fee: Number(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-teal-950 font-bold font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-teal-950 uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-teal-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-teal-950 uppercase tracking-wider mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-teal-950 font-mono"
                  />
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="block font-bold text-teal-950 uppercase tracking-wider mb-1.5">Initial Password</label>
                  <input
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    placeholder="Enter Account Password"
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-teal-950 font-mono"
                  />
                </div>
              )}

              {/* Clinic Financials & Revenue Visibility Permission Card */}
              <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="staff_can_view_financials_toggle"
                    checked={Boolean(staffForm.can_view_financials)}
                    onChange={(e) => setStaffForm({ ...staffForm, can_view_financials: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded border-teal-300 text-teal-700 focus:ring-teal-500 cursor-pointer"
                  />
                  <label htmlFor="staff_can_view_financials_toggle" className="cursor-pointer">
                    <div className="font-extrabold text-teal-950 text-xs flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-teal-700">account_balance_wallet</span>
                      <span>Grant Financials &amp; Revenue Breakdown Access</span>
                    </div>
                    <p className="text-[11px] text-teal-800/80 mt-0.5 leading-relaxed">
                      When enabled, this user (Doctor or Cashier/Staff) will be able to see Total Clinic OPD Fees, Pharmacy Sales, Daily Expenses, Net Revenue, and Doctor-by-Doctor earnings on their Dashboard. (Default: <strong>OFF</strong> - only Principal Owner sees full clinic financials).
                    </p>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-teal-50">
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white shadow-lg shadow-teal-700/20 cursor-pointer"
              >
                Save Staff User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: TAB GRANULAR PASSWORD LOCK & HIDING CONFIGURATION          */}
      {/* ================================================================= */}
      {showTabSecurityModal && tempSecurityConfig && (
        <div className="fixed inset-0 bg-teal-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSecurityConfig}
            className="bg-white rounded-3xl border border-teal-100 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto animate-fade-in"
          >
            <div className="flex items-center justify-between border-b border-teal-50 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">shield</span>
                </div>
                <div>
                  <h3 className="font-black text-base text-teal-950">Granular Tab Security &amp; Locks</h3>
                  <p className="text-xs text-slate-500 font-medium">Protect or hide sensitive tabs when delegating to staff</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTabSecurityModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Dual Security Key Management (Admin Passcode & Sub-Tab PIN) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* KEY 1: Super Admin Login Passcode */}
              <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-black text-teal-950 uppercase tracking-wider">
                    🔑 1. Super Admin Passcode
                  </label>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                    Portal Login
                  </span>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-teal-700 text-base select-none">
                    admin_panel_settings
                  </span>
                  <input
                    type={showPinText ? "text" : "password"}
                    required
                    value={tempSecurityConfig.admin_passcode || ""}
                    onChange={(e) =>
                      setTempSecurityConfig({
                        ...tempSecurityConfig,
                        admin_passcode: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-teal-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-500 tracking-wider"
                    placeholder="Enter Admin Passcode"
                  />
                </div>
                <p className="text-[10px] text-teal-800 font-medium">
                  Used to unlock the Super Admin Panel at <code className="font-mono bg-teal-100/70 px-1 rounded">/admin</code>.
                </p>
              </div>

              {/* KEY 2: Sub-Tab Delegation PIN */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-black text-amber-950 uppercase tracking-wider">
                    🔒 2. Sub-Tab Security PIN
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    Staff Lock
                  </span>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-amber-700 text-base select-none">
                    key
                  </span>
                  <input
                    type={showPinText ? "text" : "password"}
                    required
                    value={tempSecurityConfig.tab_pin || ""}
                    onChange={(e) =>
                      setTempSecurityConfig({
                        ...tempSecurityConfig,
                        tab_pin: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-amber-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 tracking-wider"
                    placeholder="Enter Tab Security PIN"
                  />
                </div>
                <p className="text-[10px] text-amber-800 font-medium">
                  Secret PIN given to staff to unlock individual delegated tabs.
                </p>
              </div>
            </div>

            {/* Password Visibility Global Toggle */}
            <div className="flex justify-end -mt-2">
              <button
                type="button"
                onClick={() => setShowPinText(!showPinText)}
                className="text-[11px] font-bold text-slate-600 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {showPinText ? "visibility_off" : "visibility"}
                </span>
                <span>{showPinText ? "Mask Passwords" : "Show Passwords"}</span>
              </button>
            </div>

            {/* Per-Tab Protection Matrix */}
            <div className="space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                Tab Access Permissions Matrix
              </div>

              {NAV_ITEMS.map((item) => {
                const isLocked = Boolean(tempSecurityConfig.tabs?.[item.id]?.locked);
                const isHidden = Boolean(tempSecurityConfig.tabs?.[item.id]?.hidden);
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="material-symbols-outlined text-lg text-teal-700 shrink-0">
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-800 truncate">{item.label}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {isLocked ? "🔒 Locked with PIN" : "🔓 Unlocked"} • {isHidden ? "👁️‍🗨️ Hidden from Menu" : "Visible in Menu"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Lock Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const curr = tempSecurityConfig.tabs?.[item.id] || {};
                          setTempSecurityConfig({
                            ...tempSecurityConfig,
                            tabs: {
                              ...tempSecurityConfig.tabs,
                              [item.id]: { ...curr, locked: !curr.locked },
                            },
                          });
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                          isLocked
                            ? "bg-amber-100 text-amber-900 border-amber-300 shadow-xs"
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        }`}
                        title="Require PIN to access this tab"
                      >
                        <span className="material-symbols-outlined text-xs">
                          {isLocked ? "lock" : "lock_open"}
                        </span>
                        <span>{isLocked ? "Locked" : "Unlocked"}</span>
                      </button>

                      {/* Hide Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const curr = tempSecurityConfig.tabs?.[item.id] || {};
                          setTempSecurityConfig({
                            ...tempSecurityConfig,
                            tabs: {
                              ...tempSecurityConfig.tabs,
                              [item.id]: { ...curr, hidden: !curr.hidden },
                            },
                          });
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                          isHidden
                            ? "bg-purple-100 text-purple-900 border-purple-300 shadow-xs"
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        }`}
                        title="Completely hide tab from sidebar menu until unlocked"
                      >
                        <span className="material-symbols-outlined text-xs">
                          {isHidden ? "visibility_off" : "visibility"}
                        </span>
                        <span>{isHidden ? "Hidden" : "Visible"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-teal-50">
              <button
                type="button"
                onClick={() => setShowTabSecurityModal(false)}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white shadow-lg shadow-teal-700/20 cursor-pointer"
              >
                Save Security Permissions
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: STEP-UP MASTER AUTHENTICATION CHALLENGE                    */}
      {/* ================================================================= */}
      {showSecurityChallengeModal && (
        <div className="fixed inset-0 bg-teal-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleVerifySecurityChallenge}
            className="bg-white rounded-3xl border border-amber-200 shadow-2xl max-w-sm w-full p-6 space-y-5 text-center animate-fade-in"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
              <span className="material-symbols-outlined text-2xl">lock</span>
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Authenticate Tab Security</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Enter your Tab Security PIN to access and configure granular permissions.
              </p>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                key
              </span>
              <input
                type="password"
                autoFocus
                required
                value={challengePinInput}
                onChange={(e) => {
                  setChallengePinInput(e.target.value);
                  setChallengePinError("");
                }}
                placeholder="Enter Tab Security PIN"
                className="w-full bg-slate-50 border border-amber-300 focus:border-amber-500 focus:bg-white rounded-2xl pl-10 pr-4 py-3 text-xs font-mono font-bold text-slate-900 text-center tracking-widest focus:outline-none transition-all"
              />
            </div>

            {challengePinError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {challengePinError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSecurityChallengeModal(false)}
                className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-1/2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black py-3 rounded-2xl text-xs shadow-md shadow-amber-600/20 transition-all cursor-pointer"
              >
                Unlock Access
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: REVEAL HIDDEN MODULES WITH PIN                             */}
      {/* ================================================================= */}
      {showRevealModal && (
        <div className="fixed inset-0 bg-teal-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRevealAllHidden}
            className="bg-white rounded-3xl border border-amber-200 shadow-2xl max-w-sm w-full p-6 space-y-5 text-center animate-fade-in"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">visibility</span>
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Reveal Hidden Admin Modules</h3>
              <p className="text-xs text-slate-500 mt-1">Enter Master Security PIN to display all protected hidden tabs in the menu.</p>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                key
              </span>
              <input
                type="password"
                autoFocus
                required
                value={revealPinInput}
                onChange={(e) => {
                  setRevealPinInput(e.target.value);
                  setRevealPinError("");
                }}
                placeholder="Enter Security PIN"
                className="w-full bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white rounded-2xl pl-9 pr-3 py-2.5 text-xs text-slate-900 font-mono tracking-widest text-center font-bold"
              />
            </div>

            {revealPinError && (
              <p className="text-xs font-bold text-rose-600">{revealPinError}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRevealModal(false)}
                className="flex-1 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-2xl text-xs font-black bg-teal-700 hover:bg-teal-800 text-white shadow-md shadow-teal-900/20 cursor-pointer"
              >
                Reveal Tabs
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: EMAIL TEMPLATE LIVE RESPONSIVE PREVIEW                     */}
      {/* ================================================================= */}
      {showEmailPreviewModal && (
        <div className="fixed inset-0 bg-teal-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-teal-200 shadow-2xl max-w-4xl w-full h-[92vh] max-h-[850px] flex flex-col overflow-hidden">
            {/* Modal Header Bar */}
            <div className="px-6 py-4 bg-gradient-to-r from-teal-900 via-emerald-950 to-teal-950 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center text-teal-300 border border-white/20">
                  <span className="material-symbols-outlined text-xl">mark_email_read</span>
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">CliniCore Signature HTML Email Template Preview</h3>
                  <p className="text-[11px] text-teal-200/80">Matches CliniCore Clinical Dark Teal &amp; Emerald Theme with Responsive CSS</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Viewport Width Switcher */}
                <div className="bg-white/10 p-1 rounded-xl flex items-center gap-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setEmailPreviewMode("desktop")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      emailPreviewMode === "desktop" ? "bg-white text-teal-950 shadow-xs" : "text-teal-200 hover:text-white"
                    }`}
                  >
                    Desktop View
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailPreviewMode("mobile")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      emailPreviewMode === "mobile" ? "bg-white text-teal-950 shadow-xs" : "text-teal-200 hover:text-white"
                    }`}
                  >
                    Mobile (380px)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEmailPreviewModal(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close Preview"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* Modal Body: Live iframe Render */}
            <div className="flex-1 bg-slate-100 overflow-auto p-4 sm:p-6 flex items-center justify-center">
              <div
                className={`bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transition-all duration-300 ${
                  emailPreviewMode === "mobile" ? "w-[390px] h-full" : "w-full h-full max-w-2xl"
                }`}
              >
                <iframe
                  title="CliniCore Email Live Template Render"
                  srcDoc={emailPreviewHtml}
                  className="w-full h-full border-0"
                />
              </div>
            </div>

            {/* Modal Footer Bar with Quick Dispatch */}
            <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-600 font-medium">
                Destination Inbox: <strong className="text-teal-950 font-bold">{clinicForm.notification_email || "admin@clinicore.pk"}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    exportFullDatabase(false);
                    showToast("💾 .cfbak file downloaded to your Downloads folder!");
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-950 border border-emerald-300 hover:bg-emerald-100 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Download copy directly"
                >
                  <span className="material-symbols-outlined text-sm text-emerald-700">download</span>
                  <span>Download .cfbak</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailPreviewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  disabled={isDispatchingBackup}
                  onClick={handleManualBackupEmailDispatch}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md shadow-emerald-700/20 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  {isDispatchingBackup ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">outgoing_mail</span>
                      <span>Send Real Backup Email (.cfbak Attached)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: REGISTER / EDIT GODOWN & MULTI-WAREHOUSE                   */}
      {/* ================================================================= */}
      {showGodownModal && (
        <div className="fixed inset-0 bg-teal-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveGodown}
            className="bg-white rounded-3xl border border-teal-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-5 animate-fade-in max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-teal-50 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-2xl">warehouse</span>
                </div>
                <div>
                  <h3 className="font-black text-base text-teal-950">
                    {editingGodown ? `Edit Godown: ${editingGodown.name}` : "Register New Godown / Warehouse"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Configure storage location details, incharge &amp; inventory tracking</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGodownModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1">
                  Godown / Warehouse Name *
                </label>
                <input
                  type="text"
                  required
                  value={godownForm.name}
                  onChange={(e) => setGodownForm({ ...godownForm, name: e.target.value })}
                  placeholder="e.g. Main Godown (Lajpat Road) or Warehouse B"
                  className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-xs font-bold text-teal-950"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1">
                    Short Identification Code
                  </label>
                  <input
                    type="text"
                    value={godownForm.code}
                    onChange={(e) => setGodownForm({ ...godownForm, code: e.target.value })}
                    placeholder="e.g. GDW-02"
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-xs font-mono font-bold text-teal-950 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1">
                    Operational Status
                  </label>
                  <select
                    value={godownForm.status}
                    onChange={(e) => setGodownForm({ ...godownForm, status: e.target.value })}
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-xs font-bold text-teal-950"
                  >
                    <option value="active">Active (Operational)</option>
                    <option value="inactive">Inactive (Temporarily Closed)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1">
                    Incharge Custodian / Manager
                  </label>
                  <input
                    type="text"
                    value={godownForm.incharge_name}
                    onChange={(e) => setGodownForm({ ...godownForm, incharge_name: e.target.value })}
                    placeholder="e.g. Usama / Kashif Khan"
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-xs font-semibold text-teal-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1">
                    Manager Phone Number
                  </label>
                  <input
                    type="text"
                    value={godownForm.phone}
                    onChange={(e) => setGodownForm({ ...godownForm, phone: e.target.value })}
                    placeholder="03473100304"
                    className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-xs font-mono font-bold text-teal-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1">
                  City &amp; Physical Street Address
                </label>
                <input
                  type="text"
                  value={godownForm.location}
                  onChange={(e) => setGodownForm({ ...godownForm, location: e.target.value })}
                  placeholder="e.g. Site Area, Near Bus Stop, Hyderabad, Sindh"
                  className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-xs font-semibold text-teal-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1">
                  Storage Notes &amp; Working Hours
                </label>
                <textarea
                  rows={2}
                  value={godownForm.notes}
                  onChange={(e) => setGodownForm({ ...godownForm, notes: e.target.value })}
                  placeholder="e.g. Bulk liquid syrup & tablet storage. Key with manager."
                  className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-2.5 text-xs font-medium text-teal-950"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-teal-50/60 rounded-2xl border border-teal-200/70">
                <input
                  type="checkbox"
                  id="is_default_godown"
                  checked={godownForm.is_default}
                  onChange={(e) => setGodownForm({ ...godownForm, is_default: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="is_default_godown" className="text-xs font-bold text-teal-950 cursor-pointer">
                  Set as Primary / Default Receiving Godown for Supplier Purchases (GRN)
                </label>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-teal-50">
              <button
                type="button"
                onClick={() => setShowGodownModal(false)}
                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-1/2 py-3 bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-black rounded-2xl text-xs shadow-lg shadow-teal-700/20 transition-all cursor-pointer"
              >
                {editingGodown ? "Save Changes" : "Register Godown"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
