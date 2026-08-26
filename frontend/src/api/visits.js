/** visits.js — Visit operations (updated for real clinic workflow — photo-based prescriptions). */
import { isSameDay, isSameMonth, subDays, format, isValid, parseISO } from "date-fns";
import { dbVisits } from "./db.js";
import { visitInputSchema, validateSchema } from "../schemas/index.js";

export function getVisit(id) {
  const visit = dbVisits.getById(id);
  if (!visit) return { success: false, data: null, error: { code: "NOT_FOUND", message: "Visit not found." } };
  return { success: true, data: visit, error: null };
}

/** Create a new visit (used by reception registration flow — token auto-assigned). */
export function createVisit(formData) {
  const { patient_id } = formData || {};
  if (!patient_id) return { success: false, data: null, error: { code: "VALIDATION", message: "Patient is required." } };

  const visit = dbVisits.add({
    ...formData,
    fee_amount: parseFloat(formData.fee_amount) || 0,
  });
  return { success: true, data: visit, error: null };
}

/** Get summary of fees — daily, weekly, or monthly — for the Fees & Reports screen. Option to filter by doctorId. */
export function getFeesSummary(range = "monthly", doctorId = null) {
  const visits = dbVisits.getAll();
  const now = new Date();

  const filtered = visits.filter((v) => {
    if (doctorId && v.doctor_id && v.doctor_id !== doctorId) return false;
    const d = typeof v.visit_date === "string" ? parseISO(v.visit_date) : new Date(v.visit_date);
    if (!isValid(d)) return false;

    if (range === "daily") return isSameDay(d, now);
    if (range === "weekly") {
      const weekAgo = subDays(now, 7);
      return d >= weekAgo;
    }
    // monthly: same calendar month
    return isSameMonth(d, now);
  });

  const total_fees  = filtered.reduce((sum, v) => sum + (v.fee_amount || 0), 0);
  const visit_count = filtered.length;

  // Build a clean bar chart dataset by grouping per day
  const byDate = new Map();
  filtered.forEach((v) => {
    const d = typeof v.visit_date === "string" ? parseISO(v.visit_date) : new Date(v.visit_date);
    const key = isValid(d) ? format(d, "dd-MMM") : "Other";
    byDate.set(key, (byDate.get(key) || 0) + (v.fee_amount || 0));
  });
  const chart_data = Array.from(byDate.entries()).map(([date, fees]) => ({ date, fees }));

  return { success: true, data: { total_fees, visit_count, chart_data, range }, error: null };
}
