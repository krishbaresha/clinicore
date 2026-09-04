import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { getSales, getReturns, processSaleReturn } from "../api/store.js";
import {
  dbClinic,
  dbSales,
  dbCashBook,
  dbAccounts,
  dbParties,
  dbSuppliers,
  dbCompanies,
} from "../api/db.js";
import { printThermalReceipt, printCashVoucherReceipt, printPartyPaymentReceipt } from "../utils/thermalPrinter.js";
import { formatDate } from "../utils/formatters.js";
import SaleInvoiceModal from "../components/SaleInvoiceModal.jsx";

// Quick Preset Expense Categories for 1-Click Fast Kharcha Entry (No Account Needed)
const SHOP_EXPENSE_PRESETS = [
  { name: "Staff Chai & Refreshment", icon: "☕", hint: "Chai, Water, Biscuits" },
  { name: "Electricity / WAPDA Bill", icon: "💡", hint: "Shop Electric Bill / Generator" },
  { name: "Courier & Delivery Freight", icon: "🛵", hint: "Bilty, TCS, Local Delivery" },
  { name: "Daily Boy Wages / Rozina", icon: "👷", hint: "Helper Daily Wage" },
  { name: "Monthly Store Rent", icon: "🏪", hint: "Shop / Building Rent" },
  { name: "Generator Petrol / Fuel", icon: "⛽", hint: "Fuel & Mobil Oil" },
  { name: "Stationery & Thermal Rolls", icon: "🖨️", hint: "Thermal Rolls & Office Items" },
  { name: "Shop Maintenance & Repairs", icon: "🔧", hint: "AC, Electric, Fixtures" },
  { name: "Doctor Personal Drawing", icon: "🩺", hint: "Doctor Cash Draw" },
  { name: "Miscellaneous Petty Cash", icon: "📦", hint: "General Daily Petty Kharcha" },
];

/**
 * Searchable Combobox for Wholesale B2B Parties & Pharma Suppliers ONLY
 * (Strictly excludes internal expense heads & dummy accounts)
 */
function SearchablePartySupplierSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select or search party / supplier...",
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
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span className="w-3.5 h-3.5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-black leading-none">+</span>
              <span>Register Party / Supplier</span>
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
        className={`w-full min-h-[38px] bg-white border ${
          isOpen ? "border-teal-600 ring-2 ring-teal-100" : "border-slate-300 hover:border-slate-400"
        } rounded-lg px-3 py-1.5 text-xs font-bold text-left flex items-center justify-between shadow-2xs transition-all cursor-pointer`}
      >
        <span className={`truncate ${selectedOpt ? "text-slate-900 font-bold" : "text-slate-400 font-medium"}`}>
          {selectedOpt ? (
            <span className="flex items-center gap-1.5 truncate">
              {selectedOpt.badge && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                    selectedOpt.badge === "Party"
                      ? "bg-emerald-100 text-emerald-900"
                      : selectedOpt.badge === "Supplier"
                      ? "bg-purple-100 text-purple-900"
                      : "bg-teal-100 text-teal-900"
                  }`}
                >
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
        <svg
          className={`w-4 h-4 text-slate-400 transform transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[999] overflow-hidden flex flex-col max-h-72 animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="text"
              autoFocus
              placeholder="Search Party name, code, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none placeholder-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[10px] text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="overflow-y-auto custom-scrollbar flex-1 p-1.5 space-y-0.5 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="p-4 space-y-2 text-center">
                <p className="text-xs text-slate-500 font-medium">No party or supplier found matching "{search}".</p>
                {onAddNew && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onAddNew();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    + Register "{search}" as New Party / Supplier
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id || opt.label}
                  type="button"
                  onClick={() => {
                    onChange(opt.label || opt.name, opt);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-teal-50 rounded-xl flex items-center justify-between text-xs transition-colors group cursor-pointer"
                >
                  <div className="truncate flex items-center gap-1.5">
                    {opt.badge && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                          opt.badge === "Party"
                            ? "bg-emerald-100 text-emerald-900 group-hover:bg-emerald-200"
                            : opt.badge === "Supplier"
                            ? "bg-purple-100 text-purple-900 group-hover:bg-purple-200"
                            : "bg-teal-100 text-teal-900 group-hover:bg-teal-200"
                        }`}
                      >
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
                    <span className="text-[10.5px] font-bold text-rose-600 shrink-0 ml-2 font-mono">{opt.extra}</span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Quick Footer */}
          <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400">
              {options.length} Registered Parties &amp; Suppliers
            </span>
            {onAddNew && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onAddNew();
                }}
                className="text-[10.5px] font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
              >
                + Register New
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MedicalStoreSalesLog() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("sales"); // "sales" | "returns" | "cashbook"

  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [cashBookEntries, setCashBookEntries] = useState([]);

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

  // CashBook / Roznamcha Form State
  const [roznamchaSubTab, setRoznamchaSubTab] = useState("parties_suppliers"); // "parties_suppliers" | "shop_expenses"
  const [cbVoucherNo, setCbVoucherNo] = useState("C-5160");
  const [cbAutoPrint, setCbAutoPrint] = useState(true);
  const [cbHistorySearch, setCbHistorySearch] = useState("");
  const [cbViewMode, setCbViewMode] = useState("daily"); // "daily" | "all"
  const [cbFilterCategory, setCbFilterCategory] = useState("all"); // "all" | "receive" | "supplier_paid" | "shop_expense"
  const [accountUpdateTrigger, setAccountUpdateTrigger] = useState(0);

  // Sub-Form 1: 🏛️ Party & Supplier Khata State (Cash & Credit Management)
  const [cbPartyTargetType, setCbPartyTargetType] = useState("party"); // "party" | "supplier"
  const [cbPartyActionType, setCbPartyActionType] = useState("party_wasooli");
  // Party actions: "party_wasooli" (Receive Payment), "party_credit_sale" (Credit Sale), "party_cash_sale" (Spot Cash Sale)
  // Supplier actions: "supplier_payment" (Pay Supplier Debt), "supplier_credit_purchase" (Receive Credit Stock), "supplier_cash_purchase" (Cash Stock Purchase)
  const [cbPartyPaymentMode, setCbPartyPaymentMode] = useState("Cash"); // "Cash" | "Bank Transfer" | "Cheque"
  const [cbPartyBankName, setCbPartyBankName] = useState("");
  const [cbPartyChequeNo, setCbPartyChequeNo] = useState("");
  const [cbPartyAccountName, setCbPartyAccountName] = useState("");
  const [cbPartyAmount, setCbPartyAmount] = useState("");
  const [cbPartyNarration, setCbPartyNarration] = useState("");

  // Sub-Form 2: 💸 Direct Shop Expense State (No Account Needed)
  const [cbExpenseHead, setCbExpenseHead] = useState("Staff Chai & Refreshment");
  const [cbExpenseAmount, setCbExpenseAmount] = useState("");
  const [cbExpenseNarration, setCbExpenseNarration] = useState("");

  // Dedicated Party / Supplier Registration Modal State
  const [showPartySupplierModal, setShowPartySupplierModal] = useState(false);
  const [newPartySupplierForm, setNewPartySupplierForm] = useState({
    category: "party", // "party" | "supplier"
    name: "",
    code: "",
    city: "Hyderabad",
    phone: "",
    opening_balance: "",
    address: "",
  });

  const [toastMsg, setToastMsg] = useState("");

  // DrCreate Sale Invoice Modal State
  const [showSaleInvoiceModal, setShowSaleInvoiceModal] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  function loadAllData() {
    const sr = getSales();
    if (sr.success) setSales([...sr.data].sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date)));

    const rr = getReturns();
    if (rr.success) setReturns([...rr.data].sort((a, b) => new Date(b.return_date) - new Date(a.return_date)));

    const allCb = dbCashBook.getAll() || [];
    setCashBookEntries(allCb);
    setCbVoucherNo(dbCashBook.getNextVoucherNo());
  }

  useEffect(() => {
    loadAllData();
    window.addEventListener("clinicflow_status_update", loadAllData);
    return () => window.removeEventListener("clinicflow_status_update", loadAllData);
  }, []);

  const cashierOptions = Array.from(new Set(sales.map((s) => s.cashier_name || "Store Staff").filter(Boolean)));

  // Account options for Searchable Select: Strictly B2B Wholesale Parties, Pharma Suppliers & Companies
  const partySupplierOptions = useMemo(() => {
    const parties = dbParties.getAll() || [];
    const suppliers = dbSuppliers.getAll() || [];
    const companies = dbCompanies.getAll() || [];

    const options = [];
    const addedNames = new Set();

    // 1. Add Wholesale Parties (Customers)
    parties.forEach((p) => {
      const bal = Number(p.current_balance ?? p.balance_due ?? 0);
      const nameKey = (p.name || "").toLowerCase().trim();
      if (!nameKey) return;
      addedNames.add(nameKey);
      options.push({
        id: p.id || p.name,
        label: p.name,
        badge: "Party",
        sublabel: `${p.city || "Hyderabad"} • Code: ${p.party_code || p.id}`,
        extra: bal > 0 ? `Udhaar Dues: Rs. ${bal.toLocaleString("en-US")}` : "Udhaar: Rs. 0",
        raw: p,
      });
    });

    // 2. Add Pharma Suppliers (Distributors)
    suppliers.forEach((s) => {
      const bal = Number(s.current_balance ?? s.balance_due ?? 0);
      const nameKey = (s.name || "").toLowerCase().trim();
      if (!nameKey || addedNames.has(nameKey)) return;
      addedNames.add(nameKey);
      options.push({
        id: s.id || s.name,
        label: s.name,
        badge: "Supplier",
        sublabel: `Code: ${s.supplier_code || s.code || s.id}`,
        extra: bal > 0 ? `Payable Dues: Rs. ${bal.toLocaleString("en-US")}` : "Payable: Rs. 0",
        raw: s,
      });
    });

    // 3. Add Registered Pharma Companies / Brands
    companies.forEach((c) => {
      const cName = typeof c === "string" ? c : c.name || "";
      if (!cName) return;
      const nameKey = cName.toLowerCase().trim();
      if (!addedNames.has(nameKey)) {
        addedNames.add(nameKey);
        options.push({
          id: typeof c === "object" && c.id ? c.id : cName,
          label: cName,
          badge: "Company",
          sublabel: "Pharma Manufacturer",
          extra: null,
          raw: c,
        });
      }
    });

    return options;
  }, [accountUpdateTrigger]);

  // Handle Register Party / Supplier Modal Submit
  const handleSavePartySupplierModal = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newPartySupplierForm.name.trim()) {
      alert("Please enter a name for the party or supplier.");
      return;
    }

    let created;
    if (newPartySupplierForm.category === "party") {
      created = dbParties.add({
        party_code: newPartySupplierForm.code.trim() || undefined,
        name: newPartySupplierForm.name.trim(),
        city: newPartySupplierForm.city.trim() || "Hyderabad",
        phone: newPartySupplierForm.phone.trim(),
        address: newPartySupplierForm.address.trim(),
        balance_due: Number(newPartySupplierForm.opening_balance) || 0,
        current_balance: Number(newPartySupplierForm.opening_balance) || 0,
      });
    } else {
      created = dbSuppliers.add({
        supplier_code: newPartySupplierForm.code.trim() || undefined,
        name: newPartySupplierForm.name.trim(),
        city: newPartySupplierForm.city.trim() || "Hyderabad",
        phone: newPartySupplierForm.phone.trim(),
        address: newPartySupplierForm.address.trim(),
        balance_due: Number(newPartySupplierForm.opening_balance) || 0,
        current_balance: Number(newPartySupplierForm.opening_balance) || 0,
      });
    }

    setAccountUpdateTrigger((prev) => prev + 1);
    setCbPartyAccountName(created.name);
    setShowPartySupplierModal(false);
    setNewPartySupplierForm({
      category: "party",
      name: "",
      code: "",
      city: "Hyderabad",
      phone: "",
      opening_balance: "",
      address: "",
    });
    showToast(`✅ ${newPartySupplierForm.category === "party" ? "Party" : "Supplier"} "${created.name}" registered & selected!`);
    loadAllData();
    window.dispatchEvent(new CustomEvent("clinicflow_status_update"));
  };

  // 1. Submit Party & Supplier Khata Voucher (Udhaar Wasooli, Credit Sale/Purchase, Spot Cash, Old Payments)
  const handlePartySupplierSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const numAmount = Math.max(0, Number(cbPartyAmount) || 0);
    if (!numAmount || numAmount <= 0) {
      alert("Please enter a valid amount greater than Rs. 0.");
      return;
    }
    if (!cbPartyAccountName.trim()) {
      alert("Please select a Party or Supplier from the list.");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const activeCashier = user?.name || user?.full_name || user?.username || "Admin / Cashier";
    const selectedOpt = partySupplierOptions.find(
      (o) => o.label.toLowerCase() === cbPartyAccountName.toLowerCase() || o.id === cbPartyAccountName
    );
    const rawEntity = selectedOpt?.raw;

    const isCreditTx = cbPartyActionType === "party_credit_sale" || cbPartyActionType === "supplier_credit_purchase";
    const term = isCreditTx
      ? "Credit"
      : (cbPartyActionType === "supplier_payment" || cbPartyActionType === "supplier_cash_purchase")
        ? "Paid"
        : "Receive";

    let defaultCategory = "Party Wasooli";
    if (cbPartyActionType === "party_wasooli") defaultCategory = "Party Wasooli";
    else if (cbPartyActionType === "party_credit_sale") defaultCategory = "Party Credit Sale";
    else if (cbPartyActionType === "party_cash_sale") defaultCategory = "Party Cash Sale";
    else if (cbPartyActionType === "supplier_payment") defaultCategory = "Supplier Payment";
    else if (cbPartyActionType === "supplier_credit_purchase") defaultCategory = "Company Credit Purchase";
    else if (cbPartyActionType === "supplier_cash_purchase") defaultCategory = "Company Cash Purchase";

    let defaultNarration = "";
    if (cbPartyActionType === "party_wasooli") defaultNarration = `Party Udhaar Wasooli - ${cbPartyAccountName}`;
    else if (cbPartyActionType === "party_credit_sale") defaultNarration = `Party Stock on Credit (Udhaar) - ${cbPartyAccountName}`;
    else if (cbPartyActionType === "party_cash_sale") defaultNarration = `Party Cash Sale - ${cbPartyAccountName}`;
    else if (cbPartyActionType === "supplier_payment") defaultNarration = `Supplier Balance Payment - ${cbPartyAccountName}`;
    else if (cbPartyActionType === "supplier_credit_purchase") defaultNarration = `Company Stock on Credit (Payable) - ${cbPartyAccountName}`;
    else if (cbPartyActionType === "supplier_cash_purchase") defaultNarration = `Company Stock on Cash - ${cbPartyAccountName}`;

    if (cbPartyPaymentMode !== "Cash" && !isCreditTx) {
      if (cbPartyBankName) defaultNarration += ` [${cbPartyPaymentMode}: ${cbPartyBankName}]`;
      if (cbPartyChequeNo) defaultNarration += ` [Cheque #${cbPartyChequeNo}]`;
    }

    const newEntry = dbCashBook.addEntry({
      date: todayStr,
      voucher_no: cbVoucherNo,
      term,
      action_type: cbPartyActionType,
      payment_mode: isCreditTx ? "Credit" : cbPartyPaymentMode,
      bank_name: cbPartyBankName || undefined,
      cheque_no: cbPartyChequeNo || undefined,
      account_name: cbPartyAccountName,
      party_id: selectedOpt?.badge === "Party" ? (rawEntity?.id || cbPartyAccountName) : undefined,
      supplier_id: (selectedOpt?.badge === "Supplier" || selectedOpt?.badge === "Company") ? (rawEntity?.id || cbPartyAccountName) : undefined,
      naration: cbPartyNarration || defaultNarration,
      amount: numAmount,
      cashier: activeCashier,
      category: defaultCategory,
    });

    if (cbAutoPrint) {
      try {
        const clinicData = dbClinic.get();
        if (cbPartyActionType === "party_wasooli" && selectedOpt?.badge === "Party") {
          const prevBal = Number(rawEntity?.current_balance ?? rawEntity?.balance_due ?? 0);
          printPartyPaymentReceipt({
            receipt_no: cbVoucherNo,
            party_name: cbPartyAccountName,
            party_code: rawEntity?.party_code || "",
            amount_paid: numAmount,
            previous_balance: prevBal,
            remaining_balance: Math.max(0, prevBal - numAmount),
            date: todayStr,
            cashier: activeCashier,
            payment_mode: cbPartyPaymentMode,
          }, clinicData);
        } else {
          printCashVoucherReceipt({
            ...newEntry,
            payment_mode: isCreditTx ? "Credit Note" : cbPartyPaymentMode,
            bank_name: cbPartyBankName,
            cheque_no: cbPartyChequeNo,
          }, clinicData);
        }
      } catch (err) {
        console.error("Slip print failed:", err);
      }
    }

    showToast(`✅ ${defaultCategory} (${cbVoucherNo} - Rs. ${numAmount.toLocaleString()}) posted!`);
    setCbPartyAmount("");
    setCbPartyNarration("");
    setCbPartyBankName("");
    setCbPartyChequeNo("");
    setCbPartyAccountName("");
    setAccountUpdateTrigger((prev) => prev + 1);
    loadAllData();
  };

  // 2. Submit Direct Shop Expense (Kharcha - Chai, Bijli, Rozina — No Account Needed)
  const handleShopExpenseSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const numAmount = Math.max(0, Number(cbExpenseAmount) || 0);
    if (!numAmount || numAmount <= 0) {
      alert("Please enter a valid expense amount greater than Rs. 0.");
      return;
    }
    const expHead = (cbExpenseHead || "").trim() || "Daily Shop Expense";

    const todayStr = new Date().toISOString().split("T")[0];
    const activeCashier = user?.name || user?.full_name || user?.username || "Admin / Cashier";

    const newEntry = dbCashBook.addEntry({
      date: todayStr,
      voucher_no: cbVoucherNo,
      term: "Paid",
      account_name: expHead,
      naration: cbExpenseNarration || `Shop Operating Kharcha (${expHead})`,
      amount: numAmount,
      cashier: activeCashier,
      category: "Shop Expense",
    });

    if (cbAutoPrint) {
      try {
        printCashVoucherReceipt(newEntry, dbClinic.get());
      } catch (err) {
        console.error("Slip print failed:", err);
      }
    }

    showToast(`✅ Shop Expense "Rs. ${numAmount.toLocaleString()} (${expHead})" posted!`);
    setCbExpenseAmount("");
    setCbExpenseNarration("");
    loadAllData();
  };

  const handleCashBookDelete = (entry) => {
    if (confirm(`Delete Cash Voucher ${entry.voucher_no} (Rs. ${entry.amount})?`)) {
      dbCashBook.deleteEntry(entry.id || entry.voucher_no);
      showToast(`🗑️ Voucher ${entry.voucher_no} deleted.`);
      loadAllData();
    }
  };

  const handleCashBookReprint = (entry) => {
    try {
      const activeCashier = user?.name || user?.full_name || user?.username || "Admin / Cashier";
      if (entry.source === "PARTY_RECOVERY") {
        printPartyPaymentReceipt(entry.raw, dbClinic.get());
      } else {
        const rawEntry = entry.raw || entry;
        printCashVoucherReceipt({ ...rawEntry, cashier: rawEntry.cashier || activeCashier }, dbClinic.get());
      }
    } catch (err) {
      console.error("CashBook voucher reprint failed:", err);
    }
  };

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
          unit_price: item.unit_price || 0,
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
      refund_type: refundType,
    });

    if (result.success) {
      alert(`Return processed successfully! Rs. ${result.data.refund_amount.toLocaleString()} refunded & stock restocked.`);
      setReturnModalSale(null);
      loadAllData();
    } else {
      alert(`Return Error: ${result.error.message}`);
    }
  }

  // Financial Calculations
  const validSales = sales.filter((s) => !s.is_voided);
  const totalSalesRevenue = validSales.reduce((sum, s) => sum + (s.total_amount || s.sale_amount || 0), 0);
  const totalRefundsValue = returns.reduce((sum, r) => sum + (r.refund_amount || 0), 0);

  // CashBook day totals
  const todayDateStr = new Date().toISOString().split("T")[0];
  const todayCashBook = cashBookEntries.filter((r) => (r.date || "").split("T")[0] === todayDateStr);
  const dayCashRecTotal = todayCashBook.filter((r) => (r.term || r.type) === "Receive").reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const dayCashPaidTotal = todayCashBook.filter((r) => (r.term || r.type) === "Paid").reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  // Cash drawer calculation
  const cashSalesTotal = validSales.reduce((sum, s) => {
    const paid = Number(s.paid_amount ?? s.amount_paid);
    if (s.payment_type === "credit" || s.payment_mode === "Credit") {
      return sum + (isNaN(paid) ? 0 : paid);
    }
    return sum + (!isNaN(paid) ? paid : (Number(s.total_amount) || Number(s.sale_amount) || 0));
  }, 0);

  const cashRefundsTotal = returns.filter((r) => r.refund_type === "cash").reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0);
  const expectedCashInDrawer = Math.max(0, cashSalesTotal + dayCashRecTotal - cashRefundsTotal - dayCashPaidTotal);

  // Display CashBook entries (daily vs all with search and category filter)
  const displayCashBookEntries = useMemo(() => {
    let list = cbViewMode === "daily" ? todayCashBook : cashBookEntries;
    if (cbFilterCategory === "receive") {
      list = list.filter((e) => (e.term || e.type) === "Receive");
    } else if (cbFilterCategory === "supplier_paid") {
      list = list.filter((e) => (e.term || e.type) === "Paid" && e.category === "Supplier Payment");
    } else if (cbFilterCategory === "shop_expense") {
      list = list.filter((e) => (e.term || e.type) === "Paid" && e.category !== "Supplier Payment");
    }

    if (!cbHistorySearch.trim()) return list;
    const q = cbHistorySearch.toLowerCase();
    return list.filter(
      (e) =>
        (e.account_name || "").toLowerCase().includes(q) ||
        (e.voucher_no || "").toLowerCase().includes(q) ||
        (e.naration || "").toLowerCase().includes(q) ||
        (e.category || "").toLowerCase().includes(q)
    );
  }, [cbViewMode, todayCashBook, cashBookEntries, cbHistorySearch, cbFilterCategory]);

  const quickPartyNarations = useMemo(() => {
    switch (cbPartyActionType) {
      case "party_wasooli":
        return ["Party Udhaar Wasooli", "Bill Clearance", "Advance Booking", "Cash Wasooli Received", "Monthly Settlement"];
      case "party_credit_sale":
        return ["Stock Issued on Credit", "Wholesale Credit Invoice", "Emergency Stock on Udhaar", "Party Monthly Credit Delivery"];
      case "party_cash_sale":
        return ["Party Spot Cash Sale", "Direct Counter Cash Sale", "Urgent Medicine Cash Sale"];
      case "supplier_payment":
        return ["Supplier Balance Payment", "Distributor Invoice Clearance", "Old Payable Settlement", "Bank Transfer to Company"];
      case "supplier_credit_purchase":
        return ["Company Stock on Credit", "Distributor Inward Goods", "Medicine Delivery on Credit (Payable)", "Monthly Company Consignment"];
      case "supplier_cash_purchase":
        return ["Company Stock on Cash", "Direct Cash Purchase of Medicines", "Spot Payment on Delivery"];
      default:
        return ["Account Settlement", "Invoice Clearance", "Payment"];
    }
  }, [cbPartyActionType]);

  return (
    <div className="p-3 sm:p-5 md:p-8 flex flex-col gap-md max-w-6xl mx-auto w-full mobile-safe-bottom touch-scroll overflow-x-hidden">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-2">
          {toastMsg}
        </div>
      )}

      {/* Page Header (Neat & Clean - Zero Clutter) */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-3xl border border-teal-100 shadow-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600">receipt_long</span>
            Medical Store Audit, Sales &amp; Returns Log
          </h1>
          <p className="font-body-sm text-body-sm text-outline">Manage Sales Invoices, Restocking Returns, Refunds &amp; Double-Entry Roznamcha Expenses</p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-sm">
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
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Today Expenses (Paid)</div>
            <div className="text-xl font-black text-amber-700">- Rs. {dayCashPaidTotal.toLocaleString()}</div>
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

      {/* Navigation Tabs (3 Unified Workstations) */}
      <div className="flex border-b border-gray-200 gap-2 flex-wrap">
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
        <button
          onClick={() => setActiveTab("cashbook")}
          className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === "cashbook" ? "border-teal-600 text-teal-700 font-black" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-lg text-teal-700">menu_book</span>
          CashBook &amp; Expense Ledger ({cashBookEntries.length})
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: Sales & Receipts Log                                           */}
      {/* ===================================================================== */}
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
                            className="bg-teal-50 text-teal-800 border border-teal-200 px-3 py-2 rounded-xl text-xs font-bold hover:bg-teal-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">print</span>
                            Print (80mm)
                          </button>
                          {!isVoided && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenReturnModal(sale)}
                                className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
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
                                className="bg-rose-50 text-rose-800 border border-rose-200 px-3 py-2 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-base">block</span>
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

              {/* Pagination */}
              {Math.ceil(filteredSales.length / PAGE_SIZE) > 1 && (
                <div className="flex justify-center items-center gap-2 pt-4">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-xs font-bold text-gray-600">
                    Page {currentPage} of {Math.ceil(filteredSales.length / PAGE_SIZE)}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredSales.length / PAGE_SIZE), p + 1))}
                    disabled={currentPage === Math.ceil(filteredSales.length / PAGE_SIZE)}
                    className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: Medicine Returns & Restocking Log                              */}
      {/* ===================================================================== */}
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
                          <span className="font-bold text-slate-900">Qty: {item.quantity || item.quantity_returned}</span>
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

      {/* ===================================================================== */}
      {/* TAB 3: 📖 CashBook Ledger (Roznamcha & Operating Expenses)             */}
      {/* ===================================================================== */}
      {activeTab === "cashbook" && (
        <div className="space-y-4">
          {/* Sub-Mode Selector Tabs */}
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-2 border border-slate-200 shadow-inner flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setRoznamchaSubTab("parties_suppliers")}
              className={`flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                roznamchaSubTab === "parties_suppliers"
                  ? "bg-white text-slate-900 shadow-md ring-1 ring-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span className="material-symbols-outlined text-teal-700 text-lg">account_balance</span>
              <span className="truncate">Party &amp; Supplier Khata</span>
            </button>

            <button
              type="button"
              onClick={() => setRoznamchaSubTab("shop_expenses")}
              className={`flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                roznamchaSubTab === "shop_expenses"
                  ? "bg-white text-slate-900 shadow-md ring-1 ring-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span className="material-symbols-outlined text-rose-600 text-lg">payments</span>
              <span className="truncate">Daily Expenses</span>
            </button>
          </div>

          {/* SUB-TAB 1: 🏛️ Party & Supplier Khata Form (Cash & Credit Management) */}
          {roznamchaSubTab === "parties_suppliers" && (
            <form onSubmit={handlePartySupplierSubmit} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black text-lg border border-teal-100 shrink-0">
                    <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight flex items-center gap-2">
                      <span>Party &amp; Supplier Ledger</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                        {cbPartyTargetType === "party" ? "Customer" : "Supplier"}
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPartySupplierForm((prev) => ({
                        ...prev,
                        category: cbPartyTargetType === "party" ? "party" : "supplier",
                      }));
                      setShowPartySupplierModal(true);
                    }}
                    className="min-h-[32px] text-xs font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1.5 bg-teal-50 px-3 py-1 rounded-lg border border-teal-200 cursor-pointer shadow-2xs hover:bg-teal-100 transition-colors"
                  >
                    <span className="text-teal-600 font-black">+</span>
                    <span>New {cbPartyTargetType === "party" ? "Party" : "Supplier"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => dbCashBook.exportCSV()}
                    className="min-h-[32px] text-xs font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer shadow-2xs hover:bg-slate-200 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Step 1: Target Entity Switcher (Wholesale Party vs Pharma Company/Supplier) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    1. Account Type
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">Voucher #{cbVoucherNo}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Option A: Wholesale Party */}
                  <button
                    type="button"
                    onClick={() => {
                      setCbPartyTargetType("party");
                      setCbPartyActionType("party_wasooli");
                      setCbPartyAccountName("");
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      cbPartyTargetType === "party"
                        ? "bg-teal-50/80 border-teal-400 ring-2 ring-teal-200 text-teal-950 shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      <span className="material-symbols-outlined text-base">storefront</span>
                    </div>
                    <div className="text-xs font-bold leading-tight">Customer / Party</div>
                  </button>

                  {/* Option B: Pharma Supplier / Company */}
                  <button
                    type="button"
                    onClick={() => {
                      setCbPartyTargetType("supplier");
                      setCbPartyActionType("supplier_payment");
                      setCbPartyAccountName("");
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      cbPartyTargetType === "supplier"
                        ? "bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200 text-indigo-950 shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      <span className="material-symbols-outlined text-base">factory</span>
                    </div>
                    <div className="text-xs font-bold leading-tight">Pharma Supplier</div>
                  </button>
                </div>
              </div>

              {/* Step 2: Specific Operation Action Buttons */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  2. Transaction Type
                </label>

                {cbPartyTargetType === "party" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Party Action 1: Wasooli */}
                    <button
                      type="button"
                      onClick={() => setCbPartyActionType("party_wasooli")}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2 ${
                        cbPartyActionType === "party_wasooli"
                          ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 text-emerald-950 font-bold shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-semibold"
                      }`}
                    >
                      <span className="material-symbols-outlined text-emerald-600 text-base">savings</span>
                      <span className="text-xs">Payment Received (Wasooli)</span>
                    </button>

                    {/* Party Action 2: Credit Sale */}
                    <button
                      type="button"
                      onClick={() => setCbPartyActionType("party_credit_sale")}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2 ${
                        cbPartyActionType === "party_credit_sale"
                          ? "bg-amber-50 border-amber-500 ring-2 ring-amber-200 text-amber-950 font-bold shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-semibold"
                      }`}
                    >
                      <span className="material-symbols-outlined text-amber-600 text-base">receipt_long</span>
                      <span className="text-xs">Credit Sale (Udhaar)</span>
                    </button>

                    {/* Party Action 3: Spot Cash Sale */}
                    <button
                      type="button"
                      onClick={() => setCbPartyActionType("party_cash_sale")}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2 ${
                        cbPartyActionType === "party_cash_sale"
                          ? "bg-teal-50 border-teal-500 ring-2 ring-teal-200 text-teal-950 font-bold shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-semibold"
                      }`}
                    >
                      <span className="material-symbols-outlined text-teal-600 text-base">payments</span>
                      <span className="text-xs">Cash Sale</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Supplier Action 1: Old Payment */}
                    <button
                      type="button"
                      onClick={() => setCbPartyActionType("supplier_payment")}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2 ${
                        cbPartyActionType === "supplier_payment"
                          ? "bg-rose-50 border-rose-500 ring-2 ring-rose-200 text-rose-950 font-bold shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-semibold"
                      }`}
                    >
                      <span className="material-symbols-outlined text-rose-600 text-base">price_check</span>
                      <span className="text-xs">Payment Made (Payable)</span>
                    </button>

                    {/* Supplier Action 2: Stock on Credit */}
                    <button
                      type="button"
                      onClick={() => setCbPartyActionType("supplier_credit_purchase")}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2 ${
                        cbPartyActionType === "supplier_credit_purchase"
                          ? "bg-amber-50 border-amber-500 ring-2 ring-amber-200 text-amber-950 font-bold shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-semibold"
                      }`}
                    >
                      <span className="material-symbols-outlined text-amber-600 text-base">inventory_2</span>
                      <span className="text-xs">Credit Purchase</span>
                    </button>

                    {/* Supplier Action 3: Stock on Cash */}
                    <button
                      type="button"
                      onClick={() => setCbPartyActionType("supplier_cash_purchase")}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2 ${
                        cbPartyActionType === "supplier_cash_purchase"
                          ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 text-indigo-950 font-bold shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-semibold"
                      }`}
                    >
                      <span className="material-symbols-outlined text-indigo-600 text-base">shopping_cart_checkout</span>
                      <span className="text-xs">Cash Purchase</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Step 3: Account Selector, Amount, Payment Mode, and Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-100">
                {/* Searchable Party / Supplier Select */}
                <div className="lg:col-span-4">
                  <SearchablePartySupplierSelect
                    label={cbPartyTargetType === "party" ? "Party Name" : "Supplier Name"}
                    required
                    value={cbPartyAccountName}
                    onChange={(val) => setCbPartyAccountName(val)}
                    options={partySupplierOptions.filter((opt) =>
                      cbPartyTargetType === "party" ? opt.badge === "Party" : (opt.badge === "Supplier" || opt.badge === "Company")
                    )}
                    onAddNew={() => {
                      setNewPartySupplierForm((prev) => ({
                        ...prev,
                        category: cbPartyTargetType === "party" ? "party" : "supplier",
                      }));
                      setShowPartySupplierModal(true);
                    }}
                    placeholder={cbPartyTargetType === "party" ? "Search Party..." : "Search Supplier..."}
                  />
                </div>

                {/* Amount */}
                <div className="lg:col-span-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Amount (Rs.) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="0.00"
                      value={cbPartyAmount}
                      onChange={(e) => setCbPartyAmount(e.target.value)}
                      className="w-full min-h-[38px] bg-white border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-teal-600 focus:outline-none shadow-2xs font-mono"
                    />
                  </div>
                </div>

                {/* Payment Mode Selector (Only shown when physical money/bank moves, not pure credit) */}
                {cbPartyActionType !== "party_credit_sale" && cbPartyActionType !== "supplier_credit_purchase" ? (
                  <div className="lg:col-span-5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Payment Mode
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setCbPartyPaymentMode("Cash")}
                        className={`min-h-[34px] flex items-center justify-center gap-1 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          cbPartyPaymentMode === "Cash"
                            ? "bg-teal-700 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <span>Cash</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCbPartyPaymentMode("Bank Transfer")}
                        className={`min-h-[34px] flex items-center justify-center gap-1 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          cbPartyPaymentMode === "Bank Transfer"
                            ? "bg-indigo-700 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <span>Bank</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCbPartyPaymentMode("Cheque")}
                        className={`min-h-[34px] flex items-center justify-center gap-1 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          cbPartyPaymentMode === "Cheque"
                            ? "bg-amber-700 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <span>Cheque</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="lg:col-span-5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Khata Entry
                    </label>
                    <div className="min-h-[38px] bg-amber-50 border border-amber-300 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-amber-900">
                      <span>Credit Entry (No Cash Movement)</span>
                    </div>
                  </div>
                )}

                {/* Optional Bank Name & Cheque # Inputs */}
                {cbPartyPaymentMode !== "Cash" && cbPartyActionType !== "party_credit_sale" && cbPartyActionType !== "supplier_credit_purchase" && (
                  <>
                    <div className="lg:col-span-6">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        placeholder="Bank Name..."
                        value={cbPartyBankName}
                        onChange={(e) => setCbPartyBankName(e.target.value)}
                        className="w-full min-h-[38px] bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none shadow-2xs"
                      />
                    </div>
                    <div className="lg:col-span-6">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Cheque / Tx ID
                      </label>
                      <input
                        type="text"
                        placeholder="Cheque # or Tx Ref..."
                        value={cbPartyChequeNo}
                        onChange={(e) => setCbPartyChequeNo(e.target.value)}
                        className="w-full min-h-[38px] bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none shadow-2xs"
                      />
                    </div>
                  </>
                )}

                {/* Narration */}
                <div className="lg:col-span-9">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="Enter details or leave blank..."
                    value={cbPartyNarration}
                    onChange={(e) => setCbPartyNarration(e.target.value)}
                    className="w-full min-h-[38px] bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none shadow-2xs"
                  />
                </div>

                {/* Submit Button */}
                <div className="lg:col-span-3">
                  <button
                    type="submit"
                    className="w-full min-h-[38px] bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Save Entry</span>
                  </button>
                </div>
              </div>

              {/* Live Balance & Impact HUD Banner */}
              {cbPartyAccountName && (() => {
                const selectedOpt = partySupplierOptions.find(
                  (o) => o.label.toLowerCase() === cbPartyAccountName.toLowerCase() || o.id === cbPartyAccountName
                );
                if (!selectedOpt) return null;
                const rawEntity = selectedOpt.raw;
                const prevBal = Number(rawEntity?.current_balance ?? rawEntity?.balance_due ?? 0);
                const numAmt = Math.max(0, Number(cbPartyAmount) || 0);

                let newBal = prevBal;
                let drawerImpactText = "Rs. 0 (Khata Entry)";
                let drawerImpactColor = "text-slate-600";

                if (cbPartyActionType === "party_wasooli") {
                  newBal = Math.max(0, prevBal - numAmt);
                  drawerImpactText = `+ Rs. ${numAmt.toLocaleString()} (Cash In)`;
                  drawerImpactColor = "text-emerald-700";
                } else if (cbPartyActionType === "party_credit_sale") {
                  newBal = prevBal + numAmt;
                  drawerImpactText = "Rs. 0 (No Cash Movement)";
                  drawerImpactColor = "text-amber-700";
                } else if (cbPartyActionType === "party_cash_sale") {
                  newBal = prevBal;
                  drawerImpactText = `+ Rs. ${numAmt.toLocaleString()} (Cash In)`;
                  drawerImpactColor = "text-emerald-700";
                } else if (cbPartyActionType === "supplier_payment") {
                  newBal = Math.max(0, prevBal - numAmt);
                  drawerImpactText = `- Rs. ${numAmt.toLocaleString()} (Cash Out)`;
                  drawerImpactColor = "text-rose-700";
                } else if (cbPartyActionType === "supplier_credit_purchase") {
                  newBal = prevBal + numAmt;
                  drawerImpactText = "Rs. 0 (No Cash Movement)";
                  drawerImpactColor = "text-amber-700";
                } else if (cbPartyActionType === "supplier_cash_purchase") {
                  newBal = prevBal;
                  drawerImpactText = `- Rs. ${numAmt.toLocaleString()} (Cash Out)`;
                  drawerImpactColor = "text-rose-700";
                }

                return (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs font-semibold animate-fade-in shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{selectedOpt.label}</span>
                      <span className="text-[11px] text-slate-500 font-mono">({selectedOpt.badge})</span>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <span className="text-slate-500 text-[11px]">Current: </span>
                        <span className="font-bold font-mono text-slate-800">Rs. {prevBal.toLocaleString()}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[11px]">New Balance: </span>
                        <span className="font-bold font-mono text-indigo-700">Rs. {newBal.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                        <span className="text-slate-500 text-[10.5px]">Drawer: </span>
                        <span className={`font-bold font-mono text-[11px] ${drawerImpactColor}`}>{drawerImpactText}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Quick Narration Presets */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Presets:</span>
                {quickPartyNarations.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setCbPartyNarration(tag)}
                    className="min-h-[26px] px-2 py-0.5 text-[10.5px] font-bold bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 rounded transition-colors border border-slate-200/80 cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}

                <label className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
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
          )}

          {/* SUB-TAB 2: 💸 Shop Daily Expenses Form (Chai, Electricity, Rozina — Fast Entry, No Account Creation) */}
          {roznamchaSubTab === "shop_expenses" && (
            <form onSubmit={handleShopExpenseSubmit} className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-100 space-y-4 shadow-sm animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-black">
                    💸
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                      Daily Operating Expenses
                    </h3>
                  </div>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cbAutoPrint}
                    onChange={(e) => setCbAutoPrint(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>80mm Thermal Receipt Slip</span>
                </label>
              </div>

              {/* 1-Click Fast Category Chips */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  ⚡ 1-Click Common Expense Heads (Click to Select):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {SHOP_EXPENSE_PRESETS.map((preset) => {
                    const isSelected = cbExpenseHead === preset.name;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setCbExpenseHead(preset.name);
                          if (!cbExpenseNarration) {
                            setCbExpenseNarration(preset.hint);
                          }
                        }}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-rose-50 border-rose-400 ring-2 ring-rose-200 text-rose-950 font-bold shadow-2xs"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                          <span>{preset.icon}</span>
                          <span className="truncate">{preset.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 truncate mt-0.5">{preset.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fast Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-100">
                {/* Voucher No */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Voucher No</label>
                  <input
                    type="text"
                    readOnly
                    value={cbVoucherNo}
                    className="w-full min-h-[38px] bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-teal-950 font-mono text-center shadow-inner cursor-not-allowed"
                  />
                </div>

                {/* Expense Title / Head */}
                <div className="lg:col-span-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Expense Head / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Staff Chai, WAPDA Bill, Petrol..."
                    value={cbExpenseHead}
                    onChange={(e) => setCbExpenseHead(e.target.value)}
                    className="w-full min-h-[38px] bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-rose-600 focus:outline-none shadow-2xs"
                  />
                </div>

                {/* Amount (Rs.) */}
                <div className="lg:col-span-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Amount (Rs.) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
                    <input
                      type="number"
                      min="1"
                      required
                      autoFocus
                      placeholder="0.00"
                      value={cbExpenseAmount}
                      onChange={(e) => setCbExpenseAmount(e.target.value)}
                      className="w-full min-h-[38px] bg-white border border-rose-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-bold text-rose-950 focus:border-rose-600 focus:outline-none shadow-2xs font-mono"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="lg:col-span-3">
                  <button
                    type="submit"
                    className="w-full min-h-[38px] bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <span>💸</span>
                    <span>Post Expense (Paid)</span>
                  </button>
                </div>

                {/* Narration */}
                <div className="lg:col-span-12">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Narration / Expense Breakdown (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 4 cups tea + bakery biscuits for staff, Month of August generator fuel..."
                    value={cbExpenseNarration}
                    onChange={(e) => setCbExpenseNarration(e.target.value)}
                    className="w-full min-h-[38px] bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-rose-600 focus:outline-none shadow-2xs"
                  />
                </div>
              </div>
            </form>
          )}

          {/* CashBook Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-800">Total Debit (Collections / Cash In)</div>
              <div className="text-lg sm:text-xl font-bold text-emerald-950 mt-0.5 font-mono">
                + Rs. {dayCashRecTotal.toLocaleString()}
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-rose-800">Total Credit (Suppliers &amp; Expenses)</div>
              <div className="text-lg sm:text-xl font-bold text-rose-950 mt-0.5 font-mono">
                - Rs. {dayCashPaidTotal.toLocaleString()}
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-3 sm:p-4 shadow-2xs">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Net Day CashBook Balance</div>
              <div className={`text-lg sm:text-xl font-bold mt-0.5 font-mono ${dayCashRecTotal - dayCashPaidTotal >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                Rs. {(dayCashRecTotal - dayCashPaidTotal).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Vouchers Register Table View */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-xs sm:text-sm">Vouchers Register</span>
                <span className="text-[11px] text-slate-400 font-mono">({displayCashBookEntries.length} entries)</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Category Filters */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setCbFilterCategory("all")}
                    className={`min-h-[28px] px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                      cbFilterCategory === "all" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setCbFilterCategory("receive")}
                    className={`min-h-[28px] px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                      cbFilterCategory === "receive" ? "bg-emerald-600 text-white shadow-2xs font-bold" : "text-slate-500 hover:text-emerald-700"
                    }`}
                  >
                    Collections (Receive)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCbFilterCategory("supplier_paid")}
                    className={`min-h-[28px] px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                      cbFilterCategory === "supplier_paid" ? "bg-purple-600 text-white shadow-2xs font-bold" : "text-slate-500 hover:text-purple-700"
                    }`}
                  >
                    Supplier Payments
                  </button>
                  <button
                    type="button"
                    onClick={() => setCbFilterCategory("shop_expense")}
                    className={`min-h-[28px] px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                      cbFilterCategory === "shop_expense" ? "bg-rose-600 text-white shadow-2xs font-bold" : "text-slate-500 hover:text-rose-700"
                    }`}
                  >
                    Shop Expenses
                  </button>
                </div>

                {/* Day vs All Filter */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setCbViewMode("daily")}
                    className={`min-h-[28px] px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                      cbViewMode === "daily" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-500"
                    }`}
                  >
                    Today ({todayDateStr})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCbViewMode("all")}
                    className={`min-h-[28px] px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                      cbViewMode === "all" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-500"
                    }`}
                  >
                    All History
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Search voucher, party, head..."
                  value={cbHistorySearch}
                  onChange={(e) => setCbHistorySearch(e.target.value)}
                  className="min-h-[30px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-0.5 text-xs font-medium focus:outline-none focus:border-teal-600 shadow-2xs"
                />
              </div>
            </div>

            {displayCashBookEntries.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                No vouchers found. Use the forms above to post your first voucher.
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[680px]">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-3.5 py-2.5">Voucher #</th>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Category</th>
                      <th className="px-3.5 py-2.5">Account / Party / Head</th>
                      <th className="px-3.5 py-2.5">Narration</th>
                      <th className="px-3.5 py-2.5">Cashier</th>
                      <th className="px-3.5 py-2.5 text-right">Debit (Receive)</th>
                      <th className="px-3.5 py-2.5 text-right">Credit (Paid)</th>
                      <th className="px-3.5 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {displayCashBookEntries.map((exp) => {
                      const isRec = (exp.term || exp.type) === "Receive";
                      const isSupplier = exp.category === "Supplier Payment";
                      return (
                        <tr key={exp.id || exp.voucher_no} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-teal-900">{exp.voucher_no}</td>
                          <td className="px-3.5 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                            {(exp.date || "").split("T")[0]}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isRec
                                  ? "bg-emerald-100 text-emerald-900"
                                  : isSupplier
                                  ? "bg-purple-100 text-purple-900"
                                  : "bg-rose-100 text-rose-900"
                              }`}
                            >
                              {exp.category || (isRec ? "Party Wasooli" : "Shop Expense")}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-bold text-slate-900">{exp.account_name}</td>
                          <td className="px-3.5 py-2.5 text-slate-600">{exp.naration || "—"}</td>
                          <td className="px-3.5 py-2.5 text-slate-500">{exp.cashier || "Admin / Cashier"}</td>
                          <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700 font-mono">
                            {isRec ? `Rs. ${Number(exp.amount || 0).toLocaleString()}` : "—"}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-bold text-rose-700 font-mono">
                            {!isRec ? `Rs. ${Number(exp.amount || 0).toLocaleString()}` : "—"}
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                title="Reprint Voucher Slip"
                                onClick={() => handleCashBookReprint(exp)}
                                className="p-1 rounded text-slate-400 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Delete Voucher"
                                onClick={() => handleCashBookDelete(exp)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
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

      {/* PROCESS RETURN / EXCHANGE MODAL */}
      {returnModalSale && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleConfirmReturn} className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 border border-rose-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Process Medicine Return / Exchange</h3>
                <p className="text-xs text-rose-700 font-semibold">Receipt #{returnModalSale.id} · {returnModalSale.patient_name || "Walk-in"}</p>
              </div>
              <button type="button" onClick={() => setReturnModalSale(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
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
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    refundType === "cash" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "border-gray-200 text-gray-500"
                  }`}
                >
                  Refund Cash
                </button>
                <button
                  type="button"
                  onClick={() => setRefundType("credit")}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    refundType === "credit" ? "bg-rose-50 border-rose-300 text-rose-800" : "border-gray-200 text-gray-500"
                  }`}
                >
                  Adjust Patient Khata (Udhaar)
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <button type="button" onClick={() => setReturnModalSale(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-rose-700 shadow-md cursor-pointer">
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
              <button type="button" onClick={() => setVoidModalSale(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
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
              <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center gap-1 cursor-pointer">
                <span className="material-symbols-outlined text-sm">block</span>
                Authorize &amp; Void Sale
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: Dedicated Register B2B Party / Pharma Supplier ─── */}
      {showPartySupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 font-bold text-base">
                  🏛️
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Register Party / Supplier</h3>
                  <p className="text-[10.5px] text-slate-300">Create B2B Wholesale Party or Pharma Supplier Account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPartySupplierModal(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePartySupplierModal} className="p-5 space-y-3.5">
              {/* Category Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Account Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPartySupplierForm({ ...newPartySupplierForm, category: "party" })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      newPartySupplierForm.category === "party"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-200"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>🏪</span>
                    <span>Wholesale Party (Customer)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPartySupplierForm({ ...newPartySupplierForm, category: "supplier" })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      newPartySupplierForm.category === "supplier"
                        ? "bg-purple-50 border-purple-500 text-purple-950 ring-2 ring-purple-200"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>🏭</span>
                    <span>Pharma Supplier (Distributor)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {newPartySupplierForm.category === "party" ? "Party Name" : "Supplier / Company Name"} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={newPartySupplierForm.category === "party" ? "e.g. Muslim Medical Store, Al-Madina Medicos..." : "e.g. Paul Brooks, Schwabe, MEKTUM Pharma..."}
                  value={newPartySupplierForm.name}
                  onChange={(e) => setNewPartySupplierForm({ ...newPartySupplierForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account / Party Code</label>
                  <input
                    type="text"
                    placeholder={newPartySupplierForm.category === "party" ? "e.g. 001, PTY-108" : "e.g. SUP-05"}
                    value={newPartySupplierForm.code}
                    onChange={(e) => setNewPartySupplierForm({ ...newPartySupplierForm, code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 font-mono focus:bg-white focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City / Area</label>
                  <input
                    type="text"
                    placeholder="e.g. Hyderabad, Kotri, Tando Adam"
                    value={newPartySupplierForm.city}
                    onChange={(e) => setNewPartySupplierForm({ ...newPartySupplierForm, city: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone / Mobile</label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={newPartySupplierForm.phone}
                    onChange={(e) => setNewPartySupplierForm({ ...newPartySupplierForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Opening {newPartySupplierForm.category === "party" ? "Udhaar" : "Payable"} (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newPartySupplierForm.opening_balance}
                    onChange={(e) => setNewPartySupplierForm({ ...newPartySupplierForm, opening_balance: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 font-mono focus:bg-white focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Address / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Shop #4, Market Road, Hyderabad"
                  value={newPartySupplierForm.address}
                  onChange={(e) => setNewPartySupplierForm({ ...newPartySupplierForm, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPartySupplierModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md transition active:scale-95 cursor-pointer"
                >
                  Save &amp; Select {newPartySupplierForm.category === "party" ? "Party" : "Supplier"}
                </button>
              </div>
            </form>
          </div>
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
