import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { dbVisits, dbPatients } from "../api/db.js";

const STATUS_META = {
  waiting:                  { label: "Waiting",         bg: "bg-amber-100",  text: "text-amber-800",  dot: "bg-amber-500" },
  in_consultation:          { label: "In Consultation", bg: "bg-teal-100",   text: "text-teal-800",   dot: "bg-teal-500 animate-pulse" },
  completed:                { label: "Done",            bg: "bg-gray-100",   text: "text-gray-500",   dot: "bg-gray-400" },
  completed_reports_pending:{ label: "Reports Pending", bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
  skipped:                  { label: "Skipped",         bg: "bg-rose-100",   text: "text-rose-700",   dot: "bg-rose-400" },
};

export default function ReceptionQueue() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState({});

  const load = useCallback(() => {
    const all = dbVisits.getTodayAll();
    setVisits(all);
    const pMap = {};
    all.forEach((v) => {
      if (!pMap[v.patient_id]) pMap[v.patient_id] = dbPatients.getById(v.patient_id);
    });
    setPatients(pMap);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [load]);

  const waiting        = visits.filter((v) => v.status === "waiting");
  const inConsultation = visits.filter((v) => v.status === "in_consultation");
  const done           = visits.filter((v) => v.status === "completed" || v.status === "skipped");
  const currentToken   = inConsultation[0]?.token_number ?? "—";
  const nextToken      = waiting[0]?.token_number ?? "—";

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>event_note</span>
            Today&apos;s Queue
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm text-teal-600 border border-teal-200 px-3 py-2 rounded-xl hover:bg-teal-50 transition-colors font-medium"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
          </button>
          <button
            onClick={() => navigate("/reception/register")}
            className="flex items-center gap-1.5 text-sm bg-teal-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Register
          </button>
        </div>
      </div>

      {/* Current / Next Tokens */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-2xl p-5 text-center shadow-xl shadow-teal-600/20">
          <div className="text-xs font-medium uppercase tracking-widest opacity-80 mb-1">Currently Seeing</div>
          <div className="text-5xl font-black">{currentToken}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center shadow-sm">
          <div className="text-xs font-medium uppercase tracking-widest text-amber-700 mb-1">Next Up</div>
          <div className="text-5xl font-black text-amber-600">{nextToken}</div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: visits.length, color: "text-gray-700" },
          { label: "Waiting", value: waiting.length, color: "text-amber-600" },
          { label: "In Room", value: inConsultation.length, color: "text-teal-600" },
          { label: "Done", value: done.length, color: "text-gray-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* All visits */}
      {visits.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-5xl text-gray-200 block mb-3">event_busy</span>
          <div className="text-gray-500">No visits registered today yet</div>
          <button
            onClick={() => navigate("/reception/register")}
            className="mt-4 inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Register First Patient
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {visits.map((visit) => {
            const patient = patients[visit.patient_id];
            const meta = STATUS_META[visit.status] || STATUS_META.waiting;
            return (
              <div
                key={visit.id}
                className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm"
              >
                {/* Token */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0 ${
                  visit.status === "in_consultation" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600"
                }`}>
                  {visit.token_number}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm truncate">
                    {patient?.full_name ?? "—"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {patient?.relation_name && `${patient.relation_type === "husband" ? "W/O" : "S/O"} ${patient.relation_name} · `}
                    {visit.visit_type === "follow_up" ? "Follow-up" : "New"} ·{" "}
                    {new Date(visit.visit_date).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                {/* Status Badge */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${meta.bg} ${meta.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
