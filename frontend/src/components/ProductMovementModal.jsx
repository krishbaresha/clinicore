import { useState, useMemo } from "react";
import { dbInventory, dbClinic } from "../api/db.js";
import { formatPKR, formatDate } from "../utils/formatters.js";
import { printProductStockCard } from "../utils/thermalPrinter.js";

export default function ProductMovementModal({ item, isOpen, onClose, onStockUpdated }) {
  const [filterType, setFilterType] = useState("all"); // "all" | "inward" | "outward" | "transfers"
  const [searchQuery, setSearchQuery] = useState("");
  const [transferMode, setTransferMode] = useState(null); // null | "to_store" | "to_warehouse"
  const [transferQty, setTransferQty] = useState(1);
  const [transferredBy, setTransferredBy] = useState("Usama");
  const [transferNotes, setTransferNotes] = useState("");

  const movementData = useMemo(() => {
    if (!item?.id) return null;
    return dbInventory.getProductMovement(item.id);
  }, [item]);

  if (!isOpen || !item) return null;

  const currentItem = movementData?.item || item;
  const summary = movementData?.summary || {
    warehouse_stock: currentItem.warehouse_stock ?? 0,
    store_stock: currentItem.store_stock ?? (currentItem.stock_qty ?? 0),
    total_base_stock: currentItem.total_base_stock ?? (currentItem.stock_qty ?? 0),
    total_purchased: 0,
    total_sold_retail: 0,
    total_sold_wholesale: 0,
  };

  const transactions = (movementData?.transactions || []).filter((tx) => {
    if (filterType === "inward" && tx.type !== "PURCHASE") return false;
    if (filterType === "outward" && tx.type !== "RETAIL_SALE" && tx.type !== "WHOLESALE_B2B") return false;
    if (filterType === "transfers" && tx.type !== "INTERNAL_TRANSFER") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchParty = (tx.party_name || "").toLowerCase().includes(q);
      const matchVou = (tx.voucher_no || "").toLowerCase().includes(q);
      const matchDest = (tx.destination || "").toLowerCase().includes(q);
      const matchSalesman = (tx.salesman || "").toLowerCase().includes(q);
      const matchHandler = (tx.handler || "").toLowerCase().includes(q);
      if (!matchParty && !matchVou && !matchDest && !matchSalesman && !matchHandler) return false;
    }
    return true;
  });

  const handleExecuteTransfer = (e) => {
    e.preventDefault();
    const qty = Number(transferQty) || 1;
    if (qty <= 0) return;
    const person = transferredBy.trim() || "Store Staff";

    if (transferMode === "to_store") {
      const wStock = currentItem.warehouse_stock ?? 0;
      if (qty > wStock) {
        alert(`Cannot transfer ${qty} units! Godown only has ${wStock} units.`);
        return;
      }
      dbInventory.transferWarehouseToStore(currentItem.id, qty, transferNotes, person);
      alert(`Successfully shifted ${qty} units from Godown to Store Counter by [${person}]!`);
    } else if (transferMode === "to_warehouse") {
      const sStock = currentItem.store_stock ?? (currentItem.stock_qty ?? 0);
      if (qty > sStock) {
        alert(`Cannot transfer ${qty} units! Store Counter only has ${sStock} units.`);
        return;
      }
      dbInventory.transferStoreToWarehouse(currentItem.id, qty, transferNotes, person);
      alert(`Successfully returned ${qty} units from Store Counter to Godown by [${person}]!`);
    }

    setTransferMode(null);
    setTransferQty(1);
    setTransferNotes("");
    if (onStockUpdated) onStockUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white border border-teal-100 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-teal-900 text-white flex items-center justify-between border-b border-teal-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-800 border border-teal-700 flex items-center justify-center text-teal-200">
              <span className="material-symbols-outlined text-xl">analytics</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold font-headline">{currentItem.medicine_name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-800 text-teal-200 border border-teal-700">
                  Code: {currentItem.item_code || "GEN"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-950 text-teal-300">
                  {currentItem.category || "Homeopathic"}
                </span>
              </div>
              <p className="text-xs text-teal-200/80 mt-0.5">
                Product Stock Movement &amp; Traceability Card (1-Click Lifecycle Audit)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-teal-800 hover:bg-teal-700 text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Live Multi-Location Stock Breakdown Cards */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            
            {/* 1. Main Warehouse Godown Stock */}
            <div className="bg-white p-4 rounded-2xl border border-teal-200 shadow-sm relative overflow-hidden">
              <div className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-teal-600">warehouse</span>
                Godown Stock
              </div>
              <div className="text-2xl font-black font-headline text-gray-900 mt-1">
                {summary.warehouse_stock} <span className="text-xs font-normal text-gray-500">{currentItem.box_label || "Packs"}</span>
              </div>
              <button
                onClick={() => setTransferMode("to_store")}
                className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
              >
                <span>Shift to Store</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </div>

            {/* 2. Medical Store Counter Stock */}
            <div className="bg-white p-4 rounded-2xl border border-teal-200 shadow-sm relative overflow-hidden">
              <div className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-teal-600">storefront</span>
                Store POS Stock
              </div>
              <div className="text-2xl font-black font-headline text-gray-900 mt-1">
                {summary.store_stock} <span className="text-xs font-normal text-gray-500">{currentItem.unit_label || "Units"}</span>
              </div>
              <button
                onClick={() => setTransferMode("to_warehouse")}
                className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
              >
                <span>Return to Godown</span>
                <span className="material-symbols-outlined text-xs">arrow_back</span>
              </button>
            </div>

            {/* 3. Total Inward Purchased */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-emerald-600">download</span>
                Total Inward
              </div>
              <div className="text-2xl font-black font-headline text-emerald-700 mt-1">
                +{summary.total_purchased}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Supplier Purchases</div>
            </div>

            {/* 4. Total Outward Wholesale */}
            <div className="bg-white p-4 rounded-2xl border border-teal-200 shadow-sm">
              <div className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-teal-600">local_shipping</span>
                Wholesale Sold
              </div>
              <div className="text-2xl font-black font-headline text-teal-900 mt-1">
                -{summary.total_sold_wholesale}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Sindh Parties</div>
            </div>

            {/* 5. Total Outward Retail */}
            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-amber-600">point_of_sale</span>
                Retail Counter
              </div>
              <div className="text-2xl font-black font-headline text-amber-700 mt-1">
                -{summary.total_sold_retail}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Walk-in Patients</div>
            </div>

          </div>

          {/* Inline Stock Shift Modal / Form */}
          {transferMode && (
            <form onSubmit={handleExecuteTransfer} className="mt-4 p-4 rounded-2xl bg-teal-50 border border-teal-200 flex flex-wrap items-center gap-3 animate-fadeIn">
              <div className="text-sm font-bold text-teal-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">sync_alt</span>
                {transferMode === "to_store" ? "Shift from Godown ➔ Store Counter" : "Return from Store Counter ➔ Godown"}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-700">Quantity:</label>
                <input
                  type="number"
                  min="1"
                  max={transferMode === "to_store" ? (currentItem.warehouse_stock ?? 999) : (currentItem.store_stock ?? 999)}
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  className="w-20 px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-sm font-bold text-center"
                  required
                />
              </div>
              <div className="w-36">
                <input
                  type="text"
                  placeholder="Staff: e.g. Usama"
                  value={transferredBy}
                  onChange={(e) => setTransferredBy(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold"
                  title="Shifted / Carried By"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <input
                  type="text"
                  placeholder="Notes / Reason (e.g. Counter replenishment)"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-colors"
              >
                Confirm Shift
              </button>
              <button
                type="button"
                onClick={() => setTransferMode(null)}
                className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
            </form>
          )}
        </div>

        {/* Toolbar & Filters */}
        <div className="px-6 py-3 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          
          {/* Tab Filters */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-2xl">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                filterType === "all" ? "bg-white text-teal-900 shadow-sm border border-teal-200" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Movements ({transactions.length})
            </button>
            <button
              onClick={() => setFilterType("inward")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 ${
                filterType === "inward" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span className="material-symbols-outlined text-xs">download</span>
              Inward Purchases
            </button>
            <button
              onClick={() => setFilterType("outward")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 ${
                filterType === "outward" ? "bg-teal-700 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span className="material-symbols-outlined text-xs">upload</span>
              Outward Sales
            </button>
            <button
              onClick={() => setFilterType("transfers")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 ${
                filterType === "transfers" ? "bg-teal-800 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span className="material-symbols-outlined text-xs">sync_alt</span>
              Internal Shifts
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
            <input
              type="text"
              placeholder="Search Party, Voucher, Bilty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-xs text-gray-900 font-medium focus:outline-none focus:border-teal-600"
            />
          </div>

        </div>

        {/* Traceability Ledger Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <span className="material-symbols-outlined text-4xl mb-2 text-gray-300">history_toggle_off</span>
              <p className="text-sm font-semibold">No movement transactions found for this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider font-bold border-b border-gray-100">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Voucher #</th>
                    <th className="py-3 px-4">Party / Customer / Source</th>
                    <th className="py-3 px-4">Territory / Transport</th>
                    <th className="py-3 px-4 text-center">In Qty</th>
                    <th className="py-3 px-4 text-center">Out Qty</th>
                    <th className="py-3 px-4 text-right">Rate</th>
                    <th className="py-3 px-4 text-right">Net Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {transactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-teal-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-500 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {tx.type === "PURCHASE" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            📥 Inward Purchase
                          </span>
                        )}
                        {tx.type === "WHOLESALE_B2B" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                            🚚 Wholesale B2B
                          </span>
                        )}
                        {tx.type === "RETAIL_SALE" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                            🏪 Retail POS
                          </span>
                        )}
                        {tx.type === "INTERNAL_TRANSFER" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            🔄 Internal Shift
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-800 whitespace-nowrap">
                        {tx.voucher_no}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900">
                        {tx.party_name}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {tx.city && <span className="font-semibold text-gray-800">{tx.city} </span>}
                        {tx.bilty_no && <span className="text-[11px] text-teal-700 font-mono">(Bilty: {tx.bilty_no}) </span>}
                        {tx.salesman && <span className="text-[11px] text-teal-900 font-mono">[{tx.salesman}]</span>}
                        {!tx.city && !tx.bilty_no && !tx.salesman && (tx.destination || "—")}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-700">
                        {tx.qty_in > 0 ? `+${tx.qty_in}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-rose-600">
                        {tx.qty_out > 0 ? `-${tx.qty_out}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-600">
                        {formatPKR(tx.unit_price)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-gray-900">
                        {formatPKR(tx.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
          <div>
            Showing <span className="font-bold text-gray-900">{transactions.length}</span> verified lifecycle transactions for <span className="font-bold text-gray-900">{currentItem.medicine_name}</span>
          </div>
          <button
            onClick={() => printProductStockCard(currentItem, transactions, summary, dbClinic.get())}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            Print Stock Card
          </button>
        </div>

      </div>
    </div>
  );
}
