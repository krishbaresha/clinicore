import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { getFeesSummary } from "../api/visits.js";
import { dbVisits, dbSales, dbExpenses, dbPurchases, dbReturns, dbB2BSales, dbClinic, dbShiftClosings } from "../api/db.js";
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

  const canViewAllFinancials = user?.is_owner || user?.can_view_financials || user?.role === "receptionist" || user?.role === "cashier" || user?.role === "pharmacist";
  const targetDoctorId = canViewAllFinancials ? null : user?.id;

  useEffect(() => {
    const r = getFeesSummary(range, targetDoctorId);
    if (r.success) setSummary(r.data);
    setSavedClosings(dbShiftClosings.getAll());
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

  // Live Physical Cash Calculation
  const physicalCashTotal =
    (Number(denominations.note5000) || 0) * 5000 +
    (Number(denominations.note1000) || 0) * 1000 +
    (Number(denominations.note500) || 0) * 500 +
    (Number(denominations.note100) || 0) * 100 +
    (Number(denominations.note50) || 0) * 50 +
    (Number(denominations.note20) || 0) * 20 +
    (Number(denominations.note10) || 0) * 10;

  const cashVariance = physicalCashTotal - netCashInHand;

  const handlePrintZReport = (closingObj = null) => {
    const dataToPrint = closingObj || {
      date: closingDate,
      closed_by: user?.name || "Cashier / Doctor",
      total_tokens: dayVisits.length,
      opd_fees: dayOpdFees,
      pharmacy_sales: dayPharmacySales,
      wholesale_sales: dayWholesaleSales,
      expenses: totalDayExpenses,
      supplier_payments: daySupplierCash,
      returns_refunds: dayReturnRefunds,
      expected_cash: netCashInHand,
      physical_cash: physicalCashTotal > 0 ? physicalCashTotal : netCashInHand,
      cash_variance: physicalCashTotal > 0 ? cashVariance : 0,
      denominations: physicalCashTotal > 0 ? { ...denominations } : null,
    };
    printDayEndClosingReceipt(dataToPrint, dbClinic.get());
  };

  const handleSaveShiftClosing = () => {
    const newRecord = dbShiftClosings.add({
      date: closingDate,
      closed_by: user?.name || "Cashier / Doctor",
      shift_name: "Day-End Shift",
      total_tokens: dayVisits.length,
      opd_fees: dayOpdFees,
      pharmacy_sales: dayPharmacySales,
      wholesale_sales: dayWholesaleSales,
      total_inflow: totalInflow,
      expenses: totalDayExpenses,
      supplier_payments: daySupplierCash,
      returns_refunds: dayReturnRefunds,
      total_outflow: totalOutflow,
      expected_cash: netCashInHand,
      physical_cash: physicalCashTotal,
      cash_variance: cashVariance,
      denominations: { ...denominations },
      notes: closingNotes,
    });

    setSavedClosings(dbShiftClosings.getAll());

    // Print Thermal Slip automatically
    printDayEndClosingReceipt(newRecord, dbClinic.get());
    alert("✅ Day-End Shift Closing saved and locked successfully!");
  };

  const handleDeleteClosing = (id) => {
    if (confirm("Are you sure you want to delete this shift closing log entry?")) {
      dbShiftClosings.delete(id);
      setSavedClosings(dbShiftClosings.getAll());
    }
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
              ? "Daily Day-End Cash Register (Z-Report), Denominations Count & Shift Audit Sheets"
              : `Consultation fee collections for ${user?.name || "Doctor"}`}
          </p>
        </div>

        {canViewAllFinancials && (
          <div className="flex gap-2">
            <button
              onClick={() => handlePrintZReport()}
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
            💰 Daily Day-End Cash Closing &amp; Denominations
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
        <div className="space-y-6">
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

            {/* System Expected Cash */}
            <div className="bg-gradient-to-br from-teal-900 to-slate-900 text-white rounded-3xl p-5 border border-teal-700 shadow-xl space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-teal-300 font-bold text-xs uppercase tracking-wider">
                  <span>System Expected Cash</span>
                  <span className="material-symbols-outlined text-amber-400">point_of_sale</span>
                </div>
                <div className="text-3xl font-black text-amber-300 mt-2">Rs. {netCashInHand.toLocaleString()}</div>
                <p className="text-xs text-teal-200/80 mt-1 font-medium">
                  Total System Cash Drawer Balance (Inflow - Outflow)
                </p>
              </div>

              <button
                onClick={() => handlePrintZReport()}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-teal-950/40"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Print Quick Z-Report
              </button>
            </div>
          </div>

          {/* PHYSICAL CASH DENOMINATION COUNTER & AUDIT */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-600">request_quote</span>
                  Physical Cash Drawer Denomination Counter
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Count notes physically in cash drawer to audit cash shortage or surplus
                </p>
              </div>

              {/* Live Audit Variance Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-semibold">Physical Counted:</span>
                <span className="text-base font-black text-gray-900 bg-gray-100 px-3 py-1 rounded-xl">
                  Rs. {physicalCashTotal.toLocaleString()}
                </span>
                {physicalCashTotal > 0 && (
                  <span
                    className={`text-xs font-black px-3 py-1 rounded-xl border flex items-center gap-1 ${
                      cashVariance === 0
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : cashVariance < 0
                        ? "bg-rose-50 text-rose-800 border-rose-300"
                        : "bg-blue-50 text-blue-800 border-blue-300"
                    }`}
                  >
                    {cashVariance === 0 && "✅ Balanced (Rs. 0)"}
                    {cashVariance < 0 && `⚠️ Shortage (-Rs. ${Math.abs(cashVariance).toLocaleString()})`}
                    {cashVariance > 0 && `ℹ️ Surplus (+Rs. ${cashVariance.toLocaleString()})`}
                  </span>
                )}
              </div>
            </div>

            {/* Denomination Inputs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {[
                { note: 5000, key: "note5000", color: "border-teal-200 bg-teal-50/50" },
                { note: 1000, key: "note1000", color: "border-indigo-200 bg-indigo-50/50" },
                { note: 500, key: "note500", color: "border-emerald-200 bg-emerald-50/50" },
                { note: 100, key: "note100", color: "border-amber-200 bg-amber-50/50" },
                { note: 50, key: "note50", color: "border-purple-200 bg-purple-50/50" },
                { note: 20, key: "note20", color: "border-orange-200 bg-orange-50/50" },
                { note: 10, key: "note10", color: "border-cyan-200 bg-cyan-50/50" },
              ].map(({ note, key, color }) => {
                const qty = denominations[key] || 0;
                const sub = note * qty;
                return (
                  <div key={key} className={`p-3 rounded-2xl border ${color} space-y-1`}>
                    <div className="text-xs font-bold text-gray-700">Rs. {note} Note</div>
                    <input
                      type="number"
                      min="0"
                      value={denominations[key] || ""}
                      onChange={(e) => setDenominations({ ...denominations, [key]: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded-xl px-2 py-1.5 text-sm font-black text-center bg-white"
                    />
                    <div className="text-[11px] font-bold text-gray-600 text-center truncate">
                      = Rs. {sub.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Shift Notes & Lock Button */}
            <div className="flex flex-col sm:flex-row items-end gap-3 pt-2 border-t border-gray-100">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Cashier Closing Remarks / Shift Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shift 1 closed by Sana. Cash balanced with drawer lock key deposited."
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-gray-50"
                />
              </div>
              <button
                onClick={handleSaveShiftClosing}
                className="w-full sm:w-auto bg-teal-800 hover:bg-teal-900 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-teal-900/20 flex items-center justify-center gap-2 shrink-0 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                Lock &amp; Save Shift Closing Sheet
              </button>
            </div>
          </div>

          {/* SAVED SHIFT CLOSINGS HISTORY LOG */}
          {savedClosings.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">history_edu</span>
                Archived Shift Closings &amp; Z-Report History
              </h3>

              <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700 font-bold sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5">Date &amp; Closed By</th>
                      <th className="px-3 py-2.5 text-right">System Cash</th>
                      <th className="px-3 py-2.5 text-right">Physical Counted</th>
                      <th className="px-3 py-2.5 text-center">Variance Audit</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {savedClosings.map((c) => {
                      const v = c.cash_variance || 0;
                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-gray-900">{new Date(c.closed_at || c.date).toLocaleString("en-PK")}</div>
                            <div className="text-[11px] text-gray-500">By: {c.closed_by || "Cashier"}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                            Rs. {(c.expected_cash || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-teal-900">
                            Rs. {(c.physical_cash || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                v === 0
                                  ? "bg-emerald-100 text-emerald-800"
                                  : v < 0
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {v === 0 ? "Balanced" : v < 0 ? `Short (-${Math.abs(v)})` : `Surplus (+${v})`}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right space-x-1">
                            <button
                              onClick={() => handlePrintZReport(c)}
                              className="bg-teal-50 border border-teal-200 text-teal-700 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-teal-100"
                            >
                              Print Slip
                            </button>
                            <button
                              onClick={() => handleDeleteClosing(c.id)}
                              className="text-gray-400 hover:text-rose-600 p-1"
                              title="Delete log"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
