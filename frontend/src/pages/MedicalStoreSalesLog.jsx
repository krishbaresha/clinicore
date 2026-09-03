import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSales, getExpenses, getReturns, addPharmacyExpense, deletePharmacyExpense, processSaleReturn } from "../api/store.js";
import { dbClinic, dbSales } from "../api/db.js";
import { printThermalReceipt } from "../utils/thermalPrinter.js";
import { formatDate } from "../utils/formatters.js";
import SaleInvoiceModal from "../components/SaleInvoiceModal.jsx";


export default function MedicalStoreSalesLog() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("sales"); // "sales", "expenses", "reconciliation"

  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Search & Filter & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [cashierFilter, setCashierFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 30;

  // Void Modal State
  const [voidModalSale, setVoidModalSale] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [voidError, setVoidError] = useState("");

  // Return Modal State
  const [returnModalSale, setReturnModalSale] = useState(null);
  const [returnReason, setReturnReason] = useState("Doctor changed prescription formula");
  const [refundType, setRefundType] = useState("cash"); // "cash" or "credit"
  const [returnQuantities, setReturnQuantities] = useState({});

  // Expense Form State
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: "Tea & Refreshment",
    amount: "",
    description: "",
    recorded_by: "Pharmacist"
  });

  // Reconciliation State
  const [countedCashInput, setCountedCashInput] = useState("");

  // DrCreate Sale Invoice Modal State
  const [showSaleInvoiceModal, setShowSaleInvoiceModal] = useState(false);

  const [error, setError] = useState("");

  function loadAllData() {
    const sr = getSales();
    if (sr.success) setSales([...sr.data].sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date)));
    
    const rr = getReturns();
    if (rr.success) setReturns([...rr.data].sort((a, b) => new Date(b.return_date) - new Date(a.return_date)));

    const er = getExpenses();
    if (er.success) setExpenses([...er.data].sort((a, b) => new Date(b.date) - new Date(a.date)));
  }

  useEffect(() => {
    loadAllData();
    window.addEventListener("clinicflow_status_update", loadAllData);
    return () => window.removeEventListener("clinicflow_status_update", loadAllData);
  }, []);

  const cashierOptions = Array.from(new Set(sales.map((s) => s.cashier_name || "Store Staff").filter(Boolean)));

  // Filtered sales search
  const filteredSales = sales.filter((s) => {
    if (cashierFilter !== "ALL" && (s.cashier_name || "Store Staff") !== cashierFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesId = (s.id || "").toLowerCase().includes(q) || (s.receipt_no || "").toLowerCase().includes(q);
    const matchesPatient = (s.patient_name || "").toLowerCase().includes(q);
    const matchesCashier = (s.cashier_name || "").toLowerCase().includes(q);
    const matchesDate = formatDate(s.sale_date).toLowerCase().includes(q);
    return matchesId || matchesPatient || matchesCashier || matchesDate;
  });

  function handleConfirmVoid(e) {
    e.preventDefault();
    // Pull VPS-synced values only — no hardcoded fallback PINs
    const currentTabPin = (typeof localStorage !== "undefined" ? localStorage.getItem("cf_admin_tab_pin") : "") || "";
    const currentMasterPasscode = (typeof localStorage !== "undefined" ? localStorage.getItem("cf_admin_master_passcode") : "") || "";
    const isMasterValid =
      (currentTabPin && adminPin.trim() === currentTabPin.trim()) ||
      (currentMasterPasscode && adminPin.trim() === currentMasterPasscode.trim());
    if (!isMasterValid) {
      setVoidError("Invalid Admin PIN / Master Passcode. Please use your VPS-configured PIN.");
      return;
    }
    if (!voidReason.trim()) {
      setVoidError("Please provide a mandatory reason for voiding this invoice.");
      return;
    }
    const res = dbSales.voidSale(voidModalSale.id, voidReason, "Authorized Manager");
    if (res.success) {
      setVoidModalSale(null);
      setVoidReason("");
      setAdminPin("");
      setVoidError("");
      loadAllData();
      alert("Invoice voided successfully and items restocked.");
    } else {
      setVoidError(res.error || "Failed to void invoice");
    }
  }

  // Open Return Dialog
  function handleOpenReturnModal(sale) {
    setReturnModalSale(sale);
    const initQtys = {};
    (sale.items || []).forEach((item, idx) => {
      initQtys[idx] = 1; // default return 1 unit
    });
    setReturnQuantities(initQtys);
  }

  // Handle Process Return
  function handleConfirmReturn(e) {
    e.preventDefault();
    if (!returnModalSale) return;

    const itemsToReturn = [];
    (returnModalSale.items || []).forEach((item, idx) => {
      const q = Number(returnQuantities[idx]) || 0;
      if (q > 0) {
        itemsToReturn.push({
          inventory_id: item.inventory_id,
          medicine_name: item.medicine_name,
          selected_unit_type: item.selected_unit_type || "unit",
          unit_label: item.unit_label || "unit",
          quantity_returned: q,
          unit_price: item.unit_price || 0
        });
      }
    });

    if (itemsToReturn.length === 0) {
      alert("Please select at least 1 item quantity to return.");
      return;
    }

    const result = processSaleReturn({
      sale_id: returnModalSale.id,
      return_items: itemsToReturn,
      reason: returnReason,
      refund_type: refundType
    });

    if (result.success) {
      alert(`Return processed successfully! Rs. ${result.data.refund_amount.toLocaleString()} refunded & stock restocked.`);
      setReturnModalSale(null);
      loadAllData();
    } else {
      alert(`Return Error: ${result.error.message}`);
    }
  }

  // Handle Add Expense
  function handleAddExpenseSubmit(e) {
    e.preventDefault();
    setError("");
    const res = addPharmacyExpense(expenseForm);
    if (res.success) {
      setShowExpenseForm(false);
      setExpenseForm({ category: "Tea & Refreshment", amount: "", description: "", recorded_by: "Pharmacist" });
      loadAllData();
    } else {
      setError(res.error.message);
    }
  }

  // Handle Delete Expense
  function handleDeleteExpense(id) {
    if (confirm("Delete this expense record?")) {
      deletePharmacyExpense(id);
      loadAllData();
    }
  }

  // Financial Calculations (Excluding voided sales)
  const validSales = sales.filter((s) => !s.is_voided);
  const totalSalesRevenue = validSales.reduce((sum, s) => sum + (s.total_amount || s.sale_amount || 0), 0);
  const totalRefundsValue = returns.reduce((sum, r) => sum + (r.refund_amount || 0), 0);
  const totalExpensesValue = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Cash drawer calculation
  const cashSalesTotal = validSales.reduce((sum, s) => {
    const paid = Number(s.paid_amount ?? s.amount_paid);
    if (s.payment_type === "credit" || s.payment_mode === "Credit") {
      return sum + (isNaN(paid) ? 0 : paid);
    }
    return sum + (!isNaN(paid) ? paid : (Number(s.total_amount) || Number(s.sale_amount) || 0));
  }, 0);

  const creditSalesTotal = validSales.reduce((sum, s) => sum + (Number(s.balance_due) || 0), 0);
  const cashRefundsTotal = returns.filter(r => r.refund_type === "cash").reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0);

  const expectedCashInDrawer = Math.max(0, cashSalesTotal - cashRefundsTotal - totalExpensesValue);
  const actualCountedCash = Number(countedCashInput) || 0;
  const cashVariance = actualCountedCash - expectedCashInDrawer;

  return (
    <div className="p-3 sm:p-5 md:p-8 flex flex-col gap-md max-w-6xl mx-auto w-full mobile-safe-bottom touch-scroll overflow-x-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-3xl border border-teal-100 shadow-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600">receipt_long</span>
            Medical Store Audit, Sales &amp; Returns Log
          </h1>
          <p className="font-body-sm text-body-sm text-outline">Manage Sales Invoices, Restocking Returns, Refunds &amp; Daily Expenses</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowExpenseForm(!showExpenseForm)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-base">add</span>
            + Record Expense
          </button>
          <button
            onClick={() => navigate("/fees-reports")}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-base text-teal-400">point_of_sale</span>
            Day Closing &amp; Z-Report
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-sm">
        <div className="bg-white p-4 rounded-2xl border border-teal-100 shadow-sm flex items-center gap-3">
          <div className="bg-teal-50 text-teal-700 p-3 rounded-xl">
            <span className="material-symbols-outlined text-2xl">payments</span>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gross Sales</div>
            <div className="text-xl font-black text-gray-900">Rs. {totalSalesRevenue.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex items-center gap-3">
          <div className="bg-rose-50 text-rose-700 p-3 rounded-xl">
            <span className="material-symbols-outlined text-2xl">assignment_return</span>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Returns / Refunds</div>
            <div className="text-xl font-black text-rose-700">- Rs. {totalRefundsValue.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-3">
          <div className="bg-amber-50 text-amber-700 p-3 rounded-xl">
            <span className="material-symbols-outlined text-2xl">request_quote</span>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Daily Expenses</div>
            <div className="text-xl font-black text-amber-700">- Rs. {totalExpensesValue.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3">
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl">
            <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Net Store Cash</div>
            <div className="text-xl font-black text-emerald-700">Rs. {expectedCashInDrawer.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Record Expense Modal Form Popup */}
      {showExpenseForm && (
        <form onSubmit={handleAddExpenseSubmit} className="bg-white p-5 rounded-2xl border border-amber-300 shadow-xl space-y-4 animate-scaleUp">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">payments</span>
              Add Pharmacy Operating Expense
            </h3>
            <button type="button" onClick={() => setShowExpenseForm(false)} className="text-gray-400 hover:text-gray-700">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Expense Category *</label>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900"
                required
              >
                <option value="Tea & Refreshment">Tea &amp; Refreshments</option>
                <option value="Electricity & Utilities">Electricity &amp; Utility Bills</option>
                <option value="Delivery & Freight">Delivery &amp; Courier Freight</option>
                <option value="Generator Fuel">Generator / Fuel</option>
                <option value="Stationery & Printing">Stationery &amp; Thermal Paper</option>
                <option value="Maintenance & Repair">Shop Repair &amp; Maintenance</option>
                <option value="Staff Allowance / Bonus">Staff Lunch / Allowance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Amount (Rs) *</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 180"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description / Note</label>
              <input
                type="text"
                placeholder="e.g. Tea for pharmacy staff"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-900"
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowExpenseForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md">Save Expense</button>
          </div>
        </form>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab("sales")}
          className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === "sales" ? "border-teal-600 text-teal-700 font-black" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-lg">receipt_long</span>
          Sales Receipts &amp; Invoices Log ({sales.length})
        </button>
        <button
          onClick={() => setActiveTab("returns")}
          className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === "returns" ? "border-teal-600 text-teal-700 font-black" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-lg text-rose-600">assignment_return</span>
          Medicine Returns &amp; Restocking Log ({returns.length})
        </button>
      </div>

      {/* TAB 1: Sales & Returns Log */}
      {activeTab === "sales" && (
        <div className="space-y-4">
          {/* Search and Cashier Filter bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Receipt ID (#sale_), Patient Name, or Date..."
                  className="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Cashier Filter */}
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                <span className="material-symbols-outlined text-gray-500 text-sm">badge</span>
                <span className="text-xs font-bold text-gray-700">Cashier:</span>
                <select
                  value={cashierFilter}
                  onChange={(e) => setCashierFilter(e.target.value)}
                  className="bg-white text-xs font-bold border border-gray-300 rounded-lg px-2 py-1 focus:outline-none text-gray-800"
                >
                  <option value="ALL">All Cashiers ({sales.length})</option>
                  {cashierOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs font-semibold text-gray-500">
              Showing <strong>{filteredSales.length}</strong> of <strong>{sales.length}</strong> receipts
            </div>
          </div>

          {/* Sales List */}
          {filteredSales.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-gray-200 text-gray-400">
              No sales receipts found matching your query.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {filteredSales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((sale) => {
                  const saleItems = sale.items || (sale.inventory_id ? [{ medicine_name: sale.inventory_id, quantity: sale.quantity_sold, line_total: sale.sale_amount }] : []);
                  const saleTotal = sale.total_amount || sale.sale_amount || 0;
                  const isCredit = sale.payment_type === "credit";
                  const isVoided = sale.is_voided === true;

                  return (
                    <div
                      key={sale.id}
                      className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                        isVoided ? "border-rose-300 bg-rose-50/20 opacity-80" : "border-gray-200"
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-xs font-bold bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-200">
                            #{sale.receipt_no || sale.id}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                            {sale.sale_date ? new Date(sale.sale_date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </span>
                          
                          {/* Dynamic Cashier Tag */}
                          <span className="text-xs bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">person</span>
                            {sale.cashier_name || "Store Staff"}
                          </span>

                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isCredit ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {isCredit ? "Udhaar Sale" : "Cash Full"}
                          </span>

                          {isVoided && (
                            <span className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">block</span>
                              VOIDED ({sale.void_reason || "Cancelled"})
                            </span>
                          )}

                          {sale.patient_name && (
                            <span className="text-xs bg-sky-50 text-sky-800 px-2 py-0.5 rounded-md font-semibold">
                              {sale.patient_name}
                            </span>
                          )}
                        </div>

                        {/* Line Items */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {saleItems.map((item, i) => (
                            <span key={i} className="text-xs bg-gray-50 text-gray-800 px-2.5 py-1 rounded-lg border border-gray-200 font-medium">
                              {item.medicine_name} ({item.quantity} {item.unit_label || "unit"}{item.quantity > 1 ? "s" : ""})
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-gray-400 uppercase">Receipt Amount</div>
                          <div className={`text-xl font-black ${isVoided ? "line-through text-gray-400" : "text-teal-700"}`}>
                            Rs. {saleTotal.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => printThermalReceipt(sale, dbClinic.get())}
                            className="bg-teal-50 text-teal-800 border border-teal-200 px-3 py-2 rounded-xl text-xs font-bold hover:bg-teal-100 transition-colors flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-base">print</span>
                            Print (80mm)
                          </button>
                          {!isVoided && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenReturnModal(sale)}
                                className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-base">assignment_return</span>
                                Return
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setVoidModalSale(sale);
                                  setVoidReason("");
                                  setAdminPin("");
                                  setVoidError("");
                                }}
                                title="Void / Cancel this invoice (Requires Admin PIN)"
                                className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-2 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-base">cancel</span>
                                Void
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {Math.ceil(filteredSales.length / PAGE_SIZE) > 1 && (
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-gray-200 shadow-sm mt-4">
                  <div className="text-xs text-gray-500 font-medium">
                    Page <strong>{currentPage}</strong> of <strong>{Math.ceil(filteredSales.length / PAGE_SIZE)}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 bg-gray-50 text-gray-700 disabled:opacity-40 hover:bg-gray-100"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= Math.ceil(filteredSales.length / PAGE_SIZE)}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 bg-gray-50 text-gray-700 disabled:opacity-40 hover:bg-gray-100"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: Medicine Returns & Refunds Log */}
      {activeTab === "returns" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Medicine Returns &amp; Restocking Audit Log</h2>
              <p className="text-xs text-gray-500">Track returned medications, patient refund amounts &amp; stock restoration</p>
            </div>
            <div className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
              Total Refunds: Rs. {totalRefundsValue.toLocaleString()}
            </div>
          </div>

          {returns.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-gray-200 text-gray-400">
              No medicine returns or exchanges recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {returns.map((ret) => (
                <div key={ret.id} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-rose-600 bg-rose-50 p-1.5 rounded-lg text-lg">assignment_return</span>
                      <span className="font-bold text-slate-900 text-xs">Receipt #{ret.sale_id || ret.receipt_no}</span>
                      <span className="text-xs text-slate-500 font-mono">({formatDate(ret.return_date || ret.created_at)})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        ret.refund_type === "cash" ? "bg-rose-100 text-rose-800" : "bg-blue-100 text-blue-800"
                      }`}>
                        {ret.refund_type === "cash" ? "Cash Refund" : "Khata Credit"}
                      </span>
                      <span className="font-mono font-black text-rose-700 text-sm">
                        - Rs. {Number(ret.refund_amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-700 font-medium">
                    <span className="font-bold text-slate-900">Reason:</span> {ret.reason || "Doctor changed prescription"}
                  </div>

                  {ret.returned_items?.length > 0 && (
                    <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-slate-800 text-[11px] block">Returned Items Restocked:</span>
                      {ret.returned_items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-slate-600 font-mono text-[11px]">
                          <span>• {item.medicine_name}</span>
                          <span className="font-bold text-slate-900">Qty: {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PROCESS RETURN / EXCHANGE MODAL */}
      {returnModalSale && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleConfirmReturn} className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 border border-rose-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Process Medicine Return / Exchange</h3>
                <p className="text-xs text-rose-700 font-semibold">Receipt #{returnModalSale.id} · {returnModalSale.patient_name || "Walk-in"}</p>
              </div>
              <button type="button" onClick={() => setReturnModalSale(null)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Select items to return */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 uppercase">Select Quantities to Return</label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {(returnModalSale.items || []).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{item.medicine_name}</div>
                      <div className="text-xs text-gray-500">
                        Purchased: {item.quantity} {item.unit_label} @ Rs. {item.unit_price}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 font-bold">Return Qty:</label>
                      <input
                        type="number"
                        min="0"
                        max={item.quantity}
                        value={returnQuantities[idx] || 0}
                        onChange={(e) => setReturnQuantities({ ...returnQuantities, [idx]: Number(e.target.value) })}
                        className="w-14 text-center border border-gray-300 rounded-lg py-1 font-bold text-sm bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Reason for Return *</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              >
                <option value="Doctor changed prescription formula">Doctor changed prescription formula</option>
                <option value="Patient no longer requires medication">Patient no longer requires medication</option>
                <option value="Damaged or defective packaging">Damaged or defective packaging</option>
                <option value="Wrong medicine dispensed by mistake">Wrong medicine dispensed by mistake</option>
              </select>
            </div>

            {/* Refund Type */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Refund Action *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundType("cash")}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    refundType === "cash" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "border-gray-200 text-gray-500"
                  }`}
                >
                  Refund Cash
                </button>
                <button
                  type="button"
                  onClick={() => setRefundType("credit")}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    refundType === "credit" ? "bg-rose-50 border-rose-300 text-rose-800" : "border-gray-200 text-gray-500"
                  }`}
                >
                  Adjust Patient Khata (Udhaar)
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <button type="button" onClick={() => setReturnModalSale(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-rose-700 shadow-md">
                Confirm Return &amp; Restock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Void Invoice Dialog (Protected with Admin PIN) */}
      {voidModalSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleConfirmVoid} className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <span className="material-symbols-outlined text-2xl">shield_lock</span>
                <h3 className="font-black text-gray-900 text-base">Void Invoice #{voidModalSale.receipt_no || voidModalSale.id}</h3>
              </div>
              <button type="button" onClick={() => setVoidModalSale(null)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Voiding this invoice will cancel the transaction, mark it permanently as <strong>VOIDED</strong> in the audit ledger, and automatically restock all dispensed medicines back into Store inventory.
            </p>

            {voidError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-rose-600">error</span>
                {voidError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mandatory Cancellation Reason *</label>
              <textarea
                required
                rows={2}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Doctor changed prescription before patient left, duplicate entry..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Doctor / Admin Master PIN *</label>
              <input
                type="password"
                required
                maxLength={8}
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Enter 4-digit Master PIN..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono tracking-widest text-center focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setVoidModalSale(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">block</span>
                Authorize &amp; Void Sale
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DrCreate & MS Access Sale Invoice Form & List Modal */}
      <SaleInvoiceModal
        isOpen={showSaleInvoiceModal}
        onClose={() => {
          setShowSaleInvoiceModal(false);
          loadAllData();
        }}
      />
    </div>
  );
}

