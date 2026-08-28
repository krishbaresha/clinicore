import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { dbCashBook, dbAccounts, dbParties, dbSuppliers, dbClinic } from "../api/db.js";
import { printCashVoucherReceipt } from "../utils/thermalPrinter.js";

/**
 * Searchable Combobox for Chart of Accounts (260+ Parties, Suppliers, Expense Accounts)
 */
function SearchableAccountSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select or search account...",
  onAddNew,
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
    return options.filter((opt) =>
      (opt.label || "").toLowerCase().includes(q) ||
      (opt.sublabel || "").toLowerCase().includes(q) ||
      (opt.badge || "").toLowerCase().includes(q)
    );
  }, [options, search]);

  const selectedOpt = options.find((o) => o.id === value || o.label === value || o.account_name === value);

  return (
    <div ref={dropdownRef} className="relative w-full">
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[11px] font-bold text-gray-700">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="text-[10px] text-emerald-700 hover:text-emerald-900 font-black flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-xs">add</span>
              + New Account
            </button>
          )}
        </div>
      )}

      {/* Trigger Box */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className={`w-full bg-white border ${
          isOpen ? "border-emerald-500 ring-2 ring-emerald-100" : "border-gray-300 hover:border-gray-400"
        } rounded-xl px-3 py-2 text-xs font-bold text-left flex items-center justify-between shadow-sm transition-all`}
      >
        <span className={`truncate ${selectedOpt ? "text-gray-900 font-black" : "text-gray-400 font-medium"}`}>
          {selectedOpt ? (
            <span className="flex items-center gap-1.5 truncate">
              {selectedOpt.badge && (
                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-emerald-100 text-emerald-800">
                  {selectedOpt.badge}
                </span>
              )}
              {selectedOpt.label}
              {selectedOpt.sublabel && (
                <span className="text-[10px] text-gray-500 font-normal">({selectedOpt.sublabel})</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <span className="material-symbols-outlined text-sm text-gray-400 ml-1 shrink-0">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-[9999] overflow-hidden flex flex-col max-h-72 animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-gray-400">search</span>
            <input
              type="text"
              autoFocus
              placeholder="Search account name, type, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs font-bold focus:outline-none placeholder-gray-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[10px] text-gray-400 hover:text-gray-600 font-bold"
              >
                Clear
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 p-1 space-y-0.5 divide-y divide-gray-50">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400 font-medium">No matching accounts found.</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id || opt.label}
                  type="button"
                  onClick={() => {
                    onChange(opt.label || opt.account_name, opt);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-50 rounded-lg flex items-center justify-between text-xs transition-colors group"
                >
                  <div className="truncate flex items-center gap-1.5">
                    {opt.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-gray-100 group-hover:bg-emerald-200 group-hover:text-emerald-900 text-gray-700">
                        {opt.badge}
                      </span>
                    )}
                    <span className="font-bold text-gray-800 group-hover:text-emerald-900 truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[10.5px] text-gray-400 group-hover:text-emerald-700 truncate">
                        • {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {opt.extra && (
                    <span className="text-[10.5px] font-black text-rose-600 shrink-0 ml-2">{opt.extra}</span>
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

/**
 * DrCreate & MS Access CASHBOOK _FORM Modal Engine
 */
export default function CashBookModal({ isOpen, onClose }) {
  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [voucherNo, setVoucherNo] = useState("C-5160");
  const [term, setTerm] = useState("Receive"); // "Receive" | "Paid"
  const [accountName, setAccountName] = useState("");
  const [naration, setNaration] = useState("");
  const [amount, setAmount] = useState("");
  const [autoPrint, setAutoPrint] = useState(true);

  // Collections & Lists
  const [accounts, setAccounts] = useState([]);
  const [todaySummary, setTodaySummary] = useState({
    total_debit: 0,
    total_credit: 0,
    balance: 0,
    receive_entries: [],
    paid_entries: [],
  });
  const [toastMsg, setToastMsg] = useState("");

  // History & Filter tab
  const [activeTab, setActiveTab] = useState("daily"); // "daily" | "history"
  const [historySearch, setHistorySearch] = useState("");
  const [historyTermFilter, setHistoryTermFilter] = useState("All");

  // Load Accounts & Next Voucher on open
  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen, date]);

  const loadData = () => {
    // 1. Accounts list
    const accList = dbAccounts.getAll();
    setAccounts(accList);

    // 2. Next Voucher
    const nextV = dbCashBook.getNextVoucherNo();
    setVoucherNo(nextV);

    // 3. Daily Summary for the selected date
    const summary = dbCashBook.getDailySummary(date);
    setTodaySummary(summary);
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Prepare Account Options for Searchable Combobox
  const accountOptions = useMemo(() => {
    const parties = dbParties.getAll();
    const sups = dbSuppliers.getAll();
    return accounts.map((acc) => {
      const matchedParty = parties.find((p) => p.name.toLowerCase() === acc.account_name.toLowerCase());
      const matchedSup = sups.find((s) => s.name.toLowerCase() === acc.account_name.toLowerCase());
      
      let extraDue = null;
      let codePrefix = "";
      if (matchedParty) {
        if (matchedParty.party_code) codePrefix = `[#${matchedParty.party_code}] `;
        if (matchedParty.current_balance > 0) extraDue = `Udhaar: Rs. ${matchedParty.current_balance.toLocaleString("en-US")}`;
      } else if (matchedSup) {
        if (matchedSup.supplier_code) codePrefix = `[#${matchedSup.supplier_code}] `;
        const supBal = Number(matchedSup.current_balance || matchedSup.balance_due || 0);
        if (supBal > 0) extraDue = `Payable: Rs. ${supBal.toLocaleString("en-US")}`;
      } else if (acc.account_no) {
        codePrefix = `[#${acc.account_no}] `;
      }

      return {
        id: acc.id || acc.account_name,
        label: `${codePrefix}${acc.account_name}`,
        badge: acc.account_type || "General",
        sublabel: acc.naration || "",
        extra: extraDue,
        raw: acc,
      };
    });
  }, [accounts]);

  // Handle Form Submit
  const handleSubmit = (e) => {
    e.preventDefault();

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      alert("⚠️ Please enter a valid non-zero transaction Amount.");
      return;
    }
    if (!accountName || !accountName.trim()) {
      alert("⚠️ Please select an Account Name.");
      return;
    }

    const newEntry = dbCashBook.addEntry({
      date,
      voucher_no: voucherNo,
      term,
      account_name: accountName,
      naration: naration || (term === "Receive" ? "Cash Received" : "Cash Paid"),
      amount: numAmount,
    });

    if (autoPrint) {
      try {
        const clinicData = dbClinic.get();
        printCashVoucherReceipt(newEntry, clinicData);
      } catch (err) {
        console.error("Thermal print failed:", err);
      }
    }

    showToast(`✅ ${term === "Receive" ? "Cash Receipt" : "Cash Payment"} ${voucherNo} posted successfully!`);

    // Reset fields for next entry & increment voucher
    setAmount("");
    setNaration("");
    setAccountName("");
    loadData();
  };

  // Handle Entry Deletion
  const handleDelete = (entry) => {
    if (confirm(`Are you sure you want to delete Cash Voucher ${entry.voucher_no} (Rs. ${entry.amount})?`)) {
      dbCashBook.deleteEntry(entry.id || entry.voucher_no);
      showToast(`🗑️ Voucher ${entry.voucher_no} deleted.`);
      loadData();
    }
  };

  // Handle Entry Reprint
  const handlePrint = (entry) => {
    const clinicData = dbClinic.get();
    printCashVoucherReceipt(entry, clinicData);
  };

  // Quick Naration Presets
  const quickNarations = term === "Receive"
    ? ["Bill Clear", "Cash Received", "Token Consultation Fee", "Advance Payment", "Udhaar Recovery", "Customer Ledger Settlement"]
    : ["Staff Tea & Refreshment", "Shop Daily Expenses", "Electricity / Utility Bill", "Courier & Transport Freight", "Medicine Purchase Bill", "Doctor Personal Drawing", "Staff Daily Allowance"];

  // Full History List
  const allEntries = useMemo(() => {
    return dbCashBook.getAll({
      term: historyTermFilter === "All" ? null : historyTermFilter,
      account_name: historySearch,
    });
  }, [historySearch, historyTermFilter, toastMsg, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-emerald-500/20 overflow-hidden flex flex-col max-h-[94vh] my-auto">
        
        {/* ─── DRCREATE CLASSIC GREEN TOP HEADER BANNER ──────────────── */}
        <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 text-white p-4 sm:p-5 flex items-center justify-between shadow-lg relative overflow-hidden shrink-0">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
              <span className="material-symbols-outlined text-3xl text-white">menu_book</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase drop-shadow-sm">
                  CASHBOOK _FORM
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider border border-white/30">
                  Double-Entry Ledger
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-semibold mt-0.5">
                {dbClinic.get()?.name || "H/Dr.Asif Ashraf Khan Clinic"} • Daily Cash Inflow &amp; Outflow
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10">
            <button
              type="button"
              onClick={() => dbCashBook.exportCSV()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors border border-white/20"
              title="Export All CashBook Transactions to CSV"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Export CSV
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors font-black"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ─── TOAST ALERT ────────────────────────────────────────────── */}
        {toastMsg && (
          <div className="bg-emerald-900 text-emerald-100 text-xs font-black px-4 py-2 flex items-center justify-between shadow-inner animate-in slide-in-from-top duration-150">
            <span>{toastMsg}</span>
            <button onClick={() => setToastMsg("")} className="text-xs font-bold text-emerald-300">Dismiss</button>
          </div>
        )}

        {/* ─── TAB NAVIGATION ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("daily")}
              className={`px-4 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "daily"
                  ? "border-emerald-600 text-emerald-900 bg-white shadow-sm"
                  : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <span className="material-symbols-outlined text-sm">edit_calendar</span>
              Daily Cash Register ({date})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "border-emerald-600 text-emerald-900 bg-white shadow-sm"
                  : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <span className="material-symbols-outlined text-sm">history</span>
              Full CashBook History Log
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <label className="text-[11px] font-black text-gray-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-teal-600">calendar_today</span>
              Select Date:
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-black text-gray-900 bg-white focus:border-emerald-500 focus:outline-none shadow-sm"
            />
          </div>
        </div>

        {/* ─── MAIN CONTENT BODY ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          
          {activeTab === "daily" ? (
            <div className="space-y-6">
              
              {/* ─── TOP TRANSACTION ENTRY FORM (DrCreate Style) ──────── */}
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3.5 items-end">
                  
                  {/* Voucher No (Read-Only) */}
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Voucher No</label>
                    <input
                      type="text"
                      readOnly
                      value={voucherNo}
                      className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-black text-emerald-900 font-mono text-center shadow-inner cursor-not-allowed"
                    />
                  </div>

                  {/* Term Radio Toggle: Receive vs Paid */}
                  <div className="lg:col-span-3">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Term / Type <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setTerm("Receive")}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                          term === "Receive"
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">arrow_downward</span>
                        Receive
                      </button>

                      <button
                        type="button"
                        onClick={() => setTerm("Paid")}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                          term === "Paid"
                            ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">arrow_upward</span>
                        Paid
                      </button>
                    </div>
                  </div>

                  {/* Account Name Dropdown */}
                  <div className="lg:col-span-4">
                    <SearchableAccountSelect
                      label="Account Name"
                      required
                      value={accountName}
                      onChange={(val) => setAccountName(val)}
                      options={accountOptions}
                      placeholder={term === "Receive" ? "Select Customer / Party..." : "Select Expense / Supplier / Dr..."}
                    />
                  </div>

                  {/* Amount Input */}
                  <div className="lg:col-span-3">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Amount (Rs.) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">Rs.</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs font-black text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Naration / Description */}
                  <div className="lg:col-span-9">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Naration / Description</label>
                      <span className="text-[10px] text-gray-400 font-semibold">Quick select below</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Bill Clear, Chai Kharcha, Utility Bill, Delivery Courier..."
                      value={naration}
                      onChange={(e) => setNaration(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none shadow-sm"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="lg:col-span-3">
                    <button
                      type="submit"
                      className="w-full h-[38px] bg-slate-900 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-slate-900/20 flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      Submit Entry
                    </button>
                  </div>
                </div>

                {/* Quick Naration Presets Bar */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mr-1">Presets:</span>
                  {quickNarations.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNaration(tag)}
                      className="px-2 py-0.5 text-[10.5px] font-bold bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-800 rounded-lg transition-colors border border-gray-200/60"
                    >
                      + {tag}
                    </button>
                  ))}

                  <label className="ml-auto flex items-center gap-1.5 text-[10.5px] font-bold text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPrint}
                      onChange={(e) => setAutoPrint(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    80mm Thermal Receipt
                  </label>
                </div>
              </form>

              {/* ─── DUAL REAL-TIME GRIDS (DrCreate Side-by-Side) ─────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* 1. DEBIT TABLE: Cash Inflow / Receive */}
                <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-emerald-50/80 px-4 py-3 border-b border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                        Cash Receipts (Debit / Inflows)
                      </h3>
                    </div>
                    <span className="text-[10.5px] font-black text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      {todaySummary.receive_entries.length} Entries
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-gray-100">
                    {todaySummary.receive_entries.length === 0 ? (
                      <div className="py-10 text-center text-xs text-gray-400 font-medium">
                        No cash received on {date}.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-gray-50/75 text-[10px] font-black uppercase text-gray-500 sticky top-0">
                          <tr>
                            <th className="px-3 py-2">Voucher</th>
                            <th className="px-3 py-2">Account Name</th>
                            <th className="px-3 py-2">Naration</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-2 py-2 text-center w-16">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium text-gray-800">
                          {todaySummary.receive_entries.map((r) => (
                            <tr key={r.id || r.voucher_no} className="hover:bg-emerald-50/40 transition-colors">
                              <td className="px-3 py-2 font-mono font-bold text-emerald-900 text-[11px]">
                                {r.voucher_no}
                              </td>
                              <td className="px-3 py-2 font-bold text-gray-900 truncate max-w-[120px]">
                                {r.account_name}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-gray-500 truncate max-w-[100px]">
                                {r.naration || "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-black text-emerald-700">
                                Rs. {Number(r.amount).toLocaleString("en-US")}
                              </td>
                              <td className="px-2 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handlePrint(r)}
                                    title="Print 80mm Receipt"
                                    className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                                  >
                                    <span className="material-symbols-outlined text-sm">print</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(r)}
                                    title="Delete Entry"
                                    className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="bg-emerald-50/60 px-4 py-2.5 border-t border-emerald-100 flex items-center justify-between mt-auto">
                    <span className="text-xs font-black text-emerald-950 uppercase">Total Debit:</span>
                    <span className="text-sm font-black text-emerald-800 font-mono">
                      Rs. {todaySummary.total_debit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* 2. CREDIT TABLE: Cash Outflow / Paid */}
                <div className="bg-white rounded-2xl border border-rose-200/80 shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-rose-50/80 px-4 py-3 border-b border-rose-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <h3 className="text-xs font-black text-rose-950 uppercase tracking-wider">
                        Cash Payments (Credit / Outflows)
                      </h3>
                    </div>
                    <span className="text-[10.5px] font-black text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded-full">
                      {todaySummary.paid_entries.length} Entries
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-gray-100">
                    {todaySummary.paid_entries.length === 0 ? (
                      <div className="py-10 text-center text-xs text-gray-400 font-medium">
                        No payments recorded on {date}.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-gray-50/75 text-[10px] font-black uppercase text-gray-500 sticky top-0">
                          <tr>
                            <th className="px-3 py-2">Voucher</th>
                            <th className="px-3 py-2">Account Name</th>
                            <th className="px-3 py-2">Naration</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-2 py-2 text-center w-16">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium text-gray-800">
                          {todaySummary.paid_entries.map((r) => (
                            <tr key={r.id || r.voucher_no} className="hover:bg-rose-50/40 transition-colors">
                              <td className="px-3 py-2 font-mono font-bold text-rose-900 text-[11px]">
                                {r.voucher_no}
                              </td>
                              <td className="px-3 py-2 font-bold text-gray-900 truncate max-w-[120px]">
                                {r.account_name}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-gray-500 truncate max-w-[100px]">
                                {r.naration || "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-black text-rose-700">
                                Rs. {Number(r.amount).toLocaleString("en-US")}
                              </td>
                              <td className="px-2 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handlePrint(r)}
                                    title="Print 80mm Receipt"
                                    className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                                  >
                                    <span className="material-symbols-outlined text-sm">print</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(r)}
                                    title="Delete Entry"
                                    className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="bg-rose-50/60 px-4 py-2.5 border-t border-rose-100 flex items-center justify-between mt-auto">
                    <span className="text-xs font-black text-rose-950 uppercase">Total Credit:</span>
                    <span className="text-sm font-black text-rose-800 font-mono">
                      Rs. {todaySummary.total_credit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

              </div>

              {/* ─── BOTTOM CASHBOOK BALANCE FOOTER ─────────────────── */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Total Debit (Inflow)</span>
                    <div className="text-lg font-black text-emerald-400 font-mono">
                      + Rs. {todaySummary.total_debit.toLocaleString("en-US")}
                    </div>
                  </div>

                  <div className="h-8 w-px bg-slate-700 hidden sm:block" />

                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Total Credit (Outflow)</span>
                    <div className="text-lg font-black text-rose-400 font-mono">
                      - Rs. {todaySummary.total_credit.toLocaleString("en-US")}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                    Net Cash Balance Today ({date})
                  </span>
                  <div className={`text-2xl font-black font-mono ${todaySummary.balance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    Rs. {todaySummary.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* ─── FULL HISTORY LOG VIEW ──────────────────────────────── */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                  <span className="material-symbols-outlined text-gray-400 text-sm">search</span>
                  <input
                    type="text"
                    placeholder="Search voucher, party name, naration..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full text-xs font-bold focus:outline-none bg-transparent"
                  />
                  {historySearch && (
                    <button onClick={() => setHistorySearch("")} className="text-xs text-gray-400 hover:text-gray-600 font-bold">Clear</button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={historyTermFilter}
                    onChange={(e) => setHistoryTermFilter(e.target.value)}
                    className="border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-black text-gray-800 bg-white"
                  >
                    <option value="All">All Types (Receive &amp; Paid)</option>
                    <option value="Receive">Receive (Receipts)</option>
                    <option value="Paid">Paid (Payments)</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => dbCashBook.exportCSV(allEntries)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">file_download</span>
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Voucher #</th>
                      <th className="px-3.5 py-2.5">Type</th>
                      <th className="px-3.5 py-2.5">Account Name</th>
                      <th className="px-3.5 py-2.5">Naration</th>
                      <th className="px-3.5 py-2.5 text-right">Debit (Rec)</th>
                      <th className="px-3.5 py-2.5 text-right">Credit (Paid)</th>
                      <th className="px-3.5 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                    {allEntries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-xs text-gray-400">
                          No matching cashbook entries found.
                        </td>
                      </tr>
                    ) : (
                      allEntries.map((e) => {
                        const isRec = (e.term || e.type) === "Receive";
                        return (
                          <tr key={e.id || e.voucher_no} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3.5 py-2.5 text-[11px] font-mono text-gray-600">
                              {(e.date || "").split("T")[0]}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-gray-900">
                              {e.voucher_no}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                isRec ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                              }`}>
                                {e.term || e.type}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 font-bold text-gray-900">
                              {e.account_name}
                            </td>
                            <td className="px-3.5 py-2.5 text-gray-500 text-[11px] truncate max-w-[160px]">
                              {e.naration || e.description || "—"}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700">
                              {isRec ? `Rs. ${Number(e.amount).toLocaleString("en-US")}` : "—"}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-bold text-rose-700">
                              {!isRec ? `Rs. ${Number(e.amount).toLocaleString("en-US")}` : "—"}
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handlePrint(e)}
                                  title="Print 80mm Voucher"
                                  className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                                >
                                  <span className="material-symbols-outlined text-sm">print</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(e)}
                                  title="Delete Voucher"
                                  className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* ─── FOOTER ─────────────────────────────────────────────────── */}
        <div className="bg-gray-100 px-6 py-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 font-bold shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>K.B Software • Double-Entry CashBook Engine</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-black transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
