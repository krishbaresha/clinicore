/**
 * thermalPrinter.js — Enterprise 80mm Thermal Receipt, Token & Supplier Voucher Generator Engine.
 * Features high-visibility large typography, crisp contrast, exact 80mm page size reset, zero margin overflow, zero double-printing, and HTML escaping security.
 */

import { formatPatientAge } from "./formatters.js";
import { CLINIC_LOGO_BASE64 } from "./clinicLogoBase64.js";
import { RECEIPT_HEADER_IMAGE_BASE64 } from "./receiptHeaderBase64.js";
import { getShortVersionBadge } from "./version.js";
import { getActiveCashier } from "../api/auth.js";

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
    clinic_name: "M.Ashraf Khan",
    tagline: "Homeopathic Clinic",
    address: "Lajpat Road, Hyderabad, Sindh, Pakistan",
    phone: "0311 4234777\n0343 9376363",
    logo_base64: CLINIC_LOGO_BASE64,
    logo_size: 62,
    logo_width: 53,
    logo_height: 60,
    name_size: 15,
    subtitle_size: 9,
    contact_size: 9.5,
    show_logo: true,
    show_tagline: true,
    show_doctor_info: true,
    show_doctor_sign: true,
    show_urdu_footer: true,
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

export function isBlockEnabled(blocks, blockId) {
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
 * Build clinic header HTML respecting per-block visibility from Receipt Studio.
 * Renders the exact high-fidelity vector/text header matching 80mm_receipt_header_builder_FULL_TEXT_CONTROLS.html
 * Settings:
 * - Logo size: 62px
 * - Logo box width: 53px (48px - 53px)
 * - Logo box height: 60px
 * - Clinic Name: 15px Georgia/Times font bold
 * - Subtitle: 9px Georgia/Times bold
 * - Address/Contact: 9.5px Georgia/Times bold
 * - Bottom single line divider #000
 */
export function getLogoHeaderHtml(docTypeLabel = "", blockFlags = {}) {
  const cfg = getCustomReceiptConfig();
  const {
    showLogo = true,
    showClinicName = true,
    showTagline = true,
    showContact = true,
  } = blockFlags;

  const rawLogo = showLogo && cfg.logo_base64 ? cfg.logo_base64 : CLINIC_LOGO_BASE64;
  const logoSrc = sanitizeLogoSrc(rawLogo);

  const rawPhones = cfg.phone || "0311 4234777\n0343 9376363";
  const phoneLines = rawPhones.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);

  let headerHtml = `
    <div style="width: 100%; padding-bottom: 2px; border-bottom: 1.5px solid #0f172a; margin-bottom: 4px; box-sizing: border-box;">
      <table style="width: 100%; border-collapse: collapse; border: 0 !important; margin: 0;">
        <tr style="border: 0 !important; vertical-align: top;">
          ${showLogo && logoSrc ? `
            <td style="width: 46px; min-width: 46px; vertical-align: top; border: 0 !important; padding: 0 4px 0 0;">
              <img src="${logoSrc}" alt="Logo" style="width: 44px; height: 48px; object-fit: contain; display: block;" />
            </td>
          ` : ''}
          <td style="vertical-align: top; text-align: left; padding: 0 2px 0 0; border: 0 !important;">
            ${showClinicName ? `
              <div style="font-size: 15px; line-height: 16px; font-weight: 700; white-space: nowrap; color: #0f172a; letter-spacing: -0.3px; font-family: Georgia, 'Times New Roman', serif;">
                ${escapeHtml(cfg.clinic_name || "M.Ashraf Khan")}
              </div>
            ` : ''}
            ${showTagline ? `
              <div style="font-size: 9.5px; line-height: 11px; font-weight: 700; white-space: nowrap; color: #334155; margin-top: 1px; font-family: Georgia, 'Times New Roman', serif;">
                ${escapeHtml(cfg.tagline || "Homeopathic Clinic")}
              </div>
            ` : ''}
            ${showContact ? `
              <div style="font-size: 8.5px; line-height: 11px; color: #475569; white-space: nowrap; margin-top: 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                ${escapeHtml(cfg.address ? (cfg.address.includes("Hyderabad") ? "Lajpat Road, Hyderabad, Sindh, PK" : cfg.address) : "Lajpat Road, Hyderabad, Sindh, PK")}
              </div>
            ` : ''}
          </td>
          <td style="vertical-align: bottom; text-align: right; font-size: 9px; line-height: 11.5px; font-weight: 700; white-space: nowrap; border: 0 !important; padding: 0; width: 78px; min-width: 78px; font-family: monospace, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${showContact ? phoneLines.map(ph => `<div>${escapeHtml(ph)}</div>`).join("") : ''}
          </td>
        </tr>
      </table>
    </div>
  `;

  if (docTypeLabel) {
    headerHtml += `<div style="font-size: 9px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; margin: 2px 0 4px 0; padding: 2px 0; background: #f8fafc; border: 1px solid #000; border-radius: 3px;">${escapeHtml(docTypeLabel)}</div>`;
  }

  return headerHtml;
}

/**
 * Standard Doctor Signature Line for Receipts
 */
export function getDoctorSignatureHtml() {
  return `
    <div style="margin-top: 28px; padding-top: 4px; display: flex; justify-content: flex-end; align-items: flex-end;">
      <div style="border-top: 1.5px solid #0f172a; width: 45%; text-align: center; font-size: 8.5px; font-weight: 800; color: #0f172a; padding-top: 2px; text-transform: uppercase;">
        Dr. Signature
      </div>
    </div>
  `;
}

/**
 * Shared software branding watermark for all thermal receipts
 */
export function getWatermarkFooterHtml() {
  return `
    <div style="text-align: center; margin-top: 6px; padding-top: 3px; border-top: 1px dotted #cbd5e1; font-size: 8px; font-family: monospace; color: #94a3b8; line-height: 1.35;">
      <div style="font-weight: 600; color: #64748b;">*** Powered by CliniCore Software ***</div>
      <div style="color: #94a3b8; font-size: 7.5px;">K.B Developer 03142291356</div>
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
    font-size: 8.5px;
    line-height: 1.15;
    border: 1px solid #0f172a;
  }
  .items-table th,
  .items-table td {
    border: 1px solid #0f172a !important;
    padding: 2.5px 2px;
    vertical-align: middle;
    word-break: break-word;
  }
  .items-table th {
    font-weight: 900;
    text-transform: uppercase;
    font-size: 7.5px;
    background: #f1f5f9;
    text-align: center;
    color: #0f172a;
  }
  .items-table .col-sr { width: 9%; text-align: center; font-weight: 800; }
  .items-table .col-qty { width: 10%; text-align: center; font-weight: 800; }
  .items-table .col-item { width: 37%; text-align: left; font-weight: 700; }
  .items-table .col-rate { width: 14%; text-align: center; font-family: monospace; font-weight: 600; }
  .items-table .col-disc { width: 12%; text-align: center; font-family: monospace; }
  .items-table .col-net { width: 18%; text-align: right; font-weight: 900; font-family: monospace; }
  .items-table .cat-row td {
    background: #e2e8f0;
    font-weight: 900;
    font-size: 7.5px;
    text-align: left;
    padding: 2.5px 4px;
    letter-spacing: 0.02em;
    border: 1px solid #0f172a !important;
    color: #0f172a;
  }
  .items-table .item-sub {
    display: block;
    font-size: 6.5px;
    font-weight: 600;
    color: #4b5563;
    margin-top: 1px;
  }
`;

function parseDiscPct(raw) {
  if (raw === null || raw === undefined || raw === "" || raw === "-") return 0;
  if (typeof raw === "string") return parseFloat(raw.replace("%", "").trim()) || 0;
  return Number(raw) || 0;
}

function normalizeReceiptLineItem(item) {
  const qty = Number(item.qty || item.quantity || 1);
  const rate = Number(item.rate || item.unit_price || item.sale_price || 0);
  const discPct = parseDiscPct(item.disc_pct_num ?? item.disc_pct ?? item.discount_pct ?? item.disc_percent ?? 0);
  const discFlat = Number(item.disc_flat || item.discount_flat || 0);
  const gross = qty * rate;
  const net = Number(item.net || item.line_total || item.net_amount || Math.max(0, gross - gross * (discPct / 100) - discFlat)) || 0;
  const name = item.medicine_name || item.item_name || "Item";
  const companyName = item.company_name || item.manufacturer || item.brand || "";
  const category = String(item.category || item.medicine_category || item.product_category || "General").trim() || "General";
  const productCode = item.product_code || item.item_code || item.batch_no || "";
  const unitLabel = item.unit_label || item.packing || "";
  return { qty, rate, discPct, discFlat, net, name, companyName, category, productCode, unitLabel };
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
    return `<div class="items-box" style="padding:6px;text-align:center;font-size:8px;font-weight:700;color:#6b7280;">— No items in cart —</div>`;
  }

  const normalized = items.map(normalizeReceiptLineItem);

  const itemRows = normalized.map((it, idx) => {
    const discLabel = it.discPct > 0 ? `${it.discPct}%` : (it.discFlat > 0 ? `Rs.${it.discFlat}` : "-");
    const subLine = [it.companyName ? `[${it.companyName}]` : "", it.unitLabel].filter(Boolean).join(" · ");
    return `
    <tr>
      <td class="col-sr">${idx + 1}</td>
      <td class="col-qty">${it.qty}</td>
      <td class="col-item">
        ${escapeHtml(it.name)}
        ${subLine ? `<span class="item-sub">${escapeHtml(subLine)}</span>` : ""}
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

export function printThermalReceipt(sale, clinicData = null) {
  if (!sale) return;

  // Read block visibility saved by Receipt Studio for POS mode
  const _blocks = getBlocksConfig("pos");
  const showLogo     = isBlockEnabled(_blocks, "header_logo");
  const showTagline  = isBlockEnabled(_blocks, "tagline");
  const showContact  = isBlockEnabled(_blocks, "contact_info");
  const showDiv1     = isBlockEnabled(_blocks, "divider_1");
  const showMeta     = isBlockEnabled(_blocks, "meta_info");
  const showCustomer = isBlockEnabled(_blocks, "customer_info");
  const showItems    = isBlockEnabled(_blocks, "items_table");
  const showDiv2     = isBlockEnabled(_blocks, "divider_2");
  const showTotals   = isBlockEnabled(_blocks, "financial_totals");
  const showUrdu     = isBlockEnabled(_blocks, "urdu_footer");
  const showNote     = isBlockEnabled(_blocks, "custom_note");
  const cfg          = getCustomReceiptConfig();

  const clinicName = escapeHtml(clinicData?.name || "H/Dr.Asif Ashraf Khan Clinic");
  const subtotal = Number(sale.subtotal_amount) || Number(sale.total_amount) || 0;
  const discount = Number(sale.discount_amount) || 0;
  const netTotal = Number(sale.total_amount) || subtotal;
  const cashTendered = Number(sale.cash_tendered) || netTotal;
  const changeDue = Number(sale.change_due) || Math.max(0, cashTendered - netTotal);

  const rawDate = sale.sale_date ? new Date(sale.sale_date) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const activeCashier = typeof getActiveCashier === "function" ? getActiveCashier() : null;
  const cashierName = escapeHtml(sale.cashier_name || sale.active_cashier_name || (activeCashier?.name) || sale.user_name || "Store Staff");
  const customerName = escapeHtml(toTitleCase(sale.patient_name || sale.account_name || (sale.visit_id ? "Linked OPD Patient" : "Walk-In Customer")));
  const invoiceId = escapeHtml(sale.receipt_no || sale.id || `POS-${Math.floor(1000 + Math.random() * 9000)}`);


  const tokenNo = escapeHtml(sale.token_no || sale.token_number || sale.token || "");
  const partyCode = escapeHtml(sale.party_code || sale.party_type || "");
  const docName = escapeHtml(sale.attending_doctor_name || "");
  const docFee = Number(sale.doctor_fee || 0);
  const docFeeWaived = Boolean(sale.doctor_fee_waived);

  const itemsHtml = buildBorderedReceiptItemsTableHtml(sale.items || []);

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt_${invoiceId}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            width: 76mm;
            margin: 0 auto;
            padding: 4px 4px;
            color: #1f2937;
            background: #fff;
            font-size: 11px;
            line-height: 1.2;
          }
          .logo-badge {
            display: none;
          }
          .clinic-header {
            text-align: center;
            margin-bottom: 2px;
          }
          .dotted-line {
            border-top: 1px dotted #9ca3af;
            margin: 3px 0;
          }
          .meta-text {
            font-size: 10px;
            font-weight: 600;
            color: #1f2937;
            line-height: 1.3;
          }
          ${getThermalItemsTableCss()}
          @media print {
            body { width: 76mm; padding: 2px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <!-- Top Clinic Header (header_logo + clinic_name + tagline + contact_info blocks) -->
        ${getLogoHeaderHtml("", { showLogo, showTagline, showContact })}

        ${showDiv1 ? `<div class="dotted-line"></div>` : ""}

        <!-- Invoice Meta (meta_info block) -->
        ${showMeta ? `
        <div class="meta-text">
          <div><span style="color: #6b7280; font-weight: 500;">Date &amp; Time :</span> ${dateTimeStr}</div>
          <div><span style="color: #6b7280; font-weight: 500;">Cashier :</span> ${cashierName}</div>
          <div><span style="color: #6b7280; font-weight: 500;">Invoice # :</span> ${invoiceId}</div>
        </div>` : ""}

        <!-- Customer Info (customer_info block) -->
        ${showCustomer ? `
        <div class="meta-text">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span><span style="color: #6b7280; font-weight: 500;">Customer :</span> <strong>${customerName}</strong></span>
            ${tokenNo ? `<span style="background: #047857; color: #fff; font-size: 11px; font-weight: 900; padding: 1px 6px; border-radius: 4px; font-family: monospace;">Token #: ${tokenNo}</span>` : ""}
          </div>
          ${docName ? `<div><span style="color: #6b7280; font-weight: 500;">Attending Doctor :</span> <strong>${docName}</strong></div>` : ""}
          ${partyCode ? `<div><span style="color: #6b7280; font-weight: 500;">Party / Route :</span> ${partyCode}</div>` : ""}
        </div>` : ""}

        ${showDiv1 ? `<div class="dotted-line"></div>` : ""}

        <!-- Items Table (items_table block) -->
        ${showItems ? itemsHtml : ""}

        ${showDiv2 ? `<div class="dotted-line"></div>` : ""}

        <!-- Totals (financial_totals block) -->
        ${showTotals ? `
        <div style="font-size: 11px; color: #374151; font-weight: 600; line-height: 1.3;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal</span>
            <span>Rs. ${Number(subtotal).toFixed(2)}</span>
          </div>
          ${docFee > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #374151; font-size: 10px;">
            <span>Dr. Fee (${docName || "Consultant"}):</span>
            <span>Rs. ${Number(docFee).toFixed(2)}</span>
          </div>
          ${docFeeWaived ? `
          <div style="display: flex; justify-content: space-between; color: #be123c; font-size: 10px; font-weight: 800;">
            <span>Dr. Fee Waived (Free):</span>
            <span>- Rs. ${Number(docFee).toFixed(2)}</span>
          </div>` : ""}
          ` : ""}
          ${discount > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #0f766e; font-weight: 700;">
            <span>Discount</span>
            <span>- Rs. ${Number(discount).toFixed(2)}</span>
          </div>` : ""}
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; color: #111827; padding-top: 1px;">
            <span>Grand Total</span>
            <span>Rs. ${Number(netTotal).toFixed(2)}</span>
          </div>
          ${sale.payment_type === "cash" ? `
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #4b5563; margin-top: 1px;">
            <span>Cash Paid</span>
            <span>Rs. ${Number(cashTendered).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; color: #0f766e;">
            <span>Change Return</span>
            <span>Rs. ${Number(changeDue).toFixed(2)}</span>
          </div>` : `
          <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; color: #b45309; margin-top: 2px;">
            <span>Payment</span>
            <span>Credit / Udhaar</span>
          </div>`}
        </div>` : ""}

        <div class="dotted-line"></div>

        <!-- Urdu Footer (urdu_footer block) -->
        ${showUrdu && cfg.urdu_footer_text ? `
        <div style="text-align: center; font-size: 9.5px; font-weight: 700; color: #374151; direction: rtl; margin: 2px 0;">
          ${escapeHtml(cfg.urdu_footer_text)}
        </div>
        <div class="dotted-line"></div>` : ""}

        <!-- Custom Note (custom_note block) -->
        ${showNote ? `
        <div style="text-align: center; margin: 4px 0 3px 0; font-size: 10px; font-weight: 700; color: #111827; line-height: 1.3;">
          ${escapeHtml(cfg.custom_policy_note || "Thank You. Please Visit Again.")}
        </div>
        <div class="dotted-line"></div>` : ""}

        <!-- Doctor Signature Line -->
        ${getDoctorSignatureHtml()}

        <!-- Powered By (permanent — always shown) -->
        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Receipt_${invoiceId}`);
}

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
  const timeStr = new Date().toLocaleString("en-US", { ...pkOptions, hour: "2-digit", minute: "2-digit", hour12: true });

  const closedBy   = escapeHtml(closing.closed_by || closing.cashier_name || "Store Manager");
  const consultant = escapeHtml(closing.consultant || closing.doctor_name || cfg.doctor_name || "Dr. Muhammad Asif Ashraf Khan");
  const auditScope = escapeHtml(closing.audit_scope || "All Terminals & Godowns");

  // Structured sale / purchase / payments data (matches DayClosingReceiptModal shape)
  const sales     = closing.sales     || {};
  const purchases = closing.purchases || {};
  const paidItems = (closing.payments_paid?.items)     || [];
  const recItems  = (closing.payments_received?.items) || [];
  const saleTotal      = Number(sales.total    ?? (Number(closing.pharmacy_sales || 0) + Number(closing.wholesale_b2b || closing.wholesale_sales || 0)));
  const saleCash       = Number(sales.cash     ?? saleTotal);
  const saleCredit     = Number(sales.credit   ?? Math.max(0, saleTotal - saleCash));
  const purchaseTotal  = Number(purchases.total  ?? Number(closing.supplier_payments || 0));
  const purchaseCash   = Number(purchases.cash   ?? purchaseTotal);
  const purchaseCredit = Number(purchases.credit ?? Math.max(0, purchaseTotal - purchaseCash));
  const paidTotal      = Number(closing.payments_paid?.total     ?? closing.daily_expenses ?? closing.expenses ?? 0);
  const recTotal       = Number(closing.payments_received?.total ?? (Number(closing.opd_fees || 0) + Number(closing.wholesale_b2b || 0)));
  const openingCash    = Number(closing.opening_cash || 0);
  const closingCash    = Number(closing.closing_cash ?? closing.net_cash_in_hand ?? closing.expected_cash ?? (openingCash + saleCash + recTotal - purchaseCash - paidTotal));

  const paidItemsHtml = paidItems.length > 0
    ? paidItems.map(it => `
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:9.5px;color:#1f2937;">
        <span style="font-weight:700;max-width:46mm;word-break:break-word;">${escapeHtml(it.account_name || "Expense")}${it.naration ? ` <span style="font-weight:normal;color:#6b7280;">(${escapeHtml(it.naration)})</span>` : ""}</span>
        <span style="font-weight:900;color:#b91c1c;font-family:monospace;">Rs. ${Number(it.amount || 0).toLocaleString("en-US")}</span>
      </div>`).join("")
    : `<div style="font-size:9px;color:#9ca3af;text-align:center;padding:2px 0;">No payments paid on this date.</div>`;

  const recItemsHtml = recItems.length > 0
    ? recItems.map(it => `
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:9.5px;color:#1f2937;">
        <span style="font-weight:700;max-width:46mm;word-break:break-word;">${escapeHtml(it.account_name || "Receipt")}${it.naration ? ` <span style="font-weight:normal;color:#6b7280;">(${escapeHtml(it.naration)})</span>` : ""}</span>
        <span style="font-weight:900;color:#047857;font-family:monospace;">Rs. ${Number(it.amount || 0).toLocaleString("en-US")}</span>
      </div>`).join("")
    : `<div style="font-size:9px;color:#9ca3af;text-align:center;padding:2px 0;">No cash payments received on this date.</div>`;

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>DayClosing_${dateStr}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            width: 76mm;
            margin: 0 auto;
            padding: 4px 5px;
            color: #111827;
            background: #fff;
            font-size: 11px;
            line-height: 1.3;
          }
          .dotted { border-top: 1px dashed #9ca3af; margin: 4px 0; }
          .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 6px; margin: 5px 0; background: #f9fafb; }
          .card-paid { border: 1px solid #fecdd3; border-radius: 8px; padding: 6px; margin: 5px 0; background: #fff1f2; }
          .card-rec  { border: 1px solid #a7f3d0; border-radius: 8px; padding: 6px; margin: 5px 0; background: #ecfdf5; }
          .box-hd { display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:11.5px;border-bottom:1px solid #e5e7eb;padding-bottom:3px;margin-bottom:4px; }
          @media print { body { width: 76mm; padding: 2px; } }
        </style>
      </head>
      <body>
        <!-- Clinic Header -->
        ${getLogoHeaderHtml("Executive Shift Z-Closing Statement", { showLogo, showTagline, showContact })}

        <div class="dotted"></div>

        <!-- Meta Info: Date / Time (meta_info block) -->
        ${showMeta ? `
        <div style="font-size:10px;font-weight:700;color:#374151;">
          <div style="display:flex;justify-content:space-between;">
            <span><strong>Date:</strong> ${dateStr}</span>
            <span><strong>Time:</strong> ${timeStr}</span>
          </div>
        </div>` : ""}

        <!-- Closed By / Consultant / Audit (customer_info block) -->
        ${showCustomer ? `
        <div style="font-size:10px;font-weight:600;color:#374151;margin-top:3px;">
          <div><strong style="color:#4b5563;">Closed By:</strong> ${closedBy}</div>
          <div><strong style="color:#4b5563;">Audit Scope:</strong> ${auditScope}</div>
          <div><strong style="color:#4b5563;">Consultant:</strong> ${consultant}</div>
        </div>` : ""}

        <div class="dotted"></div>

        <!-- items_table block = Sale / Purchase / Payments boxes -->
        ${showItems ? `

        <!-- 1. SALE BOX -->
        ${openingCash > 0 ? `<div style="display:flex;justify-content:space-between;font-size:10px;font-weight:bold;color:#047857;padding:2px 0;"><span>Opening Drawer Float:</span><span>Rs. ${openingCash.toLocaleString("en-US",{minimumFractionDigits:2})}</span></div>` : ""}
        <div class="card">
          <div class="box-hd" style="color:#111827;">
            <span style="font-family:Georgia,serif;font-size:12px;">Sale</span>
            <span style="color:#047857;font-family:monospace;font-size:12px;">Rs. ${saleTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
          <div style="font-size:10px;color:#374151;">
            <div style="display:flex;justify-content:space-between;padding:1px 0;"><span>Cash</span><span style="font-weight:bold;font-family:monospace;">Rs. ${saleCash.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
            <div style="display:flex;justify-content:space-between;padding:1px 0;"><span>Credit</span><span style="font-weight:bold;font-family:monospace;color:#b91c1c;">Rs. ${saleCredit.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
          </div>
        </div>

        <!-- 2. PURCHASE BOX -->
        <div class="card">
          <div class="box-hd" style="color:#111827;">
            <span style="font-family:Georgia,serif;font-size:12px;">Purchase</span>
            <span style="font-family:monospace;font-size:12px;">Rs. ${purchaseTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
          <div style="font-size:10px;color:#374151;">
            <div style="display:flex;justify-content:space-between;padding:1px 0;"><span>Cash</span><span style="font-weight:bold;font-family:monospace;">Rs. ${purchaseCash.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
            <div style="display:flex;justify-content:space-between;padding:1px 0;"><span>Credit</span><span style="font-weight:bold;font-family:monospace;color:#4b5563;">Rs. ${purchaseCredit.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
          </div>
        </div>

        <!-- 3. PAYMENT PAID BOX -->
        <div class="card-paid">
          <div class="box-hd" style="color:#9f1239;border-color:#fecdd3;">
            <span style="font-family:Georgia,serif;font-size:12px;">Payment Paid</span>
            <span style="color:#b91c1c;font-family:monospace;font-size:12px;">Rs. ${paidTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
          ${paidItemsHtml}
        </div>

        <!-- 4. PAYMENT RECEIVE BOX -->
        <div class="card-rec">
          <div class="box-hd" style="color:#065f46;border-color:#a7f3d0;">
            <span style="font-family:Georgia,serif;font-size:12px;">Payment Receive</span>
            <span style="color:#047857;font-family:monospace;font-size:12px;">Rs. ${recTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
          ${recItemsHtml}
        </div>` : ""}

        <!-- financial_totals block = dark Closing Cash box -->
        ${showTotals ? `
        <div style="margin-top:8px;padding-top:6px;border-top:2px dashed #4b5563;">
          <div style="background:#0f172a;color:#fff;border-radius:10px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-family:Georgia,serif;font-weight:900;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">Closing Cash In Hand</span>
            <span style="font-family:monospace;font-weight:900;font-size:17px;color:#6ee7b7;">Rs. ${closingCash.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
        </div>` : ""}

        <div class="dotted"></div>

        <!-- Urdu Footer (urdu_footer block) -->
        ${showUrdu && cfg.urdu_footer_text ? `
        <div style="text-align:center;font-size:9.5px;font-weight:700;color:#374151;direction:rtl;margin:3px 0;">${escapeHtml(cfg.urdu_footer_text)}</div>
        <div class="dotted"></div>` : ""}

        <!-- Custom Policy Note (custom_note block) -->
        ${showNote && cfg.custom_policy_note ? `
        <div style="text-align:center;font-size:9.5px;font-weight:700;color:#374151;font-style:italic;margin:3px 0;">${escapeHtml(cfg.custom_policy_note)}</div>
        <div class="dotted"></div>` : ""}

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

  // Read block visibility saved by Receipt Studio for GRN mode
  const _blocks    = getBlocksConfig("grn");
  const showLogo   = isBlockEnabled(_blocks, "header_logo");
  const showTagline= isBlockEnabled(_blocks, "tagline");
  const showContact= isBlockEnabled(_blocks, "contact_info");
  const showMeta   = isBlockEnabled(_blocks, "meta_info");
  const showItems  = isBlockEnabled(_blocks, "items_table");
  const showTotals = isBlockEnabled(_blocks, "financial_totals");

  const clinicName = escapeHtml(clinicData?.name || "H/Dr.Asif Ashraf Khan Clinic");
  const supplierName = escapeHtml(supplier?.company_name || purchase.supplier_name || "Company Distributor");
  const totalAmount = Number(purchase.total_amount) || 0;
  const paidAmount = Number(purchase.paid_amount) || 0;
  const balanceDue = Number(purchase.balance_due) || Math.max(0, totalAmount - paidAmount);

  const rawDate = purchase.purchase_date ? new Date(purchase.purchase_date) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const invoiceId = escapeHtml(purchase.invoice_no || purchase.id || `INV_${Math.floor(1000 + Math.random() * 9000)}`);
  const cashierName = escapeHtml(purchase.entered_by || "Store Manager");

  const itemsHtml = (purchase.items || []).map((item) => `
    <div style="margin-bottom: 6px;">
      <div style="font-weight: 700; font-size: 13px; color: #111;">${escapeHtml(item.medicine_name)}</div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #444; margin-top: 1px;">
        <span>${Number(item.quantity_received || item.qty || 1).toFixed(2)} ${escapeHtml(item.received_unit_type || item.unit_label || "Pack")} X ${Number(item.cost_price || 0).toFixed(2)}</span>
        <span style="font-weight: 800; color: #000;">Rs. ${Number(item.line_cost || (item.qty * item.cost_price) || 0).toFixed(2)}</span>
      </div>
    </div>
  `).join("");

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Purchase_${invoiceId}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            width: 76mm;
            margin: 0 auto;
            padding: 4px 4px;
            color: #222;
            background: #fff;
            font-size: 11px;
            line-height: 1.2;
          }
          .clinic-header { text-align: center; margin-bottom: 2px; }
          .dotted-line { border-top: 1px dotted #999; margin: 3px 0; }
          .meta-text { font-size: 10px; font-weight: 600; color: #222; line-height: 1.3; }
          .summary-row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #333; margin-bottom: 2px; }
          .grand-total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; color: #000; margin-top: 2px; }
          .payment-table { width: 100%; border-collapse: collapse; margin: 3px 0; }
          .payment-table th { background: #f3f4f6; font-size: 10px; font-weight: 700; color: #374151; padding: 2px 4px; text-align: left; }
          .payment-table td { font-size: 10px; font-weight: 700; color: #111827; padding: 2px 4px; }
          @media print { body { width: 76mm; padding: 2px; } .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <!-- Clinic Header (blocks: header_logo, tagline, contact_info) -->
        ${getLogoHeaderHtml("Stock Purchase Voucher", { showLogo, showTagline, showContact })}

        <div class="dotted-line"></div>

        <!-- Meta Info (meta_info block) -->
        ${showMeta ? `
        <div class="meta-text">
          <div><strong style="color: #4b5563;">Date &amp; Time :</strong> ${dateTimeStr}</div>
          <div><strong style="color: #4b5563;">Entered By :</strong> ${cashierName}</div>
          <div><strong style="color: #4b5563;">Supplier :</strong> ${supplierName}</div>
          <div><strong style="color: #4b5563;">Invoice # :</strong> ${invoiceId}</div>
        </div>
        <div class="dotted-line"></div>` : ""}

        <!-- Purchased Stock List (items_table block) -->
        ${showItems ? `<div style="margin: 6px 0;">${itemsHtml}</div><div class="dotted-line"></div>` : ""}

        <!-- Summary Totals (financial_totals block) -->
        ${showTotals ? `
        <div style="margin: 6px 0;">
          <div class="grand-total-row">
            <span>Bill Total</span>
            <span>Rs. ${totalAmount.toFixed(2)}</span>
          </div>
        </div>
        <div class="dotted-line"></div>

        <!-- Supplier Payment Table -->
        <table class="payment-table">
          <thead>
            <tr>
              <th style="width: 50%;">Paid Now:</th>
              <th style="width: 50%; text-align: right;">Balance Due:</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 800; color: #0f766e;">Rs. ${paidAmount.toFixed(2)}</td>
              <td style="text-align: right; font-weight: 800; color: #b91c1c;">Rs. ${balanceDue.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <div class="dotted-line"></div>` : ""}

        <div style="text-align: center; margin: 4px 0 3px 0;">
          <div style="font-size: 11px; font-weight: 800; color: #111;">Stock Received &amp; Verified</div>
        </div>

        <div class="dotted-line"></div>

        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Purchase_${invoiceId}`);
}

/** Print DrCreate & Access CashBook Thermal Voucher (80mm ESC/POS) */
export function printCashVoucherReceipt(entry, clinicData = null) {
  if (!entry) return;

  const isReceive = (entry.term || entry.type) === "Receive";
  const voucherTitle = isReceive ? "CASH RECEIPT VOUCHER (DEBIT)" : "CASH PAYMENT VOUCHER (CREDIT)";
  const voucherNo = escapeHtml(entry.voucher_no || "C-5160");
  const accountName = escapeHtml(entry.account_name || "Cash In Hand");
  const naration = escapeHtml(entry.naration || entry.description || "General Cash Transaction");
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
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            width: 76mm;
            margin: 0 auto;
            padding: 4px 4px;
            color: #222;
            background: #fff;
            font-size: 11px;
            line-height: 1.3;
          }
          .dotted-line { border-top: 1px dotted #888; margin: 4px 0; }
          .meta-text { font-size: 10px; font-weight: 600; color: #222; }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 900;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: ${isReceive ? '#ecfdf5' : '#fff1f2'};
            color: ${isReceive ? '#065f46' : '#9f1239'};
            border: 1px solid ${isReceive ? '#a7f3d0' : '#fecdd3'};
          }
          .amount-box {
            border: 2px solid #000;
            border-radius: 6px;
            padding: 6px 4px;
            margin: 6px 0;
            text-align: center;
            background: #fafafa;
          }
          .sign-row {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding-top: 4px;
            font-size: 9px;
            font-weight: 700;
            color: #444;
          }
          @media print { body { width: 76mm; padding: 2px; } .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <!-- Top Clinic Header -->
        ${getLogoHeaderHtml(voucherTitle)}

        <div class="dotted-line"></div>

        <!-- Voucher Details -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <div><strong style="font-size: 13px; font-weight: 900; font-family: monospace;">${voucherNo}</strong></div>
          <div><span class="badge">${isReceive ? 'RECEIPT' : 'PAYMENT'}</span></div>
        </div>

        <div class="meta-text">
          <div><strong style="color: #4b5563;">Date &amp; Time :</strong> ${dateTimeStr}</div>
          <div><strong style="color: #4b5563;">Account Name :</strong> <span style="font-size: 12px; font-weight: 800; color: #000;">${accountName}</span></div>
          <div><strong style="color: #4b5563;">Naration :</strong> ${naration}</div>
        </div>

        <!-- Prominent Amount Display -->
        <div class="amount-box">
          <div style="font-size: 9px; font-weight: 800; color: #555; text-transform: uppercase;">
            ${isReceive ? 'Total Cash Received' : 'Total Cash Paid Out'}
          </div>
          <div style="font-size: 18px; font-weight: 900; color: #000; letter-spacing: -0.5px;">
            Rs. ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div class="dotted-line"></div>

        <!-- Signature Lines -->
        <div class="sign-row">
          <div style="border-top: 1px dashed #666; width: 42%; text-align: center; padding-top: 2px;">
            Prepared / Cashier
          </div>
          <div style="border-top: 1px dashed #666; width: 42%; text-align: center; padding-top: 2px;">
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
  const age = escapeHtml(formatPatientAge(receipt.patient) || "18").replace(/[^0-9]/g, "") || "18";

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
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            width: 74mm;
            margin: 0 auto;
            padding: 4px 6px;
            color: #000;
            background: #fff;
            font-size: 11px;
            line-height: 1.2;
          }
          .header-table {
            width: 100%;
            border: none;
            padding-bottom: 3px;
            margin-bottom: 2px;
          }
          .divider-heavy {
            border-top: 2px solid #000;
            margin: 3px 0 4px 0;
          }
          .divider-double {
            border-top: 3px double #000;
            margin: 4px 0;
          }
          .divider-thin {
            border-top: 1px solid #000;
            margin: 3px 0;
          }
          @media print { body { width: 74mm; padding: 2px; } }
        </style>
      </head>
      <body>
        <!-- Top Receipt Header Banner -->
        ${getLogoHeaderHtml()}

        <!-- Print Date & Time Row -->
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #000; padding: 1px 0 3px 0;">
          <span>Print Date &amp; Time</span>
          <span style="font-family: monospace; font-size: 11px;">${printDateTimeStr}</span>
        </div>

        <div class="divider-thin"></div>

        <!-- Doctor & Appointment No Center Block -->
        <div style="text-align: center; padding: 4px 0;">
          <div style="font-size: 15px; font-weight: 900; color: #000; letter-spacing: -0.2px;">
            ${doctorName}
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #000; margin-top: 2px;">
            Appointment No
          </div>
          <div style="font-size: 26px; font-weight: 900; color: #000; line-height: 1; margin-top: 2px; font-family: monospace;">
            ${tokenNo}
          </div>
        </div>

        <div class="divider-thin"></div>

        <!-- Patient Demographics Rows -->
        <div style="padding: 2px 0; font-size: 12px; font-weight: 900; color: #000; line-height: 1.4;">
          <div style="display: flex; margin-bottom: 3px;">
            <span style="width: 115px;">Patient Name &nbsp;:</span>
            <span style="font-size: 13px; font-weight: 900;">${patientName}</span>
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
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 13.5px; font-weight: 900; color: #000;">
          <span>Paid Fees</span>
          <span style="font-family: monospace; font-size: 14px;">PKR ${Number(fee).toFixed(2)}</span>
        </div>

        <!-- THANK YOU Bottom Banner -->
        <div style="border-top: 3px solid #000; border-bottom: 3px solid #000; padding: 4px 0; text-align: center; margin-top: 4px;">
          <div style="font-size: 16px; font-weight: 900; letter-spacing: 2px; color: #000; font-family: serif, 'Times New Roman', -apple-system;">
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
          @page { size: 80mm auto; margin: 0; }
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
        <div style="font-size: 10px; color: #333; margin-top: 1px;">
          Code: <strong>${escapeHtml(item.item_code || 'GEN')}</strong> | Category: <strong>${escapeHtml(item.category || 'Homeopathic')}</strong>
        </div>

        <div class="summary-box">
          <div>Godown Stock: <strong>${summary.warehouse_stock || 0}</strong></div>
          <div>Store POS: <strong>${summary.store_stock || 0}</strong></div>
          <div>Total Inward: <strong>+${summary.total_purchased || 0}</strong></div>
          <div>Wholesale Sold: <strong>-${summary.total_sold_wholesale || 0}</strong></div>
          <div>Retail Sold: <strong>-${summary.total_sold_retail || 0}</strong></div>
          <div>Total Base: <strong>${summary.total_base_stock || 0}</strong></div>
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
          @page { size: 80mm auto; margin: 0; }
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
          @page { size: 80mm auto; margin: 0; }
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
          @page { size: 80mm auto; margin: 0; }
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
 * 80mm ESC/POS Thermal Print for Stock Movement Ledger (DrCreate Format)
 */
export function printStockLedgerReceipt(medicineName, timeline = [], clinic = null) {
  const dateStr = new Date().toLocaleDateString("en-GB");
  const totalIn = timeline.reduce((s, r) => s + (Number(r.total_in) || 0), 0);
  const totalOut = timeline.reduce((s, r) => s + (Number(r.total_out) || 0), 0);
  const netBalance = totalIn - totalOut;

  const rowsHtml = timeline
    .map(
      (r) => `
        <tr>
          <td style="font-weight: 700; font-family: monospace;">${escapeHtml(r.date)}</td>
          <td style="text-align: center; color: #047857; font-weight: 700;">+${r.total_in || 0}</td>
          <td style="text-align: center; color: #b91c1c; font-weight: 700;">-${r.total_out || 0}</td>
          <td style="text-align: right; font-weight: 800;">${(r.total_in || 0) - (r.total_out || 0)}</td>
        </tr>
      `
    )
    .join("");

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Stock Movement Ledger</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
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
        ${getLogoHeaderHtml("STOCK MOVEMENT LEDGER")}
        <div style="font-size: 9.5px; text-align: center; margin-top: 2px; font-weight: bold;">
          ${escapeHtml(medicineName)}
        </div>
        <div style="font-size: 8.5px; text-align: center; color: #444; margin-top: 1px;">
          <strong>Date:</strong> ${dateStr}
        </div>

        <div class="divider-dashed"></div>

        <table>
          <thead>
            <tr>
              <th style="width: 34%;">Date</th>
              <th style="width: 22%; text-align: center;">In</th>
              <th style="width: 22%; text-align: center;">Out</th>
              <th style="width: 22%; text-align: right;">Net</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="4" style="text-align:center; padding: 8px;">No transaction records</td></tr>'}
          </tbody>
        </table>

        <div class="divider-single"></div>
        <div style="font-size: 9px; font-weight: bold; margin-top: 3px; display: flex; justify-content: space-between;">
          <span>Total In: +${totalIn}</span>
          <span>Total Out: -${totalOut}</span>
        </div>
        <div style="font-size: 10px; font-weight: 900; text-align: center; margin-top: 3px; border-top: 1px solid #000; padding-top: 2px;">
          Current Net Stock: ${netBalance} Units
        </div>
        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Stock_Ledger_${escapeHtml(medicineName)}`);
}

/**
 * 80mm ESC/POS Thermal Print: Purchase GRN Voucher (DrCreate Format)
 */
export function printPurchaseGRNReceipt(purchase, clinic = null) {
  if (!purchase) return;

  const dateStr = purchase.purchase_date
    ? new Date(purchase.purchase_date).toLocaleDateString("en-GB")
    : new Date().toLocaleDateString("en-GB");

  const voucherNo = escapeHtml(purchase.invoice_no || purchase.voucher_no || "P-GRN");
  const supplierName = escapeHtml(purchase.supplier_name || purchase.account_name || "Supplier");
  const grnNo = escapeHtml(purchase.grn_no || "0");
  const transport = escapeHtml(purchase.transport || "By Hand");
  const biltyNo = escapeHtml(purchase.bilty_no || "-");
  const reference = escapeHtml(purchase.reference || "-");
  const paymentMode = escapeHtml(purchase.payment_mode || (purchase.balance_due > 0 ? "Credit (Udhaar)" : "Cash In Hand"));

  const rowsHtml = (purchase.items || []).map((it) => {
    const qty = Number(it.qty || it.quantity || it.qty_base_units || 1);
    const rate = Number(it.rate || it.cost_price || 0);
    const gross = Number(it.gross || (qty * rate));
    const discPct = it.disc_pct || "-";
    const net = Number(it.net || it.total_cost || (gross - (gross * (Number(it.disc_pct || 0) / 100)) - (Number(it.disc_flat || 0))));

    return `
      <tr>
        <td style="font-weight: bold; max-width: 32mm; word-break: break-word;">${escapeHtml(it.medicine_name || "Item")}</td>
        <td style="text-align: center; font-mono: true;">${qty}</td>
        <td style="text-align: center;">${rate}</td>
        <td style="text-align: center; font-size: 8.5px;">${discPct}</td>
        <td style="text-align: right; font-weight: 800;">${net.toLocaleString()}</td>
      </tr>
    `;
  }).join("");

  const totalBill = Number(purchase.total_amount || purchase.net_total || 0);
  const paidAmount = Number(purchase.paid_amount || 0);
  const balanceDue = Number(purchase.balance_due || (totalBill - paidAmount));

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Purchase_GRN_${voucherNo}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
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
        ${getLogoHeaderHtml("PURCHASE GRN VOUCHER")}
        <div style="font-size: 9px; margin-top: 2px;">
          <div><strong>Voucher #:</strong> ${voucherNo} · <strong>Date:</strong> ${dateStr}</div>
          <div><strong>Supplier:</strong> ${supplierName}</div>
          <div><strong>GRN / Challan #:</strong> ${grnNo} · <strong>Ref:</strong> ${reference}</div>
          <div><strong>Transport:</strong> ${transport} · <strong>Bilty:</strong> ${biltyNo}</div>
          <div><strong>Mode:</strong> ${paymentMode}</div>
        </div>

        <div class="divider-dashed"></div>

        <table>
          <thead>
            <tr>
              <th style="width: 44%;">Item Name</th>
              <th style="width: 12%; text-align: center;">Qty</th>
              <th style="width: 14%; text-align: center;">Rate</th>
              <th style="width: 14%; text-align: center;">Disc</th>
              <th style="width: 16%; text-align: right;">Net</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="divider-single"></div>
        <div style="font-size: 10px; font-weight: 900; display: flex; justify-content: space-between; margin-top: 2px;">
          <span>TOTAL BILL:</span>
          <span>Rs. ${totalBill.toLocaleString()}</span>
        </div>
        ${paidAmount > 0 ? `
          <div style="font-size: 9px; font-weight: bold; display: flex; justify-content: space-between; margin-top: 1px;">
            <span>Paid Amount:</span>
            <span>Rs. ${paidAmount.toLocaleString()}</span>
          </div>
        ` : ""}
        ${balanceDue > 0 ? `
          <div style="font-size: 9px; font-weight: bold; color: #b91c1c; display: flex; justify-content: space-between; margin-top: 1px;">
            <span>Payable Udhaar Balance:</span>
            <span>Rs. ${balanceDue.toLocaleString()}</span>
          </div>
        ` : ""}

        <div class="divider-dashed"></div>
        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Purchase_GRN_${voucherNo}`);
}

/**
 * Low-Ink 80mm ESC/POS Sale Invoice Thermal Receipt (DrCreate & MS Access Style)
 */
export function printSaleInvoiceReceipt(sale, clinic) {
  if (!sale) return;

  const _blocks    = getBlocksConfig("b2b");
  const showLogo   = isBlockEnabled(_blocks, "header_logo");
  const showTagline= isBlockEnabled(_blocks, "tagline");
  const showContact= isBlockEnabled(_blocks, "contact_info");

  const voucherNo = escapeHtml(sale.voucher_no || sale.receipt_no || sale.invoice_no || "Inv-6218");
  const dateStr = escapeHtml((sale.sale_date || sale.created_at || new Date().toISOString()).split("T")[0]);
  const customerName = escapeHtml(toTitleCase(sale.account_name || sale.customer_name || "Walk-In Patient"));
  const tokenNo = escapeHtml(sale.token_no || sale.patient_token || "");
  const city = escapeHtml(sale.party_type || sale.city || "");
  const partyCode = escapeHtml(sale.party_code || "");
  const reference = escapeHtml(sale.reference || (clinic?.user_name || "Clinic Administrator"));
  const transport = escapeHtml(sale.transport || "By Hand");
  const biltyNo = escapeHtml(sale.bilty_no || "-");
  const paymentMode = escapeHtml(sale.payment_mode || "Cash");

  const isUdhaar = String(paymentMode).toLowerCase().includes("credit") || String(paymentMode).toLowerCase().includes("udhaar");
  const puranaUdhaar = Number(sale.previous_balance || sale.purana_udhaar || sale.party_balance || 0);
  const currentBill = Number(sale.total_amount || sale.net_total || sale.net_amount || sale.subtotal_amount || 0);
  const grandPayable = puranaUdhaar > 0 ? (currentBill + puranaUdhaar) : currentBill;
  const cashPaid = sale.cash_received !== undefined && sale.cash_received !== "" && !isNaN(Number(sale.cash_received))
    ? Number(sale.cash_received)
    : (isUdhaar ? 0 : currentBill);
  const changeReturn = Math.max(0, cashPaid - grandPayable);
  const remainingBalance = Math.max(0, grandPayable - cashPaid);

  const posFee = Number(sale.pos_service_fee || sale.pos_fee || 0);

  const items = sale.items || [];
  const itemsTableHtml = buildBorderedReceiptItemsTableHtml(items);

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Sale_Invoice_${voucherNo}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 10px;
            line-height: 1.25;
            width: 76mm;
            margin: 0 auto;
            padding: 4px 6px;
            color: #0f172a;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table { width: 100%; border-collapse: collapse; }
          ${getThermalItemsTableCss()}
        </style>
      </head>
      <body>
        <!-- Clean Flat Header Layout -->
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
            <!-- Left: Logo -->
            <div style="width: 48px; min-width: 48px; height: 54px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <img
                src="${CLINIC_LOGO_BASE64}"
                alt="Logo"
                style="width: 48px; height: 52px; object-fit: contain; display: block;"
              />
            </div>

            <!-- Middle: Clinic Name + Subtitle + Address -->
            <div style="flex: 1; min-width: 0; text-align: left; font-family: Georgia, Cambria, serif;">
              <div style="font-size: 15px; line-height: 16px; font-weight: bold; color: #0f172a; white-space: nowrap; letter-spacing: -0.2px;">
                M.Ashraf Khan
              </div>
              <div style="font-size: 9.5px; line-height: 11px; font-weight: bold; color: #334155; white-space: nowrap; margin-top: 1px;">
                Homeopathic Clinic
              </div>
              <div style="font-size: 8.5px; line-height: 11px; font-family: system-ui, -apple-system, sans-serif; font-weight: 500; color: #475569; white-space: nowrap; margin-top: 2px;">
                Lajpat Road, Hyderabad, Sindh, PK
              </div>
            </div>

            <!-- Right: Phone Numbers stacked -->
            <div style="text-align: right; font-size: 9px; line-height: 11.5px; font-family: monospace; font-weight: bold; color: #0f172a; white-space: nowrap; flex-shrink: 0; align-self: flex-end;">
              <div>0311 4234777</div>
              <div>0343 9376363</div>
            </div>
          </div>
        </div>

        <!-- Meta Information -->
        ${(sale.billing_type === "wholesale_party" || sale.party_type || partyCode) ? `
          <div style="border-bottom: 1px dashed #94a3b8; padding-bottom: 4px; margin-bottom: 4px; font-size: 10px; line-height: 1.3; font-family: monospace;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 900; color: #0f172a;">Invoice #: ${voucherNo}</span>
              <span style="font-weight: 700; color: #334155;">Issue Date: ${dateStr}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 1px; gap: 4px;">
              <span style="font-weight: 900; color: #0f172a; font-size: 10.5px;">Name: ${customerName}</span>
              <span style="font-weight: 700; color: #334155; text-align: right; white-space: nowrap; flex-shrink: 0;">Salesman: ${reference}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1px;">
              <span style="font-weight: 700; color: #334155;">City : ${(city || "HAIDERABAD").toUpperCase()}</span>
            </div>
            ${(sale.transport && String(sale.transport).trim() && String(sale.transport).trim() !== "0") ? `
              <div style="color: #334155; font-weight: 700; margin-top: 1px;">Transport: ${escapeHtml(toTitleCase(sale.transport))}</div>
            ` : ""}
            ${(sale.bilty_no && String(sale.bilty_no).trim() && String(sale.bilty_no).trim() !== "0") ? `
              <div style="color: #334155; font-weight: 700; margin-top: 1px;">Bilty #: ${escapeHtml(sale.bilty_no)}</div>
            ` : ""}
          </div>
        ` : `
          <div style="border-bottom: 1px dashed #94a3b8; padding-bottom: 4px; margin-bottom: 4px; font-size: 9.5px; line-height: 1.3;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Date: ${dateStr}</span>
              <span style="font-weight: 900; color: #0f172a;">Inv: #${voucherNo}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748b;">Cashier: ${reference}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 2px; border-top: 1px solid #e2e8f0; margin-top: 2px;">
              <span style="font-weight: 900; color: #0f172a; font-size: 10.5px;">Customer: ${customerName}</span>
              ${tokenNo ? `<span style="background: #065f46; color: #fff; padding: 1px 5px; border-radius: 3px; font-weight: 900; font-size: 9px;">Token #: ${tokenNo}</span>` : ""}
            </div>
            ${(sale.transport && String(sale.transport).trim() && String(sale.transport).trim() !== "0") ? `
              <div style="color: #334155; font-weight: 700; margin-top: 1px;">Transport: ${escapeHtml(toTitleCase(sale.transport))}</div>
            ` : ""}
            ${(sale.bilty_no && String(sale.bilty_no).trim() && String(sale.bilty_no).trim() !== "0") ? `
              <div style="color: #334155; font-weight: 700; margin-top: 1px;">Bilty #: ${escapeHtml(sale.bilty_no)}</div>
            ` : ""}
          </div>
        `}

        <!-- Items Table -->
        ${itemsTableHtml}

        <!-- Totals Summary -->
        ${posFee > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #475569; font-size: 9.5px; margin-top: 1px;">
            <span>POS Service Fee:</span>
            <span style="font-weight: 700; color: #0f172a;">Rs. ${Math.round(posFee).toLocaleString("en-US")}</span>
          </div>
        ` : ""}
        
        <div style="font-size: 10.5px; padding-top: 3px; line-height: 1.35; color: #1e293b;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #475569;">Current Bill:</span>
            <span style="font-weight: 700; color: #0f172a;">Rs. ${Math.round(currentBill).toLocaleString("en-US")}</span>
          </div>
          ${puranaUdhaar > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #1e293b; font-weight: 600; margin-top: 1px;">
              <span>Previous Balance:</span>
              <span style="font-weight: 700; color: #0f172a;">Rs. ${Math.round(puranaUdhaar).toLocaleString("en-US")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 800; border-top: 1px dashed #0f172a; padding-top: 2px; margin-top: 2px; color: #0f172a;">
              <span>Total Payable:</span>
              <span style="font-weight: 900; color: #0f172a;">Rs. ${Math.round(grandPayable).toLocaleString("en-US")}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 800; border-top: 1px solid #0f172a; padding-top: 3px; margin-top: 2px; color: #0f172a;">
              <span>Total Amount:</span>
              <span style="font-weight: 900; color: #0f172a;">Rs. ${Math.round(currentBill).toLocaleString("en-US")}</span>
            </div>
          `}
          <div style="display: flex; justify-content: space-between; color: #334155; font-weight: 600; margin-top: 1px;">
            <span>Cash Paid:</span>
            <span style="font-weight: 700; color: #0f172a;">Rs. ${Math.round(cashPaid).toLocaleString("en-US")}</span>
          </div>
          ${changeReturn > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #065f46; font-weight: 700; margin-top: 1px;">
              <span>Change Return:</span>
              <span style="font-weight: 800; color: #065f46;">Rs. ${Math.round(changeReturn).toLocaleString("en-US")}</span>
            </div>
          ` : ""}
          ${remainingBalance > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #991b1b; font-weight: 800; border-top: 1px dotted #991b1b; padding-top: 2px; margin-top: 2px;">
              <span>Remaining Balance:</span>
              <span style="font-weight: 900; color: #991b1b;">Rs. ${Math.round(remainingBalance).toLocaleString("en-US")}</span>
            </div>
          ` : ""}
        </div>

        <!-- Urdu Footer Disclaimer -->
        <div style="border-top: 1px dashed #94a3b8; padding-top: 4px; text-align: center; font-size: 10px; font-weight: bold; color: #1e293b; direction: rtl; margin-top: 4px; font-family: 'Noto Nastaleeq Urdu', 'Jameel Noori Nastaleeq', 'Urdu', system-ui;">
          <div>خریدی ہوئی دوا واپس یا تبدیل نہیں ہوگی۔</div>
        </div>

        <!-- Doctor Signature Line with Proper Gap for Physical Sign -->
        <div style="padding-top: 28px; padding-bottom: 2px; display: flex; justify-content: flex-end;">
          <div style="border-top: 1.5px solid #0f172a; width: 45%; text-align: center; font-size: 8.5px; font-weight: 900; text-transform: uppercase; color: #0f172a; padding-top: 2px;">
            Dr. Signature
          </div>
        </div>

        <!-- Powered By Watermark -->
        <div style="text-align: center; font-size: 8px; color: #94a3b8; font-family: monospace; border-top: 1px dotted #cbd5e1; padding-top: 4px; margin-top: 6px; line-height: 1.35;">
          <div style="font-weight: 600; color: #64748b;">*** Powered by CliniCore Software ***</div>
          <div style="color: #94a3b8; font-size: 7.5px;">K.B Developer 03142291356</div>
        </div>
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Sale_Invoice_${voucherNo}`);
}

/**
 * Print 80mm Low-Ink Thermal Slip for Executive Financial & Godown Audit (6-Mo / 1-Yr / 2-Yr / Custom)
 */
export function printExecutiveAuditReceipt(auditData, clinicData = null) {
  if (!auditData) return;

  const clinicName = escapeHtml(clinicData?.name || "H/Dr.Asif Ashraf Khan Clinic Pharmacy");
  const clinicAddress = escapeHtml(clinicData?.address || "Hyderabad, Sindh");
  const clinicPhone = escapeHtml(clinicData?.phone || "03473100304");

  const periodLabel = escapeHtml(auditData.periodLabel || "Executive Financial Audit");
  const startDate = escapeHtml(auditData.startDateStr || "");
  const endDate = escapeHtml(auditData.endDateStr || "");
  const godownLabel = escapeHtml(auditData.godownLabel || "All Godowns & Store");

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
    const qty = Number(it.warehouse_stock ?? it.stock_qty ?? 0);
    const cost = Number(it.cost_price_per_box || it.cost_price || 0);
    const val = qty * cost;
    return `
      <tr>
        <td style="padding: 2px 0; font-size: 8.5px; vertical-align: top;">
          <div style="font-weight: bold; color: #111;">${name}</div>
          <div style="color: #666; font-size: 7.5px;">${code} · ${brand}</div>
        </td>
        <td style="text-align: center; font-size: 8.5px; font-weight: bold; vertical-align: top; padding: 2px 0;">${qty}</td>
        <td style="text-align: right; font-size: 8.5px; font-weight: bold; vertical-align: top; padding: 2px 0;">${val.toLocaleString("en-US")}</td>
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
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Courier New', Courier, monospace, system-ui;
            font-size: 9.5px;
            line-height: 1.25;
            width: 72mm;
            margin: 0 auto;
            padding: 5px;
            color: #000;
            background: #fff;
          }
          .divider-dashed { border-top: 1px dashed #000; margin: 4px 0; }
          .divider-double { border-top: 2px solid #000; margin: 4px 0; }
          .divider-single { border-top: 1px solid #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 3px; }
          th { border-bottom: 1px solid #000; padding: 2px 0; text-align: left; font-size: 8.5px; text-transform: uppercase; font-weight: 900; }
          td { border-bottom: 0.5px dotted #ddd; }
          .flex-row { display: flex; justify-content: space-between; margin: 1.5px 0; font-size: 9px; }
        </style>
      </head>
      <body>
        ${getLogoHeaderHtml("EXECUTIVE AUDIT SLIP")}
        <div style="text-align: center; margin-top: 2px;">
          <div style="font-size: 11px; font-weight: 900; color: #000;">${clinicName}</div>
          <div style="font-size: 8px; color: #333;">${clinicAddress} · Ph: ${clinicPhone}</div>
        </div>

        <div class="divider-double"></div>

        <div style="font-size: 8.5px;">
          <div><strong>Audit Period:</strong> ${periodLabel}</div>
          <div><strong>Date Range:</strong> ${startDate} ➔ ${endDate}</div>
          <div><strong>Location Scope:</strong> ${godownLabel}</div>
          <div><strong>Generated On:</strong> ${new Date().toLocaleString("en-US")}</div>
        </div>

        <div class="divider-dashed"></div>
        <div style="font-size: 9.5px; font-weight: 900; text-align: center; text-transform: uppercase;">
          ── FINANCIAL SUMMARY ──
        </div>
        <div class="divider-dashed"></div>

        <div class="flex-row" style="font-weight: 900; font-size: 9.5px;">
          <span>TOTAL INFLOWS (REVENUE):</span>
          <span>Rs. ${totalInflows.toLocaleString("en-US")}</span>
        </div>
        <div class="flex-row" style="padding-left: 6px; color: #333;">
          <span>• OPD Doctor Consultations:</span>
          <span>Rs. ${opdFeesTotal.toLocaleString("en-US")}</span>
        </div>
        <div class="flex-row" style="padding-left: 6px; color: #333;">
          <span>• Store Counter POS Sales:</span>
          <span>Rs. ${posSalesTotal.toLocaleString("en-US")}</span>
        </div>
        <div class="flex-row" style="padding-left: 6px; color: #333;">
          <span>• B2B Godown / Wholesale Sales:</span>
          <span>Rs. ${b2bSalesTotal.toLocaleString("en-US")}</span>
        </div>

        <div class="divider-single"></div>

        <div class="flex-row" style="font-weight: 900; font-size: 9.5px;">
          <span>TOTAL OUTFLOWS (EXPENSES):</span>
          <span>Rs. ${totalOutflows.toLocaleString("en-US")}</span>
        </div>
        <div class="flex-row" style="padding-left: 6px; color: #333;">
          <span>• Supplier Purchases (GRN):</span>
          <span>Rs. ${supplierPurchasesCash.toLocaleString("en-US")}</span>
        </div>
        <div class="flex-row" style="padding-left: 6px; color: #333;">
          <span>• General Operational Expenses:</span>
          <span>Rs. ${expensesTotal.toLocaleString("en-US")}</span>
        </div>

        <div class="divider-double"></div>

        <div class="flex-row" style="font-size: 11px; font-weight: 900;">
          <span>NET OPERATING MARGIN:</span>
          <span>Rs. ${netOperatingSurplus.toLocaleString("en-US")}</span>
        </div>
        <div style="text-align: right; font-size: 8px; font-weight: bold; margin-bottom: 2px;">
          ${isProfit ? "✅ [NET OPERATING SURPLUS / PROFIT]" : "⚠️ [NET OPERATING DEFICIT]"}
        </div>

        <div class="divider-dashed"></div>
        <div style="font-size: 9.5px; font-weight: 900; text-align: center; text-transform: uppercase;">
          ── GODOWN STOCK VALUATION ──
        </div>
        <div class="divider-dashed"></div>

        <div class="flex-row" style="font-weight: 900; font-size: 9.5px;">
          <span>TOTAL STOCK VALUATION:</span>
          <span>Rs. ${totalStockValuation.toLocaleString("en-US")}</span>
        </div>
        <div class="flex-row" style="color: #333;">
          <span>Total Quantities / Units:</span>
          <span>${totalUnitsCount.toLocaleString("en-US")} Packs</span>
        </div>

        ${topItems.length > 0 ? `
          <div class="divider-single"></div>
          <div style="font-size: 8px; font-weight: bold; margin-top: 2px; color: #333;">TOP INVENTORY ITEMS (BY VALUE):</div>
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

        <div style="margin-top: 14px; display: flex; justify-content: space-between; font-size: 8px;">
          <div style="border-top: 1px solid #000; width: 45%; text-align: center; padding-top: 2px;">
            Auditor / Operator
          </div>
          <div style="border-top: 1px solid #000; width: 45%; text-align: center; padding-top: 2px;">
            Super Admin / Doctor
          </div>
        </div>

        <div class="divider-dashed" style="margin-top: 6px;"></div>
        ${getWatermarkFooterHtml()}
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Executive_Audit_${startDate}_to_${endDate}`);
}

/**
 * Print A4 / Letter PDF Document for Executive Financial & Godown Audit Statement
 */
export function printExecutiveAuditDocument(auditData, clinicData = null) {
  if (!auditData) return;

  const clinicName = escapeHtml(clinicData?.name || "H/Dr.Asif Ashraf Khan Clinic Pharmacy");
  const clinicAddress = escapeHtml(clinicData?.address || "Hyderabad, Sindh");
  const clinicPhone = escapeHtml(clinicData?.phone || "03473100304");

  const periodLabel = escapeHtml(auditData.periodLabel || "Executive Financial & Stock Audit");
  const startDate = escapeHtml(auditData.startDateStr || "");
  const endDate = escapeHtml(auditData.endDateStr || "");
  const godownLabel = escapeHtml(auditData.godownLabel || "All Godowns & Store Locations");

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
        <td style="padding: 6px 8px; font-weight: 600; color: #0f172a;">${name}</td>
        <td style="padding: 6px 8px; color: #475569;">${company}</td>
        <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #0f172a;">${qty}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #334155;">Rs. ${cost.toLocaleString("en-US")}</td>
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
          @page { size: A4 portrait; margin: 12mm 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
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
          .meta-item strong { color: #334155; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
          
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
          .kpi-sub { font-size: 10px; color: #64748b; margin-top: 3px; font-weight: 500; }

          .section-title {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
            border-left: 4px solid #0f766e;
            padding-left: 8px;
            margin-bottom: 10px;
          }

          .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
          .summary-table th { background: #f1f5f9; padding: 7px 10px; font-size: 11px; text-align: left; font-weight: 800; color: #334155; }
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
            color: #334155;
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <div class="title-tag">EXECUTIVE AUDIT STATEMENT</div>
            <h1 style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 2px;">${clinicName}</h1>
            <p style="font-size: 11px; color: #475569; margin-top: 2px;">${clinicAddress} · Contact: ${clinicPhone}</p>
          </div>
          <div style="text-align: right;">
            <img src="${CLINIC_LOGO_BASE64}" alt="Logo" style="max-height: 48px; width: auto;" />
            <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Audited on: ${new Date().toLocaleDateString("en-US")}</div>
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
            <strong>Godown / Branch Focus</strong>
            <span>${godownLabel}</span>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card" style="border-left: 4px solid #0f766e;">
            <div class="kpi-label" style="color: #0f766e;">Godown Stock Valuation</div>
            <div class="kpi-val" style="color: #0f172a;">Rs. ${totalStockValuation.toLocaleString("en-US")}</div>
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
              <td>Clinic & Godown Operating Expenses</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">Rs. ${expensesTotal.toLocaleString("en-US")}</td>
            </tr>
            <tr>
              <td>Central Warehouse & B2B Wholesale Distribution</td>
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
          <div class="section-title">Godown Stock Inventory Valuation Matrix (${inventoryItems.length} SKUs)</div>
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

        <div style="text-align: center; font-size: 10px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
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
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
            font-size: 10px;
            line-height: 1.3;
            width: 76mm;
            margin: 0 auto;
            padding: 4px 6px;
            color: #0f172a;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .title-box { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 4px; }
          .clinic-name { font-size: 14px; font-weight: bold; font-family: serif; }
          .sub-title { font-size: 10px; font-weight: bold; color: #334155; }
          .receipt-tag { font-size: 10px; font-weight: 900; background: #0f172a; color: #fff; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 3px; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .ledger-box { border-top: 1px solid #0f172a; border-bottom: 1px solid #0f172a; padding: 4px 0; margin: 6px 0; font-size: 10.5px; }
          .row { display: flex; justify-content: space-between; padding: 2px 0; }
          .bold { font-weight: 900; }
          .footer { text-align: center; border-top: 1px dashed #94a3b8; padding-top: 4px; font-size: 9px; color: #475569; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="title-box">
          <div class="clinic-name">M.Ashraf Khan</div>
          <div class="sub-title">Homeopathic Clinic &amp; Wholesale Store</div>
          <div style="font-size: 8.5px; color: #64748b;">Lajpat Road, Hyderabad | 0311 4234777</div>
          <div class="receipt-tag">UDHAAR PAYMENT RECEIPT</div>
        </div>

        <div style="border-bottom: 1px dashed #94a3b8; padding-bottom: 4px; margin-bottom: 4px; font-size: 10px;">
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
            <span class="bold" style="color: #15803d; font-size: 12px;">Rs. ${amountPaid.toLocaleString()}</span>
          </div>
          <div class="row" style="margin-top: 2px;">
            <span class="bold">Remaining Balance Due:</span>
            <span class="bold" style="font-size: 11px; color: ${remainingBal > 0 ? '#991b1b' : '#15803d'};">Rs. ${remainingBal.toLocaleString()}</span>
          </div>
        </div>

        ${remarks ? `<div style="font-size: 9px; font-style: italic; color: #475569; margin-bottom: 6px;">Note: ${remarks}</div>` : ""}

        <div class="footer">
          <div>Thank you for your business!</div>
          <div style="margin-top: 2px;">خریدی ہوئی دوا واپس یا تبدیل نہیں ہوگی۔</div>
        </div>
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Udhaar_Receipt_${receiptNo}`);
}
