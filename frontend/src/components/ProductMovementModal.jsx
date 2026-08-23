import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
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

  const modalContent = (
    <div
      className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white border border-teal-100 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[88vh] max-h-[720px]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-4 bg-teal-900 text-white flex items-center justify-between border-b border-teal-800 shrink-0">
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
        <div className="p-4 bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-100 grid grid-cols-2 md:grid-cols-5 gap-3 text-center shrink-0">
          <div className="p-2.5 bg-white rounded-2xl border border-teal-100 shadow-sm">
            <div className="text-[10px] text-gray-500 font-bold uppercase">Main Godown</div>
            <div className="text-base font-extrabold text-teal-950">{summary.warehouse_stock} units</div>
          </div>
          <div className="p-2.5 bg-white rounded-2xl border border-teal-100 shadow-sm">
            <div className="text-[10px] text-gray-500 font-bold uppercase">Store Counter</div>
            <div className="text-base font-extrabold text-teal-950">{summary.store_stock} units</div>
          </div>
          <div className="p-2.5 bg-teal-600 text-white rounded-2xl shadow-sm">
            <div className="text-[10px] text-teal-100 font-bold uppercase">Total Base Stock</div>
            <div className="text-base font-extrabold">{summary.total_base_stock} units</div>
          </div>
          <div className="p-2.5 bg-white rounded-2xl border border-teal-100 shadow-sm">
            <div className="text-[10px] text-gray-500 font-bold uppercase">Total Inward</div>
            <div className="text-base font-extrabold text-emerald-700">+{summary.total_purchased} units</div>
          </div>
          <div className="p-2.5 bg-white rounded-2xl border border-teal-100 shadow-sm col-span-2 md:col-span-1">
            <div className="text-[10px] text-gray-500 font-bold uppercase">Total Outward</div>
            <div className="text-base font-extrabold text-rose-600">
              -{summary.total_sold_retail + summary.total_sold_wholesale} units
            </div>
          </div>
        </div>

        {/* Internal Stock Transfer Drawer */}
        {transferMode && (
          <form onSubmit={handleExecuteTransfer} className="p-4 bg-amber-50/80 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <span className="material-symbols-outlined text-amber-700">swap_horiz</span>
              {transferMode === "to_store" ? "Shift from Godown ➔ Store Counter" : "Return from Store ➔ Godown"}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="font-semibold text-gray-700">Quantity:</label>
              <input
                type="number"
                min="1"
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                className="w-20 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white font-bold text-xs"
                required
              />

              <label className="font-semibold text-gray-700">Handler:</label>
              <input
                type="text"
                value={transferredBy}
                onChange={(e) => setTransferredBy(e.target.value)}
                placeholder="Staff name"
                className="w-28 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs"
                required
              />

              <input
                type="text"
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                placeholder="Reason / Notes (Optional)"
                className="w-44 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-xs"
              />

              <button
                type="submit"
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-sm"
              >
                Confirm Shift
              </button>
              <button
                type="button"
                onClick={() => setTransferMode(null)}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Filter and Search Bar */}
        <div className="p-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl w-full sm:w-auto">
            {[
              { id: "all", label: "All Audit Logs" },
              { id: "inward", label: "Inward (Purchases)" },
              { id: "outward", label: "Outward (Sales)" },
              { id: "transfers", label: "Godown Shifts" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  filterType === tab.id
                    ? "bg-white text-teal-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <input
              type="text"
              placeholder="Filter voucher, party, salesman..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:border-teal-600 w-full sm:w-56"
            />

            {!transferMode && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setTransferMode("to_store")}
                  className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-800 border border-teal-200 rounded-xl text-xs font-bold transition-all"
                  title="Shift stock from Godown to Front Store"
                >
                  Shift to Store
                </button>
                <button
                  type="button"
                  onClick={() => setTransferMode("to_warehouse")}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all"
                  title="Return stock from Front Store to Godown"
                >
                  Return to Godown
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Lifecycle Ledger Table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {transactions.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs">
              <span className="material-symbols-outlined text-4xl mb-2 text-gray-300 block">history_toggle_off</span>
              No stock movements recorded for this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-[11px] sticky top-0 border-b border-gray-200 shadow-xs">
                  <tr>
                    <th className="p-3">Date &amp; Time</th>
                    <th className="p-3">Activity / Channel</th>
                    <th className="p-3">Voucher #</th>
                    <th className="p-3">Party / Customer</th>
                    <th className="p-3 text-center">Movement Qty</th>
                    <th className="p-3 text-right">Value (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-teal-50/40 transition-colors">
                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        {formatDate(tx.date || tx.created_at)}
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold inline-flex items-center gap-1 ${
                          tx.type === "PURCHASE"
                            ? "bg-emerald-100 text-emerald-800"
                            : tx.type === "WHOLESALE_B2B"
                            ? "bg-indigo-100 text-indigo-800"
                            : tx.type === "RETAIL_SALE"
                            ? "bg-teal-100 text-teal-800"
                            : tx.type === "SALE_RETURN"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-900"
                        }`}>
                          <span className="material-symbols-outlined text-xs">
                            {tx.type === "PURCHASE"
                              ? "arrow_downward"
                              : tx.type === "INTERNAL_TRANSFER"
                              ? "sync_alt"
                              : tx.type === "SALE_RETURN"
                              ? "keyboard_return"
                              : "arrow_upward"}
                          </span>
                          {tx.type_label || tx.type}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-teal-900">{tx.voucher_no || "-"}</td>
                      <td className="p-3">
                        <div className="font-bold text-gray-900">{tx.party_name || "Direct Counter"}</div>
                        {tx.salesman && <div className="text-[10px] text-gray-400">Rep: {tx.salesman}</div>}
                      </td>
                      <td className={`p-3 text-center font-bold font-mono ${
                        tx.quantity > 0 ? "text-emerald-700" : tx.quantity < 0 ? "text-rose-600" : "text-amber-800"
                      }`}>
                        {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity} units
                      </td>
                      <td className="p-3 text-right font-extrabold text-gray-900">
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
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600 shrink-0">
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

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}
