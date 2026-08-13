/**
 * formatters.js — Shared display helpers.
 * Rule 10: Currency displayed as "Rs. 1,200" · Dates as "15-Mar-2023".
 */

/** Format a number as PKR currency: "Rs. 1,200" */
export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return "Rs. 0";
  return `Rs. ${Number(amount).toLocaleString("en-PK")}`;
}

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

/** Greeting based on the current hour: Good Morning / Afternoon / Evening */
export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

/** Format today's date for the dashboard header: "Wednesday, 13 Aug 2026" */
export function formatTodayLong() {
  return new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
