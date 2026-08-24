<?php
declare(strict_types=1);

namespace CliniCore\Config;

use PDO;
use PDOException;
use Exception;
use CliniCore\Utils\Response;

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            Env::load();

            $host = (string) Env::get('DB_HOST', '127.0.0.1');
            $port = (string) Env::get('DB_PORT', '3306');
            $db   = (string) Env::get('DB_DATABASE', 'clinicore');
            $user = (string) Env::get('DB_USERNAME', 'root');
            $pass = (string) Env::get('DB_PASSWORD', '');

            $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
            
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ];

            try {
                self::$instance = new PDO($dsn, $user, $pass, $options);
            } catch (PDOException $e) {
                error_log("Database Connection Failure: " . $e->getMessage());
                Response::error(
                    "DATABASE_CONNECTION_ERROR",
                    "Database service temporarily unavailable. Please verify connection credentials.",
                    500
                );
                exit;
            }
        }

        return self::$instance;
    }

    /**
     * Executes a callback within an isolated ACID database transaction.
     * Automatically rolls back on any uncaught exception.
     */
    public static function transaction(callable $callback): mixed {
        $db = self::getConnection();
        $db->beginTransaction();
        try {
            $result = $callback($db);
            $db->commit();
            return $result;
        } catch (Exception $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }
}
