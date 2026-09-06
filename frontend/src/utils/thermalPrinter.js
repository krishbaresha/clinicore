/**
 * thermalPrinter.js — Enterprise 80mm Thermal Receipt, Token & Supplier Voucher Generator Engine.
 * Features high-visibility large typography, crisp contrast, exact 80mm page size reset, zero margin overflow, zero double-printing, and HTML escaping security.
 */

import { formatPatientAge } from "./formatters.js";
import { CLINIC_LOGO_BASE64 } from "./clinicLogoBase64.js";
import { RECEIPT_HEADER_IMAGE_BASE64 } from "./receiptHeaderBase64.js";
import { getShortVersionBadge } from "./version.js";
import { getActiveCashier } from "../api/auth.js";
import { dbDayClosing } from "../api/db.js";

/**
 * Get user customized receipt branding & layout configuration
 */
export function getCustomReceiptConfig() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("cf_receipt_custom_config") : null;
    if (raw) {
      let config = JSON.parse(raw);
      return config;
    }
  } catch {}
  return {
    clinic_name: "Dr. Asif Khan",
    tagline: "Homoeopathic Clinic",
    address: "Lajpat Road, Hyderabad, Sindh, Pakistan",
    phone: "0335-9376363\n0310-9376363",
    header_image_base64: RECEIPT_HEADER_IMAGE_BASE64,
    logo_base64: CLINIC_LOGO_BASE64,
    logo_size: 62,
    logo_width: 53,
    logo_height: 60,
    name_size: 16,
    subtitle_size: 11,
    contact_size: 11,
    show_logo: true,
    show_tagline: true,
    show_doctor_info: true,
    show_doctor_sign: true,
    show_urdu_footer: false, // Default false for all receipts except Sale Invoice
    urdu_footer_text: "خریدی ہوئی دوا واپس یا تبدیل نہیں ہوگی۔",
  };
}

/**
 * Get per-mode block visibility/order config saved by Receipt Studio.
 * Key format: cf_receipt_blocks_order_<mode>  (pos | opd | b2b | grn | closing)
 * Returns null when no overrides saved — callers treat null as "show everything".
 */
export function getBlocksConfig(mode = "pos") {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(`cf_receipt_blocks_order_${mode}`)
        : null;
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function isBlockEnabled(blocks, blockId, mode = "") {
  if (blockId === "urdu_footer" && mode !== "pos" && mode !== "b2b" && mode !== "sale") {
    // Only enabled by default for sale invoices
    if (!blocks) return false;
    const item = blocks.find((b) => b && b.id === blockId);
    return item ? Boolean(item.enabled) : false;
  }
  if (!blocks || !Array.isArray(blocks)) return true;
  const item = blocks.find((b) => b && b.id === blockId);
  return item ? Boolean(item.enabled) : true;
}

/**
 * Shared clinic header HTML block for all thermal receipts.
 */
function sanitizeLogoSrc(src) {
  if (!src || typeof src !== "string") return CLINIC_LOGO_BASE64;
  const clean = src.trim();
  if (clean.startsWith("data:image/") || clean.startsWith("/") || clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean.replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  return CLINIC_LOGO_BASE64;
}

/**
 * Build clinic header HTML respecting per-block visibility.
 * Renders large full-width header image with zero top gap for low-ink thermal printing.
 */
export function getLogoHeaderHtml(docTypeLabel = "", blockFlags = {}) {
  const cfg = getCustomReceiptConfig();
  const {
    showLogo = true,
  } = blockFlags;

  const rawHeader = showLogo && (cfg.header_image_base64 || RECEIPT_HEADER_IMAGE_BASE64) ? (cfg.header_image_base64 || RECEIPT_HEADER_IMAGE_BASE64) : RECEIPT_HEADER_IMAGE_BASE64;
  const headerSrc = sanitizeLogoSrc(rawHeader) || RECEIPT_HEADER_IMAGE_BASE64;

  let headerHtml = `
    <div style="width: 100%; text-align: center; margin: 0 0 4px 0; padding: 0; box-sizing: border-box; line-height: 0;">
      <img src="${headerSrc}" alt="Clinic Header Logo" style="width: 100% !important; max-width: 100% !important; min-width: 100% !important; height: auto !important; display: block; margin: 0 auto; padding: 0; image-rendering: -webkit-optimize-contrast;" />
    </div>
  `;

  if (docTypeLabel) {
    headerHtml += `<div style="font-size: 11.5px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; margin: 3px 0 4px 0; padding: 2px 4px; border: 1.5px solid #000; background: #fff; color: #000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${escapeHtml(docTypeLabel)}</div>`;
  }

  return headerHtml;
}

/**
 * Standard Doctor Signature Line for Receipts
 */
export function getDoctorSignatureHtml() {
  return `
    <div style="margin-top: 65px; padding-top: 4px; display: flex; justify-content: flex-end; align-items: flex-end;">
      <div style="border-top: 1px solid #000; width: 48%; text-align: center; font-size: 11.5px; font-weight: 700; color: #000; padding-top: 3px; text-transform: uppercase; letter-spacing: 0.5px;">
        DR. SIGNATURE
      </div>
    </div>
  `;
}

/**
 * Shared software branding watermark for all thermal receipts
 */
export function getWatermarkFooterHtml() {
  return `
    <div style="text-align: center; margin-top: 6px; padding-top: 3px; border-top: 1px dotted #999; font-size: 9px; font-family: monospace; color: #444; line-height: 1.35;">
      <div style="font-weight: 600; color: #333;">*** Powered by CliniCore Software ***</div>
      <div style="color: #555; font-size: 8.5px; font-weight: 500;">K.B Developer 03142291356</div>
    </div>
  `;
}

/**
 * Auto-Capitalizes text into clean Title Case (e.g., "by hand" -> "By Hand")
 */
export function toTitleCase(str) {
  if (!str || typeof str !== "string") return "";
  const cleaned = str.trim();
  if (!cleaned) return "";
  const upperAcronyms = ["TCS", "B2B", "GRN", "VIP", "POS", "HBL", "MCB", "UBL", "ABL", "BOP", "NBP", "JS", "NRSP", "KMBL"];
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (!word) return "";
      const upper = word.toUpperCase();
      if (upperAcronyms.includes(upper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const THERMAL_ITEMS_TABLE_CSS = `
  .items-box {
    margin: 4px 0;
    overflow: hidden;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 13px;
    line-height: 1.25;
    border: 1px solid #000;
  }
  .items-table th,
  .items-table td {
    border: 1px solid #000 !important;
    padding: 3px 2px;
    vertical-align: middle;
    word-break: break-word;
    color: #000;
  }
  .items-table th {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 11.5px;
    background: #fff;
    text-align: center;
    color: #000;
    letter-spacing: 0.2px;
  }
  .items-table .col-sr { width: 9%; text-align: center; font-weight: 500; font-size: 11.5px; }
  .items-table .col-qty { width: 12%; text-align: center; font-weight: 700; font-size: 13.5px; }
  .items-table .col-item { width: 36%; text-align: left; font-weight: 600; font-size: 13px; }
  .items-table .col-rate { width: 14%; text-align: center; font-family: monospace; font-weight: 500; font-size: 12.5px; }
  .items-table .col-disc { width: 11%; text-align: center; font-family: monospace; font-size: 11.5px; font-weight: 500; }
  .items-table .col-net { width: 18%; text-align: right; font-weight: 700; font-family: monospace; font-size: 13.5px; }
  .items-table .cat-row td {
    background: #f8fafc;
    font-weight: 700;
    font-size: 12px;
    text-align: left;
    padding: 3px 4px;
    letter-spacing: 0.02em;
    border: 1px solid #000 !important;
    color: #000;
  }
  .items-table .item-sub {
    display: block;
    font-size: 10.5px;
    font-weight: 500;
    color: #333;
    margin-top: 1px;
  }
`;

function parseDiscPct(raw) {
  if (raw === null || raw === undefined || raw === "" || raw === "-") return 0;
  if (typeof raw === "string") return parseFloat(raw.replace("%", "").trim()) || 0;
  return Number(raw) || 0;
}

function normalizeReceiptLineItem(item) {
  const qty = Number(item.qty || item.quantity || item.quantity_received || item.qty_base_units || 1);
  const bonusQty = Number(item.bonus_qty || 0);
  const rate = Number(item.rate || item.unit_price || item.sale_price || item.cost_price || 0);
  const discPct = parseDiscPct(item.disc_pct_num ?? item.disc_pct ?? item.discount_pct ?? item.disc_percent ?? 0);
  const discFlat = Number(item.disc_flat || item.discount_flat || 0);
  const gross = qty * rate;
  const net = Number(item.net || item.line_total || item.total_cost || item.net_amount || Math.max(0, gross - gross * (discPct / 100) - discFlat)) || 0;
  const name = item.medicine_name || item.item_name || "Item";
  const companyName = item.company_name || item.manufacturer || item.brand || "";
  const category = String(item.category || item.medicine_category || item.product_category || "General").trim() || "General";
  const productCode = item.product_code || item.item_code || "";
  const unitLabel = item.unit_label || item.packing || item.received_unit_type || "";
  const batchNo = (item.batch_no && String(item.batch_no).trim() && String(item.batch_no).trim() !== "0" && String(item.batch_no).trim() !== "-") ? String(item.batch_no).trim() : "";
  const expiryDate = item.expiry_date || item.exp_date || "";
  return { qty, bonusQty, rate, discPct, discFlat, net, name, companyName, category, productCode, unitLabel, batchNo, expiryDate };
}

function groupItemsByCategory(items) {
  const order = [];
  const map = new Map();
  items.forEach((item) => {
    if (!map.has(item.category)) {
      map.set(item.category, []);
      order.push(item.category);
    }
    map.get(item.category).push(item);
  });
  return order.map((category) => ({ category, items: map.get(category) }));
}

/**
 * Build bordered S/r | Qty | Particulars | Rate | Dis | Net table for 80mm customer receipts.
 * Renders clear row-by-row lines with full horizontal + vertical cell borders.
 */
export function buildBorderedReceiptItemsTableHtml(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<div class="items-box" style="padding:10px;text-align:center;font-size:13.5px;font-weight:800;color:#444;border:1.5px dashed #666;border-radius:6px;margin:6px 0;">— No items in bill —</div>`;
  }

  const normalized = items.map(normalizeReceiptLineItem);

  const itemRows = normalized.map((it, idx) => {
    const discLabel = it.discPct > 0 ? `${it.discPct}%` : (it.discFlat > 0 ? `Rs.${it.discFlat}` : "-");
    const metaParts = [];
    if (it.companyName) metaParts.push(`[${it.companyName}]`);
    if (it.unitLabel) metaParts.push(`${it.unitLabel}`);
    if (it.batchNo) metaParts.push(`B:${it.batchNo}`);
    if (it.expiryDate) metaParts.push(`Exp:${String(it.expiryDate).split("T")[0]}`);
    if (it.bonusQty > 0) metaParts.push(`+${it.bonusQty} Bonus`);

    const subLine = metaParts.join(" · ");
    return `
    <tr>
      <td class="col-sr">${idx + 1}</td>
      <td class="col-qty">${it.qty}${it.bonusQty > 0 ? `<span style="font-size:9.5px;display:block;color:#166534;font-weight:900;">+${it.bonusQty}B</span>` : ""}</td>
      <td class="col-item">
        <span style="font-weight:700;color:#000;">${escapeHtml(it.name)}</span>
        ${subLine ? `<span class="item-sub" style="color:#333;font-size:10px;font-weight:600;display:block;margin-top:1px;">${escapeHtml(subLine)}</span>` : ""}
      </td>
      <td class="col-rate">${it.rate.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
      <td class="col-disc">${discLabel}</td>
      <td class="col-net">${it.net.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
    </tr>`;
  }).join("");

  return `
    <div class="items-box">
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-sr">S/r</th>
            <th class="col-qty">Qty</th>
            <th class="col-item">Particulars</th>
            <th class="col-rate">Rate</th>
            <th class="col-disc">Dis</th>
            <th class="col-net">Net</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>`;
}

export function getThermalItemsTableCss() {
  return THERMAL_ITEMS_TABLE_CSS;
}

/**
 * Universal Thermal Print Dispatcher
 * Uses isolated temporary iframe with automatic lifecycle teardown on afterprint/cancel.
 * Prevents double-printing, page reloads, and state corruption.
 */
export function executeThermalPrint(receiptHtml, title = "Print") {
  if (typeof document === "undefined" || typeof window === "undefined" || !document?.body) {
    return receiptHtml;
  }
  try {
    // Strip any embedded print scripts to guarantee single-invocation
    const sanitizedHtml = (receiptHtml || "").replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

    // Clean up any lingering print iframes
    const oldIframe = document.getElementById("thermal-print-iframe");
    if (oldIframe && oldIframe.parentNode) {
      try { oldIframe.parentNode.removeChild(oldIframe); } catch {}
    }

    const iframe = document.createElement("iframe");
    if (!iframe) return sanitizedHtml;

    iframe.id = "thermal-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "80mm";
    iframe.style.height = "200px";
    iframe.style.border = "0";
    iframe.style.opacity = "0.01";
    iframe.style.pointerEvents = "none";
    iframe.setAttribute("aria-hidden", "true");
    iframe.title = title || "Print Thermal Receipt";
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    if (!win || !win.document) {
      if (iframe.parentNode) {
        try { iframe.parentNode.removeChild(iframe); } catch {}
      }
      return sanitizedHtml;
    }

    const doc = win.document;
    doc.open();
    doc.write(sanitizedHtml);
    doc.close();

    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      setTimeout(() => {
        try {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch {}
      }, 800);
    };

    try { win.onafterprint = cleanup; } catch {}
    try { win.onbeforeunload = cleanup; } catch {}

    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
      } catch (err) {
        console.warn("[Thermal Printer] Direct print dispatch notice:", err);
        try {
          const printWindow = window.open("", "_blank", "width=400,height=600");
          if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(sanitizedHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
              try {
                printWindow.print();
                printWindow.close();
              } catch {}
            }, 300);
          }
        } catch (popupErr) {
          console.error("Popup fallback failed:", popupErr);
        }
      } finally {
        setTimeout(cleanup, 2000);
      }
    };

    // Trigger after layout / image decode
    if (doc.readyState === "complete") {
      setTimeout(triggerPrint, 250);
    } else {
      win.onload = () => setTimeout(triggerPrint, 250);
      setTimeout(triggerPrint, 600); // safety timeout
    }

    // Fallback garbage collection
    setTimeout(cleanup, 45000);
    return sanitizedHtml;
  } catch (outerErr) {
    console.error("executeThermalPrint error:", outerErr);
    return receiptHtml;
  }
}

/**
 * Generate 80mm ESC/POS Thermal Receipt HTML for Sale Invoices (Retail POS & Wholesale B2B)
 */
export function generateSaleInvoiceReceiptHtml(sale, clinicData = null) {
  if (!sale) return "";

  const isWholesale = sale.billing_type === "wholesale_party" || sale.is_wholesale || Boolean(sale.party_code && String(sale.party_code).toUpperCase() !== "POS");
  const modeKey = isWholesale ? "b2b" : "pos";

  // Read block visibility saved by Receipt Studio for mode
  const _blocks = getBlocksConfig(modeKey) || getBlocksConfig("pos");
  const showLogo     = isBlockEnabled(_blocks, "header_logo", modeKey);
  const showTagline  = isBlockEnabled(_blocks, "tagline", modeKey);
  const showContact  = isBlockEnabled(_blocks, "contact_info", modeKey);
  const showDiv1     = isBlockEnabled(_blocks, "divider_1", modeKey);
  const showMeta     = isBlockEnabled(_blocks, "meta_info", modeKey);
  const showCustomer = isBlockEnabled(_blocks, "customer_info", modeKey);
  const showItems    = isBlockEnabled(_blocks, "items_table", modeKey);
  const showDiv2     = isBlockEnabled(_blocks, "divider_2", modeKey);
  const showTotals   = isBlockEnabled(_blocks, "financial_totals", modeKey);
  const showUrdu     = isBlockEnabled(_blocks, "urdu_footer", modeKey);
  const showNote     = isBlockEnabled(_blocks, "custom_note", modeKey);
  const cfg          = getCustomReceiptConfig();

  const subtotal = Number(sale.subtotal_amount) || Number(sale.subtotal) || Number(sale.total_amount) || 0;
  const discount = Number(sale.discount_amount) || 0;
  const netTotal = Number(sale.total_amount) || subtotal;
  const isCredit = sale.payment_type === "credit" || sale.balance_due > 0 || (sale.payment_mode && String(sale.payment_mode).toLowerCase().includes("credit"));
  const cashTendered = Number(sale.cash_tendered ?? sale.paid_amount) || (isCredit ? 0 : netTotal);
  const changeDue = Number(sale.change_due ?? sale.change_return) || Math.max(0, cashTendered - netTotal);

  const rawDate = sale.sale_date || sale.date ? new Date(sale.sale_date || sale.date) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const activeCashier = typeof getActiveCashier === "function" ? getActiveCashier() : null;
  const cashierName = escapeHtml(sale.cashier_name || sale.active_cashier_name || (activeCashier?.name) || sale.user_name || "Store Staff");
  const customerName = escapeHtml(toTitleCase(sale.patient_name || sale.account_name || (sale.visit_id ? "Linked OPD Patient" : (isWholesale ? "B2B Wholesale Party" : "Walk-In Customer"))));
  const invoiceId = escapeHtml(sale.receipt_no || sale.voucher_no || sale.id || `POS-${Math.floor(1000 + Math.random() * 9000)}`);

  const rawToken = String(sale.token_no || sale.token_number || sale.token || "").trim();
  const isWalkInOrManual = !rawToken || ["walk-in", "walkin", "manual", "none", "null", "undefined", "-"].includes(rawToken.toLowerCase());
  const tokenNo = isWalkInOrManual ? "" : escapeHtml(rawToken);
  const partyCode = escapeHtml(sale.party_code || sale.party_type || "");
  const docName = (isWalkInOrManual || isWholesale) ? "" : escapeHtml(sale.attending_doctor_name || "");
  const docFee = Number(sale.doctor_fee || 0);
  const docFeeWaived = Boolean(sale.doctor_fee_waived);
  const posFee = Number(sale.pos_fee != null ? sale.pos_fee : (sale.is_pos_fee_included ? 1 : 0)) || 0;
  const salesman = escapeHtml(sale.salesman || sale.booker || "");
  const city = escapeHtml(sale.city || "");
  const transport = escapeHtml(sale.transport || "");
  const biltyNo = escapeHtml(sale.bilty_no || "");
  const prevBalance = Number(sale.previous_balance || sale.purana_udhaar || 0);

  const itemsHtml = buildBorderedReceiptItemsTableHtml(sale.items || []);
  const docTypeLabel = isWholesale ? "WHOLESALE DELIVERY BILL" : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt_${invoiceId}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600&display=swap" rel="stylesheet">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600&display=swap');
          @page { size: 80mm auto; margin: 0mm !important; }
          @media print {
            @page { size: 80mm auto; margin: 0mm !important; }
            html, body { width: 78mm !important; max-width: 78mm !important; margin: 0 auto !important; padding: 0 1.5mm 2mm 1.5mm !important; }
            .no-print { display: none !important; }
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            width: 78mm;
            margin: 0 auto;
            padding: 0 2mm 2mm 2mm;
            color: #000;
            background: #fff;
            font-size: 13.5px;
            line-height: 1.35;
            font-weight: 500;
          }
          .dotted-line {
            border-top: 1px dashed #000;
            margin: 4px 0;
          }
          .meta-text {
            font-size: 13px;
            font-weight: 500;
            color: #000;
            line-height: 1.35;
          }
          .urdu-disclaimer {
            font-family: 'Noto Nastaliq Urdu', 'Noto Sans Arabic', 'Urdu Typesetting', 'Jameel Noori Nastaleeq', serif;
            direction: rtl;
            text-align: center;
            font-size: 12.5px;
            line-height: 1.8;
            font-weight: 400;
            color: #000;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }
          ${getThermalItemsTableCss()}
        </style>
      </head>
      <body>
        <!-- Top Clinic Header (header_logo + clinic_name + tagline + contact_info blocks) -->
        ${getLogoHeaderHtml(docTypeLabel, { showLogo, showTagline, showContact })}

        ${showDiv1 ? `<div class="dotted-line"></div>` : ""}

        <!-- Invoice & Customer Meta (Balanced 2-Column Left / Right Layout) -->
        ${(showMeta || showCustomer) ? `
        <div class="meta-text" style="display: flex; flex-direction: column; gap: 2px;">
          <!-- Row 1: Date & Time (Left) | Invoice # (Right) -->
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span><span style="color: #4b5563; font-weight: 500;">Date &amp; Time :</span> ${dateTimeStr}</span>
            <span><span style="color: #4b5563; font-weight: 500;">Invoice # :</span> <strong>${invoiceId}</strong></span>
          </div>

          <!-- Row 2: Cashier/Salesman (Left) | Attending Doctor / City (Right) -->
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span><span style="color: #4b5563; font-weight: 500;">${isWholesale ? "Salesman :" : "Cashier :"}</span> <strong>${isWholesale ? (salesman || cashierName) : cashierName}</strong></span>
            ${isWholesale 
              ? (city ? `<span><span style="color: #4b5563; font-weight: 500;">City :</span> <strong>${city}</strong></span>` : `<span></span>`) 
              : (docName ? `<span><span style="color: #4b5563; font-weight: 500;">Doctor :</span> <strong>${docName}</strong></span>` : `<span></span>`)}
          </div>

          <!-- Row 3: Customer / Party (Left) | Party Code (Right) -->
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span><span style="color: #4b5563; font-weight: 500;">${isWholesale ? "Party / Store :" : "Customer :"}</span> <strong>${customerName}</strong></span>
            ${isWholesale && partyCode ? `<span><span style="color: #4b5563; font-weight: 500;">Party Code :</span> <strong>${partyCode}</strong></span>` : `<span></span>`}
          </div>

          <!-- Extra Details (Token # in Retail / Transport & Bilty in Wholesale) -->
          ${tokenNo ? `
          <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 2px;">
            <span style="border: 1.5px solid #000; color: #000; font-size: 12px; font-weight: 800; padding: 1px 7px; border-radius: 4px; font-family: monospace; background: #fff;">Token #: ${tokenNo}</span>
          </div>` : ""}

          ${isWholesale && (transport || biltyNo) ? `
          <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 11.5px; color: #333; margin-top: 2px;">
            <span><span style="color: #4b5563; font-weight: 500;">Transport :</span> ${transport || "-"}</span>
            <span><span style="color: #4b5563; font-weight: 500;">Bilty # :</span> ${biltyNo || "-"}</span>
          </div>` : ""}
        </div>` : ""}

        ${showDiv1 ? `<div class="dotted-line"></div>` : ""}

        <!-- Items Table (items_table block) -->
        ${showItems ? itemsHtml : ""}

        ${showDiv2 ? `<div class="dotted-line"></div>` : ""}

        <!-- Totals (financial_totals block) -->
        ${showTotals ? `
        <div style="font-size: 12.5px; color: #000; font-weight: 500; line-height: 1.35;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal</span>
            <span>Rs. ${Number(subtotal).toFixed(2)}</span>
          </div>
          ${docFee > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #374151; font-size: 11px;">
            <span>Dr. Fee (${docName || "Consultant"}):</span>
            <span>Rs. ${Number(docFee).toFixed(2)}</span>
          </div>
          ${docFeeWaived ? `
          <div style="display: flex; justify-content: space-between; color: #be123c; font-size: 11px; font-weight: 700;">
            <span>Dr. Fee Waived (Free):</span>
            <span>- Rs. ${Number(docFee).toFixed(2)}</span>
          </div>` : ""}
          ` : ""}
          ${posFee > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #374151; font-size: 11px;">
            <span>POS Charges:</span>
            <span>Rs. ${Number(posFee).toFixed(2)}</span>
          </div>` : ""}
          ${discount > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #0f766e; font-weight: 600;">
            <span>Discount</span>
            <span>- Rs. ${Number(discount).toFixed(2)}</span>
          </div>` : ""}
          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; color: #000; padding-top: 2px; border-top: 1px solid #000; margin-top: 2px;">
            <span>Grand Total</span>
            <span>Rs. ${Number(netTotal).toFixed(2)}</span>
          </div>
          ${prevBalance > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #991b1b; margin-top: 1px;">
            <span>Previous Balance:</span>
            <span>Rs. ${Number(prevBalance).toFixed(2)}</span>
          </div>` : ""}
          ${isCredit ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #b45309; margin-top: 2px;">
            <span>Payment</span>
            <span>Credit / Udhaar</span>
          </div>` : (cashTendered > 0 || changeDue > 0) ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #4b5563; margin-top: 1px;">
            <span>Cash Paid</span>
            <span>Rs. ${Number(cashTendered).toFixed(2)}</span>
          </div>
          ${changeDue > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #0f766e;">
            <span>Change Return</span>
            <span>Rs. ${Number(changeDue).toFixed(2)}</span>
          </div>` : ""}` : ""}
        </div>` : ""}

        <div class="dotted-line"></div>

        <!-- Custom Note (custom_note block) -->
        ${showNote ? `
        <div style="text-align: center; margin: 4px 0 3px 0; font-size: 11px; font-weight: 600; color: #000; line-height: 1.35;">
          ${escapeHtml(cfg.custom_policy_note || (isWholesale ? "Thank You for Your Wholesale Order!" : "Thank You. Please Visit Again."))}
        </div>` : ""}

        <!-- Footer Disclaimer (Light Urdu in Noto Nastaliq Urdu) -->
        ${(showUrdu || cfg.show_urdu_footer || cfg.urdu_footer_text !== undefined) ? `
        <div style="border-top: 1px dashed #000; margin-top: 6px; padding-top: 4px; text-align: center;">
          <div class="urdu-disclaimer">
            ${escapeHtml((cfg.urdu_footer_text && !cfg.urdu_footer_text.toLowerCase().includes("once sold") && !cfg.urdu_footer_text.toLowerCase().includes("returned"))
              ? cfg.urdu_footer_text
              : (isWholesale ? "خریدی ہوئی دوا یا سامان واپس یا تبدیل نہیں ہوگا۔" : "خریدی ہوئی دوا واپس یا تبدیل نہیں ہوگی۔")
            )}
          </div>
        </div>` : ""}

        <!-- Doctor Signature Line -->
        ${getDoctorSignatureHtml()}

        <!-- Powered By (permanent — always shown) -->
        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;
}

export function printThermalReceipt(sale, clinicData = null) {
  if (!sale) return;
  const invoiceId = escapeHtml(sale.receipt_no || sale.voucher_no || sale.id || `POS-${Math.floor(1000 + Math.random() * 9000)}`);
  const receiptHtml = generateSaleInvoiceReceiptHtml(sale, clinicData);
  executeThermalPrint(receiptHtml, `Receipt_${invoiceId}`);
}

export const printSaleInvoiceReceipt = printThermalReceipt;

/** Print 80mm Daily Day-End Cash Closure & DrCreate Day Closing Receipt */
export function printDayEndClosingReceipt(closing, clinicData = null) {
  if (!closing) return;

  // Read block visibility saved by Receipt Studio for closing mode
  const _blocks      = getBlocksConfig("closing");
  const showLogo     = isBlockEnabled(_blocks, "header_logo");
  const showTagline  = isBlockEnabled(_blocks, "tagline");
  const showContact  = isBlockEnabled(_blocks, "contact_info");
  const showMeta     = isBlockEnabled(_blocks, "meta_info");
  const showCustomer = isBlockEnabled(_blocks, "customer_info");
  const showItems    = isBlockEnabled(_blocks, "items_table");
  const showTotals   = isBlockEnabled(_blocks, "financial_totals");
  const showUrdu     = isBlockEnabled(_blocks, "urdu_footer");
  const showNote     = isBlockEnabled(_blocks, "custom_note");
  const cfg          = getCustomReceiptConfig();

  const pkOptions = { timeZone: "Asia/Karachi" };
  const closingDateRaw = closing.date || closing.closing_date;
  const dateStr = closingDateRaw
    ? new Date(closingDateRaw + "T00:00:00").toLocaleDateString("en-CA", pkOptions)
    : new Date().toLocaleDateString("en-CA", pkOptions);

  // Auto-fetch structured closing data if items are missing or not passed
  let autoClosing = null;
  const hasPaidItems = Array.isArray(closing.payments_paid?.items) && closing.payments_paid.items.length > 0;
  const hasRecItems = Array.isArray(closing.payments_received?.items) && closing.payments_received.items.length > 0;
  const hasSales = Boolean(closing.sales?.total !== undefined);
  const hasPurchases = Boolean(closing.purchases?.total !== undefined);

  if (!hasPaidItems || !hasRecItems || !hasSales || !hasPurchases) {
    try {
      autoClosing = dbDayClosing.getDayClosingData(closingDateRaw || dateStr);
    } catch (e) {
      console.warn("Auto-loading DayClosingData fallback in printDayEndClosingReceipt:", e);
    }
  }

  // Structured sale / purchase / payments data (matches DayClosingReceiptModal shape)
  const sales     = (hasSales ? closing.sales : (autoClosing?.sales || closing.sales)) || {};
  const purchases = (hasPurchases ? closing.purchases : (autoClosing?.purchases || closing.purchases)) || {};
  const paidItems = (hasPaidItems ? closing.payments_paid.items : (autoClosing?.payments_paid?.items || []));
  const recItems  = (hasRecItems ? closing.payments_received.items : (autoClosing?.payments_received?.items || []));

  const saleTotal      = Number(sales.total    ?? autoClosing?.sales?.total ?? (Number(closing.pharmacy_sales || 0) + Number(closing.wholesale_b2b || closing.wholesale_sales || 0)));
  const saleCash       = Number(sales.cash     ?? autoClosing?.sales?.cash ?? saleTotal);
  const saleCredit     = Number(sales.credit   ?? autoClosing?.sales?.credit ?? Math.max(0, saleTotal - saleCash));
  const purchaseTotal  = Number(purchases.total  ?? autoClosing?.purchases?.total ?? Number(closing.supplier_payments || 0));
  const purchaseCash   = Number(purchases.cash   ?? autoClosing?.purchases?.cash ?? purchaseTotal);
  const purchaseCredit = Number(purchases.credit ?? autoClosing?.purchases?.credit ?? Math.max(0, purchaseTotal - purchaseCash));
  const paidTotal      = Number(closing.payments_paid?.total ?? autoClosing?.payments_paid?.total ?? closing.daily_expenses ?? closing.expenses ?? 0);
  const recTotal       = Number(closing.payments_received?.total ?? autoClosing?.payments_received?.total ?? (Number(closing.opd_fees || 0) + Number(closing.wholesale_b2b || 0)));
  const openingCash    = Number(closing.opening_cash || 0);
  const closingCash    = Number(closing.closing_cash ?? autoClosing?.closing_cash ?? closing.net_cash_in_hand ?? closing.expected_cash ?? (openingCash + saleCash + recTotal - purchaseCash - paidTotal));

  const paidItemsHtml = paidItems.length > 0
    ? paidItems.map(it => `
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#000;">
        <span style="font-weight:800;max-width:48mm;word-break:break-word;">${escapeHtml(it.account_name || "Expense")}${it.naration ? ` <span style="font-weight:normal;color:#333;">(${escapeHtml(it.naration)})</span>` : ""}</span>
        <span style="font-weight:900;color:#000;font-family:monospace;font-size:14px;">Rs. ${Number(it.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>`).join("")
    : `<div style="font-size:12px;color:#444;text-align:center;padding:3px 0;">No payments paid on this date.</div>`;

  const recItemsHtml = recItems.length > 0
    ? recItems.map(it => `
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#000;">
        <span style="font-weight:800;max-width:48mm;word-break:break-word;">${escapeHtml(it.account_name || "Receipt")}${it.naration ? ` <span style="font-weight:normal;color:#333;">(${escapeHtml(it.naration)})</span>` : ""}</span>
        <span style="font-weight:900;color:#000;font-family:monospace;font-size:14px;">Rs. ${Number(it.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>`).join("")
    : `<div style="font-size:12px;color:#444;text-align:center;padding:3px 0;">No cash payments received on this date.</div>`;

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>DayClosing_${dateStr}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          @media print {
            @page { size: 80mm auto; margin: 0mm !important; }
            html, body { width: 78mm !important; max-width: 78mm !important; margin: 0 auto !important; padding: 1mm !important; }
            .no-print { display: none !important; }
          }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            width: 78mm;
            margin: 0 auto;
            padding: 2mm 1.5mm;
            color: #000;
            background: #fff;
            font-size: 13.5px;
            line-height: 1.35;
            font-weight: 600;
          }
          .dotted { border-top: 1px dashed #000; margin: 6px 0; }
        </style>
      </head>
      <body>
        <!-- Clinic Header -->
        ${getLogoHeaderHtml("", { showLogo, showTagline, showContact })}

        <!-- Top Date & Time & Closing Receipt Header (Matching MS Access DrCreate Format) -->
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13.5px;font-weight:900;color:#000;margin:6px 0 2px 0;">
          <span>Date</span>
          <span style="font-family:monospace;font-weight:900;">${dateStr} <span style="font-size:12px;font-weight:700;color:#333;margin-left:5px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></span>
        </div>
        <div style="text-align:center;font-size:17px;font-weight:900;font-family:serif;color:#000;margin:2px 0 6px 0;letter-spacing:0.5px;">
          Closing Receipt
        </div>

        <div class="dotted"></div>

        <!-- items_table block = Sale / Purchase / Payments boxes -->
        ${showItems ? `

        <!-- 1. SALE -->
        ${openingCash > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13.5px;font-weight:900;color:#000;padding:2px 0;"><span>Opening Drawer Float:</span><span>Rs. ${openingCash.toLocaleString("en-US",{minimumFractionDigits:2})}</span></div>` : ""}
        <div style="margin: 6px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:900;color:#000;">
            <span style="font-family:serif;">Sale</span>
            <span style="font-family:monospace;font-size:16px;">Rs. ${saleTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
          <div style="font-size:13.5px;color:#000;padding-left:4px;">
            <div style="display:flex;justify-content:space-between;padding:1px 0;"><span>Cash</span><span style="font-weight:900;font-family:monospace;">Rs. ${saleCash.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
            <div style="display:flex;justify-content:space-between;padding:1px 0;"><span>Credit</span><span style="font-weight:900;font-family:monospace;color:#000;">Rs. ${saleCredit.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
          </div>
        </div>

        <!-- 2. PURCHASE -->
        <div style="margin: 6px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:900;color:#000;">
            <span style="font-family:serif;">Purchase</span>
            <span style="font-family:monospace;font-size:16px;">Rs. ${purchaseTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
          <div style="font-size:13.5px;color:#000;padding-left:4px;">
            <div style="display:flex;justify-content:space-between;padding:1px 0;"><span>Cash</span><span style="font-weight:900;font-family:monospace;">Rs. ${purchaseCash.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
            <div style="display:flex;justify-content:space-between;padding:1px 0;"><span>Credit</span><span style="font-weight:900;font-family:monospace;color:#000;">Rs. ${purchaseCredit.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
          </div>
        </div>

        <!-- 3. PAYMENT PAID -->
        <div style="margin: 6px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:900;color:#000;">
            <span style="font-family:serif;">Payment Paid</span>
            <span style="font-family:monospace;font-size:16px;">Rs. ${paidTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:900;border-bottom:1px dotted #000;padding:2px 0 2px 4px;color:#333;margin-bottom:2px;">
            <span>Account Name</span>
            <span>Amount</span>
          </div>
          <div style="padding-left:4px;">
            ${paidItemsHtml}
          </div>
        </div>

        <!-- 4. PAYMENT RECEIVE -->
        <div style="margin: 6px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:900;color:#000;">
            <span style="font-family:serif;">Payment Receive</span>
            <span style="font-family:monospace;font-size:16px;">Rs. ${recTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:900;border-bottom:1px dotted #000;padding:2px 0 2px 4px;color:#333;margin-bottom:2px;">
            <span>Account Name</span>
            <span>Amount</span>
          </div>
          <div style="padding-left:4px;">
            ${recItemsHtml}
          </div>
        </div>` : ""}

        <!-- 5. CLOSING CASH -->
        ${showTotals ? `
        <div style="margin-top:8px;padding-top:4px;border-top:2px dashed #000;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:900;color:#000;font-family:serif;padding:6px 2px;">
            <span>Closing Cash</span>
            <span style="font-family:monospace;font-size:18px;font-weight:900;color:#000;">Rs. ${closingCash.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
        </div>` : ""}

        <div class="dotted"></div>

        <!-- Urdu Footer (urdu_footer block) -->
        ${showUrdu && cfg.urdu_footer_text ? `
        <div style="border-top: 1px dashed #000; margin-top: 10px; padding-top: 4px; text-align: center; direction: rtl; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Noto Nastaliq Urdu', 'Noto Sans Arabic', 'Urdu Typesetting', 'Jameel Noori Nastaleeq', 'Segoe UI', Tahoma, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;"><div style="font-size: 13.5px; line-height: 1.4; font-weight: 500; color: #000; letter-spacing: 0.1px;">${escapeHtml(cfg.urdu_footer_text)}</div></div>
        <div class="dotted"></div>` : ""}

        <!-- Custom Policy Note (custom_note block) -->
        ${showNote && cfg.custom_policy_note ? `
        <div style="text-align:center;font-size:12px;font-weight:800;color:#000;font-style:italic;margin:4px 0;">${escapeHtml(cfg.custom_policy_note)}</div>
        <div class="dotted"></div>` : ""}

        <!-- Doctor Signature Line -->
        ${getDoctorSignatureHtml()}

        <!-- Powered By CliniCore (permanent) -->
        ${getWatermarkFooterHtml()}

      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `DayClosing_${dateStr}`);
}


/** Print Company / Supplier Stock Purchase Thermal Invoice */
export function printSupplierPurchaseReceipt(purchase, supplier = null, clinicData = null) {
  if (!purchase) return;
  const mergedPurchase = {
    ...purchase,
    supplier_name: supplier?.company_name || supplier?.name || purchase.supplier_name || "Company Distributor",
  };
  return printPurchaseGRNReceipt(mergedPurchase, clinicData);
}

/** Print DrCreate & Access CashBook Thermal Voucher (80mm ESC/POS) */
export function printCashVoucherReceipt(entry, clinicData = null) {
  if (!entry) return;

  const isReceive = (entry.term || entry.type) === "Receive";
  const voucherTitle = isReceive ? "CASH RECEIPT VOUCHER" : "CASH PAYMENT VOUCHER";
  const voucherNo = escapeHtml(entry.voucher_no || "C-5160");
  const accountName = escapeHtml(entry.account_name || "Cash In Hand");
  const naration = escapeHtml(entry.naration || entry.description || "General Cash Transaction");
  const cashierName = escapeHtml(entry.cashier || entry.created_by || entry.user_name || clinicData?.cashier_name || "Admin / Cashier");
  const amount = Number(entry.amount) || 0;

  const rawDate = entry.date ? new Date(entry.date) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>CashVoucher_${voucherNo}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            width: 76mm;
            margin: 0 auto;
            padding: 4px 4px;
            color: #000;
            background: #fff;
            font-size: 11px;
            line-height: 1.35;
          }
          .dashed-line { border-top: 1px dashed #000; margin: 5px 0; }
          .meta-text { font-size: 10.5px; color: #000; line-height: 1.5; }
          .sign-row {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            padding-top: 4px;
            font-size: 9.5px;
            font-weight: 700;
            color: #000;
          }
          @media print { body { width: 76mm; padding: 2px; } .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <!-- Top Clinic Header with Header Image -->
        ${getLogoHeaderHtml("")}

        <!-- Clean Unboxed Voucher Title -->
        <div style="font-size: 12.5px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; margin: 3px 0 5px 0; padding: 3px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; font-family: monospace;">
          ${voucherTitle}
        </div>

        <!-- Voucher Details -->
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; font-size: 11px;">
          <div><strong>Voucher #:</strong> <span style="font-size: 13px; font-weight: 900; font-family: monospace;">${voucherNo}</span></div>
          <div style="font-weight: 800; font-size: 10.5px; text-transform: uppercase; color: #000;">${isReceive ? 'RECEIPT (CASH IN)' : 'PAYMENT (CASH OUT)'}</div>
        </div>

        <div class="meta-text">
          <div><span style="font-weight: 700;">Date &amp; Time :</span> ${dateTimeStr}</div>
          <div><span style="font-weight: 700;">Account Name :</span> <span style="font-size: 11.5px; font-weight: 900; color: #000;">${accountName}</span></div>
          <div><span style="font-weight: 700;">Narration :</span> ${naration}</div>
          <div><span style="font-weight: 700;">Cashier :</span> <span style="font-weight: 800; color: #000;">${cashierName}</span></div>
        </div>

        <!-- Prominent Clean Amount Display (No Boxes) -->
        <div style="margin: 8px 0; padding: 6px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 11px; font-weight: 800; text-transform: uppercase;">${isReceive ? 'TOTAL CASH RECEIVED :' : 'TOTAL CASH PAID OUT :'}</span>
          <span style="font-size: 16px; font-weight: 900; font-family: monospace;">Rs. ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <!-- Signature Lines with Ample Spacing -->
        <div class="sign-row">
          <div style="border-top: 1px dashed #000; width: 44%; text-align: center; padding-top: 3px;">
            Prepared / Cashier
          </div>
          <div style="border-top: 1px dashed #000; width: 44%; text-align: center; padding-top: 3px;">
            Receiver / Party Sign
          </div>
        </div>

        ${getWatermarkFooterHtml()}

      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `CashVoucher_${voucherNo}`);
}

//** Print OPD Consultation Token Thermal Receipt - Exact Layout Standard */
export function printOPDTokenReceipt(receipt, clinicData = null) {
  if (!receipt) return;

  const _blocks    = getBlocksConfig("opd");
  const showLogo   = isBlockEnabled(_blocks, "header_logo");
  const showTagline= isBlockEnabled(_blocks, "tagline");
  const showContact= isBlockEnabled(_blocks, "contact_info");
  const cfg        = getCustomReceiptConfig();

  const tokenNo = escapeHtml(String(receipt.token || receipt.token_number || "01"));
  const patientName = escapeHtml(receipt.patient?.full_name || receipt.patient_name || "Patient");
  const fee = Number(receipt.fee != null ? receipt.fee : (receipt.visit?.fee_amount || 0));

  const rawDate = receipt.registeredAt ? new Date(receipt.registeredAt) : new Date();
  const dateFormatted = `${rawDate.getMonth() + 1}/${rawDate.getDate()}/${rawDate.getFullYear()}`;
  const timeFormatted = `${String(rawDate.getHours()).padStart(2, '0')}:${String(rawDate.getMinutes()).padStart(2, '0')}`;
  const printDateTimeStr = `${dateFormatted} ${timeFormatted}`;

  const doctorName = escapeHtml(receipt.doctor?.name || receipt.visit?.doctor_name || cfg.doctor_name || "H/Dr Muhammad Asif Khan");
  const gender = escapeHtml((receipt.patient?.gender || "M").toUpperCase().charAt(0));
  const rawAge = formatPatientAge(receipt.patient);
  const age = rawAge && rawAge !== "—" ? escapeHtml(rawAge.replace(/[^0-9]/g, "") || rawAge) : "—";

  const rawLogo = showLogo && cfg.logo_base64 ? cfg.logo_base64 : CLINIC_LOGO_BASE64;
  const logoSrc = sanitizeLogoSrc(rawLogo);
  const rawPhones = cfg.phone || "0315 3696164\n0311 4234777\n0343 9376363";
  const phoneLines = rawPhones.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Token_${tokenNo}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          @media print {
            @page { size: 80mm auto; margin: 0mm !important; }
            html, body { width: 78mm !important; max-width: 78mm !important; margin: 0 auto !important; padding: 0 1.5mm 2mm 1.5mm !important; }
          }
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            width: 78mm;
            margin: 0 auto;
            padding: 0 2mm 2mm 2mm;
            color: #000;
            background: #fff;
            font-size: 13.5px;
            line-height: 1.35;
            font-weight: 500;
          }
          .divider-thin {
            border-top: 1px solid #000;
            margin: 3px 0;
          }
        </style>
      </head>
      <body>
        <!-- Top Receipt Header Banner -->
        ${getLogoHeaderHtml()}

        <!-- Print Date & Time Row -->
        <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; color: #000; padding: 1px 0 2px 0;">
          <span>Print Date &amp; Time</span>
          <span style="font-family: monospace; font-size: 11.5px; font-weight: 600;">${printDateTimeStr}</span>
        </div>

        <div class="divider-thin"></div>

        <!-- Doctor & Appointment No Center Block -->
        <div style="text-align: center; padding: 3px 0;">
          <div style="font-size: 15.5px; font-weight: 700; color: #000; letter-spacing: -0.2px;">
            ${doctorName}
          </div>
          <div style="font-size: 13px; font-weight: 600; color: #000; margin-top: 1px;">
            Appointment / Token No
          </div>
          <div style="font-size: 28px; font-weight: 700; color: #000; line-height: 1; margin-top: 2px; font-family: monospace;">
            ${tokenNo}
          </div>
        </div>

        <div class="divider-thin"></div>

        <!-- Patient Demographics Rows -->
        <div style="padding: 2px 0; font-size: 12.5px; font-weight: 500; color: #000; line-height: 1.4;">
          <div style="display: flex; margin-bottom: 2px;">
            <span style="width: 110px;">Patient Name &nbsp;:</span>
            <span style="font-size: 13.5px; font-weight: 700;">${patientName}</span>
          </div>
          <div style="display: flex;">
            <div style="display: flex; width: 45%;">
              <span style="width: 48px;">Age &nbsp;:</span>
              <span>${age}</span>
            </div>
            <div style="display: flex; width: 55%;">
              <span style="width: 65px;">Gender &nbsp;:</span>
              <span>${gender}</span>
            </div>
          </div>
        </div>

        <div class="divider-thin"></div>

        <!-- Paid Fees Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 14px; font-weight: 700; color: #000;">
          <span>Paid Fees</span>
          <span style="font-family: monospace; font-size: 15px; font-weight: 700;">PKR ${Number(fee).toFixed(2)}</span>
        </div>

        <!-- THANK YOU Bottom Banner -->
        <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; text-align: center; margin-top: 3px;">
          <div style="font-size: 14px; font-weight: 700; letter-spacing: 2px; color: #000; font-family: serif, 'Times New Roman', -apple-system;">
            THANK YOU
          </div>
        </div>

        <!-- Powered By CliniCore (permanent watermark) -->
        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Token_${tokenNo}`);
}

/** Print Product Stock Movement & Traceability Card (80mm / Low-Ink Minimalist) */
export function printProductStockCard(item, transactions = [], summary = {}, clinicData = null) {
  if (!item) return;

  const clinicName = escapeHtml(clinicData?.name || "H/Dr.Asif Ashraf Khan Clinic");
  const clinicAddress = escapeHtml(clinicData?.address || "Lajpat Road, Hyderabad");
  const clinicPhone = escapeHtml(clinicData?.phone || "0300-1234567");
  const rawDate = new Date();
  const dateTimeStr = rawDate.toLocaleString("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const rowsHtml = (transactions || []).map((tx) => {
    let typeLabel = "TX";
    if (tx.type === "PURCHASE") typeLabel = "Inward Buy";
    else if (tx.type === "WHOLESALE_B2B") typeLabel = "Wholesale";
    else if (tx.type === "RETAIL_SALE") typeLabel = "Retail POS";
    else if (tx.type === "INTERNAL_TRANSFER") typeLabel = "Shift";

    return `
      <tr style="border-bottom: 1px dotted #888;">
        <td style="padding: 3px 2px; font-size: 10px;">${escapeHtml(tx.date ? tx.date.split('T')[0] : '—')}</td>
        <td style="padding: 3px 2px; font-size: 10px; font-weight: bold;">${escapeHtml(typeLabel)}</td>
        <td style="padding: 3px 2px; font-size: 10px;">${escapeHtml(tx.party_name || tx.destination || '—')}</td>
        <td style="padding: 3px 2px; font-size: 10px; text-align: center; font-weight: bold;">${tx.qty_in > 0 ? '+' + tx.qty_in : (tx.qty_out > 0 ? '-' + tx.qty_out : '0')}</td>
        <td style="padding: 3px 2px; font-size: 10px; text-align: right; font-weight: bold;">Rs. ${Number(tx.total_amount || 0).toLocaleString()}</td>
      </tr>
    `;
  }).join("");

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>StockCard_${escapeHtml(item.medicine_name)}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            width: 76mm;
            margin: 0 auto;
            padding: 4px 3px;
            color: #000;
            background: #fff;
            font-size: 10px;
            line-height: 1.2;
          }
          .text-center { text-align: center; }
          .divider-single { border-top: 1px solid #000; margin: 3px 0; }
          .divider-double { border-top: 2px double #000; margin: 3px 0; }
          .divider-dashed { border-top: 1px dashed #000; margin: 3px 0; }
          .summary-box {
            border: 1px solid #000;
            padding: 2px 3px;
            margin: 3px 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1px 4px;
            font-size: 9px;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 2px; }
          th { text-align: left; font-size: 9px; border-bottom: 1px solid #000; padding: 1px 2px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          ${getLogoHeaderHtml("Product Stock Audit Card")}
          <div style="font-size: 10px; color: #444;">${dateTimeStr}</div>
        </div>

        <div class="divider-double"></div>

        <div style="font-size: 14px; font-weight: 900;">${escapeHtml(item.medicine_name)}</div>
        ${(item.product_description || item.generic_name || item.naration) ? `<div style="font-size: 10px; color: #444; font-style: italic; margin-top: 1px;">${escapeHtml(item.product_description || item.generic_name || item.naration)}</div>` : ""}
        <div style="font-size: 10px; color: #333; margin-top: 1px;">
          Code: <strong>${escapeHtml(item.item_code || 'GEN')}</strong> | Category: <strong>${escapeHtml(item.category || 'Homeopathic')}</strong>
        </div>

        <div class="summary-box">
          <div>Available Stock: <strong>${summary.warehouse_stock || summary.store_stock || summary.total_base_stock || 0}</strong></div>
          <div>Total Inward: <strong>+${summary.total_purchased || 0}</strong></div>
          <div>Wholesale Sold: <strong>-${summary.total_sold_wholesale || 0}</strong></div>
          <div>Retail Sold: <strong>-${summary.total_sold_retail || 0}</strong></div>
        </div>

        <div class="divider-dashed"></div>

        <div style="font-size: 10px; font-weight: 900; text-transform: uppercase;">Stock Movements History:</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Source / Dest</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding: 6px;">No transactions recorded</td></tr>'}
          </tbody>
        </table>

        <div class="divider-single"></div>

        ${getWatermarkFooterHtml()}


      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `StockCard_${escapeHtml(item.medicine_name)}`);
}

/**
 * 80mm ESC/POS Thermal & Standard Print: Inventory Stock List (DrCreate & Access Format)
 */
export function printInventoryListReceipt(items = [], categoryName = "All Categories", clinic = null) {
  const cName = clinic?.name || "CliniCore Pharmacy & Clinic";
  const dateStr = new Date().toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });

  const rowsHtml = (items || []).map((item) => {
    const stock = Number(item.total_base_stock ?? item.stock_qty ?? 0);
    return `
      <tr>
        <td style="font-weight: bold; font-size: 10px; max-width: 140px; word-break: break-word;">${escapeHtml(item.medicine_name)}</td>
        <td style="text-align: center; font-size: 9px; font-mono: true;">${escapeHtml(item.item_code || "-")}</td>
        <td style="text-align: right; font-weight: 800; font-size: 10px;">${stock}</td>
      </tr>
    `;
  }).join("");

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Inventory List — ${escapeHtml(categoryName)}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          body {
            font-family: 'Courier New', Courier, monospace, system-ui;
            font-size: 10px;
            line-height: 1.2;
            width: 72mm;
            margin: 0 auto;
            padding: 4px;
            color: #000;
            background: #fff;
          }
          .divider-dashed { border-top: 1px dashed #000; margin: 4px 0; }
          .divider-single { border-top: 1px solid #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 3px; }
          th { border-bottom: 1px solid #000; padding: 2px 0; text-align: left; font-size: 9px; text-transform: uppercase; font-weight: 900; }
          td { padding: 2px 0; border-bottom: 0.5px dotted #ddd; vertical-align: top; }
        </style>
      </head>
      <body>
        ${getLogoHeaderHtml("INVENTORY STOCK LIST")}
        <div style="font-size: 9px; text-align: center; margin-top: 2px;">
          <div><strong>Category / Filter:</strong> ${escapeHtml(categoryName)}</div>
          <div><strong>Print Date:</strong> ${dateStr} · <strong>Items:</strong> ${items.length}</div>
        </div>

        <div class="divider-dashed"></div>

        <table>
          <thead>
            <tr>
              <th style="width: 58%;">Item Name</th>
              <th style="width: 22%; text-align: center;">Code</th>
              <th style="width: 20%; text-align: right;">Level</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="3" style="text-align:center; padding: 8px;">No items found</td></tr>'}
          </tbody>
        </table>

        <div class="divider-single"></div>
        <div style="text-align: center; font-size: 9px; font-weight: bold; margin-top: 3px;">
          Total Products in List: ${items.length}
        </div>
        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Inventory_List_${escapeHtml(categoryName)}`);
}

/**
 * 80mm ESC/POS Thermal & Standard Print: Product Pricing List (DrCreate & Access Format)
 */
export function printProductPricingListReceipt(items = [], categoryName = "All Categories", clinic = null) {
  const dateStr = new Date().toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });

  const rowsHtml = (items || []).map((item) => {
    const sale = Number(item.unit_sale_price || item.box_sale_price || item.unit_price || 0);
    const cost = Number(item.cost_price_per_box || item.purchase_price || (sale * 0.7));
    const stock = Number(item.total_base_stock ?? item.stock_qty ?? 0);
    return `
      <tr>
        <td style="font-weight: bold; font-size: 10px; max-width: 110px; word-break: break-word;">${escapeHtml(item.medicine_name)}</td>
        <td style="font-size: 9px; text-align: center;">${escapeHtml(item.item_code || "-")}</td>
        <td style="font-size: 9px; text-align: center;">${stock}</td>
        <td style="text-align: right; font-weight: 800; font-size: 10px;">Rs.${sale}</td>
        <td style="text-align: right; font-size: 9px; color: #444;">Rs.${cost}</td>
      </tr>
    `;
  }).join("");

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Product Pricing List</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          body {
            font-family: 'Courier New', Courier, monospace, system-ui;
            font-size: 9.5px;
            line-height: 1.2;
            width: 72mm;
            margin: 0 auto;
            padding: 4px;
            color: #000;
            background: #fff;
          }
          .divider-dashed { border-top: 1px dashed #000; margin: 4px 0; }
          .divider-single { border-top: 1px solid #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 3px; }
          th { border-bottom: 1px solid #000; padding: 2px 0; text-align: left; font-size: 8.5px; text-transform: uppercase; font-weight: 900; }
          td { padding: 2px 0; border-bottom: 0.5px dotted #ddd; vertical-align: top; }
        </style>
      </head>
      <body>
        ${getLogoHeaderHtml("PRODUCT PRICING LIST")}
        <div style="font-size: 9px; text-align: center; margin-top: 2px;">
          <div><strong>Filter:</strong> ${escapeHtml(categoryName)} · <strong>Date:</strong> ${dateStr}</div>
        </div>

        <div class="divider-dashed"></div>

        <table>
          <thead>
            <tr>
              <th style="width: 38%;">Product</th>
              <th style="width: 14%; text-align: center;">Code</th>
              <th style="width: 12%; text-align: center;">Qty</th>
              <th style="width: 18%; text-align: right;">Sale</th>
              <th style="width: 18%; text-align: right;">Cost</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding: 8px;">No items found</td></tr>'}
          </tbody>
        </table>

        <div class="divider-single"></div>
        <div style="text-align: center; font-size: 9px; font-weight: bold; margin-top: 3px;">
          Total Products: ${items.length}
        </div>
        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Pricing_List_${escapeHtml(categoryName)}`);
}

/**
 * 80mm ESC/POS Thermal & Standard Print: Zero-Pilferage Blind Stock Physical Count Sheet
 */
export function printBlindStockAuditSheet(items = [], companyFilter = "All", clinic = null) {
  const dateStr = new Date().toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
  const companyLabel = !companyFilter || companyFilter.toLowerCase() === "all" ? "All Companies" : companyFilter;

  const rowsHtml = (items || []).map((item, idx) => {
    const packing = item.packing || item.unit_label || "";
    const comp = item.company_name || "General";
    return `
      <tr>
        <td style="font-weight: 800; font-size: 9px; text-align: center; border: 0.5px solid #000; padding: 3px 2px;">${idx + 1}</td>
        <td style="padding: 3px 4px; font-weight: bold; font-size: 9.5px; line-height: 1.2; border: 0.5px solid #000;">
          <div style="font-size: 10px; font-weight: 900; color: #000;">${escapeHtml(item.medicine_name)}</div>
          <div style="font-size: 8px; font-weight: 600; color: #333; margin-top: 1px;">
            ${escapeHtml(comp)}${packing ? ` · ${escapeHtml(packing)}` : ""}${item.item_code ? ` · [${escapeHtml(item.item_code)}]` : ""}
          </div>
        </td>
        <td style="border: 1.5px solid #000; width: 22mm; text-align: center; height: 18px; background: #fff;">
          <!-- Blank Physical Count write-in box -->
        </td>
        <td style="border: 0.5px solid #000; width: 8mm; text-align: center; font-size: 9px; font-weight: bold;">
          [ ]
        </td>
      </tr>
    `;
  }).join("");

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Physical Stock Count Sheet — ${escapeHtml(companyLabel)}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          body {
            font-family: 'Courier New', Courier, monospace, system-ui;
            font-size: 9.5px;
            line-height: 1.2;
            width: 72mm;
            margin: 0 auto;
            padding: 4px;
            color: #000;
            background: #fff;
          }
          .divider-dashed { border-top: 1px dashed #000; margin: 4px 0; }
          .divider-single { border-top: 1px solid #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 3px; }
          th { border: 1px solid #000; padding: 3px 2px; text-align: left; font-size: 8.5px; text-transform: uppercase; font-weight: 900; background: #e2e8f0; color: #000; }
          td { vertical-align: middle; }
        </style>
      </head>
      <body>
        ${getLogoHeaderHtml("PHYSICAL STOCK COUNT SHEET")}
        <div style="font-size: 8.5px; text-align: center; margin-top: 2px; line-height: 1.3; color: #000;">
          <div style="font-weight: 900; font-size: 9px; text-transform: uppercase;">Zero-Pilferage Blind Shelf Audit</div>
          <div><strong>Company / Filter:</strong> ${escapeHtml(companyLabel)}</div>
          <div><strong>Print Date:</strong> ${dateStr} · <strong>Total SKUs:</strong> ${items.length}</div>
        </div>

        <div class="divider-dashed"></div>

        <table>
          <thead>
            <tr>
              <th style="width: 8%; text-align: center;">#</th>
              <th style="width: 60%;">Medicine Particulars</th>
              <th style="width: 24%; text-align: center;">Physical Qty</th>
              <th style="width: 8%; text-align: center;">OK</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="4" style="text-align:center; padding: 10px; font-weight: bold; border: 1px solid #000;">No medicines found for this company</td></tr>'}
          </tbody>
        </table>

        <div class="divider-single"></div>

        <div style="margin-top: 6px; font-size: 8px; line-height: 1.3; color: #000;">
          <div><strong>Instructions:</strong> Count physical bottles/strips on shelf. Enter exact count in boxes.</div>
        </div>

        <div style="margin-top: 16px; font-size: 8.5px; color: #000;">
          <table style="width: 100%; border: none;">
            <tr style="border: none;">
              <td style="border: none; width: 50%; padding: 0;">
                <div>Auditor Sign:</div>
                <div style="margin-top: 14px; border-top: 1px dashed #000; width: 85%;"></div>
              </td>
              <td style="border: none; width: 50%; padding: 0; text-align: right;">
                <div>Supervisor Sign:</div>
                <div style="margin-top: 14px; border-top: 1px dashed #000; width: 85%; margin-left: auto;"></div>
              </td>
            </tr>
          </table>
        </div>

        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Audit_Count_Sheet_${escapeHtml(companyLabel)}`);
}

/**
 * 80mm ESC/POS Thermal Print for Chart Of Accounts (DrCreate & Access Form Format)
 */
export function printChartOfAccountsReceipt(accounts = [], filterType = "All", clinic = null) {
  const clinicName = clinic?.name || "H/Dr.Asif Ashraf Khan Clinic";
  const dateStr = new Date().toLocaleDateString("en-GB");

  const rowsHtml = accounts
    .map(
      (a) => `
        <tr>
          <td style="font-weight: 700; max-width: 38mm; word-break: break-word;">${escapeHtml(a.account_name)}</td>
          <td style="text-align: center; font-family: monospace; font-weight: 700;">${a.account_no || "-"}</td>
          <td style="text-align: right; font-weight: 600;">${escapeHtml(a.account_type || "-")}</td>
        </tr>
      `
    )
    .join("");

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Chart Of Accounts List</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          body {
            font-family: 'Courier New', Courier, monospace, system-ui;
            font-size: 9.5px;
            line-height: 1.2;
            width: 72mm;
            margin: 0 auto;
            padding: 4px;
            color: #000;
            background: #fff;
          }
          .divider-dashed { border-top: 1px dashed #000; margin: 4px 0; }
          .divider-single { border-top: 1px solid #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 3px; }
          th { border-bottom: 1px solid #000; padding: 2px 0; text-align: left; font-size: 8.5px; text-transform: uppercase; font-weight: 900; }
          td { padding: 2px 0; border-bottom: 0.5px dotted #ddd; vertical-align: top; }
        </style>
      </head>
      <body>
        ${getLogoHeaderHtml("CHART OF ACCOUNTS LIST")}
        <div style="font-size: 9px; text-align: center; margin-top: 2px;">
          <div><strong>Category / Route:</strong> ${escapeHtml(filterType)} · <strong>Date:</strong> ${dateStr}</div>
        </div>

        <div class="divider-dashed"></div>

        <table>
          <thead>
            <tr>
              <th style="width: 50%;">Account Name</th>
              <th style="width: 20%; text-align: center;">No</th>
              <th style="width: 30%; text-align: right;">Type / Route</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="3" style="text-align:center; padding: 8px;">No accounts found</td></tr>'}
          </tbody>
        </table>

        <div class="divider-single"></div>
        <div style="text-align: center; font-size: 9px; font-weight: bold; margin-top: 3px;">
          Total Registered Accounts: ${accounts.length}
        </div>
        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Chart_Of_Accounts_${escapeHtml(filterType)}`);
}

/**
 * 80mm ESC/POS Thermal Print for Stock Movement Ledger (DrCreate High-Definition Table Format)
 */
export function printStockLedgerReceipt(medicineName, timeline = [], clinic = null) {
  const printDateStr = new Date().toLocaleDateString("en-GB") + " " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const totalIn = timeline.reduce((s, r) => s + (Number(r.total_in) || 0), 0);
  const totalOut = timeline.reduce((s, r) => s + (Number(r.total_out) || 0), 0);
  const netBalance = totalIn - totalOut;

  // Running balance tracker
  let runningBal = 0;
  const rowsHtml = timeline
    .map((r, idx) => {
      const dayIn = Number(r.total_in) || 0;
      const dayOut = Number(r.total_out) || 0;
      runningBal += (dayIn - dayOut);
      return `
        <tr style="border-bottom: 1px solid #000;">
          <td style="padding: 4px 2px; text-align: center; font-weight: 700; border-right: 1px solid #000; font-family: monospace;">${idx + 1}</td>
          <td style="padding: 4px 3px; font-weight: 700; border-right: 1px solid #000; font-family: monospace; white-space: nowrap;">${escapeHtml(r.date)}</td>
          <td style="padding: 4px 2px; text-align: center; color: #000; font-weight: 900; border-right: 1px solid #000;">${dayIn > 0 ? `+${dayIn}` : "-"}</td>
          <td style="padding: 4px 2px; text-align: center; color: #000; font-weight: 900; border-right: 1px solid #000;">${dayOut > 0 ? `-${dayOut}` : "-"}</td>
          <td style="padding: 4px 3px; text-align: right; font-weight: 900; font-family: monospace;">${runningBal}</td>
        </tr>
      `;
    })
    .join("");

  // Collect all individual vouchers across all dates
  const allVouchers = [];
  timeline.forEach((r) => {
    (r.vouchers || []).forEach((v) => {
      allVouchers.push({ ...v, date: r.date });
    });
  });

  const vouchersTableHtml = allVouchers.length > 0 ? `
    <div style="margin-top: 8px; font-size: 11px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 2px;">
      TRANSACTION VOUCHERS AUDIT TRAIL (${allVouchers.length})
    </div>
    <table style="width: 100%; border-collapse: collapse; margin-top: 3px; border: 1.5px solid #000; font-size: 10.5px;">
      <thead>
        <tr style="background-color: #f0f0f0; border-bottom: 1.5px solid #000;">
          <th style="width: 8%; padding: 3px 2px; text-align: center; border-right: 1px solid #000; font-weight: 900;">#</th>
          <th style="width: 22%; padding: 3px 2px; text-align: left; border-right: 1px solid #000; font-weight: 900;">Date</th>
          <th style="width: 24%; padding: 3px 2px; text-align: left; border-right: 1px solid #000; font-weight: 900;">Voucher</th>
          <th style="width: 16%; padding: 3px 2px; text-align: center; border-right: 1px solid #000; font-weight: 900;">Type</th>
          <th style="width: 15%; padding: 3px 2px; text-align: center; border-right: 1px solid #000; font-weight: 900;">In</th>
          <th style="width: 15%; padding: 3px 2px; text-align: center; font-weight: 900;">Out</th>
        </tr>
      </thead>
      <tbody>
        ${allVouchers.map((v, i) => `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 3px 2px; text-align: center; border-right: 1px solid #000; font-family: monospace;">${i + 1}</td>
            <td style="padding: 3px 2px; border-right: 1px solid #000; font-family: monospace;">${escapeHtml(v.date || "")}</td>
            <td style="padding: 3px 2px; border-right: 1px solid #000; font-weight: 700; font-family: monospace;">${escapeHtml(v.voucher_no || "-")}</td>
            <td style="padding: 3px 2px; text-align: center; border-right: 1px solid #000; font-weight: 700;">${escapeHtml(v.type || "-")}</td>
            <td style="padding: 3px 2px; text-align: center; border-right: 1px solid #000; font-weight: 900;">${v.in_qty || "-"}</td>
            <td style="padding: 3px 2px; text-align: center; font-weight: 900;">${v.out_qty || "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : "";

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Stock_Ledger_${escapeHtml(medicineName)}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          @media print {
            @page { size: 80mm auto; margin: 0mm !important; }
            html, body { width: 78mm !important; max-width: 78mm !important; margin: 0 auto !important; padding: 0 1.5mm 2mm 1.5mm !important; }
            .no-print { display: none !important; }
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 11.5px;
            line-height: 1.35;
            width: 78mm;
            margin: 0 auto;
            padding: 0 2mm 2mm 2mm;
            color: #000;
            background: #fff;
            font-weight: 500;
          }
          table { width: 100%; border-collapse: collapse; }
          .meta-box {
            border: 1.5px solid #000;
            padding: 5px;
            margin: 4px 0;
            background: #fafafa;
          }
          .summary-card {
            border: 2px solid #000;
            padding: 6px;
            margin-top: 6px;
            background: #fdfdfd;
          }
        </style>
      </head>
      <body>
        ${getLogoHeaderHtml("STOCK MOVEMENT LEDGER")}
        
        <!-- Product Metadata Card -->
        <div class="meta-box">
          <div style="font-size: 13.5px; font-weight: 900; text-transform: uppercase; color: #000;">
            ${escapeHtml(medicineName)}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 2px; color: #333;">
            <span>Printed: ${printDateStr}</span>
            <span>Total Dates: ${timeline.length}</span>
          </div>
        </div>

        <!-- Daily Reconciled Movements Table -->
        <div style="margin-top: 5px; font-size: 11px; font-weight: 900; text-transform: uppercase;">
          DAILY RECONCILED LEDGER
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 2px; border: 1.5px solid #000; font-size: 11px;">
          <thead>
            <tr style="background-color: #eaeaea; border-bottom: 1.5px solid #000;">
              <th style="width: 8%; padding: 4px 2px; text-align: center; border-right: 1px solid #000; font-weight: 900;">Sr</th>
              <th style="width: 32%; padding: 4px 3px; text-align: left; border-right: 1px solid #000; font-weight: 900;">Date</th>
              <th style="width: 20%; padding: 4px 2px; text-align: center; border-right: 1px solid #000; font-weight: 900;">In (+)</th>
              <th style="width: 20%; padding: 4px 2px; text-align: center; border-right: 1px solid #000; font-weight: 900;">Out (-)</th>
              <th style="width: 20%; padding: 4px 3px; text-align: right; font-weight: 900;">Bal</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding: 10px; font-weight: 700;">No movement records found</td></tr>'}
          </tbody>
        </table>

        <!-- Optional Detailed Vouchers Breakdown -->
        ${vouchersTableHtml}

        <!-- Comprehensive Stock Balance Summary -->
        <div class="summary-card">
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; border-bottom: 1px dashed #000; padding-bottom: 3px;">
            <span>Total Lifetime Inward:</span>
            <span style="font-family: monospace; font-weight: 900;">+${totalIn} Units</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; border-bottom: 1px dashed #000; padding: 3px 0;">
            <span>Total Lifetime Outward:</span>
            <span style="font-family: monospace; font-weight: 900;">-${totalOut} Units</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 900; padding-top: 4px; color: #000;">
            <span>CURRENT NET STOCK:</span>
            <span style="font-family: monospace; font-size: 14px;">${netBalance} Units</span>
          </div>
        </div>

        <!-- Verification Signatures -->
        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dotted #999; display: flex; justify-content: space-between; font-size: 10px; font-weight: 700;">
          <div style="text-align: center; width: 45%;">
            <div style="border-bottom: 1px solid #000; height: 16px;"></div>
            <span style="margin-top: 2px; display: block;">Prepared By</span>
          </div>
          <div style="text-align: center; width: 45%;">
            <div style="border-bottom: 1px solid #000; height: 16px;"></div>
            <span style="margin-top: 2px; display: block;">Store Incharge</span>
          </div>
        </div>

        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Stock_Ledger_${escapeHtml(medicineName)}`);
}

/**
 * 80mm ESC/POS Thermal Print for Item Date History & Detailed Vouchers Breakdown
 */
export function printItemDateHistoryReceipt(medicineName, dateRow, clinic = null) {
  if (!dateRow) return;
  const printDateStr = new Date().toLocaleDateString("en-GB") + " " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const vouchers = dateRow.vouchers || [];
  const totalIn = vouchers.reduce((s, v) => s + (Number(v.in_qty) || 0), 0);
  const totalOut = vouchers.reduce((s, v) => s + (Number(v.out_qty) || 0), 0);
  const totalGross = vouchers.reduce((s, v) => s + (Number(v.gross) || (Number(v.rate || 0) * Number(v.in_qty || v.out_qty || 0))), 0);
  const totalNet = vouchers.reduce((s, v) => s + (Number(v.net) || 0), 0);

  const rowsHtml = vouchers.map((v, idx) => `
    <tr style="border-bottom: 1px solid #000;">
      <td style="padding: 4px 2px; text-align: center; font-weight: 700; border-right: 1px solid #000; font-family: monospace;">${idx + 1}</td>
      <td style="padding: 4px 2px; font-weight: 900; border-right: 1px solid #000; font-family: monospace;">
        <div>${escapeHtml(v.voucher_no || "-")}</div>
        <div style="font-size: 9.5px; font-weight: 700; color: #444;">[${escapeHtml(v.type || "-")}]</div>
      </td>
      <td style="padding: 4px 3px; border-right: 1px solid #000; font-size: 10px; font-weight: 600;">
        ${escapeHtml(v.description || "-")}
      </td>
      <td style="padding: 4px 2px; text-align: center; font-weight: 900; border-right: 1px solid #000;">${v.in_qty || "-"}</td>
      <td style="padding: 4px 2px; text-align: center; font-weight: 900; border-right: 1px solid #000;">${v.out_qty || "-"}</td>
      <td style="padding: 4px 3px; text-align: right; font-weight: 900; font-family: monospace;">${Number(v.net || 0).toLocaleString()}</td>
    </tr>
  `).join("");

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Date_History_${escapeHtml(dateRow.date || "History")}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          @media print {
            @page { size: 80mm auto; margin: 0mm !important; }
            html, body { width: 78mm !important; max-width: 78mm !important; margin: 0 auto !important; padding: 0 1.5mm 2mm 1.5mm !important; }
            .no-print { display: none !important; }
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 11.5px;
            line-height: 1.35;
            width: 78mm;
            margin: 0 auto;
            padding: 0 2mm 2mm 2mm;
            color: #000;
            background: #fff;
            font-weight: 500;
          }
          table { width: 100%; border-collapse: collapse; }
          .meta-box {
            border: 1.5px solid #000;
            padding: 5px;
            margin: 4px 0;
            background: #fafafa;
          }
          .summary-card {
            border: 2px solid #000;
            padding: 6px;
            margin-top: 6px;
            background: #fdfdfd;
          }
        </style>
      </head>
      <body>
        ${getLogoHeaderHtml("ITEM DATE HISTORY & VOUCHERS")}
        
        <div class="meta-box">
          <div style="font-size: 13.5px; font-weight: 900; text-transform: uppercase;">
            ${escapeHtml(medicineName || "Medicine Audit")}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-top: 3px;">
            <span style="font-weight: 800;">Target Date: ${escapeHtml(dateRow.date || "-")}</span>
            <span>Vouchers: ${vouchers.length}</span>
          </div>
          <div style="font-size: 10px; color: #444; margin-top: 2px;">
            Printed on: ${printDateStr}
          </div>
        </div>

        <div style="margin-top: 5px; font-size: 11px; font-weight: 900; text-transform: uppercase;">
          VOUCHER TRANSACTIONS TABLE
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 2px; border: 1.5px solid #000; font-size: 10.5px;">
          <thead>
            <tr style="background-color: #eaeaea; border-bottom: 1.5px solid #000;">
              <th style="width: 7%; padding: 4px 2px; text-align: center; border-right: 1px solid #000; font-weight: 900;">#</th>
              <th style="width: 26%; padding: 4px 2px; text-align: left; border-right: 1px solid #000; font-weight: 900;">Voucher</th>
              <th style="width: 29%; padding: 4px 2px; text-align: left; border-right: 1px solid #000; font-weight: 900;">Particulars</th>
              <th style="width: 11%; padding: 4px 2px; text-align: center; border-right: 1px solid #000; font-weight: 900;">In</th>
              <th style="width: 11%; padding: 4px 2px; text-align: center; border-right: 1px solid #000; font-weight: 900;">Out</th>
              <th style="width: 16%; padding: 4px 2px; text-align: right; font-weight: 900;">Net (Rs)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding: 10px; font-weight: 700;">No voucher details</td></tr>'}
          </tbody>
        </table>

        <!-- Daily Financial & Unit Summary -->
        <div class="summary-card">
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; border-bottom: 1px dashed #000; padding-bottom: 3px;">
            <span>Daily Inward Units:</span>
            <span style="font-family: monospace; font-weight: 900;">+${totalIn}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; border-bottom: 1px dashed #000; padding: 3px 0;">
            <span>Daily Outward Units:</span>
            <span style="font-family: monospace; font-weight: 900;">-${totalOut}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; border-bottom: 1px dashed #000; padding: 3px 0;">
            <span>Daily Gross Total:</span>
            <span style="font-family: monospace; font-weight: 900;">Rs. ${totalGross.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 900; padding-top: 4px; color: #000;">
            <span>DAILY NET VALUE:</span>
            <span style="font-family: monospace; font-size: 14px;">Rs. ${totalNet.toLocaleString()}</span>
          </div>
        </div>

        <!-- Verification Signatures -->
        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dotted #999; display: flex; justify-content: space-between; font-size: 10px; font-weight: 700;">
          <div style="text-align: center; width: 45%;">
            <div style="border-bottom: 1px solid #000; height: 16px;"></div>
            <span style="margin-top: 2px; display: block;">Prepared By</span>
          </div>
          <div style="text-align: center; width: 45%;">
            <div style="border-bottom: 1px solid #000; height: 16px;"></div>
            <span style="margin-top: 2px; display: block;">Authorized Incharge</span>
          </div>
        </div>

        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Date_History_${escapeHtml(dateRow.date || "History")}`);
}

export function printPurchaseGRNReceipt(purchase, clinic = null) {
  if (!purchase) return;

  const voucherNo = escapeHtml(purchase.invoice_no || purchase.voucher_no || "P-GRN");
  const dateStr = escapeHtml((purchase.purchase_date || purchase.created_at || new Date().toISOString()).split("T")[0]);
  const supplierName = escapeHtml(toTitleCase(purchase.supplier_name || purchase.account_name || "Company Distributor"));
  const grnNo = escapeHtml(purchase.grn_no || purchase.company_bill_no || "0");
  const transport = escapeHtml(purchase.transport || "By Hand");
  const biltyNo = escapeHtml(purchase.bilty_no || "-");
  const reference = escapeHtml(purchase.reference || (clinic?.user_name || "Store Incharge"));
  const paymentMode = escapeHtml(purchase.payment_mode || (Number(purchase.balance_due) > 0 ? "Credit (Udhaar)" : "Cash In Hand"));

  const items = purchase.items || [];
  const itemsGross = items.reduce((sum, it) => sum + (Number(it.gross) || (Number(it.qty || it.quantity || 1) * Number(it.rate || it.cost_price || 0))), 0);
  const itemsSubtotal = items.reduce((sum, it) => sum + (Number(it.net) || Number(it.total_cost) || (Number(it.qty || it.quantity || 1) * Number(it.rate || it.cost_price || 0))), 0) || itemsGross;
  const itemsDiscount = Math.max(0, itemsGross - itemsSubtotal);
  const extraDiscount = Number(purchase.extra_discount || purchase.extra_bill_discount || 0);
  const freightCharges = Number(purchase.freight_charges || purchase.freight || 0);

  const totalBill = Number(purchase.total_amount || purchase.net_total || Math.max(0, itemsSubtotal - extraDiscount + freightCharges));
  const paidAmount = Number(purchase.paid_amount || (paymentMode === "Cash" ? totalBill : 0));
  const balanceDue = Number(purchase.balance_due ?? Math.max(0, totalBill - paidAmount));

  const itemsTableHtml = buildBorderedReceiptItemsTableHtml(items);

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Purchase_GRN_${voucherNo}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          @media print {
            @page { size: 80mm auto; margin: 0mm !important; }
            html, body { width: 78mm !important; max-width: 78mm !important; margin: 0 auto !important; padding: 0 1.5mm 2mm 1.5mm !important; }
            .no-print { display: none !important; }
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 13.5px;
            line-height: 1.35;
            width: 78mm;
            margin: 0 auto;
            padding: 0 2mm 2mm 2mm;
            color: #000;
            background: #fff;
            font-weight: 500;
          }
          table { width: 100%; border-collapse: collapse; }
          ${getThermalItemsTableCss()}
        </style>
      </head>
      <body>
        <!-- Header Banner -->
        ${getLogoHeaderHtml("STOCK PURCHASE INVOICE / GRN")}

        <!-- Meta Information -->
        <div style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; font-size: 13px; line-height: 1.35; color: #000;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; font-size: 14px;">Voucher #: ${voucherNo}</span>
            <span>Date: ${dateStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 2px; gap: 4px;">
            <span style="font-weight: 700; font-size: 14.5px;">Supplier: ${supplierName}</span>
            <span style="text-align: right; white-space: nowrap; flex-shrink: 0;">Co. Bill #: ${grnNo}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
            <span>Mode: <strong>${paymentMode}</strong></span>
            <span>Incharge: ${reference}</span>
          </div>
          ${((transport && transport !== "0" && transport !== "-") || (biltyNo && biltyNo !== "0" && biltyNo !== "-")) ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px; font-size: 12px; color: #333;">
              <span>Transport: ${transport || "By Hand"}</span>
              <span>Bilty #: ${biltyNo || "-"}</span>
            </div>
          ` : ""}
        </div>

        <!-- Items Table -->
        ${itemsTableHtml}

        <!-- Financial Totals -->
        <div style="margin-top: 6px; font-size: 13px; line-height: 1.4; color: #000;">
          <div style="display: flex; justify-content: space-between; padding: 1px 0;">
            <span>Items Gross Total:</span>
            <span style="font-family: monospace; font-weight: 600;">Rs. ${itemsGross.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ${itemsDiscount > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0; color: #166534; font-weight: 700;">
              <span>Trade Discount:</span>
              <span style="font-family: monospace;">- Rs. ${itemsDiscount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ` : ""}
          ${extraDiscount > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0; color: #166534; font-weight: 700;">
              <span>Extra Bill Discount:</span>
              <span style="font-family: monospace;">- Rs. ${extraDiscount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ` : ""}
          ${freightCharges > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>Freight / Delivery:</span>
              <span style="font-family: monospace; font-weight: 600;">+ Rs. ${freightCharges.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ` : ""}
          <div style="border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 4px 0; margin-top: 3px; display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 900;">
            <span>TOTAL BILL:</span>
            <span style="font-family: monospace; font-size: 16px;">Rs. ${totalBill.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ${paidAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 2px 0; font-weight: 700; font-size: 13.5px;">
              <span>Cash Paid:</span>
              <span style="font-family: monospace;">Rs. ${paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ` : ""}
          ${balanceDue > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 2px 0; font-weight: 900; font-size: 14px; color: #b91c1c; border-top: 1px dashed #b91c1c; margin-top: 2px;">
              <span>Payable Balance (Udhaar):</span>
              <span style="font-family: monospace;">Rs. ${balanceDue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ` : ""}
        </div>

        <!-- Verification & Signatures -->
        <div style="display: flex; justify-content: space-between; margin-top: 16px; padding-top: 4px; font-size: 11px; font-weight: 700; color: #444;">
          <span style="border-top: 1px solid #000; padding-top: 2px; width: 32mm; text-align: center;">Stock Inward Incharge</span>
          <span style="border-top: 1px solid #000; padding-top: 2px; width: 32mm; text-align: center;">Authorized Signature</span>
        </div>

        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Purchase_GRN_${voucherNo}`);
}



/**
 * Print 80mm Low-Ink Thermal Slip for Executive Financial & Pharmacy Audit (6-Mo / 1-Yr / 2-Yr / Custom)
 */
export function printExecutiveAuditReceipt(auditData, clinicData = null) {
  if (!auditData) return;

  const clinicName = escapeHtml(clinicData?.name || "H/Dr.Asif Ashraf Khan Clinic Pharmacy");
  const clinicAddress = escapeHtml(clinicData?.address || "Hyderabad, Sindh");
  const clinicPhone = escapeHtml(clinicData?.phone || "03473100304");

  const periodLabel = escapeHtml(auditData.periodLabel || "Executive Financial Audit");
  const startDate = escapeHtml(auditData.startDateStr || "");
  const endDate = escapeHtml(auditData.endDateStr || "");
  const godownLabel = escapeHtml(auditData.godownLabel || "Clinic Pharmacy & Store");

  const metrics = auditData.metrics || {};
  const totalStockValuation = Number(metrics.totalStockValuation || 0);
  const totalUnitsCount = Number(metrics.totalUnitsCount || 0);
  const totalInflows = Number(metrics.totalInflows || 0);
  const opdFeesTotal = Number(metrics.opdFeesTotal || 0);
  const posSalesTotal = Number(metrics.posSalesTotal || 0);
  const b2bSalesTotal = Number(metrics.b2bSalesTotal || 0);

  const totalOutflows = Number(metrics.totalOutflows || 0);
  const supplierPurchasesCash = Number(metrics.supplierPurchasesCash || 0);
  const expensesTotal = Number(metrics.expensesTotal || 0);
  const netOperatingSurplus = Number(metrics.netOperatingSurplus || 0);

  const isProfit = netOperatingSurplus >= 0;

  const topItems = (auditData.inventoryItems || []).slice(0, 20);
  const itemsRowsHtml = topItems.map((it) => {
    const code = escapeHtml(it.item_code || "MED");
    const name = escapeHtml(it.medicine_name || "Item");
    const brand = escapeHtml(it.company_name || "");
    const qty = Number(it.total_base_stock ?? it.stock_qty ?? (Number(it.store_stock || 0) + Number(it.warehouse_stock || 0)));
    const cost = Number(it.cost_price_per_box || it.cost_price || 0);
    const val = qty * cost;
    return `
      <tr>
        <td style="padding: 3px 0; font-size: 12.5px; vertical-align: top;">
          <div style="font-weight: 900; color: #000;">${name}</div>
          <div style="color: #333; font-size: 11px; font-weight: 700;">${code}${brand ? ` · ${brand}` : ""}</div>
        </td>
        <td style="text-align: center; font-size: 13px; font-weight: 900; vertical-align: top; padding: 3px 0;">${qty}</td>
        <td style="text-align: right; font-size: 13.5px; font-weight: 900; vertical-align: top; padding: 3px 0; font-family: monospace;">${val.toLocaleString("en-US")}</td>
      </tr>
    `;
  }).join("");

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Audit_${startDate}_to_${endDate}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          @media print {
            @page { size: 80mm auto; margin: 0mm !important; }
            html, body { width: 78mm !important; max-width: 78mm !important; margin: 0 auto !important; padding: 0 !important; }
            .no-print { display: none !important; }
          }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px;
            line-height: 1.35;
            width: 78mm;
            margin: 0 auto;
            padding: 0 1mm 2mm 1mm;
            color: #000;
            background: #fff;
          }
          .divider-dashed { border-top: 1.5px dashed #000; margin: 5px 0; }
          .divider-double { border-top: 2px solid #000; margin: 5px 0; }
          .divider-single { border-top: 1.5px solid #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th { border-bottom: 2px solid #000; padding: 3px 0; text-align: left; font-size: 12px; text-transform: uppercase; font-weight: 800; background: #f1f5f9; }
          td { border-bottom: 1px dotted #888; }
          .flex-row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 13px; font-weight: 700; }
        </style>
      </head>
      <body>
        ${getLogoHeaderHtml("EXECUTIVE CLINIC AUDIT SLIP")}

        <div style="font-size: 12.5px; font-weight: 700; margin-top: 4px;">
          <div><span style="font-weight: 900;">Audit Period:</span> ${periodLabel}</div>
          <div><span style="font-weight: 900;">Date Range:</span> ${startDate} ➔ ${endDate}</div>
          <div><span style="font-weight: 900;">Location Scope:</span> ${godownLabel}</div>
          <div><span style="font-weight: 900;">Generated On:</span> ${new Date().toLocaleString("en-US")}</div>
        </div>

        <div class="divider-dashed"></div>
        <div style="font-size: 13.5px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
          ── FINANCIAL SUMMARY ──
        </div>
        <div class="divider-dashed"></div>

        <div class="flex-row" style="font-weight: 900; font-size: 14px;">
          <span>TOTAL INFLOWS (REVENUE):</span>
          <span style="font-family: monospace;">Rs. ${totalInflows.toLocaleString("en-US")}</span>
        </div>
        <div class="flex-row" style="padding-left: 6px; color: #111; font-size: 12.5px;">
          <span>• OPD Doctor Consultations:</span>
          <span style="font-family: monospace; font-weight: 800;">Rs. ${opdFeesTotal.toLocaleString("en-US")}</span>
        </div>
        <div class="flex-row" style="padding-left: 6px; color: #111; font-size: 12.5px;">
          <span>• Store Counter POS Sales:</span>
          <span style="font-family: monospace; font-weight: 800;">Rs. ${posSalesTotal.toLocaleString("en-US")}</span>
        </div>

        <div class="divider-single"></div>

        <div class="flex-row" style="font-weight: 900; font-size: 14px;">
          <span>TOTAL OUTFLOWS (EXPENSES):</span>
          <span style="font-family: monospace;">Rs. ${totalOutflows.toLocaleString("en-US")}</span>
        </div>
        <div class="flex-row" style="padding-left: 6px; color: #111; font-size: 12.5px;">
          <span>• Supplier Purchases (GRN):</span>
          <span style="font-family: monospace; font-weight: 800;">Rs. ${supplierPurchasesCash.toLocaleString("en-US")}</span>
        </div>
        <div class="flex-row" style="padding-left: 6px; color: #111; font-size: 12.5px;">
          <span>• General Operational Expenses:</span>
          <span>Rs. ${expensesTotal.toLocaleString("en-US")}</span>
        </div>

        <div class="divider-double"></div>

        <div class="flex-row" style="font-size: 15px; font-weight: 900;">
          <span>NET OPERATING MARGIN:</span>
          <span>Rs. ${netOperatingSurplus.toLocaleString("en-US")}</span>
        </div>
        <div style="text-align: right; font-size: 12px; font-weight: 900; margin-bottom: 3px;">
          ${isProfit ? "✅ [NET OPERATING SURPLUS / PROFIT]" : "⚠️ [NET OPERATING DEFICIT]"}
        </div>

        <div class="divider-dashed"></div>
        <div style="font-size: 13.5px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
          ── CLINIC STOCK VALUATION ──
        </div>
        <div class="divider-dashed"></div>

        <div class="flex-row" style="font-weight: 900; font-size: 14px;">
          <span>TOTAL STOCK VALUATION:</span>
          <span>Rs. ${totalStockValuation.toLocaleString("en-US")}</span>
        </div>
        <div class="flex-row" style="color: #000; font-size: 12.5px;">
          <span>Total Quantities / Units:</span>
          <span>${totalUnitsCount.toLocaleString("en-US")} Packs</span>
        </div>

        ${topItems.length > 0 ? `
          <div class="divider-single"></div>
          <div style="font-size: 12px; font-weight: 900; margin-top: 3px; color: #000; text-transform: uppercase;">TOP INVENTORY ITEMS (BY VALUE):</div>
          <table>
            <thead>
              <tr>
                <th style="width: 55%;">Item Details</th>
                <th style="width: 15%; text-align: center;">Qty</th>
                <th style="width: 30%; text-align: right;">Val (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
            </tbody>
          </table>
        ` : ""}

        <div class="divider-double"></div>

        <!-- Doctor Signature Line -->
        ${getDoctorSignatureHtml()}

        <div class="divider-dashed" style="margin-top: 6px;"></div>
        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Executive_Audit_${startDate}_to_${endDate}`);
}

/**
 * Print A4 / Letter PDF Document for Executive Financial & Pharmacy Audit Statement
 */
export function printExecutiveAuditDocument(auditData, clinicData = null) {
  if (!auditData) return;

  const clinicName = escapeHtml(clinicData?.name || "H/Dr.Asif Ashraf Khan Clinic Pharmacy");
  const clinicAddress = escapeHtml(clinicData?.address || "Hyderabad, Sindh");
  const clinicPhone = escapeHtml(clinicData?.phone || "03473100304");

  const periodLabel = escapeHtml(auditData.periodLabel || "Executive Financial & Stock Audit");
  const startDate = escapeHtml(auditData.startDateStr || "");
  const endDate = escapeHtml(auditData.endDateStr || "");
  const godownLabel = escapeHtml(auditData.godownLabel || "Main Pharmacy & Store");

  const metrics = auditData.metrics || {};
  const totalStockValuation = Number(metrics.totalStockValuation || 0);
  const totalUnitsCount = Number(metrics.totalUnitsCount || 0);
  const totalInflows = Number(metrics.totalInflows || 0);
  const opdFeesTotal = Number(metrics.opdFeesTotal || 0);
  const posSalesTotal = Number(metrics.posSalesTotal || 0);
  const b2bSalesTotal = Number(metrics.b2bSalesTotal || 0);

  const totalOutflows = Number(metrics.totalOutflows || 0);
  const supplierPurchasesCash = Number(metrics.supplierPurchasesCash || 0);
  const expensesTotal = Number(metrics.expensesTotal || 0);
  const netOperatingSurplus = Number(metrics.netOperatingSurplus || 0);
  const isProfit = netOperatingSurplus >= 0;

  const inventoryItems = auditData.inventoryItems || [];
  const itemRowsHtml = inventoryItems.map((it, idx) => {
    const code = escapeHtml(it.item_code || "MED");
    const name = escapeHtml(it.medicine_name || "Item");
    const company = escapeHtml(it.company_name || "-");
    const qty = Number(it.warehouse_stock ?? it.stock_qty ?? 0);
    const cost = Number(it.cost_price_per_box || it.cost_price || 0);
    const val = qty * cost;
    return `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 6px 8px; font-family: monospace; font-weight: bold; color: #0f766e;">${code}</td>
        <td style="padding: 6px 8px; font-weight: 600; color: #000;">${name}</td>
        <td style="padding: 6px 8px; color: #111;">${company}</td>
        <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #000;">${qty}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #000;">Rs. ${cost.toLocaleString("en-US")}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #0f766e;">Rs. ${val.toLocaleString("en-US")}</td>
      </tr>
    `;
  }).join("");

  const docHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Audit_Report_${startDate}_to_${endDate}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm !important; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #000;
            background: #fff;
            padding: 10px;
            font-size: 12px;
            line-height: 1.4;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f766e;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .title-tag {
            background: #ccfbf1;
            color: #0f766e;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 800;
            display: inline-block;
            margin-bottom: 4px;
            border: 1px solid #99f6e4;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 16px;
          }
          .meta-item { font-size: 11.5px; }
          .meta-item strong { color: #000; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
          
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .kpi-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px;
            background: #ffffff;
          }
          .kpi-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .kpi-val { font-size: 17px; font-weight: 900; font-family: monospace; }
          .kpi-sub { font-size: 10px; color: #222; margin-top: 3px; font-weight: 500; }

          .section-title {
            font-size: 13px;
            font-weight: 800;
            color: #000;
            border-left: 4px solid #0f766e;
            padding-left: 8px;
            margin-bottom: 10px;
          }

          .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
          .summary-table th { background: #f1f5f9; padding: 7px 10px; font-size: 11px; text-align: left; font-weight: 800; color: #000; }
          .summary-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11.5px; }

          .stock-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; }
          .stock-table th { background: #0f766e; color: #ffffff; padding: 7px 8px; font-weight: 800; text-align: left; text-transform: uppercase; font-size: 10px; }
          .stock-table td { border-bottom: 1px solid #e2e8f0; }

          .signatures {
            margin-top: 36px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .sign-box {
            width: 200px;
            border-top: 1.5px solid #334155;
            text-align: center;
            padding-top: 6px;
            font-size: 11px;
            font-weight: bold;
            color: #000;
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <div class="title-tag">EXECUTIVE AUDIT STATEMENT</div>
            <h1 style="font-size: 20px; font-weight: 900; color: #000; margin-top: 2px;">${clinicName}</h1>
            <p style="font-size: 11px; color: #111; margin-top: 2px;">${clinicAddress} · Contact: ${clinicPhone}</p>
          </div>
          <div style="text-align: right;">
            <img src="${CLINIC_LOGO_BASE64}" alt="Logo" style="max-height: 48px; width: auto;" />
            <div style="font-size: 10px; color: #222; margin-top: 4px;">Audited on: ${new Date().toLocaleDateString("en-US")}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <strong>Audit Scope Period</strong>
            <span style="font-weight: 700; color: #0f766e;">${periodLabel}</span>
          </div>
          <div class="meta-item">
            <strong>Date Horizon</strong>
            <span>${startDate} &nbsp;➔&nbsp; ${endDate}</span>
          </div>
          <div class="meta-item">
            <strong>Store / Branch Focus</strong>
            <span>${godownLabel}</span>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card" style="border-left: 4px solid #0f766e;">
            <div class="kpi-label" style="color: #0f766e;">Store Inventory Valuation</div>
            <div class="kpi-val" style="color: #000;">Rs. ${totalStockValuation.toLocaleString("en-US")}</div>
            <div class="kpi-sub">${totalUnitsCount.toLocaleString()} Total Units</div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid #059669;">
            <div class="kpi-label" style="color: #059669;">Total Revenue Inflows</div>
            <div class="kpi-val" style="color: #059669;">Rs. ${totalInflows.toLocaleString("en-US")}</div>
            <div class="kpi-sub">OPD + POS + B2B</div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid #e11d48;">
            <div class="kpi-label" style="color: #e11d48;">Total Outflows & GRN</div>
            <div class="kpi-val" style="color: #e11d48;">Rs. ${totalOutflows.toLocaleString("en-US")}</div>
            <div class="kpi-sub">Purchases + Expenses</div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid ${isProfit ? '#7c3aed' : '#dc2626'}; background: ${isProfit ? '#faf5ff' : '#fef2f2'};">
            <div class="kpi-label" style="color: ${isProfit ? '#7c3aed' : '#dc2626'};">Net Operating Surplus</div>
            <div class="kpi-val" style="color: ${isProfit ? '#581c87' : '#991b1b'};">Rs. ${netOperatingSurplus.toLocaleString("en-US")}</div>
            <div class="kpi-sub" style="font-weight: bold; color: ${isProfit ? '#7c3aed' : '#dc2626'};">${isProfit ? '✅ Net Profit' : '⚠️ Operating Deficit'}</div>
          </div>
        </div>

        <div class="section-title">Periodic Financial Breakdown</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th>Revenue & Inflows Category</th>
              <th style="text-align: right;">Amount (PKR)</th>
              <th>Expense & Outflow Category</th>
              <th style="text-align: right;">Amount (PKR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>OPD Doctor Consultation Collection</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">Rs. ${opdFeesTotal.toLocaleString("en-US")}</td>
              <td>Supplier Inventory Purchases (GRN)</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">Rs. ${supplierPurchasesCash.toLocaleString("en-US")}</td>
            </tr>
            <tr>
              <td>Retail Counter POS Pharmacy Sales</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">Rs. ${posSalesTotal.toLocaleString("en-US")}</td>
              <td>Clinic & Pharmacy Operating Expenses</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">Rs. ${expensesTotal.toLocaleString("en-US")}</td>
            </tr>
            <tr>
              <td>Central Pharmacy & B2B Wholesale Distribution</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">Rs. ${b2bSalesTotal.toLocaleString("en-US")}</td>
              <td><strong>Total Operational Outflows</strong></td>
              <td style="text-align: right; font-family: monospace; font-weight: 800; color: #e11d48;">Rs. ${totalOutflows.toLocaleString("en-US")}</td>
            </tr>
            <tr style="background: #f8fafc; font-weight: bold;">
              <td><strong>Total Inflows & Revenue</strong></td>
              <td style="text-align: right; font-family: monospace; font-weight: 800; color: #059669;">Rs. ${totalInflows.toLocaleString("en-US")}</td>
              <td><strong>Net Operating Margin</strong></td>
              <td style="text-align: right; font-family: monospace; font-weight: 900; color: ${isProfit ? '#0f766e' : '#dc2626'};">Rs. ${netOperatingSurplus.toLocaleString("en-US")}</td>
            </tr>
          </tbody>
        </table>

        ${inventoryItems.length > 0 ? `
          <div class="section-title">Pharmacy Stock Inventory Valuation Matrix (${inventoryItems.length} SKUs)</div>
          <table class="stock-table">
            <thead>
              <tr>
                <th style="width: 12%;">SKU Code</th>
                <th style="width: 38%;">Medicine Item Name</th>
                <th style="width: 20%;">Manufacturer Brand</th>
                <th style="width: 10%; text-align: center;">Stock</th>
                <th style="width: 10%; text-align: right;">Unit Cost</th>
                <th style="width: 10%; text-align: right;">Valuation</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml}
            </tbody>
          </table>
        ` : ""}

        <div class="signatures">
          <div class="sign-box">Prepared by (Internal Auditor)</div>
          <div class="sign-box">Verified by (Chief Pharmacist)</div>
          <div class="sign-box">Super Admin / Executive Owner</div>
        </div>

        <div style="text-align: center; font-size: 10px; color: #444; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
          CliniCore Master Hybrid OS · System Verified Report · Confidential Internal Audit Statement
        </div>
      </body>
    </html>
  `;

  executeThermalPrint(docHtml, `Executive_Audit_Statement_${startDate}_to_${endDate}`);
}

/**
 * 80mm ESC/POS Thermal Udhaar Payment Recovery Receipt Printing
 */
export function printPartyPaymentReceipt(payment, clinic) {
  if (!payment) return;

  const receiptNo = escapeHtml(payment.receipt_no || "REC-1001");
  const dateStr = escapeHtml(payment.date || new Date().toLocaleDateString("en-US"));
  const partyName = escapeHtml(toTitleCase(payment.party_name || "Wholesale Party"));
  const city = escapeHtml((payment.city || "HAIDERABAD").toUpperCase());
  const amountPaid = Number(payment.amount) || 0;
  const previousBal = Number(payment.previous_balance) || 0;
  const remainingBal = Number(payment.remaining_balance) || 0;
  const paymentMode = escapeHtml(payment.payment_mode || "Cash");
  const bankName = payment.bank_name ? escapeHtml(toTitleCase(payment.bank_name)) : "";
  const chequeNo = payment.cheque_no ? escapeHtml(payment.cheque_no) : "";
  const collectedBy = escapeHtml(toTitleCase(payment.collected_by || "Staff Handler"));
  const remarks = escapeHtml(payment.notes || "Udhaar cash recovery");

  const modeStr = `${paymentMode}${bankName ? ` (${bankName})` : ""}${chequeNo ? ` [#${chequeNo}]` : ""}`;

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Party_Udhaar_Receipt_${receiptNo}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
            font-size: 11.5px;
            line-height: 1.3;
            width: 76mm;
            margin: 0 auto;
            padding: 4px 5px;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .title-box { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 4px; }
          .clinic-name { font-size: 14px; font-weight: bold; font-family: serif; }
          .sub-title { font-size: 10px; font-weight: bold; color: #000; }
          .receipt-tag { font-size: 10px; font-weight: 900; background: #0f172a; color: #fff; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 3px; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .ledger-box { border-top: 1.5px solid #0f172a; border-bottom: 1.5px solid #0f172a; padding: 5px 0; margin: 6px 0; font-size: 12px; font-weight: 700; }
          .row { display: flex; justify-content: space-between; padding: 2px 0; }
          .bold { font-weight: 900; }
          .footer { text-align: center; border-top: 1px dashed #000; padding-top: 4px; font-size: 9px; color: #111; font-weight: bold; }
        </style>
      </head>
      <body>
        ${getLogoHeaderHtml("UDHAAR PAYMENT RECEIPT")}

        <div style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; font-size: 10px;">
          <div class="meta-row">
            <span class="bold">Receipt #: ${receiptNo}</span>
            <span>Date: ${dateStr}</span>
          </div>
          <div class="meta-row">
            <span class="bold" style="font-size: 11px;">Party: ${partyName}</span>
            <span class="bold">City: ${city}</span>
          </div>
          <div class="meta-row">
            <span>Collected By: <b>${collectedBy}</b></span>
          </div>
        </div>

        <div class="ledger-box">
          <div class="row">
            <span>Previous Udhaar Balance:</span>
            <span class="bold" style="color: #991b1b;">Rs. ${previousBal.toLocaleString()}</span>
          </div>
          <div class="row" style="background: #f0fdf4; padding: 3px 2px; border-radius: 4px;">
            <span class="bold" style="color: #166534;">Amount Received Today (${modeStr}):</span>
            <span class="bold" style="color: #15803d; font-size: 15px;">Rs. ${amountPaid.toLocaleString()}</span>
          </div>
          <div class="row" style="margin-top: 2px;">
            <span class="bold">Remaining Balance Due:</span>
            <span class="bold" style="font-size: 14px; color: ${remainingBal > 0 ? '#991b1b' : '#15803d'};">Rs. ${remainingBal.toLocaleString()}</span>
          </div>
        </div>

        ${remarks ? `<div style="font-size: 10px; font-style: italic; color: #333; margin: 4px 0;">Note: ${remarks}</div>` : ""}

        <div style="text-align: center; font-size: 10.5px; font-weight: 700; color: #000; margin-top: 6px; padding: 4px 2px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px;">
          Thank you for your payment! Please keep this receipt for accounts record.
        </div>

        <!-- Verification Signatures -->
        <div style="margin-top: 20px; padding-top: 6px; border-top: 1px dotted #999; display: flex; justify-content: space-between; font-size: 10px; font-weight: 700;">
          <div style="text-align: center; width: 45%;">
            <div style="border-bottom: 1px solid #000; height: 16px;"></div>
            <span style="margin-top: 2px; display: block;">Receiver's Signature</span>
          </div>
          <div style="text-align: center; width: 45%;">
            <div style="border-bottom: 1px solid #000; height: 16px;"></div>
            <span style="margin-top: 2px; display: block;">Party Signature</span>
          </div>
        </div>

        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Udhaar_Receipt_${receiptNo}`);
}
