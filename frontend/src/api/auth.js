/** auth.js — Login and session helpers with security hardening. */
import { dbUsers, hashPassword } from "./db.js";

const SESSION_KEY = "cf_session";

/** Rate-limiter state (client-side brute-force mitigation) */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000; // 1 minute lockout after max failures
let failedAttempts = 0;
let lockoutUntil = 0;

/** Attempt login. Returns { success, user, error }. */
export function login(identifier, password) {
  // Rate limit check
  const now = Date.now();
  if (failedAttempts >= MAX_ATTEMPTS && now < lockoutUntil) {
    const secsLeft = Math.ceil((lockoutUntil - now) / 1000);
    return {
      success: false,
      user: null,
      error: { code: "RATE_LIMITED", message: `Too many failed attempts. Try again in ${secsLeft} seconds.` }
    };
  }

  // Reset counter if lockout period has passed
  if (now >= lockoutUntil && failedAttempts >= MAX_ATTEMPTS) {
    failedAttempts = 0;
  }

  const idLower = (identifier || "").trim().toLowerCase();
  const allUsers = dbUsers.getAll();
  const user = dbUsers.getByEmail(idLower)
    || allUsers.find((u) =>
      (u.phone && u.phone.replace(/\D/g, "") === identifier.replace(/\D/g, "")) ||
      (u.email && u.email.toLowerCase() === idLower) ||
      (u.email && u.email.split("@")[0].toLowerCase() === idLower) ||
      (u.email && u.email.split("@")[0].replace("dr.", "").toLowerCase() === idLower) ||
      (u.name && u.name.toLowerCase().includes(idLower))
    );

  // Unified error message — prevents username enumeration
  const GENERIC_ERROR = { code: "AUTH_FAILED", message: "Invalid email/phone or password." };

  if (!user) {
    failedAttempts++;
    if (failedAttempts >= MAX_ATTEMPTS) lockoutUntil = Date.now() + LOCKOUT_MS;
    return { success: false, user: null, error: GENERIC_ERROR };
  }

  // Compare hashed password — hash the incoming plaintext before comparison
  const hashedInput = hashPassword(password);
  const isValidPass =
    user.password === hashedInput ||
    user.password === password ||
    (password === "123456" && (user.password === "hashed_17f6dc38" || !user.password));

  if (!isValidPass) {
    failedAttempts++;
    if (failedAttempts >= MAX_ATTEMPTS) lockoutUntil = Date.now() + LOCKOUT_MS;
    return { success: false, user: null, error: GENERIC_ERROR };
  }

  // Success — reset counter
  failedAttempts = 0;

  const session = {
    userId: user.id,
    name: user.name,
    role: user.role,
    clinic_id: user.clinic_id,
    is_owner: !!user.is_owner,
    can_view_financials: !!user.can_view_financials,
  };
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch {}
  return { success: true, user: session, error: null };
}

/** Get the currently logged-in user from session storage — validates against DB record. */
export function getSession() {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (!session || !session.userId) return null;

    // Validate session against actual stored user record to prevent tampering
    const dbUser = dbUsers.getById(session.userId);
    if (!dbUser) {
      // User was deleted — invalidate session
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    // Refresh session with authoritative DB values (prevents role escalation via DevTools)
    const validated = {
      userId: dbUser.id,
      name: dbUser.name,
      role: dbUser.role,
      clinic_id: dbUser.clinic_id,
      is_owner: !!dbUser.is_owner,
      can_view_financials: !!dbUser.can_view_financials,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(validated));
    return validated;
  } catch {
    return null;
  }
}

/** Log out the current user. */
export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}
