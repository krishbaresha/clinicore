import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { dbSales, dbInventory, dbParties, dbAccounts, dbClinic, dbGrnMetadata, dbVisits, dbPatients, dbUsers, dbTransports, toTitleCase } from "../api/db.js";
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
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  onAddNew,
  addNewLabel = "+ Add New",
  required = false,
  className = "",
  align = "left",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  const selectedOpt = useMemo(() => {
    return options.find((opt) => opt.id === value || opt.label === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter((opt) => {
      const lbl = (opt.label || "").toLowerCase();
      const sub = (opt.sublabel || "").toLowerCase();
      const code = (opt.phone || opt.city || opt.id || "").toLowerCase();
      return lbl.includes(q) || sub.includes(q) || code.includes(q);
    });
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              {addNewLabel.replace(/^\+\s*/, "")}
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
        className={`w-full bg-white border ${isOpen ? "border-emerald-500 ring-1 ring-emerald-200" : "border-gray-300 hover:border-gray-400"} rounded-lg px-2.5 py-1 text-xs font-bold text-left flex items-center justify-between shadow-2xs transition-all`}
      >
        <span className={`truncate flex-1 min-w-0 ${selectedOpt ? "text-gray-900 font-black" : "text-gray-400 font-medium"}`}>
          {selectedOpt ? (
            <span className="flex items-center gap-1.5 min-w-0">
              {selectedOpt.badge && (
                <span className="px-1 py-0.2 rounded text-[8.5px] font-black bg-emerald-100 text-emerald-800 shrink-0">
                  {selectedOpt.badge}
                </span>
              )}
              <span className="truncate flex-1 min-w-0">{selectedOpt.label}</span>
            </span>
          ) : (
            placeholder
          )}
        </span>
        <span className={`material-symbols-outlined text-sm text-gray-500 transition-transform ${isOpen ? "rotate-180 text-emerald-600" : ""}`}>
          arrow_drop_down
        </span>
      </button>

      {/* Expandable Tall Dropdown Popup (10-15 rows visible with scroll - smart alignment to prevent screen clipping) */}
      {isOpen && (
        <div className={`absolute ${align === "right" ? "right-0 left-auto" : "left-0 right-auto"} top-full mt-1.5 bg-white rounded-2xl border border-emerald-300 shadow-2xl z-50 overflow-hidden animate-fade-in flex flex-col max-h-72 min-w-[280px] sm:min-w-[320px] max-w-[85vw]`}>
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
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-56 divide-y divide-gray-50 p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value || opt.label === value;
                return (
                  <button
                    key={opt.id || opt.label}
                    type="button"
                    onClick={() => {
                      onChange(opt.id || opt.label, opt);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-600 text-white font-black shadow-xs"
                        : "hover:bg-emerald-50 text-gray-800 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                            isSelected ? "bg-emerald-700 text-emerald-100" : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      <span className="truncate font-black text-xs shrink-0">{opt.label}</span>
                      {opt.sublabel && (
                        <span className={`text-[10px] font-medium truncate ${isSelected ? "text-emerald-100" : "text-gray-500"}`}>
                          · {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-sm shrink-0">check</span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs font-bold text-gray-400">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SaleInvoiceModal({ isOpen = true, onClose, isPage = false, onSave, initialParty = null, initialBillingType = null }) {
  const { user, activeCashier } = useAuth() || {};
  const activeUser = activeCashier?.name || user?.name || user?.username || "Clinic Administrator";

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
  const [showTransportDropdown, setShowTransportDropdown] = useState(false);

  const registeredDoctors = useMemo(() => {
    try {
      const users = dbUsers.getAll ? dbUsers.getAll() : [];
      const docs = users.filter((u) => u.role === "doctor" || u.is_doctor || u.role === "admin");
      if (docs.length > 0) return docs;
    } catch {}
    const clinic = dbClinic.get();
    return [
      { id: "doc_001", name: clinic.doctor_name || "Dr. M. Ashraf Khan", fee: clinic.doctor_fee || 500 },
    ];
  }, []);

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
    payment_mode: "Cash", // "Cash" | "Credit" | "Easypaisa" | "JazzCash" | "Bank Transfer" | "Cheque"
    bank_name: "",
    cheque_no: "",
    company_filter: "All",
    transport: "",
    bilty_no: "",
    destination_type: "warehouse",
    extra_bill_discount: "0",
    freight_charges: "0",
    attending_doctor_id: "",
    attending_doctor_name: "",
    doctor_fee: "0",
    doctor_fee_waived: false,
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
  const [newPartyForm, setNewPartyForm] = useState({
    party_code: "",
    name: "",
    city: "Hyderabad",
    phone: "",
    address: "",
    balance_due: "0",
  });
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [todayVisits, setTodayVisits] = useState([]);

  // Direct Inline Typeahead Autocomplete State
  const [medicineSearchText, setMedicineSearchText] = useState("");
  const [showMedicineSuggestions, setShowMedicineSuggestions] = useState(false);
  const [highlightedMedIndex, setHighlightedMedIndex] = useState(0);

  const medicineInputRef = useRef(null);
  const medicineInputWrapperRef = useRef(null);
  const suggestionsContainerRef = useRef(null);

  const productCodeInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const rateInputRef = useRef(null);
  const customerNameInputRef = useRef(null);
  const narationInputRef = useRef(null);
  const partyCodeInputRef = useRef(null);
  const cityInputRef = useRef(null);
  const transportInputRef = useRef(null);
  const biltyInputRef = useRef(null);
  const bankNameInputRef = useRef(null);
  const chequeNoInputRef = useRef(null);
  const discPctInputRef = useRef(null);
  const discFlatInputRef = useRef(null);
  const saleItemsEndRef = useRef(null);
  const tableContainerRef = useRef(null);
  const cashPaidInputRef = useRef(null);

  // Focus next input field helper for seamless Enter key navigation
  const handleGenericEnterNext = (e, nextRef) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
        if (nextRef.current.select) nextRef.current.select();
      }
    }
  };

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

  useEffect(() => {
    if (initialBillingType) {
      setBillingType(initialBillingType);
    }
    if (initialParty) {
      setBillingType("wholesale_party");
      const code = initialParty.party_code || initialParty.id || "";
      setPartyCodeSearch(code);
      setSaleForm((prev) => ({
        ...prev,
        account_name: initialParty.name || initialParty.account_name || "",
        buyer_id: initialParty.id || "",
        party_type: initialParty.city || "Hyderabad",
      }));
    }
  }, [initialParty, initialBillingType]);

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
      let displayName = matchedVisit.patient_name || pat?.full_name || pat?.name || "Patient";
      const relation = pat?.relation_name
        ? `${pat.relation || "s/o"} ${pat.relation_name}`
        : (pat?.guardian_name ? `${pat.relationship || "s/o"} ${pat.guardian_name}` : "");
      if (relation && !displayName.includes(relation)) {
        displayName = `${displayName} (${relation})`;
      }
      setSaleForm((prev) => ({
        ...prev,
        account_name: displayName,
        visit_id: matchedVisit.id,
        patient_id: matchedVisit.patient_id,
        naration: relation ? `Relation: ${relation}` : "",
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

  const matchedPatient = useMemo(() => {
    if (billingType !== "patient") return null;
    if (saleForm.patient_id) {
      return dbPatients.getById(saleForm.patient_id);
    }
    if (saleForm.account_name) {
      const lower = saleForm.account_name.toLowerCase().trim();
      return dbPatients.getAll().find((p) => {
        const pName = (p.full_name || p.name || "").toLowerCase().trim();
        return pName && (lower.includes(pName) || pName.includes(lower));
      }) || null;
    }
    return null;
  }, [billingType, saleForm.patient_id, saleForm.account_name]);

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  // Companies & Brand Codes List for filtering
  const companyOptions = useMemo(() => {
    const list = [{ id: "All", label: "🏢 All Companies / Brands", code: "ALL" }];
    const seen = new Set(["all"]);

    inventoryList.forEach((i) => {
      const comp = (i.company_name || "").trim();
      const code = (i.item_code || "").trim().toUpperCase();
      const key = comp.toLowerCase();
      if (comp && !seen.has(key)) {
        seen.add(key);
        list.push({
          id: comp,
          label: `${code ? `[${code}] ` : ""}${comp}`,
          code: code || comp.slice(0, 3).toUpperCase(),
          name: comp,
        });
      }
    });
    return list;
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
    const registeredStaff = (dbUsers.getAll() || []).map((u) => u.name || u.full_name).filter(Boolean);
    const combined = Array.from(new Set([activeUser, ...registeredStaff, ...referencesList])).filter(Boolean);
    return combined.map((r) => {
      const isCurrentActive = r === (activeCashier?.name || activeUser);
      return {
        id: r,
        label: r,
        badge: isCurrentActive ? "⭐ Active POS" : "👤 Staff",
      };
    });
  }, [referencesList, activeUser, activeCashier]);

  const transportOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    (transportsList || []).forEach((t) => {
      const formatted = toTitleCase(t);
      if (formatted && !seen.has(formatted.toLowerCase())) {
        seen.add(formatted.toLowerCase());
        list.push({
          id: formatted,
          label: formatted,
          badge: "🚚 Carrier",
        });
      }
    });
    return list;
  }, [transportsList]);

  // Filtered Products by Company / Brand Code
  const filteredProducts = useMemo(() => {
    if (!selectedCompany || selectedCompany === "All" || selectedCompany === "ALL") {
      return inventoryList;
    }
    const q = selectedCompany.toLowerCase().trim();
    return inventoryList.filter(
      (inv) =>
        (inv.company_name || "").toLowerCase().includes(q) ||
        (inv.item_code || "").toLowerCase() === q ||
        (inv.item_code || "").toLowerCase().startsWith(q) ||
        (inv.category || "").toLowerCase().includes(q)
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

  // Scored Direct Inline Typeahead Autocomplete Suggestions (Strict Prefix-First Shortening)
  const typeaheadSuggestions = useMemo(() => {
    if (!medicineSearchText || !medicineSearchText.trim()) {
      return filteredProducts.slice(0, 20);
    }
    const rawQ = medicineSearchText.trim().toLowerCase();
    const cleanQ = rawQ.replace(/[\s\-_./]/g, "");

    // Tier 1: Exact start-with / prefix matches on Name, Code, or Words
    const prefixMatches = [];
    // Tier 2: Substring matches (Only used if 0 prefix matches found)
    const substringMatches = [];

    filteredProducts.forEach((inv) => {
      const name = (inv.medicine_name || "").toLowerCase();
      const cleanName = name.replace(/[\s\-_./]/g, "");
      const code = (inv.item_code || "").toLowerCase();
      const cleanCode = code.replace(/[\s\-_./]/g, "");
      const generic = (inv.generic_name || "").toLowerCase();

      // Check strict prefix on code or name
      const codeExact = code === rawQ || (cleanQ.length > 0 && cleanCode === cleanQ);
      const nameExact = name === rawQ || (cleanQ.length > 0 && cleanName === cleanQ);
      const codeStartsWith = code.startsWith(rawQ) || (cleanQ.length > 0 && cleanCode.startsWith(cleanQ));
      const nameStartsWith = name.startsWith(rawQ) || (cleanQ.length > 0 && cleanName.startsWith(cleanQ));

      // Check if any word starts with query (e.g. "Syrup T-1" -> "T-1")
      const words = name.split(/[\s\-_/]+/);
      const wordStartsWith = words.some((w) => w.startsWith(rawQ) || (cleanQ.length > 0 && w.replace(/[\s\-_./]/g, "").startsWith(cleanQ)));

      if (codeExact || nameExact || codeStartsWith || nameStartsWith || wordStartsWith) {
        let rank = 0;
        if (codeExact) rank = 100;
        else if (nameExact) rank = 90;
        else if (codeStartsWith) rank = 80;
        else if (nameStartsWith) rank = 70;
        else rank = 60;

        prefixMatches.push({ inv, rank });
      } else if (name.includes(rawQ) || code.includes(rawQ) || (generic && generic.includes(rawQ))) {
        substringMatches.push(inv);
      }
    });

    // If prefix matches exist, ONLY return prefix matches sorted by rank + natural alpha-numeric sort
    if (prefixMatches.length > 0) {
      return prefixMatches
        .sort((a, b) => {
          if (b.rank !== a.rank) return b.rank - a.rank;
          return (a.inv.medicine_name || "").localeCompare(b.inv.medicine_name || "", undefined, { numeric: true, sensitivity: "base" });
        })
        .slice(0, 25)
        .map((m) => m.inv);
    }

    // Fallback only if no prefix matches exist
    return substringMatches
      .sort((a, b) => (a.medicine_name || "").localeCompare(b.medicine_name || "", undefined, { numeric: true, sensitivity: "base" }))
      .slice(0, 15);
  }, [filteredProducts, medicineSearchText]);

  // Click Outside Listener for Typeahead Suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        medicineInputWrapperRef.current &&
        !medicineInputWrapperRef.current.contains(e.target)
      ) {
        setShowMedicineSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // POS Master Global Keyboard Shortcuts Listener (F4: Switch Mode, F8: Cash, F9: Save & Print, Alt+N: Medicine, Esc: Close)
  useEffect(() => {
    const handleGlobalPOSKeyDown = (e) => {
      // Don't intercept if child sub-modals are active
      if (showListModal || showNewPartyModal || showSalesmanPinModal) return;

      // F4: Switch Billing Mode (Patient <-> Wholesale B2B)
      if (e.key === "F4") {
        e.preventDefault();
        setBillingType((prev) => (prev === "patient" ? "wholesale_party" : "patient"));
      }
      // F8: Focus Cash Paid Input
      else if (e.key === "F8") {
        e.preventDefault();
        cashPaidInputRef.current?.focus();
        if (cashPaidInputRef.current?.select) cashPaidInputRef.current.select();
      }
      // F9: Save & Print Invoice
      else if (e.key === "F9") {
        e.preventDefault();
        handleSaveSaleBill();
      }
      // Alt + N: Focus Medicine Search Input Bar
      else if ((e.altKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        medicineInputRef.current?.focus();
        if (medicineInputRef.current?.select) medicineInputRef.current.select();
      }
      // Escape: Close Sale Invoice Modal
      else if (e.key === "Escape") {
        e.preventDefault();
        if (onClose) onClose();
      }
    };

    window.addEventListener("keydown", handleGlobalPOSKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalPOSKeyDown);
  }, [billingType, showListModal, showNewPartyModal, showSalesmanPinModal, saleItems, saleForm, onClose]);

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

  // Save New Party directly from Sale Invoice Modal without leaving page
  const handleSaveNewParty = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newPartyForm.name.trim()) {
      alert("Please enter Party / Store Name.");
      return;
    }

    const created = dbParties.add({
      party_code: newPartyForm.party_code.trim(),
      name: newPartyForm.name.trim(),
      party_name: newPartyForm.name.trim(),
      city: newPartyForm.city.trim() || "Hyderabad",
      territory: newPartyForm.city.trim() || "Hyderabad",
      phone: newPartyForm.phone.trim(),
      address: newPartyForm.address.trim(),
      balance_due: Number(newPartyForm.balance_due) || 0,
      current_balance: Number(newPartyForm.balance_due) || 0,
      opening_balance: Number(newPartyForm.balance_due) || 0,
    });

    // Auto-sync into unified dbAccounts
    const existingAcc = dbAccounts.getAll().find((a) => a.account_name.toLowerCase() === created.name.toLowerCase());
    if (!existingAcc) {
      dbAccounts.add({
        account_name: created.name,
        account_no: created.party_code || dbAccounts.getNextAccountNo(),
        naration: `${created.city || ""} (${created.phone || ""}) ${created.address || ""}`.trim(),
        account_type: created.city || "Wholesale Party",
        opening_balance: Number(created.balance_due) || 0,
        date: new Date().toLocaleDateString("en-US"),
      });
    }

    // Refresh lists
    const updatedParties = dbParties.getAll();
    setPartiesList(updatedParties);
    setAccountsList(dbAccounts.getAll());

    // Auto-select this newly created party into saleForm
    const city = created.city || "HYD";
    const phone = created.phone || "";
    const narationStr = `${city}${phone ? ` (${phone})` : ""} LED`;
    setSaleForm((prev) => ({
      ...prev,
      account_name: created.name,
      buyer_id: created.id || "",
      naration: narationStr,
      party_type: city,
    }));
    if (created.party_code) {
      setPartyCodeSearch(created.party_code);
    }

    setShowNewPartyModal(false);
    setNewPartyForm({
      party_code: "",
      name: "",
      city: "Hyderabad",
      phone: "",
      address: "",
      balance_due: "0",
    });
    setSaveSuccessMsg(`✅ Party "${created.name}" registered & auto-linked!`);
    setTimeout(() => setSaveSuccessMsg(""), 4000);
  };

  // Select Product from Typeahead Suggestions
  const handleSelectTypeaheadMedicine = (inv) => {
    if (!inv) return;
    const rate = Number(inv.unit_sale_price || inv.sale_price || inv.box_sale_price) || 0;
    const qty = Number(saleCart.qty) || 1;
    const gross = Math.round(qty * rate);
    const discPct = saleCart.disc_pct === "" || saleCart.disc_pct === undefined ? 40 : (Number(saleCart.disc_pct) || 0);
    const discFlat = Number(saleCart.disc_flat) || 0;
    const net = Math.round(Math.max(0, gross - (gross * (discPct / 100)) - discFlat));

    setMedicineSearchText(inv.medicine_name || "");
    setShowMedicineSuggestions(false);
    setHighlightedMedIndex(0);

    setSaleCart({
      product_code: inv.item_code || "",
      medicine_name: inv.medicine_name,
      company_name: inv.company_name || "",
      category: inv.category || inv.medicine_category || inv.company_name || "General",
      packing: inv.packing || "",
      inventory_id: inv.id,
      qty: String(qty),
      rate: String(rate),
      gross: String(gross),
      disc_pct: String(discPct),
      disc_flat: String(discFlat),
      net_amount: String(net),
    });

    setTimeout(() => {
      qtyInputRef.current?.focus();
      if (qtyInputRef.current?.select) qtyInputRef.current.select();
    }, 40);
  };

  // Helper to accurately scroll typeahead suggestions
  const scrollItemIntoView = (index) => {
    const container = suggestionsContainerRef.current;
    if (!container) return;
    if (index <= 0) {
      container.scrollTop = 0;
      return;
    }
    const itemEl = document.getElementById(`med-sugg-${index}`);
    if (!itemEl) return;

    const itemOffsetTop = itemEl.offsetTop;
    const itemHeight = itemEl.offsetHeight;
    const containerScrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const headerHeight = 28;

    if (itemOffsetTop - headerHeight < containerScrollTop) {
      container.scrollTop = Math.max(0, itemOffsetTop - headerHeight);
    } else if (itemOffsetTop + itemHeight > containerScrollTop + containerHeight) {
      container.scrollTop = itemOffsetTop + itemHeight - containerHeight;
    }
  };

  // Keyboard navigation on Product Name input
  const handleMedicineKeyDown = (e) => {
    if (!showMedicineSuggestions || typeaheadSuggestions.length === 0) {
      if (e.key === "ArrowDown" || (e.key === "Enter" && !saleCart.inventory_id)) {
        setShowMedicineSuggestions(true);
      } else if (e.key === "Enter") {
        e.preventDefault();
        qtyInputRef.current?.focus();
        if (qtyInputRef.current?.select) qtyInputRef.current.select();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedMedIndex((prev) => {
        const next = Math.min(typeaheadSuggestions.length - 1, prev + 1);
        scrollItemIntoView(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedMedIndex((prev) => {
        const next = Math.max(0, prev - 1);
        scrollItemIntoView(next);
        return next;
      });
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (typeaheadSuggestions[highlightedMedIndex]) {
        e.preventDefault();
        handleSelectTypeaheadMedicine(typeaheadSuggestions[highlightedMedIndex]);
      }
    } else if (e.key === "Escape") {
      setShowMedicineSuggestions(false);
    }
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
      const rate = Number(match.unit_sale_price || match.sale_price || match.box_sale_price) || 0;
      const qty = Number(saleCart.qty) || 1;
      const gross = Math.round(qty * rate);
      const discPct = saleCart.disc_pct === "" || saleCart.disc_pct === undefined ? 40 : (Number(saleCart.disc_pct) || 0);
      const discFlat = Number(saleCart.disc_flat) || 0;
      const net = Math.round(Math.max(0, gross - (gross * (discPct / 100)) - discFlat));

      setMedicineSearchText(match.medicine_name || "");
      setShowMedicineSuggestions(false);

      setSaleCart({
        product_code: match.item_code || codeVal,
        medicine_name: match.medicine_name,
        company_name: match.company_name || "",
        category: match.category || match.medicine_category || match.company_name || "General",
        packing: match.packing || "",
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

  // Select Product Name from Dropdown (fallback compatibility)
  const handleSelectProduct = (invId, opt) => {
    if (!invId) {
      setSaleCart((prev) => ({ ...prev, inventory_id: "", medicine_name: "", company_name: "", product_code: "", category: "", packing: "", rate: "", gross: "", net_amount: "" }));
      setMedicineSearchText("");
      return;
    }
    const inv = opt?.raw || inventoryList.find((i) => i.id === invId);
    if (!inv) return;
    handleSelectTypeaheadMedicine(inv);
  };

  const handleUpdateCartMath = (field, val) => {
    setSaleCart((prev) => {
      const updated = { ...prev, [field]: val };
      const q = Number(field === "qty" ? val : updated.qty) || 0;
      const r = Number(field === "rate" ? val : updated.rate) || 0;
      const gross = Math.round(q * r);
      const dPct = Number(field === "disc_pct" ? val : updated.disc_pct) || 0;
      const dFlat = Number(field === "disc_flat" ? val : updated.disc_flat) || 0;
      const net = Math.round(Math.max(0, gross - (gross * (dPct / 100)) - dFlat));
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
    const gross = Math.round(q * r);
    const dPct = Number(saleCart.disc_pct) || 0;
    const dFlat = Number(saleCart.disc_flat) || 0;
    const net = Math.round(Math.max(0, gross - (gross * (dPct / 100)) - dFlat));

    const newItem = {
      id: "sale_item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      inventory_id: saleCart.inventory_id || "",
      product_code: saleCart.product_code || "",
      medicine_name: saleCart.medicine_name.trim(),
      company_name: saleCart.company_name || "",
      category: saleCart.category || "General",
      packing: saleCart.packing || "",
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
      company_name: "",
      inventory_id: "",
      category: "",
      packing: "",
      qty: "1",
      rate: "",
      gross: "",
      disc_pct: "40",
      disc_flat: "0",
      net_amount: "",
    });
    setMedicineSearchText("");
    setShowMedicineSuggestions(false);
    setHighlightedMedIndex(0);
    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
      }
      if (saleItemsEndRef.current) {
        saleItemsEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      medicineInputRef.current?.focus();
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
    const docFee = (billingType === "patient" && saleForm.attending_doctor_id && !saleForm.doctor_fee_waived)
      ? (Number(saleForm.doctor_fee) || 0)
      : 0;
    return Math.round(Math.max(0, subtotal + docFee - extraDisc + freight + posFee));
  }, [saleItems, saleForm.extra_bill_discount, saleForm.freight_charges, saleForm.attending_doctor_id, saleForm.doctor_fee, saleForm.doctor_fee_waived, billingType]);

  const puranaUdhaar = useMemo(() => {
    if (billingType === "wholesale_party") {
      return Math.round(Number(matchedParty?.current_balance || matchedParty?.opening_balance || 0));
    }
    if (billingType === "patient") {
      return Math.round(Number(matchedPatient?.balance_due || matchedPatient?.current_balance || matchedPatient?.pending_balance || 0));
    }
    return 0;
  }, [billingType, matchedParty, matchedPatient]);

  const grandPayable = Math.round(puranaUdhaar > 0 ? (totalBillCalculated + puranaUdhaar) : totalBillCalculated);
  const isUdhaarMode = saleForm.payment_mode === "Credit";
  const cashPaidNum = Math.round(saleForm.cash_received !== undefined && saleForm.cash_received !== "" && !isNaN(Number(saleForm.cash_received))
    ? Number(saleForm.cash_received)
    : (isUdhaarMode ? 0 : totalBillCalculated));
  const changeReturnCalculated = Math.round(Math.max(0, cashPaidNum - grandPayable));
  const remainingCalculated = Math.round(Math.max(0, grandPayable - cashPaidNum));

  const groupedSaleItems = useMemo(() => {
    const order = [];
    const map = new Map();
    saleItems.forEach((item) => {
      const cat = String(item.category || item.medicine_category || "General").trim() || "General";
      if (!map.has(cat)) {
        map.set(cat, []);
        order.push(cat);
      }
      map.get(cat).push(item);
    });
    return order.map((category) => ({ category, items: map.get(category) }));
  }, [saleItems]);

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

  // Instant Print Current Slip (without resetting)
  const handlePrintCurrentReceipt = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (saleItems.length === 0) {
      setSaveSuccessMsg("❌ Please add at least 1 medicine item to print.");
      setTimeout(() => setSaveSuccessMsg(""), 3500);
      return;
    }
    const resolvedAccountName = saleForm.account_name.trim() || (billingType === "patient" ? "Walk-In Patient" : "Walk-In Customer");
    const itemsSubtotal = saleItems.reduce((sum, item) => sum + (Number(item.net) || 0), 0);
    const extraDisc = Number(saleForm.extra_bill_discount) || 0;
    const freight = Number(saleForm.freight_charges) || 0;
    const grandTotal = totalBillCalculated;
    const partyBalance = puranaUdhaar;

    const tempSale = {
      ...saleForm,
      billing_type: billingType,
      account_name: resolvedAccountName,
      items: saleItems,
      subtotal: itemsSubtotal,
      extra_discount: extraDisc,
      freight_charges: freight,
      pos_service_fee: posServiceFee,
      previous_balance: partyBalance,
      purana_udhaar: partyBalance,
      party_balance: partyBalance,
      total_amount: grandTotal,
      paid_amount: cashPaidNum,
      cash_received: saleForm.cash_received,
      change_return: changeReturnCalculated,
      balance_due: remainingCalculated,
    };

    const clinic = dbClinic.get();
    try {
      printSaleInvoiceReceipt(tempSale, clinic);
      setSaveSuccessMsg(`🖨️ Printing thermal receipt for #${saleForm.voucher_no}...`);
      setTimeout(() => setSaveSuccessMsg(""), 4000);
    } catch (err) {
      console.warn("Print error:", err);
    }
  };

  // Save Sale Invoice Bill & Print
  const handleSaveSaleBill = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (saleItems.length === 0) {
      setSaveSuccessMsg("❌ Please add at least 1 medicine item to the sale cart before saving.");
      setTimeout(() => setSaveSuccessMsg(""), 3500);
      return;
    }

    // Auto-fallback customer name so walk-in sales never get blocked
    const resolvedAccountName = toTitleCase(saleForm.account_name.trim()) || (billingType === "patient" ? "Walk-In Patient" : "Walk-In Customer");

    const itemsSubtotal = saleItems.reduce((sum, item) => sum + (Number(item.net) || 0), 0);
    const extraDisc = Number(saleForm.extra_bill_discount) || 0;
    const freight = Number(saleForm.freight_charges) || 0;
    const grandTotal = totalBillCalculated;
    const partyBalance = puranaUdhaar;

    // Title-Case Transport & Clean Bilty #
    const formattedTransport = saleForm.transport && saleForm.transport.trim() ? toTitleCase(saleForm.transport) : "";
    const cleanBiltyNo = saleForm.bilty_no && saleForm.bilty_no.trim() && saleForm.bilty_no.trim() !== "0" ? saleForm.bilty_no.trim() : "";

    if (formattedTransport) {
      dbTransports.addTransport(formattedTransport);
    }

    const createdSale = dbSales.addSaleInvoice({
      ...saleForm,
      transport: formattedTransport,
      bilty_no: cleanBiltyNo,
      billing_type: billingType,
      account_name: resolvedAccountName,
      items: saleItems,
      subtotal: itemsSubtotal,
      extra_discount: extraDisc,
      freight_charges: freight,
      pos_service_fee: posServiceFee,
      previous_balance: partyBalance,
      purana_udhaar: partyBalance,
      party_balance: partyBalance,
      total_amount: grandTotal,
      paid_amount: cashPaidNum,
      cash_received: saleForm.cash_received,
      change_return: changeReturnCalculated,
      balance_due: remainingCalculated,
    });

    // Update Patient or Party balance in persistent ledger
    if (billingType === "patient" && (saleForm.patient_id || matchedPatient?.id)) {
      const targetPatId = saleForm.patient_id || matchedPatient?.id;
      dbPatients.update(targetPatId, {
        balance_due: remainingCalculated,
        current_balance: remainingCalculated,
      });
    } else if (billingType === "wholesale_party" && (matchedParty?.id || saleForm.buyer_id)) {
      const targetPartyId = matchedParty?.id || saleForm.buyer_id;
      dbParties.update(targetPartyId, {
        balance_due: remainingCalculated,
        current_balance: remainingCalculated,
      });
      const acc = dbAccounts.getAll().find((a) => a.account_name.toLowerCase() === (saleForm.account_name || "").toLowerCase());
      if (acc) {
        dbAccounts.update(acc.id, {
          opening_balance: remainingCalculated,
        });
      }
    }

    // ✅ Trigger thermal print (non-blocking iframe)
    const clinic = dbClinic.get();
    try {
      printSaleInvoiceReceipt(createdSale, clinic);
    } catch (err) {
      console.warn("Print error:", err);
    }

    // Non-blocking success toast
    setSaveSuccessMsg(`✅ Invoice ${createdSale.voucher_no} saved! Printing thermal receipt...`);
    setTimeout(() => setSaveSuccessMsg(""), 4500);

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
      cash_received: "",
      extra_bill_discount: "0",
      freight_charges: "0",
    }));
    setPartyCodeSearch("");
    refreshData();
    if (onSave) onSave(createdSale);
  };

  // Global Keydown Shortcut Listener (F9 -> Save & Print, F8 -> Jump to Cash Paid)
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e) => {
      if (e.key === "F9") {
        e.preventDefault();
        handleSaveSaleBill();
      } else if (e.key === "F8" || (e.altKey && (e.key === "c" || e.key === "C"))) {
        e.preventDefault();
        cashPaidInputRef.current?.focus();
        if (cashPaidInputRef.current?.select) cashPaidInputRef.current.select();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, saleItems, saleForm, billingType, puranaUdhaar, cashPaidNum, totalBillCalculated, handleSaveSaleBill]);

  if (!isOpen) return null;

  const modalBody = (
    <>
      <div className={`bg-white w-full ${isPage ? 'rounded-2xl shadow-sm border border-emerald-300 h-full max-h-full flex-1 min-h-0' : 'max-w-[98vw] 2xl:max-w-[1550px] rounded-3xl shadow-2xl border border-emerald-300 my-auto h-[95vh] max-h-[95vh]'} overflow-hidden flex flex-col`}>
        {/* Visual Green Gradient Header (Compact 48px) */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 px-4 py-2 text-white flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <span className="material-symbols-outlined text-xl">point_of_sale</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/25 text-emerald-100 border border-white/20">
                  Wholesale &amp; Retail POS
                </span>
                <span className="text-[9px] font-bold text-emerald-200">DrCreate Cockpit</span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                SALE INVOICE <span className="text-xs font-bold opacity-80">_Form</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowListModal(true)}
              className="bg-slate-900/80 hover:bg-slate-900 text-white px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-xs flex items-center gap-1 border border-white/20"
            >
              <span className="material-symbols-outlined text-sm">list_alt</span>
              Invoices List
            </button>
            <button
              type="button"
              onClick={handleSaveSaleBill}
              className="bg-white text-emerald-800 hover:bg-emerald-50 px-4 py-1.5 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              Save &amp; Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Viewport-Fit Non-Scroll Body (Left POS Cockpit + Right Live Thermal Receipt) */}
        <div className="p-2 sm:p-2.5 overflow-hidden flex-1 min-h-0 bg-slate-50/60">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 h-full min-h-0 overflow-hidden">
            
            {/* Left Main Form Column (8 cols on XL screens) */}
            <div className="xl:col-span-8 flex flex-col h-full min-h-0 space-y-2 overflow-hidden">
              
              {/* Section 1: Customer & Party Details Bar (Compact) */}
              <div className="shrink-0 bg-emerald-50/40 border border-emerald-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-emerald-200 pb-1.5">
                  <div className="text-[11px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                    <span className="material-symbols-outlined text-sm text-emerald-700">receipt_long</span>
                    <span>Customer &amp; Party Details</span>
                    
                    {/* Visual Shortcut Key Badges Bar */}
                    <div className="hidden sm:flex items-center gap-1 ml-2">
                      <span className="bg-emerald-900/10 text-emerald-950 font-bold px-1.5 py-0.2 rounded text-[9px] border border-emerald-300 font-mono">F4: Mode</span>
                      <span className="bg-emerald-900/10 text-emerald-950 font-bold px-1.5 py-0.2 rounded text-[9px] border border-emerald-300 font-mono">F8: Cash</span>
                      <span className="bg-emerald-900/10 text-emerald-950 font-bold px-1.5 py-0.2 rounded text-[9px] border border-emerald-300 font-mono">F9: Save &amp; Print</span>
                      <span className="bg-emerald-900/10 text-emerald-950 font-bold px-1.5 py-0.2 rounded text-[9px] border border-emerald-300 font-mono">Alt+N: Medicine</span>
                    </div>
                  </div>

                  {/* Billing Mode Switcher */}
                  <div className="inline-flex bg-emerald-100/90 p-0.5 rounded-lg text-xs font-bold border border-emerald-300 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setBillingType("patient")}
                      title="Press F4 to toggle billing mode"
                      className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-black transition-all cursor-pointer ${billingType === "patient"
                          ? "bg-emerald-800 text-white shadow-xs"
                          : "text-emerald-900 hover:text-emerald-950"
                        }`}
                    >
                      👤 Patient / Walk-In
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingType("wholesale_party")}
                      title="Press F4 to toggle billing mode"
                      className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-black transition-all cursor-pointer ${billingType === "wholesale_party"
                          ? "bg-amber-800 text-white shadow-xs"
                          : "text-amber-900 hover:text-amber-950"
                        }`}
                    >
                      🏢 Wholesale B2B Party
                    </button>
                  </div>
                </div>

                {billingType === "patient" ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-1.5 items-end">
                      <div className="md:col-span-2">
                        <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5">Date (Locked)</label>
                        <input
                          type="text"
                          readOnly={true}
                          value={saleForm.date}
                          className="w-full bg-gray-100 border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-700"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[9.5px] font-bold text-emerald-950 mb-0.5">Invoice #</label>
                        <input
                          type="text"
                          readOnly={true}
                          value={saleForm.voucher_no}
                          className="w-full bg-emerald-100/80 border border-emerald-300 rounded-lg px-2 py-1 text-xs font-black text-emerald-950 font-mono"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[9.5px] font-bold text-teal-800 mb-0.5">Token #</label>
                        <input
                          type="text"
                          value={saleForm.token_no}
                          onChange={(e) => handleTokenNumberChange(e.target.value)}
                          placeholder="e.g. 14, T-05"
                          className="w-full bg-teal-50 border border-teal-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-teal-950 text-center"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-2 md:col-span-4">
                        <label className="block text-[9.5px] font-bold text-gray-700 mb-0.5">
                          Patient / Customer Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          ref={customerNameInputRef}
                          type="text"
                          required={true}
                          value={saleForm.account_name}
                          onChange={(e) => setSaleForm({ ...saleForm, account_name: e.target.value })}
                          onBlur={() => {
                            if (saleForm.account_name) {
                              setSaleForm((prev) => ({ ...prev, account_name: toTitleCase(prev.account_name) }));
                            }
                          }}
                          onKeyDown={(e) => handleGenericEnterNext(e, narationInputRef)}
                          placeholder="Enter Patient or Walk-In Name..."
                          className="w-full bg-white border border-emerald-400 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-900 focus:border-emerald-600"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-2 md:col-span-2">
                        <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5">Relation / Info</label>
                        <input
                          ref={narationInputRef}
                          type="text"
                          value={saleForm.naration}
                          onChange={(e) => setSaleForm({ ...saleForm, naration: e.target.value })}
                          onKeyDown={(e) => handleGenericEnterNext(e, medicineInputRef)}
                          placeholder="e.g. s/o, w/o..."
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 text-xs font-medium text-gray-800"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-4 md:col-span-3 flex items-end gap-1">
                        <div className="flex-1 min-w-0">
                          <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5">Payment Mode</label>
                          <select
                            value={saleForm.payment_mode || "Cash"}
                            onChange={(e) => setSaleForm({ ...saleForm, payment_mode: e.target.value })}
                            className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                          >
                            <option value="Cash">💵 Cash</option>
                            <option value="Credit">📜 Credit / Udhaar</option>
                            <option value="Easypaisa">📱 Easypaisa</option>
                            <option value="JazzCash">📱 JazzCash</option>
                            <option value="Bank Transfer">🏦 Bank Transfer</option>
                          </select>
                        </div>
                        {saleForm.payment_mode === "Bank Transfer" && (
                          <div className="flex-1 min-w-0">
                            <label className="block text-[9.5px] font-bold text-teal-800 mb-0.5">Bank Name</label>
                            <input
                              type="text"
                              value={saleForm.bank_name || ""}
                              onChange={(e) => setSaleForm({ ...saleForm, bank_name: e.target.value })}
                              onBlur={() => {
                                if (saleForm.bank_name) {
                                  setSaleForm((prev) => ({ ...prev, bank_name: toTitleCase(prev.bank_name) }));
                                }
                              }}
                              placeholder="e.g. Meezan, HBL..."
                              className="w-full bg-teal-50 border border-teal-300 rounded-lg px-2 py-1 text-xs font-bold text-teal-950 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Attending Doctor, Consultation Fee & Fee Waived Checkbox */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-1.5 items-end pt-1 border-t border-emerald-100">
                      <div className="col-span-2 sm:col-span-2 md:col-span-5">
                        <label className="block text-[9.5px] font-bold text-teal-900 mb-0.5 flex items-center justify-between">
                          <span>Attending Doctor (Consultant)</span>
                          {saleForm.attending_doctor_name && (
                            <span className="text-[9px] text-teal-700 font-bold">✓ Selected</span>
                          )}
                        </label>
                        <select
                          value={saleForm.attending_doctor_id || ""}
                          onChange={(e) => {
                            const docId = e.target.value;
                            const selectedDoc = registeredDoctors.find((d) => d.id === docId || d.name === docId || d.full_name === docId);
                            const fee = selectedDoc ? (selectedDoc.consultation_fee || selectedDoc.fee || 500) : 0;
                            setSaleForm((prev) => ({
                              ...prev,
                              attending_doctor_id: docId,
                              attending_doctor_name: selectedDoc ? (selectedDoc.name || selectedDoc.full_name) : (docId ? docId : ""),
                              doctor_fee: String(fee),
                            }));
                          }}
                          className="w-full bg-teal-50/70 border border-teal-300 rounded-lg px-2 py-1 text-xs font-bold text-teal-950 focus:border-teal-600 outline-none cursor-pointer"
                        >
                          <option value="">-- Select Registered Doctor --</option>
                          {registeredDoctors.map((doc) => (
                            <option key={doc.id || doc.name} value={doc.id || doc.name}>
                              👨‍⚕️ {doc.name || doc.full_name} (Fee: Rs. {doc.consultation_fee || doc.fee || 500})
                            </option>
                          ))}
                        </select>
                      </div>

                      {saleForm.attending_doctor_id && (
                        <>
                          <div className="col-span-1 sm:col-span-1 md:col-span-3">
                            <label className="block text-[9.5px] font-bold text-slate-700 mb-0.5">
                              Dr Fee (Rs)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={saleForm.doctor_fee || "0"}
                              onChange={(e) => setSaleForm({ ...saleForm, doctor_fee: e.target.value })}
                              disabled={saleForm.doctor_fee_waived}
                              className={`w-full border rounded-lg px-2 py-1 text-xs font-mono font-bold ${
                                saleForm.doctor_fee_waived
                                  ? "bg-slate-100 text-slate-400 line-through border-slate-200"
                                  : "bg-white text-slate-900 border-teal-400"
                              }`}
                            />
                          </div>

                          <div className="col-span-1 sm:col-span-1 md:col-span-4 flex items-center pb-0.5">
                            <label className={`inline-flex items-center gap-1.5 border px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                              saleForm.doctor_fee_waived
                                ? "bg-rose-100 border-rose-400 text-rose-950 font-black shadow-2xs"
                                : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                            }`}>
                              <input
                                type="checkbox"
                                checked={Boolean(saleForm.doctor_fee_waived)}
                                onChange={(e) => setSaleForm({ ...saleForm, doctor_fee_waived: e.target.checked })}
                                className="w-3.5 h-3.5 text-rose-600 rounded border-rose-300 focus:ring-rose-500 cursor-pointer"
                              />
                              <span className="text-[10px] uppercase tracking-tight font-bold">
                                {saleForm.doctor_fee_waived ? "❌ Fee Waived (Free)" : "Fee Charged"}
                              </span>
                            </label>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Matched Patient Udhaar Banner */}
                    {matchedPatient && (
                      <div className="bg-teal-50 border border-teal-300 rounded-lg px-3 py-1 flex items-center justify-between text-xs text-teal-950 gap-2 shadow-2xs mt-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="material-symbols-outlined text-base text-teal-700">person</span>
                          <span>{matchedPatient.full_name || matchedPatient.name}</span>
                          {(matchedPatient.relation_name || matchedPatient.guardian_name) && (
                            <span className="text-[10px] text-teal-800 bg-teal-100/80 px-1.5 py-0.2 rounded border border-teal-200">
                              {matchedPatient.relation || "s/o"} {matchedPatient.relation_name || matchedPatient.guardian_name}
                            </span>
                          )}
                          {matchedPatient.mr_number && (
                            <span className="text-[10px] font-mono bg-white px-1.5 py-0.2 rounded border border-teal-300">
                              {matchedPatient.mr_number}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[10px] uppercase font-bold text-slate-600">Previous Udhaar:</span>
                          <span className={`text-xs font-black ${Number(matchedPatient.balance_due || matchedPatient.current_balance || matchedPatient.pending_balance || 0) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                            Rs. {Number(matchedPatient.balance_due || matchedPatient.current_balance || matchedPatient.pending_balance || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-1.5 items-end">
                      <div className="md:col-span-2">
                        <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5">Date (Locked)</label>
                        <input
                          type="text"
                          readOnly={true}
                          value={saleForm.date}
                          className="w-full bg-gray-100 border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-700"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[9.5px] font-bold text-emerald-950 mb-0.5">Invoice #</label>
                        <input
                          type="text"
                          readOnly={true}
                          value={saleForm.voucher_no}
                          className="w-full bg-emerald-100/80 border border-emerald-300 rounded-lg px-2 py-1 text-xs font-black text-emerald-950 font-mono"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5 flex items-center justify-between">
                          <span>Party Code</span>
                          {partyCodeSearch && <span className="text-[9px] text-emerald-700 font-bold">✓</span>}
                        </label>
                        <div className="relative">
                          <input
                            ref={partyCodeInputRef}
                            type="text"
                            value={partyCodeSearch}
                            onChange={(e) => handlePartyCodeChange(e.target.value)}
                            placeholder="e.g. 001, Muslim"
                            className="w-full bg-amber-50/70 border border-amber-300 rounded-lg px-2 py-1 text-xs font-mono font-black text-amber-950 uppercase"
                          />
                          {partyCodeSearch && (
                            <button
                              type="button"
                              onClick={() => handlePartyCodeChange("")}
                              className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                            >
                              <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2 sm:col-span-2 md:col-span-3">
                        <ExpandableCombobox
                          label="Party Name"
                          value={saleForm.account_name}
                          onChange={handleSelectAccount}
                          options={accountOptions}
                          placeholder="Select Party Name..."
                          searchPlaceholder="Search Parties..."
                          onAddNew={() => setShowNewPartyModal(true)}
                          addNewLabel="New Party"
                          required={true}
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-2 md:col-span-3">
                        <ExpandableCombobox
                          label="Salesman"
                          value={saleForm.reference || activeUser}
                          onChange={handleSelectSalesman}
                          options={referenceOptions}
                          placeholder="Select Salesman..."
                          searchPlaceholder="Search staff..."
                          required={true}
                          align="right"
                        />
                      </div>
                    </div>

                    {/* Row 2: Territory, Transport, Bilty, Payment Mode, Brand */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-1.5 items-end pt-1">
                      <div className="md:col-span-2">
                        <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5">Type (City)</label>
                        <input
                          ref={cityInputRef}
                          type="text"
                          value={saleForm.party_type}
                          onChange={(e) => setSaleForm({ ...saleForm, party_type: e.target.value })}
                          placeholder="e.g. HYD"
                          className="w-full bg-gray-100 border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-800"
                        />
                      </div>
                      {/* Direct Dynamic Editable Transport Autocomplete Field */}
                      <div className="col-span-2 sm:col-span-2 md:col-span-3 relative">
                        <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5 flex items-center justify-between">
                          <span>Transport</span>
                          {saleForm.transport && (
                            <button
                              type="button"
                              onClick={() => setSaleForm({ ...saleForm, transport: "" })}
                              className="text-[8.5px] text-rose-600 font-bold hover:underline"
                            >
                              Clear
                            </button>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            ref={transportInputRef}
                            type="text"
                            value={saleForm.transport}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSaleForm({ ...saleForm, transport: val });
                              setShowTransportDropdown(true);
                            }}
                            onFocus={() => setShowTransportDropdown(true)}
                            onBlur={() => {
                              if (saleForm.transport) {
                                const formatted = toTitleCase(saleForm.transport);
                                setSaleForm((prev) => ({ ...prev, transport: formatted }));
                              }
                              setTimeout(() => setShowTransportDropdown(false), 200);
                            }}
                            onKeyDown={(e) => handleGenericEnterNext(e, biltyInputRef)}
                            placeholder="Type transport (e.g. By Hand)..."
                            className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                          />
                          {/* Dropdown Suggestions */}
                          {showTransportDropdown && transportOptions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-teal-400 rounded-xl shadow-xl max-h-44 overflow-y-auto divide-y divide-gray-100">
                              {transportOptions
                                .filter((opt) => !saleForm.transport || opt.label.toLowerCase().includes(saleForm.transport.toLowerCase()))
                                .map((opt) => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setSaleForm({ ...saleForm, transport: opt.label });
                                      setShowTransportDropdown(false);
                                    }}
                                    className="w-full px-2.5 py-1.5 text-left text-xs font-bold text-gray-800 hover:bg-teal-50 flex items-center justify-between transition-colors cursor-pointer"
                                  >
                                    <span className="flex items-center gap-1">
                                      <span className="text-[9px] text-teal-700 font-bold bg-teal-100 px-1 rounded">🚚 Carrier</span>
                                      <span>{opt.label}</span>
                                    </span>
                                    {saleForm.transport === opt.label && (
                                      <span className="material-symbols-outlined text-xs text-teal-600">check</span>
                                    )}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5">Bilty#</label>
                        <input
                          ref={biltyInputRef}
                          type="text"
                          value={saleForm.bilty_no}
                          onChange={(e) => setSaleForm({ ...saleForm, bilty_no: e.target.value })}
                          onKeyDown={(e) => handleGenericEnterNext(e, medicineInputRef)}
                          placeholder="0000"
                          className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-800"
                        />
                      </div>
                      {/* Payment Mode Selector & Dynamic Bank / Cheque Fields */}
                      <div className="col-span-2 sm:col-span-4 md:col-span-4 flex items-end gap-1.5">
                        <div className="flex-1 min-w-0">
                          <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5">Payment Mode</label>
                          <select
                            value={saleForm.payment_mode || "Cash"}
                            onChange={(e) => setSaleForm({ ...saleForm, payment_mode: e.target.value })}
                            className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                          >
                            <option value="Cash">💵 Cash</option>
                            <option value="Credit">📜 Credit / Udhaar</option>
                            <option value="Easypaisa">📱 Easypaisa</option>
                            <option value="JazzCash">📱 JazzCash</option>
                            <option value="Bank Transfer">🏦 Bank Transfer</option>
                            <option value="Cheque">🧾 Cheque / Bank</option>
                          </select>
                        </div>

                        {/* Conditional Bank Name Input */}
                        {(saleForm.payment_mode === "Bank Transfer" || saleForm.payment_mode === "Cheque") && (
                          <div className="flex-1 min-w-0">
                            <label className="block text-[9.5px] font-bold text-teal-800 mb-0.5">Bank Name</label>
                            <input
                              ref={bankNameInputRef}
                              type="text"
                              value={saleForm.bank_name || ""}
                              onChange={(e) => setSaleForm({ ...saleForm, bank_name: e.target.value })}
                              onBlur={() => {
                                if (saleForm.bank_name) {
                                  setSaleForm((prev) => ({ ...prev, bank_name: toTitleCase(prev.bank_name) }));
                                }
                              }}
                              onKeyDown={(e) => {
                                if (saleForm.payment_mode === "Cheque") {
                                  handleGenericEnterNext(e, chequeNoInputRef);
                                } else {
                                  handleGenericEnterNext(e, medicineInputRef);
                                }
                              }}
                              placeholder="e.g. Meezan, HBL..."
                              className="w-full bg-teal-50 border border-teal-300 rounded-lg px-2 py-1 text-xs font-bold text-teal-950 focus:border-teal-500 outline-none"
                            />
                          </div>
                        )}

                        {/* Conditional Cheque Number Input */}
                        {saleForm.payment_mode === "Cheque" && (
                          <div className="w-24 shrink-0">
                            <label className="block text-[9.5px] font-bold text-teal-800 mb-0.5">Cheque #</label>
                            <input
                              ref={chequeNoInputRef}
                              type="text"
                              value={saleForm.cheque_no || ""}
                              onChange={(e) => setSaleForm({ ...saleForm, cheque_no: e.target.value })}
                              onKeyDown={(e) => handleGenericEnterNext(e, medicineInputRef)}
                              placeholder="e.g. 4819"
                              className="w-full bg-teal-50 border border-teal-300 rounded-lg px-2 py-1 text-xs font-bold text-teal-950 focus:border-teal-500 outline-none font-mono"
                            />
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 sm:col-span-2 md:col-span-3">
                        <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">Filter Company / Code</label>
                        <select
                          value={selectedCompany}
                          onChange={(e) => setSelectedCompany(e.target.value)}
                          className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-bold text-emerald-950 focus:border-emerald-500"
                        >
                          {companyOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Matched Party Udhaar Inline Strip */}
                    {matchedParty && (
                      <div className="bg-amber-100/90 border border-amber-300 rounded-lg px-3 py-1 flex items-center justify-between text-xs text-amber-950 gap-2 shadow-2xs mt-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="material-symbols-outlined text-base text-amber-700">account_balance_wallet</span>
                          <span>{matchedParty.name} {matchedParty.city ? `(${matchedParty.city})` : ""}</span>
                          {matchedParty.party_code && (
                            <span className="text-[10px] font-mono bg-white px-1.5 py-0.2 rounded border border-amber-300">
                              #{matchedParty.party_code}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[10px] uppercase font-bold text-slate-600">Previous Udhaar:</span>
                          <span className={`text-xs font-black ${Number(matchedParty.current_balance || matchedParty.opening_balance || 0) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                            Rs. {Number(matchedParty.current_balance || matchedParty.opening_balance || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Save / Print Notification Alert Banner */}
              {saveSuccessMsg && (
                <div className="shrink-0 bg-slate-900 text-white px-3 py-1.5 text-xs font-black text-center flex items-center justify-center gap-2 rounded-xl border border-emerald-400 shadow-md">
                  <span className="material-symbols-outlined text-emerald-400 text-sm">print</span>
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Section 2: Cart Fast Entry Bar */}
              <div className="shrink-0 bg-teal-50/70 border border-teal-200 rounded-xl p-2 space-y-1 shadow-2xs">
                <div className="text-[10.5px] font-black text-teal-950 uppercase tracking-wider flex items-center justify-between flex-wrap gap-1">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-teal-700">add_shopping_cart</span>
                    Fast Line Item Entry
                  </span>

                  {/* Quick Company / Brand Code Filter Badges & Dropdown */}
                  <div className="flex items-center gap-1.5 text-[9.5px] max-w-full overflow-hidden">
                    <span className="text-gray-600 font-bold text-[9px] uppercase whitespace-nowrap shrink-0">Brand Code:</span>
                    <div className="flex items-center gap-1 overflow-x-auto max-w-[240px] sm:max-w-[340px] no-scrollbar shrink">
                      {companyOptions.slice(0, 8).map((c) => {
                        const isActive = selectedCompany === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCompany(c.id)}
                            className={`px-1.5 py-0.2 rounded font-black text-[9.5px] transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                              isActive
                                ? "bg-teal-700 text-white shadow-2xs"
                                : "bg-white text-teal-800 border border-teal-200 hover:bg-teal-100"
                            }`}
                            title={`Filter strictly by ${c.name || c.id}`}
                          >
                            {c.code || c.id}
                          </button>
                        );
                      })}
                    </div>
                    {companyOptions.length > 1 && (
                      <select
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        className="bg-white border border-teal-300 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-teal-950 max-w-[130px] truncate shrink-0 focus:border-teal-500 outline-none"
                        title="Select from all registered companies"
                      >
                        {companyOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <span className="text-[9px] text-teal-700 font-bold hidden lg:inline">
                    ⌨️ F9: Save &amp; Print · F8: Cash Paid
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-1.5 items-end">
                  {/* Direct Inline Typeahead Autocomplete Product Name (5 columns) */}
                  <div className="col-span-2 sm:col-span-3 md:col-span-5 relative" ref={medicineInputWrapperRef}>
                    <label className="block text-[9.5px] font-bold text-gray-700 mb-0.5 flex items-center justify-between">
                      <span>Product Name <span className="text-red-500">*</span></span>
                      {selectedCompany !== "All" && (
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[8.5px] font-black rounded border border-emerald-300 flex items-center gap-1">
                          <span>🏢 {selectedCompany} ({filteredProducts.length})</span>
                          <button
                            type="button"
                            onClick={() => setSelectedCompany("All")}
                            className="text-rose-600 hover:text-rose-800 font-bold text-[10px]"
                            title="Reset company filter"
                          >
                            ✕
                          </button>
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        ref={medicineInputRef}
                        type="text"
                        value={medicineSearchText}
                        onChange={(e) => {
                          setMedicineSearchText(e.target.value);
                          setShowMedicineSuggestions(true);
                          setHighlightedMedIndex(0);
                          setSaleCart((prev) => ({ ...prev, medicine_name: e.target.value }));
                        }}
                        onFocus={() => setShowMedicineSuggestions(true)}
                        onKeyDown={handleMedicineKeyDown}
                        placeholder="Type medicine name, formula..."
                        className="w-full bg-white border border-teal-400 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-500 outline-none"
                      />
                      {medicineSearchText && (
                        <button
                          type="button"
                          onClick={() => {
                            setMedicineSearchText("");
                            setShowMedicineSuggestions(false);
                            setSaleCart((prev) => ({
                              ...prev,
                              inventory_id: "",
                              medicine_name: "",
                              company_name: "",
                              product_code: "",
                              category: "",
                              packing: "",
                              rate: "",
                              gross: "",
                              net_amount: "",
                            }));
                            medicineInputRef.current?.focus();
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      )}
                    </div>

                    {/* Floating Suggestion Tray */}
                    {showMedicineSuggestions && medicineSearchText.trim().length > 0 && (
                      <div
                        ref={suggestionsContainerRef}
                        className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-teal-500 rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-gray-100 animate-fade-in"
                      >
                        <div className="bg-teal-900 text-teal-100 text-[9.5px] font-black px-2.5 py-1 flex items-center justify-between sticky top-0 z-10">
                          <span className="flex items-center gap-1.5">
                            <span>SUGGESTIONS ({typeaheadSuggestions.length})</span>
                            {selectedCompany !== "All" && (
                              <span className="text-[8.5px] bg-emerald-700 text-emerald-100 px-1.5 py-0.2 rounded font-mono">
                                🏢 {selectedCompany}
                              </span>
                            )}
                          </span>
                          <span className="text-[8.5px] text-teal-300 font-normal">↑ ↓ Navigate · Enter Select</span>
                        </div>
                        {typeaheadSuggestions.length === 0 ? (
                          <div className="p-3 text-center text-xs text-gray-400 italic">
                            No medicines found matching "{medicineSearchText}"
                          </div>
                        ) : (
                          typeaheadSuggestions.map((inv, idx) => {
                            const isHighlighted = idx === highlightedMedIndex;
                            const stockUnits = inv.warehouse_stock || inv.store_stock || 0;
                            const salePrice = inv.unit_sale_price || inv.sale_price || inv.box_sale_price || 0;
                            return (
                              <div
                                key={inv.id || idx}
                                id={`med-sugg-${idx}`}
                                onMouseEnter={() => setHighlightedMedIndex(idx)}
                                onClick={() => handleSelectTypeaheadMedicine(inv)}
                                className={`px-2.5 py-1.5 cursor-pointer transition-colors flex items-center justify-between gap-2 ${isHighlighted
                                    ? "bg-teal-50 border-l-4 border-teal-600 text-teal-950 font-bold"
                                    : "hover:bg-gray-50 text-gray-800"
                                  }`}
                              >
                                <div className="flex-1 min-w-0 text-left">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black truncate">{inv.medicine_name}</span>
                                    {inv.company_name && (
                                      <span className="px-1 py-0.2 rounded text-[8.5px] font-black bg-emerald-100 text-emerald-800 shrink-0">
                                        {inv.company_name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[9.5px] text-gray-500 font-normal truncate mt-0.5 flex items-center gap-1">
                                    {inv.item_code && <span className="font-mono font-bold text-teal-700">{inv.item_code}</span>}
                                    {inv.packing && <span>· {inv.packing}</span>}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-xs font-black text-emerald-800 font-mono">
                                    Rs. {Number(salePrice).toLocaleString()}
                                  </div>
                                  <div className={`text-[9px] font-bold ${stockUnits <= 0 ? "text-rose-600" : stockUnits <= 5 ? "text-amber-600" : "text-gray-500"}`}>
                                    Stock: {stockUnits}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="md:col-span-1">
                    <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5 text-center">Qty</label>
                    <input
                      ref={qtyInputRef}
                      type="number"
                      min="1"
                      value={saleCart.qty}
                      onChange={(e) => handleUpdateCartMath("qty", e.target.value)}
                      onKeyDown={(e) => handleGenericEnterNext(e, rateInputRef)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-1.5 py-1 text-xs font-black text-center text-gray-900"
                    />
                  </div>

                  {/* Rate */}
                  <div className="md:col-span-1">
                    <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5 text-center">Rate</label>
                    <input
                      ref={rateInputRef}
                      type="number"
                      value={saleCart.rate}
                      onChange={(e) => handleUpdateCartMath("rate", e.target.value)}
                      onKeyDown={(e) => handleGenericEnterNext(e, discPctInputRef)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-1.5 py-1 text-xs font-bold text-center text-gray-900"
                    />
                  </div>

                  {/* Gross */}
                  <div className="md:col-span-1">
                    <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5 text-center">Gross</label>
                    <input
                      type="text"
                      value={saleCart.gross}
                      readOnly
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg px-1 py-1 text-xs font-bold text-center text-gray-700"
                    />
                  </div>

                  {/* Disc % */}
                  <div className="md:col-span-1">
                    <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5 text-center">Disc%</label>
                    <input
                      ref={discPctInputRef}
                      type="number"
                      value={saleCart.disc_pct}
                      onChange={(e) => handleUpdateCartMath("disc_pct", e.target.value)}
                      onKeyDown={(e) => handleGenericEnterNext(e, discFlatInputRef)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-1 py-1 text-xs font-bold text-center text-gray-900"
                    />
                  </div>

                  {/* Disc 0 */}
                  <div className="md:col-span-1">
                    <label className="block text-[9.5px] font-bold text-gray-600 mb-0.5 text-center">Disc 0</label>
                    <input
                      ref={discFlatInputRef}
                      type="number"
                      value={saleCart.disc_flat}
                      onChange={(e) => handleUpdateCartMath("disc_flat", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSaleItem();
                          setTimeout(() => medicineInputRef.current?.focus(), 40);
                        }
                      }}
                      className="w-full bg-white border border-gray-300 rounded-lg px-1 py-1 text-xs font-bold text-center text-gray-900"
                    />
                  </div>

                  {/* Net Amount */}
                  <div className="md:col-span-1">
                    <label className="block text-[9.5px] font-bold text-emerald-800 mb-0.5 text-center">Net</label>
                    <input
                      type="text"
                      value={saleCart.net_amount}
                      readOnly
                      className="w-full bg-emerald-100/80 border border-emerald-300 rounded-lg px-1 py-1 text-xs font-black text-center text-emerald-950"
                    />
                  </div>

                  {/* Add Button */}
                  <div className="md:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddSaleItem}
                      className="w-full bg-teal-700 hover:bg-teal-800 text-white font-black py-1.5 rounded-lg text-xs flex items-center justify-center gap-0.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 3: Added Items Table (Dynamically Takes ALL Remaining Screen Height) */}
              <div className="flex-1 min-h-[120px] bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs flex flex-col">
                <div ref={tableContainerRef} className="overflow-y-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-emerald-900 text-white font-black uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="px-3 py-2">Item Name</th>
                        <th className="px-2 py-2 text-center">Qty</th>
                        <th className="px-2 py-2 text-center">Rate</th>
                        <th className="px-2 py-2 text-center">Gross</th>
                        <th className="px-2 py-2 text-center">Disc(%)</th>
                        <th className="px-2 py-2 text-center">Disc(0)</th>
                        <th className="px-3 py-2 text-right">Net</th>
                        <th className="px-2 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {saleItems.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center py-6 text-gray-400 font-bold bg-gray-50/40">
                            <span className="material-symbols-outlined text-2xl text-gray-300 block mb-0.5">point_of_sale</span>
                            No items in cart yet. Type Medicine Name to add.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {saleItems.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-emerald-50/40 transition-colors">
                              <td className="px-3 py-1.5 font-bold text-gray-900">
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span>{item.medicine_name}</span>
                                    {item.product_code && (
                                      <span className="text-[9.5px] text-gray-400 font-mono">[{item.product_code}]</span>
                                    )}
                                    {item.packing && (
                                      <span className="text-[8.5px] bg-slate-100 text-slate-700 px-1 py-0.2 rounded font-bold">
                                        {item.packing}
                                      </span>
                                    )}
                                  </div>
                                  {item.company_name && (
                                    <div className="text-[9px] text-emerald-800 font-bold mt-0.5">
                                      🏢 {item.company_name}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-center font-black text-emerald-800">{item.qty}</td>
                              <td className="px-2 py-1.5 text-center text-gray-700">Rs. {Number(item.rate).toLocaleString()}</td>
                              <td className="px-2 py-1.5 text-center text-gray-700">Rs. {Number(item.gross).toLocaleString()}</td>
                              <td className="px-2 py-1.5 text-center text-gray-600">{item.disc_pct}</td>
                              <td className="px-2 py-1.5 text-center text-gray-600">Rs. {item.disc_flat}</td>
                              <td className="px-3 py-1.5 text-right font-black text-gray-900">Rs. {Number(item.net).toLocaleString()}</td>
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSaleItem(idx)}
                                  className="text-rose-600 hover:text-rose-800 p-0.5 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
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

              {/* Section 4: Footer Controls Bar (Fixed at bottom) */}
              <div className="shrink-0 bg-white border border-gray-200 rounded-xl p-1.5 px-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                <button
                  type="button"
                  onClick={() => setShowListModal(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">list_alt</span>
                  Invoices Logbook
                </button>

                {/* Financial Summary Controls */}
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  {/* Items Subtotal */}
                  <div className="bg-gray-50 border border-gray-200 px-2.5 py-0.5 rounded-lg text-right">
                    <div className="text-[8.5px] font-bold text-gray-500 uppercase">Subtotal</div>
                    <div className="text-xs font-black text-gray-900">
                      Rs. {saleItems.reduce((sum, item) => sum + (Number(item.net) || 0), 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Previous Udhaar / Balance Box */}
                  {puranaUdhaar > 0 && (
                    <div className="bg-rose-50 border border-rose-300 px-2.5 py-0.5 rounded-lg text-right text-rose-950">
                      <div className="text-[8.5px] font-bold uppercase tracking-wider text-rose-700">Previous Balance</div>
                      <div className="text-xs font-black font-mono">
                        Rs. {puranaUdhaar.toLocaleString()}
                      </div>
                    </div>
                  )}

                  {/* Net Grand Total */}
                  <div className="bg-emerald-100 border border-emerald-300 text-emerald-950 font-black px-3 py-0.5 rounded-xl text-xs text-right shadow-2xs">
                    <div className="text-[8.5px] font-bold text-emerald-800 uppercase">
                      {puranaUdhaar > 0 ? "Total Payable" : "Net Total"}
                    </div>
                    Rs. {grandPayable.toLocaleString()}
                  </div>

                  {/* Cash Paid / Received Input Field with F8 Focus */}
                  <div className="bg-slate-50 border border-slate-300 px-2 py-0.5 rounded-lg text-right flex items-center gap-1.5">
                    <span className="text-[8.5px] font-bold text-slate-600 uppercase whitespace-nowrap">
                      Cash Paid <span className="text-[7.5px] text-teal-700 font-mono">(F8)</span>:
                    </span>
                    <input
                      ref={cashPaidInputRef}
                      type="number"
                      placeholder={isUdhaarMode ? "0" : String(grandPayable)}
                      value={saleForm.cash_received}
                      onChange={(e) => setSaleForm({ ...saleForm, cash_received: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveSaleBill();
                        }
                      }}
                      className="w-16 bg-white border border-slate-300 rounded px-1 py-0.2 text-xs font-mono font-bold text-slate-900 text-right focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Change Return or Remaining Udhaar pill */}
                  {changeReturnCalculated > 0 && (
                    <div className="bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-lg text-right text-emerald-950">
                      <div className="text-[8.5px] font-bold uppercase tracking-wider text-emerald-700">Change Return</div>
                      <div className="text-xs font-black font-mono">
                        Rs. {changeReturnCalculated.toLocaleString()}
                      </div>
                    </div>
                  )}

                  {remainingCalculated > 0 && (
                    <div className="bg-rose-50 border border-rose-300 px-2.5 py-0.5 rounded-lg text-right text-rose-950">
                      <div className="text-[8.5px] font-bold uppercase tracking-wider text-rose-700">Remaining Udhaar</div>
                      <div className="text-xs font-black font-mono">
                        Rs. {remainingCalculated.toLocaleString()}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveSaleBill}
                    className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black px-4 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 shadow-md shadow-emerald-200 cursor-pointer active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">print</span>
                    Save &amp; Print (F9)
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column (4 cols): REAL-TIME LIVE 80mm THERMAL RECEIPT PREVIEW */}
            <div className="xl:col-span-4 flex flex-col h-full min-h-0 space-y-1.5 overflow-hidden">
              <div className="shrink-0 bg-slate-900 text-white p-2 px-3 rounded-xl flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-400 text-base">receipt_long</span>
                  <div>
                    <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
                      LIVE THERMAL RECEIPT
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSaleBill}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg font-black text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">print</span>
                  Print (F9)
                </button>
              </div>

              {/* Thermal Paper Slip Frame (Internal Scroll Only If Needed) */}
              <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border-2 border-slate-300 bg-white p-3 shadow-md font-mono text-[10px] text-slate-900 space-y-1.5 relative custom-scrollbar">
                {/* Clean Flat Header Layout */}
                <div className="border-b-2 border-slate-950 pb-1.5 text-slate-950">
                  <div className="flex items-start justify-between gap-1.5">
                    {/* Left: Logo */}
                    <div className="w-[46px] min-w-[46px] h-[52px] flex items-center justify-center shrink-0">
                      <img
                        src={CLINIC_LOGO_BASE64}
                        alt="Logo"
                        className="w-[46px] h-[50px] object-contain block"
                      />
                    </div>

                    {/* Middle: Clinic Name + Subtitle + Address */}
                    <div className="flex-1 min-w-0 text-left font-serif">
                      <div className="text-[15px] leading-[16px] font-bold text-slate-950 whitespace-nowrap tracking-tight">
                        M.Ashraf Khan
                      </div>
                      <div className="text-[9.5px] leading-[11px] font-bold text-slate-700 whitespace-nowrap mt-0.5">
                        Homeopathic Clinic
                      </div>
                      <div className="text-[8.5px] leading-[11px] font-sans font-medium text-slate-600 whitespace-nowrap mt-1">
                        Lajpat Road, Hyderabad, Sindh, PK
                      </div>
                    </div>

                    {/* Right: Phone Numbers stacked */}
                    <div className="text-right text-[9px] leading-[11.5px] font-mono font-bold text-slate-900 whitespace-nowrap shrink-0 self-end">
                      <div>0311 4234777</div>
                      <div>0343 9376363</div>
                    </div>
                  </div>
                </div>

                {/* Meta Information */}
                {billingType === "wholesale_party" ? (
                  <div className="border-b border-dashed border-slate-400 pb-2 text-[10px] space-y-1 font-mono">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-950">Invoice #: {saleForm.voucher_no}</span>
                      <span className="text-slate-800 font-semibold">Issue Date: {saleForm.date}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-black text-slate-950 text-[10.5px] leading-tight">
                        Name: {toTitleCase(saleForm.account_name) || "WHOLESALE PARTY"}
                      </span>
                      <span className="text-slate-900 font-bold whitespace-nowrap text-right shrink-0">
                        Salesman: {toTitleCase(saleForm.reference || activeUser || "Clinic Staff")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-800 font-bold">
                      <span>City : {(saleForm.party_type || "HAIDERABAD").toUpperCase()}</span>
                      <span className="text-emerald-950 font-black">
                        Mode: {saleForm.payment_mode || "Cash"}
                        {saleForm.bank_name && ` (${toTitleCase(saleForm.bank_name)})`}
                        {saleForm.cheque_no && ` [#${saleForm.cheque_no}]`}
                      </span>
                    </div>
                    {saleForm.transport && saleForm.transport.trim() && saleForm.transport.trim() !== "0" && (
                      <div className="text-slate-800 font-bold">
                        Transport: {toTitleCase(saleForm.transport)}
                      </div>
                    )}
                    {saleForm.bilty_no && saleForm.bilty_no.trim() && saleForm.bilty_no.trim() !== "0" && (
                      <div className="text-slate-800 font-bold">
                        Bilty #: {saleForm.bilty_no.trim()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border-b border-dashed border-slate-400 pb-2 text-[10px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date: {saleForm.date}</span>
                      <span className="font-bold text-slate-950">Inv: #{saleForm.voucher_no}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Cashier: {saleForm.reference || activeUser}</span>
                      <span className="font-bold text-slate-950">
                        Mode: {saleForm.payment_mode || "Cash"}
                        {saleForm.bank_name && ` (${toTitleCase(saleForm.bank_name)})`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                      <span className="font-black text-slate-950 text-[10.5px]">
                        Customer: {toTitleCase(saleForm.account_name) || "Walk-In Patient"}
                      </span>
                      {saleForm.token_no && (
                        <span className="bg-emerald-800 text-white px-1.5 py-0.5 rounded font-black text-[10px]">
                          Token #: {saleForm.token_no}
                        </span>
                      )}
                    </div>
                    {saleForm.transport && saleForm.transport.trim() && saleForm.transport.trim() !== "0" && (
                      <div className="text-slate-700 font-bold">
                        Transport: {toTitleCase(saleForm.transport)}
                      </div>
                    )}
                    {saleForm.bilty_no && saleForm.bilty_no.trim() && saleForm.bilty_no.trim() !== "0" && (
                      <div className="text-slate-700 font-bold">
                        Bilty #: {saleForm.bilty_no.trim()}
                      </div>
                    )}
                  </div>
                )}

                {/* Items Table — Clean single-bordered table: | S/r | Qty | Particulars | Rate | Dis | Net | */}
                <div className="my-1 overflow-hidden">
                  {saleItems.length === 0 ? (
                    <div className="text-center py-5 text-slate-400 italic text-[10px] bg-slate-50 border border-slate-300 rounded">
                      -- No items in cart --
                    </div>
                  ) : (
                    <table className="w-full text-[9px] border-collapse border border-slate-800">
                      <thead>
                        <tr className="bg-slate-100 text-slate-950 font-black">
                          <th className="border border-slate-800 text-center py-1 px-1 w-6">S/r</th>
                          <th className="border border-slate-800 text-center py-1 px-1 w-7">Qty</th>
                          <th className="border border-slate-800 text-left py-1 px-1.5">Particulars</th>
                          <th className="border border-slate-800 text-center py-1 px-1 w-9">Rate</th>
                          <th className="border border-slate-800 text-center py-1 px-1 w-8">Dis</th>
                          <th className="border border-slate-800 text-right py-1 px-1.5 w-12 font-black">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saleItems.map((item, i) => {
                          const discLabel = item.disc_pct && item.disc_pct !== "0%"
                            ? item.disc_pct
                            : (Number(item.disc_flat) > 0 ? `Rs.${item.disc_flat}` : "-");
                          return (
                            <tr key={item.id || i} className="hover:bg-slate-50">
                              <td className="border border-slate-800 text-center py-1 px-0.5 font-bold text-slate-900">
                                {i + 1}
                              </td>
                              <td className="border border-slate-800 text-center py-1 px-0.5 font-bold text-slate-900">
                                {item.qty}
                              </td>
                              <td className="border border-slate-800 text-left py-1 px-1.5 font-bold text-slate-950 leading-tight">
                                <div>{item.medicine_name}</div>
                                {item.company_name && (
                                  <div className="text-[7.5px] text-slate-600 font-sans font-semibold">
                                    [{item.company_name}]
                                  </div>
                                )}
                                {(item.packing) && (
                                  <div className="text-[7.5px] text-slate-500 font-mono font-normal">
                                    {item.packing}
                                  </div>
                                )}
                              </td>
                              <td className="border border-slate-800 text-center py-1 px-0.5 font-mono text-slate-800">
                                {Number(item.rate).toLocaleString()}
                              </td>
                              <td className="border border-slate-800 text-center py-1 px-0.5 font-mono text-slate-600">
                                {discLabel}
                              </td>
                              <td className="border border-slate-800 text-right py-1 px-1.5 font-mono font-black text-slate-950">
                                {Number(item.net).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Totals Summary */}
                <div className="space-y-1 text-[11px] pt-1">
                  {saleForm.attending_doctor_id && (
                    <>
                      <div className="flex justify-between text-slate-700 text-[10px]">
                        <span>Dr. Fee ({saleForm.attending_doctor_name || "Doctor"}):</span>
                        <span className="font-bold text-slate-900">
                          Rs. {Number(saleForm.doctor_fee || 0).toLocaleString("en-US")}
                        </span>
                      </div>
                      {saleForm.doctor_fee_waived && (
                        <div className="flex justify-between text-rose-700 text-[10px] font-bold">
                          <span>Dr. Fee Waived (Free):</span>
                          <span className="font-black text-rose-800">
                            -Rs. {Number(saleForm.doctor_fee || 0).toLocaleString("en-US")}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {posServiceFee > 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>POS Service Fee:</span>
                      <span className="font-bold text-slate-800">
                        Rs. {Math.round(posServiceFee).toLocaleString("en-US")}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-700">
                    <span className="font-medium">Current Bill:</span>
                    <span className="font-bold text-slate-950">
                      Rs. {Math.round(totalBillCalculated).toLocaleString("en-US")}
                    </span>
                  </div>
                  {puranaUdhaar > 0 && (
                    <div className="flex justify-between text-slate-800 font-semibold">
                      <span>Previous Balance:</span>
                      <span className="font-bold text-slate-950">
                        Rs. {Math.round(puranaUdhaar).toLocaleString("en-US")}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11.5px] font-bold border-t border-slate-800 pt-1 text-slate-950">
                    <span>{puranaUdhaar > 0 ? "Total Payable:" : "Total Amount:"}</span>
                    <span className="font-black text-slate-950">
                      Rs. {Math.round(grandPayable).toLocaleString("en-US")}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-800 font-semibold pt-0.5">
                    <span>Cash Paid:</span>
                    <span className="font-bold text-slate-950">
                      Rs. {Math.round(cashPaidNum).toLocaleString("en-US")}
                    </span>
                  </div>
                  {changeReturnCalculated > 0 && (
                    <div className="flex justify-between text-emerald-900 font-semibold">
                      <span>Change Return:</span>
                      <span className="font-bold text-emerald-950">
                        Rs. {Math.round(changeReturnCalculated).toLocaleString("en-US")}
                      </span>
                    </div>
                  )}
                  {remainingCalculated > 0 && (
                    <div className="flex justify-between text-rose-900 font-bold border-t border-dotted border-rose-400 pt-0.5 mt-0.5">
                      <span>Remaining Balance:</span>
                      <span className="font-black text-rose-950">
                        Rs. {Math.round(remainingCalculated).toLocaleString("en-US")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Urdu Footer Disclaimer */}
                <div className="border-t border-dashed border-slate-400 pt-2 text-center text-[10px] font-bold text-slate-800 leading-snug">
                  <div>خریدی ہوئی دوا واپس یا تبدیل نہیں ہوگی۔</div>
                </div>

                {/* Doctor Signature Line with Proper Gap for Physical Sign */}
                <div className="pt-7 pb-1 flex justify-end">
                  <div className="border-t-2 border-slate-900 w-[45%] text-center text-[8.5px] font-black uppercase text-slate-900 pt-1">
                    Dr. Signature
                  </div>
                </div>

                {/* Powered By Watermark */}
                <div className="text-center text-[8px] text-slate-400 font-mono border-t border-dotted border-slate-300 pt-1.5 space-y-0.5">
                  <div className="font-semibold text-slate-500">*** Powered by CliniCore Software ***</div>
                  <div className="text-[7.5px] text-slate-400">K.B Developer 03142291356</div>
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
                    className={`px-3 py-1.5 rounded-xl font-black text-xs transition-colors ${historyFilterMode === mode ? "bg-emerald-700 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${sale.payment_mode === "Credit" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
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

      {/* Direct Add New Party Modal Popup (Inline on Same Page) */}
      {showNewPartyModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowNewPartyModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border-2 border-emerald-600 animate-scaleUp text-left"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-emerald-950 font-black text-base">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                  <span className="material-symbols-outlined text-2xl">add_business</span>
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">Register New Wholesale Party</div>
                  <div className="text-[10.5px] text-slate-500 font-normal">Add party and instantly use in this sale invoice</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewPartyModal(false)}
                className="text-gray-400 hover:text-gray-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveNewParty} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Party Code:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 104"
                    value={newPartyForm.party_code}
                    onChange={(e) => setNewPartyForm((prev) => ({ ...prev, party_code: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-xs font-mono font-black text-slate-950 uppercase focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-text shadow-xs"
                  />
                  <span className="text-[9.5px] text-slate-400">Empty = Auto</span>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Party / Store Name <span className="text-rose-600">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Muslim Homeo Store"
                    value={newPartyForm.name}
                    onChange={(e) => setNewPartyForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 bg-white text-xs font-bold text-slate-950 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-text shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    City / Territory:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hyderabad, Dharki"
                    value={newPartyForm.city}
                    onChange={(e) => setNewPartyForm((prev) => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-xs font-bold text-slate-950 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-text shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Phone / Contact:
                  </label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={newPartyForm.phone}
                    onChange={(e) => setNewPartyForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-xs font-mono font-bold text-slate-950 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-text shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Address / Goods Transport:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lajpat Road Market / Al-Madina Goods"
                  value={newPartyForm.address}
                  onChange={(e) => setNewPartyForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-xs font-bold text-slate-950 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-text shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Opening Udhaar Balance (Rs):
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newPartyForm.balance_due}
                  onChange={(e) => setNewPartyForm((prev) => ({ ...prev, balance_due: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-xs font-mono font-black text-rose-700 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-text shadow-xs"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowNewPartyModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Save &amp; Link Party
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
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
