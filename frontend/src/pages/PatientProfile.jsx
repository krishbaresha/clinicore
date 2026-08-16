import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dbPatients, dbVisits, dbPatientLedger } from "../api/db.js";

// Placeholder prescription image — used when mock data has a URL path (not a real data-url)
const RX_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 140' fill='none'%3E%3Crect width='200' height='140' rx='8' fill='%23f0fdf4'/%3E%3Ctext x='100' y='55' font-family='sans-serif' font-size='36' text-anchor='middle' fill='%2316a34a'%3E%E2%80%8B%F0%9F%93%8B%3C/text%3E%3Ctext x='100' y='85' font-family='sans-serif' font-size='11' text-anchor='middle' fill='%2316a34a' font-weight='600'%3EPrescription Photo%3C/text%3E%3Ctext x='100' y='103' font-family='sans-serif' font-size='9' text-anchor='middle' fill='%2315803d'%3E(demo placeholder)%3C/text%3E%3C/svg%3E`;
const REPORT_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 140' fill='none'%3E%3Crect width='200' height='140' rx='8' fill='%23eff6ff'/%3E%3Ctext x='100' y='55' font-family='sans-serif' font-size='36' text-anchor='middle' fill='%233b82f6'%3E%F0%9F%A9%BB%3C/text%3E%3Ctext x='100' y='85' font-family='sans-serif' font-size='11' text-anchor='middle' fill='%231d4ed8' font-weight='600'%3EReport Photo%3C/text%3E%3Ctext x='100' y='103' font-family='sans-serif' font-size='9' text-anchor='middle' fill='%231e40af'%3E(demo placeholder)%3C/text%3E%3C/svg%3E`;

function resolveImgSrc(src) {
  if (!src) return null;
  // If it's a data URL already (from camera), use directly
  if (src.startsWith("data:")) return src;
  // If it's a mock path like /mock-images/rx_visit_001.jpg, return a placeholder
  return RX_PLACEHOLDER;
}

function resolveReportSrc(src) {
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  return REPORT_PLACEHOLDER;
}

function PhotoLightbox({ src, alt, onClose }) {
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]" />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>
  );
}

function getRelLabel(type) {
  return { father: "S/O", husband: "W/O", wife: "H/O", mother: "D/O", brother: "Br/O", sister: "Sr/O" }[type] || "";
}

function VisitCard({ visit, index }) {
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const rxSrc = resolveImgSrc(visit.prescription_image_url);
  const reportSrcs = (visit.report_image_urls || []).map(resolveReportSrc).filter(Boolean);
  const isRecent = index === 0;

  return (
    <>
      {lightboxSrc && <PhotoLightbox src={lightboxSrc} alt="Prescription / Report" onClose={() => setLightboxSrc(null)} />}

      <li className="ml-6 relative">
        {/* Timeline dot */}
        <div className={`absolute -left-[33px] top-3 w-4 h-4 rounded-full border-2 border-white ${isRecent ? "bg-teal-600" : "bg-gray-400"}`} />

        <div className={`rounded-2xl border ${isRecent ? "border-teal-100 bg-white shadow-md shadow-teal-50" : "border-gray-100 bg-white shadow-sm"} p-4`}>
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {new Date(visit.visit_date).toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" })}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  visit.visit_type === "follow_up" ? "bg-blue-50 text-blue-700" : "bg-teal-50 text-teal-700"
                }`}>
                  {visit.visit_type === "follow_up" ? "Follow-up" : "New Visit"}
                </span>
                {isRecent && (
                  <span className="text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full font-semibold">Most Recent</span>
                )}
                {visit.status === "completed" && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Completed</span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Token #{visit.token_number}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-teal-700">Rs. {visit.fee_amount?.toLocaleString() ?? "—"}</div>
              <div className="text-xs text-gray-400">Fee Paid</div>
            </div>
          </div>

          {/* Prescription Photo */}
          {rxSrc ? (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">📋 Prescription</div>
              <button
                onClick={() => setLightboxSrc(rxSrc)}
                className="group relative rounded-xl overflow-hidden border border-gray-100 hover:border-teal-200 transition-all shadow-sm hover:shadow-md w-full max-w-[240px]"
              >
                <img src={rxSrc} alt="Prescription" className="w-full object-cover aspect-video" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity text-3xl drop-shadow">zoom_in</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="mb-3 text-xs text-gray-400 italic flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">hide_image</span>
              No prescription photo
            </div>
          )}

          {/* Report Photos */}
          {reportSrcs.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">🩻 Reports ({reportSrcs.length})</div>
              <div className="flex gap-2 flex-wrap">
                {reportSrcs.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxSrc(src)}
                    className="group relative rounded-xl overflow-hidden border border-gray-100 hover:border-blue-200 transition-all shadow-sm hover:shadow-md w-20 h-20"
                  >
                    <img src={src} alt={`Report ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity text-xl">zoom_in</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {visit.notes && (
            <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-2 mt-2">{visit.notes}</p>
          )}

          {/* Follow-up */}
          {visit.follow_up_date && (
            <div className="flex items-center gap-1.5 text-xs text-teal-700 mt-2">
              <span className="material-symbols-outlined text-sm">event_available</span>
              Follow-up: {new Date(visit.follow_up_date).toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          )}
        </div>
      </li>
    </>
  );
}

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [error, setError] = useState("");

  // Patient Khata Receive Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [khataPayInput, setKhataPayInput] = useState("");

  useEffect(() => {
    const p = dbPatients.getById(id);
    if (!p) { setError("Patient not found."); return; }
    setPatient(p);
    setVisits(dbVisits.getByPatient(id)); // sorted most-recent first
  }, [id]);

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 font-medium">
        {error}{" "}
        <button className="underline text-teal-600" onClick={() => navigate("/patients")}>Back to Patients</button>
      </div>
    );
  }

  if (!patient) {
    return <div className="p-8 text-center text-gray-400">Loading…</div>;
  }

  const relLabel = getRelLabel(patient.relation_type);

  return (
    <div className="p-3 sm:p-5 md:p-8 max-w-4xl mx-auto w-full">
      {/* Back */}
      <button
        onClick={() => navigate("/patients")}
        className="flex items-center gap-1 text-sm text-teal-600 hover:underline mb-4"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Back to Patients
      </button>

      {/* Patient Header */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-5 text-white mb-5 shadow-xl shadow-teal-600/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center font-black text-xl shrink-0">
              {patient.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{patient.full_name}</h1>
              {patient.relation_name && (
                <div className="text-teal-100 text-sm mt-0.5">
                  {relLabel} {patient.relation_name}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-teal-100">
            {patient.age && <span>🎂 {patient.age} yrs</span>}
            {patient.gender && <span className="capitalize">👤 {patient.gender}</span>}
            {patient.phone && <span>📞 {patient.phone}</span>}
            {patient.cnic && <span>🪪 {patient.cnic}</span>}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 mt-4 pt-4 border-t border-white/20">
          <div>
            <div className="text-2xl font-black">{visits.length}</div>
            <div className="text-xs text-teal-200">Total Visits</div>
          </div>
          <div>
            <div className="text-2xl font-black">
              {visits.length > 0 ? new Date(visits[0].visit_date).getFullYear() : "—"}
            </div>
            <div className="text-xs text-teal-200">Last Seen</div>
          </div>
          <div>
            <div className="text-2xl font-black">
              {new Date(patient.created_at).getFullYear()}
            </div>
            <div className="text-xs text-teal-200">Patient Since</div>
          </div>
          
          {/* Patient Khata Balance Card */}
          {(() => {
            const ledger = dbPatientLedger.getByPatient(patient.id);
            const due = ledger?.balance_due || 0;
            return (
              <div className="ml-auto bg-white/10 px-3 py-1.5 rounded-xl flex items-center gap-3 border border-white/20">
                <div>
                  <div className="text-xs text-teal-100 uppercase font-semibold">Khata Balance</div>
                  <div className={`text-lg font-black ${due > 0 ? "text-amber-300" : "text-emerald-200"}`}>
                    Rs. {due.toLocaleString()}
                  </div>
                </div>
                {due > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPayModal(true)}
                    className="bg-amber-400 text-teal-950 text-xs px-2.5 py-1 rounded-lg font-bold hover:bg-amber-300 shadow"
                  >
                    Receive Due
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Visit History Timeline */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Visit History
            <span className="ml-2 text-sm font-normal text-gray-500">({visits.length})</span>
          </h2>
          <button
            onClick={() => navigate("/reception/register")}
            className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-teal-700 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Visit
          </button>
        </div>

        {visits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 shadow-sm">
            <span className="material-symbols-outlined text-4xl block mb-2 text-gray-200">history</span>
            No visits recorded yet.
          </div>
        ) : (
          <>
            {/* "History never lost across years" banner — shown if patient has visits spanning >1 year */}
            {visits.length >= 2 && (() => {
              const oldest = new Date(visits[visits.length - 1].visit_date);
              const newest = new Date(visits[0].visit_date);
              const yearDiff = newest.getFullYear() - oldest.getFullYear();
              return yearDiff >= 1 ? (
                <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5 mb-4 text-sm text-teal-700">
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
                  <span>
                    <strong>History complete</strong> — {yearDiff} year{yearDiff > 1 ? "s" : ""} of records spanning{" "}
                    {oldest.getFullYear()} to {newest.getFullYear()}
                  </span>
                </div>
              ) : null;
            })()}

            <ol className="relative border-l-2 border-teal-100 ml-4 flex flex-col gap-4">
              {visits.map((visit, i) => (
                <VisitCard key={visit.id} visit={visit} index={i} />
              ))}
            </ol>
          </>
        )}
      </section>

      {/* Khata Receive Payment Modal */}
      {showPayModal && (() => {
        const ledger = dbPatientLedger.getByPatient(patient.id);
        const due = ledger?.balance_due || 0;
        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const amt = Number(khataPayInput);
                if (!amt || amt <= 0) return;
                dbPatientLedger.receivePayment(patient.id, amt);
                setKhataPayInput("");
                setShowPayModal(false);
              }}
              className="bg-white p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl"
            >
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">payments</span>
                Receive Khata Payment
              </h3>
              <div className="text-xs text-gray-600 space-y-1 bg-teal-50 p-3 rounded-xl border border-teal-100">
                <div>Patient Name: <strong className="text-gray-900">{patient.full_name}</strong></div>
                <div>Current Khata Outstanding: <strong className="text-amber-700">Rs. {due.toLocaleString()}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Payment Amount Received (Rs) *</label>
                <input
                  type="number"
                  max={due}
                  value={khataPayInput}
                  onChange={(e) => setKhataPayInput(e.target.value)}
                  placeholder={`Max Rs. ${due}`}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-500 font-bold"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPayModal(false); setKhataPayInput(""); }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-teal-700 shadow-md shadow-teal-600/20"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        );
      })()}
    </div>
  );
}
