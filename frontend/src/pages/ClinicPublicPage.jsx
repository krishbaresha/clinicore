import { useState, useEffect } from "react";
import { dbClinic, dbUsers, dbVisits } from "../api/db.js";

export default function ClinicPublicPage() {
  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [doctorQueues, setDoctorQueues] = useState({});
  const [searchToken, setSearchToken] = useState("");
  const [tokenResult, setTokenResult] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Load clinic, doctors, and live queue data
  const loadData = () => {
    const c = dbClinic.get() || {};
    setClinic(c);

    const docList = dbUsers.getAll().filter((u) => u.role === "doctor");
    setDoctors(docList);

    const todayAllVisits = dbVisits.getTodayAll();
    const qMap = {};

    docList.forEach((doc) => {
      const docVisits = todayAllVisits.filter((v) => v.doctor_id === doc.id);
      const inRoom = docVisits.find((v) => v.status === "in_consultation");
      const waiting = docVisits.filter((v) => v.status === "waiting");
      const completed = docVisits.filter(
        (v) => v.status === "completed" || v.status === "completed_reports_pending"
      );

      qMap[doc.id] = {
        inRoom: inRoom || null,
        waiting: waiting || [],
        completedCount: completed.length,
        totalToday: docVisits.length,
      };
    });

    setDoctorQueues(qMap);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
      setCurrentTime(new Date());
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Track specific token logic
  const handleTrackToken = (e) => {
    e.preventDefault();
    if (!searchToken.trim()) return;
    const num = Number(searchToken.trim());
    if (isNaN(num)) {
      setTokenResult({ status: "invalid", msg: "Please enter a valid numeric token number." });
      return;
    }

    const todayAll = dbVisits.getTodayAll();
    const targetVisit = todayAll.find((v) => Number(v.token_number) === num);

    if (!targetVisit) {
      setTokenResult({
        status: "not_found",
        token: num,
        msg: `Token #${num} is not registered in today's active queue. Please verify your receipt or contact the reception desk.`,
      });
      return;
    }

    const doc = doctors.find((d) => d.id === targetVisit.doctor_id) || doctors[0];
    const docQueue = doctorQueues[doc?.id] || { waiting: [], inRoom: null };

    if (targetVisit.status === "in_consultation") {
      setTokenResult({
        status: "in_room",
        token: num,
        doctor: doc,
        msg: `Token #${num} is currently being called. Please proceed directly to Chamber ${doc?.room_number || "Room 1"}.`,
      });
    } else if (targetVisit.status === "waiting") {
      const ahead = docQueue.waiting.findIndex((v) => v.id === targetVisit.id);
      const queuePosition = ahead >= 0 ? ahead : 0;
      const waitMins = (queuePosition + 1) * 7;

      setTokenResult({
        status: "waiting",
        token: num,
        doctor: doc,
        queuePosition: queuePosition + 1,
        aheadCount: queuePosition,
        estimatedMins: waitMins,
        msg: queuePosition === 0
          ? `You are next in line. Please be ready outside Chamber ${doc?.room_number || "Room 1"}.`
          : `There are ${queuePosition} patient(s) ahead of you. Estimated wait time is approximately ~${waitMins} minutes.`,
      });
    } else if (targetVisit.status === "completed" || targetVisit.status === "completed_reports_pending") {
      setTokenResult({
        status: "completed",
        token: num,
        doctor: doc,
        msg: `Token #${num} consultation is marked completed for today.`,
      });
    } else {
      setTokenResult({
        status: "other",
        token: num,
        doctor: doc,
        msg: `Token #${num} status: ${targetVisit.status}.`,
      });
    }
  };

  // Primary doctor
  const primaryDoc = doctors[0] || {
    name: "Dr. Asif Ashraf",
    specialization: "Consultant Homeopath & Family Physician",
    room_number: "Room 1",
    status: "available",
  };

  const primaryQueue = doctorQueues[primaryDoc.id] || { inRoom: null, waiting: [], totalToday: 0 };
  const isClinicOpen = clinic?.is_open !== false;

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#181c1c] font-sans selection:bg-teal-600 selection:text-white flex flex-col">
      {/* ── Top Clinic Emergency Bar ── */}
      <div className="bg-teal-900 text-teal-100 text-xs py-2 px-4 border-b border-teal-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-semibold">Dr. Asif Ashraf&apos;s Clinic • Live OPD Queue Portal</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-teal-300">location_on</span>
              Lajpat Road, Hyderabad
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-teal-300">call</span>
              03001234567
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Clinic Header ── */}
      <header className="bg-white border-b border-teal-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt="CliniCore Logo"
              className="w-12 h-12 object-contain rounded-2xl drop-shadow-md shrink-0"
            />
            <div>
              <h1 className="text-xl font-black text-teal-950 tracking-tight leading-tight">
                {clinic?.name || "Dr. Asif Ashraf's Clinic"}
              </h1>
              <p className="text-xs font-semibold text-teal-700">Classical Homeopathic Treatment &amp; Family Care</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="tel:03001234567"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-teal-50 text-teal-900 border border-teal-200 hover:bg-teal-100 transition-colors"
            >
              <span className="material-symbols-outlined text-base text-teal-600">call</span>
              <span className="hidden sm:inline">Call Clinic</span>
            </a>
            <a
              href="https://wa.me/923001234567?text=Assalam%20o%20Alaikum%20Dr%20Asif,%20I%20want%20to%20inquire%20about%20clinic%20timings."
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* ── Live Hero Banner ── */}
      <section className="bg-gradient-to-br from-teal-800 via-teal-900 to-slate-900 text-white py-12 px-4 relative overflow-hidden">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Doctor & Clinic Info */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {isClinicOpen ? "Clinic is Currently Open" : "Clinic is Currently Closed"}
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Dr. Asif Ashraf
            </h2>
            <p className="text-base sm:text-lg text-teal-200 font-medium mt-1">
              Senior Consultant Homeopath • 15+ Years Clinical Experience
            </p>
            <p className="text-xs sm:text-sm text-teal-100/80 mt-3 max-w-xl leading-relaxed">
              Specializing in classical homeopathic treatment for chronic ailments, allergies, digestive disorders, skin conditions, arthritis, and natural family wellness.
            </p>

            <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-teal-100">
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                <span className="material-symbols-outlined text-emerald-400 text-base">schedule</span>
                <span>Mon – Sat: 5:00 PM – 10:30 PM</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                <span className="material-symbols-outlined text-emerald-400 text-base">meeting_room</span>
                <span>Chamber: Room 1</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                <span className="material-symbols-outlined text-emerald-400 text-base">location_on</span>
                <span>Lajpat Road, Hyderabad</span>
              </div>
            </div>
          </div>

          {/* Right: Live Token Card Display */}
          <div className="lg:col-span-5">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 text-white shadow-2xl text-center">
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-teal-300">
                Live Patient Queue
              </div>
              <div className="text-xs text-teal-100 mt-0.5">
                {currentTime.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>

              {/* Calling Token Box */}
              <div className="my-5 py-4 px-6 rounded-2xl bg-white text-slate-900 shadow-inner">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Now Calling</div>
                <div className="text-5xl sm:text-6xl font-black text-teal-900 my-1">
                  {primaryQueue.inRoom ? `TOKEN #${primaryQueue.inRoom.token_number}` : "WAITING"}
                </div>
                <div className="text-xs font-bold text-teal-700 flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-sm">person</span>
                  {primaryQueue.inRoom ? "In Chamber 1 with Doctor" : "Doctor preparing for next token"}
                </div>
              </div>

              {/* Waiting metrics */}
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="bg-white/10 p-3 rounded-xl">
                  <div className="text-[10px] text-teal-200 font-bold uppercase">Waiting in Queue</div>
                  <div className="text-2xl font-black">{primaryQueue.waiting.length} Patients</div>
                </div>
                <div className="bg-white/10 p-3 rounded-xl">
                  <div className="text-[10px] text-teal-200 font-bold uppercase">Estimated Delay</div>
                  <div className="text-2xl font-black">~{primaryQueue.waiting.length * 6} mins</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Interactive Patient Token Finder ── */}
      <section className="max-w-4xl mx-auto px-4 -mt-6 mb-12 relative z-10 w-full">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-teal-100">
          <div className="text-center max-w-xl mx-auto mb-6">
            <h3 className="text-xl sm:text-2xl font-black text-teal-950 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-teal-700 text-2xl">search</span>
              Track Your Token Turn Live
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Enter your Token Number printed on your slip to check how many patients are ahead of you.
            </p>
          </div>

          <form onSubmit={handleTrackToken} className="max-w-md mx-auto flex gap-2">
            <input
              type="number"
              min="1"
              max="999"
              value={searchToken}
              onChange={(e) => setSearchToken(e.target.value)}
              placeholder="e.g. 12"
              className="flex-1 border-2 border-teal-200 focus:border-teal-600 rounded-2xl px-4 py-3 text-base font-bold text-center text-slate-900 focus:outline-none bg-teal-50/50"
            />
            <button
              type="submit"
              className="bg-teal-700 hover:bg-teal-800 text-white font-extrabold px-6 py-3 rounded-2xl text-sm transition-all shadow-md shadow-teal-700/20 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">search</span>
              Track
            </button>
          </form>

          {/* Token Tracking Result Card */}
          {tokenResult && (
            <div className={`mt-6 p-4 sm:p-5 rounded-2xl border text-sm font-semibold max-w-xl mx-auto ${
              tokenResult.status === "in_room"
                ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                : tokenResult.status === "waiting"
                ? "bg-amber-50 border-amber-300 text-amber-950"
                : tokenResult.status === "completed"
                ? "bg-blue-50 border-blue-300 text-blue-950"
                : "bg-rose-50 border-rose-300 text-rose-950"
            }`}>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-2xl shrink-0 mt-0.5">
                  {tokenResult.status === "in_room"
                    ? "check_circle"
                    : tokenResult.status === "waiting"
                    ? "hourglass_top"
                    : tokenResult.status === "completed"
                    ? "task_alt"
                    : "error"}
                </span>
                <div>
                  <div className="font-black text-base mb-1">
                    {tokenResult.status === "in_room" && `Token #${tokenResult.token} is Calling Now!`}
                    {tokenResult.status === "waiting" && `Token #${tokenResult.token} Status: In Queue`}
                    {tokenResult.status === "completed" && `Token #${tokenResult.token} Done`}
                    {tokenResult.status === "not_found" && `Token #${tokenResult.token} Not Found`}
                  </div>
                  <p className="font-normal text-xs sm:text-sm leading-relaxed">{tokenResult.msg}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Clinic Key Specializations ── */}
      <section className="py-12 bg-white border-y border-teal-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200 uppercase tracking-wider">
              Natural Healing
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-teal-950 mt-2">
              Key Treatments &amp; Consultations
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-2xl bg-teal-50/50 border border-teal-100 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center mb-3">
                <span className="material-symbols-outlined">spa</span>
              </div>
              <h4 className="font-bold text-teal-950">Chronic Illness</h4>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                Root-cause homeopathic treatment for long-standing health issues without side effects.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-teal-50/50 border border-teal-100 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center mb-3">
                <span className="material-symbols-outlined">face_2</span>
              </div>
              <h4 className="font-bold text-teal-950">Skin &amp; Allergies</h4>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                Eczema, psoriasis, acne, seasonal allergies, and respiratory sensitivity therapies.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-teal-50/50 border border-teal-100 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center mb-3">
                <span className="material-symbols-outlined">gastroenterology</span>
              </div>
              <h4 className="font-bold text-teal-950">Digestive Care</h4>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                IBS, acidity, gastritis, liver sluggishness, and metabolic health restoration.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-teal-50/50 border border-teal-100 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center mb-3">
                <span className="material-symbols-outlined">family_restroom</span>
              </div>
              <h4 className="font-bold text-teal-950">Family &amp; Child Health</h4>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                Gentle immunity boosting, pediatric growth support, and elder wellness care.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Clinic Contact & Timings Footer ── */}
      <footer className="bg-slate-950 text-slate-300 py-12 mt-auto">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="font-black text-xl text-white">Dr. Asif Ashraf&apos;s Clinic</div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Committed to providing compassionate, classical homeopathic care and holistic wellness for patients of all ages.
            </p>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-3">Clinic Timings</div>
            <div className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Monday – Saturday:</span>
                <span className="font-bold text-white">5:00 PM – 10:30 PM</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>Sunday:</span>
                <span>Closed</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-3">Address &amp; Contact</div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div>📍 Lajpat Road, Hyderabad, Sindh, Pakistan</div>
              <div>📞 Phone: <strong>03001234567</strong></div>
              <div className="pt-2">
                <a
                  href="https://wa.me/923001234567"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-400 font-bold hover:underline"
                >
                  <span className="material-symbols-outlined text-sm">chat</span>
                  WhatsApp Consultation Inquiry
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div>© 2026 Dr. Asif Ashraf&apos;s Clinic • All Rights Reserved</div>
          <div>Powered by ClinicFlow System</div>
        </div>
      </footer>
    </div>
  );
}
