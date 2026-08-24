import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [inventory, setInventory] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [b2bSales, setB2BSales] = useState([]);
  const [parties, setParties] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [accounts, setAccounts] = useState([]);
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
  const [godowns, setGodowns] = useState([]);
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

  // Add New Party Modal State
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [newPartyForm, setNewPartyForm] = useState({
    party_code: "",
    name: "",
    city: "Hyderabad",
    phone: "",
    address: "",
    balance_due: "0",
  });

  const handleSaveParty = (e) => {
    e.preventDefault();
    if (!newPartyForm.name.trim()) {
      alert("Please enter party / store name.");
      return;
    }
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
    setShowAddPartyModal(false);

    // Auto-select party if user was on B2B Wholesale tab
    setSelectedPartyId(created.id);
    setPartySearchCode(created.party_code || created.id);
    setB2bBuyerName(created.name);
    setB2bBuyerPhone(created.phone || "");
    setB2bCity(created.city || "Hyderabad");

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

  const handleExecuteTransfer = (e) => {
    e.preventDefault();
    if (!selectedInvForTransfer) { alert("Please select a medicine item to transfer."); return; }
    const inv = inventory.find((i) => i.id === selectedInvForTransfer);
    if (!inv) return;

    const qty = Number(transferQty) || 1;
    const person = transferredBy.trim() || "Store Staff";

    if (transferDirection === "to_store") {
      const wStock = inv.warehouse_stock ?? 0;
      if (qty > wStock) {
        alert(`Cannot transfer ${qty} units! Godown only has ${wStock} units in stock.`);
        return;
      }
      dbInventory.transferWarehouseToStore(selectedInvForTransfer, qty, transferNotes, person);
      alert(`Successfully transferred ${qty} units of ${inv.medicine_name} from Godown ➔ Store Counter by [${person}]!`);
    } else {
      const sStock = inv.store_stock ?? (inv.stock_qty ?? 0);
      if (qty > sStock) {
        alert(`Cannot transfer ${qty} units! Store Counter only has ${sStock} units.`);
        return;
      }
      dbInventory.transferStoreToWarehouse(selectedInvForTransfer, qty, transferNotes, person);
      alert(`Successfully returned ${qty} units of ${inv.medicine_name} from Store Counter ➔ Godown by [${person}]!`);
    }

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

    // Validate warehouse stock
    for (const item of validItems) {
      const inv = inventory.find((i) => i.id === item.inventory_id);
      if (inv) {
        const available = inv.warehouse_stock ?? 0;
        if (item.qty > available) {
          alert(`Insufficient Godown stock for "${inv.medicine_name}". Available: ${available}, Requested: ${item.qty}`);
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
  const filteredInventory = inventory.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (item.medicine_name || "").toLowerCase().includes(q);
      const matchCode = (item.item_code || "").toLowerCase().includes(q);
      const matchCat = (item.category || "").toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchCat) return false;
    }
    return true;
  });

  // Filtered parties list
  const filteredParties = parties.filter((p) => {
    if (selectedCityFilter !== "all" && (p.city || "").toLowerCase() !== selectedCityFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (p.name || "").toLowerCase().includes(q) || (p.city || "").toLowerCase().includes(q);
    }
    return true;
  });

  const uniqueCities = Array.from(new Set(parties.map((p) => p.city).filter(Boolean)));

  const totalGodownValuation = inventory.reduce(
    (sum, i) => sum + (i.warehouse_stock ?? 0) * (i.cost_price_per_box || i.purchase_price || 0),
    0
  );
  const totalWholesaleB2BVolume = b2bSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
  const totalPartyReceivables = parties.reduce((sum, p) => sum + (Number(p.balance_due) || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn pb-24">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-teal-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-sm">
              <span className="material-symbols-outlined text-2xl">warehouse</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold font-headline text-gray-900">
                Central Warehouse &amp; Wholesale Distribution
              </h1>
              <p className="text-xs text-gray-500">
                Interior Sindh Bulk Supply, Godown Stock, Bilty/Transport &amp; 2-Way Store Transfers
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Active Godown Incharge Pill */}
          <div className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-2xl shadow-xs">
            <span className="material-symbols-outlined text-teal-700 text-sm">badge</span>
            <span className="text-[11px] font-bold text-teal-900">Incharge:</span>
            <select
              value={activeGodownOperator.id}
              onChange={(e) => {
                const found = availableGodownOperators.find((op) => op.id === e.target.value);
                if (found) {
                  setActiveGodownOperator(found);
                  try { localStorage.setItem("cf_warehouse_active_operator", JSON.stringify(found)); } catch {}
                }
              }}
              className="bg-white text-teal-950 font-black text-xs px-2 py-1 rounded-xl border border-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              {availableGodownOperators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name} ({op.role})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setLedgerInitialItem(null);
              setShowStockLedgerModal(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-purple-900/20 transition-all active:scale-95"
            title="Open DrCreate 4-Level Stock Ledger (Category -> SKU -> Timeline -> Vouchers)"
          >
            <span className="material-symbols-outlined text-base">menu_book</span>
            Stock Ledger
          </button>

          <button
            type="button"
            onClick={handleOpenAccountForm}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-md transition-all ${
              showAccountForm
                ? "bg-emerald-800 text-white shadow-emerald-900/20 ring-2 ring-emerald-400"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
            }`}
            title="DrCreate & MS Access Style Account Registration"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            {showAccountForm ? "Close Account Form" : "Account Registration"}
          </button>


          <button
            type="button"
            onClick={() => setShowSaleInvoiceModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 transition-all active:scale-95"
            title="Open DrCreate & MS Access Style Sale Invoice (Form & History List)"
          >
            <span className="material-symbols-outlined text-base">point_of_sale</span>
            Sale Invoice (DrCreate)
          </button>

          <button
            onClick={() => {
              setTransferDirection("to_store");
              handleTabChange("transfer");
            }}
            className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-teal-600/20 transition-all"
          >
            <span className="material-symbols-outlined text-base">sync_alt</span>
            Two-Way Stock Transfer
          </button>

          
          <button
            onClick={() => handleTabChange("b2b")}
            className="px-4 py-2.5 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-teal-900/20 transition-all"
          >
            <span className="material-symbols-outlined text-base">local_shipping</span>
            New Wholesale B2B Invoice
          </button>
        </div>
      </div>

      {/* DrCreate / MS Access Style ACCOUNT REGISTRATION _FORM */}
      {showAccountForm && (
        <div className="bg-gradient-to-r from-emerald-850 via-teal-900 to-emerald-950 p-1 rounded-3xl shadow-xl animate-fadeIn">
          <div className="bg-white rounded-[22px] p-5 sm:p-7 border border-emerald-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-inner">
                  <span className="material-symbols-outlined text-xl">contact_page</span>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold font-headline text-emerald-950 flex items-center gap-2">
                    ACCOUNT REGISTRATION _FORM
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider font-semibold">DrCreate Flow</span>
                  </h2>
                  <p className="text-xs text-gray-500">
                    Register Wholesale Parties, Pharma Suppliers, Sales Representatives &amp; Ledgers
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowChartOfAccountsModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1.5 border border-teal-200 transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">folder_open</span>
                  Show List (Chart of Accounts)
                </button>
                <button
                  type="button"
                  onClick={() => setShowAccountForm(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            {/* Active Edit Mode Banner */}
            {editingAccountId && (
              <div className="mt-4 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <span className="material-symbols-outlined text-amber-600 text-base">edit_note</span>
                  <span>Editing Mode: Account #{accountForm.account_no} — <span className="underline font-black">{accountForm.account_name}</span></span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs font-bold text-amber-700 hover:text-amber-950 underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                  Cancel Edit (Switch to New)
                </button>
              </div>
            )}

            <form onSubmit={handleSaveAccount} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Account Name */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Account Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={accountNameRef}
                    type="text"
                    required
                    placeholder="e.g. krish, Affan Bilal H/S (HYD), BM Pvt LTD"
                    value={accountForm.account_name}
                    onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-400"
                  />
                </div>

                {/* Account No */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Account No <span className="text-[10px] text-gray-400 font-normal">(Auto Generated)</span>
                  </label>
                  <input
                    type="number"
                    value={accountForm.account_no}
                    onChange={(e) => setAccountForm({ ...accountForm, account_no: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 text-xs font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                {/* Account Type (Territories / Supplier / Heads) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Account Type / Territory Route <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={accountForm.account_type}
                    onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                  >
                    {SINDH_ACCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Opening Balance */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Oppening Balance (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={accountForm.opening_balance}
                    onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={accountForm.date}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-mono text-gray-600 outline-none"
                  />
                </div>

                {/* Naration */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Naration / Address / Phone Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Near Lajpat Chowk, Contact: 0300-1234567, Salesman: C/O Waheed Bhai"
                    value={accountForm.naration}
                    onChange={(e) => setAccountForm({ ...accountForm, naration: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-gray-100">
                {editingAccountId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">undo</span>
                    Cancel Edit
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowChartOfAccountsModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold flex items-center gap-2 transition-all"
                >
                  <span className="material-symbols-outlined text-base text-gray-600">view_list</span>
                  Show List
                </button>

                <button
                  type="submit"
                  className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 ${
                    editingAccountId
                      ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {editingAccountId ? "save" : "check_circle"}
                  </span>
                  {editingAccountId ? "Update Account" : "Submit (Save & Next)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



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
          onClick={() => handleTabChange("b2b")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "b2b"
              ? "bg-white text-teal-900 shadow-sm border border-teal-200"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <span className="material-symbols-outlined text-sm text-teal-600">local_shipping</span>
          Interior Sindh Wholesale Invoice
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
                          {formatPKR(item.cost_price_per_box || item.purchase_price || 0)}
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
      {/* TAB 2: INTERIOR SINDH WHOLESALE B2B INVOICE                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "b2b" && (
        <div className="bg-white p-6 rounded-3xl border border-teal-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold font-headline text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">local_shipping</span>
                Generate Wholesale B2B Supply Invoice (Interior Sindh)
              </h2>
              <p className="text-xs text-gray-500">
                Bulk medicine supply to registered stores, clinics &amp; doctors across Sindh
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
              Deducts from Main Godown
            </span>
          </div>

          <form onSubmit={handleExecuteB2BSale} className="space-y-6">
            
            {/* Row 1: Party Code Auto-Fill & Search */}
            <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-200/80 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-teal-700">badge</span>
                  1. Enter Party Code or Select Registered Sindh Party (Auto-Fills Details):
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddPartyModal(true)}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-white px-2.5 py-1 rounded-lg border border-teal-200 shadow-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">add_circle</span>
                  + Register New Party
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Party Code / Quick Search:
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">tag</span>
                    <input
                      type="text"
                      placeholder="e.g. 001, 1044, Muslim, Larkana..."
                      value={partySearchCode}
                      onChange={(e) => handlePartyCodeInput(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-8">
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Or Select from Sindh Parties Directory ({parties.length}):
                  </label>
                  <select
                    value={selectedPartyId}
                    onChange={(e) => handlePartySelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-semibold focus:outline-none focus:border-teal-600"
                  >
                    <option value="">-- Choose from Registered Directory --</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.party_code ? `[Code: ${p.party_code}] ` : `[${p.id}] `}{p.name} ({p.city}) — Udhaar: {formatPKR(p.balance_due || 0)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Selected Party Details Card */}
              {selectedPartyId && (() => {
                const activeP = parties.find((p) => p.id === selectedPartyId);
                if (!activeP) return null;
                return (
                  <div className="p-3 bg-white rounded-xl border border-teal-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white font-mono font-bold text-[10px]">
                        CODE: {activeP.party_code || activeP.id}
                      </span>
                      <span className="font-bold text-gray-900">{activeP.name}</span>
                      <span className="text-gray-500">📍 {activeP.city}</span>
                      {activeP.phone && <span className="text-gray-500">📞 {activeP.phone}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 uppercase block font-semibold">Current Udhaar:</span>
                        <span className="font-mono font-black text-amber-700">{formatPKR(activeP.balance_due || 0)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 uppercase block font-semibold">Credit Limit:</span>
                        <span className="font-mono font-bold text-gray-700">{formatPKR(activeP.credit_limit || 80000)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Row 2: Buyer Name, City & Territory */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Party Name / Buyer:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Muslim Homoeopathic Store"
                  value={b2bBuyerName}
                  onChange={(e) => setB2bBuyerName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs font-semibold focus:outline-none focus:border-teal-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Territory / City:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Larkana / Tando Allahyar / Sanghar"
                  value={b2bCity}
                  onChange={(e) => setB2bCity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Contact Phone:
                </label>
                <input
                  type="text"
                  placeholder="0300-1234567"
                  value={b2bBuyerPhone}
                  onChange={(e) => setB2bBuyerPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            {/* Row 3: Salesman, Bilty & Transport */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Assigned Salesman:
                </label>
                <select
                  value={selectedSalesman}
                  onChange={(e) => setSelectedSalesman(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs font-semibold focus:outline-none focus:border-teal-600"
                >
                  {salesmen.map((sm) => (
                    <option key={sm.id} value={sm.name}>
                      {sm.name} ({sm.territory})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Bilty Number:
                </label>
                <input
                  type="text"
                  placeholder="e.g. BL-9841 (Optional)"
                  value={biltyNo}
                  onChange={(e) => setBiltyNo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs font-mono focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Transport / Cargo Service:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Al-Madina Goods / Niazi Express"
                  value={transportName}
                  onChange={(e) => setTransportName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            {/* Row 4: Company / Brand Filter Bar */}
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-700 text-sm">factory</span>
                <span className="text-xs font-bold text-gray-800">
                  2. Filter Medicines by Manufacturing Company:
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: "all", label: "All Companies" },
                  ...Array.from(new Set(inventory.map((i) => i.company_name).filter(Boolean))).map((name) => ({
                    id: name,
                    label: name,
                  })),
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setB2bCompanyFilter(c.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                      b2bCompanyFilter === c.id
                        ? "bg-teal-700 text-white shadow-xs"
                        : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Item Rows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  3. Medicines to Supply ({inventory.filter((i) => b2bCompanyFilter === "all" || (i.company_name || "").toLowerCase() === b2bCompanyFilter.toLowerCase()).length} available in {b2bCompanyFilter === "all" ? "All Brands" : b2bCompanyFilter}):
                </h3>
                <button
                  type="button"
                  onClick={handleAddB2BItemRow}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-bold text-xs flex items-center gap-1 hover:bg-teal-100 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  + Add Another Item
                </button>
              </div>

              <div className="space-y-2">
                {b2bItems.map((item, idx) => {
                  const companyFilteredList = b2bCompanyFilter === "all"
                    ? inventory
                    : inventory.filter((i) => (i.company_name || "").toLowerCase() === b2bCompanyFilter.toLowerCase());

                  return (
                    <div key={idx} className="p-3 rounded-2xl bg-gray-50 border border-gray-200 flex flex-wrap items-center gap-2.5">
                      <div className="flex-1 min-w-[220px]">
                        <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Medicine &amp; Company:</label>
                        <select
                          value={item.inventory_id}
                          onChange={(e) => handleB2BItemSelect(idx, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-semibold focus:outline-none focus:border-teal-600"
                          required
                        >
                          <option value="">-- Select Medicine [{b2bCompanyFilter === 'all' ? 'All Brands' : b2bCompanyFilter}] --</option>
                          {companyFilteredList.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              [{inv.company_name || "BM Pvt LTD"}] {inv.medicine_name} ({inv.item_code || "GEN"}) [Godown: {inv.warehouse_stock ?? 0}] — Rs. {inv.box_sale_price || inv.sale_price}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-20">
                        <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Qty:</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.qty}
                          onChange={(e) => handleB2BItemChange(idx, "qty", e.target.value)}
                          className="w-full px-2.5 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-center focus:outline-none focus:border-teal-600"
                          required
                        />
                      </div>

                      <div className="w-24">
                        <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Rate (Rs):</label>
                        <input
                          type="number"
                          placeholder="Rate"
                          value={item.unit_price}
                          onChange={(e) => handleB2BItemChange(idx, "unit_price", e.target.value)}
                          className="w-full px-2.5 py-2 rounded-xl border border-gray-300 bg-white text-xs font-mono text-right focus:outline-none focus:border-teal-600"
                          required
                        />
                      </div>

                      <div className="w-20">
                        <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Disc %:</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0%"
                          value={item.disc_pct || ""}
                          onChange={(e) => handleB2BItemChange(idx, "disc_pct", e.target.value)}
                          className="w-full px-2.5 py-2 rounded-xl border border-gray-300 bg-white text-xs font-mono text-center focus:outline-none focus:border-teal-600"
                        />
                      </div>

                      <div className="w-20">
                        <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Disc Rs:</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={item.disc_flat || ""}
                          onChange={(e) => handleB2BItemChange(idx, "disc_flat", e.target.value)}
                          className="w-full px-2.5 py-2 rounded-xl border border-gray-300 bg-white text-xs font-mono text-center focus:outline-none focus:border-teal-600"
                        />
                      </div>

                    <div className="w-24 text-right">
                      <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Net Total:</label>
                      <div className="font-mono font-black text-gray-900 text-xs py-2">
                        {formatPKR(item.line_total)}
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveB2BItemRow(idx)}
                        className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition-colors"
                        title="Remove Row"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            {/* Row 4: Overall Bill Discount & Payment Settlement */}
            <div className="space-y-4 pt-2">
              {/* Overall Bill Discount Card */}
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-700 text-base">percent</span>
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">
                      4. Overall Bill / Trade Discount (Optional):
                    </span>
                    <span className="text-[10px] text-gray-500">
                      Apply special negotiated trade discount on the entire invoice subtotal
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-amber-300">
                    <label className="text-[11px] font-bold text-gray-600">Bill Disc %:</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0%"
                      value={b2bOverallDiscPct}
                      onChange={(e) => setB2bOverallDiscPct(e.target.value)}
                      className="w-16 text-xs font-mono font-bold text-center focus:outline-none text-amber-900"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-amber-300">
                    <label className="text-[11px] font-bold text-gray-600">Flat Disc Rs:</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={b2bOverallDiscFlat}
                      onChange={(e) => setB2bOverallDiscFlat(e.target.value)}
                      className="w-24 text-xs font-mono font-bold text-right focus:outline-none text-amber-900"
                    />
                  </div>

                  {calculateB2BOverallDiscount() > 0 && (
                    <div className="px-3 py-1 bg-amber-100 text-amber-900 rounded-lg text-xs font-bold font-mono">
                      - {formatPKR(calculateB2BOverallDiscount())} OFF
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Settlement & Submission Box */}
              <div className="p-5 rounded-3xl bg-teal-50 border border-teal-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-teal-200/60 pb-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                      Payment Mode:
                    </span>
                    <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-gray-800 bg-white px-3 py-1.5 rounded-xl border border-teal-200 shadow-xs">
                      <input
                        type="radio"
                        name="payType"
                        checked={b2bPaymentType === "credit"}
                        onChange={() => setB2bPaymentType("credit")}
                      />
                      <span>Party Udhaar (Credit)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-gray-800 bg-white px-3 py-1.5 rounded-xl border border-teal-200 shadow-xs">
                      <input
                        type="radio"
                        name="payType"
                        checked={b2bPaymentType === "cash"}
                        onChange={() => setB2bPaymentType("cash")}
                      />
                      <span>Full Cash In Hand</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-gray-800 bg-white px-3 py-1.5 rounded-xl border border-teal-200 shadow-xs">
                      <input
                        type="radio"
                        name="payType"
                        checked={b2bPaymentType === "cheque"}
                        onChange={() => setB2bPaymentType("cheque")}
                      />
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-teal-700">account_balance</span>
                        Cheque / Bank Transfer
                      </span>
                    </label>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="flex items-center gap-4 text-xs font-semibold text-gray-700">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase block">Items Subtotal:</span>
                      <span className="font-mono">{formatPKR(calculateB2BItemsSubtotal())}</span>
                    </div>
                    {calculateB2BOverallDiscount() > 0 && (
                      <div className="text-amber-700">
                        <span className="text-[10px] uppercase block">Bill Discount:</span>
                        <span className="font-mono">- {formatPKR(calculateB2BOverallDiscount())}</span>
                      </div>
                    )}
                    <div className="text-right">
                      <span className="text-[10px] text-teal-800 font-bold uppercase block">Final Net Total:</span>
                      <span className="text-2xl font-black text-teal-950 font-mono">
                        {formatPKR(calculateB2BFinalTotal())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conditional Payment Inputs */}
                {b2bPaymentType === "credit" && (
                  <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3.5 rounded-2xl border border-teal-200">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-gray-700">Partial Cash Received Now:</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={b2bPaidAmount}
                        onChange={(e) => setB2bPaidAmount(e.target.value)}
                        className="w-32 px-3 py-1.5 rounded-xl border border-teal-300 bg-gray-50 focus:bg-white text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      Remaining Udhaar to add in Ledger:{" "}
                      <strong className="text-amber-700 font-mono">
                        {formatPKR(Math.max(0, calculateB2BFinalTotal() - (Number(b2bPaidAmount) || 0)))}
                      </strong>
                    </div>
                  </div>
                )}

                {b2bPaymentType === "cheque" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-2xl border border-teal-200 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                        Cheque # / Instrument Ref *:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CHK-984210 / Online Ref"
                        value={b2bChequeNo}
                        onChange={(e) => setB2bChequeNo(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 font-mono font-bold"
                        required={b2bPaymentType === "cheque"}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                        Bank Name:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Habib Bank / Meezan Bank"
                        value={b2bBankName}
                        onChange={(e) => setB2bBankName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                        Cheque / Deposit Date:
                      </label>
                      <input
                        type="date"
                        value={b2bChequeDate}
                        onChange={(e) => setB2bChequeDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                        Cheque Amount (Rs):
                      </label>
                      <input
                        type="number"
                        placeholder={calculateB2BFinalTotal().toString()}
                        value={b2bChequeAmount || calculateB2BFinalTotal()}
                        onChange={(e) => setB2bChequeAmount(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-teal-300 bg-teal-50 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                        Cheque Clearance Status:
                      </label>
                      <select
                        value={b2bChequeStatus}
                        onChange={(e) => setB2bChequeStatus(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 font-bold text-teal-800 bg-white"
                      >
                        <option value="cleared">Cleared / In Hand</option>
                        <option value="pending">Pending Clearing</option>
                        <option value="post_dated">Post Dated Cheque (PDC)</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-teal-600 text-sm">verified_user</span>
                    <span>All item quantities will be automatically deducted from <b>Main Godown Stock</b>.</span>
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-lg shadow-teal-600/20 transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">print</span>
                    Issue Wholesale Invoice &amp; Deduct Godown Stock
                  </button>
                </div>
              </div>
            </div>

          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: TWO-WAY STOCK TRANSFERS (GODOWN <-> STORE)                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "transfer" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-teal-100 shadow-sm space-y-6">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold font-headline text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-600">sync_alt</span>
                  Execute Two-Way Internal Stock Shift
                </h2>
                <p className="text-xs text-gray-500">
                  Move medicines between Main Warehouse (Godown) and Front Medical Store (POS Counter)
                </p>
              </div>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              
              {/* Transfer Direction Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTransferDirection("to_store")}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    transferDirection === "to_store"
                      ? "bg-teal-50 border-teal-500 text-teal-900 shadow-sm"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-teal-800">
                    <span className="material-symbols-outlined text-teal-600">arrow_forward</span>
                    Godown ➔ Medical Store (Replenishment)
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Deducts Godown stock and adds to Front Counter POS</p>
                </button>

                <button
                  type="button"
                  onClick={() => setTransferDirection("to_warehouse")}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    transferDirection === "to_warehouse"
                      ? "bg-teal-50 border-teal-500 text-teal-900 shadow-sm"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-teal-800">
                    <span className="material-symbols-outlined text-teal-600">arrow_forward</span>
                    Medical Store ➔ Godown (Stock Return)
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Returns excess/slow counter stock back to Godown</p>
                </button>
              </div>

              {/* Medicine & Quantity Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Select Medicine Item:
                  </label>
                  <select
                    value={selectedInvForTransfer}
                    onChange={(e) => setSelectedInvForTransfer(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs font-semibold focus:outline-none focus:border-teal-600"
                    required
                  >
                    <option value="">-- Choose Medicine --</option>
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.medicine_name} — [Godown: {inv.warehouse_stock ?? 0} Packs | Counter: {inv.store_stock ?? 0} Units]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Quantity to Transfer:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={transferQty}
                    onChange={(e) => setTransferQty(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs font-bold text-center focus:outline-none focus:border-teal-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-teal-600">person</span>
                    Shifted / Carried By (Staff Person Name):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Usama / Bilal / Ali"
                    value={transferredBy}
                    onChange={(e) => setTransferredBy(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs font-semibold focus:outline-none focus:border-teal-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Transfer Reason / Notes:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Front store daily refill / Counter replenishment"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-xs focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                Confirm &amp; Record Internal Stock Transfer
              </button>

            </form>
          </div>

          {/* Transfers History Log */}
          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-xs text-gray-800 uppercase tracking-wider">
              Recent Internal Stock Shifts Log
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                    <th className="py-3 px-4">Transfer #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Medicine</th>
                    <th className="py-3 px-4">From ➔ To</th>
                    <th className="py-3 px-4 text-center">Quantity</th>
                    <th className="py-3 px-4">Shifted By (Handler)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {transfers.map((trf) => (
                    <tr key={trf.id} className="hover:bg-teal-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-teal-900">{trf.transfer_no}</td>
                      <td className="py-3 px-4 text-gray-500 font-mono">{formatDate(trf.transfer_date)}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">{trf.medicine_name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          {trf.from_loc} ➔ {trf.to_loc}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-teal-800">{trf.qty}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-lg text-xs">
                          <span className="material-symbols-outlined text-xs text-teal-600">person</span>
                          {trf.transferred_by || "Staff"}
                        </span>
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
                        <button
                          onClick={() => {
                            setSelectedPartyId(p.id);
                            setB2bBuyerName(p.name);
                            setB2bBuyerPhone(p.phone || "");
                            setB2bCity(p.city || "Hyderabad");
                            handleTabChange("b2b");
                          }}
                          className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all shadow-sm"
                        >
                          Create B2B Invoice
                        </button>
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
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            className="bg-white max-w-md w-full rounded-3xl p-6 border border-gray-200 shadow-2xl space-y-4 animate-scaleUp"
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
          >
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>warehouse</span>
                {editingGodown ? `Edit: ${editingGodown.name}` : "Add New Godown"}
              </h3>
              <button type="button" onClick={() => setShowGodownModal(false)} className="text-gray-400 hover:text-gray-700">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
              <div className="col-span-2">
                <label className="block text-gray-600 mb-1">Godown Name *</label>
                <input type="text" required value={godownForm.name} onChange={(e) => setGodownForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Main Godown (Lajpat Road)" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold" />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Short Code</label>
                <input type="text" value={godownForm.code} onChange={(e) => setGodownForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. GDW-03" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono" />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Status</label>
                <select value={godownForm.status} onChange={(e) => setGodownForm((f) => ({ ...f, status: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-gray-600 mb-1">Location / Address</label>
                <input type="text" value={godownForm.location} onChange={(e) => setGodownForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Site Area, Near Bus Stop, Hyderabad" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Incharge Name</label>
                <input type="text" value={godownForm.incharge_name} onChange={(e) => setGodownForm((f) => ({ ...f, incharge_name: e.target.value }))} placeholder="e.g. Raza Ahmed" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Phone</label>
                <input type="text" value={godownForm.phone} onChange={(e) => setGodownForm((f) => ({ ...f, phone: e.target.value }))} placeholder="03001234567" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs" />
              </div>
              <div className="col-span-2">
                <label className="block text-gray-600 mb-1">Notes</label>
                <input type="text" value={godownForm.notes} onChange={(e) => setGodownForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes about this godown" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs" />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowGodownModal(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-xs">Cancel</button>
              <button type="submit" className="flex-1 bg-teal-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-teal-700 transition-colors">
                {editingGodown ? "Save Changes" : "Add Godown"}
              </button>
            </div>
          </form>
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
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <form
            onSubmit={handleSaveParty}
            className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scaleUp border border-gray-100"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-teal-800 font-bold text-base">
                <span className="material-symbols-outlined text-teal-600">add_business</span>
                Register New Wholesale Party / Account
              </div>
              <button
                type="button"
                onClick={() => setShowAddPartyModal(false)}
                className="text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Party Code:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1044"
                    value={newPartyForm.party_code}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, party_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 text-xs font-mono font-bold uppercase focus:outline-none focus:border-teal-600"
                  />
                  <span className="text-[9px] text-gray-400">Empty = Auto</span>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Party / Store Name: *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Al-Shifa Homeo Store"
                    value={newPartyForm.name}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 text-xs font-bold focus:outline-none focus:border-teal-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    City / Territory:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hyderabad"
                    value={newPartyForm.city}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 text-xs font-semibold focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Phone / Contact:
                  </label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={newPartyForm.phone}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 text-xs font-mono focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Address / Goods Transport:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Medical Market / Al-Madina Goods Bilty"
                  value={newPartyForm.address}
                  onChange={(e) => setNewPartyForm({ ...newPartyForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 text-xs focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Opening Udhaar Balance (Rs):
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newPartyForm.balance_due}
                  onChange={(e) => setNewPartyForm({ ...newPartyForm, balance_due: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 text-xs font-mono font-bold text-amber-700 focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddPartyModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                Save Party
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

    </div>
  );
}




