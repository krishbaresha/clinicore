import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import {
  dbVisits,
  dbInventory,
  dbSales,
  dbExpenses,
  dbUsers,
  dbPatients,
  dbStockTransfers,
  dbWarehouses,
  dbPurchases,
  dbB2BSales,
  dbParties,
} from "../api/db.js";
import { formatCurrency, formatTodayLong } from "../utils/formatters.js";
import { useTranslation } from "react-i18next";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Doctor ke liye strict data isolation: sirf apna OPD data dikhe
  const isDoctor = user?.role === "doctor";
  const isWarehouseUser =
    user?.role === "warehouse" ||
    user?.role === "warehouse_incharge" ||
    user?.role === "warehouse_manager";
  const [syncTick, setSyncTick] = useState(0);

  // Statement Date Range Preset State (Admin / Owner & Authorized Financial Access Only)
  const [datePreset, setDatePreset] = useState("today"); // "today" | "yesterday" | "last7" | "this_month" | "last_month" | "custom"
  const [startDateInput, setStartDateInput] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDateInput, setEndDateInput] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const handleSync = () => setSyncTick((prev) => prev + 1);
    window.addEventListener("clinicflow_status_update", handleSync);
    return () => window.removeEventListener("clinicflow_status_update", handleSync);
  }, []);

  const isPrimaryDoctorOrOwner = Boolean(user?.is_owner || user?.role === "admin");
  const canViewFinancials = Boolean(isPrimaryDoctorOrOwner || user?.can_view_financials === true);

  // Dynamic Greeting based on time of day with matching SVG icon
  const greetingInfo = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return {
        en: "Good Morning",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      };
    } else if (hour >= 12 && hour < 17) {
      return {
        en: "Good Afternoon",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      };
    }
    return {
      en: "Good Evening",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
    };
  }, []);

  // Compute live stats efficiently in single-pass O(N) memoized block
  const {
    todayVisits,
    todaySales,
    todayExpenses,
    feesToday,
    myTodayVisits,
    myFeesToday,
    pharmacyRevenueToday,
    expensesToday,
    netRevenueToday,
    doctorBreakdown,
    lowStockItems,
    repeatRatio,
    newRatio,
    waitingVisits,
    completedVisits,
    myWaitingVisits,
    myInRoomVisit,
    activeWhObj,
    activeWhId,
    godownValue,
    godownUnits,
    todayWhPurchases,
    todayWhPurchasesVal,
    todayWhSales,
    todayWhSalesVal,
    todayWhExpenses,
    todayWhExpensesVal,
    totalPartyUdhaar,
    partiesWithUdhaarCount,
    whLowStockItems,
  } = useMemo(() => {
    const now = new Date();
    const todayYMD = now.toISOString().split("T")[0];

    const isMatchDate = (rawDate) => {
      if (!rawDate) return false;
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return false;
      const dYMD = d.toISOString().split("T")[0];

      if (datePreset === "today") {
        return dYMD === todayYMD;
      }
      if (datePreset === "yesterday") {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return dYMD === y.toISOString().split("T")[0];
      }
      if (datePreset === "last7") {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return d >= sevenDaysAgo && d <= now;
      }
      if (datePreset === "this_month") {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (datePreset === "last_month") {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
      }
      if (datePreset === "custom") {
        return dYMD >= startDateInput && dYMD <= endDateInput;
      }
      return dYMD === todayYMD;
    };

    const allVisits = dbVisits.getAll() || [];
    const tVisits = allVisits.filter((v) => isMatchDate(v.visit_date || v.created_at));
    const fToday = tVisits.reduce((sum, v) => sum + (v.fee_amount || 0), 0);

    const activeDocId = user?.userId || user?.id;
    const myTVisits = tVisits.filter((v) => v.doctor_id === activeDocId || (!v.doctor_id && activeDocId === "user_001"));
    const myFToday = myTVisits.reduce((sum, v) => sum + (v.fee_amount || 0), 0);

    const allSales = dbSales.getAll() || [];
    const tSales = allSales.filter((s) => isMatchDate(s.sale_date || s.date || s.created_at));
    const pRevToday = tSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

    const allExpenses = dbExpenses.getAll() || [];
    const activeWhId = user?.assigned_warehouse_id || "wh_001";
    const isWarehouseRole = user?.role === "warehouse" || user?.role === "warehouse_incharge" || user?.role === "warehouse_manager";
    const tExpenses = allExpenses.filter((e) => {
      const matchDate = isMatchDate(e.expense_date || e.date || e.created_at);
      if (!matchDate) return false;
      if (isWarehouseRole && !user?.is_owner && user?.role !== "admin") {
        return e.warehouse_id === activeWhId;
      }
      return true;
    });
    const expToday = tExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const netRevToday = fToday + pRevToday - expToday;

    // Doctor breakdown (Excludes non-doctor administrative accounts)
    const allUsers = dbUsers.getAll() || [];
    const doctors = allUsers.filter((u) => u.role === "doctor" && u.id !== "user_admin_001" && u.name !== "Clinic Administrator");
    const docBreakdown = doctors.map((doc) => {
      const docVisits = tVisits.filter((v) => v.doctor_id === doc.id || v.doctor_id === doc.userId);
      const docFees = docVisits.reduce((sum, v) => sum + (v.fee_amount || 0), 0);
      return {
        id: doc.id,
        name: doc.name || doc.full_name || "Doctor",
        specialization: doc.specialization || doc.qualification || "General Physician",
        is_owner: Boolean(doc.is_owner || doc.is_principal_doctor),
        visitsCount: docVisits.length,
        today_patient_count: docVisits.length,
        feesCollected: docFees,
        today_fees: docFees,
      };
    });

    const allInventory = dbInventory.getAll() || [];
    const lowStock = allInventory.filter((i) => (i.stock_qty || 0) <= (i.reorder_level || 10));

    const totVisits = allVisits.length;
    const allPatients = dbPatients.getAll() || [];
    const newPatientsToday = allPatients.filter((p) => isMatchDate(p.created_at || p.registered_date)).length;
    const rRatio = tVisits.length > 0 ? Math.round(((tVisits.length - newPatientsToday) / tVisits.length) * 100) : 0;
    const nRatio = tVisits.length > 0 ? 100 - rRatio : 100;

    const totalWait = tVisits.filter((v) => v.status === "waiting");
    const totalCompleted = tVisits.filter((v) => v.status === "completed" || v.status === "completed_reports_pending");

    const myWait = myTVisits.filter((v) => v.status === "waiting");
    const myInRoom = myTVisits.find((v) => v.status === "in_consultation");

    // Warehouse specific calculations
    const allWhs = dbWarehouses.getAll() || [];
    const activeWhObj = allWhs.find((w) => w.id === activeWhId) || allWhs[0] || { name: "Primary Godown", id: "wh_001" };

    const whValuation = dbWarehouses.getStockValuation ? dbWarehouses.getStockValuation(activeWhId) : { totalValue: 0, totalUnits: 0 };
    const godownValue = whValuation?.totalValue || 0;
    const godownUnits = whValuation?.totalUnits || 0;

    const allPurchases = (dbPurchases && dbPurchases.getAll ? dbPurchases.getAll() : []) || [];
    const todayWhPurchases = allPurchases.filter((p) => {
      return isMatchDate(p.purchase_date || p.date || p.created_at) && p.warehouse_id === activeWhId;
    });
    const todayWhPurchasesVal = todayWhPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);

    const allB2BSales = (dbB2BSales && dbB2BSales.getAll ? dbB2BSales.getAll() : []) || [];
    const todayWhSales = allB2BSales.filter((s) => {
      return isMatchDate(s.sale_date || s.date || s.created_at) && s.warehouse_id === activeWhId;
    });
    const todayWhSalesVal = todayWhSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

    const todayWhExpenses = allExpenses.filter((e) => {
      return isMatchDate(e.expense_date || e.date || e.created_at) && e.warehouse_id === activeWhId;
    });
    const todayWhExpensesVal = todayWhExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const allParties = (dbParties && dbParties.getAll ? dbParties.getAll() : []) || [];
    let totalPartyUdhaar = 0;
    let partiesWithUdhaarCount = 0;
    allParties.forEach((pty) => {
      const bal = Number(pty.current_balance || pty.balance || 0);
      if (bal > 0) {
        totalPartyUdhaar += bal;
        partiesWithUdhaarCount += 1;
      }
    });

    const whLowStockItems = allInventory.filter((item) => {
      const locQty = dbInventory.getLocationStock ? dbInventory.getLocationStock(item, activeWhId) : (item.stock_qty || 0);
      return locQty <= (item.reorder_level || 10);
    });

    return {
      todayVisits: tVisits,
      todaySales: tSales,
      todayExpenses: tExpenses,
      feesToday: fToday,
      myTodayVisits: myTVisits,
      myFeesToday: myFToday,
      pharmacyRevenueToday: pRevToday,
      expensesToday: expToday,
      netRevenueToday: netRevToday,
      doctorBreakdown: docBreakdown,
      lowStockItems: lowStock,
      totalVisits: totVisits,
      repeatRatio: rRatio,
      newRatio: nRatio,
      waitingVisits: totalWait,
      completedVisits: totalCompleted,
      myWaitingVisits: myWait,
      myInRoomVisit: myInRoom,
      activeWhObj,
      activeWhId,
      godownValue,
      godownUnits,
      todayWhPurchases,
      todayWhPurchasesVal,
      todayWhSales,
      todayWhSalesVal,
      todayWhExpenses,
      todayWhExpensesVal,
      totalPartyUdhaar,
      partiesWithUdhaarCount,
      whLowStockItems,
    };
  }, [syncTick, user, datePreset, startDateInput, endDateInput]);

  // Selected date preset description
  const selectedDateLabel = useMemo(() => {
    switch (datePreset) {
      case "today":
        return "Today (Aaj)";
      case "yesterday":
        return "Yesterday (Kal)";
      case "last7":
        return "Last 7 Days (Pichlay 7 Din)";
      case "this_month":
        return "This Month (Iss Mahine)";
      case "last_month":
        return "Last Month (Pichla Mahina)";
      case "custom":
        return `Custom: ${startDateInput} to ${endDateInput}`;
      default:
        return "Today (Aaj)";
    }
  }, [datePreset, startDateInput, endDateInput]);

  if (isWarehouseUser) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-300">
        {/* Header Greeting Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-teal-100/70 text-teal-800 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {greetingInfo.en} <span className="font-normal text-slate-600 font-serif" dir="rtl">({greetingInfo.ur})</span>, {user?.name || user?.full_name || "Warehouse Manager"}
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1 pl-10.5 font-medium flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatTodayLong()} • Location: {activeWhObj?.name || "Primary Godown"} ({activeWhId})
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => navigate("/store/purchases")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm rounded-xl shadow-xs transition duration-150 ease-in-out cursor-pointer"
              type="button"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
              </svg>
              <span>+ Inward Purchase (GRN)</span>
            </button>
            <button
              onClick={() => navigate("/store/warehouse")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm rounded-xl shadow-xs transition duration-150 ease-in-out cursor-pointer"
              type="button"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>+ B2B Wholesale Sale</span>
            </button>
          </div>
        </div>

        {/* 4 Core Warehouse KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Godown Stock Valuation</span>
              <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">Rs. {godownValue.toLocaleString()}</div>
              <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{godownUnits.toLocaleString()} total units in stock</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stock Inward (GRN)</span>
              <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">Rs. {todayWhPurchasesVal.toLocaleString()}</div>
              <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{todayWhPurchases.length} inward purchases</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">B2B Wholesale Outward</span>
              <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">Rs. {todayWhSalesVal.toLocaleString()}</div>
              <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{todayWhSales.length} wholesale bills issued</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Parties Credit (Udhaar)</span>
              <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-extrabold text-rose-600 tracking-tight">Rs. {totalPartyUdhaar.toLocaleString()}</div>
              <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{partiesWithUdhaarCount} party account(s) pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Warehouse Revenue Breakdown Bento */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/90">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Warehouse Net Revenue &amp; Expense Summary</h2>
                <p className="text-xs text-slate-500 font-medium">Daily operating metrics for {activeWhObj?.name || "Primary Godown"}</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/store/warehouse")}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition shadow-xs cursor-pointer"
              type="button"
            >
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <span>Manage Godown &amp; Transfers</span>
              <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 hover:border-teal-200 transition shadow-xs">
              <div className="flex items-center justify-between text-slate-600 text-xs font-bold uppercase tracking-wider">
                <span>Today's B2B Revenue</span>
                <div className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2" />
                  </svg>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold tracking-tight text-slate-900">Rs. {todayWhSalesVal.toLocaleString()}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">From {todayWhSales.length} wholesale bills</div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 hover:border-rose-100 transition shadow-xs">
              <div className="flex items-center justify-between text-rose-600 text-xs font-bold uppercase tracking-wider">
                <span>Warehouse Expenses</span>
                <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold tracking-tight text-rose-600">Rs. {todayWhExpensesVal.toLocaleString()}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">From {todayWhExpenses.length} expense vouchers</div>
              </div>
            </div>

            <div className="bg-teal-700 text-white rounded-xl p-4 border border-teal-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-teal-100 text-xs font-bold uppercase tracking-wider">
                <span>Warehouse Net Balance</span>
                <div className="h-7 w-7 rounded-lg bg-teal-800/80 text-teal-200 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold tracking-tight text-white">Rs. {(todayWhSalesVal - todayWhExpensesVal).toLocaleString()}</div>
                <div className="text-[11px] text-teal-100/90 mt-1 font-medium">B2B Revenue − Expenses</div>
              </div>
            </div>
          </div>
        </div>

        {/* Low Stock Items in Warehouse */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/90">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              <h3 className="font-bold text-sm text-slate-900">
                Low Stock Alerts in {activeWhObj?.name || "Assigned Warehouse"}
              </h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {whLowStockItems.length} Low Items
            </span>
          </div>

          {whLowStockItems.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-xl mt-4">
              ✅ All stock levels in {activeWhObj?.name || "assigned godown"} are healthy and above reorder thresholds.
            </div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider bg-slate-50">
                    <th className="py-2.5 px-3">Medicine SKU</th>
                    <th className="py-2.5 px-3">Company</th>
                    <th className="py-2.5 px-3 text-right">Location Stock</th>
                    <th className="py-2.5 px-3 text-right">Reorder Level</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {whLowStockItems.slice(0, 8).map((item) => {
                    const locQty = dbInventory.getLocationStock ? dbInventory.getLocationStock(item, activeWhId) : (item.stock_qty || 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{item.medicine_name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.company_name || item.brand_name || "Generic"}</td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-600">{locQty} units</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{item.reorder_level || 10} units</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => navigate("/store/purchases")}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 font-bold text-[11px] hover:bg-teal-100 transition-colors cursor-pointer"
                          >
                            + Order Stock
                          </button>
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
    );
  }

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-200 w-full max-w-full">
      {/* ── 1. Welcome Banner & Primary Action Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-teal-100/70 text-teal-800 flex items-center justify-center shrink-0 shadow-2xs">
              {greetingInfo.icon}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {greetingInfo.en}, {user?.name || user?.full_name || "Clinic Administrator"}
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1 pl-10.5 font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4 text-slate-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatTodayLong()}
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isDoctor ? (
            <>
              <button
                onClick={() => navigate("/doctor/queue")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm rounded-xl shadow-xs transition duration-150 ease-in-out cursor-pointer"
                type="button"
              >
                <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Open My OPD Queue</span>
              </button>
              <button
                onClick={() => navigate("/patients")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl border border-slate-200 transition duration-150 ease-in-out cursor-pointer"
                type="button"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Patients &amp; EMR</span>
              </button>
            </>
          ) : (
            <button
              id="dashboard-add-patient-btn"
              onClick={() => navigate("/reception/register")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm rounded-xl shadow-xs transition duration-150 ease-in-out cursor-pointer"
              type="button"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Register Patient Token</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Filter Bar: Financial Statement Period (Admin / Owner Secured) ── */}
      {canViewFinancials && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left Info & Security Badge */}
            <div className="flex items-start sm:items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 shadow-xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-700">Financial Statement Period Filter</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 uppercase tracking-wider">
                    <svg className="w-2.5 h-2.5 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                      <path clipRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" fillRule="evenodd" />
                    </svg>
                    Admin / Owner Secured
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                  <span>Showing data for:</span>
                  <span className="font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/80">
                    {selectedDateLabel}
                  </span>
                </p>
              </div>
            </div>

            {/* Right: Filter Pill Selector Buttons */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 overflow-x-auto max-w-full" data-purpose="period-selector">
              <button
                type="button"
                onClick={() => setDatePreset("today")}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  datePreset === "today"
                    ? "font-semibold bg-teal-700 text-white shadow-xs"
                    : "font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                Today (Aaj)
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("yesterday")}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  datePreset === "yesterday"
                    ? "font-semibold bg-teal-700 text-white shadow-xs"
                    : "font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                Yesterday (Kal)
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("last7")}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  datePreset === "last7"
                    ? "font-semibold bg-teal-700 text-white shadow-xs"
                    : "font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("this_month")}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  datePreset === "this_month"
                    ? "font-semibold bg-teal-700 text-white shadow-xs"
                    : "font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("custom")}
                className={`whitespace-nowrap inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  datePreset === "custom"
                    ? "font-semibold bg-teal-700 text-white shadow-xs"
                    : "font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <svg className="w-3.5 h-3.5 fill-none stroke-current" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Custom Range
              </button>
            </div>
          </div>

          {/* Custom Date Range Picker Subbar */}
          {datePreset === "custom" && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-600">Select Range:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(e) => setStartDateInput(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono outline-none focus:border-teal-600 focus:bg-white"
                />
                <span className="text-xs font-bold text-slate-400">to</span>
                <input
                  type="date"
                  value={endDateInput}
                  onChange={(e) => setEndDateInput(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono outline-none focus:border-teal-600 focus:bg-white"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. Key Metric Cards Row ── */}
      {/* Mobile Slider */}
      <div className="block md:hidden">
        <Swiper
          modules={[Pagination]}
          pagination={{ clickable: true, dynamicBullets: true }}
          spaceBetween={12}
          slidesPerView={1.15}
          className="pb-8"
        >
          {/* Slide 1: Patients Today */}
          <SwiperSlide className="h-auto">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {canViewFinancials ? "Patients Today" : "My Patients Today"}
                </span>
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {canViewFinancials ? todayVisits.length : myTodayVisits.length}
                </div>
                <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    {canViewFinancials
                      ? `${todayVisits.length} total OPD visits`
                      : `${myTodayVisits.length} visit${myTodayVisits.length === 1 ? "" : "s"} in my chamber`}
                  </span>
                </div>
              </div>
            </div>
          </SwiperSlide>

          {/* Slide 2: Fees Collected */}
          <SwiperSlide className="h-auto">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {canViewFinancials ? (isDoctor ? "My Fees Today" : "Fees Collected") : "Consultations Done"}
                </span>
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {canViewFinancials
                    ? formatCurrency(isDoctor ? myFeesToday : feesToday)
                    : isDoctor
                    ? `${myTodayVisits.filter((v) => v.status === "completed" || v.status === "completed_reports_pending").length} Done`
                    : "🔒 Confidential"}
                </div>
                <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>{canViewFinancials ? "Direct cash & card counter" : isDoctor ? "Chamber consultations done" : "Owner / Admin Role Required"}</span>
                </div>
              </div>
            </div>
          </SwiperSlide>

          {/* Slide 3: New vs Repeat (or Chamber Queue for Doctor) */}
          <SwiperSlide className="h-auto">
            {isDoctor ? (
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Chamber Queue</span>
                  <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {myWaitingVisits.length} <span className="text-sm font-semibold text-slate-500">Patients</span>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-teal-700 flex items-center justify-between">
                    <span>{myWaitingVisits.length > 0 ? `Next: #${myWaitingVisits[0].token_number}` : "Queue is Clear"}</span>
                    <button onClick={() => navigate("/doctor/queue")} className="underline font-bold">
                      Call →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("dashboard.newVsRepeat", "New vs Repeat")}</span>
                  <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-teal-700 tracking-tight">{newRatio}%</span>
                    <span className="text-xs font-semibold text-slate-500">New</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-lg font-bold text-slate-700">{repeatRatio}%</span>
                    <span className="text-xs text-slate-400">Repeat</span>
                  </div>
                  <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                    <div className="bg-teal-600 h-full rounded-full" style={{ width: `${newRatio}%` }}></div>
                    <div className="bg-slate-300 h-full" style={{ width: `${repeatRatio}%` }}></div>
                  </div>
                </div>
              </div>
            )}
          </SwiperSlide>

          {/* Slide 4: Low Stock Alerts */}
          {!isDoctor && (
            <SwiperSlide className="h-auto">
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600">{t("dashboard.lowStockAlerts", "Low Stock Alerts")}</span>
                  <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{lowStockItems.length}</div>
                  <div className="mt-2 text-xs font-medium flex items-center gap-1.5">
                    {lowStockItems.length === 0 ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {t("dashboard.allStockOk", "All pharmacy stock levels OK")}
                      </span>
                    ) : (
                      <span className="text-rose-600 font-semibold">{lowStockItems.length} item(s) need reordering</span>
                    )}
                  </div>
                </div>
              </div>
            </SwiperSlide>
          )}
        </Swiper>
      </div>

      {/* Desktop Grid Layout */}
      <div
        className={
          isDoctor
            ? "hidden md:grid md:grid-cols-3 gap-4"
            : "hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4"
        }
        data-purpose="quick-metrics-row"
      >
        {/* Card 1: Patients Today */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {canViewFinancials ? t("dashboard.todayPatients", "Patients Today") : "My Patients Today"}
            </span>
            <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {canViewFinancials ? todayVisits.length : myTodayVisits.length}
            </div>
            <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {canViewFinancials
                  ? `${todayVisits.length} total OPD visits`
                  : `${myTodayVisits.length} visit${myTodayVisits.length === 1 ? "" : "s"} in my OPD chamber`}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Fees Collected */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {canViewFinancials ? (isDoctor ? "My Fees Today" : t("dashboard.feesCollected", "Fees Collected")) : "Completed Consultations"}
            </span>
            <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {canViewFinancials
                ? formatCurrency(isDoctor ? myFeesToday : feesToday)
                : isDoctor
                ? `${myTodayVisits.filter((v) => v.status === "completed" || v.status === "completed_reports_pending").length} Done`
                : "🔒 Confidential"}
            </div>
            <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{canViewFinancials ? "Direct cash & card counter" : isDoctor ? "Chamber Consultations Done" : "Owner / Admin Role Required"}</span>
            </div>
          </div>
        </div>

        {/* Card 3: New vs Repeat (or Doctor Chamber Queue) */}
        {isDoctor ? (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800">Waiting Queue</span>
              <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {myWaitingVisits.length} <span className="text-sm font-semibold text-slate-500">Patients</span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-teal-800">
                <span>
                  {myInRoomVisit
                    ? `In Room: #${myInRoomVisit.token_number}`
                    : myWaitingVisits.length > 0
                    ? `Next: #${myWaitingVisits[0].token_number}`
                    : "Clear"}
                </span>
                <button
                  onClick={() => navigate("/doctor/queue")}
                  className="font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                >
                  Call Next →
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("dashboard.newVsRepeat", "New vs Repeat")}</span>
              <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-teal-700 tracking-tight">{newRatio}%</span>
                <span className="text-xs font-semibold text-slate-500">New</span>
                <span className="text-slate-300">|</span>
                <span className="text-lg font-bold text-slate-700">{repeatRatio}%</span>
                <span className="text-xs text-slate-400">Repeat</span>
              </div>
              <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                <div className="bg-teal-600 h-full rounded-full" style={{ width: `${newRatio}%` }}></div>
                <div className="bg-slate-300 h-full" style={{ width: `${repeatRatio}%` }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Card 4: Low Stock Alerts */}
        {!isDoctor && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600">{t("dashboard.lowStockAlerts", "Low Stock Alerts")}</span>
              <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{lowStockItems.length}</div>
              <div className="mt-2 text-xs font-medium flex items-center gap-1.5">
                {lowStockItems.length === 0 ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {t("dashboard.allStockOk", "All pharmacy stock levels OK")}
                  </span>
                ) : (
                  <span className="text-rose-600 font-semibold">{lowStockItems.length} item(s) need reordering</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Bento Financial Breakdown Section ── */}
      {canViewFinancials && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/90" data-purpose="revenue-breakdown-bento">
          {/* Section Header with Ledger Action */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Clinic Financial Revenue Breakdown</h2>
                <p className="text-xs text-slate-500 font-medium">Real-time daily earnings summary for Principal Doctor &amp; Owner</p>
              </div>
            </div>

            {/* View Ledger Analytics Button */}
            <button
              onClick={() => navigate("/fees")}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition shadow-xs cursor-pointer"
              type="button"
            >
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <span>View Ledger Analytics</span>
              <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          {/* Revenue 4-Column Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            {/* Item 1: OPD Doctor Fees */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 hover:border-teal-200 transition shadow-xs">
              <div className="flex items-center justify-between text-slate-600 text-xs font-bold uppercase tracking-wider">
                <span>OPD Doctor Fees</span>
                <div className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold tracking-tight text-slate-900">Rs. {feesToday.toLocaleString()}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">From {todayVisits.length} consultation tokens</div>
              </div>
            </div>

            {/* Item 2: Pharmacy Store Sales */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 hover:border-teal-200 transition shadow-xs">
              <div className="flex items-center justify-between text-slate-600 text-xs font-bold uppercase tracking-wider">
                <span>Pharmacy Store Sales</span>
                <div className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold tracking-tight text-slate-900">Rs. {pharmacyRevenueToday.toLocaleString()}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">From {todaySales.length} store sales receipts</div>
              </div>
            </div>

            {/* Item 3: Daily Expenses */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 hover:border-rose-100 transition shadow-xs">
              <div className="flex items-center justify-between text-rose-600 text-xs font-bold uppercase tracking-wider">
                <span>Daily Expenses</span>
                <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold tracking-tight text-rose-600">Rs. {expensesToday.toLocaleString()}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">From {todayExpenses.length} expense vouchers</div>
              </div>
            </div>

            {/* Item 4: Net Overall Revenue (Highlighted Deep Teal Accent) */}
            <div className="bg-teal-700 text-white rounded-xl p-4 border border-teal-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-teal-100 text-xs font-bold uppercase tracking-wider">
                <span>Net Overall Revenue</span>
                <div className="h-7 w-7 rounded-lg bg-teal-800/80 text-teal-200 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold tracking-tight text-white">Rs. {netRevenueToday.toLocaleString()}</div>
                <div className="text-[11px] text-teal-100/90 mt-1 font-medium">Fees + Store Sales − Expenses</div>
              </div>
            </div>
          </div>

          {/* Doctor-By-Doctor Breakdown Subsection */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Today's Doctor-by-Doctor OPD Revenue Breakdown</h3>
            </div>

            {doctorBreakdown.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <p className="text-xs text-slate-500">No doctors registered yet.</p>
                <button
                  type="button"
                  onClick={() => navigate("/settings")}
                  className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer inline-flex items-center gap-1"
                >
                  Manage Doctors in Clinic Settings (/settings)
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {doctorBreakdown.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between hover:border-teal-200 transition shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 shadow-xs">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 leading-tight truncate">{doc.name}</span>
                          {doc.is_owner && (
                            <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-amber-500 text-slate-950 rounded uppercase tracking-wide">
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-medium truncate">{doc.specialization || "General Physician"}</div>
                        <div className="text-[11px] text-teal-700 font-semibold mt-0.5">
                          {doc.visitsCount ?? doc.today_patient_count ?? 0} Patients Today
                        </div>
                      </div>
                    </div>

                    <div className="text-right pl-3 border-l border-slate-200 shrink-0">
                      <div className="text-sm font-bold text-teal-800 font-mono">
                        Rs. {(Number(doc.feesCollected ?? doc.today_fees) || 0).toLocaleString()}
                      </div>
                      <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">OPD Collection</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 5. Direct Counter Shortcuts (for non-doctor staff) ── */}
      {!isDoctor && (
        <div className="pt-2" data-purpose="quick-action-launchers">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Direct Counter Shortcuts
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Quick Action 1: Register Patient Token */}
            <button
              onClick={() => navigate("/reception/register")}
              className="group flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 hover:border-teal-500 hover:shadow-md transition text-left cursor-pointer"
              type="button"
            >
              <div className="h-11 w-11 rounded-xl bg-teal-50 group-hover:bg-teal-600 text-teal-700 group-hover:text-white flex items-center justify-center transition shrink-0 border border-teal-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 group-hover:text-teal-700 transition">Register Patient Token</p>
                <p className="text-xs text-slate-500 truncate">Create OPD slip &amp; queue entry</p>
              </div>
            </button>

            {/* Quick Action 2: POS Store & Pharmacy */}
            <button
              onClick={() => navigate("/store/pos")}
              className="group flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 hover:border-teal-500 hover:shadow-md transition text-left cursor-pointer"
              type="button"
            >
              <div className="h-11 w-11 rounded-xl bg-teal-50 group-hover:bg-teal-600 text-teal-700 group-hover:text-white flex items-center justify-center transition shrink-0 border border-teal-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 group-hover:text-teal-700 transition">POS Store &amp; Pharmacy</p>
                <p className="text-xs text-slate-500 truncate">Dispense medicines &amp; OTC sales</p>
              </div>
            </button>

            {/* Quick Action 3: Daily Cash & Reports */}
            <button
              onClick={() => navigate("/fees")}
              className="group flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 hover:border-teal-500 hover:shadow-md transition text-left cursor-pointer"
              type="button"
            >
              <div className="h-11 w-11 rounded-xl bg-teal-50 group-hover:bg-teal-600 text-teal-700 group-hover:text-white flex items-center justify-center transition shrink-0 border border-teal-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 group-hover:text-teal-700 transition">Daily Cash &amp; Reports</p>
                <p className="text-xs text-slate-500 truncate">Day-end tally &amp; audit statements</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
