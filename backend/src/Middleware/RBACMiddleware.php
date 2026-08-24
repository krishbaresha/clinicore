<?php
declare(strict_types=1);

namespace CliniCore\Middleware;

use CliniCore\Utils\Response;

class RBACMiddleware {
    /**
     * Enforce that the authenticated user possesses one of the allowed roles.
     */
    public static function authorize(array $allowedRoles): array {
        $user = AuthMiddleware::authenticate();
        
        // Owner and Admin bypass all role checks
        if ($user['role'] === 'owner' || $user['role'] === 'admin') {
            return $user;
        }

        if (!in_array($user['role'], $allowedRoles, true)) {
            Response::forbidden("Access denied: Your account role ({$user['role']}) does not have permission for this resource.");
        }

        return $user;
    }
}
