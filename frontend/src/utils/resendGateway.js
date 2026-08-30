/**
 * CliniCore Resend Email Gateway Utility
 * Supports dual-dispatch: Backend API Relay with automatic Direct Resend Cloud Fallback.
 */

export async function sendResendEmail({ apiKey, from, to, subject, html, attachments }) {
  const key = (apiKey || (typeof window !== "undefined" ? localStorage.getItem("cf_resend_api_key") : null) || "").trim();
  const fromAddr = from || "CliniCore System <backup@clinicore.me>";
  const toAddrs = Array.isArray(to) ? to : [to || "drasifhosting@gmail.com"];
  const emailSubject = subject || "🏥 CliniCore System Audit & Encrypted Vault Backup";
  const emailHtml = html || "<p>CliniCore System Message</p>";
  const emailAttachments = attachments || [];

  if (!key) {
    return { success: false, error: "Missing Resend API Key (re_xxxx). Please enter your key in Settings." };
  }

  // 1. Primary: Dispatch via Relay endpoint (Handled locally by Vite/Node or by VPS)
  const relayUrls = ["/api/v1/system/send-email"];
  if (typeof window !== "undefined" && window.location.origin) {
    relayUrls.unshift(`${window.location.origin}/api/v1/system/send-email`);
  }
  const vpsApiUrl = import.meta.env?.VITE_API_URL || "https://api.clinicore.me";
  relayUrls.push(`${vpsApiUrl}/api/v1/system/send-email`);

  for (const url of relayUrls) {
    try {
      const relayRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          from: fromAddr,
          to: toAddrs,
          subject: emailSubject,
          html: emailHtml,
          attachments: emailAttachments,
        }),
      });

      const relayData = await relayRes.json().catch(() => null);
      if (relayRes.ok && relayData?.success) {
        return { success: true, id: relayData.id || "sent_via_relay", method: `Relayed (${url.startsWith("http") ? url : "Local/VPS"})` };
      } else if (relayData?.error && relayRes.status !== 404) {
        return { success: false, error: relayData.error, details: relayData };
      }
    } catch {}
  }

  // 2. Direct Fallback via Resend Cloud API
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
      return { success: true, id: directData.id || "sent_direct", method: "Resend Cloud (Direct)" };
    } else {
      const errMsg = directData.message || directData.name || `Resend Error (HTTP ${directRes.status})`;
      return { success: false, error: errMsg, details: directData };
    }
  } catch (directErr) {
    return { success: false, error: directErr.message || "Network connection failure" };
  }
}




