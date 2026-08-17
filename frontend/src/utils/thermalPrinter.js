/**
 * thermalPrinter.js — Enterprise 80mm Thermal Receipt, Token & Supplier Voucher Generator Engine.
 * Features high-visibility large typography, crisp contrast, exact 80mm page size reset, zero margin overflow, zero double-printing, and HTML escaping security.
 */

import { formatPatientAge } from "./formatters.js";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function printThermalReceipt(sale, clinicData = null) {
  if (!sale) return;

  const clinicName = escapeHtml(clinicData?.name || "Dr. Asif Ashraf's Clinic");
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

  const cashierName = escapeHtml(sale.cashier_name || sale.user_name || "Cashier Desk");
  const customerName = escapeHtml(sale.patient_name || (sale.visit_id ? "Linked Patient" : "Walk-In-Customer"));
  const invoiceId = escapeHtml(sale.id || `SL_${Math.floor(1000 + Math.random() * 9000)}`);

  const itemsHtml = (sale.items || []).map((item) => `
    <div style="margin-bottom: 6px;">
      <div style="font-weight: 700; font-size: 13px; color: #111;">${escapeHtml(item.medicine_name)}</div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #444; margin-top: 1px;">
        <span>${Number(item.quantity || 1).toFixed(2)} ${escapeHtml(item.unit_label || "Pc")} X ${Number(item.unit_price || 0).toFixed(2)}</span>
        <span style="font-weight: 800; color: #000;">Rs. ${Number(item.line_total || 0).toFixed(2)}</span>
      </div>
    </div>
  `).join("");

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
          <div style="font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Medical Store Tax Invoice</div>
        </div>

        <div class="dotted-line"></div>

        <!-- Relevant Meta Header Details -->
        <div class="meta-text">
          <div><strong style="color: #4b5563;">Date &amp; Time :</strong> ${dateTimeStr}</div>
          <div><strong style="color: #4b5563;">Cashier :</strong> ${cashierName}</div>
          <div><strong style="color: #4b5563;">Customer :</strong> ${customerName}</div>
          <div><strong style="color: #4b5563;">Invoice # :</strong> ${invoiceId}</div>
        </div>

        <div class="dotted-line"></div>

        <!-- Purchased Items List -->
        <div style="margin: 6px 0;">${itemsHtml}</div>

        <div class="dotted-line"></div>

        <!-- Summary Totals -->
        <div style="margin: 6px 0;">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>Rs. ${subtotal.toFixed(2)}</span>
          </div>
          ${discount > 0 ? `
          <div class="summary-row" style="color: #0d9488;">
            <span>Discount</span>
            <span>- Rs. ${discount.toFixed(2)}</span>
          </div>
          ` : ""}
          <div class="grand-total-row">
            <span>Grand Total</span>
            <span>Rs. ${netTotal.toFixed(2)}</span>
          </div>
        </div>

        <div class="dotted-line"></div>

        <!-- Payment Header Table -->
        <table class="payment-table">
          <thead>
            <tr>
              <th style="width: 35%;">Paid By:</th>
              <th style="width: 35%; text-align: center;">Amount:</th>
              <th style="width: 30%; text-align: right;">Change Return:</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-transform: capitalize; font-weight: 800;">${escapeHtml(sale.payment_type || "Cash")}</td>
              <td style="text-align: center;">${cashTendered.toFixed(2)}</td>
              <td style="text-align: right;">${changeDue.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="dotted-line"></div>

        <!-- Centered Thank You Notice -->
        <div style="text-align: center; margin: 10px 0 8px 0;">
          <div style="font-size: 12px; font-weight: 800; color: #111;">
            Thank You For Shopping With Us .<br>Please Come Again
          </div>
        </div>

        <div class="dotted-line"></div>

        <!-- Developer Branding & Contact Footer -->
        <div style="text-align: center; margin-top: 8px; font-size: 11px; font-weight: 800; color: #374151; line-height: 1.4;">
          <div>Software Powered by: K.B Software</div>
          <div style="color: #0d9488; font-family: monospace; font-size: 12px; font-weight: 900; margin-top: 2px;">
            📞 Contact: 03142291356
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

  const printWindow = window.open("", "_blank", "width=440,height=650,scrollbars=yes,resizable=yes");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  } else {
    alert("Pop-up blocker prevented opening receipt window. Please allow popups for this site.");
  }
}

/** Print 80mm Daily Day-End Cash Closure (Z-Report / Roznamcha Hisab-Kitab) */
export function printDayEndClosingReceipt(closing, clinicData = null) {
  if (!closing) return;

  const clinicName = escapeHtml(clinicData?.name || "Dr. Asif Ashraf's Clinic");
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
          <div style="color: #0d9488; font-family: monospace; font-size: 12px; font-weight: 900;">📞 Contact: 03142291356</div>
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

  const printWindow = window.open("", "_blank", "width=440,height=650,scrollbars=yes,resizable=yes");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  } else {
    alert("Pop-up blocker prevented opening closing receipt window. Please allow popups for this site.");
  }
}

/** Print Company / Supplier Stock Purchase Thermal Invoice */
export function printSupplierPurchaseReceipt(purchase, supplier = null, clinicData = null) {
  if (!purchase) return;

  const clinicName = escapeHtml(clinicData?.name || "Dr. Asif Ashraf's Clinic");
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
            📞 Contact: 03142291356
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

  const printWindow = window.open("", "_blank", "width=440,height=650,scrollbars=yes,resizable=yes");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  } else {
    alert("Pop-up blocker prevented opening purchase invoice window. Please allow popups for this site.");
  }
}

/** Print OPD Consultation Token Thermal Receipt */
export function printOPDTokenReceipt(receipt, clinicData = null) {
  if (!receipt) return;

  const clinicName = escapeHtml(clinicData?.name || "Dr. Asif Ashraf's Clinic");
  const tokenNo = escapeHtml(String(receipt.token || receipt.token_number || "01").padStart(2, "0"));
  const patientName = escapeHtml(receipt.patient?.full_name || receipt.patient_name || "Patient");
  const fee = Number(receipt.fee != null ? receipt.fee : (receipt.visit?.fee_amount || 800));

  const rawDate = receipt.registeredAt ? new Date(receipt.registeredAt) : new Date();
  const dateTimeStr = rawDate.toLocaleString("en-PK", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const doctorName = escapeHtml(receipt.doctor?.name || receipt.visit?.doctor_name || "Dr. Asif Ashraf");
  const doctorSpecialization = escapeHtml(receipt.doctor?.specialization || receipt.visit?.doctor_specialization || "General Physician");
  const doctorRoom = escapeHtml(receipt.doctor?.room_number || receipt.visit?.room_number || "Room 1");
  const receptionistName = escapeHtml(receipt.receptionist_name || "Reception Desk");
  const clinicAddress = escapeHtml(clinicData?.address || "Lajpat Road, Hyderabad");
  const clinicPhone = escapeHtml(clinicData?.phone || "03001234567");
  const phone = escapeHtml(receipt.patient?.phone || receipt.phone || "—");
  const age = escapeHtml(formatPatientAge(receipt.patient));
  const dateStr = escapeHtml(dateTimeStr);
  const visitType = escapeHtml(receipt.visit_type === "follow_up" || receipt.visit?.visit_type === "follow_up" ? "Follow-up" : "New Visit");

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
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            width: 76mm;
            margin: 0 auto;
            padding: 10px 6px;
            color: #000;
            background: #fff;
            font-size: 12px;
            line-height: 1.35;
          }
          .text-center { text-align: center; }
          .divider-single {
            border-top: 1px solid #000;
            margin: 6px 0;
          }
          .divider-double {
            border-top: 2.5px double #000;
            margin: 6px 0;
          }
          .token-box {
            border: 2.5px solid #000;
            border-radius: 12px;
            padding: 8px 4px;
            margin: 6px 0;
            text-align: center;
            background: #fff;
          }
          .token-num {
            font-size: 44px;
            font-weight: 900;
            color: #000;
            line-height: 1;
            margin-top: 2px;
          }
          .doctor-box {
            border: 2px solid #000;
            padding: 6px 8px;
            border-radius: 6px;
            margin: 6px 0;
            background: #fff;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-top: 2px;
          }
          @media print {
            body { width: 76mm; padding: 4px; }
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div style="font-size: 17px; font-weight: 900;">${clinicName}</div>
          <div style="font-size: 10px; color: #222; font-weight: bold;">${clinicAddress} · Ph: ${clinicPhone}</div>
          <div style="font-size: 13px; font-weight: 900; margin-top: 4px; letter-spacing: 1px; text-decoration: underline;">OPD CONSULTATION TOKEN</div>
          <div style="font-size: 10px; color: #444; margin-top: 2px;">${dateTimeStr}</div>
        </div>

        <div class="divider-double"></div>

        <!-- Big Token Box -->
        <div class="token-box">
          <div style="font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">PATIENT TOKEN NUMBER</div>
          <div class="token-num">${tokenNo}</div>
        </div>

        <!-- Attending Doctor Box -->
        <div class="doctor-box">
          <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #333; letter-spacing: 1px;">Attending Doctor:</div>
          <div style="font-size: 15px; font-weight: 900; color: #000; margin-top: 1px;">👨‍⚕️ ${doctorName}</div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #222; margin-top: 3px;">
            <span>${doctorSpecialization}</span>
            <span style="font-weight: 900; background: #000; color: #fff; padding: 1px 6px; border-radius: 4px;">🚪 Chamber: ${doctorRoom}</span>
          </div>
        </div>

        <!-- Patient Info -->
        <div style="font-size: 13px; font-weight: bold; margin-top: 4px;">
          <div><span style="font-weight: 900;">Patient:</span> ${patientName}</div>
          <div class="info-row">
            <span>Phone: ${phone}</span>
            <span>Age: ${age}</span>
          </div>
          <div class="info-row">
            <span>Type: ${visitType}</span>
            <span>Date: ${dateStr.split(',')[0]}</span>
          </div>
        </div>

        <div class="divider-single"></div>

        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; padding: 4px 0;">
          <span>Consultation Fee:</span>
          <span>Rs. ${Number(fee).toLocaleString()}</span>
        </div>

        <div class="divider-double"></div>

        <div class="text-center" style="font-size: 11px; margin-top: 6px; font-weight: bold;">
          <div>Please wait in waiting area for your token call.</div>
          <div style="margin-top: 4px; padding: 4px; background: #f0fdfa; border: 1px dashed #0d9488; border-radius: 4px; font-size: 11px; color: #0f766e;">
            🌐 <strong>Live Token Tracker:</strong> Open <code>/live</code> on your phone to track queue!
          </div>
          <div style="font-size: 10px; font-weight: 900; margin-top: 6px; color: #333;">Software Powered by: K.B Software</div>
          <div style="font-size: 10px; font-weight: 900; color: #0d9488;">📞 Contact: 03142291356</div>
        </div>
      </body>
    </html>
  `;

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
      } catch {
        // Fallback to window.open if iframe is blocked
        const win = window.open("", "_blank", "width=440,height=650,scrollbars=yes,resizable=yes");
        if (win) {
          win.document.open();
          win.document.write(receiptHtml);
          win.document.close();
          setTimeout(() => { win.print(); }, 250);
        }
      }
    }, 250);
  } catch (err) {
    const win = window.open("", "_blank", "width=440,height=650,scrollbars=yes,resizable=yes");
    if (win) {
      win.document.open();
      win.document.write(receiptHtml);
      win.document.close();
      setTimeout(() => { win.print(); }, 250);
    } else {
      window.print();
    }
  }
}

