import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { dbVisits, dbInventory, dbSales, dbExpenses, dbUsers, dbPatients, dbStockTransfers, dbWarehouses, dbPurchases, dbB2BSales, dbParties } from "../api/db.js";
import { formatCurrency, formatTodayLong, getGreeting } from "../utils/formatters.js";
import { useTranslation } from "react-i18next";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

function StatCard({ label, value, icon, subline, iconBg, labelColor, valueColor, children }) {
  return (
    <div className="glass-card p-md flex flex-col gap-4 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300 h-full">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-secondary-container/30 rounded-full blur-xl group-hover:bg-secondary-container/50 transition-colors" />
      <div className="flex justify-between items-start z-10">
        <div>
          <p className={`font-label-md text-label-md mb-1 uppercase tracking-wider ${labelColor || "text-outline"}`}>
            {label}
          </p>
          <h3 className={`font-display-lg text-display-lg font-bold ${valueColor || "text-on-surface"}`}>
            {value}
          </h3>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg || "bg-secondary-container/50"}`}>
          <span className="material-symbols-outlined text-2xl text-primary-container">{icon}</span>
        </div>
      </div>
      {subline && <div className="z-10 flex items-center gap-2 text-primary font-body-sm text-body-sm">{subline}</div>}
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Doctor ke liye strict data isolation: sirf apna OPD data dikhe
  const isDoctor = user?.role === "doctor";
  const isWarehouseUser = user?.role === "warehouse" || user?.role === "warehouse_incharge" || user?.role === "warehouse_manager";
  const [syncTick, setSyncTick] = useState(0);

  useEffect(() => {
    const handleSync = () => setSyncTick((t) => t + 1);
    window.addEventListener("clinicflow_status_update", handleSync);
    return () => window.removeEventListener("clinicflow_status_update", handleSync);
  }, []);

  const isPrimaryDoctorOrOwner = Boolean(user?.is_owner || user?.role === "admin");
  const canViewFinancials = Boolean(
    isPrimaryDoctorOrOwner ||
    user?.can_view_financials === true
  );

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
    const allVisits = dbVisits.getAll() || [];
    const todayStr = new Date().toDateString();
    const tVisits = allVisits.filter((v) => new Date(v.visit_date).toDateString() === todayStr);
    const fToday = tVisits.reduce((sum, v) => sum + (v.fee_amount || 0), 0);

    const activeDocId = user?.userId || user?.id;
    const myTVisits = tVisits.filter((v) => v.doctor_id === activeDocId || (!v.doctor_id && activeDocId === "user_001"));
    const myFToday = myTVisits.reduce((sum, v) => sum + (v.fee_amount || 0), 0);

    const allSales = dbSales.getAll() || [];
    const tSales = allSales.filter((s) => new Date(s.sale_date).toDateString() === todayStr);
    const pRevToday = tSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

    const allExpenses = dbExpenses.getAll() || [];
    const activeWhId = user?.assigned_warehouse_id || "wh_001";
    const isWarehouseRole = user?.role === "warehouse" || user?.role === "warehouse_incharge" || user?.role === "warehouse_manager";
    const tExpenses = allExpenses.filter((e) => {
      const matchDate = new Date(e.expense_date || e.date).toDateString() === todayStr;
      if (!matchDate) return false;
      if (isWarehouseRole && !user?.is_owner && user?.role !== "admin") {
        return e.warehouse_id === activeWhId;
      }
      return true;
    });
    const expToday = tExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const netRevToday = fToday + pRevToday - expToday;

    // Doctor breakdown
    const allUsers = dbUsers.getAll() || [];
    const doctors = allUsers.filter((u) => u.role === "doctor" || u.is_principal_doctor);
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
    const newPatientsToday = allPatients.filter((p) => new Date(p.created_at || p.registered_date).toDateString() === todayStr).length;
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
      const pDate = new Date(p.purchase_date || p.date || p.created_at).toDateString();
      return pDate === todayStr && p.warehouse_id === activeWhId;
    });
    const todayWhPurchasesVal = todayWhPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);

    const allB2BSales = (dbB2BSales && dbB2BSales.getAll ? dbB2BSales.getAll() : []) || [];
    const todayWhSales = allB2BSales.filter((s) => {
      const sDate = new Date(s.sale_date || s.date || s.created_at).toDateString();
      return sDate === todayStr && s.warehouse_id === activeWhId;
    });
    const todayWhSalesVal = todayWhSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

    const todayWhExpenses = allExpenses.filter((e) => {
      const eDate = new Date(e.expense_date || e.date || e.created_at).toDateString();
      return eDate === todayStr && e.warehouse_id === activeWhId;
    });
    const todayWhExpensesVal = todayWhExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const allParties = (dbParties && dbParties.getAll ? dbParties.getAll() : []) || [];
    let totalPartyUdhaar = 0;
    let partiesWithUdhaarCount = 0;
    allParties.forEach((p) => {
      const bal = Number(p.current_balance || p.balance_due || p.balance) || 0;
      if (bal > 0) {
        totalPartyUdhaar += bal;
        partiesWithUdhaarCount++;
      }
    });

    const whLowStockItems = allInventory.filter((item) => {
      const qty = dbInventory.getLocationStock ? dbInventory.getLocationStock(item, activeWhId) : (item.stock_qty || 0);
      return qty <= (item.reorder_level || 10);
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
  }, [syncTick, user]);

  if (isWarehouseUser) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-300">
        {/* Header Greeting Banner */}
        <header className="glass-card p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-teal-200/60 bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-amber-300 font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-base">warehouse</span>
              <span>Central Warehouse Operations • Location: {activeWhObj?.name || "Primary Godown"} ({activeWhId})</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {getGreeting()}, {user?.name || user?.full_name || "Warehouse Manager"}!
            </h1>
            <p className="text-xs text-teal-200">
              {formatTodayLong()} — Real-time Stock, B2B Inward/Outward &amp; Parties Udhaar Summary
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate("/store/purchases")}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add_business</span>
              + Inward Purchase (GRN)
            </button>
            <button
              onClick={() => navigate("/store/warehouse")}
              className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">point_of_sale</span>
              + B2B Wholesale Sale
            </button>
          </div>
        </header>

        {/* 4 Core Warehouse KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Godown Stock Valuation</p>
                <h3 className="text-2xl font-black text-teal-900 mt-1">Rs. {godownValue.toLocaleString()}</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">inventory_2</span>
              </div>
            </div>
            <div className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg w-fit">
              📦 {godownUnits.toLocaleString()} total units in stock
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today&apos;s Stock Inward (GRN)</p>
                <h3 className="text-2xl font-black text-cyan-900 mt-1">Rs. {todayWhPurchasesVal.toLocaleString()}</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-cyan-100 text-cyan-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">local_shipping</span>
              </div>
            </div>
            <div className="text-xs font-semibold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-lg w-fit">
              🚚 {todayWhPurchases.length} supplier inward bill(s)
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today&apos;s B2B Wholesale Outward</p>
                <h3 className="text-2xl font-black text-amber-900 mt-1">Rs. {todayWhSalesVal.toLocaleString()}</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">point_of_sale</span>
              </div>
            </div>
            <div className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg w-fit">
              📜 {todayWhSales.length} B2B bill(s) issued today
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Parties Credit (Udhaar)</p>
                <h3 className="text-2xl font-black text-rose-900 mt-1">Rs. {totalPartyUdhaar.toLocaleString()}</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
              </div>
            </div>
            <div className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg w-fit">
              👥 {partiesWithUdhaarCount} party account(s) pending
            </div>
          </div>
        </div>

        {/* Specific Warehouse Revenue Breakdown */}
        <section className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl p-6 shadow-lg border border-teal-800/60 space-y-4">
          <div className="flex items-center justify-between border-b border-teal-800/80 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-amber-400 text-2xl">analytics</span>
              <div>
                <h3 className="font-bold text-lg leading-tight">Warehouse Net Revenue &amp; Expense Summary</h3>
                <p className="text-xs text-teal-200">Daily financial operating metrics for {activeWhObj?.name || "Assigned Location"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-xs text-teal-200 font-semibold uppercase tracking-wider mb-1">Today&apos;s B2B Revenue</div>
              <div className="text-2xl font-black text-cyan-300">Rs. {todayWhSalesVal.toLocaleString()}</div>
              <div className="text-[11px] text-teal-200/80 mt-1">From {todayWhSales.length} wholesale bills</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-xs text-teal-200 font-semibold uppercase tracking-wider mb-1">Today&apos;s Warehouse Expenses</div>
              <div className="text-2xl font-black text-rose-300">Rs. {todayWhExpensesVal.toLocaleString()}</div>
              <div className="text-[11px] text-teal-200/80 mt-1">From {todayWhExpenses.length} expense voucher(s)</div>
            </div>

            <div className="bg-amber-500/20 backdrop-blur-md rounded-2xl p-4 border border-amber-400/40">
              <div className="text-xs text-amber-200 font-bold uppercase tracking-wider mb-1">Warehouse Net Balance</div>
              <div className="text-2xl font-black text-amber-300">Rs. {(todayWhSalesVal - todayWhExpensesVal).toLocaleString()}</div>
              <div className="text-[11px] text-amber-100/90 font-medium mt-1">B2B Revenue - Warehouse Expenses</div>
            </div>
          </div>
        </section>

        {/* Warehouse Operational CRM Quick Desk Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => navigate("/store/warehouse")}
            className="glass-card p-5 rounded-3xl bg-white border border-slate-200 hover:border-teal-400 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-2xl">warehouse</span>
            </div>
            <h4 className="font-extrabold text-base text-slate-900 group-hover:text-teal-700">Godown &amp; B2B Distribution Hub</h4>
            <p className="text-xs text-slate-500 mt-1">Issue wholesale bills, internal stock transfers, and view godowns ledger.</p>
          </div>

          <div
            onClick={() => navigate("/store/purchases")}
            className="glass-card p-5 rounded-3xl bg-white border border-slate-200 hover:border-cyan-400 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-2xl">add_business</span>
            </div>
            <h4 className="font-extrabold text-base text-slate-900 group-hover:text-cyan-700">Company Purchases (GRN)</h4>
            <p className="text-xs text-slate-500 mt-1">Receive inward stock from pharmaceutical companies and distributors.</p>
          </div>

          <div
            onClick={() => navigate("/store/warehouse")}
            className="glass-card p-5 rounded-3xl bg-white border border-slate-200 hover:border-amber-400 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-2xl">group</span>
            </div>
            <h4 className="font-extrabold text-base text-slate-900 group-hover:text-amber-700">B2B Wholesale Parties</h4>
            <p className="text-xs text-slate-500 mt-1">Manage party accounts, credit limits, city/salesman mappings &amp; Udhaar balance.</p>
          </div>

          <div
            onClick={() => navigate("/store")}
            className="glass-card p-5 rounded-3xl bg-white border border-slate-200 hover:border-emerald-400 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-2xl">inventory_2</span>
            </div>
            <h4 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-700">Store Catalogue &amp; Stock</h4>
            <p className="text-xs text-slate-500 mt-1">View inventory list, manufacturing company tags, unit prices, and batches.</p>
          </div>
        </div>

        {/* Low Stock Items Table for Warehouse */}
        <section className="glass-card p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600">warning</span>
              <h3 className="font-bold text-base text-slate-900">
                Low Stock Alerts in {activeWhObj?.name || "Assigned Warehouse"}
              </h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800">
              {whLowStockItems.length} Low Items
            </span>
          </div>

          {whLowStockItems.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl">
              ✅ All stock levels in {activeWhObj?.name || "assigned godown"} are healthy and above reorder thresholds.
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{item.medicine_name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.company_name || item.brand_name || "Generic"}</td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-600">{locQty} units</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{item.reorder_level || 10} units</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => navigate("/store/purchases")}
                            className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-800 font-bold text-[11px] hover:bg-teal-200 transition-colors"
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
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">
            {getGreeting()}, {user?.name || "Doctor"}
          </h2>
          <p className="text-xs sm:text-sm text-outline mt-0.5">{formatTodayLong()}</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {user?.role === "doctor" ? (
            <>
              <button
                onClick={() => navigate("/doctor/queue")}
                className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-primary/20"
              >
                <span className="material-symbols-outlined text-base">queue</span>
                Open My OPD Queue
              </button>
              <button
                onClick={() => navigate("/patients")}
                className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">group</span>
                Patients &amp; EMR
              </button>
            </>
          ) : user?.role === "warehouse" ? (
            <button
              onClick={() => navigate("/store/warehouse")}
              className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-base">warehouse</span>
              Open Warehouse Dashboard
            </button>
          ) : (
            <button
              id="dashboard-add-patient-btn"
              onClick={() => navigate("/reception/register")}
              className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-base">how_to_reg</span>
              Register Patient Token
            </button>
          )}
        </div>
      </header>

      {/* Stats Bento Grid (Desktop Grid / Mobile Swiper Slider) */}
      <div className="block md:hidden">
        <Swiper
          modules={[Pagination]}
          pagination={{ clickable: true, dynamicBullets: true }}
          spaceBetween={12}
          slidesPerView={1.15}
          className="pb-8"
        >
          <SwiperSlide className="h-auto">
            <StatCard
              label={canViewFinancials ? t("dashboard.todayPatients") : "My Patients Today"}
              value={canViewFinancials ? todayVisits.length : myTodayVisits.length}
              icon="group"
              iconBg="bg-secondary-container/50"
              subline={
                <>
                  <span className="material-symbols-outlined text-sm">calendar_today</span>
                  {canViewFinancials
                    ? `${todayVisits.length} total OPD visit${todayVisits.length === 1 ? "" : "s"}`
                    : `${myTodayVisits.length} visit${myTodayVisits.length === 1 ? "" : "s"} in my chamber`}
                </>
              }
            />
          </SwiperSlide>

          <SwiperSlide className="h-auto">
            <StatCard
              label={canViewFinancials ? (isDoctor ? "My Fees Today" : t("dashboard.feesCollected")) : (isDoctor ? "Completed Consultations" : "Revenue Status")}
              value={canViewFinancials ? formatCurrency(isDoctor ? myFeesToday : feesToday) : (isDoctor ? `${myTodayVisits.filter((v) => v.status === "completed" || v.status === "completed_reports_pending").length} Done` : "🔒 Confidential")}
              icon={canViewFinancials ? "payments" : (isDoctor ? "task_alt" : "lock")}
              iconBg={canViewFinancials ? "bg-primary-container/10" : (isDoctor ? "bg-emerald-500/10 text-emerald-700" : "bg-primary-container/10")}
              subline={canViewFinancials ? null : (isDoctor ? "Chamber Consultations Done" : "Owner / Admin Role Required")}
            />
          </SwiperSlide>

          <SwiperSlide className="h-auto">
            {user?.role === "doctor" ? (
              <div className="glass-card p-4 sm:p-5 flex flex-col justify-between gap-3 relative overflow-hidden h-full border border-teal-200/60 bg-teal-50/40">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-label-md text-label-md text-teal-800 mb-1 uppercase tracking-wider font-bold">
                      Waiting Queue
                    </p>
                    <h3 className="text-3xl font-black text-teal-950">
                      {myWaitingVisits.length} <span className="text-sm font-semibold text-gray-500">Patients</span>
                    </h3>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-700/20">
                    <span className="material-symbols-outlined text-2xl">hourglass_top</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-teal-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-teal-800">
                    {myWaitingVisits.length > 0 ? `Next: #${myWaitingVisits[0].token_number}` : "Clear"}
                  </span>
                  <button onClick={() => navigate("/doctor/queue")} className="text-xs font-extrabold text-teal-700 underline">
                    Call →
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-card p-4 sm:p-5 flex flex-col justify-between gap-3 relative overflow-hidden h-full">
                <p className="font-label-md text-label-md text-outline mb-1 uppercase tracking-wider">{t("dashboard.newVsRepeat")}</p>
                <div>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-2xl font-black text-primary">{newRatio}%</span>
                    <span className="text-xs text-outline pb-0.5">New</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-bold text-tertiary">{repeatRatio}%</span>
                    <span className="text-xs text-outline pb-0.5">Repeat</span>
                  </div>
                </div>
                <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-100">
                  <div className="bg-primary" style={{ width: `${newRatio}%` }} />
                  <div className="bg-surface-variant" style={{ width: `${repeatRatio}%` }} />
                </div>
              </div>
            )}
          </SwiperSlide>

          {/* Low Stock Slide — sirf staff/owner ke liye */}
          {!isDoctor && (
          <SwiperSlide className="h-auto">
            <div className="glass-card p-4 sm:p-5 flex flex-col justify-between gap-3 relative overflow-hidden h-full border border-error-container/50 bg-error-container/10">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-label-md text-label-md text-error mb-1 uppercase tracking-wider">{t("dashboard.lowStockAlerts")}</p>
                  <h3 className="text-3xl font-black text-error">{lowStockItems.length}</h3>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-error-container flex items-center justify-center text-error">
                  <span className="material-symbols-outlined text-2xl">warning</span>
                </div>
              </div>
              <p className="text-xs text-outline">{lowStockItems.length === 0 ? t("dashboard.allStockOk") : `${lowStockItems.length} items low`}</p>
            </div>
          </SwiperSlide>
          )}
        </Swiper>
      </div>

      {/* Desktop Grid — doctor ke liye sirf 3 card: My Patients, My Fees, My Queue */}
      {user?.role !== "warehouse" && (
        <section
          className={
            isDoctor
              ? "hidden md:grid md:grid-cols-3 gap-4"
              : "hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4"
          }
          aria-label="Key metrics"
        >
          {/* Patients Today */}
          <StatCard
            label={canViewFinancials ? t("dashboard.todayPatients") : "My Patients Today"}
            value={canViewFinancials ? todayVisits.length : myTodayVisits.length}
            icon="group"
            iconBg="bg-secondary-container/50"
            subline={
              <>
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                {canViewFinancials
                  ? `${todayVisits.length} total OPD visit${todayVisits.length === 1 ? "" : "s"}`
                  : `${myTodayVisits.length} visit${myTodayVisits.length === 1 ? "" : "s"} in my OPD chamber`}
              </>
            }
          />

          {/* Fees Collected Today / Consultations Completed */}
          <StatCard
            label={canViewFinancials ? (isDoctor ? "My Fees Today" : t("dashboard.feesCollected")) : (isDoctor ? "Completed Consultations" : "Revenue Status")}
            value={canViewFinancials ? formatCurrency(isDoctor ? myFeesToday : feesToday) : (isDoctor ? `${myTodayVisits.filter((v) => v.status === "completed" || v.status === "completed_reports_pending").length} Done` : "🔒 Confidential")}
            icon={canViewFinancials ? "payments" : (isDoctor ? "task_alt" : "lock")}
            iconBg={canViewFinancials ? "bg-primary-container/10" : (isDoctor ? "bg-emerald-500/10 text-emerald-700" : "bg-primary-container/10")}
            subline={canViewFinancials ? null : (isDoctor ? "Chamber Consultations Done" : "Owner / Admin Role Required")}
          />

          {/* 3rd Card */}
          {isDoctor ? (
            <div className="glass-card p-4 sm:p-5 flex flex-col justify-between gap-3 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300 border border-teal-200/60 bg-teal-50/40">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-label-md text-label-md text-teal-800 mb-1 uppercase tracking-wider font-bold">
                    Waiting In Chamber Queue
                  </p>
                  <h3 className="text-3xl sm:text-4xl font-black text-teal-950">
                    {myWaitingVisits.length} <span className="text-sm font-semibold text-gray-500">Patients</span>
                  </h3>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-700/20">
                  <span className="material-symbols-outlined text-2xl">hourglass_top</span>
                </div>
              </div>
              <div className="pt-2 border-t border-teal-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-800">
                  {myInRoomVisit
                    ? `In Room: #${myInRoomVisit.token_number} (${myInRoomVisit.patient_name || dbPatients.getById(myInRoomVisit.patient_id)?.full_name || "Patient"})`
                    : myWaitingVisits.length > 0
                    ? `Next: Token #${myWaitingVisits[0].token_number}`
                    : "Queue is Clear"}
                </span>
                <button
                  onClick={() => navigate("/doctor/queue")}
                  className="text-xs font-extrabold text-teal-700 hover:text-teal-900 underline flex items-center gap-0.5"
                >
                  Call Next →
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="glass-card p-4 sm:p-5 flex flex-col justify-between gap-3 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
                <p className="font-label-md text-label-md text-outline mb-1 uppercase tracking-wider">{t("dashboard.newVsRepeat")}</p>
                <div>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-2xl font-black text-primary">{newRatio}%</span>
                    <span className="text-xs text-outline pb-0.5">New</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-bold text-tertiary">{repeatRatio}%</span>
                    <span className="text-xs text-outline pb-0.5">Repeat</span>
                  </div>
                </div>
                <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-100">
                  <div className="bg-primary" style={{ width: `${newRatio}%` }} />
                  <div className="bg-surface-variant" style={{ width: `${repeatRatio}%` }} />
                </div>
              </div>

              {/* 4th Card: Low Stock — sirf staff/owner dekhega */}
              <div className="glass-card p-4 sm:p-5 flex flex-col gap-3 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300 border border-error-container/50 bg-error-container/10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-label-md text-label-md text-error mb-1 uppercase tracking-wider">{t("dashboard.lowStockAlerts")}</p>
                    <h3 className="text-3xl font-black text-error">{lowStockItems.length}</h3>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-error-container flex items-center justify-center text-error">
                    <span className="material-symbols-outlined text-2xl">warning</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {lowStockItems.slice(0, 2).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="text-on-surface truncate max-w-[120px]">{item.medicine_name}</span>
                      <span className="text-error font-semibold">{item.stock_qty} left</span>
                    </div>
                  ))}
                  {lowStockItems.length === 0 && (
                    <p className="text-xs text-outline">{t("dashboard.allStockOk")}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Executive Financial Revenue Breakdown — Available for Staff and Owner */}
      {canViewFinancials ? (
        <section className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-teal-700/50 space-y-4">
          <div className="flex items-center justify-between border-b border-teal-700/60 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-amber-400 text-2xl">account_balance_wallet</span>
              <div>
                <h3 className="font-bold text-lg leading-tight">Clinic Financial Revenue Breakdown</h3>
                <p className="text-xs text-teal-200">Real-time daily earnings summary for Principal Doctor &amp; Owner</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/fees")}
              className="text-xs font-bold bg-teal-600/80 hover:bg-teal-500 text-white px-3.5 py-2 rounded-xl transition-colors border border-teal-400/40 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">analytics</span>
              View Ledger Analytics →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-xs text-teal-200 font-semibold uppercase tracking-wider mb-1">OPD Doctor Fees</div>
              <div className="text-2xl font-black text-emerald-300">Rs. {feesToday.toLocaleString()}</div>
              <div className="text-[11px] text-teal-200/80 mt-1">From {todayVisits.length} consultation tokens</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-xs text-teal-200 font-semibold uppercase tracking-wider mb-1">Pharmacy Store Sales</div>
              <div className="text-2xl font-black text-cyan-300">Rs. {pharmacyRevenueToday.toLocaleString()}</div>
              <div className="text-[11px] text-teal-200/80 mt-1">From {todaySales.length} store sales receipts</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-xs text-teal-200 font-semibold uppercase tracking-wider mb-1">Daily Expenses</div>
              <div className="text-2xl font-black text-rose-300">Rs. {expensesToday.toLocaleString()}</div>
              <div className="text-[11px] text-teal-200/80 mt-1">From {todayExpenses.length} expense vouchers</div>
            </div>

            <div className="bg-amber-500/20 backdrop-blur-md rounded-2xl p-4 border border-amber-400/40">
              <div className="text-xs text-amber-200 font-bold uppercase tracking-wider mb-1">Net Overall Revenue</div>
              <div className="text-2xl font-black text-amber-300">Rs. {netRevenueToday.toLocaleString()}</div>
              <div className="text-[11px] text-amber-100/90 font-medium mt-1">Fees + Store Sales - Expenses</div>
            </div>
          </div>

          {/* Doctor-by-Doctor OPD Revenue Breakdown Table */}
          <div className="border-t border-teal-700/60 pt-4 mt-2">
            <h4 className="text-xs font-bold text-teal-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-amber-400">stethoscope</span>
              Today&apos;s Doctor-by-Doctor OPD Revenue Breakdown
            </h4>
            {doctorBreakdown.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <p className="text-xs text-teal-200">No doctors registered yet.</p>
                <button
                  type="button"
                  onClick={() => navigate("/settings")}
                  className="mt-2 text-xs font-black text-amber-300 hover:text-amber-200 underline cursor-pointer inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Manage Doctors in Clinic Settings (/settings)
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {doctorBreakdown.map((doc) => (
                  <div key={doc.id} className="bg-white/10 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                        <span className="material-symbols-outlined text-xs text-teal-300">person</span>
                        <span>{doc.name}</span>
                        {doc.is_owner && <span className="text-[9px] bg-amber-400 text-teal-950 font-black px-1.5 py-0.2 rounded shrink-0">OWNER</span>}
                      </div>
                      <div className="text-[11px] text-teal-200 truncate">{doc.specialization || "General Physician"}</div>
                      <div className="text-[10px] text-teal-300/80 mt-0.5">{doc.visitsCount ?? doc.today_patient_count ?? 0} Patients Today</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-amber-300">
                        Rs. {(Number(doc.feesCollected ?? doc.today_fees) || 0).toLocaleString()}
                      </div>
                      <div className="text-[9px] text-teal-200 uppercase">OPD Collection</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : isDoctor ? (
        /* Doctor Personal Live OPD Queue & Consultation Desk */
        <section className="glass-card p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">hourglass_top</span>
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Live Chamber Queue &amp; Waiting Patients</h3>
                <p className="text-xs text-slate-500">Real-time OPD patient waiting list for your consultation chamber</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-100 text-teal-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                {myWaitingVisits.length} Waiting
              </span>
              <button
                onClick={() => navigate("/doctor/queue")}
                className="btn-primary text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">queue</span>
                Open Chamber Queue Portal →
              </button>
            </div>
          </div>

          {myWaitingVisits.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
              <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">task_alt</span>
              </div>
              <h4 className="font-bold text-sm text-slate-800">Chamber Queue is Clear</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All assigned OPD consultation tokens have been completed. New waiting patients will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider bg-slate-50">
                    <th className="py-2.5 px-3">Token #</th>
                    <th className="py-2.5 px-3">Patient Name</th>
                    <th className="py-2.5 px-3">Age / Gender</th>
                    <th className="py-2.5 px-3">Chief Complaint</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myWaitingVisits.map((visit) => {
                    const patient = dbPatients.getById(visit.patient_id) || {};
                    return (
                      <tr key={visit.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-black text-teal-800">
                          <span className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 text-xs">
                            #{visit.token_number}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {visit.patient_name || patient.full_name || "Patient"}
                          {patient.mr_number && (
                            <span className="block text-[10px] font-mono text-slate-400">{patient.mr_number}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {patient.age ? `${patient.age} yrs` : "N/A"} • {patient.gender || "N/A"}
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-[200px] truncate">
                          {visit.symptoms || visit.chief_complaint || "General Consultation"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Waiting
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => navigate(`/doctor/consultation?visit_id=${visit.id}`)}
                            className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-[11px] shadow-sm transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">stethoscope</span>
                            Start Consultation
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        /* Front Desk / Receptionist / Operational Counter Summary */
        user?.role === "warehouse" ? (
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-teal-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600 text-2xl">warehouse</span>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Warehouse Status Overview</h3>
                  <p className="text-xs text-gray-400">Logged in as {user?.name || "Staff"} • {user?.assigned_warehouse_id ? `Warehouse ID: ${user.assigned_warehouse_id.toUpperCase()}` : "Global Inventory Incharge"}</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/store/warehouse")}
                className="text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">swap_horiz</span>
                Manage Stock &amp; Transfers
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 text-center">
                <div className="text-xs text-teal-700 font-bold uppercase mb-1">My Godown Stock Valuation</div>
                <div className="text-2xl font-black text-teal-900">
                  {(() => {
                    const whId = user?.assigned_warehouse_id || "wh_001";
                    const value = (dbInventory.getAll() || []).reduce((sum, item) => {
                      const qty = Number(item.location_quantities?.[whId] || (whId === "wh_001" ? item.warehouse_stock || 0 : 0));
                      return sum + (qty * Number(item.sale_price || item.unit_sale_price || 0));
                    }, 0);
                    return formatCurrency(value);
                  })()}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">Valued at local store retail price</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-center">
                <div className="text-xs text-amber-700 font-bold uppercase mb-1">Low Stock SKUs in Godown</div>
                <div className="text-2xl font-black text-amber-900">
                  {(() => {
                    const whId = user?.assigned_warehouse_id || "wh_001";
                    return (dbInventory.getAll() || []).filter((item) => {
                      const qty = Number(item.location_quantities?.[whId] || (whId === "wh_001" ? item.warehouse_stock || 0 : 0));
                      return qty > 0 && qty <= (item.low_stock_threshold || 6);
                    }).length;
                  })()}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">Threshold level alerts</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
                <div className="text-xs text-blue-700 font-bold uppercase mb-1">Pending Stock Transfers</div>
                <div className="text-2xl font-black text-blue-900">
                  {(() => {
                    const whId = user?.assigned_warehouse_id || "wh_001";
                    return (dbStockTransfers.getAll() || []).filter((t) => 
                      t.status === "in_transit" && (t.from_warehouse_id === whId || t.to_warehouse_id === whId)
                    ).length;
                  })()}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">In Transit transfers</div>
              </div>
            </div>
          </section>
        ) : (
          /* Front Desk / Receptionist / Operational Counter Summary */
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-teal-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600 text-2xl">badge</span>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Operational Counter Desk</h3>
                  <p className="text-xs text-gray-400">Logged in as {user?.name || "Staff"} • {user?.role ? user.role.toUpperCase() : "COUNTER"}</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/reception/register")}
                className="text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                + New Patient Token
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 text-center">
                <div className="text-xs text-teal-700 font-bold uppercase mb-1">Today&apos;s Total Patients</div>
                <div className="text-3xl font-black text-teal-900">{todayVisits.length}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Tokens issued today</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-center">
                <div className="text-xs text-amber-700 font-bold uppercase mb-1">Waiting in Queue</div>
                <div className="text-3xl font-black text-amber-900">{waitingVisits.length}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">OPD waiting room</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center sm:col-span-1 col-span-2">
                <div className="text-xs text-blue-700 font-bold uppercase mb-1">Completed Consultations</div>
                <div className="text-3xl font-black text-blue-900">{completedVisits.length}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Visits completed</div>
              </div>
            </div>
          </section>
        )
      )}

      {/* Quick Actions — Only for Non-Doctor Staff */}
      {!isDoctor && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4" aria-label="Quick actions">
          {user?.role === "warehouse" ? (
          <>
            <button
              onClick={() => navigate("/store/warehouse")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">warehouse</span>
              <span className="font-label-md text-label-md font-bold">Godown &amp; Wholesale</span>
            </button>
            <button
              onClick={() => navigate("/store/purchases")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">add_business</span>
              <span className="font-label-md text-label-md font-bold">Company Purchases (GRN)</span>
            </button>
            <button
              onClick={() => navigate("/store")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">inventory_2</span>
              <span className="font-label-md text-label-md font-bold">Store Counter Inventory</span>
            </button>
          </>
        ) : (
          <>
            <button
              id="quick-register-patient"
              onClick={() => navigate("/reception/register")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">how_to_reg</span>
              <span className="font-label-md text-label-md font-bold">Register Patient Token</span>
            </button>
            <button
              onClick={() => navigate("/store/pos")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">point_of_sale</span>
              <span className="font-label-md text-label-md font-bold">POS Store &amp; Pharmacy</span>
            </button>
            <button
              id="quick-view-reports"
              onClick={() => navigate("/fees")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">assessment</span>
              <span className="font-label-md text-label-md font-bold">Daily Cash &amp; Reports</span>
            </button>
          </>
        )}
      </section>
      )}
    </div>
  );
}
