import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  RefreshCw,
  DoorOpen,
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

function getRelLabel(type, gender) {
  if (type === "father") return gender === "female" ? "D/O" : "S/O";
  if (type === "husband") return "W/O";
  if (type === "wife") return "H/O";
  if (type === "mother") return gender === "female" ? "D/O" : "S/O";
  return "";
}

export default function DoctorQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [patients, setPatients] = useState({});
  const [now, setNow] = useState(new Date());

  const doctors = useMemo(() => dbUsers.getAll().filter((u) => u.role === "doctor"), []);
  const isDoctorUser = user?.role === "doctor";
  const [selectedDoctorId, setSelectedDoctorId] = useState(() => {
    if (isDoctorUser) return user?.userId || user?.id || "user_owner";
    return doctors[0]?.id || "user_owner";
  });
  const doctorId = isDoctorUser ? (user?.userId || user?.id || "user_owner") : selectedDoctorId;
  const currentDoctor = useMemo(() => {
    return doctors.find((d) => d.id === doctorId || d.userId === doctorId) || dbUsers.getById(doctorId) || user;
  }, [doctors, doctorId, user]);
  const [selectedQueueIndex, setSelectedQueueIndex] = useState(0);

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

  const callNext = useCallback(() => {
    const { queue: curQueue } = navStateRef.current;
    const nextWaiting = curQueue.find((v) => v.status === "waiting");
    if (!nextWaiting) return;
    dbVisits.updateStatus(nextWaiting.id, "in_consultation");
    loadQueue();
  }, [loadQueue]);

  function skipVisit(visitId) {
    dbVisits.skip(visitId);
    loadQueue();
  }

  function startConsultation(visitId) {
    navigate(`/doctor/consultation/${visitId}`);
  }

  const inConsultation = queue.filter((v) => v.status === "in_consultation");
  const waiting = queue.filter((v) => v.status === "waiting");

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 10000);
    const handleCustomUpdate = () => loadQueue();
    window.addEventListener("clinicflow_status_update", handleCustomUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("clinicflow_status_update", handleCustomUpdate);
    };
  }, [loadQueue]);

  // Dedicated live clock interval
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // Stable keyboard navigation using ref
  const navStateRef = useRef({ queue, selectedQueueIndex, waiting });
  navStateRef.current = { queue, selectedQueueIndex, waiting };

  useEffect(() => {
    function handleDoctorQueueKeyDown(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const { queue: curQueue, selectedQueueIndex: curIdx, waiting: curWaiting } = navStateRef.current;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedQueueIndex((prev) => Math.min(curQueue.length - 1, prev + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedQueueIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (curQueue.length > 0 && curQueue[curIdx]) {
          startConsultation(curQueue[curIdx].id);
        } else if (curWaiting.length > 0) {
          callNext();
        }
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        callNext();
      }
    }

    window.addEventListener("keydown", handleDoctorQueueKeyDown);
    return () => window.removeEventListener("keydown", handleDoctorQueueKeyDown);
  }, [callNext]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 zero-horizontal-overflow">
      {/* ── Header with Live Clock & Refresh ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Stethoscope className="w-6 h-6 sm:w-7 sm:h-7 text-teal-600" />
            <span>{currentDoctor?.name ? `${currentDoctor.name}'s OPD Chamber` : "Doctor's Live Queue"}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            {now.toLocaleString("en-US", { weekday: "long", hour: "2-digit", minute: "2-digit", second: "2-digit" })} • {currentDoctor?.room_number || "OPD Chamber 1"}
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
            {queue.map((visit, idx) => {
              const patient = patients[visit.patient_id];
              const s = STATUS_STYLES[visit.status] || STATUS_STYLES.waiting;
              const isActive = visit.status === "in_consultation";
              const isSelected = idx === selectedQueueIndex;

              return (
                <motion.div
                  key={visit.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setSelectedQueueIndex(idx)}
                  className={`glass-card p-4 sm:p-5 transition-all cursor-pointer ${s.bg} ${s.border} ${
                    isSelected ? "ring-2 ring-teal-600 shadow-md bg-teal-50/90" : isActive ? "shadow-md ring-2 ring-teal-500/50" : ""
                  }`}
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
                          <span>Registered at {new Date(visit.visit_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
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


