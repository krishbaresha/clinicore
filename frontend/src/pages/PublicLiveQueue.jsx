import { useState, useEffect, useRef, useCallback } from "react";
import { dbClinic, dbUsers, dbVisits } from "../api/db.js";

// Audio Context singleton
let globalAudioCtx = null;

function getAudioContext() {
  if (!globalAudioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      globalAudioCtx = new AudioContext();
    }
  }
  return globalAudioCtx;
}

// Gentle dual-tone airport/hospital style chime using browser Web Audio API
function playTokenCallChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
      return;
    }

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
  const [themeMode, setThemeMode] = useState("light"); // 'light' (ClinicFlow Signature) | 'dark' (TV Lounge)

  const isInitialLoad = useRef(true);
  const lastCalledTokensRef = useRef({});
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

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
    if (!isInitialLoad.current && soundEnabledRef.current) {
      let hasNewCall = false;
      Object.keys(currentCalls).forEach((docId) => {
        if (currentCalls[docId] && currentCalls[docId] !== lastCalledTokensRef.current[docId]) {
          hasNewCall = true;
        }
      });
      if (hasNewCall) {
        playTokenCallChime();
      }
    }

    lastCalledTokensRef.current = currentCalls;
    isInitialLoad.current = false;
  }, []);

  // Unlock AudioContext on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };
    window.addEventListener("click", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

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
  const isDark = themeMode === "dark";

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
        isDark ? "bg-slate-950 text-slate-100" : "bg-[#f7faf8] text-[#181c1c]"
      }`}
      style={{
        background: isDark
          ? "radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)"
          : "linear-gradient(135deg, #f7faf8 0%, #e6f7f3 40%, #edf6f4 100%)"
      }}
    >
      {/* ─── TOP HEADER BAR ────────────────────────────────────── */}
      <header
        className={`px-4 sm:px-8 py-3.5 flex items-center justify-between flex-wrap gap-4 border-b transition-all sticky top-0 z-30 ${
          isDark
            ? "bg-slate-900/90 border-slate-800/90 backdrop-blur-xl shadow-xl"
            : "bg-white/80 border-white/60 backdrop-blur-xl shadow-[0_4px_24px_rgba(15,118,110,0.06)]"
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-700 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-700/25">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              medical_services
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-teal-950 font-headline-lg"}`}>
                {clinic?.name || "Dr. Asif Ashraf's Clinic"}
              </h1>

              {/* Clinic Master Status Badge */}
              {clinicStatus === "open" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-sm animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Clinic Open (OPD Active)
                </span>
              )}
              {clinicStatus === "break" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Midday / Prayer Break
                </span>
              )}
              {clinicStatus === "closed" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                  Clinic Closed (OPD Ended)
                </span>
              )}
            </div>
            <p className={`text-xs font-medium mt-0.5 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              📍 {clinic?.address || "Lajpat Road, Hyderabad"} • 📞 {clinic?.phone || "03001234567"}
            </p>
          </div>
        </div>

        {/* Clock & Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Digital Clock */}
          <div
            className={`px-4 py-1.5 rounded-2xl border text-right transition-all ${
              isDark
                ? "bg-slate-800/80 border-slate-700/80"
                : "bg-white/80 border-teal-100 shadow-sm"
            }`}
          >
            <div className={`text-sm sm:text-base font-mono font-black tracking-wider ${isDark ? "text-teal-300" : "text-teal-800"}`}>
              {currentTime.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
            </div>
            <div className={`text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              {currentTime.toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>

          {/* Theme Mode Switcher (Light ClinicFlow vs Dark TV Lounge) */}
          <button
            onClick={() => setThemeMode(isDark ? "light" : "dark")}
            title={isDark ? "Switch to ClinicFlow Light Medical Theme" : "Switch to Waiting Room Dark TV Theme"}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300"
                : "bg-white hover:bg-teal-50 border-teal-200 text-teal-800 shadow-sm"
            }`}
          >
            <span className="material-symbols-outlined text-xl">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>

          {/* Audio Chime Toggle */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playTokenCallChime();
            }}
            title={soundEnabled ? "Mute Calling Bell Chime" : "Enable Calling Bell Chime"}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
              soundEnabled
                ? isDark
                  ? "bg-teal-500/20 border-teal-500/50 text-teal-300"
                  : "bg-teal-100 border-teal-300 text-teal-900 shadow-sm"
                : isDark
                  ? "bg-slate-800 border-slate-700 text-slate-500"
                  : "bg-gray-100 border-gray-200 text-gray-400"
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
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                : "bg-white hover:bg-teal-50 border-teal-200 text-teal-800 shadow-sm"
            }`}
          >
            <span className="material-symbols-outlined text-xl">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>
        </div>
      </header>

      {/* ─── PUBLIC ANNOUNCEMENT MARQUEE ───────────────────────── */}
      {clinicNotice && (
        <div
          className={`border-b px-4 py-2 flex items-center gap-2.5 overflow-hidden shadow-sm transition-colors ${
            isDark
              ? "bg-teal-950/60 border-teal-900/60 text-teal-200"
              : "bg-teal-50 border-teal-200/70 text-teal-950"
          }`}
        >
          <span className="material-symbols-outlined text-teal-600 text-base animate-bounce shrink-0">
            campaign
          </span>
          <span className="text-xs font-bold tracking-wide uppercase shrink-0 text-teal-800">
            Public Notice:
          </span>
          <div className="text-xs font-medium truncate">
            {clinicNotice}
          </div>
        </div>
      )}

      {/* ─── MAIN DOCTORS OPD LIVE GRID ───────────────────────── */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col justify-between">
        {/* Closed Banner Warning if Clinic is Closed */}
        {clinicStatus === "closed" && (
          <div
            className={`mb-6 rounded-3xl p-6 text-center shadow-xl border backdrop-blur-xl transition-all ${
              isDark
                ? "bg-rose-950/40 border-rose-800/60 text-rose-200"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <span className="material-symbols-outlined text-rose-500 text-5xl mb-2">
              door_front
            </span>
            <h2 className="text-2xl font-black">Clinic OPD is Currently Closed</h2>
            <p className="text-sm mt-1 max-w-lg mx-auto opacity-90">
              Today's consultation hours have concluded. For emergency appointments or tomorrow's OPD token registration, please visit the reception desk during opening hours.
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
                className={`rounded-3xl p-6 flex flex-col justify-between transition-all border relative overflow-hidden group shadow-lg ${
                  isDark
                    ? "bg-slate-900/85 border-slate-800 hover:border-teal-700/60 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl"
                    : "bg-white/90 border-white/80 hover:border-teal-200 shadow-[0_12px_36px_rgba(15,118,110,0.08)] backdrop-blur-xl"
                }`}
              >
                {/* Top Glowing Ambient Light for Active Call */}
                {currentToken && docStatus === "available" && (
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500 animate-pulse"></div>
                )}

                <div>
                  {/* Doctor Header & Availability Status */}
                  <div className={`flex items-start justify-between gap-3 border-b pb-4 ${isDark ? "border-slate-800" : "border-gray-100"}`}>
                    <div>
                      <h2 className={`text-lg sm:text-xl font-bold transition-colors ${isDark ? "text-white group-hover:text-teal-300" : "text-gray-900 group-hover:text-teal-800"}`}>
                        {doc.name}
                      </h2>
                      <p className="text-xs text-teal-700 font-bold mt-0.5">
                        {doc.specialization || "General Physician"}
                      </p>
                      <p className={`text-[11px] mt-0.5 flex items-center gap-1 font-mono ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                        <span className="material-symbols-outlined text-[14px] text-teal-600">meeting_room</span>
                        {doc.room_number || "Chamber"}
                      </p>
                    </div>

                    {/* Status Pill */}
                    <div className="text-right shrink-0">
                      {docStatus === "available" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
                          Available
                        </span>
                      )}
                      {docStatus === "break" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          On Break
                        </span>
                      )}
                      {docStatus === "unavailable" && (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${isDark ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-gray-100 text-gray-600 border-gray-300"}`}>
                          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                          Not In Today
                        </span>
                      )}
                      {doc.status_note && (
                        <p className={`text-[10px] font-medium mt-1 max-w-[130px] truncate ${isDark ? "text-slate-400" : "text-gray-500"}`} title={doc.status_note}>
                          {doc.status_note}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ─── NOW IN ROOM HERO CALLOUT ───────────────── */}
                  <div className="my-5">
                    <div className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-teal-700 font-bold">
                        <span className="material-symbols-outlined text-base text-teal-600 animate-pulse">sensors</span>
                        Now In Chamber
                      </span>
                      <span className={`text-[10px] font-medium ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                        🔒 Private Token Only
                      </span>
                    </div>

                    {docStatus === "unavailable" ? (
                      <div className={`border rounded-2xl p-5 text-center font-medium text-xs ${isDark ? "bg-slate-950/60 border-slate-800 text-slate-500" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                        Doctor shift has ended for today.
                      </div>
                    ) : docStatus === "break" ? (
                      <div className={`border rounded-2xl p-5 text-center ${isDark ? "bg-amber-950/20 border-amber-800/40 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
                        <span className="material-symbols-outlined text-amber-500 text-3xl mb-1">coffee</span>
                        <div className="text-sm font-bold">Doctor on Short Break</div>
                        <div className="text-xs opacity-80 mt-0.5">{doc.status_note || "Consultations will resume shortly"}</div>
                      </div>
                    ) : currentToken ? (
                      <div className="bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-900 text-white rounded-3xl p-5 text-center shadow-xl relative overflow-hidden border border-teal-600">
                        <div className="text-xs font-bold text-teal-200 uppercase tracking-widest">
                          Calling Token Number
                        </div>
                        <div className="text-5xl sm:text-6xl font-black my-1 tracking-tight font-mono text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)] animate-pulse">
                          #{String(currentToken).padStart(2, "0")}
                        </div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-100 bg-white/15 px-3.5 py-1 rounded-full border border-white/25 backdrop-blur-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
                          Inside {doc.room_number || "Chamber"}
                        </div>
                      </div>
                    ) : (
                      <div className={`border rounded-2xl p-5 text-center ${isDark ? "bg-slate-950/60 border-slate-800 text-slate-400" : "bg-teal-50/50 border-teal-100 text-teal-800"}`}>
                        <div className="text-3xl font-black font-mono opacity-50">—</div>
                        <div className="text-xs font-semibold mt-1">Chamber Ready • Calling Next Turn</div>
                      </div>
                    )}
                  </div>

                  {/* ─── UP NEXT IN QUEUE (PRIVACY PROTECTED) ───── */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold mb-2.5">
                      <span className={`flex items-center gap-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        <span className="material-symbols-outlined text-sm text-teal-600">list_alt</span>
                        Upcoming Tokens
                      </span>
                      <span className="text-[11px] text-teal-700 font-bold">
                        {waitingList.length} in Waiting Queue
                      </span>
                    </div>

                    {waitingList.length === 0 ? (
                      <div className={`border rounded-xl p-3 text-center text-xs ${isDark ? "bg-slate-950/40 border-slate-800 text-slate-500" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                        No pending patients in queue
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {waitingList.slice(0, 6).map((item, idx) => (
                          <div
                            key={item.id}
                            className={`px-3 py-1.5 rounded-xl font-mono font-bold text-sm border transition-all ${
                              idx === 0
                                ? isDark
                                  ? "bg-teal-500/20 text-teal-200 border-teal-500/40"
                                  : "bg-teal-600 text-white border-teal-700 shadow-sm"
                                : isDark
                                  ? "bg-slate-800/80 text-slate-300 border-slate-700"
                                  : "bg-teal-50 text-teal-900 border-teal-200/80"
                            }`}
                          >
                            <span className={`text-[10px] mr-1 font-sans font-normal ${idx === 0 ? (isDark ? "text-teal-300" : "text-teal-100") : "text-gray-500"}`}>
                              Next:
                            </span>
                            #{String(item.token_number).padStart(2, "0")}
                          </div>
                        ))}
                        {waitingList.length > 6 && (
                          <div className={`px-2.5 py-1.5 rounded-xl font-sans text-xs border flex items-center ${isDark ? "bg-slate-800 text-slate-400 border-slate-800" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                            +{waitingList.length - 6} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Est. Wait Time & Stats */}
                <div className={`mt-5 pt-3.5 border-t flex items-center justify-between text-[11px] ${isDark ? "border-slate-800 text-slate-400" : "border-gray-100 text-gray-500"}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-teal-600">schedule</span>
                    <span>Est. Wait:</span>
                    <span className={`font-bold font-mono ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                      {waitingList.length > 0 ? `~${waitingList.length * 10} mins` : "Ready"}
                    </span>
                  </div>
                  <div>
                    Done: <span className={`font-mono font-bold ${isDark ? "text-slate-200" : "text-gray-800"}`}>{queueInfo.completedCount}</span> / Total: <span className={`font-mono font-bold ${isDark ? "text-slate-200" : "text-gray-800"}`}>{queueInfo.totalToday}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── WAITING ROOM INSTRUCTIONS FOOTER ─────────────────── */}
        <footer
          className={`mt-8 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-center sm:text-left transition-colors ${
            isDark ? "border-slate-800 text-slate-400" : "border-teal-100 text-gray-600"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600 text-lg">verified_user</span>
            <span>
              <strong>Privacy Protection:</strong> Patient names are hidden. Please watch your Token Number on screen.
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync Active (4s)
            </span>
            <span className={isDark ? "text-slate-500" : "text-gray-400"}>
              Powered by: <strong>ClinicFlow Display Engine</strong>
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
