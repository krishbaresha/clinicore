import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { searchPatients } from "../api/patients.js";
import { dbVisits, dbPatientLedger } from "../api/db.js";
import { formatDate, getInitials } from "../utils/formatters.js";

export default function PatientsList() {
  const navigate = useNavigate();
  const [query,    setQuery]    = useState("");
  const [patients, setPatients] = useState([]);

  // Load/filter patients whenever query changes
  useEffect(() => {
    const result = searchPatients(query);
    if (result.success) setPatients(result.data);
  }, [query]);

  // Enrich each patient row with last-visit date and total visits count
  const allVisits = dbVisits.getAll();

  function getPatientMeta(patientId) {
    const visits = allVisits
      .filter((v) => v.patient_id === patientId)
      .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    return {
      lastVisit:   visits.length > 0 ? visits[0].visit_date : null,
      totalVisits: visits.length,
    };
  }

  return (
    <div className="flex flex-col w-full">
      {/* Page Header */}
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md flex items-center justify-between px-3 py-3 md:px-lg md:py-md border-b border-outline-variant/20 gap-2">
        <h1 className="font-bold text-xl md:text-headline-lg text-primary shrink-0">Patients</h1>

        {/* Search bar — hero interaction */}
        <div className="flex-1 max-w-2xl px-0 md:px-8">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
              search
            </span>
            <input
              id="patient-search-input"
              type="text"
              placeholder="Search patient by name or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface-container-low border-none rounded-full font-body-md text-body-md text-on-surface focus:bg-white focus:ring-2 focus:ring-primary/30 transition-all shadow-inner outline-none"
            />
          </div>
        </div>

        <button
          id="add-patient-btn"
          onClick={() => navigate("/patients/new")}
          className="btn-pill hidden md:flex"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add New Patient
        </button>
        {/* Mobile FAB */}
        <button
          id="add-patient-fab"
          onClick={() => navigate("/patients/new")}
          className="md:hidden bg-primary-container text-white p-3 rounded-full shadow-md active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-md md:p-lg space-y-md">
        {/* Table header row — desktop only */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 font-label-md text-label-md text-outline uppercase tracking-wider">
          <div className="col-span-4">Patient Name</div>
          <div className="col-span-3">Contact</div>
          <div className="col-span-3">Last Visit</div>
          <div className="col-span-2 text-right">Total Visits</div>
        </div>

        {/* Patient rows */}
        {patients.length === 0 ? (
          <div className="glass-card p-xl text-center text-outline font-body-md text-body-md">
            {query ? `No patients found for "${query}".` : "No patients registered yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {patients.map((patient) => {
              const { lastVisit, totalVisits } = getPatientMeta(patient.id);
              const initials = getInitials(patient.full_name);
              const isAlt = (patients.indexOf(patient) % 2 === 0);
              return (
                <div
                  key={patient.id}
                  id={`patient-row-${patient.id}`}
                  onClick={() => navigate(`/patients/${patient.id}`)}
                  className="glass-row rounded-2xl p-4 md:px-6 md:py-4 flex flex-col md:grid md:grid-cols-12 md:items-center gap-4 cursor-pointer"
                >
                  {/* Name + Avatar */}
                  <div className="col-span-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isAlt ? "bg-secondary-container text-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-body-lg text-body-lg font-semibold text-on-surface">{patient.full_name}</h3>
                      <p className="font-body-sm text-body-sm text-outline md:hidden">{patient.phone}</p>
                    </div>
                  </div>

                  {/* Phone — desktop */}
                  <div className="col-span-3 hidden md:flex items-center gap-2 text-on-surface-variant font-body-md text-body-md">
                    <span className="material-symbols-outlined text-[18px] text-outline">call</span>
                    {patient.phone}
                  </div>

                  {/* Last Visit */}
                  <div className="col-span-3 flex items-center justify-between md:justify-start gap-2 text-on-surface-variant font-body-md text-body-md">
                    <span className="md:hidden font-label-md text-outline uppercase">Last Visit:</span>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-outline hidden md:block">calendar_today</span>
                      {lastVisit ? formatDate(lastVisit) : "—"}
                    </div>
                  </div>

                  {/* Total Visits */}
                  <div className="col-span-2 flex items-center justify-between md:justify-end gap-2">
                    {(() => {
                      const ledger = dbPatientLedger.getByPatient(patient.id);
                      const due = ledger?.balance_due || 0;
                      if (due > 0) {
                        return (
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200" title={`Khata Due: Rs. ${due}`}>
                            Due: Rs. {due}
                          </span>
                        );
                      }
                      return null;
                    })()}
                    <span className="font-headline-md text-headline-md font-bold text-primary-container">
                      {totalVisits}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
