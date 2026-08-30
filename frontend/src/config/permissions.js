/**
 * permissions.js — Centralized Role & Route Authorization Policy Engine for ClinicFlow Enterprise.
 * Strictly maps route paths to business permissions via hasPermission().
 * Enforces fail-closed security: unauthenticated or missing roles are DENIED by default.
 */

import { hasPermission } from "../api/auth.js";

/**
 * Route Path ➔ Entity Capability Mapping
 */
export const ROUTE_PERMISSION_MAP = {
  "/dashboard": { entity: "dashboard", capability: "view" },
  "/reception/register": { entity: "patients", capability: "create" },
  "/reception/queue": { entity: "visits", capability: "view" },
  "/reception/pending-reports": { entity: "visits", capability: "edit" },
  "/doctor/queue": { entity: "visits", capability: "view", roleRequirement: "doctor" },
  "/doctor/consultation": { entity: "visits", capability: "edit", roleRequirement: "doctor" },
  "/store/pos": { entity: "pos_sales", capability: "create" },
  "/store/sales": { entity: "pos_sales", capability: "view" },
  "/store/purchases": { entity: "purchases", capability: "create" },
  "/store/warehouse": { entity: "warehouses", capability: "view" },
  "/store": { entity: "inventory", capability: "view" },
  "/patients": { entity: "patients", capability: "view" },
  "/patients/new": { entity: "patients", capability: "create" },
  "/patients/:id": { entity: "patients", capability: "view" },
  "/fees": { entity: "cashbook", capability: "view" },
  "/settings": { entity: "system_settings", capability: "edit" },
  "/admin": { entity: "system_settings", capability: "admin" },
  "/developer-admin": { entity: "system_settings", capability: "admin" },
  "/developer": { entity: "system_settings", capability: "admin" },
  "/god-admin": { entity: "system_settings", capability: "admin" },
  "/receipt-studio": { entity: "system_settings", capability: "admin" },
};

/**
 * Check if a user or session is authorized to access a given route path.
 * Returns true if authorized, false if denied (fail-closed).
 */
export function canAccessRoutePath(userOrSession, path) {
  // Fail closed if unauthenticated
  if (!userOrSession) return false;

  const role = userOrSession.role;
  if (!role && !userOrSession.is_owner) return false;

  // Superuser / Admin / Owner wildcard access
  const isSuper = Boolean(
    userOrSession.is_owner ||
    role === "admin" ||
    role === "owner" ||
    userOrSession.is_principal_doctor
  );
  if (isSuper) return true;

  // Find mapping key for route
  let normalizedPath = path.split("?")[0].replace(/\/$/, "");
  if (!normalizedPath) normalizedPath = "/";

  let matchKey = normalizedPath;

  // Parametric route matching (e.g. /doctor/consultation/123 -> /doctor/consultation)
  if (!ROUTE_PERMISSION_MAP[matchKey]) {
    for (const key of Object.keys(ROUTE_PERMISSION_MAP)) {
      if (key.includes(":") || normalizedPath.startsWith(key + "/")) {
        matchKey = key;
        break;
      }
    }
  }

  // Dashboard is universally accessible for all authenticated users
  if (normalizedPath === "/dashboard") return true;

  const mapping = ROUTE_PERMISSION_MAP[matchKey];

  // If route is not explicitly mapped or has role requirement
  if (!mapping) {
    // Default open for basic authenticated pages (e.g., /dashboard, /patients) if user has generic view
    if (normalizedPath === "/dashboard" || normalizedPath === "/patients") return true;
    return false; // Fail closed for unknown routes
  }

  if (mapping.roleRequirement && role !== mapping.roleRequirement) {
    return false;
  }

  return hasPermission(userOrSession, mapping.entity, mapping.capability);
}

/**
 * Get primary default redirect path for a given role upon unauthorized access.
 */
export function getDefaultRouteForRole(role) {
  switch (role) {
    case "receptionist":
      return "/reception/register";
    case "cashier":
    case "pharmacist":
      return "/store/pos";
    case "doctor":
      return "/doctor/queue";
    case "warehouse":
    case "warehouse_incharge":
      return "/store/warehouse";
    default:
      return "/dashboard";
  }
}
