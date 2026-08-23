import { useState, useMemo } from "react";
import { CLINIC_LOGO_BASE64 } from "../utils/clinicLogoBase64.js";
import { formatPKR, formatDate } from "../utils/formatters.js";
import { executeThermalPrint } from "../utils/thermalPrinter.js";

const TEMPLATE_TYPES = [
  { id: "pos", name: "Retail Counter POS Receipt", icon: "point_of_sale" },
  { id: "opd", name: "OPD Patient Token", icon: "confirmation_number" },
  { id: "b2b", name: "Wholesale B2B Invoice", icon: "inventory_2" },
  { id: "grn", name: "Supplier Purchase GRN", icon: "local_shipping" },
  { id: "closing", name: "Day-End Z-Closing Statement", icon: "summarize" },
];

export default function ReceiptStudio() {
  const [selectedTemplate, setSelectedTemplate] = useState("pos");
  
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
      show_logo: true,
      show_tagline: true,
      show_doctor_info: true,
      show_urdu_footer: true,
      show_barcode: true,
      urdu_footer_text: "نوٹ: خریدی ہوئی ادویات 3 دن میں تبدیل ہو سکتی ہیں۔ بغیر بل کے واپسی ممکن نہیں۔",
      doctor_name: "Dr. Muhammad Kashif Khan",
      doctor_qualifications: "D.H.M.S, R.H.M.P, Consultant Homoeopath",
      doctor_room: "Room # 1",
    };
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

  const [opdData, setOpdData] = useState({
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

  // Handle Logo Upload
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setClinicConfig((prev) => ({ ...prev, logo_base64: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveConfig = () => {
    try {
      localStorage.setItem("cf_receipt_custom_config", JSON.stringify(clinicConfig));
      alert("✅ Custom Receipt Template Saved to Local Storage!");
    } catch (err) {
      alert("Failed to save: " + err.message);
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
            @page { size: 80mm auto; margin: 0; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      {/* Top Header */}
      <header className="max-w-7xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-2xl">receipt_long</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              CliniCore Receipt Studio &amp; Template Customizer
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Visual Lab
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Customize thermal headers, logos, formatting, and live calculate arithmetic before production rollout.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveConfig}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-teal-600/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">save</span>
            Save Template Defaults
          </button>
          <button
            onClick={handlePrintPreview}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">print</span>
            Test Print (80mm)
          </button>
        </div>
      </header>

      {/* Main Split Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* =================================================================== */}
        {/* LEFT COLUMN: Controls & Input Studio (7 Columns)                    */}
        {/* =================================================================== */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 1. Template Switcher */}
          <div className="bg-slate-800/80 rounded-3xl p-5 border border-slate-700/60 backdrop-blur-md shadow-xl">
            <h3 className="text-xs font-black text-teal-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">layers</span>
              Select Receipt Template
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TEMPLATE_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                    selectedTemplate === t.id
                      ? "bg-teal-600/20 border-teal-400 text-white shadow-md shadow-teal-500/10"
                      : "bg-slate-900/60 border-slate-700/80 text-slate-400 hover:bg-slate-700/40"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg text-teal-400">{t.icon}</span>
                  <span className="text-xs font-bold">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Clinic Identity & Header Customization */}
          <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/60 backdrop-blur-md shadow-xl space-y-4">
            <h3 className="text-xs font-black text-teal-400 uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-base">storefront</span>
              Branding &amp; Header Customization
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Clinic / Store Name:</label>
                <input
                  type="text"
                  value={clinicConfig.clinic_name}
                  onChange={(e) => setClinicConfig({ ...clinicConfig, clinic_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 font-semibold focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Tagline / Speciality:</label>
                <input
                  type="text"
                  value={clinicConfig.tagline}
                  onChange={(e) => setClinicConfig({ ...clinicConfig, tagline: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 font-semibold focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Phone / Helpline:</label>
                <input
                  type="text"
                  value={clinicConfig.phone}
                  onChange={(e) => setClinicConfig({ ...clinicConfig, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 font-semibold focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Address / Location:</label>
                <input
                  type="text"
                  value={clinicConfig.address}
                  onChange={(e) => setClinicConfig({ ...clinicConfig, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 font-semibold focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Logo Management */}
            <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="toggle-logo"
                  checked={clinicConfig.show_logo}
                  onChange={(e) => setClinicConfig({ ...clinicConfig, show_logo: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <label htmlFor="toggle-logo" className="text-xs font-bold text-slate-300 cursor-pointer">
                  Show Clinic Logo in Receipt Header
                </label>
              </div>

              <label className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">upload</span>
                Upload Custom Logo
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
          </div>

          {/* 3. Section Toggles */}
          <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/60 backdrop-blur-md shadow-xl space-y-3">
            <h3 className="text-xs font-black text-teal-400 uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-base">tune</span>
              Template Sections &amp; Footer Notes
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-700/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clinicConfig.show_doctor_info}
                  onChange={(e) => setClinicConfig({ ...clinicConfig, show_doctor_info: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-600"
                />
                <span className="font-bold text-slate-200">Show Doctor Name &amp; Room #</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-700/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clinicConfig.show_urdu_footer}
                  onChange={(e) => setClinicConfig({ ...clinicConfig, show_urdu_footer: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-600"
                />
                <span className="font-bold text-slate-200">Show Urdu Instructions Note</span>
              </label>
            </div>

            {clinicConfig.show_urdu_footer && (
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">Urdu Footer Note:</label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={clinicConfig.urdu_footer_text}
                  onChange={(e) => setClinicConfig({ ...clinicConfig, urdu_footer_text: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 text-sm font-urdu focus:outline-none focus:border-teal-500"
                />
              </div>
            )}
          </div>

          {/* 4. Live Calculation Data Tuner */}
          {selectedTemplate === "pos" && (
            <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/60 backdrop-blur-md shadow-xl space-y-4">
              <h3 className="text-xs font-black text-teal-400 uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-base">calculate</span>
                Live Transaction &amp; Calculation Tuner
              </h3>

              <div className="space-y-2">
                {posData.items.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center text-xs bg-slate-900/70 p-2.5 rounded-xl border border-slate-700/80">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...posData.items];
                        newItems[idx].name = e.target.value;
                        setPosData({ ...posData, items: newItems });
                      }}
                      className="col-span-5 px-2 py-1 bg-slate-800 rounded-lg border border-slate-700 text-white font-bold"
                    />
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => {
                          const newItems = [...posData.items];
                          newItems[idx].qty = Math.max(1, Number(e.target.value));
                          setPosData({ ...posData, items: newItems });
                        }}
                        className="w-full px-1.5 py-1 bg-slate-800 rounded-lg border border-slate-700 text-white font-bold text-center"
                      />
                    </div>
                    <div className="col-span-3 flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Rs:</span>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => {
                          const newItems = [...posData.items];
                          newItems[idx].price = Math.max(0, Number(e.target.value));
                          setPosData({ ...posData, items: newItems });
                        }}
                        className="w-full px-1.5 py-1 bg-slate-800 rounded-lg border border-slate-700 text-white font-bold text-right"
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="text-[10px] text-rose-400">-%:</span>
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
                        className="w-full px-1.5 py-1 bg-slate-800 rounded-lg border border-slate-700 text-rose-300 font-bold text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Cash Received (Paid):</label>
                  <input
                    type="number"
                    value={posData.paid_amount}
                    onChange={(e) => setPosData({ ...posData, paid_amount: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-emerald-400 font-black text-sm text-right"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Overall Flat Discount (Rs):</label>
                  <input
                    type="number"
                    value={posData.overall_disc_flat}
                    onChange={(e) => setPosData({ ...posData, overall_disc_flat: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-rose-400 font-black text-sm text-right"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: 100% Exact 80mm Live Thermal Paper Simulation (5 Cols) */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="sticky top-6 w-full max-w-[340px]">
            <div className="text-center mb-2 font-bold text-xs text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              80mm Paper Roll Live Preview
            </div>

            {/* Realistic Thermal Receipt Paper Card */}
            <div
              id="thermal-render-target"
              className="bg-white text-slate-900 p-5 rounded-2xl shadow-2xl border-t-8 border-teal-600 font-mono text-[11px] leading-tight select-none"
              style={{ width: "100%", minHeight: "480px" }}
            >
              {/* Header Logo */}
              {clinicConfig.show_logo && clinicConfig.logo_base64 && (
                <div className="text-center mb-2">
                  <img
                    src={clinicConfig.logo_base64}
                    alt="Logo"
                    className="max-w-[130px] h-auto mx-auto block object-contain"
                  />
                </div>
              )}

              {/* Clinic Name & Tagline */}
              <div className="text-center font-sans space-y-0.5 mb-2">
                <h2 className="font-black text-sm text-slate-900 leading-tight">
                  {clinicConfig.clinic_name}
                </h2>
                {clinicConfig.show_tagline && (
                  <p className="text-[10px] text-slate-600 font-semibold leading-tight">
                    {clinicConfig.tagline}
                  </p>
                )}
                <p className="text-[9.5px] text-slate-500 font-medium">{clinicConfig.address}</p>
                <p className="text-[10px] font-bold text-slate-800">Phone: {clinicConfig.phone}</p>
              </div>

              <div className="border-t border-dashed border-slate-400 my-2" />

              {/* ==================== POS RECEIPT BODY ==================== */}
              {selectedTemplate === "pos" && (
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-700">
                    <span>Inv: {posData.receipt_no}</span>
                    <span>{formatDate(posData.date)}</span>
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Customer: <span className="font-bold text-slate-900">{posData.customer_name}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 mb-2">
                    Cashier: <span className="font-bold">{posData.cashier_name}</span>
                  </div>

                  <div className="border-t border-dashed border-slate-400 my-1" />

                  {/* Items Header */}
                  <div className="flex justify-between font-black text-[10px] text-slate-800 uppercase py-0.5">
                    <span>Item Description</span>
                    <span>Amount</span>
                  </div>

                  {/* Items List */}
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

                  <div className="border-t border-dashed border-slate-400 my-1.5" />

                  {/* Financial Summary */}
                  <div className="space-y-0.5 text-[11px]">
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
                </div>
              )}

              {/* ==================== OPD TOKEN BODY ==================== */}
              {selectedTemplate === "opd" && (
                <div className="text-center py-1">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-700">OPD Consultation Token</div>
                  
                  {/* Huge Token Circle */}
                  <div className="my-2 py-3 bg-teal-50 border-2 border-teal-700 rounded-2xl">
                    <div className="text-[10px] font-bold text-teal-800 uppercase">Your Token Number</div>
                    <div className="text-4xl font-black text-teal-900 my-0.5">#{opdData.token_no}</div>
                    <div className="text-[10px] font-bold text-slate-600">{opdData.room}</div>
                  </div>

                  <div className="text-left space-y-0.5 text-[10px] text-slate-700 my-2">
                    <div>Patient: <span className="font-black text-slate-900">{opdData.patient_name}</span></div>
                    <div>Guardian: <span>{opdData.patient_relation}</span></div>
                    <div>Age / Gender: <span>{opdData.age} yrs • {opdData.gender}</span></div>
                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span>Fee: <strong className="text-slate-900">Rs. {opdData.fee_amount}</strong> ({opdData.fee_status})</span>
                      <span>MR#: {opdData.mr_no}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== B2B INVOICE BODY ==================== */}
              {selectedTemplate === "b2b" && (
                <div>
                  <div className="text-center font-bold text-[10px] uppercase text-slate-700 mb-1">Wholesale Tax Invoice</div>
                  <div className="flex justify-between text-[10px]">
                    <span>Inv: WHO-6218</span>
                    <span>Date: {formatDate(new Date())}</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-900">Party: Al-Rehman Homoeo (Tando Adam)</div>
                  <div className="text-[9.5px] text-slate-600 mb-2">Transport: Al-Madina Goods (Bilty # 44102)</div>

                  <div className="border-t border-dashed border-slate-400 my-1" />
                  <div className="py-1 text-[10px]">
                    <div className="flex justify-between font-bold">
                      <span>10 Boxes BM Drops #1</span>
                      <span>Rs. 3,500.00</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>5 Boxes Schwabe Eye Drops</span>
                      <span>Rs. 2,750.00</span>
                    </div>
                  </div>
                  <div className="border-t border-dashed border-slate-400 my-1.5" />
                  <div className="flex justify-between font-black text-xs">
                    <span>TOTAL INVOICE:</span>
                    <span>Rs. 6,250.00</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-rose-700">
                    <span>Party Udhaar Due:</span>
                    <span>Rs. 6,250.00</span>
                  </div>
                </div>
              )}

              {/* ==================== DAY-END CLOSING BODY ==================== */}
              {selectedTemplate === "closing" && (
                <div className="text-left space-y-1">
                  <div className="text-center font-bold text-[10px] uppercase text-slate-700 mb-1">Executive Shift Z-Closing</div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>Date: {formatDate(new Date())}</span>
                    <span>Time: 9:00 PM</span>
                  </div>
                  <div className="border-t border-dashed border-slate-400 my-1" />
                  <div className="flex justify-between text-[10.5px]">
                    <span>• OPD Doctor Fees:</span>
                    <span className="font-bold">Rs. 12,500</span>
                  </div>
                  <div className="flex justify-between text-[10.5px]">
                    <span>• Retail POS Pharmacy:</span>
                    <span className="font-bold">Rs. 34,200</span>
                  </div>
                  <div className="flex justify-between text-[10.5px]">
                    <span>• Wholesale Godown Sales:</span>
                    <span className="font-bold">Rs. 45,000</span>
                  </div>
                  <div className="flex justify-between text-[10.5px] text-rose-700">
                    <span>• Operational Expenses:</span>
                    <span className="font-bold">- Rs. 3,400</span>
                  </div>
                  <div className="border-t border-slate-300 pt-1 flex justify-between font-black text-xs text-teal-950">
                    <span>NET CASH IN HAND:</span>
                    <span>Rs. 88,300</span>
                  </div>
                </div>
              )}

              {/* Urdu Footer Instructions */}
              {clinicConfig.show_urdu_footer && clinicConfig.urdu_footer_text && (
                <div className="mt-3 pt-2 border-t border-dashed border-slate-400 text-center font-urdu text-[10.5px] text-slate-800 leading-snug" dir="rtl">
                  {clinicConfig.urdu_footer_text}
                </div>
              )}

              {/* Powered By Footer */}
              <div className="mt-2 text-center text-[8.5px] text-slate-400 font-sans tracking-wider uppercase">
                *** Powered by CliniCore Software ***
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
