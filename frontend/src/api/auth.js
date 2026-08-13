/** auth.js — Login and session helpers. */
import { dbUsers } from "./db.js";

const SESSION_KEY = "cf_session";

/** Attempt login. Returns { success, user, error }. */
export function login(identifier, password) {
  const user = dbUsers.getByEmail(identifier.trim().toLowerCase())
    || dbUsers.getAll().find((u) => u.phone === identifier.trim());

  if (!user) {
    return { success: false, user: null, error: { code: "NOT_FOUND", message: "No account found for that email or phone." } };
  }
  if (user.password !== password) {
    return { success: false, user: null, error: { code: "WRONG_PASSWORD", message: "Incorrect password." } };
  }

  const session = { userId: user.id, name: user.name, role: user.role, clinic_id: user.clinic_id };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true, user: session, error: null };
}

/** Get the currently logged-in user from session storage. */
export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

/** Log out the current user. */
export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}
