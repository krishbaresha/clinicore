<?php
declare(strict_types=1);

namespace CliniCore\Middleware;

use CliniCore\Utils\Response;

class RBACMiddleware {
    private const ROLE_PERMISSIONS = [
        'owner' => ['*'],
        'admin' => ['*'],
        'doctor' => ['patients.view', 'patients.create', 'patients.edit', 'visits.*', 'inventory.view', 'pos_sales.view', 'reports.view'],
        'pharmacist' => ['patients.view', 'visits.view', 'inventory.*', 'pos_sales.*', 'b2b_sales.*', 'purchases.*', 'suppliers.view', 'parties.view', 'warehouses.*', 'cashbook.*', 'reports.view'],
        'cashier' => ['patients.view', 'patients.create', 'visits.view', 'visits.create', 'inventory.view', 'pos_sales.*', 'b2b_sales.view', 'parties.view', 'cashbook.*', 'reports.view'],
        'receptionist' => ['patients.view', 'patients.create', 'patients.edit', 'visits.view', 'visits.create', 'visits.edit', 'inventory.view'],
        'warehouse_incharge' => ['inventory.*', 'warehouses.*', 'purchases.*', 'b2b_sales.*', 'suppliers.view', 'parties.view'],
        'accountant' => ['finance.*', 'cashbook.*', 'ledgers.*', 'purchases.*', 'pos_sales.*', 'b2b_sales.*', 'suppliers.*', 'parties.*', 'reports.*', 'audit.view'],
        'manager' => ['patients.*', 'visits.*', 'inventory.*', 'pos_sales.*', 'b2b_sales.*', 'purchases.*', 'suppliers.*', 'parties.*', 'warehouses.*', 'cashbook.*', 'finance.*', 'reports.*', 'audit.view'],
    ];

    /**
     * Checks whether the user has a specific dot-notation permission.
     */
    public static function hasPermission(array $user, string $permission): bool {
        if ($user['role'] === 'owner' || $user['role'] === 'admin' || !empty($user['is_principal_doctor'])) {
            return true;
        }

        $perms = self::ROLE_PERMISSIONS[$user['role']] ?? [];
        if (in_array('*', $perms, true) || in_array($permission, $perms, true)) {
            return true;
        }

        [$module] = explode('.', $permission);
        if (in_array("{$module}.*", $perms, true)) {
            return true;
        }

        return false;
    }

    /**
     * Enforce a specific dot-notation permission or reject with 403 Forbidden.
     */
    public static function requirePermission(string $permission): array {
        $user = AuthMiddleware::authenticate();
        if (!self::hasPermission($user, $permission)) {
            Response::forbidden("Access denied: Role '{$user['role']}' lacks '{$permission}' permission.");
        }
        return $user;
    }

    /**
     * Verifies that the authenticated user is authorized to access or mutate the given warehouse.
     *
     * @param array $user Authenticated user array from AuthMiddleware::authenticate()
     * @param string|null $targetWarehouseId The warehouse ID requested in query or body
     * @return string The validated, effective warehouse ID
     */
    public static function enforceWarehouseScope(array $user, ?string $targetWarehouseId): string {
        $isSuper = ($user['role'] === 'owner' || $user['role'] === 'admin' || !empty($user['is_principal_doctor']) || $user['role'] === 'doctor');
        
        $assignedWh = $user['assigned_warehouse_id'] ?? null;
        $allowedWhs = !empty($user['allowed_warehouses']) ? (is_array($user['allowed_warehouses']) ? $user['allowed_warehouses'] : json_decode($user['allowed_warehouses'], true)) : [];

        // Superusers can target any warehouse or default to store
        if ($isSuper) {
            return $targetWarehouseId ?: ($assignedWh ?: 'wh_str');
        }

        // Non-superusers MUST be assigned to a warehouse
        if (!$assignedWh && empty($allowedWhs)) {
            Response::forbidden("Access denied: User is not assigned to any warehouse location.");
        }

        // If no target provided in request, default to user's assigned warehouse
        if (!$targetWarehouseId) {
            return $assignedWh ?: $allowedWhs[0];
        }

        // If target warehouse specified, verify access
        $hasAccess = ($targetWarehouseId === $assignedWh) || in_array($targetWarehouseId, $allowedWhs, true);
        if (!$hasAccess) {
            Response::forbidden("Access denied: You do not have permission to access warehouse '{$targetWarehouseId}'. Assigned warehouse: '{$assignedWh}'.");
        }

        return $targetWarehouseId;
    }

    /**
     * Enforce that the authenticated user possesses one of the allowed roles.
     */
    public static function authorize(array $allowedRoles): array {
        $user = AuthMiddleware::authenticate();
        
        // Owner and Admin bypass all role checks
        if ($user['role'] === 'owner' || $user['role'] === 'admin' || !empty($user['is_principal_doctor'])) {
            return $user;
        }

        if (!in_array($user['role'], $allowedRoles, true)) {
            Response::forbidden("Access denied: Your account role ({$user['role']}) does not have permission for this resource.");
        }

        return $user;
    }

    /**
     * Shorthand: Requires Super Admin or Clinic Owner role.
     */
    public static function requireAdminOrOwner(): array {
        return self::authorize(['admin', 'owner']);
    }

    /**
     * Shorthand: Financial clearance required (Cashbook, Expenses, Audit Ledgers).
     */
    public static function requireFinancials(): array {
        return self::authorize(['admin', 'owner', 'accountant', 'manager']);
    }

    /**
     * Shorthand: Warehouse / Supply Chain clearance (Purchases, B2B Sales, Stock Movements).
     */
    public static function requireWarehouse(): array {
        return self::authorize(['admin', 'owner', 'warehouse_incharge', 'warehouse_manager', 'godown_incharge', 'b2b_salesman', 'pharmacist']);
    }

    /**
     * Shorthand: Doctor / Clinical clearance.
     */
    public static function requireDoctorOrAdmin(): array {
        return self::authorize(['admin', 'owner', 'doctor']);
    }
}
