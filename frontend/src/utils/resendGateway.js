/**
 * CliniCore Resend Email Gateway Utility
 * Supports dual-dispatch: Backend API Relay with automatic Direct Resend Cloud Fallback.
 */

export async function sendResendEmail({ apiKey, from, to, subject, html, attachments }) {
  const key = (apiKey || (typeof window !== "undefined" ? localStorage.getItem("cf_resend_api_key") : null) || "re_93uVicu6_Py7aVeEvK1caBdcvbaFbMLts").trim();
  const fromAddr = from || "CliniCore System <backup@clinicore.me>";
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

  // 1. Try local backend (http://127.0.0.1:5000 / http://localhost:5000) first, then VPS backend
  const candidateUrls = [];
  if (typeof window !== "undefined") {
    candidateUrls.push("http://127.0.0.1:5000");
    candidateUrls.push("http://localhost:5000");
  }
  candidateUrls.push(import.meta.env?.VITE_API_URL || "https://api.clinicore.me");

  let lastRelayError = null;

  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/system/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const backendData = await res.json().catch(() => null);
      if (res.ok && backendData?.success) {
        return { success: true, id: backendData.id || "sent_via_relay", method: `relay (${baseUrl})` };
      } else if (backendData?.error) {
        lastRelayError = backendData.error;
      }
    } catch (err) {
      // Backend candidate offline/unreachable
      lastRelayError = err.message;
    }
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
      const errMsg = directData.message || directData.name || lastRelayError || `Resend Error (HTTP ${directRes.status})`;
      return { success: false, error: errMsg, details: directData };
    }
  } catch (directErr) {
    const finalErr = lastRelayError || directErr.message || "Network connection failure";
    return { success: false, error: finalErr };
  }
}

