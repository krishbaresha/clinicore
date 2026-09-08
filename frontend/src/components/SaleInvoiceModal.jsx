import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  dbSales,
  dbInventory,
  dbParties,
  dbClinic,
  dbVisits,
  dbPatients,
  dbUsers,
  dbSuppliers,
  dbCompanies,
  toTitleCase,
  getMaxDiscountLimit,
} from "../api/db.js";
import { printSaleInvoiceReceipt, generateSaleInvoiceReceiptHtml } from "../utils/thermalPrinter.js";
import { useAuth } from "../hooks/useAuth.js";

export default function SaleInvoiceModal({
  isOpen = true,
  onClose,
  isPage = false,
  onSave,
  initialParty = null,
  initialBillingType = null,
}) {
  const { user, activeCashier } = useAuth() || {};
  const activeUser = activeCashier?.name || user?.name || user?.username || "Mustafa";

  // Data lists from DB
  const [inventoryList, setInventoryList] = useState([]);
  const [partiesList, setPartiesList] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [todayVisits, setTodayVisits] = useState([]);

  // Active Billing Mode: 'retail' (Patient / Walk-in) | 'wholesale' (B2B Party)
  const [activeInvoiceMode, setActiveInvoiceMode] = useState(
    initialBillingType === "wholesale_party" ? "wholesale" : "retail"
  );

  // Mode in Retail: 'auto' | 'manual'
  const [tokenMode, setTokenMode] = useState("auto");
  const [isDoctorFeeIncluded, setIsDoctorFeeIncluded] = useState(true);

  // Clinic profile from DB
  const clinicInfo = useMemo(() => {
    try {
      return dbClinic?.get ? dbClinic.get() : {};
    } catch {
      return {};
    }
  }, []);

  // Doctors list from DB
  const registeredDoctors = useMemo(() => {
    try {
      if (dbUsers?.getDoctors) {
        const docs = dbUsers.getDoctors();
        if (docs && docs.length > 0) return docs;
      }
      const users = dbUsers?.getAll ? dbUsers.getAll() : [];
      const docs = users.filter(
        (u) =>
          (u.role === "doctor" || u.is_doctor) &&
          u.role !== "admin" &&
          u.id !== "user_admin_001" &&
          u.name !== "Clinic Administrator" &&
          u.status !== "inactive"
      );
      if (docs.length > 0) return docs;
    } catch {}
    const clinic = clinicInfo;
    return [
      {
        id: "doc_001",
        name: clinic.doctor_name || "Consultant Doctor",
        fee: clinic.doctor_fee || 0,
      },
    ];
  }, [clinicInfo]);

  // Initial Doctor defaults
  const primaryDoc = registeredDoctors[0] || {};
  const defaultDocFee = String(primaryDoc.consultation_fee || primaryDoc.fee || clinicInfo.doctor_fee || 0);

  // Form State
  const [saleForm, setSaleForm] = useState({
    date: new Date().toLocaleDateString("en-US"),
    voucher_no: "",
    token_no: "",
    patient_id: "",
    visit_id: "",
    account_name: "",
    naration: "",
    payment_mode: "Cash",
    bank_name: "",
    cheque_no: "",
    party_code: "",
    city: "",
    transport: "",
    bilty_no: "",
    salesman: activeUser || "Salesman",
    attending_doctor_id: primaryDoc.id || "",
    attending_doctor_name: primaryDoc.name || primaryDoc.full_name || clinicInfo.doctor_name || "Consultant Doctor",
    doctor_fee: defaultDocFee,
    cash_received: "",
  });

  // Fast Line Entry Cart Inputs
  const [entryLine, setEntryLine] = useState({
    inventory_id: "",
    product_code: "",
    medicine_name: "",
    product_description: "",
    company_name: "",
    category: "General",
    packing: "",
    qty: "1",
    rate: "0.00",
    disc_pct: "0",
  });

  // Cart Items
  const [cartItems, setCartItems] = useState([]);

  // Modals & Drawers
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [showNewPartyModal, setShowNewPartyModal] = useState(false);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilterMode, setHistoryFilterMode] = useState("All");

  // Typeahead / Autocomplete
  const [showMedDropdown, setShowMedDropdown] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showRetailCompanyDropdown, setShowRetailCompanyDropdown] = useState(false);
  const [retailCompanySearch, setRetailCompanySearch] = useState("");
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [highlightedMedIdx, setHighlightedMedIdx] = useState(0);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("All");

  // Dynamic POS Fee (Rs. 1.00) Toggle
  const [isPosFeeIncluded, setIsPosFeeIncluded] = useState(true);

  // Party Dropdown Ref for Click Outside
  const partyDropdownRef = useRef(null);

  // Toast Notifications
  const [toasts, setToasts] = useState([]);

  // Refs for keyboard navigation
  const medicineInputRef = useRef(null);
  const itemCodeInputRef = useRef(null);
  const companyCodeInputRef = useRef(null);
  const retailCompanyInputRef = useRef(null);
  const retailCompanyDropdownRef = useRef(null);
  const qtyInputRef = useRef(null);
  const rateInputRef = useRef(null);
  const discInputRef = useRef(null);
  const cashTenderedInputRef = useRef(null);
  const customerNameInputRef = useRef(null);
  const partyCodeInputRef = useRef(null);
  const medSuggestionsRef = useRef(null);
  const companyDropdownRef = useRef(null);

  // Toast helper
  const showToast = (message, isWarning = false) => {
    const id = Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, isWarning }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, isWarning ? 3500 : 2500);
  };

  // Refresh DB Data
  const refreshData = () => {
    const inv = dbInventory?.getAll ? dbInventory.getAll() : [];
    const pty = dbParties?.getAll ? dbParties.getAll() : [];
    const sls = dbSales?.getAll ? dbSales.getAll() : [];
    const vst = dbVisits?.getTodayAll ? dbVisits.getTodayAll() : (dbVisits?.getAll ? dbVisits.getAll() : []);

    setInventoryList(inv);
    setPartiesList(pty);
    setSalesHistory(sls);
    setTodayVisits(vst);

    const billingType = activeInvoiceMode === "wholesale" ? "wholesale_party" : "patient";
    const nextVoucher = dbSales?.getNextVoucherNo ? dbSales.getNextVoucherNo(billingType) : "";

    setSaleForm((prev) => ({
      ...prev,
      voucher_no: nextVoucher,
    }));
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  useEffect(() => {
    const billingType = activeInvoiceMode === "wholesale" ? "wholesale_party" : "patient";
    const nextVoucher = dbSales?.getNextVoucherNo ? dbSales.getNextVoucherNo(billingType) : "";
    setSaleForm((prev) => ({
      ...prev,
      voucher_no: nextVoucher,
    }));
  }, [activeInvoiceMode]);

  useEffect(() => {
    if (initialParty) {
      setActiveInvoiceMode("wholesale");
      const code = initialParty.party_code || initialParty.id || "";
      setSaleForm((prev) => ({
        ...prev,
        party_code: code,
        account_name: initialParty.name || initialParty.account_name || "",
        city: initialParty.city || "",
        transport: initialParty.transport || initialParty.address || "",
        bilty_no: initialParty.bilty_no || initialParty.bilty || "",
      }));
    }
    if (initialBillingType) {
      setActiveInvoiceMode(initialBillingType === "wholesale_party" ? "wholesale" : "retail");
    }
  }, [initialParty, initialBillingType]);

  // Initial doctor auto-selection
  useEffect(() => {
    if (registeredDoctors.length > 0 && !saleForm.attending_doctor_id) {
      const firstDoc = registeredDoctors[0];
      const fee = firstDoc.consultation_fee || firstDoc.fee || clinicInfo.doctor_fee || 0;
      setSaleForm((prev) => ({
        ...prev,
        attending_doctor_id: firstDoc.id || firstDoc.name,
        attending_doctor_name: firstDoc.name || firstDoc.full_name || clinicInfo.doctor_name || "Consultant Doctor",
        doctor_fee: String(fee),
      }));
    }
  }, [registeredDoctors, clinicInfo]);

  // Companies / Brands list
  const companyOptions = useMemo(() => {
    const list = [{ id: "All", label: "All Brands / Companies", code: "ALL", name: "All Brands" }];
    const seen = new Set(["all"]);

    // 1. From dbCompanies
    const comps = dbCompanies?.getAll ? dbCompanies.getAll() : [];
    comps.forEach((c) => {
      const name = (c.name || "").trim();
      const code = (c.code || "").trim().toUpperCase();
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        list.push({ id: name, label: code ? `[${code}] ${name}` : name, code: code || name.slice(0, 3).toUpperCase(), name });
      }
    });

    // 2. From dbSuppliers
    const sups = dbSuppliers?.getAll ? dbSuppliers.getAll() : [];
    sups.forEach((s) => {
      const name = (s.name || "").trim();
      const code = (s.supplier_code || s.code || "").trim().toUpperCase();
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        list.push({ id: name, label: code ? `[${code}] ${name}` : name, code: code || name.slice(0, 3).toUpperCase(), name });
      }
    });

    // 3. From inventoryList
    inventoryList.forEach((i) => {
      const comp = (i.company_name || "").trim();
      const code = (i.company_code || i.item_code || "").trim().toUpperCase();
      const key = comp.toLowerCase();
      if (comp && !seen.has(key)) {
        seen.add(key);
        list.push({ id: comp, label: code ? `[${code}] ${comp}` : comp, code: code || comp.slice(0, 3).toUpperCase(), name: comp });
      }
    });

    return list;
  }, [inventoryList]);

  // Filtered Company Options for Retail Quick Dropdown
  const filteredRetailCompanyOptions = useMemo(() => {
    if (!retailCompanySearch || !retailCompanySearch.trim()) {
      return companyOptions;
    }
    const q = retailCompanySearch.trim().toLowerCase();
    return companyOptions.filter(
      (c) =>
        c.id === "All" ||
        (c.name || "").toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q) ||
        (c.label || "").toLowerCase().includes(q)
    );
  }, [companyOptions, retailCompanySearch]);

  // Typeahead medicine suggestions (Expanded catalog up to 300 items with smart filtering)
  const medicineSuggestions = useMemo(() => {
    const q = (entryLine.medicine_name || "").trim().toLowerCase();
    const cleanQ = q.replace(/[\s\-_./]/g, "");

    let pool = inventoryList;
    if (selectedCompanyFilter && selectedCompanyFilter !== "All") {
      const compLower = selectedCompanyFilter.toLowerCase().trim();
      pool = pool.filter((i) => {
        const cName = (i.company_name || "").toLowerCase();
        const cCode = (i.company_code || "").toLowerCase();
        const itmCode = (i.item_code || "").toLowerCase();
        const medName = (i.medicine_name || "").toLowerCase();

        return (
          cName.includes(compLower) ||
          cCode === compLower ||
          (compLower.length <= 5 && cCode.includes(compLower)) ||
          (compLower.length >= 3 && itmCode.startsWith(compLower)) ||
          (compLower.length >= 3 && medName.startsWith(compLower))
        );
      });
    }

    if (!q) {
      // Return up to 300 medicines so user can browse extensive catalog
      return pool.slice(0, 300);
    }

    const matches = pool.filter((inv) => {
      const name = (inv.medicine_name || "").toLowerCase();
      const cleanName = name.replace(/[\s\-_./]/g, "");
      const code = (inv.item_code || inv.product_code || "").toLowerCase();
      const generic = (inv.generic_name || inv.product_description || inv.naration || "").toLowerCase();
      const comp = (inv.company_name || inv.company_code || "").toLowerCase();

      return (
        name.includes(q) ||
        cleanName.includes(cleanQ) ||
        code.includes(q) ||
        generic.includes(q) ||
        comp.includes(q)
      );
    });

    return matches.slice(0, 300);
  }, [inventoryList, entryLine.medicine_name, selectedCompanyFilter]);

  // Fast Item Code / Barcode Lookup Handler (Auto-fills product details & company)
  const handleLookupByItemCode = (codeQuery) => {
    if (!codeQuery || !String(codeQuery).trim()) return;
    const raw = String(codeQuery).trim();
    const clean = raw.toLowerCase();
    const cleanNoHyphen = clean.replace(/[\s\-_.]/g, "");

    // 1. Search in current company-filtered pool first if company filter is active
    let pool = inventoryList;
    if (selectedCompanyFilter && selectedCompanyFilter !== "All") {
      const compLower = selectedCompanyFilter.toLowerCase().trim();
      pool = pool.filter((i) => {
        const cName = (i.company_name || "").toLowerCase();
        const cCode = (i.company_code || "").toLowerCase();
        return cName.includes(compLower) || cCode === compLower;
      });
    }

    const checkMatch = (inv) => {
      const itmCode = (inv.item_code || "").toLowerCase();
      const prdCode = (inv.product_code || "").toLowerCase();
      const barcode = (inv.barcode || "").toLowerCase();
      const id = String(inv.id || "").toLowerCase();
      const medName = (inv.medicine_name || "").toLowerCase();

      // Exact match on item_code, product_code, barcode, or id
      if (itmCode === clean || prdCode === clean || barcode === clean || id === clean) {
        return true;
      }
      // Exact match without hyphens/spaces
      const itmNoHyphen = itmCode.replace(/[\s\-_.]/g, "");
      const prdNoHyphen = prdCode.replace(/[\s\-_.]/g, "");
      if (itmNoHyphen === cleanNoHyphen || prdNoHyphen === cleanNoHyphen) {
        return true;
      }
      // Exact match on medicine_name (e.g. user entered "Ghr-7")
      if (medName === clean || medName.replace(/[\s\-_.]/g, "") === cleanNoHyphen) {
        return true;
      }
      return false;
    };

    let matched = pool.find(checkMatch);

    // Fallback search across entire inventory if not in filtered pool
    if (!matched && pool !== inventoryList) {
      matched = inventoryList.find(checkMatch);
    }

    // Secondary prefix match if exact match not found
    if (!matched) {
      matched = inventoryList.find((inv) => {
        const itmCode = (inv.item_code || "").toLowerCase();
        const prdCode = (inv.product_code || "").toLowerCase();
        const medName = (inv.medicine_name || "").toLowerCase();
        return (
          (itmCode && itmCode.startsWith(clean)) ||
          (prdCode && prdCode.startsWith(clean)) ||
          (medName && medName.startsWith(clean))
        );
      });
    }

    if (matched) {
      const rate = Number(matched.unit_sale_price || matched.sale_price || matched.box_sale_price || matched.unit_price || 280) || 0;
      const compName = matched.company_name || "";
      const code = matched.item_code || matched.product_code || raw.toUpperCase();

      setEntryLine((prev) => ({
        ...prev,
        inventory_id: matched.id,
        product_code: code,
        medicine_name: matched.medicine_name,
        product_description: matched.product_description || matched.generic_name || matched.naration || "",
        company_name: compName,
        category: matched.category || matched.medicine_category || "General",
        packing: matched.packing || "",
        rate: rate.toFixed(2),
      }));

      if (compName) {
        setSelectedCompanyFilter(compName);
      }

      showToast(`Found: [${code}] ${matched.medicine_name} (${compName || "General"})`);

      setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 40);
    } else {
      showToast(`Item code "${raw}" not found in inventory!`, true);
    }
  };

  // Handle Token Input Lookup (Retail Patient Queue)
  const handleTokenInput = (val, preferredDoctorId = null) => {
    setSaleForm((prev) => ({ ...prev, token_no: val }));
    if (!val || !val.trim()) return;
    const clean = val.trim().toUpperCase();

    // 1. Check in today's visits list with live DB fallback
    const num = parseInt(clean.replace(/\D/g, ""), 10);
    const freshVisits = dbVisits?.getTodayAll ? dbVisits.getTodayAll() : (dbVisits?.getAll ? dbVisits.getAll() : []);
    const visitsPool = todayVisits && todayVisits.length > 0 ? todayVisits : freshVisits;
    const activeDocId = preferredDoctorId || saleForm.attending_doctor_id;

    // First attempt: match token number for the currently selected doctor
    let matchedVisit = visitsPool.find(
      (v) =>
        (activeDocId ? (v.doctor_id === activeDocId || (!v.doctor_id && activeDocId === "user_owner")) : false) &&
        (String(v.token_number) === clean ||
         `T-${v.token_number}`.toUpperCase() === clean ||
         (num && Number(v.token_number) === num))
    );

    // Second attempt: match any token number across today's pool
    if (!matchedVisit) {
      matchedVisit = visitsPool.find(
        (v) =>
          String(v.token_number) === clean ||
          `T-${v.token_number}`.toUpperCase() === clean ||
          (num && Number(v.token_number) === num)
      );
    }

    if (!matchedVisit && freshVisits !== visitsPool) {
      matchedVisit = freshVisits.find(
        (v) =>
          String(v.token_number) === clean ||
          `T-${v.token_number}`.toUpperCase() === clean ||
          (num && Number(v.token_number) === num)
      );
    }

    if (matchedVisit) {
      const pat = matchedVisit.patient_id ? dbPatients.getById(matchedVisit.patient_id) : null;
      const rawName = matchedVisit.patient_name || pat?.full_name || pat?.name || "";
      const docUser = matchedVisit.doctor_id ? dbUsers.getById(matchedVisit.doctor_id) : null;
      const doc = registeredDoctors.find((d) => d.id === matchedVisit.doctor_id || d.name === matchedVisit.doctor_name) || docUser;

      const resolvedDocName = matchedVisit.doctor_name || doc?.name || doc?.full_name || clinicInfo.doctor_name || "Consultant Doctor";
      const resolvedDocId = matchedVisit.doctor_id || doc?.id || (primaryDoc?.id || "");
      const fee = Number(
        matchedVisit.doctor_fee !== undefined && matchedVisit.doctor_fee !== null && matchedVisit.doctor_fee !== ""
          ? matchedVisit.doctor_fee
          : matchedVisit.fee_amount !== undefined && matchedVisit.fee_amount !== null && matchedVisit.fee_amount !== ""
          ? matchedVisit.fee_amount
          : doc?.consultation_fee || doc?.fee || clinicInfo.doctor_fee || 0
      );

      setSaleForm((prev) => ({
        ...prev,
        account_name: rawName,
        visit_id: matchedVisit.id,
        patient_id: matchedVisit.patient_id || "",
        attending_doctor_id: resolvedDocId,
        attending_doctor_name: resolvedDocName,
        doctor_fee: String(fee),
      }));
      setIsDoctorFeeIncluded(fee > 0);
      showToast(`Token #${matchedVisit.token_number}: ${rawName} • Dr. ${resolvedDocName} (Fee: Rs. ${fee})`);
      return;
    }

    // 2. Check in registered patients by MR / Name / Phone
    const patients = dbPatients?.getAll ? dbPatients.getAll() : [];
    const matchedPatient = patients.find(
      (p) =>
        (p.patient_mr && p.patient_mr.toUpperCase() === clean) ||
        (p.phone && p.phone.includes(clean)) ||
        (p.full_name && p.full_name.toUpperCase() === clean) ||
        (p.name && p.name.toUpperCase() === clean)
    );

    if (matchedPatient) {
      const patName = matchedPatient.full_name || matchedPatient.name || "";
      setSaleForm((prev) => ({
        ...prev,
        account_name: patName,
        patient_id: matchedPatient.id,
      }));
      showToast(`Patient Found: ${patName}`);
    }
  };

  // Switch Token Mode
  const setTokenModeHandler = (mode) => {
    setTokenMode(mode);
    if (mode === "auto") {
      // Find first waiting patient in today's visit queue
      const activeQueueVisit = todayVisits.find(
        (v) => v.status !== "completed" && v.status !== "cancelled"
      );
      if (activeQueueVisit) {
        handleTokenInput(String(activeQueueVisit.token_number || activeQueueVisit.id));
      } else {
        setSaleForm((prev) => ({
          ...prev,
          token_no: "",
          attending_doctor_id: primaryDoc.id || "",
          attending_doctor_name: primaryDoc.name || primaryDoc.full_name || clinicInfo.doctor_name || "Consultant Doctor",
          account_name: prev.account_name === "Walk-In Patient" ? "" : prev.account_name,
        }));
        setIsDoctorFeeIncluded(true);
      }
      showToast("Auto Token mode active");
    } else {
      setSaleForm((prev) => ({
        ...prev,
        token_no: "",
        attending_doctor_id: "",
        attending_doctor_name: "",
        doctor_fee: "0",
        account_name: prev.account_name === "Walk-In Patient" ? "" : (prev.account_name || ""),
      }));
      setIsDoctorFeeIncluded(false);
      showToast("Manual / Walk-In Mode: Doctor & Token disabled");
    }
  };

  // Quick Token Picker (supports exact visit object binding for zero doctor token collisions)
  const selectQuickToken = (tokenKey, visitObj = null) => {
    if (tokenKey === "WALK-IN" || tokenKey === "Walk-in") {
      setTokenModeHandler("manual");
      return;
    }
    setTokenMode("auto");
    if (visitObj) {
      const pat = visitObj.patient_id ? dbPatients.getById(visitObj.patient_id) : null;
      const rawName = visitObj.patient_name || pat?.full_name || pat?.name || "";
      const docUser = visitObj.doctor_id ? dbUsers.getById(visitObj.doctor_id) : null;
      const doc = registeredDoctors.find((d) => d.id === visitObj.doctor_id || d.name === visitObj.doctor_name) || docUser;
      const resolvedDocName = visitObj.doctor_name || doc?.name || doc?.full_name || clinicInfo.doctor_name || "Consultant Doctor";
      const resolvedDocId = visitObj.doctor_id || doc?.id || (primaryDoc?.id || "");
      const fee = Number(
        visitObj.doctor_fee !== undefined && visitObj.doctor_fee !== null && visitObj.doctor_fee !== ""
          ? visitObj.doctor_fee
          : visitObj.fee_amount !== undefined && visitObj.fee_amount !== null && visitObj.fee_amount !== ""
          ? visitObj.fee_amount
          : doc?.consultation_fee || doc?.fee || clinicInfo.doctor_fee || 0
      );

      setSaleForm((prev) => ({
        ...prev,
        token_no: String(visitObj.token_number || tokenKey),
        account_name: rawName,
        visit_id: visitObj.id,
        patient_id: visitObj.patient_id || "",
        attending_doctor_id: resolvedDocId,
        attending_doctor_name: resolvedDocName,
        doctor_fee: String(fee),
      }));
      setIsDoctorFeeIncluded(fee > 0);
      showToast(`Token #${visitObj.token_number}: ${rawName} • Dr. ${resolvedDocName}`);
      return;
    }
    handleTokenInput(tokenKey);
  };

  // Helper to select and link party to invoice
  const selectParty = (party) => {
    if (!party) return;
    setSaleForm((prev) => ({
      ...prev,
      party_code: party.party_code || prev.party_code,
      account_name: party.name,
      city: party.city || party.district || "",
      transport: party.transport || party.address || "",
      bilty_no: party.bilty_no || party.bilty || "",
      salesman: party.salesman || prev.salesman,
    }));
    setShowPartyDropdown(false);
    showToast(`Party Selected: ${party.name} (${party.party_code || "B2B"})`);
  };

  // Filtered Parties for Typeahead Dropdown
  const filteredParties = useMemo(() => {
    if (!partiesList || !Array.isArray(partiesList)) return [];
    const nameQ = (saleForm.account_name || "").trim().toLowerCase();
    const codeQ = (saleForm.party_code || "").trim().toLowerCase();
    if (!nameQ && !codeQ) {
      return partiesList.slice(0, 15);
    }
    return partiesList.filter((p) => {
      const pName = (p.name || "").toLowerCase();
      const pCode = (p.party_code || "").toLowerCase();
      const pCity = (p.city || "").toLowerCase();
      const pPhone = (p.phone || "").toLowerCase();
      return (
        (nameQ && (pName.includes(nameQ) || pCode.includes(nameQ) || pCity.includes(nameQ) || pPhone.includes(nameQ))) ||
        (codeQ && pCode.includes(codeQ))
      );
    }).slice(0, 15);
  }, [partiesList, saleForm.account_name, saleForm.party_code]);

  // Handle Party Code Input Lookup (Wholesale)
  const handlePartyCodeInput = (codeVal) => {
    setSaleForm((prev) => ({ ...prev, party_code: codeVal }));
    if (!codeVal || !codeVal.trim()) return;
    const clean = codeVal.trim().toUpperCase();

    // Check in partiesList
    const party = partiesList.find(
      (p) =>
        (p.party_code && p.party_code.toUpperCase() === clean) ||
        (p.code && p.code.toUpperCase() === clean) ||
        (p.name && p.name.toUpperCase().startsWith(clean)) ||
        (p.id && p.id.toUpperCase() === clean) ||
        (p.phone && p.phone.includes(clean))
    );

    if (party) {
      selectParty(party);
    }
  };

  // Close party, company, and typeahead dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (partyDropdownRef.current && !partyDropdownRef.current.contains(e.target)) {
        setShowPartyDropdown(false);
      }
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target)) {
        setShowCompanyDropdown(false);
      }
      if (retailCompanyDropdownRef.current && !retailCompanyDropdownRef.current.contains(e.target)) {
        setShowRetailCompanyDropdown(false);
      }
      if (
        medSuggestionsRef.current &&
        !medSuggestionsRef.current.contains(e.target) &&
        medicineInputRef.current &&
        !medicineInputRef.current.contains(e.target)
      ) {
        setShowMedDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Matched Party & Matched Patient Previous Balance (Purana Udhaar)
  const matchedParty = useMemo(() => {
    if (activeInvoiceMode !== "wholesale" || !saleForm.account_name) return null;
    const lower = saleForm.account_name.toLowerCase().trim();
    return partiesList.find((p) => p.name && p.name.toLowerCase().trim() === lower) || null;
  }, [partiesList, saleForm.account_name, activeInvoiceMode]);

  const matchedPatient = useMemo(() => {
    if (activeInvoiceMode !== "retail") return null;
    if (saleForm.patient_id) {
      return dbPatients?.getById ? dbPatients.getById(saleForm.patient_id) : null;
    }
    if (saleForm.account_name) {
      const lower = saleForm.account_name.toLowerCase().trim();
      return (dbPatients?.getAll ? dbPatients.getAll() : []).find((p) => {
        const pName = (p.full_name || p.name || "").toLowerCase().trim();
        return pName && (lower.includes(pName) || pName.includes(lower));
      }) || null;
    }
    return null;
  }, [saleForm.patient_id, saleForm.account_name, activeInvoiceMode]);

  const puranaUdhaar = useMemo(() => {
    if (activeInvoiceMode === "wholesale") {
      return Math.round(Number(matchedParty?.current_balance || matchedParty?.opening_balance || 0));
    }
    if (activeInvoiceMode === "retail") {
      return Math.round(Number(matchedPatient?.balance_due || matchedPatient?.current_balance || 0));
    }
    return 0;
  }, [activeInvoiceMode, matchedParty, matchedPatient]);

  // Master Clean Slate Reset for Next Transaction / Customer
  const resetInvoiceToCleanSlate = (targetMode = activeInvoiceMode) => {
    const isWholesale = targetMode === "wholesale";
    const billingType = isWholesale ? "wholesale_party" : "patient";
    const nextVoucher = dbSales?.getNextVoucherNo ? dbSales.getNextVoucherNo(billingType) : "";

    setCartItems([]);
    setEntryLine({
      inventory_id: "",
      product_code: "",
      medicine_name: "",
      product_description: "",
      company_name: "",
      category: "General",
      packing: "",
      qty: "1",
      rate: "0.00",
      disc_pct: "0",
    });

    const isAutoRetail = !isWholesale && tokenMode === "auto";

    setSaleForm({
      date: new Date().toLocaleDateString("en-US"),
      voucher_no: nextVoucher,
      token_no: "",
      patient_id: "",
      visit_id: "",
      account_name: "",
      naration: "",
      payment_mode: "Cash",
      bank_name: "",
      cheque_no: "",
      party_code: "",
      city: "",
      transport: "",
      bilty_no: "",
      salesman: activeUser || "Salesman",
      attending_doctor_id: isAutoRetail ? (primaryDoc.id || "") : "",
      attending_doctor_name: isAutoRetail ? (primaryDoc.name || primaryDoc.full_name || clinicInfo.doctor_name || "Consultant Doctor") : "",
      doctor_fee: isAutoRetail ? defaultDocFee : "0",
      cash_received: "",
    });

    setSelectedReceiptSale(null);
    setShowMedDropdown(false);
    setShowCompanyDropdown(false);
    setShowRetailCompanyDropdown(false);
    setSelectedCompanyFilter("All");
    setRetailCompanySearch("");
    setShowPartyDropdown(false);
    refreshData();
  };

  // Mode Switcher Handler with Complete Clean Reset
  const switchInvoiceMode = (mode) => {
    if (activeInvoiceMode === mode) return;
    setActiveInvoiceMode(mode);
    resetInvoiceToCleanSlate(mode);

    if (mode === "wholesale") {
      showToast("Switched to Wholesale B2B Mode (Alt+9) — Clean Slate");
    } else {
      setTokenMode("auto");
      showToast("Switched to Retail POS Mode (Alt+5) — Clean Slate");
    }
  };

  // Select item from typeahead autocomplete
  const handleSelectTypeaheadMedicine = (inv) => {
    if (!inv) return;
    const rate = Number(inv.unit_sale_price || inv.sale_price || inv.box_sale_price || inv.unit_price || 280) || 0;
    const qty = Number(entryLine.qty) || 1;
    const code = inv.item_code || inv.product_code || "";
    const comp = inv.company_name || "";

    setEntryLine({
      inventory_id: inv.id,
      product_code: code,
      medicine_name: inv.medicine_name,
      product_description: inv.product_description || inv.generic_name || inv.naration || "",
      company_name: comp,
      category: inv.category || inv.medicine_category || "General",
      packing: inv.packing || "",
      qty: String(qty),
      rate: rate.toFixed(2),
      disc_pct: entryLine.disc_pct || "0",
    });

    if (comp && (!selectedCompanyFilter || selectedCompanyFilter === "All")) {
      setSelectedCompanyFilter(comp);
    }

    setShowMedDropdown(false);
    setHighlightedMedIdx(0);
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 40);
  };

  // Keyboard navigation on medicine input
  const handleMedicineKeyDown = (e) => {
    if (showMedDropdown && medicineSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedMedIdx((prev) => Math.min(medicineSuggestions.length - 1, prev + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedMedIdx((prev) => Math.max(0, prev - 1));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (medicineSuggestions[highlightedMedIdx]) {
          handleSelectTypeaheadMedicine(medicineSuggestions[highlightedMedIdx]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMedDropdown(false);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }
  };

  // Dynamic Maximum Discount Limit Handler
  const handleDiscInputChange = (e) => {
    const val = e.target.value;
    const maxLimit = getMaxDiscountLimit ? getMaxDiscountLimit() : 28;
    const numVal = parseFloat(val);
    if (!isNaN(numVal) && numVal > maxLimit) {
      alert(
        `⚠️ Maximum Discount Alert!\nAdmin Panel ne maximum discount limit ${maxLimit}% set ki hui hai.\nAap is se zyada discount nahi de sakte. Value automatically ${maxLimit}% par set kar di gayi hai.`
      );
      setEntryLine((prev) => ({ ...prev, disc_pct: String(maxLimit) }));
    } else if (!isNaN(numVal) && numVal < 0) {
      setEntryLine((prev) => ({ ...prev, disc_pct: "0" }));
    } else {
      setEntryLine((prev) => ({ ...prev, disc_pct: val }));
    }
  };

  // Add Item to Cart (With Auto-Merge & Quantity Consolidation for Same Medicine)
  const addNewItem = () => {
    const name = entryLine.medicine_name.trim();
    if (!name) {
      showToast("Please enter or select a medicine first!", true);
      medicineInputRef.current?.focus();
      return;
    }

    const qty = parseInt(entryLine.qty, 10) || 1;
    const rate = parseFloat(entryLine.rate) || 0;
    const maxLimit = getMaxDiscountLimit ? getMaxDiscountLimit() : 28;
    let disc = parseFloat(entryLine.disc_pct) || 0;
    if (disc > maxLimit) {
      alert(
        `⚠️ Maximum Discount Alert!\nAdmin Panel ne maximum discount limit ${maxLimit}% set ki hui hai.\nAap is se zyada discount nahi de sakte!`
      );
      disc = maxLimit;
      showToast(`⚠️ Discount capped! Max discount is ${maxLimit}%`, true);
      setEntryLine((prev) => ({ ...prev, disc_pct: String(maxLimit) }));
    } else if (disc < 0) {
      disc = 0;
    }

    // Check if the medicine already exists in the cart (by inventory_id or exact name)
    const existingIndex = cartItems.findIndex((item) => {
      if (entryLine.inventory_id && item.inventory_id) {
        return item.inventory_id === entryLine.inventory_id;
      }
      return (item.name || "").trim().toLowerCase() === name.toLowerCase();
    });

    if (existingIndex >= 0) {
      // Merge / Increment Quantity on existing cart row
      const existing = cartItems[existingIndex];
      const updatedQty = Number(existing.qty) + qty;
      const effectiveRate = rate > 0 ? rate : Number(existing.rate);
      const effectiveDisc = disc > 0 ? disc : Number(existing.discPercent || 0);
      const updatedGross = updatedQty * effectiveRate;
      const updatedNet = updatedGross - (updatedGross * effectiveDisc) / 100;

      const updatedItem = {
        ...existing,
        qty: updatedQty,
        rate: effectiveRate,
        gross: updatedGross,
        discPercent: effectiveDisc,
        net: updatedNet,
        detail: entryLine.product_description || existing.detail,
        company: entryLine.company_name || existing.company,
      };

      const nextCart = [...cartItems];
      nextCart[existingIndex] = updatedItem;
      setCartItems(nextCart);
      showToast(`Consolidated: ${name} (Total Qty: ${updatedQty})`);
    } else {
      // Add as new row in cart
      const gross = qty * rate;
      const net = gross - (gross * disc) / 100;

      const newItem = {
        id: "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        inventory_id: entryLine.inventory_id,
        product_code: entryLine.product_code,
        item_code: entryLine.product_code,
        name: name,
        detail: entryLine.product_description || (entryLine.company_name ? `${entryLine.company_name} • Formula Standard` : "Formula Standard"),
        company: entryLine.company_name || "",
        category: entryLine.category || "General",
        packing: entryLine.packing || "",
        qty: qty,
        rate: rate,
        gross: gross,
        discPercent: disc,
        net: net,
      };

      setCartItems((prev) => [...prev, newItem]);
      showToast(`Added: ${name} (Qty: ${qty})`);
    }

    // Reset Line Entry for next medicine
    setEntryLine({
      inventory_id: "",
      product_code: "",
      medicine_name: "",
      product_description: "",
      company_name: selectedCompanyFilter !== "All" ? selectedCompanyFilter : "",
      category: "General",
      packing: "",
      qty: "1",
      rate: "0.00",
      disc_pct: "0",
    });

    setTimeout(() => {
      medicineInputRef.current?.focus();
    }, 40);
  };

  // Delete Cart Item
  const deleteCartItem = (id) => {
    const item = cartItems.find((i) => i.id === id);
    setCartItems((prev) => prev.filter((i) => i.id !== id));
    if (item) {
      showToast(`Removed: ${item.name}`);
    }
  };

  // Clear Cart & Clean Slate Reset
  const confirmClearCart = () => {
    resetInvoiceToCleanSlate(activeInvoiceMode);
    showToast("Cart and customer details reset (Clean Slate)");
    setTimeout(() => {
      medicineInputRef.current?.focus();
    }, 40);
  };

  // Calculations
  const calculations = useMemo(() => {
    let medsGross = 0;
    let totalDiscount = 0;

    cartItems.forEach((item) => {
      const rowGross = item.qty * item.rate;
      const rowDisc = (rowGross * item.discPercent) / 100;
      medsGross += rowGross;
      totalDiscount += rowDisc;
    });

    const isRetail = activeInvoiceMode === "retail";
    const opdFee =
      isRetail && tokenMode === "auto" && isDoctorFeeIncluded
        ? Number(saleForm.doctor_fee || 0)
        : 0;

    const posFee = isPosFeeIncluded ? 1 : 0;

    const medsNet = medsGross - totalDiscount;
    const currentBill = medsNet + opdFee + posFee;
    const grandNet = currentBill + (puranaUdhaar > 0 ? puranaUdhaar : 0);

    const cashTenderedVal =
      saleForm.cash_received !== undefined && saleForm.cash_received !== ""
        ? parseFloat(saleForm.cash_received) || 0
        : 0;

    const change = Math.max(0, cashTenderedVal - grandNet);
    const balanceDue = Math.max(0, grandNet - cashTenderedVal);

    return {
      medsGross,
      totalDiscount,
      opdFee,
      posFee,
      medsNet,
      currentBill,
      grandNet,
      cashTenderedVal,
      change,
      balanceDue,
    };
  }, [cartItems, activeInvoiceMode, tokenMode, isDoctorFeeIncluded, isPosFeeIncluded, saleForm.doctor_fee, saleForm.cash_received, puranaUdhaar]);

  // Save Sale and Print
  const processSaleAndPrint = () => {
    if (cartItems.length === 0) {
      showToast("Cart is empty. Add medicines first!", true);
      medicineInputRef.current?.focus();
      return;
    }

    const billingType = activeInvoiceMode === "wholesale" ? "wholesale_party" : "patient";
    const resolvedAccountName =
      toTitleCase(saleForm.account_name.trim()) ||
      (billingType === "patient" ? "Walk-In Patient" : "Walk-In Customer");

    const isWholesale = activeInvoiceMode === "wholesale";
    const isExplicitManual = tokenMode === "manual";
    const cleanedTokenNo = isExplicitManual || isWholesale ? "" : (saleForm.token_no || "").trim();
    const cleanedDoctorName = isExplicitManual || isWholesale ? "" : (saleForm.attending_doctor_name || "").trim();
    const cleanedDoctorId = isExplicitManual || isWholesale ? "" : (saleForm.attending_doctor_id || "");

    const createdSale = dbSales?.addSaleInvoice
      ? dbSales.addSaleInvoice({
          ...saleForm,
          token_no: cleanedTokenNo,
          attending_doctor_id: cleanedDoctorId,
          attending_doctor_name: cleanedDoctorName,
          billing_type: billingType,
          account_name: resolvedAccountName,
          items: cartItems.map((item) => ({
            id: item.id,
            inventory_id: item.inventory_id,
            product_code: item.product_code,
            medicine_name: item.name,
            company_name: item.company,
            qty: item.qty,
            rate: item.rate,
            gross: item.gross,
            disc_pct: `${item.discPercent}%`,
            disc_pct_num: item.discPercent,
            net: item.net,
            line_total: item.net,
          })),
          salesman: saleForm.salesman || activeUser || "Salesman",
          cashier_name: activeUser || saleForm.salesman || "Salesman",
          active_cashier_name: activeUser || saleForm.salesman || "Salesman",
          subtotal: calculations.medsNet,
          subtotal_amount: calculations.medsGross,
          gross_amount: calculations.medsGross,
          discount_amount: calculations.totalDiscount,
          total_discount: calculations.totalDiscount,
          doctor_fee: String(calculations.opdFee),
          doctor_fee_waived: !isDoctorFeeIncluded,
          pos_fee: calculations.posFee,
          is_pos_fee_included: isPosFeeIncluded,
          previous_balance: puranaUdhaar,
          purana_udhaar: puranaUdhaar,
          total_amount: calculations.currentBill,
          paid_amount: calculations.cashTenderedVal || calculations.currentBill,
          cash_received: saleForm.cash_received,
          change_return: calculations.change,
          balance_due: calculations.balanceDue,
        })
      : {
          voucher_no: saleForm.voucher_no,
          account_name: resolvedAccountName,
          created_at: new Date().toISOString(),
          items: cartItems,
          total_amount: calculations.currentBill,
        };

    const clinic = dbClinic?.get ? dbClinic.get() : {};
    try {
      printSaleInvoiceReceipt(createdSale, clinic);
    } catch (err) {
      console.warn("Print error:", err);
    }

    showToast(`Invoice #${createdSale.voucher_no || saleForm.voucher_no} saved and printed!`);

    // Automatic clean slate reset for next customer / party
    resetInvoiceToCleanSlate(activeInvoiceMode);

    setTimeout(() => {
      medicineInputRef.current?.focus();
    }, 60);

    if (onSave) onSave(createdSale);
  };

  // Active sale data for Live 80mm ESC/POS Thermal Receipt
  const activeReceiptSaleData = useMemo(() => {
    if (selectedReceiptSale) {
      return {
        ...selectedReceiptSale,
        billing_type: selectedReceiptSale.billing_type || (activeInvoiceMode === "wholesale" ? "wholesale_party" : "patient"),
        items: (selectedReceiptSale.items || []).map((i) => ({
          medicine_name: i.medicine_name || i.name || i.item_name || "Item",
          qty: Number(i.qty || i.quantity || 1),
          rate: Number(i.rate || i.unit_price || 0),
          disc_pct: i.disc_pct ?? i.disc_pct_num ?? (i.discPercent != null ? `${i.discPercent}%` : "0%"),
          net: Number(i.net || i.line_total || 0),
          company_name: i.company_name || i.manufacturer || "",
          category: i.category || "General",
        })),
        doctor_fee: selectedReceiptSale.doctor_fee || "0",
        doctor_fee_waived: selectedReceiptSale.doctor_fee_waived,
        total_amount: selectedReceiptSale.total_amount || 0,
        subtotal_amount: selectedReceiptSale.subtotal || selectedReceiptSale.subtotal_amount || selectedReceiptSale.total_amount,
        cash_tendered: selectedReceiptSale.cash_received || selectedReceiptSale.paid_amount || selectedReceiptSale.total_amount,
        change_due: selectedReceiptSale.change_return || selectedReceiptSale.change_due || 0,
        previous_balance: selectedReceiptSale.previous_balance || selectedReceiptSale.purana_udhaar || 0,
      };
    }

    const isWholesale = activeInvoiceMode === "wholesale";
    const isExplicitManual = tokenMode === "manual";
    const resolvedTokenNo = isExplicitManual || isWholesale ? "" : (saleForm.token_no || "").trim();
    const resolvedDoctorName = isExplicitManual || isWholesale ? "" : (saleForm.attending_doctor_name || "").trim();

    const resolvedAccountName =
      saleForm.account_name ||
      (activeInvoiceMode === "wholesale"
        ? "Wholesale Party"
        : resolvedTokenNo
        ? `Token #${resolvedTokenNo}`
        : "Walk-In Customer");

    return {
      voucher_no: saleForm.voucher_no || "DRAFT",
      receipt_no: saleForm.voucher_no || "DRAFT",
      billing_type: activeInvoiceMode === "wholesale" ? "wholesale_party" : "patient",
      is_wholesale: activeInvoiceMode === "wholesale",
      date: saleForm.date,
      sale_date: new Date().toISOString(),
      account_name: resolvedAccountName,
      patient_name: resolvedAccountName,
      token_no: resolvedTokenNo,
      party_code: saleForm.party_code,
      salesman: saleForm.salesman,
      city: saleForm.city,
      transport: saleForm.transport,
      bilty_no: saleForm.bilty_no,
      payment_mode: saleForm.payment_mode,
      payment_type:
        saleForm.payment_mode === "Credit / Udhaar" || saleForm.payment_mode === "Credit" ? "credit" : "cash",
      attending_doctor_name: resolvedDoctorName,
      doctor_fee: String(calculations.opdFee),
      doctor_fee_waived: !isDoctorFeeIncluded,
      pos_fee: calculations.posFee,
      is_pos_fee_included: isPosFeeIncluded,
      items: cartItems.map((i) => ({
        medicine_name: i.name,
        qty: i.qty,
        rate: i.rate,
        disc_pct: `${i.discPercent}%`,
        net: i.net,
        company_name: i.company_name || "",
        category: i.category || "General",
        unit_label: i.packing || "",
      })),
      subtotal_amount: calculations.medsGross,
      subtotal: calculations.medsGross,
      discount_amount: calculations.totalDiscount,
      total_amount: calculations.currentBill,
      cash_tendered: calculations.cashTenderedVal,
      change_due: calculations.change,
      balance_due: calculations.balanceDue,
      previous_balance: puranaUdhaar,
      purana_udhaar: puranaUdhaar,
    };
  }, [selectedReceiptSale, saleForm, activeInvoiceMode, cartItems, calculations, isDoctorFeeIncluded, puranaUdhaar]);

  // Generate Live Thermal Receipt HTML
  const receiptPreviewHtml = useMemo(() => {
    if (!showReceiptModal) return "";
    return generateSaleInvoiceReceiptHtml(activeReceiptSaleData, clinicInfo);
  }, [showReceiptModal, activeReceiptSaleData, clinicInfo]);

  // Open Preview Modal
  const openReceiptModal = () => {
    setSelectedReceiptSale(null);
    setShowReceiptModal(true);
  };

  // Print Direct from Preview Modal
  const handlePrintModalReceipt = () => {
    setShowReceiptModal(false);
    if (selectedReceiptSale) {
      // Historical reprint from Invoices Logbook
      const clinic = dbClinic?.get ? dbClinic.get() : {};
      printSaleInvoiceReceipt(selectedReceiptSale, clinic);
      showToast(`Reprinted Invoice #${selectedReceiptSale.voucher_no || selectedReceiptSale.receipt_no}`);
    } else {
      // Direct print on active unsaved cart -> save invoice and reset clean slate
      processSaleAndPrint();
    }
  };

  // Reprint from Logbook
  const reprintLogInvoice = (sale) => {
    setSelectedReceiptSale(sale);
    setShowInvoicesModal(false);
    setShowReceiptModal(true);
    showToast(`Loaded invoice #${sale.voucher_no || sale.receipt_no}`);
  };

  // Salesmen list from DB
  const salesmanOptions = useMemo(() => {
    try {
      const users = dbUsers?.getAll ? dbUsers.getAll() : [];
      const names = users
        .filter((u) => u.status !== "inactive")
        .map((u) => u.name || u.full_name || u.username)
        .filter(Boolean);
      if (names.length > 0) return Array.from(new Set(names));
    } catch {}
    return [activeUser || "Counter Salesman"];
  }, [activeUser]);

  // Real-time Queue Tokens for Quick Tokens Strip
  const queueTokensList = useMemo(() => {
    return todayVisits
      .filter((v) => v.status !== "completed" && v.status !== "cancelled")
      .slice(0, 4);
  }, [todayVisits]);

  // Save New Party Modal
  const [newPartyForm, setNewPartyForm] = useState({
    party_code: "",
    name: "",
    city: clinicInfo.city || "",
    phone: "",
    address: "",
    balance_due: "0",
  });

  const handleSaveNewParty = (e) => {
    e.preventDefault();
    const storeName = newPartyForm.name.trim();
    if (!storeName) {
      showToast("⚠️ Store / Pharmacy Name is required!");
      return;
    }

    const cleanName = storeName.toLowerCase();
    const cleanCode = newPartyForm.party_code.trim().toLowerCase();

    // Check if party with same name or code already exists
    const allExisting = dbParties?.getAll ? dbParties.getAll() : partiesList;
    const existing = allExisting.find(
      (p) =>
        (p.name && p.name.trim().toLowerCase() === cleanName) ||
        (cleanCode && p.party_code && p.party_code.trim().toLowerCase() === cleanCode)
    );

    if (existing) {
      showToast(`⚠️ Party '${existing.name}' already registered (Code: ${existing.party_code || "P-XXX"})! Auto-linked.`);
      selectParty(existing);
      setShowNewPartyModal(false);
      return;
    }

    const pCode = newPartyForm.party_code.trim() || `P-${Math.floor(100 + Math.random() * 900)}`;
    const newRecord = {
      party_code: pCode.toUpperCase(),
      name: storeName,
      city: newPartyForm.city.trim() || clinicInfo.city || "Hyderabad",
      phone: newPartyForm.phone.trim(),
      address: newPartyForm.address.trim(),
      transport: newPartyForm.address.trim(),
      balance_due: Number(newPartyForm.balance_due) || 0,
      current_balance: Number(newPartyForm.balance_due) || 0,
      opening_balance: Number(newPartyForm.balance_due) || 0,
      salesman: saleForm.salesman || activeUser || "Salesman",
    };

    let created = null;
    if (dbParties?.add) {
      created = dbParties.add(newRecord);
    }

    const freshList = dbParties?.getAll ? dbParties.getAll() : [];
    setPartiesList(freshList);

    const savedParty = created || newRecord;
    selectParty(savedParty);
    setShowNewPartyModal(false);
    setNewPartyForm({
      party_code: "",
      name: "",
      city: clinicInfo.city || "",
      phone: "",
      address: "",
      balance_due: "0",
    });
    showToast(`✅ Registered & Linked Party: ${savedParty.name} (${savedParty.party_code})`);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Alt+5 -> Retail
      if (e.altKey && e.key === "5") {
        e.preventDefault();
        switchInvoiceMode("retail");
      }
      // Alt+9 -> Wholesale
      if (e.altKey && e.key === "9") {
        e.preventDefault();
        switchInvoiceMode("wholesale");
      }
      // F9 -> Save & Print
      if (e.key === "F9") {
        e.preventDefault();
        processSaleAndPrint();
      }
      // F8 -> Focus Cash Tendered
      if (e.key === "F8") {
        e.preventDefault();
        cashTenderedInputRef.current?.focus();
        cashTenderedInputRef.current?.select();
      }
      // F12 -> Shortcuts Toast
      if (e.key === "F12") {
        e.preventDefault();
        showToast("Shortcuts: Alt+5 (Retail), Alt+9 (Wholesale), F8 (Cash), F9 (Save & Print), Del (Delete)");
      }
      // '/' -> Focus Medicine Search
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        medicineInputRef.current?.focus();
        medicineInputRef.current?.select();
      }
      // Delete key -> Remove last item in cart
      if (e.key === "Delete" && document.activeElement?.tagName !== "INPUT" && cartItems.length > 0) {
        deleteCartItem(cartItems[cartItems.length - 1].id);
      }
      // Escape -> Close Modals & Dropdowns
      if (e.key === "Escape") {
        setShowReceiptModal(false);
        setShowInvoicesModal(false);
        setShowNewPartyModal(false);
        setShowMedDropdown(false);
        setShowCompanyDropdown(false);
      }
    };

    const handleClickOutside = (e) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target)) {
        setShowCompanyDropdown(false);
      }
      if (medSuggestionsRef.current && !medSuggestionsRef.current.contains(e.target) && e.target !== medicineInputRef.current) {
        setShowMedDropdown(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, cartItems, activeInvoiceMode, calculations, saleForm]);

  if (!isOpen) return null;

  // Entry Line Live Calculations
  const entryGross = ((parseFloat(entryLine.qty) || 0) * (parseFloat(entryLine.rate) || 0)).toFixed(2);
  const entryNet = (
    parseFloat(entryGross) -
    (parseFloat(entryGross) * (parseFloat(entryLine.disc_pct) || 0)) / 100
  ).toFixed(2);

  const mainLayout = (
    <div className="w-full h-full flex flex-col bg-slate-100 font-sans text-slate-800 antialiased overflow-hidden select-none">
      {/* ================= BEGIN: InvoiceSubheaderBar ================= */}
      <div className="app-subheader bg-white border-b border-slate-200 px-3.5 sm:px-4 py-1.5 flex items-center justify-between flex-shrink-0 h-10 z-10" id="invoiceSubheaderBar">
        {/* Left: Title, Inv Number, Live Status */}
        <div className="flex items-center gap-2 whitespace-nowrap">
          <h1 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 leading-none">
            <span>{activeInvoiceMode === "wholesale" ? "B2B Invoice" : "Sale Invoice"}</span>
          </h1>
          <span className="px-1.5 py-0.5 text-[11px] font-semibold rounded bg-teal-50 text-teal-800 border border-teal-200 font-mono leading-none">
            #{saleForm.voucher_no}
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live</span>
          </span>
        </div>

        {/* Center: Switcher Segmented Control */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 gap-0.5">
          <button
            type="button"
            onClick={() => switchInvoiceMode("retail")}
            className={`px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
              activeInvoiceMode === "retail"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-transparent text-slate-600 hover:text-teal-700 hover:bg-slate-200/70"
            }`}
            title="Retail POS Mode (Alt+5)"
          >
            <span>Retail</span>
            <kbd className={`text-[9px] font-mono px-1 rounded ${activeInvoiceMode === "retail" ? "bg-teal-800 text-teal-100" : "bg-slate-200 text-slate-600"}`}>
              Alt+5
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => switchInvoiceMode("wholesale")}
            className={`px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
              activeInvoiceMode === "wholesale"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-transparent text-slate-600 hover:text-teal-700 hover:bg-slate-200/70"
            }`}
            title="Wholesale B2B Mode (Alt+9)"
          >
            <span>Wholesale</span>
            <kbd className={`text-[9px] font-mono px-1 rounded ${activeInvoiceMode === "wholesale" ? "bg-teal-800 text-teal-100" : "bg-slate-200 text-slate-600"}`}>
              Alt+9
            </kbd>
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openReceiptModal}
            className="px-2 py-1 text-[11px] font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 flex items-center gap-1 whitespace-nowrap transition-colors shadow-xs cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Preview Slip</span>
          </button>
          <button
            type="button"
            onClick={() => setShowInvoicesModal(true)}
            className="px-2 py-1 text-[11px] font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 flex items-center gap-1 whitespace-nowrap transition-colors shadow-xs cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Invoices List</span>
          </button>
          {!isPage && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close POS"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {/* ================= END: InvoiceSubheaderBar ================= */}

      {/* ================= BEGIN: ScrollableWorkspace ================= */}
      <div className="flex-1 flex flex-col min-h-0 p-2.5 sm:p-3 space-y-2 overflow-hidden">
        {/* 1A: Retail / Patient Customer Ribbon */}
        {activeInvoiceMode === "retail" && (
          <section className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs flex-shrink-0" data-purpose="customer-info-strip">
            <div className="space-y-1.5">
              {/* Row 1: Token Mode Switcher, Patient Name, Payment Mode, Token Field */}
              <div className="flex flex-wrap items-center gap-2 justify-between">
                {/* Two-State Toggle Button Group */}
                <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 flex-shrink-0" role="group">
                  <button
                    type="button"
                    onClick={() => setTokenModeHandler("auto")}
                    className={`px-2 py-1 text-[11px] font-bold rounded flex items-center gap-1 transition-all cursor-pointer ${
                      tokenMode === "auto"
                        ? "bg-teal-700 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tokenMode === "auto" && (
                      <svg className="w-3 h-3 text-teal-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span>Auto Token (Patient)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTokenModeHandler("manual")}
                    className={`px-2 py-1 text-[11px] font-medium rounded transition-all cursor-pointer ${
                      tokenMode === "manual"
                        ? "bg-teal-700 text-white shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Manual / Walk-In</span>
                  </button>
                </div>

                {/* Customer / Patient Name Input */}
                <div className="flex-1 min-w-[200px] max-w-md">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      ref={customerNameInputRef}
                      type="text"
                      value={saleForm.account_name}
                      onChange={(e) => setSaleForm({ ...saleForm, account_name: e.target.value })}
                      placeholder="Enter patient name..."
                      className="w-full text-xs font-medium pl-7 pr-20 py-1 rounded-md border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-slate-50/50 hover:bg-white transition h-8 outline-none"
                    />
                    <div className="absolute right-1.5 top-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium leading-none ${tokenMode === "auto" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                        {tokenMode === "auto" ? "Token Linked" : "Walk-In"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Mode (Retail) */}
                <div className="w-32 flex-shrink-0">
                  <select
                    value={saleForm.payment_mode}
                    onChange={(e) => setSaleForm({ ...saleForm, payment_mode: e.target.value })}
                    className="w-full text-xs font-medium py-1 px-2 rounded-md border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-slate-50/50 hover:bg-white transition text-slate-700 h-8 outline-none cursor-pointer"
                  >
                    <option value="Cash">Cash (F8)</option>
                    <option value="Credit / Udhaar">Credit / Udhaar</option>
                    <option value="Easypaisa">Easypaisa</option>
                    <option value="JazzCash">JazzCash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                {/* Dynamic POS Charges Toggle Checkbox */}
                <div className="flex items-center space-x-1.5 ml-auto">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-teal-50/50 border border-slate-200 px-2 py-1 rounded-md transition select-none h-8" title="POS Service Fee / Charges (Rs. 1)">
                    <input
                      type="checkbox"
                      checked={isPosFeeIncluded}
                      onChange={(e) => setIsPosFeeIncluded(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300 transition cursor-pointer"
                    />
                    <span className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                      <span>POS Fee:</span>
                      <span className={`font-mono font-bold ${isPosFeeIncluded ? "text-teal-800" : "text-slate-400 line-through"}`}>
                        {isPosFeeIncluded ? "Rs. 1" : "Rs. 0"}
                      </span>
                    </span>
                  </label>
                </div>

                {/* Token Box (Visible ONLY in Auto Token Mode) */}
                {tokenMode === "auto" && (
                  <div className="flex items-center gap-1 flex-shrink-0 animate-fade-in">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Token:</label>
                    <input
                      type="text"
                      value={saleForm.token_no}
                      onChange={(e) => handleTokenInput(e.target.value)}
                      placeholder="T-01"
                      className="w-14 font-mono font-bold text-xs py-1 px-1.5 text-center rounded-md border border-slate-200 bg-slate-100 text-teal-800 uppercase focus:border-teal-600 focus:ring-1 focus:ring-teal-600 h-8 outline-none"
                    />
                    <span className="text-[9px] text-teal-700 font-mono hidden sm:inline-block">
                      auto-sync
                    </span>
                  </div>
                )}
              </div>

              {/* Row 2: Assigned Doctor & OPD Consultation Fee Section (Visible ONLY in Auto Token Mode) */}
              {tokenMode === "auto" && (
                <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-in">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Assigned Doctor Dropdown / Selector */}
                    <div className="min-w-[220px]">
                      <div className="flex items-center space-x-1.5 bg-teal-50 border border-teal-200 rounded-md px-2 py-1 text-xs text-teal-900" title="Assigned Doctor">
                        <svg className="w-3.5 h-3.5 text-teal-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="leading-tight flex-1">
                          <div className="text-[8px] uppercase font-bold text-teal-700 tracking-wider flex items-center justify-between">
                            <span>Assigned Doctor</span>
                            <span className="text-[8px] bg-teal-100 text-teal-800 px-1 rounded font-mono">Select</span>
                          </div>
                          <select
                            value={saleForm.attending_doctor_id || (registeredDoctors.find((d) => d.name === saleForm.attending_doctor_name)?.id || "")}
                            onChange={(e) => {
                              const docId = e.target.value;
                              const selectedDoc = registeredDoctors.find((d) => d.id === docId);
                              if (selectedDoc) {
                                const fee = Number(selectedDoc.consultation_fee || selectedDoc.fee || clinicInfo.doctor_fee || 0);
                                setSaleForm((prev) => ({
                                  ...prev,
                                  attending_doctor_id: selectedDoc.id,
                                  attending_doctor_name: selectedDoc.name || selectedDoc.full_name || clinicInfo.doctor_name || "Doctor",
                                  doctor_fee: String(fee),
                                }));
                                setIsDoctorFeeIncluded(fee > 0);
                              }
                            }}
                            className="w-full bg-transparent font-semibold text-slate-800 text-[11px] focus:outline-none cursor-pointer py-0.5"
                          >
                            {registeredDoctors.map((doc) => (
                              <option key={doc.id} value={doc.id} className="bg-white text-slate-900">
                                {doc.name || doc.full_name} (Rs. {doc.consultation_fee || doc.fee || clinicInfo.doctor_fee || 0})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* OPD Fee Checkbox Toggle Container */}
                    <div className="flex items-center space-x-1.5">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-teal-50/50 border border-slate-200 px-2.5 py-1 rounded-md transition select-none">
                        <input
                          type="checkbox"
                          checked={isDoctorFeeIncluded}
                          onChange={(e) => setIsDoctorFeeIncluded(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300 transition cursor-pointer"
                        />
                        <span className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                          <span>Include OPD Fee:</span>
                          <span className={`font-mono font-bold ${isDoctorFeeIncluded ? "text-teal-800" : "text-emerald-700 line-through"}`}>
                            {isDoctorFeeIncluded ? `Rs. ${Number(saleForm.doctor_fee || 0).toLocaleString()}` : "Waived (0)"}
                          </span>
                        </span>
                      </label>
                      <span className="text-[10px] text-slate-400 hidden xl:inline">
                        {isDoctorFeeIncluded ? "(Uncheck for Fee-Waived Consultancy)" : "(Consultancy Fee Waived)"}
                      </span>
                    </div>
                  </div>

                  {/* Quick Token Picker Pills */}
                  <div className="flex items-center gap-1 text-[9px] text-slate-500 font-mono ml-auto">
                    <span className="uppercase font-semibold tracking-wider text-slate-400 hidden sm:inline">Tokens:</span>
                    {queueTokensList.map((v) => {
                      const docTag = v.doctor_name ? v.doctor_name.replace(/^(H\/)?Dr\.?\s*/i, "").split(" ")[0] : "";
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => selectQuickToken(String(v.token_number || v.id), v)}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-teal-50 hover:text-teal-800 border border-slate-200 transition cursor-pointer"
                          title={`${v.patient_name || "Patient"} — Dr. ${v.doctor_name || "Consultant"}`}
                        >
                          T-{v.token_number || v.id}{docTag ? ` [${docTag}]` : ""} ({v.patient_name ? v.patient_name.split(" ")[0] : "Queue"})
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => selectQuickToken("WALK-IN")}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-teal-50 hover:text-teal-800 border border-slate-200 transition cursor-pointer"
                    >
                      Walk-in
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 1B: Wholesale B2B Ribbon */}
        {activeInvoiceMode === "wholesale" && (
          <section className="bg-white p-2.5 rounded-lg border border-teal-200 shadow-xs flex-shrink-0" data-purpose="wholesale-party-strip">
            <div className="space-y-1.5">
              {/* Row 1: Party Code, Pharmacy/Ledger, Booker, City, Transport Carrier, Bilty # */}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-2 sm:col-span-2">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Party Code</label>
                  <input
                    ref={partyCodeInputRef}
                    type="text"
                    value={saleForm.party_code}
                    onChange={(e) => handlePartyCodeInput(e.target.value)}
                    placeholder="P-001"
                    className="w-full font-mono font-bold text-xs uppercase px-2 py-1 rounded-md border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-slate-50/50 hover:bg-white transition h-8 outline-none"
                  />
                </div>
                <div className="col-span-4 sm:col-span-3 relative" ref={partyDropdownRef}>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                      Pharmacy / Ledger
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPartyDropdown(false);
                        setShowNewPartyModal(true);
                      }}
                      className="text-[9px] font-semibold text-teal-700 hover:text-teal-900 transition flex items-center space-x-0.5 whitespace-nowrap cursor-pointer hover:underline"
                    >
                      + New
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={saleForm.account_name}
                      onFocus={() => setShowPartyDropdown(true)}
                      onChange={(e) => {
                        setSaleForm({ ...saleForm, account_name: e.target.value });
                        setShowPartyDropdown(true);
                      }}
                      placeholder="Search / Select Party or Store..."
                      className="w-full text-xs font-semibold px-2 pr-16 py-1 rounded-md border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white transition h-8 truncate outline-none"
                    />
                    <span className="absolute right-1 top-1.5 text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-blue-50 text-blue-700 pointer-events-none">
                      {matchedParty ? `Bal: ${Number(matchedParty.current_balance || matchedParty.balance_due || 0).toLocaleString()}` : "New Party"}
                    </span>
                  </div>

                  {/* Searchable Wholesale Parties Dropdown */}
                  {showPartyDropdown && filteredParties.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-2xl border border-teal-300 z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 text-left animate-fade-in">
                      <div className="p-1.5 bg-teal-50/90 text-[10px] font-bold text-teal-900 flex justify-between items-center sticky top-0 border-b border-teal-200 backdrop-blur-xs">
                        <span>REGISTERED PARTIES ({filteredParties.length})</span>
                        <span className="text-[9px] text-teal-700 font-mono">Click to Link</span>
                      </div>
                      {filteredParties.map((p) => {
                        const bal = Number(p.current_balance || p.balance_due || p.opening_balance || 0);
                        const isSelected = matchedParty?.id === p.id || (p.party_code && p.party_code === saleForm.party_code);
                        return (
                          <div
                            key={p.id || p.party_code || p.name}
                            onClick={() => selectParty(p)}
                            className={`p-2 hover:bg-teal-50/70 transition cursor-pointer flex items-center justify-between gap-2 ${
                              isSelected ? "bg-teal-50 font-semibold" : ""
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-900 uppercase">
                                  {p.party_code || "P-XXX"}
                                </span>
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {p.name}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>📍 {p.city || "Hyderabad"}</span>
                                {p.phone && <span>📞 {p.phone}</span>}
                                {p.salesman && <span>👤 {p.salesman}</span>}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className={`text-[10px] font-mono font-bold block ${bal > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                                Rs. {bal.toLocaleString()}
                              </span>
                              <span className="text-[8px] text-slate-400 uppercase">
                                {bal > 0 ? "Udhaar Due" : "Clear"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="p-1.5 bg-slate-50 text-center sticky bottom-0 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPartyDropdown(false);
                            setShowNewPartyModal(true);
                          }}
                          className="text-[10px] font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
                        >
                          + Register New Party (Not in list)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Booker / Salesman</label>
                  <select
                    value={saleForm.salesman}
                    onChange={(e) => setSaleForm({ ...saleForm, salesman: e.target.value })}
                    className="w-full text-xs font-medium py-1 px-1.5 rounded-md border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-slate-50/50 hover:bg-white transition text-slate-700 h-8 outline-none cursor-pointer"
                  >
                    {salesmanOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">City</label>
                  <input
                    type="text"
                    value={saleForm.city}
                    onChange={(e) => setSaleForm({ ...saleForm, city: e.target.value })}
                    placeholder="City"
                    className="w-full text-xs font-medium px-2 py-1 rounded-md border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-slate-50/50 hover:bg-white transition h-8 outline-none"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Transport</label>
                  <input
                    type="text"
                    value={saleForm.transport}
                    onChange={(e) => setSaleForm({ ...saleForm, transport: e.target.value })}
                    placeholder="Carrier / Cargo"
                    className="w-full text-xs font-medium px-2 py-1 rounded-md border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-slate-50/50 hover:bg-white transition h-8 outline-none"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Bilty #</label>
                  <input
                    type="text"
                    value={saleForm.bilty_no}
                    onChange={(e) => setSaleForm({ ...saleForm, bilty_no: e.target.value })}
                    placeholder="Bilty #"
                    className="w-full font-mono text-xs font-medium px-1.5 py-1 rounded-md border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-slate-50/50 hover:bg-white transition h-8 outline-none"
                  />
                </div>
              </div>

              {/* Row 2: Payment Mode & Conditional Fields */}
              <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                <div className="w-48">
                  <div className="relative">
                    <select
                      value={saleForm.payment_mode}
                      onChange={(e) => setSaleForm({ ...saleForm, payment_mode: e.target.value })}
                      className="w-full text-xs font-semibold py-1 pl-2.5 pr-7 rounded-full border border-teal-500 focus:border-teal-600 focus:ring-1 focus:ring-teal-500/20 bg-white text-slate-800 transition cursor-pointer appearance-none h-7 outline-none"
                    >
                      <option value="Cash">💵 Cash</option>
                      <option value="Credit / Udhaar">📜 Credit / Udhaar</option>
                      <option value="Easypaisa">📲 Easypaisa</option>
                      <option value="JazzCash">📱 JazzCash</option>
                      <option value="Bank Transfer">🏦 Bank Transfer</option>
                      <option value="Cheque / Bank">📑 Cheque / Bank</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {(saleForm.payment_mode === "Bank Transfer" || saleForm.payment_mode === "Cheque / Bank") && (
                  <div className="flex-1 min-w-[160px] max-w-xs">
                    <input
                      type="text"
                      value={saleForm.bank_name}
                      onChange={(e) => setSaleForm({ ...saleForm, bank_name: e.target.value })}
                      placeholder="Bank Name (Meezan, HBL...)"
                      className="w-full text-xs font-medium py-1 px-3 rounded-full border border-teal-400 focus:border-teal-600 bg-white placeholder-slate-400 transition h-7 outline-none"
                    />
                  </div>
                )}

                {saleForm.payment_mode === "Cheque / Bank" && (
                  <div className="w-32">
                    <input
                      type="text"
                      value={saleForm.cheque_no}
                      onChange={(e) => setSaleForm({ ...saleForm, cheque_no: e.target.value })}
                      placeholder="Cheque #"
                      className="w-full font-mono text-xs font-medium py-1 px-3 rounded-full border border-teal-400 focus:border-teal-600 bg-white placeholder-slate-400 transition h-7 outline-none"
                    />
                  </div>
                )}

                {/* Dynamic POS Charges Toggle for Wholesale */}
                <label
                  className="inline-flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-teal-50/50 border border-slate-200 px-2.5 py-0.5 rounded-full transition select-none h-7"
                  title="POS Service Fee / Charges (Rs. 1)"
                >
                  <input
                    type="checkbox"
                    checked={isPosFeeIncluded}
                    onChange={(e) => setIsPosFeeIncluded(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300 transition cursor-pointer"
                  />
                  <span className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                    <span>POS Fee:</span>
                    <span className={`font-mono font-bold ${isPosFeeIncluded ? "text-teal-800" : "text-slate-400 line-through"}`}>
                      {isPosFeeIncluded ? "Rs. 1" : "Rs. 0"}
                    </span>
                  </span>
                </label>

                <div className="text-[10px] text-slate-400 ml-auto hidden sm:block font-mono">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>Ledger posting sync
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================= BEGIN: Fast Line Item Entry Box ================= */}
        {activeInvoiceMode === "retail" ? (
          /* Retail Mode Fast Entry Bar matching user's Retail Template */
          <section className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs relative flex-shrink-0" data-purpose="fast-entry-bar">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addNewItem();
              }}
              className="space-y-1"
            >
              <div className="grid grid-cols-12 gap-2 items-end">
                {/* 1. COMPANY / BRAND Filter (Select or type company code e.g. GHR, BM) */}
                <div className="col-span-6 sm:col-span-3 lg:col-span-2 relative" ref={retailCompanyDropdownRef}>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-teal-900 truncate">
                      COMPANY / BRAND
                    </label>
                    {selectedCompanyFilter && selectedCompanyFilter !== "All" && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCompanyFilter("All");
                          setRetailCompanySearch("");
                          showToast("Company filter cleared — All brands active");
                        }}
                        className="text-[9px] font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer flex-shrink-0"
                      >
                        Clear (All)
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      ref={retailCompanyInputRef}
                      type="text"
                      autoComplete="off"
                      value={showRetailCompanyDropdown ? retailCompanySearch : (selectedCompanyFilter === "All" ? "" : selectedCompanyFilter)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRetailCompanySearch(val);
                        setSelectedCompanyFilter(val || "All");
                        setShowRetailCompanyDropdown(true);
                      }}
                      onFocus={() => {
                        setRetailCompanySearch(selectedCompanyFilter === "All" ? "" : selectedCompanyFilter);
                        setShowRetailCompanyDropdown(true);
                      }}
                      placeholder="All Brands (or Code)"
                      title="Filter medicines by Pharma Company or Code (e.g. GHR, BM, Paul Brooks)"
                      className="w-full text-xs font-semibold pl-2.5 pr-6 py-1.5 rounded-full border-2 border-teal-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-500/20 bg-white text-slate-800 h-8 outline-none shadow-xs truncate"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRetailCompanyDropdown((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-700 p-0.5 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Retail Company Dropdown */}
                  {showRetailCompanyDropdown && (
                    <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-slate-200 shadow-2xl rounded-xl py-1 z-40 max-h-60 overflow-y-auto">
                      <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex justify-between items-center">
                        <span>Select Company / Brand</span>
                        <span className="font-mono text-teal-700">Code</span>
                      </div>
                      {filteredRetailCompanyOptions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedCompanyFilter(c.id === "All" ? "All" : c.id);
                            setShowRetailCompanyDropdown(false);
                            setRetailCompanySearch("");
                            showToast(c.id === "All" ? "All Brands Active" : `Filtered by: ${c.name || c.label}`);
                            medicineInputRef.current?.focus();
                          }}
                          className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between transition cursor-pointer ${
                            selectedCompanyFilter === c.id ? "bg-teal-50 font-bold text-teal-950" : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="truncate">{c.name || c.label}</span>
                          <span className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold ml-1">
                            {c.code || "ALL"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. ITEM CODE (Auto-fetch Product & Company Details) */}
                <div className="col-span-6 sm:col-span-3 lg:col-span-2 relative">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-teal-900 mb-0.5">
                    ITEM CODE
                  </label>
                  <input
                    ref={itemCodeInputRef}
                    type="text"
                    autoComplete="off"
                    value={entryLine.product_code}
                    onChange={(e) => {
                      setEntryLine((prev) => ({ ...prev, product_code: e.target.value }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleLookupByItemCode(entryLine.product_code);
                      }
                    }}
                    placeholder="e.g. Ghr-7, BM-1..."
                    title="Type Item Code / Barcode and press Enter to auto-fill details & company"
                    className="w-full font-mono text-xs font-bold px-3 py-1.5 rounded-full border-2 border-teal-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-500/20 bg-white placeholder-slate-400 text-slate-800 h-8 outline-none shadow-xs uppercase"
                  />
                </div>

                {/* 3. PRODUCT NAME * (Search input with rounded-full pill border & search icon) */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-3 relative">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-teal-900 mb-0.5">
                    PRODUCT NAME <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-teal-700">
                      <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      ref={medicineInputRef}
                      type="text"
                      autoComplete="off"
                      value={entryLine.medicine_name}
                      onChange={(e) => {
                        setEntryLine({ ...entryLine, medicine_name: e.target.value });
                        setShowMedDropdown(true);
                        setHighlightedMedIdx(0);
                      }}
                      onFocus={() => setShowMedDropdown(true)}
                      onKeyDown={handleMedicineKeyDown}
                      placeholder="Type medicine name, formula, code..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-full border-2 border-teal-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-500/20 bg-white placeholder-slate-400 transition text-slate-800 h-8 outline-none shadow-xs"
                    />
                  </div>

                  {/* Medicine Suggestions Dropdown */}
                  {showMedDropdown && (
                    <div
                      ref={medSuggestionsRef}
                      className="absolute left-0 top-full mt-1 w-full sm:w-[480px] bg-white border border-slate-200 shadow-2xl rounded-xl py-1 z-40 max-h-72 sm:max-h-80 overflow-y-auto"
                    >
                      <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/90 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10 backdrop-blur-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                          <span>Matching Medicines in Stock ({medicineSuggestions.length})</span>
                          {selectedCompanyFilter && selectedCompanyFilter !== "All" && (
                            <span className="text-[8px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-bold">
                              {selectedCompanyFilter}
                            </span>
                          )}
                        </span>
                        <span>Price / Stock</span>
                      </div>
                      {medicineSuggestions.length === 0 ? (
                        <div className="p-4 text-slate-400 text-center text-xs">
                          No medicines found {selectedCompanyFilter !== "All" ? `for "${selectedCompanyFilter}"` : ""}
                        </div>
                      ) : (
                        medicineSuggestions.map((m, idx) => {
                          const isH = idx === highlightedMedIdx;
                          const price = Number(m.unit_sale_price || m.sale_price || m.box_sale_price || 280);
                          const stock = Number(m.store_stock || m.warehouse_stock || m.stock_qty || 0);
                          return (
                            <button
                              key={m.id || idx}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectTypeaheadMedicine(m);
                              }}
                              onMouseEnter={() => setHighlightedMedIdx(idx)}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between border-b border-slate-50 last:border-0 transition cursor-pointer ${
                                isH ? "bg-teal-50 text-teal-950 font-bold" : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div className="truncate pr-2">
                                <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                  <span>{m.medicine_name}</span>
                                  {m.item_code && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-bold">
                                      {m.item_code}
                                    </span>
                                  )}
                                  {m.company_name && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-teal-50 text-teal-800 rounded font-mono font-bold border border-teal-200/50">
                                      {m.company_name}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {m.product_description || m.generic_name || m.packing || "Standard Formula"}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="font-mono font-bold text-teal-800 text-xs">Rs. {price.toFixed(2)}</div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${stock <= 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                                  Stock: {stock}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 4. QTY */}
                <div className="col-span-3 sm:col-span-2 lg:col-span-1">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-700 text-center mb-0.5">QTY</label>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    value={entryLine.qty}
                    onChange={(e) => setEntryLine({ ...entryLine, qty: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        rateInputRef.current?.focus();
                        rateInputRef.current?.select();
                      }
                    }}
                    className="w-full text-center text-xs font-bold py-1 px-1 rounded-full border border-slate-300 focus:border-teal-500 bg-white text-slate-900 h-8 outline-none shadow-xs"
                  />
                </div>

                {/* 5. RATE */}
                <div className="col-span-3 sm:col-span-2 lg:col-span-1">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-700 text-center mb-0.5">RATE</label>
                  <input
                    ref={rateInputRef}
                    type="number"
                    step="0.01"
                    value={entryLine.rate}
                    onChange={(e) => setEntryLine({ ...entryLine, rate: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        discInputRef.current?.focus();
                        discInputRef.current?.select();
                      }
                    }}
                    placeholder="0.00"
                    className="w-full text-center text-xs font-semibold py-1 px-1 rounded-full border border-slate-300 focus:border-teal-500 bg-white font-mono text-slate-800 h-8 outline-none shadow-xs"
                  />
                </div>

                {/* 6. DISC% */}
                <div className="col-span-3 sm:col-span-2 lg:col-span-1 relative">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-700 text-center mb-0.5">DISC%</label>
                  <input
                    ref={discInputRef}
                    type="number"
                    min="0"
                    max={getMaxDiscountLimit ? getMaxDiscountLimit() : 28}
                    value={entryLine.disc_pct}
                    onChange={handleDiscInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addNewItem();
                      }
                    }}
                    placeholder="0"
                    title={`Discount % (Max Limit: ${getMaxDiscountLimit ? getMaxDiscountLimit() : 28}%)`}
                    className="w-full text-center text-xs font-semibold py-1 px-1 rounded-full border border-slate-300 focus:border-teal-500 bg-white font-mono text-slate-800 h-8 outline-none shadow-xs"
                  />
                </div>

                {/* 7. NET (with Gross info) */}
                <div className="col-span-3 sm:col-span-3 lg:col-span-1">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-teal-800 text-center mb-0.5">NET</label>
                  <div
                    title={`Gross: Rs. ${entryGross} | Disc: ${entryLine.disc_pct}%`}
                    className="w-full text-center text-xs font-extrabold py-0.5 px-1 rounded-full border-2 border-teal-400 bg-teal-50/70 text-teal-950 font-mono select-none tracking-tight flex flex-col items-center justify-center h-8"
                  >
                    <span>{entryNet}</span>
                    <span className="text-[7.5px] font-normal text-slate-500 -mt-0.5 truncate">G: {entryGross}</span>
                  </div>
                </div>

                {/* 8. ADD BUTTON */}
                <div className="col-span-12 sm:col-span-3 lg:col-span-1">
                  <button
                    type="button"
                    onClick={addNewItem}
                    className="w-full inline-flex items-center justify-center space-x-1 px-2 py-1 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold text-xs rounded-full transition shadow-xs whitespace-nowrap cursor-pointer h-8"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </form>
          </section>
        ) : (
          /* Wholesale Mode Fast Entry Bar With Dedicated COMP CODE & ITEM CODE */
          <section className="bg-white p-2.5 rounded-lg border border-teal-200 shadow-xs relative flex-shrink-0" data-purpose="fast-entry-bar">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addNewItem();
              }}
              className="flex flex-col sm:flex-row items-center gap-2"
            >
              {/* 1. Company Code Input + Dropdown Trigger */}
              <div className="relative w-full sm:w-32 flex-shrink-0" ref={companyDropdownRef}>
                <div className="relative">
                  <input
                    ref={companyCodeInputRef}
                    type="text"
                    autoComplete="off"
                    value={entryLine.company_name}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setEntryLine((prev) => ({ ...prev, company_name: val }));
                      setSelectedCompanyFilter(val || "All");
                      setShowCompanyDropdown(true);
                    }}
                    onFocus={() => setShowCompanyDropdown(true)}
                    placeholder="COMP CODE"
                    title="Pharma Company Code (e.g. GSK, SAMI, GETZ, AGP, ABT, BM, GHR)"
                    className="w-full uppercase font-mono font-bold text-xs pl-2.5 pr-6 py-1.5 rounded-lg border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white placeholder-slate-400 shadow-xs h-8 outline-none"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCompanyDropdown((prev) => !prev);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Company Code Dropdown Menu */}
                {showCompanyDropdown && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 shadow-xl rounded-lg py-1 z-30 max-h-48 overflow-y-auto">
                    <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex justify-between items-center">
                      <span>Select Pharma Company</span>
                      <span className="font-mono text-teal-700">Code</span>
                    </div>
                    {companyOptions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          const code = c.code || (c.id === "All" ? "" : c.id);
                          setEntryLine((prev) => ({ ...prev, company_name: code || "GSK" }));
                          setSelectedCompanyFilter(c.id === "All" ? "All" : c.id);
                          setShowCompanyDropdown(false);
                          showToast(`Filtered by Company: ${c.name || c.label}`);
                          medicineInputRef.current?.focus();
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-teal-50 flex items-center justify-between text-slate-700 hover:text-teal-900 transition cursor-pointer"
                      >
                        <span className="font-medium truncate">{c.name || c.label}</span>
                        <span className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                          {c.code || "ALL"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Item Code Input (Auto-fetch Product & Details) */}
              <div className="relative w-full sm:w-28 flex-shrink-0">
                <input
                  type="text"
                  autoComplete="off"
                  value={entryLine.product_code}
                  onChange={(e) => {
                    setEntryLine((prev) => ({ ...prev, product_code: e.target.value }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleLookupByItemCode(entryLine.product_code);
                    }
                  }}
                  placeholder="ITEM CODE"
                  title="Enter Item Code / Barcode (e.g. GHR-7) and press Enter to auto-fill"
                  className="w-full uppercase font-mono font-bold text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white placeholder-slate-400 shadow-xs h-8 outline-none"
                />
              </div>

              {/* 3. Medicine Search Bar with Quick Autocomplete Preview */}
              <div className="relative flex-1 w-full">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-teal-700">
                  <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  ref={medicineInputRef}
                  type="text"
                  autoComplete="off"
                  value={entryLine.medicine_name}
                  onChange={(e) => {
                    setEntryLine({ ...entryLine, medicine_name: e.target.value });
                    setShowMedDropdown(true);
                    setHighlightedMedIdx(0);
                  }}
                  onFocus={() => setShowMedDropdown(true)}
                  onKeyDown={handleMedicineKeyDown}
                  placeholder="Type medicine name, barcode, or generic formula (e.g. Panadol, Augmentin)..."
                  className="w-full pl-8 pr-8 py-1.5 text-xs font-medium rounded-lg border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white placeholder-slate-400 transition text-slate-800 h-8 outline-none shadow-xs"
                />
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono bg-slate-100 text-slate-500 px-1 py-0.5 rounded border border-slate-200">
                  /
                </kbd>

                {/* Medicine Suggestions Dropdown */}
                {showMedDropdown && (
                  <div
                    ref={medSuggestionsRef}
                    className="absolute left-0 top-full mt-1 w-full bg-white border border-slate-200 shadow-2xl rounded-xl py-1 z-40 max-h-72 sm:max-h-80 overflow-y-auto"
                  >
                    <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/90 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10 backdrop-blur-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                        <span>Matching Medicines in Stock ({medicineSuggestions.length})</span>
                        {selectedCompanyFilter && selectedCompanyFilter !== "All" && (
                          <span className="text-[8px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-bold">
                            {selectedCompanyFilter}
                          </span>
                        )}
                      </span>
                      <span>Price / Stock</span>
                    </div>
                    {medicineSuggestions.length === 0 ? (
                      <div className="p-4 text-slate-400 text-center text-xs">
                        No medicines found {selectedCompanyFilter !== "All" ? `for "${selectedCompanyFilter}"` : ""}
                      </div>
                    ) : (
                      medicineSuggestions.map((m, idx) => {
                        const isH = idx === highlightedMedIdx;
                        const price = Number(m.unit_sale_price || m.sale_price || m.box_sale_price || 280);
                        const stock = Number(m.store_stock || m.warehouse_stock || m.stock_qty || 0);
                        return (
                          <button
                            key={m.id || idx}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectTypeaheadMedicine(m);
                            }}
                            onMouseEnter={() => setHighlightedMedIdx(idx)}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between border-b border-slate-50 last:border-0 transition cursor-pointer ${
                              isH ? "bg-teal-50 text-teal-950 font-bold" : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                <span>{m.medicine_name}</span>
                                {m.item_code && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-bold">
                                    {m.item_code}
                                  </span>
                                )}
                                {m.company_name && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-teal-50 text-teal-800 rounded font-mono font-bold border border-teal-200/50">
                                    {m.company_name}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {m.product_description || m.generic_name || m.packing || "Standard Formula"}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-mono font-bold text-teal-800 text-xs">Rs. {price.toFixed(2)}</div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${stock <= 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                                Stock: {stock}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* 3. Inline Compact Numeric Inputs */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                {/* Qty Input */}
                <div className="w-16">
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    value={entryLine.qty}
                    onChange={(e) => setEntryLine({ ...entryLine, qty: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        rateInputRef.current?.focus();
                        rateInputRef.current?.select();
                      }
                    }}
                    placeholder="Qty"
                    title="Quantity"
                    className="w-full text-center text-xs font-bold py-1 px-1 rounded-lg border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white text-slate-900 h-8 outline-none"
                  />
                </div>

                {/* Unit Price (Rate) Input */}
                <div className="w-20">
                  <input
                    ref={rateInputRef}
                    type="number"
                    step="0.01"
                    value={entryLine.rate}
                    onChange={(e) => setEntryLine({ ...entryLine, rate: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        discInputRef.current?.focus();
                        discInputRef.current?.select();
                      }
                    }}
                    placeholder="Rate"
                    title="Unit Rate"
                    className="w-full text-center text-xs font-semibold py-1 px-1 rounded-lg border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white font-mono text-slate-800 h-8 outline-none"
                  />
                </div>

                {/* Discount % Input */}
                <div className="w-16">
                  <input
                    ref={discInputRef}
                    type="number"
                    min="0"
                    max={getMaxDiscountLimit ? getMaxDiscountLimit() : 28}
                    value={entryLine.disc_pct}
                    onChange={handleDiscInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addNewItem();
                      }
                    }}
                    placeholder="Disc%"
                    title={`Discount % (Max Limit: ${getMaxDiscountLimit ? getMaxDiscountLimit() : 28}%)`}
                    className="w-full text-center text-xs font-semibold py-1 px-1 rounded-lg border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white font-mono text-slate-800 h-8 outline-none"
                  />
                </div>

                {/* Add Button */}
                <button
                  type="button"
                  onClick={addNewItem}
                  className="inline-flex items-center justify-center space-x-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold text-xs rounded-lg transition shadow-xs flex-shrink-0 whitespace-nowrap cursor-pointer h-8"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Item</span>
                </button>
              </div>
            </form>
          </section>
        )}
        {/* ================= END: Fast Line Item Entry Box ================= */}

        {/* ================= BEGIN: CartLedgerTable Area ================= */}
        <section className="flex-1 min-h-0 bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex flex-col" data-purpose="invoice-items-table">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                {activeInvoiceMode === "wholesale" ? "Wholesale Consignment" : "Cart Items"}
              </span>
              <span className="text-[10px] font-semibold bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded-full">
                {cartItems.length} {cartItems.length === 1 ? "item" : "items"}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-600 hidden sm:inline">
                {activeInvoiceMode === "wholesale" ? `B2B Invoice #${saleForm.voucher_no}` : `Retail Invoice #${saleForm.voucher_no}`}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Press <kbd className="font-mono bg-white border border-slate-200 px-1 rounded">Del</kbd> to remove row
            </span>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-auto table-scroll-wrapper custom-scrollbar">
            <table className="w-full text-left text-xs text-slate-700 min-w-[580px] sm:min-w-full">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[9px] border-b border-slate-200 tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-1.5 px-2.5 w-10 text-center" scope="col">#</th>
                  <th className="py-1.5 px-2" scope="col">Item / Formula Name</th>
                  <th className="py-1.5 px-2 text-center w-16" scope="col">Qty</th>
                  <th className="py-1.5 px-2 text-right w-24" scope="col">Rate (Rs.)</th>
                  {activeInvoiceMode === "wholesale" && (
                    <th className="py-1.5 px-2 text-right w-24" scope="col">Gross (Rs.)</th>
                  )}
                  <th className="py-1.5 px-2 text-center w-16" scope="col">Disc %</th>
                  <th className="py-1.5 px-2 text-right w-28" scope="col">Net Total (Rs.)</th>
                  <th className="py-1.5 px-2 text-center w-12" scope="col">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {cartItems.length === 0 ? (
                  <tr>
                    <td colSpan={activeInvoiceMode === "wholesale" ? 8 : 7} className="py-12 text-center text-slate-400 italic">
                      No medicines in cart yet. Type or search above to add items.
                    </td>
                  </tr>
                ) : (
                  cartItems.map((item, index) => {
                    const rowGross = item.qty * item.rate;
                    return (
                      <tr key={item.id || index} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-2.5 text-center text-slate-400 font-mono text-[10px]">
                          {String(index + 1).padStart(2, "0")}
                        </td>
                        <td className="py-2 px-2">
                          <div className="font-semibold text-slate-900 text-xs leading-tight flex items-center gap-1.5">
                            <span>{item.name}</span>
                            {item.company && (
                              <span className="text-[8.5px] font-bold bg-teal-50 text-teal-800 px-1 py-0.2 rounded font-mono">
                                {item.company}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{item.detail}</div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="inline-block px-1.5 py-0.2 bg-slate-100 rounded text-slate-800 font-mono font-bold text-xs">
                            {item.qty}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600 text-xs">
                          {item.rate.toFixed(2)}
                        </td>
                        {activeInvoiceMode === "wholesale" && (
                          <td className="py-2 px-2 text-right font-mono text-slate-700 text-xs">
                            {rowGross.toFixed(2)}
                          </td>
                        )}
                        <td className={`py-2 px-2 text-center font-mono text-xs ${item.discPercent > 0 ? "text-emerald-600 font-bold" : "text-slate-400"}`}>
                          {item.discPercent}%
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900 text-xs">
                          {item.net.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => deleteCartItem(item.id)}
                            className="text-slate-300 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                            title="Remove item"
                          >
                            <svg className="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
        {/* ================= END: CartLedgerTable Area ================= */}
      </div>
      {/* ================= END: ScrollableWorkspace ================= */}

      {/* ================= BEGIN: BottomCheckoutDock ================= */}
      <footer className="bg-white border-t border-slate-200 px-3 sm:px-3.5 py-2 flex-shrink-0 shadow-md" data-purpose="checkout-dock">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Left Actions */}
          <div className="flex items-center space-x-1.5 justify-between sm:justify-start">
            <button
              type="button"
              onClick={() => setShowInvoicesModal(true)}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Invoices Logbook</span>
            </button>
            <button
              type="button"
              onClick={confirmClearCart}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 text-xs font-medium transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear Cart</span>
            </button>
          </div>

          {/* Right Calculation Summary & Primary Save/Print Action */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-between sm:justify-end text-xs w-full sm:w-auto">
            {/* Figures breakdown */}
            <div className="flex items-center space-x-2 sm:space-x-3 text-[11px] sm:text-xs text-slate-500 pr-2 border-r border-slate-200">
              <div>
                <span>Gross: </span>
                <span className="font-mono font-semibold text-slate-800">
                  Rs. {calculations.medsGross.toFixed(2)}
                </span>
              </div>
              <div>
                <span>Disc: </span>
                <span className="font-mono font-semibold text-emerald-600">
                  -Rs. {calculations.totalDiscount.toFixed(2)}
                </span>
              </div>
              {activeInvoiceMode === "retail" && calculations.opdFee > 0 && (
                <div className="border-l border-slate-200 pl-2 flex items-center space-x-1">
                  <span className="text-slate-600 font-medium">OPD:</span>
                  <span className="font-mono font-bold text-teal-800 bg-teal-50 px-1 py-0.2 rounded border border-teal-200">
                    Rs. {calculations.opdFee.toFixed(2)}
                  </span>
                </div>
              )}
              {calculations.posFee > 0 && (
                <div className="border-l border-slate-200 pl-2 flex items-center space-x-1">
                  <span className="text-slate-600 font-medium">POS Fee:</span>
                  <span className="font-mono font-bold text-teal-800 bg-teal-50 px-1 py-0.2 rounded border border-teal-200">
                    Rs. 1.00
                  </span>
                </div>
              )}
            </div>

            {/* Net Amount Box with Wholesale / Retail contextual styling */}
            <div className="bg-teal-50 px-2.5 sm:px-3.5 py-1 rounded-lg border border-teal-200 flex items-center space-x-2 shadow-xs">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-teal-900 uppercase tracking-tight">
                    {activeInvoiceMode === "wholesale" ? "Net Total" : "Net Payable"}
                  </span>
                  {activeInvoiceMode === "wholesale" && (saleForm.payment_mode === "Credit / Udhaar" || (saleForm.cash_received !== "" && calculations.balanceDue > 0)) && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500 text-white font-mono uppercase tracking-wider shadow-xs">
                      Udhaar (Receivable)
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-teal-700 flex items-center gap-1 mt-0.2">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    activeInvoiceMode === "wholesale" && (saleForm.payment_mode === "Credit / Udhaar" || puranaUdhaar > 0)
                      ? "bg-amber-500 animate-pulse"
                      : "bg-emerald-500 animate-pulse"
                  }`}></span>
                  {activeInvoiceMode === "wholesale"
                    ? (saleForm.payment_mode === "Credit / Udhaar"
                        ? (puranaUdhaar > 0 ? `Ledger Credit • Prior Bal: Rs. ${puranaUdhaar.toLocaleString()}` : "Balance Due: Ledger Credit Term")
                        : puranaUdhaar > 0
                        ? `Prior Udhaar: Rs. ${puranaUdhaar.toLocaleString()}`
                        : "Live Wholesale Billing Active")
                    : "Live Sale Billing Active"}
                </span>
              </div>
              <span className="text-sm sm:text-lg font-extrabold text-teal-900 font-mono tracking-tight pl-1">
                Rs. {calculations.grandNet.toFixed(2)}
              </span>
            </div>

            {/* Tendered / Cash Input & Change */}
            <div className="flex items-center space-x-1.5">
              <div className="relative w-22 sm:w-28">
                <input
                  ref={cashTenderedInputRef}
                  type="number"
                  value={saleForm.cash_received}
                  onChange={(e) => setSaleForm({ ...saleForm, cash_received: e.target.value })}
                  placeholder={activeInvoiceMode === "wholesale" ? "Payment" : "Cash (F8)"}
                  className="w-full text-xs font-bold font-mono py-1.5 pl-2 pr-6 rounded-lg border border-slate-300 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-slate-800 h-8 outline-none"
                />
                <span className="absolute right-1.5 top-2 text-[9px] text-slate-400 font-mono">PKR</span>
              </div>
              <div className="text-[11px] leading-tight">
                <span className="text-slate-400 block text-[9px] uppercase font-semibold">
                  {activeInvoiceMode === "wholesale"
                    ? (calculations.balanceDue > 0 && saleForm.cash_received !== "" ? "Balance Due" : calculations.change > 0 ? "Change" : "Balance")
                    : "Change"}
                </span>
                <span className={`font-mono font-bold ${
                  activeInvoiceMode === "wholesale" && calculations.balanceDue > 0 && saleForm.cash_received !== ""
                    ? "text-amber-700"
                    : calculations.change > 0
                    ? "text-emerald-600"
                    : "text-slate-700"
                }`}>
                  Rs. {(activeInvoiceMode === "wholesale" && calculations.balanceDue > 0 && saleForm.cash_received !== ""
                    ? calculations.balanceDue
                    : calculations.change
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Primary Action Button: Save & Print */}
            <button
              type="button"
              onClick={processSaleAndPrint}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 sm:py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold text-xs tracking-wide shadow-sm hover:shadow transition whitespace-nowrap cursor-pointer min-h-[40px] sm:h-8"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>{activeInvoiceMode === "wholesale" ? "Save & Print B2B Invoice" : "Save & Print Slip"}</span>
              <kbd className="text-[9px] bg-teal-800/80 px-1.5 py-0.2 rounded text-teal-100 font-mono font-normal">F9</kbd>
            </button>
          </div>
        </div>
      </footer>
      {/* ================= END: BottomCheckoutDock ================= */}

      {/* ================= MODAL: THERMAL RECEIPT / WHOLESALE BILL LIVE PREVIEW ================= */}
      {showReceiptModal && (
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in p-2 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReceiptModal(false);
          }}
        >
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md overflow-hidden flex flex-col max-h-[95vh]">
            <div className="bg-teal-700 px-4 py-3 text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-teal-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <div>
                  <h3 className="font-bold text-xs tracking-wide text-white">
                    {activeInvoiceMode === "wholesale" ? "Live Wholesale B2B Thermal Bill" : "Live 80mm Thermal Receipt Preview"}
                  </h3>
                  <p className="text-[10px] text-teal-100/90 font-mono">
                    Invoice #{activeReceiptSaleData?.voucher_no || activeReceiptSaleData?.receipt_no || "DRAFT"} • ESC/POS 80mm
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="text-teal-200 hover:text-white transition cursor-pointer p-1 rounded-md hover:bg-teal-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Live 80mm Thermal Paper Container */}
            <div className="flex-1 bg-slate-200/90 p-3 sm:p-4 overflow-y-auto flex justify-center items-start min-h-[480px]">
              <div className="w-[82mm] max-w-full bg-white shadow-2xl rounded-sm border border-slate-300 overflow-hidden flex flex-col items-center">
                <iframe
                  srcDoc={receiptPreviewHtml}
                  title="Live 80mm ESC/POS Thermal Receipt"
                  className="w-[80mm] min-h-[560px] max-w-full border-0 bg-white"
                  style={{ height: "66vh" }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Thermal Output</span>
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrintModalReceipt}
                  className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>{activeInvoiceMode === "wholesale" ? "Print Wholesale Bill" : "Print Thermal Slip"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: INVOICES LOGBOOK ================= */}
      {showInvoicesModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-3"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInvoicesModal(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-teal-50 text-teal-700 rounded">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Today's Completed Invoices Logbook</h3>
                  <p className="text-[10px] text-slate-500">Terminal #01 • Cashier: {activeUser} • {saleForm.date}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoicesModal(false)}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search by Invoice #, Token, or Name..."
                  className="w-full text-xs pl-7 pr-3 py-1 rounded border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white outline-none"
                />
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div className="flex items-center gap-1">
                {["All", "Cash", "Credit"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setHistoryFilterMode(mode)}
                    className={`px-2 py-1 text-[11px] font-bold rounded ${
                      historyFilterMode === mode ? "bg-teal-700 text-white" : "bg-white border border-slate-200 text-slate-600"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[9px] border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Invoice #</th>
                    <th className="py-2 px-3">Token &amp; Patient / Party</th>
                    <th className="py-2 px-3">Doctor / Salesman</th>
                    <th className="py-2 px-3 text-right">Net Paid</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {salesHistory
                    .filter((s) => {
                      if (historyFilterMode !== "All" && s.payment_mode !== historyFilterMode) return false;
                      if (!historySearch.trim()) return true;
                      const q = historySearch.toLowerCase();
                      return (
                        (s.voucher_no || s.receipt_no || "").toLowerCase().includes(q) ||
                        (s.account_name || s.customer_name || "").toLowerCase().includes(q) ||
                        (s.token_no || "").toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 30)
                    .map((s, idx) => (
                      <tr key={s.id || idx} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-mono font-bold text-teal-800">
                          #{s.voucher_no || s.receipt_no || "POS-1000"}
                        </td>
                        <td className="py-2 px-3">
                          {s.token_no && (
                            <span className="font-mono text-[9px] font-bold bg-slate-100 px-1 py-0.2 rounded mr-1">
                              {s.token_no}
                            </span>
                          )}
                          <span className="font-semibold text-slate-800">{s.account_name || "Walk-In"}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">
                          {s.attending_doctor_name || s.reference || "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          Rs. {Number(s.total_amount || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded text-[9px] font-semibold border ${
                            s.payment_mode === "Credit" || s.payment_mode === "Credit / Udhaar"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            {s.payment_mode || "Paid Cash"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => reprintLogInvoice(s)}
                            className="text-[11px] text-teal-700 hover:underline font-semibold cursor-pointer"
                          >
                            Re-print
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="p-2 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInvoicesModal(false)}
                className="px-3 py-1 rounded border border-slate-300 text-slate-700 hover:bg-white text-xs font-medium cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD NEW PARTY ================= */}
      {showNewPartyModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowNewPartyModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-5 max-w-md w-full space-y-3 shadow-2xl border border-teal-300 text-left"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700 font-bold">
                  +
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Register Wholesale Party</h3>
                  <p className="text-[10px] text-slate-500">Quick create and link to current invoice</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewPartyModal(false)}
                className="text-slate-400 hover:text-slate-600 text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewParty} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Party Code</label>
                  <input
                    type="text"
                    value={newPartyForm.party_code}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, party_code: e.target.value })}
                    placeholder="P-104"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-xs uppercase bg-white text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Store / Pharmacy Name *</label>
                  <input
                    type="text"
                    required
                    value={newPartyForm.name}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, name: e.target.value })}
                    placeholder="Al-Madina Pharmacy"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">City</label>
                  <input
                    type="text"
                    value={newPartyForm.city}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, city: e.target.value })}
                    placeholder="Taxila / Hyderabad"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Phone</label>
                  <input
                    type="text"
                    value={newPartyForm.phone}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, phone: e.target.value })}
                    placeholder="0300-1234567"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Transport / Carrier</label>
                <input
                  type="text"
                  value={newPartyForm.address}
                  onChange={(e) => setNewPartyForm({ ...newPartyForm, address: e.target.value })}
                  placeholder="Local Goods Transport"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Opening Balance / Udhaar (Rs)</label>
                <input
                  type="number"
                  value={newPartyForm.balance_due}
                  onChange={(e) => setNewPartyForm({ ...newPartyForm, balance_due: e.target.value })}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white text-rose-700 placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewPartyModal(false)}
                  className="flex-1 py-1.5 rounded border border-slate-300 text-slate-600 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save &amp; Link
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ================= TOAST NOTIFICATION CONTAINER ================= */}
      <div className="fixed bottom-14 right-4 z-50 flex flex-col space-y-1.5 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${
              t.isWarning ? "bg-amber-900/95 border-amber-600 text-amber-100" : "bg-slate-900/90 border-slate-700 text-white"
            } text-xs px-3 py-2 rounded-lg shadow-xl backdrop-blur border flex items-center space-x-2 animate-fade-in pointer-events-auto`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${t.isWarning ? "bg-amber-400" : "bg-teal-400"}`}></span>
            <span className="font-medium text-[11px]">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (isPage) {
    return mainLayout;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-hidden">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 h-[95vh] max-h-[95vh] overflow-hidden flex flex-col">
        {mainLayout}
      </div>
    </div>,
    document.body
  );
}
