import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { dbVisits, dbPatients, dbUsers } from "../api/db.js";
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
  const [docProfile, setDocProfile] = useState(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [customNote, setCustomNote] = useState("");

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

    if (doctorId) {
      const p = dbUsers.getById(doctorId);
      setDocProfile(p);
      if (p?.status_note) setCustomNote(p.status_note);
    }
  }, [doctorId]);

  useEffect(() => {
    loadQueue();
    // Auto-refresh every 10 seconds (simulates live queue)
    const interval = setInterval(loadQueue, 10000);
    const clock = setInterval(() => setNow(new Date()), 1000);

    const handleCustomUpdate = () => loadQueue();
    window.addEventListener("clinicflow_status_update", handleCustomUpdate);

    return () => {
      clearInterval(interval);
      clearInterval(clock);
      window.removeEventListener("clinicflow_status_update", handleCustomUpdate);
    };
  }, [loadQueue]);

  function handleSetAvailability(status, defaultNote = "") {
    const note = status === "available" ? "" : (defaultNote || docProfile?.status_note || "");
    dbUsers.updateDoctorStatus(doctorId, status, note);
    setDocProfile(dbUsers.getById(doctorId));
  }

  function handleSaveCustomNote(e) {
    e.preventDefault();
    dbUsers.updateDoctorStatus(doctorId, docProfile?.availability_status || "break", customNote.trim());
    setDocProfile(dbUsers.getById(doctorId));
    setShowNoteInput(false);
  }

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
  const currentStatus = docProfile?.availability_status || "available";

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>queue</span>
            {user?.name ? `${user.name}'s OPD Chamber` : "Doctor's Live Queue"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {now.toLocaleString("en-PK", { weekday: "long", hour: "2-digit", minute: "2-digit" })} • {docProfile?.room_number || "OPD Chamber"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => window.open("/live", "_blank")}
            title="Open Waiting Room Public TV Screen in new window"
            className="flex items-center gap-1.5 text-xs text-teal-800 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl hover:bg-teal-100 transition-colors font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-base">tv</span>
            Waiting Area TV Screen
          </button>
          <button
            onClick={loadQueue}
            className="flex items-center gap-1.5 text-xs text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* ─── DOCTOR LIVE AVAILABILITY CONTROL BAR ──────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">My Live Chamber Status:</span>
            <span className="text-xs text-gray-400">(Broadcasts to Waiting Room TV & Patient Mobile)</span>
          </div>
          {docProfile?.status_note && (
            <span className="text-xs bg-amber-50 text-amber-800 font-semibold px-2.5 py-0.5 rounded-md border border-amber-200">
              Notice: {docProfile.status_note}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Option 1: Available */}
          <button
            onClick={() => handleSetAvailability("available")}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
              currentStatus === "available"
                ? "bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-600/20"
                : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping"></span>
            🟢 Available (In Room)
          </button>

          {/* Option 2: 15-Min Short Break */}
          <button
            onClick={() => handleSetAvailability("break", "15-Min Break — Back soon")}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
              currentStatus === "break"
                ? "bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20"
                : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
            }`}
          >
            <span className="material-symbols-outlined text-base">coffee</span>
            🟡 Short Break (15m)
          </button>

          {/* Option 3: Unavailable / Done for Today */}
          <button
            onClick={() => handleSetAvailability("unavailable", "Shift Ended for Today")}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
              currentStatus === "unavailable"
                ? "bg-slate-700 text-white border-slate-800 shadow-md shadow-slate-700/20"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span className="material-symbols-outlined text-base">do_not_disturb_on</span>
            🔴 Shift Ended / Away
          </button>
        </div>

        {/* Custom Status Note Toggle */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setShowNoteInput(!showNoteInput)}
            className="text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">edit_note</span>
            {showNoteInput ? "Hide Custom Note" : "Add / Edit Custom Status Note (e.g. Back at 6:30 PM)"}
          </button>
        </div>

        {showNoteInput && (
          <form onSubmit={handleSaveCustomNote} className="flex gap-2 pt-1">
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. Tea Break • Available from 5:30 PM"
              className="flex-1 text-xs border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              Save Note
            </button>
          </form>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
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
          className="w-full bg-teal-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-teal-700 transition-colors shadow-xl shadow-teal-600/25 flex items-center justify-center gap-3"
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
                      <div className="flex sm:flex-col flex-row gap-1">
                        <button
                          onClick={() => {
                            dbVisits.reissueLateToken(visit.id);
                            loadQueue();
                          }}
                          title="Re-issue new token at END of queue with Rs. 0 Fee"
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-white border border-amber-300 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-amber-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">confirmation_number</span>
                          Re-issue (End Queue)
                        </button>
                        <button
                          onClick={() => { dbVisits.updateStatus(visit.id, "waiting"); loadQueue(); }}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-white border border-teal-300 text-teal-700 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-teal-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">undo</span>
                          Recall Next
                        </button>
                      </div>
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
