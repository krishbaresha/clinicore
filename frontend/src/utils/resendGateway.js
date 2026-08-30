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

  // On Web (clinicore.me), Tauri Desktop, or Localhost:
  // 1. Current origin relative API (same-origin, zero CORS issues on clinicore.me & localhost)
  // 2. Direct VPS API URL (api.clinicore.me)
  // 3. Direct local Node backend (http://127.0.0.1:5000)
  const currentOrigin = (typeof window !== "undefined" && window.location.origin) ? window.location.origin : "";
  const vpsApiUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ? import.meta.env.VITE_API_URL : "https://api.clinicore.me";
  
  const relayUrls = [
    "/api/v1/system/send-email",
    "https://clinicore.me/api/v1/system/send-email",
    "https://api.clinicore.me/api/v1/system/send-email",
    "http://127.0.0.1:5000/api/v1/system/send-email",
  ];

  let lastRelayError = null;

  for (const url of relayUrls) {
    try {
      const relayRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
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
        return { success: true, id: relayData.id || "sent_via_relay", method: `VPS Relay (${url})` };
      } else if (relayData?.error) {
        lastRelayError = relayData.error;
      }
    } catch (err) {
      if (!lastRelayError) {
        lastRelayError = err.message || "Failed to fetch";
      }
    }
  }

  // Fallback: Direct Resend Cloud API (Works when CORS is bypassed or direct connection succeeds)
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
    return { success: false, error: lastRelayError || directErr.message || "Network connection failure" };
  }
}




