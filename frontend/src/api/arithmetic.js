/**
 * ClinicFlow — Decimal-Safe Arithmetic Engine (DSAE) & Invariant Validator
 * Anti-Guess & Zero-Loss Financial & Inventory Precision Engine
 */

const PRECISION_SCALE = 10000; // 4 decimal places internal calculation scale
const CURRENCY_SCALE = 100;    // 2 decimal places display/ledger scale

/**
 * Coerces any unknown value to a safe finite number.
 */
export function safeNum(val, fallback = 0, { min = null, max = null, integer = false } = {}) {
  if (val === null || val === undefined || val === "") return fallback;
  let num;
  if (typeof val === "number") {
    num = val;
  } else {
    const str = String(val).replace(/,/g, "").trim();
    const match = str.match(/-?\d+(?:\.\d+)?/);
    num = match ? Number(match[0]) : Number(str);
  }
  if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
  if (integer) num = Math.trunc(num);
  if (min !== null && num < min) num = min;
  if (max !== null && num > max) num = max;
  return num;
}

/**
 * Safe currency normalizer (2 decimal places, rounded half-up, non-negative default).
 */
export function safeMoney(val, fallback = 0, allowNegative = false) {
  const num = safeNum(val, fallback, { min: allowNegative ? null : 0 });
  return Math.round((num + Number.EPSILON) * CURRENCY_SCALE) / CURRENCY_SCALE;
}

/**
 * Safe integer quantity normalizer.
 */
export function safeQty(val, fallback = 0, { integer = true, allowNegative = false } = {}) {
  return safeNum(val, fallback, { min: allowNegative ? null : 0, integer });
}

/**
 * Safe addition preventing floating point drift: sum(v_i)
 */
export function safeAdd(...vals) {
  let scaledSum = 0;
  for (const v of vals) {
    const num = safeNum(v, 0);
    scaledSum += Math.round(num * PRECISION_SCALE);
  }
  return scaledSum / PRECISION_SCALE;
}

/**
 * Safe subtraction with optional clamp to zero: a - b
 */
export function safeSub(a, b, { clampZero = false } = {}) {
  const scaledA = Math.round(safeNum(a, 0) * PRECISION_SCALE);
  const scaledB = Math.round(safeNum(b, 0) * PRECISION_SCALE);
  const diff = (scaledA - scaledB) / PRECISION_SCALE;
  return clampZero ? Math.max(0, diff) : diff;
}

/**
 * Safe multiplication: a * b * ...
 */
export function safeMul(...vals) {
  if (vals.length === 0) return 0;
  let result = safeNum(vals[0], 0);
  for (let i = 1; i < vals.length; i++) {
    const next = safeNum(vals[i], 0);
    result = (Math.round(result * PRECISION_SCALE) * Math.round(next * PRECISION_SCALE)) / (PRECISION_SCALE * PRECISION_SCALE);
  }
  return result;
}

/**
 * Safe division preventing Division-by-Zero and Infinity: a / b
 */
export function safeDiv(numerator, denominator, { fallback = 0, precision = 4 } = {}) {
  const n = safeNum(numerator, 0);
  const d = safeNum(denominator, 0);
  if (Math.abs(d) < 1e-9) return fallback;
  const factor = Math.pow(10, precision);
  return Math.round((n / d) * factor) / factor;
}

/**
 * Robust line item discount calculation supporting both percentage % and flat Rs.
 * Mathematical Invariant: 0 <= Net <= Gross
 */
export function calculateLineDiscount(grossAmount, discPct = 0, discFlat = 0) {
  const gross = safeMoney(grossAmount);
  const pct = safeNum(discPct, 0, { min: 0, max: 100 });
  const flat = safeMoney(discFlat, 0);

  // 1. Percentage discount component
  const pctAmount = safeMoney((gross * pct) / 100);

  // 2. Total discount cannot exceed gross
  const totalDiscount = safeMoney(Math.min(gross, safeAdd(pctAmount, flat)));
  const netAmount = safeMoney(safeSub(gross, totalDiscount, { clampZero: true }));

  return {
    gross_amount: gross,
    disc_pct: pct,
    disc_pct_amount: pctAmount,
    disc_flat: flat,
    total_discount: totalDiscount,
    net_amount: netAmount,
  };
}

/**
 * Complete Cart / Invoice Level Aggregator with Overall Bill Discount
 */
export function calculateInvoiceFinancials(items = [], billDiscPct = 0, billDiscFlat = 0, paidAmount = null) {
  let subtotalGross = 0;
  let totalLineDiscounts = 0;
  let subtotalNet = 0;

  const normalizedItems = (items || []).map((item) => {
    const qty = safeQty(item.quantity || item.qty || 1);
    const rate = safeMoney(item.unit_price || item.rate || item.sale_price || item.box_sale_price || 0);
    const gross = safeMoney(safeMul(qty, rate));
    const disc = calculateLineDiscount(gross, item.disc_pct || item.item_discount_pct, item.disc_flat || item.discount);

    subtotalGross = safeAdd(subtotalGross, gross);
    totalLineDiscounts = safeAdd(totalLineDiscounts, disc.total_discount);
    subtotalNet = safeAdd(subtotalNet, disc.net_amount);

    return {
      ...item,
      quantity: qty,
      unit_price: rate,
      gross_amount: gross,
      total_discount: disc.total_discount,
      line_total: disc.net_amount,
    };
  });

  // Overall Bill-level trade discount
  const billDisc = calculateLineDiscount(subtotalNet, billDiscPct, billDiscFlat);
  const grandTotal = safeMoney(billDisc.net_amount);
  const overallDiscount = safeMoney(safeAdd(totalLineDiscounts, billDisc.total_discount));

  // Determine Paid & Due
  const finalPaid = paidAmount !== null && paidAmount !== undefined && !isNaN(Number(paidAmount))
    ? safeMoney(Math.min(grandTotal, safeNum(paidAmount, 0, { min: 0 })))
    : grandTotal;

  const balanceDue = safeMoney(safeSub(grandTotal, finalPaid, { clampZero: true }));

  return {
    items: normalizedItems,
    item_count: normalizedItems.length,
    subtotal_gross: safeMoney(subtotalGross),
    line_discounts_total: safeMoney(totalLineDiscounts),
    subtotal_after_line_discounts: safeMoney(subtotalNet),
    bill_discount_pct: safeNum(billDiscPct, 0, { min: 0, max: 100 }),
    bill_discount_flat: safeMoney(billDiscFlat, 0),
    bill_discount_total: safeMoney(billDisc.total_discount),
    total_discount: overallDiscount,
    grand_total: grandTotal,
    paid_amount: finalPaid,
    balance_due: balanceDue,
    is_credit: balanceDue > 0,
  };
}
