import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dbPatients, dbVisits, dbPatientLedger, dbUsers, dbClinic, dbSales } from "../api/db.js";
import { formatPatientAge } from "../utils/formatters.js";
import { compressImageFile } from "../utils/imageCompressor.js";
import { printOPDTokenReceipt, printThermalReceipt } from "../utils/thermalPrinter.js";
import PhotoLightbox from "../components/PhotoLightbox.jsx";

// Pharmacy Thermal Receipt Modal
function PharmacyReceiptModal({ sale, onClose }) {
  if (!sale) return null;
  const clinic = dbClinic.get();
  const subtotal = sale.subtotal_amount ?? sale.items.reduce((s, i) => s + i.line_total, 0);
  const discount = sale.discount_amount ?? 0;
  const cashTendered = sale.cash_tendered ?? sale.total_amount;
  const changeDue = sale.change_due ?? Math.max(0, cashTendered - sale.total_amount);
  
  const rawDate = sale.sale_date ? new Date(sale.sale_date) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const cashierName = sale.cashier_name || sale.user_name || "Cashier Desk";
  const customerName = sale.patient_name || "Linked Patient";
  const invoiceId = sale.receipt_no || sale.id || `POS-${Math.floor(1000 + Math.random() * 9000)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="max-w-md w-full my-6">
        <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-200 text-gray-800 text-xs font-sans space-y-4 relative">
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-600 to-teal-800 text-white font-black text-2xl flex items-center justify-center mx-auto shadow-md shadow-teal-200">
              {(clinic?.name || "D").charAt(0)}
            </div>
            <div className="text-base font-black text-teal-800 mt-1">
              {clinic?.name || "H/Dr.Asif Ashraf Khan Clinic"}
            </div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
              Retail Medical Store Invoice
            </div>
          </div>

          <div className="border-t border-dotted border-gray-400 my-2" />

          <div className="text-xs text-gray-800 font-semibold space-y-1 leading-relaxed">
            <div><span className="text-gray-500 font-medium">Date &amp; Time :</span> {dateTimeStr}</div>
            <div><span className="text-gray-500 font-medium">Cashier :</span> {cashierName}</div>
            <div><span className="text-gray-500 font-medium">Customer :</span> {customerName}</div>
            <div><span className="text-gray-500 font-medium">Invoice # :</span> {invoiceId}</div>
          </div>

          <div className="border-t border-dotted border-gray-400 my-2" />

          <div className="space-y-2">
            {sale.items?.map((item, i) => (
              <div key={i} className="text-xs space-y-0.5">
                <div className="font-bold text-gray-900">{item.medicine_name}</div>
                <div className="flex justify-between items-center text-gray-600 font-medium">
                  <span>{item.quantity || 1} {item.unit_label || "Unit"} × Rs. {Number(item.unit_price || 0).toFixed(2)}</span>
                  <span className="font-extrabold text-gray-900">Rs. {Number(item.line_total || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dotted border-gray-400 my-2" />

          <div className="space-y-1 text-xs text-gray-700 font-semibold">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>Rs. {Number(subtotal).toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-teal-700 font-bold">
                <span>Discount</span>
                <span>- Rs. {Number(discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-gray-900 pt-1">
              <span>Grand Total</span>
              <span>Rs. {Number(sale.total_amount || subtotal).toFixed(2)}</span>
            </div>
            {sale.payment_type === "cash" ? (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Cash Paid</span>
                  <span>Rs. {Number(cashTendered).toFixed(2)}</span>
                </div>
                {changeDue > 0 && (
                  <div className="flex justify-between text-teal-800 font-bold">
                    <span>Change Return</span>
                    <span>Rs. {Number(changeDue).toFixed(2)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Payment Type</span>
                <span>Credit / Udhaar (Added to Patient Ledger)</span>
              </div>
            )}
          </div>

          <div className="border-t border-dotted border-gray-400 my-2" />

          <div className="text-center font-bold text-gray-900 text-xs py-1">
            Thank You For Shopping With Us.<br />Please Visit Again
          </div>

          <div className="pt-2 flex justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => printThermalReceipt(sale, clinic)}
              className="flex-1 border border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">print</span>
              Print Receipt (80mm)
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// Placeholder prescription image — used when mock data has a URL path (not a real data-url)
const RX_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 140' fill='none'%3E%3Crect width='200' height='140' rx='8' fill='%23f0fdf4'/%3E%3Ctext x='100' y='65' font-family='sans-serif' font-size='36' text-anchor='middle' fill='%2316a34a'%3E%E2%80%8B%F0%9F%93%8B%3C/text%3E%3Ctext x='100' y='95' font-family='sans-serif' font-size='12' text-anchor='middle' fill='%2316a34a' font-weight='600'%3EPrescription Document%3C/text%3E%3C/svg%3E`;
const REPORT_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 140' fill='none'%3E%3Crect width='200' height='140' rx='8' fill='%23eff6ff'/%3E%3Ctext x='100' y='65' font-family='sans-serif' font-size='36' text-anchor='middle' fill='%233b82f6'%3E%F0%9F%A9%BB%3C/text%3E%3Ctext x='100' y='95' font-family='sans-serif' font-size='12' text-anchor='middle' fill='%231d4ed8' font-weight='600'%3EMedical Diagnostic Report%3C/text%3E%3C/svg%3E`;

function resolveImgSrc(src) {
  if (!src) return null;
  if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("http:") || src.startsWith("https:")) return src;
  return RX_PLACEHOLDER;
}

function resolveReportSrc(src) {
  if (!src) return null;
  if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("http:") || src.startsWith("https:")) return src;
  return REPORT_PLACEHOLDER;
}

function getRelLabel(type) {
  return { father: "S/O", husband: "W/O", wife: "H/O", mother: "D/O", brother: "Br/O", sister: "Sr/O" }[type] || "";
}

function VisitCard({ visit, index, onUpdate, onViewReceipt }) {
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const rxSrc = resolveImgSrc(visit.prescription_image_url);
  const reportSrcs = (visit.report_image_urls || []).map(resolveReportSrc).filter(Boolean);
  const isRecent = index === 0;

  const linkedSales = dbSales.getAll().filter(
    (s) => s.visit_id === visit.id || (s.patient_id === visit.patient_id && s.sale_date?.split("T")[0] === visit.visit_date?.split("T")[0])
  );

  async function handleRxUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const compressed = await compressImageFile(file);
      dbVisits.update(visit.id, { prescription_image_url: compressed });
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Rx Upload error:", err);
      alert("Failed to attach prescription: " + (err?.message || "Unknown error"));
    } finally {
      e.target.value = "";
      setIsUploading(false);
    }
  }

  async function handleReportsUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const newReports = [...(visit.report_image_urls || [])];
      for (const file of files) {
        const compressed = await compressImageFile(file);
        newReports.push(compressed);
      }
      dbVisits.update(visit.id, { report_image_urls: newReports });
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Reports Upload error:", err);
      alert("Failed to attach reports: " + (err?.message || "Unknown error"));
    } finally {
      e.target.value = "";
      setIsUploading(false);
    }
  }

  function handleDeleteRx(e) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove this prescription photo?")) return;
    dbVisits.update(visit.id, { prescription_image_url: null });
    if (onUpdate) onUpdate();
  }

  function handleDeleteReport(indexToDelete, e) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this report photo?")) return;
    const filtered = (visit.report_image_urls || []).filter((_, i) => i !== indexToDelete);
    dbVisits.update(visit.id, { report_image_urls: filtered });
    if (onUpdate) onUpdate();
  }

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
                  {new Date(visit.visit_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
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

          {/* Prescription Photo Section */}
          <div className="mb-3">
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">📋 Prescription</div>
              <label className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-0.5 rounded-lg cursor-pointer inline-flex items-center gap-1 transition-all">
                <span className="material-symbols-outlined text-xs">add_photo_alternate</span>
                {rxSrc ? "Replace Photo" : "+ Attach Gallery Photo"}
                <input type="file" accept="image/*" className="hidden" onChange={handleRxUpload} />
              </label>
            </div>

            {rxSrc ? (
              <div className="relative group w-fit max-w-[240px]">
                <button
                  onClick={() => setLightboxSrc(rxSrc)}
                  className="rounded-xl overflow-hidden border border-gray-100 hover:border-teal-200 transition-all shadow-sm hover:shadow-md block w-full"
                >
                  <img src={rxSrc} alt="Prescription" className="w-full object-cover aspect-video" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                    <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity text-3xl drop-shadow">zoom_in</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRx}
                  title="Remove Prescription Photo"
                  className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow-md opacity-90 hover:opacity-100 transition-all flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">hide_image</span>
                No prescription photo attached yet
              </div>
            )}
          </div>

          {/* Report Photos Section */}
          <div className="mb-3">
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">🩻 Reports ({reportSrcs.length})</div>
              <label className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg cursor-pointer inline-flex items-center gap-1 transition-all">
                <span className="material-symbols-outlined text-xs">upload_file</span>
                + Add Report Photos
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleReportsUpload} />
              </label>
            </div>

            {reportSrcs.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {reportSrcs.map((src, i) => (
                  <div key={i} className="relative group w-20 h-20">
                    <button
                      onClick={() => setLightboxSrc(src)}
                      className="rounded-xl overflow-hidden border border-gray-100 hover:border-blue-200 transition-all shadow-sm hover:shadow-md w-full h-full block"
                    >
                      <img src={src} alt={`Report ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                        <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity text-xl">zoom_in</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteReport(i, e)}
                      title="Delete Report"
                      className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-0.5 shadow-md opacity-90 hover:opacity-100 transition-all flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[10px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">hide_image</span>
                No lab/X-ray reports
              </div>
            )}
          </div>

          {isUploading && (
            <div className="p-2 bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold rounded-xl animate-pulse flex items-center gap-2 my-2">
              <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
              Compressing &amp; Attaching Photo...
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
              Follow-up: {new Date(visit.follow_up_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          )}

          {/* Pharmacy Dispensed Medicines & Receipts Section */}
          {linkedSales.length > 0 && (
            <div className="mt-3 pt-3 border-t border-dashed border-gray-200 space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-emerald-600">medication</span>
                Pharmacy Dispensed Medicines &amp; Receipts ({linkedSales.length})
              </div>
              <div className="space-y-2">
                {linkedSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-gray-900 text-xs">
                          Invoice #{sale.receipt_no || sale.id}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sale.payment_type === "credit"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {sale.payment_type === "credit" ? "Credit / Udhaar" : "Cash Paid"}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-600 mt-1">
                        {sale.items?.length || 0} item{(sale.items?.length || 0) > 1 ? "s" : ""} (
                        {sale.items?.map((it) => `${it.medicine_name} × ${it.quantity}`).join(", ") || "Medicines"}
                        )
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-black text-emerald-950 text-sm">
                          Rs. {Number(sale.total_amount || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-500">POS Total</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onViewReceipt && onViewReceipt(sale)}
                        className="bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">receipt_long</span>
                        View Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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

  // Instant New Visit & Token Modal
  const [showNewVisitModal, setShowNewVisitModal] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [visitFee, setVisitFee] = useState("");
  const [issuedReceipt, setIssuedReceipt] = useState(null);

  // Pharmacy Receipt Viewer Modal
  const [selectedPharmacyReceipt, setSelectedPharmacyReceipt] = useState(null);

  function getDoctorFee(docId, docsList = doctors) {
    const doc = docsList.find((d) => d.id === docId) || docsList[0];
    const clinicObj = dbClinic.get();
    const defaultClinicFee = Number(clinicObj?.default_consultation_fee) || 300;
    if (!doc) return defaultClinicFee;
    return Number(doc.consultation_fee) || defaultClinicFee;
  }

  function handleDoctorChange(docId) {
    setSelectedDoctorId(docId);
    const fee = getDoctorFee(docId);
    setVisitFee(String(fee));
  }

  useEffect(() => {
    const p = dbPatients.getById(id);
    if (!p) { setError("Patient not found."); return; }
    setPatient(p);
    setVisits(dbVisits.getByPatient(id)); // sorted most-recent first

    const docs = dbUsers.getAll().filter((u) => u.role === "doctor");
    setDoctors(docs);
    if (docs.length > 0) {
      const defDoc = docs[0].id;
      setSelectedDoctorId(defDoc);
      setVisitFee(String(getDoctorFee(defDoc, docs)));
    }
  }, [id]);

  function handleCreateVisitAndToken(e) {
    e.preventDefault();
    if (!patient) return;
    const finalFee = visitFee !== "" && !isNaN(Number(visitFee)) ? Number(visitFee) : getDoctorFee(selectedDoctorId);

    // Duplicate Token Safeguard Check
    const todayQueue = dbVisits.getTodayAll();
    const existingActive = todayQueue.find(
      (v) => v.patient_id === patient.id && (v.status === "waiting" || v.status === "in_consultation")
    );
    if (existingActive) {
      const confirmDup = confirm(
        `⚠️ ATTENTION: ${patient.full_name} ALREADY has an active Token (#${existingActive.token_number}) in today's queue!\n\nDo you still want to issue ANOTHER duplicate token for this patient?`
      );
      if (!confirmDup) return;
    }

    const assignedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0] || { id: "user_001", name: "Doctor" };
    const newVisit = dbVisits.add({
      patient_id: patient.id,
      doctor_id: selectedDoctorId || assignedDoctor.id,
      visit_type: "consultation",
      fee_amount: finalFee,
    });

    const currentClinic = dbClinic.get();
    const receiptData = {
      token: newVisit.token_number,
      token_number: newVisit.token_number,
      patient: patient,
      doctor: assignedDoctor,
      visit: newVisit,
      fee: finalFee,
      fee_amount: finalFee,
      registeredAt: new Date(),
    };

    setIssuedReceipt(receiptData);
    setVisits(dbVisits.getByPatient(patient.id)); // refresh history immediately!

    // Auto-trigger 80mm thermal print
    try {
      printOPDTokenReceipt(receiptData, currentClinic);
    } catch (err) {
      console.warn("Print token failed:", err);
    }
  }

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
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-teal-100">
            <span>Age: {formatPatientAge(patient)}</span>
            {patient.gender && <span className="capitalize">{patient.gender}</span>}
            {patient.phone && <span>Phone: {patient.phone}</span>}
            <button
              type="button"
              onClick={() => {
                const newAge = prompt(`Update age for ${patient.full_name}: (leave empty if unknown)`, patient.age ?? "");
                if (newAge !== null) {
                  const parsed = newAge.trim() === "" ? null : Number(newAge);
                  dbPatients.update(patient.id, { age: parsed });
                  setPatient(dbPatients.getById(patient.id));
                }
              }}
              className="text-[11px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-md font-medium text-white transition-colors"
            >
              Edit Age
            </button>
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
            onClick={() => {
              setIssuedReceipt(null);
              setShowNewVisitModal(true);
            }}
            className="flex items-center gap-1.5 bg-teal-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-teal-700 transition-colors shadow-md shadow-teal-600/20"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Visit &amp; Token
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
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  index={i}
                  onUpdate={() => setVisits(dbVisits.getByPatient(id))}
                  onViewReceipt={setSelectedPharmacyReceipt}
                />
              ))}
            </ol>
          </>
        )}
      </section>

      {/* Quick New Visit & Token Issuance Modal */}
      {showNewVisitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          {!issuedReceipt ? (
            <form
              onSubmit={handleCreateVisitAndToken}
              className="bg-white p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="font-black text-gray-900 text-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-600">confirmation_number</span>
                  Issue New OPD Token
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewVisitModal(false)}
                  className="text-gray-400 hover:text-gray-600 rounded-full p-1"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Patient Badge */}
              <div className="bg-teal-50/90 border border-teal-200/90 p-3.5 rounded-2xl">
                <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Patient Details</div>
                <div className="text-base font-black text-teal-950 mt-0.5">{patient.full_name}</div>
                <div className="text-xs text-teal-800 mt-0.5">
                  {relLabel} {patient.relation_name} · Age: {formatPatientAge(patient)} · {patient.phone || "No Phone"}
                </div>
              </div>

              {/* Doctor Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Assign Doctor <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedDoctorId}
                  onChange={(e) => handleDoctorChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold bg-gray-50 text-gray-900"
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

              {/* Consultation Fee */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Consultation Fee (Rs) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={visitFee}
                  onChange={(e) => setVisitFee(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-black text-teal-900"
                  placeholder="e.g. 300"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowNewVisitModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-black text-xs hover:bg-teal-700 shadow-lg shadow-teal-600/25 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  Issue Token &amp; Print Slip
                </button>
              </div>
            </form>
          ) : (
            /* Generated Token Receipt Card Modal */
            <div className="bg-white p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl text-center">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-2xl">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h3 className="font-black text-gray-900 text-lg">Token Issued Successfully!</h3>
              
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 my-2">
                <div className="text-xs font-bold text-teal-700 uppercase tracking-widest">Token Number</div>
                <div className="text-5xl font-black text-teal-950 my-1">
                  {String(issuedReceipt.token).padStart(2, "0")}
                </div>
                <div className="text-xs text-teal-800 font-semibold mt-1">
                  Doctor: {issuedReceipt.doctor?.name || "Doctor"}
                </div>
                <div className="text-xs font-bold text-teal-900">
                  Fee Paid: Rs. {issuedReceipt.fee.toLocaleString()}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => printOPDTokenReceipt(issuedReceipt, dbClinic.get())}
                  className="w-full bg-teal-50 text-teal-800 border border-teal-300 py-2.5 rounded-xl font-bold text-xs hover:bg-teal-100 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  Print Thermal Slip (80mm) Again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewVisitModal(false);
                    setIssuedReceipt(null);
                    navigate("/reception/queue");
                  }}
                  className="w-full bg-teal-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-teal-700 flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-teal-600/20"
                >
                  <span className="material-symbols-outlined text-base">queue</span>
                  View Today&apos;s Live Queue →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewVisitModal(false);
                    setIssuedReceipt(null);
                  }}
                  className="w-full text-gray-500 py-1.5 text-xs font-semibold hover:text-gray-800"
                >
                  Close &amp; Stay in Profile
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
              className="bg-white p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
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

      {/* Pharmacy POS Receipt Viewer Modal */}
      {selectedPharmacyReceipt && (
        <PharmacyReceiptModal
          sale={selectedPharmacyReceipt}
          onClose={() => setSelectedPharmacyReceipt(null)}
        />
      )}
    </div>
  );
}
