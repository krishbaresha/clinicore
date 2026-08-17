import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("opd");

  const modules = [
    {
      id: "opd",
      title: "OPD Tokens & Queue",
      icon: "confirmation_number",
      badge: "Zero Waiting Chaos",
      heading: "Instant 80mm Thermal Token Generation with Doctor Chamber Routing",
      desc: "Register patients in under 15 seconds. Issue thermal slips with assigned doctor chamber room number, smart age auto-advancement, and duplicate token prevention.",
      highlights: [
        "1-Click 80mm thermal token receipt printer engine",
        "Assigned doctor and chamber room number on every slip",
        "Smart dynamic age calculation with zero compulsory fields",
        "Duplicate active token safeguard to prevent double-booking",
      ],
      previewGradient: "from-teal-600 to-emerald-700",
      previewBadge: "OPD Chamber Dispatcher",
    },
    {
      id: "live_tv",
      title: "Public TV Screen",
      icon: "tv",
      badge: "100% Privacy Safe",
      heading: "Airport-Grade Waiting Lounge Display Screen (/live)",
      desc: "Mount any smart TV or browser in the clinic waiting area. Display live tokens, doctor availability statuses (🟢 Available, 🟡 Break, 🔴 Away), and gentle dual-tone hospital audio chimes.",
      highlights: [
        "Zero privacy breach: displays only Token # and Chamber (No patient names)",
        "Gentle Web Audio API dual-tone hospital chime on token calls",
        "Live Doctor status bars updated directly by doctor or reception",
        "Built-in 1-click Dark TV Lounge & Fullscreen modes",
      ],
      previewGradient: "from-cyan-700 to-teal-800",
      previewBadge: "Live Waiting Lounge Hub",
    },
    {
      id: "emr",
      title: "Doctor Chamber & EMR",
      icon: "stethoscope",
      badge: "0.2s Search",
      heading: "Lightning Fast Patient History, Paperless Rx & Camera Snapshots",
      desc: "Instantly pull up 5-year patient history by phone number or name. Capture physical prescription photos via high-res camera and manage diagnostic reports with zero paperwork.",
      highlights: [
        "Instant patient history search across years in 0.2s",
        "Camera snapshot capture for physical paper prescriptions",
        "Diagnostic lab report tracking and pending image uploads",
        "1-click follow-up scheduling and digital Rx generation",
      ],
      previewGradient: "from-emerald-700 to-teal-900",
      previewBadge: "Clinical EMR Workstation",
    },
    {
      id: "pos",
      title: "Pharmacy POS & Inventory",
      icon: "local_pharmacy",
      badge: "2-Tier Warehouse",
      heading: "Integrated Medical Store POS, Batch Expiry & Supplier Purchases",
      desc: "Seamlessly bill walk-in or clinic-linked patients with barcode POS. Track main godown stock, inter-counter branch transfers, supplier purchase ledgers, and customer khata balances.",
      highlights: [
        "Rapid barcode thermal POS billing with automatic stock deduction",
        "2-tier warehouse management: Main godown to counter transfer",
        "Supplier purchase bills, batch expiry tracking & payable ledgers",
        "Customer khata balance management with 1-click payment receiving",
      ],
      previewGradient: "from-teal-800 to-slate-900",
      previewBadge: "Pharmacy & Godown POS",
    },
  ];

  const currentModule = modules.find((m) => m.id === activeTab) || modules[0];

  return (
    <div className="min-h-screen bg-[#f8faf9] text-[#181c1c] font-sans selection:bg-teal-500 selection:text-white flex flex-col">
      {/* ─── STICKY NAVBAR ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-teal-100/80 shadow-[0_4px_24px_rgba(15,118,110,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-700 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-700/25 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                medical_services
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-teal-950">ClinicFlow</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  Enterprise
                </span>
              </div>
              <p className="text-[11px] font-semibold text-gray-500">by K.B Software</p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-600">
            <a href="#features" className="hover:text-teal-700 transition-colors">Features</a>
            <a href="#modules" className="hover:text-teal-700 transition-colors">Clinical Modules</a>
            <a href="#workflow" className="hover:text-teal-700 transition-colors">How It Works</a>
            <a href="#contact" className="hover:text-teal-700 transition-colors">Contact Developer</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {/* Live TV Screen Button */}
            <Link
              to="/live"
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-all shadow-xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live TV Screen
            </Link>

            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 transition-all shadow-md shadow-teal-600/25 hover:shadow-lg hover:shadow-teal-600/35"
              >
                <span className="material-symbols-outlined text-lg">dashboard</span>
                Go to Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 transition-all shadow-md shadow-teal-600/25 hover:shadow-lg hover:shadow-teal-600/35"
              >
                <span className="material-symbols-outlined text-lg">lock</span>
                Staff Portal Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION ─────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        {/* Decorative Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-teal-100/60 via-emerald-50/40 to-transparent blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs sm:text-sm font-bold shadow-xs mb-6 animate-bounce">
            <span className="text-base">✨</span>
            The Modern Clinic, OPD Queue & Pharmacy Operating System
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-teal-950 max-w-4xl mx-auto leading-[1.15]">
            Run Your Clinic & Pharmacy with{" "}
            <span className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
              Zero Waiting Chaos
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto font-medium leading-relaxed">
            Smart 80mm thermal token ticketing, multi-doctor chamber routing, real-time public TV waiting lounge, paperless EMR with camera archiving, and integrated barcode pharmacy inventory.
          </p>

          {/* Hero Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to={user ? "/dashboard" : "/login"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-base font-extrabold bg-gradient-to-r from-teal-700 to-teal-600 text-white shadow-xl shadow-teal-700/25 hover:shadow-2xl hover:shadow-teal-700/35 hover:-translate-y-0.5 transition-all"
            >
              <span className="material-symbols-outlined text-2xl">rocket_launch</span>
              Access Staff Portal
            </Link>

            <Link
              to="/live"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold bg-white text-teal-900 border border-teal-200 hover:bg-teal-50 shadow-sm hover:shadow-md transition-all"
            >
              <span className="material-symbols-outlined text-2xl text-teal-600">tv</span>
              Open Waiting Lounge Screen (/live)
            </Link>

            <a
              href="https://wa.me/923142291356?text=Hi%20K.B%20Software,%20I%20am%20interested%20in%20ClinicFlow%20System."
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-2xl text-emerald-600">chat</span>
              WhatsApp Inquiry
            </a>
          </div>

          {/* Metric Badges */}
          <div className="mt-12 pt-8 border-t border-teal-100/80 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 bg-white/70 backdrop-blur rounded-2xl border border-teal-100 shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-teal-900">0.2s</div>
              <div className="text-xs font-semibold text-gray-500 mt-1">Patient History Retrieval</div>
            </div>
            <div className="p-4 bg-white/70 backdrop-blur rounded-2xl border border-teal-100 shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-teal-900">80mm</div>
              <div className="text-xs font-semibold text-gray-500 mt-1">Native Thermal Printer Engine</div>
            </div>
            <div className="p-4 bg-white/70 backdrop-blur rounded-2xl border border-teal-100 shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-teal-900">100%</div>
              <div className="text-xs font-semibold text-gray-500 mt-1">Patient Privacy Guaranteed</div>
            </div>
            <div className="p-4 bg-white/70 backdrop-blur rounded-2xl border border-teal-100 shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-teal-900">2-Tier</div>
              <div className="text-xs font-semibold text-gray-500 mt-1">Pharmacy Godown Inventory</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── LIVE HERO SHOWCASE CARD ──────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 mb-20">
        <div className="bg-gradient-to-tr from-teal-900 via-teal-950 to-slate-950 rounded-3xl p-4 sm:p-8 text-white shadow-2xl border border-teal-800/50 relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-teal-800/60 pb-4 mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              </div>
              <span className="text-xs font-mono text-teal-300 font-bold">ClinicFlow OPD & Chamber Live Console</span>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Active Simulation
            </span>
          </div>

          {/* Interactive Live Layout Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Token Issuance */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-300 mb-2">1. Reception Token Desk</div>
              <div className="bg-white rounded-xl p-3 text-slate-900 shadow-sm">
                <div className="flex justify-between items-center text-xs font-semibold text-gray-500 mb-1">
                  <span>Patient Token Slip</span>
                  <span className="text-teal-700 font-bold">80mm Thermal</span>
                </div>
                <div className="text-3xl font-black text-teal-900 text-center py-2 bg-teal-50 rounded-lg border border-teal-200">
                  TOKEN #12
                </div>
                <div className="text-xs font-bold text-gray-800 mt-2">Nival · S/O Raju (23 yrs)</div>
                <div className="text-[11px] text-teal-700 font-semibold mt-0.5">👨‍⚕️ Dr. Asif Ashraf · 🚪 Room 1</div>
              </div>
            </div>

            {/* Column 2: Public TV Display */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-300 mb-2">2. Waiting TV Screen (/live)</div>
              <div className="bg-slate-900 rounded-xl p-3 border border-slate-700 text-white">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">NOW CALLING</div>
                <div className="text-4xl font-black text-amber-400 my-1">TOKEN #12</div>
                <div className="text-xs font-bold text-slate-200">Dr. Asif Ashraf (Chamber 1)</div>
                <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-1.5">
                  <span>Waiting: 4 Patients</span>
                  <span className="text-emerald-400 font-semibold">🔊 Audio Chime Active</span>
                </div>
              </div>
            </div>

            {/* Column 3: Doctor Chamber */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-300 mb-2">3. Doctor Consultation</div>
              <div className="bg-white rounded-xl p-3 text-slate-900 shadow-sm">
                <div className="flex justify-between items-center text-xs font-bold text-teal-900 mb-1">
                  <span>Patient Profile</span>
                  <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">In Chamber</span>
                </div>
                <div className="text-xs font-bold text-gray-900">Nival (23 yrs)</div>
                <div className="text-[11px] text-gray-500">History: 3 Past Visits retrieved in 0.2s</div>
                <div className="mt-2 text-[10px] font-bold text-teal-800 bg-teal-50 p-1.5 rounded border border-teal-100 text-center">
                  📷 Rx Camera Snapshot & Print Ready
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE MODULES TABBED SECTION ────────────────────── */}
      <section id="modules" className="py-16 bg-white border-y border-teal-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-extrabold tracking-wider uppercase text-teal-700 bg-teal-50 px-3.5 py-1 rounded-full border border-teal-200">
              Complete Clinic Ecosystem
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-teal-950 mt-3 tracking-tight">
              Four Connected Modules for Complete Clinical Flow
            </h2>
            <p className="text-gray-600 mt-3 text-base">
              Everything works in seamless real-time sync with zero cloud delay and offline durability.
            </p>
          </div>

          {/* Module Tab Buttons */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap mb-10">
            {modules.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveTab(m.id)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-bold transition-all ${
                  activeTab === m.id
                    ? "bg-teal-700 text-white shadow-lg shadow-teal-700/25 scale-105"
                    : "bg-gray-50 text-gray-700 hover:bg-teal-50 hover:text-teal-800 border border-gray-200"
                }`}
              >
                <span className="material-symbols-outlined text-xl">{m.icon}</span>
                {m.title}
              </button>
            ))}
          </div>

          {/* Active Tab Showcase Box */}
          <div className="bg-gradient-to-br from-teal-50/80 to-white rounded-3xl p-6 sm:p-10 border border-teal-200/80 shadow-xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left: Descriptions */}
            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-teal-200/70 text-teal-900 mb-3">
                {currentModule.badge}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-teal-950 tracking-tight leading-tight">
                {currentModule.heading}
              </h3>
              <p className="text-gray-600 mt-4 text-base leading-relaxed">
                {currentModule.desc}
              </p>

              {/* Highlights list */}
              <ul className="mt-6 space-y-3">
                {currentModule.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-semibold text-gray-800">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-xs">check</span>
                    </span>
                    {h}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex gap-3">
                <Link
                  to={user ? "/dashboard" : "/login"}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-teal-700 text-white hover:bg-teal-800 shadow-md shadow-teal-700/20 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">login</span>
                  Open {currentModule.title}
                </Link>
                {currentModule.id === "live_tv" && (
                  <Link
                    to="/live"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-white text-teal-900 border border-teal-300 hover:bg-teal-50 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">tv</span>
                    Launch Live Screen
                  </Link>
                )}
              </div>
            </div>

            {/* Right: Graphic Card Mockup */}
            <div className={`rounded-3xl p-8 bg-gradient-to-br ${currentModule.previewGradient} text-white shadow-2xl flex flex-col justify-between min-h-[340px]`}>
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase font-extrabold tracking-widest text-teal-200">
                  {currentModule.previewBadge}
                </span>
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <div className="my-6">
                <div className="text-4xl sm:text-5xl font-black tracking-tight">{currentModule.title}</div>
                <div className="text-teal-100 text-sm mt-2 font-medium">Enterprise Healthcare Standard Built for Speed</div>
              </div>
              <div className="pt-4 border-t border-white/20 flex justify-between items-center text-xs font-semibold text-teal-200">
                <span>ClinicFlow v4.0</span>
                <span>Native Thermal POS &amp; EMR</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS WORKFLOW ─────────────────────────────────── */}
      <section id="workflow" className="py-20 bg-[#f7faf8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-extrabold tracking-wider uppercase text-teal-700 bg-teal-50 px-3.5 py-1 rounded-full border border-teal-200">
              Streamlined Workflow
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-teal-950 mt-3 tracking-tight">
              How Patient Journey Flows in ClinicFlow
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm relative">
              <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white font-black text-xl flex items-center justify-center mb-4 shadow-md shadow-teal-700/20">
                1
              </div>
              <h4 className="text-lg font-bold text-teal-950">Patient Arrival</h4>
              <p className="text-sm text-gray-600 mt-2">
                Receptionist searches by phone or adds new patient in 15 seconds. 80mm thermal token prints instantly with assigned doctor chamber.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm relative">
              <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white font-black text-xl flex items-center justify-center mb-4 shadow-md shadow-teal-700/20">
                2
              </div>
              <h4 className="text-lg font-bold text-teal-950">Lounge TV Display</h4>
              <p className="text-sm text-gray-600 mt-2">
                Waiting TV screen (/live) rings dual-tone chime when token is called. Patients see live chamber availability without any privacy breach.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm relative">
              <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white font-black text-xl flex items-center justify-center mb-4 shadow-md shadow-teal-700/20">
                3
              </div>
              <h4 className="text-lg font-bold text-teal-950">Doctor Consultation</h4>
              <p className="text-sm text-gray-600 mt-2">
                Doctor views entire multi-year visit history in 0.2s, records clinical notes, snaps paper Rx photos, and prescribes medicines.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-sm relative">
              <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white font-black text-xl flex items-center justify-center mb-4 shadow-md shadow-teal-700/20">
                4
              </div>
              <h4 className="text-lg font-bold text-teal-950">Pharmacy &amp; POS</h4>
              <p className="text-sm text-gray-600 mt-2">
                Medical store dispenses prescription with barcode scan, manages khata balance, and deducts live batch inventory automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DEVELOPER CONTACT & BRANDING SECTION ─────────────────── */}
      <section id="contact" className="py-16 bg-white border-t border-teal-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 rounded-3xl p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute right-0 bottom-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative z-10">
              <div>
                <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-700/50">
                  Customization &amp; Deployment
                </span>
                <h3 className="text-2xl sm:text-3xl font-black mt-3 text-white">
                  Need ClinicFlow for Your Hospital or Clinic?
                </h3>
                <p className="text-teal-200 mt-2 text-sm sm:text-base max-w-xl">
                  Built and supported by <strong>K.B Software</strong>. Available with local offline setup, multi-chamber hardware routing, and thermal printer integration.
                </p>

                <div className="mt-6 space-y-2 text-sm font-semibold text-teal-100">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400">code</span>
                    <span>Software Architect &amp; Developer: <strong>Krish Baresha</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400">call</span>
                    <span>Phone: <strong className="font-mono text-emerald-300">03142291356</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400">location_on</span>
                    <span>Location: <strong>Lajpat Road, Hyderabad, Sindh, Pakistan</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 w-full md:w-auto shrink-0">
                <a
                  href="https://wa.me/923142291356?text=Hello%20Krish,%20I%20am%20interested%20in%20deploying%20ClinicFlow%20System%20for%20my%20clinic."
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-extrabold bg-emerald-500 text-teal-950 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/25"
                >
                  <span className="material-symbols-outlined text-xl">chat</span>
                  Direct WhatsApp Chat
                </a>

                <a
                  href="tel:03142291356"
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
                >
                  <span className="material-symbols-outlined text-xl">phone_forwarded</span>
                  Call 03142291356
                </a>

                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold bg-teal-700/80 hover:bg-teal-700 text-teal-100 transition-all"
                >
                  <span className="material-symbols-outlined text-xl">lock</span>
                  Open Staff Portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-slate-400 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
              CF
            </div>
            <div>
              <div className="font-bold text-slate-200">ClinicFlow Enterprise</div>
              <div className="text-[11px] text-slate-500">© 2026 K.B Software • All Rights Reserved</div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/live" className="hover:text-teal-400 transition-colors">Waiting Lounge (/live)</Link>
            <Link to="/login" className="hover:text-teal-400 transition-colors">Staff Login</Link>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              All Systems Operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
