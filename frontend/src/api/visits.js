/** visits.js — Visit and prescription operations. */
import { dbVisits, dbPrescriptions, dbInventory, dbSales } from "./db.js";

export function getVisit(id) {
  const visit = dbVisits.getById(id);
  if (!visit) return { success: false, data: null, error: { code: "NOT_FOUND", message: "Visit not found." } };
  const prescription_items = dbPrescriptions.getByVisit(id);
  return { success: true, data: { ...visit, prescription_items }, error: null };
}

/** Create a new visit along with its prescription items. */
export function createVisit(formData) {
  const { patient_id, symptoms, diagnosis, fee_amount, follow_up_date, notes, medicines, services } = formData;
  if (!patient_id) return { success: false, data: null, error: { code: "VALIDATION", message: "Patient is required." } };

  const visit = dbVisits.add({ patient_id, symptoms, diagnosis, fee_amount: parseFloat(fee_amount) || 0, follow_up_date: follow_up_date || null, notes, services: services || [] });
  if (medicines && medicines.length > 0) {
    dbPrescriptions.addBulk(visit.id, medicines);

    // Sync with store inventory
    const allInventory = dbInventory.getAll();
    medicines.forEach((med) => {
      if (!med.medicine_name || !med.medicine_name.trim()) return;
      const medNameTrimmed = med.medicine_name.trim();

      // Case-insensitive lookup
      let invItem = allInventory.find(
        (item) => item.medicine_name.toLowerCase() === medNameTrimmed.toLowerCase()
      );

      if (!invItem) {
        // Automatically add to inventory if it doesn't exist
        invItem = dbInventory.add({
          medicine_name: medNameTrimmed,
          stock_qty: 0,
          unit_price: 0,
          low_stock_threshold: 10,
        });
      }

      // Deduct stock and log sale if quantity is prescribed
      const qty = parseInt(med.quantity) || 0;
      if (qty > 0) {
        dbSales.add({
          inventory_id: invItem.id,
          quantity_sold: qty,
          sale_amount: parseFloat((invItem.unit_price * qty).toFixed(2)),
          linked_visit_id: visit.id,
        });
      }
    });
  }
  const prescription_items = dbPrescriptions.getByVisit(visit.id);
  return { success: true, data: { ...visit, prescription_items }, error: null };
}

/** Get summary of fees — daily, weekly, or monthly — for the fees & reports screen. */
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

  const total_fees   = filtered.reduce((sum, v) => sum + (v.fee_amount || 0), 0);
  const visit_count  = filtered.length;

  // Build a simple bar chart dataset by grouping per day
  const byDate = {};
  filtered.forEach((v) => {
    const key = new Date(v.visit_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
    byDate[key] = (byDate[key] || 0) + (v.fee_amount || 0);
  });
  const chart_data = Object.entries(byDate).map(([date, fees]) => ({ date, fees }));

  return { success: true, data: { total_fees, visit_count, chart_data, range }, error: null };
}
