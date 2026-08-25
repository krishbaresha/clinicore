import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { searchPatients } from "../api/patients.js";
import { dbVisits } from "../api/db.js";
import { formatDate, getInitials } from "../utils/formatters.js";

export default function PatientsList() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 30;

  // Load/filter patients whenever query changes or data syncs
  useEffect(() => {
    const fetchPatients = () => {
      const result = searchPatients(query);
      if (result.success) {
        setPatients(result.data);
      }
    };
    fetchPatients();
    window.addEventListener("clinicflow_status_update", fetchPatients);
    return () => window.removeEventListener("clinicflow_status_update", fetchPatients);
  }, [query]);

  // Pre-index visit metadata in O(M) once instead of O(N*M) on each row
  const visitMetaMap = useMemo(() => {
    const map = new Map();
    const allVisits = dbVisits.getAll();
    allVisits.forEach((v) => {
      if (!map.has(v.patient_id)) {
        map.set(v.patient_id, { lastVisit: v.visit_date, totalVisits: 1 });
      } else {
        const curr = map.get(v.patient_id);
        curr.totalVisits += 1;
        if (new Date(v.visit_date) > new Date(curr.lastVisit)) {
          curr.lastVisit = v.visit_date;
        }
      }
    });
    return map;
  }, []);

  const totalPages = Math.max(1, Math.ceil(patients.length / PAGE_SIZE));
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return patients.slice(start, start + PAGE_SIZE);
  }, [patients, currentPage]);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isWiping, setIsWiping] = useState(false);

  function handleToggleSelect(patientId, e) {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  }

  function handleToggleSelectAll() {
    if (selectedIds.size === paginatedPatients.length && paginatedPatients.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedPatients.map((p) => p.id)));
    }
  }

  function handleBulkWipeout() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`⚠️ PERMANENT PROFILE WIPEOUT:\nAre you sure you want to completely erase ${count} selected patient profile(s)?\n\nThis will permanently delete their demographic records, visit history, consultation notes, and attached prescription photos.`)) {
      return;
    }
    setIsWiping(true);
    dbPatients.bulkWipeout(Array.from(selectedIds));
    setSelectedIds(new Set());
    // Refresh list
    const res = searchPatients(query);
    if (res.success) setPatients(res.data);
    setIsWiping(false);
  }

  function handleSingleDelete(patient, e) {
    e.stopPropagation();
    if (!confirm(`Permanently wipe out complete profile for "${patient.full_name}"?\n(Cascades and erases all visit history & prescription photos).`)) return;
    dbPatients.delete(patient.id);
    const res = searchPatients(query);
    if (res.success) setPatients(res.data);
  }

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md flex flex-wrap items-center justify-between px-3 py-3 md:px-lg md:py-md border-b border-outline-variant/20 gap-2">
        <div>
          <h1 className="font-bold text-xl md:text-headline-lg text-primary shrink-0">Patients Directory</h1>
          <p className="text-xs text-gray-500 hidden md:block">{patients.length} Total Patients Registered</p>
        </div>

        {/* Search bar — hero interaction */}
        <div className="flex-1 max-w-xl px-0 md:px-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
              search
            </span>
            <input
              id="patient-search-input"
              type="text"
              role="searchbox"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Name, Father/Husband, Phone, or CNIC..."
              className="w-full h-11 pl-12 pr-4 bg-surface-container-low border border-outline-variant/40 rounded-full font-body-lg text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkWipeout}
              disabled={isWiping}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all cursor-pointer animate-pulse"
            >
              <span className="material-symbols-outlined text-sm">delete_forever</span>
              Wipeout ({selectedIds.size}) Selected
            </button>
          )}

          <button
            onClick={() => navigate("/reception/register")}
            className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>New Patient</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="py-3 flex flex-col gap-md w-full min-w-0 overflow-x-hidden">
        {/* Table Header with Select All */}
        <div className="grid grid-cols-12 px-4 py-2.5 bg-slate-100/80 rounded-xl text-xs font-black text-slate-600 uppercase tracking-wider items-center">
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              checked={selectedIds.size === paginatedPatients.length && paginatedPatients.length > 0}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
              title="Select all on this page"
            />
          </div>
          <div className="col-span-4">Patient Name & Guardian</div>
          <div className="col-span-3">Contact & City</div>
          <div className="col-span-2 hidden md:block">Last Visit</div>
          <div className="col-span-2 text-right">Visits & Actions</div>
        </div>

        {patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-3xl border-2 border-dashed border-teal-200/80 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-700 flex items-center justify-center mb-4 shadow-inner">
              <span className="material-symbols-outlined text-4xl">person_search</span>
            </div>
            <h3 className="font-bold text-slate-800 text-base">No Patients Found in Database</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              {query ? `No matching records for "${query}". Try searching with a different name or phone.` : "Get started by registering your very first clinic patient."}
            </p>
            <button
              onClick={() => navigate("/reception/register")}
              className="mt-5 px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md shadow-teal-800/20 transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              <span>Register First Patient</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {paginatedPatients.map((patient) => {
              const meta = visitMetaMap.get(patient.id) || { lastVisit: null, totalVisits: 0 };
              const isSelected = selectedIds.has(patient.id);

              return (
                <div
                  key={patient.id}
                  onClick={() => navigate(`/patients/${patient.id}`)}
                  className={`grid grid-cols-12 items-center px-4 py-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-teal-50/80 border-teal-300 shadow-sm"
                      : "bg-white border-slate-200 hover:border-teal-300 hover:shadow-md"
                  }`}
                >
                  {/* Selection Checkbox */}
                  <div className="col-span-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleToggleSelect(patient.id, e)}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                  </div>

                  {/* Patient Name & Initials */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-100/80 text-teal-900 font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                      {getInitials(patient.full_name)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-sm text-slate-950 truncate">{patient.full_name}</h4>
                      <p className="text-xs text-slate-600 truncate">
                        {patient.relation_name ? `${patient.relation_type || "S/O"} ${patient.relation_name}` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Contact & Gender */}
                  <div className="col-span-3 text-xs text-slate-700">
                    <div className="font-bold text-slate-900">{patient.phone || "—"}</div>
                    <div className="text-[11px] text-slate-500 capitalize">{patient.gender || "—"} {patient.age ? `• ${patient.age} yrs` : ""}</div>
                  </div>

                  {/* Last Visit */}
                  <div className="col-span-2 hidden md:block text-xs font-semibold text-slate-700">
                    {meta.lastVisit ? formatDate(meta.lastVisit) : "—"}
                  </div>

                  {/* Total Visits & Individual Delete Action */}
                  <div className="col-span-2 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="font-black text-xs px-2.5 py-1 bg-teal-50 text-teal-900 border border-teal-100 rounded-xl">
                      {meta.totalVisits} visits
                    </span>
                    <button
                      onClick={(e) => handleSingleDelete(patient, e)}
                      title="Wipe out complete profile"
                      className="min-h-[36px] min-w-[36px] p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 shadow-sm text-xs text-gray-600">
            <div>
              Showing Page <span className="font-bold text-gray-900">{currentPage}</span> of <span className="font-bold text-gray-900">{totalPages}</span> ({patients.length} total patients)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 font-bold"
              >
                Previous
              </button>
              <span className="font-bold text-teal-800 px-2">Page {currentPage}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
