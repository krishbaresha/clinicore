import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { dbVisits, dbPatients } from "../api/db.js";
import { compressImageFile } from "../utils/imageCompressor.js";

function PhotoCaptureModal({ visit, patient, onClose, onSave }) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [reportPhotos, setReportPhotos] = useState([]);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

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
    setReportPhotos((prev) => [...prev, capturedPreview]);
    setCapturedPreview(null);
    setShowCamera(false);
  }

  async function handleFile(e) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const compressed = await compressImageFile(file);
        setReportPhotos((prev) => [...prev, compressed]);
      } catch (err) {
        console.error("Compression error:", err);
      }
    }
    e.target.value = "";
  }

  function removeReportPhoto(index) {
    setReportPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (reportPhotos.length === 0) {
      alert("Please take or upload at least one report photo.");
      return;
    }
    setSaving(true);
    dbVisits.addReports(visit.id, reportPhotos);
    setSaving(false);
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-800 text-white p-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-teal-200 font-semibold">Upload Pending Reports</div>
            <h3 className="text-lg font-bold">{patient?.full_name}</h3>
            <p className="text-xs text-teal-100">Token #{visit.token_number} · Visit Date: {new Date(visit.visit_date).toLocaleDateString("en-US")}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {visit.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
              <span className="material-symbols-outlined text-base shrink-0 mt-0.5">info</span>
              <div>
                <span className="font-bold">Doctor Notes: </span>
                {visit.notes}
              </div>
            </div>
          )}

          {/* Camera overlay */}
          {showCamera && (
            <div className="bg-black rounded-2xl p-4 flex flex-col items-center">
              {!capturedPreview ? (
                <>
                  <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl max-h-60 object-cover" />
                  <div className="flex gap-3 mt-3">
                    <button onClick={stopCamera} className="bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-semibold">
                      Cancel
                    </button>
                    <button onClick={snap} className="bg-white text-gray-900 px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-teal-600 text-sm">camera</span>
                      Snap
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img src={capturedPreview} alt="Captured report" className="w-full rounded-xl max-h-60 object-contain" />
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => { setCapturedPreview(null); openCamera(); }} className="bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-semibold">
                      Retake
                    </button>
                    <button onClick={confirmCapture} className="bg-teal-500 text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check</span>
                      Add Photo
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Photo Gallery */}
          {reportPhotos.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Report Photos ({reportPhotos.length})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {reportPhotos.map((src, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200">
                    <img src={src} alt={`Report ${i + 1}`} className="w-full h-24 object-cover" />
                    <button
                      onClick={() => removeReportPhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-80 hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capture Actions */}
          <div className="flex gap-3">
            <button
              onClick={openCamera}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-teal-300 rounded-2xl p-4 text-teal-700 hover:bg-teal-50 transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">photo_camera</span>
              <span className="text-xs font-bold">Take Photo</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-2xl p-4 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">upload</span>
              <span className="text-xs font-medium">Upload File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || reportPhotos.length === 0}
            className={`flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5 ${
              reportPhotos.length > 0 ? "bg-teal-600 hover:bg-teal-700 shadow-md" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            <span className="material-symbols-outlined text-base">check_circle</span>
            {saving ? "Saving..." : "Save Reports & Complete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PendingReports() {
  const navigate = useNavigate();
  const [pendingVisits, setPendingVisits] = useState([]);
  const [patients, setPatients] = useState({});
  const [selectedVisit, setSelectedVisit] = useState(null);

  const loadPending = () => {
    const list = dbVisits.getPendingReports();
    setPendingVisits(list);
    const pMap = {};
    list.forEach((v) => {
      if (!pMap[v.patient_id]) pMap[v.patient_id] = dbPatients.getById(v.patient_id);
    });
    setPatients(pMap);
  };

  useEffect(() => {
    loadPending();
    const interval = setInterval(loadPending, 3000);
    const handleUpdate = () => loadPending();
    window.addEventListener("clinicflow_status_update", handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("clinicflow_status_update", handleUpdate);
    };
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {selectedVisit && (
        <PhotoCaptureModal
          visit={selectedVisit}
          patient={patients[selectedVisit.patient_id]}
          onClose={() => setSelectedVisit(null)}
          onSave={() => {
            setSelectedVisit(null);
            loadPending();
          }}
        />
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>
              pending_actions
            </span>
            Pending Report Uploads
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Visits completed by Doctor where lab/X-ray report photos are waiting to be attached at Reception.
          </p>
        </div>
        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full">
          {pendingVisits.length} Pending
        </span>
      </div>

      {/* List */}
      {pendingVisits.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <span className="material-symbols-outlined text-5xl text-gray-300 block mb-3">task_alt</span>
          <div className="text-gray-700 font-bold text-lg">No pending report uploads</div>
          <div className="text-sm text-gray-400 mt-1">All completed visits have their reports attached!</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingVisits.map((visit) => {
            const patient = patients[visit.patient_id];
            return (
              <div key={visit.id} className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        Reports Pending
                      </span>
                      <h3 className="font-bold text-gray-900 text-base mt-1.5">{patient?.full_name || "Unknown"}</h3>
                      <div className="text-xs text-gray-500">
                        {patient?.relation_type === "father" ? "S/O" : "W/O"} {patient?.relation_name} · {patient?.phone}
                      </div>
                    </div>
                    <div className="bg-teal-50 text-teal-700 px-3 py-1 rounded-xl text-center">
                      <div className="text-xs text-teal-500 font-medium">Token</div>
                      <div className="text-lg font-black leading-none">#{visit.token_number}</div>
                    </div>
                  </div>

                  {visit.notes && (
                    <div className="text-xs bg-gray-50 rounded-xl p-3 text-gray-600 mb-4 border border-gray-100">
                      <span className="font-semibold text-gray-700">Doctor Note: </span>
                      {visit.notes}
                    </div>
                  )}

                  <div className="text-xs text-gray-400 mb-4">
                    Visited: {new Date(visit.visit_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedVisit(visit)}
                    className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">add_a_photo</span>
                    Upload Reports
                  </button>
                  <button
                    onClick={() => navigate(`/patients/${patient?.id}`)}
                    className="border border-gray-200 text-gray-600 px-3 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Profile
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
