import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { dbDayClosing, dbClinic } from "../api/db.js";
import { getSession } from "../api/auth.js";
import { printDayEndClosingReceipt } from "../utils/thermalPrinter.js";
import clinicLogoPng from "../assets/clinic-logo.png";

/**
 * DrCreate & MS Access Day Closing Receipt (UserForm12) Engine
 */
export default function DayClosingReceiptModal({ isOpen, onClose }) {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [whatsAppNo, setWhatsAppNo] = useState("03473100304");
  const [statusMsg, setStatusMsg] = useState("Ready");
  const [closingData, setClosingData] = useState(null);
  const [clinicData, setClinicData] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen, date]);

  const loadData = () => {
    setStatusMsg("Loading Data...");
    const clinic = dbClinic.get();
    setClinicData(clinic);

    const data = dbDayClosing.getDayClosingData(date);
    setClosingData(data);
    setStatusMsg("Data Loaded");
  };

  // Day of Week
  const dayOfWeekName = useMemo(() => {
    try {
      const d = new Date(date + "T00:00:00");
      return d.toLocaleDateString("en-US", { weekday: "long" });
    } catch {
      return "Today";
    }
  }, [date]);

  // Handle Print 80mm Thermal Receipt
  const handlePrint = () => {
    if (!closingData) return;
    const session = getSession();
    const printPayload = {
      date: closingData.date,
      closing_date: closingData.date,
      closed_by: session?.name || session?.full_name || "Store Manager",
      audit_scope: "All Terminals & Godowns",
      consultant: dbClinic.get()?.doctor_name || "Dr. Muhammad Asif Ashraf Khan",
      sales: closingData.sales,
      purchases: closingData.purchases,
      payments_paid: closingData.payments_paid,
      payments_received: closingData.payments_received,
      closing_cash: closingData.closing_cash,
      net_cash_in_hand: closingData.closing_cash,
      expected_cash: closingData.closing_cash,
    };
    printDayEndClosingReceipt(printPayload, clinicData);
  };

  // Handle Send via WhatsApp
  const handleSendWhatsApp = () => {
    if (!closingData) return;
    let cleanPhone = (whatsAppNo || "").replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "92" + cleanPhone.slice(1);
    }
    if (!cleanPhone) {
      alert("⚠️ Please enter a valid WhatsApp mobile number (e.g., 03473100304).");
      return;
    }
    const encodedText = encodeURIComponent(closingData.whatsapp_text);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
    window.open(waUrl, "_blank");
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-emerald-500/20 overflow-hidden flex flex-col max-h-[94vh] my-auto">
        
        {/* ─── DRCREATE CLASSIC GREEN TOP HEADER BANNER ──────────────── */}
        <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 text-white p-4 sm:p-5 flex items-center justify-between shadow-lg relative overflow-hidden shrink-0">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
              <span className="material-symbols-outlined text-3xl text-white">receipt_long</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase drop-shadow-sm">
                  Day Closing Receipt
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider border border-white/30">
                  Daily Z-Report
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-semibold mt-0.5">
                {dbClinic.get()?.name || "Dr. Muhammad Asif Ashraf Khan Clinic"} • Day-End Financial Reconciliation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors font-black relative z-10"
          >
            ✕
          </button>
        </div>

        {/* ─── MAIN DUAL-PANEL BODY (DrCreate Style) ─────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* ─── LEFT: 80MM THERMAL RECEIPT PREVIEW (Exactly Matching UserForm12) ─── */}
            <div className="md:col-span-7 bg-white rounded-2xl border-2 border-gray-300/80 shadow-md p-5 font-sans relative">
              
              {/* Receipt Header Badge */}
              <div className="absolute top-2 left-4 text-[10px] font-black uppercase tracking-wider text-gray-400">
                [ RECEIPT PREVIEW — 80MM ESC/POS ]
              </div>

              {/* Clinic Logo Header */}
              <div className="text-center pt-2 pb-2 border-b border-gray-300">
                <img
                  src={clinicLogoPng}
                  alt="Clinic Logo"
                  className="max-h-16 max-w-[200px] mx-auto object-contain"
                />
              </div>

              {/* Date & Title */}
              <div className="flex items-center justify-between py-2 border-b border-gray-300 text-xs">
                <div>
                  <strong className="text-gray-600">Date:</strong>{" "}
                  <span className="font-mono font-black text-gray-900">{date}</span>
                </div>
                <div className="font-serif font-black text-sm text-gray-900 uppercase">
                  Day Closing Receipt
                </div>
              </div>

              {closingData ? (
                <div className="space-y-3 py-3 text-xs">
                  
                  {/* 1. SALE SECTION */}
                  <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between font-black text-gray-900 pb-1 border-b border-gray-200">
                      <span className="font-serif text-sm">Sale</span>
                      <span className="font-mono text-emerald-700 text-sm">
                        Rs. {closingData.sales.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-1.5 space-y-0.5 text-[11px] text-gray-700 font-medium">
                      <div className="flex items-center justify-between">
                        <span>Cash</span>
                        <span className="font-mono font-bold text-gray-900">
                          Rs. {closingData.sales.cash.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Credit</span>
                        <span className="font-mono font-bold text-rose-700">
                          Rs. {closingData.sales.credit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. PURCHASE SECTION */}
                  <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between font-black text-gray-900 pb-1 border-b border-gray-200">
                      <span className="font-serif text-sm">Purchase</span>
                      <span className="font-mono text-gray-900 text-sm">
                        Rs. {closingData.purchases.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-1.5 space-y-0.5 text-[11px] text-gray-700 font-medium">
                      <div className="flex items-center justify-between">
                        <span>Cash</span>
                        <span className="font-mono font-bold text-gray-900">
                          Rs. {closingData.purchases.cash.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Credit</span>
                        <span className="font-mono font-bold text-gray-600">
                          Rs. {closingData.purchases.credit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. PAYMENT PAID (Cash Outflows / Expenses) */}
                  <div className="border border-rose-200 rounded-xl p-3 bg-rose-50/30">
                    <div className="flex items-center justify-between font-black text-rose-950 pb-1 border-b border-rose-200">
                      <span className="font-serif text-sm">Payment Paid</span>
                      <span className="font-mono text-rose-700 text-sm">
                        Rs. {closingData.payments_paid.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="mt-2 max-h-28 overflow-y-auto divide-y divide-rose-100 text-[11px]">
                      {closingData.payments_paid.items.length === 0 ? (
                        <div className="py-2 text-center text-gray-400">No payments paid on this date.</div>
                      ) : (
                        closingData.payments_paid.items.map((it, idx) => (
                          <div key={idx} className="py-1 flex items-center justify-between text-gray-800">
                            <span className="font-bold truncate max-w-[200px]">{it.account_name}</span>
                            <span className="font-mono font-black text-rose-700 shrink-0">
                              Rs. {Number(it.amount || 0).toLocaleString("en-US")}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 4. PAYMENT RECEIVE (Cash Inflows) */}
                  <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/30">
                    <div className="flex items-center justify-between font-black text-emerald-950 pb-1 border-b border-emerald-200">
                      <span className="font-serif text-sm">Payment Receive</span>
                      <span className="font-mono text-emerald-700 text-sm">
                        Rs. {Number(closingData.payments_received.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="mt-2 max-h-28 overflow-y-auto divide-y divide-emerald-100 text-[11px]">
                      {closingData.payments_received.items.length === 0 ? (
                        <div className="py-2 text-center text-gray-400">No cash payments received on this date.</div>
                      ) : (
                        closingData.payments_received.items.map((it, idx) => (
                          <div key={idx} className="py-1 flex items-center justify-between text-gray-800">
                            <span className="font-bold truncate max-w-[200px]">{it.account_name}</span>
                            <span className="font-mono font-black text-emerald-700 shrink-0">
                              Rs. {Number(it.amount || 0).toLocaleString("en-US")}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 5. CLOSING CASH IN HAND (Grand Highlighted Box) */}
                  <div className="mt-4 pt-3 border-t-2 border-dashed border-gray-400 flex items-center justify-between bg-slate-900 text-white p-3.5 rounded-xl shadow-inner">
                    <span className="font-serif font-black text-base uppercase tracking-wide">
                      Closing Cash In Hand
                    </span>
                    <span className="font-mono font-black text-xl text-emerald-300">
                      Rs. {closingData.closing_cash.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-xs font-bold animate-pulse">
                  Loading Day Closing Data...
                </div>
              )}

              {/* Watermark Footer */}
              <div className="text-center pt-2 text-[9px] font-bold text-teal-800 border-t border-gray-200 mt-2">
                *** POWERED BY CLINICORE SOFTWARE *** &nbsp;|&nbsp; www.krishbaresa.tech
              </div>
            </div>

            {/* ─── RIGHT: INTERACTIVE CONTROL PANEL (DrCreate Style) ─────── */}
            <div className="md:col-span-5 space-y-4">
              
              {/* WhatsApp Sharing Card */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">chat</span>
                  <label className="text-xs font-black text-gray-800 uppercase tracking-wider">
                    WhatsApp No
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="03XXXXXXXXX"
                  value={whatsAppNo}
                  onChange={(e) => setWhatsAppNo(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-gray-900 focus:border-emerald-500 focus:outline-none shadow-inner"
                />
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-slate-900/20 flex items-center justify-center gap-2 active:scale-95"
                >
                  <span className="material-symbols-outlined text-base text-emerald-400">send</span>
                  Send WhatsApp Report
                </button>
              </div>

              {/* Status Indicator Box */}
              <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm">
                <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider">System Status</div>
                <div className="text-xs font-black text-emerald-700 mt-0.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  {statusMsg}
                </div>
              </div>

              {/* Date & Day of Week Inputs */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-black text-gray-900 bg-white focus:border-emerald-500 focus:outline-none shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Day of Week</label>
                  <input
                    type="text"
                    readOnly
                    value={dayOfWeekName}
                    className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-black text-gray-700 cursor-not-allowed shadow-inner"
                  />
                </div>
              </div>

              {/* Primary Action Buttons: Load & Print */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={loadData}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all shadow-md shadow-slate-900/20 flex items-center justify-center gap-2 active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">sync</span>
                  Load / Refresh Data
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  Print 80mm Closing Slip
                </button>
              </div>

            </div>

          </div>
        </div>

        {/* ─── FOOTER ─────────────────────────────────────────────────── */}
        <div className="bg-gray-100 px-6 py-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 font-bold shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>CliniCore Software • Day-End Closing Receipt Module</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-black transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
