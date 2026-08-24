<?php
declare(strict_types=1);

namespace ClinicFlow\Controllers;

use ClinicFlow\Config\Database;
use ClinicFlow\Utils\Response;
use ClinicFlow\Utils\Validator;
use ClinicFlow\Middleware\AuthMiddleware;
use PDO;

class PatientController {
    public function search(): void {
        $user = AuthMiddleware::authenticate();
        $q = trim((string) ($_GET['q'] ?? $_GET['search'] ?? ''));

        $db = Database::getConnection();

        if ($q === '') {
            $stmt = $db->prepare("
                SELECT id, clinic_id, mr_number, full_name, relation_name, relation_type, phone, cnic, age, gender, city, created_at
                FROM patients
                WHERE clinic_id = :clinic_id AND deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT 50
            ");
            $stmt->execute([':clinic_id' => $user['clinic_id']]);
        } else {
            // Anti-guess search across phone, full_name, relation_name, mr_number
            $stmt = $db->prepare("
                SELECT id, clinic_id, mr_number, full_name, relation_name, relation_type, phone, cnic, age, gender, city, created_at
                FROM patients
                WHERE clinic_id = :clinic_id AND deleted_at IS NULL AND (
                    phone LIKE :term1 OR 
                    full_name LIKE :term2 OR 
                    relation_name LIKE :term3 OR 
                    mr_number LIKE :term4
                )
                ORDER BY full_name ASC
                LIMIT 50
            ");
            $term = "%{$q}%";
            $stmt->execute([
                ':clinic_id' => $user['clinic_id'],
                ':term1'     => $term,
                ':term2'     => $term,
                ':term3'     => $term,
                ':term4'     => $term
            ]);
        }

        $patients = $stmt->fetchAll(PDO::FETCH_ASSOC);
        Response::success($patients);
    }

    public function create(): void {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        Validator::make($body)
            ->required('full_name', 'Patient Full Name is required')
            ->required('phone', 'Phone Number is required')
            ->validateOrFail();

        $db = Database::getConnection();

        $id = bin2hex(random_bytes(16));
        $mrNumber = 'MR-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));

        $stmt = $db->prepare("
            INSERT INTO patients (id, clinic_id, mr_number, full_name, relation_name, relation_type, phone, cnic, age, gender, address, city, notes, created_at)
            VALUES (:id, :clinic_id, :mr, :name, :rname, :rtype, :phone, :cnic, :age, :gender, :addr, :city, :notes, NOW())
        ");
        $stmt->execute([
            ':id'        => $id,
            ':clinic_id' => $user['clinic_id'],
            ':mr'        => $mrNumber,
            ':name'      => trim((string) $body['full_name']),
            ':rname'     => isset($body['relation_name']) ? trim((string) $body['relation_name']) : null,
            ':rtype'     => $body['relation_type'] ?? 'father',
            ':phone'     => trim((string) $body['phone']),
            ':cnic'      => $body['cnic'] ?? null,
            ':age'       => isset($body['age']) ? (int) $body['age'] : null,
            ':gender'    => $body['gender'] ?? 'male',
            ':addr'      => $body['address'] ?? null,
            ':city'      => $body['city'] ?? 'Hyderabad',
            ':notes'     => $body['notes'] ?? null
        ]);

        Response::success(['id' => $id, 'mr_number' => $mrNumber], 201);
    }
}
