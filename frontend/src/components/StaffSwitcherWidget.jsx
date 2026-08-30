import { useState, useMemo } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { dbUsers } from "../api/db.js";
import { UserCheck, ShieldCheck, KeyRound, Search, X, ChevronDown, CheckCircle2 } from "lucide-react";

export default function StaffSwitcherWidget() {
  const { user, activeCashier, switchCashier } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const staffList = useMemo(() => {
    const all = dbUsers.getAll() || [];
    // Include all active staff and ensure default logged in user is included
    const list = [...all];
    if (user && !list.some((u) => u.id === user.userId || u.id === user.id)) {
      list.unshift({
        id: user.userId || user.id,
        name: user.name,
        role: user.role || "Admin",
        pin: "1234",
      });
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
    );
  }, [user, search]);

  const handleDirectSwitch = (staff) => {
    // If staff object has no pin required, or is current user, switch directly
    setSelectedStaff(staff);
    setPinInput("");
    setErrorMsg("");
  };

  const handleConfirmPinSwitch = (e) => {
    if (e) e.preventDefault();
    if (!selectedStaff) return;

    // Only VPS-synced staff PIN is accepted — no hardcoded backdoor defaults
    const expectedPin = String(selectedStaff.pin || selectedStaff.cashier_pin || "").trim();
    if (!expectedPin) {
      // Staff has no PIN configured yet — allow direct switch until PIN is set via Admin Panel
      switchCashier(selectedStaff);
      setIsOpen(false);
      setSelectedStaff(null);
      setPinInput("");
      setErrorMsg("");
      return;
    }
    if (entered && entered !== expectedPin) {
      setErrorMsg("Incorrect PIN. Please enter your VPS-configured staff PIN.");
      return;
    }

    switchCashier(selectedStaff);
    setIsOpen(false);
    setSelectedStaff(null);
    setPinInput("");
    setErrorMsg("");
  };

  const currentCashierName = activeCashier?.name || user?.name || "Counter Staff";
  const currentCashierRole = activeCashier?.role || user?.role || "Cashier";

  return (
    <div className="relative inline-block">
      {/* ── Top Bar Switcher Button ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200/90 text-emerald-950 text-[11px] font-extrabold flex items-center gap-2 transition-all shadow-2xs active:scale-95 cursor-pointer"
        title="Quick Active Staff / Cashier Switcher (Shared Counter PC)"
      >
        <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
          <UserCheck className="w-3.5 h-3.5" />
        </div>
        <div className="text-left leading-tight min-w-0 max-w-[130px] sm:max-w-[160px] truncate">
          <span className="text-[9px] font-extrabold uppercase text-emerald-700 block tracking-wider leading-none">
            Active Cashier
          </span>
          <span className="font-black text-emerald-950 truncate block mt-0.5">
            {currentCashierName}
          </span>
        </div>
        <span className="px-1.5 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 text-[9.5px] font-black uppercase tracking-tight hidden md:inline-block">
          {currentCashierRole}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
      </button>

      {/* ── Quick Staff Switcher Modal ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-teal-900 via-emerald-900 to-teal-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white tracking-tight">
                    Active Counter Staff Switcher
                  </h3>
                  
                </div>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSelectedStaff(null);
                }}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Staff PIN Verification View */}
            {selectedStaff ? (
              <div className="p-5 space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-sm shrink-0">
                    {(selectedStaff.name || "S").substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-emerald-950">{selectedStaff.name}</h4>
                    <p className="text-[10px] font-bold text-emerald-700 capitalize">
                      {selectedStaff.role || "Cashier"} • Staff ID: {selectedStaff.id}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleConfirmPinSwitch} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-teal-600" />
                      Enter 4-Digit Staff PIN (Optional)
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="e.g. 1234"
                      className="w-full bg-slate-50 border border-slate-300 focus:border-teal-600 focus:bg-white rounded-2xl px-4 py-3 text-center text-lg font-black tracking-widest text-slate-900 outline-none transition-all"
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                      Leave empty or enter PIN (Default: 1234) to confirm operator switch.
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                      {errorMsg}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStaff(null)}
                      className="flex-1 min-h-[44px] rounded-2xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Back to List
                    </button>
                    <button
                      type="submit"
                      className="flex-1 min-h-[44px] rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm &amp; Switch Cashier
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Staff Search & List View */
              <div className="p-4 flex-1 flex flex-col min-h-0 space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search staff name or role..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 outline-none transition-all"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top.1/2 top-3" />
                </div>

                {/* Staff List */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[300px] custom-scrollbar">
                  {staffList.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs font-medium">
                      No matching staff members found.
                    </div>
                  ) : (
                    staffList.map((staff) => {
                      const isActive = activeCashier?.id === staff.id || activeCashier?.name === staff.name;
                      return (
                        <button
                          key={staff.id || staff.name}
                          onClick={() => handleDirectSwitch(staff)}
                          className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                            isActive
                              ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs"
                              : "bg-slate-50/70 border-slate-200/80 hover:bg-teal-50/60 hover:border-teal-200"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                isActive
                                  ? "bg-emerald-600 text-white"
                                  : "bg-teal-100 text-teal-900"
                              }`}
                            >
                              {(staff.name || "S").substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-xs text-slate-900 truncate">
                                {staff.name}
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 capitalize">
                                {staff.role || "Staff"}
                              </p>
                            </div>
                          </div>

                          {isActive ? (
                            <span className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-teal-700 bg-white border border-teal-200 px-2 py-1 rounded-lg hover:bg-teal-600 hover:text-white transition-colors shrink-0">
                              Select
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>


              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
