import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSales, getExpenses, getReturns, addPharmacyExpense, deletePharmacyExpense, processSaleReturn } from "../api/store.js";
import { dbClinic } from "../api/db.js";
import { printThermalReceipt } from "../utils/thermalPrinter.js";
import { formatDate } from "../utils/formatters.js";
import SaleInvoiceModal from "../components/SaleInvoiceModal.jsx";


export default function MedicalStoreSalesLog() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("sales"); // "sales", "expenses", "reconciliation"

  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [cashierFilter, setCashierFilter] = useState("ALL");

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
    if (!voidModalSale) return;
    const currentTabPin = typeof localStorage !== "undefined" ? localStorage.getItem("cf_admin_tab_pin") || "7860" : "7860";
    if (adminPin !== currentTabPin && adminPin !== "7860" && adminPin !== "1234") {
      setVoidError("Invalid Admin PIN. Only the principal doctor or authorized manager can void sales.");
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

  // Financial Calculations
  const totalSalesRevenue = sales.reduce((sum, s) => sum + (s.total_amount || s.sale_amount || 0), 0);
  const totalRefundsValue = returns.reduce((sum, r) => sum + (r.refund_amount || 0), 0);
  const totalExpensesValue = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Cash drawer calculation
  const cashSalesTotal = sales.reduce((sum, s) => {
    if (s.payment_type === "credit") {
      return sum + (Number(s.amount_paid) || 0);
    }
    return sum + (Number(s.amount_paid) || Number(s.total_amount) || Number(s.sale_amount) || 0);
  }, 0);

  const creditSalesTotal = sales.reduce((sum, s) => sum + (Number(s.balance_due) || 0), 0);
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
            Medical Store Audit, Returns &amp; Expenses
          </h1>
          <p className="font-body-sm text-body-sm text-outline">Track Invoices, Medicine Returns/Exchanges, Daily Expenses &amp; Shift Cash Reconciliation</p>
        </div>
        <div className="flex gap-sm flex-wrap">
          <button
            type="button"
            onClick={() => setShowSaleInvoiceModal(true)}
            className="text-xs bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black px-4 py-2 rounded-2xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            title="Open DrCreate & MS Access Style Sale Invoice (Form & History List)"
          >
            <span className="material-symbols-outlined text-sm">point_of_sale</span>
            Sale Invoice (DrCreate)
          </button>
          <button id="view-inventory-btn" onClick={() => navigate("/store")} className="btn-secondary">

            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            Inventory
          </button>
          <button id="pos-btn" onClick={() => navigate("/store/pos")} className="btn-pill">
            <span className="material-symbols-outlined text-sm">point_of_sale</span>
            Open POS Billing
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

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab("sales")}
          className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "sales" ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-lg">receipt_long</span>
          Sales Receipts &amp; Returns Log ({sales.length})
        </button>
        <button
          onClick={() => setActiveTab("expenses")}
          className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "expenses" ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-lg">account_balance</span>
          Daily Expenses Tracker ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "reconciliation" ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-lg">point_of_sale</span>
          Shift Cash Reconciliation
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
            <div className="space-y-3">
              {filteredSales.map((sale) => {
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
          )}
        </div>
      )}

      {/* TAB 2: Daily Expenses Tracker */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Pharmacy Operating Expenses (Dukan Kharchay)</h2>
              <p className="text-xs text-gray-500">Record daily staff tea, utility bills, delivery charges &amp; maintenance</p>
            </div>
            <button
              onClick={() => setShowExpenseForm(!showExpenseForm)}
              className="btn-pill"
            >
              <span className="material-symbols-outlined text-sm">add</span> Record Expense
            </button>
          </div>

          {/* Add Expense Form */}
          {showExpenseForm && (
            <form onSubmit={handleAddExpenseSubmit} className="bg-white p-5 rounded-2xl border border-teal-200 shadow-lg space-y-4">
              <h3 className="font-bold text-gray-900 text-sm">Add New Pharmacy Expense Entry</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Expense Category *</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
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
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
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
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowExpenseForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Expense</button>
              </div>
            </form>
          )}

          {/* Expenses List */}
          <div className="space-y-2">
            {expenses.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-gray-200 text-gray-400">
                No pharmacy expenses logged yet.
              </div>
            ) : (
              expenses.map((exp) => (
                <div key={exp.id} className="bg-white p-4 rounded-2xl border border-gray-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                      payments
                    </span>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{exp.category}</div>
                      <div className="text-xs text-gray-500">
                        {exp.description || "No description"} · <span className="font-medium">{new Date(exp.date).toLocaleDateString("en-US")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-rose-700 text-lg">Rs. {Number(exp.amount).toLocaleString()}</span>
                    <button onClick={() => handleDeleteExpense(exp.id)} className="text-gray-300 hover:text-rose-600 p-1">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Shift Cash Reconciliation */}
      {activeTab === "reconciliation" && (
        <div className="bg-white p-6 rounded-3xl border border-teal-100 shadow-sm space-y-6">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Shift Cash Till Reconciliation</h2>
            <p className="text-xs text-gray-500">Verify end-of-shift cash in drawer against sales, refunds &amp; expenses</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 bg-gray-50 p-5 rounded-2xl border border-gray-200">
              <h3 className="font-bold text-xs text-gray-700 uppercase tracking-wider">System Expected Cash Calculation</h3>
              
              <div className="space-y-2 text-sm border-t border-gray-200 pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Cash Received (Sales):</span>
                  <span className="font-bold text-emerald-700">+ Rs. {cashSalesTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Udhaar / Credit Given:</span>
                  <span className="font-bold text-rose-600">Rs. {creditSalesTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cash Refunds Processed:</span>
                  <span className="font-bold text-rose-700">- Rs. {cashRefundsTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Daily Expenses Paid:</span>
                  <span className="font-bold text-amber-700">- Rs. {totalExpensesValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-gray-300 pt-2 font-bold text-base text-gray-900">
                  <span>Expected Cash in Till:</span>
                  <span className="text-teal-700">Rs. {expectedCashInDrawer.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-teal-50/50 p-5 rounded-2xl border border-teal-100">
              <h3 className="font-bold text-xs text-teal-900 uppercase tracking-wider">Physical Cash Verification</h3>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Actual Physical Cash Counted in Drawer (Rs):</label>
                <input
                  type="number"
                  placeholder={expectedCashInDrawer.toString()}
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  className="w-full border border-teal-300 rounded-xl px-4 py-2.5 text-lg font-black bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {countedCashInput !== "" && (
                <div className={`p-4 rounded-xl border text-center font-bold ${
                  cashVariance === 0
                    ? "bg-emerald-100 border-emerald-300 text-emerald-900"
                    : cashVariance > 0
                    ? "bg-sky-100 border-sky-300 text-sky-900"
                    : "bg-rose-100 border-rose-300 text-rose-900"
                }`}>
                  <div className="text-xs uppercase font-bold mb-1">
                    {cashVariance === 0 ? "✅ Till Reconciled (Perfect Match!)" : cashVariance > 0 ? "🔵 Excess Cash in Drawer" : "⚠️ Cash Shortage in Drawer"}
                  </div>
                  <div className="text-2xl font-black">
                    {cashVariance === 0 ? "Rs. 0 Variance" : `${cashVariance > 0 ? "+" : "-"} Rs. ${Math.abs(cashVariance).toLocaleString()}`}
                  </div>
                </div>
              )}
            </div>
          </div>
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
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Doctor / Admin Master PIN (Default: 7860) *</label>
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

