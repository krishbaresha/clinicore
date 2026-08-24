<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Config\Database;
use CliniCore\Utils\JWT;
use CliniCore\Utils\Response;
use CliniCore\Utils\Validator;
use CliniCore\Middleware\AuthMiddleware;
use PDO;

class AuthController {
    public function login(): void {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $validator = Validator::make($body)
            ->required('username', 'Please provide your email, phone, or username')
            ->required('password', 'Password is required')
            ->validateOrFail();

        $username = trim((string) $body['username']);
        $password = (string) $body['password'];

        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT u.id, u.clinic_id, u.name, u.display_label, u.role, u.phone, u.email, 
                   u.password_hash, u.assigned_warehouse_id, u.is_principal_doctor, u.status,
                   c.name AS clinic_name, c.logo_url AS clinic_logo, c.default_consultation_fee
            FROM users u
            JOIN clinics c ON c.id = u.clinic_id
            WHERE (u.email = :u1 OR u.phone = :u2 OR u.id = :u3) AND u.status = 'active'
            LIMIT 1
        ");
        $stmt->execute([':u1' => $username, ':u2' => $username, ':u3' => $username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Response::error('INVALID_CREDENTIALS', 'Invalid username or password.', 401);
        }

        // Generate JWT Token
        $token = JWT::encode([
            'user_id'   => $user['id'],
            'clinic_id' => $user['clinic_id'],
            'role'      => $user['role'],
            'wh_id'     => $user['assigned_warehouse_id']
        ]);

        // Remove sensitive password hash
        unset($user['password_hash']);

        Response::success([
            'token' => $token,
            'user'  => $user
        ], 200);
    }

    public function me(): void {
        $user = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT id, name, logo_url, address, phone, default_consultation_fee FROM clinics WHERE id = :id");
        $stmt->execute([':id' => $user['clinic_id']]);
        $clinic = $stmt->fetch(PDO::FETCH_ASSOC);

        Response::success([
            'user'   => $user,
            'clinic' => $clinic
        ]);
    }
}
