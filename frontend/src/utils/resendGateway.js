/**
 * CliniCore Resend Email Gateway Utility
 * Supports dual-dispatch: Backend API Relay with automatic Direct Resend Cloud Fallback.
 */

export async function sendResendEmail({ apiKey, from, to, subject, html, attachments }) {
  const key = (apiKey || (typeof window !== "undefined" ? localStorage.getItem("cf_resend_api_key") : null) || "re_93uVicu6_Py7aVeEvK1caBdcvbaFbMLts").trim();
  const fromAddr = from || "CliniCore System <no-reply@clinicore.me>";
  const toAddrs = Array.isArray(to) ? to : [to || "drasifhosting@gmail.com"];
  const emailSubject = subject || "🏥 CliniCore System Audit & Encrypted Vault Backup";
  const emailHtml = html || "<p>CliniCore System Message</p>";
  const emailAttachments = attachments || [];

  const payload = {
    api_key: key,
    from: fromAddr,
    to: toAddrs,
    subject: emailSubject,
    html: emailHtml,
    attachments: emailAttachments,
  };

  // 1. Try Backend Relay Endpoint first (http://localhost:5000 locally or https://api.clinicore.me in prod)
  try {
    const apiUrl = (import.meta.env?.VITE_API_URL) ||
      (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:5000" : "https://api.clinicore.me");

    const res = await fetch(`${apiUrl}/api/v1/system/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const backendData = await res.json().catch(() => null);
      if (backendData?.success) {
        return { success: true, id: backendData.id || "sent_via_backend", method: "backend_relay" };
      }
    }
  } catch (err) {
    console.warn("Backend email relay unavailable, using direct Resend API fallback...", err.message);
  }

  // 2. Direct Fallback to Resend Cloud API
  try {
    const directRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddr,
        to: toAddrs,
        subject: emailSubject,
        html: emailHtml,
        attachments: emailAttachments,
      }),
    });

    const directData = await directRes.json().catch(() => ({}));
    if (directRes.ok) {
      return { success: true, id: directData.id || "sent_direct", method: "direct_resend_api" };
    } else {
      const errMsg = directData.message || directData.name || `Resend Error (HTTP ${directRes.status})`;
      return { success: false, error: errMsg, details: directData };
    }
  } catch (directErr) {
    return { success: false, error: directErr.message || "Network connection failure" };
  }
}
