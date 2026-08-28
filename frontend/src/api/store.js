import { dbInventory, dbSales, dbVisits, dbExpenses, dbReturns, dbStockMovements, resetDatabaseToDemoData, safeMoney, safeMul } from "./db.js";
import {
  pharmacyExpenseSchema,
  inventoryItemSchema,
  recordSaleSchema,
  validateSchema,
} from "../schemas/index.js";

export function resetDemoData()   { resetDatabaseToDemoData(); return { success: true, data: true, error: null }; }
export function getInventory()    { return { success: true, data: dbInventory.getAll(),       error: null }; }
export function getLowStock()     { return { success: true, data: dbInventory.getLowStock(),  error: null }; }
export function getSales()        { return { success: true, data: dbSales.getAll(),           error: null }; }
export function getExpenses()     { return { success: true, data: dbExpenses.getAll(),        error: null }; }
export function getReturns()      { return { success: true, data: dbReturns.getAll(),         error: null }; }

export function addPharmacyExpense(formData) {
  const validation = validateSchema(pharmacyExpenseSchema, formData);
  if (!validation.success) return validation;
  const exp = dbExpenses.add(validation.data);
  return { success: true, data: exp, error: null };
}

export function deletePharmacyExpense(id) {
  dbExpenses.delete(id);
  return { success: true, data: true, error: null };
}

export function processSaleReturn(payload) {
  try {
    const res = dbReturns.processReturn(payload);
    if (res && res.returned_items) {
      (res.returned_items || []).forEach((item) => {
        if (item.inventory_id) {
          const baseUnits = Number(item.base_units || item.base_units_deducted || item.quantity_returned || item.qty || 1);
          const inv = dbInventory.getById(item.inventory_id);
          dbStockMovements.recordMovement({
            inventory_id: item.inventory_id,
            medicine_name: item.medicine_name || inv?.medicine_name || "Medicine Item",
            company_name: inv?.company_name || "",
            item_code: inv?.item_code || "",
            movement_type: "return",
            direction: "IN",
            source_location_id: "CUSTOMER",
            destination_location_id: "wh_str",
            qty_base_units: baseUnits,
            rate_per_base_unit: item.unit_price || inv?.unit_sale_price || 0,
            gross_amount: safeMoney(safeMul(baseUnits, item.unit_price || inv?.unit_sale_price || 0)),
            net_amount: safeMoney(safeMul(baseUnits, item.unit_price || inv?.unit_sale_price || 0)),
            source_voucher_type: "SALES_RETURN",
            source_voucher_no: res.return_voucher_no || res.id || "RET-VOUCHER",
            notes: `Sales return restock: ${payload.reason || "Customer Return"}`,
          });
        }
      });
    }
    return { success: true, data: res, error: null };
  } catch (err) {
    return { success: false, data: null, error: { code: "RETURN_ERROR", message: err.message } };
  }
}

export function addInventoryItem(formData) {
  const validation = validateSchema(inventoryItemSchema, formData);
  if (!validation.success) return validation;
  const item = dbInventory.add(validation.data);
  return { success: true, data: item, error: null };
}

/** Record a sale — automatically deducts stock from inventory. */
export function recordSale(formData) {
  const validation = validateSchema(recordSaleSchema, formData);
  if (!validation.success) return validation;

  const { inventory_id, quantity_sold: qty, linked_visit_id, selected_unit_type } = validation.data;
  const item = dbInventory.getById(inventory_id);
  if (!item) return { success: false, data: null, error: { code: "NOT_FOUND", message: "Inventory item not found." } };

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

  const lineTotal = safeMoney(safeMul(unitPrice, qty));

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
      line_total: lineTotal,
    }],
  });

  try {
    dbStockMovements.recordMovement({
      inventory_id,
      medicine_name: item.medicine_name,
      company_name: item.company_name,
      item_code: item.item_code,
      movement_type: "sale",
      direction: "OUT",
      source_location_id: "wh_str",
      destination_location_id: "CUSTOMER",
      selected_unit_type,
      qty_selected_unit: qty,
      qty_base_units: baseUnitsNeeded,
      rate_per_base_unit: unitPrice,
      gross_amount: lineTotal,
      discount_amount: 0,
      net_amount: lineTotal,
      source_voucher_type: "POS_RECEIPT",
      source_voucher_no: sale?.receipt_no || sale?.id || "POS-SALE",
      source_voucher_id: sale?.id || "",
      notes: `Sold ${qty} ${unitLabel}(s) at counter POS`,
    });
  } catch {}

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

export function bulkImportInventory(items, mode = "merge") {
  const result = dbInventory.bulkImport(items, mode);
  return result.success ? { success: true, data: result, error: null } : { success: false, data: null, error: { code: "IMPORT_ERROR", message: result.message || "Failed to import items" } };
}

export async function bulkImportAccessInventory(limit = 4236, defaultStock = { store: 15, godown: 35 }) {
  const result = await dbInventory.bulkImportFromAccess(limit, defaultStock);
  return result.success ? { success: true, data: result, error: null } : { success: false, data: null, error: { code: "MIGRATION_ERROR", message: result.message || "Failed to import legacy Access catalog" } };
}

export async function getAccessInventoryCatalog() {
  return { success: true, data: await dbInventory.getAccessCatalog(), error: null };
}


