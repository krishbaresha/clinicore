/** auth.js — Login and session helpers with security hardening. */
import { dbUsers, hashPassword, verifyPassword, dbAuditLogs } from "./db.js";
import { storageDriver } from "./storageDriver.js";

const SESSION_KEY = "cf_session";
const MAX_ATTEMPTS = 5;

export const PERMISSION_MATRIX = {
  admin: {
    dashboard: ["view"],
    patients: ["view", "create", "edit", "delete", "export"],
    visits: ["view", "create", "edit", "delete", "export"],
    inventory: ["view", "create", "edit", "delete", "stock_adjust", "export"],
    pos_sales: ["view", "create", "edit", "delete", "financial_view", "export"],
    b2b_sales: ["view", "create", "edit", "delete", "financial_view", "export"],
    purchases: ["view", "create", "edit", "delete", "approve", "financial_view", "export"],
    suppliers: ["view", "create", "edit", "delete", "financial_view", "ledger_adjust", "export"],
    parties: ["view", "create", "edit", "delete", "financial_view", "ledger_adjust", "export"],
    warehouses: ["view", "create", "edit", "delete", "stock_adjust", "export"],
    cashbook: ["view", "create", "edit", "delete", "financial_view", "export"],
    system_settings: ["view", "create", "edit", "delete", "admin"],
  },
  owner: {
    dashboard: ["view"],
    patients: ["view", "create", "edit", "delete", "export"],
    visits: ["view", "create", "edit", "delete", "export"],
    inventory: ["view", "create", "edit", "delete", "stock_adjust", "export"],
    pos_sales: ["view", "create", "edit", "delete", "financial_view", "export"],
    b2b_sales: ["view", "create", "edit", "delete", "financial_view", "export"],
    purchases: ["view", "create", "edit", "delete", "approve", "financial_view", "export"],
    suppliers: ["view", "create", "edit", "delete", "financial_view", "ledger_adjust", "export"],
    parties: ["view", "create", "edit", "delete", "financial_view", "ledger_adjust", "export"],
    warehouses: ["view", "create", "edit", "delete", "stock_adjust", "export"],
    cashbook: ["view", "create", "edit", "delete", "financial_view", "export"],
    system_settings: ["view", "create", "edit", "delete", "admin"],
  },
  doctor: {
    dashboard: ["view"],
    patients: ["view", "create", "edit"],
    visits: ["view", "create", "edit"],
    inventory: ["view"],
    pos_sales: ["view"],
    b2b_sales: [],
    purchases: [],
    suppliers: [],
    parties: [],
    warehouses: [],
    cashbook: [],
    system_settings: [],
  },
  pharmacist: {
    dashboard: ["view"],
    patients: ["view"],
    visits: ["view"],
    inventory: ["view", "edit", "stock_adjust"],
    pos_sales: ["view", "create", "financial_view"],
    b2b_sales: ["view", "create", "financial_view"],
    purchases: ["view", "create"],
    suppliers: ["view"],
    parties: ["view"],
    warehouses: ["view"],
    cashbook: ["view", "create"],
    system_settings: [],
  },
  cashier: {
    dashboard: ["view"],
    patients: ["view", "create", "edit"],
    visits: ["view", "create", "edit"],
    inventory: ["view"],
    pos_sales: ["view", "create", "financial_view"],
    b2b_sales: ["view", "create", "financial_view"],
    purchases: ["view", "create"],
    suppliers: ["view"],
    parties: ["view"],
    warehouses: ["view"],
    cashbook: ["view", "create", "financial_view"],
    system_settings: [],
  },
  accountant: {
    dashboard: ["view"],
    patients: [],
    visits: [],
    inventory: ["view", "export"],
    pos_sales: ["view", "financial_view", "export"],
    b2b_sales: ["view", "financial_view", "export"],
    purchases: ["view", "financial_view", "export"],
    suppliers: ["view", "financial_view", "ledger_adjust", "export"],
    parties: ["view", "financial_view", "ledger_adjust", "export"],
    warehouses: ["view"],
    cashbook: ["view", "create", "edit", "financial_view", "export"],
    system_settings: [],
  },
  b2b_salesman: {
    dashboard: ["view"],
    patients: [],
    visits: [],
    inventory: ["view"],
    pos_sales: [],
    b2b_sales: ["view", "create"],
    purchases: [],
    suppliers: [],
    parties: ["view", "create"],
    warehouses: ["view"],
    cashbook: [],
    system_settings: [],
  },
  warehouse: {
    dashboard: ["view"],
    patients: [],
    visits: [],
    inventory: ["view", "stock_adjust", "export"],
    pos_sales: [],
    b2b_sales: ["view", "create"],
    purchases: ["view", "create", "approve"],
    suppliers: ["view"],
    parties: ["view"],
    warehouses: ["view", "stock_adjust"],
    cashbook: [],
    system_settings: [],
  },
  warehouse_incharge: {
    dashboard: ["view"],
    patients: [],
    visits: [],
    inventory: ["view", "stock_adjust", "export"],
    pos_sales: [],
    b2b_sales: ["view", "create"],
    purchases: ["view", "create", "approve"],
    suppliers: ["view"],
    parties: ["view"],
    warehouses: ["view", "stock_adjust"],
    cashbook: [],
    system_settings: [],
  },
  warehouse_manager: {
    dashboard: ["view"],
    patients: [],
    visits: [],
    inventory: ["view", "stock_adjust", "export"],
    pos_sales: [],
    b2b_sales: ["view", "create"],
    purchases: ["view", "create", "approve"],
    suppliers: ["view"],
    parties: ["view"],
    warehouses: ["view", "stock_adjust"],
    cashbook: [],
    system_settings: [],
  },
  manager: {
    dashboard: ["view"],
    patients: ["view", "create", "edit", "export"],
    visits: ["view", "create", "edit", "export"],
    inventory: ["view", "edit", "stock_adjust", "export"],
    pos_sales: ["view", "create", "financial_view", "export"],
    b2b_sales: ["view", "create", "financial_view", "export"],
    purchases: ["view", "create", "financial_view", "export"],
    suppliers: ["view", "create", "financial_view", "export"],
    parties: ["view", "create", "financial_view", "export"],
    warehouses: ["view", "stock_adjust"],
    cashbook: ["view", "create", "financial_view", "export"],
    system_settings: [],
  },
  receptionist: {
    dashboard: ["view"],
    patients: ["view", "create", "edit"],
    visits: ["view", "create", "edit"],
    inventory: ["view"],
    pos_sales: [],
    b2b_sales: [],
    purchases: [],
    suppliers: [],
    parties: [],
    warehouses: [],
    cashbook: [],
    system_settings: [],
  }
};

/**
 * Universal Permission Verification Helper
 * Supports:
 * - hasPermission(user, 'patients.view')
 * - hasPermission(user, 'patients', 'view')
 * - hasPermission(user, 'financial_view')
 */
export function hasPermission(userOrSession, entityOrPermission, maybeCapability) {
  if (!userOrSession) return false;

  // 1. Superuser / Admin / Owner Bypass
  const isSuper = Boolean(
    userOrSession.is_owner ||
    userOrSession.role === "admin" ||
    userOrSession.role === "owner" ||
    userOrSession.userId === "user_admin" ||
    userOrSession.id === "user_admin" ||
    userOrSession.is_principal_doctor
  );
  if (isSuper) return true;

  // 2. Normalize arguments into permission query string (e.g. "patients.view")
  let permission = "";
  let capability = "";
  let entity = "";

  if (maybeCapability !== undefined) {
    entity = String(entityOrPermission).trim();
    capability = String(maybeCapability).trim();
    permission = `${entity}.${capability}`;
  } else {
    const str = String(entityOrPermission).trim();
    if (str.includes(".")) {
      permission = str;
      const parts = str.split(".");
      entity = parts[0];
      capability = parts[1];
    } else {
      capability = str;
      permission = str;
    }
  }

  // 3. Financial clearance override
  if ((capability === "financial_view" || permission.startsWith("finance.") || capability.endsWith("financial_view")) && userOrSession.can_view_financials) {
    return true;
  }

  // 4. Role normalization & permission lookup
  const role = userOrSession.role || "receptionist";
  const entityPerms = PERMISSION_MATRIX[role]?.[entity] || [];

  if (entityPerms.includes(capability)) return true;

  // Normalized action alias checking (e.g. stock_adjust -> adjust)
  const actionAliases = {
    adjust: "stock_adjust",
    stock_adjust: "stock_adjust",
    ledger_adjust: "ledger_adjust",
  };
  const mappedAction = actionAliases[capability];
  if (mappedAction && entityPerms.includes(mappedAction)) return true;

  return false;
}

/** Assert capability permission or throw Error */
export function assertPermission(userOrSession, entityOrPermission, maybeCapability) {
  if (!hasPermission(userOrSession, entityOrPermission, maybeCapability)) {
    const permName = maybeCapability ? `${entityOrPermission}.${maybeCapability}` : entityOrPermission;
    throw new Error(`Unauthorized: Role '${userOrSession?.role || 'anonymous'}' lacks '${permName}' permission.`);
  }
  return true;
}

/**
 * Checks if a user has access to a specific warehouse.
 * Supports legacy assigned_warehouse_id and multi-warehouse allowed_warehouses array.
 */
export function hasWarehouseAccess(userOrSession, targetWarehouseId) {
  if (!userOrSession) return false;

  const isSuper = Boolean(
    userOrSession.is_owner ||
    userOrSession.role === "admin" ||
    userOrSession.role === "owner" ||
    userOrSession.role === "doctor" ||
    userOrSession.userId === "user_admin" ||
    userOrSession.id === "user_admin" ||
    userOrSession.is_principal_doctor
  );
  if (isSuper) return true;

  if (!targetWarehouseId) return false;

  if (Array.isArray(userOrSession.allowed_warehouses) && userOrSession.allowed_warehouses.length > 0) {
    return userOrSession.allowed_warehouses.includes(targetWarehouseId);
  }

  const assigned = userOrSession.assigned_warehouse_id || userOrSession.warehouse_id;
  return assigned === targetWarehouseId;
}

/** Asserts warehouse access or throws an authorization error. */
export function assertWarehouseAccess(userOrSession, targetWarehouseId) {
  if (!hasWarehouseAccess(userOrSession, targetWarehouseId)) {
    const userWh = userOrSession?.assigned_warehouse_id || "unassigned";
    throw new Error(`Unauthorized Warehouse Access: User is assigned to '${userWh}' and cannot access '${targetWarehouseId}'.`);
  }
  return true;
}

function getRateLimitState() {
  try {
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("cf_auth_rate_limit") : null;
    if (raw) return JSON.parse(raw);
  } catch {}
  return { failedAttempts: 0, lockoutUntil: 0 };
}

function setRateLimitState(state) {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("cf_auth_rate_limit", JSON.stringify(state));
    }
  } catch {}
}

export function getAdminPasscode() {
  if (typeof window !== "undefined" && window.localStorage) {
    return storageDriver.getItem("cf_admin_master_passcode") || "KB2026";
  }
  return "KB2026";
}

export function verifyAdminPasscode(passcode) {
  if (!passcode) return false;
  const current = getAdminPasscode();
  return passcode.trim() === current.trim();
}

/** Attempt login. Returns { success, user, error }. */
export async function login(identifier, password) {
  // Rate limit check
  const now = Date.now();
  let { failedAttempts, lockoutUntil } = getRateLimitState();
  if (failedAttempts >= MAX_ATTEMPTS && now < lockoutUntil) {
    const secsLeft = Math.ceil((lockoutUntil - now) / 1000);
    return {
      success: false,
      user: null,
      error: { code: "RATE_LIMITED", message: `Too many failed attempts. Try again in ${secsLeft} seconds.` }
    };
  }
  if (now >= lockoutUntil && failedAttempts >= MAX_ATTEMPTS) {
    failedAttempts = 0;
    setRateLimitState({ failedAttempts: 0, lockoutUntil: 0 });
  }

  const GENERIC_ERROR = {
    code: "INVALID_CREDENTIALS",
    message: "Invalid email/phone or password. Please check your credentials.",
  };

  // ─────────────────────────────────────────────────────────
  // STEP 1: Try VPS API authentication first (when online)
  // ─────────────────────────────────────────────────────────
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (isOnline) {
    try {
      const API_BASE =
        (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
        (typeof window !== "undefined" && window.location.hostname === "localhost" ? "" : "https://api.clinicore.me");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: identifier, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.data?.user && json?.data?.token) {
          const vpsUser = json.data.user;

          // Save JWT token for sync engine API calls
          try { storageDriver.setItem("cf_vps_jwt", json.data.token); } catch {}

          // Update local user cache from VPS record so offline login works next time
          try {
            const { dbUsers } = await import("./db.js");
            const existingUser = dbUsers.getAll().find((u) => u.id === vpsUser.id);
            if (existingUser) {
              dbUsers.update(vpsUser.id, { ...vpsUser });
            } else {
              dbUsers.add({ ...vpsUser, password: "", password_hash: "" });
            }
          } catch {}

          // Build session from VPS user data
          const session = {
            userId: vpsUser.id,
            name: vpsUser.name || vpsUser.display_label,
            role: vpsUser.role,
            clinic_id: vpsUser.clinic_id,
            assigned_warehouse_id: vpsUser.assigned_warehouse_id || "",
            is_owner: Boolean(vpsUser.is_principal_doctor || vpsUser.is_owner),
            can_view_financials: Boolean(vpsUser.can_view_financials),
            is_principal_doctor: Boolean(vpsUser.is_principal_doctor),
            sessionToken: "st_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
            authenticatedAt: new Date().toISOString(),
            auth_source: "vps",
          };

          try {
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
            }
            storageDriver.setItem(SESSION_KEY, JSON.stringify(session));
          } catch {}

          setRateLimitState({ failedAttempts: 0, lockoutUntil: 0 });

          // ── IMMEDIATE POST-LOGIN SYNC ──────────────────────────────────────
          // JWT is now in localStorage. Trigger pull immediately so MySQL data
          // hydrates into the browser without waiting for the 4-second poller.
          // This is what makes "clear localStorage → login → data appears" work.
          try {
            const { syncEngine } = await import("./syncEngine.js");
            // Small tick so session storage write settles first
            setTimeout(() => {
              syncEngine.pullLatestCloudState().then(() => {
                syncEngine.processOutbox();
              });
            }, 100);
          } catch (_) {}
          // ──────────────────────────────────────────────────────────────────

          return { success: true, user: session, error: null };
        }

        // VPS returned 401 — check if account exists in local restored cache before outright rejecting
        if (res.status === 401) {
          console.warn("[Auth] VPS rejected credentials (401), checking local restored database...");
        }
      }
    } catch (networkErr) {
      // Network error / timeout → fall through to offline local auth
      console.warn("[Auth] VPS auth unreachable, trying local fallback:", networkErr?.message || networkErr);
    }
  }

  // ─────────────────────────────────────────────────────────
  // STEP 2: Offline fallback — use local localStorage users
  // (cached from last successful VPS pull)
  // ─────────────────────────────────────────────────────────
  const idLower = (identifier || "").toString().trim().toLowerCase();
  const idSlug = idLower.replace(/[\s._-]+/g, "");
  const cleanPhone = typeof identifier === "string" ? identifier.replace(/\D/g, "") : "";
  const allUsers = dbUsers.getAll();

  let user = allUsers.find((u) => {
    if (!u) return false;
    // 1. Match exact ID or ID lowercase
    if (u.id && u.id.toLowerCase() === idLower) return true;
    // 2. Match exact Email
    if (u.email && u.email.trim().toLowerCase() === idLower) return true;
    // 3. Match Email prefix (before @)
    if (u.email && u.email.split("@")[0].toLowerCase() === idLower) return true;
    // 4. Match exact Phone (digits only)
    if (cleanPhone && u.phone && u.phone.replace(/\D/g, "") === cleanPhone) return true;
    // 5. Match Name lowercase or Name slug (e.g. "mustafa", "asif", "raza")
    if (u.name && u.name.trim().toLowerCase() === idLower) return true;
    if (u.name && u.name.toLowerCase().replace(/[\s._-]+/g, "") === idSlug) return true;
    return false;
  });

  // Legacy default bootstrap admin user disabled by user request

  if (!user) {
    failedAttempts++;
    lockoutUntil = failedAttempts >= MAX_ATTEMPTS ? Date.now() + 60_000 : lockoutUntil;
    setRateLimitState({ failedAttempts, lockoutUntil });
    return { success: false, user: null, error: GENERIC_ERROR };
  }

  if (user.status === "disabled" || user.status === "deactivated" || user.status === "inactive") {
    return {
      success: false,
      user: null,
      error: { code: "ACCOUNT_DISABLED", message: "This account has been disabled. Please contact the clinic administrator." },
    };
  }

  const isMatch = verifyPassword(password, user.password || user.password_hash);
  if (!isMatch) {
    failedAttempts++;
    lockoutUntil = failedAttempts >= MAX_ATTEMPTS ? Date.now() + 60_000 : lockoutUntil;
    setRateLimitState({ failedAttempts, lockoutUntil });
    dbAuditLogs.logEvent({
      actor_id: user.id, actor_name: user.name, role: user.role,
      action: "LOGIN_FAILED", entity: "auth", entity_id: user.id,
      reason: "Invalid password attempt",
    });
    return { success: false, user: null, error: GENERIC_ERROR };
  }

  // Auto-upgrade legacy password hashes
  const currentPassStr = String(user.password || user.password_hash || "");
  if (!currentPassStr.startsWith("cf_s256$")) {
    try {
      const newSalted = hashPassword(password);
      dbUsers.update(user.id, { password: newSalted, password_hash: newSalted });
    } catch {}
  }

  setRateLimitState({ failedAttempts: 0, lockoutUntil: 0 });

  const session = {
    userId: user.id,
    name: user.name,
    role: user.role,
    clinic_id: user.clinic_id,
    assigned_warehouse_id: user.assigned_warehouse_id || "",
    is_owner: Boolean(user.is_owner),
    can_view_financials: Boolean(user.can_view_financials),
    sessionToken: "st_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    authenticatedAt: new Date().toISOString(),
    auth_source: "local_offline",
  };

  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    storageDriver.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}

  dbAuditLogs.logEvent({
    actor_id: user.id, actor_name: user.name, role: user.role,
    action: "LOGIN_SUCCESS", entity: "auth", entity_id: user.id,
    session_token: session.sessionToken,
    reason: isOnline ? "VPS unavailable — local cache used" : "Offline mode",
  });

  return { success: true, user: session, error: null };
}

/** Get the currently logged-in user from session storage — validates against DB record. */
export function getSession() {
  try {
    if (typeof sessionStorage === "undefined") return null;
    let session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (!session && typeof localStorage !== "undefined") {
      session = JSON.parse(storageDriver.getItem(SESSION_KEY));
      if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    if (!session || !session.userId) return null;

    // Validate session against actual stored user record to prevent tampering & zombie sessions
    const dbUser = dbUsers.getById(session.userId);

    if (!dbUser) {
      // ── VPS-issued session trust ───────────────────────────────────────────
      // If the session was issued by the VPS (auth_source="vps") but the local
      // user cache is empty (e.g. localStorage was just cleared and a fresh VPS
      // login was done), trust the session as-is.
      // The pull triggered after login will repopulate the local user cache.
      // We must NOT invalidate here or the user gets logged out immediately.
      if (session.auth_source === "vps" && session.userId && session.role) {
        return session; // Trust VPS-issued session while local cache repopulates
      }
      // Local-only session with no user record → purge
      sessionStorage.removeItem(SESSION_KEY);
      storageDriver.removeItem(SESSION_KEY);
      return null;
    }

    if (dbUser.status === "disabled" || dbUser.status === "deactivated" || dbUser.status === "inactive") {
      sessionStorage.removeItem(SESSION_KEY);
      storageDriver.removeItem(SESSION_KEY);
      return null;
    }

    // Refresh session with authoritative DB values (prevents role escalation via DevTools)
    const validated = {
      userId: dbUser.id,
      name: dbUser.name,
      role: dbUser.role,
      clinic_id: dbUser.clinic_id,
      assigned_warehouse_id: dbUser.assigned_warehouse_id || "",
      is_owner: Boolean(dbUser.is_owner),
      can_view_financials: Boolean(dbUser.can_view_financials),
      sessionToken: session.sessionToken,
      authenticatedAt: session.authenticatedAt,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(validated));
    return validated;
  } catch {
    return null;
  }
}

/** Log out the current user. */
export function logout() {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(SESSION_KEY);
    if (typeof localStorage !== "undefined") storageDriver.removeItem(SESSION_KEY);
  } catch {}
}

/**
 * Server-Side / Engine-Level RBAC & Authority Enforcement Guards
 */

/** Check if current active session has required role or is clinic owner */
export function checkAuthorization(allowedRoles = [], requireFinancials = false) {
  const session = getSession();
  if (!session) {
    return { authorized: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } };
  }

  const isOwner = Boolean(session.is_owner || session.role === "admin" || session.role === "owner" || session.userId === "user_admin");
  if (isOwner) {
    return { authorized: true, user: session };
  }

  if (requireFinancials && !session.can_view_financials) {
    return { authorized: false, error: { code: "FORBIDDEN_FINANCIALS", message: "Access denied: Financial clearance required." } };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    return { authorized: false, error: { code: "FORBIDDEN_ROLE", message: `Access denied: Requires role [${allowedRoles.join(", ")}].` } };
  }

  return { authorized: true, user: session };
}

/** Assert authority or throw authorization error (used inside DB & API mutations) */
export function assertAuthorized(allowedRoles = [], requireFinancials = false) {
  const check = checkAuthorization(allowedRoles, requireFinancials);
  if (!check.authorized) {
    throw new Error(check.error?.message || "Forbidden: You do not have permission to execute this operation.");
  }
  return check.user;
}

/**
 * Shared Counter Active Cashier / Staff Session Manager
 */
export function getActiveCashier() {
  try {
    const raw = typeof localStorage !== "undefined" ? storageDriver.getItem("cf_active_cashier") : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id && parsed.name) return parsed;
    }
  } catch {}
  
  const session = getSession();
  if (session && session.name) {
    return {
      id: session.userId || session.id || "user_admin",
      name: session.name,
      role: session.role || "Cashier",
      pin: "1234",
    };
  }
  return { id: "user_admin", name: "Counter Staff", role: "Cashier", pin: "1234" };
}

export function setActiveCashier(staff) {
  if (!staff || !staff.name) return getActiveCashier();
  const data = {
    id: staff.id || staff.userId || `staff_${Date.now()}`,
    name: staff.name || staff.display_label,
    role: staff.role || "Cashier",
    pin: staff.pin || "1234",
    switched_at: new Date().toISOString(),
  };
  try {
    storageDriver.setItem("cf_active_cashier", JSON.stringify(data));
    storageDriver.setItem("cf_pos_active_operator", JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("clinicflow_cashier_changed", { detail: data }));
    }
  } catch {}
  return data;
}



/**
 * Attempt login using 4-digit PIN selection.
 * Returns { success, user, error }.
 */
export async function loginWithPin(userId, pin) {
  const allUsers = dbUsers.getAll();
  const user = allUsers.find((u) => u.id === userId);
  if (!user) {
    return { success: false, error: { message: "User not found." } };
  }
  
  if (user.status === "disabled" || user.status === "deactivated" || user.status === "inactive") {
    return {
      success: false,
      error: { message: "This account has been disabled." },
    };
  }

  // Verify PIN (matches either raw user.pin, user.password, or verifies against hash)
  const isMatch = (user.pin && user.pin.toString() === pin.toString()) || 
                  (user.password && user.password.toString() === pin.toString()) ||
                  verifyPassword(pin, user.password || user.password_hash || "");
                  
  if (!isMatch) {
    return { success: false, error: { message: "Incorrect 4-digit PIN." } };
  }

  // Create session
  const session = {
    userId: user.id,
    name: user.name || user.display_label,
    role: user.role,
    clinic_id: user.clinic_id || "clinic_001",
    assigned_warehouse_id: user.assigned_warehouse_id || "",
    is_owner: Boolean(user.is_principal_doctor || user.is_owner || user.role === "admin" || user.role === "owner"),
    can_view_financials: Boolean(user.can_view_financials || user.role === "admin" || user.role === "owner"),
    is_principal_doctor: Boolean(user.is_principal_doctor),
    sessionToken: "st_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    authenticatedAt: new Date().toISOString(),
    auth_source: "local_pin",
  };

  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    storageDriver.setItem(SESSION_KEY, JSON.stringify(session));
    
    // Auto-set as active cashier for POS session
    setActiveCashier(user);
  } catch (e) {
    console.error("Failed to write session:", e);
  }

  return { success: true, user: session };
}
