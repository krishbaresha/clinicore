/**
 * thermalPrinter.js — Enterprise 80mm Thermal Receipt, Token & Supplier Voucher Generator Engine.
 * Features high-visibility large typography, crisp contrast, exact 80mm page size reset, zero margin overflow, zero double-printing, and HTML escaping security.
 */

import { formatPatientAge } from "./formatters.js";

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Universal Thermal Print Dispatcher
 * Uses hidden iframe (immune to popup blockers) and falls back to window.open.
 */
export function executeThermalPrint(receiptHtml, title = "Print") {
  try {
    let iframe = document.getElementById("thermal-print-iframe");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "thermal-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.setAttribute("aria-hidden", "true");
      iframe.title = title || "Print Thermal Receipt";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(receiptHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.warn("Iframe print blocked, falling back to window.open:", err);
        const win = window.open("", "_blank", "width=440,height=650,scrollbars=yes,resizable=yes");
        if (win) {
          win.document.open();
          win.document.write(receiptHtml);
          win.document.close();
          setTimeout(() => { win.print(); }, 250);
        }
      }
    }, 250);
  } catch (outerErr) {
    console.warn("Direct window fallback:", outerErr);
    const win = window.open("", "_blank", "width=440,height=650,scrollbars=yes,resizable=yes");
    if (win) {
      win.document.open();
      win.document.write(receiptHtml);
      win.document.close();
      setTimeout(() => { win.print(); }, 250);
    }
  }
}

export function printThermalReceipt(sale, clinicData = null) {
  if (!sale) return;

  const clinicName = escapeHtml(clinicData?.name || "Dr. Muhammad Kashif Khan's Homeopathic Clinic & Store");
  const subtotal = Number(sale.subtotal_amount) || Number(sale.total_amount) || 0;
  const discount = Number(sale.discount_amount) || 0;
  const netTotal = Number(sale.total_amount) || subtotal;
  const cashTendered = Number(sale.cash_tendered) || netTotal;
  const changeDue = Number(sale.change_due) || Math.max(0, cashTendered - netTotal);

  const rawDate = sale.sale_date ? new Date(sale.sale_date) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-PK", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const cashierName = escapeHtml(sale.cashier_name || sale.user_name || "Store Staff");
  const customerName = escapeHtml(sale.patient_name || (sale.visit_id ? "Linked OPD Patient" : "Walk-In-Customer"));
  const invoiceId = escapeHtml(sale.receipt_no || sale.id || `POS-${Math.floor(1000 + Math.random() * 9000)}`);

  const itemsHtml = (sale.items || []).map((item) => {
    const discPct = Number(item.disc_pct || item.discount_pct || 0);
    const discBadge = discPct > 0 ? ` <span style="font-weight: 700; color: #b91c1c; font-size: 10px;">(-${discPct}%)</span>` : "";
    return `
    <div style="margin-bottom: 5px;">
      <div style="font-weight: 700; font-size: 12px; color: #111827;">${escapeHtml(item.medicine_name)}${discBadge}</div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 500; color: #4b5563; margin-top: 1px;">
        <span>${item.quantity || 1} ${escapeHtml(item.unit_label || "Unit")} × Rs. ${Number(item.unit_price || 0).toFixed(2)}</span>
        <span style="font-weight: 800; color: #111827;">Rs. ${Number(item.line_total || 0).toFixed(2)}</span>
      </div>
    </div>
  `;
  }).join("");

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
            padding: 10px 6px;
            color: #1f2937;
            background: #fff;
            font-size: 12px;
            line-height: 1.35;
          }
          .logo-badge {
            width: 40px;
            height: 40px;
            background: #0f766e;
            color: #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 18px;
            margin: 0 auto 4px auto;
          }
          .clinic-header {
            text-align: center;
            margin-bottom: 4px;
          }
          .dotted-line {
            border-top: 1px dotted #9ca3af;
            margin: 6px 0;
          }
          .meta-text {
            font-size: 11px;
            font-weight: 600;
            color: #1f2937;
            line-height: 1.5;
          }
          @media print {
            body { width: 76mm; padding: 4px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <!-- Top Clinic Branding & Logo -->
        <div class="clinic-header">
          <div class="logo-badge">${clinicName.charAt(0)}</div>
          <div style="font-size: 14px; font-weight: 900; color: #0f766e; letter-spacing: -0.2px; line-height: 1.25;">${clinicName}</div>
          <div style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Retail Medical Store Invoice</div>
        </div>

        <div class="dotted-line"></div>

        <!-- Relevant Meta Header Details -->
        <div class="meta-text">
          <div><span style="color: #6b7280; font-weight: 500;">Date &amp; Time :</span> ${dateTimeStr}</div>
          <div><span style="color: #6b7280; font-weight: 500;">Cashier :</span> ${cashierName}</div>
          <div><span style="color: #6b7280; font-weight: 500;">Customer :</span> ${customerName}</div>
          <div><span style="color: #6b7280; font-weight: 500;">Invoice # :</span> ${invoiceId}</div>
        </div>

        <div class="dotted-line"></div>

        <!-- Purchased Items List -->
        <div style="margin: 4px 0;">${itemsHtml}</div>

        <div class="dotted-line"></div>

        <!-- Summary Totals -->
        <div style="font-size: 12px; color: #374151; font-weight: 600; line-height: 1.5;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal</span>
            <span>Rs. ${Number(subtotal).toFixed(2)}</span>
          </div>
          ${discount > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #0f766e; font-weight: 700;">
            <span>Discount</span>
            <span>- Rs. ${Number(discount).toFixed(2)}</span>
          </div>
          ` : ""}
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; color: #111827; padding-top: 2px;">
            <span>Grand Total</span>
            <span>Rs. ${Number(netTotal).toFixed(2)}</span>
          </div>
          ${sale.payment_type === "cash" ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #4b5563; margin-top: 2px;">
            <span>Cash Paid</span>
            <span>Rs. ${Number(cashTendered).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #0f766e;">
            <span>Change Return</span>
            <span>Rs. ${Number(changeDue).toFixed(2)}</span>
          </div>
          ` : `
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #b45309; margin-top: 3px;">
            <span>Payment Type</span>
            <span>Credit / Udhaar (Added to Patient Ledger)</span>
          </div>
          `}
        </div>

        <div class="dotted-line"></div>

        <!-- Centered Thank You Notice -->
        <div style="text-align: center; margin: 8px 0 6px 0; font-size: 11px; font-weight: 700; color: #111827; line-height: 1.4;">
          Thank You For Shopping With Us.<br>Please Visit Again
        </div>

        <div class="dotted-line"></div>

        <!-- Developer Branding & Contact Footer -->
        <div style="text-align: center; margin-top: 6px; font-size: 10px; font-weight: 700; color: #6b7280; line-height: 1.4;">
          <div>Software Powered by: K.B Software</div>
          <div style="color: #0f766e; font-family: monospace; font-size: 11px; font-weight: 900; margin-top: 1px;">
            Phone: 03142291356
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 250);
          };
        </script>
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Receipt_${invoiceId}`);
}

/** Print 80mm Daily Day-End Cash Closure (Z-Report / Roznamcha Hisab-Kitab) */
export function printDayEndClosingReceipt(closing, clinicData = null) {
  if (!closing) return;

  const clinicName = escapeHtml(clinicData?.name || "Dr. Muhammad Kashif Khan's Homeopathic Clinic & Store");
  const rawDate = closing.date ? new Date(closing.date) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-PK", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const closedBy = escapeHtml(closing.closed_by || "Doctor / Front Desk");
  const opdFees = Number(closing.opd_fees || 0);
  const pharmacySales = Number(closing.pharmacy_sales || 0);
  const wholesaleB2B = Number(closing.wholesale_sales || 0);
  const totalInflow = opdFees + pharmacySales + wholesaleB2B;

  const expenses = Number(closing.expenses || 0);
  const supplierPayments = Number(closing.supplier_payments || 0);
  const returnsRefunds = Number(closing.returns_refunds || 0);
  const totalOutflow = expenses + supplierPayments + returnsRefunds;

  const netCashInHand = closing.expected_cash !== undefined ? Number(closing.expected_cash) : totalInflow - totalOutflow;
  const physicalCash = closing.physical_cash !== undefined ? Number(closing.physical_cash) : null;
  const cashVariance = closing.cash_variance !== undefined ? Number(closing.cash_variance) : null;
  const den = closing.denominations || null;

  let varianceText = "";
  if (cashVariance !== null) {
    if (cashVariance === 0) varianceText = "BALANCED (Rs. 0)";
    else if (cashVariance > 0) varianceText = `SURPLUS OVER (+Rs. ${cashVariance.toLocaleString()})`;
    else varianceText = `SHORTAGE (-Rs. ${Math.abs(cashVariance).toLocaleString()})`;
  }

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>DayEnd_Closing_${rawDate.toISOString().split("T")[0]}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            width: 76mm;
            margin: 0 auto;
            padding: 12px 6px;
            color: #222;
            background: #fff;
            font-size: 12px;
            line-height: 1.35;
          }
          .logo-badge {
            width: 46px; height: 46px;
            background: linear-gradient(135deg, #0d9488, #0f766e);
            color: #fff; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-weight: 900; font-size: 22px; margin: 0 auto 6px auto;
          }
          .clinic-header { text-align: center; margin-bottom: 8px; }
          .dotted-line { border-top: 1.5px dotted #999; margin: 8px 0; }
          .double-line { border-top: 3px double #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; margin-bottom: 3px; }
          .row-bold { display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; margin: 4px 0; }
          .row-large { display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; color: #000; padding: 6px 8px; background: #f0fdf4; border: 1.5px solid #0f766e; border-radius: 8px; margin: 6px 0; }
          .den-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
          .den-table th, .den-table td { border: 1px solid #ccc; padding: 2px 4px; text-align: center; }
          @media print { body { width: 76mm; padding: 4px; } .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="clinic-header">
          <div class="logo-badge">${clinicName.charAt(0)}</div>
          <div style="font-size: 16px; font-weight: 900; color: #0f766e;">${clinicName}</div>
          <div style="font-size: 11px; font-weight: 800; color: #4b5563; text-transform: uppercase; margin-top: 2px;">
            DAY-END CASH CLOSING (Z-REPORT)
          </div>
        </div>

        <div class="dotted-line"></div>

        <div style="font-size: 11px; font-weight: 600;">
          <div><strong>Closing Date:</strong> ${dateTimeStr}</div>
          <div><strong>Closed By:</strong> ${closedBy}</div>
          <div><strong>OPD Patients:</strong> ${closing.total_tokens || 0} Visits</div>
        </div>

        <div class="dotted-line"></div>

        <div style="font-size: 11px; font-weight: 800; color: #0f766e; text-transform: uppercase; margin-bottom: 4px;">
          (+) CASH INFLOWS (COLLECTIONS)
        </div>
        <div class="row"><span>OPD Doctor Fees:</span> <span>Rs. ${opdFees.toLocaleString()}</span></div>
        <div class="row"><span>Pharmacy Store Sales:</span> <span>Rs. ${pharmacySales.toLocaleString()}</span></div>
        <div class="row"><span>Wholesale B2B Sales:</span> <span>Rs. ${wholesaleB2B.toLocaleString()}</span></div>
        <div class="row-bold" style="color: #0f766e;"><span>Total Cash Inflow:</span> <span>Rs. ${totalInflow.toLocaleString()}</span></div>

        <div class="dotted-line"></div>

        <div style="font-size: 11px; font-weight: 800; color: #b91c1c; text-transform: uppercase; margin-bottom: 4px;">
          (-) CASH OUTFLOWS (EXPENSES &amp; BILLS)
        </div>
        <div class="row"><span>Daily Clinic Expenses:</span> <span>Rs. ${expenses.toLocaleString()}</span></div>
        <div class="row"><span>Supplier Cash Payments:</span> <span>Rs. ${supplierPayments.toLocaleString()}</span></div>
        <div class="row"><span>Sales Returns &amp; Refunds:</span> <span>Rs. ${returnsRefunds.toLocaleString()}</span></div>
        <div class="row-bold" style="color: #b91c1c;"><span>Total Cash Outflow:</span> <span>Rs. ${totalOutflow.toLocaleString()}</span></div>

        <div class="double-line"></div>

        <div class="row-large">
          <span>SYSTEM EXPECTED CASH:</span>
          <span>Rs. ${netCashInHand.toLocaleString()}</span>
        </div>

        ${physicalCash !== null ? `
          <div class="row-bold" style="background: #fffbe6; padding: 4px 6px; border-radius: 6px; border: 1px solid #f59e0b;">
            <span>PHYSICAL COUNTED:</span>
            <span>Rs. ${physicalCash.toLocaleString()}</span>
          </div>
          <div class="row-bold" style="color: ${cashVariance === 0 ? '#059669' : cashVariance < 0 ? '#dc2626' : '#2563eb'}; margin-top: 2px;">
            <span>CASH AUDIT VARIANCE:</span>
            <span>${varianceText}</span>
          </div>
        ` : ''}

        ${den ? `
          <div class="dotted-line"></div>
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase;">CASH DENOMINATIONS COUNT:</div>
          <table class="den-table">
            <thead>
              <tr style="background: #f3f4f6;"><th>Note</th><th>Qty</th><th>Subtotal</th></tr>
            </thead>
            <tbody>
              ${[5000, 1000, 500, 100, 50, 20, 10].map(n => {
    const qty = den[`note${n}`] || 0;
    if (qty === 0) return '';
    return `<tr><td>Rs. ${n}</td><td>${qty}</td><td>Rs. ${(n * qty).toLocaleString()}</td></tr>`;
  }).join('')}
            </tbody>
          </table>
        ` : ''}

        <div class="dotted-line"></div>

        <div style="text-align: center; font-size: 11px; font-weight: 800; color: #374151; margin-top: 8px;">
          <div>Verified Cash Drawer Shift Audit</div>
          <div style="margin-top: 4px;">Software Powered by: K.B Software</div>
          <div style="color: #0d9488; font-family: monospace; font-size: 12px; font-weight: 900;">Phone: 03142291356</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 250);
          };
        </script>
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Closing_${dateTimeStr}`);
}

/** Print Company / Supplier Stock Purchase Thermal Invoice */
export function printSupplierPurchaseReceipt(purchase, supplier = null, clinicData = null) {
  if (!purchase) return;

  const clinicName = escapeHtml(clinicData?.name || "Dr. Muhammad Kashif Khan's Homeopathic Clinic & Store");
  const supplierName = escapeHtml(supplier?.company_name || purchase.supplier_name || "Company Distributor");
  const totalAmount = Number(purchase.total_amount) || 0;
  const paidAmount = Number(purchase.paid_amount) || 0;
  const balanceDue = Number(purchase.balance_due) || Math.max(0, totalAmount - paidAmount);

  const rawDate = purchase.purchase_date ? new Date(purchase.purchase_date) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-PK", {
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
            padding: 12px 6px;
            color: #222;
            background: #fff;
            font-size: 12px;
            line-height: 1.35;
          }
          .logo-badge {
            width: 46px;
            height: 46px;
            background: linear-gradient(135deg, #0d9488, #0f766e);
            color: #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 22px;
            margin: 0 auto 6px auto;
            box-shadow: 0 4px 10px rgba(13, 148, 136, 0.25);
          }
          .clinic-header {
            text-align: center;
            margin-bottom: 8px;
          }
          .dotted-line {
            border-top: 1.5px dotted #999;
            margin: 8px 0;
          }
          .meta-text {
            font-size: 12px;
            font-weight: 600;
            color: #222;
            line-height: 1.45;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 600;
            color: #333;
            margin-bottom: 3px;
          }
          .grand-total-row {
            display: flex;
            justify-content: space-between;
            font-size: 15px;
            font-weight: 900;
            color: #000;
            margin-top: 4px;
          }
          .payment-table {
            width: 100%;
            border-collapse: collapse;
            margin: 6px 0;
          }
          .payment-table th {
            background: #f3f4f6;
            font-size: 11px;
            font-weight: 700;
            color: #374151;
            padding: 4px 6px;
            text-align: left;
          }
          .payment-table td {
            font-size: 11px;
            font-weight: 700;
            color: #111827;
            padding: 4px 6px;
          }
          
          @media print {
            body { width: 76mm; padding: 4px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <!-- Top Clinic Branding & Logo -->
        <div class="clinic-header">
          <div class="logo-badge">${clinicName.charAt(0)}</div>
          <div style="font-size: 16px; font-weight: 900; color: #0f766e; letter-spacing: -0.3px;">${clinicName}</div>
          <div style="font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Stock Purchase Voucher</div>
        </div>

        <div class="dotted-line"></div>

        <!-- Relevant Meta Header Details -->
        <div class="meta-text">
          <div><strong style="color: #4b5563;">Date &amp; Time :</strong> ${dateTimeStr}</div>
          <div><strong style="color: #4b5563;">Entered By :</strong> ${cashierName}</div>
          <div><strong style="color: #4b5563;">Supplier :</strong> ${supplierName}</div>
          <div><strong style="color: #4b5563;">Invoice # :</strong> ${invoiceId}</div>
        </div>

        <div class="dotted-line"></div>

        <!-- Purchased Stock List -->
        <div style="margin: 6px 0;">${itemsHtml}</div>

        <div class="dotted-line"></div>

        <!-- Summary Totals -->
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

        <div class="dotted-line"></div>

        <!-- Centered Notice -->
        <div style="text-align: center; margin: 10px 0 8px 0;">
          <div style="font-size: 12px; font-weight: 800; color: #111;">
            Stock Received &amp; Verified in Inventory
          </div>
        </div>

        <div class="dotted-line"></div>

        <!-- Developer Branding & Contact Footer -->
        <div style="text-align: center; margin-top: 8px; font-size: 11px; font-weight: 800; color: #374151; line-height: 1.4;">
          <div>Software Powered by: K.B Software</div>
          <div style="color: #0d9488; font-family: monospace; font-size: 12px; font-weight: 900; margin-top: 2px;">
            Phone: 03142291356
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 250);
          };
        </script>
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Purchase_${invoiceId}`);
}

//** Print OPD Consultation Token Thermal Receipt - Clean, Minimal & Ink-Saving */
export function printOPDTokenReceipt(receipt, clinicData = null) {
  if (!receipt) return;

  const clinicName = escapeHtml(clinicData?.name || "Dr. Muhammad Kashif Khan's Clinic");
  const tokenNo = escapeHtml(String(receipt.token || receipt.token_number || "01").padStart(2, "0"));
  const patientName = escapeHtml(receipt.patient?.full_name || receipt.patient_name || "Patient");
  const relLabel = { father: "S/O", husband: "W/O", wife: "H/O", mother: "D/O" }[receipt.patient?.relation_type] || "S/O";
  const relationName = receipt.patient?.relation_name ? `${relLabel} ${escapeHtml(receipt.patient.relation_name)}` : "";
  const fee = Number(receipt.fee != null ? receipt.fee : (receipt.visit?.fee_amount || 0));

  const rawDate = receipt.registeredAt ? new Date(receipt.registeredAt) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-PK", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const doctorName = escapeHtml(receipt.doctor?.name || receipt.visit?.doctor_name || "Doctor");
  const clinicAddress = escapeHtml(clinicData?.address || "Lajpat Road, Hyderabad");
  const clinicPhone = escapeHtml(clinicData?.phone || "03473100304");
  const phone = escapeHtml(receipt.patient?.phone || receipt.phone || "—");
  const age = escapeHtml(formatPatientAge(receipt.patient));

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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          body {
            width: 76mm;
            margin: 0 auto;
            padding: 8px 6px;
            color: #000;
            background: #fff;
            font-size: 12px;
            line-height: 1.35;
          }
          .text-center { text-align: center; }
          .divider-single {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
          .divider-double {
            border-top: 2px double #000;
            margin: 5px 0;
          }
          .token-box {
            border: 2px solid #000;
            border-radius: 8px;
            padding: 6px 4px;
            margin: 6px 0;
            text-align: center;
            background: #fff;
          }
          .token-num {
            font-size: 40px;
            font-weight: 900;
            color: #000;
            line-height: 1;
            margin-top: 2px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-top: 2px;
          }
          @media print {
            body { width: 76mm; padding: 2px; }
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div style="font-size: 16px; font-weight: 900;">${clinicName}</div>
          <div style="font-size: 10px; color: #333; font-weight: bold;">${clinicAddress} · Ph: ${clinicPhone}</div>
          <div style="font-size: 12px; font-weight: 900; margin-top: 3px; letter-spacing: 0.5px;">OPD CONSULTATION TOKEN</div>
          <div style="font-size: 10px; color: #555; margin-top: 2px;">${dateTimeStr}</div>
        </div>

        <div class="divider-double"></div>

        <!-- Big Token Box -->
        <div class="token-box">
          <div style="font-size: 10px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">PATIENT TOKEN NUMBER</div>
          <div class="token-num">${tokenNo}</div>
        </div>

        <!-- Doctor & Patient Info -->
        <div style="font-size: 12px; font-weight: bold; margin-top: 4px;">
          <div class="info-row">
            <span style="color: #444;">Doctor:</span>
            <span style="font-weight: 900;">${doctorName}</span>
          </div>
          <div class="info-row">
            <span style="color: #444;">Patient:</span>
            <span>${patientName}</span>
          </div>
          ${relationName ? `
          <div class="info-row">
            <span style="color: #444;">Relation:</span>
            <span>${relationName}</span>
          </div>` : ''}
          <div class="info-row">
            <span style="color: #444;">Age:</span>
            <span>${age} (${receipt.patient?.gender || "Male"})</span>
          </div>
          ${phone !== "—" ? `
          <div class="info-row">
            <span style="color: #444;">Phone:</span>
            <span>${phone}</span>
          </div>` : ''}
        </div>

        <div class="divider-single"></div>

        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; padding: 2px 0;">
          <span>Consultation Fee:</span>
          <span>Rs. ${Number(fee).toLocaleString()}</span>
        </div>

        <div class="divider-double"></div>

        <div class="text-center" style="font-size: 10px; margin-top: 5px; font-weight: bold;">
          <div>Please wait for your turn. Thank you!</div>
          <div style="font-size: 9px; margin-top: 2px; color: #444;">شکریہ — جزاک اللہ خیرا</div>
        </div>
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `Token_${tokenNo}`);
}

/** Print Product Stock Movement & Traceability Card (80mm / Low-Ink Minimalist) */
export function printProductStockCard(item, transactions = [], summary = {}, clinicData = null) {
  if (!item) return;

  const clinicName = escapeHtml(clinicData?.name || "Dr. Muhammad Kashif Khan Clinic");
  const clinicAddress = escapeHtml(clinicData?.address || "Lajpat Road, Hyderabad");
  const clinicPhone = escapeHtml(clinicData?.phone || "0300-1234567");
  const rawDate = new Date();
  const dateTimeStr = rawDate.toLocaleString("en-PK", {
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
            padding: 8px 4px;
            color: #000;
            background: #fff;
            font-size: 11px;
            line-height: 1.3;
          }
          .text-center { text-align: center; }
          .divider-single { border-top: 1px solid #000; margin: 5px 0; }
          .divider-double { border-top: 2.5px double #000; margin: 5px 0; }
          .divider-dashed { border-top: 1px dashed #000; margin: 5px 0; }
          .summary-box {
            border: 1.5px solid #000;
            padding: 4px;
            margin: 5px 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2px 6px;
            font-size: 10px;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th { text-align: left; font-size: 10px; border-bottom: 1.5px solid #000; padding: 2px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div style="font-size: 15px; font-weight: 900;">${clinicName}</div>
          <div style="font-size: 10px; color: #222;">${clinicAddress} · Ph: ${clinicPhone}</div>
          <div style="font-size: 12px; font-weight: 900; margin-top: 3px; letter-spacing: 0.5px; text-decoration: underline;">PRODUCT STOCK AUDIT CARD</div>
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

        <div class="text-center" style="font-size: 9px; margin-top: 4px; color: #333; font-weight: bold;">
          Software Powered by: K.B Software · 03142291356
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 250);
          };
        </script>
      </body>
    </html>
  `;

  executeThermalPrint(receiptHtml, `StockCard_${escapeHtml(item.medicine_name)}`);
}



