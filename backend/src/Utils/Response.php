<?php
declare(strict_types=1);

namespace CliniCore\Utils;

class Response {
    public static function json(mixed $data = null, bool $success = true, ?array $error = null, int $statusCode = 200, array $meta = []): void {
        // Clear any previous buffer
        if (ob_get_length()) {
            ob_clean();
        }

        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        
        $payload = [
            'success' => $success,
            'data'    => $data,
            'error'   => $error,
            'meta'    => array_merge([
                'timestamp'  => date('c'),
                'request_id' => bin2hex(random_bytes(6)),
            ], $meta)
        ];

        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function success(mixed $data = null, int $statusCode = 200, array $meta = []): void {
        self::json($data, true, null, $statusCode, $meta);
    }

    public static function error(string $code, string $message, int $statusCode = 400, ?array $details = null): void {
        self::json(null, false, [
            'code'    => $code,
            'message' => $message,
            'details' => $details,
        ], $statusCode);
    }

    public static function unauthorized(string $message = "Authentication required or session expired."): void {
        self::error("UNAUTHORIZED", $message, 401);
    }

    public static function forbidden(string $message = "You do not have permission to perform this action."): void {
        self::error("FORBIDDEN", $message, 403);
    }

    public static function notFound(string $message = "Requested resource not found."): void {
        self::error("NOT_FOUND", $message, 404);
    }

    public static function validationError(array $errors): void {
        self::json(null, false, [
            'code'    => 'VALIDATION_FAILED',
            'message' => 'Input validation failed. Please correct the highlighted errors.',
            'fields'  => $errors,
        ], 422);
    }
}
