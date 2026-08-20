import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { dbInventory, dbStockTransfers, dbB2BSales, dbClinic, dbParties, dbSalesmen } from "../api/db.js";
import { printThermalReceipt } from "../utils/thermalPrinter.js";
import { formatPKR, formatDate } from "../utils/formatters.js";
import ProductMovementModal from "../components/ProductMovementModal.jsx";

export default function WarehouseManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [inventory, setInventory] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [b2bSales, setB2BSales] = useState([]);
  const [parties, setParties] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [activeTab, setActiveTab] = useState(urlTab && ["stock", "b2b", "transfer", "parties", "logs"].includes(urlTab) ? urlTab : "stock");

  useEffect(() => {
    if (urlTab && ["stock", "b2b", "transfer", "parties", "logs"].includes(urlTab)) {
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
    alert(`Party "${created.name}" registered successfully with Code #${created.party_code || created.id}!`);
    setShowAddPartyModal(false);
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
  };

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

        <div className="flex items-center gap-3">
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
                  { id: "BM Pvt LTD", label: "BM Pvt LTD" },
                  { id: "Paul Brooks Homoeo Lab", label: "Paul Brooks" },
                  { id: "MEKTUM Pvt Ltd", label: "MEKTUM" },
                  { id: "BLOSSOM Homoeo Pharma", label: "BLOSSOM" },
                  { id: "Schwabe / German", label: "Schwabe" },
                  { id: "Local Pharma Market", label: "Local Market" },
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

          {/* Add New Party Modal */}
          {showAddPartyModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveParty}
                className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-fadeIn"
              >
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2 text-teal-800 font-bold text-base">
                    <span className="material-symbols-outlined text-teal-600">add_business</span>
                    Register New Wholesale Party / Account
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddPartyModal(false)}
                    className="text-gray-400 hover:text-gray-600"
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
            </div>
          )}
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

    </div>
  );
}
