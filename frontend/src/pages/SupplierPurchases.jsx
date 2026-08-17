import { useState, useEffect } from "react";
import { dbSuppliers, dbPurchases, dbInventory, dbClinic, generateSequentialInvoiceNo } from "../api/db.js";
import { printSupplierPurchaseReceipt } from "../utils/thermalPrinter.js";

export default function SupplierPurchases() {
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [activeTab, setActiveTab] = useState("suppliers"); // "suppliers" | "bills" | "new_purchase"

  // Selected Supplier Drawer / Modal
  const [selectedSupplierDrawer, setSelectedSupplierDrawer] = useState(null);
  const [supplierDrawerSearch, setSupplierDrawerSearch] = useState("");

  // New Purchase Form
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [companyBillNoInput, setCompanyBillNoInput] = useState("");
  const [systemVoucherId, setSystemVoucherId] = useState(generateSequentialInvoiceNo("PUR"));
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [purchaseItems, setPurchaseItems] = useState([
    { inventory_id: "", medicine_name: "", category: "Tablet", strength: "500 mg", received_unit_type: "box", unit_label: "pack", batch_no: "", expiry_date: "", qty: 1, cost_price: "", sale_price: "" }
  ]);

  // View Invoice Detail Modal
  const [selectedInvoiceModal, setSelectedInvoiceModal] = useState(null);

  // New Supplier Modal
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupName, setNewSupName] = useState("");
  const [newSupContact, setNewSupContact] = useState("");
  const [newSupPhone, setNewSupPhone] = useState("");
  const [newSupAddress, setNewSupAddress] = useState("");

  // Payment Settlement Modal
  const [paySupplierModal, setPaySupplierModal] = useState(null);
  const [payAmountInput, setPayAmountInput] = useState("");

  // Global Bills Search
  const [globalBillsSearch, setGlobalBillsSearch] = useState("");

  const refreshData = () => {
    setSuppliers(dbSuppliers.getAll());
    setPurchases(dbPurchases.getAll());
    setInventoryList(dbInventory.getAll());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleAddItemRow = () => {
    setPurchaseItems([
      ...purchaseItems,
      { inventory_id: "", medicine_name: "", category: "Tablet", strength: "", received_unit_type: "box", unit_label: "pack", batch_no: "", expiry_date: "", qty: 1, cost_price: "", sale_price: "" }
    ]);
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
      return sum + q * c;
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
      invoice_no: systemVoucherId,
      company_bill_no: companyBillNoInput || "N/A",
      total_amount,
      paid_amount,
      items: validItems.map((i) => ({
        medicine_name: i.medicine_name,
        category: i.category || "Tablet",
        strength: i.strength || "",
        received_unit_type: i.received_unit_type || "box",
        unit_label: i.unit_label || "pack",
        strips_per_box: Number(i.strips_per_box) || 10,
        units_per_strip: Number(i.units_per_strip) || 10,
        batch_no: i.batch_no || `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
        expiry_date: i.expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0],
        qty: Number(i.qty) || 1,
        cost_price: Number(i.cost_price) || 0,
        sale_price: Number(i.sale_price) || 0,
        line_total: (Number(i.qty) || 1) * (Number(i.cost_price) || 0)
      }))
    });

    alert(`✅ Stock Entry Voucher #${newPur.invoice_no} saved successfully! Inventory & Supplier Ledger updated.`);
    
    // Auto print 80mm thermal voucher
    printSupplierPurchaseReceipt(newPur, supplier, dbClinic.get());

    // Reset Form
    setSystemVoucherId(generateSequentialInvoiceNo("PUR"));
    setCompanyBillNoInput("");
    setPaidAmountInput("");
    setPurchaseItems([{ inventory_id: "", medicine_name: "", category: "Tablet", strength: "", received_unit_type: "box", unit_label: "pack", batch_no: "", expiry_date: "", qty: 1, cost_price: "", sale_price: "" }]);
    setActiveTab("suppliers");
    refreshData();
  };

  const handleCreateSupplier = (e) => {
    e.preventDefault();
    if (!newSupName.trim()) return;
    dbSuppliers.add({
      name: newSupName,
      contact_person: newSupContact,
      phone: newSupPhone,
      address: newSupAddress,
    });
    setNewSupName("");
    setNewSupContact("");
    setNewSupPhone("");
    setNewSupAddress("");
    setShowAddSupplier(false);
    refreshData();
  };

  const handleSupplierPayment = (e) => {
    e.preventDefault();
    if (!paySupplierModal || !payAmountInput) return;
    dbSuppliers.recordPayment(paySupplierModal.id, Number(payAmountInput));
    alert(`Payment of Rs. ${Number(payAmountInput).toLocaleString()} recorded! Supplier Ledger & Expenses updated.`);
    setPaySupplierModal(null);
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
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
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
          onClick={() => setActiveTab("suppliers")}
          className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "suppliers" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-base">domain</span>
          Pharma Distributors Directory ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab("bills")}
          className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "bills" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-base">receipt_long</span>
          All Purchase Bills Audit Log ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab("new_purchase")}
          className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "new_purchase" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-base">add_shopping_cart</span>
          Receive New Stock Entry
        </button>
      </div>

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
                          <h3 className="font-bold text-gray-900 text-base leading-tight">
                            {sup.name}
                          </h3>
                          <div className="text-xs text-gray-500 font-medium mt-0.5">
                            👤 {sup.contact_person || "Sales Representative"}
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
                  <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedSupplierDrawer(sup);
                        setSupplierDrawerSearch("");
                      }}
                      className="flex-1 bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 py-2 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">receipt_long</span>
                      View Invoices ({supBills.length})
                    </button>
                    {balance > 0 && (
                      <button
                        onClick={() => {
                          setPaySupplierModal(sup);
                          setPayAmountInput(String(balance));
                        }}
                        className="bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-2 rounded-xl font-bold text-xs transition-colors"
                      >
                        Pay Cash
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Select Company / Distributor *</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 bg-white"
                required
              >
                <option value="">-- Choose Distributor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏢 {s.name} ({s.contact_person || "Rep"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">System Sequential Voucher #</label>
              <input
                type="text"
                value={systemVoucherId}
                readOnly
                className="w-full border border-teal-200 bg-teal-50/50 rounded-xl px-3 py-2 text-xs font-black text-teal-900"
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
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-gray-700 uppercase tracking-wider">Itemized Stock Entries</span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1 rounded-xl font-bold hover:bg-teal-100"
              >
                + Add Line Item
              </button>
            </div>

            {purchaseItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-200 items-center">
                <div className="col-span-12 md:col-span-4 space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">Medicine Item *</label>
                    {inventoryList.length > 0 && (
                      <span className="text-[10px] font-semibold text-teal-700">Auto-fill from Inventory</span>
                    )}
                  </div>
                  <select
                    value={item.inventory_id || ""}
                    onChange={(e) => handleSelectExistingMedicine(index, e.target.value)}
                    className="w-full border border-teal-200 bg-teal-50/40 rounded-lg px-2 py-1.5 text-xs font-bold text-teal-900 focus:ring-1 focus:ring-teal-500 mb-1"
                  >
                    <option value="">➕ Custom / New Medicine Entry</option>
                    {inventoryList.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        💊 {inv.medicine_name} ({inv.strength || inv.category}) — {inv.stock_qty} left
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
                    <option value="box">📦 Boxes / Packs</option>
                    <option value="strip">💊 Strips / Pattay</option>
                    <option value="unit">💊 Base Units / Tablets</option>
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
                    className="text-rose-500 hover:text-rose-700 p-1"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
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
                  className="border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-bold w-40"
                />
              </div>
            </div>
            <button
              type="submit"
              className="bg-teal-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20"
            >
              Save Stock Entry &amp; Print Voucher
            </button>
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
                  🏢 {selectedSupplierDrawer.name}
                </h2>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                  <span>👤 Rep: {selectedSupplierDrawer.contact_person || "N/A"}</span>
                  <span>•</span>
                  <span>📞 {selectedSupplierDrawer.phone || "N/A"}</span>
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

      {/* MODAL: Payment Settlement */}
      {paySupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSupplierPayment} className="bg-white max-w-sm w-full rounded-3xl p-6 border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-base">Record Supplier Cash Payment</h3>
            <p className="text-xs text-gray-500">Pay cash to <strong>{paySupplierModal.name}</strong></p>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Amount Paid Now (Rs) *</label>
              <input
                type="number"
                value={payAmountInput}
                onChange={(e) => setPayAmountInput(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold text-teal-800"
                required
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
                Save Payment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Add New Supplier */}
      {showAddSupplier && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateSupplier} className="bg-white max-w-md w-full rounded-3xl p-6 border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-base">Add New Pharma Supplier / Distributor</h3>
            
            <div className="space-y-3 text-xs font-semibold">
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
    </div>
  );
}
