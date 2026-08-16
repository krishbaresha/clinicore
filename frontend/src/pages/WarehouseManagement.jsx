import { useState, useEffect } from "react";
import { dbInventory, dbStockTransfers, dbB2BSales, dbClinic, dbSuppliers } from "../api/db.js";
import { printThermalReceipt } from "../utils/thermalPrinter.js";

export default function WarehouseManagement() {
  const [inventory, setInventory] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [b2bSales, setB2BSales] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [activeTab, setActiveTab] = useState("stock"); // "stock" | "transfer" | "b2b" | "logs"

  // Search Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Internal Transfer Form
  const [selectedInvForTransfer, setSelectedInvForTransfer] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [transferNotes, setTransferNotes] = useState("");

  // B2B Sale Form
  const [b2bBuyerName, setB2bBuyerName] = useState("");
  const [b2bBuyerPhone, setB2bBuyerPhone] = useState("");
  const [b2bPaymentType, setB2bPaymentType] = useState("cash"); // "cash" | "credit"
  const [b2bPaidAmount, setB2bPaidAmount] = useState("");
  const [b2bItems, setB2bItems] = useState([
    { inventory_id: "", medicine_name: "", qty: 1, unit_price: 0, line_total: 0 }
  ]);

  const refreshData = () => {
    setInventory(dbInventory.getAll());
    setTransfers(dbStockTransfers.getAll());
    setB2BSales(dbB2BSales.getAll());
    setSuppliers(dbSuppliers.getAll());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleSelectTransferItem = (invId) => {
    setSelectedInvForTransfer(invId);
  };

  const handleExecuteTransfer = (e) => {
    e.preventDefault();
    if (!selectedInvForTransfer) { alert("Please select a medicine item to transfer."); return; }
    const inv = inventory.find((i) => i.id === selectedInvForTransfer);
    if (!inv) return;

    const wStock = inv.warehouse_stock ?? inv.total_base_stock ?? inv.stock_qty ?? 0;
    const qty = Number(transferQty) || 1;
    if (qty > wStock) {
      alert(`⚠️ Cannot transfer ${qty} units! Main Warehouse only has ${wStock} units in stock.`);
      return;
    }

    dbStockTransfers.transfer({
      inventory_id: inv.id,
      medicine_name: inv.medicine_name,
      qty,
      from_loc: "Main Warehouse (Godown)",
      to_loc: "Medical Store Counter (POS)",
      notes: transferNotes || "Internal Stock Replenishment",
      transferred_by: "Store Pharmacist"
    });

    alert(`✅ Successfully transferred ${qty} units of ${inv.medicine_name} to Front Counter Store!`);
    setSelectedInvForTransfer("");
    setTransferQty(1);
    setTransferNotes("");
    refreshData();
  };

  const handleAddB2BItemRow = () => {
    setB2bItems([
      ...b2bItems,
      { inventory_id: "", medicine_name: "", qty: 1, unit_price: 0, line_total: 0 }
    ]);
  };

  const handleB2BItemSelect = (index, invId) => {
    const inv = inventory.find((i) => i.id === invId);
    if (!inv) return;
    const updated = [...b2bItems];
    const price = inv.box_sale_price || inv.unit_sale_price || 0;
    updated[index] = {
      ...updated[index],
      inventory_id: inv.id,
      medicine_name: inv.medicine_name,
      unit_label: inv.box_label || inv.unit_label || "pack",
      unit_price: price,
      line_total: (updated[index].qty || 1) * price
    };
    setB2bItems(updated);
  };

  const handleB2BItemChange = (index, field, val) => {
    const updated = [...b2bItems];
    updated[index][field] = val;
    if (field === "qty" || field === "unit_price") {
      const q = Number(field === "qty" ? val : updated[index].qty) || 0;
      const p = Number(field === "unit_price" ? val : updated[index].unit_price) || 0;
      updated[index].line_total = q * p;
    }
    setB2bItems(updated);
  };

  const calculateB2BSubtotal = () => {
    return b2bItems.reduce((sum, i) => sum + (Number(i.line_total) || 0), 0);
  };

  const handleExecuteB2BSale = (e) => {
    e.preventDefault();
    if (!b2bBuyerName.trim()) { alert("Please enter Buyer / Clinic Name."); return; }
    const validItems = b2bItems.filter((i) => i.medicine_name.trim() !== "");
    if (validItems.length === 0) { alert("Please add at least 1 medicine item for wholesale sale."); return; }

    const subtotal = calculateB2BSubtotal();
    const paid = b2bPaymentType === "cash" ? subtotal : Number(b2bPaidAmount) || 0;
    const balance = Math.max(0, subtotal - paid);

    const sale = dbB2BSales.checkout({
      buyer_name: b2bBuyerName,
      buyer_phone: b2bBuyerPhone,
      items: validItems,
      total_amount: subtotal,
      paid_amount: paid,
      balance_due: balance,
      payment_type: b2bPaymentType,
      user_name: "Warehouse Manager"
    });

    alert(`✅ Wholesale B2B Invoice #${sale.invoice_no} created successfully! Stock deducted from Main Warehouse.`);
    
    // Print 80mm B2B Voucher
    printThermalReceipt({
      id: sale.invoice_no,
      sale_date: sale.sale_date,
      patient_name: `[Wholesale B2B] ${b2bBuyerName}`,
      payment_type: b2bPaymentType,
      items: validItems,
      subtotal_amount: subtotal,
      total_amount: subtotal,
      cash_tendered: paid,
      change_due: 0,
      cashier_name: "Warehouse Manager"
    }, dbClinic.get());

    setB2bBuyerName("");
    setB2bBuyerPhone("");
    setB2bPaidAmount("");
    setB2bItems([{ inventory_id: "", medicine_name: "", qty: 1, unit_price: 0, line_total: 0 }]);
    refreshData();
  };

  const filteredInventory = searchQuery.trim() === ""
    ? inventory
    : inventory.filter((i) =>
        (i.medicine_name || "").toLowerCase().includes(searchQuery.toLowerCase())
      );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-teal-950 text-white p-5 rounded-3xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-300">warehouse</span>
            Central Warehouse &amp; Distribution Center
          </h1>
          <p className="text-xs text-teal-100/80 mt-1">
            2-Tier Inventory Management: Main Godown Stock, Internal Counter Transfers &amp; Wholesale B2B Sales
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshData}
            className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("stock")}
          className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "stock" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-base">inventory_2</span>
          Warehouse Stock Ledger ({inventory.length})
        </button>
        <button
          onClick={() => setActiveTab("transfer")}
          className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "transfer" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-base">sync_alt</span>
          🔄 Internal Stock Transfer (Warehouse ➔ Store)
        </button>
        <button
          onClick={() => setActiveTab("b2b")}
          className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "b2b" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-base">storefront</span>
          💼 Wholesale B2B Sales (Warehouse ➔ Chemists)
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`pb-3 px-4 font-bold text-xs transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "logs" ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="material-symbols-outlined text-base">history</span>
          Transfers &amp; Wholesale Audit Logs
        </button>
      </div>

      {/* TAB 1: Warehouse Stock Ledger */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <input
              type="text"
              placeholder="Search medicine in Warehouse / Store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-semibold w-full sm:w-72 shadow-sm"
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-teal-50 text-teal-900 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Medicine Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center bg-teal-100/50">🏢 Main Warehouse (Godown)</th>
                  <th className="px-4 py-3 text-center bg-amber-50">🏪 Counter Store (POS)</th>
                  <th className="px-4 py-3 text-center font-black">Total Combined Stock</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-400">
                      No stock items found in inventory.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => {
                    const wStock = item.warehouse_stock ?? item.total_base_stock ?? item.stock_qty ?? 0;
                    const sStock = item.store_stock ?? item.stock_qty ?? 0;
                    const totStock = wStock + sStock;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-900 font-bold">
                          {item.medicine_name} <span className="text-gray-400 text-[11px] font-normal">({item.strength})</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{item.category}</td>
                        <td className="px-4 py-3 text-center font-bold text-teal-800 bg-teal-50/30">
                          {wStock} {item.unit_label || "units"}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-amber-900 bg-amber-50/30">
                          {sStock} {item.unit_label || "units"}
                        </td>
                        <td className="px-4 py-3 text-center font-black text-gray-900">
                          {totStock} {item.unit_label || "units"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              setSelectedInvForTransfer(item.id);
                              setActiveTab("transfer");
                            }}
                            className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 px-3 py-1 rounded-xl font-bold text-[11px] transition-colors"
                          >
                            Transfer to Store
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Internal Stock Transfer */}
      {activeTab === "transfer" && (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm max-w-2xl mx-auto space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600">sync_alt</span>
              Internal Stock Movement (Warehouse ➔ Front Counter)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Shift bulk medicine stock from Central Godown to Medical Store POS Counter
            </p>
          </div>

          <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs font-semibold">
            <div>
              <label className="block text-gray-600 mb-1">Select Medicine from Warehouse *</label>
              <select
                value={selectedInvForTransfer}
                onChange={(e) => handleSelectTransferItem(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-800"
                required
              >
                <option value="">-- Choose Stock Item --</option>
                {inventory.map((inv) => {
                  const wStock = inv.warehouse_stock ?? inv.total_base_stock ?? inv.stock_qty ?? 0;
                  return (
                    <option key={inv.id} value={inv.id}>
                      💊 {inv.medicine_name} ({inv.strength}) — Godown Stock: {wStock} {inv.unit_label || "units"}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-600 mb-1">Quantity to Shift (Base Units) *</label>
                <input
                  type="number"
                  min="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-center"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Transfer Note / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Counter Low Stock Request"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl hover:bg-teal-700 transition-colors shadow-md shadow-teal-200 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">forward</span>
              Execute Internal Transfer Now
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Wholesale B2B Sales */}
      {activeTab === "b2b" && (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600">storefront</span>
              Wholesale B2B Sale (Main Warehouse ➔ External Buyers)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Sell bulk stock directly from Godown to neighboring chemists, clinics, or sub-pharmacies (Cash or Credit Udhaar)
            </p>
          </div>

          <form onSubmit={handleExecuteB2BSale} className="space-y-5 text-xs font-semibold">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-600 mb-1">Buyer / Chemist Clinic Name *</label>
                <input
                  type="text"
                  placeholder="e.g. City Pharmacy / Dr. Tariq Clinic"
                  value={b2bBuyerName}
                  onChange={(e) => setB2bBuyerName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Buyer Phone Number</label>
                <input
                  type="text"
                  placeholder="03001234567"
                  value={b2bBuyerPhone}
                  onChange={(e) => setB2bBuyerPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Payment Mode *</label>
                <select
                  value={b2bPaymentType}
                  onChange={(e) => setB2bPaymentType(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold bg-gray-50"
                >
                  <option value="cash">💵 Immediate Cash Payment</option>
                  <option value="credit">📑 Credit Sale (Added to Udhaar Khata)</option>
                </select>
              </div>
            </div>

            {/* Wholesale Itemized Entry Rows */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Wholesale Line Items</span>
                <button
                  type="button"
                  onClick={handleAddB2BItemRow}
                  className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1 rounded-xl font-bold hover:bg-teal-100"
                >
                  + Add Item Line
                </button>
              </div>

              {b2bItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-200 items-center">
                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-[10px] text-gray-500 uppercase font-bold">Select Godown Item *</label>
                    <select
                      value={item.inventory_id}
                      onChange={(e) => handleB2BItemSelect(index, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold bg-white"
                      required
                    >
                      <option value="">-- Choose Stock Item --</option>
                      {inventory.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          💊 {inv.medicine_name} — Godown Stock: {inv.warehouse_stock ?? inv.stock_qty}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className="block text-[10px] text-gray-500 uppercase font-bold text-center">Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => handleB2BItemChange(index, "qty", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold text-center bg-white"
                      required
                    />
                  </div>
                  <div className="col-span-4 md:col-span-3">
                    <label className="block text-[10px] text-gray-500 uppercase font-bold">Wholesale Price (Rs)</label>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleB2BItemChange(index, "unit_price", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold bg-white"
                      required
                    />
                  </div>
                  <div className="col-span-4 md:col-span-3 text-right">
                    <label className="block text-[10px] text-gray-500 uppercase font-bold">Line Total</label>
                    <div className="text-sm font-black text-gray-900 pt-1">
                      Rs. {(Number(item.line_total) || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bill Summary */}
            <div className="border-t border-gray-200 pt-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <div className="text-xs text-gray-500 font-medium">Calculated Wholesale Bill Total:</div>
                <div className="text-2xl font-black text-teal-800">Rs. {calculateB2BSubtotal().toLocaleString()}</div>
              </div>
              <button
                type="submit"
                className="bg-teal-700 text-white px-8 py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors shadow-md shadow-teal-300"
              >
                Complete Wholesale Sale &amp; Print Voucher
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 text-sm mb-3">🔄 Internal Stock Transfers Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase">
                  <tr>
                    <th className="px-3 py-2">Transfer #</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Item Name</th>
                    <th className="px-3 py-2 text-center">Qty Shifted</th>
                    <th className="px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transfers.length === 0 ? (
                    <tr><td colSpan="5" className="py-4 text-center text-gray-400">No transfers recorded yet.</td></tr>
                  ) : (
                    transfers.map((t) => (
                      <tr key={t.id}>
                        <td className="px-3 py-2 font-bold text-teal-700">{t.transfer_no || t.id}</td>
                        <td className="px-3 py-2">{new Date(t.transfer_date).toLocaleDateString("en-PK")}</td>
                        <td className="px-3 py-2 font-bold text-gray-900">{t.medicine_name}</td>
                        <td className="px-3 py-2 text-center font-black text-gray-900">{t.qty} units</td>
                        <td className="px-3 py-2 text-gray-500">{t.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 text-sm mb-3">💼 Wholesale B2B Sales Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase">
                  <tr>
                    <th className="px-3 py-2">Invoice #</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Buyer Name</th>
                    <th className="px-3 py-2 text-right">Total Amount</th>
                    <th className="px-3 py-2 text-right">Balance Due</th>
                    <th className="px-3 py-2 text-center">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {b2bSales.length === 0 ? (
                    <tr><td colSpan="6" className="py-4 text-center text-gray-400">No wholesale B2B sales recorded yet.</td></tr>
                  ) : (
                    b2bSales.map((s) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 font-bold text-teal-700">{s.invoice_no || s.id}</td>
                        <td className="px-3 py-2">{new Date(s.sale_date).toLocaleDateString("en-PK")}</td>
                        <td className="px-3 py-2 font-bold text-gray-900">{s.buyer_name}</td>
                        <td className="px-3 py-2 text-right font-black text-gray-900">Rs. {(s.total_amount || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold text-rose-700">Rs. {(s.balance_due || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-center capitalize font-bold">{s.payment_type}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
