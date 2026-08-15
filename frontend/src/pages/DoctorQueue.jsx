import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { dbVisits, dbPatients } from "../api/db.js";
import { useAuth } from "../context/AuthContext.jsx";

const STATUS_STYLES = {
  waiting:                  { bg: "bg-amber-50",  border: "border-amber-200",  badge: "bg-amber-100 text-amber-800",  dot: "bg-amber-500",  label: "Waiting"         },
  in_consultation:          { bg: "bg-teal-50",   border: "border-teal-200",   badge: "bg-teal-100 text-teal-800",    dot: "bg-teal-500 animate-pulse", label: "In Consultation" },
  completed:                { bg: "bg-gray-50",   border: "border-gray-200",   badge: "bg-gray-100 text-gray-500",    dot: "bg-gray-400",   label: "Completed"       },
  completed_reports_pending:{ bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-800",dot: "bg-orange-500", label: "Reports Pending" },
  skipped:                  { bg: "bg-rose-50",   border: "border-rose-200",   badge: "bg-rose-100 text-rose-700",    dot: "bg-rose-400",   label: "Skipped"         },
};

function getRelLabel(type) {
  return { father: "S/O", husband: "W/O", wife: "H/O", mother: "D/O" }[type] || "";
}

export default function DoctorQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [patients, setPatients] = useState({});
  const [now, setNow] = useState(new Date());

  const doctorId = user?.userId || user?.id;

  const loadQueue = useCallback(() => {
    // Pass doctorId to get ONLY visits assigned to this doctor
    const q = dbVisits.getTodayQueue(doctorId);
    setQueue(q);
    // Build patient map for quick lookup
    const pMap = {};
    q.forEach((v) => {
      if (!pMap[v.patient_id]) pMap[v.patient_id] = dbPatients.getById(v.patient_id);
    });
    setPatients(pMap);
  }, [doctorId]);

  useEffect(() => {
    loadQueue();
    // Auto-refresh every 15 seconds (simulates live queue)
    const interval = setInterval(loadQueue, 15000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [loadQueue]);

  function callNext() {
    const nextWaiting = queue.find((v) => v.status === "waiting");
    if (!nextWaiting) return;
    dbVisits.updateStatus(nextWaiting.id, "in_consultation");
    loadQueue();
  }

  function skipVisit(visitId) {
    dbVisits.skip(visitId);
    loadQueue();
  }

  function startConsultation(visitId) {
    navigate(`/doctor/consultation/${visitId}`);
  }

  const inConsultation = queue.filter((v) => v.status === "in_consultation");
  const waiting = queue.filter((v) => v.status === "waiting");

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>queue</span>
            {user?.name ? `${user.name}'s Live Queue` : "Doctor's Live Queue"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {now.toLocaleString("en-PK", { weekday: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={loadQueue}
          className="flex items-center gap-1.5 text-sm text-teal-600 border border-teal-200 px-3 py-2 rounded-xl hover:bg-teal-50 transition-colors font-medium"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
          <div className="text-3xl font-black text-teal-600">{inConsultation.length}</div>
          <div className="text-xs font-medium text-gray-500 mt-1">In Consultation</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
          <div className="text-3xl font-black text-amber-500">{waiting.length}</div>
          <div className="text-xs font-medium text-gray-500 mt-1">Waiting</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
          <div className="text-3xl font-black text-gray-400">{queue.length}</div>
          <div className="text-xs font-medium text-gray-500 mt-1">Total Today</div>
        </div>
      </div>

      {/* Call Next Button */}
      {waiting.length > 0 && inConsultation.length === 0 && (
        <button
          onClick={callNext}
          className="w-full mb-6 bg-teal-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-teal-700 transition-colors shadow-xl shadow-teal-600/25 flex items-center justify-center gap-3"
        >
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
          Call Next Patient (Token #{waiting[0]?.token_number})
        </button>
      )}

      {/* Queue List */}
      {queue.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-6xl text-gray-200 block mb-3">event_available</span>
          <div className="text-gray-500 font-medium">No patients in today's queue yet</div>
          <div className="text-sm text-gray-400 mt-1">Patients will appear here after registration</div>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((visit) => {
            const patient = patients[visit.patient_id];
            const s = STATUS_STYLES[visit.status] || STATUS_STYLES.waiting;
            const isActive = visit.status === "in_consultation";

            return (
              <div
                key={visit.id}
                className={`rounded-2xl border-2 p-4 transition-all ${s.bg} ${s.border} ${isActive ? "shadow-lg" : "shadow-sm"}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Token Number */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shrink-0 ${
                      isActive ? "bg-teal-600 text-white shadow-md shadow-teal-200" : "bg-white text-gray-700 border border-gray-200"
                    }`}>
                      {visit.token_number}
                    </div>

                    {/* Patient Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-base">
                          {patient ? patient.full_name : "Unknown Patient"}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                        {visit.visit_type === "follow_up" && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">Follow-up</span>
                        )}
                      </div>
                      {patient && (
                        <div className="text-sm text-gray-500 mt-0.5">
                          {getRelLabel(patient.relation_type)} {patient.relation_name}
                          {patient.age ? ` · ${patient.age}y` : ""}
                          {patient.phone ? ` · ${patient.phone}` : ""}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        Registered at {new Date(visit.visit_date).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col flex-row gap-2 shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200/60">
                    {isActive && (
                      <button
                        onClick={() => startConsultation(visit.id)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-teal-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-teal-700 transition-colors shadow-md shadow-teal-200"
                      >
                        <span className="material-symbols-outlined text-sm">stethoscope</span>
                        Consult
                      </button>
                    )}
                    {visit.status === "waiting" && (
                      <>
                        <button
                          onClick={() => { dbVisits.updateStatus(visit.id, "in_consultation"); loadQueue(); }}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-white border border-teal-300 text-teal-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-teal-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">call</span>
                          Call
                        </button>
                        <button
                          onClick={() => skipVisit(visit.id)}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-500 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-gray-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">skip_next</span>
                          Skip
                        </button>
                      </>
                    )}
                    {visit.status === "skipped" && (
                      <button
                        onClick={() => { dbVisits.updateStatus(visit.id, "waiting"); loadQueue(); }}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-white border border-amber-300 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-amber-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">undo</span>
                        Recall
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
