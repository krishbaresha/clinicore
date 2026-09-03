import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { dbInventory, dbStockTransfers, dbB2BSales, dbClinic, dbParties, dbSalesmen, dbWarehouses, dbAccounts, dbUsers } from "../api/db.js";
import { printThermalReceipt, printChartOfAccountsReceipt } from "../utils/thermalPrinter.js";
import { formatPKR, formatDate } from "../utils/formatters.js";
import ProductMovementModal from "../components/ProductMovementModal.jsx";
import StockLedgerModal from "../components/StockLedgerModal.jsx";
import SaleInvoiceModal from "../components/SaleInvoiceModal.jsx";


const SINDH_ACCOUNT_TYPES = [

  "Supplier",
  "Hyderabad",
  "Local Market",
  "Tando Alayar",
  "TMK",
  "Khanoot",
  "SANGER",
  "SHADADPUR",
  "Larkana",
  "Sukkar",
  "Badain",
  "GOLARCHI",
  "Hala",
  "Rato Dero",
  "Umar Kot",
  "Tharparkar",
  "Tharushah",
  "Talhar",
  "Matyari",
  "Dolat Pur",
  "Dambalo",
  "Ghulab Lagari",
  "Jahan Mori",
  "Kotri",
  "Mirpur",
  "Moro",
  "NAWABSHAH",
  "Noabad",
  "PANOAQIL",
  "Qazi Ahmed",
  "Sanjhoro",
  "T.Adam",
  "Tando Bhago",
  "Tando Ghulam Ali",
  "Tando Jaam",
  "Customer",
  "Sales Man",
  "Cash",
  "Expense",
  "Capital"
];

export default function WarehouseManagement() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [inventory, setInventory] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [b2bSales, setB2BSales] = useState([]);
  const [parties, setParties] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [godowns, setGodowns] = useState([]);

  const _isLocationLocked = Boolean(
    user && !user.is_owner && user.role !== "admin" && user.role !== "doctor" && user.assigned_warehouse_id
  );
  const _userAssignedWh = useMemo(() => godowns.find((w) => w.id === user?.assigned_warehouse_id), [godowns, user]);
  const canViewFinancials = Boolean(
    user?.is_owner || user?.role === "doctor" || user?.role === "admin" || user?.can_view_financials
  );

  const [activeTab, setActiveTab] = useState(urlTab && ["stock", "b2b", "transfer", "parties", "logs", "godowns"].includes(urlTab) ? urlTab : "stock");

  // DrCreate Account Registration Form & Chart of Accounts State
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [accountForm, setAccountForm] = useState({
    account_name: "",
    account_no: "",
    naration: "",
    account_type: "Hyderabad",
    opening_balance: "0",
    date: new Date().toLocaleDateString("en-US"),
  });
  const accountNameRef = useRef(null);


  // DrCreate 4-Level Stock Ledger Modal State
  const [showStockLedgerModal, setShowStockLedgerModal] = useState(false);
  const [ledgerInitialItem, setLedgerInitialItem] = useState(null);

  // DrCreate Sale Invoice Modal State
  const [showSaleInvoiceModal, setShowSaleInvoiceModal] = useState(false);

  // Chart of Accounts Modal State
  const [showChartOfAccountsModal, setShowChartOfAccountsModal] = useState(false);


  const [modalAccountTypeFilter, setModalAccountTypeFilter] = useState("All");
  const [modalAccountSearch, setModalAccountSearch] = useState("");
  const [accessAccountsImportStatus, setAccessAccountsImportStatus] = useState({ loading: false, result: null, error: "" });

  // Godown / Multi-Warehouse Management State
  const [showGodownModal, setShowGodownModal] = useState(false);
  const [editingGodown, setEditingGodown] = useState(null);
  const [godownForm, setGodownForm] = useState({
    name: "", code: "", location: "", incharge_name: "", phone: "", notes: "", status: "active"
  });

  // Active Godown Operator Switcher (Single-login multi-staff workflow)
  const [activeGodownOperator, setActiveGodownOperator] = useState(() => {
    try {
      const saved = localStorage.getItem("cf_warehouse_active_operator");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { id: "op_godown_01", name: "Raza", role: "Incharge" };
  });

  const availableGodownOperators = useMemo(() => {
    const users = dbUsers.getActiveStaff ? dbUsers.getActiveStaff("wh_001") : dbUsers.getAll();
    const smList = dbSalesmen.getAll ? dbSalesmen.getAll() : [];
    const list = [
      ...users.map((u) => ({ id: u.id, name: u.display_label || u.name, role: u.role || "Incharge" })),
      ...smList.map((s) => ({ id: s.id, name: s.name, role: "Salesman" })),
    ];
    const unique = [];
    const names = new Set();
    for (const op of list) {
      if (op.name && !names.has(op.name.toLowerCase())) {
        names.add(op.name.toLowerCase());
        unique.push(op);
      }
    }
    return unique.length > 0 ? unique : [{ id: "op_godown_01", name: "Raza", role: "Incharge" }];
  }, []);

  useEffect(() => {
    if (urlTab && ["stock", "b2b", "transfer", "parties", "logs", "godowns"].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const handleTabChange = (t) => {
    setActiveTab(t);
    setSearchParams({ tab: t });
  };

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCityFilter, setSelectedCityFilter] = useState("all");

  // Product Movement Modal State
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);

  // Two-Way Internal Transfer Form
  const [transferDirection, setTransferDirection] = useState("to_store"); // "to_store" | "to_warehouse"
  const [selectedInvForTransfer, setSelectedInvForTransfer] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [transferredBy, setTransferredBy] = useState("Usama");
  const [transferNotes, setTransferNotes] = useState("");

  // B2B Wholesale Sale Form
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [partySearchCode, setPartySearchCode] = useState("");
  const [b2bBuyerName, setB2bBuyerName] = useState("");
  const [b2bBuyerPhone, setB2bBuyerPhone] = useState("");
  const [b2bCity, setB2bCity] = useState("Hyderabad");
  const [selectedSalesman, setSelectedSalesman] = useState("Usama");
  const [biltyNo, setBiltyNo] = useState("");
  const [transportName, setTransportName] = useState("Al-Madina Goods");
  const [b2bPaymentType, setB2bPaymentType] = useState("credit"); // "credit" | "cash" | "cheque"
  const [b2bPaidAmount, setB2bPaidAmount] = useState("");
  const [b2bChequeNo, setB2bChequeNo] = useState("");
  const [b2bBankName, setB2bBankName] = useState("Habib Bank Limited (HBL)");
  const [b2bChequeDate, setB2bChequeDate] = useState(new Date().toISOString().split("T")[0]);
  const [b2bChequeAmount, setB2bChequeAmount] = useState("");
  const [b2bChequeStatus, setB2bChequeStatus] = useState("cleared");

  const [b2bOverallDiscPct, setB2bOverallDiscPct] = useState("");
  const [b2bOverallDiscFlat, setB2bOverallDiscFlat] = useState("");
  const [b2bCompanyFilter, setB2bCompanyFilter] = useState("all");
  const [b2bItems, setB2bItems] = useState([
    { inventory_id: "", medicine_name: "", qty: 1, unit_price: 0, disc_pct: 0, disc_flat: 0, line_total: 0 }
  ]);

  // Add & Edit Party Modal State
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState(null);
  const [newPartyForm, setNewPartyForm] = useState({
    party_code: "",
    name: "",
    city: "Hyderabad",
    phone: "",
    address: "",
    balance_due: "0",
  });

  const handleOpenEditParty = (party) => {
    setEditingPartyId(party.id);
    setNewPartyForm({
      party_code: party.party_code || "",
      name: party.name || party.party_name || "",
      city: party.city || "Hyderabad",
      phone: party.phone || "",
      address: party.address || "",
      balance_due: String(party.balance_due || party.opening_balance || "0"),
    });
    setShowAddPartyModal(true);
  };

  const handleDeleteParty = (party) => {
    if (window.confirm(`Are you sure you want to delete "${party.name || party.party_name}" (Code #${party.party_code || party.id})?`)) {
      dbParties.delete(party.id);
      refreshData();
    }
  };

  const handleSaveParty = (e) => {
    e.preventDefault();
    if (!newPartyForm.name.trim()) {
      alert("Please enter party / store name.");
      return;
    }

    if (editingPartyId) {
      // Update existing party
      const updated = dbParties.update(editingPartyId, {
        party_code: newPartyForm.party_code.trim(),
        name: newPartyForm.name.trim(),
        party_name: newPartyForm.name.trim(),
        city: newPartyForm.city.trim(),
        territory: newPartyForm.city.trim(),
        phone: newPartyForm.phone.trim(),
        address: newPartyForm.address.trim(),
        balance_due: Number(newPartyForm.balance_due) || 0,
        updated_at: new Date().toISOString(),
      });
      alert(`Party "${updated.name}" updated successfully!`);
    } else {
      // Create new party
      const created = dbParties.add(newPartyForm);
      
      // Auto-sync into unified dbAccounts if not already existing
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
      alert(`Party "${created.name}" registered successfully with Code #${created.party_code || created.id}!`);
    }

    setShowAddPartyModal(false);
    setEditingPartyId(null);

    setNewPartyForm({
      party_code: "",
      name: "",
      city: "Hyderabad",
      phone: "",
      address: "",
      balance_due: "0",
    });
    refreshData();
  };


  const refreshData = () => {
    setInventory(dbInventory.getAll());
    setTransfers(dbStockTransfers.getAll());
    setB2BSales(dbB2BSales.getAll());
    setParties(dbParties.getAll());
    setSalesmen(dbSalesmen.getAll());
    setGodowns(dbWarehouses.getAll());
    const allAccs = dbAccounts.getAll();
    setAccounts(allAccs);
    setAccountForm((prev) => ({
      ...prev,
      account_no: prev.account_no || dbAccounts.getNextAccountNo(),
      date: prev.date || new Date().toLocaleDateString("en-US"),
    }));
  };

  const handleOpenAccountForm = () => {
    if (!showAccountForm) {
      if (!editingAccountId) {
        const nextNo = dbAccounts.getNextAccountNo();
        setAccountForm((prev) => ({
          ...prev,
          account_no: nextNo,
          date: new Date().toLocaleDateString("en-US"),
        }));
      }
      setShowAccountForm(true);
      setTimeout(() => accountNameRef.current?.focus(), 100);
    } else {
      setShowAccountForm(false);
    }
  };

  const handleSelectAccountForEdit = (acc) => {
    setEditingAccountId(acc.id || acc.account_no);
    setAccountForm({
      account_name: acc.account_name || "",
      account_no: acc.account_no || "",
      naration: acc.naration || "",
      account_type: acc.account_type || "Hyderabad",
      opening_balance: String(acc.opening_balance || "0"),
      date: acc.created_at ? new Date(acc.created_at).toLocaleDateString("en-US") : new Date().toLocaleDateString("en-US"),
    });
    setShowChartOfAccountsModal(false);
    setShowAccountForm(true);
    setTimeout(() => accountNameRef.current?.focus(), 100);
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    const nextNo = dbAccounts.getNextAccountNo();
    setAccountForm({
      account_name: "",
      account_no: nextNo,
      naration: "",
      account_type: "Hyderabad",
      opening_balance: "0",
      date: new Date().toLocaleDateString("en-US"),
    });
    setTimeout(() => accountNameRef.current?.focus(), 50);
  };

  const handleSaveAccount = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!accountForm.account_name.trim()) {
      alert("Please enter Account Name.");
      accountNameRef.current?.focus();
      return;
    }

    if (editingAccountId) {
      dbAccounts.update(editingAccountId, {
        account_name: accountForm.account_name.trim(),
        account_no: accountForm.account_no,
        naration: accountForm.naration,
        account_type: accountForm.account_type,
        opening_balance: Number(accountForm.opening_balance) || 0,
      });
      alert(`Account #${accountForm.account_no} ("${accountForm.account_name}") updated successfully!`);
      setEditingAccountId(null);
    } else {
      dbAccounts.add({
        account_name: accountForm.account_name.trim(),
        account_no: accountForm.account_no || dbAccounts.getNextAccountNo(),
        naration: accountForm.naration,
        account_type: accountForm.account_type,
        opening_balance: Number(accountForm.opening_balance) || 0,
        date: accountForm.date || new Date().toLocaleDateString("en-US"),
      });
    }

    const nextNo = dbAccounts.getNextAccountNo();
    setAccountForm({
      account_name: "",
      account_no: nextNo,
      naration: "",
      account_type: accountForm.account_type,
      opening_balance: "0",
      date: new Date().toLocaleDateString("en-US"),
    });
    setAccounts(dbAccounts.getAll());
    setParties(dbParties.getAll());
    setTimeout(() => accountNameRef.current?.focus(), 50);
  };


  const handleImportLegacyAccounts = async () => {
    setAccessAccountsImportStatus({ loading: true, result: null, error: "" });
    try {
      const res = await dbAccounts.bulkImportFromAccess();
      if (res.success) {
        setAccessAccountsImportStatus({ loading: false, result: res, error: "" });
        setAccounts(dbAccounts.getAll());
        setParties(dbParties.getAll());
      } else {
        setAccessAccountsImportStatus({ loading: false, result: null, error: res.error || "Import failed" });
      }
    } catch (err) {
      setAccessAccountsImportStatus({ loading: false, result: null, error: err.message });
    }
  };

  // Filtered accounts for Chart of Accounts Modal
  const modalFilteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (modalAccountTypeFilter !== "All" && (a.account_type || "").toLowerCase() !== modalAccountTypeFilter.toLowerCase()) {
        return false;
      }
      if (modalAccountSearch.trim()) {
        const q = modalAccountSearch.toLowerCase().trim();
        const matchName = (a.account_name || "").toLowerCase().includes(q);
        const matchNo = String(a.account_no || "").includes(q);
        const matchType = (a.account_type || "").toLowerCase().includes(q);
        if (!matchName && !matchNo && !matchType) return false;
      }
      return true;
    });
  }, [accounts, modalAccountTypeFilter, modalAccountSearch]);

  const distinctAccountTypes = useMemo(() => {
    const set = new Set(accounts.map((a) => a.account_type).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [accounts]);

  // Modal backdrop body scroll lock
  const isAnyPopupOpen = Boolean(showChartOfAccountsModal || showAddPartyModal || showGodownModal || isMovementModalOpen);
  useEffect(() => {
    if (isAnyPopupOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isAnyPopupOpen]);

  useEffect(() => {
    refreshData();
    window.addEventListener("clinicflow_status_update", refreshData);
    return () => window.removeEventListener("clinicflow_status_update", refreshData);
  }, []);


  const handleOpenMovement = (item) => {
    setSelectedItemForModal(item);
    setIsMovementModalOpen(true);
  };

  const handlePartySelect = (partyId) => {
    setSelectedPartyId(partyId);
    const p = parties.find((item) => item.id === partyId);
    if (p) {
      setPartySearchCode(p.party_code || p.id);
      setB2bBuyerName(p.name);
      setB2bBuyerPhone(p.phone || "");
      setB2bCity(p.city || "Hyderabad");
      if (p.salesman) setSelectedSalesman(p.salesman);
    } else {
      setPartySearchCode("");
    }
  };

  const handlePartyCodeInput = (code) => {
    setPartySearchCode(code);
    if (!code || !code.trim()) {
      setSelectedPartyId("");
      return;
    }
    const q = code.trim().toLowerCase();
    const p = parties.find((item) =>
      (item.party_code && item.party_code.toLowerCase() === q) ||
      item.id.toLowerCase() === q ||
      (item.party_code && item.party_code.toLowerCase().startsWith(q)) ||
      item.name.toLowerCase().includes(q)
    );
    if (p) {
      setSelectedPartyId(p.id);
      setB2bBuyerName(p.name);
      setB2bBuyerPhone(p.phone || "");
      setB2bCity(p.city || "Hyderabad");
      if (p.salesman) setSelectedSalesman(p.salesman);
    }
  };

  // Transfer Source & Destination Locations
  const [transferSourceLoc, setTransferSourceLoc] = useState("wh_001"); // "wh_001", "wh_str", or godown ID
  const [transferDestLoc, setTransferDestLoc] = useState("wh_str"); // "wh_str", "wh_001", or godown ID
  const [transferSearchQuery, setTransferSearchQuery] = useState("");

  const handleExecuteTransfer = (e) => {
    e.preventDefault();
    if (!selectedInvForTransfer) { alert("Please select a medicine item to transfer."); return; }
    const inv = inventory.find((i) => i.id === selectedInvForTransfer);
    if (!inv) return;

    if (transferSourceLoc === transferDestLoc) {
      alert("Source Location and Destination Location cannot be the same. Please select different locations.");
      return;
    }

    const qty = Number(transferQty) || 1;
    if (qty <= 0) {
      alert("Please enter a valid transfer quantity greater than 0.");
      return;
    }

    const person = transferredBy.trim() || activeGodownOperator?.name || user?.name || "Store Staff";

    // Resolve location names
    const getLocationName = (locId) => {
      if (locId === "wh_str" || locId === "store") return "Medical Store (POS Counter)";
      if (locId === "wh_001" || locId === "godown" || locId === "main_warehouse") return "Main Godown (Hyderabad)";
      const matchedGodown = godowns.find((g) => g.id === locId);
      if (matchedGodown) return `${matchedGodown.name} (${matchedGodown.location || "Godown"})`;
      return "Warehouse Godown";
    };

    const fromLocName = getLocationName(transferSourceLoc);
    const toLocName = getLocationName(transferDestLoc);

    // Check available source stock
    let availableSourceStock = 0;
    if (transferSourceLoc === "wh_str" || transferSourceLoc === "store") {
      availableSourceStock = inv.store_stock ?? (inv.stock_qty ?? 0);
    } else {
      const locStocks = inv.location_stocks || {};
      availableSourceStock = locStocks[transferSourceLoc] !== undefined 
        ? locStocks[transferSourceLoc] 
        : (inv.warehouse_stock ?? 0);
    }

    if (qty > availableSourceStock) {
      alert(`Insufficient stock at [${fromLocName}]!\nAvailable: ${availableSourceStock} Units\nRequested: ${qty} Units`);
      return;
    }

    // Execute transfer with full location stock reconciliation
    const currentLocStocks = { ...(inv.location_stocks || {}) };
    let currentStoreStock = inv.store_stock ?? (inv.stock_qty ?? 0);
    let currentWhStock = inv.warehouse_stock ?? 0;

    // Deduct from source
    if (transferSourceLoc === "wh_str" || transferSourceLoc === "store") {
      currentStoreStock = Math.max(0, currentStoreStock - qty);
    } else {
      currentLocStocks[transferSourceLoc] = Math.max(0, (currentLocStocks[transferSourceLoc] ?? currentWhStock) - qty);
      currentWhStock = Math.max(0, currentWhStock - qty);
    }

    // Add to destination
    if (transferDestLoc === "wh_str" || transferDestLoc === "store") {
      currentStoreStock = currentStoreStock + qty;
    } else {
      currentLocStocks[transferDestLoc] = (currentLocStocks[transferDestLoc] ?? 0) + qty;
      currentWhStock = currentWhStock + qty;
    }

    const totalBase = currentStoreStock + currentWhStock;

    // Update DB Inventory
    dbInventory.update(inv.id, {
      store_stock: currentStoreStock,
      stock_qty: currentStoreStock,
      warehouse_stock: currentWhStock,
      total_base_stock: totalBase,
      location_stocks: currentLocStocks,
      updated_at: new Date().toISOString(),
    });

    // Record Immutable Stock Transfer Audit Entry
    dbStockTransfers.transfer({
      inventory_id: inv.id,
      medicine_name: inv.medicine_name,
      item_code: inv.item_code || "GEN",
      company_name: inv.company_name || "BM Pvt LTD",
      qty: qty,
      from_loc: fromLocName,
      from_warehouse_id: transferSourceLoc,
      to_loc: toLocName,
      to_warehouse_id: transferDestLoc,
      notes: transferNotes || `Stock Shift: ${fromLocName} ➔ ${toLocName}`,
      transferred_by: person,
      transferred_by_id: activeGodownOperator?.id || user?.id || "user_staff",
      status: "completed",
    });

    alert(`✅ Stock Shift Recorded Successfully!\n• Item: ${inv.medicine_name}\n• Shifted: ${qty} Units\n• From: ${fromLocName}\n• To: ${toLocName}\n• Shifted By: ${person}`);

    setSelectedInvForTransfer("");
    setTransferQty(1);
    setTransferNotes("");
    refreshData();
  };

  const handleAddB2BItemRow = () => {
    setB2bItems([
      ...b2bItems,
      { inventory_id: "", medicine_name: "", qty: 1, unit_price: 0, disc_pct: 0, disc_flat: 0, line_total: 0 }
    ]);
  };

  const handleRemoveB2BItemRow = (index) => {
    if (b2bItems.length === 1) return;
    setB2bItems(b2bItems.filter((_, i) => i !== index));
  };

  const handleB2BItemSelect = (index, invId) => {
    const inv = inventory.find((i) => i.id === invId);
    if (!inv) return;
    const updated = [...b2bItems];
    const price = inv.box_sale_price || inv.unit_sale_price || 0;
    const q = Number(updated[index].qty) || 1;
    const dPct = Number(updated[index].disc_pct) || 0;
    const dFlat = Number(updated[index].disc_flat) || 0;
    const gross = q * price;
    const disc = (gross * (dPct / 100)) + dFlat;
    updated[index] = {
      ...updated[index],
      inventory_id: inv.id,
      medicine_name: inv.medicine_name,
      unit_price: price,
      line_total: Math.max(0, gross - disc)
    };
    setB2bItems(updated);
  };

  const handleB2BItemChange = (index, field, val) => {
    const updated = [...b2bItems];
    updated[index][field] = val;
    const q = Number(field === "qty" ? val : updated[index].qty) || 0;
    const p = Number(field === "unit_price" ? val : updated[index].unit_price) || 0;
    const dPct = Number(field === "disc_pct" ? val : updated[index].disc_pct) || 0;
    const dFlat = Number(field === "disc_flat" ? val : updated[index].disc_flat) || 0;
    const gross = q * p;
    const disc = (gross * (dPct / 100)) + dFlat;
    updated[index].line_total = Math.max(0, gross - disc);
    setB2bItems(updated);
  };

  const calculateB2BItemsSubtotal = () => {
    return b2bItems.reduce((sum, i) => sum + (Number(i.line_total) || 0), 0);
  };

  const calculateB2BOverallDiscount = () => {
    const itemsSubtotal = calculateB2BItemsSubtotal();
    const dPct = Number(b2bOverallDiscPct) || 0;
    const dFlat = Number(b2bOverallDiscFlat) || 0;
    const pctAmount = itemsSubtotal * (dPct / 100);
    return pctAmount + dFlat;
  };

  const calculateB2BFinalTotal = () => {
    const itemsSubtotal = calculateB2BItemsSubtotal();
    const overallDisc = calculateB2BOverallDiscount();
    return Math.max(0, itemsSubtotal - overallDisc);
  };

  const handleExecuteB2BSale = (e) => {
    e.preventDefault();
    if (!b2bBuyerName.trim()) { alert("Please enter or select Party / Buyer Name."); return; }
    const validItems = b2bItems.filter((i) => i.medicine_name.trim() !== "");
    if (validItems.length === 0) { alert("Please add at least 1 medicine item for wholesale supply."); return; }

    // Validate warehouse stock with aggregated quantities for duplicate rows
    const itemTotals = new Map();
    for (const item of validItems) {
      if (item.inventory_id) {
        itemTotals.set(item.inventory_id, (itemTotals.get(item.inventory_id) || 0) + Number(item.qty || 1));
      }
    }
    for (const [invId, reqQty] of itemTotals.entries()) {
      const inv = inventory.find((i) => i.id === invId);
      if (inv) {
        const available = inv.warehouse_stock ?? 0;
        if (reqQty > available) {
          alert(`Insufficient Godown stock for "${inv.medicine_name}". Available: ${available}, Total Requested in Invoice: ${reqQty}`);
          return;
        }
      }
    }

    const itemsSubtotal = calculateB2BItemsSubtotal();
    const overallDiscount = calculateB2BOverallDiscount();
    const finalTotal = calculateB2BFinalTotal();

    let paid = 0;
    if (b2bPaymentType === "cash") {
      paid = finalTotal;
    } else if (b2bPaymentType === "cheque") {
      paid = Number(b2bChequeAmount) || finalTotal;
    } else {
      paid = Number(b2bPaidAmount) || 0;
    }
    const balance = Math.max(0, finalTotal - paid);

    const saleData = {
      buyer_id: selectedPartyId || null,
      buyer_name: b2bBuyerName,
      buyer_phone: b2bBuyerPhone,
      city: b2bCity,
      salesman: selectedSalesman,
      bilty_no: biltyNo || "Direct / Hand Delivery",
      transport: transportName || "Direct Delivery",
      items: validItems,
      items_subtotal: itemsSubtotal,
      overall_disc_pct: Number(b2bOverallDiscPct) || 0,
      overall_disc_flat: Number(b2bOverallDiscFlat) || 0,
      overall_discount_amount: overallDiscount,
      total_amount: finalTotal,
      paid_amount: paid,
      balance_due: balance,
      payment_type: b2bPaymentType,
      cheque_no: b2bPaymentType === "cheque" ? b2bChequeNo : null,
      bank_name: b2bPaymentType === "cheque" ? b2bBankName : null,
      cheque_date: b2bPaymentType === "cheque" ? b2bChequeDate : null,
      cheque_status: b2bPaymentType === "cheque" ? b2bChequeStatus : null,
      user_name: "Warehouse Manager"
    };

    const sale = dbB2BSales.checkout(saleData);
    alert(`Wholesale B2B Invoice #${sale.invoice_no} generated successfully! Stock deducted from Main Godown.`);

    // Reset Form
    setSelectedPartyId("");
    setPartySearchCode("");
    setB2bBuyerName("");
    setB2bBuyerPhone("");
    setBiltyNo("");
    setB2bPaidAmount("");
    setB2bChequeNo("");
    setB2bChequeAmount("");
    setB2bOverallDiscPct("");
    setB2bOverallDiscFlat("");
    setB2bItems([{ inventory_id: "", medicine_name: "", qty: 1, unit_price: 0, line_total: 0 }]);
    refreshData();
    setActiveTab("logs");
  };

  // Filtered inventory list
  const filteredInventory = inventory
    .filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (item.medicine_name || "").toLowerCase().includes(q);
        const matchCode = (item.item_code || "").toLowerCase().includes(q);
        const matchCat = (item.category || "").toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCat) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const nameA = (a.medicine_name || "").trim();
      const nameB = (b.medicine_name || "").trim();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

  // Filtered parties list
  const filteredParties = parties
    .filter((p) => {
      if (selectedCityFilter !== "all" && (p.city || "").toLowerCase() !== selectedCityFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (p.name || "").toLowerCase().includes(q) || (p.city || "").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const nameA = (a.party_code || a.name || "").trim();
      const nameB = (b.party_code || b.name || "").trim();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

  const uniqueCities = Array.from(new Set(parties.map((p) => p.city).filter(Boolean)));

  const totalGodownValuation = inventory.reduce(
    (sum, i) => sum + (i.warehouse_stock ?? 0) * (i.cost_price_per_box || i.purchase_price || 0),
    0
  );
  const totalWholesaleB2BVolume = b2bSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
  const totalPartyReceivables = parties.reduce((sum, p) => sum + (Number(p.balance_due) || 0), 0);

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 animate-fadeIn pb-24 overflow-x-hidden">
      
      {/* Page Header */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-teal-100 shadow-sm space-y-5">
        {/* Tier 1: Header Title & Primary Action Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-sm shrink-0">
              <span className="material-symbols-outlined text-2xl">warehouse</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-headline text-gray-900">
                Central Warehouse &amp; Wholesale Distribution
              </h1>
              <p className="text-xs text-gray-500">
                Interior Sindh Bulk Supply, Godown Stock, Bilty/Transport &amp; 2-Way Store Transfers
              </p>
            </div>
          </div>
        </div>

        {/* Tier 2: Dedicated Full-Width Action Tool Deck */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setLedgerInitialItem(null);
              setShowStockLedgerModal(true);
            }}
            className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/20 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            title="Open DrCreate 4-Level Stock Ledger (Category -> SKU -> Timeline -> Vouchers)"
          >
            <span className="material-symbols-outlined text-base">menu_book</span>
            <span>Stock Ledger</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSaleInvoiceModal(true)}
            className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/20 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            title="Open DrCreate & MS Access Style Sale Invoice (Form & History List)"
          >
            <span className="material-symbols-outlined text-base">point_of_sale</span>
            <span>Sale Invoice (DrCreate)</span>
          </button>

          <button
            onClick={() => {
              setTransferDirection("to_store");
              handleTabChange("transfer");
            }}
            className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/20 transition-all whitespace-nowrap cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">sync_alt</span>
            <span>Two-Way Stock Transfer</span>
          </button>
        </div>
      </div>



      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-teal-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Godown Inventory Value</span>
            <span className="material-symbols-outlined text-teal-600 text-lg">account_balance_wallet</span>
          </div>
          <div className="text-2xl font-bold font-headline text-gray-900 mt-2">
            {formatPKR(totalGodownValuation)}
          </div>
          <div className="text-xs text-teal-700 font-medium mt-1">
            {inventory.reduce((sum, i) => sum + (i.warehouse_stock ?? 0), 0)} Total Packs in Godown
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-teal-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Wholesale Supply Volume</span>
            <span className="material-symbols-outlined text-teal-600 text-lg">trending_up</span>
          </div>
          <div className="text-2xl font-bold font-headline text-gray-900 mt-2">
            {formatPKR(totalWholesaleB2BVolume)}
          </div>
          <div className="text-xs text-teal-700 font-medium mt-1">
            {b2bSales.length} Wholesale Invoices Dispatched
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-teal-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Party Outstanding Udhaar</span>
            <span className="material-symbols-outlined text-amber-600 text-lg">credit_card</span>
          </div>
          <div className="text-2xl font-bold font-headline text-amber-600 mt-2">
            {formatPKR(totalPartyReceivables)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Across {parties.length} Registered Sindh Parties
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-teal-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Active Supply Territories</span>
            <span className="material-symbols-outlined text-teal-600 text-lg">location_city</span>
          </div>
          <div className="text-2xl font-bold font-headline text-gray-900 mt-2">
            {uniqueCities.length} Cities
          </div>
          <div className="text-xs text-teal-700 font-medium mt-1">
            Hyderabad, Larkana, Sanghar, Tando Jam, etc.
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-gray-100 rounded-2xl border border-gray-200">
        <button
          onClick={() => handleTabChange("stock")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "stock"
              ? "bg-white text-teal-900 shadow-sm border border-teal-200"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span className="material-symbols-outlined text-sm text-teal-600">inventory_2</span>
          Godown Master Stock ({inventory.length})
        </button>

        <button
          onClick={() => handleTabChange("transfer")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "transfer"
              ? "bg-white text-teal-900 shadow-sm border border-teal-200"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span className="material-symbols-outlined text-sm text-teal-600">sync_alt</span>
          Two-Way Stock Transfers
        </button>

        <button
          onClick={() => handleTabChange("parties")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "parties"
              ? "bg-white text-teal-900 shadow-sm border border-teal-200"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span className="material-symbols-outlined text-sm text-teal-600">store</span>
          Sindh Parties &amp; Ledgers ({parties.length})
        </button>

        <button
          onClick={() => handleTabChange("godowns")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "godowns"
              ? "bg-white text-teal-900 shadow-sm border border-teal-200"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span className="material-symbols-outlined text-sm text-teal-600">warehouse</span>
          Godown Master ({godowns.length})
        </button>

        <button
          onClick={() => handleTabChange("logs")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "logs"
              ? "bg-white text-teal-900 shadow-sm border border-teal-200"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span className="material-symbols-outlined text-sm text-teal-600">receipt_long</span>
          Audit Logs ({transfers.length + b2bSales.length})
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: GODOWN MASTER STOCK WITH 1-CLICK PRODUCT MOVEMENT MODAL      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-teal-100 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
              <input
                type="text"
                placeholder="Search Medicine name, code, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-teal-600 text-xs font-medium focus:outline-none transition-all"
              />
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse"></span>
              <span>Tip: Click on any row to open the <b>Product Movement &amp; Lifecycle Card</b></span>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100">
                    <th className="py-3.5 px-4">Medicine Item</th>
                    <th className="py-3.5 px-4">Code / Category</th>
                    <th className="py-3.5 px-4 text-center">Godown Stock</th>
                    <th className="py-3.5 px-4 text-center">Store POS Stock</th>
                    <th className="py-3.5 px-4 text-center">Total Stock</th>
                    <th className="py-3.5 px-4 text-right">Purchase Price</th>
                    <th className="py-3.5 px-4 text-right">Sale Price</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {filteredInventory.map((item) => {
                    const wStock = item.warehouse_stock ?? 0;
                    const sStock = item.store_stock ?? (item.stock_qty ?? 0);
                    const totStock = item.total_base_stock ?? (wStock + sStock);
                    const isLow = totStock <= (item.low_stock_threshold || 6);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleOpenMovement(item)}
                        className="hover:bg-teal-50/50 cursor-pointer transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-bold text-gray-900 flex items-center gap-2">
                          <span className="material-symbols-outlined text-teal-600 text-base">
                            medication
                          </span>
                          <span>{item.medicine_name}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            {item.item_code || "GEN"}
                          </span>
                          <span className="ml-1.5 text-gray-500">{item.category}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-teal-800">
                          {wStock} <span className="text-[10px] text-gray-400 font-normal">{item.box_label || "Packs"}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-teal-900">
                          {sStock} <span className="text-[10px] text-gray-400 font-normal">{item.unit_label || "Units"}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            isLow
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}>
                            {totStock}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-gray-600">
                          {canViewFinancials
                            ? formatPKR(item.cost_price_per_box || item.purchase_price || 0)
                            : <span className="text-xs text-gray-400 font-semibold">🔒 Confidential</span>}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                          {formatPKR(item.box_sale_price || item.sale_price || 0)}
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenMovement(item)}
                            className="px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 hover:bg-teal-600 hover:text-white text-teal-800 text-xs font-bold flex items-center gap-1 mx-auto transition-all shadow-sm"
                          >
                            <span className="material-symbols-outlined text-xs">analytics</span>
                            Stock Card
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: TWO-WAY STOCK TRANSFERS (GODOWN <-> STORE / GODOWNS)         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "transfer" && (
        <div className="space-y-6">
          {/* Main Transfer Workflow Card */}
          <div className="bg-white p-6 rounded-3xl border border-teal-100 shadow-sm space-y-6">
            
            {/* Header with Handler / Operator badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold font-headline text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-600">sync_alt</span>
                  Internal Stock Transfer &amp; Shift Manager
                </h2>
                <p className="text-xs text-gray-500">
                  Shift medicine stock between Godowns and Front Counter with 100% transparent audit trails.
                </p>
              </div>

              {/* Active Operator Pill */}
              <div className="flex items-center gap-2 bg-teal-50/80 border border-teal-200 px-3.5 py-1.5 rounded-2xl">
                <span className="material-symbols-outlined text-teal-700 text-sm">badge</span>
                <span className="text-xs text-gray-600">Operator:</span>
                <span className="text-xs font-bold text-teal-950 font-mono">
                  {transferredBy || activeGodownOperator?.name || "Staff"}
                </span>
              </div>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-6">
              
              {/* STEP 1: Fast Transfer Preset Mode */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                  Select Transfer Route / Direction:
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTransferSourceLoc("wh_001");
                      setTransferDestLoc("wh_str");
                      setTransferDirection("to_store");
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      transferSourceLoc === "wh_001" && transferDestLoc === "wh_str"
                        ? "bg-teal-50/90 border-teal-600 text-teal-950 ring-2 ring-teal-500/20 shadow-sm"
                        : "bg-gray-50/70 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <span className="material-symbols-outlined text-lg">storefront</span>
                    </div>
                    <div>
                      <div className="font-bold text-xs text-teal-900 flex items-center gap-1.5">
                        <span>Godown</span>
                        <span className="material-symbols-outlined text-xs text-teal-600">arrow_forward</span>
                        <span>Front Medical Store</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                        Daily counter refill / Replenish front shelves
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTransferSourceLoc("wh_str");
                      setTransferDestLoc("wh_001");
                      setTransferDirection("to_warehouse");
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      transferSourceLoc === "wh_str" && transferDestLoc === "wh_001"
                        ? "bg-teal-50/90 border-teal-600 text-teal-950 ring-2 ring-teal-500/20 shadow-sm"
                        : "bg-gray-50/70 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <span className="material-symbols-outlined text-lg">warehouse</span>
                    </div>
                    <div>
                      <div className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                        <span>Front Medical Store</span>
                        <span className="material-symbols-outlined text-xs text-amber-600">arrow_forward</span>
                        <span>Godown</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                        Stock return / Shift excess or slow-moving items back
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* STEP 2: Location Selectors (From & To) */}
              <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-rose-600">upload</span>
                    From (Source Location - Deducts Stock):
                  </label>
                  <select
                    value={transferSourceLoc}
                    onChange={(e) => setTransferSourceLoc(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="wh_001">🏢 Main Godown (Hyderabad)</option>
                    <option value="wh_str">🏪 Medical Store (POS Counter)</option>
                    {godowns.filter(g => g.id !== "wh_001" && g.id !== "wh_str").map(g => (
                      <option key={g.id} value={g.id}>📦 {g.name} ({g.location || "Godown"})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-emerald-600">download</span>
                    To (Destination Location - Adds Stock):
                  </label>
                  <select
                    value={transferDestLoc}
                    onChange={(e) => setTransferDestLoc(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="wh_str">🏪 Medical Store (POS Counter)</option>
                    <option value="wh_001">🏢 Main Godown (Hyderabad)</option>
                    {godowns.filter(g => g.id !== "wh_001" && g.id !== "wh_str").map(g => (
                      <option key={g.id} value={g.id}>📦 {g.name} ({g.location || "Godown"})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* STEP 3: Medicine Item & Quantity Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                  Select Medicine &amp; Transfer Quantity:
                </label>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-8">
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Choose Medicine ({inventory.length} total in catalog):
                    </label>
                    <select
                      value={selectedInvForTransfer}
                      onChange={(e) => setSelectedInvForTransfer(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    >
                      <option value="">-- Click to Select Medicine Item --</option>
                      {inventory.map((inv) => {
                        const locStocks = inv.location_stocks || {};
                        const srcStock = transferSourceLoc === "wh_str" 
                          ? (inv.store_stock ?? inv.stock_qty ?? 0)
                          : (locStocks[transferSourceLoc] !== undefined ? locStocks[transferSourceLoc] : (inv.warehouse_stock ?? 0));
                        
                        return (
                          <option key={inv.id} value={inv.id}>
                            [{inv.company_name || "BM"}] {inv.medicine_name} ({inv.item_code || "GEN"}) — Available in Source: {srcStock} Units
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Quantity to Shift (Units):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        placeholder="1"
                        value={transferQty}
                        onChange={(e) => setTransferQty(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-black font-mono text-center text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Selected Medicine Stock Visualizer */}
                {selectedInvForTransfer && (() => {
                  const activeInv = inventory.find((i) => i.id === selectedInvForTransfer);
                  if (!activeInv) return null;

                  const locStocks = activeInv.location_stocks || {};
                  const srcStock = transferSourceLoc === "wh_str" 
                    ? (activeInv.store_stock ?? activeInv.stock_qty ?? 0)
                    : (locStocks[transferSourceLoc] !== undefined ? locStocks[transferSourceLoc] : (activeInv.warehouse_stock ?? 0));

                  const dstStock = transferDestLoc === "wh_str"
                    ? (activeInv.store_stock ?? activeInv.stock_qty ?? 0)
                    : (locStocks[transferDestLoc] !== undefined ? locStocks[transferDestLoc] : (activeInv.warehouse_stock ?? 0));

                  const q = Number(transferQty) || 0;
                  const srcAfter = Math.max(0, srcStock - q);
                  const dstAfter = dstStock + q;
                  const isInsufficient = q > srcStock;

                  return (
                    <div className={`mt-3 p-4 rounded-2xl border transition-all ${
                      isInsufficient ? "bg-rose-50 border-rose-300" : "bg-teal-50/60 border-teal-200"
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="font-bold text-gray-900 block text-sm">
                            {activeInv.medicine_name}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            Company: <b>{activeInv.company_name || "BM Pvt LTD"}</b> | Code: <b>{activeInv.item_code || "GEN"}</b>
                          </span>
                        </div>

                        {/* Live Stock Comparison Card */}
                        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-teal-200 shadow-2xs">
                          <div className="text-center">
                            <span className="text-[10px] text-gray-500 uppercase block font-semibold">Source Before:</span>
                            <span className="font-mono font-bold text-gray-800">{srcStock}</span>
                            <span className="text-[10px] text-teal-700 block font-bold">➔ After: {srcAfter}</span>
                          </div>
                          <div className="text-teal-400 font-bold">➔</div>
                          <div className="text-center">
                            <span className="text-[10px] text-gray-500 uppercase block font-semibold">Destination Before:</span>
                            <span className="font-mono font-bold text-gray-800">{dstStock}</span>
                            <span className="text-[10px] text-emerald-700 block font-bold">➔ After: {dstAfter}</span>
                          </div>
                        </div>
                      </div>

                      {isInsufficient && (
                        <div className="mt-2 text-xs font-bold text-rose-700 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">error</span>
                          Cannot transfer {q} units! Source location only has {srcStock} units available.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* STEP 4: Handler Person & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-teal-600">person</span>
                    Shifted / Handled By (Staff Person):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Usama / Bilal / Raza"
                    value={transferredBy}
                    onChange={(e) => setTransferredBy(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs font-bold text-gray-800 focus:bg-white focus:outline-none focus:border-teal-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-gray-500">edit_note</span>
                    Reason / Shift Remarks:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Daily morning counter refill / Customer demand shift"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs focus:bg-white focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-teal-600">verified</span>
                  Real-time stock deduction and ledger logging will be recorded instantly.
                </p>

                <button
                  type="submit"
                  className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Confirm &amp; Record Internal Stock Transfer
                </button>
              </div>

            </form>
          </div>

          {/* Transfers History Log Table with Search */}
          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-gray-50/80 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-700 text-base">history</span>
                <span className="font-bold text-xs text-gray-800 uppercase tracking-wider">
                  Internal Stock Shifts Audit Log ({transfers.length} records)
                </span>
              </div>

              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">search</span>
                <input
                  type="text"
                  placeholder="Filter by medicine, handler, location..."
                  value={transferSearchQuery}
                  onChange={(e) => setTransferSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                    <th className="py-3.5 px-4">Transfer #</th>
                    <th className="py-3.5 px-4">Date &amp; Time</th>
                    <th className="py-3.5 px-4">Medicine Item</th>
                    <th className="py-3.5 px-4">Shift Route (From ➔ To)</th>
                    <th className="py-3.5 px-4 text-center">Quantity</th>
                    <th className="py-3.5 px-4">Shifted By (Handler)</th>
                    <th className="py-3.5 px-4">Remarks / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {transfers
                    .filter((trf) => {
                      if (!transferSearchQuery.trim()) return true;
                      const q = transferSearchQuery.toLowerCase();
                      return (
                        (trf.transfer_no || "").toLowerCase().includes(q) ||
                        (trf.medicine_name || "").toLowerCase().includes(q) ||
                        (trf.transferred_by || "").toLowerCase().includes(q) ||
                        (trf.from_loc || "").toLowerCase().includes(q) ||
                        (trf.to_loc || "").toLowerCase().includes(q) ||
                        (trf.notes || "").toLowerCase().includes(q)
                      );
                    })
                    .map((trf) => (
                      <tr key={trf.id} className="hover:bg-teal-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-teal-900">
                          {trf.transfer_no || "TRF-LOG"}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 font-mono text-[11px]">
                          {formatDate(trf.transfer_date || trf.created_at)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-teal-600 text-sm">medication</span>
                            {trf.medicine_name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-teal-50 text-teal-900 border border-teal-200">
                            <span>{trf.from_loc}</span>
                            <span className="material-symbols-outlined text-xs text-teal-600">arrow_forward</span>
                            <span>{trf.to_loc}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-black text-sm text-teal-950">
                          {trf.qty} <span className="text-[10px] text-gray-400 font-normal">Units</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 font-bold text-gray-800 bg-gray-100 px-2.5 py-1 rounded-xl text-[11px] border border-gray-200">
                            <span className="material-symbols-outlined text-xs text-teal-600">person</span>
                            {trf.transferred_by || "Staff"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 text-[11px] max-w-xs truncate">
                          {trf.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  {transfers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        <span className="material-symbols-outlined text-3xl block mb-1 text-gray-300">swap_horiz</span>
                        No stock transfer entries recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: SINDH PARTIES & CREDIT LEDGERS                               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "parties" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-teal-100 shadow-sm">
            <div className="flex items-center gap-3 flex-1 max-w-lg">
              <input
                type="text"
                placeholder="Search Party name, code or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-teal-600 text-xs font-medium focus:outline-none transition-all"
              />
              <select
                value={selectedCityFilter}
                onChange={(e) => setSelectedCityFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-bold focus:outline-none focus:border-teal-600"
              >
                <option value="all">All Cities ({uniqueCities.length})</option>
                {uniqueCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs font-bold text-gray-700 hidden md:block">
                Total Outstanding: <span className="text-amber-600 font-headline text-base font-bold ml-1">{formatPKR(totalPartyReceivables)}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPartyModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-base">add_business</span>
                + Add New Party
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100">
                    <th className="py-3.5 px-4">Party Name / Store / Doctor</th>
                    <th className="py-3.5 px-4">Territory / City</th>
                    <th className="py-3.5 px-4">Phone / Contact</th>
                    <th className="py-3.5 px-4">Address / Narration</th>
                    <th className="py-3.5 px-4 text-right">Balance Due (Udhaar)</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {filteredParties.map((p) => (
                    <tr key={p.id} className="hover:bg-teal-50/50">
                      <td className="py-3.5 px-4 font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-teal-600 text-base">store</span>
                        {p.party_code ? <span className="font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded text-[10px]">#{p.party_code}</span> : null}
                        {p.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          {p.city}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-600">{p.phone || "—"}</td>
                      <td className="py-3.5 px-4 text-gray-500 max-w-[200px] truncate">{p.address}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-600">
                        {formatPKR(p.balance_due || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedPartyId(p.id);
                              setB2bBuyerName(p.name);
                              setB2bBuyerPhone(p.phone || "");
                              setB2bCity(p.city || "Hyderabad");
                              handleTabChange("b2b");
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] transition-all shadow-sm flex items-center gap-1"
                            title="Create B2B Invoice for this party"
                          >
                            <span className="material-symbols-outlined text-sm">receipt_long</span>
                            Invoice
                          </button>

                          <button
                            onClick={() => handleOpenEditParty(p)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 font-bold text-[11px] transition-all flex items-center gap-1"
                            title="Edit Party Code, Name, City, Phone & Details"
                          >
                            <span className="material-symbols-outlined text-sm text-teal-600">edit</span>
                            Edit
                          </button>

                          <button
                            onClick={() => handleDeleteParty(p)}
                            className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold transition-all"
                            title="Delete Party"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: WHOLESALE INVOICES LOG                                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-xs text-gray-800 uppercase tracking-wider flex items-center justify-between">
            <span>Dispatched Wholesale B2B Invoices</span>
            <span className="text-teal-800 font-mono font-bold">{formatPKR(totalWholesaleB2BVolume)} Total Volume</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Party / Buyer</th>
                  <th className="py-3.5 px-4">City / Bilty / Transport</th>
                  <th className="py-3.5 px-4">Salesman</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4 text-right">Paid</th>
                  <th className="py-3.5 px-4 text-right">Balance</th>
                  <th className="py-3.5 px-4 text-center">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {b2bSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-teal-50/50">
                    <td className="py-3.5 px-4 font-mono font-bold text-teal-900">
                      {sale.invoice_no}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 font-mono">{formatDate(sale.sale_date)}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">{sale.buyer_name}</td>
                    <td className="py-3.5 px-4 text-gray-600">
                      <span className="font-semibold text-gray-800">{sale.city}</span>
                      {sale.bilty_no && <div className="text-[10px] font-mono text-teal-700">Bilty: {sale.bilty_no} ({sale.transport})</div>}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-teal-800">{sale.salesman || "—"}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                      {formatPKR(sale.total_amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-bold">{formatPKR(sale.paid_amount || 0)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-600">
                      {formatPKR(sale.balance_due || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => printThermalReceipt({
                          id: sale.invoice_no,
                          sale_date: sale.sale_date,
                          user_name: sale.salesman || "Wholesale Desk",
                          patient_name: `${sale.buyer_name} [${sale.city}] (Bilty: ${sale.bilty_no || 'N/A'} - ${sale.transport || ''})`,
                          items: sale.items || [],
                          total_amount: sale.total_amount,
                          subtotal_amount: sale.total_amount,
                          cash_tendered: sale.paid_amount,
                          change_due: 0
                        }, dbClinic.get())}
                        className="px-2.5 py-1 rounded-xl bg-teal-50 border border-teal-200 hover:bg-teal-600 hover:text-white text-teal-800 text-xs font-bold flex items-center gap-1 mx-auto transition-all shadow-sm"
                      >
                        <span className="material-symbols-outlined text-xs">print</span>
                        Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Movement Traceability Modal */}
      {selectedItemForModal && (
        <ProductMovementModal
          item={selectedItemForModal}
          isOpen={isMovementModalOpen}
          onClose={() => {
            setIsMovementModalOpen(false);
            setSelectedItemForModal(null);
          }}
          onStockUpdated={refreshData}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB: GODOWN / MULTI-WAREHOUSE MASTER MANAGEMENT                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "godowns" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-teal-100 shadow-sm">
            <div>
              <div className="font-bold text-gray-900">Godown / Warehouse Master</div>
              <div className="text-xs text-gray-500 mt-0.5">Manage all storage godowns. Stock valuation is computed per-location.</div>
            </div>
            <button
              onClick={() => {
                setEditingGodown(null);
                setGodownForm({ name: "", code: "", location: "", incharge_name: "", phone: "", notes: "", status: "active" });
                setShowGodownModal(true);
              }}
              className="bg-teal-600 text-white px-4 py-2.5 rounded-2xl font-bold text-xs hover:bg-teal-700 transition-colors shadow-md flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">add_home_work</span>
              Add New Godown
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {godowns.map((gd) => {
              const val = dbWarehouses.getStockValuation(gd.id);
              const itemCount = inventory.filter((i) => (i.location_stocks?.[gd.id] || (gd.id === "wh_001" ? i.warehouse_stock : gd.is_store_counter ? (i.store_stock ?? i.stock_qty) : 0) || 0) > 0).length;
              return (
                <div
                  key={gd.id}
                  className={`bg-white rounded-3xl border ${gd.is_store_counter ? "border-emerald-200" : gd.is_default ? "border-teal-300 ring-2 ring-teal-100" : "border-gray-200"} p-5 shadow-sm hover:shadow-md transition-all space-y-3`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 ${gd.is_store_counter ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-teal-50 border border-teal-200 text-teal-700"}`}>
                        <span className="material-symbols-outlined text-2xl">{gd.is_store_counter ? "storefront" : "warehouse"}</span>
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-sm leading-tight">{gd.name}</div>
                        <div className="text-[10px] font-mono text-gray-400 mt-0.5">{gd.code}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${gd.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {gd.status}
                      </span>
                      {gd.is_default && (
                        <span className="text-[9px] font-black bg-teal-600 text-white px-2 py-0.5 rounded-full">PRIMARY</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <div className="flex justify-between"><span className="text-gray-400">Location:</span><span className="font-semibold truncate max-w-[160px]">{gd.location || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Incharge:</span><span className="font-bold text-teal-800">{gd.incharge_name || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Phone:</span><span className="font-semibold">{gd.phone || "—"}</span></div>
                    <div className="flex justify-between border-t border-gray-200 pt-1.5">
                      <span className="text-gray-400">Stock Items:</span><span className="font-black text-teal-700">{itemCount} SKUs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Est. Value:</span>
                      <span className="font-black text-gray-900">Rs. {val.totalValue.toLocaleString()}</span>
                    </div>
                  </div>
                  {gd.notes && <div className="text-[10px] text-gray-400 italic">{gd.notes}</div>}

                  <div className="pt-1 border-t border-gray-100 flex gap-2">
                    <button
                      onClick={() => {
                        setEditingGodown(gd);
                        setGodownForm({ name: gd.name, code: gd.code, location: gd.location || "", incharge_name: gd.incharge_name || "", phone: gd.phone || "", notes: gd.notes || "", status: gd.status || "active" });
                        setShowGodownModal(true);
                      }}
                      className="flex-1 text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 py-2 rounded-xl transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      Edit
                    </button>
                    {!gd.is_store_counter && !gd.is_default && (
                      <button
                        onClick={() => {
                          if (!window.confirm(`Delete godown "${gd.name}"? This cannot be undone.`)) return;
                          const ok = dbWarehouses.delete(gd.id);
                          if (!ok) { alert("Cannot delete this godown (system-protected)."); return; }
                          refreshData();
                        }}
                        className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 py-2 px-3 rounded-xl transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {godowns.length === 0 && (
              <div className="col-span-full text-center py-16 bg-white rounded-3xl border border-gray-200">
                <span className="material-symbols-outlined text-5xl text-gray-300 block mb-2">warehouse</span>
                <div className="text-gray-500 font-semibold text-sm">No godowns found.</div>
                <button onClick={() => { setEditingGodown(null); setGodownForm({ name: "", code: "", location: "", incharge_name: "", phone: "", notes: "", status: "active" }); setShowGodownModal(true); }} className="mt-3 bg-teal-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-teal-700">
                  + Add First Godown
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Godown Add/Edit Modal (React Portal) */}
      {showGodownModal && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowGodownModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white max-w-md w-full rounded-3xl p-6 border-2 border-teal-600 shadow-2xl space-y-4 animate-scaleUp text-left"
          >
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>warehouse</span>
                {editingGodown ? `Edit: ${editingGodown.name}` : "Add New Godown"}
              </h3>
              <button type="button" onClick={() => setShowGodownModal(false)} className="text-gray-400 hover:text-gray-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!godownForm.name.trim()) { alert("Godown name is required."); return; }
                if (editingGodown) {
                  dbWarehouses.update(editingGodown.id, godownForm);
                } else {
                  dbWarehouses.add(godownForm);
                }
                setShowGodownModal(false);
                refreshData();
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                <div className="col-span-2">
                  <label className="block text-slate-800 font-bold mb-1">Godown Name *</label>
                  <input type="text" required autoFocus value={godownForm.name} onChange={(e) => setGodownForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Main Godown (Lajpat Road)" className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-950 bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:outline-none cursor-text shadow-xs" />
                </div>
                <div>
                  <label className="block text-slate-800 font-bold mb-1">Short Code</label>
                  <input type="text" value={godownForm.code} onChange={(e) => setGodownForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. GDW-03" className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-950 bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:outline-none cursor-text shadow-xs" />
                </div>
                <div>
                  <label className="block text-slate-800 font-bold mb-1">Status</label>
                  <select value={godownForm.status} onChange={(e) => setGodownForm((f) => ({ ...f, status: e.target.value }))} className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-950 bg-white focus:border-teal-600 focus:outline-none cursor-pointer">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-800 font-bold mb-1">Location / Address</label>
                  <input type="text" value={godownForm.location} onChange={(e) => setGodownForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Site Area, Near Bus Stop, Hyderabad" className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-950 bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:outline-none cursor-text shadow-xs" />
                </div>
                <div>
                  <label className="block text-slate-800 font-bold mb-1">Incharge Name</label>
                  <input type="text" value={godownForm.incharge_name} onChange={(e) => setGodownForm((f) => ({ ...f, incharge_name: e.target.value }))} placeholder="e.g. Raza Ahmed" className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-950 bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:outline-none cursor-text shadow-xs" />
                </div>
                <div>
                  <label className="block text-slate-800 font-bold mb-1">Phone</label>
                  <input type="text" value={godownForm.phone} onChange={(e) => setGodownForm((f) => ({ ...f, phone: e.target.value }))} placeholder="03001234567" className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-950 bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:outline-none cursor-text shadow-xs" />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-800 font-bold mb-1">Notes</label>
                  <input type="text" value={godownForm.notes} onChange={(e) => setGodownForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes about this godown" className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-950 bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:outline-none cursor-text shadow-xs" />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowGodownModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-black py-2.5 rounded-xl text-xs transition-colors shadow-md cursor-pointer">
                  {editingGodown ? "Save Changes" : "Add Godown"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* DrCreate / MS Access Style: Chart Of Accounts _List Popup Modal (React Portal) */}
      {showChartOfAccountsModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white max-w-4xl w-full rounded-3xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 px-6 py-4 flex items-center justify-between text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <span className="material-symbols-outlined text-emerald-300 text-2xl">folder_shared</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-lg text-white flex items-center gap-2">
                    Chart Of Accounts _List
                    <span className="text-[10px] bg-emerald-700/80 text-emerald-100 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                      {modalFilteredAccounts.length} / {accounts.length} Accounts
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-100/80">
                    Master ledger directory of Wholesale Stores, Pharma Companies, Salesmen &amp; Financial Heads
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowChartOfAccountsModal(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Filter & Search Bar */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs font-bold text-gray-600 whitespace-nowrap">Filter Type:</label>
                <select
                  value={modalAccountTypeFilter}
                  onChange={(e) => setModalAccountTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-800 bg-white focus:ring-2 focus:ring-emerald-500 outline-none w-full sm:w-48"
                >
                  {distinctAccountTypes.map((t) => (
                    <option key={t} value={t}>
                      {t === "All" ? "All Account Types" : t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-full sm:w-72">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-sm">search</span>
                <input
                  type="text"
                  placeholder="Search by Name, No, Type..."
                  value={modalAccountSearch}
                  onChange={(e) => setModalAccountSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-gray-400 bg-white"
                />
              </div>
            </div>

            {/* Legacy Import Notification Banner */}
            {accessAccountsImportStatus.result && (
              <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 font-bold flex items-center justify-between">
                <span>✅ Successfully imported {accessAccountsImportStatus.result.count} legacy accounts from AshrafKhan.accdb! Total: {accessAccountsImportStatus.result.total}</span>
                <button onClick={() => setAccessAccountsImportStatus({ loading: false, result: null, error: "" })} className="text-emerald-900 hover:underline">Dismiss</button>
              </div>
            )}
            {accessAccountsImportStatus.error && (
              <div className="px-6 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 font-bold flex items-center justify-between">
                <span>❌ Import error: {accessAccountsImportStatus.error}</span>
                <button onClick={() => setAccessAccountsImportStatus({ loading: false, result: null, error: "" })} className="text-rose-900 hover:underline">Dismiss</button>
              </div>
            )}

            {/* Accounts Table */}
            <div className="flex-1 overflow-y-auto p-4 max-h-[55vh] custom-scrollbar">
              <table className="w-full text-left border-collapse">

                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="border-b-2 border-emerald-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Account Name</th>
                    <th className="py-2.5 px-3 text-center w-24">No</th>
                    <th className="py-2.5 px-3 w-36">Account Type</th>
                    <th className="py-2.5 px-3">Naration / Notes</th>
                    <th className="py-2.5 px-3 text-center w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {modalFilteredAccounts.length > 0 ? (
                    modalFilteredAccounts.map((a) => (
                      <tr
                        key={a.id || a.account_no}
                        onClick={() => handleSelectAccountForEdit(a)}
                        className="hover:bg-emerald-50/70 cursor-pointer transition-colors group"
                        title="Click to pick and edit this account"
                      >
                        <td className="py-2.5 px-3 font-bold text-gray-900 group-hover:text-emerald-800">
                          {a.account_name}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-800 bg-emerald-50/30 rounded-lg">
                          #{a.account_no}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            a.account_type === "Supplier"
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : a.account_type === "Cash" || a.account_type === "Expense"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-teal-100 text-teal-800 border border-teal-200"
                          }`}>
                            {a.account_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 truncate max-w-xs">
                          {a.naration || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAccountForEdit(a);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-emerald-100 group-hover:bg-emerald-600 group-hover:text-white text-emerald-800 text-xs font-bold flex items-center gap-1 mx-auto transition-all shadow-sm active:scale-95"
                          >
                            <span className="material-symbols-outlined text-xs">edit</span>
                            Pick / Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400 font-semibold">
                        <span className="material-symbols-outlined text-4xl block mb-1 text-gray-300">folder_off</span>
                        No accounts found matching filter.
                      </td>
                    </tr>
                  )}
                </tbody>

              </table>
            </div>

            {/* Modal Bottom Action Buttons */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleImportLegacyAccounts}
                  disabled={accessAccountsImportStatus.loading}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                  title="Import all 262 real registered accounts from AshrafKhan.accdb"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  {accessAccountsImportStatus.loading ? "Importing..." : "📥 Import Access Accounts (262)"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printChartOfAccountsReceipt(modalFilteredAccounts, modalAccountTypeFilter, dbClinic.get())}
                  className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  Print List
                </button>

                <button
                  type="button"
                  onClick={() => dbAccounts.exportCSV(modalFilteredAccounts, `chart_of_accounts_${modalAccountTypeFilter}.csv`)}
                  className="px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">file_download</span>
                  Export List
                </button>

                <button
                  type="button"
                  onClick={() => setShowChartOfAccountsModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold transition-all"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* DrCreate 4-Level Stock Ledger Modal */}
      <StockLedgerModal
        isOpen={showStockLedgerModal}
        onClose={() => {
          setShowStockLedgerModal(false);
          setLedgerInitialItem(null);
        }}
        initialItem={ledgerInitialItem}
      />

      {/* DrCreate & MS Access Sale Invoice Form & List Modal */}
      <SaleInvoiceModal
        isOpen={showSaleInvoiceModal}
        onClose={() => setShowSaleInvoiceModal(false)}
      />

      {/* Add New Wholesale Party Modal (Global React Portal) */}
      {showAddPartyModal && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => {
            setShowAddPartyModal(false);
            setEditingPartyId(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scaleUp border-2 border-teal-600 text-left"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-teal-950 font-black text-base">
                <span className="material-symbols-outlined text-teal-600 text-2xl">
                  {editingPartyId ? "edit_note" : "add_business"}
                </span>
                {editingPartyId ? "Edit Party Profile & Territory" : "Register New Wholesale Party / Account"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddPartyModal(false);
                  setEditingPartyId(null);
                }}
                className="text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveParty} className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Party Code:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1044"
                    value={newPartyForm.party_code}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, party_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-xs font-mono font-black text-slate-950 uppercase focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 cursor-text shadow-xs"
                  />
                  <span className="text-[9.5px] text-slate-400">Empty = Auto</span>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Party / Store Name: *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Al-Shifa Homeo Store"
                    value={newPartyForm.name}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-xs font-bold text-slate-950 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 cursor-text shadow-xs"
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
                    placeholder="e.g. Hyderabad"
                    value={newPartyForm.city}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-xs font-bold text-slate-950 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 cursor-text shadow-xs"
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
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-xs font-mono font-bold text-slate-950 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 cursor-text shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Address / Goods Transport:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Medical Market / Al-Madina Goods Bilty"
                  value={newPartyForm.address}
                  onChange={(e) => setNewPartyForm({ ...newPartyForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-xs font-bold text-slate-950 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 cursor-text shadow-xs"
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
                  onChange={(e) => setNewPartyForm({ ...newPartyForm, balance_due: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-xs font-mono font-black text-rose-700 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 cursor-text shadow-xs"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPartyModal(false);
                    setEditingPartyId(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  {editingPartyId ? "Update Party Profile" : "Save Party"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}




