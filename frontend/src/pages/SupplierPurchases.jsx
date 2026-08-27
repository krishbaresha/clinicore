import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { dbSuppliers, dbPurchases, dbInventory, dbClinic, dbSupplierLedger, dbAccounts, dbGrnMetadata } from "../api/db.js";
import { verifyAdminPasscode } from "../api/auth.js";
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

  const selectedOpt = options.find((o) => o.id === value || o.label === value);

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
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-emerald-300 shadow-2xl z-50 overflow-hidden animate-fade-in flex flex-col max-h-72">
          {/* Search Header */}
          <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-1.5 sticky top-0 z-10">
            <span className="material-symbols-outlined text-base text-emerald-700">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
          <div className="overflow-y-auto flex-1 p-1 space-y-0.5 max-h-60">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs font-semibold">
                No matches found for "{search}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value || opt.label === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.id, opt);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-emerald-600 text-white font-black"
                        : "hover:bg-emerald-50 text-gray-800 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.badge && (
                        <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black ${
                          isSelected ? "bg-emerald-800 text-white" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {opt.badge}
                        </span>
                      )}
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className={`text-[10px] font-medium truncate ${isSelected ? "text-emerald-200" : "text-gray-400"}`}>
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
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [activeTab, setActiveTab] = useState("suppliers"); // "suppliers" | "bills" | "new_purchase"

  // DrCreate Purchase GRN Form State
  const [grnShowAllCompanies, setGrnShowAllCompanies] = useState(false);
  const [tab4ShowAllCompanies, setTab4ShowAllCompanies] = useState(false);
  const [referencesList, setReferencesList] = useState([]);
  const [transportsList, setTransportsList] = useState([]);
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
    destination_type: "warehouse",
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
  const grnItemsEndRef = useRef(null);
  const grnTableContainerRef = useRef(null);


  // Selected Supplier Drawer / Modal
  const [selectedSupplierDrawer, setSelectedSupplierDrawer] = useState(null);
  const [supplierDrawerSearch, setSupplierDrawerSearch] = useState("");

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
    return list;
  }, [suppliers, accountsList]);

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

  // Dynamic Company-Filtered Inventory for Tab 1 (Purchase GRN _Form)
  const filteredGrnInventory = useMemo(() => {
    if (grnShowAllCompanies || !grnForm.account_name) return inventoryList;
    const matched = filterInventoryByCompanyOrSupplier(inventoryList, grnForm.account_name);
    return matched.length > 0 ? matched : inventoryList;
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


  // DrCreate Purchase GRN Form Handlers
  const handleSelectGRNMedicine = (invId) => {
    if (!invId) {
      setGrnCart((prev) => ({ ...prev, inventory_id: "", medicine_name: "", product_code: "", category: "", packing: "", batch_no: "", expiry_date: "", rate: "", gross: "", net_amount: "" }));
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
      rate: String(rate),
      gross: String(gross),
      disc_pct: grnCart.disc_pct || "40",
      disc_flat: grnCart.disc_flat || "0",
      net_amount: String(net),
    });
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
      category: grnCart.category || "Medicine",
      packing: grnCart.packing || "pack",
      batch_no: grnCart.batch_no.trim() || `BT-${Date.now().toString().slice(-4)}`,
      expiry_date: grnCart.expiry_date.trim() || "",
      qty: q,
      qty_base_units: q,
      rate: r,
      cost_price: r,
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

    const savedPur = dbPurchases.add({
      invoice_no: grnForm.voucher_no || dbPurchases.getNextVoucherNo(),
      supplier_name: grnForm.account_name,
      supplier_id: matchedSup ? matchedSup.id : undefined,
      grn_no: grnForm.grn_no || "0",
      reference: grnForm.reference || "",
      transport: grnForm.transport || "By Hand",
      bilty_no: grnForm.bilty_no || "",
      payment_mode: grnForm.payment_mode,
      destination_type: grnForm.destination_type || "warehouse",
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
    alert(`Purchase Invoice ${savedPur.invoice_no} (Co Bill #${savedPur.grn_no}) saved successfully & stock updated in Godown!`);
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

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 overflow-x-hidden">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-teal-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>
              domain
            </span>
            Pharma Companies &amp; Distributor Directory
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage Distributor Accounts, Stock Purchase Bills, Expiry Batches &amp; Payable Ledgers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-rose-50 border border-rose-200 px-4 py-2 rounded-2xl text-right shadow-sm">
            <div className="text-[11px] text-rose-700 font-bold uppercase tracking-wider">Total Company Credit Due</div>
            <div className="text-xl font-black text-rose-800">Rs. {totalSupplierPayables.toLocaleString()}</div>
          </div>
          <button
            onClick={() => setActiveTab("grn_form")}
            className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-4 py-2.5 rounded-2xl font-black text-xs hover:from-emerald-700 hover:to-teal-800 transition-all shadow-md shadow-emerald-200 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            Company Purchase Bill (کمپنی خریداری بل)
          </button>
          <button
            onClick={() => setShowAddSupplier(true)}
            className="bg-teal-600 text-white px-4 py-2.5 rounded-2xl font-bold text-xs hover:bg-teal-700 transition-colors shadow-md shadow-teal-200 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">add_business</span>
            Add Distributor Company
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("grn_form")}
          className={`pb-3 px-4 font-black text-xs transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "grn_form" ? "border-emerald-600 text-emerald-800" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-base text-emerald-600">receipt_long</span>
          Company Purchase Invoice Entry (کمپنی بل انٹری)
          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-black">
            {grnForm.voucher_no}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "suppliers" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-base">domain</span>
          Pharma Companies &amp; Suppliers ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab("bills")}
          className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "bills" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-base">receipt_long</span>
          All Purchase Bills &amp; Invoices Log ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab("new_purchase")}
          className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "new_purchase" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-base">add_shopping_cart</span>
          Detailed Multi-Item Purchase Entry
        </button>
      </div>

      {/* TAB 0: DrCreate & MS Access Purchase GRN Form */}
      {activeTab === "grn_form" && (
        <div className="space-y-6 animate-fade-in">
          {/* Visual Header Banner matching DrCreate */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 border border-emerald-500/30">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 text-white shadow-inner">
                <span className="material-symbols-outlined text-3xl">inventory_2</span>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-[11px] font-black uppercase tracking-wider mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                  Pharmacy / Godown Company Stock Inward
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                  Company Purchase Invoice Entry <span className="text-emerald-200 text-xl font-medium">(کمپنی خریداری بل)</span>
                </h2>
                <p className="text-xs text-emerald-100 mt-0.5 font-medium">
                  Enter Company Sale Invoices, Bill #, Changing Salesmen, Bilty Tracking &amp; Auto Godown Stock
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowGRNListModal(true)}
                className="bg-slate-900/80 hover:bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-black text-xs transition-all shadow-md flex items-center gap-1.5 border border-white/20"
              >
                <span className="material-symbols-outlined text-base">list_alt</span>
                Show Invoices List
              </button>
              <button
                type="button"
                onClick={handleSaveGRNBill}
                className="bg-white text-emerald-800 hover:bg-emerald-50 px-6 py-2.5 rounded-2xl font-black text-xs transition-all shadow-lg flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">save</span>
                Save Bill
              </button>
            </div>
          </div>

          {/* Form Container */}
          <div className="bg-white rounded-3xl border border-emerald-200/80 p-6 shadow-sm space-y-6">
            {/* Section 1: Basic Info */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 md:p-5">
              <div className="text-xs font-black text-emerald-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-emerald-700">receipt_long</span>
                Invoice Header &amp; Company Info (انوائس اور سپلائر کی تفصیل)
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                {/* Date */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Invoice Date (تاریخ)</label>
                  <input
                    type="text"
                    value={grnForm.date}
                    onChange={(e) => setGrnForm({ ...grnForm, date: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* System Entry # */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">System Entry # (سسٹم نمبر)</label>
                  <input
                    type="text"
                    value={grnForm.voucher_no}
                    readOnly
                    className="w-full bg-emerald-100/70 border border-emerald-300 text-emerald-900 rounded-xl px-3 py-2 text-xs font-black tracking-wider"
                  />
                </div>

                {/* Company Invoice / Bill # */}
                <div>
                  <label className="block text-[11px] font-bold text-emerald-950 mb-1 flex items-center gap-1">
                    <span>Company Invoice / Bill # (انوائس نمبر)</span>
                    <span className="text-rose-500 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    value={grnForm.grn_no}
                    onChange={(e) => setGrnForm({ ...grnForm, grn_no: e.target.value })}
                    placeholder="e.g. 10505, 017729, INV/0503"
                    className="w-full bg-white border border-emerald-400 rounded-xl px-3 py-2 text-xs font-black text-gray-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                {/* Salesman / Reference with + New */}
                <div>
                  {showNewRefInput ? (
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">New Salesman / Booker</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newRefText}
                          onChange={(e) => setNewRefText(e.target.value)}
                          placeholder="e.g. M Imran Qasim..."
                          className="flex-1 bg-white border border-emerald-400 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleAddNewReference()}
                        />
                        <button
                          type="button"
                          onClick={handleAddNewReference}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-xl font-black text-xs"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewRefInput(false)}
                          className="bg-gray-200 text-gray-700 px-2 py-1.5 rounded-xl font-bold text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ExpandableCombobox
                      label="Salesman / Booker (سیلز مین / آرڈر بکر)"
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

                {/* Quick Supplier Code Auto-Fill */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-amber-900">
                      <span className="material-symbols-outlined text-sm text-amber-600">bolt</span>
                      Supplier Code
                    </span>
                    {grnSupplierCode && (
                      <span className="text-[10px] text-emerald-700 font-bold">✓ Linked</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={grnSupplierCode}
                      onChange={(e) => handleSupplierCodeChange(e.target.value)}
                      placeholder="e.g. SUP-001, BM"
                      className="w-full bg-amber-50/70 border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-amber-950 uppercase tracking-wider focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                    {grnSupplierCode && (
                      <button
                        type="button"
                        onClick={() => handleSupplierCodeChange("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                        title="Clear Code"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Account Name */}
                <div className="sm:col-span-2">
                  <ExpandableCombobox
                    label="Account Name (Supplier / Company)"
                    value={grnForm.account_name}
                    onChange={(val, opt) => {
                      setGrnForm({ ...grnForm, account_name: val });
                      if (opt?.supplier_code) {
                        setGrnSupplierCode(opt.supplier_code);
                      }
                    }}
                    options={accountOptions}
                    placeholder="Select or Search Supplier / Account..."
                    searchPlaceholder="Search 260+ Suppliers & Accounts..."
                    required={true}
                  />
                </div>

                {/* Naration */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Naration</label>
                  <input
                    type="text"
                    value={grnForm.naration}
                    onChange={(e) => setGrnForm({ ...grnForm, naration: e.target.value })}
                    placeholder="Invoice remarks / note"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium text-gray-800"
                  />
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Payment Mode</label>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setGrnForm({ ...grnForm, payment_mode: "Cash" })}
                      className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs transition-all ${
                        grnForm.payment_mode === "Cash" ? "bg-emerald-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setGrnForm({ ...grnForm, payment_mode: "Credit" })}
                      className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs transition-all ${
                        grnForm.payment_mode === "Credit" ? "bg-rose-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Credit (Udhaar)
                    </button>
                  </div>
                </div>

                {/* Linked Supplier Info Capsule */}
                {matchedGrnSupplier && (
                  <div className="col-span-1 sm:col-span-2 md:col-span-4 bg-emerald-100/80 border border-emerald-300 rounded-2xl p-3 flex flex-wrap items-center justify-between text-xs text-emerald-950 gap-2 shadow-xs animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-emerald-700">verified_user</span>
                      <span className="font-bold">
                        Linked Supplier: <strong className="font-mono bg-white px-2 py-0.5 rounded-lg border border-emerald-300 text-emerald-900">#{matchedGrnSupplier.supplier_code || matchedGrnSupplier.id}</strong> — {matchedGrnSupplier.name} ({matchedGrnSupplier.phone || "No Phone"})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-700">
                        Current Udhaar / Balance: <strong className="text-rose-700 font-black">Rs. {Number(matchedGrnSupplier.current_balance || matchedGrnSupplier.balance_due || 0).toLocaleString()}</strong>
                      </span>
                      <span className="text-[10px] bg-emerald-700 text-white px-2.5 py-0.5 rounded-full font-black">
                        ⚡ Details Auto-Filled
                      </span>
                    </div>
                  </div>
                )}

                {/* Transport with + New */}
                <div className="sm:col-span-2">
                  {showNewTransportInput ? (
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">New Transport Carrier</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newTransportText}
                          onChange={(e) => setNewTransportText(e.target.value)}
                          placeholder="e.g. Al-Razi Transport, Larkana Goods..."
                          className="flex-1 bg-white border border-emerald-400 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleAddNewTransport()}
                        />
                        <button
                          type="button"
                          onClick={handleAddNewTransport}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-xl font-black text-xs"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewTransportInput(false)}
                          className="bg-gray-200 text-gray-700 px-2 py-1.5 rounded-xl font-bold text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ExpandableCombobox
                      label="Transport Carrier"
                      value={grnForm.transport}
                      onChange={(val) => setGrnForm({ ...grnForm, transport: val })}
                      options={transportOptions}
                      placeholder="Select or Search Carrier..."
                      searchPlaceholder="Search Transport Carrier..."
                      onAddNew={() => setShowNewTransportInput(true)}
                      addNewLabel="+ New Carrier"
                    />
                  )}
                </div>

                {/* Bilty # */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Bilty #</label>
                  <input
                    type="text"
                    value={grnForm.bilty_no}
                    onChange={(e) => setGrnForm({ ...grnForm, bilty_no: e.target.value })}
                    placeholder="Tracking / Bilty No"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-800"
                  />
                </div>

                {/* Destination Location */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Stock Destination</label>
                  <select
                    value={grnForm.destination_type}
                    onChange={(e) => setGrnForm({ ...grnForm, destination_type: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-teal-800"
                  >
                    <option value="warehouse">🏢 Central Godown (Warehouse)</option>
                    <option value="store">🏬 Pharmacy Counter (Store)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Cart Detail (Fast Line Item Add Bar with Batch & Expiry) */}
            <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-teal-700">add_shopping_cart</span>
                  Cart Detail (Fast Keyboard Entry, Batch #, Expiry Date &amp; Auto Rate)
                </div>
                <span className="text-[10px] text-teal-700 font-bold bg-white px-2.5 py-0.5 rounded-full border border-teal-200">
                  ⌨️ Tab / Enter Navigation Supported
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-2.5 items-end">
                {/* Product Code */}
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">Code</label>
                  <input
                    type="text"
                    value={grnCart.product_code}
                    readOnly
                    placeholder="Code"
                    className="w-full bg-gray-100 border border-gray-300 rounded-xl px-2 py-2 text-xs font-mono font-bold text-gray-700 text-center"
                  />
                </div>

                {/* Product Name Search with ExpandableCombobox */}
                <div className="col-span-2 sm:col-span-3 md:col-span-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-gray-700">
                      Product Name <span className="text-rose-500">*</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setGrnShowAllCompanies(!grnShowAllCompanies)}
                      className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md transition-all ${
                        grnShowAllCompanies
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                      }`}
                      title={grnShowAllCompanies ? "Switch to Company-Filtered mode" : "Show all products regardless of supplier"}
                    >
                      {grnShowAllCompanies
                        ? `🌐 All (${inventoryList.length})`
                        : `🏢 Filtered (${filteredGrnInventory.length})`}
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
                        ? "Search 500+ medicines..."
                        : `Search within ${grnForm.account_name || "Company"}...`
                    }
                    required={true}
                  />
                </div>

                {/* Batch # / Lot No */}
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">Batch #</label>
                  <input
                    type="text"
                    value={grnCart.batch_no}
                    onChange={(e) => handleUpdateGRNCart("batch_no", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddGRNItem(e)}
                    placeholder="e.g. 250525"
                    className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs font-mono font-bold text-gray-800 focus:border-teal-500"
                  />
                </div>

                {/* Expiry Date */}
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">Exp Date</label>
                  <input
                    type="text"
                    value={grnCart.expiry_date}
                    onChange={(e) => handleUpdateGRNCart("expiry_date", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddGRNItem(e)}
                    placeholder="MM/YY"
                    className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs font-bold text-gray-800 focus:border-teal-500"
                  />
                </div>

                {/* Qty */}
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-600 mb-1 text-center">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={grnCart.qty}
                    onChange={(e) => handleUpdateGRNCart("qty", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddGRNItem(e)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs font-black text-center text-gray-900 focus:border-teal-500"
                  />
                </div>

                {/* Rate */}
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-600 mb-1 text-center">Rate (TP)</label>
                  <input
                    type="number"
                    value={grnCart.rate}
                    onChange={(e) => handleUpdateGRNCart("rate", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddGRNItem(e)}
                    placeholder="Rate"
                    className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs font-bold text-center text-gray-900 focus:border-teal-500"
                  />
                </div>

                {/* Gross */}
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-600 mb-1 text-center">Gross</label>
                  <input
                    type="text"
                    value={grnCart.gross}
                    readOnly
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl px-2 py-2 text-xs font-bold text-center text-gray-700"
                  />
                </div>

                {/* Disc % */}
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-600 mb-1 text-center">Disc %</label>
                  <input
                    type="number"
                    value={grnCart.disc_pct}
                    onChange={(e) => handleUpdateGRNCart("disc_pct", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddGRNItem(e)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs font-bold text-center text-gray-900"
                  />
                </div>

                {/* Disc 0 (Flat) */}
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-600 mb-1 text-center">Disc 0</label>
                  <input
                    type="number"
                    value={grnCart.disc_flat}
                    onChange={(e) => handleUpdateGRNCart("disc_flat", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddGRNItem(e)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs font-bold text-center text-gray-900"
                  />
                </div>

                {/* Net Amount */}
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-[10px] font-bold text-emerald-800 mb-1 text-center">Net Amt</label>
                  <input
                    type="text"
                    value={grnCart.net_amount}
                    readOnly
                    className="w-full bg-emerald-100/80 border border-emerald-300 rounded-xl px-2 py-2 text-xs font-black text-center text-emerald-950"
                  />
                </div>

                {/* Add Button */}
                <div className="col-span-1 md:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddGRNItem}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1 shadow-md shadow-emerald-200"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3: Itemized Table Grid with Smooth Scroll Container */}
            <div
              ref={grnTableContainerRef}
              className="rounded-2xl border border-gray-200 shadow-sm max-h-80 min-h-[160px] overflow-y-auto custom-scrollbar relative bg-white"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-emerald-700 text-white font-black uppercase tracking-wider text-[11px] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-3 py-3 text-center">Batch #</th>
                    <th className="px-3 py-3 text-center">Exp Date</th>
                    <th className="px-3 py-3 text-center">Qty</th>
                    <th className="px-3 py-3 text-center">Rate</th>
                    <th className="px-3 py-3 text-center">Gross</th>
                    <th className="px-3 py-3 text-center">Disc(%)</th>
                    <th className="px-3 py-3 text-center">Disc(0)</th>
                    <th className="px-4 py-3 text-right">Net Amount</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {grnItems.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-12 text-gray-400 font-semibold">
                        <span className="material-symbols-outlined text-4xl block mb-1 text-gray-300">add_shopping_cart</span>
                        No medicine items in this purchase bill yet. Select a product, enter Batch/Exp, and click Add.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {grnItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-emerald-50/40 transition-colors">
                          <td className="px-4 py-3 font-bold text-gray-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{item.medicine_name}</span>
                              {item.product_code && (
                                <span className="text-[10px] text-gray-400 font-mono">[{item.product_code}]</span>
                              )}
                              {item.packing && (
                                <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                  {item.packing}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-black text-slate-800 bg-slate-50/70">
                            {item.batch_no || "—"}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-amber-900 bg-amber-50/40">
                            {item.expiry_date || "—"}
                          </td>
                          <td className="px-3 py-3 text-center font-black text-emerald-800">{item.qty}</td>
                          <td className="px-3 py-3 text-center text-gray-700">Rs. {Number(item.rate).toLocaleString()}</td>
                          <td className="px-3 py-3 text-center text-gray-700">Rs. {Number(item.gross).toLocaleString()}</td>
                          <td className="px-3 py-3 text-center text-gray-600">{item.disc_pct}</td>
                          <td className="px-3 py-3 text-center text-gray-600">Rs. {item.disc_flat}</td>
                          <td className="px-4 py-3 text-right font-black text-gray-900">Rs. {Number(item.net).toLocaleString()}</td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveGRNItem(idx)}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Delete Row"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
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


            {/* Section 4: Footer Summary & Action Controls with Extra Bill Discount & Freight */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowGRNListModal(true)}
                className="w-full lg:w-auto bg-slate-800 text-white hover:bg-slate-900 px-5 py-2.5 rounded-2xl font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">list_alt</span>
                Invoices Audit List (بل لسٹ اور ریکارڈ)
              </button>

              {/* Financial Calculation Widgets */}
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                {/* Items Subtotal */}
                <div className="bg-gray-50 border border-gray-200 px-3.5 py-2 rounded-xl text-right min-w-[110px]">
                  <div className="text-[9.5px] font-bold text-gray-500 uppercase">Items Subtotal</div>
                  <div className="text-sm font-black text-gray-900">
                    Rs. {grnItems.reduce((s, it) => s + (Number(it.net) || 0), 0).toLocaleString()}
                  </div>
                </div>

                {/* Extra Bill Discount */}
                <div className="bg-amber-50/70 border border-amber-200 px-3 py-1.5 rounded-xl text-right">
                  <label className="block text-[9.5px] font-bold text-amber-800 uppercase">Extra Disc (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={grnForm.extra_bill_discount}
                    onChange={(e) => setGrnForm({ ...grnForm, extra_bill_discount: e.target.value })}
                    placeholder="0"
                    className="w-20 bg-white border border-amber-300 rounded-lg px-2 py-0.5 text-xs font-black text-amber-950 text-right"
                  />
                </div>

                {/* Freight / Bilty Expense */}
                <div className="bg-blue-50/70 border border-blue-200 px-3 py-1.5 rounded-xl text-right">
                  <label className="block text-[9.5px] font-bold text-blue-800 uppercase">Freight / Bilty (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={grnForm.freight_charges}
                    onChange={(e) => setGrnForm({ ...grnForm, freight_charges: e.target.value })}
                    placeholder="0"
                    className="w-20 bg-white border border-blue-300 rounded-lg px-2 py-0.5 text-xs font-black text-blue-950 text-right"
                  />
                </div>

                {/* Final Net Payable Total */}
                <div className="bg-emerald-100 border border-emerald-300 px-4 py-2 rounded-xl text-right shadow-sm">
                  <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Net Payable (کل بل)</div>
                  <div className="text-lg font-black text-emerald-950">
                    Rs. {Math.max(
                      0,
                      grnItems.reduce((s, it) => s + (Number(it.net) || 0), 0) -
                        (Number(grnForm.extra_bill_discount) || 0) +
                        (Number(grnForm.freight_charges) || 0)
                    ).toLocaleString()}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveGRNBill}
                  className="w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3 rounded-2xl font-black text-xs transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  Save Invoice &amp; Add to Stock (بل محفوظ کریں)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: Pharma Suppliers / Distributors Directory (Clean Company Cards) */}
      {activeTab === "suppliers" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {suppliers.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white rounded-3xl border border-gray-200">
              <span className="material-symbols-outlined text-5xl text-gray-300 block mb-2">domain_disabled</span>
              <div className="text-gray-500 font-semibold text-sm">No pharma suppliers added yet.</div>
              <button
                onClick={() => setShowAddSupplier(true)}
                className="mt-3 bg-teal-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-teal-700"
              >
                + Add First Distributor
              </button>
            </div>
          ) : (
            suppliers.map((sup) => {
              const supBills = purchases.filter((p) => p.supplier_id === sup.id);
              const balance = sup.balance_due || 0;

              return (
                <div
                  key={sup.id}
                  className="bg-white rounded-3xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Company Icon + Name + Balance */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-black text-xl shrink-0">
                          {sup.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-base leading-tight">
                              {sup.name}
                            </h3>
                            <span className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-[10.5px] font-black tracking-wider">
                              #{sup.supplier_code || sup.id}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 font-medium mt-0.5">
                            {sup.contact_person || "Sales Representative"}
                          </div>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-black whitespace-nowrap ${
                        balance > 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {balance > 0 ? `Due: Rs. ${balance.toLocaleString()}` : "Paid"}
                      </span>
                    </div>

                    {/* Info Metadata */}
                    <div className="mt-4 space-y-1.5 text-xs text-gray-600 bg-gray-50 p-3 rounded-2xl border border-gray-100 font-medium">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Supplier Code:</span>
                        <span className="font-mono font-black text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                          {sup.supplier_code || sup.id}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Phone:</span>
                        <span className="font-bold text-gray-800">{sup.phone || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Address:</span>
                        <span className="font-semibold text-gray-700 truncate max-w-[160px]">{sup.address || "Main City"}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-gray-200 pt-1.5">
                        <span className="text-gray-400">Recorded Bills:</span>
                        <span className="font-black text-teal-700">{supBills.length} Bills</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
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
                      className="bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 px-2.5 py-2 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1"
                      title="Create GRN with this Supplier"
                    >
                      <span className="material-symbols-outlined text-sm">receipt</span>
                      New GRN
                    </button>
                    <button
                      onClick={() => handleRequestEditSupplier(sup)}
                      className="bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 px-2.5 py-2 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1"
                      title="Admin Security Passcode Required to Edit Company & Code"
                    >
                      <span className="material-symbols-outlined text-sm text-amber-700">edit_note</span>
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSupplierDrawer(sup);
                        setSupplierDrawerSearch("");
                      }}
                      className="flex-1 bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 py-2 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">receipt_long</span>
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
                      className="flex-1 bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 py-2 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">account_balance</span>
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
                        className="bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-2 rounded-xl font-bold text-xs transition-colors"
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

      {/* TAB 2: All Purchase Bills Audit Log */}
      {activeTab === "bills" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <input
              type="text"
              placeholder="Search by System Invoice #, Company Bill #, or Supplier..."
              value={globalBillsSearch}
              onChange={(e) => setGlobalBillsSearch(e.target.value)}
              className="border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-semibold w-full sm:w-80 shadow-sm"
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-teal-50 text-teal-900 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">System Voucher #</th>
                  <th className="px-4 py-3">Company Bill #</th>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3 text-right">Bill Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold">
                {globalFilteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-gray-400">
                      No purchase bills match your search criteria.
                    </td>
                  </tr>
                ) : (
                  globalFilteredPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(p.purchase_date).toLocaleDateString("en-PK")}
                      </td>
                      <td className="px-4 py-3 font-bold text-teal-700">{p.invoice_no}</td>
                      <td className="px-4 py-3 font-bold text-gray-800">{p.company_bill_no || "N/A"}</td>
                      <td className="px-4 py-3 text-gray-900 font-bold">{p.supplier_name}</td>
                      <td className="px-4 py-3 text-right font-black text-gray-900">
                        Rs. {(p.total_amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-teal-700 font-bold">
                        Rs. {(p.paid_amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-700 font-bold">
                        Rs. {(p.balance_due || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedInvoiceModal(p)}
                            className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                          >
                            View
                          </button>
                          <button
                            onClick={() => printSupplierPurchaseReceipt(p, suppliers.find((s) => s.id === p.supplier_id), dbClinic.get())}
                            className="bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 px-2 py-1 rounded-lg text-[11px] font-bold"
                          >
                            Print
                          </button>
                          <button
                            onClick={() => handleDeletePurchaseInvoice(p.id, p.invoice_no)}
                            className="bg-rose-50 text-rose-700 hover:bg-rose-100 px-2 py-1 rounded-lg text-[11px] font-bold"
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
                        <td className="px-3 py-2.5">{new Date(p.purchase_date).toLocaleDateString("en-PK")}</td>
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl p-6 border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Purchase Voucher #{selectedInvoiceModal.invoice_no}</h3>
                <p className="text-xs text-gray-500">Company Bill #: {selectedInvoiceModal.company_bill_no || "N/A"}</p>
              </div>
              <button onClick={() => setSelectedInvoiceModal(null)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-2 text-xs font-semibold">
              <div className="flex justify-between text-gray-600">
                <span>Supplier:</span>
                <span className="font-bold text-gray-900">{selectedInvoiceModal.supplier_name}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Date:</span>
                <span>{new Date(selectedInvoiceModal.purchase_date).toLocaleString("en-PK")}</span>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold">
                  <tr>
                    <th className="px-3 py-2">Item Name</th>
                    <th className="px-3 py-2 text-center">Qty Recv</th>
                    <th className="px-3 py-2 text-right">Cost Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {(selectedInvoiceModal.items || []).map((i, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 font-bold text-gray-900">{i.medicine_name}</td>
                      <td className="px-3 py-2 text-center">{i.qty} {i.received_unit_type || "pack"}s</td>
                      <td className="px-3 py-2 text-right font-bold">Rs. {i.cost_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl space-y-1 text-xs font-bold">
              <div className="flex justify-between text-gray-700">
                <span>Total Amount:</span>
                <span>Rs. {(selectedInvoiceModal.total_amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-teal-800">
                <span>Paid Amount:</span>
                <span>Rs. {(selectedInvoiceModal.paid_amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-800">
                <span>Balance Due:</span>
                <span>Rs. {(selectedInvoiceModal.balance_due || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => printSupplierPurchaseReceipt(selectedInvoiceModal, suppliers.find((s) => s.id === selectedInvoiceModal.supplier_id), dbClinic.get())}
                className="flex-1 bg-teal-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-teal-700"
              >
                Print 80mm Voucher
              </button>
              <button
                onClick={() => handleDeletePurchaseInvoice(selectedInvoiceModal.id, selectedInvoiceModal.invoice_no)}
                className="bg-rose-50 border border-rose-200 text-rose-700 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-rose-100"
              >
                Delete Invoice
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
              {(paySupplierModal.balance_due || 0) > 0 && (
                <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800">
                  Outstanding Balance: Rs. {(paySupplierModal.balance_due || 0).toLocaleString()}
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
                supplierLedgerTxns.slice().reverse().map((tx) => {
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
                    <div key={tx.id || Math.random()} className={`p-3.5 rounded-2xl border ${isDebit ? "bg-rose-50/60 border-rose-200" : "bg-emerald-50/60 border-emerald-200"}`}>
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
            {(Number(ledgerDrawerSupplier.balance_due) > 0 || Number(ledgerDrawerSupplier.balance) > 0) && (
              <div className="p-4 border-t border-gray-100 bg-white sticky bottom-0">
                <button
                  type="button"
                  onClick={() => {
                    const due = Number(ledgerDrawerSupplier.balance_due || ledgerDrawerSupplier.balance || 0);
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
                  <span>Record New Payment (Rs. {Number(ledgerDrawerSupplier.balance_due || ledgerDrawerSupplier.balance || 0).toLocaleString()} due)</span>
                </button>
              </div>
            )}
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
    </div>
  );
}

