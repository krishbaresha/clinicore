import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { dbPatients, dbVisits, dbUsers, dbClinic, dbClinicServices, dbPatientLedger } from "../api/db.js";
import { printOPDTokenReceipt } from "../utils/thermalPrinter.js";
import { formatPatientAge } from "../utils/formatters.js";
import { CLINIC_LOGO_BASE64 } from "../utils/clinicLogoBase64.js";
import { patientInputSchema, validateSchema } from "../schemas/index.js";

const RELATION_TYPES = ["father", "husband", "wife", "mother", "brother", "sister", "son", "daughter"];

function RelationTypeBadge({ type }) {
  const labels = { father: "S/O", husband: "W/O", wife: "H/O", mother: "D/O", brother: "Br/O", sister: "Sr/O", son: "Son of", daughter: "D/O" };
  const colors = { father: "bg-blue-50 text-blue-700", husband: "bg-purple-50 text-purple-700", wife: "bg-pink-50 text-pink-700", mother: "bg-emerald-50 text-emerald-700" };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[type] || "bg-gray-100 text-gray-700"}`}>
      {labels[type] || type}
    </span>
  );
}

export default function PatientRegistration() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);

  // Clinic, doctors & services
  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = not searched yet
  const [selected, setSelected] = useState(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);

  const patientResultsListRef = useRef(null);

  useEffect(() => {
    if (patientResultsListRef.current) {
      const activeEl = patientResultsListRef.current.querySelector(`[data-index="${selectedResultIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedResultIndex]);

  // Quick-add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "", relation_type: "father", relation_name: "",
    phone: "", age: "", gender: "male",
  });
  const [formError, setFormError] = useState("");

  // Visit form (after patient is selected or added)
  const [feeAmount, setFeeAmount] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [receipt, setReceipt] = useState(null);

  // Patient Dues state
  const [duesInfo, setDuesInfo] = useState(null); // { balance_due, transactions }
  const [showCollectDues, setShowCollectDues] = useState(false);
  const [duesCollectAmount, setDuesCollectAmount] = useState("");
  const [duesCollectNote, setDuesCollectNote] = useState("Cash Payment Received at Reception");

  function getDoctorFee(docId, clinicObj = clinic, docsList = doctors) {
    const doc = docsList.find((d) => d.id === docId) || docsList[0];
    const defaultClinicFee = Number(clinicObj?.default_consultation_fee) || 300;
    if (!doc) return defaultClinicFee;
    return Number(doc.consultation_fee) || defaultClinicFee;
  }

  function newRegistration() {
    setShowReceipt(false);
    setReceipt(null);
    setQuery("");
    setResults(null);
    setSelected(null);
    setShowAddForm(false);
    setForm({ full_name: "", relation_type: "father", relation_name: "", phone: "", age: "", gender: "male" });
    const autoFee = getDoctorFee(selectedDoctorId);
    setFeeAmount(String(autoFee));
    setTimeout(() => searchRef.current?.focus(), 100);
  }

  useEffect(() => {
    if (searchRef.current) searchRef.current.focus();
    const c = dbClinic.get();
    setClinic(c);
    const docs = dbUsers.getAll().filter((u) => u.role === "doctor");
    setDoctors(docs);
    if (docs.length > 0) {
      const defaultDocId = docs[0].id;
      setSelectedDoctorId(defaultDocId);
      const autoFee = getDoctorFee(defaultDocId, c, docs);
      setFeeAmount(String(autoFee));
    }
    setServices(dbClinicServices.getAll());

    if (location.state?.patientId) {
      const p = dbPatients.getById(location.state.patientId);
      if (p) {
        setSelected(p);
      }
    }

    function handlePatientRegKeyDown(e) {
      if (e.key === "F1") {
        e.preventDefault();
        if (searchRef.current) {
          searchRef.current.focus();
          searchRef.current.select();
        }
      } else if (e.key === "F2" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        const regBtn = document.getElementById("register-visit-btn") || document.getElementById("save-patient-btn");
        if (regBtn) regBtn.click();
      } else if (e.key === "F3") {
        e.preventDefault();
        setShowAddForm((prev) => !prev);
      } else if (e.key === "Escape") {
        if (showReceipt) {
          newRegistration();
        } else if (showAddForm) {
          setShowAddForm(false);
        } else if (results) {
          setResults(null);
        }
      }
    }

    window.addEventListener("keydown", handlePatientRegKeyDown);
    return () => {
      window.removeEventListener("keydown", handlePatientRegKeyDown);
    };
  }, [location.state, showReceipt, showAddForm, results, selectedDoctorId]);

  function handleDoctorChange(docId) {
    setSelectedDoctorId(docId);
    const fee = getDoctorFee(docId);
    setFeeAmount(String(fee));
  }

  function openNewPatientForm(customName = query) {
    const cleanName = toTitleCase((customName || "").trim());
    setForm({
      full_name: cleanName,
      relation_type: "father",
      relation_name: "",
      phone: "",
      age: "",
      gender: "male",
    });
    setFormError("");
    setShowAddForm(true);
    setSelected(null);
    setShowReceipt(false);
  }

  function handleSearch(e) {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      setShowAddForm(false);
      return;
    }
    const found = dbPatients.search(query.trim());
    setResults(found);
    setSelected(null);
    setSelectedResultIndex(0);
    setShowReceipt(false);
    
    // If no patient found, automatically open Add Form with name pre-populated in Title Case
    if (found.length === 0) {
      openNewPatientForm(query.trim());
    } else {
      setShowAddForm(false);
    }
  }

  function handleSearchKeyDown(e) {
    if (results && results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedResultIndex((prev) => Math.min(results.length - 1, prev + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedResultIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Enter" && !e.ctrlKey) {
        if (results[selectedResultIndex]) {
          e.preventDefault();
          selectPatient(results[selectedResultIndex]);
        }
      }
    }
  }

  function selectPatient(patient) {
    setSelected(patient);
    setShowAddForm(false);
    setShowReceipt(false);
    // Load patient dues on select
    const ledger = dbPatientLedger.getByPatient(patient.id);
    setDuesInfo(ledger && (ledger.balance_due || 0) > 0 ? ledger : null);
    setShowCollectDues(false);
    setDuesCollectAmount("");
    const fee = getDoctorFee(selectedDoctorId);
    setFeeAmount(String(fee));
  }

function toTitleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

  function handleFormChange(field, value) {
    let finalVal = value;
    if (field === "full_name" || field === "relation_name") {
      // Capitalize first letters automatically
      finalVal = value.replace(/(^|\s)\S/g, (l) => l.toUpperCase());
    }
    setForm((prev) => ({ ...prev, [field]: finalVal }));
  }

  function addAndSelectPatient(e) {
    e.preventDefault();
    setFormError("");
    const cleanName = toTitleCase((form.full_name || "").trim());
    const cleanRelName = form.relation_name ? toTitleCase(form.relation_name.trim()) : "";
    
    const candidateData = {
      full_name:     cleanName,
      relation_name: cleanRelName,
      relation_type: form.relation_type || "father",
      phone:         (form.phone || "").trim() || "03000000000",
      age:           form.age !== "" && !isNaN(Number(form.age)) ? Number(form.age) : null,
      gender:        form.gender || "male",
    };

    const validation = validateSchema(patientInputSchema, candidateData);
    if (!validation.success) {
      setFormError(validation.error.message);
      return;
    }

    const newPatient = dbPatients.add(validation.data);
    setSelected(newPatient);
    setShowAddForm(false);
    setResults(null);
    setQuery("");
    const fee = getDoctorFee(selectedDoctorId);
    setFeeAmount(String(fee));
  }

  function registerVisit(e) {
    e.preventDefault();
    if (!selected) return;
    const finalFee = feeAmount !== "" && !isNaN(Number(feeAmount)) ? Number(feeAmount) : getDoctorFee(selectedDoctorId);
    
    // Duplicate Token Safeguard Check
    const todayQueue = dbVisits.getTodayAll();
    const existingActive = todayQueue.find(
      (v) => v.patient_id === selected.id && (v.status === "waiting" || v.status === "in_consultation")
    );
    if (existingActive) {
      const confirmDup = confirm(
        `⚠️ ATTENTION: ${selected.full_name} ALREADY has an active Token (#${existingActive.token_number}) in today's queue!\n\nDo you still want to issue ANOTHER duplicate token for this patient?`
      );
      if (!confirmDup) return;
    }

    const assignedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0] || { id: "user_001", name: "Doctor" };
    const newVisit = dbVisits.add({
      patient_id: selected.id,
      doctor_id: selectedDoctorId || assignedDoctor.id,
      visit_type: "consultation",
      fee_amount: finalFee,
    });

    const currentClinic = clinic || dbClinic.get();
    const receiptData = {
      token: newVisit.token_number,
      token_number: newVisit.token_number,
      patient: selected,
      doctor: assignedDoctor,
      visit: newVisit,
      fee: finalFee,
      fee_amount: finalFee,
      registeredAt: new Date(),
    };

    setReceipt(receiptData);
    setShowReceipt(true);
    setSelected(null);
    setResults(null);
    setQuery("");

    // Auto-trigger 80mm thermal print immediately on token generation
    try {
      printOPDTokenReceipt(receiptData, currentClinic);
    } catch (printErr) {
      console.warn("Auto-print deferred:", printErr);
    }
  }

  function printReceipt() {
    printOPDTokenReceipt(receipt, clinic || dbClinic.get());
  }

  // ── Receipt view ──
  if (showReceipt && receipt) {
    const relLabel =
      receipt.patient.relation_type === "father" ? "S/O" :
      receipt.patient.relation_type === "husband" ? "W/O" :
      receipt.patient.relation_type === "wife" ? "H/O" :
      receipt.patient.relation_type === "mother" ? "D/O" : "S/O";

    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 p-4 md:p-8 flex items-center justify-center">
        {/* ── 80mm thermal print CSS ── */}
        <style>{`
          @media print {
            /* 80mm thermal paper — standard receipt printer width */
            @page {
              size: 80mm auto;
              margin: 4mm 3mm;
            }
            /* Hide everything except the receipt */
            body > * { display: none !important; }
            #thermal-receipt-root { display: block !important; }
            /* Inside the receipt */
            #thermal-receipt {
              width: 74mm !important;
              max-width: 74mm !important;
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              font-size: 11pt !important;
              color: #000 !important;
              page-break-inside: avoid;
            }
            #thermal-receipt .rx-header {
              background: #000 !important;
              color: #fff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            #thermal-receipt .rx-token-num {
              font-size: 42pt !important;
              font-weight: 900 !important;
            }
            #thermal-receipt .rx-clinic-name {
              font-size: 13pt !important;
              font-weight: 700 !important;
            }
            .print\\:hidden { display: none !important; }
          }
        `}</style>

        <div id="thermal-receipt-root" className="w-full max-w-sm">
          {/* Receipt card — screen view */}
          <div
            id="thermal-receipt"
            className="bg-white rounded-3xl shadow-2xl border border-teal-100 overflow-hidden"
          >
            {/* ── Header ── */}
            <div className="rx-header bg-gradient-to-br from-teal-700 to-teal-800 text-white p-5 text-center">
              {/* Clinic Logo */}
              <div className="flex justify-center mb-2">
                <img
                  src={clinic?.logo_url || CLINIC_LOGO_BASE64}
                  alt="Clinic Logo"
                  className="h-16 w-auto max-w-[200px] object-contain rounded-lg bg-white/10 p-1 backdrop-blur-xs"
                />
              </div>
              {/* Dynamic Clinic name */}
              <div className="rx-clinic-name text-base font-bold tracking-wide mb-0.5">
                {clinic?.name || "H/Dr.Asif Ashraf Khan Clinic"}
              </div>
              <div className="text-[10px] opacity-70 mb-0.5">{clinic?.address || "Lajpat Road, Hyderabad"}</div>
              {clinic?.phone && <div className="text-[10px] opacity-70 mb-1">Tel: {clinic.phone}</div>}
              <div className="text-[10px] opacity-60 mb-3">
                {receipt.registeredAt.toLocaleString("en-US", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </div>

              {/* Big Token Number */}
              <div className="bg-white/15 rounded-2xl py-3 px-6 inline-block">
                <div className="text-[10px] font-semibold uppercase tracking-widest opacity-75 mb-0.5">
                  Token No.
                </div>
                <div className="rx-token-num text-6xl font-black leading-none">
                  {String(receipt.token).padStart(2, "0")}
                </div>
              </div>
            </div>

            {/* ── Doctor & Fee Row ── */}
            <div className="mx-4 mt-3 p-3 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Doctor</div>
                <div className="font-black text-gray-900 text-sm">{receipt.doctor?.name || "Doctor"}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Fee Paid</div>
                <div className="font-black text-teal-800 text-sm">Rs. {receipt.fee.toLocaleString()}</div>
              </div>
            </div>

            {/* ── Patient Details ── */}
            <div className="p-4 space-y-2.5 text-sm">
              {/* Name */}
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Patient Name</div>
                <div className="font-bold text-gray-900 text-base leading-tight">{receipt.patient.full_name}</div>
                {receipt.patient.relation_name && (
                  <div className="text-gray-500 text-xs mt-0.5">
                    {relLabel} {receipt.patient.relation_name}
                  </div>
                )}
              </div>

              {/* Phone + Age row */}
              <div className="flex justify-between border-t border-dashed border-gray-200 pt-2 text-xs">
                <div>
                  <span className="text-gray-400">Phone: </span>
                  <span className="font-bold text-gray-800">{receipt.patient.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-gray-400">Age: </span>
                  <span className="font-bold text-gray-800">{formatPatientAge(receipt.patient)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Gender: </span>
                  <span className="font-bold text-gray-800 capitalize">{receipt.patient.gender || "Male"}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-dashed border-gray-200 pt-2 text-center">
                <div className="text-[11px] text-gray-600 font-medium">
                  Please wait — your token will be called
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  شکریہ — جزاک اللہ خیرا
                </div>
              </div>
            </div>
          </div>

          {/* ── Action Buttons (hidden on print) ── */}
          <div className="mt-4 flex gap-3 print:hidden">
            <button
              onClick={printReceipt}
              className="flex-1 flex items-center justify-center gap-2 bg-teal-50 border border-teal-300 text-teal-800 font-bold py-3 px-4 rounded-2xl hover:bg-teal-100 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-xl">print</span>
              Print Thermal Token (80mm)
            </button>
            <button
              onClick={newRegistration}
              className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white font-semibold py-3 px-4 rounded-2xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/25"
            >
              <span className="material-symbols-outlined text-xl">person_add</span>
              Next Patient
            </button>
          </div>

          <button
            onClick={() => navigate("/reception/queue")}
            className="mt-3 w-full text-center text-sm text-gray-500 hover:text-teal-700 transition-colors print:hidden"
          >
            View Today&apos;s Queue →
          </button>
        </div>
      </div>
    );
  }



  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_reg</span>
          Patient Registration
        </h1>
        <p className="text-sm text-gray-500 mt-1">Search for an existing patient or register a new one</p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Search Patient <span className="text-gray-400 font-normal">(name, relation name, or phone)</span>
        </label>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="e.g. Bilal, Abdul Rasheed, 03211112233 [↑ / ↓ to select, Enter to choose]"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50 font-medium"
          />
          <button
            type="submit"
            className="bg-teal-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors flex items-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-xl">search</span>
            Search
          </button>
        </form>

        {/* Search Results */}
        {results !== null && (
          <div className="mt-4">
            {results.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-gray-400 text-sm mb-3">No existing patient found for &quot;{query}&quot;</div>
                <button
                  type="button"
                  onClick={() => openNewPatientForm(query)}
                  className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-2xl font-bold hover:bg-teal-700 transition-colors text-sm shadow-md"
                >
                  <span className="material-symbols-outlined text-xl">person_add</span>
                  Register &quot;{toTitleCase(query)}&quot; as New Patient
                </button>
              </div>
            ) : (
              <>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>{results.length} patient{results.length !== 1 ? "s" : ""} found</span>
                  <span className="text-[11px] text-teal-700 font-bold">Use ↑ / ↓ arrow keys, press Enter</span>
                </div>
                <div ref={patientResultsListRef} className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {results.map((p, idx) => {
                    const isHighlighted = idx === selectedResultIndex;
                    const isSelected = selected?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        data-index={idx}
                        onClick={() => {
                          setSelectedResultIndex(idx);
                          selectPatient(p);
                        }}
                        className={`w-full text-left rounded-xl border p-4 transition-all ${
                          isHighlighted || isSelected
                            ? "border-teal-500 bg-teal-50 shadow-md shadow-teal-100 ring-2 ring-teal-500"
                            : "border-gray-100 hover:border-teal-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-gray-900 flex items-center gap-2">
                              {p.full_name}
                              {isHighlighted && (
                                <span className="text-[10px] bg-teal-600 text-white font-bold px-1.5 py-0.2 rounded font-mono">
                                  ↵ Enter
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                              <RelationTypeBadge type={p.relation_type} />
                              <span>{p.relation_name}</span>
                            </div>
                            <div className="text-sm text-gray-400 mt-1">{p.phone} · {formatPatientAge(p)} · {p.gender}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {(isSelected || isHighlighted) && (
                              <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            )}
                            {/* Live Dues Badge */}
                            {(() => {
                              const bal = dbPatientLedger.getBalance(p.id);
                              return bal > 0 ? (
                                <span className="text-[10px] font-black bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded-full flex items-center gap-0.5 animate-pulse">
                                  <span className="material-symbols-outlined text-[11px]">warning</span>
                                  Udhaar: Rs. {bal.toLocaleString()}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => openNewPatientForm(query)}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 py-3 rounded-2xl text-xs font-bold transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-base text-teal-600">person_add</span>
                  Not the same person? Register <strong>&quot;{toTitleCase(query)}&quot;</strong> as a Brand New Patient
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick-Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-5 mb-4">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600">person_add</span>
            New Patient Details
          </h2>
          <form onSubmit={addAndSelectPatient} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg_full_name" className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
                <input
                  id="reg_full_name"
                  name="full_name"
                  autoComplete="name"
                  required value={form.full_name}
                  onChange={(e) => handleFormChange("full_name", e.target.value)}
                  placeholder="Muhammad Ali"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                />
              </div>
              <div>
                <label htmlFor="reg_relation_type" className="block text-xs font-semibold text-gray-600 mb-1">Relation Type</label>
                <select
                  id="reg_relation_type"
                  name="relation_type"
                  autoComplete="off"
                  value={form.relation_type}
                  onChange={(e) => handleFormChange("relation_type", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                >
                  {RELATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reg_relation_name" className="block text-xs font-semibold text-gray-600 mb-1">Relation Name (Optional)</label>
                <input
                  id="reg_relation_name"
                  name="relation_name"
                  autoComplete="off"
                  value={form.relation_name}
                  onChange={(e) => handleFormChange("relation_name", e.target.value)}
                  placeholder="Father / Husband Name"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                />
              </div>
              <div>
                <label htmlFor="reg_phone" className="block text-xs font-semibold text-gray-600 mb-1">Phone Number (Optional)</label>
                <input
                  id="reg_phone"
                  name="phone"
                  autoComplete="tel"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleFormChange("phone", e.target.value)}
                  placeholder="03001234567"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                />
              </div>
              <div>
                <label htmlFor="reg_age" className="block text-xs font-semibold text-gray-600 mb-1">Age (Optional)</label>
                <input
                  id="reg_age"
                  name="age"
                  autoComplete="off"
                  type="number" min="0" max="120" value={form.age}
                  onChange={(e) => handleFormChange("age", e.target.value)}
                  placeholder="e.g. 35"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                />
              </div>
              <div>
                <label htmlFor="reg_gender" className="block text-xs font-semibold text-gray-600 mb-1">Gender</label>
                <select
                  id="reg_gender"
                  name="gender"
                  autoComplete="sex"
                  value={form.gender}
                  onChange={(e) => handleFormChange("gender", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                id="save-patient-btn"
                type="submit"
                className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors"
              >
                Add Patient & Continue
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Visit Registration Form */}
      {selected && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          {/* Dues Alert Banner + Collect Dues Modal */}
          {duesInfo && (
            <div className="mb-3">
              <div className="flex items-center justify-between gap-3 p-3.5 bg-red-50 border-2 border-red-300 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  <div>
                    <div className="text-sm font-black text-red-800">⚠️ Outstanding Udhaar — Rs. {duesInfo.balance_due.toLocaleString()}</div>
                    <div className="text-[11px] text-red-600 font-medium">Total Credit: Rs. {duesInfo.total_credit?.toLocaleString()} · Paid: Rs. {(duesInfo.total_paid || 0).toLocaleString()}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCollectDues((v) => !v)}
                  className="shrink-0 bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1 transition-colors shadow-md"
                >
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Collect / Settle
                </button>
              </div>
              {showCollectDues && (
                <div className="mt-2 p-4 bg-white border border-red-200 rounded-2xl shadow-sm space-y-3">
                  <div className="text-sm font-bold text-gray-800">💰 Collect Udhaar Payment</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Amount Received (Rs.)</label>
                      <input
                        type="number" min="1" max={duesInfo.balance_due}
                        value={duesCollectAmount}
                        onChange={(e) => setDuesCollectAmount(e.target.value)}
                        placeholder={`Max: Rs. ${duesInfo.balance_due}`}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 font-bold text-red-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Note</label>
                      <input
                        type="text"
                        value={duesCollectNote}
                        onChange={(e) => setDuesCollectNote(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const amt = Number(duesCollectAmount);
                        if (!amt || amt <= 0) { alert("Please enter a valid amount."); return; }
                        const session = JSON.parse(localStorage.getItem("cf_auth_session") || "{}");
                        dbPatientLedger.receivePayment(selected.id, amt, duesCollectNote || "Cash Payment at Reception", session?.name || "Reception");
                        const updatedLedger = dbPatientLedger.getByPatient(selected.id);
                        if (updatedLedger && updatedLedger.balance_due > 0) {
                          setDuesInfo(updatedLedger);
                        } else {
                          setDuesInfo(null);
                        }
                        setShowCollectDues(false);
                        setDuesCollectAmount("");
                        alert(`✅ Payment of Rs. ${amt.toLocaleString()} received from ${selected.full_name}. Balance: Rs. ${Math.max(0, duesInfo.balance_due - amt).toLocaleString()}`);
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                    >
                      ✓ Confirm & Collect
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCollectDues(false)}
                      className="border border-gray-200 text-gray-600 py-2.5 px-4 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-3 mb-4 p-3.5 bg-teal-50/80 rounded-2xl border border-teal-100/90 shadow-sm">
            <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              {selected.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-bold text-gray-900 text-base">{selected.full_name}</div>
                <button
                  type="button"
                  onClick={() => {
                    const newAge = prompt(`Update age for ${selected.full_name}: (leave empty if unknown)`, selected.age ?? "");
                    if (newAge !== null) {
                      const parsed = newAge.trim() === "" ? null : Number(newAge);
                      dbPatients.update(selected.id, { age: parsed });
                      const updated = dbPatients.getById(selected.id);
                      setSelected(updated);
                    }
                  }}
                  className="text-xs font-semibold text-teal-800 bg-white hover:bg-teal-100/70 border border-teal-200 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  Update Age
                </button>
              </div>
              <div className="text-sm text-gray-600 mt-0.5">
                {selected.relation_type === "father" ? "S/O" : selected.relation_type === "husband" ? "W/O" : "H/O"}{" "}
                {selected.relation_name} · Phone: {selected.phone} · <span className="font-semibold text-teal-900">Age: {formatPatientAge(selected)}</span> ({selected.gender})
              </div>
            </div>
          </div>

          <form onSubmit={registerVisit} className="space-y-4">
            {/* Select Doctor & Fee Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Assign Doctor <span className="text-red-500">*</span>
                </label>
                <select
                  id="select-doctor-dropdown"
                  required
                  value={selectedDoctorId}
                  onChange={(e) => handleDoctorChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 font-medium text-gray-900"
                >
                  {doctors.map((doc) => {
                    const docFee = getDoctorFee(doc.id);
                    return (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} (Fee: Rs. {docFee})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Doctor Consultation Fee (Rs.) <span className="text-teal-600 font-bold">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="300"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 font-bold text-teal-800"
                />
              </div>
            </div>

            {/* Quick Clinic Services & Procedures Catalog Pills */}
            {services.length > 0 && (
              <div className="bg-teal-50/70 p-3 rounded-2xl border border-teal-100 space-y-1.5">
                <div className="text-xs font-bold text-teal-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">medical_services</span>
                  Add Procedure / Clinic Service Charge to Token Fee:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {services.map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => {
                        const currentFee = Number(feeAmount) || Number(getDoctorFee(selectedDoctorId)) || 0;
                        setFeeAmount(String(currentFee + Number(srv.price)));
                      }}
                      className="text-xs bg-white text-teal-900 border border-teal-200 hover:bg-teal-100 px-2.5 py-1 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1"
                    >
                      <span>+ {srv.service_name}</span>
                      <span className="text-teal-700 font-mono">(Rs. {srv.price})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              id="register-visit-btn"
              type="submit"
              className="w-full bg-teal-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">confirmation_number</span>
              Register &amp; Generate Token
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
