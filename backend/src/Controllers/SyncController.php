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
                        $results[] = [
                            'mutation_id' => $mutationId,
                            'status'      => 'confirmed',
                            'idempotent'  => true,
                            'message'     => 'Already committed previously'
                        ];
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
        switch ($entity) {
            case 'patients':
                self::mutatePatient($pdo, $clinicId, $entityId, $operation, $payload);
                break;
            case 'visits':
                self::mutateVisit($pdo, $clinicId, $userId, $entityId, $operation, $payload);
                break;
            case 'stock_movements':
                self::mutateStockMovement($pdo, $clinicId, $userId, $entityId, $payload);
                break;
            case 'expenses':
                self::mutateExpense($pdo, $clinicId, $userId, $entityId, $operation, $payload);
                break;
            default:
                // Fallback to updating cloud state json
                $saveState = $pdo->prepare("
                    INSERT INTO app_cloud_state (collection_key, data_json)
                    VALUES (:k, :v)
                    ON DUPLICATE KEY UPDATE data_json = VALUES(data_json)
                ");
                $saveState->execute([
                    ':k' => "cf_{$entity}_v5",
                    ':v' => json_encode($payload)
                ]);
                break;
        }
    }

    private static function mutatePatient(PDO $pdo, string $clinicId, string $id, string $op, array $p): void {
        if ($op === 'DELETE') {
            $stmt = $pdo->prepare("UPDATE patients SET deleted_at = NOW() WHERE id = :id AND clinic_id = :cid");
            $stmt->execute([':id' => $id, ':cid' => $clinicId]);
            return;
        }

        $stmt = $pdo->prepare("
            INSERT INTO patients (id, clinic_id, mr_number, full_name, relation_name, relation_type, phone, cnic, age, gender, address, city, notes)
            VALUES (:id, :cid, :mr, :name, :rname, :rtype, :phone, :cnic, :age, :gender, :address, :city, :notes)
            ON DUPLICATE KEY UPDATE
                full_name = VALUES(full_name),
                relation_name = VALUES(relation_name),
                phone = VALUES(phone),
                address = VALUES(address),
                city = VALUES(city),
                notes = VALUES(notes),
                updated_at = NOW()
        ");

        $stmt->execute([
            ':id'      => $id ?: bin2hex(random_bytes(16)),
            ':cid'     => $clinicId,
            ':mr'      => $p['mr_number'] ?? ('MR-' . rand(10000, 99999)),
            ':name'    => (string) ($p['full_name'] ?? $p['name'] ?? 'Unnamed'),
            ':rname'   => $p['relation_name'] ?? null,
            ':rtype'   => $p['relation_type'] ?? 'father',
            ':phone'   => (string) ($p['phone'] ?? '03000000000'),
            ':cnic'    => $p['cnic'] ?? null,
            ':age'     => (int) ($p['age'] ?? 30),
            ':gender'  => $p['gender'] ?? 'male',
            ':address' => $p['address'] ?? null,
            ':city'    => $p['city'] ?? 'Hyderabad',
            ':notes'   => $p['notes'] ?? null,
        ]);
    }

    private static function mutateVisit(PDO $pdo, string $clinicId, string $userId, string $id, string $op, array $p): void {
        $stmt = $pdo->prepare("
            INSERT INTO visits (id, clinic_id, patient_id, doctor_id, token_number, queue_date, status, fee_amount, net_fee, symptoms, diagnosis, notes)
            VALUES (:id, :cid, :pid, :did, :tok, :qdate, :status, :fee, :nfee, :sym, :diag, :notes)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                diagnosis = VALUES(diagnosis),
                notes = VALUES(notes),
                updated_at = NOW()
        ");

        $stmt->execute([
            ':id'     => $id ?: bin2hex(random_bytes(16)),
            ':cid'    => $clinicId,
            ':pid'    => $p['patient_id'] ?? 'pat_unknown',
            ':did'    => $p['doctor_id'] ?? $userId,
            ':tok'    => (int) ($p['token_number'] ?? 1),
            ':qdate'  => $p['queue_date'] ?? date('Y-m-d'),
            ':status' => $p['status'] ?? 'waiting',
            ':fee'    => (float) ($p['fee_amount'] ?? 500.0),
            ':nfee'   => (float) ($p['net_fee'] ?? 500.0),
            ':sym'    => $p['symptoms'] ?? null,
            ':diag'   => $p['diagnosis'] ?? null,
            ':notes'  => $p['notes'] ?? null,
        ]);
    }

    private static function mutateStockMovement(PDO $pdo, string $clinicId, string $userId, string $id, array $p): void {
        $stmt = $pdo->prepare("
            INSERT INTO stock_movements (id, clinic_id, warehouse_id, inventory_id, movement_type, reference_id, qty_change_base_units, balance_after_base_units, notes, created_by)
            VALUES (:id, :cid, :wid, :iid, :mtype, :ref, :qty, :bal, :notes, :uid)
        ");

        $stmt->execute([
            ':id'    => $id ?: bin2hex(random_bytes(16)),
            ':cid'   => $clinicId,
            ':wid'   => $p['destination_location_id'] ?? $p['source_location_id'] ?? 'wh_str',
            ':iid'   => $p['inventory_id'] ?? '',
            ':mtype' => $p['movement_type'] ?? 'adjustment',
            ':ref'   => $p['source_voucher_no'] ?? null,
            ':qty'   => (int) ($p['qty_base_units'] ?? 0),
            ':bal'   => (int) ($p['running_balance_snapshot'] ?? 0),
            ':notes' => $p['notes'] ?? null,
            ':uid'   => $userId
        ]);
    }

    private static function mutateExpense(PDO $pdo, string $clinicId, string $userId, string $id, string $op, array $p): void {
        if ($op === 'DELETE') {
            $stmt = $pdo->prepare("DELETE FROM expenses WHERE id = :id AND clinic_id = :cid");
            $stmt->execute([':id' => $id, ':cid' => $clinicId]);
            return;
        }

        $stmt = $pdo->prepare("
            INSERT INTO expenses (id, clinic_id, warehouse_id, category, description, amount, payment_mode, expense_date)
            VALUES (:id, :cid, :wid, :cat, :desc, :amt, :pmode, :edate)
            ON DUPLICATE KEY UPDATE
                amount = VALUES(amount),
                description = VALUES(description),
                category = VALUES(category)
        ");

        $stmt->execute([
            ':id'    => $id ?: bin2hex(random_bytes(16)),
            ':cid'   => $clinicId,
            ':wid'   => $p['warehouse_id'] ?? null,
            ':cat'   => $p['category'] ?? 'General',
            ':desc'  => $p['description'] ?? 'Expense',
            ':amt'   => (float) ($p['amount'] ?? 0.0),
            ':pmode' => $p['payment_mode'] ?? 'cash',
            ':edate' => $p['date'] ?? date('Y-m-d')
        ]);
    }
}
