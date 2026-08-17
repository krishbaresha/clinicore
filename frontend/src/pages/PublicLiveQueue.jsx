import { useState, useEffect, useRef, useCallback } from "react";
import { dbClinic, dbUsers, dbVisits } from "../api/db.js";

// Gentle dual-tone airport/hospital style chime using browser Web Audio API
function playTokenCallChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    
    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Tone 2: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.25);
    gain2.gain.setValueAtTime(0.25, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 0.9);
  } catch (err) {
    console.warn("Audio chime playback ignored:", err);
  }
}

export default function PublicLiveQueue() {
  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [doctorQueues, setDoctorQueues] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastCalledTokens, setLastCalledTokens] = useState({});

  const isInitialLoad = useRef(true);

  const loadData = useCallback(() => {
    const c = dbClinic.get() || {};
    setClinic(c);

    const docList = dbUsers.getAll().filter((u) => u.role === "doctor");
    setDoctors(docList);

    const todayAllVisits = dbVisits.getTodayAll();

    const qMap = {};
    const currentCalls = {};

    docList.forEach((doc) => {
      const docVisits = todayAllVisits.filter((v) => v.doctor_id === doc.id);
      const inRoom = docVisits.find((v) => v.status === "in_consultation");
      const waiting = docVisits.filter((v) => v.status === "waiting");
      const completed = docVisits.filter((v) => v.status === "completed" || v.status === "completed_reports_pending");

      qMap[doc.id] = {
        inRoom: inRoom || null,
        waiting: waiting || [],
        completedCount: completed.length,
        totalToday: docVisits.length,
      };

      if (inRoom) {
        currentCalls[doc.id] = inRoom.token_number;
      }
    });

    setDoctorQueues(qMap);

    // Audio Chime notification when a new token is called
    if (!isInitialLoad.current && soundEnabled) {
      let hasNewCall = false;
      Object.keys(currentCalls).forEach((docId) => {
        if (currentCalls[docId] && currentCalls[docId] !== lastCalledTokens[docId]) {
          hasNewCall = true;
        }
      });
      if (hasNewCall) {
        playTokenCallChime();
      }
    }

    setLastCalledTokens(currentCalls);
    isInitialLoad.current = false;
  }, [soundEnabled, lastCalledTokens]);

  useEffect(() => {
    loadData();

    // Polling interval (every 4 seconds for live sync)
    const interval = setInterval(loadData, 4000);

    // Clock ticker (every 1 second)
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);

    // Multi-tab instant sync via localStorage and custom events
    const handleStorage = () => loadData();
    const handleCustomUpdate = () => loadData();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("clinicflow_status_update", handleCustomUpdate);

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("clinicflow_status_update", handleCustomUpdate);
    };
  }, [loadData]);

  // Toggle fullscreen mode for waiting area TV
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  }

  const clinicStatus = clinic?.clinic_status || "open";
  const clinicNotice = clinic?.public_notice || "";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* ─── TOP HEADER BAR ────────────────────────────────────── */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between flex-wrap gap-4 shadow-xl backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-teal-500/20">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              medical_services
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {clinic?.name || "Dr. Asif Ashraf's Clinic"}
              </h1>
              {/* Clinic Master Status Badge */}
              {clinicStatus === "open" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Clinic Open (OPD Active)
                </span>
              )}
              {clinicStatus === "break" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Midday / Prayer Break
                </span>
              )}
              {clinicStatus === "closed" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  Clinic Closed (OPD Ended)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              📍 {clinic?.address || "Lajpat Road, Hyderabad"} • 📞 {clinic?.phone || "03001234567"}
            </p>
          </div>
        </div>

        {/* Clock & Action Controls */}
        <div className="flex items-center gap-3">
          {/* Digital Clock */}
          <div className="bg-slate-800/80 border border-slate-700 px-4 py-1.5 rounded-xl text-right">
            <div className="text-sm sm:text-base font-mono font-bold text-teal-300 tracking-wider">
              {currentTime.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {currentTime.toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>

          {/* Audio Chime Toggle */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playTokenCallChime();
            }}
            title={soundEnabled ? "Mute Calling Bell Chime" : "Enable Calling Bell Chime"}
            className={`p-2.5 rounded-xl border transition-all ${
              soundEnabled
                ? "bg-teal-500/20 border-teal-500/50 text-teal-300 hover:bg-teal-500/30"
                : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="material-symbols-outlined text-xl">
              {soundEnabled ? "volume_up" : "volume_off"}
            </span>
          </button>

          {/* Fullscreen TV Mode Toggle */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Waiting Area TV Fullscreen Mode"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>
        </div>
      </header>

      {/* ─── PUBLIC ANNOUNCEMENT MARQUEE ───────────────────────── */}
      {clinicNotice && (
        <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-teal-950 border-b border-teal-800/40 px-4 py-2 flex items-center gap-2 overflow-hidden shadow-inner">
          <span className="material-symbols-outlined text-teal-400 text-sm animate-bounce shrink-0">
            campaign
          </span>
          <span className="text-xs font-bold text-teal-300 tracking-wide shrink-0">NOTICE:</span>
          <div className="text-xs text-slate-200 font-medium truncate">
            {clinicNotice}
          </div>
        </div>
      )}

      {/* ─── MAIN DOCTORS OPD LIVE GRID ───────────────────────── */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col justify-between">
        {/* Closed Banner Warning if Clinic is Closed */}
        {clinicStatus === "closed" && (
          <div className="mb-6 bg-rose-950/40 border border-rose-800/60 rounded-3xl p-6 text-center shadow-2xl backdrop-blur-md">
            <span className="material-symbols-outlined text-rose-400 text-5xl mb-2">
              door_front
            </span>
            <h2 className="text-2xl font-black text-white">Clinic OPD is Currently Closed</h2>
            <p className="text-sm text-rose-200/80 mt-1 max-w-lg mx-auto">
              Today's consultation hours have concluded. For emergency appointments or tomorrow's OPD registration, please visit the reception desk during opening hours.
            </p>
          </div>
        )}

        {/* Doctor Chambers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doc) => {
            const queueInfo = doctorQueues[doc.id] || { inRoom: null, waiting: [], completedCount: 0, totalToday: 0 };
            const docStatus = doc.availability_status || "available";
            const currentToken = queueInfo.inRoom?.token_number;
            const waitingList = queueInfo.waiting;

            return (
              <div
                key={doc.id}
                className="bg-slate-900/80 border border-slate-800/90 hover:border-teal-700/50 rounded-3xl p-6 flex flex-col justify-between shadow-2xl backdrop-blur-xl transition-all relative overflow-hidden group"
              >
                {/* Top Glowing Ambient Light for Active Call */}
                {currentToken && docStatus === "available" && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500 animate-pulse"></div>
                )}

                <div>
                  {/* Doctor Header & Availability Status */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-teal-300 transition-colors">
                          {doc.name}
                        </h2>
                      </div>
                      <p className="text-xs text-teal-400 font-semibold mt-0.5">
                        {doc.specialization || "General Physician"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                        <span className="material-symbols-outlined text-[13px] text-slate-500">meeting_room</span>
                        {doc.room_number || "Chamber"}
                      </p>
                    </div>

                    {/* Status Pill */}
                    <div className="text-right shrink-0">
                      {docStatus === "available" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                          Available
                        </span>
                      )}
                      {docStatus === "break" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          On Break
                        </span>
                      )}
                      {docStatus === "unavailable" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                          Not In Today
                        </span>
                      )}
                      {doc.status_note && (
                        <p className="text-[10px] text-slate-400 mt-1 max-w-[120px] truncate" title={doc.status_note}>
                          {doc.status_note}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ─── NOW IN ROOM HERO CALL ─────────────────── */}
                  <div className="my-5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-teal-400">
                        <span className="material-symbols-outlined text-sm animate-pulse">sensors</span>
                        Now In Chamber
                      </span>
                      <span className="text-[10px] font-normal text-slate-500">Private Token</span>
                    </div>

                    {docStatus === "unavailable" ? (
                      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center text-slate-500 font-medium text-xs">
                        Doctor shift has ended for today.
                      </div>
                    ) : docStatus === "break" ? (
                      <div className="bg-amber-950/20 border border-amber-800/40 rounded-2xl p-5 text-center">
                        <span className="material-symbols-outlined text-amber-400 text-3xl mb-1">coffee</span>
                        <div className="text-sm font-bold text-amber-300">Doctor on Short Break</div>
                        <div className="text-xs text-amber-200/60 mt-0.5">{doc.status_note || "Consultations will resume shortly"}</div>
                      </div>
                    ) : currentToken ? (
                      <div className="bg-gradient-to-br from-teal-950/90 via-slate-900 to-emerald-950/60 border-2 border-teal-500/60 rounded-3xl p-5 text-center shadow-xl relative overflow-hidden">
                        <div className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                          Calling Token Number
                        </div>
                        <div className="text-5xl sm:text-6xl font-black text-white my-1 tracking-tight font-mono drop-shadow-[0_0_20px_rgba(20,184,166,0.5)] animate-pulse">
                          #{String(currentToken).padStart(2, "0")}
                        </div>
                        <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 bg-emerald-900/40 px-3 py-0.5 rounded-full border border-emerald-700/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          Inside {doc.room_number || "Chamber"}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 text-center">
                        <div className="text-3xl font-black text-slate-600 font-mono">—</div>
                        <div className="text-xs text-slate-400 font-medium mt-1">Chamber Ready • Calling Next</div>
                      </div>
                    )}
                  </div>

                  {/* ─── UP NEXT IN QUEUE (PRIVACY PROTECTED) ───── */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2.5">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-slate-500">list_alt</span>
                        Upcoming Tokens
                      </span>
                      <span className="text-[11px] text-teal-400 font-semibold">
                        {waitingList.length} in Waiting Queue
                      </span>
                    </div>

                    {waitingList.length === 0 ? (
                      <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 text-center text-xs text-slate-500">
                        No pending patients in queue
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {waitingList.slice(0, 6).map((item, idx) => (
                          <div
                            key={item.id}
                            className={`px-3 py-1.5 rounded-xl font-mono font-bold text-sm border transition-all ${
                              idx === 0
                                ? "bg-teal-500/20 text-teal-200 border-teal-500/40 shadow-sm"
                                : "bg-slate-800/70 text-slate-300 border-slate-700"
                            }`}
                          >
                            <span className="text-[10px] text-slate-400 mr-1 font-sans font-normal">Next:</span>
                            #{String(item.token_number).padStart(2, "0")}
                          </div>
                        ))}
                        {waitingList.length > 6 && (
                          <div className="px-2.5 py-1.5 rounded-xl font-sans text-xs bg-slate-800/40 text-slate-400 border border-slate-800 flex items-center">
                            +{waitingList.length - 6} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Est. Wait Time & Stats */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-slate-500">schedule</span>
                    <span>Est. Wait:</span>
                    <span className="font-semibold text-slate-300 font-mono">
                      {waitingList.length > 0 ? `~${waitingList.length * 10} mins` : "Ready"}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    Done: <span className="text-slate-300 font-mono font-semibold">{queueInfo.completedCount}</span> / Total: <span className="text-slate-300 font-mono font-semibold">{queueInfo.totalToday}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── WAITING ROOM INSTRUCTIONS FOOTER ─────────────────── */}
        <footer className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-400 text-lg">info</span>
            <span>
              <strong>Patient Note:</strong> Please watch for your Token Number on screen. 100% Privacy Protected.
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
              Live Sync Active (4s)
            </span>
            <span>Powered by: <strong>ClinicFlow Display Engine</strong></span>
          </div>
        </footer>
      </main>
    </div>
  );
}
