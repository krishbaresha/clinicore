import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { dbStockLedger, dbClinic } from "../api/db";
import { printStockLedgerReceipt } from "../utils/thermalPrinter";

export default function StockLedgerModal({ isOpen, onClose, initialItem = null }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [categorySearch, setCategorySearch] = useState("");

  const [skuList, setSkuList] = useState([]);
  const [selectedSku, setSelectedSku] = useState(null);
  const [skuSearch, setSkuSearch] = useState("");

  const [timeline, setTimeline] = useState([]);
  const [selectedDateRow, setSelectedDateRow] = useState(null);
  const [showDateHistoryModal, setShowDateHistoryModal] = useState(false);

  // Load initial categories & SKU list
  useEffect(() => {
    if (isOpen) {
      const cats = dbStockLedger.getCategorySummary();
      setCategories(cats);

      if (initialItem) {
        const cat = initialItem.item_code || initialItem.company_name || "All";
        setSelectedCategory(cat);
        const skus = dbStockLedger.getSKUSummary(cat);
        setSkuList(skus);
        const foundSku = skus.find((s) => s.id === initialItem.id || s.item_name === initialItem.medicine_name) || skus[0];
        if (foundSku) {
          setSelectedSku(foundSku);
          setTimeline(dbStockLedger.getItemTimeline(foundSku.item_name));
        }
      } else if (cats.length > 0) {
        setSelectedCategory(cats[0].category);
        const skus = dbStockLedger.getSKUSummary(cats[0].category);
        setSkuList(skus);
        if (skus.length > 0) {
          setSelectedSku(skus[0]);
          setTimeline(dbStockLedger.getItemTimeline(skus[0].item_name));
        }
      }
    }
  }, [isOpen, initialItem]);

  // When Category changes
  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    const skus = dbStockLedger.getSKUSummary(cat);
    setSkuList(skus);
    if (skus.length > 0) {
      setSelectedSku(skus[0]);
      setTimeline(dbStockLedger.getItemTimeline(skus[0].item_name));
    } else {
      setSelectedSku(null);
      setTimeline([]);
    }
  };

  // When SKU changes
  const handleSelectSku = (sku) => {
    setSelectedSku(sku);
    setTimeline(dbStockLedger.getItemTimeline(sku.item_name));
  };

  // When Date row is clicked in Transactional Ledger
  const handleSelectDateRow = (row) => {
    setSelectedDateRow(row);
    setShowDateHistoryModal(true);
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase().trim();
    return categories.filter((c) => c.category.toLowerCase().includes(q) || (c.company_name && c.company_name.toLowerCase().includes(q)));
  }, [categories, categorySearch]);

  // Filtered SKU list
  const filteredSkus = useMemo(() => {
    if (!skuSearch.trim()) return skuList;
    const q = skuSearch.toLowerCase().trim();
    return skuList.filter((s) => s.item_name.toLowerCase().includes(q) || (s.item_code && s.item_code.toLowerCase().includes(q)));
  }, [skuList, skuSearch]);

  if (!isOpen) return null;

  const totalIn = timeline.reduce((s, r) => s + (Number(r.total_in) || 0), 0);
  const totalOut = timeline.reduce((s, r) => s + (Number(r.total_out) || 0), 0);
  const netStock = totalIn - totalOut;

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-emerald-100 flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* Top Header matching DrCreate Stock Ledger Style */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center font-bold text-white shadow-inner">
              <span className="material-symbols-outlined text-2xl">menu_book</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-black font-headline tracking-wide flex items-center gap-2">
                  Stock Ledger _List
                </h2>
                <span className="bg-emerald-400 text-emerald-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono">
                  DrCreate V2.0
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium">
                4-Level Audit Drilldown: Category Summary ➔ SKU Summary ➔ Transactional Ledger ➔ Item Date History
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
            title="Close Stock Ledger"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Main 3-Pane Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-[500px]">
          
          {/* Left Column: Pane 1 & Pane 2 (Category & SKU Summaries) */}
          <div className="lg:col-span-5 border-r border-gray-200 flex flex-col divide-y divide-gray-200 bg-gray-50/50">
            
            {/* PANE 1: Catogery Summery (Top Left) */}
            <div className="flex-1 flex flex-col min-h-[240px] max-h-[280px] p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-blue-700">category</span>
                  Catogery Summery
                </h3>
                <span className="text-[11px] font-mono text-gray-500 font-bold">
                  {filteredCategories.length} Brands
                </span>
              </div>

              <div className="relative mb-2">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-gray-400 text-xs">search</span>
                <input
                  type="text"
                  placeholder="Search Category / Brand..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
              </div>

              <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-inner custom-scrollbar">

                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-blue-50 border-b border-blue-100 text-[10px] font-black text-blue-900 uppercase">
                    <tr>
                      <th className="py-1.5 px-3">Catogery</th>
                      <th className="py-1.5 px-3 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredCategories.map((c) => {
                      const isSelected = selectedCategory.toLowerCase() === c.category.toLowerCase();
                      return (
                        <tr
                          key={c.category}
                          onClick={() => handleSelectCategory(c.category)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-blue-600 text-white font-bold"
                              : "hover:bg-blue-50 text-gray-800"
                          }`}
                        >
                          <td className="py-1.5 px-3 flex items-center justify-between">
                            <span>{c.category}</span>
                            {c.item_count > 0 && (
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "text-gray-400"}`}>
                                {c.item_count} items
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold">
                            {c.total_qty}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PANE 2: SKU Summery (Bottom Left) */}
            <div className="flex-1 flex flex-col min-h-[260px] p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase text-teal-800 tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-teal-600">inventory_2</span>
                  SKU Summery ({selectedCategory})
                </h3>
                <span className="text-[11px] font-mono text-gray-500 font-bold">
                  {filteredSkus.length} SKUs
                </span>
              </div>

              <div className="relative mb-2">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-gray-400 text-xs">search</span>
                <input
                  type="text"
                  placeholder="Search Medicine SKU..."
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                />
              </div>

              <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-inner max-h-[220px] custom-scrollbar">

                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-teal-50 border-b border-teal-100 text-[10px] font-black text-teal-900 uppercase">
                    <tr>
                      <th className="py-1.5 px-3">Item Name</th>
                      <th className="py-1.5 px-3 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredSkus.length > 0 ? (
                      filteredSkus.map((s) => {
                        const isSelected = selectedSku && selectedSku.item_name === s.item_name;
                        return (
                          <tr
                            key={s.id || s.item_name}
                            onClick={() => handleSelectSku(s)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-teal-700 text-white font-bold"
                                : "hover:bg-teal-50 text-gray-800"
                            }`}
                          >
                            <td className="py-1.5 px-3 truncate max-w-[200px]" title={s.item_name}>
                              {s.item_name}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono font-bold">
                              {s.qty}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={2} className="py-6 text-center text-gray-400">
                          No SKUs found for category.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column: PANE 3 (Transactional Ledger) */}
          <div className="lg:col-span-7 flex flex-col p-4 bg-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-black uppercase text-rose-800 tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-rose-600">receipt_long</span>
                  Transactional Ledger
                </h3>
                <p className="text-xs text-gray-500 font-bold mt-0.5">
                  Medicine: <span className="text-teal-950 font-black">{selectedSku ? selectedSku.item_name : "Select an item"}</span>
                </p>
              </div>

              {selectedSku && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  <span className="text-[11px] font-bold text-emerald-800">Current Balance:</span>
                  <span className="text-xs font-mono font-black text-emerald-950">
                    {netStock} Units
                  </span>
                </div>
              )}
            </div>

            {/* Daily Timeline Table */}
            <div className="flex-1 overflow-y-auto mt-3 rounded-2xl border border-gray-200 shadow-inner max-h-[420px] custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">

                <thead className="sticky top-0 bg-rose-50 border-b border-rose-100 text-[11px] font-black text-rose-900 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4 text-center text-emerald-700">Total In</th>
                    <th className="py-2.5 px-4 text-center text-rose-700">Total Out</th>
                    <th className="py-2.5 px-4 text-right">Daily Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {timeline.length > 0 ? (
                    timeline.map((row) => (
                      <tr
                        key={row.date}
                        onClick={() => handleSelectDateRow(row)}
                        className="hover:bg-rose-50/60 cursor-pointer transition-colors group"
                        title="Click to view full invoice & voucher details for this date"
                      >
                        <td className="py-2 px-4 font-mono font-bold text-gray-800 group-hover:text-rose-900">
                          {row.date}
                        </td>
                        <td className="py-2 px-4 text-center font-mono font-bold text-emerald-600 bg-emerald-50/30">
                          {row.total_in > 0 ? `+${row.total_in}` : "0"}
                        </td>
                        <td className="py-2 px-4 text-center font-mono font-bold text-rose-600 bg-rose-50/30">
                          {row.total_out > 0 ? `-${row.total_out}` : "0"}
                        </td>
                        <td className="py-2 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectDateRow(row);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 group-hover:bg-rose-600 group-hover:text-white text-gray-700 text-[11px] font-bold inline-flex items-center gap-1 transition-all"
                          >
                            <span className="material-symbols-outlined text-xs">visibility</span>
                            Voucher Details
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-gray-400 font-semibold">
                        <span className="material-symbols-outlined text-4xl block mb-1 text-gray-300">history_toggle_off</span>
                        No transaction movement recorded for this medicine.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Summary Pill */}
            {timeline.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between text-xs font-bold text-gray-700 gap-2">
                <div>Total Lifetime Inward: <span className="text-emerald-700 font-mono">+{totalIn}</span></div>
                <div>Total Lifetime Outward: <span className="text-rose-700 font-mono">-{totalOut}</span></div>
                <div>Net Reconciled Balance: <span className="text-teal-900 font-mono font-black">{netStock}</span></div>
              </div>
            )}

          </div>

        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 bg-gray-100 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500 font-medium">
            💡 Tip: Click on any Date row in the Transactional Ledger to view invoice &amp; voucher history.
          </div>

          <div className="flex items-center gap-2">
            {selectedSku && (
              <>
                <button
                  type="button"
                  onClick={() => printStockLedgerReceipt(selectedSku.item_name, timeline, dbClinic.get())}
                  className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  Print 80mm Ledger
                </button>

                <button
                  type="button"
                  onClick={() => dbStockLedger.exportCSV(selectedSku.item_name, timeline)}
                  className="px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">file_download</span>
                  Export CSV
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold transition-all"
            >
              Close
            </button>
          </div>
        </div>

      </div>

      {/* PANE 4: Item Date History (Popup Modal Level) */}
      {showDateHistoryModal && selectedDateRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Popup Header */}
            <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold font-headline flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-400">event_note</span>
                  Item Date History
                </h4>
                <p className="text-xs text-gray-400">
                  {selectedSku?.item_name} · Date: <span className="font-mono text-emerald-300 font-bold">{selectedDateRow.date}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDateHistoryModal(false)}
                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white transition-all"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Vouchers Table */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar max-h-[60vh]">
              <table className="w-full text-left text-xs border-collapse">

                <thead className="sticky top-0 bg-gray-100 border-b border-gray-200 text-[10px] font-black text-gray-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Voucher</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-center">In</th>
                    <th className="py-2 px-3 text-center">Out</th>
                    <th className="py-2 px-3 text-right">Rate</th>
                    <th className="py-2 px-3 text-right">Gross</th>
                    <th className="py-2 px-3 text-center">Disc%</th>
                    <th className="py-2 px-3 text-right">Disc0</th>
                    <th className="py-2 px-3 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {(selectedDateRow.vouchers && selectedDateRow.vouchers.length > 0) ? (
                    selectedDateRow.vouchers.map((v, idx) => (
                      <tr key={idx} className="hover:bg-teal-50/50 transition-colors">
                        <td className="py-2 px-3 font-mono text-gray-600 whitespace-nowrap">{selectedDateRow.date}</td>
                        <td className="py-2 px-3 font-mono font-bold text-teal-800">{v.voucher_no}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.type === "Sale"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {v.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-700 max-w-xs truncate" title={v.description}>
                          {v.description}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700">{v.in_qty || 0}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-rose-700">{v.out_qty || 0}</td>
                        <td className="py-2 px-3 text-right font-mono">{v.rate || 0}</td>
                        <td className="py-2 px-3 text-right font-mono">{v.gross || 0}</td>
                        <td className="py-2 px-3 text-center font-mono text-gray-500">{v.disc_pct || "-"}</td>
                        <td className="py-2 px-3 text-right font-mono text-gray-500">{v.disc_flat || 0}</td>
                        <td className="py-2 px-3 text-right font-mono font-black text-gray-900">{v.net || 0}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-gray-400">
                        No voucher details available for this entry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Popup Bottom */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowDateHistoryModal(false)}
                className="px-5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold transition-all"
              >
                Close History
              </button>
            </div>

          </div>
        </div>
      )}

    </div>,
    document.body
  );
}
