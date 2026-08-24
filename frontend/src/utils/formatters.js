/**
 * formatters.js — Shared display helpers.
 * Rule 10: Currency displayed as "Rs. 1,200" · Dates as "15-Mar-2023".
 */

/** Format a number as PKR currency: "Rs. 1,200" */
export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return "Rs. 0";
  return `Rs. ${Number(amount).toLocaleString("en-PK")}`;
}

export const formatPKR = formatCurrency;

/** Format an ISO date string or Date object as "15-Mar-2023" */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
}

/** Format an ISO datetime string as "15-Mar-2023, 10:05 AM" */
export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const datePart = formatDate(dateStr);
  const timePart = d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

/** Return the initials from a full name: "Muhammad Bilal" → "MB" */
export function getInitials(fullName) {
  if (!fullName) return "?";
  return fullName
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2);
}

/** Greeting based on the current hour: Good Morning / Afternoon / Evening with Emojis & Urdu */
export function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "☀️ Good Morning (صبح بخیر)";
  if (hour >= 12 && hour < 17) return "🌤️ Good Afternoon (دوپہر بخیر)";
  return "🌙 Good Evening (شام بخیر)";
}

/** Format today's date for the dashboard header: "Wednesday, 13 Aug 2026" */
export function formatTodayLong() {
  return new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Calculate dynamic patient age.
 * Handles:
 * - Exact Date of Birth (DOB) -> auto-increments on every birthday.
 * - Initial approx age stored at registration -> auto-advances dynamically based on years elapsed since registration.
 * - Missing / unstated age -> returns null cleanly.
 */
export function getPatientCalculatedAge(patient, asOfDate = new Date()) {
  if (!patient) return null;

  // 1. If exact Date of Birth is recorded
  if (patient.dob) {
    const dob = new Date(patient.dob);
    if (!isNaN(dob.getTime())) {
      const target = new Date(asOfDate);
      let age = target.getFullYear() - dob.getFullYear();
      const m = target.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && target.getDate() < dob.getDate())) {
        age--;
      }
      return age >= 0 ? age : null;
    }
  }

  // 2. If initial approx age was recorded at registration
  if (patient.age !== null && patient.age !== undefined && patient.age !== "" && !isNaN(Number(patient.age))) {
    const initialAge = Number(patient.age);
    if (initialAge === 0) return 0; // Infant / newborn

    const regDateStr = patient.created_at || patient.registration_date;
    if (regDateStr) {
      const regDate = new Date(regDateStr);
      if (!isNaN(regDate.getTime())) {
        const target = new Date(asOfDate);
        const yearsElapsed = Math.floor((target.getTime() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        return initialAge + Math.max(0, yearsElapsed);
      }
    }
    return initialAge;
  }

  return null;
}

/**
 * Returns formatted age string:
 * - e.g. "37 yrs" (auto-advanced from 35 yrs 2 years ago)
 * - e.g. "< 1 yr" (for infants)
 * - e.g. "—" (when age was not provided by patient)
 */
export function formatPatientAge(patient, asOfDate = new Date()) {
  const calculated = getPatientCalculatedAge(patient, asOfDate);
  if (calculated === null || calculated === undefined) return "—";
  if (calculated === 0) return "< 1 yr";
  return `${calculated} yrs`;
}
