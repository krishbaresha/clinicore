<?php
declare(strict_types=1);

namespace ClinicFlow\Config;

class Env {
    private static bool $loaded = false;

    public static function load(string $path = __DIR__ . '/../../.env'): void {
        if (self::$loaded || !file_exists($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || str_starts_with($line, '#')) {
                continue;
            }

            $parts = explode('=', $line, 2);
            if (count($parts) === 2) {
                $name = trim($parts[0]);
                $value = trim($parts[1]);
                // Remove quotes if present
                $value = trim($value, '"\'');

                if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
                    putenv(sprintf('%s=%s', $name, $value));
                    $_ENV[$name] = $value;
                    $_SERVER[$name] = $value;
                }
            }
        }
        self::$loaded = true;
    }

    public static function get(string $key, mixed $default = null): mixed {
        self::load();
        $val = getenv($key);
        if ($val === false) {
            return $_ENV[$key] ?? $_SERVER[$key] ?? $default;
        }
        return match (strtolower($val)) {
            'true', '(true)' => true,
            'false', '(false)' => false,
            'null', '(null)' => null,
            'empty', '(empty)' => '',
            default => $val,
        };
    }
}
