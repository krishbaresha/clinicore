/**
 * CliniCore Resend Email Gateway Utility
 * Routes ALL email through VPS relay backend (api.clinicore.me) or local Node (127.0.0.1:5000).
 *
 * WHY: Tauri Desktop WebView cannot reliably resolve external DNS (api.resend.com).
 * Direct Resend API calls cause EAI_AGAIN / DNS-lookup failures on Desktop.
 * VPS backend (server.js /api/v1/system/send-email) handles Resend API calls
 * server-side where internet + DNS are always available.
 */

export async function sendResendEmail({ apiKey, from, to, subject, html, attachments }) {
  const key = (
    apiKey ||
    (typeof window !== "undefined" ? localStorage.getItem("cf_resend_api_key") : null) ||
    ""
  ).trim();

  const fromAddr = from || "CliniCore System <backup@clinicore.me>";
  const toAddrs = Array.isArray(to) ? to : [to || "drasifhosting@gmail.com"];
  const emailSubject = subject || "🏥 CliniCore System Audit & Encrypted Vault Backup";
  const emailHtml = html || "<p>CliniCore System Message</p>";
  const emailAttachments = attachments || [];

  if (!key) {
    return {
      success: false,
      error: "Missing Resend API Key (re_xxxx). Please enter your key in Admin Panel → Backups & Email.",
    };
  }

  // Relay priority order — all traffic goes through VPS/Node backend:
  // 1. Local Node backend (127.0.0.1:5000) — Desktop/Tauri: always LAN-reachable
  // 2. VPS production API (api.clinicore.me) — Web/Mobile: always internet-reachable
  // 3. Same-origin relative path — works on clinicore.me production web
  // 4. clinicore.me absolute — final web fallback
  //
  // ⚠️ Direct api.resend.com is intentionally NOT attempted:
  //    Tauri WebView DNS cannot reliably resolve external hostnames → EAI_AGAIN
  //    VPS backend relays to Resend with full internet access (server-side)
  const relayUrls = [
    "http://127.0.0.1:5000/api/v1/system/send-email",
    "https://api.clinicore.me/api/v1/system/send-email",
    "https://clinicore.me/api/v1/system/send-email",
    "/api/v1/system/send-email",
  ];

  const emailBody = JSON.stringify({
    api_key: key,
    from: fromAddr,
    to: toAddrs,
    subject: emailSubject,
    html: emailHtml,
    attachments: emailAttachments,
  });

  let lastError = null;

  for (const url of relayUrls) {
    try {
      const controller = new AbortController();
      // 4-second hard timeout per relay — prevents Desktop hanging on unreachable endpoints
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const relayRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: emailBody,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const relayData = await relayRes.json().catch(() => null);

      if (relayRes.ok && relayData?.success) {
        return {
          success: true,
          id: relayData.id || "sent_via_relay",
          method: `VPS Relay (${url})`,
        };
      }

      // 4xx from relay = Resend API itself rejected (bad key, unverified domain, etc.)
      // Stop immediately — no point trying other relay endpoints
      if (relayRes.status >= 400 && relayRes.status < 500) {
        const errMsg =
          relayData?.error ||
          relayData?.message ||
          `Email provider rejected request (HTTP ${relayRes.status}). Check your Resend API key.`;
        return { success: false, error: errMsg };
      }

      if (relayData?.error) lastError = relayData.error;
    } catch (err) {
      // AbortError = 4s timeout (endpoint unreachable / Desktop DNS issue)
      // TypeError  = network unreachable
      // Both are expected for inactive relays — silently try next
      if (!lastError && err.name !== "AbortError") {
        lastError = err.message;
      }
    }
  }

  return {
    success: false,
    error:
      lastError ||
      "All relay endpoints unreachable. Please verify:\n• VPS backend (api.clinicore.me:5000) is running\n• Resend API key is valid\n• Internet connection is active",
  };
}
