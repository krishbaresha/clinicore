import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { dbSales, dbInventory, dbParties, dbAccounts, dbClinic, dbGrnMetadata, dbVisits, dbPatients } from "../api/db.js";
import { printSaleInvoiceReceipt } from "../utils/thermalPrinter.js";
import { CLINIC_LOGO_BASE64 } from "../utils/clinicLogoBase64.js";
import { RECEIPT_HEADER_IMAGE_BASE64 } from "../utils/receiptHeaderBase64.js";
import { useAuth } from "../hooks/useAuth.js";

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

export default function SaleInvoiceModal({ isOpen = true, onClose, isPage = false, onSave }) {
  const authContext = useAuth();
  const activeUser = authContext?.user?.name || authContext?.user?.username || "Admin Staff";

  const [inventoryList, setInventoryList] = useState([]);
  const [partiesList, setPartiesList] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [referencesList, setReferencesList] = useState([]);
  const [transportsList, setTransportsList] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);

  // Form State
  const [partyCodeSearch, setPartyCodeSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("All");
  const [showNewRefInput, setShowNewRefInput] = useState(false);
  const [newRefText, setNewRefText] = useState("");
  const [showNewTransportInput, setShowNewTransportInput] = useState(false);
  const [newTransportText, setNewTransportText] = useState("");

  const [billingType, setBillingType] = useState("patient"); // "patient" | "wholesale_party"

  // Salesman PIN Verification Challenge Modal State
  const [pendingSalesmanStaff, setPendingSalesmanStaff] = useState(null);
  const [showSalesmanPinModal, setShowSalesmanPinModal] = useState(false);
  const [salesmanPinInput, setSalesmanPinInput] = useState("");
  const [salesmanPinError, setSalesmanPinError] = useState("");

  const [saleForm, setSaleForm] = useState({
    date: new Date().toLocaleDateString("en-US"),
    voucher_no: "Inv-1000",
    grn_no: "0",
    reference: activeUser || "",
    account_name: "",
    token_no: "",
    buyer_id: "",
    naration: "",
    party_type: "",
    payment_mode: "Cash", // "Credit" | "Cash"
    company_filter: "All",
    transport: "",
    bilty_no: "",
    destination_type: "warehouse",
    extra_bill_discount: "0",
    freight_charges: "0",
  });

  const [saleCart, setSaleCart] = useState({
    product_code: "",
    medicine_name: "",
    inventory_id: "",
    category: "",
    packing: "",
    batch_no: "",
    qty: "1",
    rate: "",
    gross: "",
    disc_pct: "40",
  });

  const [saleItems, setSaleItems] = useState([]);
  const [showListModal, setShowListModal] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilterMode, setHistoryFilterMode] = useState("All");
  const [showNewPartyModal, setShowNewPartyModal] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [todayVisits, setTodayVisits] = useState([]);

  const productCodeInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const rateInputRef = useRef(null);
  const customerNameInputRef = useRef(null);
  const partyCodeInputRef = useRef(null);
  const cityInputRef = useRef(null);
  const biltyInputRef = useRef(null);
  const discPctInputRef = useRef(null);
  const discFlatInputRef = useRef(null);
  const saleItemsEndRef = useRef(null);
  const tableContainerRef = useRef(null);

  const refreshData = () => {
    setInventoryList(dbInventory.getAll());
    const parties = dbParties.getAll();
    setPartiesList(parties);
    setAccountsList(dbAccounts.getAll());
    setReferencesList(dbGrnMetadata.getReferences());
    setTransportsList(dbGrnMetadata.getTransports());
    setSalesHistory(dbSales.getAll());
    setTodayVisits(dbVisits.getTodayAll());

    setSaleForm((prev) => ({
      ...prev,
      voucher_no: dbSales.getNextVoucherNo(billingType),
    }));
  };

  useEffect(() => {
    setSaleForm((prev) => ({
      ...prev,
      voucher_no: dbSales.getNextVoucherNo(billingType),
    }));
  }, [billingType]);

  const handleSelectTodayPatient = (visitId) => {
    if (!visitId) return;
    const visit = todayVisits.find((v) => v.id === visitId);
    if (visit) {
      setSaleForm((prev) => ({
        ...prev,
        account_name: visit.patient_name || "",
        token_no: String(visit.token_number || ""),
        visit_id: visit.id,
        patient_id: visit.patient_id,
      }));
    }
  };

  const handleTokenNumberChange = (val) => {
    setSaleForm((prev) => ({ ...prev, token_no: val }));
    if (!val || !val.trim()) return;
    const num = parseInt(val.replace(/\D/g, ""), 10);
    if (!num) return;
    
    // Check in today's visits list
    const matchedVisit = todayVisits.find((v) => Number(v.token_number) === num) || dbVisits.getTodayAll().find((v) => Number(v.token_number) === num);
    if (matchedVisit) {
      const pat = matchedVisit.patient_id ? dbPatients.getById(matchedVisit.patient_id) : null;
      const patientFullName = matchedVisit.patient_name || pat?.full_name || pat?.name || "Patient";
      setSaleForm((prev) => ({
        ...prev,
        account_name: patientFullName,
        visit_id: matchedVisit.id,
        patient_id: matchedVisit.patient_id,
      }));
    }
  };

  const handlePartyCodeChange = (code) => {
    setPartyCodeSearch(code);
    if (!code || !code.trim()) return;
    const clean = code.trim().toLowerCase();
    const party = partiesList.find(
      (p) =>
        (p.party_code && p.party_code.toLowerCase() === clean) ||
        (p.party_code && p.party_code.toLowerCase().startsWith(clean)) ||
        (p.name && p.name.toLowerCase().startsWith(clean))
    );
    if (party) {
      handleSelectAccount(party.name, { raw: party });
    }
  };

  const matchedParty = useMemo(() => {
    if (billingType !== "wholesale_party" || !saleForm.account_name) return null;
    const lower = saleForm.account_name.toLowerCase().trim();
    return partiesList.find((p) => p.name && p.name.toLowerCase().trim() === lower) || null;
  }, [partiesList, saleForm.account_name, billingType]);

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  // Companies List for filtering
  const companyOptions = useMemo(() => {
    const set = new Set(["All"]);
    inventoryList.forEach((i) => {
      if (i.company_name) set.add(i.company_name);
    });
    return Array.from(set);
  }, [inventoryList]);

  // Customer Account Options
  const accountOptions = useMemo(() => {
    const list = [];
    partiesList.forEach((p) => {
      list.push({
        id: p.name,
        party_id: p.id,
        label: p.name,
        sublabel: `${p.city || "City"} · Phone: ${p.phone || "-"} · Balance: Rs. ${p.current_balance || 0}`,
        badge: `🏛️ ${p.city || "Party"}`,
        phone: p.phone,
        city: p.city,
        raw: p,
      });
    });
    accountsList.forEach((a) => {
      if (!partiesList.some((p) => p.name.toLowerCase() === a.account_name.toLowerCase())) {
        list.push({
          id: a.account_name,
          party_id: a.id,
          label: a.account_name,
          sublabel: `${a.city || a.account_type || "Party"} · Balance: Rs. ${a.opening_balance || 0}`,
          badge: `📒 ${a.account_type || "Account"}`,
          phone: a.phone,
          city: a.city,
          raw: a,
        });
      }
    });
    return list;
  }, [partiesList, accountsList]);

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

  // Filtered Products by Company
  const filteredProducts = useMemo(() => {
    if (selectedCompany === "All") return inventoryList;
    const comp = selectedCompany.toLowerCase();
    return inventoryList.filter(
      (inv) =>
        (inv.company_name || "").toLowerCase().includes(comp) ||
        (inv.item_code || "").toLowerCase().includes(comp) ||
        (inv.category || "").toLowerCase().includes(comp)
    );
  }, [inventoryList, selectedCompany]);

  const productOptions = useMemo(() => {
    return filteredProducts.map((inv) => ({
      id: inv.id,
      label: inv.medicine_name,
      sublabel: `Sale: Rs. ${inv.unit_sale_price || inv.sale_price || 0} · Stock: ${inv.warehouse_stock || inv.store_stock || 0}`,
      badge: inv.item_code || inv.company_name || "MED",
      raw: inv,
    }));
  }, [filteredProducts]);

  // Account Name Selection Handlers
  const handleSelectAccount = (accName, opt) => {
    if (!accName) {
      setSaleForm((prev) => ({ ...prev, account_name: "", naration: "", party_type: "" }));
      setPartyCodeSearch("");
      return;
    }
    const party = opt?.raw || partiesList.find((p) => p.name === accName) || accountsList.find((a) => a.account_name === accName);
    const city = party?.city || party?.territory || "HYD";
    const phone = party?.phone || "";
    const narationStr = `${city}${phone ? ` (${phone})` : ""} LED`;

    setSaleForm((prev) => ({
      ...prev,
      account_name: accName,
      buyer_id: party?.id || "",
      naration: narationStr,
      party_type: city,
    }));
    if (party?.code || party?.account_code) {
      setPartyCodeSearch(party.code || party.account_code);
    }
  };

  const handleSelectSalesman = (staffName) => {
    setSaleForm((prev) => ({
      ...prev,
      reference: staffName || "",
    }));
  };

  // Product Code Auto-Lookup
  const handleProductCodeChange = (codeVal) => {
    setSaleCart((prev) => ({ ...prev, product_code: codeVal }));
    if (!codeVal.trim()) return;

    const clean = codeVal.trim().toLowerCase();
    const match = inventoryList.find(
      (inv) =>
        (inv.item_code || "").toLowerCase() === clean ||
        (inv.company_name || "").toLowerCase() === clean ||
        inv.id.toLowerCase() === clean
    );

    if (match) {
      const rate = match.unit_sale_price || match.sale_price || match.box_sale_price || 0;
      const qty = Number(saleCart.qty) || 1;
      const gross = qty * rate;
      const discPct = saleCart.disc_pct === "" || saleCart.disc_pct === undefined ? 40 : (Number(saleCart.disc_pct) || 0);
      const discFlat = Number(saleCart.disc_flat) || 0;
      const net = Math.max(0, gross - (gross * (discPct / 100)) - discFlat);

      setSaleCart({
        product_code: match.item_code || codeVal,
        medicine_name: match.medicine_name,
        inventory_id: match.id,
        qty: String(qty),
        rate: String(rate),
        gross: String(gross),
        disc_pct: String(discPct),
        disc_flat: String(discFlat),
        net_amount: String(net),
      });
      setTimeout(() => qtyInputRef.current?.focus(), 50);
    }
  };

  // Select Product Name from Dropdown
  const handleSelectProduct = (invId, opt) => {
    if (!invId) {
      setSaleCart((prev) => ({ ...prev, inventory_id: "", medicine_name: "", product_code: "", rate: "", gross: "", net_amount: "" }));
      return;
    }
    const inv = opt?.raw || inventoryList.find((i) => i.id === invId);
    if (!inv) return;
    const rate = inv.unit_sale_price || inv.sale_price || inv.box_sale_price || 0;
    const qty = Number(saleCart.qty) || 1;
    const gross = qty * rate;
    const discPct = saleCart.disc_pct === "" || saleCart.disc_pct === undefined ? 40 : (Number(saleCart.disc_pct) || 0);
    const discFlat = Number(saleCart.disc_flat) || 0;
    const net = Math.max(0, gross - (gross * (discPct / 100)) - discFlat);

    setSaleCart({
      product_code: inv.item_code || inv.company_name || "",
      medicine_name: inv.medicine_name,
      inventory_id: inv.id,
      qty: String(qty),
      rate: String(rate),
      gross: String(gross),
      disc_pct: String(discPct),
      disc_flat: String(discFlat),
      net_amount: String(net),
    });
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const handleUpdateCartMath = (field, val) => {
    setSaleCart((prev) => {
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

  const handleAddSaleItem = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!saleCart.medicine_name.trim()) {
      alert("Please select or enter a Product Name.");
      return;
    }
    if (Number(saleCart.qty) <= 0) {
      alert("Please enter a valid Quantity.");
      qtyInputRef.current?.focus();
      return;
    }

    const q = Number(saleCart.qty) || 1;
    const r = Number(saleCart.rate) || 0;
    const gross = q * r;
    const dPct = Number(saleCart.disc_pct) || 0;
    const dFlat = Number(saleCart.disc_flat) || 0;
    const net = Math.max(0, gross - (gross * (dPct / 100)) - dFlat);

    const newItem = {
      id: "sale_item_" + Date.now(),
      inventory_id: saleCart.inventory_id || "",
      product_code: saleCart.product_code,
      medicine_name: saleCart.medicine_name.trim(),
      qty: q,
      qty_base_units: q,
      rate: r,
      unit_price: r,
      gross: gross,
      disc_pct: dPct > 0 ? `${dPct}%` : "0%",
      disc_pct_num: dPct,
      disc_flat: dFlat,
      net: net,
      line_total: net,
    };

    setSaleItems((prev) => [...prev, newItem]);
    setSaleCart({
      product_code: "",
      medicine_name: "",
      inventory_id: "",
      qty: "1",
      rate: "",
      gross: "",
      disc_pct: "40",
      disc_flat: "0",
      net_amount: "",
    });
    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
      }
      if (saleItemsEndRef.current) {
        saleItemsEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      productCodeInputRef.current?.focus();
    }, 40);
  };


  const handleRemoveSaleItem = (idx) => {
    setSaleItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const posServiceFee = billingType === "patient" ? 1 : 0;

  const totalBillCalculated = useMemo(() => {
    const subtotal = saleItems.reduce((sum, item) => sum + (Number(item.net) || 0), 0);
    const extraDisc = Number(saleForm.extra_bill_discount) || 0;
    const freight = Number(saleForm.freight_charges) || 0;
    const posFee = billingType === "patient" ? 1 : 0;
    return Math.max(0, subtotal - extraDisc + freight + posFee);
  }, [saleItems, saleForm.extra_bill_discount, saleForm.freight_charges, billingType]);

  const handleAddNewReference = () => {
    if (!newRefText.trim()) return;
    const added = dbGrnMetadata.addReference(newRefText.trim());
    setReferencesList(dbGrnMetadata.getReferences());
    setSaleForm((prev) => ({ ...prev, reference: added }));
    setNewRefText("");
    setShowNewRefInput(false);
  };

  const handleAddNewTransport = () => {
    if (!newTransportText.trim()) return;
    const added = dbGrnMetadata.addTransport(newTransportText.trim());
    setTransportsList(dbGrnMetadata.getTransports());
    setSaleForm((prev) => ({ ...prev, transport: added }));
    setNewTransportText("");
    setShowNewTransportInput(false);
  };

  // Save Sale Invoice Bill
  const handleSaveSaleBill = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (saleItems.length === 0) {
      setSaveSuccessMsg("❌ Please add at least 1 medicine item to the sale cart.");
      setTimeout(() => setSaveSuccessMsg(""), 3500);
      return;
    }
    if (!saleForm.account_name.trim()) {
      setSaveSuccessMsg("❌ Please select or enter Customer / Patient Account Name.");
      setTimeout(() => setSaveSuccessMsg(""), 3500);
      return;
    }

    const itemsSubtotal = saleItems.reduce((sum, item) => sum + (Number(item.net) || 0), 0);
    const extraDisc = Number(saleForm.extra_bill_discount) || 0;
    const freight = Number(saleForm.freight_charges) || 0;
    const grandTotal = totalBillCalculated;

    const createdSale = dbSales.addSaleInvoice({
      ...saleForm,
      items: saleItems,
      subtotal: itemsSubtotal,
      extra_discount: extraDisc,
      freight_charges: freight,
      pos_service_fee: posServiceFee,
      total_amount: grandTotal,
      paid_amount: saleForm.payment_mode === "Cash" ? grandTotal : 0,
      balance_due: saleForm.payment_mode === "Credit" ? grandTotal : 0,
    });

    // ✅ Trigger print FIRST (non-blocking iframe), then reset state
    const clinic = dbClinic.get();
    try {
      printSaleInvoiceReceipt(createdSale, clinic);
    } catch (err) {
      console.warn("Print error:", err);
    }

    // Non-blocking success toast (no alert() which would block print dialog)
    setSaveSuccessMsg(`✅ Invoice ${createdSale.voucher_no} saved! Printing...`);
    setTimeout(() => setSaveSuccessMsg(""), 4000);

    setSaleItems([]);
    setSaleForm((prev) => ({
      ...prev,
      voucher_no: dbSales.getNextVoucherNo(),
      account_name: "",
      token_no: "",
      buyer_id: "",
      naration: "",
      party_type: "",
      payment_mode: "Cash",
      transport: "",
      bilty_no: "",
      extra_bill_discount: "0",
      freight_charges: "0",
    }));
    setPartyCodeSearch("");
    refreshData();
    if (onSave) onSave(createdSale);
  };

  if (!isOpen) return null;

  const modalBody = (
    <>
      <div className={`bg-white w-full ${isPage ? 'rounded-3xl shadow-xl border border-emerald-300' : 'max-w-7xl rounded-3xl shadow-2xl border border-emerald-300 my-auto max-h-[95vh]'} overflow-hidden flex flex-col`}>
        {/* Visual Green Gradient Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <span className="material-symbols-outlined text-3xl">point_of_sale</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/25 text-emerald-100 border border-white/20">
                  Wholesale &amp; Retail Invoicing
                </span>
                <span className="text-[10px] font-bold text-emerald-200">DrCreate Engine</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                SALE INVOICE <span className="text-sm font-bold opacity-80">_Form</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowListModal(true)}
              className="bg-slate-900/80 hover:bg-slate-900 text-white px-4 py-2 rounded-2xl font-black text-xs transition-all shadow-md flex items-center gap-1.5 border border-white/20"
            >
              <span className="material-symbols-outlined text-base">list_alt</span>
              Invoices List
            </button>
            <button
              type="button"
              onClick={handleSaveSaleBill}
              className="bg-white text-emerald-800 hover:bg-emerald-50 px-5 py-2 rounded-2xl font-black text-xs transition-all shadow-lg flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">print</span>
              Save &amp; Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>        {/* Scrollable Workspace with Real-Time Thermal Receipt Preview Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Main Form Column (8 cols on XL screens) */}
            <div className="xl:col-span-8 space-y-5">
              {/* Section 1: Basic Info */}
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2.5">
                  <div className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-emerald-700">receipt_long</span>
                    Sale Invoice &amp; Customer Details (انوائس اور گاہک کی تفصیل)
                  </div>

                  {/* Billing Mode Switcher (Patient vs Wholesale B2B Party) */}
                  <div className="inline-flex bg-emerald-100/90 p-0.5 rounded-xl text-xs font-bold border border-emerald-300 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setBillingType("patient")}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        billingType === "patient"
                          ? "bg-emerald-800 text-white shadow-xs"
                          : "text-emerald-900 hover:text-emerald-950"
                      }`}
                    >
                      👤 Patient / Walk-In Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingType("wholesale_party")}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        billingType === "wholesale_party"
                          ? "bg-amber-800 text-white shadow-xs"
                          : "text-amber-900 hover:text-amber-950"
                      }`}
                    >
                      🏢 Wholesale B2B Party
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                  {/* Date (Locked) */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Invoice Date (تاریخ) (Locked)</label>
                    <input
                      type="text"
                      readOnly={true}
                      value={saleForm.date}
                      className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-600 font-sans"
                    />
                  </div>

                  {/* Voucher / Invoice # (Locked Inv- Prefix) */}
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-950 mb-1">Sale Invoice # (انوائس نمبر)</label>
                    <input
                      type="text"
                      readOnly={true}
                      value={saleForm.voucher_no}
                      className="w-full bg-emerald-100/80 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-black text-emerald-950 font-mono tracking-wider"
                    />
                  </div>

                  {/* Patient / Retail Customer Mode Layout */}
                  {billingType === "patient" ? (
                    <>
                      {/* Select Today's OPD Patient Dropdown */}
                      <div className="col-span-1 sm:col-span-2 md:col-span-4 bg-teal-50/80 border border-teal-300 rounded-2xl p-3 space-y-1">
                        <label className="block text-[11px] font-black text-teal-950 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-teal-700">badge</span>
                            Select Today's OPD Patient (آج کے OPD مریض کا ٹوکن منتخب کریں)
                          </span>
                          <span className="text-[10px] bg-teal-800 text-white px-2 py-0.5 rounded-full font-bold">
                            {todayVisits.length} Patients Today
                          </span>
                        </label>
                        <select
                          onChange={(e) => handleSelectTodayPatient(e.target.value)}
                          className="w-full bg-white border border-teal-400 rounded-xl px-3 py-2 text-xs font-bold text-teal-950 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 cursor-pointer"
                        >
                          <option value="">-- 🔍 Select Patient from Today's OPD Queue --</option>
                          {todayVisits.map((v) => (
                            <option key={v.id} value={v.id}>
                              🎟️ Token #{v.token_number} — {v.patient_name || "Patient"} {v.doctor_name ? `(${v.doctor_name})` : ""} [{v.status === "completed" ? "✓ Doctor Seen" : v.status}]
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Customer / Patient Name Input */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          Customer / Patient Name (گاہک یا مریض کا نام) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          ref={customerNameInputRef}
                          type="text"
                          required={true}
                          value={saleForm.account_name}
                          onChange={(e) => setSaleForm({ ...saleForm, account_name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              productCodeInputRef.current?.focus();
                            }
                          }}
                          placeholder="Enter Customer or Patient Name (e.g. Ali Raza, Dr. Kashif)..."
                          className="w-full bg-white border border-emerald-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 rounded-xl px-3 py-2 text-xs font-bold text-gray-900"
                        />
                      </div>

                      {/* Token Number Field */}
                      <div>
                        <label className="block text-[11px] font-bold text-teal-800 mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-teal-600">confirmation_number</span>
                          Token # (ٹوکن نمبر)
                        </label>
                        <input
                          type="text"
                          value={saleForm.token_no}
                          onChange={(e) => handleTokenNumberChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              productCodeInputRef.current?.focus();
                            }
                          }}
                          placeholder="e.g. 14, T-05"
                          className="w-full bg-teal-50/70 border border-teal-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-teal-950 text-center focus:bg-white focus:border-teal-600"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Wholesale B2B Mode Fields */}
                      {/* Quick Party Code Auto-Fill */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1 text-amber-900">
                            <span className="material-symbols-outlined text-sm text-amber-600">bolt</span>
                            Party Code
                          </span>
                          {partyCodeSearch && (
                            <span className="text-[10px] text-emerald-700 font-bold">✓ Linked</span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            ref={partyCodeInputRef}
                            type="text"
                            value={partyCodeSearch}
                            onChange={(e) => handlePartyCodeChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                cityInputRef.current?.focus();
                              }
                            }}
                            placeholder="e.g. 001, Muslim"
                            className="w-full bg-amber-50/70 border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-amber-950 uppercase tracking-wider focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                          />
                          {partyCodeSearch && (
                            <button
                              type="button"
                              onClick={() => handlePartyCodeChange("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                              title="Clear Code"
                            >
                              <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Customer / Party Name */}
                      <div className="sm:col-span-2">
                        <ExpandableCombobox
                          label="Party Name (پارٹی کا نام)"
                          value={saleForm.account_name}
                          onChange={handleSelectAccount}
                          options={accountOptions}
                          placeholder="Select or Search Party Name..."
                          searchPlaceholder="Search Parties..."
                          onAddNew={() => setShowNewPartyModal(true)}
                          addNewLabel="+ New Party"
                          required={true}
                        />
                      </div>

                      {/* Salesman / Booker */}
                      <div>
                        <ExpandableCombobox
                          label="Salesman / Order Booker (سیلز مین)"
                          value={saleForm.reference || activeUser}
                          onChange={handleSelectSalesman}
                          options={referenceOptions}
                          placeholder="Select Salesman..."
                          searchPlaceholder="Search registered staff..."
                          required={true}
                        />
                      </div>

                      {/* Type (City) */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Type (City / Route)</label>
                        <input
                          ref={cityInputRef}
                          type="text"
                          value={saleForm.party_type}
                          onChange={(e) => setSaleForm({ ...saleForm, party_type: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              biltyInputRef.current?.focus();
                            }
                          }}
                          placeholder="e.g. DHARKI, HYD"
                          className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-black text-gray-700"
                        />
                      </div>

                      {/* Transport Carrier */}
                      <div className="sm:col-span-2">
                        {showNewTransportInput ? (
                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 mb-1">New Transport Carrier</label>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={newTransportText}
                                onChange={(e) => setNewTransportText(e.target.value)}
                                placeholder="e.g. Ali Raza By Hand..."
                                className="flex-1 bg-white border border-emerald-400 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                                autoFocus
                                onKeyDown={(e) => e.key === "Enter" && handleAddNewTransport()}
                              />
                              <button
                                type="button"
                                onClick={handleAddNewTransport}
                                className="bg-emerald-600 text-white px-2.5 py-1.5 rounded-xl font-black text-xs"
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
                            label="Transport"
                            value={saleForm.transport}
                            onChange={(val) => setSaleForm({ ...saleForm, transport: val })}
                            options={transportOptions}
                            placeholder="Select Transport..."
                            searchPlaceholder="Search Transport..."
                            onAddNew={() => setShowNewTransportInput(true)}
                            addNewLabel="+ New Carrier"
                          />
                        )}
                      </div>

                      {/* Bilty # */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Bilty#</label>
                        <input
                          ref={biltyInputRef}
                          type="text"
                          value={saleForm.bilty_no}
                          onChange={(e) => setSaleForm({ ...saleForm, bilty_no: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              productCodeInputRef.current?.focus();
                            }
                          }}
                          placeholder="0000"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-800"
                        />
                      </div>
                    </>
                  )}

                  {/* Matched Party Udhaar Box */}
                  {billingType === "wholesale_party" && matchedParty && (
                    <div className="col-span-1 sm:col-span-2 md:col-span-4 bg-amber-50/95 border-2 border-amber-400 rounded-2xl p-3 flex flex-wrap items-center justify-between text-xs text-amber-950 gap-2 shadow-sm animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-xl text-amber-700">account_balance_wallet</span>
                        <div>
                          <div className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Party Outstanding Balance (پرانا ادھار)</div>
                          <div className="font-extrabold text-slate-900 text-sm">
                            {matchedParty.name} {matchedParty.city ? `(${matchedParty.city})` : ""}
                            {matchedParty.party_code && (
                              <span className="ml-1.5 text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-amber-300">
                                #{matchedParty.party_code}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-slate-600 uppercase">Current Udhaar / Balance</div>
                          <div className={`text-base font-black font-mono ${Number(matchedParty.current_balance || matchedParty.opening_balance || 0) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                            Rs. {Number(matchedParty.current_balance || matchedParty.opening_balance || 0).toLocaleString()}
                          </div>
                        </div>
                        {Number(matchedParty.current_balance || matchedParty.opening_balance || 0) > 0 ? (
                          <span className="text-[10px] bg-rose-600 text-white px-2.5 py-1 rounded-full font-black uppercase shadow-xs">
                            ⚠️ Udhaar Due
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-600 text-white px-2.5 py-1 rounded-full font-black uppercase shadow-xs">
                            ✓ No Udhaar (Rs. 0)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payment Mode Radio Toggle & Company Filter */}
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-4 bg-white p-2.5 rounded-xl border border-gray-200">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Payment Mode</label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-gray-800">
                          <input
                            type="radio"
                            name="payment_mode"
                            value="Credit"
                            checked={saleForm.payment_mode === "Credit"}
                            onChange={() => setSaleForm({ ...saleForm, payment_mode: "Credit" })}
                            className="text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                          />
                          Credit (Udhaar)
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-gray-800">
                          <input
                            type="radio"
                            name="payment_mode"
                            value="Cash"
                            checked={saleForm.payment_mode === "Cash"}
                            onChange={() => setSaleForm({ ...saleForm, payment_mode: "Cash" })}
                            className="text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                          />
                          Cash
                        </label>
                      </div>
                    </div>

                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Filter Brand / Company</label>
                      <select
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        className="w-full bg-gray-50 border border-emerald-300 rounded-xl px-2.5 py-1.5 text-xs font-black text-emerald-900 focus:border-emerald-500"
                      >
                        {companyOptions.map((c) => (
                          <option key={c} value={c}>{c === "All" ? "🏢 All Companies / Brands" : `🏢 ${c}`}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Cart Detail (Fast Line Item Add Bar) */}
              <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-black text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-teal-700">add_shopping_cart</span>
                  Cart Detail (Fast Keyboard Entry &amp; Product Code Auto-Lookup)
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-12 gap-2.5 items-end">
                  {/* Product Code */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">Product Code</label>
                    <input
                      ref={productCodeInputRef}
                      type="text"
                      value={saleCart.product_code}
                      onChange={(e) => handleProductCodeChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          qtyInputRef.current?.focus();
                        }
                      }}
                      placeholder="e.g. BM-01, T-1"
                      className="w-full bg-white border border-teal-400 rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-gray-900 text-center focus:border-teal-600 focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  {/* Product Name Search */}
                  <div className="col-span-2 sm:col-span-3 md:col-span-3">
                    <ExpandableCombobox
                      label="Product Name"
                      value={saleCart.inventory_id}
                      onChange={handleSelectProduct}
                      options={productOptions}
                      placeholder="-- Select or Search Product --"
                      searchPlaceholder="Search medicines, formulas, T-1..."
                      required={true}
                    />
                  </div>

                  {/* Qty */}
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 text-center">Qty</label>
                    <input
                      ref={qtyInputRef}
                      type="number"
                      min="1"
                      value={saleCart.qty}
                      onChange={(e) => handleUpdateCartMath("qty", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (rateInputRef.current) {
                            rateInputRef.current.focus();
                            if (rateInputRef.current.select) rateInputRef.current.select();
                          } else {
                            discPctInputRef.current?.focus();
                          }
                        }
                      }}
                      className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs font-black text-center text-gray-900 focus:border-teal-500"
                    />
                  </div>

                  {/* Rate */}
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 text-center">Rate</label>
                    <input
                      ref={rateInputRef}
                      type="number"
                      value={saleCart.rate}
                      onChange={(e) => handleUpdateCartMath("rate", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          discPctInputRef.current?.focus();
                        }
                      }}
                      placeholder="Rate"
                      className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs font-bold text-center text-gray-900 focus:border-teal-500"
                    />
                  </div>

                  {/* Gross */}
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 text-center">Gross</label>
                    <input
                      type="text"
                      value={saleCart.gross}
                      readOnly
                      className="w-full bg-gray-100 border border-gray-200 rounded-xl px-2 py-2 text-xs font-bold text-center text-gray-700"
                    />
                  </div>

                  {/* Disc % */}
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 text-center">Disc %</label>
                    <input
                      ref={discPctInputRef}
                      type="number"
                      value={saleCart.disc_pct}
                      onChange={(e) => handleUpdateCartMath("disc_pct", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSaleItem(e);
                        }
                      }}
                      className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs font-bold text-center text-gray-900"
                    />
                  </div>

                  {/* Disc 0 */}
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 text-center">Disc 0</label>
                    <input
                      ref={discFlatInputRef}
                      type="number"
                      value={saleCart.disc_flat}
                      onChange={(e) => handleUpdateCartMath("disc_flat", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSaleItem(e);
                        }
                      }}
                      className="w-full bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs font-bold text-center text-gray-900"
                    />
                  </div>

                  {/* Net Amount */}
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-emerald-800 mb-1 text-center">Net Amt</label>
                    <input
                      type="text"
                      value={saleCart.net_amount}
                      readOnly
                      className="w-full bg-emerald-100/80 border border-emerald-300 rounded-xl px-2 py-2 text-xs font-black text-center text-emerald-950"
                    />
                  </div>

                  {/* Add Button */}
                  <div className="md:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddSaleItem}
                      className="w-full bg-teal-700 hover:bg-teal-800 text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 3: Added Items Table */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div ref={tableContainerRef} className="max-h-[320px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-emerald-900 text-white font-black uppercase tracking-wider text-[10px] sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3">Item Name</th>
                        <th className="px-3 py-3 text-center">Qty</th>
                        <th className="px-3 py-3 text-center">Rate</th>
                        <th className="px-3 py-3 text-center">Gross</th>
                        <th className="px-3 py-3 text-center">Disc(%)</th>
                        <th className="px-3 py-3 text-center">Disc(0)</th>
                        <th className="px-4 py-3 text-right">Net</th>
                        <th className="px-3 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {saleItems.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center py-8 text-gray-400 font-bold bg-gray-50/50">
                            <span className="material-symbols-outlined text-3xl text-gray-300 block mb-1">point_of_sale</span>
                            No medicine items in this Sale Invoice yet. Select a product or type Product Code to add.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {saleItems.map((item, idx) => (
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
                              <td className="px-3 py-3 text-center font-black text-emerald-800">{item.qty}</td>
                              <td className="px-3 py-3 text-center text-gray-700">Rs. {Number(item.rate).toLocaleString()}</td>
                              <td className="px-3 py-3 text-center text-gray-700">Rs. {Number(item.gross).toLocaleString()}</td>
                              <td className="px-3 py-3 text-center text-gray-600">{item.disc_pct}</td>
                              <td className="px-3 py-3 text-center text-gray-600">Rs. {item.disc_flat}</td>
                              <td className="px-4 py-3 text-right font-black text-gray-900">Rs. {Number(item.net).toLocaleString()}</td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSaleItem(idx)}
                                  className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                          <tr ref={saleItemsEndRef}>
                            <td colSpan="8" className="p-0 border-0" />
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 4: Footer Controls */}
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowListModal(true)}
                  className="w-full lg:w-auto bg-slate-900 hover:bg-slate-800 text-white font-black px-5 py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">list_alt</span>
                  Invoices Logbook (بل ریکارڈ)
                </button>

                {/* Financial Summary Controls */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                  {/* Items Subtotal */}
                  <div className="bg-gray-50 border border-gray-200 px-3.5 py-1.5 rounded-xl text-right min-w-[110px]">
                    <div className="text-[9.5px] font-bold text-gray-500 uppercase">Subtotal</div>
                    <div className="text-sm font-black text-gray-900">
                      Rs. {saleItems.reduce((sum, item) => sum + (Number(item.net) || 0), 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Previous Udhaar / Balance Box */}
                  <div className={`px-3.5 py-1.5 rounded-xl text-right min-w-[120px] border ${
                    Number(matchedParty?.current_balance || matchedParty?.opening_balance || 0) > 0
                      ? "bg-rose-50 border-rose-300 text-rose-950"
                      : "bg-gray-50 border-gray-200 text-gray-700"
                  }`}>
                    <div className="text-[9.5px] font-bold uppercase tracking-wider">Purana Udhaar (ادھار)</div>
                    <div className="text-sm font-black font-mono">
                      Rs. {Number(matchedParty?.current_balance || matchedParty?.opening_balance || 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Net Grand Total */}
                  <div className="bg-emerald-100 border border-emerald-300 text-emerald-950 font-black px-5 py-2 rounded-2xl text-base min-w-[130px] text-right shadow-inner">
                    <div className="text-[9.5px] font-bold text-emerald-800 uppercase">Net Total (کل رقم)</div>
                    Rs. {totalBillCalculated.toLocaleString()}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveSaleBill}
                    className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black px-6 py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-200 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">print</span>
                    Save &amp; Print Invoice (بل محفوظ کریں اور پرنٹ)
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column (4 cols): REAL-TIME LIVE 80mm THERMAL RECEIPT PREVIEW */}
            <div className="xl:col-span-4 space-y-3 sticky top-4">
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-xl">receipt_long</span>
                  <div>
                    <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
                      LIVE THERMAL RECEIPT PREVIEW
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">80mm ESC/POS Live Stream View</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSaleBill}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  Print
                </button>
              </div>

              {/* Thermal Paper Slip Frame */}
              <div className="bg-white rounded-2xl border-2 border-slate-300 p-4 shadow-xl font-mono text-[11px] text-slate-900 space-y-2 max-h-[82vh] overflow-y-auto relative">
                {/* Exact High-Fidelity Vector/Text Header (Georgia / Times New Roman) */}
                <div className="border-b border-slate-950 pb-1 font-serif text-slate-950">
                  <div className="flex items-center justify-between gap-1">
                    {/* Left: Logo Box (53px x 60px) */}
                    <div className="w-[53px] min-w-[53px] h-[60px] flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src={CLINIC_LOGO_BASE64}
                        alt="Logo"
                        className="w-[62px] h-[62px] object-contain block"
                      />
                    </div>

                    {/* Center: Clinic Name (15px) & Subtitle (9px) */}
                    <div className="flex-1 min-w-0 px-0.5 text-left">
                      <div className="text-[15px] leading-[16px] font-bold text-slate-950 whitespace-nowrap tracking-tight">
                        M.Ashraf Khan
                      </div>
                      <div className="text-[9px] leading-[11px] font-bold text-slate-900 whitespace-nowrap mt-0.5">
                        Homeopathic Clinic
                      </div>
                    </div>

                    {/* Right: Address & Contact (9.5px) */}
                    <div className="text-right text-[9.5px] leading-[11.5px] font-semibold text-slate-900 whitespace-nowrap shrink-0">
                      <div>Lajpat Road, Hyderabad</div>
                      <div>Sindh, Pakistan</div>
                      <div className="font-bold">
                        <div>0311 4234777</div>
                        <div>0343 9376363</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meta Information */}
                <div className="border-b border-dashed border-slate-400 pb-2 text-[10px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date: {saleForm.date}</span>
                    <span className="font-bold text-slate-950">Inv: #{saleForm.voucher_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cashier:</span>
                    <span className="font-bold text-slate-900">{saleForm.reference || activeUser}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="font-black text-slate-950 text-[10.5px]">
                      Customer: {saleForm.account_name || (billingType === "patient" ? "Walk-In Patient" : "Wholesale Party")}
                    </span>
                    {billingType === "patient" && saleForm.token_no && (
                      <span className="bg-emerald-800 text-white px-1.5 py-0.5 rounded font-black text-[10px]">
                        Token #: {saleForm.token_no}
                      </span>
                    )}
                  </div>
                  {billingType === "wholesale_party" && (
                    <div className="text-slate-700 font-bold">
                      Party / Route: {saleForm.party_type || "HYD"} {partyCodeSearch ? `(#${partyCodeSearch})` : ""}
                    </div>
                  )}
                </div>

                {/* Items Table — Category-wise compact table */}
                <div className="border-b border-dashed border-slate-400 pb-2">
                  {saleItems.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 italic text-[10px]">
                      -- No medicines in cart --
                    </div>
                  ) : (
                    <table className="w-full text-[9.5px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-900">
                          <th className="text-left font-black uppercase py-0.5 pr-1">Item</th>
                          <th className="text-center font-black uppercase py-0.5 px-0.5 w-6">Qty</th>
                          <th className="text-center font-black uppercase py-0.5 px-0.5 w-10">Rate</th>
                          <th className="text-center font-black uppercase py-0.5 px-0.5 w-8">Dis%</th>
                          <th className="text-right font-black uppercase py-0.5 pl-1 w-12">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saleItems.map((item, i) => (
                          <tr key={i} className="border-b border-dotted border-slate-200">
                            <td className="font-bold text-slate-950 py-0.5 pr-1 leading-tight">
                              <div>{item.medicine_name}</div>
                              {item.product_code && (
                                <div className="text-[8.5px] text-slate-400 font-mono">[{item.product_code}]</div>
                              )}
                            </td>
                            <td className="text-center py-0.5 px-0.5 text-slate-700">{item.qty}</td>
                            <td className="text-center py-0.5 px-0.5 text-slate-700">{Number(item.rate).toLocaleString()}</td>
                            <td className="text-center py-0.5 px-0.5 text-slate-600">
                              {item.disc_pct && item.disc_pct !== "0%" ? item.disc_pct : "-"}
                            </td>
                            <td className="text-right font-mono font-black text-slate-950 py-0.5 pl-1">
                              {Number(item.net).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Totals Summary */}
                <div className="space-y-1 text-[11px] pt-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-bold">
                      Rs. {saleItems.reduce((s, i) => s + Number(i.net || 0), 0).toLocaleString()}
                    </span>
                  </div>
                  {billingType === "patient" && (
                    <div className="flex justify-between text-slate-600">
                      <span>POS Service Fee:</span>
                      <span>Rs. 1</span>
                    </div>
                  )}
                  {billingType === "wholesale_party" && Number(matchedParty?.current_balance || 0) > 0 && (
                    <div className="flex justify-between text-rose-700 font-bold">
                      <span>Purana Udhaar:</span>
                      <span>Rs. {Number(matchedParty?.current_balance || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black border-t-2 border-slate-950 pt-1.5 text-slate-950">
                    <span>GRAND TOTAL:</span>
                    <span className="text-emerald-800">Rs. {totalBillCalculated.toLocaleString()}</span>
                  </div>
                </div>

                {/* Urdu Footer Disclaimer */}
                <div className="border-t border-dashed border-slate-400 pt-2 text-center text-[10px] font-bold text-slate-800 leading-snug">
                  <div>خریدی ہوئی دوا واپس یا تبدیل نہیں ہوگی۔</div>
                </div>

                {/* Doctor Signature Line */}
                <div className="pt-3 pb-1 flex justify-end">
                  <div className="border-t border-slate-900 w-[45%] text-center text-[8.5px] font-black uppercase text-slate-900 pt-0.5">
                    Dr. Signature
                  </div>
                </div>

                {/* Powered By Watermark */}
                <div className="text-center text-[8px] text-slate-400 font-mono border-t border-dotted border-slate-300 pt-1">
                  *** Powered by CliniCore Software ***
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SALE INVOICE _List Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-slate-900 to-emerald-950 p-4 sm:p-5 text-white flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Sale Invoices Logbook</div>
                <h3 className="text-xl font-black flex items-center gap-2">
                  SALE INVOICE <span className="text-sm font-bold opacity-80">_List</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => dbSales.exportCSV(salesHistory)}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setShowListModal(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-base">search</span>
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search by Voucher #, Customer, City, Ref..."
                  className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                {["All", "Credit", "Cash"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setHistoryFilterMode(mode)}
                    className={`px-3 py-1.5 rounded-xl font-black text-xs transition-colors ${
                      historyFilterMode === mode ? "bg-emerald-700 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-black uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Voucher #</th>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-4 py-3">Customer Party</th>
                      <th className="px-3 py-3">City / Mode</th>
                      <th className="px-3 py-3">Ref &amp; Transport</th>
                      <th className="px-3 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-right">Total Bill</th>
                      <th className="px-3 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {salesHistory
                      .filter((s) => {
                        if (historyFilterMode !== "All" && s.payment_mode !== historyFilterMode) return false;
                        if (!historySearch.trim()) return true;
                        const q = historySearch.toLowerCase();
                        return (
                          (s.voucher_no || s.receipt_no || "").toLowerCase().includes(q) ||
                          (s.account_name || s.customer_name || "").toLowerCase().includes(q) ||
                          (s.party_type || s.city || "").toLowerCase().includes(q) ||
                          (s.reference || "").toLowerCase().includes(q)
                        );
                      })
                      .map((sale) => (
                        <tr key={sale.id} className="hover:bg-emerald-50/40 transition-colors">
                          <td className="px-4 py-3 font-mono font-black text-emerald-800">
                            {sale.voucher_no || sale.receipt_no || sale.invoice_no}
                          </td>
                          <td className="px-3 py-3 text-gray-600">
                            {(sale.sale_date || sale.created_at || "").split("T")[0]}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            {sale.account_name || sale.customer_name || "Cash Customer"}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              sale.payment_mode === "Credit" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                            }`}>
                              {sale.payment_mode || "Cash"}
                            </span>
                            {sale.party_type && <span className="ml-1 text-[10px] text-gray-500 font-bold">({sale.party_type})</span>}
                          </td>
                          <td className="px-3 py-3 text-gray-600 text-[11px]">
                            <div>Ref: {sale.reference || "Direct"}</div>
                            <div className="text-[10px] text-gray-400">Tr: {sale.transport || "By Hand"}</div>
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-gray-700">
                            {(sale.items || []).length}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-gray-900">
                            Rs. {(Number(sale.total_amount) || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => printSaleInvoiceReceipt(sale, dbClinic.get())}
                              className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 p-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-colors"
                              title="Print 80mm ESC/POS Thermal Invoice"
                            >
                              <span className="material-symbols-outlined text-base">print</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isPage) {
    return modalBody;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {modalBody}
    </div>,
    document.body
  );
}
