import { useState, useEffect, useMemo } from "react";
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
  dbDayClosing,
} from "../api/db.js";
import { formatCurrency } from "../utils/formatters.js";
import { printDayEndClosingReceipt } from "../utils/thermalPrinter.js";
import DayClosingReceiptModal from "../components/DayClosingReceiptModal.jsx";
import { RECEIPT_HEADER_IMAGE_BASE64 } from "../utils/receiptHeaderBase64.js";

const RANGES = ["daily", "weekly", "monthly"];

export default function FeesReports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("closing"); // "closing" | "trends"
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
    note75: 0,
    note50: 0,
    note20: 0,
    note10: 0,
  });
  const [closingNotes, setClosingNotes] = useState("");
  const [savedClosings, setSavedClosings] = useState([]);
  const [showDenomCounter, setShowDenomCounter] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
      );
    }, 5000);
    return () => clearInterval(timer);
  }, []);

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
  };

  useEffect(() => {
    loadData();
    const handleStatusUpdate = () => loadData();
    window.addEventListener("clinicflow_status_update", handleStatusUpdate);
    return () => window.removeEventListener("clinicflow_status_update", handleStatusUpdate);
  }, [range, targetDoctorId, closingDate]);

  // ---------------------------------------------------------------------------
  // FINANCIAL CALCULATIONS (Day-End Reconciliation)
  // ---------------------------------------------------------------------------
  const targetDateStr = closingDate;

  // Base Collections
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

  // Inflows
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

  // Day CashBook Vouchers Inflows and Outflows
  const dayCashRecTotal = useMemo(() => {
    return (allCashBook || [])
      .filter(
        (c) =>
          (c.date || c.created_at || "").split("T")[0] === targetDateStr &&
          (c.term === "Receive" || c.type === "Receive")
      )
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }, [allCashBook, targetDateStr]);

  const dayCashPaidTotal = useMemo(() => {
    return (allCashBook || [])
      .filter(
        (c) =>
          (c.date || c.created_at || "").split("T")[0] === targetDateStr &&
          (c.term === "Paid" || c.type === "Paid")
      )
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }, [allCashBook, targetDateStr]);

  const totalInflow = dayOpdFees + dayPharmacySales + dayWholesaleSales + dayCashRecTotal;

  const dayExpenses = allExpenses.filter(
    (e) => (e.expense_date || e.date || "").split("T")[0] === targetDateStr
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

  // Net Drawer Cash: Opening Float + Inflow - Outflow
  const netCashInHand = openingCash + totalInflow - totalOutflow;

  // Physical Counted Total
  const physicalCashTotal =
    (Number(denominations.note5000) || 0) * 5000 +
    (Number(denominations.note1000) || 0) * 1000 +
    (Number(denominations.note500) || 0) * 500 +
    (Number(denominations.note100) || 0) * 100 +
    (Number(denominations.note75) || 0) * 75 +
    (Number(denominations.note50) || 0) * 50 +
    (Number(denominations.note20) || 0) * 20 +
    (Number(denominations.note10) || 0) * 10;

  const cashVariance = physicalCashTotal - netCashInHand;

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  const handlePrintZReport = (closingObj = null) => {
    const dataToPrint = closingObj || {
      date: closingDate,
      closing_date: closingDate,
      closed_by: user?.name || "Cashier / Doctor",
      total_tokens: dayVisits.length,
      opening_cash: openingCash,
      sales: dayClosingData?.sales || {
        total: dayPharmacySales + dayWholesaleSales,
        cash: dayPharmacySales + dayWholesaleSales,
        credit: 0,
      },
      purchases: dayClosingData?.purchases || {
        total: daySupplierCash,
        cash: daySupplierCash,
        credit: 0,
      },
      payments_paid: dayClosingData?.payments_paid || {
        total: totalDayExpenses,
        items: [],
      },
      payments_received: dayClosingData?.payments_received || {
        total: totalInflow,
        items: [],
      },
      opd_fees: dayOpdFees,
      pharmacy_sales: dayPharmacySales,
      wholesale_b2b: dayWholesaleSales + dayCashRecTotal,
      daily_expenses: totalDayExpenses,
      supplier_payments: daySupplierCash,
      returns_refunds: dayReturnRefunds,
      total_inflow: totalInflow,
      total_outflow: totalOutflow,
      net_cash_in_hand: netCashInHand,
      closing_cash: netCashInHand,
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
      sales: dayClosingData?.sales || {
        total: dayPharmacySales + dayWholesaleSales,
        cash: dayPharmacySales + dayWholesaleSales,
        credit: 0,
      },
      purchases: dayClosingData?.purchases || {
        total: daySupplierCash,
        cash: daySupplierCash,
        credit: 0,
      },
      opd_fees: dayOpdFees,
      pharmacy_sales: dayPharmacySales,
      wholesale_sales: dayWholesaleSales + dayCashRecTotal,
      total_inflow: totalInflow,
      expenses: totalDayExpenses,
      supplier_payments: daySupplierCash,
      returns_refunds: dayReturnRefunds,
      total_outflow: totalOutflow,
      expected_cash: netCashInHand,
      closing_cash: netCashInHand,
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

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const maxFee = summary?.chart_data?.length ? Math.max(...summary.chart_data.map((d) => d.fees), 1) : 1;
  const clinic = dbClinic.get();

  if (!canViewAllFinancials && user?.role !== "doctor") {
    return (
      <div className="w-full bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto my-12 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900">Financial Access Restricted</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          You do not have administrative permission to view clinic revenue, cashbook vouchers, or day closing reconciliation.
          Only the Primary Doctor, Owner, or authorized Cashier can view financial records.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 flex flex-col gap-2.5 sm:gap-3 pb-2 font-sans zero-horizontal-overflow">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-[9999] bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-2xl border border-teal-500/40 flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg("")} className="text-slate-400 hover:text-white font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* BEGIN: PageHeader & ActionRow */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        {/* Title & Subtitle */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 shadow-2xs">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                {canViewAllFinancials ? "Financial Registers & CashBook" : "My OPD Fee Reports"}
              </h1>
              {canViewAllFinancials && (
                <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-medium border border-slate-200">
                  Daily Cash Desk
                </span>
              )}
            </div>
            <p className="text-[10.5px] sm:text-[11px] text-slate-500 font-normal leading-tight">
              {canViewAllFinancials
                ? "Day-End Cash Closures, Physical Denominations HUD & Roznamcha Double-Entry Ledger"
                : `Consultation fee collections for ${user?.name || "Doctor"}`}
            </p>
          </div>
        </div>

        {/* Header Action CTAs */}
        {canViewAllFinancials && (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setShowDayClosingModal(true)}
              className="inline-flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white px-3 py-1.5 rounded-lg font-semibold text-xs shadow-2xs transition transform active:scale-98 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-teal-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Day Closing (UserForm12)</span>
            </button>
            <button
              type="button"
              onClick={() => handlePrintZReport()}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg font-medium text-xs shadow-2xs transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Print Z-Report</span>
            </button>
          </div>
        )}
      </div>
      {/* END: PageHeader & ActionRow */}

      {/* BEGIN: NavigationTabs */}
      {canViewAllFinancials && (
        <div className="border-b border-slate-200 overflow-x-auto no-scrollbar">
          <nav className="flex space-x-6 text-xs sm:text-sm font-medium whitespace-nowrap min-w-max pb-px">
            {/* Active Tab */}
            <button
              type="button"
              onClick={() => setActiveTab("closing")}
              className={`py-1.5 px-1 border-b-2 font-semibold flex items-center gap-1.5 transition cursor-pointer text-xs sm:text-sm ${
                activeTab === "closing"
                  ? "border-teal-700 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Day Closing Receipt</span>
            </button>

            {/* OPD Doctor Fee Trends Tab */}
            <button
              type="button"
              onClick={() => setActiveTab("trends")}
              className={`py-1.5 px-1 border-b-2 font-medium flex items-center gap-1.5 transition cursor-pointer text-xs sm:text-sm ${
                activeTab === "trends"
                  ? "border-teal-700 text-teal-700 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>OPD Doctor Fee Trends</span>
            </button>
          </nav>
        </div>
      )}
      {/* END: NavigationTabs */}

      {/* ===================================================================== */}
      {/* TAB 1: 📋 Day Closing Receipt & Physical Denominations HUD           */}
      {/* ===================================================================== */}
      {activeTab === "closing" && canViewAllFinancials && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* ======================= LEFT COLUMN: 80MM ESC/POS RECEIPT (4-5 Cols) ======================= */}
          <section aria-label="Receipt Preview" className="lg:col-span-5 xl:col-span-4 flex flex-col">
            <div className="bg-white border-2 border-slate-300/90 rounded-xl p-3 sm:p-3.5 shadow-2xs relative overflow-hidden text-slate-950 font-sans">
              <div>
                {/* Paper Preview Label Header */}
                <div className="text-center pb-1 border-b border-dashed border-slate-300 mb-1.5">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400 font-bold">
                    [ RECEIPT PREVIEW — 80MM ESC/POS ]
                  </span>
                </div>

                {/* Clinic Header Banner Image (Full Coverage) */}
                <div className="text-center pb-2 -mx-2 -mt-1">
                  <img
                    src={RECEIPT_HEADER_IMAGE_BASE64}
                    alt="Dr. Asif Khan Homoeopathic Clinic"
                    className="w-full h-auto object-contain block"
                  />
                </div>

                {/* Date & Closing Receipt Header (Matching MS Access DrCreate Format) */}
                <div className="flex items-center justify-between font-semibold text-xs text-slate-900 my-1">
                  <span>Date</span>
                  <span className="font-mono font-semibold">
                    {closingDate} <span className="text-[11px] text-slate-700 ml-1.5 font-sans font-bold">{currentTime}</span>
                  </span>
                </div>

                <div className="text-center font-serif font-bold text-sm text-slate-900 my-1 tracking-wide">
                  Closing Receipt
                </div>

                {/* Dotted Divider */}
                <div className="border-t border-dashed border-slate-900 my-2" />

                {/* Opening Drawer Float (if > 0) */}
                {openingCash > 0 && (
                  <div className="flex items-center justify-between font-semibold text-xs text-slate-900 py-0.5 mb-1 bg-amber-50/60 px-1 rounded border border-amber-200">
                    <span>Opening Drawer Float:</span>
                    <span className="font-mono font-bold">
                      Rs. {Number(openingCash).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {/* 1. SALE */}
                <div className="my-2.5 space-y-0.5">
                  <div className="flex items-center justify-between font-semibold text-xs text-slate-900">
                    <span className="font-serif font-bold text-xs">Sale</span>
                    <span className="font-mono font-semibold text-xs text-slate-900">
                      Rs. {(dayClosingData?.sales?.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-700 pl-2">
                    <span>Cash</span>
                    <span className="font-mono">
                      Rs. {(dayClosingData?.sales?.cash || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-700 pl-2">
                    <span>Credit</span>
                    <span className="font-mono">
                      Rs. {(dayClosingData?.sales?.credit || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* 2. PURCHASE */}
                <div className="my-2.5 space-y-0.5">
                  <div className="flex items-center justify-between font-semibold text-xs text-slate-900">
                    <span className="font-serif font-bold text-xs">Purchase</span>
                    <span className="font-mono font-semibold text-xs text-slate-900">
                      Rs. {(dayClosingData?.purchases?.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-700 pl-2">
                    <span>Cash</span>
                    <span className="font-mono">
                      Rs. {(dayClosingData?.purchases?.cash || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-700 pl-2">
                    <span>Credit</span>
                    <span className="font-mono">
                      Rs. {(dayClosingData?.purchases?.credit || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* 3. PAYMENT PAID */}
                <div className="my-2.5">
                  <div className="flex items-center justify-between font-semibold text-xs text-slate-900 mb-0.5">
                    <span className="font-serif font-bold text-xs">Payment Paid</span>
                    <span className="font-mono font-semibold text-xs text-slate-900">
                      Rs. {(dayClosingData?.payments_paid?.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-semibold border-b border-dotted border-slate-400 pb-0.5 mb-1 text-slate-600 pl-2">
                    <span>Account Name</span>
                    <span>Amount</span>
                  </div>
                  {dayClosingData?.payments_paid?.items?.length === 0 ? (
                    <div className="text-[10px] text-slate-400 italic text-center py-0.5">
                      No payments paid on this date.
                    </div>
                  ) : (
                    <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5 pl-2">
                      {dayClosingData?.payments_paid?.items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[10.5px] text-slate-800">
                          <span className="truncate max-w-[170px]">
                            {it.account_name} {it.naration ? `(${it.naration})` : ""}
                          </span>
                          <span className="font-mono font-medium shrink-0">
                            Rs. {Number(it.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. PAYMENT RECEIVE */}
                <div className="my-2.5">
                  <div className="flex items-center justify-between font-semibold text-xs text-slate-900 mb-0.5">
                    <span className="font-serif font-bold text-xs">Payment Receive</span>
                    <span className="font-mono font-semibold text-xs text-slate-900">
                      Rs. {(dayClosingData?.payments_received?.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-semibold border-b border-dotted border-slate-400 pb-0.5 mb-1 text-slate-600 pl-2">
                    <span>Account Name</span>
                    <span>Amount</span>
                  </div>
                  {dayClosingData?.payments_received?.items?.length === 0 ? (
                    <div className="text-[10px] text-slate-400 italic text-center py-0.5">
                      No cash payments received on this date.
                    </div>
                  ) : (
                    <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5 pl-2">
                      {dayClosingData?.payments_received?.items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[10.5px] text-slate-800">
                          <span className="truncate max-w-[170px]">
                            {it.account_name} {it.naration ? `(${it.naration})` : ""}
                          </span>
                          <span className="font-mono font-medium shrink-0">
                            Rs. {Number(it.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dotted Divider */}
                <div className="border-t border-dashed border-slate-900 my-2" />

                {/* 5. CLOSING CASH */}
                <div className="my-2 flex justify-between items-center py-0.5 bg-white">
                  <span className="font-serif font-bold text-sm text-slate-900 tracking-wide">
                    Closing Cash
                  </span>
                  <span className="font-mono font-bold text-base text-slate-900">
                    Rs. {netCashInHand.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Doctor Signature Line with ample signing room */}
                <div className="mt-20 sm:mt-24 flex justify-end">
                  <div className="border-t border-slate-900 w-44 text-center text-[9px] font-bold uppercase pt-1.5 text-slate-800">
                    DR. SIGNATURE
                  </div>
                </div>

                {/* Watermark Footer */}
                <div className="mt-2 pt-1 border-t border-dotted border-slate-400 text-center font-mono text-[8px] text-slate-500">
                  <div className="font-bold text-slate-700">*** Powered by CliniCore Software ***</div>
                  <div>K.B Developer 03142291356</div>
                </div>
              </div>
            </div>
          </section>

          {/* ======================= RIGHT COLUMN: OPERATIONAL CONTROLS (7-8 Cols) ======================= */}
          <section aria-label="Operational Controls" className="lg:col-span-7 xl:col-span-8 space-y-2.5">
            {/* ROW 1: WhatsApp Report + Closing Config Controls in 2-Column Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-stretch">
              {/* WhatsApp Quick Dispatcher (5 Cols) */}
              <div className="sm:col-span-5 bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 rounded-xl p-2.5 sm:p-3 text-white shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-teal-100" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 012.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24M8.53 7.33c-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.57c.13.16 1.74 2.67 4.23 3.74.59.26 1.05.41 1.41.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29s-1.47-.73-1.7-.81c-.23-.09-.39-.13-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.53.07-.25-.13-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43z"></path>
                        </svg>
                      </div>
                      <h3 className="font-bold text-[11px] tracking-tight text-white uppercase">WhatsApp Report</h3>
                    </div>
                    <span className="bg-white/20 text-white text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                      1-Click
                    </span>
                  </div>
                  <input
                    type="text"
                    value={whatsAppNo}
                    onChange={(e) => setWhatsAppNo(e.target.value)}
                    placeholder="03473100304"
                    className="w-full bg-black/20 border border-white/25 rounded-lg px-2.5 py-1 text-white placeholder-teal-200/60 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-white/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="mt-2 w-full bg-white hover:bg-teal-50 text-teal-900 font-semibold px-2.5 py-1 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                  <span>Send WhatsApp</span>
                </button>
              </div>

              {/* Closing Config Panel (7 Cols) */}
              <div className="sm:col-span-7 bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 space-y-2 shadow-2xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5" htmlFor="closingDateInput">
                      Closing Date
                    </label>
                    <input
                      id="closingDateInput"
                      type="date"
                      value={closingDate}
                      onChange={(e) => setClosingDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-mono text-xs focus:bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500" htmlFor="drawerFloatInput">
                        Opening Float (Morning Cash)
                      </label>
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2 flex items-center font-mono font-medium text-slate-400 text-xs">
                        Rs.
                      </span>
                      <input
                        id="drawerFloatInput"
                        type="number"
                        min="0"
                        value={openingCash || ""}
                        onChange={(e) => handleOpeningCashChange(e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-amber-300 rounded-lg pl-7 pr-2 py-1 text-slate-900 font-mono text-xs font-semibold focus:bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handlePrintZReport()}
                    className="flex-1 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold py-1.5 px-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-teal-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                    <span>Print 80mm Slip</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleFullScreen}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1.5 px-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1 border border-slate-200 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                    <span>Full Screen</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ROW 2: Operator Accountability & Archived Shift Logs (Side-by-Side on md+) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-stretch">
              {/* Operator Cash Accountability Card (6 Cols) */}
              <div className="sm:col-span-6 bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-[11px] text-slate-900 leading-tight">Operator Accountability</h4>
                      <p className="text-[9px] text-slate-400">Cashier breakdown</p>
                    </div>
                  </div>
                  <span className="bg-slate-100 text-slate-600 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full border border-slate-200">
                    {operatorBreakdown.length} {operatorBreakdown.length === 1 ? "User" : "Users"}
                  </span>
                </div>

                {operatorBreakdown.length === 0 ? (
                  <div className="py-3 text-center text-[10px] text-slate-400 italic">
                    No retail sales recorded on this date.
                  </div>
                ) : (
                  <div className="space-y-1 pt-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-0.5">
                    {operatorBreakdown.map((op, idx) => (
                      <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-teal-50/50 border border-teal-100 text-xs">
                        <div className="truncate max-w-[130px]">
                          <span className="font-bold text-slate-900 text-[11px] truncate block">{op.name}</span>
                          <div className="text-[9px] text-slate-500">{op.count} invoices</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-teal-950 font-mono text-xs">Rs. {op.cashSales.toLocaleString()}</div>
                          <div className="text-[8.5px] text-slate-400 font-mono">Tot: Rs. {op.totalSales.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Saved Shift Closings History Log (6 Cols) */}
              <div className="sm:col-span-6 bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                      <svg className="w-3.5 h-3.5 text-teal-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-[11px] text-slate-900 leading-tight">Archived Shift Logs</h4>
                      <p className="text-[9px] text-slate-400">Past closures</p>
                    </div>
                  </div>
                  <span className="text-[9.5px] text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                    {savedClosings.length} logs
                  </span>
                </div>

                {savedClosings.length === 0 ? (
                  <div className="py-3 text-center text-[10px] text-slate-400 italic">
                    No archived shift logs found.
                  </div>
                ) : (
                  <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1 pt-1.5 pr-0.5">
                    {savedClosings.map((c) => (
                      <div key={c.id} className="p-1.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                        <div className="truncate max-w-[110px]">
                          <div className="font-bold text-slate-900 text-[10.5px] truncate">{new Date(c.closed_at || c.date).toLocaleDateString()}</div>
                          <div className="text-[8.5px] text-slate-500 truncate">{c.closed_by || "Cashier"}</div>
                        </div>
                        <div className="text-right flex items-center gap-1 shrink-0">
                          <span className="font-bold text-slate-900 font-mono text-[11px]">Rs. {(c.expected_cash || 0).toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={() => handlePrintZReport(c)}
                            className="p-1 text-teal-700 hover:bg-teal-100 rounded cursor-pointer"
                            title="Print Slip"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClosing(c.id)}
                            className="p-1 text-rose-500 hover:bg-rose-100 rounded cursor-pointer"
                            title="Delete"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ROW 3: Physical Cash Drawer Denominations (Full Width of Right Column) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDenomCounter(!showDenomCounter)}
                className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 leading-tight">
                      Physical Cash Drawer Denominations (Count Notes)
                    </h4>
                    <p className="text-[9.5px] text-slate-400">Physical note quantities in till</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {physicalCashTotal > 0 && (
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Rs. {physicalCashTotal.toLocaleString()}
                    </span>
                  )}
                  <svg
                    className={`w-4 h-4 text-slate-400 transform transition-transform duration-200 ${showDenomCounter ? "" : "rotate-180"}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
              </button>

              {showDenomCounter && (
                <div className="p-2.5 sm:p-3 border-t border-slate-100 bg-slate-50/40 space-y-2.5">
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                    {[
                      { note: 5000, key: "note5000" },
                      { note: 1000, key: "note1000" },
                      { note: 500, key: "note500" },
                      { note: 100, key: "note100" },
                      { note: 75, key: "note75" },
                      { note: 50, key: "note50" },
                      { note: 20, key: "note20" },
                      { note: 10, key: "note10" },
                    ].map(({ note, key }) => {
                      const count = Number(denominations[key]) || 0;
                      const subtotal = note * count;
                      return (
                        <div key={key} className="bg-white p-1.5 rounded-lg border border-slate-200 text-center">
                          <div className="text-[10px] font-bold text-slate-700 leading-tight">
                            Rs. {note}
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={denominations[key] || ""}
                            onChange={(e) => setDenominations({ ...denominations, [key]: Number(e.target.value) })}
                            placeholder="0"
                            className="denom-input w-full bg-slate-50 border border-slate-200 rounded text-xs font-mono py-0.5 px-1 my-1 focus:bg-white focus:ring-1 focus:ring-teal-600 focus:outline-none text-center"
                          />
                          <div className="text-[8.5px] text-slate-400 font-mono truncate leading-none">
                            Rs. {subtotal.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Live Variance Status, Remarks & Shift Save Action */}
                  <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-600">Total:</span>
                      <span className="font-mono font-bold text-teal-800 text-xs">
                        Rs. {physicalCashTotal.toLocaleString()}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className={`text-[10.5px] font-bold font-mono px-1.5 py-0.5 rounded ${
                        cashVariance === 0
                          ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          : cashVariance < 0
                          ? "bg-rose-100 text-rose-900 border border-rose-300"
                          : "bg-amber-100 text-amber-900 border border-amber-300"
                      }`}>
                        {cashVariance === 0
                          ? "Balanced"
                          : cashVariance < 0
                          ? `Short: -Rs. ${Math.abs(cashVariance).toLocaleString()}`
                          : `Surplus: +Rs. ${cashVariance.toLocaleString()}`}
                      </span>
                    </div>

                    <div className="flex-1 min-w-[140px]">
                      <input
                        type="text"
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                        placeholder="Closing notes / remarks..."
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:bg-white focus:border-teal-600 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveShiftClosing}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs shrink-0"
                    >
                      Lock &amp; Save Shift
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: 📈 OPD Consultation Fee Trends                                 */}
      {/* ===================================================================== */}
      {(activeTab === "trends" || !canViewAllFinancials) && (
        <div className="space-y-4">
          {/* Range Toggle */}
          <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1 self-start">
            {RANGES.map((r) => (
              <button
                key={r}
                id={`range-${r}`}
                onClick={() => setRange(r)}
                className={`min-h-[32px] px-3 py-1 rounded-lg font-bold text-xs uppercase transition-all cursor-pointer ${
                  range === r
                    ? "bg-teal-700 text-white shadow-2xs"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col gap-1.5 shadow-2xs">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Consultation Fees</p>
                  <p className="text-xl sm:text-2xl font-bold text-teal-800 font-mono">{formatCurrency(summary.total_fees)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col gap-1.5 shadow-2xs">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">OPD Patient Visits</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">{summary.visit_count}</p>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                  Fee Breakdown — {range.charAt(0).toUpperCase() + range.slice(1)}
                </p>
                {summary.chart_data.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No visits in this period.</p>
                ) : (
                  <div className="flex items-end gap-2.5 overflow-x-auto custom-scrollbar pb-1.5" style={{ minHeight: "120px" }}>
                    {summary.chart_data.map((d, i) => {
                      const pct = Math.max(4, Math.round((d.fees / maxFee) * 100));
                      return (
                        <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] font-bold text-slate-600 font-mono">{formatCurrency(d.fees)}</span>
                          <div
                            className="w-9 bg-teal-600 hover:bg-teal-700 rounded-t-lg transition-all"
                            style={{ height: `${pct}px` }}
                            title={`${d.date}: ${formatCurrency(d.fees)}`}
                          />
                          <span className="text-[9.5px] font-bold text-slate-500 whitespace-nowrap font-mono">{d.date}</span>
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



