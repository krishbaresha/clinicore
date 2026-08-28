/**
 * ClinicFlow — Domain-Specific Conflict Resolution & Multi-Device Concurrency Engine
 * Implements mathematically sound conflict policies per business domain.
 */

import { safeAdd, safeSub, safeQty, safeMoney } from "./arithmetic.js";

/**
 * Domain 1: Patient Profile 3-Way Merge & Field-Level Last-Write-Wins (LWW)
 */
export function mergePatientEntity(baseRecord, localRecord, remoteRecord, deviceId = "local_node") {
  if (!baseRecord && !remoteRecord) return localRecord;
  if (!baseRecord && remoteRecord) return { ...remoteRecord, ...localRecord };
  if (!localRecord) return remoteRecord;
  if (!remoteRecord) return localRecord;

  const now = new Date().toISOString();
  const merged = { ...baseRecord, ...remoteRecord, ...localRecord };
  const mergedMeta = {
    ...(baseRecord?._field_meta || {}),
    ...(remoteRecord?._field_meta || {}),
    ...(localRecord?._field_meta || {}),
  };

  const allKeys = new Set([
    ...Object.keys(baseRecord || {}),
    ...Object.keys(localRecord || {}),
    ...Object.keys(remoteRecord || {}),
  ]);

  for (const key of allKeys) {
    if (key.startsWith("_") || key === "id" || key === "created_at") continue;

    const baseVal = baseRecord ? baseRecord[key] : undefined;
    const localVal = localRecord ? localRecord[key] : undefined;
    const remoteVal = remoteRecord ? remoteRecord[key] : undefined;

    // Fast path: Identical values
    if (localVal === remoteVal) {
      merged[key] = localVal;
      continue;
    }

    const localMeta = localRecord?._field_meta?.[key] || {
      updated_at: localRecord?.updated_at || "1970-01-01T00:00:00Z",
      node_id: deviceId,
    };
    const remoteMeta = remoteRecord?._field_meta?.[key] || {
      updated_at: remoteRecord?.updated_at || "1970-01-01T00:00:00Z",
      node_id: "remote_node",
    };

    const localChanged = JSON.stringify(localVal) !== JSON.stringify(baseVal);
    const remoteChanged = JSON.stringify(remoteVal) !== JSON.stringify(baseVal);

    if (localChanged && !remoteChanged) {
      // Local clean edit
      merged[key] = localVal;
      mergedMeta[key] = localMeta;
    } else if (!localChanged && remoteChanged) {
      // Remote clean edit
      merged[key] = remoteVal;
      mergedMeta[key] = remoteMeta;
    } else if (localChanged && remoteChanged) {
      // True Concurrent Conflict
      if (Array.isArray(localVal) && Array.isArray(remoteVal)) {
        // Set union for lists (e.g. allergies, symptoms)
        merged[key] = Array.from(new Set([...remoteVal, ...localVal]));
        mergedMeta[key] = { updated_at: now, node_id: "3way_union" };
      } else if (key === "medical_history" || key === "notes") {
        // Non-destructive narrative concatenation for clinical notes
        const combined = `${localVal || ""}\n--- [Remote Update ${remoteMeta.updated_at}] ---\n${remoteVal || ""}`.trim();
        merged[key] = combined;
        mergedMeta[key] = { updated_at: now, node_id: "3way_concat" };
      } else {
        // Scalar Field LWW with Timestamp comparison
        const localTime = new Date(localMeta.updated_at).getTime();
        const remoteTime = new Date(remoteMeta.updated_at).getTime();

        if (localTime >= remoteTime) {
          merged[key] = localVal;
          mergedMeta[key] = localMeta;
        } else {
          merged[key] = remoteVal;
          mergedMeta[key] = remoteMeta;
        }
      }
    }
  }

  merged._version = Math.max(localRecord?._version || 0, remoteRecord?._version || 0) + 1;
  merged.updated_at = now;
  merged._field_meta = mergedMeta;

  return merged;
}

/**
 * Domain 2: Inventory & Stock Commutative PN-Counter Delta Reconciliation
 */
export function reconcileInventoryWithDeltas(serverInventoryList, pendingOutboxMovements) {
  if (!serverInventoryList) return [];
  if (!pendingOutboxMovements || pendingOutboxMovements.length === 0) {
    return serverInventoryList;
  }

  const inventoryMap = new Map();
  for (const item of serverInventoryList) {
    const locStocks = { ...(item.location_stocks || {}) };
    inventoryMap.set(item.id, {
      ...item,
      location_stocks: locStocks,
      total_base_stock: Number(item.total_base_stock) || 0,
      store_stock: Number(item.store_stock) || 0,
      warehouse_stock: Number(item.warehouse_stock) || 0,
    });
  }

  // Replay uncommitted pending outbox stock movements
  for (const mov of pendingOutboxMovements) {
    const item = inventoryMap.get(mov.inventory_id);
    if (!item) continue;

    const baseQty = safeQty(mov.qty_base_units || 1);
    const locStocks = item.location_stocks;

    if (mov.direction === "IN") {
      const dest = mov.destination_location_id;
      if (dest && dest !== "CUSTOMER" && dest !== "SCRAP") {
        locStocks[dest] = safeAdd(locStocks[dest] || 0, baseQty);
      }
    } else if (mov.direction === "OUT") {
      const src = mov.source_location_id;
      if (src && src !== "EXTERNAL") {
        locStocks[src] = Math.max(0, safeSub(locStocks[src] || 0, baseQty));
      }
    } else if (mov.direction === "TRANSFER") {
      const src = mov.source_location_id;
      const dest = mov.destination_location_id;
      if (src && src !== "EXTERNAL") {
        locStocks[src] = Math.max(0, safeSub(locStocks[src] || 0, baseQty));
      }
      if (dest && dest !== "CUSTOMER" && dest !== "SCRAP") {
        locStocks[dest] = safeAdd(locStocks[dest] || 0, baseQty);
      }
    }

    // Recalculate totals
    const storeStock = Number(locStocks["wh_str"]) || 0;
    const warehouseStock = Object.entries(locStocks)
      .filter(([k]) => k !== "wh_str")
      .reduce((sum, [, v]) => safeAdd(sum, Number(v) || 0), 0);

    item.store_stock = storeStock;
    item.warehouse_stock = warehouseStock;
    item.total_base_stock = safeAdd(storeStock, warehouseStock);
    item.stock_qty = storeStock;
  }

  return Array.from(inventoryMap.values());
}

/**
 * Domain 4: Shift Drift & Cash Drawer Reconciliation
 */
export function calculateShiftDrift(openingFloat = 0, cashInflows = 0, cashExpenses = 0, actualCountedCash = 0) {
  const expectedCash = safeSub(safeAdd(openingFloat, cashInflows), cashExpenses);
  const counted = safeMoney(actualCountedCash);
  const drift = safeSub(counted, expectedCash);

  let category = "EXACT";
  if (drift > 0) category = "OVERAGE";
  else if (drift < 0) category = "SHORTAGE";

  return {
    opening_float: safeMoney(openingFloat),
    total_cash_inflows: safeMoney(cashInflows),
    total_cash_expenses: safeMoney(cashExpenses),
    expected_cash: expectedCash,
    actual_counted_cash: counted,
    drift_variance: drift,
    drift_category: category,
    is_balanced: drift === 0,
  };
}

/**
 * Domain 5: System Configuration & Licensing Reconciler (Server Supremacy)
 */
export function reconcileSystemSettings(localSettings, remoteSettings) {
  if (!remoteSettings) return localSettings;
  if (!localSettings) return remoteSettings;

  const merged = { ...localSettings };

  // Strict Server Supremacy on Licensing & Security
  if (remoteSettings.license) {
    const rLic = remoteSettings.license;
    merged.license = {
      ...localSettings.license,
      license_status: rLic.license_status,
      is_hard_locked: Boolean(rLic.is_hard_locked),
      restricted_features: Array.isArray(rLic.restricted_features) ? rLic.restricted_features : [],
      due_day: rLic.due_day,
      next_due_date: rLic.next_due_date,
      custom_notice: rLic.custom_notice,
      monthly_fee: rLic.monthly_fee,
      server_revision: Number(rLic.server_revision) || (localSettings.license?.server_revision || 0) + 1,
    };
  }

  // Monotonic Revision Vectors for Operational Settings
  const localRev = Number(localSettings.revision || 0);
  const remoteRev = Number(remoteSettings.revision || 0);

  if (remoteRev > localRev) {
    merged.clinic = { ...localSettings.clinic, ...remoteSettings.clinic };
    merged.revision = remoteRev;
    merged.updated_at = remoteSettings.updated_at;
  } else if (localRev > remoteRev) {
    merged.revision = localRev;
  } else {
    const localTime = new Date(localSettings.updated_at || 0).getTime();
    const remoteTime = new Date(remoteSettings.updated_at || 0).getTime();
    if (remoteTime > localTime) {
      merged.clinic = { ...localSettings.clinic, ...remoteSettings.clinic };
      merged.updated_at = remoteSettings.updated_at;
    }
  }

  return merged;
}
