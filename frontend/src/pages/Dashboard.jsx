import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { dbVisits, dbInventory, dbSales, dbExpenses, dbUsers } from "../api/db.js";
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

  const canViewFinancials = user?.is_owner || user?.can_view_financials || user?.role === "receptionist" || user?.role === "cashier" || user?.role === "pharmacist";

  // Compute live stats from the mock DB
  const allVisits = dbVisits.getAll();
  const today = new Date().toDateString();
  const todayVisits = allVisits.filter((v) => new Date(v.visit_date).toDateString() === today);
  const feesToday = todayVisits.reduce((sum, v) => sum + (v.fee_amount || 0), 0);

  // User-specific visits & fees (e.g. Dr. Fatima, Dr. Asif)
  const myTodayVisits = todayVisits.filter((v) => v.doctor_id === user?.userId || v.doctor_id === user?.id || (!v.doctor_id && user?.role === "doctor"));
  const myFeesToday = myTodayVisits.reduce((sum, v) => sum + (v.fee_amount || 0), 0);

  const allSales = dbSales.getAll();
  const todaySales = allSales.filter((s) => new Date(s.sale_date).toDateString() === today);
  const pharmacyRevenueToday = todaySales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  const allExpenses = dbExpenses.getAll();
  const todayExpenses = allExpenses.filter((e) => new Date(e.expense_date).toDateString() === today);
  const expensesToday = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const netRevenueToday = (feesToday + pharmacyRevenueToday) - expensesToday;

  // Doctor-by-Doctor OPD Revenue Breakdown (for Principal Owner View)
  const doctorAccounts = dbUsers.getAll().filter((u) => u.role === "doctor");
  const doctorBreakdown = doctorAccounts.map((doc) => {
    const docVisits = todayVisits.filter((v) => v.doctor_id === doc.id);
    const docFees = docVisits.reduce((sum, v) => sum + (v.fee_amount || 0), 0);
    return {
      ...doc,
      today_patient_count: docVisits.length,
      today_fees: docFees,
    };
  });

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

  const myWaitingVisits = myTodayVisits.filter((v) => v.status === "waiting");
  const myInRoomVisit = myTodayVisits.find((v) => v.status === "in_consultation");

  return (
    <div className="p-4 sm:p-6 md:p-8 flex flex-col gap-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">
            {getGreeting()}, {user?.name || "Doctor"}
          </h2>
          <p className="text-xs sm:text-sm text-outline mt-0.5">{formatTodayLong()}</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {user?.role === "doctor" ? (
            <>
              <button
                onClick={() => navigate("/doctor/queue")}
                className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-primary/20"
              >
                <span className="material-symbols-outlined text-base">queue</span>
                Open My OPD Queue
              </button>
              <button
                onClick={() => navigate("/patients")}
                className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">group</span>
                Patients &amp; EMR
              </button>
            </>
          ) : (
            <button
              id="dashboard-add-patient-btn"
              onClick={() => navigate("/reception/register")}
              className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-base">how_to_reg</span>
              Register Patient Token
            </button>
          )}
        </div>
      </header>

      {/* Stats Bento Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Key metrics">
        {/* Patients Today */}
        <StatCard
          label={canViewFinancials ? "Clinic Patients Today" : "My Patients Today"}
          value={canViewFinancials ? todayVisits.length : myTodayVisits.length}
          icon="group"
          iconBg="bg-secondary-container/50"
          subline={
            <>
              <span className="material-symbols-outlined text-sm">calendar_today</span>
              {canViewFinancials
                ? `${todayVisits.length} total OPD visit${todayVisits.length === 1 ? "" : "s"}`
                : `${myTodayVisits.length} visit${myTodayVisits.length === 1 ? "" : "s"} in my OPD chamber`}
            </>
          }
        />

        {/* Fees Collected Today */}
        <StatCard
          label={canViewFinancials ? "Total Fees Collected" : "My Fees Today"}
          value={formatCurrency(canViewFinancials ? feesToday : myFeesToday)}
          icon="payments"
          iconBg="bg-primary-container/10"
        />

        {/* Doctor-tailored 3rd Card: Waiting Queue or New vs Repeat */}
        {user?.role === "doctor" ? (
          <div className="glass-card p-4 sm:p-5 flex flex-col justify-between gap-3 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300 border border-teal-200/60 bg-teal-50/40">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-label-md text-label-md text-teal-800 mb-1 uppercase tracking-wider font-bold">
                  Waiting In Chamber Queue
                </p>
                <h3 className="text-3xl sm:text-4xl font-black text-teal-950">
                  {myWaitingVisits.length} <span className="text-sm font-semibold text-gray-500">Patients</span>
                </h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-700/20">
                <span className="material-symbols-outlined text-2xl">hourglass_top</span>
              </div>
            </div>

            <div className="pt-2 border-t border-teal-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-teal-800">
                {myInRoomVisit
                  ? `In Room: #${myInRoomVisit.token_number} (${myInRoomVisit.patient_name})`
                  : myWaitingVisits.length > 0
                  ? `Next: Token #${myWaitingVisits[0].token_number}`
                  : "Queue is Clear"}
              </span>
              <button
                onClick={() => navigate("/doctor/queue")}
                className="text-xs font-extrabold text-teal-700 hover:text-teal-900 underline flex items-center gap-0.5"
              >
                Call Next →
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card p-4 sm:p-5 flex flex-col justify-between gap-3 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
            <p className="font-label-md text-label-md text-outline mb-1 uppercase tracking-wider">New vs Repeat</p>
            <div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-2xl font-black text-primary">{newRatio}%</span>
                <span className="text-xs text-outline pb-0.5">New</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-lg font-bold text-tertiary">{repeatRatio}%</span>
                <span className="text-xs text-outline pb-0.5">Repeat</span>
              </div>
            </div>
            <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-100">
              <div className="bg-primary" style={{ width: `${newRatio}%` }} />
              <div className="bg-surface-variant" style={{ width: `${repeatRatio}%` }} />
            </div>
          </div>
        )}

        {/* 4th Card: New vs Repeat (for Doctor) OR Low Stock (for Staff) */}
        {user?.role === "doctor" ? (
          <div className="glass-card p-4 sm:p-5 flex flex-col justify-between gap-3 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
            <p className="font-label-md text-label-md text-outline mb-1 uppercase tracking-wider">New vs Repeat</p>
            <div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-2xl font-black text-primary">{newRatio}%</span>
                <span className="text-xs text-outline pb-0.5">New Patients</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-lg font-bold text-tertiary">{repeatRatio}%</span>
                <span className="text-xs text-outline pb-0.5">Repeat</span>
              </div>
            </div>
            <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-100">
              <div className="bg-primary" style={{ width: `${newRatio}%` }} />
              <div className="bg-surface-variant" style={{ width: `${repeatRatio}%` }} />
            </div>
          </div>
        ) : (
          <div className="glass-card p-4 sm:p-5 flex flex-col gap-3 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300 border border-error-container/50 bg-error-container/10">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-label-md text-label-md text-error mb-1 uppercase tracking-wider">Low Stock Alerts</p>
                <h3 className="text-3xl font-black text-error">{lowStockItems.length}</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-error-container flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {lowStockItems.slice(0, 2).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="text-on-surface truncate max-w-[120px]">{item.medicine_name}</span>
                  <span className="text-error font-semibold">{item.stock_qty} left</span>
                </div>
              ))}
              {lowStockItems.length === 0 && (
                <p className="text-xs text-outline">All stock levels OK</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Executive Financial Revenue Breakdown — Available for Staff and Owner */}
      {canViewFinancials ? (
        <section className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-teal-700/50 space-y-4">
          <div className="flex items-center justify-between border-b border-teal-700/60 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-amber-400 text-2xl">account_balance_wallet</span>
              <div>
                <h3 className="font-bold text-lg leading-tight">Clinic Financial Revenue Breakdown</h3>
                <p className="text-xs text-teal-200">Real-time daily earnings summary for Principal Doctor &amp; Owner</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/fees")}
              className="text-xs font-bold bg-teal-600/80 hover:bg-teal-500 text-white px-3.5 py-2 rounded-xl transition-colors border border-teal-400/40 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">analytics</span>
              View Ledger Analytics →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-xs text-teal-200 font-semibold uppercase tracking-wider mb-1">OPD Doctor Fees</div>
              <div className="text-2xl font-black text-emerald-300">Rs. {feesToday.toLocaleString()}</div>
              <div className="text-[11px] text-teal-200/80 mt-1">From {todayVisits.length} consultation tokens</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-xs text-teal-200 font-semibold uppercase tracking-wider mb-1">Pharmacy Store Sales</div>
              <div className="text-2xl font-black text-cyan-300">Rs. {pharmacyRevenueToday.toLocaleString()}</div>
              <div className="text-[11px] text-teal-200/80 mt-1">From {todaySales.length} store sales receipts</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-xs text-teal-200 font-semibold uppercase tracking-wider mb-1">Daily Expenses</div>
              <div className="text-2xl font-black text-rose-300">Rs. {expensesToday.toLocaleString()}</div>
              <div className="text-[11px] text-teal-200/80 mt-1">From {todayExpenses.length} expense vouchers</div>
            </div>

            <div className="bg-amber-500/20 backdrop-blur-md rounded-2xl p-4 border border-amber-400/40">
              <div className="text-xs text-amber-200 font-bold uppercase tracking-wider mb-1">Net Overall Revenue</div>
              <div className="text-2xl font-black text-amber-300">Rs. {netRevenueToday.toLocaleString()}</div>
              <div className="text-[11px] text-amber-100/90 font-medium mt-1">Fees + Store Sales - Expenses</div>
            </div>
          </div>

          {/* Doctor-by-Doctor OPD Revenue Breakdown Table */}
          <div className="border-t border-teal-700/60 pt-4 mt-2">
            <h4 className="text-xs font-bold text-teal-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-amber-400">stethoscope</span>
              Today&apos;s Doctor-by-Doctor OPD Revenue Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {doctorBreakdown.map((doc) => (
                <div key={doc.id} className="bg-white/10 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                      <span className="material-symbols-outlined text-xs text-teal-300">person</span>
                      <span>{doc.name}</span>
                      {doc.is_owner && <span className="text-[9px] bg-amber-400 text-teal-950 font-black px-1.5 py-0.2 rounded shrink-0">OWNER</span>}
                    </div>
                    <div className="text-[11px] text-teal-200 truncate">{doc.specialization || "General Physician"}</div>
                    <div className="text-[10px] text-teal-300/80 mt-0.5">{doc.today_patient_count} Patients Today</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-amber-300">Rs. {doc.today_fees.toLocaleString()}</div>
                    <div className="text-[9px] text-teal-200 uppercase">OPD Collection</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-teal-100 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600">stethoscope</span>
              <h3 className="font-bold text-gray-900 text-base">My OPD Consultation Portal</h3>
            </div>
            <button
              onClick={() => navigate("/doctor/queue")}
              className="text-xs font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 px-3 py-1.5 rounded-xl border border-teal-200 transition-colors"
            >
              Open My OPD Queue →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100">
              <div className="text-xs text-teal-700 font-bold uppercase mb-1">My Patients Today</div>
              <div className="text-3xl font-black text-teal-900">
                {todayVisits.filter((v) => !v.doctor_id || v.doctor_id === user?.id).length}
              </div>
              <div className="text-xs text-gray-500 mt-1">Waiting &amp; Completed in my chamber</div>
            </div>
            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
              <div className="text-xs text-emerald-700 font-bold uppercase mb-1">My Consultation Fees Today</div>
              <div className="text-3xl font-black text-emerald-900">
                Rs. {todayVisits.filter((v) => !v.doctor_id || v.doctor_id === user?.id).reduce((s, v) => s + (v.fee_amount || 0), 0).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">Direct OPD Consultation collection</div>
            </div>
          </div>
        </section>
      )}

      {/* Quick Actions (Role Tailored) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4" aria-label="Quick actions">
        {user?.role === "doctor" ? (
          <>
            <button
              onClick={() => navigate("/doctor/queue")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">queue</span>
              <span className="font-label-md text-label-md font-bold">My OPD Queue</span>
            </button>
            <button
              onClick={() => navigate("/patients")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">group</span>
              <span className="font-label-md text-label-md font-bold">Patients &amp; EMR Records</span>
            </button>
            <button
              onClick={() => navigate("/fees")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">payments</span>
              <span className="font-label-md text-label-md font-bold">Fees &amp; Revenue Analytics</span>
            </button>
          </>
        ) : (
          <>
            <button
              id="quick-register-patient"
              onClick={() => navigate("/reception/register")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">how_to_reg</span>
              <span className="font-label-md text-label-md font-bold">Register Patient Token</span>
            </button>
            <button
              onClick={() => navigate("/store/pos")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">point_of_sale</span>
              <span className="font-label-md text-label-md font-bold">POS Store &amp; Pharmacy</span>
            </button>
            <button
              id="quick-view-reports"
              onClick={() => navigate("/fees")}
              className="glass-card px-5 py-4 flex items-center justify-center sm:justify-start gap-3 hover:bg-white/90 transition-colors active:scale-95 text-primary"
            >
              <span className="material-symbols-outlined">assessment</span>
              <span className="font-label-md text-label-md font-bold">Daily Cash &amp; Reports</span>
            </button>
          </>
        )}
      </section>
    </div>
  );
}
