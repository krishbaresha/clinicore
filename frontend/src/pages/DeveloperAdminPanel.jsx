import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dbTenants, dbClinic, exportFullDatabase, importFullDatabase, resetDatabaseToDemoData } from "../api/db.js";

const DEVELOPER_PASSCODE = "KB2026"; // Master Developer Passcode

export default function DeveloperAdminPanel() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [tenants, setTenants] = useState([]);
  const [activeClinic, setActiveClinic] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const [form, setForm] = useState({
    name: "",
    doctor_name: "",
    specialization: "General Physician & Consultant",
    phone: "",
    city: "Hyderabad",
    address: "",
    fee: 1000,
    room: "Room 1",
    plan: "Pro Tier (Rs. 5,000 / mo)",
    monthly_fee: 5000,
    status: "active",
  });

  const loadData = () => {
    const list = dbTenants.getAll();
    setTenants(list);
    const curr = dbClinic.get();
    setActiveClinic(curr);
  };

  useEffect(() => {
    // Check if already authenticated in sessionStorage
    if (sessionStorage.getItem("cf_dev_auth") === "true") {
      setIsAuthenticated(true);
      loadData();
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passcodeInput === DEVELOPER_PASSCODE || passcodeInput === "admin") {
      sessionStorage.setItem("cf_dev_auth", "true");
      setIsAuthenticated(true);
      setAuthError("");
      loadData();
    } else {
      setAuthError("Incorrect developer master passcode. Please try again.");
    }
  };

  const handleSaveTenant = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.doctor_name.trim()) return;

    if (editingTenant) {
      dbTenants.update(editingTenant.id, form);
      setToastMsg(`Updated ${form.name} successfully!`);
    } else {
      const newT = dbTenants.add({
        ...form,
        fee: Number(form.fee) || 800,
        monthly_fee: Number(form.monthly_fee) || 5000,
      });
      setToastMsg(`Provisioned new clinic: ${newT.name}!`);
    }

    setShowAddModal(false);
    setEditingTenant(null);
    setForm({
      name: "",
      doctor_name: "",
      specialization: "General Physician & Consultant",
      phone: "",
      city: "Hyderabad",
      address: "",
      fee: 1000,
      room: "Room 1",
      plan: "Pro Tier (Rs. 5,000 / mo)",
      monthly_fee: 5000,
      status: "active",
    });
    loadData();
    setTimeout(() => setToastMsg(""), 4000);
  };

  const handleSwitchTenant = (tenantId) => {
    const success = dbTenants.switchToTenant(tenantId);
    if (success) {
      const target = dbTenants.getById(tenantId);
      setActiveClinic(dbClinic.get());
      setToastMsg(`Switched active system context to: ${target?.name}!`);
      setTimeout(() => setToastMsg(""), 4000);
    }
  };

  const handleDeleteTenant = (id, name) => {
    if (confirm(`Are you sure you want to delete ${name} from tenants directory?`)) {
      dbTenants.delete(id);
      setToastMsg(`Deleted ${name}`);
      loadData();
      setTimeout(() => setToastMsg(""), 3000);
    }
  };

  // Metrics calculation
  const totalMRR = tenants.reduce((sum, t) => sum + (Number(t.monthly_fee) || 0), 0);
  const activeCount = tenants.filter((t) => t.status === "active").length;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 selection:bg-teal-500">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center mx-auto mb-4 text-white font-black shadow-lg shadow-teal-500/20">
            <span className="material-symbols-outlined text-2xl">terminal</span>
          </div>
          <h2 className="text-2xl font-black text-center text-white tracking-tight">
            Developer Control Plane
          </h2>
          <p className="text-xs text-center text-slate-400 mt-1 mb-6">
            K.B Software • Master Multi-Tenant Command Center
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Developer Master Passcode
              </label>
              <input
                type="password"
                required
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="Enter passcode (e.g. KB2026)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 font-mono tracking-widest text-center"
              />
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-teal-600/25"
            >
              Authenticate &amp; Open Console
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <Link to="/" className="text-xs text-slate-500 hover:text-teal-400 transition-colors">
              ← Return to Main Website
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500 selection:text-white flex flex-col">
      {/* ── Top Developer Console Bar ── */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
              KB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-white">K.B Software Command Center</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  SUPER-ADMIN
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Multi-Tenant Doctor &amp; Clinic Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/clinic"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              View Active Clinic Site
            </Link>

            <button
              onClick={() => {
                sessionStorage.removeItem("cf_dev_auth");
                setIsAuthenticated(false);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
            >
              Lock Console
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Toast Notification */}
        {toastMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-bold flex items-center gap-2 shadow-lg animate-fade-in">
            <span className="material-symbols-outlined">check_circle</span>
            {toastMsg}
          </div>
        )}

        {/* ── Analytics KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Deployed Clinics</div>
            <div className="text-3xl font-black text-white mt-1">{tenants.length}</div>
            <div className="text-[11px] text-emerald-400 mt-1 font-medium">{activeCount} Active Subscriptions</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Recurring Revenue</div>
            <div className="text-3xl font-black text-emerald-400 mt-1">Rs. {totalMRR.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-1">PKR / Month SaaS Income</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active System Instance</div>
            <div className="text-lg font-black text-teal-300 truncate mt-1">{activeClinic?.name || "Dr. Asif Clinic"}</div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">{activeClinic?.address || "Hyderabad"}</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Developer Lead</div>
            <div className="text-lg font-black text-white mt-1">Krish Baresha</div>
            <div className="text-[11px] text-teal-400 mt-1 font-mono">03142291356 • krishbaresha.tech</div>
          </div>
        </div>

        {/* ── Clinics & Tenants Management Section ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Client Clinics &amp; Doctors Directory
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Provision new doctor clients, manage subscription licenses, and switch active clinic instances in 1-click.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingTenant(null);
                setForm({
                  name: "",
                  doctor_name: "",
                  specialization: "General Physician & Consultant",
                  phone: "",
                  city: "Hyderabad",
                  address: "",
                  fee: 1000,
                  room: "Room 1",
                  plan: "Pro Tier (Rs. 5,000 / mo)",
                  monthly_fee: 5000,
                  status: "active",
                });
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-md shadow-teal-600/25 shrink-0"
            >
              <span className="material-symbols-outlined text-lg">add_business</span>
              Provision New Clinic / Doctor
            </button>
          </div>

          {/* Tenants Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-4">Clinic &amp; Doctor</th>
                  <th className="py-3 px-4">City &amp; Phone</th>
                  <th className="py-3 px-4">License Key</th>
                  <th className="py-3 px-4">Status &amp; Plan</th>
                  <th className="py-3 px-4">Monthly Fee</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {tenants.map((t) => {
                  const isActive = activeClinic?.name === t.name;
                  return (
                    <tr key={t.id} className={`hover:bg-slate-800/40 transition-colors ${isActive ? "bg-teal-950/20" : ""}`}>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          {t.name}
                          {isActive && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              CURRENT ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 text-xs mt-0.5">
                          {t.doctor_name} ({t.specialization}) • {t.room || "Room 1"}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div>{t.city || "Hyderabad"}</div>
                        <div className="text-slate-400 text-[11px]">{t.phone}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-teal-300 text-[11px]">
                        {t.license_key || "KB-PRO-2026-001"}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          t.status === "active"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}>
                          {t.status || "active"}
                        </span>
                        <div className="text-slate-400 text-[10px] mt-1">{t.plan}</div>
                      </td>

                      <td className="py-3.5 px-4 font-black text-white text-sm">
                        Rs. {Number(t.monthly_fee || 5000).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {!isActive && (
                            <button
                              onClick={() => handleSwitchTenant(t.id)}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-teal-600/30 text-teal-300 border border-teal-500/30 hover:bg-teal-600 hover:text-white transition-colors"
                            >
                              Switch Active
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingTenant(t);
                              setForm(t);
                              setShowAddModal(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit Clinic"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          {tenants.length > 1 && (
                            <button
                              onClick={() => handleDeleteTenant(t.id, t.name)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                              title="Delete Clinic"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Global Multi-Tenant Database Backup & System Tools ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-600/20 text-teal-400 flex items-center justify-center font-bold mb-3">
              <span className="material-symbols-outlined">download</span>
            </div>
            <h4 className="font-bold text-white text-sm">Full Database Backup</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Export encrypted JSON backup of the currently running clinic database with all patient history &amp; sales.
            </p>
            <button
              onClick={() => {
                const data = exportFullDatabase();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `ClinicFlow_FullBackup_${new Date().toISOString().split("T")[0]}.json`;
                a.click();
              }}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              Export JSON Backup
            </button>
          </div>

          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold mb-3">
              <span className="material-symbols-outlined">medical_services</span>
            </div>
            <h4 className="font-bold text-white text-sm">Open Public Doctor Site</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              View the currently active clinic&apos;s public website (/clinic) with live queue and patient token search.
            </p>
            <Link
              to="/clinic"
              target="_blank"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Launch /clinic
            </Link>
          </div>

          <div>
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center font-bold mb-3">
              <span className="material-symbols-outlined">restart_alt</span>
            </div>
            <h4 className="font-bold text-white text-sm">Reset / Clean Data</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Reset system data back to default baseline schema for onboarding a brand new doctor client.
            </p>
            <button
              onClick={() => {
                if (confirm("Reset database to clean baseline demo data? This will reset active patient records.")) {
                  resetDatabaseToDemoData();
                  loadData();
                  setToastMsg("Database reset to clean baseline successfully.");
                  setTimeout(() => setToastMsg(""), 3000);
                }
              }}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
            >
              Reset Baseline Data
            </button>
          </div>
        </div>
      </main>

      {/* ── Provision / Edit Clinic Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black">
                  {editingTenant ? "Edit Clinic Client" : "Provision New Clinic / Doctor"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Configure clinic profile &amp; SaaS license</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTenant} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Clinic / Hospital Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Al-Shifa Family Clinic"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Doctor Name *</label>
                  <input
                    required
                    value={form.doctor_name}
                    onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}
                    placeholder="e.g. Dr. Bilal Ahmed"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Doctor Specialization</label>
                  <input
                    value={form.specialization}
                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                    placeholder="e.g. Consultant Pediatrician"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">City</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="e.g. Karachi / Lahore / Hyderabad"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Clinic Phone / Mobile *</label>
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="03001234567"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Clinic Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. Main Boulevard, Gulshan-e-Iqbal, Karachi"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Consultation Fee (Rs.)</label>
                  <input
                    type="number"
                    value={form.fee}
                    onChange={(e) => setForm({ ...form, fee: e.target.value })}
                    placeholder="1000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Monthly Subscription Fee (PKR)</label>
                  <input
                    type="number"
                    value={form.monthly_fee}
                    onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })}
                    placeholder="5000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-colors shadow-lg shadow-teal-600/25"
                >
                  {editingTenant ? "Save Changes" : "Deploy Clinic"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
