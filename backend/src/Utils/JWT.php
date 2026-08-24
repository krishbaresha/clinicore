<?php
declare(strict_types=1);

namespace CliniCore\Utils;

use CliniCore\Config\Env;
use Exception;

class JWT {
    private static function getSecret(): string {
        return (string) Env::get('JWT_SECRET', 'clinicore_enterprise_secure_token_secret_key_2026');
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
    }

    public static function encode(array $payload, int $ttlSeconds = 604800): string {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $now = time();
        $payload = array_merge($payload, [
            'iat' => $now,
            'exp' => $now + $ttlSeconds,
            'jti' => bin2hex(random_bytes(8))
        ]);

        $base64Header = self::base64UrlEncode((string) $header);
        $base64Payload = self::base64UrlEncode((string) json_encode($payload));

        $signature = hash_hmac('sha256', "{$base64Header}.{$base64Payload}", self::getSecret(), true);
        $base64Signature = self::base64UrlEncode($signature);

        return "{$base64Header}.{$base64Payload}.{$base64Signature}";
    }

    public static function decode(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$base64Header, $base64Payload, $base64Signature] = $parts;

        $expectedSig = hash_hmac('sha256', "{$base64Header}.{$base64Payload}", self::getSecret(), true);
        $expectedBase64Sig = self::base64UrlEncode($expectedSig);

        if (!hash_equals($expectedBase64Sig, $base64Signature)) {
            return null; // Invalid signature
        }

        $payload = json_decode(self::base64UrlDecode($base64Payload), true);
        if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
            return null; // Expired or malformed
        }

        return $payload;
    }
}
