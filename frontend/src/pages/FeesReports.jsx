import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getFeesSummary } from "../api/visits.js";
import { dbVisits, dbSales, dbExpenses, dbPurchases, dbReturns, dbB2BSales, dbClinic } from "../api/db.js";
import { formatCurrency } from "../utils/formatters.js";
import { printDayEndClosingReceipt } from "../utils/thermalPrinter.js";

const RANGES = ["daily", "weekly", "monthly"];

export default function FeesReports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("zreport"); // "zreport" | "opd_analytics"
  const [range, setRange] = useState("monthly");
  const [summary, setSummary] = useState(null);

  // Day-End Filter Date
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split("T")[0]);

  const canViewAllFinancials = user?.is_owner || user?.can_view_financials;
  const targetDoctorId = canViewAllFinancials ? null : user?.id;

  useEffect(() => {
    const r = getFeesSummary(range, targetDoctorId);
    if (r.success) setSummary(r.data);
  }, [range, targetDoctorId]);

  // Compute Day-End Financials for selected date
  const targetDateStr = new Date(closingDate).toDateString();

  const allVisits = dbVisits.getAll();
  const dayVisits = allVisits.filter((v) => new Date(v.visit_date).toDateString() === targetDateStr);
  const dayOpdFees = dayVisits.reduce((sum, v) => sum + (v.fee_amount || 0), 0);

  const allSales = dbSales.getAll();
  const daySales = allSales.filter((s) => new Date(s.sale_date).toDateString() === targetDateStr);
  const dayPharmacySales = daySales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  const allB2B = dbB2BSales.getAll();
  const dayB2B = allB2B.filter((b) => new Date(b.sale_date).toDateString() === targetDateStr);
  const dayWholesaleSales = dayB2B.reduce((sum, b) => sum + (b.paid_amount || b.total_amount || 0), 0);

  const totalInflow = dayOpdFees + dayPharmacySales + dayWholesaleSales;

  const allExpenses = dbExpenses.getAll();
  const dayExpenses = allExpenses.filter((e) => new Date(e.expense_date).toDateString() === targetDateStr);
  const totalDayExpenses = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const allPurchases = dbPurchases.getAll();
  const dayPurchases = allPurchases.filter((p) => new Date(p.purchase_date).toDateString() === targetDateStr);
  const daySupplierCash = dayPurchases.reduce((sum, p) => sum + (p.paid_amount || 0), 0);

  const allReturns = dbReturns.getAll();
  const dayReturns = allReturns.filter((r) => new Date(r.return_date).toDateString() === targetDateStr);
  const dayReturnRefunds = dayReturns.reduce((sum, r) => sum + (r.refund_amount || 0), 0);

  const totalOutflow = totalDayExpenses + daySupplierCash + dayReturnRefunds;
  const netCashInHand = totalInflow - totalOutflow;

  const handlePrintZReport = () => {
    printDayEndClosingReceipt({
      date: closingDate,
      closed_by: user?.name || "Cashier / Doctor",
      total_tokens: dayVisits.length,
      opd_fees: dayOpdFees,
      pharmacy_sales: dayPharmacySales,
      wholesale_sales: dayWholesaleSales,
      expenses: totalDayExpenses,
      supplier_payments: daySupplierCash,
      returns_refunds: dayReturnRefunds
    }, dbClinic.get());
  };

  const maxFee = summary?.chart_data?.length
    ? Math.max(...summary.chart_data.map((d) => d.fees), 1)
    : 1;

  return (
    <div className="p-3 sm:p-5 md:p-8 flex flex-col gap-lg max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-3xl border border-teal-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600">payments</span>
            {canViewAllFinancials ? "Clinic Financial Analytics & Cash Closures" : "My OPD Fee Reports"}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {canViewAllFinancials
              ? "Daily Day-End Cash Register (Z-Report), Pharmacy Sales & Doctor Fee Breakdowns"
              : `Consultation fee collections for ${user?.name || "Doctor"}`}
          </p>
        </div>

        {canViewAllFinancials && (
          <div className="flex gap-2">
            <button
              onClick={handlePrintZReport}
              className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-2xl font-bold text-xs shadow-md shadow-teal-200 flex items-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-base">print</span>
              Print Day-End Z-Report (80mm)
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      {canViewAllFinancials && (
        <div className="flex border-b border-gray-200 gap-2">
          <button
            onClick={() => setActiveTab("zreport")}
            className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "zreport" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            💰 Daily Day-End Cash Closing (Z-Report Roznamcha)
          </button>
          <button
            onClick={() => setActiveTab("opd_analytics")}
            className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "opd_analytics" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="material-symbols-outlined text-base">analytics</span>
            📈 OPD Consultation Fee Trends
          </button>
        </div>
      )}

      {/* TAB 1: Day-End Cash Register (Z-Report Roznamcha) */}
      {activeTab === "zreport" && canViewAllFinancials && (
        <div className="space-y-5">
          {/* Date Selector Banner */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 flex items-center justify-between flex-wrap gap-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
              <span className="material-symbols-outlined text-teal-600">calendar_month</span>
              Select Closing Date:
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-bold text-teal-900 bg-gray-50"
              />
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Showing financial hisab-kitab for: <strong>{new Date(closingDate).toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>
            </div>
          </div>

          {/* Cash Summary Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Inflows */}
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-3xl p-5 border border-teal-200 space-y-3">
              <div className="flex justify-between items-center text-teal-800 font-bold text-xs uppercase tracking-wider">
                <span>(+) Cash Inflows (Collections)</span>
                <span className="material-symbols-outlined">trending_up</span>
              </div>
              <div className="text-2xl font-black text-teal-900">Rs. {totalInflow.toLocaleString()}</div>
              
              <div className="space-y-1.5 text-xs text-gray-700 pt-2 border-t border-teal-200/60 font-medium">
                <div className="flex justify-between">
                  <span>OPD Doctor Fees ({dayVisits.length} Visits):</span>
                  <span className="font-bold text-gray-900">Rs. {dayOpdFees.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pharmacy POS Sales ({daySales.length} Bills):</span>
                  <span className="font-bold text-gray-900">Rs. {dayPharmacySales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Wholesale B2B Sales ({dayB2B.length} Bills):</span>
                  <span className="font-bold text-gray-900">Rs. {dayWholesaleSales.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Total Outflows */}
            <div className="bg-gradient-to-br from-rose-50 to-amber-50 rounded-3xl p-5 border border-rose-200 space-y-3">
              <div className="flex justify-between items-center text-rose-800 font-bold text-xs uppercase tracking-wider">
                <span>(-) Cash Outflows (Expenses &amp; Bills)</span>
                <span className="material-symbols-outlined">trending_down</span>
              </div>
              <div className="text-2xl font-black text-rose-900">Rs. {totalOutflow.toLocaleString()}</div>

              <div className="space-y-1.5 text-xs text-gray-700 pt-2 border-t border-rose-200/60 font-medium">
                <div className="flex justify-between">
                  <span>Daily Clinic Expenses ({dayExpenses.length} Entries):</span>
                  <span className="font-bold text-gray-900">Rs. {totalDayExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Supplier Cash Paid ({dayPurchases.length} Purchases):</span>
                  <span className="font-bold text-gray-900">Rs. {daySupplierCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sales Returns &amp; Refunds:</span>
                  <span className="font-bold text-gray-900">Rs. {dayReturnRefunds.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Net Physical Cash in Hand */}
            <div className="bg-gradient-to-br from-teal-900 to-slate-900 text-white rounded-3xl p-5 border border-teal-700 shadow-xl space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-teal-300 font-bold text-xs uppercase tracking-wider">
                  <span>Net Physical Cash in Hand</span>
                  <span className="material-symbols-outlined text-amber-400">point_of_sale</span>
                </div>
                <div className="text-3xl font-black text-amber-300 mt-2">Rs. {netCashInHand.toLocaleString()}</div>
                <p className="text-xs text-teal-200/80 mt-1 font-medium">
                  Total Cash Drawer Closing Balance (Inflow - Outflow)
                </p>
              </div>

              <button
                onClick={handlePrintZReport}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-teal-950/40"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Print Z-Report Thermal Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OPD Consultation Fee Trends */}
      {(activeTab === "opd_analytics" || !canViewAllFinancials) && (
        <div className="space-y-5">
          {/* Range Toggle */}
          <div className="flex gap-xs bg-surface-container-low rounded-full p-1 self-start">
            {RANGES.map((r) => (
              <button
                key={r}
                id={`range-${r}`}
                onClick={() => setRange(r)}
                className={`px-md py-2 rounded-full font-label-md text-label-md uppercase transition-colors ${
                  range === r
                    ? "bg-primary text-on-primary shadow"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {summary && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                <div className="glass-card p-md flex flex-col gap-2">
                  <p className="font-label-md text-label-md text-outline uppercase tracking-wider">Total Consultation Fees</p>
                  <p className="font-display-lg text-display-lg font-bold text-primary">{formatCurrency(summary.total_fees)}</p>
                </div>
                <div className="glass-card p-md flex flex-col gap-2">
                  <p className="font-label-md text-label-md text-outline uppercase tracking-wider">OPD Patient Visits</p>
                  <p className="font-display-lg text-display-lg font-bold text-on-surface">{summary.visit_count}</p>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="glass-card p-md">
                <p className="font-label-md text-label-md text-outline uppercase tracking-wider mb-md">
                  Fee Breakdown — {range.charAt(0).toUpperCase() + range.slice(1)}
                </p>
                {summary.chart_data.length === 0 ? (
                  <p className="font-body-md text-body-md text-outline text-center py-lg">No visits in this period.</p>
                ) : (
                  <div className="flex items-end gap-sm overflow-x-auto pb-2" style={{ minHeight: "140px" }}>
                    {summary.chart_data.map((d, i) => {
                      const pct = Math.max(4, Math.round((d.fees / maxFee) * 120));
                      return (
                        <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                          <span className="font-label-md text-label-md text-outline text-xs">{formatCurrency(d.fees)}</span>
                          <div
                            className="w-10 bg-primary rounded-t-lg transition-all"
                            style={{ height: `${pct}px` }}
                            title={`${d.date}: ${formatCurrency(d.fees)}`}
                          />
                          <span className="font-label-md text-label-md text-outline text-xs whitespace-nowrap">{d.date}</span>
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
    </div>
  );
}
