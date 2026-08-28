import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { getFeesSummary } from "../api/visits.js";
import {
  dbVisits,
  dbSales,
  dbExpenses,
  dbPurchases,
  dbReturns,
  dbB2BSales,
  dbClinic,
  dbShiftClosings,
  dbCashBook,
  dbAccounts,
  dbParties,
  dbDayClosing,
} from "../api/db.js";
import { formatCurrency } from "../utils/formatters.js";
import { printDayEndClosingReceipt, printCashVoucherReceipt } from "../utils/thermalPrinter.js";
import DayClosingReceiptModal from "../components/DayClosingReceiptModal.jsx";

const RANGES = ["daily", "weekly", "monthly"];

/**
 * Searchable Combobox for Chart of Accounts (260+ Parties, Suppliers, Expense Accounts)
 */
function SearchableAccountSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select or search account...",
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) =>
        (opt.label || "").toLowerCase().includes(q) ||
        (opt.sublabel || "").toLowerCase().includes(q) ||
        (opt.badge || "").toLowerCase().includes(q)
    );
  }, [options, search]);

  const selectedOpt = options.find((o) => o.id === value || o.label === value || o.account_name === value);

  return (
    <div ref={dropdownRef} className="relative w-full">
      {label && (
        <label className="block text-[11px] font-black text-slate-700 mb-1 uppercase tracking-tight">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Trigger Box */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className={`w-full min-h-[44px] bg-white border ${
          isOpen ? "border-teal-600 ring-2 ring-teal-100" : "border-slate-300 hover:border-slate-400"
        } rounded-xl px-3.5 py-2 text-xs font-bold text-left flex items-center justify-between shadow-2xs transition-all cursor-pointer`}
      >
        <span className={`truncate ${selectedOpt ? "text-slate-900 font-black" : "text-slate-400 font-medium"}`}>
          {selectedOpt ? (
            <span className="flex items-center gap-1.5 truncate">
              {selectedOpt.badge && (
                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-teal-100 text-teal-900">
                  {selectedOpt.badge}
                </span>
              )}
              <span>{selectedOpt.label}</span>
              {selectedOpt.sublabel && (
                <span className="text-[10.5px] text-slate-500 font-normal">({selectedOpt.sublabel})</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <span className="material-symbols-outlined text-base text-slate-400 ml-1 shrink-0">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[999] overflow-hidden flex flex-col max-h-64 animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-400">search</span>
            <input
              type="text"
              autoFocus
              placeholder="Search account name, city, type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none placeholder-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[10px] text-slate-400 hover:text-slate-700 font-black cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="overflow-y-auto custom-scrollbar flex-1 p-1.5 space-y-0.5 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="py-5 text-center text-xs text-slate-400 font-medium">No matching accounts found.</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id || opt.label}
                  type="button"
                  onClick={() => {
                    onChange(opt.label || opt.account_name, opt);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-teal-50 rounded-xl flex items-center justify-between text-xs transition-colors group cursor-pointer"
                >
                  <div className="truncate flex items-center gap-1.5">
                    {opt.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-slate-100 group-hover:bg-teal-200 group-hover:text-teal-950 text-slate-700">
                        {opt.badge}
                      </span>
                    )}
                    <span className="font-bold text-slate-800 group-hover:text-teal-950 truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[10.5px] text-slate-400 group-hover:text-teal-700 truncate">
                        • {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {opt.extra && (
                    <span className="text-[10.5px] font-black text-rose-600 shrink-0 ml-2 font-mono">{opt.extra}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeesReports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("zreport"); // "zreport" | "cashbook" | "opd_analytics"
  const [range, setRange] = useState("monthly");
  const [summary, setSummary] = useState(null);

  // Day-End Filter Date & Opening Cash Float
  const [closingDate, setClosingDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [openingCash, setOpeningCash] = useState(() => {
    const saved = localStorage.getItem(`cf_opening_cash_${new Date().toISOString().split("T")[0]}`);
    return saved !== null ? Number(saved) : 0;
  });

  // Modal State for DrCreate Day Closing Receipt
  const [showDayClosingModal, setShowDayClosingModal] = useState(false);
  const [whatsAppNo, setWhatsAppNo] = useState("03473100304");

  // Denominations Counter State
  const [denominations, setDenominations] = useState({
    note5000: 0,
    note1000: 0,
    note500: 0,
    note100: 0,
    note50: 0,
    note20: 0,
    note10: 0,
  });
  const [closingNotes, setClosingNotes] = useState("");
  const [savedClosings, setSavedClosings] = useState([]);
  const [toastMsg, setToastMsg] = useState("");
  const [showDenomCounter, setShowDenomCounter] = useState(false);

  // CashBook Form State (Inline Tab 2)
  const [cbVoucherNo, setCbVoucherNo] = useState("C-5160");
  const [cbTerm, setCbTerm] = useState("Receive"); // "Receive" | "Paid"
  const [cbAccountName, setCbAccountName] = useState("");
  const [cbAmount, setCbAmount] = useState("");
  const [cbNaration, setCbNaration] = useState("");
  const [cbAutoPrint, setCbAutoPrint] = useState(true);
  const [cbHistorySearch, setCbHistorySearch] = useState("");
  const [cbViewMode, setCbViewMode] = useState("daily"); // "daily" | "all"

  const isPrimaryDoctorOrOwner = Boolean(user?.is_owner || user?.role === "admin");
  const canViewAllFinancials = Boolean(
    isPrimaryDoctorOrOwner ||
    user?.can_view_financials === true
  );
  const targetDoctorId = canViewAllFinancials ? null : user?.id;

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Sync Opening Cash to LocalStorage
  const handleOpeningCashChange = (val) => {
    const num = Math.max(0, Number(val) || 0);
    setOpeningCash(num);
    localStorage.setItem(`cf_opening_cash_${closingDate}`, num.toString());
  };

  const loadData = () => {
    const r = getFeesSummary(range, targetDoctorId);
    if (r.success) setSummary(r.data);
    setSavedClosings(dbShiftClosings.getAll());
    setCbVoucherNo(dbCashBook.getNextVoucherNo());
  };

  useEffect(() => {
    loadData();
    const handleStatusUpdate = () => loadData();
    window.addEventListener("clinicflow_status_update", handleStatusUpdate);
    return () => window.removeEventListener("clinicflow_status_update", handleStatusUpdate);
  }, [range, targetDoctorId, closingDate]);

  // Account options for Searchable Select
  const accountOptions = useMemo(() => {
    const accList = dbAccounts.getAll() || [];
    const parties = dbParties.getAll() || [];
    return accList.map((acc) => {
      const matchedParty = parties.find((p) => p.name.toLowerCase() === acc.account_name.toLowerCase());
      const extraDue =
        matchedParty && matchedParty.current_balance > 0
          ? `Udhaar: Rs. ${Number(matchedParty.current_balance || 0).toLocaleString("en-US")}`
          : null;

      return {
        id: acc.id || acc.account_name,
        label: acc.account_name,
        badge: acc.account_type || "General",
        sublabel: acc.naration || "",
        extra: extraDue,
        raw: acc,
      };
    });
  }, [activeTab]);

  // ---------------------------------------------------------------------------
  // FINANCIAL CALCULATIONS (Day-End Reconciliation)
  // ---------------------------------------------------------------------------
  const targetDateStr = closingDate;

  // 0. Base Collections
  const allCashBook = dbCashBook.getAll() || [];
  const allVisits = dbVisits.getAll() || [];
  const allSales = dbSales.getAll() || [];
  const allB2B = dbB2BSales.getAll() || [];
  const allExpenses = dbExpenses.getAll() || [];
  const allPurchases = dbPurchases.getAll() || [];
  const allReturns = dbReturns.getAll() || [];

  // Day Closing Rich Data (Software UserForm12 Engine)
  const dayClosingData = useMemo(() => {
    return dbDayClosing.getDayClosingData(closingDate);
  }, [closingDate, activeTab, allCashBook.length, allSales.length, allPurchases.length]);

  // Day of Week
  const dayOfWeekName = useMemo(() => {
    try {
      const d = new Date(closingDate + "T00:00:00");
      return d.toLocaleDateString("en-US", { weekday: "long" });
    } catch {
      return "Today";
    }
  }, [closingDate]);

  // 1. Inflows
  const dayVisits = allVisits.filter((v) => (v.visit_date || "").split("T")[0] === targetDateStr);
  const dayOpdFees = dayVisits.reduce((sum, v) => sum + (Number(v.fee_amount) || 0), 0);

  const daySales = allSales.filter((s) => (s.sale_date || s.created_at || "").split("T")[0] === targetDateStr);
  const dayPharmacySales = daySales.reduce(
    (sum, s) => sum + (Number(s.paid_amount !== undefined ? s.paid_amount : s.total_amount) || 0),
    0
  );

  const operatorBreakdown = useMemo(() => {
    const activeDaySales = allSales.filter((s) => (s.sale_date || s.created_at || "").split("T")[0] === targetDateStr && !s.is_voided);
    const map = {};
    activeDaySales.forEach((s) => {
      const op = s.cashier_name || s.user_name || "Counter Staff";
      if (!map[op]) {
        map[op] = { name: op, totalSales: 0, cashSales: 0, count: 0 };
      }
      map[op].totalSales += Number(s.total_amount) || 0;
      map[op].cashSales += Number(s.paid_amount !== undefined ? s.paid_amount : s.total_amount) || 0;
      map[op].count += 1;
    });
    return Object.values(map);
  }, [allSales, targetDateStr]);

  const dayB2B = allB2B.filter((b) => (b.sale_date || b.created_at || "").split("T")[0] === targetDateStr);
  const dayWholesaleSales = dayB2B.reduce(
    (sum, b) => sum + (Number(b.paid_amount !== undefined ? b.paid_amount : b.total_amount) || 0),
    0
  );

  // CashBook Inflows
  const dayCashRec = allCashBook.filter(
    (c) => (c.date || "").split("T")[0] === targetDateStr && (c.term || c.type) === "Receive"
  );
  const dayCashRecTotal = dayCashRec.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const totalInflow = dayOpdFees + dayPharmacySales + dayWholesaleSales + dayCashRecTotal;

  // 2. Outflows
  const dayCashPaid = allCashBook.filter(
    (c) => (c.date || "").split("T")[0] === targetDateStr && (c.term || c.type) === "Paid"
  );
  const dayCashPaidTotal = dayCashPaid.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const dayExpenses = allExpenses.filter(
    (e) =>
      (e.expense_date || e.date || "").split("T")[0] === targetDateStr &&
      !dayCashPaid.some(
        (c) => c.voucher_no === e.id || (c.account_name === e.category && Math.abs(c.amount - Number(e.amount)) < 0.01)
      )
  );
  const totalDayExpenses = dayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + dayCashPaidTotal;

  const dayPurchases = allPurchases.filter(
    (p) => (p.purchase_date || p.created_at || "").split("T")[0] === targetDateStr
  );
  const daySupplierCash = dayPurchases.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0);

  const dayReturns = allReturns.filter(
    (r) => (r.return_date || r.created_at || "").split("T")[0] === targetDateStr
  );
  const dayReturnRefunds = dayReturns.reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0);

  const totalOutflow = totalDayExpenses + daySupplierCash + dayReturnRefunds;

  // Net Drawer Cash Formula: Opening Float + Inflow - Outflow
  const netCashInHand = openingCash + totalInflow - totalOutflow;

  // Physical Counted Total
  const physicalCashTotal =
    (Number(denominations.note5000) || 0) * 5000 +
    (Number(denominations.note1000) || 0) * 1000 +
    (Number(denominations.note500) || 0) * 500 +
    (Number(denominations.note100) || 0) * 100 +
    (Number(denominations.note50) || 0) * 50 +
    (Number(denominations.note20) || 0) * 20 +
    (Number(denominations.note10) || 0) * 10;

  const cashVariance = physicalCashTotal - netCashInHand;

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  const handlePrintZReport = (closingObj = null) => {
    const dataToPrint = closingObj || {
      closing_date: closingDate,
      closed_by: user?.name || "Cashier / Doctor",
      total_tokens: dayVisits.length,
      opening_cash: openingCash,
      opd_fees: dayOpdFees,
      pharmacy_sales: dayPharmacySales,
      wholesale_b2b: dayWholesaleSales + dayCashRecTotal,
      daily_expenses: totalDayExpenses,
      supplier_payments: daySupplierCash,
      returns_refunds: dayReturnRefunds,
      total_inflow: totalInflow,
      total_outflow: totalOutflow,
      net_cash_in_hand: netCashInHand,
      expected_cash: netCashInHand,
      physical_cash: physicalCashTotal > 0 ? physicalCashTotal : netCashInHand,
      cash_variance: physicalCashTotal > 0 ? cashVariance : 0,
      denominations: physicalCashTotal > 0 ? { ...denominations } : null,
    };
    printDayEndClosingReceipt(dataToPrint, dbClinic.get());
  };

  const handleSendWhatsApp = () => {
    const clinic = dbClinic.get();
    let cleanPhone = (whatsAppNo || clinic?.phone || "03473100304").replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "92" + cleanPhone.slice(1);
    }
    if (!cleanPhone) {
      alert("⚠️ Please enter a valid WhatsApp mobile number (e.g., 03473100304).");
      return;
    }

    const clinicName = clinic?.name || "H/Dr.Asif Ashraf Khan Clinic";
    const waText =
      `*📋 DAY CLOSING RECEIPT (Z-REPORT) — ${closingDate}*\n` +
      `*🏥 ${clinicName}*\n\n` +
      (openingCash > 0 ? `*💵 OPENING CASH FLOAT:* Rs. ${openingCash.toLocaleString()}\n` : "") +
      `*💰 TOTAL SALE:* Rs. ${(dayClosingData?.sales?.total || 0).toLocaleString()} (Cash: Rs. ${(dayClosingData?.sales?.cash || 0).toLocaleString()} | Credit: Rs. ${(dayClosingData?.sales?.credit || 0).toLocaleString()})\n` +
      `*📦 TOTAL PURCHASE:* Rs. ${(dayClosingData?.purchases?.total || 0).toLocaleString()} (Cash: Rs. ${(dayClosingData?.purchases?.cash || 0).toLocaleString()} | Credit: Rs. ${(dayClosingData?.purchases?.credit || 0).toLocaleString()})\n` +
      `*🔻 PAYMENT PAID (Outflow):* Rs. ${(dayClosingData?.payments_paid?.total || 0).toLocaleString()}\n` +
      `*🔺 PAYMENT RECEIVE (Inflow):* Rs. ${(dayClosingData?.payments_received?.total || 0).toLocaleString()}\n\n` +
      `*💵 CLOSING CASH IN HAND: Rs. ${netCashInHand.toLocaleString()}*\n` +
      (physicalCashTotal > 0
        ? `*🧮 Physical Counted:* Rs. ${physicalCashTotal.toLocaleString()} (${cashVariance === 0 ? "Balanced" : cashVariance < 0 ? `Short: Rs. ${cashVariance}` : `Surplus: +Rs. ${cashVariance}`})\n\n`
        : "\n") +
      `_Generated by CliniCore POS Engine_`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`, "_blank");
  };

  const handleSaveShiftClosing = () => {
    const newRecord = dbShiftClosings.add({
      date: closingDate,
      closed_by: user?.name || "Cashier / Doctor",
      shift_name: "Day-End Shift",
      total_tokens: dayVisits.length,
      opening_cash: openingCash,
      opd_fees: dayOpdFees,
      pharmacy_sales: dayPharmacySales,
      wholesale_sales: dayWholesaleSales + dayCashRecTotal,
      total_inflow: totalInflow,
      expenses: totalDayExpenses,
      supplier_payments: daySupplierCash,
      returns_refunds: dayReturnRefunds,
      total_outflow: totalOutflow,
      expected_cash: netCashInHand,
      physical_cash: physicalCashTotal,
      cash_variance: cashVariance,
      denominations: { ...denominations },
      payments_paid: {
        total: totalDayExpenses,
        items: dayClosingData?.payments_paid?.items || [],
      },
      payments_received: {
        total: totalInflow,
        items: dayClosingData?.payments_received?.items || [],
      },
      is_locked: true,
      notes: closingNotes,
    });

    setSavedClosings(dbShiftClosings.getAll());
    printDayEndClosingReceipt(newRecord, dbClinic.get());
    showToast("✅ Day-End Shift Closing saved and locked successfully!");
  };

  const handleDeleteClosing = (id) => {
    if (confirm("Are you sure you want to delete this shift closing log entry?")) {
      dbShiftClosings.delete(id);
      setSavedClosings(dbShiftClosings.getAll());
      showToast("🗑️ Shift closing log deleted.");
    }
  };

  // CashBook Submission (Tab 2)
  const handleCashBookSubmit = (e) => {
    e.preventDefault();
    const numAmount = Number(cbAmount);
    if (!numAmount || numAmount <= 0) {
      alert("⚠️ Please enter a valid non-zero transaction Amount.");
      return;
    }
    if (!cbAccountName || !cbAccountName.trim()) {
      alert("⚠️ Please select an Account Name.");
      return;
    }

    const newEntry = dbCashBook.addEntry({
      date: closingDate,
      voucher_no: cbVoucherNo,
      term: cbTerm,
      account_name: cbAccountName,
      naration: cbNaration || (cbTerm === "Receive" ? "Cash Received" : "Cash Paid"),
      amount: numAmount,
    });

    if (cbAutoPrint) {
      try {
        printCashVoucherReceipt(newEntry, dbClinic.get());
      } catch (err) {
        console.error("Slip print failed:", err);
      }
    }

    showToast(`✅ ${cbTerm === "Receive" ? "Cash Receipt" : "Cash Payment"} ${cbVoucherNo} posted!`);
    setCbAmount("");
    setCbNaration("");
    setCbAccountName("");
    loadData();
  };

  const handleCashBookDelete = (entry) => {
    if (confirm(`Delete Cash Voucher ${entry.voucher_no} (Rs. ${entry.amount})?`)) {
      dbCashBook.deleteEntry(entry.id || entry.voucher_no);
      showToast(`🗑️ Voucher ${entry.voucher_no} deleted.`);
      loadData();
    }
  };

  const handleCashBookReprint = (entry) => {
    printCashVoucherReceipt(entry, dbClinic.get());
  };

  // Narration Presets
  const quickNarations =
    cbTerm === "Receive"
      ? ["Bill Clear", "Cash Received", "Token Consultation Fee", "Advance Payment", "Udhaar Recovery", "Customer Ledger Settlement"]
      : ["Staff Tea & Refreshment", "Shop Daily Expenses", "Electricity / Utility Bill", "Courier & Transport Freight", "Medicine Purchase Bill", "Doctor Personal Drawing", "Staff Daily Allowance"];

  // CashBook Filtered View
  const displayCashBookEntries = useMemo(() => {
    let list = allCashBook;
    if (cbViewMode === "daily") {
      list = list.filter((r) => (r.date || "").split("T")[0] === closingDate);
    }
    if (cbHistorySearch.trim()) {
      const q = cbHistorySearch.toLowerCase();
      list = list.filter(
        (r) =>
          (r.voucher_no || "").toLowerCase().includes(q) ||
          (r.account_name || "").toLowerCase().includes(q) ||
          (r.naration || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allCashBook, cbViewMode, closingDate, cbHistorySearch]);

  const maxFee = summary?.chart_data?.length ? Math.max(...summary.chart_data.map((d) => d.fees), 1) : 1;
  const clinic = dbClinic.get();

  if (!canViewAllFinancials && user?.role !== "doctor") {
    return (
      <div className="w-full bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto my-12 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-3xl">lock</span>
        </div>
        <h3 className="text-xl font-black text-slate-900">Financial Access Restricted</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          You do not have administrative permission to view clinic revenue, cashbook vouchers, or day closing reconciliation.
          Only the Primary Doctor, Owner, or authorized Cashier can view financial records.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 flex flex-col gap-6 pb-24 font-sans zero-horizontal-overflow">
      {/* Toast Banner */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-[9999] bg-slate-900 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-2xl border border-teal-500/40 flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg("")} className="text-slate-400 hover:text-white font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="glass-card p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <span>{canViewAllFinancials ? "Financial Registers & CashBook" : "My OPD Fee Reports"}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            {canViewAllFinancials
              ? "Day-End Cash Closures, Physical Denominations HUD & Roznamcha Double-Entry Ledger"
              : `Consultation fee collections for ${user?.name || "Doctor"}`}
          </p>
        </div>

        {canViewAllFinancials && (
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Desktop Software Mode Button */}
            <button
              type="button"
              onClick={() => setShowDayClosingModal(true)}
              className="touch-pill min-h-[44px] bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-4 py-2.5 rounded-xl font-black text-xs shadow-lg shadow-teal-700/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer border border-emerald-400/30"
            >
              <span className="material-symbols-outlined text-base">receipt_long</span>
              <span>Day Closing (UserForm12)</span>
            </button>

            <button
              type="button"
              onClick={() => handlePrintZReport()}
              className="touch-pill min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-black text-xs shadow-md shadow-slate-900/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Print Z-Report (80mm)</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 3 Bento Navigation Tabs ── */}
      {canViewAllFinancials && (
        <div className="flex border-b border-slate-200/80 gap-2 overflow-x-auto custom-scrollbar pb-1">
          <button
            onClick={() => setActiveTab("zreport")}
            className={`min-h-[44px] px-4 font-black text-xs transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "zreport"
                ? "border-emerald-600 text-emerald-950 bg-emerald-50/70 rounded-t-2xl shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-t-2xl"
            }`}
          >
            <span className="material-symbols-outlined text-lg text-emerald-700">receipt_long</span>
            <span>📋 Day Closing Receipt (روزانہ کلوزنگ رسید)</span>
          </button>
          <button
            onClick={() => setActiveTab("cashbook")}
            className={`min-h-[44px] px-4 font-black text-xs transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "cashbook"
                ? "border-teal-600 text-teal-950 bg-teal-50/70 rounded-t-2xl shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-t-2xl"
            }`}
          >
            <span className="material-symbols-outlined text-lg text-teal-700">menu_book</span>
            <span>📖 CashBook Ledger (Roznamcha)</span>
          </button>
          <button
            onClick={() => setActiveTab("opd_analytics")}
            className={`min-h-[44px] px-4 font-black text-xs transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "opd_analytics"
                ? "border-teal-600 text-teal-950 bg-teal-50/70 rounded-t-2xl shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-t-2xl"
            }`}
          >
            <span className="material-symbols-outlined text-lg text-teal-700">analytics</span>
            <span>📈 OPD Doctor Fee Trends</span>
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: 📋 Day Closing Receipt & Physical Denominations HUD           */}
      {/* ===================================================================== */}
      {activeTab === "zreport" && canViewAllFinancials && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ─── LEFT: 80MM THERMAL RECEIPT SLIP PREVIEW (5 Cols) ─────── */}
            <div className="lg:col-span-5 glass-card p-5 sm:p-6 border-2 border-emerald-500/30 shadow-xl relative overflow-hidden flex flex-col font-mono text-xs text-slate-800">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600" />
              
              {/* Slip Header */}
              <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-1">
                <div className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  {clinic?.name || "H/Dr.Asif Ashraf Khan Clinic"}
                </div>
                <div className="text-[10px] text-slate-500 font-sans">
                  {clinic?.address || "Lajpat Road, Hyderabad"}
                </div>
                <div className="text-[10px] text-slate-500 font-sans">
                  Tel: {clinic?.phone || "0347-3100304"}
                </div>
                <div className="inline-block px-2.5 py-0.5 mt-1 rounded bg-slate-100 text-slate-800 text-[10.5px] font-black uppercase tracking-wider">
                  DAY CLOSING RECEIPT
                </div>
              </div>

              {/* Date & Day */}
              <div className="py-2.5 border-b border-dashed border-slate-300 flex justify-between text-[11px] font-bold text-slate-600">
                <span>Date: {closingDate}</span>
                <span>Day: {dayOfWeekName}</span>
              </div>

              {/* In-Receipt Sections */}
              <div className="py-3 space-y-3.5 flex-1">
                {/* 1. SALE */}
                <div className="space-y-1">
                  <div className="font-black text-slate-900 text-xs border-b border-slate-200 pb-0.5">
                    === SALE ===
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Sale:</span>
                    <span className="font-black text-slate-900 font-mono">
                      Rs. {(dayClosingData?.sales?.total || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600 pl-2">
                    <span>Cash Sale:</span>
                    <span className="font-mono">Rs. {(dayClosingData?.sales?.cash || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600 pl-2">
                    <span>Credit Sale:</span>
                    <span className="font-mono">Rs. {(dayClosingData?.sales?.credit || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* 2. PURCHASE */}
                <div className="space-y-1">
                  <div className="font-black text-slate-900 text-xs border-b border-slate-200 pb-0.5">
                    === PURCHASE ===
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Purchase:</span>
                    <span className="font-black text-slate-900 font-mono">
                      Rs. {(dayClosingData?.purchases?.total || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600 pl-2">
                    <span>Cash Purchase:</span>
                    <span className="font-mono">Rs. {(dayClosingData?.purchases?.cash || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600 pl-2">
                    <span>Credit Purchase:</span>
                    <span className="font-mono">Rs. {(dayClosingData?.purchases?.credit || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* 3. PAYMENT PAID (Outflow) */}
                <div className="space-y-1">
                  <div className="flex justify-between font-black text-rose-900 text-xs border-b border-rose-200 pb-0.5">
                    <span>=== PAYMENT PAID ===</span>
                    <span className="font-mono">Rs. {(dayClosingData?.payments_paid?.total || 0).toLocaleString()}</span>
                  </div>
                  {dayClosingData?.payments_paid?.items?.length === 0 ? (
                    <div className="text-[10px] text-slate-400 pl-2 italic">No payments paid</div>
                  ) : (
                    dayClosingData.payments_paid.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[10.5px] pl-2 text-slate-700">
                        <span className="truncate max-w-[200px]">
                          • {item.account_name} {item.naration ? `(${item.naration})` : ""}
                        </span>
                        <span className="font-bold shrink-0 font-mono">Rs. {Number(item.amount || 0).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* 4. PAYMENT RECEIVE (Inflow) */}
                <div className="space-y-1">
                  <div className="flex justify-between font-black text-emerald-900 text-xs border-b border-emerald-200 pb-0.5">
                    <span>=== PAYMENT RECEIVE ===</span>
                    <span className="font-mono">Rs. {(dayClosingData?.payments_received?.total || 0).toLocaleString()}</span>
                  </div>
                  {dayClosingData?.payments_received?.items?.length === 0 ? (
                    <div className="text-[10px] text-slate-400 pl-2 italic">No payments received</div>
                  ) : (
                    dayClosingData.payments_received.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[10.5px] pl-2 text-slate-700">
                        <span className="truncate max-w-[200px]">
                          • {item.account_name} {item.naration ? `(${item.naration})` : ""}
                        </span>
                        <span className="font-bold shrink-0 font-mono">Rs. {Number(item.amount || 0).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* 5. CLOSING CASH */}
                <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-1 shadow-inner border border-slate-800">
                  <div className="text-[10px] font-black text-amber-300 uppercase tracking-widest text-center">
                    FINAL CLOSING CASH IN HAND
                  </div>
                  <div className={`text-2xl font-black text-center font-mono ${netCashInHand >= 0 ? "text-amber-300" : "text-rose-400"}`}>
                    Rs. {netCashInHand.toLocaleString()}
                  </div>
                  {openingCash > 0 && (
                    <div className="text-[9.5px] text-slate-400 text-center">
                      (Includes Rs. {openingCash.toLocaleString()} Opening Float)
                    </div>
                  )}
                </div>
              </div>

              {/* Thermal Receipt Bottom Tear-Edge Graphic */}
              <div className="text-center pt-2 text-[9px] text-slate-400 font-sans border-t border-dashed border-slate-300">
                CliniCore Thermal Printing Engine
              </div>
            </div>

            {/* ─── RIGHT: CONTROL CONSOLE & DENOMINATION HUD (7 Cols) ────── */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* WhatsApp Quick Dispatcher Card */}
              <div className="glass-card bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-5 rounded-3xl shadow-lg space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-2xl">chat</span>
                    <span className="font-black text-sm uppercase tracking-wide">WhatsApp Daily Summary Report</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">1-Click Share</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="03473100304"
                    value={whatsAppNo}
                    onChange={(e) => setWhatsAppNo(e.target.value)}
                    className="flex-1 min-h-[44px] bg-white/10 border border-white/30 placeholder-white/60 text-white rounded-xl px-3.5 py-2 text-xs font-black focus:outline-none focus:bg-white/20"
                  />
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="touch-target-44 min-h-[44px] bg-white text-emerald-950 hover:bg-emerald-50 px-4 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">send</span>
                    <span>Send WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Date, Opening Float & Control Buttons */}
              <div className="glass-card p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1 uppercase tracking-tight">Select Closing Date</label>
                    <input
                      type="date"
                      value={closingDate}
                      onChange={(e) => setClosingDate(e.target.value)}
                      className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1 uppercase tracking-tight">
                      Opening Drawer Float (صبح کا کیش)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={openingCash || ""}
                        onChange={(e) => handleOpeningCashChange(e.target.value)}
                        className="w-full min-h-[44px] bg-amber-50/70 border border-amber-300 rounded-xl pl-9 pr-3.5 py-2 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2 border-t border-slate-100 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handlePrintZReport()}
                    className="touch-target-44 flex-1 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white py-3 px-4 rounded-xl font-black text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">print</span>
                    <span>Print 80mm Closing Slip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDayClosingModal(true)}
                    className="touch-target-44 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">open_in_full</span>
                    <span>Full Screen</span>
                  </button>
                </div>
              </div>

              {/* Operator / Staff Cash Inflow Breakdown Card */}
              <div className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                      <span className="material-symbols-outlined text-lg">badge</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-slate-900">Operator Cash Accountability</h3>
                      <p className="text-[10px] text-slate-500">Sales breakdown by cashier</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black bg-teal-100 text-teal-950 px-2.5 py-0.5 rounded-full">
                    {operatorBreakdown.length} Operators
                  </span>
                </div>

                {operatorBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No retail sales recorded on this date.</p>
                ) : (
                  <div className="space-y-2 pt-1">
                    {operatorBreakdown.map((op, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-teal-50/50 border border-teal-100 text-xs">
                        <div>
                          <span className="font-bold text-slate-900">{op.name}</span>
                          <div className="text-[10px] text-slate-500">{op.count} invoices processed</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-teal-950 font-mono">Rs. {op.cashSales.toLocaleString()}</div>
                          <div className="text-[9.5px] text-slate-400 font-mono">Total: Rs. {op.totalSales.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Physical Cash Denominations HUD Accordion with Live Variance */}
              <div className="glass-card border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDenomCounter(!showDenomCounter)}
                  className="w-full min-h-[48px] p-4 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-600">request_quote</span>
                    <span className="font-black text-slate-900 text-xs">
                      Physical Cash Drawer Denominations ({physicalCashTotal > 0 ? `Rs. ${physicalCashTotal.toLocaleString()}` : "Count Notes"})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {physicalCashTotal > 0 && (
                      <span className={`text-[10.5px] font-black px-2.5 py-0.5 rounded-full font-mono ${
                        cashVariance === 0
                          ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          : cashVariance < 0
                          ? "bg-rose-100 text-rose-900 border border-rose-300"
                          : "bg-amber-100 text-amber-900 border border-amber-300"
                      }`}>
                        {cashVariance === 0 ? "🟢 Balanced" : cashVariance < 0 ? `🔴 Short: Rs. ${Math.abs(cashVariance).toLocaleString()}` : `🟡 Surplus: +Rs. ${cashVariance.toLocaleString()}`}
                      </span>
                    )}
                    <span className="material-symbols-outlined text-slate-400">
                      {showDenomCounter ? "expand_less" : "expand_more"}
                    </span>
                  </div>
                </button>

                {showDenomCounter && (
                  <div className="p-4 pt-0 border-t border-slate-100 space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                      {[
                        { note: 5000, key: "note5000" },
                        { note: 1000, key: "note1000" },
                        { note: 500, key: "note500" },
                        { note: 100, key: "note100" },
                        { note: 50, key: "note50" },
                        { note: 20, key: "note20" },
                        { note: 10, key: "note10" },
                      ].map(({ note, key }) => (
                        <div key={key} className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200 text-center">
                          <div className="text-[10.5px] font-black text-slate-600">Rs. {note}</div>
                          <input
                            type="number"
                            min="0"
                            value={denominations[key] || ""}
                            onChange={(e) => setDenominations({ ...denominations, [key]: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full min-h-[36px] bg-white border border-slate-300 rounded-lg py-1 text-xs font-black text-center mt-1 font-mono shadow-2xs"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Live Variance Feedback Box */}
                    <div className="p-3 rounded-2xl bg-slate-100 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[10.5px] font-bold text-slate-600">Total Counted:</div>
                        <div className="text-sm font-black text-slate-900 font-mono">Rs. {physicalCashTotal.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10.5px] font-bold text-slate-600">Variance Status:</div>
                        <div className={`text-xs font-black font-mono ${
                          cashVariance === 0 ? "text-emerald-700" : cashVariance < 0 ? "text-rose-700" : "text-amber-700"
                        }`}>
                          {cashVariance === 0
                            ? "✅ Perfectly Balanced (Rs. 0)"
                            : cashVariance < 0
                            ? `⚠️ Short: -Rs. ${Math.abs(cashVariance).toLocaleString()} (Drawer deficit)`
                            : `⚠️ Surplus: +Rs. ${cashVariance.toLocaleString()} (Drawer extra)`}
                        </div>
                      </div>
                      <div className="w-full sm:w-auto">
                        <input
                          type="text"
                          value={closingNotes}
                          onChange={(e) => setClosingNotes(e.target.value)}
                          placeholder="Closing notes / handover remarks..."
                          className="w-full text-xs border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-teal-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveShiftClosing}
                        className="touch-target-44 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md whitespace-nowrap"
                      >
                        Lock &amp; Save Shift
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Saved Shift History Log */}
              {savedClosings.length > 0 && (
                <div className="glass-card p-4 space-y-3">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-emerald-600 text-base">history</span>
                    <span>Archived Closing Records</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {savedClosings.map((c) => (
                      <div key={c.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{new Date(c.closed_at || c.date).toLocaleDateString()}</div>
                          <div className="text-[10px] text-slate-500 font-medium">By: {c.closed_by || "Cashier"}</div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className="font-black text-slate-900 font-mono">Rs. {(c.expected_cash || 0).toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={() => handlePrintZReport(c)}
                            className="p-1.5 text-teal-700 hover:bg-teal-100 rounded-lg cursor-pointer"
                            title="Print Slip"
                          >
                            <span className="material-symbols-outlined text-base">print</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClosing(c.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg cursor-pointer"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: 📖 Embedded CashBook Ledger (Roznamcha)                        */}
      {/* ===================================================================== */}
      {activeTab === "cashbook" && canViewAllFinancials && (
        <div className="space-y-6">
          {/* Top Form: Fast Double-Entry Voucher Input */}
          <form onSubmit={handleCashBookSubmit} className="glass-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">receipt_long</span>
                <span>Record CashBook Voucher (Double-Entry Roznamcha)</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => dbCashBook.exportCSV()}
                  className="touch-pill min-h-[36px] text-xs font-black text-teal-800 hover:text-teal-950 flex items-center gap-1.5 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200 cursor-pointer shadow-2xs"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3.5 items-end">
              {/* Voucher No */}
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-black text-slate-600 mb-1 uppercase tracking-tight">Voucher No</label>
                <input
                  type="text"
                  readOnly
                  value={cbVoucherNo}
                  className="w-full min-h-[44px] bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-teal-950 font-mono text-center shadow-inner cursor-not-allowed"
                />
              </div>

              {/* Term: Receive vs Paid */}
              <div className="lg:col-span-3">
                <label className="block text-[11px] font-black text-slate-700 mb-1 uppercase tracking-tight">
                  Term / Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCbTerm("Receive")}
                    className={`min-h-[38px] flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      cbTerm === "Receive"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">arrow_downward</span>
                    <span>Receive (In)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCbTerm("Paid")}
                    className={`min-h-[38px] flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      cbTerm === "Paid"
                        ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">arrow_upward</span>
                    <span>Paid (Out)</span>
                  </button>
                </div>
              </div>

              {/* Searchable Account Name */}
              <div className="lg:col-span-4">
                <SearchableAccountSelect
                  label="Account Name"
                  required
                  value={cbAccountName}
                  onChange={(val) => setCbAccountName(val)}
                  options={accountOptions}
                  placeholder={cbTerm === "Receive" ? "Select Customer / Party..." : "Select Expense / Supplier..."}
                />
              </div>

              {/* Amount */}
              <div className="lg:col-span-3">
                <label className="block text-[11px] font-black text-slate-700 mb-1 uppercase tracking-tight">
                  Amount (Rs.) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">Rs.</span>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="0.00"
                    value={cbAmount}
                    onChange={(e) => setCbAmount(e.target.value)}
                    className="w-full min-h-[44px] bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-2 text-xs font-black text-slate-900 focus:border-teal-600 focus:outline-none shadow-2xs font-mono"
                  />
                </div>
              </div>

              {/* Narration */}
              <div className="lg:col-span-9">
                <label className="block text-[11px] font-black text-slate-700 mb-1 uppercase tracking-tight">Narration / Details</label>
                <input
                  type="text"
                  placeholder="e.g. Bill Clear, Chai Kharcha, Utility Bill, Delivery Courier..."
                  value={cbNaration}
                  onChange={(e) => setCbNaration(e.target.value)}
                  className="w-full min-h-[44px] bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none shadow-2xs"
                />
              </div>

              {/* Submit */}
              <div className="lg:col-span-3">
                <button
                  type="submit"
                  className="touch-target-44 w-full min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-slate-900/20 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>Post Voucher</span>
                </button>
              </div>
            </div>

            {/* Quick Naration Presets */}
            <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">Presets:</span>
              {quickNarations.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setCbNaration(tag)}
                  className="min-h-[30px] px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 rounded-lg transition-colors border border-slate-200/80 cursor-pointer"
                >
                  + {tag}
                </button>
              ))}

              <label className="ml-auto flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cbAutoPrint}
                  onChange={(e) => setCbAutoPrint(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>80mm Thermal Receipt Slip</span>
              </label>
            </div>
          </form>

          {/* CashBook Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card bg-emerald-50/70 border-emerald-200/80 p-4 sm:p-5">
              <div className="text-[11px] font-black uppercase tracking-wider text-emerald-800">Total Debit (Receipts)</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-950 mt-1 font-mono">
                + Rs. {dayCashRecTotal.toLocaleString()}
              </div>
            </div>

            <div className="glass-card bg-rose-50/70 border-rose-200/80 p-4 sm:p-5">
              <div className="text-[11px] font-black uppercase tracking-wider text-rose-800">Total Credit (Payments)</div>
              <div className="text-xl sm:text-2xl font-black text-rose-950 mt-1 font-mono">
                - Rs. {dayCashPaidTotal.toLocaleString()}
              </div>
            </div>

            <div className="glass-card bg-slate-900 text-white border-slate-800 p-4 sm:p-5">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Net Day Roznamcha Balance</div>
              <div className={`text-xl sm:text-2xl font-black mt-1 font-mono ${dayCashRecTotal - dayCashPaidTotal >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                Rs. {(dayCashRecTotal - dayCashPaidTotal).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Table View with Horizontal Scroll Container */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 text-sm">Vouchers Register</span>
                <span className="text-xs text-slate-400 font-mono">({displayCashBookEntries.length} entries)</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* View toggle */}
                <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setCbViewMode("daily")}
                    className={`min-h-[34px] px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      cbViewMode === "daily" ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500"
                    }`}
                  >
                    Today ({closingDate})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCbViewMode("all")}
                    className={`min-h-[34px] px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      cbViewMode === "all" ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500"
                    }`}
                  >
                    All History
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Search voucher, party..."
                  value={cbHistorySearch}
                  onChange={(e) => setCbHistorySearch(e.target.value)}
                  className="min-h-[36px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-xs font-medium focus:outline-none focus:border-teal-600 shadow-2xs"
                />
              </div>
            </div>

            {displayCashBookEntries.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                No cashbook entries recorded. Use the form above to post your first voucher.
              </div>
            ) : (
              <div className="table-scroll-container overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[640px]">
                  <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Voucher #</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Account Name</th>
                      <th className="px-4 py-3">Narration</th>
                      <th className="px-4 py-3 text-right">Debit (Receive)</th>
                      <th className="px-4 py-3 text-right">Credit (Paid)</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {displayCashBookEntries.map((exp) => {
                      const isRec = (exp.term || exp.type) === "Receive";
                      return (
                        <tr key={exp.id || exp.voucher_no} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-black text-teal-900">{exp.voucher_no}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono whitespace-nowrap">
                            {(exp.date || "").split("T")[0]}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">{exp.account_name}</td>
                          <td className="px-4 py-3 text-slate-600">{exp.naration || "—"}</td>
                          <td className="px-4 py-3 text-right font-black text-emerald-700 font-mono">
                            {isRec ? `Rs. ${Number(exp.amount || 0).toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-rose-700 font-mono">
                            {!isRec ? `Rs. ${Number(exp.amount || 0).toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleCashBookReprint(exp)}
                                className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg cursor-pointer"
                                title="Print Slip"
                              >
                                <span className="material-symbols-outlined text-base">print</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCashBookDelete(exp)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Delete Voucher"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: 📈 OPD Consultation Fee Trends                                 */}
      {/* ===================================================================== */}
      {(activeTab === "opd_analytics" || !canViewAllFinancials) && (
        <div className="space-y-5">
          {/* Range Toggle */}
          <div className="flex gap-1.5 bg-slate-100 rounded-2xl p-1 self-start">
            {RANGES.map((r) => (
              <button
                key={r}
                id={`range-${r}`}
                onClick={() => setRange(r)}
                className={`min-h-[38px] px-4 py-1.5 rounded-xl font-black text-xs uppercase transition-all cursor-pointer ${
                  range === r
                    ? "bg-teal-700 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {summary && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card p-5 sm:p-6 flex flex-col gap-2">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Consultation Fees</p>
                  <p className="text-2xl sm:text-3xl font-black text-teal-800 font-mono">{formatCurrency(summary.total_fees)}</p>
                </div>
                <div className="glass-card p-5 sm:p-6 flex flex-col gap-2">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider">OPD Patient Visits</p>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">{summary.visit_count}</p>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="glass-card p-5 sm:p-6">
                <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-4">
                  Fee Breakdown — {range.charAt(0).toUpperCase() + range.slice(1)}
                </p>
                {summary.chart_data.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">No visits in this period.</p>
                ) : (
                  <div className="flex items-end gap-3 overflow-x-auto custom-scrollbar pb-2" style={{ minHeight: "140px" }}>
                    {summary.chart_data.map((d, i) => {
                      const pct = Math.max(4, Math.round((d.fees / maxFee) * 120));
                      return (
                        <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                          <span className="text-[10.5px] font-bold text-slate-600 font-mono">{formatCurrency(d.fees)}</span>
                          <div
                            className="w-10 bg-teal-600 hover:bg-teal-700 rounded-t-lg transition-all"
                            style={{ height: `${pct}px` }}
                            title={`${d.date}: ${formatCurrency(d.fees)}`}
                          />
                          <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap font-mono">{d.date}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── MODAL: DrCreate & MS Access Day Closing Receipt (UserForm12) ─── */}
      <DayClosingReceiptModal
        isOpen={showDayClosingModal}
        onClose={() => setShowDayClosingModal(false)}
      />
    </div>
  );
}

