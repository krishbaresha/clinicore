import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Layers,
  Boxes,
  Receipt,
  Printer,
  Download,
  X,
  Search,
  Eye,
  History,
  Calendar,
} from "lucide-react";
import { dbStockLedger, dbClinic } from "../api/db";
import { printStockLedgerReceipt, printItemDateHistoryReceipt } from "../utils/thermalPrinter";

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
        const cat = initialItem.company_code || initialItem.company_name || initialItem.item_code || "All";
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

  // Filtered categories with Natural Alphanumeric Sorting (GHR -> BM -> LEH)
  const filteredCategories = useMemo(() => {
    let list = categories;
    if (categorySearch.trim()) {
      const q = categorySearch.toLowerCase().trim();
      list = categories.filter((c) => (c.category || "").toLowerCase().includes(q) || (c.company_code || "").toLowerCase().includes(q) || (c.company_name && c.company_name.toLowerCase().includes(q)));
    }
    return [...list].sort((a, b) =>
      (a.category || "").localeCompare(b.category || "", undefined, { numeric: true, sensitivity: "base" })
    );
  }, [categories, categorySearch]);

  // Filtered SKU list with Natural Alphanumeric Sorting
  const filteredSkus = useMemo(() => {
    let list = skuList;
    if (skuSearch.trim()) {
      const q = skuSearch.toLowerCase().trim();
      list = skuList.filter((s) => (s.item_name || "").toLowerCase().includes(q) || (s.item_code && s.item_code.toLowerCase().includes(q)));
    }
    return [...list].sort((a, b) => {
      if (a.item_code && b.item_code && a.item_code !== b.item_code) {
        const codeCmp = a.item_code.localeCompare(b.item_code, undefined, { numeric: true, sensitivity: "base" });
        if (codeCmp !== 0) return codeCmp;
      }
      return (a.item_name || "").localeCompare(b.item_name || "", undefined, { numeric: true, sensitivity: "base" });
    });
  }, [skuList, skuSearch]);

  const totalIn = timeline.reduce((s, r) => s + (Number(r.total_in) || 0), 0);
  const totalOut = timeline.reduce((s, r) => s + (Number(r.total_out) || 0), 0);
  const netStock = totalIn - totalOut;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="bg-white text-slate-900 w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-300 flex flex-col max-h-[92vh] overflow-hidden my-auto relative z-10 font-sans"
          >
            {/* Top Header matching DrCreate Stock Ledger Style */}
            <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 p-4 sm:p-5 text-white flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center font-bold text-white shadow-inner">
                  <BookOpen className="w-6 h-6 text-teal-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2 text-white">
                      Stock Ledger &amp; Inventory Movement
                    </h2>
                    <span className="bg-emerald-400 text-slate-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono">
                      ClinicFlow POS
                    </span>
                  </div>
                  <p className="text-xs text-teal-100/90 font-medium">
                    4-Level Audit Drilldown: Company Summary ➔ SKU Summary ➔ Transactional Ledger ➔ Item Date History
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="touch-target-44 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95 cursor-pointer"
                title="Close Stock Ledger"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main 3-Pane Body */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-[500px]">
              
              {/* Left Column: Pane 1 & Pane 2 (Category & SKU Summaries) */}
              <div className="lg:col-span-5 border-r border-slate-300 flex flex-col divide-y divide-slate-300 bg-slate-50">
                
                {/* PANE 1: Category Summary (Top Left) */}
                <div className="flex-1 flex flex-col min-h-[240px] max-h-[280px] p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-teal-700" />
                      <span>Company Summary</span>
                    </h3>
                    <span className="text-[11px] font-mono text-slate-700 font-black">
                      {filteredCategories.length} Companies
                    </span>
                  </div>

                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search Company Code / Name (e.g. GHR, BM)..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-xl border-2 border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-600 outline-none bg-white shadow-xs"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-inner custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-700 text-[10px] font-black text-white uppercase shadow-sm">
                        <tr>
                          <th className="py-2.5 px-2.5 text-center w-10">Sr.</th>
                          <th className="py-2.5 px-3">Company Code &amp; Name</th>
                          <th className="py-2.5 px-3 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-semibold bg-white text-slate-900">
                        {filteredCategories.map((c, idx) => {
                          const isSelected = selectedCategory.toLowerCase() === c.category.toLowerCase();
                          return (
                            <tr
                              key={c.category}
                              onClick={() => handleSelectCategory(c.category)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-teal-800 text-white font-black"
                                  : "hover:bg-teal-50 text-slate-900 even:bg-slate-50/50"
                              }`}
                            >
                              <td className={`py-2 px-2.5 text-center font-mono text-[11px] font-bold ${isSelected ? "text-teal-200" : "text-slate-600"}`}>
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className={`font-mono font-black text-xs ${isSelected ? "text-white" : "text-slate-950"}`}>
                                    {c.company_code || c.category}
                                  </span>
                                  {c.item_count > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${isSelected ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-800"}`}>
                                      {c.item_count} items
                                    </span>
                                  )}
                                </div>
                                {c.company_name && (
                                  <div className={`text-[11px] font-bold truncate mt-0.5 ${isSelected ? "text-teal-100" : "text-slate-700"}`}>
                                    {c.company_name}
                                  </div>
                                )}
                              </td>
                              <td className={`py-2 px-3 text-right font-mono font-black ${isSelected ? "text-white" : "text-slate-950"}`}>
                                {c.total_qty}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PANE 2: SKU Summary (Bottom Left) */}
                <div className="flex-1 flex flex-col min-h-[260px] p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-teal-700" />
                      <span>SKU Summary ({selectedCategory})</span>
                    </h3>
                    <span className="text-[11px] font-mono text-slate-700 font-black">
                      {filteredSkus.length} SKUs
                    </span>
                  </div>

                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search Medicine SKU (e.g. GHR-1, Drops)..."
                      value={skuSearch}
                      onChange={(e) => setSkuSearch(e.target.value)}
                      className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-xl border-2 border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-600 outline-none bg-white shadow-xs"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-inner max-h-[220px] custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-700 text-[10px] font-black text-white uppercase shadow-sm">
                        <tr>
                          <th className="py-2.5 px-2.5 text-center w-10">Sr.</th>
                          <th className="py-2.5 px-3">Item Code &amp; Name</th>
                          <th className="py-2.5 px-3 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-semibold bg-white text-slate-900">
                        {filteredSkus.length > 0 ? (
                          filteredSkus.map((s, idx) => {
                            const isSelected = selectedSku && selectedSku.item_name === s.item_name;
                            return (
                              <tr
                                key={s.id || s.item_name}
                                onClick={() => handleSelectSku(s)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-teal-800 text-white font-black"
                                    : "hover:bg-teal-50 text-slate-900 even:bg-slate-50/50"
                                }`}
                              >
                                <td className={`py-2 px-2.5 text-center font-mono text-[11px] font-bold ${isSelected ? "text-teal-200" : "text-slate-600"}`}>
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {s.item_code && s.item_code !== "General" && (
                                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-black shrink-0 ${
                                        isSelected ? "bg-white/25 text-white" : "bg-teal-100 text-teal-950 border border-teal-300"
                                      }`}>
                                        {s.item_code}
                                      </span>
                                    )}
                                    <span className={`truncate max-w-[180px] ${isSelected ? "text-white font-black" : "text-slate-950 font-bold"}`} title={s.item_name}>
                                      {s.item_name}
                                    </span>
                                  </div>
                                </td>
                                <td className={`py-2 px-3 text-right font-mono font-black ${isSelected ? "text-white" : "text-slate-950"}`}>
                                  {s.qty}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={3} className="py-6 text-center text-slate-600 font-bold">
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
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-teal-700" />
                      <span>Transactional Ledger</span>
                    </h3>
                    <p className="text-xs text-slate-600 font-bold mt-0.5">
                      Medicine: <span className="text-teal-950 font-black">{selectedSku ? selectedSku.item_name : "Select an item"}</span>
                    </p>
                  </div>

                  {selectedSku && (
                    <div className="flex items-center gap-2 bg-emerald-50 border-2 border-emerald-300 px-3 py-1.5 rounded-xl shadow-xs">
                      <span className="text-[11px] font-bold text-emerald-950">Current Balance:</span>
                      <span className="text-xs font-mono font-black text-emerald-950">
                        {netStock} Units
                      </span>
                    </div>
                  )}
                </div>

                {/* Daily Timeline Table with Sticky Header */}
                <div className="flex-1 overflow-y-auto mt-3 rounded-2xl border border-slate-300 shadow-inner max-h-[420px] custom-scrollbar bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-700 text-[11px] font-black text-white uppercase shadow-sm">
                      <tr>
                        <th className="py-2.5 px-2.5 text-center w-10">Sr.</th>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4 text-center text-emerald-300">Total In</th>
                        <th className="py-2.5 px-4 text-center text-rose-300">Total Out</th>
                        <th className="py-2.5 px-4 text-right">Daily Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-semibold bg-white text-slate-900">
                      {timeline.length > 0 ? (
                        timeline.map((row, idx) => (
                          <tr
                            key={row.date}
                            onClick={() => handleSelectDateRow(row)}
                            className="hover:bg-teal-50/60 cursor-pointer transition-colors group even:bg-slate-50/40"
                            title="Click to view full invoice & voucher details for this date"
                          >
                            <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-600">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-black text-slate-900 group-hover:text-teal-950">
                              {row.date}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono font-black text-emerald-950 bg-emerald-50">
                              {row.total_in > 0 ? `+${row.total_in}` : "0"}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono font-black text-rose-950 bg-rose-50">
                              {row.total_out > 0 ? `-${row.total_out}` : "0"}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectDateRow(row);
                                }}
                                className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-slate-900 group-hover:bg-teal-800 text-white text-xs font-black inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Vouchers</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-16 text-center text-slate-600 font-bold">
                            <History className="w-8 h-8 block mx-auto mb-1 text-slate-400" />
                            No transaction movement recorded for this medicine.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Summary Pill */}
                {timeline.length > 0 && (
                  <div className="mt-3 p-3 bg-slate-100 rounded-xl border border-slate-300 flex flex-wrap items-center justify-between text-xs font-black text-slate-900 gap-2">
                    <div>Total Lifetime Inward: <span className="text-emerald-900 font-mono font-black">+{totalIn}</span></div>
                    <div>Total Lifetime Outward: <span className="text-rose-900 font-mono font-black">-{totalOut}</span></div>
                    <div>Net Reconciled Balance: <span className="text-teal-950 font-mono font-black">{netStock}</span></div>
                  </div>
                )}

              </div>

            </div>

            {/* Modal Bottom Footer Actions */}
            <div className="p-4 bg-slate-100 border-t border-slate-300 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-700 font-bold">
                💡 Tip: Click on any Date row in the Transactional Ledger to view invoice &amp; voucher history.
              </div>

              <div className="flex items-center gap-2">
                {selectedSku && (
                  <>
                    <button
                      type="button"
                      onClick={() => printStockLedgerReceipt(selectedSku.item_name, timeline, dbClinic.get())}
                      className="touch-target-44 min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print 80mm Ledger</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => dbStockLedger.exportCSV(selectedSku.item_name, timeline)}
                      className="touch-target-44 min-h-[44px] px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export CSV</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="touch-target-44 min-h-[44px] px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 text-xs font-black transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

          </motion.div>

          {/* PANE 4: Item Date History (Popup Modal Level with AnimatePresence) */}
          <AnimatePresence>
            {showDateHistoryModal && selectedDateRow && (
              <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowDateHistoryModal(false)}
                  className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white text-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[85vh] relative z-10 font-sans"
                >
                  {/* Popup Header */}
                  <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-4 flex items-center justify-between shrink-0">
                    <div>
                      <h4 className="text-base font-black flex items-center gap-2 text-white">
                        <Calendar className="w-4 h-4 text-teal-300" />
                        <span>Item Date History &amp; Vouchers Breakdown</span>
                      </h4>
                      <p className="text-xs text-teal-200/90 font-medium">
                        {selectedSku?.item_name} · Date: <span className="font-mono text-emerald-300 font-bold">{selectedDateRow.date}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowDateHistoryModal(false)}
                      className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Vouchers Table */}
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar max-h-[60vh] bg-white">
                    <table className="w-full text-left text-xs border-collapse min-w-[750px]">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-700 text-[11px] font-black text-white uppercase tracking-wider shadow-sm">
                        <tr>
                          <th className="py-3 px-2.5 text-center w-10">Sr.</th>
                          <th className="py-3 px-3">Date</th>
                          <th className="py-3 px-3">Voucher #</th>
                          <th className="py-3 px-3">Type</th>
                          <th className="py-3 px-3">Description</th>
                          <th className="py-3 px-3 text-center">In Qty</th>
                          <th className="py-3 px-3 text-center">Out Qty</th>
                          <th className="py-3 px-3 text-right">Rate (Rs)</th>
                          <th className="py-3 px-3 text-right">Gross (Rs)</th>
                          <th className="py-3 px-3 text-center">Disc %</th>
                          <th className="py-3 px-3 text-right">Disc Flat</th>
                          <th className="py-3 px-3 text-right">Net Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs bg-white text-slate-900 font-semibold">
                        {(selectedDateRow.vouchers && selectedDateRow.vouchers.length > 0) ? (
                          selectedDateRow.vouchers.map((v, idx) => (
                            <tr key={idx} className="hover:bg-teal-50/60 transition-colors even:bg-slate-50/40">
                              <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-600">{idx + 1}</td>
                              <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">{selectedDateRow.date}</td>
                              <td className="py-3 px-3 font-mono font-black text-teal-950">{v.voucher_no}</td>
                              <td className="py-3 px-3">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black border ${
                                  v.type === "Sale"
                                    ? "bg-rose-100 text-rose-950 border-rose-300"
                                    : "bg-emerald-100 text-emerald-950 border-emerald-300"
                                }`}>
                                  {v.type}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-900 font-bold max-w-xs truncate" title={v.description}>
                                {v.description}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-black text-emerald-950 bg-emerald-50/70">{v.in_qty || 0}</td>
                              <td className="py-3 px-3 text-center font-mono font-black text-rose-950 bg-rose-50/70">{v.out_qty || 0}</td>
                              <td className="py-3 px-3 text-right font-mono font-black text-slate-900">Rs. {Number(v.rate || 0).toLocaleString()}</td>
                              <td className="py-3 px-3 text-right font-mono font-black text-slate-900">Rs. {Number(v.gross || 0).toLocaleString()}</td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">{v.disc_pct || "-"}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{v.disc_flat ? `Rs. ${Number(v.disc_flat).toLocaleString()}` : "0"}</td>
                              <td className="py-3 px-3 text-right font-mono font-black text-slate-950 text-sm">Rs. {Number(v.net || 0).toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={12} className="py-12 text-center text-slate-700 font-bold">
                              No voucher details available for this entry.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Popup Bottom */}
                  <div className="p-4 bg-slate-100 border-t border-slate-300 flex items-center justify-between gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => printItemDateHistoryReceipt(selectedSku?.item_name, selectedDateRow, dbClinic.get())}
                      className="touch-target-44 min-h-[40px] px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Date Vouchers</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowDateHistoryModal(false)}
                      className="touch-target-44 min-h-[40px] px-6 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black transition-all cursor-pointer shadow-md active:scale-95"
                    >
                      Close History
                    </button>
                  </div>

                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

