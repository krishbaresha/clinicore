<?php
declare(strict_types=1);

namespace CliniCore\Middleware;

use CliniCore\Config\Database;
use CliniCore\Utils\JWT;
use CliniCore\Utils\Response;
use PDO;

class AuthMiddleware {
    private static ?array $authenticatedUser = null;

    public static function authenticate(): array {
        if (self::$authenticatedUser !== null) {
            return self::$authenticatedUser;
        }

        $token = self::extractToken();
        if (!$token) {
            Response::unauthorized("Authorization token not provided.");
        }

        $payload = JWT::decode($token);
        if (!$payload || !isset($payload['user_id'])) {
            Response::unauthorized("Invalid or expired session token. Please log in again.");
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT id, clinic_id, name, display_label, role, phone, email, assigned_warehouse_id, is_principal_doctor, status FROM users WHERE id = :id AND status = 'active' LIMIT 1");
        $stmt->execute([':id' => $payload['user_id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            Response::unauthorized("User account does not exist or has been deactivated.");
        }

        self::$authenticatedUser = $user;
        return $user;
    }

    public static function user(): ?array {
        return self::$authenticatedUser;
    }

    private static function extractToken(): ?string {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? null;

        if ($authHeader && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            return $matches[1];
        }

        // Fallback to cookie
        if (isset($_COOKIE['cf_token'])) {
            return $_COOKIE['cf_token'];
        }

        return null;
    }
}
