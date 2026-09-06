import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { dbUsers, dbClinic } from "../api/db.js";
import { getEffectiveVersion, setEffectiveVersion, compareSemver } from "../utils/version.js";
import clinicLogo from "../assets/clinic-logo.png";
import drAsif from "../assets/dr-asif.jpg";

export default function LoginScreen() {
  const navigate = useNavigate();
  const { loginWithPin } = useAuth();
  const [view, setView] = useState("PORTALS"); // "PORTALS" | "STAFF_SELECT" | "PIN_ENTRY"
  const [selectedPortal, setSelectedPortal] = useState(""); // "clinic" | "doctor" | "warehouse"
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [clinicData, setClinicData] = useState(null);
  const [search, setSearch] = useState("");
  const [liveAppVersion, setLiveAppVersion] = useState(() => {
    return getEffectiveVersion();
  });

  useEffect(() => {
    setClinicData(dbClinic.get() || {});

    // Query live version dynamically
    const fetchLiveVersion = async () => {
      try {
        const vpsApiUrl =
          (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
          (typeof window !== "undefined" && window.location.origin && !window.location.hostname.includes("localhost")
            ? window.location.origin
            : typeof window !== "undefined" && window.location.hostname === "localhost"
            ? "http://127.0.0.1:5000"
            : "https://clinicore.me");
        const endpoints = [`/version.json?_t=${Date.now()}`, `${vpsApiUrl}/api/v1/system/version?_t=${Date.now()}`];
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep, { cache: "no-store" });
            if (res.ok) {
              const data = await res.json();
              const v = data?.version || data?.data?.version;
              if (v && compareSemver(v, getEffectiveVersion()) > 0) {
                setLiveAppVersion(v);
                setEffectiveVersion(v);
                break;
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
    };

    fetchLiveVersion();
  }, []);

  // Handle physical keyboard input for the PIN pad
  useEffect(() => {
    if (view !== "PIN_ENTRY") return;
    
    const handleKeyDown = (e) => {
      // 0-9 keys
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Enter") {
        handlePinSubmit();
      } else if (e.key === "Escape") {
        setView("STAFF_SELECT");
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, pinInput, selectedStaff]);

  const PORTAL_METRICS = {
    clinic: {
      title: "Clinic OPD & POS Counter",
      icon: "storefront",
      color: "from-teal-700 to-teal-600",
      description: "OPD tokens, receipts & sales.",
      roles: ["cashier", "receptionist", "pharmacist", "manager", "owner", "admin"]
    },
    doctor: {
      title: "Doctor consultation desk",
      icon: "stethoscope",
      color: "from-emerald-700 to-emerald-600",
      description: "Prescriptions & diagnoses.",
      roles: ["doctor", "owner", "admin"]
    }
  };

  const usersList = useMemo(() => {
    const all = dbUsers.getAll() || [];
    if (!selectedPortal) return [];
    
    // Filter users based on portal access roles
    const targetRoles = PORTAL_METRICS[selectedPortal]?.roles || [];
    const filtered = all.filter((u) => targetRoles.includes(u.role));
    
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(u => u.name.toLowerCase().includes(q));
  }, [selectedPortal, search]);

  const handlePortalSelect = (portal) => {
    setSelectedPortal(portal);
    setSearch("");
    setView("STAFF_SELECT");
    setError("");
  };

  const handleStaffSelect = (staff) => {
    setSelectedStaff(staff);
    setPinInput("");
    setView("PIN_ENTRY");
    setError("");
  };

  const handleKeyPress = (num) => {
    setError("");
    setPinInput(pinInput + num);
  };

  const handleBackspace = () => {
    if (pinInput.length > 0) {
      setPinInput(pinInput.slice(0, -1));
    }
  };

  const handlePinSubmit = async () => {
    if (!pinInput) {
      setError("Please enter your login PIN.");
      return;
    }
    setLoading(true);
    try {
      const res = await loginWithPin(selectedStaff.id, pinInput);
      if (res.success) {
        // Direct doctor to Doctor Queue and other roles to their default portal
        if (res.user?.role === "doctor") {
          navigate("/doctor/queue");
        } else {
          navigate("/dashboard");
        }
      } else {
        setError(res.error?.message || "Incorrect PIN.");
        setPinInput("");
      }
    } catch (e) {
      setError("Login error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen max-h-screen w-screen bg-slate-50 flex font-sans overflow-hidden select-none">
      {/* Left side: Owner Profile Banner Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-teal-950 items-center justify-center p-12 overflow-hidden">
        {/* Large, clear picture of Dr. Asif (Owner) with high visibility */}
        <img
          src={drAsif}
          alt="H/Dr. Asif Ashraf Clinic Owner"
          className="absolute inset-0 w-full h-full object-cover opacity-80 filter brightness-95 contrast-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-teal-950 via-teal-950/40 to-transparent" />
        
        <div className="relative z-10 text-left max-w-lg mt-auto bg-teal-950/80 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-5 mb-4">
            <img
              src={clinicLogo}
              alt="H/Dr. Asif Clinic Logo"
              className="w-20 h-20 object-contain rounded-2xl"
            />
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-none">H/Dr. Asif</h1>
              <p className="text-xs text-teal-300 font-black uppercase tracking-widest mt-1.5 font-mono">Ashraf Khan Clinic</p>
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight leading-tight mb-2">
            Clinical &amp; Wholesale Engine
          </h2>
          <p className="text-xs text-teal-200/80 font-medium leading-relaxed">
            Workspace Station Terminal Login.
          </p>
        </div>
      </div>

      {/* Right side: Login Module */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-4 sm:p-6 lg:p-8 bg-white relative h-full overflow-y-auto custom-scrollbar">
        <header className="flex items-center justify-between w-full flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Transparent float logo container */}
            <div className="p-0.5">
              <img
                src={clinicLogo}
                alt="Clinic Logo"
                className="w-14 h-14 object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-teal-950 leading-none">H/Dr. Asif Ashraf Clinic</h1>
              <p className="text-[10px] text-teal-700 font-black uppercase tracking-wider mt-0.5">Clinical OS</p>
            </div>
          </div>
        </header>

        {/* ── STAGE A: PORTAL CHOICES ── */}
        {view === "PORTALS" && (
          <main className="w-full max-w-lg mx-auto my-auto py-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-teal-950 tracking-tight">Select Work Station</h2>
              <p className="text-xs text-slate-500 mt-1.5"></p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-md mx-auto">
              {Object.entries(PORTAL_METRICS).map(([key, data]) => (
                <button
                  key={key}
                  onClick={() => handlePortalSelect(key)}
                  className="bg-white border-2 border-slate-100 hover:border-teal-600/80 rounded-3xl p-6 text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between h-52 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors shadow-xs">
                    <span className="material-symbols-outlined text-3xl">{data.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 group-hover:text-teal-950 capitalize">{key === "clinic" ? "OPD & Counter POS" : data.title}</h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{data.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center">
              <button
                onClick={() => navigate("/admin")}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 font-extrabold text-xs text-slate-700 transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                <span>Super Admin Portal</span>
              </button>
            </div>
          </main>
        )}

        {/* ── STAGE B: STAFF DIRECTORY SELECTION ── */}
        {view === "STAFF_SELECT" && (
          <main className="w-full max-w-md mx-auto my-auto py-4">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setView("PORTALS")}
                className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div>
                <h2 className="text-xl font-black text-teal-950 tracking-tight leading-none">
                  {PORTAL_METRICS[selectedPortal]?.title}
                </h2>
                <p className="text-[10px] text-teal-600 font-extrabold uppercase mt-1">Select your profile</p>
              </div>
            </div>

            <div className="mb-4 relative">
              <input
                type="text"
                placeholder="Search staff name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-teal-950 transition-all outline-none"
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[38vh] pr-1 custom-scrollbar">
              {usersList.length > 0 ? (
                usersList.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleStaffSelect(u)}
                    className="w-full bg-white border border-slate-200 hover:border-teal-600/80 rounded-2xl p-3.5 flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-100 text-teal-800 flex items-center justify-center font-black text-sm uppercase">
                        {u.name.slice(0,2)}
                      </div>
                      <div className="text-left">
                        <h3 className="font-extrabold text-sm text-slate-900 leading-none">{u.name}</h3>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase mt-1.5 tracking-wider border border-slate-200/50">
                          {u.role === "cashier" ? "POS Counter & Cashier" : u.role === "warehouse_incharge" ? "Warehouse Manager" : u.role}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-teal-600">arrow_forward_ios</span>
                  </button>
                ))
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-3xl text-slate-300">account_box</span>
                  <p className="text-xs text-slate-500 mt-2 font-bold">No active profiles assigned</p>
                  <button
                    onClick={() => navigate("/admin")}
                    className="mt-3 text-xs font-black text-teal-700 hover:underline"
                  >
                    Open Admin panel to register staff
                  </button>
                </div>
              )}
            </div>
          </main>
        )}

        {/* ── STAGE C: SECURE PIN KEYPAD ── */}
        {view === "PIN_ENTRY" && (
          <main className="w-full max-w-xs mx-auto my-auto py-2">
            <div className="text-center mb-2">
              <button
                onClick={() => setView("STAFF_SELECT")}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold transition-all cursor-pointer mb-2"
              >
                <span className="material-symbols-outlined text-xs">arrow_back</span>
                <span>Change User</span>
              </button>
              
              <div className="relative w-12 h-12 mx-auto mb-1.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-teal-800 flex items-center justify-center font-black text-lg uppercase">
                  {selectedStaff?.name.slice(0, 2)}
                </div>
              </div>
              
              <h3 className="font-extrabold text-sm text-slate-900 leading-none">{selectedStaff?.name}</h3>
              <p className="text-[10px] text-teal-700 font-bold uppercase tracking-wider mt-0.5">
                {selectedStaff?.role === "cashier" ? "POS Counter & Cashier" : selectedStaff?.role === "warehouse_incharge" ? "Warehouse Manager" : selectedStaff?.role}
              </p>
            </div>

            {/* PIN Bubble Displays */}
            <div className="flex items-center justify-center gap-2 mb-2 h-5">
              {pinInput.split("").map((char, idx) => (
                <div key={idx} className="w-3 h-3 rounded-full bg-teal-600 scale-110 shadow-xs" />
              ))}
              {pinInput.length === 0 && <span className="text-[11px] text-slate-400 font-semibold tracking-wider">Enter login PIN</span>}
            </div>

            {error && (
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold text-center mb-2">
                {error}
              </div>
            )}

            {/* Keypad Layout */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num.toString())}
                  className="w-13 h-13 sm:w-14 sm:h-14 rounded-full border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 font-bold text-lg text-slate-900 transition-all cursor-pointer mx-auto flex items-center justify-center shadow-2xs"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => { setPinInput(""); setError(""); }}
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 font-bold text-xs text-rose-600 transition-all cursor-pointer mx-auto flex items-center justify-center"
              >
                Clear
              </button>
              <button
                onClick={() => handleKeyPress("0")}
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 font-bold text-lg text-slate-900 transition-all cursor-pointer mx-auto flex items-center justify-center shadow-2xs"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-600 transition-all cursor-pointer mx-auto flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-xl">backspace</span>
              </button>
            </div>

            {/* Large Submit Button */}
            <button
              onClick={handlePinSubmit}
              disabled={loading || !pinInput}
              className="w-full min-h-[42px] bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-extrabold py-2.5 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md shadow-teal-700/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {loading ? "Unlocking..." : "Unlock Terminal"}
              {!loading && <span className="material-symbols-outlined text-base">lock_open</span>}
            </button>
          </main>
        )}

        <footer className="w-full text-center py-2 text-[11px] text-slate-400 font-semibold border-t border-slate-100 flex items-center justify-between mt-2 flex-shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            <span className="text-slate-600 font-bold">CliniCore v{liveAppVersion}</span>
            <span className="text-[10px] text-slate-400 font-mono">({(typeof globalThis !== "undefined" && globalThis.__APP_BUILD_ID__) || "20260830"})</span>
          </span>
          <span className="text-teal-700 font-semibold">
            Developer: Krish Baresha Softwares | 03142291356
          </span>
        </footer>
      </div>
    </div>
  );
}
