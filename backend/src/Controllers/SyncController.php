<?php

declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Config\Database;
use CliniCore\Middleware\AuthMiddleware;
use CliniCore\Utils\Response;
use PDO;
use Throwable;

/**
 * SyncController — Enterprise Offline-First Cloud Synchronization Engine
 * Handles idempotent batch mutation pushes, delta pulls, and calibrated server time.
 */
class SyncController {

    /**
     * Calibrated Server Time & Master Clock
     * GET /api/v1/time
     */
    public function time(): void {
        $now = new \DateTimeImmutable('now', new \DateTimeZone('Asia/Karachi'));
        Response::success([
            'server_time'  => $now->format('c'),
            'timezone'     => 'Asia/Karachi',
            'epoch_ms'     => (int) (microtime(true) * 1000),
            'status'       => 'synchronized'
        ]);
    }

    /**
     * Ingest Batched Client Mutations with Strict Server Idempotency
     * POST /api/v1/sync/push
     */
    public function push(): void {
        $user = AuthMiddleware::authenticate();
        $userId = $user['user_id'] ?? $user['id'] ?? 'unknown_user';
        $clinicId = $user['clinic_id'] ?? 'clinic_001';

        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true);

        if (!is_array($input) || !isset($input['mutations']) || !is_array($input['mutations'])) {
            Response::badRequest('Invalid payload format. Expected { mutations: [...] } array.');
            return;
        }

        $mutations = $input['mutations'];
        if (empty($mutations)) {
            Response::success([
                'processed' => 0,
                'duplicates' => 0,
                'errors' => 0,
                'results' => []
            ]);
            return;
        }

        $db = Database::getConnection();
        $results = [];
        $processedCount = 0;
        $duplicateCount = 0;
        $errorCount = 0;

        try {
            Database::transaction(function (PDO $pdo) use (
                $mutations,
                $userId,
                $clinicId,
                &$results,
                &$processedCount,
                &$duplicateCount,
                &$errorCount
            ) {
                $checkIdem = $pdo->prepare("
                    SELECT idempotency_key, response_code, response_body 
                    FROM idempotency_keys 
                    WHERE idempotency_key = :key 
                    LIMIT 1
                ");

                $saveIdem = $pdo->prepare("
                    INSERT INTO idempotency_keys (idempotency_key, user_id, endpoint, response_code, response_body)
                    VALUES (:key, :user_id, :endpoint, :code, :body)
                    ON DUPLICATE KEY UPDATE response_code = VALUES(response_code)
                ");

                foreach ($mutations as $mut) {
                    $mutationId = (string) ($mut['mutation_id'] ?? $mut['id'] ?? '');
                    $entity     = (string) ($mut['entity'] ?? '');
                    $entityId   = (string) ($mut['entity_id'] ?? '');
                    $operation  = strtoupper((string) ($mut['operation'] ?? 'UPDATE'));
                    $payload    = $mut['payload'] ?? [];

                    if (!$mutationId || !$entity) {
                        $results[] = [
                            'mutation_id' => $mutationId,
                            'status'      => 'rejected',
                            'reason'      => 'Missing mutation_id or entity'
                        ];
                        $errorCount++;
                        continue;
                    }

                    // 1. Idempotency Check
                    $checkIdem->execute([':key' => $mutationId]);
                    $existing = $checkIdem->fetch(PDO::FETCH_ASSOC);

                    if ($existing) {
                        $duplicateCount++;
                        $cachedBody = json_decode((string)($existing['response_body'] ?? '{}'), true) ?: [];
                        $results[] = array_merge([
                            'mutation_id' => $mutationId,
                            'status'      => 'confirmed',
                            'idempotent'  => true
                        ], $cachedBody);
                        continue;
                    }

                    // 2. Process domain entity mutation safely
                    try {
                        self::applyMutation($pdo, $clinicId, $userId, $entity, $entityId, $operation, $payload);

                        // 3. Record Idempotency Key
                        $saveIdem->execute([
                            ':key'      => $mutationId,
                            ':user_id'  => $userId,
                            ':endpoint' => "/api/v1/sync/push#{$entity}",
                            ':code'     => 200,
                            ':body'     => json_encode(['status' => 'confirmed', 'entity_id' => $entityId])
                        ]);

                        $processedCount++;
                        $results[] = [
                            'mutation_id' => $mutationId,
                            'status'      => 'confirmed',
                            'entity_id'   => $entityId
                        ];
                    } catch (Throwable $e) {
                        $errorCount++;
                        $results[] = [
                            'mutation_id' => $mutationId,
                            'status'      => 'failed',
                            'error'       => $e->getMessage()
                        ];
                    }
                }
            });

            Response::success([
                'processed'   => $processedCount,
                'duplicates'  => $duplicateCount,
                'errors'      => $errorCount,
                'results'     => $results
            ]);
        } catch (Throwable $e) {
            Response::serverError('Transaction failed during batch mutation processing: ' . $e->getMessage());
        }
    }

    /**
     * Delta Pull Endpoint
     * GET /api/v1/sync/pull?since=<ISO_TIMESTAMP>&warehouse_id=<ID>
     */
    public function pull(): void {
        AuthMiddleware::authenticate();
        $since = $_GET['since'] ?? '1970-01-01 00:00:00';
        $warehouseId = $_GET['warehouse_id'] ?? null;

        $db = Database::getConnection();
        $delta = [];

        try {
            // 1. Patients updated since
            $pStmt = $db->prepare("SELECT * FROM patients WHERE updated_at >= :since ORDER BY updated_at ASC LIMIT 500");
            $pStmt->execute([':since' => $since]);
            $delta['patients'] = $pStmt->fetchAll(PDO::FETCH_ASSOC);

            // 2. Visits updated since
            $vStmt = $db->prepare("SELECT * FROM visits WHERE updated_at >= :since ORDER BY updated_at ASC LIMIT 500");
            $vStmt->execute([':since' => $since]);
            $delta['visits'] = $vStmt->fetchAll(PDO::FETCH_ASSOC);

            // 3. Inventory updated since
            $iStmt = $db->prepare("SELECT * FROM inventory WHERE updated_at >= :since ORDER BY updated_at ASC LIMIT 1000");
            $iStmt->execute([':since' => $since]);
            $delta['inventory'] = $iStmt->fetchAll(PDO::FETCH_ASSOC);

            // 4. Warehouse Stocks
            if ($warehouseId) {
                $wsStmt = $db->prepare("SELECT * FROM warehouse_stocks WHERE warehouse_id = :wh AND updated_at >= :since");
                $wsStmt->execute([':wh' => $warehouseId, ':since' => $since]);
            } else {
                $wsStmt = $db->prepare("SELECT * FROM warehouse_stocks WHERE updated_at >= :since LIMIT 1000");
                $wsStmt->execute([':since' => $since]);
            }
            $delta['warehouse_stocks'] = $wsStmt->fetchAll(PDO::FETCH_ASSOC);

            // 5. System Settings
            $sStmt = $db->prepare("SELECT * FROM system_settings WHERE updated_at >= :since");
            $sStmt->execute([':since' => $since]);
            $delta['system_settings'] = $sStmt->fetchAll(PDO::FETCH_ASSOC);

            $now = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Karachi')))->format('Y-m-d H:i:s');

            Response::success([
                'server_time' => $now,
                'delta'       => $delta,
                'total_items' => array_sum(array_map('count', $delta))
            ]);
        } catch (Throwable $e) {
            Response::serverError('Delta pull query error: ' . $e->getMessage());
        }
    }

    /**
     * Internal Domain Mutation Dispatcher
     */
    private static function applyMutation(
        PDO $pdo,
        string $clinicId,
        string $userId,
        string $entity,
        string $entityId,
        string $operation,
        array $payload
    ): void {
        \CliniCore\Services\MutationService::mutate($pdo, $clinicId, $userId, $entity, $entityId, $operation, $payload);
    }
}
