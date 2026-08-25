<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Config\Database;
use CliniCore\Utils\Response;
use CliniCore\Utils\Validator;
use CliniCore\Middleware\AuthMiddleware;
use CliniCore\Services\QueueService;
use PDO;

class VisitController {
    public function getTodayQueue(): void {
        $user = AuthMiddleware::authenticate();
        $doctorId = $_GET['doctor_id'] ?? null;

        // If logged in as doctor, isolate strictly to own queue
        if ($user['role'] === 'doctor') {
            $doctorId = $user['id'];
        }

        $today = QueueService::getTodayPKTDate();
        $db = Database::getConnection();

        $query = "
            SELECT v.id, v.token_number, v.queue_date, v.visit_type, v.status, v.fee_amount,
                   v.discount_amount, v.net_fee, v.payment_mode, v.symptoms, v.diagnosis,
                   v.prescription_image_url, v.notes, v.created_at, v.called_at, v.completed_at,
                   p.id AS patient_id, p.mr_number, p.full_name AS patient_name, p.relation_name,
                   p.relation_type, p.phone AS patient_phone, p.age, p.gender,
                   u.name AS doctor_name
            FROM visits v
            JOIN patients p ON p.id = v.patient_id
            JOIN users u ON u.id = v.doctor_id
            WHERE v.clinic_id = :clinic_id AND v.queue_date = :today
        ";

        $params = [':clinic_id' => $user['clinic_id'], ':today' => $today];

        if ($doctorId) {
            $query .= " AND v.doctor_id = :doc_id";
            $params[':doc_id'] = $doctorId;
        }

        $query .= " ORDER BY v.token_number ASC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $visits = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($visits);
    }

    public function register(): void {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        Validator::make($body)
            ->required('patient_id', 'Patient selection is required')
            ->required('doctor_id', 'Doctor selection is required')
            ->validateOrFail();

        $today = QueueService::getTodayPKTDate();
        $db = Database::getConnection();

        $visit = Database::transaction(function(PDO $db) use ($user, $body, $today) {
            $nextToken = QueueService::getNextTokenNumber($db, $user['clinic_id'], $body['doctor_id'], $today);
            $id = bin2hex(random_bytes(16));

            $fee = (float) ($body['fee_amount'] ?? 300.00);
            $discount = (float) ($body['discount_amount'] ?? 0.00);
            $netFee = max(0.00, $fee - $discount);

            $stmt = $db->prepare("
                INSERT INTO visits (id, clinic_id, patient_id, doctor_id, token_number, queue_date, visit_type, status, fee_amount, discount_amount, net_fee, payment_mode, symptoms, registered_by, created_at)
                VALUES (:id, :clinic_id, :pid, :doc_id, :token, :qdate, :vtype, 'waiting', :fee, :disc, :net, :pmode, :symp, :reg_by, NOW())
            ");
            $stmt->execute([
                ':id'        => $id,
                ':clinic_id' => $user['clinic_id'],
                ':pid'       => $body['patient_id'],
                ':doc_id'    => $body['doctor_id'],
                ':token'     => $nextToken,
                ':qdate'     => $today,
                ':vtype'     => $body['visit_type'] ?? 'new',
                ':fee'       => $fee,
                ':disc'      => $discount,
                ':net'       => $netFee,
                ':pmode'     => $body['payment_mode'] ?? 'cash',
                ':symp'      => $body['symptoms'] ?? null,
                ':reg_by'    => $user['id']
            ]);

            return ['id' => $id, 'token_number' => $nextToken, 'queue_date' => $today];
        });

        Response::success($visit, 201);
    }

    public function complete(string $id): void {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $prescriptionImage = $body['prescription_image_url'] ?? null;
        $status = empty($body['report_image_urls']) ? 'completed' : 'completed';

        $db = Database::getConnection();
        $stmt = $db->prepare("
            UPDATE visits 
            SET status = :status,
                diagnosis = :diag,
                notes = :notes,
                prescription_image_url = :pimg,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = :id AND clinic_id = :clinic_id
        ");
        $stmt->execute([
            ':status'    => $status,
            ':diag'      => $body['diagnosis'] ?? null,
            ':notes'     => $body['notes'] ?? null,
            ':pimg'      => $prescriptionImage,
            ':id'        => $id,
            ':clinic_id' => $user['clinic_id']
        ]);

        Response::success(['id' => $id, 'status' => $status]);
    }
}
