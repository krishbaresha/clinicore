import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { dbLicense } from "../api/db.js";

/**
 * Route-to-Feature key mapping for selective feature restrictions
 */
const ROUTE_FEATURE_MAP = {
  "/store/pos": "pos",
  "/store": "inventory",
  "/store/sales": "sales",
  "/store/purchases": "purchases",
  "/store/warehouse": "b2b",
  "/doctor/queue": "consultation",
  "/fees": "reports",
  "/patients": "patients",
};

/**
 * LicenseGuard — Enforces Hard Lock & Selective Feature Blockades
 */
export default function LicenseGuard({ children }) {
  const location = useLocation();
  const [licenseState, setLicenseState] = useState(() => dbLicense.evaluateStatus());

  useEffect(() => {
    const update = () => setLicenseState(dbLicense.evaluateStatus());
    window.addEventListener("clinicflow_license_update", update);
    return () => window.removeEventListener("clinicflow_license_update", update);
  }, []);

  const lic = dbLicense.get();

  // Allow developer admin unlock path unconditionally
  if (location.pathname === "/admin" || location.pathname === "/login") {
    return children;
  }

  // 1. HARD LOCK ENFORCEMENT (Full Screen Lock Screen)
  if (licenseState.isLocked || licenseState.status === "locked") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 selection:bg-rose-600 font-sans relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-600/20 blur-3xl rounded-full pointer-events-none" />

        <div className="w-full max-w-lg bg-slate-900/90 backdrop-blur-xl border border-rose-800/80 rounded-3xl p-8 sm:p-10 shadow-2xl text-center relative z-10 space-y-6 animate-scale-up">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-rose-700 to-red-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-rose-700/30">
            <span className="material-symbols-outlined text-4xl">lock</span>
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 bg-rose-950 text-rose-300 border border-rose-800 text-[11px] font-black rounded-full uppercase tracking-wider">
              Software License Suspended
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Access Temporarily Restricted
            </h2>
            <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
              {licenseState.message || "Monthly subscription maintenance has expired. Please clear the pending dues to restore instant access."}
            </p>
          </div>

          {/* Payment Details Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left space-y-2.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400 font-bold">Monthly Fee:</span>
              <span className="font-mono font-black text-rose-400">Rs. {Number(lic.monthly_fee || 5000).toLocaleString("en-US")}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400 font-bold">Account / Payment:</span>
              <span className="font-mono font-bold text-slate-200">JazzCash / EasyPaisa / Bank</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-bold">Developer Contact:</span>
              <span className="font-mono font-black text-emerald-400">{lic.developer_phone || "03142291356"}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a
              href={`https://wa.me/923142291356?text=${encodeURIComponent(
                `Salam K.B Software, our CliniCore software access is locked. We want to clear our monthly subscription of Rs. ${lic.monthly_fee || 5000}. Please verify and restore access.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs py-3.5 rounded-2xl shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              <span>Pay &amp; Contact Developer</span>
            </a>

            <Link
              to="/admin"
              className="px-5 py-3.5 rounded-2xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">admin_panel_settings</span>
              <span>Developer Login</span>
            </Link>
          </div>

          <div className="text-[10px] text-slate-500 font-mono">
            Powered by K.B Software · Hyderabad, Sindh
          </div>
        </div>
      </div>
    );
  }

  // 2. SELECTIVE FEATURE KILL-SWITCH ENFORCEMENT
  const currentFeatureKey = ROUTE_FEATURE_MAP[location.pathname];
  if (currentFeatureKey && licenseState.isFeatureBlocked(currentFeatureKey)) {
    return (
      <div className="p-8 max-w-3xl mx-auto my-12 bg-white border border-rose-200 rounded-3xl p-8 text-center space-y-5 shadow-lg animate-scale-up">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center mx-auto shadow-sm">
          <span className="material-symbols-outlined text-3xl">block</span>
        </div>

        <div className="space-y-1.5">
          <span className="px-3 py-1 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full uppercase tracking-wider">
            Module Temporarily Paused
          </span>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            This Feature Is Currently Restricted
          </h3>
          <p className="text-xs text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
            Access to the <strong>{currentFeatureKey.toUpperCase()}</strong> module has been paused by the software provider due to pending monthly subscription maintenance. Other operational records remain safe.
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2">
          <div className="flex justify-between items-center font-bold">
            <span className="text-slate-500">To resume this module:</span>
            <span className="text-rose-700 font-mono">Rs. {Number(lic.monthly_fee || 5000).toLocaleString("en-US")}</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Payment via JazzCash / EasyPaisa / Bank: <strong className="text-slate-900 font-mono">03142291356</strong>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/dashboard"
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-2xl transition-colors"
          >
            Back to Dashboard
          </Link>
          <a
            href="https://wa.me/923142291356"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-black text-xs rounded-2xl shadow-md shadow-teal-700/20 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">chat</span>
            <span>Contact Developer</span>
          </a>
        </div>
      </div>
    );
  }

  return children;
}
