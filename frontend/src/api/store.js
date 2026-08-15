/** store.js — Medical store inventory and sales operations. */
import { dbInventory, dbSales, dbVisits, dbPatients } from "./db.js";

export function getInventory()    { return { success: true, data: dbInventory.getAll(),       error: null }; }
export function getLowStock()     { return { success: true, data: dbInventory.getLowStock(),  error: null }; }
export function getSales()        { return { success: true, data: dbSales.getAll(),           error: null }; }

export function addInventoryItem(formData) {
  const { medicine_name, stock_qty, unit_price, low_stock_threshold } = formData;
  if (!medicine_name?.trim()) return { success: false, data: null, error: { code: "VALIDATION", message: "Medicine name is required." } };
  const item = dbInventory.add({
    medicine_name: medicine_name.trim(),
    stock_qty:           parseInt(stock_qty) || 0,
    unit_price:          parseFloat(unit_price) || 0,
    low_stock_threshold: parseInt(low_stock_threshold) || 10,
  });
  return { success: true, data: item, error: null };
}

/** Record a sale — automatically deducts stock from inventory. */
export function recordSale(formData) {
  const { inventory_id, quantity_sold, linked_visit_id } = formData;
  const item = dbInventory.getById(inventory_id);
  if (!item) return { success: false, data: null, error: { code: "NOT_FOUND", message: "Inventory item not found." } };
  const qty = parseInt(quantity_sold) || 1;
  if (item.stock_qty < qty) return { success: false, data: null, error: { code: "INSUFFICIENT_STOCK", message: `Only ${item.stock_qty} units available.` } };

  const sale = dbSales.checkout({
    visit_id: linked_visit_id || null,
    items: [{
      inventory_id,
      medicine_name: item.medicine_name,
      quantity: qty,
      unit_price: item.unit_price,
      line_total: parseFloat((item.unit_price * qty).toFixed(2)),
    }],
  });
  return { success: true, data: sale, error: null };
}

/** Dashboard summary: patients today, fees today, low stock count. */
export function getDashboardSummary() {
  const visits    = dbVisits.getAll();
  const today     = new Date().toDateString();
  const todayV    = visits.filter((v) => new Date(v.visit_date).toDateString() === today);
  const feesToday = todayV.reduce((sum, v) => sum + (v.fee_amount || 0), 0);
  const lowCount  = dbInventory.getLowStock().length;
  return { success: true, data: { patients_today: todayV.length, fees_today: feesToday, low_stock_count: lowCount }, error: null };
}
