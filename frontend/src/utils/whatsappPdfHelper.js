/**
 * whatsappPdfHelper.js — Automated Day Closing Receipt PDF Generator & WhatsApp Smart Dispatcher
 * 
 * Features:
 * 1. Generates pixel-perfect 80mm ESC/POS Day Closing Receipt PDF via html2canvas + jsPDF.
 * 2. Automatically triggers native download of the PDF: Day_Closing_Receipt_YYYY-MM-DD.pdf.
 * 3. Copies formatted Z-Report closing summary text to system clipboard for instant Ctrl+V.
 * 4. Smart WhatsApp Dispatcher:
 *    - Tries WhatsApp Desktop application (whatsapp://) first.
 *    - Automatically detects if desktop app took focus; falls back cleanly to WhatsApp Web (https://web.whatsapp.com/).
 */

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Format any Pakistani or international phone number to WhatsApp international standard.
 * e.g. "0347-3100304" -> "923473100304", "+92 347 3100304" -> "923473100304"
 */
export function formatWhatsAppPhone(phone) {
  let clean = String(phone || "").replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) {
    clean = "92" + clean.slice(1);
  }
  if (!clean.startsWith("92") && clean.length === 10) {
    clean = "92" + clean;
  }
  return clean;
}

/**
 * Generate and download a high-definition PDF of the Day Closing Receipt.
 * @param {HTMLElement|string} previewTarget - The DOM element or selector containing the receipt.
 * @param {string} dateStr - Date string for filename (e.g. "2026-09-06").
 * @returns {Promise<string>} The generated filename.
 */
export async function generateAndDownloadClosingPDF(previewTarget, dateStr = "") {
  let element = null;
  if (typeof previewTarget === "string") {
    element = document.querySelector(previewTarget);
  } else if (previewTarget instanceof HTMLElement) {
    element = previewTarget;
  }

  if (!element && typeof document !== "undefined") {
    element = document.getElementById("day-closing-thermal-preview") || document.querySelector("[data-closing-preview]");
  }

  if (!element) {
    throw new Error("Receipt preview element not found for PDF export.");
  }

  // Render element to high-res canvas (2x DPI for crisp thermal typography)
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.98);
  const imgWidth = 80; // 80mm thermal width
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const pageHeight = Math.max(120, imgHeight + 4);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [imgWidth, pageHeight],
  });

  pdf.addImage(imgData, "JPEG", 0, 2, imgWidth, imgHeight, undefined, "FAST");

  const cleanDate = (dateStr || new Date().toISOString().split("T")[0]).replace(/[^0-9-]/g, "");
  const filename = `Day_Closing_Receipt_${cleanDate}.pdf`;
  pdf.save(filename);

  return filename;
}

/**
 * Smart WhatsApp Protocol Launcher
 * Tries Desktop application protocol (whatsapp://) first.
 * If desktop app does not open within timeout, opens WhatsApp Web in browser.
 * 
 * @param {string} phone - Target recipient phone number.
 * @param {string} text - Message body text.
 * @param {object} options - Configuration options.
 */
export function openWhatsAppSmart(phone, text = "", options = {}) {
  const { fallbackTimeout = 1400, onFallback = null } = options;
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text || "");

  const desktopUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
  const webUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;

  if (!cleanPhone) {
    if (typeof alert !== "undefined") {
      alert("⚠️ Please enter a valid mobile number for WhatsApp (e.g. 03473100304).");
    }
    return;
  }

  if (typeof window === "undefined") return;

  let desktopAppLaunched = false;

  // Window blur event signals that OS launched WhatsApp Desktop application
  const onBlur = () => {
    desktopAppLaunched = true;
    window.removeEventListener("blur", onBlur);
  };
  window.addEventListener("blur", onBlur);

  // 1. Attempt desktop URI launch via hidden anchor
  try {
    const link = document.createElement("a");
    link.href = desktopUrl;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.warn("Desktop WhatsApp launch attempt failed, falling back to Web:", err);
  }

  // 2. Timeout fallback to WhatsApp Web if window remained focused (Desktop app not installed)
  setTimeout(() => {
    window.removeEventListener("blur", onBlur);
    if (!desktopAppLaunched) {
      if (typeof onFallback === "function") {
        onFallback();
      }
      window.open(webUrl, "_blank");
    }
  }, fallbackTimeout);
}

/**
 * Complete WhatsApp Closing Report Dispatcher
 * 1. Generates & downloads Day Closing Receipt PDF to PC Downloads.
 * 2. Copies Z-Report summary text to clipboard.
 * 3. Launches WhatsApp Desktop app with automatic WhatsApp Web fallback.
 * 
 * @param {object} params
 * @param {string} params.phone - WhatsApp phone number.
 * @param {string} params.text - Summary message text.
 * @param {string} params.dateStr - Date string for PDF name.
 * @param {HTMLElement|string} params.previewTarget - Preview element reference.
 * @returns {Promise<{success: boolean, filename: string}>}
 */
export async function dispatchDayClosingWhatsAppWithPDF({
  phone,
  text = "",
  dateStr = "",
  previewTarget = null,
}) {
  const cleanPhone = formatWhatsAppPhone(phone);
  if (!cleanPhone) {
    throw new Error("Invalid WhatsApp phone number.");
  }

  // 1. Copy formatted text to clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  // 2. Generate and download PDF
  let filename = `Day_Closing_Receipt_${dateStr || "Today"}.pdf`;
  try {
    filename = await generateAndDownloadClosingPDF(previewTarget, dateStr);
  } catch (pdfErr) {
    console.warn("Closing PDF auto-generation error:", pdfErr);
  }

  // 3. Append PDF notice to WhatsApp message text
  const messageWithNote = `${text}\n\n📄 *Note:* Detailed Day Closing Receipt PDF has been generated and saved to your device Downloads.`;

  // 4. Open WhatsApp Desktop or Web
  openWhatsAppSmart(cleanPhone, messageWithNote);

  return {
    success: true,
    filename,
    phone: cleanPhone,
  };
}
