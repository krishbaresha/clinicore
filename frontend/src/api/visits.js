/** visits.js — Visit operations (updated for real clinic workflow — photo-based prescriptions). */
import { dbVisits } from "./db.js";

export function getVisit(id) {
  const visit = dbVisits.getById(id);
  if (!visit) return { success: false, data: null, error: { code: "NOT_FOUND", message: "Visit not found." } };
  return { success: true, data: visit, error: null };
}

/** Create a new visit (used by reception registration flow — token auto-assigned). */
export function createVisit(formData) {
  const { patient_id, visit_type, fee_amount, notes } = formData;
  if (!patient_id) return { success: false, data: null, error: { code: "VALIDATION", message: "Patient is required." } };
  const visit = dbVisits.add({
    patient_id,
    visit_type: visit_type || "new",
    fee_amount: parseFloat(fee_amount) || 0,
    notes: notes || "",
  });
  return { success: true, data: visit, error: null };
}

/** Get summary of fees — daily, weekly, or monthly — for the Fees & Reports screen. */
export function getFeesSummary(range = "monthly") {
  const visits = dbVisits.getAll();
  const now = new Date();

  const filtered = visits.filter((v) => {
    const d = new Date(v.visit_date);
    if (range === "daily")   return d.toDateString() === now.toDateString();
    if (range === "weekly") {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    // monthly: same calendar month
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const total_fees  = filtered.reduce((sum, v) => sum + (v.fee_amount || 0), 0);
  const visit_count = filtered.length;

  // Build a simple bar chart dataset by grouping per day
  const byDate = {};
  filtered.forEach((v) => {
    const key = new Date(v.visit_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
    byDate[key] = (byDate[key] || 0) + (v.fee_amount || 0);
  });
  const chart_data = Object.entries(byDate).map(([date, fees]) => ({ date, fees }));

  return { success: true, data: { total_fees, visit_count, chart_data, range }, error: null };
}
