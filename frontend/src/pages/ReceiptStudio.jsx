import { useState, useMemo, useEffect } from "react";
import { autoCropLogoImage } from "../utils/imageCompressor.js";
import { Link } from "react-router-dom";
import { CLINIC_LOGO_BASE64 } from "../utils/clinicLogoBase64.js";
import { formatDate } from "../utils/formatters.js";
import { executeThermalPrint } from "../utils/thermalPrinter.js";

const TEMPLATE_TYPES = [
  { id: "pos", name: "Retail Counter POS Receipt", icon: "point_of_sale", badge: "POS" },
  { id: "opd", name: "OPD Patient Token", icon: "confirmation_number", badge: "OPD" },
  { id: "b2b", name: "Wholesale B2B Invoice", icon: "inventory_2", badge: "B2B" },
  { id: "grn", name: "Supplier Purchase GRN", icon: "local_shipping", badge: "GRN" },
  { id: "closing", name: "Day-End Z-Closing Statement", icon: "summarize", badge: "AUDIT" },
];

const DEFAULT_BLOCKS = [
  { id: "header_logo", name: "Clinic Logo Image", enabled: true, category: "header", icon: "image", padY: 2, align: "center" },
  { id: "clinic_name", name: "Clinic / Store Title", enabled: true, category: "header", icon: "title", padY: 2, align: "center", customText: "" },
  { id: "tagline", name: "Tagline & Speciality", enabled: true, category: "header", icon: "subtitles", padY: 1, align: "center", customText: "" },
  { id: "contact_info", name: "Address & Phone Line", enabled: true, category: "header", icon: "call", padY: 2, align: "center", customText: "" },
  { id: "divider_1", name: "Dotted Divider Line", enabled: true, category: "layout", icon: "horizontal_rule", padY: 2 },
  { id: "meta_info", name: "Invoice # & Timestamp", enabled: true, category: "meta", icon: "calendar_today", padY: 2, align: "left" },
  { id: "customer_info", name: "Customer / Patient Details", enabled: true, category: "meta", icon: "person", padY: 2, align: "left" },
  { id: "doctor_info", name: "Doctor & Room Details", enabled: true, category: "meta", icon: "stethoscope", padY: 2, align: "left" },
  { id: "items_table", name: "Itemized Price Table", enabled: true, category: "body", icon: "table_rows", padY: 3 },
  { id: "divider_2", name: "Dotted Divider Line", enabled: true, category: "layout", icon: "horizontal_rule", padY: 2 },
  { id: "financial_totals", name: "Subtotal & Net Calculations", enabled: true, category: "totals", icon: "payments", padY: 3 },
  { id: "divider_3", name: "Dotted Divider Line", enabled: true, category: "layout", icon: "horizontal_rule", padY: 2 },
  { id: "urdu_footer", name: "Urdu Terms & Instructions", enabled: true, category: "footer", icon: "translate", padY: 3, align: "center" },
  { id: "custom_note", name: "Custom Policy / Return Note", enabled: true, category: "footer", icon: "notes", padY: 2, align: "center", customText: "Thanks for visiting! Get well soon." },
  { id: "powered_by", name: "Software Watermark (Permanent)", enabled: true, locked: true, isPermanent: true, category: "footer", icon: "verified", padY: 2, align: "center", customText: "*** Powered by CliniCore Software ***\nwww.krishbaresa.tech | 0314-2291356" },
];

export default function ReceiptStudio() {
  const [selectedTemplate, setSelectedTemplate] = useState("pos");
  const [activeTab, setActiveTab] = useState("blocks"); // "blocks" | "branding" | "tuner" | "typography"
  
  // Custom Header & Branding Config
  const [clinicConfig, setClinicConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("cf_receipt_custom_config");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      clinic_name: "Dr. Muhammad Kashif Khan Clinic & Wholesale Homoeo Store",
      tagline: "Homoeopathic Consultant & Bulk Distributors (Interior Sindh)",
      address: "Near Gul Center / Lajpat Road, Hyderabad, Sindh",
      phone: "0300-1234567 / 022-2780000",
      logo_base64: CLINIC_LOGO_BASE64,
      logo_size: 135,
      paper_width: "80mm",
      font_family: "monospace",
      urdu_footer_text: "نوٹ: خریدی ہوئی ادویات 3 دن میں تبدیل ہو سکتی ہیں۔ بغیر بل کے واپسی ممکن نہیں۔",
      custom_policy_note: "Thanks for visiting! Get well soon.",
      doctor_name: "Dr. Muhammad Kashif Khan",
      doctor_qualifications: "D.H.M.S, R.H.M.P, Consultant Homoeopath",
      doctor_room: "Room # 1",
    };
  });

  // Reorderable & Toggleable Block Structure
  const [blocks, setBlocks] = useState(() => {
    try {
      const saved = localStorage.getItem("cf_receipt_blocks_order");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_BLOCKS;
  });

  // Mock Dynamic Transaction Data for Live Calculations
  const [posData, setPosData] = useState({
    receipt_no: "POS-7861",
    customer_name: "Tariq Mehmood Memon",
    customer_phone: "0300-1122334",
    cashier_name: "Waheed Bhai",
    date: new Date().toISOString(),
    items: [
      { id: 1, name: "BM Drops No. 1 (Cardio)", qty: 2, price: 350, disc_pct: 10 },
      { id: 2, name: "Schwabe Cineraria Eye Drops", qty: 1, price: 550, disc_pct: 0 },
      { id: 3, name: "Paul Brooks Acid Phos Q", qty: 1, price: 420, disc_pct: 5 },
    ],
    overall_disc_flat: 0,
    paid_amount: 1550,
  });

  const [opdData] = useState({
    token_no: "01",
    patient_name: "Ghulam Murtaza Brohi",
    patient_relation: "S/O Haji Ali Bux",
    patient_phone: "0314-9988776",
    age: 45,
    gender: "Male",
    mr_no: "MR-1042",
    fee_amount: 500,
    fee_status: "Paid",
    doctor_name: "Dr. Muhammad Kashif Khan",
    room: "Room # 1",
    date: new Date().toISOString(),
  });

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Live Arithmetic Computation for POS Template
  const posCalculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;

    const computedItems = posData.items.map((it) => {
      const lineGross = it.qty * it.price;
      const lineDisc = (lineGross * (it.disc_pct || 0)) / 100;
      const lineNet = Math.max(0, lineGross - lineDisc);
      subtotal += lineGross;
      totalDiscount += lineDisc;
      return { ...it, lineGross, lineDisc, lineNet };
    });

    const netBill = Math.max(0, subtotal - totalDiscount - (Number(posData.overall_disc_flat) || 0));
    const paid = Number(posData.paid_amount) || 0;
    const changeReturn = Math.max(0, paid - netBill);
    const balanceDue = Math.max(0, netBill - paid);

    return {
      computedItems,
      subtotal,
      totalDiscount: totalDiscount + (Number(posData.overall_disc_flat) || 0),
      netBill,
      paid,
      changeReturn,
      balanceDue,
    };
  }, [posData]);

  // Handle Drag & Drop
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newBlocks = [...blocks];
    const draggedItem = newBlocks[draggedIndex];
    newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    setBlocks(newBlocks);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const moveBlock = (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const newBlocks = [...blocks];
    const item = newBlocks[index];
    newBlocks.splice(index, 1);
    newBlocks.splice(targetIndex, 0, item);
    setBlocks(newBlocks);
  };

  const toggleBlock = (id) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b))
    );
  };

  // Automatically auto-crop initial default logo on mount if needed
  useEffect(() => {
    const rawLogo = clinicConfig.logo_base64;
    if (rawLogo && rawLogo.length > 5000) {
      autoCropLogoImage(rawLogo, 400, 140)
        .then((cropped) => {
          if (cropped && cropped !== rawLogo) {
            setClinicConfig((prev) => ({ ...prev, logo_base64: cropped }));
          }
        })
        .catch(() => {});
    }
  }, [clinicConfig.logo_base64]);

  // Handle Logo Upload with Automatic Margin Cropping
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Auto-crop all empty margins & whitespace
      const croppedBase64 = await autoCropLogoImage(file, 420, 150);
      setClinicConfig((prev) => ({ ...prev, logo_base64: croppedBase64 }));
    } catch (err) {
      console.warn("Logo crop fallback:", err);
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setClinicConfig((prev) => ({ ...prev, logo_base64: uploadEvent.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveConfig = () => {
    try {
      localStorage.setItem("cf_receipt_custom_config", JSON.stringify(clinicConfig));
      localStorage.setItem("cf_receipt_blocks_order", JSON.stringify(blocks));
      alert("✅ Custom Receipt Template & Layout Order Saved to Local Storage!");
    } catch (err) {
      alert("Failed to save: " + err.message);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("Reset receipt layout order back to default factory styling?")) {
      setBlocks(DEFAULT_BLOCKS);
      localStorage.removeItem("cf_receipt_blocks_order");
    }
  };

  const handlePrintPreview = () => {
    const previewEl = document.getElementById("thermal-render-target");
    if (!previewEl) return;
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Preview_Receipt</title>
          <style>
            @page { size: ${clinicConfig.paper_width || "80mm"} auto; margin: 0; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
            body {
              font-family: ${clinicConfig.font_family === "sans" ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" : "monospace"};
              width: 76mm;
              margin: 0 auto;
              padding: 4px;
              color: #111827;
              background: #fff;
              font-size: 11px;
              line-height: 1.25;
            }
          </style>
        </head>
        <body>
          ${previewEl.innerHTML}
        </body>
      </html>
    `;
    executeThermalPrint(fullHtml, "Custom Receipt Preview");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header Bar matching CliniCore Teal Theme */}
      <header className="sticky top-0 z-30 bg-teal-900 text-white shadow-lg border-b border-teal-800">
        <div className="max-w-7xl mx-auto px-3 py-2.5 sm:px-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all shadow-inner shrink-0 cursor-pointer"
              title="Return to Super Admin Command Center"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">arrow_back</span>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span>Receipt Design Studio</span>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-800 text-teal-200 border border-teal-700">
                  UI/UX Pro Max
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-teal-200 font-medium truncate">
                Thermal canvas customizer &amp; live receipt arithmetic tuner
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none">
            <button
              onClick={handleResetDefaults}
              className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-2 rounded-xl bg-teal-800/80 hover:bg-teal-800 text-teal-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
              <span>Reset</span>
            </button>
            <button
              onClick={handleSaveConfig}
              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-teal-950 font-black text-xs flex items-center justify-center gap-1 shadow-md shadow-emerald-500/20 transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm sm:text-base">save</span>
              <span>Save</span>
            </button>
            <button
              onClick={handlePrintPreview}
              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl bg-white hover:bg-teal-50 text-teal-900 font-black text-xs flex items-center justify-center gap-1 shadow-md transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm sm:text-base">print</span>
              <span>80mm Test</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Grid */}
      <div className="max-w-7xl mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 min-w-0 overflow-x-hidden">
        
        {/* =================================================================== */}
        {/* LEFT COLUMN: Controls & Drag-Drop Studio (7 Columns)                */}
        {/* =================================================================== */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5 min-w-0">
          
          {/* Template Switcher Bar */}
          <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-teal-100 shadow-sm min-w-0">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[11px] sm:text-xs font-black text-teal-950 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-teal-600 text-sm">receipt</span>
                Active Receipt Mode
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">80mm ESC/POS</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
              {TEMPLATE_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`p-2 sm:p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer min-w-0 active:scale-95 ${
                    selectedTemplate === t.id
                      ? "bg-teal-50 border-teal-600 text-teal-900 shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="material-symbols-outlined text-base sm:text-lg text-teal-700">{t.icon}</span>
                  <span className="text-[10px] sm:text-[11px] font-bold leading-tight line-clamp-1 w-full">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sub Navigation Tabs (Scrollable on Mobile with Mobile Preview Switcher) */}
          <div className="flex bg-teal-100/60 p-1.5 rounded-2xl gap-1 overflow-x-auto scrollbar-none">
            {[
              { id: "blocks", label: "Blocks Order", icon: "drag_indicator" },
              { id: "branding", label: "Branding", icon: "storefront" },
              { id: "tuner", label: "Calculator", icon: "calculate" },
              { id: "typography", label: "Paper & Fonts", icon: "format_size" },
              { id: "mobile_preview", label: "Live Preview", icon: "visibility", mobileOnly: true },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[85px] sm:min-w-0 py-2 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 ${
                  tab.mobileOnly ? "lg:hidden" : ""
                } ${
                  activeTab === tab.id
                    ? "bg-white text-teal-900 shadow-sm font-black"
                    : "text-teal-800 hover:bg-white/50"
                }`}
              >
                <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: DRAG & DROP BLOCKS MANAGER */}
          {activeTab === "blocks" && (
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-teal-100 shadow-sm space-y-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">Receipt Sections Order &amp; Visibility</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Drag items up or down to re-order. Toggle checkbox to show or hide from printed receipt.
                  </p>
                </div>
                <span className="text-[10px] sm:text-xs font-black text-teal-800 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200 self-start sm:self-auto shrink-0">
                  {blocks.filter((b) => b.enabled).length} Active Blocks
                </span>
              </div>

              <div className="space-y-2 min-w-0">
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`p-2.5 sm:p-3 rounded-2xl border transition-all min-w-0 ${
                      draggedIndex === index
                        ? "bg-teal-50 border-teal-400 opacity-60 shadow-lg scale-[1.02]"
                        : block.enabled
                        ? "bg-white border-slate-200 hover:border-teal-300 shadow-xs"
                        : "bg-slate-50 border-slate-200 opacity-50"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-teal-700 shrink-0">
                          <span className="material-symbols-outlined text-base sm:text-lg">drag_indicator</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={block.isPermanent ? true : block.enabled}
                          disabled={block.isPermanent}
                          onChange={() => !block.isPermanent && toggleBlock(block.id)}
                          className={`w-4 h-4 rounded text-teal-600 focus:ring-teal-500 shrink-0 ${block.isPermanent ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
                        />
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span className="material-symbols-outlined text-sm sm:text-base text-teal-700 shrink-0">{block.icon}</span>
                          <span className="text-xs font-bold text-slate-900 truncate">{block.name}</span>
                          {block.isPermanent && (
                            <span className="text-[8.5px] sm:text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 shrink-0">
                              <span className="material-symbols-outlined text-[10px]">lock</span>
                              MANDATORY
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-100">
                        {/* Spacing / Padding Step Tuner */}
                        <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200" title="Vertical Spacing / Padding">
                          <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500">Pad:</span>
                          <button
                            onClick={() => {
                              const newBlocks = [...blocks];
                              newBlocks[index].padY = Math.max(0, (newBlocks[index].padY || 2) - 1);
                              setBlocks(newBlocks);
                            }}
                            className="text-xs font-black text-slate-600 hover:text-teal-800 px-1 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-[10px] font-black text-teal-900">{block.padY ?? 2}px</span>
                          <button
                            onClick={() => {
                              const newBlocks = [...blocks];
                              newBlocks[index].padY = Math.min(16, (newBlocks[index].padY || 2) + 1);
                              setBlocks(newBlocks);
                            }}
                            className="text-xs font-black text-slate-600 hover:text-teal-800 px-1 cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        {/* Move Up / Down Buttons */}
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => moveBlock(index, "up")}
                            disabled={index === 0}
                            className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 hover:text-teal-800 cursor-pointer"
                            title="Move Block Up"
                          >
                            <span className="material-symbols-outlined text-sm">arrow_upward</span>
                          </button>
                          <button
                            onClick={() => moveBlock(index, "down")}
                            disabled={index === blocks.length - 1}
                            className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 hover:text-teal-800 cursor-pointer"
                            title="Move Block Down"
                          >
                            <span className="material-symbols-outlined text-sm">arrow_downward</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Direct Inline Content & Label Editor for EVERY enabled block */}
                    {block.enabled && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 pl-8 space-y-1.5">
                        {block.id === "urdu_footer" ? (
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">Urdu Footer Content:</span>
                            <textarea
                              rows={2}
                              dir="rtl"
                              value={clinicConfig.urdu_footer_text}
                              onChange={(e) => setClinicConfig({ ...clinicConfig, urdu_footer_text: e.target.value })}
                              className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-urdu focus:outline-none focus:border-teal-600"
                            />
                          </div>
                        ) : block.id === "clinic_name" ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 shrink-0">Store Title:</span>
                            <input
                              type="text"
                              value={clinicConfig.clinic_name}
                              onChange={(e) => setClinicConfig({ ...clinicConfig, clinic_name: e.target.value })}
                              className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-teal-600"
                            />
                          </div>
                        ) : block.id === "tagline" ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 shrink-0">Tagline Text:</span>
                            <input
                              type="text"
                              value={clinicConfig.tagline}
                              onChange={(e) => setClinicConfig({ ...clinicConfig, tagline: e.target.value })}
                              className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-teal-600"
                            />
                          </div>
                        ) : block.id === "contact_info" ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 shrink-0">Phone:</span>
                              <input
                                type="text"
                                value={clinicConfig.phone}
                                onChange={(e) => setClinicConfig({ ...clinicConfig, phone: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 shrink-0">Address:</span>
                              <input
                                type="text"
                                value={clinicConfig.address}
                                onChange={(e) => setClinicConfig({ ...clinicConfig, address: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold"
                              />
                            </div>
                          </div>
                        ) : block.id === "doctor_info" ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 shrink-0">Doctor:</span>
                              <input
                                type="text"
                                value={clinicConfig.doctor_name}
                                onChange={(e) => setClinicConfig({ ...clinicConfig, doctor_name: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 shrink-0">Room:</span>
                              <input
                                type="text"
                                value={clinicConfig.doctor_room}
                                onChange={(e) => setClinicConfig({ ...clinicConfig, doctor_room: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold"
                              />
                            </div>
                          </div>
                        ) : block.id === "custom_note" ? (
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">Note / Policy (Multi-line supported):</span>
                            <textarea
                              rows={2}
                              value={block.customText || clinicConfig.custom_policy_note}
                              placeholder="Type note or policy (Press Enter for new line)..."
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[index].customText = e.target.value;
                                setBlocks(newBlocks);
                              }}
                              className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-teal-600 resize-y"
                            />
                          </div>
                        ) : block.id === "powered_by" ? (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-black text-teal-900 block">*** Powered by CliniCore Software ***</span>
                              <span className="text-[9.5px] font-bold text-slate-600 block">www.krishbaresa.tech &nbsp;|&nbsp; 0314-2291356</span>
                            </div>
                            <span className="text-[9.5px] font-black text-slate-500 bg-white border border-slate-300 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs">
                              <span className="material-symbols-outlined text-xs text-teal-600">verified</span>
                              Permanent Brand
                            </span>
                          </div>
                        ) : block.customText !== undefined || block.id.startsWith("custom_line_") ? (
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">Custom Text Block (Multi-line supported):</span>
                            <textarea
                              rows={2}
                              value={block.customText || ""}
                              placeholder="Type custom text (Press Enter for new line)..."
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[index].customText = e.target.value;
                                setBlocks(newBlocks);
                              }}
                              className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-teal-600 resize-y"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Dynamic layout component active</span>
                            <span className="font-semibold text-teal-800">Auto-formatted</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Custom New Block Action */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <button
                  onClick={() => {
                    const id = `custom_line_${Date.now()}`;
                    const newBlock = {
                      id,
                      name: "Custom Note / Notice Line",
                      enabled: true,
                      category: "custom",
                      icon: "edit_note",
                      padY: 2,
                      align: "center",
                      customText: "Emergency Helpline: 0300-1234567",
                    };
                    setBlocks([...blocks, newBlock]);
                  }}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Add Custom Text Line
                </button>

                <button
                  onClick={() => {
                    const id = `spacer_${Date.now()}`;
                    const newBlock = {
                      id,
                      name: "Custom Vertical Space Gap",
                      enabled: true,
                      category: "layout",
                      icon: "space_bar",
                      padY: 8,
                    };
                    setBlocks([...blocks, newBlock]);
                  }}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">vertical_align_center</span>
                  Add Empty Gap Spacer
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BRANDING & LOGO */}
          {activeTab === "branding" && (
            <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">storefront</span>
                Clinic Identity &amp; Header Customization
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Clinic / Store Name:</label>
                  <input
                    type="text"
                    value={clinicConfig.clinic_name}
                    onChange={(e) => setClinicConfig({ ...clinicConfig, clinic_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-teal-600 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tagline / Speciality:</label>
                  <input
                    type="text"
                    value={clinicConfig.tagline}
                    onChange={(e) => setClinicConfig({ ...clinicConfig, tagline: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-teal-600 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Helpline / Phone Number:</label>
                  <input
                    type="text"
                    value={clinicConfig.phone}
                    onChange={(e) => setClinicConfig({ ...clinicConfig, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-teal-600 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Address / Location:</label>
                  <input
                    type="text"
                    value={clinicConfig.address}
                    onChange={(e) => setClinicConfig({ ...clinicConfig, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-teal-600 bg-slate-50"
                  />
                </div>
              </div>

              {/* Logo Settings */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {clinicConfig.logo_base64 && (
                    <img src={clinicConfig.logo_base64} alt="Logo" className="w-14 h-10 object-contain bg-slate-100 p-1 rounded-lg border" />
                  )}
                  <label className="px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">upload</span>
                    Upload Custom Logo Image
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-600">Logo Size:</span>
                  <input
                    type="range"
                    min="80"
                    max="180"
                    value={clinicConfig.logo_size || 135}
                    onChange={(e) => setClinicConfig({ ...clinicConfig, logo_size: Number(e.target.value) })}
                    className="accent-teal-600 cursor-pointer"
                  />
                  <span className="font-mono text-slate-500">{clinicConfig.logo_size || 135}px</span>
                </div>
              </div>

              {/* Urdu Footer Editor */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1">Urdu Footer Note / Policy:</label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={clinicConfig.urdu_footer_text}
                  onChange={(e) => setClinicConfig({ ...clinicConfig, urdu_footer_text: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-urdu focus:outline-none focus:border-teal-600 bg-slate-50"
                />
              </div>
            </div>
          )}

          {/* TAB 3: LIVE CALCULATOR & PRICE TUNER */}
          {activeTab === "tuner" && (
            <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">calculate</span>
                Live Transaction &amp; Calculation Arithmetic Tuner
              </h3>
              <p className="text-xs text-slate-500">
                Modify quantities, unit prices, and trade discounts to inspect live math calculations with zero negative bounds.
              </p>

              <div className="space-y-2.5 min-w-0">
                {posData.items.map((item, idx) => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200 min-w-0">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...posData.items];
                        newItems[idx].name = e.target.value;
                        setPosData({ ...posData, items: newItems });
                      }}
                      className="flex-1 px-3 py-2 bg-white rounded-xl border border-slate-300 text-slate-900 font-bold min-w-0"
                      placeholder="Item Name"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 font-bold">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => {
                            const newItems = [...posData.items];
                            newItems[idx].qty = Math.max(1, Number(e.target.value));
                            setPosData({ ...posData, items: newItems });
                          }}
                          className="w-14 px-2 py-1.5 bg-white rounded-xl border border-slate-300 text-slate-900 font-bold text-center"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 font-bold">Rs:</span>
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => {
                            const newItems = [...posData.items];
                            newItems[idx].price = Math.max(0, Number(e.target.value));
                            setPosData({ ...posData, items: newItems });
                          }}
                          className="w-20 px-2 py-1.5 bg-white rounded-xl border border-slate-300 text-slate-900 font-bold text-right"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-rose-600 font-bold">-%:</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.disc_pct}
                          onChange={(e) => {
                            const newItems = [...posData.items];
                            newItems[idx].disc_pct = Math.min(100, Math.max(0, Number(e.target.value)));
                            setPosData({ ...posData, items: newItems });
                          }}
                          className="w-14 px-1.5 py-1.5 bg-white rounded-xl border border-slate-300 text-rose-700 font-bold text-center"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cash Received (Paid Amount):</label>
                  <input
                    type="number"
                    value={posData.paid_amount}
                    onChange={(e) => setPosData({ ...posData, paid_amount: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/60 border border-emerald-300 text-emerald-900 font-black text-sm text-right"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Overall Bill Discount (Rs Flat):</label>
                  <input
                    type="number"
                    value={posData.overall_disc_flat}
                    onChange={(e) => setPosData({ ...posData, overall_disc_flat: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-rose-50/60 border border-rose-300 text-rose-900 font-black text-sm text-right"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TYPOGRAPHY & PAPER WIDTH */}
          {activeTab === "typography" && (
            <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">format_size</span>
                Thermal Font &amp; Paper Roll Settings
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Paper Roll Width:</label>
                  <select
                    value={clinicConfig.paper_width}
                    onChange={(e) => setClinicConfig({ ...clinicConfig, paper_width: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="80mm">80mm (Standard POS Desktop Printers)</option>
                    <option value="58mm">58mm (Compact Mobile Handhelds)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Print Font Style:</label>
                  <select
                    value={clinicConfig.font_family}
                    onChange={(e) => setClinicConfig({ ...clinicConfig, font_family: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="monospace">Monospace (High Clarity Classic Thermal)</option>
                    <option value="sans">Clean Modern Sans-Serif</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: 100% Exact 80mm Live Thermal Paper Simulation (5 Cols) */}
        {/* =================================================================== */}
        <div className={`lg:col-span-5 flex flex-col items-center min-w-0 ${activeTab === "mobile_preview" ? "flex" : "hidden lg:flex"}`}>
          <div className="sticky top-20 w-full max-w-[340px] px-1 sm:px-0">
            <div className="text-center mb-3 font-bold text-xs text-teal-900 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Live 80mm Paper Roll Canvas
            </div>

            {/* Realistic Thermal Receipt Paper Card */}
            <div
              id="thermal-render-target"
              className="bg-white text-slate-900 p-4 sm:p-5 rounded-2xl shadow-xl border border-slate-200 text-[11px] leading-tight select-none min-w-0"
              style={{
                width: "100%",
                minHeight: "520px",
                fontFamily: clinicConfig.font_family === "sans" ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" : "monospace",
              }}
            >
              {/* Dynamic Block Render Engine based on User Drag-Drop Order */}
              {blocks
                .filter((b) => b.enabled)
                .map((block) => {
                  switch (block.id) {
                    case "header_logo":
                      return clinicConfig.logo_base64 ? (
                        <div key={block.id} style={{ paddingTop: `${block.padY ?? 2}px`, paddingBottom: `${block.padY ?? 2}px` }} className="text-center leading-none">
                          <img
                            src={clinicConfig.logo_base64}
                            alt="Logo"
                            style={{
                              maxWidth: `${clinicConfig.logo_size || 140}px`,
                              maxHeight: "85px",
                              width: "auto",
                              height: "auto",
                              display: "block",
                              margin: "0 auto",
                              objectFit: "contain",
                            }}
                          />
                        </div>
                      ) : null;

                    case "clinic_name":
                      return (
                        <div key={block.id} style={{ paddingTop: `${block.padY ?? 2}px`, paddingBottom: `${block.padY ?? 2}px` }} className="text-center">
                          <h2 className="font-black text-sm text-slate-900 leading-tight">
                            {block.customText || clinicConfig.clinic_name}
                          </h2>
                        </div>
                      );

                    case "tagline":
                      return (
                        <div key={block.id} style={{ paddingTop: `${block.padY ?? 1}px`, paddingBottom: `${block.padY ?? 1}px` }} className="text-center">
                          <p className="text-[10px] text-slate-600 font-semibold leading-tight mt-0.5">
                            {block.customText || clinicConfig.tagline}
                          </p>
                        </div>
                      );

                    case "contact_info":
                      return (
                        <div key={block.id} style={{ paddingTop: `${block.padY ?? 2}px`, paddingBottom: `${block.padY ?? 2}px` }} className="text-center text-[9.5px] text-slate-600 font-medium space-y-0.5 mt-0.5">
                          <p>{clinicConfig.address}</p>
                          <p className="font-bold text-slate-800">Phone: {clinicConfig.phone}</p>
                        </div>
                      );

                    case "divider_1":
                    case "divider_2":
                    case "divider_3":
                      return <div key={block.id} style={{ marginTop: `${block.padY ?? 2}px`, marginBottom: `${block.padY ?? 2}px` }} className="border-t border-dashed border-slate-400" />;

                    case "meta_info":
                      if (selectedTemplate === "opd") {
                        return (
                          <div key={block.id} className="py-1">
                            {/* Sleek, Ink-Saving Compact Token Header */}
                            <div className="flex items-center justify-between border-y border-slate-900 py-1.5 px-1 my-1 font-sans">
                              <div className="text-left">
                                <span className="text-[10px] uppercase font-bold text-slate-600 block leading-tight">Token Number</span>
                                <span className="text-lg font-black text-slate-900 leading-none">TOKEN #{opdData.token_no}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-700 block">{opdData.room}</span>
                                <span className="text-[9.5px] font-semibold text-slate-500">{formatDate(opdData.date)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (selectedTemplate === "b2b") {
                        return (
                          <div key={block.id}>
                            <div className="text-center font-bold text-[10px] uppercase text-slate-700 mb-1">Wholesale Tax Invoice</div>
                            <div className="flex justify-between text-[10px] font-bold">
                              <span>Inv: WHO-6218</span>
                              <span>Date: {formatDate(new Date())}</span>
                            </div>
                          </div>
                        );
                      }
                      if (selectedTemplate === "grn") {
                        return (
                          <div key={block.id}>
                            <div className="text-center font-bold text-[10px] uppercase text-slate-700 mb-1">Supplier Goods Receipt Note (GRN)</div>
                            <div className="flex justify-between text-[10px] font-bold">
                              <span>GRN: PUR-1042</span>
                              <span>Date: {formatDate(new Date())}</span>
                            </div>
                          </div>
                        );
                      }
                      if (selectedTemplate === "closing") {
                        return (
                          <div key={block.id}>
                            <div className="text-center font-bold text-[10px] uppercase text-slate-700 mb-1">Executive Shift Z-Closing Statement</div>
                            <div className="flex justify-between text-[10px] font-bold">
                              <span>Date: {formatDate(new Date())}</span>
                              <span>Time: 9:00 PM</span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={block.id} className="flex justify-between text-[10px] font-bold text-slate-700">
                          <span>Inv: {posData.receipt_no}</span>
                          <span>{formatDate(posData.date)}</span>
                        </div>
                      );

                    case "customer_info":
                      if (selectedTemplate === "opd") {
                        return (
                          <div key={block.id} className="text-left space-y-0.5 text-[10px] text-slate-700 my-1">
                            <div>Patient: <strong className="text-slate-900">{opdData.patient_name}</strong></div>
                            <div>Guardian: <span>{opdData.patient_relation}</span></div>
                            <div>Age / Gender: <span>{opdData.age} yrs • {opdData.gender}</span></div>
                            <div>Phone: <span>{opdData.patient_phone}</span></div>
                          </div>
                        );
                      }
                      if (selectedTemplate === "b2b") {
                        return (
                          <div key={block.id} className="text-[10px] text-slate-700 space-y-0.5 my-1">
                            <div>Party: <strong className="text-slate-900">Al-Rehman Homoeo Store (Tando Adam)</strong></div>
                            <div>City / Territory: <span>Tando Adam (Sindh)</span></div>
                            <div>Transport / Bilty: <span>Al-Madina Goods (#44102)</span></div>
                          </div>
                        );
                      }
                      if (selectedTemplate === "grn") {
                        return (
                          <div key={block.id} className="text-[10px] text-slate-700 space-y-0.5 my-1">
                            <div>Supplier: <strong className="text-slate-900">Dr. Willmar Schwabe Germany</strong></div>
                            <div>Carrier: <span>Karachi Goods Transport</span></div>
                          </div>
                        );
                      }
                      if (selectedTemplate === "closing") {
                        return (
                          <div key={block.id} className="text-[10px] text-slate-700 space-y-0.5 my-1">
                            <div>Closed By: <strong className="text-slate-900">Waheed Bhai (Cashier Desk)</strong></div>
                            <div>Audit Scope: <span>All Terminals &amp; Godowns</span></div>
                          </div>
                        );
                      }
                      return (
                        <div key={block.id} className="text-[10px] text-slate-600">
                          Customer: <span className="font-bold text-slate-900">{posData.customer_name}</span> ({posData.customer_phone})
                        </div>
                      );

                    case "doctor_info":
                      if (selectedTemplate === "opd") {
                        return (
                          <div key={block.id} className="text-[10px] text-slate-700 border-t border-slate-200 pt-1 mt-1">
                            <div>Consultant: <strong className="text-teal-900">{clinicConfig.doctor_name}</strong></div>
                            <div className="text-[9px] text-slate-500">{clinicConfig.doctor_qualifications}</div>
                          </div>
                        );
                      }
                      return (
                        <div key={block.id} className="text-[10px] text-slate-600 mb-1">
                          Consultant: <span className="font-bold">{clinicConfig.doctor_name}</span> ({clinicConfig.doctor_room})
                        </div>
                      );

                    case "items_table":
                      if (selectedTemplate === "opd") {
                        return (
                          <div key={block.id} className="flex justify-between font-bold text-[11px] border-y border-dashed border-slate-300 py-1.5 my-1">
                            <span>Consultation Fee:</span>
                            <span className="font-black text-teal-950">Rs. {opdData.fee_amount.toFixed(2)} ({opdData.fee_status})</span>
                          </div>
                        );
                      }
                      if (selectedTemplate === "b2b") {
                        return (
                          <div key={block.id}>
                            <div className="flex justify-between font-black text-[10px] text-slate-800 uppercase py-0.5 border-y border-dashed border-slate-300">
                              <span>Carton / Medicine</span>
                              <span>Amount</span>
                            </div>
                            <div className="divide-y divide-dotted divide-slate-200 my-1 text-[10.5px]">
                              <div className="py-1 flex justify-between">
                                <span>10 Boxes BM Cardio Drops #1</span>
                                <span className="font-bold">Rs. 3,500.00</span>
                              </div>
                              <div className="py-1 flex justify-between">
                                <span>5 Boxes Schwabe Cineraria Eye Drops</span>
                                <span className="font-bold">Rs. 2,750.00</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (selectedTemplate === "grn") {
                        return (
                          <div key={block.id}>
                            <div className="flex justify-between font-black text-[10px] text-slate-800 uppercase py-0.5 border-y border-dashed border-slate-300">
                              <span>Inward Medicine Batch</span>
                              <span>Cost Total</span>
                            </div>
                            <div className="divide-y divide-dotted divide-slate-200 my-1 text-[10.5px]">
                              <div className="py-1 flex justify-between">
                                <span>50 Units Schwabe Drops (Batch #982)</span>
                                <span className="font-bold">Rs. 18,500.00</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (selectedTemplate === "closing") {
                        return (
                          <div key={block.id} className="space-y-1 my-1 text-[10.5px]">
                            <div className="flex justify-between">
                              <span>• OPD Doctor Consultation Fees:</span>
                              <span className="font-bold">Rs. 12,500</span>
                            </div>
                            <div className="flex justify-between">
                              <span>• Retail Counter POS Sales:</span>
                              <span className="font-bold">Rs. 34,200</span>
                            </div>
                            <div className="flex justify-between">
                              <span>• Wholesale Godown Sales:</span>
                              <span className="font-bold">Rs. 45,000</span>
                            </div>
                            <div className="flex justify-between text-rose-700">
                              <span>• Operational Expenses:</span>
                              <span className="font-bold">- Rs. 3,400</span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={block.id}>
                          <div className="flex justify-between font-black text-[10px] text-slate-800 uppercase py-0.5 border-y border-dashed border-slate-300">
                            <span>Item Description</span>
                            <span>Amount</span>
                          </div>
                          <div className="divide-y divide-dotted divide-slate-200 my-1">
                            {posCalculations.computedItems.map((it) => (
                              <div key={it.id} className="py-1">
                                <div className="font-bold text-[11px] text-slate-900 flex justify-between">
                                  <span>{it.name}</span>
                                  {it.disc_pct > 0 && <span className="text-rose-700 text-[9.5px]">(-{it.disc_pct}%)</span>}
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-600">
                                  <span>{it.qty} × Rs. {it.price.toFixed(2)}</span>
                                  <span className="font-bold text-slate-900">Rs. {it.lineNet.toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );

                    case "financial_totals":
                      if (selectedTemplate === "opd") {
                        return (
                          <div key={block.id} className="text-center font-mono text-[10px] text-slate-500 pt-1">
                            MR No: <strong className="text-slate-800">{opdData.mr_no}</strong> • Status: Valid for Today Only
                          </div>
                        );
                      }
                      if (selectedTemplate === "b2b") {
                        return (
                          <div key={block.id} className="space-y-0.5 text-[11px] pt-1 border-t border-slate-300">
                            <div className="flex justify-between font-black text-sm text-slate-900">
                              <span>NET INVOICE BILL:</span>
                              <span>Rs. 6,250.00</span>
                            </div>
                            <div className="flex justify-between font-bold text-rose-800 bg-rose-50 px-1 py-0.5 rounded">
                              <span>Party Udhaar (Due):</span>
                              <span>Rs. 6,250.00</span>
                            </div>
                          </div>
                        );
                      }
                      if (selectedTemplate === "grn") {
                        return (
                          <div key={block.id} className="space-y-0.5 text-[11px] pt-1 border-t border-slate-300">
                            <div className="flex justify-between font-black text-sm text-slate-900">
                              <span>TOTAL GRN BILL:</span>
                              <span>Rs. 18,500.00</span>
                            </div>
                            <div className="flex justify-between font-bold text-slate-700">
                              <span>Supplier Payable Due:</span>
                              <span>Rs. 18,500.00</span>
                            </div>
                          </div>
                        );
                      }
                      if (selectedTemplate === "closing") {
                        return (
                          <div key={block.id} className="pt-1.5 border-t-2 border-slate-800 flex justify-between font-black text-sm text-teal-950">
                            <span>NET CASH IN HAND:</span>
                            <span>Rs. 88,300.00</span>
                          </div>
                        );
                      }
                      return (
                        <div key={block.id} className="space-y-0.5 text-[11px]">
                          <div className="flex justify-between text-slate-600">
                            <span>Subtotal Gross:</span>
                            <span>Rs. {posCalculations.subtotal.toFixed(2)}</span>
                          </div>

                          {posCalculations.totalDiscount > 0 && (
                            <div className="flex justify-between text-rose-700 font-bold">
                              <span>Total Trade Discount:</span>
                              <span>- Rs. {posCalculations.totalDiscount.toFixed(2)}</span>
                            </div>
                          )}

                          <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-300">
                            <span>NET TOTAL BILL:</span>
                            <span>Rs. {posCalculations.netBill.toFixed(2)}</span>
                          </div>

                          <div className="flex justify-between font-bold text-emerald-800 pt-0.5">
                            <span>Cash Paid:</span>
                            <span>Rs. {posCalculations.paid.toFixed(2)}</span>
                          </div>

                          {posCalculations.changeReturn > 0 && (
                            <div className="flex justify-between font-black text-slate-900">
                              <span>Change Returned:</span>
                              <span>Rs. {posCalculations.changeReturn.toFixed(2)}</span>
                            </div>
                          )}

                          {posCalculations.balanceDue > 0 && (
                            <div className="flex justify-between font-black text-rose-800 bg-rose-50 px-1 py-0.5 rounded">
                              <span>Udhaar (Balance Due):</span>
                              <span>Rs. {posCalculations.balanceDue.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      );

                    case "urdu_footer":
                      return clinicConfig.urdu_footer_text ? (
                        <div key={block.id} className="mt-3 pt-2 text-center font-urdu text-[10.5px] text-slate-800 leading-snug" dir="rtl">
                          {clinicConfig.urdu_footer_text}
                        </div>
                      ) : null;

                    case "custom_note":
                      return (block.customText || clinicConfig.custom_policy_note) ? (
                        <div key={block.id} style={{ paddingTop: `${block.padY ?? 2}px`, paddingBottom: `${block.padY ?? 2}px` }} className="text-center text-[9.5px] text-slate-600 font-semibold italic whitespace-pre-line">
                          {block.customText || clinicConfig.custom_policy_note}
                        </div>
                      ) : null;

                    case "powered_by":
                      return (
                        <div key={block.id} style={{ paddingTop: `${block.padY ?? 3}px`, paddingBottom: `${block.padY ?? 2}px` }} className="text-center text-[8.5px] text-slate-500 font-bold uppercase tracking-wider border-t border-dashed border-slate-300 mt-2.5 pt-1">
                          <span className="text-teal-900 font-black block leading-tight">*** POWERED BY CLINICORE SOFTWARE ***</span>
                          <span className="text-slate-700 font-bold normal-case tracking-normal block text-[9px] leading-tight mt-0.5">
                            www.krishbaresa.tech &nbsp;|&nbsp; 0314-2291356
                          </span>
                        </div>
                      );

                    default:
                      // Support user created custom text blocks & spacers
                      if (block.id.startsWith("custom_line_")) {
                        return (
                          <div key={block.id} style={{ paddingTop: `${block.padY ?? 2}px`, paddingBottom: `${block.padY ?? 2}px` }} className="text-center text-[10px] font-bold text-slate-800 whitespace-pre-line">
                            {block.customText}
                          </div>
                        );
                      }
                      if (block.id.startsWith("spacer_")) {
                        return (
                          <div key={block.id} style={{ height: `${block.padY ?? 8}px` }} />
                        );
                      }
                      return null;
                  }
                })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
