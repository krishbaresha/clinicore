import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPatient, getPatientVisits, getPatientDocuments, uploadPatientDocument, deletePatientDocument } from "../api/patients.js";
import { dbPrescriptions } from "../api/db.js";
import { formatDate, formatCurrency } from "../utils/formatters.js";

export default function PatientProfile() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [patient, setPatient] = useState(null);
  const [visits,  setVisits]  = useState([]);
  const [documents, setDocuments] = useState([]);
  const [error,   setError]   = useState("");

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  useEffect(() => {
    const pr = getPatient(id);
    if (!pr.success) { setError(pr.error.message); return; }
    setPatient(pr.data);
    const vr = getPatientVisits(id);
    if (vr.success) setVisits(vr.data);
    const dr = getPatientDocuments(id);
    if (dr.success) setDocuments(dr.data);
  }, [id]);

  async function startCamera() {
    try {
      setCapturedPhoto(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      alert("Could not access camera. Please upload a file instead or ensure permissions are allowed.");
      setShowCameraModal(false);
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  }

  function capturePhoto() {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  }

  function saveCapturedPhoto() {
    if (capturedPhoto) {
      const docObj = {
        name: `Camera_Capture_${Date.now()}.jpg`,
        file_type: "image/jpeg",
        data_url: capturedPhoto
      };
      const res = uploadPatientDocument(id, docObj);
      if (res.success) {
        const dr = getPatientDocuments(id);
        if (dr.success) setDocuments(dr.data);
      }
      setCapturedPhoto(null);
      setShowCameraModal(false);
    }
  }

  function handleFileUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const docObj = {
          name: file.name,
          file_type: file.type,
          data_url: reader.result
        };
        const res = uploadPatientDocument(id, docObj);
        if (res.success) {
          const dr = getPatientDocuments(id);
          if (dr.success) setDocuments(dr.data);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (error) {
    return (
      <div className="p-lg text-center text-error font-body-md">
        {error} —{" "}
        <button className="underline text-primary" onClick={() => navigate("/patients")}>
          Back to Patients
        </button>
      </div>
    );
  }

  if (!patient) {
    return <div className="p-lg text-center text-outline font-body-md">Loading…</div>;
  }

  return (
    <div className="p-md md:p-lg flex flex-col gap-lg max-w-3xl">

      {/* Back button */}
      <button
        id="back-to-patients"
        onClick={() => navigate("/patients")}
        className="flex items-center gap-1 text-primary font-body-sm text-body-sm hover:underline self-start"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Patients
      </button>

      {/* Patient Header Card */}
      <div className="glass-card p-md flex flex-col md:flex-row md:items-center gap-md">
        <div className="w-16 h-16 rounded-full bg-secondary-container text-primary flex items-center justify-center font-bold text-2xl shrink-0">
          {patient.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1">
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">{patient.full_name}</h2>
          <div className="flex flex-wrap gap-x-md gap-y-1 mt-xs text-on-surface-variant font-body-sm text-body-sm">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">cake</span>
              Age {patient.age ?? "—"}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">wc</span>
              {patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "—"}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">call</span>
              {patient.phone}
            </span>
            {patient.cnic && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">badge</span>
                {patient.cnic}
              </span>
            )}
          </div>
        </div>
        <button
          id="add-visit-btn"
          onClick={() => navigate(`/visits/new?patient_id=${patient.id}`)}
          className="btn-pill shrink-0"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add New Visit
        </button>
      </div>

      {/* Documents & Medical Reports Section */}
      <section className="glass-card p-lg flex flex-col gap-md">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Documents &amp; Reports</h3>
            <p className="font-body-sm text-body-sm text-outline">Patient medical files, lab tests, and report images</p>
          </div>
          
          <div className="flex items-center gap-sm">
            {/* Native file upload input hidden */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="image/*,application/pdf"
              className="hidden"
            />
            
            {/* Upload buttons */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">upload_file</span>
              Upload File
            </button>
            
            <button
              onClick={() => {
                setShowCameraModal(true);
                startCamera();
              }}
              className="btn-pill flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">photo_camera</span>
              Take Photo
            </button>
          </div>
        </div>

        {/* Documents Grid */}
        {documents.length === 0 ? (
          <p className="font-body-md text-body-md text-outline text-center py-4">No documents uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
            {documents.map((doc) => {
              const isImage = doc.file_type?.startsWith("image/");
              return (
                <div key={doc.id} className="flex items-center justify-between p-sm bg-surface-container-low rounded-xl border border-outline-variant/30 gap-sm">
                  <div className="flex items-center gap-sm min-w-0">
                    {isImage ? (
                      <img
                        src={doc.data_url}
                        alt={doc.name}
                        className="w-12 h-12 object-cover rounded-lg border border-outline-variant shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary-container/10 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-2xl">description</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-body-md text-body-md font-semibold text-on-surface truncate" title={doc.name}>
                        {doc.name}
                      </p>
                      <p className="font-body-sm text-body-sm text-outline">
                        {formatDate(doc.uploaded_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-xs">
                    {/* View/Download link */}
                    <a
                      href={doc.data_url}
                      download={doc.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-surface-container-high rounded-full text-primary flex items-center justify-center"
                      title="Download/View"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                    </a>
                    
                    {/* Delete button */}
                    <button
                      onClick={() => {
                        if (confirm(`Delete document "${doc.name}"?`)) {
                          deletePatientDocument(doc.id);
                          const dr = getPatientDocuments(id);
                          if (dr.success) setDocuments(dr.data);
                        }
                      }}
                      className="p-2 hover:bg-error-container/20 rounded-full text-error flex items-center justify-center"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Camera Capture Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-md">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { stopCamera(); setShowCameraModal(false); }} />
          
          {/* Modal Container */}
          <div className="relative bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl z-10 flex flex-col">
            <header className="px-lg py-md border-b border-outline-variant/30 flex justify-between items-center bg-surface">
              <h4 className="font-headline-sm text-headline-sm font-bold text-on-surface">Capture Document Photo</h4>
              <button
                onClick={() => { stopCamera(); setShowCameraModal(false); }}
                className="text-outline hover:text-on-surface flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            
            <div className="relative bg-black aspect-video flex items-center justify-center">
              {!capturedPhoto ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-2 border-dashed border-white/40 pointer-events-none m-md rounded-lg" />
                </>
              ) : (
                <img
                  src={capturedPhoto}
                  alt="Captured preview"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            
            <footer className="p-md flex justify-between bg-surface border-t border-outline-variant/30">
              {!capturedPhoto ? (
                <>
                  <button
                    type="button"
                    onClick={() => { stopCamera(); setShowCameraModal(false); }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="btn-primary flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                    Capture
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setCapturedPhoto(null); startCamera(); }}
                    className="btn-secondary"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={saveCapturedPhoto}
                    className="btn-primary"
                  >
                    Use Photo
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}

      {/* Visit Timeline */}
      <section>
        <h3 className="font-headline-md text-headline-md font-bold text-on-surface mb-md">
          Visit History ({visits.length})
        </h3>

        {visits.length === 0 ? (
          <div className="glass-card p-xl text-center text-outline font-body-md">
            No visits recorded yet.
          </div>
        ) : (
          <ol className="relative border-l-2 border-secondary-container/50 ml-4 flex flex-col gap-lg">
            {visits.map((visit) => {
              const rxItems = dbPrescriptions.getByVisit(visit.id);
              return (
                <li key={visit.id} id={`visit-${visit.id}`} className="ml-6 relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-[33px] top-3 w-4 h-4 rounded-full bg-primary border-2 border-white" />

                  <div className="glass-card p-md flex flex-col gap-sm">
                    {/* Visit date + fee */}
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <span className="font-label-md text-label-md text-outline uppercase tracking-wider">
                        {formatDate(visit.visit_date)}
                      </span>
                      <span className="font-headline-md text-headline-md font-bold text-primary">
                        {formatCurrency(visit.fee_amount)}
                      </span>
                    </div>

                    {/* Diagnosis */}
                    <div>
                      <p className="font-label-md text-label-md text-outline uppercase mb-1">Diagnosis</p>
                      <p className="font-body-md text-body-md text-on-surface font-semibold">{visit.diagnosis || "—"}</p>
                    </div>

                    {/* Symptoms */}
                    {visit.symptoms && (
                      <div>
                        <p className="font-label-md text-label-md text-outline uppercase mb-1">Symptoms</p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">{visit.symptoms}</p>
                      </div>
                    )}

                    {/* Medicines */}
                    {rxItems.length > 0 && (
                      <div>
                        <p className="font-label-md text-label-md text-outline uppercase mb-2">Medicines Prescribed</p>
                        <ul className="flex flex-col gap-1">
                          {rxItems.map((rx) => (
                            <li key={rx.id} className="flex items-start gap-2 font-body-sm text-body-sm text-on-surface">
                              <span className="material-symbols-outlined text-[14px] text-primary mt-0.5">medication</span>
                              <span>
                                <strong>{rx.medicine_name}</strong> — {rx.dosage} for {rx.duration}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Notes */}
                    {visit.notes && (
                      <p className="font-body-sm text-body-sm text-outline italic border-t border-outline-variant/30 pt-xs">
                        {visit.notes}
                      </p>
                    )}

                    {/* Follow-up */}
                    {visit.follow_up_date && (
                      <div className="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
                        <span className="material-symbols-outlined text-[16px] text-primary">event_available</span>
                        Follow-up: {formatDate(visit.follow_up_date)}
                      </div>
                    )}

                    {/* Print prescription link */}
                    <button
                      id={`print-rx-${visit.id}`}
                      onClick={() => navigate(`/visits/${visit.id}/print`)}
                      className="self-start flex items-center gap-1 text-primary font-body-sm text-body-sm hover:underline mt-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">print</span>
                      Print Prescription
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
