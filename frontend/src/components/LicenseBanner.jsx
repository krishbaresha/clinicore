import { useState, useEffect } from "react";
import { dbLicense } from "../api/db.js";

/**
 * LicenseBanner — Dynamic Warning & Grace Period Reminder Bar
 * Features:
 * - Warning Banner (5 days before due date): Non-intrusive, dismissible reminder with developer payment details.
 * - Grace Period Banner (1st to 10th): Reminds clinic owner that payment is pending without halting clinic operations.
 * - Restricted Banner: Tells staff which features are paused by developer.
 */
export default function LicenseBanner() {
  const [licenseState, setLicenseState] = useState(() => dbLicense.evaluateStatus());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => setLicenseState(dbLicense.evaluateStatus());
    window.addEventListener("clinicflow_license_update", update);
    const interval = setInterval(update, 60000); // refresh every minute
    return () => {
      window.removeEventListener("clinicflow_license_update", update);
      clearInterval(interval);
    };
  }, []);

  if (!licenseState.isWarning && !licenseState.isGrace && licenseState.status !== "restricted") {
    return null;
  }

  if (dismissed && licenseState.status !== "restricted" && !licenseState.isGrace) {
    return null;
  }

  const lic = dbLicense.get();

  const isRestricted = licenseState.status === "restricted";
  const isGrace = licenseState.status === "grace_period";

  return (
    <div
      className={`w-full px-4 py-2.5 text-xs font-bold transition-all flex items-center justify-between shadow-xs border-b z-50 ${
        isRestricted
          ? "bg-rose-600 text-white border-rose-700"
          : isGrace
          ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-700"
          : "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-950 border-amber-200"
      }`}
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <span
          className={`material-symbols-outlined text-lg shrink-0 ${
            isRestricted || isGrace ? "text-white animate-bounce" : "text-amber-700"
          }`}
        >
          {isRestricted ? "lock_clock" : isGrace ? "warning" : "notifications_active"}
        </span>

        <div className="truncate">
          <span className="font-black uppercase tracking-wider mr-2">
            {isRestricted
              ? "⚠️ [Subscription Pending]"
              : isGrace
              ? `🔔 [Grace Period Active — Day ${licenseState.daysOverdue}]`
              : "💳 [Payment Notice]"}
          </span>
          <span className="font-medium">{licenseState.message}</span>
          <span className="hidden sm:inline font-mono ml-2 opacity-90">
            • Pay via: {lic.developer_bank_details || "JazzCash / EasyPaisa: 03142291356"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <a
          href={`https://wa.me/923142291356?text=${encodeURIComponent(
            `Salam K.B Software, I am contacting regarding software subscription payment for ${lic.monthly_fee ? `Rs. ${lic.monthly_fee}` : "ClinicFlow"}.`
          )}`}
          target="_blank"
          rel="noreferrer"
          className={`px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 transition-all ${
            isRestricted || isGrace
              ? "bg-white text-slate-900 hover:bg-slate-100 shadow-xs"
              : "bg-amber-700 text-white hover:bg-amber-800 shadow-xs"
          }`}
        >
          <span className="material-symbols-outlined text-xs">chat</span>
          <span>Contact Dev</span>
        </a>

        {!isRestricted && (
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg hover:bg-black/10 transition-colors opacity-70 hover:opacity-100"
            title="Dismiss notice"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
      </div>
    </div>
  );
}
