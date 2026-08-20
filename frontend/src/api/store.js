import { dbInventory, dbSales, dbVisits, dbExpenses, dbReturns, resetDatabaseToDemoData } from "./db.js";

export function resetDemoData()   { resetDatabaseToDemoData(); return { success: true, data: true, error: null }; }
export function getInventory()    { return { success: true, data: dbInventory.getAll(),       error: null }; }
export function getLowStock()     { return { success: true, data: dbInventory.getLowStock(),  error: null }; }
export function getSales()        { return { success: true, data: dbSales.getAll(),           error: null }; }
export function getExpenses()     { return { success: true, data: dbExpenses.getAll(),        error: null }; }
export function getReturns()      { return { success: true, data: dbReturns.getAll(),         error: null }; }

export function addPharmacyExpense(formData) {
  const { amount } = formData || {};
  if (!amount || Number(amount) <= 0) return { success: false, data: null, error: { code: "VALIDATION", message: "Valid amount is required." } };
  const exp = dbExpenses.add(formData);
  return { success: true, data: exp, error: null };
}

export function deletePharmacyExpense(id) {
  dbExpenses.delete(id);
  return { success: true, data: true, error: null };
}

export function processSaleReturn(payload) {
  try {
    const res = dbReturns.processReturn(payload);
    return { success: true, data: res, error: null };
  } catch (err) {
    return { success: false, data: null, error: { code: "RETURN_ERROR", message: err.message } };
  }
}

export function addInventoryItem(formData) {
  const { medicine_name } = formData;
  if (!medicine_name?.trim()) return { success: false, data: null, error: { code: "VALIDATION", message: "Medicine name is required." } };
  const item = dbInventory.add({
    ...formData,
    medicine_name: medicine_name.trim(),
  });
  return { success: true, data: item, error: null };
}

/** Record a sale — automatically deducts stock from inventory. */
export function recordSale(formData) {
  const { inventory_id, quantity_sold, linked_visit_id, selected_unit_type = "unit" } = formData;
  const item = dbInventory.getById(inventory_id);
  if (!item) return { success: false, data: null, error: { code: "NOT_FOUND", message: "Inventory item not found." } };

  const qty = parseInt(quantity_sold) || 1;
  const stripsPerBox = Number(item.strips_per_box) || 10;
  const unitsPerStrip = Number(item.units_per_strip) || 12;

  let baseUnitsNeeded = qty;
  let unitPrice = item.unit_sale_price || item.unit_price || 0;
  let unitLabel = item.unit_label || "tablet";

  if (item.has_multi_unit) {
    if (selected_unit_type === "box") {
      baseUnitsNeeded = qty * (stripsPerBox * unitsPerStrip);
      unitPrice = item.box_sale_price || (item.unit_price * stripsPerBox * unitsPerStrip);
      unitLabel = item.box_label || "box";
    } else if (selected_unit_type === "strip") {
      baseUnitsNeeded = qty * unitsPerStrip;
      unitPrice = item.strip_sale_price || (item.unit_price * unitsPerStrip);
      unitLabel = item.strip_label || "strip";
    }
  }

  const currentBaseStock = item.total_base_stock ?? item.stock_qty ?? 0;
  if (currentBaseStock < baseUnitsNeeded) {
    return { success: false, data: null, error: { code: "INSUFFICIENT_STOCK", message: `Insufficient stock. Only ${currentBaseStock} base ${item.unit_label || "unit"}s available.` } };
  }

  const sale = dbSales.checkout({
    visit_id: linked_visit_id || null,
    items: [{
      inventory_id,
      medicine_name: item.medicine_name,
      selected_unit_type,
      unit_label: unitLabel,
      quantity: qty,
      base_units: baseUnitsNeeded,
      base_units_deducted: baseUnitsNeeded,
      unit_price: unitPrice,
      line_total: parseFloat((unitPrice * qty).toFixed(2)),
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
