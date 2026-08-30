import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

// In-Memory & File-Backed Storage Node.js Engine
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const STATE_FILE = path.join(DATA_DIR, "sync_state.json");

function loadJson(file, defaultData) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch (e) {}
  return defaultData;
}

function saveJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {}
}

let systemConfig = loadJson(CONFIG_FILE, {
  admin_master_passcode: "KB2026",
  tab_pin: "0000",
  tab_security_json: "{}",
});

let users = loadJson(USERS_FILE, []);
let syncStateData = loadJson(STATE_FILE, {});

// PERMANENT PURGE: Delete admin@clinicore.pk / user_admin if present in users
users = users.filter((u) => u.email !== "admin@clinicore.pk" && u.id !== "user_admin");
saveJson(USERS_FILE, users);

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    let payload = {};
    try {
      if (body) payload = JSON.parse(body);
    } catch (e) {}

    // Healthcheck
    if (url.pathname === "/health" || url.pathname === "/api/health" || url.pathname === "/api/v1/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", engine: "Node.js Canonical API", version: "2.5.0" }));
      return;
    }

    // Time Calibration
    if (url.pathname === "/api/v1/time" || url.pathname === "/api/v1/system/time") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: { epoch_ms: Date.now() } }));
      return;
    }

    // Verify Passcode
    if (url.pathname === "/api/v1/system/verify-passcode" && req.method === "POST") {
      const { passcode } = payload;
      const currentPasscode = systemConfig.admin_master_passcode || "KB2026";
      if (passcode === currentPasscode) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, data: { token: "node_admin_jwt_token_" + Date.now() } }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: { message: "Incorrect master passcode." } }));
      }
      return;
    }

    // Auth Login
    if (url.pathname === "/api/v1/auth/login" && req.method === "POST") {
      const { username, password } = payload;
      const user = users.find((u) => u.username === username || u.email === username || u.phone === username);
      if (user) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, token: "node_jwt_token_" + Date.now(), user }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid credentials" }));
      }
      return;
    }

    // Sync Pull (State Pull)
    if (url.pathname === "/api/v1/system/sync-state" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: syncStateData }));
      return;
    }

    // Sync Push (State Push)
    if (url.pathname === "/api/v1/system/sync-state" && req.method === "POST") {
      syncStateData = payload;
      saveJson(STATE_FILE, syncStateData);
      if (payload && Array.isArray(payload["cf_users_v5"])) {
        users = payload["cf_users_v5"].filter((u) => u.email !== "admin@clinicore.pk" && u.id !== "user_admin");
        saveJson(USERS_FILE, users);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Restore Backup Data
    if (url.pathname === "/api/v1/system/restore-backup-data" && req.method === "POST") {
      syncStateData = payload;
      saveJson(STATE_FILE, syncStateData);
      if (payload && Array.isArray(payload["cf_users_v5"])) {
        users = payload["cf_users_v5"].filter((u) => u.email !== "admin@clinicore.pk" && u.id !== "user_admin");
        saveJson(USERS_FILE, users);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Incremental Mutations Sync Push Gate (Fallback acknowledgment)
    if (url.pathname === "/api/v1/sync/push" && req.method === "POST") {
      // Process incremental user deletes or updates directly to local cache
      const mutations = payload.mutations || [];
      const results = [];
      for (const mut of mutations) {
        const { entity_type, action, payload: itemPayload, entity_id } = mut;
        if (entity_type === "users") {
          if (action === "DELETE") {
            users = users.filter((u) => u.id !== entity_id);
            saveJson(USERS_FILE, users);
            if (syncStateData["cf_users_v5"]) {
              syncStateData["cf_users_v5"] = syncStateData["cf_users_v5"].filter((u) => u.id !== entity_id);
              saveJson(STATE_FILE, syncStateData);
            }
          } else if (action === "CREATE") {
            const cleanUser = { ...itemPayload };
            users = [...users.filter((u) => u.id !== cleanUser.id), cleanUser];
            saveJson(USERS_FILE, users);
            if (syncStateData["cf_users_v5"]) {
              syncStateData["cf_users_v5"] = [...syncStateData["cf_users_v5"].filter((u) => u.id !== cleanUser.id), cleanUser];
              saveJson(STATE_FILE, syncStateData);
            }
          } else if (action === "UPDATE") {
            users = users.map((u) => (u.id === entity_id ? { ...u, ...itemPayload } : u));
            saveJson(USERS_FILE, users);
            if (syncStateData["cf_users_v5"]) {
              syncStateData["cf_users_v5"] = syncStateData["cf_users_v5"].map((u) => (u.id === entity_id ? { ...u, ...itemPayload } : u));
              saveJson(STATE_FILE, syncStateData);
            }
          }
        }
        results.push({ mutation_id: mut.mutation_id || mut.id, status: "confirmed" });
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: { results } }));
      return;
    }

    // System Config GET/POST
    if (url.pathname === "/api/v1/system/config") {
      if (req.method === "POST") {
        systemConfig = { ...systemConfig, ...payload };
        saveJson(CONFIG_FILE, systemConfig);
      }
      const responseData = {
        success: true,
        data: {
          clinic: systemConfig.clinic || {
            id: "clinic_001",
            name: "H/Dr.Asif Ashraf Khan Clinic Medical Store",
            address: "Lajpat Road, Hyderabad, Sindh",
            phone: "03473100304",
            default_consultation_fee: 300,
            clinic_status: "open",
            notification_email: "drasifhosting@gmail.com",
            report_frequency: "daily_9pm",
          },
          license: systemConfig.license || {
            license_status: "active",
            monthly_fee: 5000,
            currency: "PKR",
            billing_cycle: "monthly",
            due_day: 1,
          }
        }
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(responseData));
      return;
    }

    // Resend Email Gateway Relay Endpoint
    if (url.pathname === "/api/v1/system/send-email" && req.method === "POST") {
      const apiKey = (payload.api_key || systemConfig.resend_api_key || process.env.RESEND_API_KEY || "re_93uVicu6_Py7aVeEvK1caBdcvbaFbMLts").trim();
      const fromAddr = payload.from || "CliniCore System <no-reply@clinicore.me>";
      const toAddrs = Array.isArray(payload.to) ? payload.to : [payload.to || "drasifhosting@gmail.com"];
      const subject = payload.subject || "🏥 CliniCore System Audit & Encrypted Vault Backup";
      const html = payload.html || "<p>CliniCore Encrypted Backup Payload</p>";
      const attachments = payload.attachments || [];

      if (!apiKey) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Missing Resend API Key" }));
        return;
      }

      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddr,
          to: toAddrs,
          subject,
          html,
          attachments,
        }),
      })
        .then(async (resendRes) => {
          const resendData = await resendRes.json().catch(() => ({}));
          if (resendRes.ok) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, id: resendData.id || "resend_sent" }));
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: resendData.message || resendData.name || "Resend API call failed" }));
          }
        })
        .catch((err) => {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message || "Network error calling Resend API" }));
        });

      return;
    }

    // Fallback 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found" }));
  });
});

server.listen(PORT, () => {
  console.log(`[ClinicFlow Node.js Backend] Running on http://localhost:${PORT}`);
});
