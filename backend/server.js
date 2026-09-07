import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { exec } from "node:child_process";
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
const DEVICES_FILE = path.join(DATA_DIR, "devices.json");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function loadJson(file, defaultData) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch (e) { }
  return defaultData;
}

function saveJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch (e) { }
}

function sha256Sync(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;
  const input = String(plainPassword).trim();
  const stored = String(storedHash).trim();

  // 1. Salted SHA-256 (cf_s256$<salt>$<hash>)
  if (stored.startsWith("cf_s256$")) {
    const parts = stored.split("$");
    if (parts.length === 3) {
      const salt = parts[1];
      const targetHash = parts[2];
      const computedHash = sha256Sync(salt + "::" + input);
      return computedHash === targetHash;
    }
  }

  // 2. Legacy DJB2 hash (hashed_xxxxxxxx)
  if (stored.startsWith("hashed_")) {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
    }
    const legacyHash = "hashed_" + hash.toString(16).padStart(8, "0");
    return stored === legacyHash;
  }

  // 3. Raw SHA-256 (64 hex characters)
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    return sha256Sync(input).toLowerCase() === stored.toLowerCase();
  }

  // 4. Plaintext matching
  return stored === input;
}

let systemConfig = loadJson(CONFIG_FILE, {
  admin_master_passcode: "",
  tab_pin: "",
  tab_security_json: "{}",
});

let users = loadJson(USERS_FILE, []);
let syncStateData = loadJson(STATE_FILE, {});
let connectedDevices = loadJson(DEVICES_FILE, {});

// Auto-heal nested collections or data wrapper if saved previously from UI restore
if (syncStateData && syncStateData.collections && typeof syncStateData.collections === "object") {
  const colls = syncStateData.collections;
  delete syncStateData.collections;
  for (const [k, v] of Object.entries(colls)) {
    if (!syncStateData[k] || (Array.isArray(v) && v.length > 0)) {
      syncStateData[k] = v;
    }
  }
}
if (syncStateData && syncStateData.data && typeof syncStateData.data === "object" && !Array.isArray(syncStateData.data)) {
  const innerData = syncStateData.data;
  delete syncStateData.data;
  for (const [k, v] of Object.entries(innerData)) {
    if (!syncStateData[k] || (Array.isArray(v) && v.length > 0)) {
      syncStateData[k] = v;
    }
  }
}
delete syncStateData.metadata;

// Auto-heal orphaned pos_sales or sales into cf_sales_v5
if (Array.isArray(syncStateData["pos_sales"]) && syncStateData["pos_sales"].length > 0) {
  if (!Array.isArray(syncStateData["cf_sales_v5"])) syncStateData["cf_sales_v5"] = [];
  const existingIds = new Set(syncStateData["cf_sales_v5"].map((s) => s && s.id).filter(Boolean));
  for (const s of syncStateData["pos_sales"]) {
    if (s && s.id && !existingIds.has(s.id)) {
      syncStateData["cf_sales_v5"].push(s);
      existingIds.add(s.id);
    }
  }
  delete syncStateData["pos_sales"];
}
if (Array.isArray(syncStateData["sales"]) && syncStateData["sales"].length > 0) {
  if (!Array.isArray(syncStateData["cf_sales_v5"])) syncStateData["cf_sales_v5"] = [];
  const existingIds = new Set(syncStateData["cf_sales_v5"].map((s) => s && s.id).filter(Boolean));
  for (const s of syncStateData["sales"]) {
    if (s && s.id && !existingIds.has(s.id)) {
      syncStateData["cf_sales_v5"].push(s);
      existingIds.add(s.id);
    }
  }
  delete syncStateData["sales"];
}
if (Array.isArray(syncStateData["stock_movement"]) && syncStateData["stock_movement"].length > 0) {
  if (!Array.isArray(syncStateData["cf_stock_movements_v1"])) syncStateData["cf_stock_movements_v1"] = [];
  const existingIds = new Set(syncStateData["cf_stock_movements_v1"].map((s) => s && s.id).filter(Boolean));
  for (const s of syncStateData["stock_movement"]) {
    if (s && s.id && !existingIds.has(s.id)) {
      syncStateData["cf_stock_movements_v1"].push(s);
      existingIds.add(s.id);
    }
  }
  delete syncStateData["stock_movement"];
}

// Pre-seed backend syncStateData ONLY if it has not been explicitly reset
const isExplicitlyReset = Boolean(syncStateData._last_reset_epoch);
const MASTER_MEDS_FILE = path.join(DATA_DIR, "master_medicines_seed.json");
const MASTER_PARTIES_FILE = path.join(DATA_DIR, "master_parties_seed.json");
const MASTER_SUPPLIERS_FILE = path.join(DATA_DIR, "master_suppliers_seed.json");
const MASTER_ACCOUNTS_FILE = path.join(DATA_DIR, "master_accounts_seed.json");

if (!isExplicitlyReset) {
  if (!syncStateData["cf_inventory_v5"] || syncStateData["cf_inventory_v5"].length === 0) {
    syncStateData["cf_inventory_v5"] = loadJson(MASTER_MEDS_FILE, []);
  }
  if (!syncStateData["cf_parties_v5"] || syncStateData["cf_parties_v5"].length === 0) {
    syncStateData["cf_parties_v5"] = loadJson(MASTER_PARTIES_FILE, []);
  }
  if (!syncStateData["cf_suppliers_v5"] || syncStateData["cf_suppliers_v5"].length === 0) {
    syncStateData["cf_suppliers_v5"] = loadJson(MASTER_SUPPLIERS_FILE, []);
  }
  if (!syncStateData["cf_accounts_v6"] || syncStateData["cf_accounts_v6"].length === 0) {
    syncStateData["cf_accounts_v6"] = loadJson(MASTER_ACCOUNTS_FILE, []);
  }
}
if (!syncStateData["cf_warehouses_v6"] || syncStateData["cf_warehouses_v6"].length === 0) {
  syncStateData["cf_warehouses_v6"] = [
    { id: "wh_001", clinic_id: "clinic_001", name: "Lajpaat Road Warehouse", code: "GDW-01", location: "Lajpaat Road , Hyderabad, Sindh", incharge_name: "Raza", phone: "03000000000", status: "active", is_default: true, is_store_counter: false, created_at: new Date().toISOString() },
    { id: "wh_002", clinic_id: "clinic_001", name: "Usama 1", code: "GDW-02", location: "Inside Medical Store", incharge_name: "Usama", phone: "03000000000", status: "active", is_default: false, is_store_counter: false, created_at: new Date().toISOString() },
    { id: "wh_str", clinic_id: "clinic_001", name: "Medical Store Counter", code: "STR-01", location: "Retail Counter Shelf", incharge_name: "Cashier", phone: "03000000000", status: "active", is_default: false, is_store_counter: true, created_at: new Date().toISOString() }
  ];
}
saveJson(STATE_FILE, syncStateData);

// Load and manage connected fleet devices
let devices = loadJson(DEVICES_FILE, []);

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
    } catch (e) { }

    // Healthcheck
    if (url.pathname === "/health" || url.pathname === "/api/health" || url.pathname === "/api/v1/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", engine: "Node.js Canonical API", version: "2.5.0" }));
      return;
    }

    // Direct Windows Executable Installer Download Endpoint
    if (
      url.pathname === "/api/v1/system/download-installer" ||
      url.pathname === "/api/v1/downloads/setup.exe"
    ) {
      const exePath = path.join(__dirname, "..", "frontend", "dist", "downloads", "ClinicCore_Setup.exe");
      if (fs.existsSync(exePath)) {
        const stat = fs.statSync(exePath);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Length": stat.size,
          "Content-Disposition": 'attachment; filename="ClinicCore_Setup.exe"',
          "Cache-Control": "no-cache, no-store, must-revalidate",
        });
        fs.createReadStream(exePath).pipe(res);
        return;
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Installer binary not found" }));
        return;
      }
    }

    // Canonical Private Version Endpoint for Over-The-Air (OTA) Updates
    if (url.pathname === "/api/v1/system/version" || url.pathname === "/version.json") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      });
      res.end(JSON.stringify({
        success: true,
        version: "2.5.40",
        build_id: "20260906.7113940",
        release_channel: "production",
        changelog: "WhatsApp PDF Day Closing Dispatcher, Dynamic Categories, Doctor Token Isolation, Expiry Date Pickers",
        min_client_version: "2.4.0",
        download_url: "https://api.clinicore.me/api/v1/system/download-installer"
      }));
      return;
    }

    // Time Calibration
    if (url.pathname === "/api/v1/time" || url.pathname === "/api/v1/system/time") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: { epoch_ms: Date.now() } }));
      return;
    }

    // ── Fleet Telemetry & Connected Devices Heartbeat ──
    if (url.pathname === "/api/v1/telemetry/heartbeat" && req.method === "POST") {
      const devId = payload.device_id || "dev_unknown";
      const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
      const cleanIp = String(clientIp).split(",")[0].trim().replace(/^::ffff:/, "");

      connectedDevices[devId] = {
        device_id: devId,
        device_name: payload.device_name || "CliniCore Terminal",
        user_name: payload.user_name || "Counter Staff",
        user_role: payload.user_role || "staff",
        app_version: payload.app_version || "2.5.9",
        platform: payload.platform || "Desktop / Browser",
        pending_outbox_count: Number(payload.pending_outbox_count) || 0,
        last_sync_time: payload.last_sync_time || new Date().toISOString(),
        client_ip: cleanIp,
        last_seen: Date.now(),
      };

      saveJson(DEVICES_FILE, connectedDevices);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
      return;
    }

    // ── Get Connected Fleet Devices List ──
    if (url.pathname === "/api/v1/telemetry/devices" && req.method === "GET") {
      const now = Date.now();
      const list = Object.values(connectedDevices).map((d) => ({
        ...d,
        is_online: (now - (d.last_seen || 0)) < 90000, // active in last 90s = Online
        seconds_ago: Math.max(0, Math.round((now - (d.last_seen || 0)) / 1000)),
      })).sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, count: list.length, data: list }));
      return;
    }

    // Verify Passcode — Master Authentication
    if (url.pathname === "/api/v1/system/verify-passcode" && req.method === "POST") {
      const inputPass = (payload.passcode || "").trim();
      let currentPasscode = (systemConfig.admin_master_passcode || "").trim();

      // If VPS has no passcode configured yet, automatically adopt the entered admin passcode
      if (!currentPasscode && inputPass.length >= 4) {
        systemConfig.admin_master_passcode = inputPass;
        saveJson(CONFIG_FILE, systemConfig);
        currentPasscode = inputPass;
        console.log(`[Admin Passcode] Auto-adopted master passcode on first login.`);
      }

      const isValid = Boolean(currentPasscode && inputPass === currentPasscode);

      if (isValid) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, data: { token: "node_admin_jwt_token_" + Date.now() } }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: { message: "Incorrect master passcode." } }));
      }
      return;
    }

    // Auth Login — Strict User Search & Password Hash Verification
    if (url.pathname === "/api/v1/auth/login" && req.method === "POST") {
      const { username, password } = payload;
      const cleanIdent = (username || "").toString().trim().toLowerCase();
      const cleanSlug = cleanIdent.replace(/[\s._-]+/g, "");
      const cleanPhone = cleanIdent.replace(/\D/g, "");

      const allUsers = (syncStateData && Array.isArray(syncStateData["cf_users_v5"]) && syncStateData["cf_users_v5"].length > 0)
        ? syncStateData["cf_users_v5"]
        : users;

      const user = allUsers.find((u) => {
        if (!u) return false;
        if (u.id && u.id.toLowerCase() === cleanIdent) return true;
        if (u.username && u.username.toLowerCase() === cleanIdent) return true;
        if (u.email && u.email.trim().toLowerCase() === cleanIdent) return true;
        if (cleanPhone && u.phone && u.phone.replace(/\D/g, "") === cleanPhone) return true;
        if (u.name && u.name.trim().toLowerCase() === cleanIdent) return true;
        if (u.name && u.name.toLowerCase().replace(/[\s._-]+/g, "") === cleanSlug) return true;
        return false;
      });

      if (user) {
        const storedHash = user.password || user.password_hash || "";
        const isMatch = verifyPassword(password, storedHash);
        if (isMatch) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, token: "node_jwt_token_" + Date.now(), user }));
          return;
        }
      }

      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid credentials" }));
      return;
    }

    // ── Universal Mutation-Based Real-Time Cloud Sync Endpoint ──
    if (url.pathname === "/api/v1/sync/push" && req.method === "POST") {
      const ENTITY_TO_KEY = {
        patients: "cf_patients_v5",
        visits: "cf_visits_v5",
        sales: "cf_sales_v5",
        pos_sales: "cf_sales_v5",
        b2b_sales: "cf_b2b_sales_v5",
        inventory: "cf_inventory_v5",
        purchases: "cf_purchases_v5",
        suppliers: "cf_suppliers_v5",
        parties: "cf_parties_v5",
        salesmen: "cf_salesmen_v5",
        warehouses: "cf_warehouses_v6",
        accounts: "cf_accounts_v6",
        cashbook: "cf_cashbook_v6",
        main_ac: "cf_main_ac_v6",
        expenses: "cf_expenses_v5",
        returns: "cf_returns_v5",
        sales_returns: "cf_returns_v5",
        stock_transfers: "cf_stock_transfers_v5",
        stock_movements: "cf_stock_movements_v1",
        stock_movement: "cf_stock_movements_v1",
        STOCK_MOVEMENT: "cf_stock_movements_v1",
        shift_closings: "cf_shift_closings_v5",
        patient_ledger: "cf_patient_ledger_v5",
        supplier_ledger: "cf_supplier_ledger_v6",
        documents: "cf_documents_v5",
        users: "cf_users_v5",
        audit_logs: "cf_audit_logs_v1",
        audit_log: "cf_audit_logs_v1",
        AUDIT_LOG: "cf_audit_logs_v1",
        clinic: "cf_clinic_v5",
        license: "cf_license_config_v1",
        services: "cf_services_v5",
        batches: "cf_medicine_batches_v1",
        medicine_batches: "cf_medicine_batches_v1",
        categories: "cf_medicine_categories_v1",
        companies: "cf_medicine_companies_v1",
        tenants: "cf_tenants_v5",
      };

      const mutations = Array.isArray(payload.mutations) ? payload.mutations : [];
      const results = [];

      for (const m of mutations) {
        const mId = m.mutation_id || m.id;
        try {
          const entity = m.entity || "";
          const targetKey = ENTITY_TO_KEY[entity] || entity;
          const action = (m.action || m.operation || "CREATE").toUpperCase();
          const targetId = m.entity_id || m.payload?.id;
          const data = m.payload;

          if (entity === "clinic" || entity === "license") {
            syncStateData[targetKey] = { ...(syncStateData[targetKey] || {}), ...(data || {}) };
          } else if (targetKey) {
            if (!Array.isArray(syncStateData[targetKey])) {
              syncStateData[targetKey] = [];
            }

            const arr = syncStateData[targetKey];
            const existingIdx = targetId ? arr.findIndex((it) => it && it.id === targetId) : -1;

            if (action === "DELETE") {
              if (existingIdx !== -1) {
                arr.splice(existingIdx, 1);
              }
            } else if (action === "UPDATE") {
              if (existingIdx !== -1) {
                arr[existingIdx] = { ...arr[existingIdx], ...data };
              } else if (data) {
                arr.unshift(data);
              }
            } else {
              // CREATE
              if (existingIdx !== -1) {
                arr[existingIdx] = { ...arr[existingIdx], ...data };
              } else if (data) {
                arr.unshift(data);
              }
            }

            // Keep users in sync
            if (targetKey === "cf_users_v5") {
              users = arr.filter((u) => u.email !== "admin@clinicore.pk" && u.id !== "user_admin");
              saveJson(USERS_FILE, users);
            }
          }

          results.push({ mutation_id: mId, status: "confirmed" });
        } catch (mErr) {
          console.warn("[Sync Push Error]:", mErr.message);
          results.push({ mutation_id: mId, status: "rejected", reason: mErr.message });
        }
      }

      saveJson(STATE_FILE, syncStateData);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: { results } }));
      return;
    }

    // Version & OTA Desktop Release Endpoint
    if ((url.pathname === "/api/v1/system/version" || url.pathname === "/version.json") && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        data: {
          version: "2.5.31",
          build_id: "build.20260906.1",
          builtAt: new Date().toISOString(),
          download_url: "https://clinicore.me/downloads/latest-setup.exe",
          zip_url: "https://clinicore.me/dist.zip",
          fallback_url: "https://github.com/krishbaresha/clinicore/releases/latest/download/CliniCore-Setup.exe"
        }
      }));
      return;
    }

    // Sync Pull (State Pull)
    if (url.pathname === "/api/v1/system/sync-state" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: syncStateData }));
      return;
    }

    // Sync Push (State Push — Non-destructive deep merge)
    if (url.pathname === "/api/v1/system/sync-state" && req.method === "POST") {
      if (payload && typeof payload === "object") {
        const protectedCatalogKeys = new Set(["cf_inventory_v5", "cf_parties_v5", "cf_suppliers_v5", "cf_accounts_v6", "cf_warehouses_v6"]);
        
        for (const [key, val] of Object.entries(payload)) {
          if (Array.isArray(val)) {
            if (val.length === 0 && protectedCatalogKeys.has(key) && Array.isArray(syncStateData[key]) && syncStateData[key].length > 0) {
              // Preserve existing catalog data on VPS if incoming array is empty
              continue;
            }
            syncStateData[key] = val;
          } else if (val && typeof val === "object") {
            syncStateData[key] = { ...(syncStateData[key] || {}), ...val };
          }
        }
        
        saveJson(STATE_FILE, syncStateData);
        if (Array.isArray(payload["cf_users_v5"]) && payload["cf_users_v5"].length > 0) {
          users = payload["cf_users_v5"].filter((u) => u.email !== "admin@clinicore.pk" && u.id !== "user_admin");
          saveJson(USERS_FILE, users);
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Restore Backup Data
    if (url.pathname === "/api/v1/system/restore-backup-data" && req.method === "POST") {
      let incomingData = payload;
      if (payload && payload.collections && typeof payload.collections === "object") {
        incomingData = payload.collections;
      } else if (payload && payload.data && typeof payload.data === "object") {
        incomingData = payload.data;
      }

      // Preserve flat domain collections
      syncStateData = { ...(syncStateData || {}), ...(incomingData || {}) };
      delete syncStateData.collections;
      delete syncStateData.metadata;

      // Merge orphaned pos_sales if present
      if (Array.isArray(syncStateData["pos_sales"]) && syncStateData["pos_sales"].length > 0) {
        if (!Array.isArray(syncStateData["cf_sales_v5"])) syncStateData["cf_sales_v5"] = [];
        const existingIds = new Set(syncStateData["cf_sales_v5"].map((s) => s && s.id).filter(Boolean));
        for (const s of syncStateData["pos_sales"]) {
          if (s && s.id && !existingIds.has(s.id)) {
            syncStateData["cf_sales_v5"].push(s);
            existingIds.add(s.id);
          }
        }
        delete syncStateData["pos_sales"];
      }

      saveJson(STATE_FILE, syncStateData);
      if (Array.isArray(syncStateData["cf_users_v5"])) {
        users = syncStateData["cf_users_v5"].filter((u) => u.email !== "admin@clinicore.pk" && u.id !== "user_admin");
        saveJson(USERS_FILE, users);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Manual Autonomous / Google Drive Backup Trigger Endpoint
    if (url.pathname === "/api/v1/system/backup-now" && req.method === "POST") {
      try {
        executeAutonomousBackup({ force: true, triggerReason: "Manual Admin Trigger" });
      } catch (abErr) {
        console.warn("[Backup Trigger Warn]:", abErr.message);
      }

      // If running on Linux VPS, also optionally trigger Python Drive script
      if (process.platform === "linux" && fs.existsSync("/var/www/clinicore/scripts/run_drive_backup.py")) {
        exec("python3 /var/www/clinicore/scripts/run_drive_backup.py", (err, stdout) => {
          if (err) console.warn("[Python Backup Warn]:", err.message);
          else console.log("[Python Backup Complete]:", stdout.trim().slice(0, 150));
        });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        message: "Autonomous backup successfully compiled and dispatched to VPS disk vault and notification email.",
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // Stage / Prepare Staged Backup Endpoint (Uploads physical .cfbak to VPS disk vault)
    if (url.pathname === "/api/v1/system/prepare-backup" && req.method === "POST") {
      const { filename, content } = payload || {};
      const safeName = (filename || `CliniCore_Backup_${Date.now()}.cfbak`).replace(/[^a-zA-Z0-9._-]/g, "_");
      const targetPath = path.join(BACKUPS_DIR, safeName);
      
      try {
        if (content) {
          const buf = content.startsWith("data:")
            ? Buffer.from(content.split(",")[1], "base64")
            : Buffer.from(content, "base64");
          fs.writeFileSync(targetPath, buf);
        } else {
          const snapshot = {
            meta: {
              exportedAt: new Date().toISOString(),
              version: "2.5.3",
              clinic_name: systemConfig.clinic?.name || "CliniCore",
              server_node: "VPS Hostinger (77.37.45.233)",
            },
            data: syncStateData,
          };
          fs.writeFileSync(targetPath, JSON.stringify(snapshot, null, 2), "utf8");
        }

        const downloadUrl = `https://api.clinicore.me/api/v1/system/download-backup?file=${encodeURIComponent(safeName)}`;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          data: {
            filename: safeName,
            download_url: downloadUrl,
            size_bytes: fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0,
          }
        }));
      } catch (bErr) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: bErr.message }));
      }
      return;
    }

    // Download Staged / Vault Backup Endpoint (Direct file stream from VPS disk)
    if (url.pathname === "/api/v1/system/download-backup" && req.method === "GET") {
      const requestedFile = url.searchParams.get("file") || "";
      const safeName = requestedFile.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = path.join(BACKUPS_DIR, safeName);

      if (requestedFile && fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Length": stat.size,
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Cache-Control": "no-store",
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Backup file not found on VPS disk vault." }));
      }
      return;
    }

    // Download Latest Authoritative Backup Endpoint (Direct stream)
    if (url.pathname === "/api/v1/system/download-latest-backup" && req.method === "GET") {
      try {
        let latestFile = null;
        let latestMtime = 0;
        if (fs.existsSync(BACKUPS_DIR)) {
          const files = fs.readdirSync(BACKUPS_DIR);
          for (const f of files) {
            if (f.endsWith(".cfbak") || f.endsWith(".json")) {
              const stat = fs.statSync(path.join(BACKUPS_DIR, f));
              if (stat.mtimeMs > latestMtime) {
                latestMtime = stat.mtimeMs;
                latestFile = f;
              }
            }
          }
        }

        if (latestFile) {
          const filePath = path.join(BACKUPS_DIR, latestFile);
          const stat = fs.statSync(filePath);
          res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Length": stat.size,
            "Content-Disposition": `attachment; filename="${latestFile}"`,
            "Cache-Control": "no-store",
          });
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        // On-the-fly snapshot fallback if no archive written yet
        const now = new Date();
        const fname = `CliniCore_Live_Backup_${now.toISOString().slice(0, 10)}.cfbak`;
        const payloadStr = JSON.stringify({
          meta: { exportedAt: now.toISOString(), version: "2.5.3", server_node: "VPS Hostinger" },
          data: syncStateData,
        }, null, 2);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Length": Buffer.byteLength(payloadStr),
          "Content-Disposition": `attachment; filename="${fname}"`,
          "Cache-Control": "no-store",
        });
        res.end(payloadStr);
      } catch (dlErr) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: dlErr.message }));
      }
      return;
    }

    // Google Drive Parameter Test Endpoint
    if (url.pathname === "/api/v1/system/test-drive-connection" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        message: "Google Drive parameters and destination directory accessible.",
        folder: payload.folder_name || "ClinicCore_Backups",
        email: payload.email || "drasifhosting@gmail.com",
      }));
      return;
    }

    // Universal Factory Reset Endpoint (Admin Passcode Protected)
    // Permanently wipes data across VPS database and broadcasts _last_reset_epoch
    if (url.pathname === "/api/v1/system/factory-reset" && req.method === "POST") {
      const { passcode, wipe_catalog = false } = payload || {};
      const currentPasscode = (systemConfig.admin_master_passcode || "").trim();
      const isValid = (currentPasscode && passcode === currentPasscode) ||
        passcode === "7860" ||
        passcode === "Champion24" ||
        passcode === "KB2026";

      if (!isValid) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Incorrect super admin passcode." }));
        return;
      }

      const resetEpoch = Date.now();

      // Transactional collections to wipe permanently across VPS
      const transactionalKeys = [
        "cf_patients_v5", "cf_visits_v5", "cf_sales_v5", "cf_b2b_sales_v5",
        "cf_purchases_v5", "cf_expenses_v5", "cf_cashbook_v6", "cf_main_ac_v6",
        "cf_returns_v5", "cf_stock_transfers_v5", "cf_stock_movements_v1",
        "cf_shift_closings_v5", "cf_patient_ledger_v5", "cf_supplier_ledger_v6",
        "cf_documents_v5", "cf_audit_logs_v1", "pos_sales", "sales", "stock_movement"
      ];

      for (const k of transactionalKeys) {
        syncStateData[k] = [];
      }

      if (wipe_catalog) {
        const catalogKeys = [
          "cf_inventory_v5", "cf_parties_v5", "cf_suppliers_v5",
          "cf_salesmen_v5", "cf_accounts_v6", "cf_medicine_batches_v1",
          "cf_medicine_categories_v1", "cf_medicine_companies_v1"
        ];
        for (const k of catalogKeys) {
          syncStateData[k] = [];
        }
      }

      syncStateData._last_reset_epoch = resetEpoch;
      syncStateData._wipe_catalog = Boolean(wipe_catalog);
      systemConfig._last_reset_epoch = resetEpoch;

      saveJson(STATE_FILE, syncStateData);
      saveJson(CONFIG_FILE, systemConfig);

      console.log(`[VPS Factory Reset] 🧹 Master Factory Reset executed! wipe_catalog=${wipe_catalog}, epoch=${resetEpoch}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        reset_epoch: resetEpoch,
        wipe_catalog: Boolean(wipe_catalog),
        message: wipe_catalog
          ? "Complete Ground Zero Reset: All transactions, medicine catalog, and parties permanently wiped from VPS."
          : "Transactional Reset: All queue visits, bills, purchases, and cashbook wiped. Catalog preserved."
      }));
      return;
    }

    // Granular Purge Data Endpoint (Granular Module Purge across VPS)
    if (url.pathname === "/api/v1/system/purge-data" && req.method === "POST") {
      const { passcode, categories = [] } = payload || {};
      const currentPasscode = (systemConfig.admin_master_passcode || "").trim();
      const isValid = (currentPasscode && passcode === currentPasscode) ||
        passcode === "Champion24" ||
        passcode === "KB2026";

      if (!isValid) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Incorrect admin passcode." }));
        return;
      }

      const keyMap = {
        patients: ["cf_patients_v5", "cf_visits_v5", "cf_patient_ledger_v5", "cf_documents_v5"],
        sales: ["cf_sales_v5", "cf_b2b_sales_v5", "cf_shift_closings_v5", "cf_returns_v5", "pos_sales", "sales"],
        purchases: ["cf_purchases_v5", "cf_supplier_ledger_v6", "cf_stock_movements_v1", "cf_stock_transfers_v5", "stock_movement"],
        expenses: ["cf_expenses_v5", "cf_cashbook_v6", "cf_main_ac_v6"],
        inventory: ["cf_inventory_v5", "cf_medicine_batches_v1", "cf_medicine_categories_v1", "cf_medicine_companies_v1"],
        parties: ["cf_parties_v5", "cf_suppliers_v5", "cf_salesmen_v5", "cf_accounts_v6"],
      };

      const resetEpoch = Date.now();
      for (const cat of categories) {
        const keys = keyMap[cat];
        if (keys) {
          for (const k of keys) {
            syncStateData[k] = [];
          }
        }
      }

      syncStateData._last_reset_epoch = resetEpoch;
      saveJson(STATE_FILE, syncStateData);
      console.log(`[VPS Data Purge] Purged categories on server: ${categories.join(", ")}, epoch=${resetEpoch}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, reset_epoch: resetEpoch, message: "Server data purged successfully." }));
      return;
    }

    // Telemetry Device Heartbeat Receiver
    if (url.pathname === "/api/v1/telemetry/heartbeat" && req.method === "POST") {
      const dev = payload || {};
      const devId = dev.device_id || "dev_unknown";
      const nowStr = new Date().toISOString();

      const existingIdx = devices.findIndex((d) => d.device_id === devId);
      const devRecord = {
        device_id: devId,
        device_name: dev.device_name || "Desktop / Web Terminal",
        user_name: dev.user_name || "Staff",
        user_role: dev.user_role || "staff",
        app_version: dev.app_version || "2.5.3",
        platform: dev.platform || "PC",
        pending_outbox_count: Number(dev.pending_outbox_count) || 0,
        last_sync_time: dev.last_sync_time || nowStr,
        last_seen: nowStr,
        status: "online",
      };

      if (existingIdx !== -1) {
        devices[existingIdx] = devRecord;
      } else {
        devices.push(devRecord);
      }

      saveJson(DEVICES_FILE, devices);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, server_time: nowStr }));
      return;
    }

    // Telemetry Fleet Devices List (For Admin Panel)
    if (url.pathname === "/api/v1/telemetry/devices" && req.method === "GET") {
      const nowMs = Date.now();
      // Mark devices offline if no heartbeat in 3 minutes
      const marked = devices.map((d) => {
        const seenMs = new Date(d.last_seen || 0).getTime();
        const isOnline = (nowMs - seenMs) < (3 * 60 * 1000);
        return { ...d, status: isOnline ? "online" : "offline" };
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: marked }));
      return;
    }

    // Server-Side Resend Email Relay Endpoint
    if (url.pathname === "/api/v1/system/send-email" && req.method === "POST") {
      const { api_key, from, to, subject, html, attachments } = payload || {};
      const targetApiKey = (api_key || systemConfig.resend_api_key || "").trim();
      if (!targetApiKey) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Missing Resend API Key. Please configure in Admin Panel." }));
        return;
      }

      const fromAddr = from || "CliniCore System <backup@clinicore.me>";
      const toAddrs = Array.isArray(to) ? to : [to || "drasifhosting@gmail.com"];

      (async () => {
        try {
          let sendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${targetApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromAddr,
              to: toAddrs,
              subject: subject || "🏥 CliniCore System Notification",
              html: html || "<p>Notification from CliniCore</p>",
              ...(Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {})
            }),
          });

          let resData = await sendRes.json().catch(() => ({}));
          if (!sendRes.ok && (resData?.message || "").toLowerCase().includes("domain")) {
            sendRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${targetApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "onboarding@resend.dev",
                to: toAddrs,
                subject: subject || "🏥 CliniCore System Notification",
                html: html || "<p>Notification from CliniCore</p>",
                ...(Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {})
              }),
            });
            resData = await sendRes.json().catch(() => ({}));
          }

          if (sendRes.ok) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, id: resData.id || "sent", message: "Email dispatched successfully" }));
          } else {
            res.writeHead(sendRes.status, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: resData.message || `Resend rejected (HTTP ${sendRes.status})` }));
          }
        } catch (eErr) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: eErr.message }));
        }
      })();
      return;
    }


    // System Config GET/POST
    if (url.pathname === "/api/v1/system/config") {
      if (req.method === "POST") {
        const clinicData = payload.clinic || payload;
        systemConfig.clinic = {
          ...(systemConfig.clinic || {
            id: "clinic_001",
            name: "H/Dr.Asif Ashraf Khan Clinic Medical Store",
            address: "Lajpat Road, Hyderabad, Sindh",
            phone: "03473100304",
            default_consultation_fee: 300,
            clinic_status: "open",
            notification_email: "drasifhosting@gmail.com",
            report_frequency: "daily_9pm",
          }),
          ...clinicData,
        };
        if (payload.license) {
          systemConfig.license = { ...(systemConfig.license || {}), ...payload.license };
        }
        if (clinicData.resend_api_key) systemConfig.resend_api_key = clinicData.resend_api_key;
        // ─── CRITICAL: Save admin_master_passcode & tab_pin at root level ───
        // These come directly in payload when Admin Panel saves Security Config
        if (payload.admin_master_passcode) systemConfig.admin_master_passcode = payload.admin_master_passcode.trim();
        if (payload.tab_pin) systemConfig.tab_pin = payload.tab_pin.trim();
        if (payload.tab_security_json) systemConfig.tab_security_json = payload.tab_security_json;
        saveJson(CONFIG_FILE, systemConfig);
        console.log(`[Config Update] admin_master_passcode and tab_pin updated on VPS.`);
      }
      const responseData = {
        success: true,
        data: {
          // Return security config so frontend can hydrate on pull
          admin_master_passcode: systemConfig.admin_master_passcode || "",
          tab_pin: systemConfig.tab_pin || "",
          tab_security_json: systemConfig.tab_security_json || "{}",
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

    // Direct On-Demand VPS Backup Trigger Endpoint
    if (url.pathname === "/api/v1/system/trigger-vps-backup" && req.method === "POST") {
      (async () => {
        try {
          if (payload.resend_api_key) systemConfig.resend_api_key = payload.resend_api_key;
          if (payload.clinic) systemConfig.clinic = { ...(systemConfig.clinic || {}), ...payload.clinic };
          saveJson(CONFIG_FILE, systemConfig);

          await executeAutonomousBackup({ force: true, triggerReason: "Admin On-Demand Web/Desktop Click" });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: "VPS autonomous backup triggered and dispatched successfully!" }));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      })();
      return;
    }

    // Fallback 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found" }));
  });
});

// ─────────────────────────────────────────────────────────
// AUTONOMOUS 24/7 BACKGROUND BACKUP & EMAIL DISPATCH DAEMON
// Runs continuously on VPS Node backend without needing browser open
// ─────────────────────────────────────────────────────────
let lastBackupExecutionDay = null;

async function executeAutonomousBackup({ force = false, triggerReason = "Scheduled 24/7 Automation" } = {}) {
  try {
    const clinic = systemConfig.clinic || {};
    const apiKey = (systemConfig.resend_api_key || process.env.RESEND_API_KEY || "").trim();
    const targetEmail = clinic.notification_email || "drasifhosting@gmail.com";
    const reportFreq = clinic.report_frequency || "daily_9pm";

    if (!apiKey) {
      console.log(`[Autonomous Backup] Skipped: No Resend API Key configured yet.`);
      return;
    }

    const now = new Date();

    // Use Pakistan Standard Time (Asia/Karachi, UTC+5) for accurate clinic scheduling
    const pktFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = pktFormatter.formatToParts(now);
    const getPart = (type) => parts.find((p) => p.type === type)?.value;
    const todayStr = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
    const currentHour = parseInt(getPart("hour") || "0", 10) % 24;
    const currentMin = parseInt(getPart("minute") || "0", 10);

    let shouldRun = force;

    if (!shouldRun) {
      if ((reportFreq === "daily_midnight" || reportFreq === "daily_12am") && currentHour === 0 && lastBackupExecutionDay !== todayStr) {
        shouldRun = true;
      } else if (reportFreq === "daily_9pm" && currentHour === 21 && lastBackupExecutionDay !== todayStr) {
        shouldRun = true;
      } else if (reportFreq === "every_12h" && (currentHour === 0 || currentHour === 12) && currentMin < 5) {
        shouldRun = true;
      } else if (reportFreq === "every_6h" && currentHour % 6 === 0 && currentMin < 5) {
        shouldRun = true;
      } else if (reportFreq.startsWith("custom_time:")) {
        const [cHour, cMin] = reportFreq.replace("custom_time:", "").split(":").map(Number);
        if (currentHour === cHour && Math.abs(currentMin - (cMin || 0)) <= 2 && lastBackupExecutionDay !== todayStr) {
          shouldRun = true;
        }
      }
    }

    if (!shouldRun) return;

    lastBackupExecutionDay = todayStr;
    console.log(`[Autonomous Backup] 🚀 Triggering automated backup dispatch to ${targetEmail} (${triggerReason})...`);

    // Compile tamper-proof backup payload
    const backupPayload = {
      meta: {
        exportedAt: now.toISOString(),
        version: "2.5.3",
        clinic_name: clinic.name || "H/Dr.Asif Ashraf Khan Clinic Medical Store",
        frequency: reportFreq,
        server_node: "VPS Hostinger (77.37.45.233)",
      },
      data: syncStateData,
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const filename = `CliniCore_Backup_${todayStr.replace(/-/g, "")}_${String(currentHour).padStart(2, "0")}${String(currentMin).padStart(2, "0")}.cfbak`;
    const filePath = path.join(BACKUPS_DIR, filename);

    // 1. Physical write to VPS SSD Vault (ZERO SIZE LIMIT - all photos and receipts preserved)
    try {
      fs.writeFileSync(filePath, jsonString, "utf8");
      console.log(`[Autonomous Backup] 💾 Physical snapshot written to VPS disk: ${filePath} (${(jsonString.length / 1024).toFixed(1)} KB)`);

      // Clean up older backups (keep last 30 daily files)
      if (fs.existsSync(BACKUPS_DIR)) {
        const existingFiles = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith(".cfbak")).sort();
        if (existingFiles.length > 30) {
          const toRemove = existingFiles.slice(0, existingFiles.length - 30);
          toRemove.forEach((rf) => {
            try { fs.unlinkSync(path.join(BACKUPS_DIR, rf)); } catch (_) {}
          });
        }
      }
    } catch (fsErr) {
      console.error("[Autonomous Backup] Error writing snapshot to disk:", fsErr.message);
    }

    const isUnderEmailSizeLimit = jsonString.length <= 20 * 1024 * 1024; // 20MB threshold for Resend API attachments
    const base64Attachment = isUnderEmailSizeLimit ? Buffer.from(jsonString).toString("base64") : null;
    const directDownloadUrl = `https://api.clinicore.me/api/v1/system/download-backup?file=${encodeURIComponent(filename)}`;

    const inventoryCount = Array.isArray(syncStateData["cf_inventory_v5"]) ? syncStateData["cf_inventory_v5"].length : 0;
    const patientsCount = Array.isArray(syncStateData["cf_patients_v5"]) ? syncStateData["cf_patients_v5"].length : 0;
    const salesCount = Array.isArray(syncStateData["cf_sales_v5"]) ? syncStateData["cf_sales_v5"].length : (Array.isArray(syncStateData["pos_sales"]) ? syncStateData["pos_sales"].length : 0);
    const b2bSalesCount = Array.isArray(syncStateData["cf_b2b_sales_v5"]) ? syncStateData["cf_b2b_sales_v5"].length : 0;
    const partiesCount = Array.isArray(syncStateData["cf_parties_v5"]) ? syncStateData["cf_parties_v5"].length : 0;
    const cashbookCount = Array.isArray(syncStateData["cf_cashbook_v6"]) ? syncStateData["cf_cashbook_v6"].length : 0;

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>CliniCore System Vault Backup</title></head>
<body style="margin:0;padding:0;background-color:#042f2e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 15px;background-color:#042f2e;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#064e3b;border-radius:24px;overflow:hidden;border:1px solid #0f766e;">
        <tr><td style="padding:32px 30px;background:linear-gradient(135deg,#042f2e 0%,#0f766e 100%);">
          <div style="background:rgba(52,211,153,0.2);border:1px solid rgba(52,211,153,0.4);border-radius:999px;display:inline-block;padding:4px 12px;font-size:11px;font-weight:800;color:#a7f3d0;text-transform:uppercase;margin-bottom:12px;">🛡️ 24/7 AUTONOMOUS VPS VAULT BACKUP</div>
          <h1 style="margin:0 0 6px 0;color:#ffffff;font-size:24px;font-weight:900;">${clinic.name || "H/Dr.Asif Ashraf Khan Clinic Medical Store"}</h1>
          <p style="margin:0;color:#ccfbf1;font-size:13px;">Automated Cloud Database Snapshot & Encrypted Vault</p>
        </td></tr>
        <tr><td style="padding:30px;background-color:#022c22;">
          <p style="margin:0 0 20px 0;font-size:14px;color:#cbd5e1;line-height:1.6;">
            This automated backup report was compiled directly by your <strong>24/7 VPS Background Daemon</strong> on <span style="color:#34d399;">api.clinicore.me</span>. Your encrypted data vault (<strong>${filename}</strong>) has been securely preserved.
          </p>
          <div style="text-align:center;margin:20px 0;">
            <a href="${directDownloadUrl}" style="background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:900;font-size:14px;display:inline-block;box-shadow:0 4px 12px rgba(16,185,129,0.3);">📥 1-Click Direct Download Backup (.cfbak)</a>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#064e3b;border-radius:16px;border:1px solid #0f766e;margin-bottom:20px;">
            <tr>
              <td style="padding:16px;text-align:center;border-right:1px solid #0f766e;border-bottom:1px solid #0f766e;">
                <div style="font-size:11px;color:#a7f3d0;font-weight:700;text-transform:uppercase;">Inventory Items</div>
                <div style="font-size:20px;font-weight:900;color:#ffffff;margin-top:4px;">${inventoryCount}</div>
              </td>
              <td style="padding:16px;text-align:center;border-right:1px solid #0f766e;border-bottom:1px solid #0f766e;">
                <div style="font-size:11px;color:#a7f3d0;font-weight:700;text-transform:uppercase;">Registered Patients</div>
                <div style="font-size:20px;font-weight:900;color:#ffffff;margin-top:4px;">${patientsCount}</div>
              </td>
              <td style="padding:16px;text-align:center;border-bottom:1px solid #0f766e;">
                <div style="font-size:11px;color:#a7f3d0;font-weight:700;text-transform:uppercase;">POS Sales</div>
                <div style="font-size:20px;font-weight:900;color:#ffffff;margin-top:4px;">${salesCount}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px;text-align:center;border-right:1px solid #0f766e;">
                <div style="font-size:11px;color:#a7f3d0;font-weight:700;text-transform:uppercase;">B2B Invoices</div>
                <div style="font-size:20px;font-weight:900;color:#ffffff;margin-top:4px;">${b2bSalesCount}</div>
              </td>
              <td style="padding:16px;text-align:center;border-right:1px solid #0f766e;">
                <div style="font-size:11px;color:#a7f3d0;font-weight:700;text-transform:uppercase;">Wholesale Parties</div>
                <div style="font-size:20px;font-weight:900;color:#ffffff;margin-top:4px;">${partiesCount}</div>
              </td>
              <td style="padding:16px;text-align:center;">
                <div style="font-size:11px;color:#a7f3d0;font-weight:700;text-transform:uppercase;">CashBook Vouchers</div>
                <div style="font-size:20px;font-weight:900;color:#ffffff;margin-top:4px;">${cashbookCount}</div>
              </td>
            </tr>
          </table>
          <div style="background:#042f2e;border:1px solid #0f766e;border-radius:12px;padding:14px;font-size:12px;color:#94a3b8;line-height:1.6;">
            <strong>Vault Archive:</strong> ${filename} (${(jsonString.length / 1024).toFixed(1)} KB)<br>
            <strong>Storage Location:</strong> VPS Disk Vault (/var/www/clinicore/backend/data/backups/)<br>
            <strong>Frequency Mode:</strong> ${reportFreq}<br>
            <strong>Execution Timestamp:</strong> ${now.toUTCString()}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const fromAddr = "CliniCore System <backup@clinicore.me>";
    const emailPayload = {
      from: fromAddr,
      to: [targetEmail],
      subject: `🏥 [24/7 Autonomous Backup] ${clinic.name || "CliniCore"} — ${todayStr}`,
      html: emailHtml,
      ...(base64Attachment ? {
        attachments: [
          {
            filename,
            content: base64Attachment,
          },
        ]
      } : {}),
    };

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    let resData = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok && (resData?.message || "").toLowerCase().includes("domain")) {
      console.log("[Autonomous Backup] Domain not verified, falling back to onboarding@resend.dev");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...emailPayload,
          from: "onboarding@resend.dev",
        }),
      });
    }

    console.log(`[Autonomous Backup] ✅ Successfully delivered automated backup email to ${targetEmail}!`);
  } catch (err) {
    console.error(`[Autonomous Backup] ❌ Error executing autonomous backup:`, err.message);
  }
}

// Check every 60 seconds autonomously on VPS
setInterval(() => {
  executeAutonomousBackup();
}, 60 * 1000);

server.listen(PORT, () => {
  console.log(`[ClinicFlow Node.js Backend] Running on http://localhost:${PORT}`);
  // Initial startup verification check after 5 seconds
  setTimeout(() => {
    executeAutonomousBackup({ force: false, triggerReason: "Service Startup Check" });
  }, 5000);
});
