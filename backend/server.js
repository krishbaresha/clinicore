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
    if (url.pathname === "/health" || url.pathname === "/api/v1/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", engine: "Node.js Canonical API", version: "2.5.0" }));
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

    // Sync Pull
    if (url.pathname === "/api/v1/sync/pull" && req.method === "GET") {
      const cursor = Number(url.searchParams.get("cursor") || 0);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, cursor: cursor + 1, mutations: [] }));
      return;
    }

    // Sync Push
    if (url.pathname === "/api/v1/sync/push" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, synced_count: Array.isArray(payload.mutations) ? payload.mutations.length : 0 }));
      return;
    }

    // System Config GET/POST
    if (url.pathname === "/api/v1/system/config") {
      if (req.method === "POST") {
        systemConfig = { ...systemConfig, ...payload };
        saveJson(CONFIG_FILE, systemConfig);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, config: systemConfig }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, config: systemConfig }));
      }
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
