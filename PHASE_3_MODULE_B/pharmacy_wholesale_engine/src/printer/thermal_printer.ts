/**
 * 80mm ESC/POS Thermal Receipt Formatting Engine
 * Generates low-ink 80mm printable ESC/POS binary buffer commands and sanitized HTML DOM preview snippets.
 * Includes version watermark footers and sanitization.
 */

export interface ReceiptLineItem {
  name: string;
  batch: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface ESCPOSReceiptData {
  clinicHeader: {
    title: string;
    doctorName: string;
    address: string;
    phone: string;
  };
  invoiceNo: string;
  date: string;
  customerOrParty: string;
  salesman?: string;
  paymentMode: string;
  items: ReceiptLineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  netTotal: number;
  tendered?: number;
  change?: number;
  biltyNo?: string;
  transportCo?: string;
  versionWatermark: string;
}

/**
 * Escapes HTML characters for strict DOM sanitization.
 */
export function sanitizeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class ThermalPrinter80mm {
  private readonly paperWidthChars: number = 48;

  /**
   * Center-align text within 48 columns
   */
  private padCenter(text: string, width: number = this.paperWidthChars): string {
    if (text.length >= width) return text.substring(0, width);
    const leftPadding = Math.floor((width - text.length) / 2);
    return ' '.repeat(leftPadding) + text;
  }

  /**
   * Space-between two columns (Key & Value)
   */
  private padBetween(left: string, right: string, width: number = this.paperWidthChars): string {
    const space = width - left.length - right.length;
    if (space <= 0) {
      return (left + ' ' + right).substring(0, width);
    }
    return left + ' '.repeat(space) + right;
  }

  /**
   * Generate raw text representation formatted for 80mm thermal paper (48 chars width).
   */
  public generatePlainTextReceipt(data: ESCPOSReceiptData): string {
    const lines: string[] = [];

    // Header
    lines.push('================================================');
    lines.push(this.padCenter(data.clinicHeader.title.toUpperCase()));
    lines.push(this.padCenter(data.clinicHeader.doctorName));
    lines.push(this.padCenter(data.clinicHeader.address));
    lines.push(this.padCenter(`Ph: ${data.clinicHeader.phone}`));
    lines.push('================================================');

    // Invoice Meta
    lines.push(this.padBetween(`Invoice: ${data.invoiceNo}`, `Date: ${data.date}`));
    lines.push(this.padBetween(`Party/Cust: ${data.customerOrParty}`, `Mode: ${data.paymentMode}`));
    if (data.salesman) {
      lines.push(`Salesman: ${data.salesman}`);
    }
    if (data.biltyNo) {
      lines.push(this.padBetween(`Bilty: ${data.biltyNo}`, `Trans: ${data.transportCo || 'N/A'}`));
    }
    lines.push('------------------------------------------------');

    // Table Header (48 chars)
    // Item (20) | Batch (10) | Qty (4) | Rate (6) | Amt (8)
    lines.push('Item Description     Batch      Qty  Rate   Amount');
    lines.push('------------------------------------------------');

    for (const item of data.items) {
      const name = item.name.length > 20 ? item.name.substring(0, 18) + '..' : item.name.padEnd(20);
      const batch = item.batch.length > 10 ? item.batch.substring(0, 10) : item.batch.padEnd(10);
      const qty = item.qty.toString().padStart(4);
      const rate = item.rate.toString().padStart(6);
      const amt = item.amount.toFixed(0).padStart(8);

      lines.push(`${name} ${batch} ${qty} ${rate} ${amt}`);
    }

    lines.push('------------------------------------------------');
    lines.push(this.padBetween('Subtotal:', `Rs. ${data.subtotal.toFixed(2)}`));
    if (data.discount > 0) {
      lines.push(this.padBetween('Total Discount:', `- Rs. ${data.discount.toFixed(2)}`));
    }
    if (data.tax > 0) {
      lines.push(this.padBetween('Sales Tax:', `Rs. ${data.tax.toFixed(2)}`));
    }
    lines.push('================================================');
    lines.push(this.padBetween('NET TOTAL:', `Rs. ${data.netTotal.toFixed(2)}`));
    lines.push('================================================');

    if (data.tendered !== undefined && data.change !== undefined) {
      lines.push(this.padBetween('Cash Tendered:', `Rs. ${data.tendered.toFixed(2)}`));
      lines.push(this.padBetween('Change Returned:', `Rs. ${data.change.toFixed(2)}`));
    }

    lines.push('');
    lines.push(this.padCenter('*** THANK YOU FOR YOUR BUSINESS ***'));
    lines.push(this.padCenter('Software: ClinicFlow Web/Desktop Hybrid Engine'));
    lines.push(this.padCenter(`Version: ${data.versionWatermark}`));
    lines.push('================================================\n\n');

    return lines.join('\n');
  }

  /**
   * Generate ESC/POS Binary Buffer commands for 80mm thermal receipt printer.
   * ESC @ (Initialize), ESC a 1 (Center), ESC E 1 (Bold On), etc.
   */
  public generateESCPOSBuffer(data: ESCPOSReceiptData): Uint8Array {
    const text = this.generatePlainTextReceipt(data);
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);

    // ESC/POS Command Sequences
    const initCmd = new Uint8Array([0x1b, 0x40]);             // ESC @ (Initialize Printer)
    const setCodepage = new Uint8Array([0x1b, 0x74, 0x00]);    // ESC t 0 (PC437 Standard)
    const cutPaperCmd = new Uint8Array([0x1d, 0x56, 0x41, 0x03]); // GS V 65 3 (Partial Cut paper)

    // Concatenate into single binary Uint8Array buffer
    const totalLength = initCmd.length + setCodepage.length + textBytes.length + cutPaperCmd.length;
    const buffer = new Uint8Array(totalLength);

    let offset = 0;
    buffer.set(initCmd, offset); offset += initCmd.length;
    buffer.set(setCodepage, offset); offset += setCodepage.length;
    buffer.set(textBytes, offset); offset += textBytes.length;
    buffer.set(cutPaperCmd, offset); offset += cutPaperCmd.length;

    return buffer;
  }

  /**
   * Generates sanitized HTML representation for screen preview in POS UI.
   */
  public generateSanitizedHTMLPreview(data: ESCPOSReceiptData): string {
    const s = sanitizeHtml;
    const rows = data.items.map((item) => `
      <tr>
        <td style="text-align:left; font-family:monospace;">${s(item.name)}</td>
        <td style="text-align:center; font-family:monospace;">${s(item.batch)}</td>
        <td style="text-align:right; font-family:monospace;">${item.qty}</td>
        <td style="text-align:right; font-family:monospace;">Rs. ${item.rate}</td>
        <td style="text-align:right; font-family:monospace;">Rs. ${item.amount.toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <div style="width: 320px; font-family: monospace; font-size: 12px; padding: 10px; background: #fff; color: #000; border: 1px solid #ccc;">
        <div style="text-align: center; font-weight: bold; font-size: 14px;">${s(data.clinicHeader.title)}</div>
        <div style="text-align: center;">${s(data.clinicHeader.doctorName)}</div>
        <div style="text-align: center; font-size: 10px;">${s(data.clinicHeader.address)}</div>
        <div style="text-align: center; font-size: 10px;">Ph: ${s(data.clinicHeader.phone)}</div>
        <hr style="border: top 1px dashed #000; margin: 6px 0;"/>
        <div><strong>Invoice #:</strong> ${s(data.invoiceNo)}</div>
        <div><strong>Date:</strong> ${s(data.date)}</div>
        <div><strong>Party/Cust:</strong> ${s(data.customerOrParty)}</div>
        <div><strong>Payment Mode:</strong> ${s(data.paymentMode)}</div>
        ${data.salesman ? `<div><strong>Salesman:</strong> ${s(data.salesman)}</div>` : ''}
        ${data.biltyNo ? `<div><strong>Bilty #:</strong> ${s(data.biltyNo)} (${s(data.transportCo || '')})</div>` : ''}
        <hr style="border: top 1px dashed #000; margin: 6px 0;"/>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align:left;">Item</th>
              <th style="text-align:center;">Batch</th>
              <th style="text-align:right;">Qty</th>
              <th style="text-align:right;">Rate</th>
              <th style="text-align:right;">Amt</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <hr style="border: top 1px dashed #000; margin: 6px 0;"/>
        <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>Rs. ${data.subtotal.toFixed(2)}</span></div>
        ${data.discount > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Discount:</span><span>- Rs. ${data.discount.toFixed(2)}</span></div>` : ''}
        ${data.tax > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Tax:</span><span>Rs. ${data.tax.toFixed(2)}</span></div>` : ''}
        <hr style="border: top 1px double #000; margin: 4px 0;"/>
        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size: 13px;"><span>NET TOTAL:</span><span>Rs. ${data.netTotal.toFixed(2)}</span></div>
        <hr style="border: top 1px double #000; margin: 4px 0;"/>
        <div style="text-align:center; margin-top: 10px; font-size: 10px; color: #555;">
          <div>*** THANK YOU FOR YOUR BUSINESS ***</div>
          <div>ClinicFlow Thermal Engine v3.0</div>
          <div>Watermark: ${s(data.versionWatermark)}</div>
        </div>
      </div>
    `.trim();
  }
}
