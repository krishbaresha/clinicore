<?php
declare(strict_types=1);

namespace CliniCore\Utils;

use CliniCore\Config\Database;
use PDO;

class RateLimiter {
    private static string $storageDir = __DIR__ . '/../../storage/ratelimit';

    public static function getClientIp(): string {
        $headers = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'REMOTE_ADDR'
        ];

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ips = explode(',', (string)$_SERVER[$header]);
                $ip = trim($ips[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }

        return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    }

    private static function getKey(string $action, ?string $identifier = null): string {
        $ip = self::getClientIp();
        $id = $identifier ? preg_replace('/[^a-zA-Z0-9_.-]/', '_', $identifier) : 'anon';
        return "rl_{$action}_{$id}_" . md5($ip);
    }

    public static function check(string $action, int $maxAttempts = 5, int $decaySeconds = 300, ?string $identifier = null): void {
        $key = self::getKey($action, $identifier);
        $record = self::readRecord($key);

        if ($record && $record['attempts'] >= $maxAttempts) {
            $remaining = $record['expires_at'] - time();
            if ($remaining > 0) {
                header("Retry-After: {$remaining}");
                Response::error(
                    'RATE_LIMIT_EXCEEDED',
                    "Too many attempts. Rate limit exceeded. Please try again in {$remaining} seconds.",
                    429,
                    ['retry_after' => $remaining]
                );
            } else {
                self::clear($action, $identifier);
            }
        }
    }

    public static function hit(string $action, int $decaySeconds = 300, ?string $identifier = null): int {
        $key = self::getKey($action, $identifier);
        $record = self::readRecord($key);
        $now = time();

        if ($record && $record['expires_at'] > $now) {
            $attempts = $record['attempts'] + 1;
            $expiresAt = $record['expires_at'];
        } else {
            $attempts = 1;
            $expiresAt = $now + $decaySeconds;
        }

        self::writeRecord($key, [
            'attempts' => $attempts,
            'expires_at' => $expiresAt,
            'updated_at' => $now
        ]);

        return $attempts;
    }

    public static function clear(string $action, ?string $identifier = null): void {
        $key = self::getKey($action, $identifier);
        $file = self::$storageDir . '/' . $key . '.json';
        if (file_exists($file)) {
            @unlink($file);
        }
    }

    private static function readRecord(string $key): ?array {
        $file = self::$storageDir . '/' . $key . '.json';
        if (!file_exists($file)) {
            return null;
        }

        $content = @file_get_contents($file);
        if (!$content) {
            return null;
        }

        $data = json_decode($content, true);
        if (!is_array($data) || empty($data['expires_at'])) {
            return null;
        }

        if ($data['expires_at'] <= time()) {
            @unlink($file);
            return null;
        }

        return $data;
    }

    private static function writeRecord(string $key, array $data): void {
        if (!is_dir(self::$storageDir)) {
            @mkdir(self::$storageDir, 0755, true);
        }

        $file = self::$storageDir . '/' . $key . '.json';
        @file_put_contents($file, json_encode($data), LOCK_EX);
    }
}
