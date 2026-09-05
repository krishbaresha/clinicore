import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { dbSuppliers, dbPurchases, dbInventory, dbClinic, dbSupplierLedger, dbAccounts, dbGrnMetadata, dbWarehouses, dbCompanies } from "../api/db.js";
import { verifyAdminPasscode } from "../api/auth.js";
import { useAuth } from "../hooks/useAuth.js";
import { printSupplierPurchaseReceipt, printPurchaseGRNReceipt } from "../utils/thermalPrinter.js";

/**
 * Expandable Combobox with built-in instant search and tall scrollable dropdown (DrCreate / MS Access Style)
 */
function ExpandableCombobox({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select or search...",
  searchPlaceholder = "Type to search...",
  onAddNew,
  addNewLabel = "+ New",
  required = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const dropdownRef = useRef(null);
  const listContainerRef = useRef(null);

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

  useEffect(() => {
    setHighlightedIdx(0);
  }, [search, isOpen]);

  const selectedOpt = options.find((o) => o.id === value || o.label === value);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((prev) => {
        const next = prev < filteredOptions.length - 1 ? prev + 1 : prev;
        scrollHighlightedIntoView(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((prev) => {
        const next = prev > 0 ? prev - 1 : 0;
        scrollHighlightedIntoView(next);
        return next;
      });
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (filteredOptions.length > 0 && highlightedIdx >= 0 && highlightedIdx < filteredOptions.length) {
        e.preventDefault();
        const selected = filteredOptions[highlightedIdx];
        onChange(selected.id, selected);
        setIsOpen(false);
        setSearch("");
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      e.preventDefault();
    }
  };

  const scrollHighlightedIntoView = (index) => {
    if (!listContainerRef.current) return;
    const items = listContainerRef.current.children;
    if (items && items[index]) {
      items[index].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
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
              {addNewLabel}
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
        onKeyDown={handleKeyDown}
        className={`w-full bg-white border ${isOpen ? "border-emerald-500 ring-2 ring-emerald-100" : "border-gray-300 hover:border-gray-400"} rounded-xl px-3 py-2 text-xs font-bold text-left flex items-center justify-between shadow-sm transition-all`}
      >
        <span className={`truncate ${selectedOpt ? "text-gray-900 font-black" : "text-gray-400 font-medium"}`}>
          {selectedOpt ? (
            <span className="flex items-center gap-1.5 truncate">
              {selectedOpt.badge && (
                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-emerald-100 text-emerald-800">
                  {selectedOpt.badge}
                </span>
              )}
              <span className="truncate">{selectedOpt.label}</span>
              {selectedOpt.sublabel && (
                <span className="text-gray-400 text-[10px] font-normal truncate">({selectedOpt.sublabel})</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <span className={`material-symbols-outlined text-base text-gray-400 transition-transform ${isOpen ? "rotate-180 text-emerald-600" : ""}`}>
          arrow_drop_down
        </span>
      </button>

      {/* Expandable Tall Dropdown Popup (10-15 rows visible with scroll) */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-emerald-300 shadow-2xl z-[9999] overflow-hidden animate-fade-in flex flex-col max-h-72">
          {/* Search Header */}
          <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-1.5 sticky top-0 z-10">
            <span className="material-symbols-outlined text-base text-emerald-700">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              autoFocus
              className="w-full bg-transparent border-0 text-xs font-bold text-gray-800 placeholder-gray-400 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            )}
          </div>

          {/* Options List */}
          <div ref={listContainerRef} className="overflow-y-auto flex-1 p-1 space-y-0.5 max-h-60">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs font-semibold">
                No matches found for "{search}"
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.id === value || opt.label === value;
                const isHighlighted = idx === highlightedIdx;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.id, opt);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      isHighlighted || isSelected
                        ? "bg-emerald-600 text-white font-black"
                        : "hover:bg-emerald-50 text-gray-800 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.badge && (
                        <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black ${
                          isHighlighted || isSelected ? "bg-emerald-800 text-white" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {opt.badge}
                        </span>
                      )}
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className={`text-[10px] font-medium truncate ${isHighlighted || isSelected ? "text-emerald-200" : "text-gray-400"}`}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-sm">check</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Filter inventory list dynamically by Supplier / Manufacturer Company Name
 */
function filterInventoryByCompanyOrSupplier(inventoryList, companyOrSupplierStr, supplierObj = null) {
  if (!companyOrSupplierStr || companyOrSupplierStr === "all" || companyOrSupplierStr === "All") {
    return inventoryList;
  }

  const raw = (companyOrSupplierStr || "").toLowerCase().trim();
  const cleanName = raw
    .replace(/\(.*\)/g, "")
    .replace(/\b(pvt|ltd|limited|pharma|homoeo|homeopathic|lab|laboratories|co|store|agency|distributors?)\b/gi, "")
    .trim();

  const filtered = inventoryList.filter((inv) => {
    const invComp = (inv.company_name || "").toLowerCase().trim();
    const invSup = (inv.supplier_name || "").toLowerCase().trim();
    const invCode = (inv.item_code || "").toLowerCase().trim();

    // 1. Direct equality or substring
    if (invComp && (invComp === raw || raw.includes(invComp) || invComp.includes(cleanName))) return true;
    if (cleanName && invComp && (invComp.includes(cleanName) || cleanName.includes(invComp))) return true;
    if (invSup && (invSup === raw || raw.includes(invSup) || invSup.includes(cleanName))) return true;

    // 2. Supplier ID match
    if (supplierObj && inv.supplier_id && inv.supplier_id === supplierObj.id) return true;

    // 3. Known company brand abbreviations & prefixes
    if (cleanName.includes("bm") && (invComp.includes("bm") || invCode.startsWith("bm-"))) return true;
    if (cleanName.includes("paul") || cleanName.includes("brooks")) {
      if (invComp.includes("paul") || invComp.includes("brooks") || invCode.startsWith("pb-")) return true;
    }
    if (cleanName.includes("schwabe") || cleanName.includes("german")) {
      if (invComp.includes("schwabe") || invComp.includes("german") || invCode.startsWith("sc-") || invCode.startsWith("sch-")) return true;
    }
    if (cleanName.includes("mektum") || cleanName.includes("mkt")) {
      if (invComp.includes("mektum") || invCode.startsWith("mek-") || invCode.startsWith("mkt-")) return true;
    }
    if (cleanName.includes("blossom") || cleanName.includes("bls")) {
      if (invComp.includes("blossom") || invCode.startsWith("bls-")) return true;
    }
    if (cleanName.includes("eagle") || cleanName.includes("egl")) {
      if (invComp.includes("eagle") || invCode.startsWith("egl-") || invCode.startsWith("eah-")) return true;
    }
    if (cleanName.includes("hfp")) {
      if (invComp.includes("hfp") || invCode.startsWith("hfp-")) return true;
    }

    return false;
  });

  return filtered;
}

export default function SupplierPurchases() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);

  const allCompanyOptions = useMemo(() => {
    const list = suppliers && suppliers.length > 0 ? suppliers : [];
    const companies = list.map((s) => ({
      name: s.name,
      code: s.supplier_code || s.code || "",
    }));
    const dynamicCompanies = dbCompanies ? dbCompanies.getAll() : [];
    dynamicCompanies.forEach((d) => {
      if (!companies.some((c) => (c.name || "").toLowerCase() === d.name.toLowerCase())) {
        companies.push(d);
      }
    });
    return companies;
  }, [suppliers]);

  const [accountsList, setAccountsList] = useState([]);
  const [activeTab, setActiveTab] = useState("suppliers"); // "suppliers" | "bills" | "new_purchase"

  // DrCreate Purchase GRN Form State
  const [grnShowAllCompanies, setGrnShowAllCompanies] = useState(false);
  const [tab4ShowAllCompanies, setTab4ShowAllCompanies] = useState(false);
  const [referencesList, setReferencesList] = useState([]);
  const [transportsList, setTransportsList] = useState([]);
  const [_warehousesList, setWarehousesList] = useState([]);
  const [showNewRefInput, setShowNewRefInput] = useState(false);
  const [newRefText, setNewRefText] = useState("");
  const [showNewTransportInput, setShowNewTransportInput] = useState(false);
  const [newTransportText, setNewTransportText] = useState("");
  const [grnForm, setGrnForm] = useState({
    date: new Date().toLocaleDateString("en-US"),
    voucher_no: "P-1001",
    grn_no: "0",
    reference: "",
    account_name: "",
    naration: "",
    type: "Supplier",
    payment_mode: "Cash",
    transport: "By Hand",
    bilty_no: "",
    destination_type: "store",
    extra_bill_discount: "0",
    freight_charges: "0",
  });

  const [grnCart, setGrnCart] = useState({
    product_code: "",
    medicine_name: "",
    inventory_id: "",
    category: "",
    packing: "",
    batch_no: "",
    expiry_date: "",
    qty: "1",
    bonus_qty: "0",
    rate: "",
    gross: "",
    disc_pct: "40",
    disc_flat: "0",
    net_amount: "",
  });

  const [grnItems, setGrnItems] = useState([]);
  const [showGRNListModal, setShowGRNListModal] = useState(false);
  const [grnListSearch, setGrnListSearch] = useState("");
  const grnProductInputRef = useRef(null);
  const batchNoRef = useRef(null);
  const expDateRef = useRef(null);
  const qtyRef = useRef(null);
  const bonusQtyRef = useRef(null);
  const rateRef = useRef(null);
  const discPctRef = useRef(null);
  const discFlatRef = useRef(null);
  const addBtnRef = useRef(null);
  const grnItemsEndRef = useRef(null);
  const grnTableContainerRef = useRef(null);

  // Quick Add New Product Modal State
  const [showQuickAddProductModal, setShowQuickAddProductModal] = useState(false);
  const [newProdForm, setNewProdForm] = useState({
    medicine_name: "",
    company_name: "",
    category: "Tablet",
    unit_label: "pack",
    cost_price: "",
    unit_sale_price: "",
  });

  // Selected Supplier Drawer / Modal & View Mode
  const [selectedSupplierDrawer, setSelectedSupplierDrawer] = useState(null);
  const [supplierDrawerSearch, setSupplierDrawerSearch] = useState("");
  const [supplierViewMode, setSupplierViewMode] = useState("table"); // "table" (default neat row list) | "grid" (cards view)
  const [supplierSearchText, setSupplierSearchText] = useState("");

  // New Purchase Form
  const [selectedSupplierId, setSelectedSupplierId] = useState("");

  const [companyBillNoInput, setCompanyBillNoInput] = useState("");
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [purchaseItems, setPurchaseItems] = useState([
    { inventory_id: "", medicine_name: "", category: "Tablet", strength: "500 mg", received_unit_type: "box", unit_label: "pack", batch_no: "", expiry_date: "", qty: 1, cost_price: "", sale_price: "" }
  ]);

  const itemsContainerRef = useRef(null);
  const itemsEndRef = useRef(null);

  // View Invoice Detail Modal
  const [selectedInvoiceModal, setSelectedInvoiceModal] = useState(null);

  // New Supplier Modal
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupCode, setNewSupCode] = useState("");
  const [newSupName, setNewSupName] = useState("");
  const [newSupContact, setNewSupContact] = useState("");
  const [newSupPhone, setNewSupPhone] = useState("");
  const [newSupAddress, setNewSupAddress] = useState("");

  // Admin Protected Supplier Edit & Passcode States
  const [adminAuthPrompt, setAdminAuthPrompt] = useState(null); // { targetSupplier: sup, action: "edit" }
  const [adminPasscodeEntry, setAdminPasscodeEntry] = useState("");
  const [adminAuthError, setAdminAuthError] = useState("");
  const [editSupplierModal, setEditSupplierModal] = useState(null); // supplier object being edited

  // Supplier Code Quick Auto-Fill state
  const [grnSupplierCode, setGrnSupplierCode] = useState("");
  const [newPurchaseCodeSearch, setNewPurchaseCodeSearch] = useState("");

  // Payment Settlement Modal
  const [paySupplierModal, setPaySupplierModal] = useState(null);
  const [payAmountInput, setPayAmountInput] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash"); // "cash" | "cheque" | "bank"
  const [paymentRef, setPaymentRef] = useState(""); // Cheque # or Bank Ref
  const [paymentNote, setPaymentNote] = useState("");

  // Supplier Ledger History Drawer
  const [ledgerDrawerSupplier, setLedgerDrawerSupplier] = useState(null);
  const [supplierLedgerTxns, setSupplierLedgerTxns] = useState([]);

  // Global Bills Search
  const [globalBillsSearch, setGlobalBillsSearch] = useState("");

  const refreshData = () => {
    setSuppliers(dbSuppliers.getAll());
    const purs = dbPurchases.getAll();
    setPurchases(purs);
    setInventoryList(dbInventory.getAll());
    setAccountsList(dbAccounts.getAll());
    setReferencesList(dbGrnMetadata.getReferences());
    setTransportsList(dbGrnMetadata.getTransports());
    setWarehousesList(dbWarehouses.getAll() || []);
    setGrnForm((prev) => ({
      ...prev,
      voucher_no: dbPurchases.getNextVoucherNo(),
    }));
  };

  const handleAddNewReference = () => {
    if (!newRefText.trim()) return;
    const added = dbGrnMetadata.addReference(newRefText.trim());
    setReferencesList(dbGrnMetadata.getReferences());
    setGrnForm((prev) => ({ ...prev, reference: added }));
    setNewRefText("");
    setShowNewRefInput(false);
  };

  const handleAddNewTransport = () => {
    if (!newTransportText.trim()) return;
    const added = dbGrnMetadata.addTransport(newTransportText.trim());
    setTransportsList(dbGrnMetadata.getTransports());
    setGrnForm((prev) => ({ ...prev, transport: added }));
    setNewTransportText("");
    setShowNewTransportInput(false);
  };

  const handleSupplierCodeChange = (code) => {
    setGrnSupplierCode(code);
    if (!code || !code.trim()) return;
    const clean = code.trim().toLowerCase();
    
    // 1. Direct match in dbSuppliers
    const sup = dbSuppliers.getByCode(clean) || suppliers.find(
      (s) =>
        (s.supplier_code && s.supplier_code.toLowerCase() === clean) ||
        (s.supplier_code && s.supplier_code.toLowerCase().startsWith(clean)) ||
        (s.name && s.name.toLowerCase().startsWith(clean))
    );

    if (sup) {
      setGrnForm((prev) => ({
        ...prev,
        account_name: sup.name,
        reference: sup.contact_person || prev.reference,
      }));
      return;
    }

    // 2. Fallback match in Chart of Accounts
    const acc = accountsList.find(
      (a) =>
        (a.account_no && String(a.account_no).toLowerCase() === clean) ||
        (a.account_name && a.account_name.toLowerCase().startsWith(clean))
    );
    if (acc) {
      setGrnForm((prev) => ({
        ...prev,
        account_name: acc.account_name,
        naration: acc.naration || prev.naration,
      }));
    }
  };

  const accountOptions = useMemo(() => {
    const list = [];
    suppliers.forEach((s) => {
      list.push({
        id: s.name,
        label: s.name,
        sublabel: `${s.supplier_code ? `[Code: ${s.supplier_code}] ` : ""}${s.contact_person || "Pharma Supplier"}${s.current_balance || s.balance_due ? ` • Udhaar: Rs. ${Number(s.current_balance || s.balance_due || 0).toLocaleString()}` : ""}`,
        badge: s.supplier_code ? `🏢 ${s.supplier_code}` : "🏢 Supplier",
        supplier_code: s.supplier_code || s.id,
        raw: s,
      });
    });
    accountsList.forEach((a) => {
      if (!suppliers.some((s) => s.name.toLowerCase() === a.account_name.toLowerCase())) {
        list.push({
          id: a.account_name,
          label: a.account_name,
          sublabel: `${a.account_no ? `[#${a.account_no}] ` : ""}${a.city || a.phone || a.account_type}`,
          badge: a.account_no ? `📒 #${a.account_no}` : `📒 ${a.account_type || "Account"}`,
          supplier_code: a.account_no ? String(a.account_no) : a.id,
          raw: a,
        });
      }
    });
    allCompanyOptions.forEach((c) => {
      if (
        !suppliers.some((s) => s.name.toLowerCase() === c.name.toLowerCase()) &&
        !accountsList.some((a) => a.account_name.toLowerCase() === c.name.toLowerCase())
      ) {
        list.push({
          id: c.name,
          label: c.name,
          sublabel: `${c.code ? `[Code: ${c.code}] ` : ""}Company / Brand`,
          badge: c.code ? `🏢 ${c.code}` : "🏢 Company",
          supplier_code: c.code || "",
          raw: c,
        });
      }
    });
    return list;
  }, [suppliers, accountsList, allCompanyOptions]);

  const matchedGrnSupplier = useMemo(() => {
    if (!grnForm.account_name) return null;
    const lower = grnForm.account_name.toLowerCase().trim();
    return suppliers.find((s) => s.name.toLowerCase().trim() === lower) || null;
  }, [suppliers, grnForm.account_name]);

  const referenceOptions = useMemo(() => {
    return referencesList.map((r) => ({
      id: r,
      label: r,
      badge: "👤 Rep",
    }));
  }, [referencesList]);

  const transportOptions = useMemo(() => {
    return transportsList.map((t) => ({
      id: t,
      label: t,
      badge: "🚚 Carrier",
    }));
  }, [transportsList]);

  // Dynamic Company & Brand-Filtered Inventory for Tab 1 (Purchase GRN Form)
  const filteredGrnInventory = useMemo(() => {
    let list = inventoryList;
    if (!grnShowAllCompanies && grnForm.account_name) {
      const matched = filterInventoryByCompanyOrSupplier(list, grnForm.account_name);
      if (matched.length > 0) list = matched;
    }
    return list;
  }, [inventoryList, grnForm.account_name, grnShowAllCompanies]);

  const productOptions = useMemo(() => {
    return filteredGrnInventory.map((inv) => ({
      id: inv.id,
      label: inv.medicine_name,
      sublabel: `Cost: Rs. ${inv.cost_price_per_box || inv.cost_price || 0} · Godown: ${inv.warehouse_stock || 0}${inv.batch_no ? ` · Bat: ${inv.batch_no}` : ""}`,
      badge: inv.company_name || inv.item_code || inv.category || "MED",
      raw: inv,
    }));
  }, [filteredGrnInventory]);

  useEffect(() => {
    refreshData();
    window.addEventListener("clinicflow_status_update", refreshData);
    return () => window.removeEventListener("clinicflow_status_update", refreshData);
  }, []);

  // Quick Code Lookup Handler for Purchase GRN Fast Line Entry
  const handleLookupGRNByCode = (codeQuery) => {
    if (!codeQuery || !codeQuery.trim()) return;
    const cleanCode = codeQuery.trim().toLowerCase();

    // 1. Search in current company filtered inventory first
    let matched = filteredGrnInventory.filter(
      (inv) => (inv.item_code || "").toLowerCase() === cleanCode || (inv.id || "").toLowerCase() === cleanCode
    );

    // 2. Fallback to all inventory items if not found in current company
    if (matched.length === 0) {
      matched = inventoryList.filter(
        (inv) => (inv.item_code || "").toLowerCase() === cleanCode || (inv.id || "").toLowerCase() === cleanCode
      );
    }

    if (matched.length === 1) {
      handleSelectGRNMedicine(matched[0].id);
      batchNoRef.current?.focus();
    } else if (matched.length > 1) {
      // Multiple items with same code across different companies -> auto select first & show notification or switch filter
      setGrnShowAllCompanies(true);
      handleSelectGRNMedicine(matched[0].id);
      batchNoRef.current?.focus();
    } else {
      alert(`Item code "${codeQuery}" not found in inventory.`);
    }
  };

  // DrCreate Purchase GRN Form Handlers
  const handleSelectGRNMedicine = (invId) => {
    if (!invId) {
      setGrnCart((prev) => ({
        ...prev,
        inventory_id: "",
        medicine_name: "",
        product_code: "",
        category: "",
        packing: "",
        batch_no: "",
        expiry_date: "",
        qty: "1",
        bonus_qty: "0",
        rate: "",
        gross: "",
        disc_pct: "40",
        disc_flat: "0",
        net_amount: "",
      }));
      return;
    }
    const inv = inventoryList.find((i) => i.id === invId);
    if (!inv) return;
    const rate = inv.cost_price_per_box || inv.cost_price || inv.unit_sale_price || 0;
    const qty = Number(grnCart.qty) || 1;
    const gross = qty * rate;
    const discPct = Number(grnCart.disc_pct) || 0;
    const discFlat = Number(grnCart.disc_flat) || 0;
    const net = Math.max(0, gross - (gross * (discPct / 100)) - discFlat);

    setGrnCart({
      product_code: inv.item_code || inv.company_name || "",
      medicine_name: inv.medicine_name,
      inventory_id: inv.id,
      category: inv.category || "Medicine",
      packing: inv.unit_label || inv.received_unit_type || "pack",
      batch_no: inv.batch_no || "",
      expiry_date: inv.expiry_date || "",
      qty: String(qty),
      bonus_qty: grnCart.bonus_qty || "0",
      rate: String(rate),
      gross: String(gross),
      disc_pct: grnCart.disc_pct === "" || grnCart.disc_pct === undefined ? "40" : String(grnCart.disc_pct),
      disc_flat: grnCart.disc_flat || "0",
      net_amount: String(net),
    });

    // Auto-focus Batch # or Qty input
    setTimeout(() => {
      batchNoRef.current?.focus();
    }, 40);
  };

  const handleUpdateGRNCart = (field, val) => {
    setGrnCart((prev) => {
      const updated = { ...prev, [field]: val };
      const q = Number(field === "qty" ? val : updated.qty) || 0;
      const r = Number(field === "rate" ? val : updated.rate) || 0;
      const gross = q * r;
      const dPct = Number(field === "disc_pct" ? val : updated.disc_pct) || 0;
      const dFlat = Number(field === "disc_flat" ? val : updated.disc_flat) || 0;
      const net = Math.max(0, gross - (gross * (dPct / 100)) - dFlat);
      updated.gross = String(gross);
      updated.net_amount = String(net);
      return updated;
    });
  };

  const handleAddGRNItem = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!grnCart.medicine_name.trim()) {
      alert("Please select or enter a Product Name.");
      grnProductInputRef.current?.focus();
      return;
    }
    if (Number(grnCart.qty) <= 0) {
      alert("Please enter a valid Quantity.");
      return;
    }

    const q = Number(grnCart.qty) || 1;
    const bonusQ = Number(grnCart.bonus_qty) || 0;
    const r = Number(grnCart.rate) || 0;
    const gross = q * r;
    const dPct = Number(grnCart.disc_pct) || 0;
    const dFlat = Number(grnCart.disc_flat) || 0;
    const net = Math.max(0, gross - (gross * (dPct / 100)) - dFlat);

    const newItem = {
      id: "item_" + Date.now(),
      inventory_id: grnCart.inventory_id || "",
      product_code: grnCart.product_code,
      medicine_name: grnCart.medicine_name.trim(),
      company_name: grnCart.company_name || grnForm.account_name || "",
      category: grnCart.category || "Medicine",
      packing: grnCart.packing || "pack",
      batch_no: grnCart.batch_no.trim() || `BT-${Date.now().toString().slice(-4)}`,
      expiry_date: grnCart.expiry_date.trim() || "",
      qty: q,
      bonus_qty: bonusQ,
      qty_base_units: q + bonusQ, // Paid Qty + Bonus Qty added to Stock!
      rate: r,
      cost_price: r,
      sale_price: Number(grnCart.sale_price) || (r > 0 ? r * 1.2 : 0),
      gross: gross,
      disc_pct: dPct > 0 ? `${dPct}%` : "0%",
      disc_pct_num: dPct,
      disc_flat: dFlat,
      net: net,
      total_cost: net,
    };

    setGrnItems((prev) => [...prev, newItem]);
    setGrnCart({
      product_code: "",
      medicine_name: "",
      inventory_id: "",
      category: "",
      packing: "",
      batch_no: "",
      expiry_date: "",
      qty: "1",
      bonus_qty: "0",
      rate: "",
      gross: "",
      disc_pct: "40",
      disc_flat: "0",
      net_amount: "",
    });
    setTimeout(() => {
      if (grnTableContainerRef.current) {
        grnTableContainerRef.current.scrollTop = grnTableContainerRef.current.scrollHeight;
      }
      if (grnItemsEndRef.current) {
        grnItemsEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      grnProductInputRef.current?.focus();
    }, 40);
  };

  const handleCreateQuickProduct = (e) => {
    e.preventDefault();
    if (!newProdForm.medicine_name.trim()) return;
    const created = dbInventory.add({
      medicine_name: newProdForm.medicine_name.trim(),
      product_description: (newProdForm.product_description || "").trim(),
      generic_name: (newProdForm.product_description || "").trim() || newProdForm.medicine_name.trim(),
      company_name: newProdForm.company_name.trim() || grnForm.account_name || "General Pharma",
      category: newProdForm.category || "Tablet",
      unit_label: (newProdForm.unit_label || "pack").trim(),
      cost_price: Number(newProdForm.cost_price) || 0,
      cost_price_per_box: Number(newProdForm.cost_price) || 0,
      unit_sale_price: Number(newProdForm.unit_sale_price) || 0,
      box_sale_price: Number(newProdForm.unit_sale_price) || 0,
      warehouse_stock: 0,
      store_stock: 0,
    });
    alert(`✅ New Product "${created.medicine_name}" registered & added to inventory!`);
    setInventoryList(dbInventory.getAll());
    setNewProdForm({ medicine_name: "", product_description: "", company_name: "", category: "Tablet", unit_label: "pack", cost_price: "", unit_sale_price: "" });
    setShowQuickAddProductModal(false);
    handleSelectGRNMedicine(created.id);
  };



  const handleRemoveGRNItem = (idx) => {
    setGrnItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveGRNBill = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (grnItems.length === 0) {
      alert("Please add at least 1 medicine item to the cart before saving bill.");
      return;
    }
    if (!grnForm.account_name.trim()) {
      alert("Please select or enter Supplier Account Name.");
      return;
    }

    const itemsSubtotal = grnItems.reduce((sum, it) => sum + (Number(it.net) || 0), 0);
    const extraDisc = Number(grnForm.extra_bill_discount) || 0;
    const freight = Number(grnForm.freight_charges) || 0;
    const totalBill = Math.max(0, itemsSubtotal - extraDisc + freight);
    const paidAmount = grnForm.payment_mode === "Cash" ? totalBill : 0;
    const matchedSup = suppliers.find((s) => s.name.toLowerCase() === grnForm.account_name.toLowerCase());
    const targetWarehouseId = user?.assigned_warehouse_id || "wh_001";
    const savedPur = dbPurchases.add({
      invoice_no: grnForm.voucher_no || dbPurchases.getNextVoucherNo(),
      supplier_name: grnForm.account_name,
      supplier_id: matchedSup ? matchedSup.id : undefined,
      warehouse_id: targetWarehouseId,
      grn_no: grnForm.grn_no || "0",
      reference: grnForm.reference || "",
      transport: grnForm.transport || "By Hand",
      bilty_no: grnForm.bilty_no || "",
      payment_mode: grnForm.payment_mode,
      destination_type: grnForm.destination_type || "store",
      purchase_date: grnForm.date || new Date().toISOString(),
      items: grnItems,
      subtotal: itemsSubtotal,
      extra_discount: extraDisc,
      freight_charges: freight,
      total_amount: totalBill,
      paid_amount: paidAmount,
      balance_due: totalBill - paidAmount,
      notes: `Purchase Invoice: ${grnForm.voucher_no} | Co Bill: ${grnForm.grn_no} | Transport: ${grnForm.transport} | Bilty: ${grnForm.bilty_no}${extraDisc > 0 ? ` | Extra Disc: Rs. ${extraDisc}` : ""}${freight > 0 ? ` | Freight: Rs. ${freight}` : ""}`,
    });

    // Auto-Print Thermal GRN Slip
    printPurchaseGRNReceipt(savedPur, dbClinic.get());

    // Reset Form for next entry
    setGrnItems([]);
    setGrnCart({
      product_code: "",
      medicine_name: "",
      inventory_id: "",
      category: "",
      packing: "",
      batch_no: "",
      expiry_date: "",
      qty: "1",
      rate: "",
      gross: "",
      disc_pct: "40",
      disc_flat: "0",
      net_amount: "",
    });
    setGrnForm((prev) => ({
      ...prev,
      voucher_no: dbPurchases.getNextVoucherNo(),
      grn_no: "0",
      bilty_no: "",
      extra_bill_discount: "0",
      freight_charges: "0",
    }));
    refreshData();
    setInventoryList(dbInventory.getAll());
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clinicflow_status_update"));
    }
    alert(`✅ Purchase Invoice ${savedPur.invoice_no} (Co Bill #${savedPur.grn_no}) saved successfully & stock added to Medical Store Inventory!`);
  };

  const handleAddItemRow = () => {

    setPurchaseItems((prev) => [
      ...prev,
      { inventory_id: "", medicine_name: "", category: "Tablet", strength: "", received_unit_type: "box", unit_label: "pack", batch_no: "", expiry_date: "", qty: 1, cost_price: "", sale_price: "" }
    ]);
    setTimeout(() => {
      itemsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  };


  const handleSelectExistingMedicine = (index, inventoryId) => {
    const updated = [...purchaseItems];
    if (!inventoryId) {
      updated[index] = { ...updated[index], inventory_id: "" };
      setPurchaseItems(updated);
      return;
    }
    const inv = inventoryList.find((i) => i.id === inventoryId);
    if (!inv) return;
    updated[index] = {
      ...updated[index],
      inventory_id: inv.id,
      medicine_name: inv.medicine_name,
      category: inv.category || "Tablet",
      strength: inv.strength || "",
      unit_label: inv.unit_label || "pack",
      received_unit_type: inv.has_multi_unit ? "box" : "unit",
      cost_price: inv.cost_price_per_box || inv.cost_price || "",
      sale_price: inv.box_sale_price || inv.unit_sale_price || "",
      strips_per_box: inv.strips_per_box || 10,
      units_per_strip: inv.units_per_strip || 12,
    };
    setPurchaseItems(updated);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...purchaseItems];
    updated[index][field] = value;
    setPurchaseItems(updated);
  };

  const handleRemoveItemRow = (index) => {
    if (purchaseItems.length === 1) return;
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const calculateTotalBill = () => {
    return purchaseItems.reduce((sum, item) => {
      const q = Number(item.qty) || 0;
      const c = Number(item.cost_price) || 0;
      const gross = q * c;
      const dPct = Number(item.disc_pct) || 0;
      const dFlat = Number(item.disc_flat) || 0;
      const disc = (gross * (dPct / 100)) + dFlat;
      return sum + Math.max(0, gross - disc);
    }, 0);
  };

  const handleSavePurchase = (e) => {
    e.preventDefault();
    if (!selectedSupplierId) { alert("Please select a Pharma Supplier."); return; }
    
    const validItems = purchaseItems.filter((i) => i.medicine_name.trim() !== "");
    if (validItems.length === 0) { alert("Please add at least one medicine item."); return; }

    const supplier = dbSuppliers.getById(selectedSupplierId);
    const total_amount = calculateTotalBill();
    const paid_amount = Number(paidAmountInput) || 0;

    const newPur = dbPurchases.add({
      supplier_id: selectedSupplierId,
      supplier_name: supplier?.name || "Distributor",
      warehouse_id: user?.assigned_warehouse_id || "wh_001",
      company_bill_no: companyBillNoInput || "N/A",
      total_amount,
      paid_amount,
      items: validItems.map((i) => {
        const q = Number(i.qty) || 1;
        const c = Number(i.cost_price) || 0;
        const gross = q * c;
        const dPct = Number(i.disc_pct) || 0;
        const dFlat = Number(i.disc_flat) || 0;
        const disc = (gross * (dPct / 100)) + dFlat;
        const lineTotal = Math.max(0, gross - disc);
        return {
          inventory_id: i.inventory_id || null,
          medicine_name: i.medicine_name,
          category: i.category || "Tablet",
          strength: i.strength || "",
          company_name: supplier?.name || "",
          has_multi_unit: Boolean(i.has_multi_unit || (Number(i.strips_per_box) > 1 || Number(i.units_per_strip) > 1)),
          received_unit_type: i.received_unit_type || "box",
          unit_label: i.unit_label || "pack",
          box_label: i.box_label || "Pack",
          strip_label: i.strip_label || "Strip",
          strips_per_box: Number(i.strips_per_box) || 10,
          units_per_strip: Number(i.units_per_strip) || 10,
          batch_no: i.batch_no || `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
          expiry_date: i.expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0],
          qty: q,
          cost_price: c,
          sale_price: Number(i.sale_price) || 0,
          disc_pct: dPct,
          disc_flat: dFlat,
          line_total: lineTotal
        };
      })
    });

    alert(`✅ Stock Entry Voucher #${newPur.invoice_no} saved successfully! Inventory & Supplier Ledger updated.`);
    
    // Auto print 80mm thermal voucher
    printSupplierPurchaseReceipt(newPur, supplier, dbClinic.get());

    // Reset Form
    setCompanyBillNoInput("");
    setPaidAmountInput("");
    setPurchaseItems([{ inventory_id: "", medicine_name: "", category: "Tablet", strength: "", received_unit_type: "box", unit_label: "pack", batch_no: "", expiry_date: "", qty: 1, cost_price: "", sale_price: "" }]);
    setActiveTab("suppliers");
    refreshData();
  };

  const handleCreateSupplier = (e) => {
    e.preventDefault();
    if (!newSupName.trim()) return;
    const created = dbSuppliers.add({
      supplier_code: newSupCode.trim() || dbSuppliers.getNextSupplierCode(),
      name: newSupName.trim(),
      contact_person: newSupContact.trim(),
      phone: newSupPhone.trim(),
      address: newSupAddress.trim(),
    });
    alert(`✅ Distributor "${created.name}" registered successfully with Short Code #${created.supplier_code}!`);
    setNewSupName("");
    setNewSupCode("");
    setNewSupContact("");
    setNewSupPhone("");
    setNewSupAddress("");
    setShowAddSupplier(false);
    refreshData();
  };

  const handleRequestEditSupplier = (sup) => {
    setAdminAuthPrompt({ targetSupplier: sup, action: "edit" });
    setAdminPasscodeEntry("");
    setAdminAuthError("");
  };

  const handleVerifyAdminPasscode = (e) => {
    e.preventDefault();
    if (!verifyAdminPasscode(adminPasscodeEntry)) {
      setAdminAuthError("❌ Incorrect Admin Master Passcode! Access Denied.");
      return;
    }
    const target = adminAuthPrompt?.targetSupplier;
    setAdminAuthPrompt(null);
    setAdminPasscodeEntry("");
    setAdminAuthError("");

    if (target) {
      setEditSupplierModal({
        id: target.id,
        supplier_code: target.supplier_code || target.id,
        name: target.name || "",
        contact_person: target.contact_person || "",
        phone: target.phone || "",
        city: target.city || "",
        address: target.address || "",
        current_balance: String(target.current_balance || target.balance_due || 0),
      });
    }
  };

  const handleSaveSupplierEdits = (e) => {
    e.preventDefault();
    if (!editSupplierModal || !editSupplierModal.name.trim()) return;

    const oldSup = dbSuppliers.getById(editSupplierModal.id);
    const updated = dbSuppliers.update(editSupplierModal.id, {
      supplier_code: editSupplierModal.supplier_code.trim() || oldSup?.supplier_code || editSupplierModal.id,
      name: editSupplierModal.name.trim(),
      contact_person: editSupplierModal.contact_person.trim(),
      phone: editSupplierModal.phone.trim(),
      city: editSupplierModal.city.trim(),
      address: editSupplierModal.address.trim(),
      current_balance: Number(editSupplierModal.current_balance) || 0,
      balance_due: Number(editSupplierModal.current_balance) || 0,
    });

    // Also sync with Chart of Accounts if matching account exists
    if (oldSup?.name) {
      const acc = dbAccounts.getAll().find((a) => a.account_name.toLowerCase() === oldSup.name.toLowerCase());
      if (acc) {
        dbAccounts.update(acc.id, {
          account_name: updated.name,
          city: updated.city || acc.city,
          phone: updated.phone || acc.phone,
        });
      }
    }

    alert(`✅ Distributor "${updated.name}" updated successfully!`);
    setEditSupplierModal(null);
    refreshData();
  };

  const handleDeleteSupplier = (id, name) => {
    const confirmDel = confirm(
      `⚠️ ADMIN CONFIRMATION: Are you sure you want to permanently delete supplier "${name}"?\n\nThis will remove their profile from active directory.`
    );
    if (!confirmDel) return;
    dbSuppliers.delete(id);
    alert(`🗑️ Supplier "${name}" deleted.`);
    setEditSupplierModal(null);
    refreshData();
  };

  const handleSupplierPayment = (e) => {
    e.preventDefault();
    if (!paySupplierModal || !payAmountInput) return;
    const amt = Number(payAmountInput);
    // Record in two-way supplier ledger
    dbSupplierLedger.recordPayment(
      paySupplierModal.id,
      amt,
      paymentMode,
      paymentNote || undefined,
      paymentRef || undefined
    );
    setPaySupplierModal(null);
    setPaymentRef("");
    setPaymentNote("");
    setPaymentMode("cash");
    setPayAmountInput("");
    refreshData();
  };

  const handleDeletePurchaseInvoice = (invoiceId, invoiceNo) => {
    const confirmDel = confirm(
      `⚠️ CRITICAL ACTION: Are you sure you want to DELETE Purchase Invoice #${invoiceNo}?\n\nThis will automatically:\n1. Revert/deduct the added stock from Inventory.\n2. Revert the supplier's payable balance.\n\nProceed?`
    );
    if (!confirmDel) return;

    dbPurchases.deleteInvoice(invoiceId);
    alert(`✅ Invoice #${invoiceNo} deleted and stock/ledger changes reverted!`);
    if (selectedInvoiceModal?.id === invoiceId) setSelectedInvoiceModal(null);
    refreshData();
  };

  const totalSupplierPayables = suppliers.reduce((s, sup) => s + (sup.balance_due || 0), 0);

  // Supplier Drawer Filtered Invoices
  const supplierInvoices = selectedSupplierDrawer
    ? purchases.filter((p) => p.supplier_id === selectedSupplierDrawer.id)
    : [];

  const filteredSupplierInvoices = supplierInvoices.filter((p) => {
    if (!supplierDrawerSearch.trim()) return true;
    const q = supplierDrawerSearch.toLowerCase();
    return (
      (p.invoice_no || "").toLowerCase().includes(q) ||
      (p.company_bill_no || "").toLowerCase().includes(q) ||
      (p.purchase_date || "").includes(q)
    );
  });

  // Global Filtered Purchases
  const globalFilteredPurchases = purchases.filter((p) => {
    if (!globalBillsSearch.trim()) return true;
    const q = globalBillsSearch.toLowerCase();
    return (
      (p.invoice_no || "").toLowerCase().includes(q) ||
      (p.company_bill_no || "").toLowerCase().includes(q) ||
      (p.supplier_name || "").toLowerCase().includes(q)
    );
  });

  // Filtered Suppliers List
  const filteredSuppliersList = useMemo(() => {
    if (!supplierSearchText.trim()) return suppliers;
    const q = supplierSearchText.toLowerCase();
    return suppliers.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.supplier_code || "").toLowerCase().includes(q) ||
        (s.phone || "").toLowerCase().includes(q) ||
        (s.contact_person || "").toLowerCase().includes(q) ||
        (s.address || "").toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearchText]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 overflow-x-hidden pb-12">
      {/* SubNavigationTabs Bar */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 pt-2 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 overflow-x-auto rounded-2xl shadow-xs">
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto whitespace-nowrap pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("grn_form")}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 border-b-2 font-bold text-xs sm:text-sm rounded-t-lg transition-colors shrink-0 ${
              activeTab === "grn_form"
                ? "border-teal-700 text-teal-800 bg-teal-50/50"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-4 h-4 text-teal-700 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Company Purchase Invoice Entry</span>
            <span className="ml-1 px-1.5 sm:px-2 py-0.5 text-[10px] font-mono font-bold bg-teal-700 text-white rounded-md">
              {grnForm.voucher_no}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("suppliers")}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 font-semibold text-xs sm:text-sm rounded-t-lg transition-colors border-b-2 shrink-0 ${
              activeTab === "suppliers"
                ? "border-teal-700 text-teal-800 bg-teal-50/50"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Pharma Companies &amp; Suppliers Directory</span>
            <span className="text-xs text-slate-400 font-normal">({suppliers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bills")}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 font-semibold text-xs sm:text-sm rounded-t-lg transition-colors border-b-2 shrink-0 ${
              activeTab === "bills"
                ? "border-teal-700 text-teal-800 bg-teal-50/50"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>All Purchase Bills &amp; Invoices Log</span>
            <span className="text-xs text-slate-400 font-normal">({purchases.length})</span>
          </button>
        </div>
        <div className="flex items-center gap-2 pb-2 self-end sm:self-auto shrink-0">
          <div className="bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl text-right shadow-2xs">
            <span className="text-[9.5px] text-rose-800 font-bold uppercase tracking-wider mr-1">Credit Due:</span>
            <span className="text-xs font-black text-rose-900">Rs. {totalSupplierPayables.toLocaleString()}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Godown Synced
          </span>
        </div>
      </div>

      {/* TAB 0: DrCreate & MS Access Purchase GRN Form */}
      {activeTab === "grn_form" && (
        <div className="space-y-4 animate-fade-in">
          {/* HeroActionBanner */}
          <section className="bg-teal-700 text-white px-3.5 sm:px-6 py-3.5 sm:py-4 rounded-2xl shadow-sm border border-teal-800" data-purpose="hero-action-banner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006V8.706c0-.594-.237-1.164-.659-1.586l-3.54-3.54A2.25 2.25 0 0014.25 3H6.75a2.25 2.25 0 00-2.25 2.25v3.456m16.5 5.444l-4.5-4.5m0 0L12 12m4.5-4.5H12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider uppercase bg-white/15 text-teal-100 border border-white/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-300"></span>
                      Pharmacy / Godown Company Stock Inward
                    </span>
                  </div>
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white flex flex-wrap items-center gap-1.5 sm:gap-2.5 mt-0.5">
                    <span>Company Purchase Invoice Entry</span>
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowGRNListModal(true)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="whitespace-nowrap">Show Invoices List</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveGRNBill}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-white text-teal-800 hover:bg-teal-50 text-xs sm:text-sm font-bold shadow-md shadow-black/10 transition-all whitespace-nowrap cursor-pointer"
                >
                  <svg className="w-4 h-4 text-teal-700 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Save Bill</span>
                </button>
              </div>
            </div>
          </section>

          {/* Section 1: Company / Party Info */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden" data-purpose="company-party-info-card">
            <div className="h-1 bg-teal-700"></div>
            <div className="p-3.5 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
                      <span>COMPANY / PARTY INFO</span>
                    </h2>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-full text-[11px] sm:text-xs font-semibold self-start sm:self-auto">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
                  </span>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="truncate">AUTO-FOCUS &amp; KEYBOARD NAVIGATION ACTIVE</span>
                </div>
              </div>

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Invoice Date */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 sm:mb-1.5" htmlFor="invoice-date">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Invoice Date</span>
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      id="invoice-date"
                      type="text"
                      value={grnForm.date}
                      onChange={(e) => setGrnForm({ ...grnForm, date: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-teal-600 focus:border-teal-600 shadow-2xs transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 2. System Entry # */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 sm:mb-1.5" htmlFor="system-entry-num">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M5.25 8.25h13.5m-13.5 7.5h13.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>System Entry #</span>
                    </span>
                  </label>
                  <input
                    id="system-entry-num"
                    type="text"
                    value={grnForm.voucher_no}
                    readOnly
                    className="w-full bg-teal-50/60 border border-teal-200 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold text-teal-800 cursor-not-allowed shadow-2xs font-mono"
                  />
                </div>

                {/* 3. Co Invoice / Bill # * */}
                <div className="col-span-1">
                  <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                    <label className="text-xs font-semibold text-slate-700" htmlFor="co-invoice-num">
                      <span>Co Invoice / Bill # <span className="text-rose-500">*</span></span>
                    </label>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Main Ref</span>
                  </div>
                  <input
                    id="co-invoice-num"
                    type="text"
                    value={grnForm.grn_no}
                    onChange={(e) => setGrnForm({ ...grnForm, grn_no: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        grnProductInputRef.current?.focus();
                      }
                    }}
                    placeholder="0"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-600 focus:border-teal-600 shadow-2xs transition-all font-mono"
                  />
                </div>

                {/* 4. Salesman / Booker */}
                <div className="col-span-1">
                  <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1" htmlFor="salesman-select">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Salesman / Booker</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewRefInput(!showNewRefInput)}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-800 hover:underline flex items-center gap-0.5 shrink-0"
                    >
                      <span>{showNewRefInput ? "Cancel" : "+ New Salesman"}</span>
                    </button>
                  </div>
                  {showNewRefInput ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newRefText}
                        onChange={(e) => setNewRefText(e.target.value)}
                        placeholder="New Salesman Name..."
                        className="flex-1 bg-white border border-teal-400 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleAddNewReference()}
                      />
                      <button
                        type="button"
                        onClick={handleAddNewReference}
                        className="bg-teal-700 text-white px-2.5 py-1.5 rounded-lg font-bold text-xs hover:bg-teal-800"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <ExpandableCombobox
                      value={grnForm.reference}
                      onChange={(val) => setGrnForm({ ...grnForm, reference: val })}
                      options={referenceOptions}
                      placeholder="Select or Type Salesman..."
                      searchPlaceholder="Search or type new Salesman..."
                      onAddNew={() => setShowNewRefInput(true)}
                      addNewLabel="+ New Salesman"
                    />
                  )}
                </div>

                {/* 5. Supplier Code */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 sm:mb-1.5" htmlFor="supplier-code">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Supplier Code</span>
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      id="supplier-code"
                      type="text"
                      value={grnSupplierCode}
                      onChange={(e) => handleSupplierCodeChange(e.target.value)}
                      placeholder="E.G. SUP-001, BM, GHR"
                      className="w-full bg-amber-50/20 border border-amber-300/80 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-2xs uppercase font-mono"
                    />
                    {grnSupplierCode && (
                      <button
                        type="button"
                        onClick={() => handleSupplierCodeChange("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        title="Clear Code"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 6. Company / Party Name * (Spans 2 on sm/lg) */}
                <div className="col-span-1 sm:col-span-2">
                  <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Company / Party Name <span className="text-rose-500">*</span></span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddSupplier(true)}
                      className="text-[11px] text-teal-700 hover:underline cursor-pointer font-bold"
                    >
                      + New Party
                    </button>
                  </div>
                  <ExpandableCombobox
                    value={grnForm.account_name}
                    onChange={(val, opt) => {
                      setGrnForm({ ...grnForm, account_name: val });
                      if (opt?.supplier_code) {
                        setGrnSupplierCode(opt.supplier_code);
                      }
                    }}
                    options={accountOptions}
                    placeholder="Select or Search Company / Party..."
                    searchPlaceholder="Search Companies & Distributors..."
                    required={true}
                  />
                </div>

                {/* 7. Payment Mode Segmented Control */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 sm:mb-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Payment Mode</span>
                    </span>
                  </label>
                  <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setGrnForm({ ...grnForm, payment_mode: "Cash" })}
                      className={`py-1.5 px-2 sm:px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                        grnForm.payment_mode === "Cash"
                          ? "bg-teal-700 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span>Cash Paid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGrnForm({ ...grnForm, payment_mode: "Credit" })}
                      className={`py-1.5 px-2 sm:px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                        grnForm.payment_mode === "Credit"
                          ? "bg-rose-700 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span className="truncate">Credit (Payable)</span>
                    </button>
                  </div>
                </div>

                {/* 8. Transport Carrier (Spans 2 on sm/lg) */}
                <div className="col-span-1 sm:col-span-2">
                  <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.635l-3.25 3.25" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Transport Carrier</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewTransportInput(!showNewTransportInput)}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-800 hover:underline shrink-0"
                    >
                      {showNewTransportInput ? "Cancel" : "+ New Carrier"}
                    </button>
                  </div>
                  {showNewTransportInput ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newTransportText}
                        onChange={(e) => setNewTransportText(e.target.value)}
                        placeholder="New Transport Carrier Name..."
                        className="flex-1 bg-white border border-teal-400 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleAddNewTransport()}
                      />
                      <button
                        type="button"
                        onClick={handleAddNewTransport}
                        className="bg-teal-700 text-white px-2.5 py-1.5 rounded-lg font-bold text-xs hover:bg-teal-800"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <ExpandableCombobox
                      value={grnForm.transport}
                      onChange={(val) => setGrnForm({ ...grnForm, transport: val })}
                      options={transportOptions}
                      placeholder="Carrier (e.g. By Hand)..."
                      searchPlaceholder="Search Transport Carrier..."
                      onAddNew={() => setShowNewTransportInput(true)}
                      addNewLabel="+ New Carrier"
                    />
                  )}
                </div>

                {/* 9. Bilty / Tracking # (Spans 2 on sm/lg) */}
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 sm:mb-1.5" htmlFor="bilty-number">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Bilty / Tracking #</span>
                    </span>
                  </label>
                  <input
                    id="bilty-number"
                    type="text"
                    value={grnForm.bilty_no}
                    onChange={(e) => setGrnForm({ ...grnForm, bilty_no: e.target.value })}
                    placeholder="Tracking / Bilty No"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-600 focus:border-teal-600 shadow-2xs transition-all"
                  />
                </div>

                {/* Linked Supplier Info Capsule */}
                {matchedGrnSupplier && (
                  <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-teal-50/80 border border-teal-200 rounded-xl p-3 flex flex-wrap items-center justify-between text-xs text-teal-950 gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-teal-700 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="font-semibold">
                        Linked Supplier: <strong className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-teal-900">#{matchedGrnSupplier.supplier_code || matchedGrnSupplier.id}</strong> — {matchedGrnSupplier.name} ({matchedGrnSupplier.phone || "No Phone"})
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] font-medium text-slate-600">
                        Current Udhaar Balance: <strong className="text-rose-700 font-bold">Rs. {Number(matchedGrnSupplier.current_balance || matchedGrnSupplier.balance_due || 0).toLocaleString()}</strong>
                      </span>
                      <span className="text-[10px] bg-teal-700 text-white px-2 py-0.5 rounded-full font-bold">
                        Auto-Filled
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 2: Fast Line Item Entry */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 sm:p-5" data-purpose="fast-line-item-entry-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
                  <span>FAST LINE ITEM ENTRY</span>
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto justify-between sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowQuickAddProductModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 text-white hover:bg-teal-800 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  <span>+ Add New Product</span>
                </button>
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-medium">
                  <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-semibold text-slate-700">Enter</kbd>
                  <span className="hidden sm:inline">Press Enter to Move Next</span>
                  <span className="sm:hidden">Next</span>
                </div>
              </div>
            </div>

            {/* Line Item Fast Grid Inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-11 gap-2.5 sm:gap-3 items-end">
              {/* Product Code */}
              <div className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="item-code">Item Code</label>
                <input
                  id="item-code"
                  type="text"
                  value={grnCart.product_code}
                  onChange={(e) => setGrnCart({ ...grnCart, product_code: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleLookupGRNByCode(grnCart.product_code);
                    }
                  }}
                  placeholder="Code + Enter"
                  className="w-full bg-amber-50/40 border border-amber-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-center uppercase"
                />
              </div>

              {/* Product Name */}
              <div className="col-span-2 sm:col-span-2 md:col-span-3 lg:col-span-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700" htmlFor="item-product-name">
                    Product Name <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setGrnShowAllCompanies(!grnShowAllCompanies)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 text-[10px] font-bold text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                  >
                    <span>
                      {grnShowAllCompanies
                        ? `All (${inventoryList.length})`
                        : `${grnForm.account_name || "Company"} (${filteredGrnInventory.length})`}
                    </span>
                  </button>
                </div>
                <ExpandableCombobox
                  value={grnCart.inventory_id}
                  onChange={(val) => handleSelectGRNMedicine(val)}
                  options={productOptions}
                  placeholder={
                    grnShowAllCompanies
                      ? "-- Search All Medicines --"
                      : `-- ${grnForm.account_name || "Supplier"} Products (${filteredGrnInventory.length}) --`
                  }
                  searchPlaceholder={
                    grnShowAllCompanies
                      ? "Search medicines catalogue..."
                      : `Search within ${grnForm.account_name || "Company"}...`
                  }
                  required={true}
                />
              </div>

              {/* Batch # */}
              <div className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="item-batch">Batch #</label>
                <input
                  ref={batchNoRef}
                  id="item-batch"
                  type="text"
                  value={grnCart.batch_no}
                  onChange={(e) => handleUpdateGRNCart("batch_no", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      expDateRef.current?.focus();
                    }
                  }}
                  placeholder="250525"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono font-medium text-slate-800 focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-center"
                />
              </div>

              {/* Exp Date (MM/YY) */}
              <div className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor="item-exp">Exp Date</label>
                <input
                  ref={expDateRef}
                  id="item-exp"
                  type="text"
                  value={grnCart.expiry_date}
                  onChange={(e) => handleUpdateGRNCart("expiry_date", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      qtyRef.current?.focus();
                    }
                  }}
                  placeholder="MM/YY"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono font-medium text-slate-800 focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-center uppercase"
                />
              </div>

              {/* Paid Qty */}
              <div className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 text-center" htmlFor="item-qty">Paid Qty</label>
                <input
                  ref={qtyRef}
                  id="item-qty"
                  type="number"
                  min="1"
                  value={grnCart.qty}
                  onChange={(e) => handleUpdateGRNCart("qty", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      bonusQtyRef.current?.focus();
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-center"
                />
              </div>

              {/* Bonus */}
              <div className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-1">
                <label className="block text-[11px] font-semibold text-amber-700 mb-1 flex items-center justify-center gap-1" htmlFor="item-bonus">
                  <svg className="w-3 h-3 text-amber-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Bonus</span>
                </label>
                <input
                  ref={bonusQtyRef}
                  id="item-bonus"
                  type="number"
                  min="0"
                  value={grnCart.bonus_qty}
                  onChange={(e) => handleUpdateGRNCart("bonus_qty", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      rateRef.current?.focus();
                    }
                  }}
                  className="w-full bg-amber-50/40 border border-amber-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-amber-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-center"
                />
              </div>

              {/* Rate (TP) */}
              <div className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 text-center" htmlFor="item-rate">Rate (TP)</label>
                <input
                  ref={rateRef}
                  id="item-rate"
                  type="number"
                  value={grnCart.rate}
                  onChange={(e) => handleUpdateGRNCart("rate", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      discPctRef.current?.focus();
                    }
                  }}
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-center"
                />
              </div>

              {/* Gross */}
              <div className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1 text-center">Gross</label>
                <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 text-center truncate">
                  {Number(grnCart.gross || 0).toFixed(2)}
                </div>
              </div>

              {/* Disc % */}
              <div className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 text-center" htmlFor="item-disc-pct">Disc %</label>
                <input
                  ref={discPctRef}
                  id="item-disc-pct"
                  type="number"
                  value={grnCart.disc_pct}
                  onChange={(e) => handleUpdateGRNCart("disc_pct", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      discFlatRef.current?.focus();
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-center"
                />
              </div>

              {/* Disc 0 (Extra/Cash) */}
              <div className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 text-center" htmlFor="item-disc-val">Disc 0</label>
                <input
                  ref={discFlatRef}
                  id="item-disc-val"
                  type="number"
                  value={grnCart.disc_flat}
                  onChange={(e) => handleUpdateGRNCart("disc_flat", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddGRNItem(e)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-center"
                />
              </div>

              {/* Net Amount Output Pill */}
              <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 text-center">Net Amt</label>
                <div className="w-full bg-teal-50 border border-teal-200 rounded-lg px-2 py-1.5 text-xs font-bold text-teal-800 text-center truncate">
                  Rs. {Number(grnCart.net_amount || 0).toLocaleString()}
                </div>
              </div>

              {/* + Add Button */}
              <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-1">
                <button
                  ref={addBtnRef}
                  type="button"
                  onClick={handleAddGRNItem}
                  className="w-full py-1.5 px-3 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 shadow-sm shadow-teal-700/20 transition-colors cursor-pointer"
                >
                  <span>+ Add</span>
                </button>
              </div>
            </div>
          </section>

          {/* Section 3: Purchase Items Table */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden" data-purpose="purchase-items-table-card">
            <div ref={grnTableContainerRef} className="overflow-x-auto w-full max-h-80 min-h-[160px] custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-teal-700 text-white text-[11px] uppercase tracking-wider font-bold select-none sticky top-0 z-10">
                    <th className="py-3 px-4" scope="col">Item Name</th>
                    <th className="py-3 px-3 text-center" scope="col">Batch #</th>
                    <th className="py-3 px-3 text-center" scope="col">Exp Date</th>
                    <th className="py-3 px-3 text-center" scope="col">Qty</th>
                    <th className="py-3 px-3 text-right" scope="col">Rate</th>
                    <th className="py-3 px-3 text-right" scope="col">Gross</th>
                    <th className="py-3 px-3 text-center" scope="col">Disc(%)</th>
                    <th className="py-3 px-3 text-center" scope="col">Disc(0)</th>
                    <th className="py-3 px-4 text-right" scope="col">Net Amount</th>
                    <th className="py-3 px-4 text-center" scope="col">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-xs">
                  {grnItems.length === 0 ? (
                    <tr>
                      <td className="py-12 sm:py-14 text-center px-4" colSpan="10">
                        <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mb-3 shadow-2xs">
                            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                              <path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-slate-700">No medicine items in this purchase bill yet.</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-sm">
                            Select a product above, enter Batch/Exp, and click <span className="text-teal-700 font-semibold">Add</span> or press Enter key to append line items.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {grnItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-teal-50/40 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{item.medicine_name}</span>
                              {item.product_code && (
                                <span className="text-[10px] text-slate-400 font-mono">[{item.product_code}]</span>
                              )}
                              {item.packing && (
                                <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                  {item.packing}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-bold text-slate-800 bg-slate-50/70">
                            {item.batch_no || "—"}
                          </td>
                          <td className="px-3 py-3 text-center font-semibold text-amber-900 bg-amber-50/40">
                            {item.expiry_date || "—"}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-teal-800">
                            {item.qty}
                            {item.bonus_qty > 0 && (
                              <span className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-bold">
                                +{item.bonus_qty} Bonus
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-700 font-medium">Rs. {Number(item.rate).toLocaleString()}</td>
                          <td className="px-3 py-3 text-right text-slate-700 font-medium">Rs. {Number(item.gross).toLocaleString()}</td>
                          <td className="px-3 py-3 text-center text-slate-600">{item.disc_pct}</td>
                          <td className="px-3 py-3 text-center text-slate-600">Rs. {item.disc_flat}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">Rs. {Number(item.net).toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveGRNItem(idx)}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Delete Row"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr ref={grnItemsEndRef}>
                        <td colSpan="10" className="p-0 border-0" />
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* StickyBottomFinancialBar */}
          <div className="bg-white/95 backdrop-blur-md border border-slate-200 z-20 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 shadow-lg rounded-2xl" data-purpose="sticky-bottom-summary">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
              {/* Left Action: Invoices Audit List */}
              <div className="flex items-center justify-between md:justify-start">
                <button
                  type="button"
                  onClick={() => setShowGRNListModal(true)}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Invoices Audit List</span>
                </button>
              </div>

              {/* Right: Financial Breakdown & Primary Save Button */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5">
                  {/* Items Subtotal */}
                  <div className="bg-slate-50 border border-slate-200 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-center min-w-[95px] sm:min-w-[105px]">
                    <span className="block text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subtotal</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800">
                      Rs. {grnItems.reduce((s, it) => s + (Number(it.net) || 0), 0).toLocaleString()}
                    </span>
                  </div>

                  {/* Extra Disc (Rs.) */}
                  <div className="bg-amber-50/50 border border-amber-200 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-center min-w-[95px] sm:min-w-[110px]">
                    <label className="block text-[9px] sm:text-[10px] font-bold text-amber-800 uppercase tracking-wider" htmlFor="extra-disc-input">Extra Disc</label>
                    <input
                      id="extra-disc-input"
                      type="number"
                      min="0"
                      value={grnForm.extra_bill_discount}
                      onChange={(e) => setGrnForm({ ...grnForm, extra_bill_discount: e.target.value })}
                      className="w-14 sm:w-16 bg-transparent border-0 p-0 text-xs sm:text-sm font-bold text-amber-900 text-center focus:ring-0"
                    />
                  </div>

                  {/* Freight / Bilty (Rs.) */}
                  <div className="bg-sky-50/50 border border-sky-200 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-center min-w-[95px] sm:min-w-[115px]">
                    <label className="block text-[9px] sm:text-[10px] font-bold text-sky-800 uppercase tracking-wider" htmlFor="freight-input">Freight</label>
                    <input
                      id="freight-input"
                      type="number"
                      min="0"
                      value={grnForm.freight_charges}
                      onChange={(e) => setGrnForm({ ...grnForm, freight_charges: e.target.value })}
                      className="w-14 sm:w-16 bg-transparent border-0 p-0 text-xs sm:text-sm font-bold text-sky-900 text-center focus:ring-0"
                    />
                  </div>

                  {/* Net Payable (Highlighted Mint Container) */}
                  <div className="bg-teal-50 border border-teal-300 px-2.5 sm:px-3.5 py-1 rounded-xl text-center min-w-[95px] sm:min-w-[130px] flex flex-col justify-center">
                    <span className="text-[9px] sm:text-[10px] font-bold text-teal-900 uppercase tracking-wide flex items-center justify-center gap-1">
                      <span>NET PAYABLE</span>
                    </span>
                    <span className="text-sm sm:text-base md:text-lg font-black text-teal-950 leading-tight">
                      Rs. {Math.max(
                        0,
                        grnItems.reduce((s, it) => s + (Number(it.net) || 0), 0) -
                          (Number(grnForm.extra_bill_discount) || 0) +
                          (Number(grnForm.freight_charges) || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Primary CTA: Save Invoice & Add to Stock */}
                <button
                  type="button"
                  onClick={handleSaveGRNBill}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-xs sm:text-sm shadow-md shadow-teal-700/20 transition-all shrink-0 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-teal-200 shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                    <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Save Invoice &amp; Add to Stock</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: Pharma Suppliers / Distributors Directory */}
      {activeTab === "suppliers" && (
        <div className="space-y-3.5">
          {/* Top Control Bar: Search & View Mode Toggle (Row List vs Cards Grid) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                search
              </span>
              <input
                type="text"
                placeholder="Search by Code, Company Name, Rep, Phone..."
                value={supplierSearchText}
                onChange={(e) => setSupplierSearchText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-100"
              />
              {supplierSearchText && (
                <button
                  type="button"
                  onClick={() => setSupplierSearchText("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider hidden md:inline">
                View Mode:
              </span>
              <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                <button
                  type="button"
                  onClick={() => setSupplierViewMode("table")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    supplierViewMode === "table"
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-200"
                  }`}
                  title="Neat Row Table List View"
                >
                  <span className="material-symbols-outlined text-base">format_list_bulleted</span>
                  <span>Neat Table Row List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierViewMode("grid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    supplierViewMode === "grid"
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-200"
                  }`}
                  title="Cards Boxes View"
                >
                  <span className="material-symbols-outlined text-base">grid_view</span>
                  <span>Cards Boxes</span>
                </button>
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: Neat Clean Accounting Table View (Default) */}
          {supplierViewMode === "table" ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-3.5 py-2.5 text-center w-24">Code</th>
                      <th className="px-4 py-2.5">Company / Distributor Name</th>
                      <th className="px-3.5 py-2.5">Sales Rep</th>
                      <th className="px-3.5 py-2.5">Phone</th>
                      <th className="px-4 py-2.5">City / Address</th>
                      <th className="px-3 py-2.5 text-center w-20">Bills</th>
                      <th className="px-4 py-2.5 text-right w-36">Udhaar Balance</th>
                      <th className="px-4 py-2.5 text-center w-56">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredSuppliersList.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center py-10 text-slate-400 font-medium">
                          No companies match your search "{supplierSearchText}".
                        </td>
                      </tr>
                    ) : (
                      filteredSuppliersList.map((sup, idx) => {
                        const supBills = purchases.filter((p) => p.supplier_id === sup.id);
                        const balance = Number(sup.current_balance ?? sup.balance_due ?? sup.balance ?? 0);

                        return (
                          <tr key={sup.id} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                            <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-600 text-xs">
                              {sup.supplier_code || sup.id}
                            </td>
                            <td className="px-4 py-2.5 font-bold text-slate-900 text-xs">
                              {sup.name}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600">
                              {sup.contact_person || "—"}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600 font-mono text-xs">
                              {sup.phone || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 truncate max-w-[200px]">
                              {sup.address || "Main City"}
                            </td>
                            <td className="px-3 py-2.5 text-center font-semibold text-slate-600">
                              {supBills.length}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold">
                              {balance > 0 ? (
                                <span className="text-rose-700 font-bold">
                                  Rs. {balance.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold text-[11px]">
                                  Rs. 0 (Paid)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab("grn_form");
                                    setGrnForm((prev) => ({
                                      ...prev,
                                      account_name: sup.name,
                                      reference: sup.contact_person || prev.reference,
                                    }));
                                    setGrnSupplierCode(sup.supplier_code || sup.id);
                                  }}
                                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-1 rounded text-xs font-semibold transition-colors"
                                  title="New GRN Bill"
                                >
                                  + GRN
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRequestEditSupplier(sup)}
                                  className="border border-slate-300 text-slate-700 hover:bg-slate-100 px-2 py-1 rounded text-xs font-medium transition-colors"
                                  title="Edit Supplier"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSupplierDrawer(sup);
                                    setSupplierDrawerSearch("");
                                  }}
                                  className="border border-slate-300 text-slate-700 hover:bg-slate-100 px-2 py-1 rounded text-xs font-medium transition-colors"
                                  title="View Invoices"
                                >
                                  Invoices ({supBills.length})
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    try {
                                      const txns = dbSupplierLedger ? dbSupplierLedger.getBySupplier(sup) : [];
                                      setLedgerDrawerSupplier(sup);
                                      setSupplierLedgerTxns(Array.isArray(txns) ? txns : []);
                                    } catch (err) {
                                      console.error("Ledger load error:", err);
                                      setLedgerDrawerSupplier(sup);
                                      setSupplierLedgerTxns([]);
                                    }
                                  }}
                                  className="border border-slate-300 text-slate-700 hover:bg-slate-100 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
                                  title="View Account Ledger"
                                >
                                  Ledger
                                </button>

                                {balance > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPaySupplierModal(sup);
                                      setPayAmountInput(String(balance));
                                      setPaymentMode("cash");
                                      setPaymentRef("");
                                      setPaymentNote("");
                                    }}
                                    className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded text-xs font-semibold transition-colors"
                                  >
                                    Pay
                                  </button>
                                )}
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
          ) : (
            /* VIEW MODE 2: Cards Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredSuppliersList.length === 0 ? (
                <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-300">
                  <span className="material-symbols-outlined text-5xl text-slate-300 block mb-2">domain_disabled</span>
                  <div className="text-slate-600 font-bold text-sm">No pharma suppliers match search.</div>
                </div>
              ) : (
                filteredSuppliersList.map((sup) => {
                  const supBills = purchases.filter((p) => p.supplier_id === sup.id);
                  const balance = Number(sup.current_balance ?? sup.balance_due ?? sup.balance ?? 0);

                  return (
                    <div
                      key={sup.id}
                      className="bg-white rounded-2xl border border-slate-300 p-4 shadow-2xs hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        {/* Top Row: Company Icon + Name + Balance */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-teal-100 border border-teal-300 text-teal-900 flex items-center justify-center font-black text-lg shrink-0">
                              {sup.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-black text-slate-950 text-sm leading-tight">
                                  {sup.name}
                                </h3>
                                <span className="font-mono text-emerald-950 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 text-[10px] font-black">
                                  #{sup.supplier_code || sup.id}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 font-bold mt-0.5">
                                {sup.contact_person || "Sales Representative"}
                              </div>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-black whitespace-nowrap ${
                            balance > 0 ? "bg-rose-100 text-rose-950 border border-rose-300" : "bg-emerald-100 text-emerald-950 border border-emerald-300"
                          }`}>
                            {balance > 0 ? `Due: Rs. ${balance.toLocaleString()}` : "Paid"}
                          </span>
                        </div>

                        {/* Info Metadata */}
                        <div className="mt-3 space-y-1 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-bold">Supplier Code:</span>
                            <span className="font-mono font-black text-emerald-900 bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-[10.5px]">
                              {sup.supplier_code || sup.id}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-bold">Phone:</span>
                            <span className="font-bold text-slate-900">{sup.phone || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-bold">Address:</span>
                            <span className="font-semibold text-slate-800 truncate max-w-[150px]">{sup.address || "Main City"}</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-200 pt-1">
                            <span className="text-slate-500 font-bold">Recorded Bills:</span>
                            <span className="font-black text-teal-800">{supBills.length} Bills</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions Bar */}
                      <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => {
                            setActiveTab("grn_form");
                            setGrnForm((prev) => ({
                              ...prev,
                              account_name: sup.name,
                              reference: sup.contact_person || prev.reference,
                            }));
                            setGrnSupplierCode(sup.supplier_code || sup.id);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded-lg font-black text-[11px] transition-colors flex items-center justify-center gap-0.5"
                          title="Create GRN with this Supplier"
                        >
                          <span className="material-symbols-outlined text-xs">receipt</span>
                          New GRN
                        </button>
                        <button
                          onClick={() => handleRequestEditSupplier(sup)}
                          className="bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200 px-2 py-1.5 rounded-lg font-black text-[11px] transition-colors flex items-center justify-center gap-0.5"
                          title="Edit Supplier"
                        >
                          <span className="material-symbols-outlined text-xs text-amber-800">edit</span>
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSupplierDrawer(sup);
                            setSupplierDrawerSearch("");
                          }}
                          className="flex-1 bg-teal-50 text-teal-900 border border-teal-300 hover:bg-teal-100 py-1.5 rounded-lg font-black text-[11px] transition-colors flex items-center justify-center gap-0.5"
                        >
                          <span className="material-symbols-outlined text-xs">receipt_long</span>
                          Invoices ({supBills.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const txns = dbSupplierLedger ? dbSupplierLedger.getBySupplier(sup) : [];
                              setLedgerDrawerSupplier(sup);
                              setSupplierLedgerTxns(Array.isArray(txns) ? txns : []);
                            } catch (err) {
                              console.error("Ledger load error:", err);
                              setLedgerDrawerSupplier(sup);
                              setSupplierLedgerTxns([]);
                            }
                          }}
                          className="flex-1 bg-purple-50 text-purple-900 border border-purple-300 hover:bg-purple-100 py-1.5 rounded-lg font-black text-[11px] transition-colors flex items-center justify-center gap-0.5 cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-xs">account_balance</span>
                          Ledger
                        </button>
                        {balance > 0 && (
                          <button
                            onClick={() => {
                              setPaySupplierModal(sup);
                              setPayAmountInput(String(balance));
                              setPaymentMode("cash");
                              setPaymentRef("");
                              setPaymentNote("");
                            }}
                            className="bg-rose-600 text-white hover:bg-rose-700 px-2.5 py-1.5 rounded-lg font-black text-[11px] transition-colors"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: All Purchase Bills Audit Log */}
      {activeTab === "bills" && (
        <div className="space-y-3.5">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-300 shadow-2xs">
              <div className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider">Total Purchase Inwarded</div>
              <div className="text-lg font-black text-slate-950 mt-0.5">
                Rs. {globalFilteredPurchases.reduce((s, p) => s + (Number(p.total_amount) || 0), 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 font-bold mt-0.5">{globalFilteredPurchases.length} Recorded Bills</div>
            </div>

            <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-300 shadow-2xs">
              <div className="text-[10.5px] font-black text-emerald-900 uppercase tracking-wider">Total Upfront Paid</div>
              <div className="text-lg font-black text-emerald-950 mt-0.5">
                Rs. {globalFilteredPurchases.reduce((s, p) => s + (Number(p.paid_amount) || 0), 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-800 font-bold mt-0.5">Cash / Bank Paid</div>
            </div>

            <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-300 shadow-2xs">
              <div className="text-[10.5px] font-black text-rose-900 uppercase tracking-wider">Total Credit (Udhaar) Due</div>
              <div className="text-lg font-black text-rose-950 mt-0.5">
                Rs. {globalFilteredPurchases.reduce((s, p) => s + (Number(p.balance_due) || 0), 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-rose-800 font-bold mt-0.5">Payable to Suppliers</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex justify-between items-center gap-3 bg-white p-3 rounded-2xl border border-slate-300 shadow-2xs">
            <div className="relative w-full sm:w-96">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                search
              </span>
              <input
                type="text"
                placeholder="Search by System Invoice #, Company Bill #, or Supplier..."
                value={globalBillsSearch}
                onChange={(e) => setGlobalBillsSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-100"
              />
              {globalBillsSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalBillsSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>
            <span className="text-xs font-black text-slate-600">
              Showing {globalFilteredPurchases.length} Purchase Invoices
            </span>
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-emerald-800 text-white font-black uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-3.5 py-3">Date</th>
                    <th className="px-3.5 py-3">System Voucher #</th>
                    <th className="px-3.5 py-3">Company Bill #</th>
                    <th className="px-4 py-3">Supplier / Company Name</th>
                    <th className="px-3.5 py-3 text-center">Payment Mode</th>
                    <th className="px-4 py-3 text-right">Bill Total</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Balance Due</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-900">
                  {globalFilteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-12 text-slate-400 font-semibold">
                        <span className="material-symbols-outlined text-4xl block mb-1 text-slate-300">receipt_long</span>
                        No purchase bills match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    globalFilteredPurchases.map((p, idx) => (
                      <tr key={p.id} className={`hover:bg-emerald-50/40 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                        <td className="px-3.5 py-3 text-slate-600 font-medium">
                          {p.purchase_date ? new Date(p.purchase_date).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="px-3.5 py-3 font-mono font-black text-emerald-950">
                          {p.invoice_no}
                        </td>
                        <td className="px-3.5 py-3 font-mono font-black text-slate-800">
                          {p.grn_no || p.company_bill_no || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-950 font-black text-sm">
                          {p.supplier_name}
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            p.payment_mode === "Cash" || p.balance_due === 0
                              ? "bg-emerald-100 text-emerald-950 border border-emerald-300"
                              : "bg-rose-100 text-rose-950 border border-rose-300"
                          }`}>
                            {p.payment_mode === "Cash" || p.balance_due === 0 ? "💵 Cash Paid" : "📜 Credit Udhaar"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-950 text-sm">
                          Rs. {(p.total_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-900 font-black">
                          Rs. {(p.paid_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(p.balance_due || 0) > 0 ? (
                            <span className="text-rose-700 font-black">Rs. {(p.balance_due || 0).toLocaleString()}</span>
                          ) : (
                            <span className="text-emerald-700 font-black">Rs. 0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceModal(p)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => printSupplierPurchaseReceipt(p, suppliers.find((s) => s.id === p.supplier_id), dbClinic.get())}
                              className="bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors"
                            >
                              Print
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePurchaseInvoice(p.id, p.invoice_no)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-2 py-1 rounded-lg text-[11px] font-black transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Receive New Stock Entry */}
      {activeTab === "new_purchase" && (
        <form onSubmit={handleSavePurchase} className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">post_add</span>
                Receive New Stock Entry (Inward Delivery)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Record Company Purchase Invoices &amp; Auto-Update Inventory Stock
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Quick Supplier Code Auto-Fill */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-amber-600">bolt</span>
                Supplier Code
              </label>
              <input
                type="text"
                placeholder="e.g. SUP-001 or BM"
                value={newPurchaseCodeSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewPurchaseCodeSearch(val);
                  const matched = dbSuppliers.getByCode(val);
                  if (matched) {
                    setSelectedSupplierId(matched.id);
                  }
                }}
                className="w-full border border-amber-300 bg-amber-50/50 rounded-xl px-3 py-2 text-xs font-mono font-black uppercase text-amber-950 focus:bg-white focus:border-amber-500"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-600 mb-1">Select Company / Distributor *</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  const sup = suppliers.find((s) => s.id === e.target.value);
                  if (sup?.supplier_code) setNewPurchaseCodeSearch(sup.supplier_code);
                }}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 bg-white"
                required
              >
                <option value="">-- Choose Distributor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏢 {s.supplier_code ? `[Code: ${s.supplier_code}] ` : ""}{s.name} ({s.contact_person || "Rep"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">System Sequential Voucher #</label>
              <input
                type="text"
                value="Auto-Generated on Save (e.g. PUR-1001)"
                readOnly
                className="w-full border border-teal-200 bg-teal-50/50 rounded-xl px-3 py-2 text-xs font-bold text-teal-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Company Original Bill / Invoice #</label>
              <input
                type="text"
                placeholder="e.g. Getz-1045 / Invoice # from Company"
                value={companyBillNoInput}
                onChange={(e) => setCompanyBillNoInput(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>
          </div>

          {/* Itemized Stock Form */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center bg-gray-50/80 p-2.5 rounded-2xl border border-gray-200">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-gray-800 uppercase tracking-wider">Itemized Stock Entries</span>
                <span className="bg-teal-100 text-teal-800 text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {purchaseItems.length} {purchaseItems.length === 1 ? "Item" : "Items"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-1.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                + Add Line Item
              </button>
            </div>

            {/* Bounded Scrollable Container */}
            <div
              ref={itemsContainerRef}
              className="max-h-[440px] overflow-y-auto pr-1.5 space-y-3 rounded-2xl p-1 focus:outline-none"
              tabIndex={0}
            >
              {purchaseItems.map((item, index) => {
                const activeSupplier = suppliers.find((s) => s.id === selectedSupplierId);
                const matchedInventory = (selectedSupplierId && activeSupplier)
                  ? filterInventoryByCompanyOrSupplier(inventoryList, activeSupplier.name, activeSupplier)
                  : inventoryList;
                const displayList = tab4ShowAllCompanies
                  ? inventoryList
                  : (matchedInventory.length > 0 ? matchedInventory : inventoryList);

                return (
                  <div key={index} className="grid grid-cols-12 gap-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-200 items-center shadow-xs">
                    <div className="col-span-12 md:col-span-4 space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Medicine Item *</label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-teal-800">
                            {activeSupplier
                              ? (tab4ShowAllCompanies ? `All (${displayList.length})` : `${displayList.length} for ${activeSupplier.name.split(" ")[0]}`)
                              : "Auto-fill from Inventory"}
                          </span>
                          {activeSupplier && (
                            <button
                              type="button"
                              onClick={() => setTab4ShowAllCompanies(!tab4ShowAllCompanies)}
                              className="text-[9px] font-black underline text-teal-600 hover:text-teal-900"
                            >
                              {tab4ShowAllCompanies ? "Filter Brand" : "All Brands"}
                            </button>
                          )}
                        </div>
                      </div>
                      <select
                        value={item.inventory_id || ""}
                        onChange={(e) => handleSelectExistingMedicine(index, e.target.value)}
                        className="w-full border border-teal-200 bg-teal-50/40 rounded-lg px-2 py-1.5 text-xs font-bold text-teal-900 focus:ring-1 focus:ring-teal-500 mb-1"
                      >
                        <option value="">+ Custom / New Medicine Entry</option>
                        {displayList.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            [{inv.company_name || "BM Pvt LTD"}] {inv.medicine_name} ({inv.strength || inv.category}) — {inv.stock_qty} left
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Medicine Name (e.g. Panadol 500mg)"
                        value={item.medicine_name}
                        onChange={(e) => handleItemChange(index, "medicine_name", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                        required
                      />
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">Category / Form</label>
                      <select
                        value={item.category || "Tablet"}
                        onChange={(e) => handleItemChange(index, "category", e.target.value)}
                        className="w-full border border-gray-300 bg-white rounded-lg px-2 py-1.5 text-xs font-medium"
                      >
                        <option value="Tablet">Tablet</option>
                        <option value="Capsule">Capsule</option>
                        <option value="Syrup / Suspension">Syrup / Suspension</option>
                        <option value="Injection / IV">Injection / IV</option>
                        <option value="Cream / Ointment / Gel">Cream / Gel</option>
                        <option value="Eye / Ear Drops">Eye/Ear Drops</option>
                      </select>
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">Received Format</label>
                      <select
                        value={item.received_unit_type || "box"}
                        onChange={(e) => handleItemChange(index, "received_unit_type", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold text-teal-800 bg-white"
                      >
                        <option value="box">Boxes / Packs</option>
                        <option value="strip">Strips / Pattay</option>
                        <option value="unit">Base Units / Tablets</option>
                      </select>
                    </div>

                    <div className="col-span-4 md:col-span-1">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase text-center">Qty</label>
                      <input
                        type="number"
                        placeholder="Qty"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, "qty", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold text-center bg-white"
                        required
                      />
                    </div>

                    <div className="col-span-4 md:col-span-1">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">Cost (Rs)</label>
                      <input
                        type="number"
                        placeholder="Cost"
                        value={item.cost_price}
                        onChange={(e) => handleItemChange(index, "cost_price", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold bg-white"
                        required
                      />
                    </div>

                    <div className="col-span-3 md:col-span-1">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">Disc %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0%"
                        value={item.disc_pct || ""}
                        onChange={(e) => handleItemChange(index, "disc_pct", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold text-center bg-white font-mono"
                      />
                    </div>

                    <div className="col-span-3 md:col-span-1">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">Disc Rs</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={item.disc_flat || ""}
                        onChange={(e) => handleItemChange(index, "disc_flat", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold text-center bg-white font-mono"
                      />
                    </div>

                    <div className="col-span-3 md:col-span-1">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">MRP / Sale</label>
                      <input
                        type="number"
                        placeholder="Sale"
                        value={item.sale_price}
                        onChange={(e) => handleItemChange(index, "sale_price", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold bg-white"
                      />
                    </div>

                    <div className="col-span-1 text-center pt-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(index)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete item row"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              <div ref={itemsEndRef} />
            </div>
          </div>

          {/* Sticky Bottom Summary Bar */}
          <div className="sticky bottom-2 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border-2 border-teal-500/20 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 transition-all">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <div className="text-xs text-gray-500 font-medium">Calculated Bill Total:</div>
                <div className="text-2xl font-black text-teal-800">Rs. {calculateTotalBill().toLocaleString()}</div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Upfront Cash Paid Now</label>
                <input
                  type="number"
                  placeholder="0 for Full Udhaar"
                  value={paidAmountInput}
                  onChange={(e) => setPaidAmountInput(e.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-bold w-40 bg-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddItemRow}
                className="btn-secondary text-xs flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add Item
              </button>
              <button
                type="submit"
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-6 py-2.5 rounded-2xl text-xs shadow-lg transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">save</span>
                Save Stock Entry &amp; Print Voucher
              </button>
            </div>
          </div>
        </form>
      )}

      {/* MODAL / DRAWER: Specific Supplier Invoices & Account Statement */}
      {selectedSupplierDrawer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl h-full sm:h-auto rounded-none sm:rounded-3xl shadow-2xl p-6 border border-gray-200 space-y-5 overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-gray-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  {selectedSupplierDrawer.name}
                </h2>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                  <span>Rep: {selectedSupplierDrawer.contact_person || "N/A"}</span>
                  <span>•</span>
                  <span>Phone: {selectedSupplierDrawer.phone || "N/A"}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedSupplierDrawer(null)}
                className="text-gray-400 hover:text-gray-600 p-1 bg-gray-100 rounded-full"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Account Financial Balance Summary */}
            <div className="grid grid-cols-3 gap-3 bg-teal-50/50 p-4 rounded-2xl border border-teal-100">
              <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase">Total Invoices</div>
                <div className="text-lg font-black text-gray-900">{supplierInvoices.length} Bills</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase">Total Purchased</div>
                <div className="text-lg font-black text-teal-800">
                  Rs. {supplierInvoices.reduce((sum, p) => sum + (p.total_amount || 0), 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-rose-700 uppercase">Payable Balance Due</div>
                <div className="text-lg font-black text-rose-800">
                  Rs. {(selectedSupplierDrawer.balance_due || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Invoices Search Bar */}
            <div className="flex justify-between items-center gap-3">
              <input
                type="text"
                placeholder="Search this supplier's invoices..."
                value={supplierDrawerSearch}
                onChange={(e) => setSupplierDrawerSearch(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold w-full"
              />
            </div>

            {/* Invoices Table */}
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Voucher #</th>
                    <th className="px-3 py-2.5">Company Bill #</th>
                    <th className="px-3 py-2.5 text-right">Bill Total</th>
                    <th className="px-3 py-2.5 text-right">Balance</th>
                    <th className="px-3 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold">
                  {filteredSupplierInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-6 text-gray-400">
                        No purchase invoices recorded for this supplier yet.
                      </td>
                    </tr>
                  ) : (
                    filteredSupplierInvoices.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5">{new Date(p.purchase_date).toLocaleDateString("en-US")}</td>
                        <td className="px-3 py-2.5 font-bold text-teal-700">{p.invoice_no}</td>
                        <td className="px-3 py-2.5 font-bold text-gray-800">{p.company_bill_no || "N/A"}</td>
                        <td className="px-3 py-2.5 text-right font-black text-gray-900">Rs. {(p.total_amount || 0).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-rose-700">Rs. {(p.balance_due || 0).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedInvoiceModal(p)}
                              className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-2 py-1 rounded-lg text-[11px] font-bold"
                            >
                              View
                            </button>
                            <button
                              onClick={() => printSupplierPurchaseReceipt(p, selectedSupplierDrawer, dbClinic.get())}
                              className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-1 rounded-lg text-[11px] font-bold"
                            >
                              Print
                            </button>
                            <button
                              onClick={() => handleDeletePurchaseInvoice(p.id, p.invoice_no)}
                              className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-1 rounded-lg text-[11px] font-bold hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: View Invoice Detail */}
      {selectedInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl p-6 border border-emerald-300 space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">receipt_long</span>
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">Purchase Voucher #{selectedInvoiceModal.invoice_no || selectedInvoiceModal.voucher_no}</h3>
                  <p className="text-xs text-gray-500 font-semibold">
                    Company Bill / GRN #: <span className="font-bold text-gray-800">{selectedInvoiceModal.grn_no || selectedInvoiceModal.company_bill_no || "0"}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedInvoiceModal(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Header Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-semibold">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Supplier</span>
                <span className="font-bold text-gray-900 truncate block">{selectedInvoiceModal.supplier_name || "Supplier"}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Purchase Date</span>
                <span className="font-bold text-gray-800">{selectedInvoiceModal.purchase_date ? String(selectedInvoiceModal.purchase_date).split("T")[0] : "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Payment Mode</span>
                <span className="font-bold text-emerald-800">{selectedInvoiceModal.payment_mode || "Cash"}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Transport / Bilty</span>
                <span className="font-bold text-gray-800 truncate block">{selectedInvoiceModal.transport || "By Hand"} {selectedInvoiceModal.bilty_no ? `· #${selectedInvoiceModal.bilty_no}` : ""}</span>
              </div>
            </div>

            {/* Items Table matching Sale Invoice */}
            <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-10">S/r</th>
                    <th className="px-3 py-2.5">Particulars</th>
                    <th className="px-3 py-2.5 text-center">Qty</th>
                    <th className="px-3 py-2.5 text-center">Rate</th>
                    <th className="px-3 py-2.5 text-center">Disc</th>
                    <th className="px-3 py-2.5 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {(selectedInvoiceModal.items || []).map((i, index) => {
                    const q = Number(i.qty || i.quantity || i.qty_base_units || 1);
                    const bq = Number(i.bonus_qty || 0);
                    const r = Number(i.rate || i.cost_price || 0);
                    const disc = i.disc_pct || (Number(i.disc_pct_num) > 0 ? `${i.disc_pct_num}%` : (Number(i.disc_flat) > 0 ? `Rs.${i.disc_flat}` : "-"));
                    const net = Number(i.net || i.total_cost || (q * r));

                    return (
                      <tr key={index} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="px-3 py-2.5 text-center font-bold text-gray-400 text-[11px]">{index + 1}</td>
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-gray-900">{i.medicine_name}</div>
                          <div className="text-[10px] text-gray-500 font-semibold flex items-center gap-1.5 flex-wrap mt-0.5">
                            {i.company_name && <span className="bg-emerald-50 text-emerald-800 px-1 py-0.2 rounded font-bold border border-emerald-200">[{i.company_name}]</span>}
                            {i.packing && <span>· {i.packing}</span>}
                            {i.batch_no && i.batch_no !== "0" && i.batch_no !== "-" && <span className="font-mono font-bold text-gray-700">· Batch: {i.batch_no}</span>}
                            {i.expiry_date && <span className="font-mono text-amber-800 font-bold">· Exp: {String(i.expiry_date).split("T")[0]}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-gray-800">
                          {q}
                          {bq > 0 && <span className="block text-[9.5px] font-black text-emerald-700">+{bq} Bonus</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-semibold">Rs. {r.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-gray-600">{disc}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-black text-gray-900">Rs. {net.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Totals Breakdown */}
            <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-2xl space-y-1.5 text-xs font-bold">
              {Number(selectedInvoiceModal.extra_discount || selectedInvoiceModal.extra_bill_discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>Extra Bill Discount:</span>
                  <span className="font-mono">- Rs. {Number(selectedInvoiceModal.extra_discount || selectedInvoiceModal.extra_bill_discount).toLocaleString()}</span>
                </div>
              )}
              {Number(selectedInvoiceModal.freight_charges || selectedInvoiceModal.freight || 0) > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Freight Charges:</span>
                  <span className="font-mono">+ Rs. {Number(selectedInvoiceModal.freight_charges || selectedInvoiceModal.freight).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-900 text-sm font-black pt-1 border-t border-emerald-200">
                <span>Total Bill Amount:</span>
                <span className="font-mono text-base text-emerald-950">Rs. {(selectedInvoiceModal.total_amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-teal-800">
                <span>Paid Now (Cash):</span>
                <span className="font-mono">Rs. {(selectedInvoiceModal.paid_amount || 0).toLocaleString()}</span>
              </div>
              {Number(selectedInvoiceModal.balance_due || 0) > 0 && (
                <div className="flex justify-between text-rose-800 font-black text-sm pt-1 border-t border-dashed border-rose-300">
                  <span>Payable Udhaar (Balance):</span>
                  <span className="font-mono">Rs. {(selectedInvoiceModal.balance_due || 0).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => printPurchaseGRNReceipt(selectedInvoiceModal, dbClinic.get())}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-2xl text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                Print 80mm ESC/POS Voucher
              </button>
              <button
                onClick={() => handleDeletePurchaseInvoice(selectedInvoiceModal.id, selectedInvoiceModal.invoice_no)}
                className="bg-rose-50 border border-rose-200 text-rose-700 font-bold px-4 py-3 rounded-2xl text-xs hover:bg-rose-100 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Enhanced Payment Settlement — Multi-Mode */}
      {paySupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSupplierPayment} className="bg-white max-w-md w-full rounded-3xl p-6 border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                Supplier Payment Settlement
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Record payment to <strong>{paySupplierModal.name}</strong></p>
              {Number(paySupplierModal.current_balance ?? paySupplierModal.balance_due ?? paySupplierModal.balance ?? 0) > 0 && (
                <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800">
                  Outstanding Balance: Rs. {Number(paySupplierModal.current_balance ?? paySupplierModal.balance_due ?? paySupplierModal.balance ?? 0).toLocaleString()}
                </div>
              )}
            </div>

            {/* Payment Mode Toggle */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Payment Mode *</label>
              <div className="flex gap-2">
                {["cash", "cheque", "bank"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      paymentMode === mode ? "bg-emerald-600 text-white border-emerald-600" : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {mode === "cash" ? "💵 Cash" : mode === "cheque" ? "📄 Cheque" : "🏦 Bank"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Amount Paid Now (Rs.) *</label>
              <input
                type="number"
                value={payAmountInput}
                onChange={(e) => setPayAmountInput(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold text-teal-800"
                required
              />
            </div>

            {(paymentMode === "cheque" || paymentMode === "bank") && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  {paymentMode === "cheque" ? "Cheque Number" : "Bank Reference / Transfer ID"}
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder={paymentMode === "cheque" ? "e.g. MCB-001234" : "e.g. HBL-TRF-20260821"}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Payment Note (Optional)</label>
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="e.g. Partial payment for August 2026 bills"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaySupplierModal(null)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs hover:bg-emerald-700"
              >
                ✓ Record Payment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Add New Supplier */}
      {showAddSupplier && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateSupplier} className="bg-white max-w-md w-full rounded-3xl p-6 border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600">domain_add</span>
              Add New Pharma Supplier / Distributor
            </h3>
            
            <div className="space-y-3 text-xs font-semibold">
              {/* Supplier Short Code */}
              <div>
                <label className="block text-gray-700 mb-1 flex items-center justify-between">
                  <span>Supplier Short Code (for Quick Auto-Fill) *</span>
                  <button
                    type="button"
                    onClick={() => setNewSupCode(dbSuppliers.getNextSupplierCode())}
                    className="text-[10px] text-teal-700 hover:text-teal-900 font-bold"
                  >
                    Auto-Generate
                  </button>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. SUP-001, BM, PAUL, SCHW"
                    value={newSupCode}
                    onChange={(e) => setNewSupCode(e.target.value)}
                    className="flex-1 border border-amber-300 bg-amber-50/50 rounded-xl px-3 py-2 text-xs font-mono font-black uppercase text-amber-950 focus:bg-white focus:border-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setNewSupCode(dbSuppliers.getNextSupplierCode())}
                    className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-[10px] font-black shrink-0 hover:bg-emerald-100"
                  >
                    Auto
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Type this short code in Purchase GRN or invoices to instantly auto-fill this company.
                </p>
              </div>

              <div>
                <label className="block text-gray-600 mb-1">Company / Distributor Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Getz Pharma / GSK Distributors"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Sales Rep / Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Asif Raza (Area Manager)"
                  value={newSupContact}
                  onChange={(e) => setNewSupContact(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="03001234567"
                  value={newSupPhone}
                  onChange={(e) => setNewSupPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Office Address</label>
                <input
                  type="text"
                  placeholder="Main Medicine Market, Hyderabad"
                  value={newSupAddress}
                  onChange={(e) => setNewSupAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSupplier(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-teal-600 text-white font-bold py-2 rounded-xl text-xs hover:bg-teal-700"
              >
                Save Supplier
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Admin Security Passcode Verification */}
      {adminAuthPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleVerifyAdminPasscode} className="bg-white max-w-sm w-full rounded-3xl p-6 border border-amber-300 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-2xl shrink-0">
                <span className="material-symbols-outlined text-2xl">lock</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Admin Passcode Required</h3>
                <p className="text-[11px] text-gray-500">
                  Editing <strong>{adminAuthPrompt.targetSupplier?.name}</strong> requires administrator authorization.
                </p>
              </div>
            </div>

            {adminAuthError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">error</span>
                {adminAuthError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Admin Master Passcode</label>
              <input
                type="password"
                placeholder="Enter Admin Passcode..."
                value={adminPasscodeEntry}
                onChange={(e) => {
                  setAdminPasscodeEntry(e.target.value);
                  setAdminAuthError("");
                }}
                autoFocus
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-black tracking-widest text-gray-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setAdminAuthPrompt(null);
                  setAdminPasscodeEntry("");
                  setAdminAuthError("");
                }}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-xs hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-amber-200 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">vpn_key</span>
                Verify &amp; Unlock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Edit Supplier Profile */}
      {editSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveSupplierEdits} className="bg-white max-w-md w-full rounded-3xl p-6 border border-gray-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">edit_note</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Edit Distributor Company Profile</h3>
                  <p className="text-[10.5px] text-gray-400">Admin Locked Editing Engine</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditSupplierModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs font-semibold">
              {/* Supplier Short Code */}
              <div>
                <label className="block text-gray-700 mb-1">Supplier Short Code *</label>
                <input
                  type="text"
                  value={editSupplierModal.supplier_code}
                  onChange={(e) => setEditSupplierModal({ ...editSupplierModal, supplier_code: e.target.value })}
                  className="w-full border border-amber-300 bg-amber-50/50 rounded-xl px-3 py-2 text-xs font-mono font-black uppercase text-amber-950 focus:bg-white focus:border-amber-500"
                  required
                />
              </div>

              {/* Company / Distributor Name */}
              <div>
                <label className="block text-gray-700 mb-1">Company / Distributor Name *</label>
                <input
                  type="text"
                  value={editSupplierModal.name}
                  onChange={(e) => setEditSupplierModal({ ...editSupplierModal, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900"
                  required
                />
              </div>

              {/* Sales Rep / Contact Person */}
              <div>
                <label className="block text-gray-700 mb-1">Sales Rep / Contact Person</label>
                <input
                  type="text"
                  value={editSupplierModal.contact_person}
                  onChange={(e) => setEditSupplierModal({ ...editSupplierModal, contact_person: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editSupplierModal.phone}
                  onChange={(e) => setEditSupplierModal({ ...editSupplierModal, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={editSupplierModal.city}
                  onChange={(e) => setEditSupplierModal({ ...editSupplierModal, city: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              {/* Office Address */}
              <div>
                <label className="block text-gray-700 mb-1">Office / Warehouse Address</label>
                <input
                  type="text"
                  value={editSupplierModal.address}
                  onChange={(e) => setEditSupplierModal({ ...editSupplierModal, address: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              {/* Current Balance / Udhaar Due */}
              <div>
                <label className="block text-gray-700 mb-1">Current Payable / Udhaar Balance (Rs.)</label>
                <input
                  type="number"
                  value={editSupplierModal.current_balance}
                  onChange={(e) => setEditSupplierModal({ ...editSupplierModal, current_balance: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-rose-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleDeleteSupplier(editSupplierModal.id, editSupplierModal.name)}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditSupplierModal(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-emerald-200 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Supplier Ledger Transaction History Drawer (Mounted via createPortal for zero DOM clipping) */}
      {ledgerDrawerSupplier && createPortal(
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-end p-2 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg h-full max-h-[96vh] sm:max-h-[100vh] overflow-y-auto rounded-3xl border border-gray-200 shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm rounded-t-3xl z-10">
              <div>
                <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-600" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
                  Ledger — {ledgerDrawerSupplier.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Two-Way Transaction Audit (Payable &amp; Receivable)</p>
              </div>
              <button
                type="button"
                onClick={() => setLedgerDrawerSupplier(null)}
                className="text-gray-400 hover:text-gray-700 font-bold p-1 rounded-xl hover:bg-gray-100 transition-colors"
                title="Close Ledger"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Ledger Totals Summary */}
            {(() => {
              const totals = dbSupplierLedger.getTotals(ledgerDrawerSupplier);
              const totalDebits = Number(totals?.totalDebits) || 0;
              const totalCredits = Number(totals?.totalCredits) || 0;
              const balance = Number(totals?.balance) || 0;
              return (
                <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 border-b border-gray-100">
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl text-center">
                    <div className="text-[10px] font-bold text-rose-700 uppercase">Total Debit</div>
                    <div className="font-black text-rose-900 text-sm">Rs. {totalDebits.toLocaleString()}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-center">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Total Paid</div>
                    <div className="font-black text-emerald-900 text-sm">Rs. {totalCredits.toLocaleString()}</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-center">
                    <div className="text-[10px] font-bold text-amber-700 uppercase">Balance Due</div>
                    <div className="font-black text-amber-900 text-sm">Rs. {balance.toLocaleString()}</div>
                  </div>
                </div>
              );
            })()}

            {/* Transactions List */}
            <div className="flex-1 p-4 space-y-2.5 overflow-y-auto">
              {(!supplierLedgerTxns || supplierLedgerTxns.length === 0) ? (
                <div className="text-center py-16 text-gray-400 space-y-2">
                  <span className="material-symbols-outlined text-5xl block text-gray-300">receipt_long</span>
                  <div className="font-bold text-xs">No ledger transactions yet for this supplier.</div>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                    New Purchase GRN bills and recorded payments will automatically appear here.
                  </p>
                </div>
              ) : (
                supplierLedgerTxns.slice().reverse().map((tx, idx) => {
                  const debit = Number(tx.debit) || 0;
                  const credit = Number(tx.credit) || 0;
                  const runningBalance = Number(tx.running_balance) || 0;
                  const isDebit = debit > 0;
                  const typeLabels = {
                    PURCHASE_BILL: "Purchase Bill",
                    CASH_PAYMENT: "Cash Payment",
                    CHEQUE_PAYMENT: "Cheque Payment",
                    BANK_PAYMENT: "Bank Transfer",
                    RETURN_CLAIM: "Return / Credit Claim",
                    ADVANCE: "Advance Payment",
                  };
                  let dateStr = "N/A";
                  if (tx.created_at) {
                    try {
                      const d = new Date(tx.created_at);
                      dateStr = isNaN(d.getTime()) ? String(tx.created_at).split("T")[0] : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
                    } catch {
                      dateStr = String(tx.created_at).split("T")[0] || "N/A";
                    }
                  }
                  return (
                    <div key={tx.id || `ledger_tx_${idx}`} className={`p-3.5 rounded-2xl border ${isDebit ? "bg-rose-50/60 border-rose-200" : "bg-emerald-50/60 border-emerald-200"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`text-xs font-black ${isDebit ? "text-rose-900" : "text-emerald-900"}`}>
                            {typeLabels[tx.type] || tx.type || "Transaction"}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{dateStr}</div>
                          {tx.notes && <div className="text-[10px] text-gray-600 mt-0.5 italic">{tx.notes}</div>}
                          {tx.invoice_no && <div className="text-[10px] font-mono text-gray-500 font-bold">Ref: {tx.invoice_no}</div>}
                        </div>
                        <div className="text-right">
                          <div className={`font-black text-sm ${isDebit ? "text-rose-800" : "text-emerald-700"}`}>
                            {isDebit ? "+" : "-"} Rs. {(isDebit ? debit : credit).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-gray-500 font-medium">Balance: Rs. {runningBalance.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Pay Button */}
            {(() => {
              const due = Number(ledgerDrawerSupplier.current_balance ?? ledgerDrawerSupplier.balance_due ?? ledgerDrawerSupplier.balance ?? 0);
              if (due <= 0) return null;
              return (
                <div className="p-4 border-t border-gray-100 bg-white sticky bottom-0">
                  <button
                    type="button"
                    onClick={() => {
                      setLedgerDrawerSupplier(null);
                      setPaySupplierModal(ledgerDrawerSupplier);
                      setPayAmountInput(String(due || ""));
                      setPaymentMode("cash");
                      setPaymentRef("");
                      setPaymentNote("");
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">payments</span>
                    <span>Record New Payment (Rs. {due.toLocaleString()} due)</span>
                  </button>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* Purchase GRN List Modal */}
      {showGRNListModal && createPortal(
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-emerald-200 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl">receipt_long</span>
                <div>
                  <h3 className="font-black text-base md:text-lg">Purchase GRN _List</h3>
                  <p className="text-[11px] text-emerald-200">Historical Inward Goods Received Notes &amp; Vouchers</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => dbPurchases.exportCSV(purchases)}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Export CSV
                </button>
                <button
                  onClick={() => setShowGRNListModal(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            {/* Filter Search Bar */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-3 items-center justify-between">
              <input
                type="text"
                value={grnListSearch}
                onChange={(e) => setGrnListSearch(e.target.value)}
                placeholder="Search by Voucher # (P-1001), Supplier, or GRN #..."
                className="flex-1 min-w-[240px] bg-white border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-bold focus:border-emerald-500"
              />
              <div className="text-xs text-gray-500 font-bold">
                Total GRN Records: <span className="text-emerald-700 font-black">{purchases.length}</span>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Voucher #</th>
                    <th className="px-3 py-2.5">GRN #</th>
                    <th className="px-3 py-2.5">Supplier Name</th>
                    <th className="px-3 py-2.5">Transport</th>
                    <th className="px-3 py-2.5">Bilty #</th>
                    <th className="px-3 py-2.5 text-center">Items</th>
                    <th className="px-3 py-2.5 text-right">Total Bill</th>
                    <th className="px-3 py-2.5 text-right">Balance Due</th>
                    <th className="px-3 py-2.5 text-center">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {purchases
                    .filter((p) => {
                      if (!grnListSearch.trim()) return true;
                      const q = grnListSearch.toLowerCase();
                      return (
                        (p.invoice_no || p.voucher_no || "").toLowerCase().includes(q) ||
                        (p.supplier_name || "").toLowerCase().includes(q) ||
                        (p.grn_no || "").toLowerCase().includes(q)
                      );
                    })
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-emerald-50/30">
                        <td className="px-3 py-2.5 text-gray-500 font-mono">
                          {(p.purchase_date || "").split("T")[0]}
                        </td>
                        <td className="px-3 py-2.5 font-black text-emerald-800">{p.invoice_no || p.voucher_no}</td>
                        <td className="px-3 py-2.5 font-bold text-gray-700">{p.grn_no || "0"}</td>
                        <td className="px-3 py-2.5 font-bold text-gray-900">{p.supplier_name}</td>
                        <td className="px-3 py-2.5 text-gray-600">{p.transport || "By Hand"}</td>
                        <td className="px-3 py-2.5 text-gray-600 font-mono">{p.bilty_no || "-"}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-teal-700">{(p.items || []).length}</td>
                        <td className="px-3 py-2.5 text-right font-black text-gray-900">
                          Rs. {Number(p.total_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-rose-700">
                          Rs. {Number(p.balance_due || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => printPurchaseGRNReceipt(p, dbClinic.get())}
                            className="bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 p-1.5 rounded-lg text-xs font-bold transition-colors"
                            title="Print 80mm GRN Voucher"
                          >
                            <span className="material-symbols-outlined text-sm">print</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowGRNListModal(false)}
                className="bg-gray-800 text-white px-5 py-2 rounded-xl font-bold text-xs hover:bg-gray-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: Quick Add New Product */}
      {showQuickAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateQuickProduct} className="bg-white max-w-md w-full rounded-3xl p-5 border border-emerald-300 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">add_box</span>
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-sm">Add New Product to Inventory</h3>
                  <p className="text-[10px] text-gray-500">Quickly register newly launched medicine or item</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddProductModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-semibold">
              {/* Product Name */}
              <div>
                <label className="block text-slate-800 font-black mb-1">Product / Medicine Name *</label>
                <input
                  type="text"
                  value={newProdForm.medicine_name}
                  onChange={(e) => setNewProdForm({ ...newProdForm, medicine_name: e.target.value })}
                  placeholder="e.g. Uronal Drops, 15 Ghr 20ml..."
                  className="w-full border border-emerald-400 rounded-xl px-3 py-2 text-xs font-bold text-slate-950 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  required
                  autoFocus
                />
              </div>

              {/* Description / Formulation (Optional) */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                  <span>Description / Usage (Optional)</span>
                  <span className="text-[9.5px] text-slate-400 font-normal">Editable Anytime</span>
                </label>
                <input
                  type="text"
                  value={newProdForm.product_description || ""}
                  onChange={(e) => setNewProdForm({ ...newProdForm, product_description: e.target.value })}
                  placeholder="e.g. Homeopathic Drops 20ml, For Fever &amp; Pain..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-500"
                />
              </div>

              {/* Company Code / Brand Dropdown & Category */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Company / Brand *</label>
                  <select
                    value={newProdForm.company_name}
                    onChange={(e) => setNewProdForm({ ...newProdForm, company_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-emerald-500"
                  >
                    {allCompanyOptions.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.code || "GEN"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Category</label>
                  <select
                    value={newProdForm.category}
                    onChange={(e) => setNewProdForm({ ...newProdForm, category: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-emerald-500"
                  >
                    <option value="Homeopathic Medicine">Homeopathic Medicine</option>
                    <option value="Homeopathic Drops">Homeopathic Drops</option>
                    <option value="Drops">Liquid Drops</option>
                    <option value="Specialized Drops">Specialized German Drops</option>
                    <option value="Tablet">Tablets</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Cream">Cream / Ointment</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Powder">Powder</option>
                    <option value="Allopathic OTC">Allopathic OTC</option>
                  </select>
                </div>
              </div>

              {/* Packing Unit, Net Price & Rate (Retail Price) */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Packing Unit</label>
                  <input
                    type="text"
                    value={newProdForm.unit_label}
                    onChange={(e) => setNewProdForm({ ...newProdForm, unit_label: e.target.value })}
                    placeholder="Pack / Box / 20ml Drop"
                    className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Net Price (Paid)</label>
                  <input
                    type="number"
                    value={newProdForm.cost_price}
                    onChange={(e) => setNewProdForm({ ...newProdForm, cost_price: e.target.value })}
                    placeholder="Rs. Net"
                    className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Rate (Retail Price)</label>
                  <input
                    type="number"
                    value={newProdForm.unit_sale_price}
                    onChange={(e) => setNewProdForm({ ...newProdForm, unit_sale_price: e.target.value })}
                    placeholder="Rs. Rate / MRP"
                    className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQuickAddProductModal(false)}
                className="flex-1 bg-slate-100 text-slate-700 font-bold py-2 rounded-xl text-xs hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-2 rounded-xl text-xs shadow-2xs flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Save &amp; Select Product
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

