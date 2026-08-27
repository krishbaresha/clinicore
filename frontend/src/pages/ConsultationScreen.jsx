import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dbVisits, dbPatients, dbUsers, dbClinicServices } from "../api/db.js";
import { useAuth } from "../hooks/useAuth.js";
import { formatPatientAge } from "../utils/formatters.js";
import { compressImageFile } from "../utils/imageCompressor.js";

function PhotoCapture({ label, multiple = false, onCapture, onRemove, photos = [] }) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);

  async function openCamera() {
    try {
      setCapturedPreview(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 150);
    } catch {
      alert("Camera not available. Please use the Upload button instead.");
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCapturedPreview(null);
  }

  async function snap() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width  = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    const rawData = canvas.toDataURL("image/jpeg", 0.9);
    try {
      const compressed = await compressImageFile(rawData);
      setCapturedPreview(compressed);
    } catch {
      setCapturedPreview(rawData);
    }
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
  }

  function confirmCapture() {
    if (!capturedPreview) return;
    onCapture(capturedPreview);
    setCapturedPreview(null);
    setShowCamera(false);
  }

  async function handleFile(e) {
    const files = Array.from(e.target.files || []);
    setIsCompressing(true);
    for (const file of files) {
      try {
        const compressed = await compressImageFile(file);
        onCapture(compressed);
      } catch (err) {
        console.error("Compression error:", err);
      }
    }
    setIsCompressing(false);
    e.target.value = "";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-800 text-sm">{label}</h3>
        {photos.length > 0 && (
          <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full font-bold">
            {photos.length} photo{photos.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Camera / Preview Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          {!capturedPreview ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-w-lg rounded-2xl shadow-2xl border border-white/20"
              />
              <div className="flex gap-4 mt-6">
                <button
                  onClick={stopCamera}
                  className="bg-white/20 hover:bg-white/30 text-white min-h-[44px] px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined">close</span>
                  <span>Cancel</span>
                </button>
                <button
                  onClick={snap}
                  className="bg-white text-slate-900 min-h-[44px] px-8 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-xl cursor-pointer hover:bg-slate-100 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-teal-600">camera</span>
                  <span>Take Photo</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <img src={capturedPreview} alt="Preview" className="w-full max-w-lg rounded-2xl object-contain max-h-[70vh] shadow-2xl border border-white/20" />
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => { setCapturedPreview(null); openCamera(); }}
                  className="bg-white/20 hover:bg-white/30 text-white min-h-[44px] px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined">replay</span>
                  <span>Retake</span>
                </button>
                <button
                  onClick={confirmCapture}
                  className="bg-teal-600 hover:bg-teal-500 text-white min-h-[44px] px-8 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-xl cursor-pointer transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>Use Photo</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Photos grid */}
      {photos.length > 0 && (
        <div className={`grid gap-3 mb-3 ${multiple ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}>
          {photos.map((src, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-xs">
              <img
                src={src}
                alt={`${label} ${i + 1}`}
                className="w-full object-cover aspect-square bg-slate-100"
              />
              <button
                onClick={() => onRemove(i)}
                className="absolute top-1.5 right-1.5 w-7 h-7 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity text-xs shadow-md cursor-pointer"
                title="Remove photo"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Capture buttons */}
      {(multiple || photos.length === 0) && (
        <div className="flex flex-col gap-2">
          {isCompressing && (
            <div className="flex items-center justify-center gap-2 p-2.5 bg-teal-50 text-teal-800 rounded-xl text-xs font-bold animate-pulse border border-teal-200/80">
              <span className="material-symbols-outlined text-base animate-spin">sync</span>
              <span>Compressing HD photo to ~120KB canvas...</span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={openCamera}
              className="flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-teal-300 rounded-2xl p-4 text-teal-800 hover:bg-teal-50/80 hover:border-teal-400 transition-all cursor-pointer active:scale-98 shadow-xs"
            >
              <span className="material-symbols-outlined text-2xl sm:text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
              <span className="text-xs sm:text-sm font-bold">Take Photo</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className="flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-300 rounded-2xl p-4 text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 cursor-pointer active:scale-98 shadow-xs"
            >
              <span className="material-symbols-outlined text-2xl sm:text-3xl">upload</span>
              <span className="text-xs sm:text-sm font-bold">Upload Photo</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={multiple}
            onChange={handleFile}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

export default function ConsultationScreen() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);
  const [priorVisitCount, setPriorVisitCount] = useState(0);
  const [prescriptionPhoto, setPrescriptionPhoto] = useState(null);
  const [reportPhotos, setReportPhotos] = useState([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Vitals HUD State (Blood Pressure, Pulse Rate, Body Temperature, SpO2, Weight)
  const [vitalsBP, setVitalsBP] = useState("");
  const [vitalsPulse, setVitalsPulse] = useState("");
  const [vitalsTemp, setVitalsTemp] = useState("");
  const [vitalsSpo2, setVitalsSpo2] = useState("");
  const [vitalsWeight, setVitalsWeight] = useState("");

  const [services, setServices] = useState([]);

  useEffect(() => {
    function loadData() {
      const v = dbVisits.getById(visitId);
      if (!v) return;
      setVisit(v);
      const p = dbPatients.getById(v.patient_id);
      setPatient(p);
      if (p) {
        const pv = dbVisits.getByPatient(p.id);
        setPriorVisitCount(pv.filter((pv2) => pv2.id !== visitId).length);
      }
      // Restore any existing photos & vitals
      if (v.prescription_image_url) setPrescriptionPhoto(v.prescription_image_url);
      if (v.report_image_urls?.length) setReportPhotos(v.report_image_urls);
      if (v.notes) setNotes(v.notes);
      if (v.vitals_bp) setVitalsBP(v.vitals_bp);
      if (v.vitals_pulse) setVitalsPulse(v.vitals_pulse);
      if (v.vitals_temp) setVitalsTemp(v.vitals_temp);
      if (v.vitals_spo2) setVitalsSpo2(v.vitals_spo2);
      if (v.vitals_weight) setVitalsWeight(v.vitals_weight);

      setServices(dbClinicServices.getAll());
    }

    loadData();
    window.addEventListener("clinicflow_status_update", loadData);

    function handleConsultationKeyDown(e) {
      if (e.key === "F1") {
        e.preventDefault();
        const el = document.getElementById("doctor-clinical-notes-input");
        if (el) el.focus();
      } else if (e.key === "F2" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        const btn = document.getElementById("complete-visit-btn");
        if (btn) btn.click();
      } else if (e.key === "Escape") {
        if (done) {
          navigate("/doctor/queue");
        }
      }
    }

    window.addEventListener("keydown", handleConsultationKeyDown);

    return () => {
      window.removeEventListener("clinicflow_status_update", loadData);
      window.removeEventListener("keydown", handleConsultationKeyDown);
    };
  }, [visitId, done, navigate]);

  function addReportPhoto(src) {
    setReportPhotos((prev) => [...prev, src]);
  }
  function removeReportPhoto(i) {
    setReportPhotos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function completeVisit(targetStatus = "completed") {
    setSaving(true);
    const completedVisit = dbVisits.complete(visitId, {
      prescription_image_url: prescriptionPhoto || null,
      report_image_urls: reportPhotos || [],
      notes: notes || "",
      vitals_bp: vitalsBP.trim(),
      vitals_pulse: vitalsPulse.trim(),
      vitals_temp: vitalsTemp.trim(),
      vitals_spo2: vitalsSpo2.trim(),
      vitals_weight: vitalsWeight.trim(),
      forcedStatus: targetStatus,
    });
    setSaving(false);
    setDone(completedVisit);
  }

  // ── Ownership Guard Check ──
  const currentUserId = user?.userId || user?.id;
  const isDoctor = user?.role === "doctor";
  const isOwnerDoctor = visit && visit.doctor_id ? visit.doctor_id === currentUserId : true;

  if (visit && isDoctor && !isOwnerDoctor) {
    const assignedDoc = dbUsers.getById(visit.doctor_id);
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md bg-rose-50 border border-rose-200 rounded-3xl p-8 shadow-sm">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">block</span>
          </div>
          <h2 className="text-xl font-bold text-rose-900 mb-2">Access Denied: Not Your Patient</h2>
          <p className="text-sm text-rose-700 mb-6">
            This visit (Token #{visit.token_number}) is assigned to{" "}
            <strong>{assignedDoc ? assignedDoc.name : "another doctor"}</strong>. Each doctor can only consult their own assigned queue.
          </p>
          <button
            onClick={() => navigate("/doctor/queue")}
            className="w-full bg-rose-600 text-white py-3 rounded-2xl font-bold hover:bg-rose-700 transition-colors shadow-md shadow-rose-600/20 cursor-pointer"
          >
            Back to My Queue
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    const isPendingReports = done.status === "completed_reports_pending";
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md glass-card p-8 shadow-lg">
          <div className="w-20 h-20 bg-teal-100/80 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <span className="material-symbols-outlined text-4xl text-teal-700" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Visit Completed</h2>
          <p className="text-slate-600 text-sm mb-2 font-medium">
            Prescription photo saved · Token #{visit?.token_number}
          </p>
          {isPendingReports ? (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3.5 text-xs mb-6 font-bold">
              Sent to reception as <strong>Completed (Reports Pending)</strong>. Receptionist can attach lab/X-ray report photos anytime.
            </div>
          ) : (
            <p className="text-emerald-800 text-xs mb-6 font-bold bg-emerald-50 border border-emerald-200/80 p-2.5 rounded-xl">
              All prescription and clinical documentation saved.
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate("/doctor/queue")}
              className="bg-teal-700 text-white min-h-[44px] px-6 py-2.5 rounded-xl font-bold hover:bg-teal-800 transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined">queue</span>
              <span>Back to Queue</span>
            </button>
            <button
              onClick={() => navigate(`/patients/${patient?.id}`)}
              className="border border-slate-300 text-slate-700 min-h-[44px] px-6 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
            >
              <span>View Profile</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!visit || !patient) {
    return (
      <div className="p-6 text-center text-slate-400">
        <span className="material-symbols-outlined text-4xl block mb-2">error</span>
        Visit not found.
        <button onClick={() => navigate("/doctor/queue")} className="block mx-auto mt-4 text-teal-700 underline text-sm font-bold">
          Back to Queue
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 max-w-3xl mx-auto pb-48 md:pb-32 zero-horizontal-overflow">
      {/* ── Top Header Bar ── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate("/doctor/queue")}
          className="touch-target-44 p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
          title="Back to Queue"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">OPD Consultation Chamber</h1>
          <p className="text-xs text-slate-500 font-medium">Token #{visit.token_number} • Dr. Chamber Active</p>
        </div>
      </div>

      {/* ── Patient Info Banner Card ── */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-800 rounded-2xl p-4 sm:p-5 text-white mb-5 shadow-lg shadow-teal-700/20">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg shrink-0 shadow-inner">
            {patient.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg sm:text-xl leading-tight truncate">{patient.full_name}</div>
            <div className="text-teal-100 text-xs sm:text-sm mt-0.5 font-medium">
              {patient.relation_type === "father" ? "S/O" : patient.relation_type === "husband" ? "W/O" : "H/O"}{" "}
              {patient.relation_name}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-teal-100 flex-wrap">
              <span>Age: {formatPatientAge(patient)}</span>
              {patient.gender && <span className="capitalize">{patient.gender}</span>}
              {patient.phone && <span>Phone: {patient.phone}</span>}
              <button
                type="button"
                onClick={() => {
                  const newAge = prompt(`Update age for ${patient.full_name}: (leave blank if unknown)`, patient.age ?? "");
                  if (newAge !== null) {
                    const parsed = newAge.trim() === "" ? null : Number(newAge);
                    dbPatients.update(patient.id, { age: parsed });
                    setPatient(dbPatients.getById(patient.id));
                  }
                }}
                className="text-[11px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-md font-medium text-white transition-colors cursor-pointer"
              >
                Edit Age
              </button>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] sm:text-xs text-teal-200 font-bold uppercase tracking-wider">Past Visits</div>
            <div className="text-2xl sm:text-3xl font-black">{priorVisitCount}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3.5 pt-3 border-t border-white/20">
          <span className={`text-xs px-3 py-1 rounded-full font-bold ${visit.visit_type === "follow_up" ? "bg-blue-500/30 text-blue-100" : "bg-white/20 text-white"}`}>
            {visit.visit_type === "follow_up" ? "Follow-up" : "New Visit"}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-white/20 font-bold">
            Token #{visit.token_number}
          </span>
        </div>
      </div>

      {/* ── Vitals HUD Card (BP, Pulse, Temp, SpO2, Weight) ── */}
      <div className="glass-card p-4 sm:p-5 mb-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              vital_signs
            </span>
            <h3 className="font-black text-slate-900 text-sm tracking-tight">Patient Vitals HUD</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Auto-saved to patient timeline</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {/* BP */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              BP (mmHg)
            </label>
            <input
              type="text"
              value={vitalsBP}
              onChange={(e) => setVitalsBP(e.target.value)}
              placeholder="120/80"
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Pulse Rate */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Pulse (bpm)
            </label>
            <input
              type="text"
              value={vitalsPulse}
              onChange={(e) => setVitalsPulse(e.target.value)}
              placeholder="72"
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Body Temp */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Temp (°F)
            </label>
            <input
              type="text"
              value={vitalsTemp}
              onChange={(e) => setVitalsTemp(e.target.value)}
              placeholder="98.6"
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* SpO2 */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              SpO2 (%)
            </label>
            <input
              type="text"
              value={vitalsSpo2}
              onChange={(e) => setVitalsSpo2(e.target.value)}
              placeholder="98%"
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Weight */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 col-span-2 sm:col-span-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Weight (kg)
            </label>
            <input
              type="text"
              value={vitalsWeight}
              onChange={(e) => setVitalsWeight(e.target.value)}
              placeholder="65 kg"
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* ── Prescription Photo Capture ── */}
      <div className="glass-card p-4 sm:p-5 mb-5">
        <PhotoCapture
          label="Prescription Photo (HD Compressed)"
          multiple={false}
          photos={prescriptionPhoto ? [prescriptionPhoto] : []}
          onCapture={(src) => setPrescriptionPhoto(src)}
          onRemove={() => setPrescriptionPhoto(null)}
        />
      </div>

      {/* ── Patient Reports Photos Capture (Multi) ── */}
      <div className="glass-card p-4 sm:p-5 mb-5">
        <PhotoCapture
          label="Patient Reports (Lab, X-Ray, Ultrasound)"
          multiple={true}
          photos={reportPhotos}
          onCapture={addReportPhoto}
          onRemove={removeReportPhoto}
        />
      </div>

      {/* ── Clinical Procedures & Services Quick Add ── */}
      {services.length > 0 && (
        <div className="glass-pill p-4 rounded-2xl mb-5 space-y-2.5">
          <div className="text-xs font-black text-teal-950 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-teal-700">medical_services</span>
            <span>Quick Attach Performed Procedures / Clinic Services:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {services.map((srv) => (
              <button
                key={srv.id}
                type="button"
                onClick={() => {
                  const entry = `• ${srv.service_name} (Rs. ${srv.price})`;
                  setNotes((prev) => (prev ? `${prev}\n${entry}` : entry));
                }}
                className="text-xs bg-white text-teal-950 border border-teal-200 hover:bg-teal-50 px-3 py-1.5 rounded-xl font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>+ {srv.service_name}</span>
                <span className="text-teal-700 font-mono font-bold">(Rs. {srv.price})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Optional Clinical Notes ── */}
      <div className="glass-card p-4 sm:p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs sm:text-sm font-black text-slate-800">
            Clinical Notes, Diagnosis &amp; Observations <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200 rounded">
            F1
          </kbd>
        </div>
        <textarea
          id="doctor-clinical-notes-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Enter diagnosis, clinical advice, or procedure notes..."
          className="w-full border border-slate-200 rounded-xl p-3 text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/60 font-medium text-slate-800"
        />
      </div>

      {/* ── Fixed Mobile-Safe Action Bar (Clears Mobile Nav at bottom-16 on mobile, bottom-0 on desktop) ── */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-3 sm:p-4 bg-white/90 backdrop-blur-md border-t border-slate-200/80 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-2.5">
          {/* Primary: Complete Visit */}
          <button
            id="complete-visit-btn"
            type="button"
            onClick={() => completeVisit("completed")}
            disabled={saving}
            className="flex-1 min-h-[44px] py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white active:scale-98 shadow-teal-700/20 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            )}
            <span>Complete Consultation</span>
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.2 bg-teal-800/80 text-teal-100 text-[10px] font-mono rounded">
              F2 / Ctrl+Enter
            </kbd>
          </button>

          {/* Secondary: Complete & Forward Reports to Reception */}
          <button
            id="forward-reception-btn"
            type="button"
            onClick={() => completeVisit("completed_reports_pending")}
            disabled={saving}
            className="flex-1 min-h-[44px] py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border bg-amber-50/90 border-amber-300 text-amber-900 hover:bg-amber-100 active:scale-98 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">forward_to_inbox</span>
            <span>Reports Pending at Reception</span>
          </button>
        </div>
      </div>
    </div>
  );
}

