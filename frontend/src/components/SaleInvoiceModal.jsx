import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { dbSales, dbInventory, dbParties, dbAccounts, dbClinic, dbGrnMetadata, dbVisits, dbPatients, dbUsers, dbTransports, toTitleCase, getMaxDiscountLimit } from "../api/db.js";
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
  addNewLabel = "+ Add New",
  required = false,
  className = "",
  align = "left",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const dropdownRef = useRef(null);
  const listContainerRef = useRef(null);

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
    setHighlightedIdx(0);
  }, [search, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        onChange(selected.id || selected.label, selected);
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
        onKeyDown={handleKeyDown}
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
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Options List */}
          <div ref={listContainerRef} className="overflow-y-auto max-h-56 divide-y divide-gray-50 p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.id === value || opt.label === value;
                const isHighlighted = idx === highlightedIdx;
                return (
                  <button
                    key={opt.id || opt.label}
                    type="button"
                    onClick={() => {
                      onChange(opt.id || opt.label, opt);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${isHighlighted || isSelected
                        ? "bg-emerald-600 text-white font-black shadow-xs"
                        : "hover:bg-emerald-50 text-gray-800 font-bold"
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${isHighlighted || isSelected ? "bg-emerald-700 text-emerald-100" : "bg-emerald-100 text-emerald-800"
                            }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      <span className="truncate font-black text-xs shrink-0">{opt.label}</span>
                      {opt.sublabel && (
                        <span className={`text-[10px] font-medium truncate ${isHighlighted || isSelected ? "text-emerald-100" : "text-gray-500"}`}>
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
  const [companyCodeInput, setCompanyCodeInput] = useState("");
  const [showReceiptDrawer, setShowReceiptDrawer] = useState(false);

  // Emergency Zero Stock / Short Stock Shift & Local Procurement Modal State
  const [zeroStockModal, setZeroStockModal] = useState({
    isOpen: false,
    targetInv: null,
    requestedQty: 1,
    cartItem: null,
    shiftQty: 1,
    localVendor: "Local Market Purchase",
    localPaymentMode: "Cash",
    localCostPrice: "",
  });

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
      if (dbUsers.getDoctors) {
        const docs = dbUsers.getDoctors();
        if (docs && docs.length > 0) return docs;
      }
      const users = dbUsers.getAll ? dbUsers.getAll() : [];
      const docs = users.filter((u) => (u.role === "doctor" || u.is_doctor) && u.role !== "admin" && u.id !== "user_admin_001" && u.name !== "Clinic Administrator" && u.status !== "inactive" && u.status !== "deactivated");
      if (docs.length > 0) return docs;
    } catch { }
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
    disc_pct: "0",
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
  const saleItemsEndRef = useRef(null);
  const tableContainerRef = useRef(null);
  const cashPaidInputRef = useRef(null);

  // Transport Autocomplete State & Refs
  const [showTransportSuggestions, setShowTransportSuggestions] = useState(false);
  const [highlightedTransportIdx, setHighlightedTransportIdx] = useState(0);
  const transportSuggestionsRef = useRef(null);

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

  // Helper to format patient relation into standard short-form (s/o, d/o, w/o, h/o, c/o)
  const formatPatientRelation = (pat) => {
    if (!pat) return "";
    const guardian = (pat.relation_name || pat.guardian_name || pat.father_name || "").trim();
    const relType = (pat.relation_type || pat.relationship || pat.relation || pat.relation_prefix || "").trim().toLowerCase();
    
    if (!guardian) {
      if (pat.relation && /^(s\/o|d\/o|w\/o|h\/o|c\/o|m\/o)\b/i.test(pat.relation)) {
        return pat.relation.trim();
      }
      return "";
    }
    
    // If guardian already has a short prefix like "s/o", "w/o", "d/o", return directly
    if (/^(s\/o|d\/o|w\/o|h\/o|c\/o|m\/o|f\/o)\b/i.test(guardian)) {
      return guardian;
    }
    
    // Determine short prefix
    let prefix = "s/o";
    if (relType.includes("daughter") || relType === "d/o" || relType === "daughter of") {
      prefix = "d/o";
    } else if (relType.includes("wife") || relType === "w/o" || relType === "wife of") {
      prefix = "w/o";
    } else if (relType.includes("husband") || relType === "h/o" || relType === "husband of") {
      prefix = "h/o";
    } else if (relType.includes("mother") || relType === "m/o" || relType === "mother of") {
      prefix = "m/o";
    } else if (relType.includes("care") || relType.includes("guardian") || relType === "c/o") {
      prefix = "c/o";
    } else if (relType.includes("father") || relType === "s/o" || relType === "son of" || relType === "father of") {
      const gender = (pat.gender || "").toLowerCase();
      prefix = (gender === "female" || gender === "f") ? "d/o" : "s/o";
    } else if (pat.gender && (pat.gender.toLowerCase() === "female" || pat.gender.toLowerCase() === "f")) {
      prefix = "d/o";
    }
    
    return `${prefix} ${guardian}`;
  };

  const handleSelectTodayPatient = (visitId) => {
    if (!visitId) return;
    const visit = todayVisits.find((v) => v.id === visitId);
    if (visit) {
      const pat = visit.patient_id ? dbPatients.getById(visit.patient_id) : null;
      const rawName = visit.patient_name || pat?.full_name || pat?.name || "Patient";
      const relation = formatPatientRelation(pat);
      let displayName = rawName;
      if (relation && !displayName.toLowerCase().includes(relation.toLowerCase())) {
        displayName = `${rawName} (${relation})`;
      }
      setSaleForm((prev) => ({
        ...prev,
        account_name: displayName,
        token_no: String(visit.token_number || ""),
        visit_id: visit.id,
        patient_id: visit.patient_id,
        naration: relation || "",
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
      const rawName = matchedVisit.patient_name || pat?.full_name || pat?.name || "Patient";
      const relation = formatPatientRelation(pat);
      let displayName = rawName;
      if (relation && !displayName.toLowerCase().includes(relation.toLowerCase())) {
        displayName = `${rawName} (${relation})`;
      }
      setSaleForm((prev) => ({
        ...prev,
        account_name: displayName,
        visit_id: matchedVisit.id,
        patient_id: matchedVisit.patient_id,
        naration: relation || "",
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

  // Customer Account Options (Strictly Wholesale B2B Parties only — Never Expenses or Cash)
  const accountOptions = useMemo(() => {
    const list = [];
    const seenNames = new Set();

    partiesList.forEach((p) => {
      const pName = (p.name || "").trim();
      const pLower = pName.toLowerCase();
      if (!pName || ["expense", "cash", "capital", "supplier", "sales man", "salesman"].includes(pLower)) return;
      seenNames.add(pLower);
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
      const aName = (a.account_name || "").trim();
      const aLower = aName.toLowerCase();
      const aType = (a.account_type || "").toLowerCase().trim();
      const isForbidden =
        !aName ||
        ["expense", "cash", "capital", "supplier", "sales man", "salesman"].includes(aLower) ||
        ["expense", "cash", "capital", "supplier", "sales man", "salesman"].includes(aType);

      if (!isForbidden && !seenNames.has(aLower)) {
        seenNames.add(aLower);
        list.push({
          id: a.account_name,
          party_id: a.id,
          label: a.account_name,
          sublabel: `${a.city || a.account_type || "Party"} · Balance: Rs. ${a.opening_balance || 0}`,
          badge: `📒 ${a.account_type || "Party"}`,
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

  const transportSuggestions = useMemo(() => {
    const q = (saleForm.transport || "").trim().toLowerCase();
    const allT = (transportsList || []).map((t) => (typeof t === "string" ? t : t?.name || "")).filter(Boolean);
    if (!q) return allT.slice(0, 10);
    return allT.filter((t) => t.toLowerCase().includes(q)).slice(0, 10);
  }, [saleForm.transport, transportsList]);

  const handleSelectTransport = (val) => {
    setSaleForm((prev) => ({ ...prev, transport: val }));
    setShowTransportSuggestions(false);
    setTimeout(() => {
      biltyInputRef.current?.focus();
    }, 50);
  };

  const handleTransportKeyDown = (e) => {
    if (showTransportSuggestions && transportSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedTransportIdx((prev) => Math.min(transportSuggestions.length - 1, prev + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedTransportIdx((prev) => Math.max(0, prev - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = transportSuggestions[highlightedTransportIdx];
        if (selected) {
          handleSelectTransport(selected);
        } else {
          setShowTransportSuggestions(false);
          biltyInputRef.current?.focus();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setShowTransportSuggestions(false);
        return;
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setShowTransportSuggestions(false);
      transportInputRef.current?.blur();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      biltyInputRef.current?.focus();
    }
  };

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

    // Tier 1: Exact start-with / prefix matches on Name, Code, Words, or Description
    const prefixMatches = [];
    // Tier 2: Substring matches (Only used if 0 prefix matches found)
    const substringMatches = [];

    filteredProducts.forEach((inv) => {
      const name = (inv.medicine_name || "").toLowerCase();
      const cleanName = name.replace(/[\s\-_./]/g, "");
      const code = (inv.item_code || "").toLowerCase();
      const cleanCode = code.replace(/[\s\-_./]/g, "");
      const generic = (inv.generic_name || "").toLowerCase();
      const desc = (inv.product_description || inv.naration || "").toLowerCase();
      const cleanDesc = desc.replace(/[\s\-_./]/g, "");

      // Check strict prefix on code, name, or description
      const codeExact = code === rawQ || (cleanQ.length > 0 && cleanCode === cleanQ);
      const nameExact = name === rawQ || (cleanQ.length > 0 && cleanName === cleanQ);
      const descExact = desc === rawQ || (cleanQ.length > 0 && cleanDesc === cleanQ);
      const codeStartsWith = code.startsWith(rawQ) || (cleanQ.length > 0 && cleanCode.startsWith(cleanQ));
      const nameStartsWith = name.startsWith(rawQ) || (cleanQ.length > 0 && cleanName.startsWith(cleanQ));
      const descStartsWith = desc.startsWith(rawQ) || (cleanQ.length > 0 && cleanDesc.startsWith(cleanQ));

      // Check if any word starts with query (e.g. "Syrup T-1" -> "T-1", "Sexual Desire" -> "Desire")
      const words = `${name} ${desc} ${generic}`.split(/[\s\-_/]+/);
      const wordStartsWith = words.some((w) => w.startsWith(rawQ) || (cleanQ.length > 0 && w.replace(/[\s\-_./]/g, "").startsWith(cleanQ)));

      if (codeExact || nameExact || descExact || codeStartsWith || nameStartsWith || descStartsWith || wordStartsWith) {
        let rank = 0;
        if (codeExact) rank = 100;
        else if (nameExact) rank = 90;
        else if (codeStartsWith) rank = 80;
        else if (nameStartsWith) rank = 70;
        else if (descExact || descStartsWith) rank = 65;
        else rank = 60;

        prefixMatches.push({ inv, rank });
      } else if (name.includes(rawQ) || code.includes(rawQ) || (generic && generic.includes(rawQ)) || (desc && desc.includes(rawQ))) {
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
      // Escape: Dismiss active popups, suggestions, or blur input without closing main invoice
      else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (showMedicineSuggestions) {
          setShowMedicineSuggestions(false);
          return;
        }
        if (showTransportSuggestions) {
          setShowTransportSuggestions(false);
          return;
        }
        if (showReceiptDrawer) {
          setShowReceiptDrawer(false);
          return;
        }
        // Blur whatever element is currently active to safely dismiss selection
        if (document.activeElement && typeof document.activeElement.blur === "function") {
          document.activeElement.blur();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalPOSKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalPOSKeyDown);
  }, [billingType, showListModal, showNewPartyModal, showSalesmanPinModal, showMedicineSuggestions, showTransportSuggestions, showReceiptDrawer, saleItems, saleForm]);

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
    const discPct = Number(saleCart.disc_pct) || 0;
    const discFlat = Number(saleCart.disc_flat) || 0;
    const net = Math.round(Math.max(0, gross - (gross * (discPct / 100)) - discFlat));

    setMedicineSearchText(inv.medicine_name || "");
    setShowMedicineSuggestions(false);
    setHighlightedMedIndex(0);

    setSaleCart({
      product_code: inv.item_code || "",
      medicine_name: inv.medicine_name,
      product_description: inv.product_description || inv.generic_name || inv.naration || "",
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
      const rate = Number(match.unit_sale_price || match.box_sale_price || match.sale_price || match.unit_price || match.retail_price) || 0;
      const qty = Number(saleCart.qty) || 1;
      const gross = Math.round(qty * rate);
      let discPct = Number(saleCart.disc_pct) || 0;
      const maxLimit = getMaxDiscountLimit();
      if (discPct > maxLimit) discPct = maxLimit;
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
    const maxLimit = getMaxDiscountLimit();
    setSaleCart((prev) => {
      const updated = { ...prev, [field]: val };
      const q = Number(field === "qty" ? val : updated.qty) || 0;
      const r = Number(field === "rate" ? val : updated.rate) || 0;
      const gross = Math.round(q * r);
      let dPct = Number(field === "disc_pct" ? val : updated.disc_pct) || 0;
      let dFlat = Number(field === "disc_flat" ? val : updated.disc_flat) || 0;

      // ⚠️ System Discount Lock: Cashier cannot give > maxLimit (default 28%) discount on any medicine
      if (dPct > maxLimit) {
        dPct = maxLimit;
        updated.disc_pct = String(maxLimit);
        setSaveSuccessMsg(`🚫 Discount Locked: Maximum allowed discount is ${maxLimit}%.`);
        setTimeout(() => setSaveSuccessMsg(""), 3500);
      }
      if (gross > 0 && dFlat > gross * (maxLimit / 100)) {
        dFlat = Math.round(gross * (maxLimit / 100));
        updated.disc_flat = String(dFlat);
        setSaveSuccessMsg(`🚫 Discount Locked: Maximum allowed discount is ${maxLimit}%.`);
        setTimeout(() => setSaveSuccessMsg(""), 3500);
      }

      const net = Math.round(Math.max(0, gross - (gross * (dPct / 100)) - dFlat));
      updated.gross = String(gross);
      updated.net_amount = String(net);
      return updated;
    });
  };

  const commitItemToSaleCart = (itemData) => {
    if (!itemData) return;
    const q = Number(itemData.qty) || 1;
    const r = Number(itemData.rate) || 0;
    const gross = Math.round(q * r);
    const maxLimit = getMaxDiscountLimit();
    let dPct = Number(itemData.discPct ?? itemData.disc_pct) || 0;
    if (dPct > maxLimit) dPct = maxLimit;
    const dFlat = Number(itemData.discFlat ?? itemData.disc_flat) || 0;
    const net = Math.round(Math.max(0, gross - (gross * (dPct / 100)) - dFlat));
    const medName = (itemData.medicine_name || "").trim();
    const compName = (itemData.company_name || "").trim();

    setSaleItems((prev) => {
      const matchIndex = prev.findIndex(
        (item) =>
          item.medicine_name.toLowerCase() === medName.toLowerCase() &&
          (item.company_name || "").toLowerCase() === compName.toLowerCase() &&
          Number(item.rate) === r &&
          Number(item.disc_pct_num ?? item.disc_pct) === dPct &&
          Number(item.disc_flat || 0) === dFlat
      );

      if (matchIndex >= 0) {
        const updated = [...prev];
        const existing = updated[matchIndex];
        const newQty = Number(existing.qty) + q;
        const newGross = Math.round(newQty * r);
        const newNet = Math.round(Math.max(0, newGross - (newGross * (dPct / 100)) - (dFlat * newQty)));

        updated[matchIndex] = {
          ...existing,
          qty: newQty,
          qty_base_units: newQty,
          gross: newGross,
          net: newNet,
          line_total: newNet,
        };
        return updated;
      }

      const newItem = {
        id: "sale_item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        inventory_id: itemData.inventory_id || "",
        product_code: itemData.product_code || "",
        medicine_name: medName,
        product_description: itemData.product_description || "",
        company_name: compName,
        category: itemData.category || "General",
        packing: itemData.packing || "",
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

      return [...prev, newItem];
    });

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
      disc_pct: "0",
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
      medicineInputRef.current?.focus();
    }, 40);
  };

  const handleConfirmLocalPurchase = () => {
    if (!zeroStockModal.targetInv) return;
    const invId = zeroStockModal.targetInv.id;
    const inwardQty = Number(zeroStockModal.shiftQty) || zeroStockModal.requestedQty;

    const targetInv = dbInventory.getById(invId);
    if (targetInv) {
      const currentStore = Number(targetInv.store_stock ?? targetInv.stock_qty ?? 0);
      const newStore = currentStore + inwardQty;
      const currentWh = Number(targetInv.warehouse_stock ?? 0);
      dbInventory.update(invId, {
        store_stock: newStore,
        stock_qty: newStore,
        total_base_stock: currentWh + newStore,
      });
    }

    refreshData();
    commitItemToSaleCart(zeroStockModal.cartItem);

    setSaveSuccessMsg(`✅ Inwarded ${inwardQty} units emergency local stock! Item added to bill.`);
    setTimeout(() => setSaveSuccessMsg(""), 3500);
    setZeroStockModal((prev) => ({ ...prev, isOpen: false }));
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
    const maxLimit = getMaxDiscountLimit();
    let dPct = Number(saleCart.disc_pct) || 0;
    let dFlat = Number(saleCart.disc_flat) || 0;

    // ⚠️ System Discount Lock: Cashier cannot give > maxLimit discount on any medicine
    if (dPct > maxLimit) {
      dPct = maxLimit;
      setSaveSuccessMsg(`🚫 Discount Locked: Cashier cannot give > ${maxLimit}% discount on any medicine!`);
      setTimeout(() => setSaveSuccessMsg(""), 3500);
    }
    if (gross > 0 && dFlat > gross * (maxLimit / 100)) {
      dFlat = Math.round(gross * (maxLimit / 100));
      setSaveSuccessMsg(`🚫 Discount Locked: Cashier cannot give > ${maxLimit}% discount on any medicine!`);
      setTimeout(() => setSaveSuccessMsg(""), 3500);
    }

    const net = Math.round(Math.max(0, gross - (gross * (dPct / 100)) - dFlat));

    const medName = saleCart.medicine_name.trim();
    const compName = (saleCart.company_name || "").trim();

    // Check Stock Availability for Active Store Counter
    let targetInv = null;
    if (saleCart.inventory_id) {
      targetInv = dbInventory.getById(saleCart.inventory_id) || inventoryList.find((i) => i.id === saleCart.inventory_id);
    }
    if (!targetInv && medName) {
      targetInv = inventoryList.find((i) => (i.medicine_name || "").toLowerCase() === medName.toLowerCase());
    }

    if (targetInv) {
      const currentStoreStock = Number(targetInv.store_stock ?? targetInv.stock_qty ?? 0);
      if (currentStoreStock < q) {
        // Trigger Emergency Zero/Short Stock Resolution Modal!
        const defaultCostPrice = targetInv.cost_price || (targetInv.unit_sale_price ? Math.round(targetInv.unit_sale_price * 0.7) : r);
        setZeroStockModal({
          isOpen: true,
          targetInv,
          requestedQty: q,
          cartItem: {
            inventory_id: targetInv.id,
            product_code: saleCart.product_code || targetInv.item_code || "",
            medicine_name: medName,
            company_name: compName || targetInv.company_name || "",
            category: saleCart.category || targetInv.category || "General",
            packing: saleCart.packing || targetInv.packing || "",
            qty: q,
            rate: r,
            gross,
            discPct: dPct,
            discFlat: dFlat,
            net,
          },
          shiftQty: Math.max(q, Math.max(1, q - Math.max(0, currentStoreStock))),
          localVendor: "Local Market Purchase",
          localPaymentMode: "Cash",
          localCostPrice: String(defaultCostPrice),
        });
        return;
      }
    }

    commitItemToSaleCart({
      inventory_id: saleCart.inventory_id,
      product_code: saleCart.product_code,
      medicine_name: medName,
      company_name: compName,
      category: saleCart.category,
      packing: saleCart.packing,
      qty: q,
      rate: r,
      discPct: dPct,
      discFlat: dFlat,
    });
  };

  const handleRemoveSaleItem = (idx) => {
    setSaleItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const posServiceFee = billingType === "patient" ? 1 : 0;

  const totalBillCalculated = useMemo(() => {
    const subtotal = saleItems.reduce((sum, item) => sum + (Number(item.net) || 0), 0);
    const freight = Number(saleForm.freight_charges) || 0;
    const posFee = billingType === "patient" ? 1 : 0;
    const docFee = (billingType === "patient" && saleForm.attending_doctor_id && !saleForm.doctor_fee_waived)
      ? (Number(saleForm.doctor_fee) || 0)
      : 0;
    return Math.round(Math.max(0, subtotal + docFee + freight + posFee));
  }, [saleItems, saleForm.freight_charges, saleForm.attending_doctor_id, saleForm.doctor_fee, saleForm.doctor_fee_waived, billingType]);

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
    const freight = Number(saleForm.freight_charges) || 0;
    const grandTotal = totalBillCalculated;
    const partyBalance = puranaUdhaar;

    const tempSale = {
      ...saleForm,
      billing_type: billingType,
      account_name: resolvedAccountName,
      items: saleItems,
      subtotal: itemsSubtotal,
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
        {/* Solid Theme Teal Header Banner */}
        <div className="bg-[#0f766e] px-4 py-2 text-white flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <span className="material-symbols-outlined text-xl text-emerald-300">point_of_sale</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] font-mono font-bold text-emerald-300 uppercase tracking-wider">
                  WHOLESALE &amp; RETAIL POS • clinicflow terminal
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight text-white">
                SALE INVOICE
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowReceiptDrawer(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 border border-white/20 active:scale-95 cursor-pointer"
              title="Toggle Live Thermal Receipt Preview"
            >
              <span className="material-symbols-outlined text-sm text-emerald-300">receipt_long</span>
              Preview Receipt
            </button>
            <button
              type="button"
              onClick={() => setShowListModal(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 border border-white/20 active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">list_alt</span>
              Invoices List
            </button>
            <button
              type="button"
              onClick={handleSaveSaleBill}
              className="bg-white text-emerald-950 hover:bg-emerald-50 px-4 py-1.5 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-emerald-800">print</span>
              Save &amp; Print (F9)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Viewport-Fit Full-Width Body */}
        <div className="p-2.5 sm:p-3 overflow-hidden flex-1 min-h-0 bg-slate-100/60 flex flex-col space-y-2">

          {/* Unified Section 1 & 2: Customer, Party & Fast Line Item Entry in a Single Prominent Card */}
          <div className="shrink-0 bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xs">
            {/* Header: Title & Billing Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
              <div className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 flex-wrap">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center border border-teal-200">
                  <span className="material-symbols-outlined text-lg">receipt_long</span>
                </div>
                <span>CUSTOMER &amp; PARTY DETAILS</span>
              </div>

              {/* Billing Mode Switcher */}
              <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setBillingType("patient")}
                  title="Press F4 to toggle billing mode"
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${billingType === "patient"
                    ? "bg-[#0f766e] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  👤 Patient / Walk-in
                </button>
                <button
                  type="button"
                  onClick={() => setBillingType("wholesale_party")}
                  title="Press F4 to toggle billing mode"
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${billingType === "wholesale_party"
                    ? "bg-[#0f766e] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  🏢 Wholesale B2B Party
                </button>
              </div>
            </div>

            {billingType === "patient" ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-2.5 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-slate-500">lock</span>
                      <span>Date (Locked)</span>
                    </label>
                    <input
                      type="text"
                      readOnly={true}
                      tabIndex={-1}
                      value={saleForm.date}
                      className="w-full h-9 sm:h-10 bg-slate-100/90 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 outline-none cursor-not-allowed select-none shadow-inner"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] sm:text-xs font-bold text-teal-950 mb-1">Invoice #</label>
                    <input
                      type="text"
                      readOnly={true}
                      value={saleForm.voucher_no}
                      className="w-full h-9 sm:h-10 bg-teal-50 border border-teal-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-black text-teal-950 font-mono text-center outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">Token #</label>
                    <input
                      type="text"
                      value={saleForm.token_no}
                      onChange={(e) => handleTokenNumberChange(e.target.value)}
                      placeholder="e.g. 14, T-05"
                      className="w-full h-9 sm:h-10 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono font-bold text-slate-800 placeholder:text-slate-400 text-center focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-2 md:col-span-4">
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">
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
                      className="w-full h-9 sm:h-10 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 outline-none"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-2 md:col-span-2">
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-600 mb-1">Relation / Info</label>
                    <input
                      ref={narationInputRef}
                      type="text"
                      value={saleForm.naration}
                      onChange={(e) => setSaleForm({ ...saleForm, naration: e.target.value })}
                      onKeyDown={(e) => handleGenericEnterNext(e, medicineInputRef)}
                      placeholder="e.g. s/o, w/o..."
                      className="w-full h-9 sm:h-10 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>

                {/* Row 2: Payment Mode & Attending Doctor */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-2.5 items-end">
                  <div className="col-span-2 sm:col-span-2 md:col-span-4 flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[11px] sm:text-xs font-bold text-slate-600 mb-1">Payment Mode</label>
                      <select
                        value={saleForm.payment_mode || "Cash"}
                        onChange={(e) => setSaleForm({ ...saleForm, payment_mode: e.target.value })}
                        className="w-full h-9 sm:h-10 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none cursor-pointer"
                      >
                        <option value="Cash">Cash (F8)</option>
                        <option value="Credit">📜 Credit / Udhaar</option>
                        <option value="Easypaisa">📱 Easypaisa</option>
                        <option value="JazzCash">📱 JazzCash</option>
                        <option value="Bank Transfer">🏦 Bank Transfer</option>
                      </select>
                    </div>
                    {saleForm.payment_mode === "Bank Transfer" && (
                      <div className="flex-1 min-w-0">
                        <label className="block text-[11px] sm:text-xs font-bold text-teal-800 mb-1">Bank Name</label>
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
                          className="w-full h-9 sm:h-10 bg-teal-50 border border-teal-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-teal-950 focus:border-teal-500 outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 sm:col-span-2 md:col-span-8 flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Attending Doctor (Consultant)</span>
                        {saleForm.attending_doctor_name && (
                          <span className="text-[10px] text-teal-700 font-bold">✓ Selected</span>
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
                        className="w-full h-9 sm:h-10 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-600 outline-none cursor-pointer"
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
                        <div className="w-28 shrink-0">
                          <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">
                            Dr Fee (Rs)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={saleForm.doctor_fee || "0"}
                            onChange={(e) => setSaleForm({ ...saleForm, doctor_fee: e.target.value })}
                            disabled={saleForm.doctor_fee_waived}
                            className={`w-full h-9 sm:h-10 border rounded-xl px-3 py-2 text-xs sm:text-sm font-mono font-bold ${saleForm.doctor_fee_waived
                                ? "bg-slate-100 text-slate-400 line-through border-slate-200"
                                : "bg-white text-slate-900 border-teal-400"
                              }`}
                          />
                        </div>

                        <div className="shrink-0 flex items-center pb-0.5">
                          <label className={`inline-flex items-center gap-1.5 border px-3 py-2 h-9 sm:h-10 rounded-xl cursor-pointer transition-all ${saleForm.doctor_fee_waived
                              ? "bg-rose-100 border-rose-400 text-rose-950 font-black shadow-2xs"
                              : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                            }`}>
                            <input
                              type="checkbox"
                              checked={Boolean(saleForm.doctor_fee_waived)}
                              onChange={(e) => setSaleForm({ ...saleForm, doctor_fee_waived: e.target.checked })}
                              className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500 cursor-pointer"
                            />
                            <span className="text-[11px] uppercase tracking-tight font-bold">
                              {saleForm.doctor_fee_waived ? "❌ Fee Waived" : "Fee Charged"}
                            </span>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Matched Patient Udhaar Banner */}
                {matchedPatient && (
                  <div className="bg-teal-50 border border-teal-300 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs sm:text-sm text-teal-950 gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="material-symbols-outlined text-base text-teal-700">person</span>
                      <span>{matchedPatient.full_name || matchedPatient.name}</span>
                      {(matchedPatient.relation_name || matchedPatient.guardian_name) && (
                        <span className="text-xs text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded-md border border-teal-200">
                          {matchedPatient.relation || "s/o"} {matchedPatient.relation_name || matchedPatient.guardian_name}
                        </span>
                      )}
                      {matchedPatient.mr_number && (
                        <span className="text-xs font-mono bg-white px-2 py-0.5 rounded-md border border-teal-300 font-bold">
                          {matchedPatient.mr_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-xs uppercase font-bold text-slate-600">Previous Udhaar:</span>
                      <span className={`text-xs sm:text-sm font-black ${Number(matchedPatient.balance_due || matchedPatient.current_balance || matchedPatient.pending_balance || 0) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                        Rs. {Number(matchedPatient.balance_due || matchedPatient.current_balance || matchedPatient.pending_balance || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-2.5 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-slate-500">lock</span>
                      <span>Date (Locked)</span>
                    </label>
                    <input
                      type="text"
                      readOnly={true}
                      tabIndex={-1}
                      value={saleForm.date}
                      className="w-full h-9 sm:h-10 bg-slate-100/90 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 outline-none cursor-not-allowed select-none shadow-inner"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] sm:text-xs font-bold text-teal-950 mb-1">Invoice #</label>
                    <input
                      type="text"
                      readOnly={true}
                      value={saleForm.voucher_no}
                      className="w-full h-9 sm:h-10 bg-teal-50 border border-teal-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-black text-teal-950 font-mono text-center outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-600 mb-1 flex items-center justify-between">
                      <span>Party Code</span>
                      {partyCodeSearch && <span className="text-[10px] text-emerald-700 font-bold">✓</span>}
                    </label>
                    <div className="relative">
                      <input
                        ref={partyCodeInputRef}
                        type="text"
                        value={partyCodeSearch}
                        onChange={(e) => handlePartyCodeChange(e.target.value)}
                        placeholder="e.g. 001, Muslim"
                        className="w-full h-9 sm:h-10 bg-amber-50/70 border border-amber-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono font-black text-amber-950 uppercase outline-none"
                      />
                      {partyCodeSearch && (
                        <button
                          type="button"
                          onClick={() => handlePartyCodeChange("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
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

                {/* Row 2: Territory, Transport, Bilty, Payment Mode */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-2.5 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-600 mb-1">Type (City)</label>
                    <input
                      ref={cityInputRef}
                      type="text"
                      value={saleForm.party_type}
                      onChange={(e) => setSaleForm({ ...saleForm, party_type: e.target.value })}
                      placeholder="e.g. HYD"
                      className="w-full h-9 sm:h-10 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 outline-none"
                    />
                  </div>

                  {/* Transport Autocomplete */}
                  <div className="col-span-2 sm:col-span-2 md:col-span-3 relative">
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-600 mb-1 flex items-center justify-between">
                      <span>Transport</span>
                      {saleForm.transport && (
                        <span className="text-[10px] text-teal-700 font-bold">✓</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        ref={transportInputRef}
                        type="text"
                        value={saleForm.transport || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSaleForm((prev) => ({ ...prev, transport: val }));
                          setShowTransportSuggestions(true);
                          setHighlightedTransportIdx(0);
                        }}
                        onFocus={() => setShowTransportSuggestions(true)}
                        onKeyDown={handleTransportKeyDown}
                        placeholder="e.g. Al-Madina, Shah Latif"
                        className="w-full h-9 sm:h-10 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-500 outline-none"
                      />
                      {showTransportSuggestions && transportSuggestions.length > 0 && (
                        <div
                          ref={transportSuggestionsRef}
                          className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-teal-500 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100"
                        >
                          <div className="bg-teal-900 text-teal-100 text-[10px] font-black px-3 py-1 flex justify-between items-center sticky top-0">
                            <span>TRANSPORTS ({transportSuggestions.length})</span>
                            <span className="text-[9px] text-teal-300 font-normal">↑ ↓ Enter</span>
                          </div>
                          {transportSuggestions.map((t, idx) => {
                            const isH = idx === highlightedTransportIdx;
                            return (
                              <div
                                key={t.id || t.name || idx}
                                onMouseEnter={() => setHighlightedTransportIdx(idx)}
                                onClick={() => handleSelectTransport(t.name || t)}
                                className={`px-3 py-2 cursor-pointer text-xs font-bold ${isH ? "bg-teal-50 text-teal-950 border-l-4 border-teal-600 font-black" : "hover:bg-gray-50 text-gray-800"}`}
                              >
                                🚚 {t.name || t}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bilty No */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-600 mb-1">Bilty #</label>
                    <input
                      ref={biltyInputRef}
                      type="text"
                      value={saleForm.bilty_no || ""}
                      onChange={(e) => setSaleForm({ ...saleForm, bilty_no: e.target.value })}
                      onKeyDown={(e) => handleGenericEnterNext(e, medicineInputRef)}
                      placeholder="e.g. 7482"
                      className="w-full h-9 sm:h-10 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-500 outline-none font-mono"
                    />
                  </div>

                  {/* Payment Mode */}
                  <div className="col-span-2 sm:col-span-2 md:col-span-5 flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[11px] sm:text-xs font-bold text-slate-600 mb-1">Payment Mode</label>
                      <select
                        value={saleForm.payment_mode || "Cash"}
                        onChange={(e) => setSaleForm({ ...saleForm, payment_mode: e.target.value })}
                        className="w-full h-9 sm:h-10 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none cursor-pointer"
                      >
                        <option value="Cash">💵 Cash</option>
                        <option value="Credit">📜 Credit / Udhaar</option>
                        <option value="Easypaisa">📱 Easypaisa</option>
                        <option value="JazzCash">📱 JazzCash</option>
                        <option value="Bank Transfer">🏦 Bank Transfer</option>
                        <option value="Cheque">🧾 Cheque / Bank</option>
                      </select>
                    </div>

                    {(saleForm.payment_mode === "Bank Transfer" || saleForm.payment_mode === "Cheque") && (
                      <div className="flex-1 min-w-0">
                        <label className="block text-[11px] sm:text-xs font-bold text-teal-800 mb-1">Bank Name</label>
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
                          className="w-full h-9 sm:h-10 bg-teal-50 border border-teal-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-teal-950 focus:border-teal-500 outline-none"
                        />
                      </div>
                    )}

                    {saleForm.payment_mode === "Cheque" && (
                      <div className="w-28 shrink-0">
                        <label className="block text-[11px] sm:text-xs font-bold text-teal-800 mb-1">Cheque #</label>
                        <input
                          ref={chequeNoInputRef}
                          type="text"
                          value={saleForm.cheque_no || ""}
                          onChange={(e) => setSaleForm({ ...saleForm, cheque_no: e.target.value })}
                          onKeyDown={(e) => handleGenericEnterNext(e, medicineInputRef)}
                          placeholder="e.g. 4819"
                          className="w-full h-9 sm:h-10 bg-teal-50 border border-teal-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-teal-950 focus:border-teal-500 outline-none font-mono"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Matched Party Udhaar Inline Strip */}
                {matchedParty && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs sm:text-sm text-amber-950 gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="material-symbols-outlined text-base text-amber-700">account_balance_wallet</span>
                      <span>{matchedParty.name} {matchedParty.city ? `(${matchedParty.city})` : ""}</span>
                      {matchedParty.party_code && (
                        <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-amber-300 font-bold">
                          #{matchedParty.party_code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-xs uppercase font-bold text-slate-600">Previous Udhaar:</span>
                      <span className={`text-xs sm:text-sm font-black ${Number(matchedParty.current_balance || matchedParty.opening_balance || 0) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                        Rs. {Number(matchedParty.current_balance || matchedParty.opening_balance || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Save / Print Notification Alert Banner */}
            {saveSuccessMsg && (
              <div className="bg-[#0f766e] text-white px-4 py-2 text-xs sm:text-sm font-black text-center flex items-center justify-center gap-2 rounded-xl border border-teal-400 shadow-md">
                <span className="material-symbols-outlined text-teal-200 text-base">print</span>
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Subtle Divider between Customer Details & Fast Line Item Entry */}
            {/* Subtle Divider between Customer Details & Fast Line Item Entry */}
            <div className="border-t border-slate-200 pt-3">
              <div className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center justify-between flex-wrap gap-2.5 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center border border-teal-200">
                    <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
                  </div>
                  <span>FAST LINE ITEM ENTRY</span>
                </div>

                {/* Quick Company / Brand Code Filter Badges & Dropdown (Enlarged & Clear) */}
                <div className="flex items-center gap-2 text-xs sm:text-sm max-w-full overflow-hidden flex-wrap">
                  <span className="text-slate-700 font-black text-xs uppercase whitespace-nowrap shrink-0">Brand:</span>
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-[240px] sm:max-w-[380px] no-scrollbar shrink py-0.5">
                    {companyOptions.slice(0, 8).map((c) => {
                      const isActive = selectedCompany === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCompany(c.id);
                            setCompanyCodeInput(c.code || c.id);
                          }}
                          className={`px-3.5 py-1.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 ${isActive
                              ? "bg-[#0f766e] text-white shadow-xs"
                              : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                            }`}
                          title={`Filter strictly by ${c.name || c.id}`}
                        >
                          {c.code || c.id}
                        </button>
                      );
                    })}
                  </div>

                  {/* Direct Company Code Quick Entry Input (Spacious) */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 shrink-0" title="Type company code (e.g. BM, MKT, PB, BLS, GHR)">
                    <span className="text-xs font-black text-slate-700 uppercase">Quick Code:</span>
                    <input
                      type="text"
                      value={companyCodeInput}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setCompanyCodeInput(val);
                        if (!val.trim()) {
                          setSelectedCompany("All");
                          return;
                        }
                        const match = companyOptions.find(
                          (c) =>
                            (c.code || c.id || "").toUpperCase() === val.trim() ||
                            (c.name || "").toUpperCase().startsWith(val.trim())
                        );
                        if (match) {
                          setSelectedCompany(match.id);
                        }
                      }}
                      placeholder="E.G. BM"
                      className="w-20 sm:w-24 bg-transparent text-xs sm:text-sm font-mono font-black text-teal-950 uppercase outline-none placeholder:text-slate-400"
                    />
                  </div>

                  {companyOptions.length > 1 && (
                    <select
                      value={selectedCompany}
                      onChange={(e) => {
                        setSelectedCompany(e.target.value);
                        const found = companyOptions.find((c) => c.id === e.target.value);
                        setCompanyCodeInput(found?.code || found?.id || "");
                      }}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-800 max-w-[150px] truncate shrink-0 focus:border-teal-500 outline-none cursor-pointer"
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
              </div>

              {/* Fast Entry Row: Product Name + Math Inputs (No Flat Disc 0) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-2 sm:gap-2.5 items-end">
                {/* Product Name Autocomplete Search Field (5 columns) */}
                <div className="col-span-2 sm:col-span-3 md:col-span-5 relative" ref={medicineInputWrapperRef}>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>PRODUCT NAME <span className="text-rose-500">*</span></span>
                    {selectedCompany !== "All" && (
                      <span className="px-2 py-0.5 bg-teal-50 text-teal-800 text-[10px] font-black rounded border border-teal-300 flex items-center gap-1">
                        <span>🏢 {selectedCompany} ({filteredProducts.length})</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCompany("All")}
                          className="text-rose-600 hover:text-rose-800 font-bold text-xs ml-1"
                          title="Reset company filter"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined text-lg text-teal-700 absolute left-3 pointer-events-none">search</span>
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
                      placeholder="Type medicine name, formula, code..."
                      className="w-full h-10 sm:h-11 bg-[#fbfcfb] border border-teal-400 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 outline-none"
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
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    )}
                  </div>

                  {/* Floating Suggestion Tray */}
                  {showMedicineSuggestions && medicineSearchText.trim().length > 0 && (
                    <div
                      ref={suggestionsContainerRef}
                      className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border-2 border-teal-600 rounded-2xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-gray-100 animate-fade-in"
                    >
                      <div className="bg-[#0f766e] text-white text-[10px] sm:text-[11px] font-black px-3.5 py-1.5 flex items-center justify-between sticky top-0 z-10">
                        <span className="flex items-center gap-2">
                          <span>SUGGESTIONS ({typeaheadSuggestions.length})</span>
                          {selectedCompany !== "All" && (
                            <span className="text-[9px] bg-teal-800 text-teal-100 px-2 py-0.5 rounded font-mono">
                              🏢 {selectedCompany}
                            </span>
                          )}
                        </span>
                        <span className="text-[9.5px] text-teal-100 font-normal">↑ ↓ Navigate · Enter Select</span>
                      </div>
                      {typeaheadSuggestions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500 italic">
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
                              className={`px-3.5 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-2.5 ${isHighlighted
                                ? "bg-teal-50 border-l-4 border-teal-700 text-teal-950 font-bold"
                                : "hover:bg-gray-50 text-gray-800"
                                }`}
                            >
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs sm:text-sm font-black truncate">{inv.medicine_name}</span>
                                  {(inv.product_description || inv.generic_name || inv.naration) && (
                                    <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs">
                                      — {inv.product_description || inv.generic_name || inv.naration}
                                    </span>
                                  )}
                                  {inv.company_name && (
                                    <span className="px-2 py-0.5 rounded text-[9.5px] font-black bg-teal-100 text-teal-900 shrink-0">
                                      {inv.company_name}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] sm:text-[11px] text-gray-500 font-normal truncate mt-0.5 flex items-center gap-1.5">
                                  {inv.item_code && <span className="font-mono font-bold text-teal-700">{inv.item_code}</span>}
                                  {inv.category && <span className="text-slate-500 font-medium">· {inv.category}</span>}
                                  {inv.packing && <span>· {inv.packing}</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs sm:text-sm font-black text-teal-900 font-mono">
                                  Rs. {Number(salePrice).toLocaleString()}
                                </div>
                                <div className={`text-[10px] font-bold ${stockUnits <= 0 ? "text-rose-600" : stockUnits <= 5 ? "text-amber-600" : "text-gray-500"}`}>
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

                {/* QTY */}
                <div className="md:col-span-1">
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 text-center">QTY</label>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    value={saleCart.qty}
                    onChange={(e) => handleUpdateCartMath("qty", e.target.value)}
                    onKeyDown={(e) => handleGenericEnterNext(e, rateInputRef)}
                    className="w-full h-10 sm:h-11 bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs sm:text-sm font-black text-center text-slate-900 focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700 outline-none"
                  />
                </div>

                {/* RATE */}
                <div className="md:col-span-1">
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 text-center">RATE</label>
                  <input
                    ref={rateInputRef}
                    type="number"
                    value={saleCart.rate}
                    onChange={(e) => handleUpdateCartMath("rate", e.target.value)}
                    onKeyDown={(e) => handleGenericEnterNext(e, discPctInputRef)}
                    className="w-full h-10 sm:h-11 bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs sm:text-sm font-bold text-center text-slate-900 focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700 outline-none"
                  />
                </div>

                {/* GROSS */}
                <div className="md:col-span-1">
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 text-center">GROSS</label>
                  <input
                    type="text"
                    value={saleCart.gross || "-"}
                    readOnly
                    className="w-full h-10 sm:h-11 bg-slate-100 border border-slate-300 rounded-xl px-2 py-2 text-xs sm:text-sm font-bold text-center text-slate-600 outline-none cursor-not-allowed"
                  />
                </div>

                {/* DISC% */}
                <div className="md:col-span-1">
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 text-center">DISC%</label>
                  <input
                    ref={discPctInputRef}
                    type="number"
                    value={saleCart.disc_pct}
                    onChange={(e) => handleUpdateCartMath("disc_pct", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSaleItem();
                        setTimeout(() => medicineInputRef.current?.focus(), 40);
                      }
                    }}
                    className="w-full h-10 sm:h-11 bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs sm:text-sm font-bold text-center text-slate-900 focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700 outline-none"
                  />
                </div>

                {/* NET */}
                <div className="md:col-span-2">
                  <label className="block text-[11px] sm:text-xs font-bold text-teal-800 mb-1 text-center">NET</label>
                  <input
                    type="text"
                    value={saleCart.net_amount || "0.00"}
                    readOnly
                    className="w-full h-10 sm:h-11 bg-teal-50 border border-teal-300 rounded-xl px-2 py-2 text-xs sm:text-sm font-black text-center text-teal-950 outline-none"
                  />
                </div>

                {/* ADD ITEM BUTTON */}
                <div className="md:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddSaleItem}
                    className="w-full h-10 sm:h-11 bg-[#0f766e] hover:bg-[#115e59] text-white font-black py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Cart Items Table (Takes All Remaining Height) */}
          <div className="flex-1 min-h-[140px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
            <div ref={tableContainerRef} className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-teal-700 text-white font-black uppercase tracking-wider text-[10px] sm:text-[11px] sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="px-4 py-2.5">ITEM NAME</th>
                    <th className="px-3 py-2.5 text-center">QTY</th>
                    <th className="px-3 py-2.5 text-center">RATE</th>
                    <th className="px-3 py-2.5 text-center">GROSS</th>
                    <th className="px-3 py-2.5 text-center">DISC(%)</th>
                    <th className="px-4 py-2.5 text-right">NET</th>
                    <th className="px-3 py-2.5 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {saleItems.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-0 border-0">
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mb-2.5 shadow-2xs">
                            <span className="material-symbols-outlined text-2xl">shopping_cart</span>
                          </div>
                          <div className="text-sm font-black text-slate-700">No items in cart yet</div>
                          <div className="text-xs text-slate-400 mt-0.5">Search or type medicine name to add to sale invoice</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {saleItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2 font-bold text-slate-900">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{item.medicine_name}</span>
                                {item.product_description && (
                                  <span className="text-[10px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                                    — {item.product_description}
                                  </span>
                                )}
                                {item.product_code && (
                                  <span className="text-[9.5px] text-slate-400 font-mono">[{item.product_code}]</span>
                                )}
                                {item.packing && (
                                  <span className="text-[8.5px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-md font-bold">
                                    {item.packing}
                                  </span>
                                )}
                              </div>
                              {item.company_name && (
                                <div className="text-[9.5px] text-teal-800 font-bold mt-0.5">
                                  🏢 {item.company_name}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center font-black text-teal-800">{item.qty}</td>
                          <td className="px-3 py-2 text-center text-slate-700">Rs. {Number(item.rate).toLocaleString()}</td>
                          <td className="px-3 py-2 text-center text-slate-700">Rs. {Number(item.gross).toLocaleString()}</td>
                          <td className="px-3 py-2 text-center text-slate-600">{item.disc_pct}</td>
                          <td className="px-4 py-2 text-right font-black text-slate-900">Rs. {Number(item.net).toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveSaleItem(idx)}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr ref={saleItemsEndRef}>
                        <td colSpan="7" className="p-0 border-0" />
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Footer Controls & Financial Bar (Enlarged & High Visibility) */}
          <div className="shrink-0 bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <button
              type="button"
              onClick={() => setShowListModal(true)}
              className="bg-[#0f766e] hover:bg-[#115e59] text-white font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-base">list_alt</span>
              <span>Invoices Logbook</span>
            </button>

            {/* Financial Summary Controls (Enlarged Elements) */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-end">
              {/* Items Subtotal */}
              <div className="px-2 text-right">
                <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">SUBTOTAL</div>
                <div className="text-sm sm:text-base font-black text-slate-900 font-mono">
                  Rs. {saleItems.reduce((sum, item) => sum + (Number(item.net) || 0), 0).toLocaleString()}
                </div>
              </div>

              {/* Previous Udhaar / Balance Box */}
              {puranaUdhaar > 0 && (
                <div className="bg-rose-50 border border-rose-300 px-3.5 py-1.5 rounded-xl text-right text-rose-950">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-rose-700">Previous Balance</div>
                  <div className="text-xs sm:text-sm font-black font-mono">
                    Rs. {puranaUdhaar.toLocaleString()}
                  </div>
                </div>
              )}

              {/* Net Grand Total Pill (Large & Prominent) */}
              <div className="bg-teal-50 border-2 border-teal-500 text-teal-950 font-black px-4 py-1.5 rounded-xl text-xs sm:text-sm text-right shadow-2xs flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-bold text-teal-800 uppercase">
                  {puranaUdhaar > 0 ? "TOTAL PAYABLE" : "NET TOTAL"}
                </span>
                <span className="text-base sm:text-lg font-black text-teal-950 font-mono">
                  Rs. {grandPayable.toLocaleString()}
                </span>
              </div>

              {/* Cash Paid / Received Input Field with F8 Focus (Spacious & Large) */}
              <div className="bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl text-right flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase whitespace-nowrap">
                  CASH PAID <span className="text-[9px] text-teal-800 font-mono font-bold">(F8)</span>:
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
                  className="w-24 sm:w-28 h-8 sm:h-9 bg-white border border-slate-300 rounded-lg px-2 text-sm sm:text-base font-mono font-black text-slate-900 text-right focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Change Return or Remaining Udhaar pill */}
              {changeReturnCalculated > 0 && (
                <div className="bg-emerald-50 border border-emerald-300 px-3.5 py-1.5 rounded-xl text-right text-emerald-950">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Change Return</div>
                  <div className="text-xs sm:text-sm font-black font-mono text-emerald-900">
                    Rs. {changeReturnCalculated.toLocaleString()}
                  </div>
                </div>
              )}

              {remainingCalculated > 0 && (
                <div className="bg-rose-50 border border-rose-300 px-3.5 py-1.5 rounded-xl text-right text-rose-950">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-rose-700">Remaining Udhaar</div>
                  <div className="text-xs sm:text-sm font-black font-mono text-rose-900">
                    Rs. {remainingCalculated.toLocaleString()}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveSaleBill}
                className="bg-[#0f766e] hover:bg-[#115e59] text-white font-black px-6 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-900/20 cursor-pointer active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base">print</span>
                <span>Save &amp; Print (F9)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Slide-Over Live Thermal Receipt Drawer */}
      {showReceiptDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fade-in">
          {/* Translucent Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300 cursor-pointer"
            onClick={() => setShowReceiptDrawer(false)}
          />

          {/* Slide-In Thermal Panel */}
          <div className="relative w-full max-w-[460px] bg-[#115e59] text-white shadow-2xl h-full flex flex-col z-10 animate-slide-in-right transform transition-transform duration-300 border-l border-teal-700">
            {/* Drawer Header */}
            <div className="shrink-0 bg-[#0f766e] px-4 py-3 border-b border-teal-600/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-200 text-lg">receipt_long</span>
                <div>
                  <div className="text-xs font-black tracking-wider uppercase flex items-center gap-2 text-white">
                    <span>LIVE THERMAL RECEIPT</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </div>
                  <div className="text-[10px] text-teal-100/80 font-mono">80mm ESC/POS Realtime Stream</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSaleBill}
                  className="bg-white hover:bg-teal-50 text-teal-900 px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-teal-800">print</span>
                  Print (F9)
                </button>
                <button
                  type="button"
                  onClick={() => setShowReceiptDrawer(false)}
                  className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-teal-100 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close Receipt Preview"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* Thermal Paper Slip Frame Container */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-teal-900/40 custom-scrollbar flex justify-center">
              <div className="rounded-xl border-2 border-slate-950 bg-white p-3.5 shadow-xl font-sans text-[13px] text-slate-950 space-y-2 relative">
                {/* Clean Flat Header Banner Layout */}
                <div className="border-b-2 border-slate-950 pb-1.5 text-slate-950">
                  <img
                    src={RECEIPT_HEADER_IMAGE_BASE64}
                    alt="Dr. Asif Khan Homoeopathic Clinic"
                    className="w-full object-contain block mx-auto"
                  />
                </div>

                {/* Meta Information */}
                {billingType === "wholesale_party" ? (
                  <div className="border-b-2 border-dashed border-slate-900 pb-2 text-[13px] space-y-1 font-mono font-bold text-slate-950">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-sm">Invoice #: {saleForm.voucher_no}</span>
                      <span>Date: {saleForm.date}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-black text-[14.5px] leading-tight">
                        Name: {toTitleCase(saleForm.account_name) || "WHOLESALE PARTY"}
                      </span>
                      <span className="whitespace-nowrap text-right shrink-0">
                        Salesman: {toTitleCase(saleForm.reference || activeUser || "Clinic Staff")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>City : {(saleForm.party_type || "HAIDERABAD").toUpperCase()}</span>
                      <span className="font-black">
                        Mode: {saleForm.payment_mode || "Cash"}
                        {saleForm.bank_name && ` (${toTitleCase(saleForm.bank_name)})`}
                        {saleForm.cheque_no && ` [#${saleForm.cheque_no}]`}
                      </span>
                    </div>
                    {saleForm.transport && saleForm.transport.trim() && saleForm.transport.trim() !== "0" && (
                      <div>
                        Transport: {toTitleCase(saleForm.transport)}
                      </div>
                    )}
                    {saleForm.bilty_no && saleForm.bilty_no.trim() && saleForm.bilty_no.trim() !== "0" && (
                      <div>
                        Bilty #: {saleForm.bilty_no.trim()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border-b-2 border-dashed border-slate-900 pb-2 text-[13px] font-bold text-slate-950 space-y-1">
                    <div className="flex justify-between">
                      <span>Date: {saleForm.date}</span>
                      <span className="font-black text-[14px]">Inv: #{saleForm.voucher_no}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Cashier: {saleForm.reference || activeUser}</span>
                      <span className="font-black">
                        Mode: {saleForm.payment_mode || "Cash"}
                        {saleForm.bank_name && ` (${toTitleCase(saleForm.bank_name)})`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-300">
                      <span className="font-black text-[14.5px]">
                        Customer: {toTitleCase(saleForm.account_name) || "Walk-In Patient"}
                      </span>
                      {saleForm.token_no && (
                        <span className="bg-slate-950 text-white px-2 py-0.5 rounded font-black text-xs">
                          Token #: {saleForm.token_no}
                        </span>
                      )}
                    </div>
                    {saleForm.transport && saleForm.transport.trim() && saleForm.transport.trim() !== "0" && (
                      <div>
                        Transport: {toTitleCase(saleForm.transport)}
                      </div>
                    )}
                    {saleForm.bilty_no && saleForm.bilty_no.trim() && saleForm.bilty_no.trim() !== "0" && (
                      <div>
                        Bilty #: {saleForm.bilty_no.trim()}
                      </div>
                    )}
                  </div>
                )}

                {/* Items Table — Clean single-bordered table */}
                <div className="my-1.5 overflow-hidden">
                  {saleItems.length === 0 ? (
                    <div className="text-center py-6 text-slate-600 font-bold italic text-sm bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg">
                      -- No items in cart --
                    </div>
                  ) : (
                    <table className="w-full text-xs border-collapse border-2 border-slate-950">
                      <thead>
                        <tr className="bg-slate-100 text-slate-950 font-black text-[11.5px]">
                          <th className="border border-slate-950 text-center py-1.5 px-1 w-7">S/r</th>
                          <th className="border border-slate-950 text-center py-1.5 px-1 w-8">Qty</th>
                          <th className="border border-slate-950 text-left py-1.5 px-2">Particulars</th>
                          <th className="border border-slate-950 text-center py-1.5 px-1 w-11">Rate</th>
                          <th className="border border-slate-950 text-center py-1.5 px-1 w-9">Dis</th>
                          <th className="border border-slate-950 text-right py-1.5 px-2 w-14 font-black">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saleItems.map((item, i) => {
                          const discLabel = item.disc_pct && item.disc_pct !== "0%"
                            ? item.disc_pct
                            : (Number(item.disc_flat) > 0 ? `Rs.${item.disc_flat}` : "-");
                          return (
                            <tr key={item.id || i} className="hover:bg-slate-50 text-[12.5px] font-bold">
                              <td className="border border-slate-950 text-center py-1.5 px-0.5 text-slate-950">
                                {i + 1}
                              </td>
                              <td className="border border-slate-950 text-center py-1.5 px-0.5 font-black text-slate-950">
                                {item.qty}
                              </td>
                              <td className="border border-slate-950 text-left py-1.5 px-2 font-black text-slate-950 leading-tight">
                                <div>{item.medicine_name}</div>
                                {item.company_name && (
                                  <div className="text-[10px] text-slate-700 font-sans font-bold">
                                    [{item.company_name}]
                                  </div>
                                )}
                                {(item.packing) && (
                                  <div className="text-[10px] text-slate-600 font-mono font-medium">
                                    {item.packing}
                                  </div>
                                )}
                              </td>
                              <td className="border border-slate-950 text-center py-1.5 px-0.5 font-mono text-slate-900">
                                {Number(item.rate).toLocaleString()}
                              </td>
                              <td className="border border-slate-950 text-center py-1.5 px-0.5 font-mono text-slate-800">
                                {discLabel}
                              </td>
                              <td className="border border-slate-950 text-right py-1.5 px-2 font-mono font-black text-slate-950 text-[13px]">
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
                {(() => {
                  const itemsSubtotal = saleItems.reduce((sum, item) => sum + (Number(item.net) || 0), 0);
                  const itemsGross = saleItems.reduce((sum, item) => sum + (Number(item.gross) || (Number(item.qty) * Number(item.rate)) || 0), 0);
                  const totalDiscount = Math.max(0, itemsGross - itemsSubtotal);
                  const freight = Number(saleForm.freight_charges) || 0;

                  return (
                    <div className="space-y-1 text-[13.5px] font-bold text-slate-950 pt-1">
                      {totalDiscount > 0 && (
                        <>
                          <div className="flex justify-between text-slate-800 text-xs font-bold">
                            <span>Gross Total:</span>
                            <span className="font-mono">
                              Rs. {Math.round(itemsGross).toLocaleString("en-US")}
                            </span>
                          </div>
                          <div className="flex justify-between text-rose-700 text-xs font-bold">
                            <span>Discount:</span>
                            <span className="font-mono">
                              -Rs. {Math.round(totalDiscount).toLocaleString("en-US")}
                            </span>
                          </div>
                        </>
                      )}

                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-black text-[14px] font-mono">
                          Rs. {Math.round(itemsSubtotal).toLocaleString("en-US")}
                        </span>
                      </div>

                      {saleForm.attending_doctor_id && (
                        <>
                          <div className="flex justify-between text-slate-900 text-xs font-bold">
                            <span>Dr. Fee ({saleForm.attending_doctor_name || "Doctor"}):</span>
                            <span className="font-black font-mono">
                              Rs. {Number(saleForm.doctor_fee || 0).toLocaleString("en-US")}
                            </span>
                          </div>
                          {saleForm.doctor_fee_waived && (
                            <div className="flex justify-between text-rose-700 text-xs font-black">
                              <span>Dr. Fee Waived (Free):</span>
                              <span className="font-mono">
                                -Rs. {Number(saleForm.doctor_fee || 0).toLocaleString("en-US")}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      {freight > 0 && (
                        <div className="flex justify-between text-slate-900 text-xs font-bold">
                          <span>Freight Charges:</span>
                          <span className="font-black font-mono">
                            Rs. {Math.round(freight).toLocaleString("en-US")}
                          </span>
                        </div>
                      )}
                      {posServiceFee > 0 && (
                        <div className="flex justify-between text-slate-900 text-xs font-bold">
                          <span>POS Service Fee:</span>
                          <span className="font-black font-mono">
                            Rs. {Math.round(posServiceFee).toLocaleString("en-US")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-dashed border-slate-900 pt-1">
                        <span>Current Bill:</span>
                        <span className="font-black text-[14.5px] font-mono">
                          Rs. {Math.round(totalBillCalculated).toLocaleString("en-US")}
                        </span>
                      </div>
                      {puranaUdhaar > 0 && (
                        <div className="flex justify-between">
                          <span>Previous Balance:</span>
                          <span className="font-black text-[14.5px] font-mono">
                            Rs. {Math.round(puranaUdhaar).toLocaleString("en-US")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-black border-t-2 border-slate-950 pt-1.5 text-slate-950">
                        <span>{puranaUdhaar > 0 ? "Total Payable:" : "Total Amount:"}</span>
                        <span className="font-black text-[17px] font-mono">
                          Rs. {Math.round(grandPayable).toLocaleString("en-US")}
                        </span>
                      </div>
                      <div className="flex justify-between pt-0.5">
                        <span>Cash Paid:</span>
                        <span className="font-black text-[14.5px] font-mono">
                          Rs. {Math.round(cashPaidNum).toLocaleString("en-US")}
                        </span>
                      </div>
                      {changeReturnCalculated > 0 && (
                        <div className="flex justify-between text-emerald-950 font-black">
                          <span>Change Return:</span>
                          <span className="font-black text-[15px] font-mono">
                            Rs. {Math.round(changeReturnCalculated).toLocaleString("en-US")}
                          </span>
                        </div>
                      )}
                      {remainingCalculated > 0 && (
                        <div className="flex justify-between text-rose-950 font-black border-t border-dashed border-slate-950 pt-1">
                          <span>Remaining Balance:</span>
                          <span className="font-black text-[15.5px] font-mono">
                            Rs. {Math.round(remainingCalculated).toLocaleString("en-US")}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Urdu Footer Disclaimer — Extra Large High-Visibility */}
                <div className="border-t-2 border-dashed border-slate-950 mt-5 pt-3.5 text-center" style={{ direction: "rtl" }}>
                  <div className="font-black text-slate-950 text-[23px] leading-relaxed tracking-wide font-serif">
                    خریدی ہوئی دوا واپس یا تبدیل نہیں ہوگی۔
                  </div>
                </div>

                {/* Doctor Signature Line with Proper Gap for Physical Sign */}
                <div className="pt-6 pb-1 flex justify-end">
                  <div className="border-t-2 border-slate-950 w-[45%] text-center text-[11px] font-black uppercase text-slate-950 pt-1">
                    Dr. Signature
                  </div>
                </div>

                {/* Powered By Watermark */}
                <div className="text-center text-[9.5px] text-slate-600 font-mono border-t border-dotted border-slate-400 pt-1.5 space-y-0.5">
                  <div className="font-bold text-slate-700">*** Powered by CliniCore Software ***</div>
                  <div className="text-[9px] text-slate-600 font-semibold">K.B Developer 03142291356</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SALE INVOICE _List Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0f766e] p-4 sm:p-5 text-white flex items-center justify-between border-b border-teal-700">
              <div>
                <div className="text-[10px] font-bold text-teal-200 uppercase tracking-widest">Sale Invoices Logbook</div>
                <h3 className="text-xl font-black flex items-center gap-2 text-white">
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

      {/* Emergency Zero Stock / Short Stock Shift & Local Procurement Modal */}
      {zeroStockModal.isOpen && zeroStockModal.targetInv && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-rose-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-700 px-5 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">warning</span>
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">
                    ⚡ Zero / Short Stock Alert
                  </h3>
                  <p className="text-[10px] text-rose-100 font-medium">
                    Billing continues uninterrupted. Resolve stock source below:
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setZeroStockModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Item Summary Banner */}
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-black text-rose-950 text-sm">
                    {zeroStockModal.targetInv.medicine_name}
                  </div>
                  <div className="text-[10.5px] text-rose-800 font-bold">
                    Company: {zeroStockModal.targetInv.company_name || "General"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-rose-700">Counter Stock</div>
                  <div className="font-mono text-base font-black text-rose-900">
                    {Number(zeroStockModal.targetInv.store_stock ?? zeroStockModal.targetInv.stock_qty ?? 0)} units
                  </div>
                  <div className="text-[10px] font-bold text-slate-600">Requested: {zeroStockModal.requestedQty} units</div>
                </div>
              </div>

              {/* Emergency Local Stock Inward Form */}
              <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-amber-700">storefront</span>
                  <h4 className="text-xs font-black text-amber-950">
                    Emergency Local Market / Counter Purchase
                  </h4>
                </div>
                <p className="text-[11px] text-amber-900 font-medium">
                  Inward stock directly to store counter to fulfill billing:
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 mb-0.5">Quantity to Inward</label>
                    <input
                      type="number"
                      min="1"
                      value={zeroStockModal.shiftQty}
                      onChange={(e) => setZeroStockModal((prev) => ({ ...prev, shiftQty: Math.max(1, Number(e.target.value) || 1) }))}
                      className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-amber-950 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 mb-0.5">Payment Mode</label>
                    <select
                      value={zeroStockModal.localPaymentMode}
                      onChange={(e) => setZeroStockModal((prev) => ({ ...prev, localPaymentMode: e.target.value }))}
                      className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-amber-950 outline-none"
                    >
                      <option value="Cash">💵 Cash Paid</option>
                      <option value="Credit">📜 Local Market Udhaar (Credit)</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-amber-900 mb-0.5">Unit Purchase Price (Cost)</label>
                    <input
                      type="number"
                      value={zeroStockModal.localCostPrice}
                      onChange={(e) => setZeroStockModal((prev) => ({ ...prev, localCostPrice: e.target.value }))}
                      placeholder="Cost price..."
                      className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-amber-950 outline-none font-mono"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmLocalPurchase}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-2.5 px-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                  <span>Inward {zeroStockModal.shiftQty} Units &amp; Continue Billing</span>
                </button>
              </div>
            </div>
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
