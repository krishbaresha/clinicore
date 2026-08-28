import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { dbClinic, dbUsers, dbVisits, dbClinicServices } from "../api/db.js";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

export default function LandingPage() {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clinicData, setClinicData] = useState({});
  const [doctorsList, setDoctorsList] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [todayVisits, setTodayVisits] = useState([]);

  // Queue Lookup state
  const [queueSearchQuery, setQueueSearchQuery] = useState("");
  const [queueSearchResult, setQueueSearchResult] = useState(null);

  // FAQ state
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  useEffect(() => {
    function loadData() {
      const clinic = dbClinic.get() || {};
      setClinicData(clinic);

      const allUsers = dbUsers.getAll() || [];
      const docs = allUsers.filter((u) => u.role === "doctor");
      setDoctorsList(docs);

      const sers = dbClinicServices.getAll() || [];
      setServicesList(sers);

      const visits = dbVisits.getAll() || [];
      const today = new Date().toDateString();
      const todayOnly = visits.filter((v) => new Date(v.visit_date).toDateString() === today);
      setTodayVisits(todayOnly);
    }

    loadData();
    window.addEventListener("clinicflow_status_update", loadData);
    return () => window.removeEventListener("clinicflow_status_update", loadData);
  }, []);

  // Live Queue Telemetry Stats
  const queueStats = useMemo(() => {
    const waiting = todayVisits.filter((v) => v.status === "waiting" || v.status === "pending");
    const inRoom = todayVisits.filter((v) => v.status === "in_consultation" || v.status === "in-room");
    const completed = todayVisits.filter((v) => v.status === "completed" || v.status === "done");
    return {
      waitingCount: waiting.length,
      inRoomToken: inRoom.length > 0 ? inRoom[0].token_number : null,
      inRoomDoctor: inRoom.length > 0 ? inRoom[0].doctor_name : null,
      totalToday: todayVisits.length,
      completedCount: completed.length,
    };
  }, [todayVisits]);

  // Handle Token / Phone Queue Lookup
  function handleQueueSearch(e) {
    e.preventDefault();
    if (!queueSearchQuery.trim()) {
      setQueueSearchResult(null);
      return;
    }
    const q = queueSearchQuery.trim().toLowerCase();
    const match = todayVisits.find((v) => {
      const tokenMatch = String(v.token_number) === q;
      const phoneMatch = v.patient_phone && v.patient_phone.includes(q);
      const nameMatch = v.patient_name && v.patient_name.toLowerCase().includes(q);
      return tokenMatch || phoneMatch || nameMatch;
    });

    if (match) {
      const waitingAhead = todayVisits.filter((v) => {
        const isWaiting = v.status === "waiting" || v.status === "pending";
        return isWaiting && Number(v.token_number) < Number(match.token_number);
      }).length;

      setQueueSearchResult({
        found: true,
        token: match.token_number,
        patientName: match.patient_name || "Patient",
        status: match.status,
        doctorName: match.doctor_name || "Assigned Consultant",
        room: match.room_number || "Chamber 1",
        waitingAhead,
        estWaitMins: Math.max(5, waitingAhead * 10),
      });
    } else {
      setQueueSearchResult({
        found: false,
        query: queueSearchQuery,
      });
    }
  }

  const defaultDoctors = [
    {
      id: "doc_asif",
      name: "Dr. Muhammad Asif Ashraf Khan",
      specialization: "Principal Consultant & Homeopath (D.H.M.S, R.H.M.P)",
      room_number: "Main Chamber 1",
      consultation_fee: 500,
      is_owner: true,
      availability_status: "available",
    },
    {
      id: "doc_kashif",
      name: "Dr. Muhammad Kashif Khan",
      specialization: "Associate Consultant & Chronic Care Specialist",
      room_number: "Chamber 2",
      consultation_fee: 400,
      is_owner: false,
      availability_status: "available",
    },
  ];

  const displayDoctors = doctorsList.length > 0 ? doctorsList : defaultDoctors;

  const defaultServices = [
    {
      id: "ser_1",
      title: "Specialized Homeopathic Care",
      desc: "Holistic, side-effect-free homeopathic remedies tailored for acute, sub-acute, and deep chronic disorders.",
      icon: "medical_services",
    },
    {
      id: "ser_2",
      title: "Chronic Diseases & Organ Wellness",
      desc: "Targeted clinical protocols for kidney stones, liver dysfunction, respiratory asthma, and hypertension.",
      icon: "monitor_heart",
    },
    {
      id: "ser_3",
      title: "Skin, Allergies & Dermatological Health",
      desc: "Individualized homeopathic diagnosis and natural healing for chronic eczema, psoriasis, acne, and hair loss.",
      icon: "dermatology",
    },
    {
      id: "ser_4",
      title: "Pediatric & Maternal Healthcare",
      desc: "Gentle, non-invasive therapies designed for infant immunity, growth wellness, and family healthcare.",
      icon: "family_restroom",
    },
    {
      id: "ser_5",
      title: "Joint Pain, Arthritis & Sciatica Care",
      desc: "Comprehensive natural rehabilitation for uric acid, degenerative osteoarthritis, and chronic inflammation.",
      icon: "accessibility_new",
    },
    {
      id: "ser_6",
      title: "Wholesale & Retail Medicine Store",
      desc: "100% authentic mother tinctures, bio-chemic salts, and imported dilutions with province-wide distribution.",
      icon: "local_pharmacy",
    },
  ];

  const displayServices = servicesList.length > 0 ? servicesList : defaultServices;

  const faqs = [
    {
      q: "What are the OPD consultation timings for the clinic?",
      a: "Our clinic OPD chambers are open Monday through Saturday from 10:00 AM to 10:00 PM, and on Sundays from 11:00 AM to 4:00 PM. Emergency on-call assistance is available 24/7.",
    },
    {
      q: "How does the Live OPD Token Queue system work?",
      a: "When you visit the reception desk, a thermal token slip is issued with your token number and assigned doctor room. You can enter your token number on this website anytime to track your turn and see exactly how many patients are ahead in line.",
    },
    {
      q: "Do you supply wholesale medicines to other stores in Sindh?",
      a: "Yes! Our Wholesale Distribution wing supplies verified batch medicines from BM, Paul Brooks, Schwabe, MEKTUM, and Blossom to licensed homeopathic stores across Hyderabad and Interior Sindh with fast transport bilty delivery.",
    },
    {
      q: "Can I book a doctor consultation or inquire via WhatsApp?",
      a: "Yes. You can click any of the WhatsApp buttons on this page to directly reach our clinic helpdesk for appointment inquiries, medicine availability, or report follow-ups.",
    },
  ];

  const testimonials = [
    {
      name: "Muhammad Rizwan",
      city: "Latifabad, Hyderabad",
      text: "The doctor's treatment resolved my 2-year-old chronic gastric and allergy issue within 6 weeks. The token system made my clinic visit quick and organized without long waiting.",
      rating: 5,
    },
    {
      name: "Haji Abdul Rehman",
      city: "Tando Allahyar",
      text: "We regularly purchase our medical store stock from their wholesale godown. 100% original company medicines and transparent billing on every order.",
      rating: 5,
    },
    {
      name: "Syeda Fatima",
      city: "Qasimabad, Hyderabad",
      text: "The clinic staff is very courteous and the live token queue feature on the website is a blessing for families. Highly recommended homeopathic consultants!",
      rating: 5,
    },
  ];

  const clinicName = clinicData.name || "Dr. Muhammad Asif Ashraf Khan Clinic & Wholesale Store";
  const clinicTagline = clinicData.tagline || "Specialized Homeopathic Healthcare & Certified Medicine Distribution";
  const heroTitle = clinicData.hero_title || t("landing.hero.defaultTitle");
  const heroDesc = clinicData.hero_description || t("landing.hero.defaultDesc");
  const clinicPhone = clinicData.phone || "+92 314 2291356";
  const clinicWhatsapp = (clinicData.whatsapp || clinicData.phone || "923142291356").replace(/[^0-9]/g, "");
  const clinicAddress = clinicData.address || "Lajpaat Road, Hyderabad, Sindh, Pakistan";
  const clinicTimings = clinicData.timings || "Monday – Saturday: 10:00 AM – 10:00 PM | Sunday: 11:00 AM – 4:00 PM";
  const clinicStatus = clinicData.clinic_status || "open";

  return (
    <div className="min-h-screen bg-[#f8faf9] text-slate-800 font-sans selection:bg-teal-700 selection:text-white flex flex-col antialiased w-full max-w-full overflow-x-hidden no-scrollbar relative">

      {/* ─── PUBLIC TOP NOTICE BANNER ─── */}
      {clinicData.public_notice && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white px-3 sm:px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-xs z-50">
          <span className="material-symbols-outlined text-sm shrink-0">campaign</span>
          <span className="truncate max-w-4xl">{clinicData.public_notice}</span>
        </div>
      )}

      {/* ─── TOP HEADER NAVBAR (FULLY RESPONSIVE & SLEEK) ──────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-[0_2px_15px_rgba(0,0,0,0.03)] transition-all w-full">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4 min-w-0">

          {/* Brand Logo & Name */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group shrink-0 min-w-0 max-w-[50%] xs:max-w-[60%] sm:max-w-none">
            <img
              src="/favicon.svg"
              alt="CliniCore Logo"
              className="h-9 sm:h-11 w-9 sm:w-11 object-contain drop-shadow-md group-hover:scale-105 transition-transform shrink-0 rounded-2xl"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xs xs:text-sm sm:text-base md:text-lg font-black tracking-tight text-slate-900 truncate">
                  {clinicName}
                </span>
                <span className="hidden 2xl:inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${clinicStatus === "open" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                  {clinicStatus === "open" ? t("landing.nav.opdOpen") : t("landing.nav.closed")}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 hidden sm:block truncate max-w-xs md:max-w-sm">
                {clinicTagline}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links (Visible on Wide XL screens 1280px+) */}
          <nav className="hidden xl:flex items-center gap-1 2xl:gap-2 shrink-0">
            {displayDoctors.length > 0 && (
              <a
                href="#doctors"
                className="text-[13px] font-semibold text-slate-600 hover:text-teal-800 hover:bg-teal-50/70 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap"
              >
                {t("landing.nav.doctors")}
              </a>
            )}
            <a
              href="#services"
              className="text-[13px] font-semibold text-slate-600 hover:text-teal-800 hover:bg-teal-50/70 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap"
            >
              {t("landing.nav.services")}
            </a>
            <a
              href="#queue"
              className="text-[13px] font-bold text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {t("landing.nav.liveQueue")}
            </a>
            <a
              href="#pharmacy"
              className="text-[13px] font-semibold text-slate-600 hover:text-teal-800 hover:bg-teal-50/70 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap"
            >
              {t("landing.nav.pharmacy")}
            </a>
            <a
              href="#contact"
              className="text-[13px] font-semibold text-slate-600 hover:text-teal-800 hover:bg-teal-50/70 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap"
            >
              {t("landing.nav.contact")}
            </a>
          </nav>

          {/* Action CTAs & Language Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LanguageSwitcher compact={true} />

            {/* Direct WhatsApp (Desktop only 2xl+) */}
            <a
              href={`https://wa.me/${clinicWhatsapp}?text=Assalam-o-Alaikum%20Clinic,%20I%20would%20like%20to%20inquire%20about%20OPD%20consultation.`}
              target="_blank"
              rel="noreferrer"
              className="hidden 2xl:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm shadow-emerald-700/20 cursor-pointer whitespace-nowrap"
              title="Message Clinic Helpdesk on WhatsApp"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              <span>{t("landing.nav.whatsapp")}</span>
            </a>

            {/* Staff Login Link */}
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-800 hover:bg-teal-900 text-white transition-all shadow-md shadow-teal-900/20 whitespace-nowrap cursor-pointer"
              title="Staff Login"
            >
              <span className="material-symbols-outlined text-base">login</span>
              <span className="hidden xs:inline">Staff Login</span>
            </Link>

            {/* Super Admin Command Center Link (visible on sm+) */}
            <Link
              to="/admin"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-950 border border-teal-200 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              title="Super Admin Command Center"
            >
              <span className="material-symbols-outlined text-base text-teal-700">admin_panel_settings</span>
              <span className="hidden 2xl:inline">Admin</span>
            </Link>

            {/* Mobile / Tablet Menu Drawer Trigger (visible on < xl) */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="xl:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 flex items-center justify-center cursor-pointer min-h-[40px] min-w-[40px] shrink-0"
              aria-label="Open Navigation Drawer"
            >
              <span className="material-symbols-outlined text-xl">
                menu
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── MODERN SLIDE-OVER SIDE MENU DRAWER ─────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop Dim */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 transition-opacity"
            />

            {/* Slide-in Drawer from Right */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 right-0 w-[85%] max-w-[340px] bg-white z-50 shadow-2xl p-5 sm:p-6 flex flex-col justify-between overflow-y-auto no-scrollbar"
            >
              {/* Drawer Top Header */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/favicon.svg"
                      alt="CliniCore Logo"
                      className="h-9 w-9 object-contain rounded-xl drop-shadow-sm"
                    />
                    <div>
                      <h3 className="font-black text-sm text-slate-900 leading-tight truncate max-w-[170px]">{clinicName}</h3>
                      <p className="text-[10px] font-semibold text-slate-500 truncate max-w-[170px]">{clinicTagline}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>

                {/* Status Pill */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold">
                  <span className={`w-2 h-2 rounded-full ${clinicStatus === "open" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                  <span>{clinicStatus === "open" ? "🟢 OPD Chambers Open Today" : "🔴 Chambers Closed Today"}</span>
                </div>

                {/* Nav Links */}
                <nav className="flex flex-col gap-1 text-xs font-bold text-slate-700 pt-1">
                  <a
                    href="#doctors"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3.5 py-3 rounded-2xl hover:bg-teal-50 flex items-center gap-3 text-slate-800 hover:text-teal-900 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-teal-700">stethoscope</span>
                    <span>{t("landing.nav.doctors")}</span>
                  </a>
                  <a
                    href="#services"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3.5 py-3 rounded-2xl hover:bg-teal-50 flex items-center gap-3 text-slate-800 hover:text-teal-900 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-teal-700">medical_services</span>
                    <span>{t("landing.nav.services")}</span>
                  </a>
                  <a
                    href="#queue"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3.5 py-3 rounded-2xl bg-teal-50/70 border border-teal-100 flex items-center justify-between text-teal-950 font-extrabold"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-lg text-teal-700">confirmation_number</span>
                      <span>{t("landing.nav.liveQueue")}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">Real-Time</span>
                  </a>
                  <a
                    href="#pharmacy"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3.5 py-3 rounded-2xl hover:bg-teal-50 flex items-center gap-3 text-slate-800 hover:text-teal-900 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-teal-700">local_pharmacy</span>
                    <span>{t("landing.nav.pharmacy")}</span>
                  </a>
                  <a
                    href="#contact"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3.5 py-3 rounded-2xl hover:bg-teal-50 flex items-center gap-3 text-slate-800 hover:text-teal-900 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-teal-700">location_on</span>
                    <span>{t("landing.nav.contact")}</span>
                  </a>
                </nav>

                {/* Direct Action Buttons in Drawer */}
                <div className="space-y-2 pt-2">
                  <a
                    href={`https://wa.me/${clinicWhatsapp}?text=Assalam-o-Alaikum%20Clinic,%20I%20need%20assistance.`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">chat</span>
                    <span>WhatsApp Consultation</span>
                  </a>
                  <a
                    href={`tel:${clinicPhone.replace(/[^0-9+]/g, "")}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200 transition-all"
                  >
                    <span className="material-symbols-outlined text-base text-teal-700">call</span>
                    <span>Call: {clinicPhone}</span>
                  </a>
                </div>
              </div>

              {/* Drawer Bottom Portals */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Language / Zaban</span>
                  <LanguageSwitcher />
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="font-bold text-teal-800 hover:underline">
                    Staff Portal →
                  </Link>
                  <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="font-bold text-amber-800 hover:underline">
                    Admin →
                  </Link>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── HERO & LIVE TELEMETRY 2-COLUMN SECTION ────────────────── */}
      <section className="relative pt-8 pb-12 sm:pt-16 sm:pb-20 overflow-hidden w-full">
        {/* Soft Medical Gradient Glows */}
        <div className="absolute top-0 inset-x-0 mx-auto max-w-7xl h-[480px] bg-gradient-to-b from-teal-100/60 via-emerald-50/30 to-transparent blur-3xl -z-10 pointer-events-none" />

        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center min-w-0">

            {/* Left Column: Hero Narrative */}
            <div className="lg:col-span-7 text-center lg:text-left space-y-5 sm:space-y-6">

              {/* Status Capsule */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-teal-200 text-teal-900 text-xs font-black shadow-xs"
              >
                <span className={`w-2 h-2 rounded-full ${clinicStatus === "open" ? "bg-emerald-500 animate-ping" : "bg-rose-500"}`} />
                <span>{clinicStatus === "open" ? t("landing.hero.openBadge") : t("landing.hero.closedBadge")}</span>
              </motion.div>

              {/* Hero Main Heading */}
              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-[1.18]"
              >
                {heroTitle}
              </motion.h1>

              {/* Hero Subtitle / Description */}
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-xs sm:text-sm lg:text-base text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto lg:mx-0"
              >
                {heroDesc}
              </motion.p>

              {/* Primary Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-2.5 sm:gap-3 pt-1 max-w-md sm:max-w-none mx-auto lg:mx-0"
              >
                <a
                  href="#queue"
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-3 rounded-2xl text-xs sm:text-sm font-black bg-teal-800 hover:bg-teal-900 text-white shadow-lg shadow-teal-900/20 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">confirmation_number</span>
                  {t("landing.hero.checkQueue")}
                </a>

                <a
                  href={`tel:${clinicPhone.replace(/[^0-9+]/g, "")}`}
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-3 rounded-2xl text-xs sm:text-sm font-black bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-xs transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg text-teal-700">call</span>
                  {t("landing.hero.call")}
                </a>

                <a
                  href={`https://wa.me/${clinicWhatsapp}?text=Assalam-o-Alaikum%20Dr.%20Sahib,%20I%20need%20medical%20advice.`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-3 rounded-2xl text-xs sm:text-sm font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg text-emerald-600">chat</span>
                  {t("landing.hero.whatsapp")}
                </a>
              </motion.div>

              {/* Mini Trust Row */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-emerald-600 text-base">verified</span>
                  Licensed Homeopaths
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-teal-600 text-base">timer</span>
                  Live Token System
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-purple-600 text-base">inventory_2</span>
                  Original Medicines
                </span>
              </div>

            </div>

            {/* Right Column: Interactive Live Queue Telemetry Card */}
            <motion.div
              id="queue"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-5 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 rounded-3xl p-5 sm:p-7 text-white shadow-2xl relative overflow-hidden"
            >
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-teal-300 text-xs font-black border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    {t("landing.queue.badge")}
                  </div>
                  <span className="text-[11px] font-bold text-teal-200/80">Real-Time Sync</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-teal-200">{t("landing.queue.servingNow")}</div>
                    <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
                      {queueStats.inRoomToken ? `#${queueStats.inRoomToken}` : "None"}
                    </div>
                    <div className="text-[9px] text-teal-200/80 truncate mt-0.5">
                      {queueStats.inRoomDoctor || "Chamber"}
                    </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-teal-200">{t("landing.queue.waitingInLine")}</div>
                    <div className="text-xl sm:text-2xl font-black text-white mt-1">
                      {queueStats.waitingCount}
                    </div>
                    <div className="text-[9px] text-teal-200/80 mt-0.5">{t("landing.queue.patients")}</div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-teal-200">{t("landing.queue.servedToday")}</div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">
                      {queueStats.completedCount}
                    </div>
                    <div className="text-[9px] text-teal-200/80 mt-0.5">{t("landing.queue.completed")}</div>
                  </div>
                </div>

                {/* Token Search Box */}
                <form onSubmit={handleQueueSearch} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder={t("landing.queue.searchPlaceholder")}
                    value={queueSearchQuery}
                    onChange={(e) => setQueueSearchQuery(e.target.value)}
                    className="flex-1 min-h-[44px] bg-white/20 border border-white/30 text-white placeholder:text-teal-200/60 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:bg-white/30"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 py-2 bg-amber-400 hover:bg-amber-300 text-teal-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-md shrink-0"
                  >
                    {t("landing.queue.lookupBtn")}
                  </button>
                </form>

                {/* Search Result Display */}
                {queueSearchResult && (
                  <div className="bg-white text-slate-800 p-4 rounded-2xl shadow-lg border border-teal-200 animate-fadeIn space-y-2.5">
                    {queueSearchResult.found ? (
                      <div>
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{t("landing.queue.patientName")}</span>
                            <h4 className="font-black text-slate-900 text-sm">{queueSearchResult.patientName}</h4>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{t("landing.queue.tokenNum")}</span>
                            <div className="text-lg font-black text-teal-800 font-mono">#{queueSearchResult.token}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                          <div>
                            <span className="text-slate-500 font-medium">{t("landing.queue.assignedPhysician")}</span>
                            <div className="font-bold text-slate-900 mt-0.5">{queueSearchResult.doctorName}</div>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">{t("landing.queue.chamberRoom")}</span>
                            <div className="font-bold text-slate-900 mt-0.5">{queueSearchResult.room}</div>
                          </div>
                          <div className="col-span-2 pt-2 border-t border-gray-100 text-xs">
                            {queueSearchResult.status === "in_consultation" ? (
                              <span className="text-emerald-700 font-black flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                {t("landing.queue.inRoom")}
                              </span>
                            ) : queueSearchResult.status === "completed" ? (
                              <span className="text-slate-600 font-black flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                                {t("landing.queue.done")}
                              </span>
                            ) : (
                              <span className="text-amber-800 font-bold">
                                ⏳ <strong>{queueSearchResult.waitingAhead} {t("landing.queue.ahead")}</strong> (~{queueSearchResult.estWaitMins} mins {t("landing.queue.estWait")})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-1 text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">error</span>
                        <span>{t("landing.queue.notFound")}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ─── CLINICAL TRUST 4-COLUMN BENTO BAR ────────────────────── */}
      <section className="py-6 sm:py-8 bg-white border-y border-slate-100 w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-50/70 border border-slate-100 p-4 sm:p-5 rounded-2xl text-left shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-teal-100/70 text-teal-800 flex items-center justify-center mb-2.5">
                <span className="material-symbols-outlined text-xl">verified_user</span>
              </div>
              <h4 className="font-black text-slate-900 text-xs sm:text-sm">{t("landing.hero.certifiedSpecialists")}</h4>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">{t("landing.hero.certifiedDesc")}</p>
            </div>

            <div className="bg-slate-50/70 border border-slate-100 p-4 sm:p-5 rounded-2xl text-left shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center mb-2.5">
                <span className="material-symbols-outlined text-xl">pace</span>
              </div>
              <h4 className="font-black text-slate-900 text-xs sm:text-sm">{t("landing.hero.zeroCongestion")}</h4>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">{t("landing.hero.zeroDesc")}</p>
            </div>

            <div className="bg-slate-50/70 border border-slate-100 p-4 sm:p-5 rounded-2xl text-left shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-purple-100/70 text-purple-800 flex items-center justify-center mb-2.5">
                <span className="material-symbols-outlined text-xl">inventory_2</span>
              </div>
              <h4 className="font-black text-slate-900 text-xs sm:text-sm">{t("landing.hero.genuinePharmacy")}</h4>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">{t("landing.hero.genuineDesc")}</p>
            </div>

            <div className="bg-slate-50/70 border border-slate-100 p-4 sm:p-5 rounded-2xl text-left shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-amber-100/70 text-amber-800 flex items-center justify-center mb-2.5">
                <span className="material-symbols-outlined text-xl">local_shipping</span>
              </div>
              <h4 className="font-black text-slate-900 text-xs sm:text-sm">{t("landing.hero.wholesaleSupply")}</h4>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">{t("landing.hero.wholesaleDesc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── OUR DOCTORS & CONSULTING SPECIALISTS SECTION (Only shown when doctors registered) ─── */}
      {displayDoctors.length > 0 && (
        <section id="doctors" className="py-12 sm:py-20 w-full">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">

            <div className="text-center space-y-2.5 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-black">
                <span className="material-symbols-outlined text-sm text-teal-600">stethoscope</span>
                {t("landing.doctors.badge")}
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                {t("landing.doctors.title")}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {t("landing.doctors.desc")}
              </p>
            </div>

            {/* Dynamic Doctors Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto gap-6 sm:gap-8">
              {displayDoctors.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5 relative overflow-hidden group hover:border-teal-200"
                >
                  <div className="space-y-4">
                    {/* Doctor Avatar & Badges */}
                    <div className="flex items-center justify-between">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-800 to-teal-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-teal-800/20">
                        {doc.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {doc.is_owner && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                            ⭐ PRINCIPAL CONSULTANT
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
                          {doc.room_number || "Chamber 1"}
                        </span>
                      </div>
                    </div>

                    {/* Doctor Name & Specialization */}
                    <div>
                      <h3 className="font-black text-lg text-slate-900 group-hover:text-teal-800 transition-colors">
                        {doc.name}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        {doc.specialization || "General Physician & Homeopath"}
                      </p>
                    </div>

                    {/* Chamber Details */}
                    <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-1.5 text-xs font-medium text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>{t("landing.doctors.fee")}</span>
                        <strong className="text-slate-900 font-bold font-mono">Rs. {doc.consultation_fee || 500}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("landing.doctors.status")}</span>
                        <span className={`font-bold ${doc.availability_status === "available" ? "text-emerald-700" : "text-amber-700"}`}>
                          {doc.availability_status === "available" ? `🟢 ${t("landing.doctors.inChamber")}` : `🟡 ${t("landing.doctors.onBreak")}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Appointment Inquiry via WhatsApp */}
                  <a
                    href={`https://wa.me/${clinicWhatsapp}?text=Assalam-o-Alaikum,%20I%20would%20like%20to%20consult%20with%20${encodeURIComponent(doc.name)}.`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 min-h-[46px] py-2.5 rounded-2xl bg-teal-50 hover:bg-teal-800 text-teal-950 hover:text-white border border-teal-200 hover:border-teal-800 font-black text-xs transition-all shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">calendar_month</span>
                    {t("landing.doctors.inquireBtn")}
                  </a>
                </motion.div>
              ))}
            </div>

          </div>
        </section>
      )}

      {/* ─── CLINICAL SERVICES & TREATMENTS SECTION ───────────────── */}
      <section id="services" className="py-12 sm:py-20 bg-white border-t border-slate-100 w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">

          <div className="text-center space-y-2.5 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-black">
              <span className="material-symbols-outlined text-sm text-teal-600">medical_services</span>
              {t("landing.services.badge")}
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              {t("landing.services.title")}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              {t("landing.services.desc")}
            </p>
          </div>

          {/* Services Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {displayServices.map((ser, idx) => (
              <motion.div
                key={ser.id || idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.3 }}
                className="bg-slate-50/60 border border-slate-100 rounded-3xl p-5 sm:p-6 hover:bg-white hover:shadow-lg transition-all duration-300 space-y-3 group hover:border-teal-100"
              >
                <div className="w-11 h-11 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-md shadow-teal-800/20 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-xl sm:text-2xl">{ser.icon || "health_and_safety"}</span>
                </div>
                <h3 className="font-black text-sm sm:text-base text-slate-900 group-hover:text-teal-800 transition-colors">
                  {ser.title || ser.service_name}
                </h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {ser.desc || ser.description || "Holistic treatment protocol personalized for optimal patient recovery."}
                </p>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ─── WHOLESALE & RETAIL PHARMACY SECTION ───────────────────── */}
      <section id="pharmacy" className="py-12 sm:py-20 bg-[#fcfdfd] w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">

              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-900 text-xs font-black">
                  <span className="material-symbols-outlined text-sm text-purple-700">warehouse</span>
                  {t("landing.pharmacy.badge")}
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {t("landing.pharmacy.title")}
                </h2>

                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  {t("landing.pharmacy.desc")}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 pt-2">
                  {[
                    "BM Pvt LTD",
                    "Paul Brooks Lab",
                    "Dr. Willmar Schwabe",
                    "MEKTUM Pvt Ltd",
                    "BLOSSOM Pharma",
                    "Dr. Reckeweg",
                  ].map((brand) => (
                    <div key={brand} className="bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-2 text-center text-[11px] sm:text-xs font-bold text-slate-800 truncate">
                      ✓ {brand}
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex flex-wrap gap-3">
                  <a
                    href={`https://wa.me/${clinicWhatsapp}?text=Assalam-o-Alaikum%20Wholesale%20Department,%20I%20want%20to%20inquire%20about%20medicine%20stock%20and%20rates.`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-black bg-purple-700 hover:bg-purple-800 text-white transition-all shadow-md shadow-purple-700/20 cursor-pointer w-full sm:w-auto"
                  >
                    <span className="material-symbols-outlined text-sm">local_shipping</span>
                    {t("landing.pharmacy.inquireBtn")}
                  </a>
                </div>
              </div>

              <div className="lg:col-span-5 bg-gradient-to-tr from-teal-900 to-slate-900 text-white p-5 sm:p-7 rounded-3xl space-y-3.5 shadow-xl">
                <h3 className="font-black text-base sm:text-lg text-white">{t("landing.pharmacy.benefitsTitle")}</h3>
                <ul className="space-y-2.5 text-xs text-teal-100/90 font-medium">
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-base shrink-0">check_circle</span>
                    <span>{t("landing.pharmacy.benefit1")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-base shrink-0">check_circle</span>
                    <span>{t("landing.pharmacy.benefit2")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-base shrink-0">check_circle</span>
                    <span>{t("landing.pharmacy.benefit3")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-base shrink-0">check_circle</span>
                    <span>{t("landing.pharmacy.benefit4")}</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ─── PATIENT TESTIMONIALS SECTION ─────────────────────────── */}
      <section className="py-12 sm:py-20 bg-white border-t border-slate-100 w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">

          <div className="text-center space-y-2.5 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-black">
              <span className="material-symbols-outlined text-sm text-teal-600">reviews</span>
              {t("landing.testimonials.badge")}
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              {t("landing.testimonials.title")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {testimonials.map((tItem, idx) => (
              <div key={idx} className="bg-slate-50/80 border border-slate-100 rounded-3xl p-5 sm:p-6 space-y-3.5 shadow-xs flex flex-col justify-between">
                <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed italic">
                  "{tItem.text}"
                </p>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-slate-900 text-xs sm:text-sm">{tItem.name}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">{tItem.city}</p>
                  </div>
                  <div className="flex text-amber-400 text-sm">
                    {"★".repeat(tItem.rating)}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─── FREQUENTLY ASKED QUESTIONS (ACCORDION) ───────────────── */}
      <section className="py-12 sm:py-20 bg-[#fcfdfd] border-t border-slate-100 w-full">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

          <div className="text-center space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-black">
              <span className="material-symbols-outlined text-sm text-teal-600">help</span>
              {t("landing.faq.badge")}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {t("landing.faq.title")}
            </h2>
          </div>

          <div className="space-y-2.5">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                    className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 font-black text-xs sm:text-sm text-slate-900 hover:text-teal-800 transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <span className={`material-symbols-outlined text-lg text-teal-600 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-4 pt-1 text-xs text-slate-600 font-medium leading-relaxed border-t border-slate-50">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ─── LOCATION, TIMINGS & CONTACT FOOTER ─────────────────────── */}
      <footer id="contact" className="bg-white border-t border-slate-100 pt-12 sm:pt-16 pb-8 w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">

            {/* Col 1: Brand & Address */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <img
                  src="/favicon.svg"
                  alt="CliniCore Logo"
                  className="h-8 w-8 object-contain rounded-lg"
                />
                <span className="font-black text-sm sm:text-base text-slate-900">{clinicName}</span>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {clinicTagline}
              </p>
              <div className="text-xs text-slate-600 font-medium flex items-start gap-1.5 pt-1">
                <span className="material-symbols-outlined text-teal-700 text-base shrink-0">location_on</span>
                <span>{clinicAddress}</span>
              </div>
            </div>

            {/* Col 2: Timings */}
            <div className="space-y-2.5">
              <h4 className="font-black text-xs uppercase tracking-wider text-slate-900">{t("landing.footer.timings")}</h4>
              <div className="text-xs text-slate-600 font-medium space-y-1.5">
                <p>{clinicTimings}</p>
                {clinicData.emergency_note && (
                  <p className="text-amber-800 font-bold pt-1">
                    🚨 {clinicData.emergency_note}
                  </p>
                )}
              </div>
            </div>

            {/* Col 3: Direct Contacts */}
            <div className="space-y-2.5">
              <h4 className="font-black text-xs uppercase tracking-wider text-slate-900">{t("landing.footer.contact")}</h4>
              <div className="space-y-2 text-xs">
                <a
                  href={`tel:${clinicPhone.replace(/[^0-9+]/g, "")}`}
                  className="flex items-center gap-2 text-slate-700 hover:text-teal-800 font-bold"
                >
                  <span className="material-symbols-outlined text-sm text-teal-600">call</span>
                  {clinicPhone}
                </a>
                <a
                  href={`https://wa.me/${clinicWhatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-emerald-700 hover:text-emerald-800 font-bold"
                >
                  <span className="material-symbols-outlined text-sm">chat</span>
                  WhatsApp Chat
                </a>
                {clinicData.email && (
                  <a
                    href={`mailto:${clinicData.email}`}
                    className="flex items-center gap-2 text-slate-600 hover:text-teal-800"
                  >
                    <span className="material-symbols-outlined text-sm text-teal-600">mail</span>
                    {clinicData.email}
                  </a>
                )}
              </div>
            </div>

            {/* Col 4: Quick Portals */}
            <div className="space-y-2.5">
              <h4 className="font-black text-xs uppercase tracking-wider text-slate-900">{t("landing.footer.access")}</h4>
              <div className="space-y-2 text-xs">
                <Link to="/dashboard" className="block text-slate-700 hover:text-teal-800 font-bold">
                  → {t("landing.footer.staffLogin")}
                </Link>
                <Link to="/admin" className="block text-amber-800 hover:underline font-bold">
                  → {t("landing.footer.superAdmin")}
                </Link>
                <Link to="/clinic" className="block text-slate-600 hover:text-teal-800">
                  → {t("landing.footer.tvDisplay")}
                </Link>
              </div>
            </div>

          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <p>© {new Date().getFullYear()} {clinicName}. {t("landing.footer.rights")}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span>{t("landing.footer.poweredBy")}</span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span>
                Designed &amp; Engineered by{" "}
                <a
                  href="https://krishbaresha.tech"
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-800 font-black hover:underline inline-flex items-center gap-1"
                  title="Visit Krish Baresha Portfolio"
                >
                  Krish Baresha
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              </span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
