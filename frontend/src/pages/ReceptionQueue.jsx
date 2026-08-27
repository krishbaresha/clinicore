import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { dbVisits, dbPatients, dbClinic, dbUsers } from "../api/db.js";
import { printOPDTokenReceipt } from "../utils/thermalPrinter.js";

const STATUS_META = {
  waiting:                  { label: "Waiting",         bg: "bg-amber-100",  text: "text-amber-800",  dot: "bg-amber-500" },
  in_consultation:          { label: "In Room",         bg: "bg-teal-100",   text: "text-teal-800",   dot: "bg-teal-500 animate-pulse" },
  completed:                { label: "Done",            bg: "bg-gray-100",   text: "text-gray-500",   dot: "bg-gray-400" },
  completed_reports_pending:{ label: "Reports Pending", bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
  skipped:                  { label: "Skipped",         bg: "bg-rose-100",   text: "text-rose-700",   dot: "bg-rose-400" },
  skipped_reissued:         { label: "Re-issued",       bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
};

export default function ReceptionQueue() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState({});
  const [doctors, setDoctors] = useState([]);
  const [clinicData, setClinicData] = useState(null);
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("active"); // 'active' | 'completed' | 'skipped' | 'all'
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [noticeText, setNoticeText] = useState("");
  const [showDoctorManager, setShowDoctorManager] = useState(false);
  const [selectedQueueIndex, setSelectedQueueIndex] = useState(0);

  const load = useCallback(() => {
    const all = dbVisits.getTodayAll();
    setVisits(all);
    const pMap = {};
    all.forEach((v) => {
      if (!pMap[v.patient_id]) pMap[v.patient_id] = dbPatients.getById(v.patient_id);
    });
    setPatients(pMap);
    setDoctors(dbUsers.getAll().filter((u) => u.role === "doctor"));

    const c = dbClinic.get() || {};
    setClinicData(c);
    setNoticeText(c.public_notice || "");
  }, []);

  function handleSetClinicStatus(status) {
    dbClinic.updateClinicStatus(status, clinicData?.public_notice || "");
    load();
  }

  function handleSaveNotice(e) {
    e.preventDefault();
    dbClinic.updateClinicStatus(clinicData?.clinic_status || "open", noticeText.trim());
    setIsEditingNotice(false);
    load();
  }

  function handleUpdateDoctorAvailability(doctorId, status, note = "") {
    dbUsers.updateDoctorStatus(doctorId, status, note);
    load();
  }

  const filteredVisitsByDoc = selectedDoctorFilter === "all"
    ? visits
    : visits.filter((v) => v.doctor_id === selectedDoctorFilter);

  const waitingList = filteredVisitsByDoc.filter((v) => v.status === "waiting");
  const inRoomList  = filteredVisitsByDoc.filter((v) => v.status === "in_consultation");
  const completedList = filteredVisitsByDoc.filter((v) => v.status === "completed" || v.status === "completed_reports_pending");
  const skippedList = filteredVisitsByDoc.filter((v) => v.status === "skipped" || v.status === "skipped_reissued");

  const currentToken = inRoomList[0]?.token_number ?? "—";
  const nextToken    = waitingList[0]?.token_number ?? "—";
  const clinicStatus = clinicData?.clinic_status || "open";

  // Tab Filtering
  let displayedVisits = [];
  if (activeTab === "active") {
    displayedVisits = [...inRoomList, ...waitingList];
  } else if (activeTab === "completed") {
    displayedVisits = completedList;
  } else if (activeTab === "skipped") {
    displayedVisits = skippedList;
  } else {
    displayedVisits = filteredVisitsByDoc;
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);

    const handleCustomUpdate = () => load();
    window.addEventListener("clinicflow_status_update", handleCustomUpdate);

    function handleReceptionQueueKeyDown(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedQueueIndex((prev) => Math.min(displayedVisits.length - 1, prev + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedQueueIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        const currentVisit = displayedVisits[selectedQueueIndex];
        if (currentVisit) {
          const patient = patients[currentVisit.patient_id];
          const assignedDoctor = doctors.find((d) => d.id === currentVisit.doctor_id) || doctors[0];
          printOPDTokenReceipt({
            token: currentVisit.token_number,
            token_number: currentVisit.token_number,
            patient,
            doctor: assignedDoctor,
            visit: currentVisit,
            fee: currentVisit.fee_amount,
            fee_amount: currentVisit.fee_amount,
            registeredAt: new Date(currentVisit.visit_date),
          }, clinicData);
        }
      } else if (e.key === "Enter") {
        const currentVisit = displayedVisits[selectedQueueIndex];
        if (currentVisit) {
          navigate(`/patients/${currentVisit.patient_id}`);
        }
      }
    }

    window.addEventListener("keydown", handleReceptionQueueKeyDown);

    return () => {
      clearInterval(interval);
      window.removeEventListener("clinicflow_status_update", handleCustomUpdate);
      window.removeEventListener("keydown", handleReceptionQueueKeyDown);
    };
  }, [load, displayedVisits, selectedQueueIndex, patients, doctors, clinicData, navigate]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>event_note</span>
            Reception &amp; Counter Queue Desk
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Waiting Room TV Screen Button - Disabled by user preference */}
          {/* <button
            onClick={() => window.open("/live", "_blank")}
            title="Launch Public Live Token Display in new tab for Waiting Room LED TV"
            className="flex items-center gap-1.5 text-xs text-teal-900 bg-teal-100 hover:bg-teal-200 border border-teal-300 px-3.5 py-2 rounded-xl transition-colors font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-base">tv</span>
            Waiting Room TV Screen
          </button> */}
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-teal-700 bg-white border border-teal-200 px-3.5 py-2 rounded-xl hover:bg-teal-50 transition-colors font-medium shadow-sm"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            Refresh
          </button>
          <button
            onClick={() => navigate("/reception/register")}
            className="flex items-center gap-1.5 text-xs bg-teal-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-teal-700 transition-colors shadow-md shadow-teal-200"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            New Token
          </button>
        </div>
      </div>

      {/* ─── MASTER CLINIC & DOCTOR AVAILABILITY CONTROLS ──────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-4">
        {/* Clinic Status Row */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Master Clinic Live Status:</span>
            <span className="text-xs text-gray-400">(Broadcasts to Waiting Room TV)</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleSetClinicStatus("open")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                clinicStatus === "open"
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              Open (OPD Active)
            </button>
            <button
              onClick={() => handleSetClinicStatus("break")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                clinicStatus === "break"
                  ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              }`}
            >
              Midday / Prayer Break
            </button>
            <button
              onClick={() => handleSetClinicStatus("closed")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                clinicStatus === "closed"
                  ? "bg-rose-600 text-white border-rose-700 shadow-sm"
                  : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
              }`}
            >
              Closed for Today
            </button>
          </div>
        </div>

        {/* Doctor Live Status Overrides List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-teal-600">stethoscope</span>
              Doctor Chambers Live Availability (Counter Overrides):
            </span>
            <button
              type="button"
              onClick={() => setShowDoctorManager(!showDoctorManager)}
              className="text-xs text-teal-700 hover:text-teal-800 font-semibold"
            >
              {showDoctorManager ? "Collapse" : "Manage Doctor Statuses"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {doctors.map((doc) => {
              const status = doc.availability_status || "available";
              return (
                <div key={doc.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="font-bold text-xs text-gray-900">{doc.name}</div>
                      <div className="text-[11px] text-gray-500">{doc.room_number || "Chamber"}</div>
                    </div>
                    {status === "available" && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Available</span>}
                    {status === "break" && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">On Break</span>}
                    {status === "unavailable" && <span className="text-[10px] font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">Not In Today</span>}
                  </div>

                  {showDoctorManager && (
                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gray-200">
                      <button
                        onClick={() => handleUpdateDoctorAvailability(doc.id, "available")}
                        className={`text-[10px] font-bold py-1 rounded-lg border ${
                          status === "available" ? "bg-emerald-600 text-white border-emerald-700" : "bg-white text-emerald-800 border-gray-200 hover:bg-emerald-50"
                        }`}
                      >
                        Available
                      </button>
                      <button
                        onClick={() => handleUpdateDoctorAvailability(doc.id, "break", "15m Break")}
                        className={`text-[10px] font-bold py-1 rounded-lg border ${
                          status === "break" ? "bg-amber-500 text-white border-amber-600" : "bg-white text-amber-800 border-gray-200 hover:bg-amber-50"
                        }`}
                      >
                        Break
                      </button>
                      <button
                        onClick={() => handleUpdateDoctorAvailability(doc.id, "unavailable", "Shift Ended")}
                        className={`text-[10px] font-bold py-1 rounded-lg border ${
                          status === "unavailable" ? "bg-slate-700 text-white border-slate-800" : "bg-white text-slate-700 border-gray-200 hover:bg-slate-50"
                        }`}
                      >
                        Away
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Public Announcement Notice Bar */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="material-symbols-outlined text-base text-amber-600">campaign</span>
            <span className="font-semibold text-gray-700">Public TV Banner Notice:</span>
            <span className="text-gray-500 truncate max-w-md italic">"{clinicData?.public_notice || "Welcome to Clinic"}"</span>
          </div>

          <button
            onClick={() => setIsEditingNotice(!isEditingNotice)}
            className="text-xs text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            {isEditingNotice ? "Cancel Edit" : "Change Notice Banner"}
          </button>
        </div>

        {isEditingNotice && (
          <form onSubmit={handleSaveNotice} className="flex gap-2 pt-2">
            <input
              type="text"
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              placeholder="e.g. Note: Dr. Asif is currently seeing emergency patients. Next general turn in 10 mins."
              className="flex-1 text-xs border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              Update TV Notice
            </button>
          </form>
        )}
      </div>

      {/* Call Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-teal-700 to-teal-800 text-white rounded-2xl p-4 flex items-center justify-between shadow-md shadow-teal-700/20">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-100">Now In Doctor Room</div>
            <div className="text-3xl font-black mt-0.5">Token #{currentToken}</div>
          </div>
          <span className="material-symbols-outlined text-4xl text-teal-200 animate-pulse">stethoscope</span>
        </div>
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-md shadow-amber-500/20">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-100">Next Up Patient</div>
            <div className="text-3xl font-black mt-0.5">Token #{nextToken}</div>
          </div>
          <span className="material-symbols-outlined text-4xl text-amber-200">group</span>
        </div>
      </div>

      {/* Doctor Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 flex items-center gap-2 flex-wrap shadow-sm">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2">Filter Doctor:</span>
        <button
          onClick={() => setSelectedDoctorFilter("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            selectedDoctorFilter === "all"
              ? "bg-teal-600 text-white shadow-md shadow-teal-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All Doctors ({visits.length})
        </button>
        {doctors.map((doc) => {
          const docCount = visits.filter((v) => v.doctor_id === doc.id).length;
          return (
            <button
              key={doc.id}
              onClick={() => setSelectedDoctorFilter(doc.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedDoctorFilter === doc.id
                  ? "bg-teal-600 text-white shadow-md shadow-teal-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {doc.name} ({docCount})
            </button>
          );
        })}
      </div>

      {/* Queue View Categorization Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "active"
              ? "bg-teal-700 text-white shadow-md shadow-teal-700/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <span>Active Queue</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === "active" ? "bg-teal-900 text-teal-100" : "bg-amber-100 text-amber-900"}`}>
            {inRoomList.length + waitingList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("completed")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "completed"
              ? "bg-teal-700 text-white shadow-md shadow-teal-700/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <span>Completed Visits</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === "completed" ? "bg-teal-900 text-teal-100" : "bg-gray-100 text-gray-700"}`}>
            {completedList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("skipped")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "skipped"
              ? "bg-teal-700 text-white shadow-md shadow-teal-700/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <span>⏭️ Skipped &amp; Re-issued</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === "skipped" ? "bg-teal-900 text-teal-100" : "bg-rose-100 text-rose-800"}`}>
            {skippedList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "all"
              ? "bg-teal-700 text-white shadow-md shadow-teal-700/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <span>📁 All Today Visits</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === "all" ? "bg-teal-900 text-teal-100" : "bg-gray-100 text-gray-700"}`}>
            {filteredVisitsByDoc.length}
          </span>
        </button>
      </div>

      {/* Visits List */}
      {displayedVisits.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <span className="material-symbols-outlined text-5xl text-gray-300 block mb-3">event_busy</span>
          <div className="text-gray-500 font-medium">No visits found in this category</div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedVisits.map((visit, idx) => {
            const patient = patients[visit.patient_id];
            const docObj = doctors.find((d) => d.id === visit.doctor_id);
            const meta = STATUS_META[visit.status] || STATUS_META.waiting;
            const isSelected = idx === selectedQueueIndex;

            return (
              <div
                key={visit.id}
                onClick={() => setSelectedQueueIndex(idx)}
                className={`bg-white rounded-2xl border border-gray-200/80 p-4 shadow-sm hover:shadow-md transition-all space-y-3 cursor-pointer ${
                  isSelected ? "ring-2 ring-teal-600 bg-teal-50/60 shadow-md" : ""
                }`}
              >
                {/* Top Row: Token # + Patient Name + Doctor Badge + Status Badge */}
                <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${
                      visit.status === "in_consultation" ? "bg-teal-600 text-white shadow-md shadow-teal-200" : "bg-gray-100 text-gray-800"
                    }`}>
                      #{visit.token_number}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 text-base leading-tight truncate">
                        {patient?.full_name ?? "—"}
                      </h3>
                      <div className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{patient?.relation_name ? `${patient.relation_type === "husband" ? "W/O" : "S/O"} ${patient.relation_name}` : ""}</span>
                        <span>•</span>
                        <span className="capitalize">{visit.visit_type === "follow_up" ? "Follow-up" : "New Visit"}</span>
                        <span>•</span>
                        <span>{new Date(visit.visit_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {docObj && (
                      <span className="text-xs bg-teal-50 text-teal-800 border border-teal-200/80 px-3 py-1 rounded-full font-bold whitespace-nowrap">
                        👨‍⚕️ {docObj.name}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${meta.bg} ${meta.text}`}>
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </div>
                </div>

                {/* Re-issue Note if present */}
                {visit.fee_waived_reason && (
                  <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200/80 px-3 py-2 rounded-xl font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-amber-600">info</span>
                    <span>{visit.fee_waived_reason}</span>
                  </div>
                )}

                {/* Bottom Row: Actions Bar */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => printOPDTokenReceipt({
                        token: visit.token_number,
                        token_number: visit.token_number,
                        patient,
                        visit,
                        fee: visit.fee_amount,
                        fee_amount: visit.fee_amount,
                        doctor: doctors.find((d) => d.id === visit.doctor_id)
                      }, dbClinic.get())}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors border border-amber-200"
                    >
                      <span className="material-symbols-outlined text-base">print</span>
                      Print Token
                    </button>
                    <button
                      onClick={() => navigate("/store/pos", { state: { patientId: visit.patient_id } })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors border border-teal-200"
                    >
                      <span className="material-symbols-outlined text-base">point_of_sale</span>
                      Pharmacy POS
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {visit.status === "waiting" && (
                      <button
                        onClick={() => { dbVisits.updateStatus(visit.id, "skipped"); load(); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors border border-rose-200"
                      >
                        <span className="material-symbols-outlined text-base">person_off</span>
                        Mark Absent / Skip
                      </button>
                    )}

                    {visit.status === "skipped" && (
                      <>
                        <button
                          onClick={() => {
                            const newV = dbVisits.reissueLateToken(visit.id);
                            load();
                            if (newV) {
                              printOPDTokenReceipt({ token: newV.token_number, patient, visit: newV, fee: 0, doctor: docObj }, dbClinic.get());
                            }
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-950 hover:bg-amber-200 transition-colors border border-amber-300"
                        >
                          <span className="material-symbols-outlined text-base">confirmation_number</span>
                          Re-issue Token (End Queue - Rs.0)
                        </button>
                        <button
                          onClick={() => { dbVisits.updateStatus(visit.id, "waiting"); load(); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors border border-emerald-300"
                        >
                          <span className="material-symbols-outlined text-base">schedule</span>
                          Recall Next
                        </button>
                      </>
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
