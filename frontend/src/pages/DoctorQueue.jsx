import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  RefreshCw,
  DoorOpen,
  Coffee,
  Moon,
  Edit3,
  PhoneCall,
  Clock,
  UserPlus,
  SkipForward,
  RotateCcw,
  Trash2,
  Ticket,
  Users
} from "lucide-react";
import { dbVisits, dbPatients, dbUsers } from "../api/db.js";
import { useAuth } from "../hooks/useAuth.js";
import { formatPatientAge } from "../utils/formatters.js";

const STATUS_STYLES = {
  waiting: {
    bg: "bg-amber-50/70",
    border: "border-amber-200/80",
    badge: "bg-amber-100 text-amber-900 border border-amber-200",
    dot: "bg-amber-500",
    label: "Waiting",
  },
  in_consultation: {
    bg: "bg-teal-50/70",
    border: "border-teal-300/80",
    badge: "bg-teal-100 text-teal-900 border border-teal-200",
    dot: "bg-teal-500 animate-pulse",
    label: "In Consultation",
  },
  completed: {
    bg: "bg-slate-50/70",
    border: "border-slate-200/80",
    badge: "bg-slate-100 text-slate-700 border border-slate-200",
    dot: "bg-slate-400",
    label: "Completed",
  },
  completed_reports_pending: {
    bg: "bg-amber-50/80",
    border: "border-amber-300/80",
    badge: "bg-amber-100 text-amber-900 border border-amber-300 font-bold",
    dot: "bg-amber-600",
    label: "Reports Pending",
  },
  skipped: {
    bg: "bg-rose-50/70",
    border: "border-rose-200/80",
    badge: "bg-rose-100 text-rose-800 border border-rose-200",
    dot: "bg-rose-500",
    label: "Skipped",
  },
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

  const [selectedDoctorId, setSelectedDoctorId] = useState(user?.userId || user?.id || "user_001");
  const doctors = dbUsers.getAll().filter((u) => u.role === "doctor");
  const isDoctorUser = user?.role === "doctor";
  const doctorId = isDoctorUser ? (user?.userId || user?.id || "user_001") : selectedDoctorId;

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
    <div className="w-full max-w-full min-w-0 space-y-6 zero-horizontal-overflow">
      {/* ── Header with Live Clock & Refresh ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Stethoscope className="w-6 h-6 sm:w-7 sm:h-7 text-teal-600" />
            <span>{docProfile?.name ? `${docProfile.name}'s OPD Chamber` : "Doctor's Live Queue"}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            {now.toLocaleString("en-PK", { weekday: "long", hour: "2-digit", minute: "2-digit", second: "2-digit" })} • {docProfile?.room_number || "OPD Chamber 1"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Single-Tap Doctor Chamber Queue Switcher */}
          {!isDoctorUser && doctors.length > 1 && (
            <div className="flex items-center gap-1 bg-white/80 border border-slate-200/80 p-1 rounded-2xl shadow-xs backdrop-blur-xs">
              {doctors.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDoctorId(d.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    doctorId === d.id
                      ? "bg-teal-700 text-white shadow-sm shadow-teal-700/20"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>{d.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={loadQueue}
            className="touch-pill min-h-[44px] text-xs text-teal-900 bg-white/85 border border-teal-200/80 hover:bg-teal-50 transition-colors font-bold shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4 text-teal-700" />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* ── Doctor Live Chamber Availability Control Bar ── */}
      <div className="glass-card p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">Live Chamber Broadcast:</span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">(Syncs to Waiting TV & Patient PWA)</span>
          </div>
          {docProfile?.status_note && (
            <span className="text-xs bg-amber-50 text-amber-900 font-bold px-3 py-1 rounded-xl border border-amber-200/80 shadow-xs">
              Notice: {docProfile.status_note}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Option 1: Available */}
          <button
            onClick={() => handleSetAvailability("available")}
            className={`min-h-[44px] py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border cursor-pointer active:scale-97 ${
              currentStatus === "available"
                ? "bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-600/20"
                : "bg-emerald-50/80 text-emerald-900 border-emerald-200/80 hover:bg-emerald-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping" />
            <span>🟢 Available (In Chamber)</span>
          </button>

          {/* Option 2: 15-Min Short Break */}
          <button
            onClick={() => handleSetAvailability("break", "15-Min Break — Back soon")}
            className={`min-h-[44px] py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border cursor-pointer active:scale-97 ${
              currentStatus === "break"
                ? "bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20"
                : "bg-amber-50/80 text-amber-900 border-amber-200/80 hover:bg-amber-100"
            }`}
          >
            <Coffee className="w-4 h-4 text-amber-700" />
            <span>🟡 Short Break (15m)</span>
          </button>

          {/* Option 3: Unavailable / Shift Ended */}
          <button
            onClick={() => handleSetAvailability("unavailable", "Shift Ended for Today")}
            className={`min-h-[44px] py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border cursor-pointer active:scale-97 ${
              currentStatus === "unavailable"
                ? "bg-slate-800 text-white border-slate-900 shadow-md shadow-slate-800/20"
                : "bg-slate-100/80 text-slate-700 border-slate-200/80 hover:bg-slate-200/80"
            }`}
          >
            <Moon className="w-4 h-4 text-slate-500" />
            <span>Shift Ended / Away</span>
          </button>
        </div>

        {/* Custom Status Note Toggle */}
        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setShowNoteInput(!showNoteInput)}
            className="text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1.5 cursor-pointer py-1"
          >
            <Edit3 className="w-4 h-4" />
            <span>{showNoteInput ? "Hide Custom Note" : "Add / Edit Custom Status Note (e.g. Back at 6:30 PM)"}</span>
          </button>
        </div>

        {showNoteInput && (
          <form onSubmit={handleSaveCustomNote} className="flex gap-2 pt-1">
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. Tea Break • Resuming at 5:30 PM"
              className="flex-1 text-xs border border-slate-300/80 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            />
            <button
              type="submit"
              className="min-h-[44px] bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              Save Note
            </button>
          </form>
        )}
      </div>

      {/* ── Telemetry KPI Summary Bento Grid ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl sm:text-3xl font-black text-teal-700 tracking-tight">{inConsultation.length}</div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">In Chamber</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">{waiting.length}</div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Waiting</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{queue.length}</div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Total Today</div>
        </div>
      </div>

      {/* ── Call Next Patient Prominent Action Bar ── */}
      {waiting.length > 0 && inConsultation.length === 0 && (
        <button
          onClick={callNext}
          className="w-full min-h-[52px] bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white py-3.5 px-6 rounded-2xl font-black text-base sm:text-lg transition-all shadow-lg shadow-teal-700/25 flex items-center justify-center gap-3 cursor-pointer active:scale-98"
        >
          <PhoneCall className="w-5 h-5" />
          <span>Call Next Patient (Token #{waiting[0]?.token_number})</span>
        </button>
      )}

      {/* ── Queue Cards List with Layout Animations ── */}
      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-card border-dashed border-2 border-teal-200/80">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mb-4 shadow-xs">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="font-black text-slate-900 text-base">No Patients in Today&apos;s Queue</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm font-medium">
            The doctor&apos;s OPD waiting list is clear. New walk-ins and appointments registered at the reception desk will appear here automatically.
          </p>
          <button
            onClick={() => navigate("/reception/register")}
            className="mt-5 min-h-[44px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-teal-700/20 transition-all cursor-pointer active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Walk-in Patient</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <AnimatePresence>
            {queue.map((visit) => {
              const patient = patients[visit.patient_id];
              const s = STATUS_STYLES[visit.status] || STATUS_STYLES.waiting;
              const isActive = visit.status === "in_consultation";

              return (
                <motion.div
                  key={visit.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`glass-card p-4 sm:p-5 transition-all ${s.bg} ${s.border} ${isActive ? "shadow-md ring-2 ring-teal-500/50" : ""}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                    <div className="flex items-start gap-3.5 min-w-0">
                      {/* Token Number High-Contrast Badge */}
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 ${
                          isActive
                            ? "bg-teal-700 text-white shadow-md shadow-teal-700/25"
                            : "bg-white text-slate-800 border border-slate-200/80 shadow-xs"
                        }`}
                      >
                        {visit.token_number}
                      </div>

                      {/* Patient Information & Badges */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-base">
                            {patient ? patient.full_name : "Unknown Patient"}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${s.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                          {visit.visit_type === "follow_up" && (
                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200/70 px-2 py-0.5 rounded-full font-bold">
                              Follow-up
                            </span>
                          )}
                        </div>
                        {patient && (
                          <div className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                            {getRelLabel(patient.relation_type)} {patient.relation_name}
                            {formatPatientAge(patient) !== "—" ? ` · ${formatPatientAge(patient)}` : ""}
                            {patient.phone ? ` · ${patient.phone}` : ""}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Registered at {new Date(visit.visit_date).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Ergonomic 44px Action Targets */}
                    <div className="flex sm:flex-col flex-row gap-2 shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                      {isActive && (
                        <button
                          onClick={() => startConsultation(visit.id)}
                          className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-2 bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-teal-700/20 cursor-pointer active:scale-95"
                        >
                          <Stethoscope className="w-4 h-4" />
                          <span>Consult</span>
                        </button>
                      )}

                      {visit.status === "waiting" && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => {
                              dbVisits.updateStatus(visit.id, "in_consultation");
                              loadQueue();
                            }}
                            className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-1.5 bg-white border border-teal-300 text-teal-800 px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-teal-50 transition-all cursor-pointer active:scale-95 shadow-xs"
                          >
                            <PhoneCall className="w-4 h-4" />
                            <span>Call</span>
                          </button>
                          <button
                            onClick={() => skipVisit(visit.id)}
                            className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-1 bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer active:scale-95 shadow-xs"
                          >
                            <SkipForward className="w-4 h-4" />
                            <span>Skip</span>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove Token #${visit.token_number} (${patient?.full_name || "Patient"}) from active queue?`)) {
                                dbVisits.delete(visit.id);
                                loadQueue();
                              }
                            }}
                            className="min-h-[44px] w-10 flex items-center justify-center bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs"
                            title="Remove from Queue"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {visit.status === "skipped" && (
                        <div className="flex sm:flex-col flex-row gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => {
                              dbVisits.reissueLateToken(visit.id);
                              loadQueue();
                            }}
                            title="Re-issue new token at END of queue with Rs. 0 Fee"
                            className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-1.5 bg-white border border-amber-300 text-amber-900 px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-amber-50 transition-all cursor-pointer active:scale-95 shadow-xs"
                          >
                            <Ticket className="w-4 h-4 text-amber-700" />
                            <span>Re-issue Token</span>
                          </button>
                          <button
                            onClick={() => {
                              dbVisits.updateStatus(visit.id, "waiting");
                              loadQueue();
                            }}
                            className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-1 bg-white border border-teal-300 text-teal-800 px-3 py-2 rounded-xl text-xs font-bold hover:bg-teal-50 transition-all cursor-pointer active:scale-95 shadow-xs"
                          >
                            <RotateCcw className="w-4 h-4 text-teal-700" />
                            <span>Recall</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}


