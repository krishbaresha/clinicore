import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { dbVisits, dbInventory } from "../api/db.js";
import { formatCurrency, formatTodayLong, getGreeting } from "../utils/formatters.js";

function StatCard({ label, value, icon, subline, iconBg, labelColor, valueColor, children }) {
  return (
    <div className="glass-card p-md flex flex-col gap-4 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-secondary-container/30 rounded-full blur-xl group-hover:bg-secondary-container/50 transition-colors" />
      <div className="flex justify-between items-start z-10">
        <div>
          <p className={`font-label-md text-label-md mb-1 uppercase tracking-wider ${labelColor || "text-outline"}`}>
            {label}
          </p>
          <h3 className={`font-display-lg text-display-lg font-bold ${valueColor || "text-on-surface"}`}>
            {value}
          </h3>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg || "bg-secondary-container/50"}`}>
          <span className="material-symbols-outlined text-2xl text-primary-container">{icon}</span>
        </div>
      </div>
      {subline && <div className="z-10 flex items-center gap-2 text-primary font-body-sm text-body-sm">{subline}</div>}
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Compute live stats from the mock DB
  const allVisits = dbVisits.getAll();
  const today = new Date().toDateString();
  const todayVisits = allVisits.filter((v) => new Date(v.visit_date).toDateString() === today);
  const feesToday = todayVisits.reduce((sum, v) => sum + (v.fee_amount || 0), 0);

  const allInventory = dbInventory.getAll();
  const lowStockItems = allInventory.filter((i) => i.stock_qty <= i.low_stock_threshold);

  const totalVisits = allVisits.length;
  const newPatientIds = new Set(allVisits.filter((v) => {
    const pVisits = allVisits.filter((x) => x.patient_id === v.patient_id);
    return pVisits.length === 1; // first ever visit = new patient
  }).map((v) => v.patient_id));
  const repeatRatio = totalVisits > 0
    ? Math.round(((totalVisits - newPatientIds.size) / totalVisits) * 100)
    : 0;
  const newRatio = 100 - repeatRatio;

  return (
    <div className="p-md md:p-lg flex flex-col gap-lg max-w-[calc(1440px-260px)]">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-4 md:mt-0">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">
            {getGreeting()}, {user?.name || "Doctor"}
          </h2>
          <p className="font-body-lg text-body-lg text-outline">{formatTodayLong()}</p>
        </div>
        <button
          id="dashboard-add-patient-btn"
          onClick={() => navigate("/patients/new")}
          className="btn-pill"
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          Add New Patient
        </button>
      </header>

      {/* Stats Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-md" aria-label="Key metrics">
        {/* Patients Today */}
        <StatCard
          label="Patients Today"
          value={todayVisits.length}
          icon="group"
          iconBg="bg-secondary-container/50"
          subline={
            <>
              <span className="material-symbols-outlined text-sm">calendar_today</span>
              {todayVisits.length === 0 ? "No visits yet today" : `${todayVisits.length} visit${todayVisits.length > 1 ? "s" : ""} recorded`}
            </>
          }
        />

        {/* Fees Collected Today */}
        <StatCard
          label="Fees Collected Today"
          value={formatCurrency(feesToday)}
          icon="payments"
          iconBg="bg-primary-container/10"
        />

        {/* New vs Repeat */}
        <div className="glass-card p-md flex flex-col justify-between gap-4 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
          <p className="font-label-md text-label-md text-outline mb-2 uppercase tracking-wider">New vs Repeat</p>
          <div>
            <div className="flex items-end gap-2 mb-1">
              <span className="font-headline-lg text-headline-lg font-bold text-primary">{newRatio}%</span>
              <span className="font-body-sm text-body-sm text-outline pb-1">New</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="font-headline-md text-headline-md font-semibold text-tertiary">{repeatRatio}%</span>
              <span className="font-body-sm text-body-sm text-outline pb-1">Repeat</span>
            </div>
          </div>
          <div className="flex w-full h-3 rounded-full overflow-hidden">
            <div className="bg-primary" style={{ width: `${newRatio}%` }} />
            <div className="bg-surface-variant" style={{ width: `${repeatRatio}%` }} />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="glass-card p-md flex flex-col gap-4 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300 border border-error-container/50 bg-error-container/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-label-md text-label-md text-error mb-1 uppercase tracking-wider">Low Stock Alerts</p>
              <h3 className="font-display-lg text-display-lg font-bold text-error">{lowStockItems.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {lowStockItems.slice(0, 2).map((item) => (
              <div key={item.id} className="flex items-center justify-between font-body-sm text-body-sm">
                <span className="text-on-surface">{item.medicine_name}</span>
                <span className="text-error font-semibold">{item.stock_qty} left</span>
              </div>
            ))}
            {lowStockItems.length === 0 && (
              <p className="font-body-sm text-body-sm text-outline">All stock levels OK</p>
            )}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="flex flex-wrap gap-4" aria-label="Quick actions">
        <button
          id="quick-add-patient"
          onClick={() => navigate("/patients/new")}
          className="glass-card px-6 py-4 flex items-center gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
        >
          <span className="material-symbols-outlined">person_add</span>
          <span className="font-label-md text-label-md font-bold">Add New Patient</span>
        </button>
        <button
          id="quick-register-patient"
          onClick={() => navigate("/reception/register")}
          className="glass-card px-6 py-4 flex items-center gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
        >
          <span className="material-symbols-outlined">how_to_reg</span>
          <span className="font-label-md text-label-md font-bold">Register Patient</span>
        </button>
        <button
          id="quick-view-reports"
          onClick={() => navigate("/fees")}
          className="glass-card px-6 py-4 flex items-center gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
        >
          <span className="material-symbols-outlined">assessment</span>
          <span className="font-label-md text-label-md font-bold">View Reports</span>
        </button>
      </section>
    </div>
  );
}
