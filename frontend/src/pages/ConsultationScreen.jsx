import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dbVisits, dbPatients, dbUsers, dbClinicServices } from "../api/db.js";
import { useAuth } from "../hooks/useAuth.js";

function PhotoCapture({ label, multiple = false, onCapture, onRemove, photos = [] }) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);

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

  function snap() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width  = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedPreview(dataUrl);
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
  }

  function confirmCapture() {
    if (!capturedPreview) return;
    onCapture(capturedPreview);
    setCapturedPreview(null);
    setShowCamera(false);
  }

  function handleFile(e) {
    Array.from(e.target.files || []).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => onCapture(reader.result);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800">{label}</h3>
        {photos.length > 0 && (
          <span className="text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full font-medium">
            {photos.length} photo{photos.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Camera / Preview Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          {!capturedPreview ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-w-lg rounded-xl"
              />
              <div className="flex gap-4 mt-6">
                <button
                  onClick={stopCamera}
                  className="bg-white/20 text-white px-5 py-3 rounded-2xl font-semibold flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">close</span>
                  Cancel
                </button>
                <button
                  onClick={snap}
                  className="bg-white text-gray-900 px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl"
                >
                  <span className="material-symbols-outlined text-teal-600">camera</span>
                  Take Photo
                </button>
              </div>
            </>
          ) : (
            <>
              <img src={capturedPreview} alt="Preview" className="w-full max-w-lg rounded-xl object-contain max-h-[70vh]" />
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => { setCapturedPreview(null); openCamera(); }}
                  className="bg-white/20 text-white px-5 py-3 rounded-2xl font-semibold flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">replay</span>
                  Retake
                </button>
                <button
                  onClick={confirmCapture}
                  className="bg-teal-500 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl"
                >
                  <span className="material-symbols-outlined">check_circle</span>
                  Use Photo
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Photos grid */}
      {photos.length > 0 && (
        <div className={`grid gap-3 mb-3 ${multiple ? "grid-cols-3" : "grid-cols-1"}`}>
          {photos.map((src, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img
                src={src}
                alt={`${label} ${i + 1}`}
                className="w-full object-cover aspect-square bg-gray-100"
              />
              <button
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs shadow"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Capture buttons */}
      {(multiple || photos.length === 0) && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={openCamera}
            className="flex-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-teal-300 rounded-2xl p-5 text-teal-700 hover:bg-teal-50 hover:border-teal-400 transition-all"
          >
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
            <span className="text-sm font-semibold">Take Photo</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl p-5 text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            <span className="material-symbols-outlined text-3xl">upload</span>
            <span className="text-sm font-medium">Upload Photo</span>
          </button>
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

  const [services, setServices] = useState([]);

  useEffect(() => {
    const v = dbVisits.getById(visitId);
    if (!v) return;
    setVisit(v);
    const p = dbPatients.getById(v.patient_id);
    setPatient(p);
    if (p) {
      const pv = dbVisits.getByPatient(p.id);
      setPriorVisitCount(pv.filter((pv2) => pv2.id !== visitId).length);
    }
    // Restore any existing photos
    if (v.prescription_image_url) setPrescriptionPhoto(v.prescription_image_url);
    if (v.report_image_urls?.length) setReportPhotos(v.report_image_urls);
    setServices(dbClinicServices.getAll());
  }, [visitId]);

  function addReportPhoto(src) {
    setReportPhotos((prev) => [...prev, src]);
  }
  function removeReportPhoto(i) {
    setReportPhotos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function completeVisit(targetStatus = "completed") {
    if (!prescriptionPhoto) {
      alert("Please take or upload a prescription photo before completing the visit.");
      return;
    }
    setSaving(true);
    const completedVisit = dbVisits.complete(visitId, {
      prescription_image_url: prescriptionPhoto,
      report_image_urls: reportPhotos,
      notes,
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
            className="w-full bg-rose-600 text-white py-3 rounded-2xl font-bold hover:bg-rose-700 transition-colors shadow-md shadow-rose-600/20"
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
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-4xl text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Visit Completed</h2>
          <p className="text-gray-600 text-sm mb-2">
            Prescription photo saved · Token #{visit?.token_number}
          </p>
          {isPendingReports ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs mb-6 font-medium">
              📋 Sent to reception as <strong>Completed (Reports Pending)</strong>. Receptionist can attach lab/X-ray report photos anytime.
            </div>
          ) : (
            <p className="text-teal-700 text-xs mb-6 font-medium">
              ✅ All prescription and report photos attached.
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate("/doctor/queue")}
              className="bg-teal-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-teal-700 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined">queue</span>
              Back to Queue
            </button>
            <button
              onClick={() => navigate(`/patients/${patient?.id}`)}
              className="border border-gray-200 text-gray-600 px-6 py-3 rounded-2xl font-medium hover:bg-gray-50 transition-colors"
            >
              View Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!visit || !patient) {
    return (
      <div className="p-6 text-center text-gray-400">
        <span className="material-symbols-outlined text-4xl block mb-2">error</span>
        Visit not found.
        <button onClick={() => navigate("/doctor/queue")} className="block mx-auto mt-4 text-teal-600 underline text-sm">
          Back to Queue
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate("/doctor/queue")}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Consultation</h1>
          <p className="text-xs text-gray-500">Token #{visit.token_number}</p>
        </div>
      </div>

      {/* Patient Info Card */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-5 text-white mb-5 shadow-xl shadow-teal-600/20">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg">
            {patient.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg leading-tight">{patient.full_name}</div>
            <div className="text-teal-100 text-sm mt-0.5">
              {patient.relation_type === "father" ? "S/O" : patient.relation_type === "husband" ? "W/O" : "H/O"}{" "}
              {patient.relation_name}
            </div>
            <div className="flex gap-3 mt-2 text-xs text-teal-100">
              {patient.age && <span>{patient.age} yrs</span>}
              {patient.gender && <span className="capitalize">{patient.gender}</span>}
              {patient.phone && <span>{patient.phone}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-teal-200 font-medium uppercase tracking-wider">Past Visits</div>
            <div className="text-2xl font-black">{priorVisitCount}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${visit.visit_type === "follow_up" ? "bg-blue-500/30 text-blue-100" : "bg-white/20 text-white"}`}>
            {visit.visit_type === "follow_up" ? "Follow-up" : "New Visit"}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/20 font-semibold">
            Token #{visit.token_number}
          </span>
        </div>
      </div>

      {/* Prescription Photo Capture */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <PhotoCapture
          label="📋 Prescription Photo"
          multiple={false}
          photos={prescriptionPhoto ? [prescriptionPhoto] : []}
          onCapture={(src) => setPrescriptionPhoto(src)}
          onRemove={() => setPrescriptionPhoto(null)}
        />
      </div>

      {/* Report Photos Capture */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <PhotoCapture
          label="🩻 Patient Reports (X-ray, Lab, etc.)"
          multiple={true}
          photos={reportPhotos}
          onCapture={addReportPhoto}
          onRemove={removeReportPhoto}
        />
      </div>

      {/* Clinical Procedures & Services Quick Add */}
      {services.length > 0 && (
        <div className="bg-teal-50/70 rounded-2xl border border-teal-100 p-4 mb-4 space-y-2">
          <div className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-teal-700">medical_services</span>
            Quick Attach Performed Procedures / Clinic Services:
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
                className="text-xs bg-white text-teal-900 border border-teal-200 hover:bg-teal-100 px-3 py-1.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1"
              >
                <span>+ {srv.service_name}</span>
                <span className="text-teal-700 font-mono">(Rs. {srv.price})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Optional Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <label className="block text-sm font-bold text-gray-700 mb-2">Clinical Notes &amp; Observations <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any additional observations or procedure notes..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 font-medium text-gray-800"
        />
      </div>

      {/* Sticky Mobile-Safe Button Bar */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-[260px] p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-2.5">
          {/* Primary: Complete Visit */}
          <button
            id="complete-visit-btn"
            type="button"
            onClick={() => completeVisit("completed")}
            disabled={saving || !prescriptionPhoto}
            className={`flex-1 py-3.5 px-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-md ${
              prescriptionPhoto
                ? "bg-teal-600 text-white hover:bg-teal-700 active:scale-98 shadow-teal-600/20"
                : "bg-gray-100 text-gray-400 cursor-not-allowed opacity-75"
            }`}
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            )}
            <span>Complete Visit</span>
          </button>

          {/* Secondary: Complete & Forward Reports to Reception */}
          <button
            id="forward-reception-btn"
            type="button"
            onClick={() => completeVisit("completed_reports_pending")}
            disabled={saving || !prescriptionPhoto}
            className={`flex-1 py-3.5 px-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all border ${
              prescriptionPhoto
                ? "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 active:scale-98 shadow-sm"
                : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed opacity-75"
            }`}
          >
            <span className="material-symbols-outlined text-lg">forward_to_inbox</span>
            <span>Complete &amp; Forward Reports to Reception</span>
          </button>
        </div>
        {!prescriptionPhoto && (
          <p className="text-center text-xs text-gray-500 mt-1 font-medium">
            ⚠️ Please capture or upload a prescription photo first to enable completion buttons.
          </p>
        )}
      </div>
    </div>
  );
}
