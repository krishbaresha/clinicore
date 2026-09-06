import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { dbSuppliers, dbPurchases, dbInventory, dbClinic, dbSupplierLedger, dbAccounts, dbGrnMetadata, dbWarehouses, dbCompanies } from "../api/db.js";
import { verifyAdminPasscode } from "../api/auth.js";
import { useAuth } from "../hooks/useAuth.js";
import { printSupplierPurchaseReceipt, printPurchaseGRNReceipt } from "../utils/thermalPrinter.js";

/**
 * Expandable Combobox with built-in instant search and tall scrollable dropdown (DrCreate / MS Access Style)
 * Uses React Portal so the dropdown escapes any parent overflow:hidden clipping.
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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 200 });
  const triggerRef = useRef(null);
  const portalRef = useRef(null);
  const listContainerRef = useRef(null);

  // Calculate dropdown position relative to trigger button
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropHeight = 288; // ~max-h-72
    const openUpward = spaceBelow < dropHeight && rect.top > dropHeight;
    setDropdownPos({
      top: openUpward ? rect.top - dropHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      openUpward,
    });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        portalRef.current && !portalRef.current.contains(e.target)
      ) {
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
    <div ref={triggerRef} className={`relative ${className}`}>
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

      {/* Portal Dropdown — escapes all overflow containers */}
      {isOpen && createPortal(
        <div
          ref={portalRef}
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: Math.max(dropdownPos.width, 280),
            zIndex: 99999,
          }}
          className="bg-white rounded-2xl border border-emerald-300 shadow-2xl overflow-hidden flex flex-col max-h-72"
        >
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
          <div ref={listContainerRef} className="overflow-y-auto flex-1 p-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs font-semibold">
                No matches found{search ? ` for "${search}"` : ""}
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
                      <span className="material-symbols-outlined text-sm flex-shrink-0">check</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
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
    const invCompCode = (inv.company_code || "").toLowerCase().trim();

    // 1. Direct equality, company code or substring
    if (invCompCode && (invCompCode === raw || raw.includes(invCompCode) || cleanName.includes(invCompCode))) return true;
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
  const [activeTab, setActiveTab] = useState("grn_form"); // "grn_form" | "suppliers" | "bills"
  const [accountSelectorMode, setAccountSelectorMode] = useState("company"); // "company" | "supplier"

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
    disc_pct: "0",
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

  const handleSwitchAccountMode = (mode) => {
    if (mode === accountSelectorMode) return;
    setAccountSelectorMode(mode);
    setGrnForm((prev) => ({
      ...prev,
      account_name: "",
    }));
    setGrnSupplierCode("");
  };

  // 1. Memoized Pharma Companies Options
  const companyOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    // From dbCompanies
    const dynamicCompanies = dbCompanies ? dbCompanies.getAll() : [];
    dynamicCompanies.forEach((d) => {
      const name = (d?.name || "").trim();
      if (!name || seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      const code = (d.code || name.substring(0, 3)).toUpperCase();
      const city = d.city || "";
      const due = Number(d.balance_due || d.current_balance || 0);
      list.push({
        id: name,
        label: name,
        code: code,
        supplier_code: code,
        city: city,
        sublabel: `${code ? `[Code: ${code}] ` : ""}${city ? `${city} • ` : ""}Pharma Company / Brand${due > 0 ? ` • Due: Rs. ${due.toLocaleString()}` : ""}`,
        badge: `🏢 ${code}`,
        raw: d,
        type: "company",
        balance_due: due,
      });
    });

    // Unique Manufacturers from Inventory
    (inventoryList || []).forEach((inv) => {
      const comp = (inv.company_name || "").trim();
      if (!comp || seen.has(comp.toLowerCase())) return;
      seen.add(comp.toLowerCase());
      const code = (inv.company_code || inv.item_code?.split("-")[0] || comp.substring(0, 3)).toUpperCase();
      list.push({
        id: comp,
        label: comp,
        code: code,
        supplier_code: code,
        city: "",
        sublabel: `${code ? `[Code: ${code}] ` : ""}Inventory Brand / Manufacturer`,
        badge: `🏢 ${code}`,
        raw: inv,
        type: "company",
        balance_due: 0,
      });
    });

    // Standard major brands
    const defaultMajorBrands = [
      { name: "BM Pvt LTD", code: "BM", city: "Lahore" },
      { name: "Paul Brooks Homoeo Lab", code: "PB", city: "Karachi" },
      { name: "GHR Homoeo Pharma", code: "GHR", city: "Lahore" },
      { name: "Schwabe Germany", code: "SCH", city: "Germany / Karachi" },
      { name: "MEKTUM Homeo Pharma", code: "MKT", city: "Lahore" },
      { name: "BLOSSOM Homeo Lab", code: "BLS", city: "Lahore" },
      { name: "Dr. Reckeweg Germany", code: "REC", city: "Germany / Lahore" },
      { name: "Lehning France", code: "LEH", city: "France" },
      { name: "Kent Homeopathic", code: "KNT", city: "Karachi" },
      { name: "SBL Homeo", code: "SBL", city: "Karachi" },
    ];
    defaultMajorBrands.forEach((b) => {
      if (!seen.has(b.name.toLowerCase())) {
        seen.add(b.name.toLowerCase());
        list.push({
          id: b.name,
          label: b.name,
          code: b.code,
          supplier_code: b.code,
          city: b.city,
          sublabel: `[Code: ${b.code}] ${b.city} • Pharma Company`,
          badge: `🏢 ${b.code}`,
          raw: b,
          type: "company",
          balance_due: 0,
        });
      }
    });

    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [inventoryList]);

  // 2. Memoized Suppliers / Vendors Options
  const supplierOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    // From dbSuppliers
    (suppliers || []).forEach((s) => {
      const name = (s?.name || "").trim();
      if (!name || seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      const code = s.supplier_code || s.code || "";
      const city = s.city || "";
      const due = Number(s.balance_due ?? s.current_balance ?? 0);
      list.push({
        id: name,
        label: name,
        code: code,
        supplier_code: code,
        city: city,
        sublabel: `${code ? `[#${code}] ` : ""}${city ? `${city} • ` : ""}${s.contact_person || "Supplier"}${due > 0 ? ` • Udhaar: Rs. ${due.toLocaleString()}` : ""}`,
        badge: code ? `🚚 #${code}` : "🚚 Supplier",
        raw: s,
        type: "supplier",
        balance_due: due,
      });
    });

    // From Chart of Accounts (accountsList)
    (accountsList || []).forEach((a) => {
      const name = (a?.account_name || a?.name || "").trim();
      if (!name || seen.has(name.toLowerCase())) return;
      const type = (a.account_type || a.type || "").toLowerCase();
      const isSupplierAccount = type.includes("supplier") || type.includes("vendor") || type.includes("payable") || type.includes("creditor") || a.account_no;
      if (!isSupplierAccount) return;
      seen.add(name.toLowerCase());
      const code = a.account_no ? String(a.account_no) : (a.code || "");
      const city = a.city || "";
      const due = Number(a.balance_due ?? a.current_balance ?? 0);
      list.push({
        id: name,
        label: name,
        code: code,
        supplier_code: code,
        city: city,
        sublabel: `${code ? `[#${code}] ` : ""}${city ? `${city} • ` : ""}${a.naration || a.contact_person || a.account_type || "Vendor Account"}${due > 0 ? ` • Udhaar: Rs. ${due.toLocaleString()}` : ""}`,
        badge: code ? `🚚 #${code}` : `🚚 ${a.account_type || "Vendor"}`,
        raw: a,
        type: "supplier",
        balance_due: due,
      });
    });

    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [suppliers, accountsList]);

  // Dynamically Active Options based on Mode Slider
  const activeAccountOptions = useMemo(() => {
    return accountSelectorMode === "company" ? companyOptions : supplierOptions;
  }, [accountSelectorMode, companyOptions, supplierOptions]);

  // Selected Entity Specific Credit Due
  const selectedAccountDue = useMemo(() => {
    if (!grnForm.account_name) return null;
    const sLower = grnForm.account_name.toLowerCase().trim();

    const supMatch = supplierOptions.find((s) => s.label.toLowerCase().trim() === sLower);
    if (supMatch && supMatch.balance_due !== undefined) return supMatch.balance_due;

    const compMatch = companyOptions.find((c) => c.label.toLowerCase().trim() === sLower);
    if (compMatch && compMatch.balance_due !== undefined) return compMatch.balance_due;

    const directSup = suppliers.find((s) => (s.name || "").toLowerCase().trim() === sLower);
    if (directSup) return Number(directSup.balance_due ?? directSup.current_balance ?? 0);

    const directAcc = accountsList.find((a) => (a.account_name || a.name || "").toLowerCase().trim() === sLower);
    if (directAcc) return Number(directAcc.balance_due ?? directAcc.current_balance ?? 0);

    return 0;
  }, [grnForm.account_name, supplierOptions, companyOptions, suppliers, accountsList]);

  const handleSupplierCodeChange = (code) => {
    setGrnSupplierCode(code);
    if (!code || !code.trim()) {
      setGrnForm((prev) => ({ ...prev, account_name: "" }));
      return;
    }
    const clean = code.trim().toLowerCase();

    // 1. Check in currently active mode list
    const activeList = accountSelectorMode === "company" ? companyOptions : supplierOptions;
    const match = activeList.find((item) => {
      const c = (item.code || "").toLowerCase();
      const l = (item.label || "").toLowerCase();
      return c === clean || c.startsWith(clean) || l === clean || l.startsWith(clean);
    });

    if (match) {
      setGrnForm((prev) => ({
        ...prev,
        account_name: match.label,
        reference: match.raw?.contact_person || prev.reference,
      }));
      return;
    }

    // 2. Cross-mode auto-switch: If user typed code that exists in the other mode
    const altMode = accountSelectorMode === "company" ? "supplier" : "company";
    const altList = accountSelectorMode === "company" ? supplierOptions : companyOptions;
    const altMatch = altList.find((item) => {
      const c = (item.code || "").toLowerCase();
      const l = (item.label || "").toLowerCase();
      return c === clean || c.startsWith(clean) || l === clean || l.startsWith(clean);
    });

    if (altMatch) {
      setAccountSelectorMode(altMode);
      setGrnForm((prev) => ({
        ...prev,
        account_name: altMatch.label,
        reference: altMatch.raw?.contact_person || prev.reference,
      }));
    }
  };

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
      badge: inv.item_code ? `${inv.company_code ? `${inv.company_code} • ` : ""}${inv.item_code}` : (inv.company_name || inv.category || "MED"),
      raw: inv,
    }));
  }, [filteredGrnInventory]);

  useEffect(() => {
    refreshData();
    window.addEventListener("clinicflow_status_update", refreshData);
    return () => window.removeEventListener("clinicflow_status_update", refreshData);
  }, []);

  // F9 Keyboard Shortcut Listener for Purchase GRN Save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F9" && activeTab === "grn_form") {
        e.preventDefault();
        handleSaveGRNBill();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, grnItems, grnForm, suppliers]);

  const grnTotalPaidQty = useMemo(() => grnItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0), [grnItems]);
  const grnTotalBonusQty = useMemo(() => grnItems.reduce((sum, it) => sum + (Number(it.bonus_qty) || 0), 0), [grnItems]);
  const grnTotalGross = useMemo(() => grnItems.reduce((sum, it) => sum + (Number(it.gross) || (Number(it.qty) * Number(it.rate)) || 0), 0), [grnItems]);
  const grnTotalNet = useMemo(() => grnItems.reduce((sum, it) => sum + (Number(it.net) || 0), 0), [grnItems]);
  const grnTotalDiscount = useMemo(() => Math.max(0, grnTotalGross - grnTotalNet), [grnTotalGross, grnTotalNet]);
  const grnExtraDiscount = Number(grnForm.extra_bill_discount) || 0;
  const grnFreight = Number(grnForm.freight_charges) || 0;
  const grnNetPayable = useMemo(() => Math.max(0, grnTotalNet - grnExtraDiscount + grnFreight), [grnTotalNet, grnExtraDiscount, grnFreight]);

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

    if (matched.length > 0) {
      const selectedInv = matched[0];
      // Auto-populate Company Name & Company Code if present
      if (selectedInv.company_name) {
        setGrnForm((prev) => ({
          ...prev,
          account_name: selectedInv.company_name,
        }));
        if (selectedInv.company_code) {
          setGrnSupplierCode(selectedInv.company_code);
        }
      }
      if (matched.length > 1) {
        setGrnShowAllCompanies(true);
      }
      handleSelectGRNMedicine(selectedInv.id);
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
        disc_pct: "0",
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
      disc_pct: grnCart.disc_pct === "" || grnCart.disc_pct === undefined ? "0" : String(grnCart.disc_pct),
      disc_flat: grnCart.disc_flat || "0",
      net_amount: String(net),
    });

    if (inv.company_name && !grnForm.account_name) {
      setGrnForm((prev) => ({
        ...prev,
        account_name: inv.company_name,
      }));
      if (inv.company_code) {
        setGrnSupplierCode(inv.company_code);
      }
    }

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
      disc_pct: "0",
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
    const isCredit = grnForm.payment_mode === "Credit";
    const paidAmount = isCredit ? 0 : totalBill;
    const sLower = grnForm.account_name.toLowerCase().trim();
    const matchedSup = suppliers.find((s) => s.name.toLowerCase().trim() === sLower);
    const matchedAcc = accountsList.find((a) => (a.account_name || a.name || "").toLowerCase().trim() === sLower);
    const matchedComp = (dbCompanies ? dbCompanies.getAll() : []).find((c) => (c.name || "").toLowerCase().trim() === sLower);
    const resolvedCity = matchedSup?.city || matchedAcc?.city || matchedComp?.city || (
      sLower.includes("schwabe") ? "Germany / Karachi" :
      sLower.includes("paul") ? "Karachi" :
      sLower.includes("bm") || sLower.includes("ghr") || sLower.includes("mektum") ? "Lahore" : ""
    );

    const targetWarehouseId = user?.assigned_warehouse_id || "wh_001";
    const savedPur = dbPurchases.add({
      invoice_no: grnForm.voucher_no || dbPurchases.getNextVoucherNo(),
      supplier_name: grnForm.account_name,
      supplier_id: matchedSup ? matchedSup.id : undefined,
      supplier_code: grnSupplierCode || (matchedSup ? matchedSup.supplier_code : undefined),
      city: resolvedCity,
      supplier_city: resolvedCity,
      warehouse_id: targetWarehouseId,
      grn_no: grnForm.grn_no || "0",
      reference: grnForm.reference || "",
      transport: grnForm.transport || "By Hand",
      bilty_no: grnForm.bilty_no || "",
      payment_mode: grnForm.payment_mode || (isCredit ? "Credit" : "Cash"),
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

    // Reset Form completely for next entry - PREVENTS STALE COMPANY DATA BUG
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
      disc_pct: "0",
      disc_flat: "0",
      net_amount: "",
    });
    setGrnSupplierCode("");
    setGrnForm((prev) => ({
      ...prev,
      voucher_no: dbPurchases.getNextVoucherNo(),
      grn_no: "0",
      account_name: "",
      reference: "",
      bilty_no: "",
      extra_bill_discount: "0",
      freight_charges: "0",
    }));
    refreshData();
    setInventoryList(dbInventory.getAll());
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clinicflow_status_update"));
    }
    alert(`✅ Purchase Invoice ${savedPur.invoice_no} (Co Bill #${savedPur.grn_no}) saved successfully!\n${isCredit ? `📋 Mode: Credit (Udhar) — Rs. ${savedPur.balance_due.toLocaleString()} added to Supplier Payable` : `💵 Mode: Cash Paid — Rs. ${savedPur.paid_amount.toLocaleString()}`}`);
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
      {/* Sub-Navigation Tabs Strip */}
      <div className="bg-white border-b border-slate-200 px-3 md:px-4 pt-1.5 flex items-center justify-between shrink-0 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("grn_form")}
            className={`flex items-center space-x-1.5 pb-2 px-2 sm:px-3 border-b-2 font-semibold text-xs transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "grn_form"
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <svg className="w-3.5 h-3.5 text-teal-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span>Company Purchase Invoice Entry</span>
            <span className="bg-teal-700 text-white text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">{grnForm.voucher_no}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("suppliers")}
            className={`flex items-center space-x-1.5 pb-2 px-2 sm:px-3 border-b-2 font-medium text-xs transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "suppliers"
                ? "border-teal-700 text-teal-800 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span className="hidden sm:inline">Pharma Companies &amp; Suppliers Directory</span>
            <span className="sm:hidden">Suppliers</span>
            <span className="text-slate-400 text-[10px]">({suppliers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bills")}
            className={`hidden md:flex items-center space-x-1.5 pb-2 px-3 border-b-2 font-medium text-xs transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "bills"
                ? "border-teal-700 text-teal-800 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M4 6h16M4 10h16M4 14h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span>All Purchase Bills Log</span>
            <span className="text-slate-400 text-[10px]">({purchases.length})</span>
          </button>
        </div>
        <div className="hidden sm:flex items-center space-x-2 pb-1.5 text-xs">
          {grnForm.account_name ? (
            <span className="text-rose-700 font-semibold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 text-[11px] flex items-center space-x-1.5 shadow-2xs">
              <span className="text-slate-600 font-medium truncate max-w-[140px]">{grnForm.account_name}:</span>
              <span className="text-rose-600 font-bold uppercase text-[10px]">CREDIT DUE:</span>
              <span className="font-bold font-mono text-rose-800 text-xs">
                Rs. {Number(selectedAccountDue || 0).toLocaleString()}
              </span>
            </span>
          ) : (
            <span className="text-slate-600 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] flex items-center space-x-1.5 shadow-2xs">
              <span className="text-slate-500 uppercase text-[10px]">TOTAL PAYABLES:</span>
              <span className="font-bold font-mono text-slate-800 text-xs">
                Rs. {totalSupplierPayables.toLocaleString()}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* TAB 0: CliniCore v3.4 Minimal Company Purchase GRN Invoice Entry */}
      {activeTab === "grn_form" && (
        <div className="flex-1 flex flex-col min-h-0 gap-2 overflow-hidden animate-fade-in">
          {/* Compact Inward Title Header */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight">Company Purchase Invoice</h1>
                  <span className="text-[10px] font-mono font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">Stock Inward</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium hidden sm:block">Record incoming supplier bill and update inventory automatically</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowGRNListModal(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6h16M4 10h16M4 14h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                <span className="hidden sm:inline">Invoices List</span>
                <span className="sm:hidden">List</span>
              </button>
            </div>
          </div>

          {/* Compact Unified Container: Info + Add Line + Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* SECTION 1: Company & Invoice Info */}
            <div className="p-2 sm:p-2.5 xl:p-2.5 border-b border-slate-200 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-1 border-b border-slate-100">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Company &amp; Invoice Info</h2>
                </div>

                {/* Dynamic Accounts / Companies Slider Switcher */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleSwitchAccountMode("company")}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      accountSelectorMode === "company"
                        ? "bg-teal-700 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 bg-transparent"
                    }`}
                  >
                    <span>🏢 Pharma Companies</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      accountSelectorMode === "company" ? "bg-teal-800 text-teal-100" : "bg-slate-200 text-slate-600"
                    }`}>
                      {companyOptions.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchAccountMode("supplier")}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      accountSelectorMode === "supplier"
                        ? "bg-teal-700 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 bg-transparent"
                    }`}
                  >
                    <span>🚚 Suppliers / Vendors</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      accountSelectorMode === "supplier" ? "bg-teal-800 text-teal-100" : "bg-slate-200 text-slate-600"
                    }`}>
                      {supplierOptions.length}
                    </span>
                  </button>
                </div>

                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">Tab / Enter to advance</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2 text-xs">
                {/* Date */}
                <div className="col-span-1 sm:col-span-1 xl:col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Date</label>
                  <input
                    type="text"
                    value={grnForm.date}
                    onChange={(e) => setGrnForm({ ...grnForm, date: e.target.value })}
                    className="w-full h-8 text-xs border border-slate-300 rounded-lg px-2 focus:border-teal-600 bg-white font-medium text-slate-800"
                  />
                </div>
                {/* System Entry # */}
                <div className="col-span-1 sm:col-span-1 xl:col-span-1">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Entry #</label>
                  <input
                    type="text"
                    value={grnForm.voucher_no}
                    readOnly
                    className="w-full h-8 text-xs border border-slate-200 bg-slate-50 rounded-lg px-1.5 text-center font-bold font-mono text-teal-800"
                  />
                </div>
                {/* Co Invoice / Bill # */}
                <div className="col-span-1 sm:col-span-2 xl:col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Bill / Inv # <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={grnForm.grn_no}
                    onChange={(e) => setGrnForm({ ...grnForm, grn_no: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        grnProductInputRef.current?.focus();
                      }
                    }}
                    placeholder="Inv No."
                    className="w-full h-8 text-xs border border-slate-300 rounded-lg px-2 font-medium text-slate-800 focus:border-teal-600"
                  />
                </div>
                {/* Bilty / Tracking # */}
                <div className="col-span-1 sm:col-span-2 xl:col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Bilty / Tracking #</label>
                  <input
                    type="text"
                    value={grnForm.bilty_no}
                    onChange={(e) => setGrnForm({ ...grnForm, bilty_no: e.target.value })}
                    placeholder="e.g. BL-4209"
                    className="w-full h-8 text-xs border border-slate-300 rounded-lg px-2 font-mono font-medium text-slate-800 focus:border-teal-600"
                  />
                </div>
                {/* Company / Supplier Code */}
                <div className="col-span-1 sm:col-span-2 xl:col-span-1">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5 truncate">
                    {accountSelectorMode === "company" ? "Company Code" : "Supplier Code"}
                  </label>
                  <input
                    type="text"
                    value={grnSupplierCode}
                    onChange={(e) => handleSupplierCodeChange(e.target.value)}
                    placeholder={accountSelectorMode === "company" ? "GHR" : "#1"}
                    className="w-full h-8 text-xs border border-slate-300 rounded-lg px-1.5 font-mono uppercase text-slate-700 font-medium focus:border-teal-600 bg-white"
                  />
                </div>
                {/* Company / Supplier Select */}
                <div className="col-span-2 sm:col-span-2 xl:col-span-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[10px] font-semibold text-slate-600">
                      {accountSelectorMode === "company" ? "Pharma Company" : "Supplier / Vendor"} <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddSupplier(true)}
                      className="text-[9px] text-teal-700 font-bold hover:underline"
                    >
                      + New
                    </button>
                  </div>
                  <ExpandableCombobox
                    value={grnForm.account_name}
                    onChange={(val, opt) => {
                      setGrnForm({
                        ...grnForm,
                        account_name: val,
                        reference: opt?.raw?.contact_person || grnForm.reference,
                      });
                      if (opt?.code || opt?.supplier_code) {
                        setGrnSupplierCode(opt.code || opt.supplier_code);
                      } else {
                        setGrnSupplierCode("");
                      }
                    }}
                    options={activeAccountOptions}
                    placeholder={accountSelectorMode === "company" ? "Select Pharma Company..." : "Select Supplier / Vendor..."}
                    searchPlaceholder={accountSelectorMode === "company" ? "Search Companies..." : "Search Suppliers..."}
                    required={true}
                  />
                </div>
                {/* Payment Mode */}
                <div className="col-span-2 sm:col-span-2 xl:col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Payment Mode</label>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-center">
                    <button
                      type="button"
                      onClick={() => setGrnForm({ ...grnForm, payment_mode: "Cash" })}
                      className={`py-1 px-1 rounded-md font-bold text-[10px] shadow-2xs truncate transition-all ${
                        grnForm.payment_mode === "Cash"
                          ? "bg-teal-700 text-white"
                          : "text-slate-600 hover:text-slate-900 bg-transparent"
                      }`}
                    >
                      Cash Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setGrnForm({ ...grnForm, payment_mode: "Credit" })}
                      className={`py-1 px-1 rounded-md font-bold text-[10px] truncate transition-all ${
                        grnForm.payment_mode === "Credit"
                          ? "bg-rose-700 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900 bg-transparent"
                      }`}
                    >
                      Credit (Udhar)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Fast Line Item Entry */}
            <div className="p-2 sm:p-2.5 xl:p-2.5 border-b border-slate-200 bg-slate-50/50 shrink-0">
              <div className="flex items-center justify-between pb-1.5">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Add Line Item</h2>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickAddProductModal(true)}
                    className="text-[10px] font-bold text-teal-700 hover:underline"
                  >
                    + Add New Product
                  </button>
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">Press Enter to Add</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-12 gap-2 text-xs items-end">
                {/* Item Code */}
                <div className="col-span-1 xl:col-span-1">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Item Code</label>
                  <input
                    type="text"
                    value={grnCart.product_code}
                    onChange={(e) => setGrnCart({ ...grnCart, product_code: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleLookupGRNByCode(grnCart.product_code);
                      }
                    }}
                    placeholder="GHR-1"
                    className="w-full h-8 text-xs border border-slate-300 rounded-lg px-2 font-mono uppercase text-slate-700 focus:border-teal-600 bg-white"
                  />
                </div>
                {/* Product Name */}
                <div className="col-span-2 sm:col-span-3 md:col-span-3 xl:col-span-3">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[10px] font-semibold text-slate-600">Product Name <span className="text-rose-500">*</span></label>
                    <button
                      type="button"
                      onClick={() => setGrnShowAllCompanies(!grnShowAllCompanies)}
                      className="text-[9px] text-teal-700 font-bold hover:underline"
                    >
                      {grnShowAllCompanies ? `All (${inventoryList.length})` : `Filtered (${filteredGrnInventory.length})`}
                    </button>
                  </div>
                  <ExpandableCombobox
                    value={grnCart.inventory_id}
                    onChange={(val) => handleSelectGRNMedicine(val)}
                    options={productOptions}
                    placeholder="Search product..."
                    searchPlaceholder="Type medicine name..."
                    required={true}
                  />
                </div>
                {/* Batch # */}
                <div className="col-span-1 sm:col-span-1 md:col-span-1 xl:col-span-1">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Batch</label>
                  <input
                    ref={batchNoRef}
                    type="text"
                    value={grnCart.batch_no}
                    onChange={(e) => handleUpdateGRNCart("batch_no", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        expDateRef.current?.focus();
                      }
                    }}
                    placeholder="BAT-01"
                    className="w-full h-8 text-xs border border-slate-300 rounded-lg px-2 font-mono focus:border-teal-600 bg-white"
                  />
                </div>
                {/* Expiry */}
                <div className="col-span-1 sm:col-span-1 md:col-span-1 xl:col-span-1">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Exp Date</label>
                  <input
                    ref={expDateRef}
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
                    className="w-full h-8 text-xs border border-slate-300 rounded-lg px-2 font-mono focus:border-teal-600 bg-white"
                  />
                </div>
                {/* Qty */}
                <div className="col-span-1 sm:col-span-1 md:col-span-1 xl:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Qty</label>
                  <input
                    ref={qtyRef}
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
                    className="w-full h-8 text-xs border border-slate-300 rounded-lg px-2 text-center font-bold text-slate-800 focus:border-teal-600 bg-white"
                  />
                </div>
                {/* Bonus */}
                <div className="col-span-1 sm:col-span-1 md:col-span-1 xl:col-span-1">
                  <label className="block text-[10px] font-semibold text-amber-700 mb-0.5">Bonus</label>
                  <input
                    ref={bonusQtyRef}
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
                    className="w-full h-8 text-xs border border-amber-300 bg-amber-50/50 rounded-lg px-2 text-center font-semibold text-amber-800 focus:border-teal-600"
                  />
                </div>
                {/* Rate (TP) */}
                <div className="col-span-1 sm:col-span-1 md:col-span-1 xl:col-span-1">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Rate (TP)</label>
                  <input
                    ref={rateRef}
                    type="number"
                    step="0.01"
                    value={grnCart.rate}
                    onChange={(e) => handleUpdateGRNCart("rate", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        discPctRef.current?.focus();
                      }
                    }}
                    placeholder="0.00"
                    className="w-full h-8 text-xs border border-slate-300 rounded-lg px-2 font-medium text-slate-800 focus:border-teal-600 bg-white"
                  />
                </div>
                {/* Disc (%) */}
                <div className="col-span-1 sm:col-span-1 md:col-span-1 xl:col-span-1">
                  <label className="block text-[10px] font-semibold text-teal-700 mb-0.5">Disc (%)</label>
                  <input
                    ref={discPctRef}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={grnCart.disc_pct}
                    onChange={(e) => handleUpdateGRNCart("disc_pct", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBtnRef.current?.focus();
                      }
                    }}
                    placeholder="0"
                    className="w-full h-8 text-xs border border-teal-300 bg-teal-50/40 rounded-lg px-2 text-center font-bold text-teal-900 focus:border-teal-600"
                  />
                </div>
                {/* Total Preview */}
                <div className="col-span-1 sm:col-span-1 md:col-span-1 xl:col-span-1">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Total</label>
                  <div className="h-8 flex items-center justify-center bg-teal-50 border border-teal-200 rounded-lg text-teal-800 font-bold font-mono text-[11px] px-1 truncate">
                    Rs. {Number(grnCart.net_amount || grnCart.gross || 0).toLocaleString()}
                  </div>
                </div>
                {/* Add Button */}
                <div className="col-span-2 sm:col-span-2 md:col-span-1 xl:col-span-1">
                  <button
                    ref={addBtnRef}
                    type="button"
                    onClick={handleAddGRNItem}
                    className="w-full h-8 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold flex items-center justify-center space-x-1 transition-colors shadow-2xs cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 3: Inward Items Scrollable Table Area */}
            <div ref={grnTableContainerRef} className="flex-1 min-h-[140px] max-h-[420px] overflow-y-auto overflow-x-auto relative custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse min-w-[760px] xl:min-w-full">
                <thead className="bg-teal-700 text-white uppercase text-[10px] tracking-wider font-semibold sticky top-0 z-10 select-none shadow-xs">
                  <tr>
                    <th className="py-2 px-3">Item Name</th>
                    <th className="py-2 px-3">Batch #</th>
                    <th className="py-2 px-3">Exp Date</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 px-3 text-center">Bonus</th>
                    <th className="py-2 px-3 text-right">Rate (TP)</th>
                    <th className="py-2 px-3 text-right">Gross</th>
                    <th className="py-2 px-3 text-center">Disc (%)</th>
                    <th className="py-2 px-3 text-right">Net Amount</th>
                    <th className="py-2 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {grnItems.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-10 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <span className="text-xs font-semibold text-slate-600">No items in this purchase bill yet</span>
                          <span className="text-[11px] text-slate-400">Search and add products above to build invoice</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    grnItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-teal-50/40 transition-colors">
                        <td className="py-1.5 px-3">
                          <div className="font-bold text-slate-900 leading-tight">{item.medicine_name}</div>
                          <div className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span>{item.company_name || grnForm.account_name || "Pharma"}</span>
                            {item.company_code && (
                              <span className="font-mono text-[9.5px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                                Co: {item.company_code}
                              </span>
                            )}
                            {item.product_code && (
                              <span className="font-mono text-[9.5px] px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 font-bold border border-teal-200">
                                Item: {item.product_code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-3 font-mono text-[11px] text-slate-600">{item.batch_no || "—"}</td>
                        <td className="py-1.5 px-3 font-mono text-[11px]">{item.expiry_date || "—"}</td>
                        <td className="py-1.5 px-3 text-center">
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{item.qty}</span>
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          {Number(item.bonus_qty) > 0 ? (
                            <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                              +{item.bonus_qty}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">0</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono">Rs. {Number(item.rate).toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{Number(item.gross || (item.qty * item.rate)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td className="py-1.5 px-3 text-center">
                          {Number(item.disc_pct_num || parseInt(item.disc_pct) || 0) > 0 ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold text-[10px]">
                              {item.disc_pct}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-teal-800 font-mono">
                          Rs. {Number(item.net).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveGRNItem(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Row"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                  <tr ref={grnItemsEndRef}>
                    <td colSpan="10" className="p-0 border-0" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Fixed Bottom Settlement Dock */}
          <footer className="bg-white border border-slate-200 rounded-xl p-2 sm:p-2.5 shadow-md shrink-0 sticky bottom-0 z-20">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              {/* Left: Counters & Shortcut Cue */}
              <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start text-xs">
                <div className="text-slate-500 font-medium">
                  <span className="text-slate-400">Items:</span> <strong className="text-slate-800 font-mono">{grnItems.length}</strong>
                </div>
                <div className="h-3.5 w-[1px] bg-slate-200"></div>
                <div className="text-slate-500 font-medium">
                  <span className="text-slate-400">Total Qty:</span>{" "}
                  <strong className="text-slate-800 font-mono">
                    {grnTotalPaidQty} {grnTotalBonusQty > 0 ? `+ ${grnTotalBonusQty} Free` : ""}
                  </strong>
                </div>
                <span className="text-[10px] text-slate-400 hidden xl:inline font-mono">(Shortcut: F9 to Save)</span>
              </div>
              {/* Right: Gross, Discount, Net Payable, Action Button */}
              <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 w-full sm:w-auto">
                {/* Gross Total */}
                <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-slate-50 border border-slate-200 rounded-lg text-right">
                  <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-semibold leading-tight">Gross Total</span>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-700 font-mono leading-none">
                    Rs. {grnTotalGross.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {/* Discount */}
                <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-emerald-50/70 border border-emerald-200 rounded-lg text-right">
                  <span className="text-[8px] uppercase tracking-wider text-emerald-700 block font-semibold leading-tight">Discount</span>
                  <span className="text-[11px] sm:text-xs font-bold text-emerald-700 font-mono leading-none">
                    - Rs. {grnTotalDiscount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {/* NET PAYABLE / CREDIT DUE Highlight */}
                <div className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg text-right border-2 transition-colors ${
                  grnForm.payment_mode === "Credit"
                    ? "bg-rose-50 border-rose-600"
                    : "bg-teal-50 border-teal-600"
                }`}>
                  <span className={`text-[8px] uppercase tracking-wider block font-extrabold leading-tight ${
                    grnForm.payment_mode === "Credit" ? "text-rose-700" : "text-teal-700"
                  }`}>
                    {grnForm.payment_mode === "Credit" ? "Credit / Udhar Due" : "Net Payable (Cash)"}
                  </span>
                  <div className={`text-xs sm:text-sm font-extrabold font-mono leading-none ${
                    grnForm.payment_mode === "Credit" ? "text-rose-900" : "text-teal-900"
                  }`}>
                    Rs. {grnNetPayable.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={handleSaveGRNBill}
                  className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-2.5 text-white rounded-lg font-bold text-xs shadow-sm flex items-center justify-center space-x-1.5 transition-transform active:scale-95 whitespace-nowrap cursor-pointer ${
                    grnForm.payment_mode === "Credit"
                      ? "bg-rose-700 hover:bg-rose-800"
                      : "bg-teal-700 hover:bg-teal-800"
                  }`}
                >
                  <svg className="w-4 h-4 text-white/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  <span>
                    {grnForm.payment_mode === "Credit"
                      ? "Save Invoice (Credit) & Add to Stock (F9)"
                      : "Save Invoice & Add to Stock (F9)"}
                  </span>
                </button>
              </div>
            </div>
          </footer>
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

