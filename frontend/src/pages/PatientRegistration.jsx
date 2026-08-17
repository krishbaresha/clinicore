import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dbPatients, dbVisits, dbUsers, dbClinic, dbClinicServices } from "../api/db.js";
import { printOPDTokenReceipt } from "../utils/thermalPrinter.js";
import { formatPatientAge } from "../utils/formatters.js";

const RELATION_TYPES = ["father", "husband", "wife", "mother", "brother", "sister", "son", "daughter"];

function RelationTypeBadge({ type }) {
  const labels = { father: "S/O", husband: "W/O", wife: "H/O", mother: "D/O", brother: "Br/O", sister: "Sr/O", son: "Son of", daughter: "D/O" };
  return <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">{labels[type] || type}</span>;
}

export default function PatientRegistration() {
  const navigate = useNavigate();
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

  // Quick-add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "", relation_type: "father", relation_name: "",
    phone: "", age: "", gender: "male",
  });

  // Visit form (after patient is selected or added)
  const [visitType, setVisitType] = useState("new");
  const [feeAmount, setFeeAmount] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const feeDefault = 800;

  useEffect(() => {
    if (searchRef.current) searchRef.current.focus();
    const c = dbClinic.get();
    setClinic(c);
    const docs = dbUsers.getAll().filter((u) => u.role === "doctor");
    setDoctors(docs);
    if (docs.length > 0) setSelectedDoctorId(docs[0].id);
    setServices(dbClinicServices.getAll());
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) { setResults([]); return; }
    const found = dbPatients.search(query.trim());
    setResults(found);
    setSelected(null);
    setShowAddForm(false);
    setShowReceipt(false);
  }

  function selectPatient(patient) {
    setSelected(patient);
    setShowAddForm(false);
    setShowReceipt(false);
    const priorVisits = dbVisits.getByPatient(patient.id);
    setVisitType(priorVisits.length > 0 ? "follow_up" : "new");
    setFeeAmount(priorVisits.length > 0 ? "1000" : String(feeDefault));
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addAndSelectPatient(e) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) return;
    const newPatient = dbPatients.add({
      full_name:     form.full_name.trim(),
      relation_name: form.relation_name.trim(),
      relation_type: form.relation_type,
      phone:         form.phone.trim(),
      age:           form.age !== "" && !isNaN(Number(form.age)) ? Number(form.age) : null,
      gender:        form.gender,
    });
    setSelected(newPatient);
    setShowAddForm(false);
    setResults(null);
    setQuery("");
    setVisitType("new");
    setFeeAmount(String(feeDefault));
  }

  function registerVisit(e) {
    e.preventDefault();
    if (!selected) return;

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

    const assignedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];
    const newVisit = dbVisits.add({
      patient_id: selected.id,
      doctor_id: selectedDoctorId || assignedDoctor?.id,
      visit_type: visitType,
      fee_amount: Number(feeAmount) || feeDefault,
    });
    const receiptData = {
      token: newVisit.token_number,
      patient: selected,
      doctor: assignedDoctor,
      visit: newVisit,
      fee: Number(feeAmount) || feeDefault,
      registeredAt: new Date(),
    };
    setReceipt(receiptData);
    setShowReceipt(true);
    setSelected(null);
    setResults(null);
    setQuery("");
  }

  function printReceipt() {
    window.print();
  }

  function newRegistration() {
    setShowReceipt(false);
    setReceipt(null);
    setQuery("");
    setResults(null);
    setSelected(null);
    setShowAddForm(false);
    setForm({ full_name: "", relation_type: "father", relation_name: "", phone: "", age: "", gender: "male" });
    setVisitType("new");
    setFeeAmount("");
    setTimeout(() => searchRef.current?.focus(), 100);
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
              {/* Dynamic Clinic name */}
              <div className="rx-clinic-name text-base font-bold tracking-wide mb-0.5">
                {clinic?.name || "Dr. Asif Ashraf's Clinic"}
              </div>
              <div className="text-[10px] opacity-70 mb-0.5">{clinic?.address || "Lajpat Road, Hyderabad"}</div>
              {clinic?.phone && <div className="text-[10px] opacity-70 mb-1">Tel: {clinic.phone}</div>}
              <div className="text-[10px] opacity-60 mb-3">
                {receipt.registeredAt.toLocaleString("en-PK", {
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

            {/* ── Attending Doctor Chamber Box ── */}
            <div className="mx-4 mt-3 p-3 bg-teal-50/90 border border-teal-200/90 rounded-2xl flex items-center justify-between shadow-xs">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Attending Doctor</div>
                <div className="font-black text-teal-950 text-sm">{receipt.doctor?.name || "Dr. Asif Ashraf"}</div>
                <div className="text-[11px] font-semibold text-teal-700">{receipt.doctor?.specialization || "General Physician"}</div>
              </div>
              <div className="bg-teal-700 text-white px-2.5 py-1 rounded-xl text-xs font-black shadow-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">meeting_room</span>
                Chamber {receipt.doctor?.room_number || "Room 1"}
              </div>
            </div>

            {/* ── Patient Details ── */}
            <div className="p-4 space-y-2.5 text-sm">
              {/* Name */}
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Patient</div>
                <div className="font-bold text-gray-900 text-base leading-tight">{receipt.patient.full_name}</div>
                <div className="text-gray-500">
                  {relLabel} {receipt.patient.relation_name}
                </div>
              </div>

              {/* Phone + Age row */}
              <div className="flex justify-between">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase">Phone</div>
                  <div className="font-medium text-gray-800">{receipt.patient.phone || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 uppercase">Age</div>
                  <div className="font-medium text-gray-800">{formatPatientAge(receipt.patient)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 uppercase">Type</div>
                  <div className={`font-semibold ${receipt.visit.visit_type === "follow_up" ? "text-blue-700" : "text-teal-700"}`}>
                    {receipt.visit.visit_type === "follow_up" ? "Follow-up" : "New"}
                  </div>
                </div>
              </div>

              {/* Dashed divider */}
              <div className="border-t border-dashed border-gray-300 my-1" />

              {/* Fee */}
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Consultation Fee</span>
                <span className="text-xl font-black text-teal-700">Rs. {receipt.fee.toLocaleString()}</span>
              </div>

              {/* Footer */}
              <div className="border-t border-dashed border-gray-200 pt-2 text-center">
                <div className="text-[11px] text-gray-500 font-medium">
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
              onClick={() => printOPDTokenReceipt(receipt, clinic)}
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
            placeholder="e.g. Bilal, Abdul Rasheed, 03211112233"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
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
                <div className="text-gray-400 text-sm mb-3">No patient found for &quot;{query}&quot;</div>
                <button
                  onClick={() => { setShowAddForm(true); setForm((f) => ({ ...f, full_name: query })); }}
                  className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-teal-700 transition-colors text-sm"
                >
                  <span className="material-symbols-outlined text-xl">person_add</span>
                  Register New Patient
                </button>
              </div>
            ) : (
              <>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {results.length} patient{results.length !== 1 ? "s" : ""} found — select to register visit
                </div>
                <div className="space-y-2">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectPatient(p)}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${
                        selected?.id === p.id
                          ? "border-teal-500 bg-teal-50 shadow-md shadow-teal-100"
                          : "border-gray-100 hover:border-teal-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-gray-900">{p.full_name}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <RelationTypeBadge type={p.relation_type} />
                            <span>{p.relation_name}</span>
                          </div>
                          <div className="text-sm text-gray-400 mt-1">{p.phone} · {formatPatientAge(p)} · {p.gender}</div>
                        </div>
                        {selected?.id === p.id && (
                          <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-teal-300 text-teal-700 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">person_add</span>
                  Not the right person? Register New Patient
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
                <label htmlFor="reg_relation_type" className="block text-xs font-semibold text-gray-600 mb-1">Relation Type *</label>
                <select
                  id="reg_relation_type"
                  name="relation_type"
                  autoComplete="off"
                  required value={form.relation_type}
                  onChange={(e) => handleFormChange("relation_type", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                >
                  {RELATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reg_relation_name" className="block text-xs font-semibold text-gray-600 mb-1">Relation Name *</label>
                <input
                  id="reg_relation_name"
                  name="relation_name"
                  autoComplete="off"
                  required value={form.relation_name}
                  onChange={(e) => handleFormChange("relation_name", e.target.value)}
                  placeholder="Abdul Rasheed"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                />
              </div>
              <div>
                <label htmlFor="reg_phone" className="block text-xs font-semibold text-gray-600 mb-1">Phone *</label>
                <input
                  id="reg_phone"
                  name="phone"
                  autoComplete="tel"
                  required type="tel" value={form.phone}
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
                  placeholder="e.g. 35 (or leave blank if unknown)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                />
              </div>
              <div>
                <label htmlFor="reg_gender" className="block text-xs font-semibold text-gray-600 mb-1">Gender *</label>
                <select
                  id="reg_gender"
                  name="gender"
                  autoComplete="sex"
                  required value={form.gender}
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
            {/* Select Doctor Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Assign Doctor <span className="text-red-500">*</span>
              </label>
              <select
                id="select-doctor-dropdown"
                required
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 font-medium text-gray-900"
              >
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} — {doc.specialization || "General Physician"} ({doc.room_number || "Room 1"})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Visit Type</label>
                <div className="flex gap-2">
                  {["new", "follow_up"].map((vt) => (
                    <button
                      key={vt}
                      type="button"
                      onClick={() => setVisitType(vt)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        visitType === vt
                          ? "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-200"
                          : "border-gray-200 text-gray-600 hover:border-teal-300"
                      }`}
                    >
                      {vt === "new" ? "New" : "Follow-up"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Consultation / Service Fee (Rs.)</label>
                <input
                  type="number" min="0" value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder={String(feeDefault)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 font-medium"
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
                        const currentFee = Number(feeAmount) || Number(feeDefault) || 0;
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
