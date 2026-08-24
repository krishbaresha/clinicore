<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Config\Database;
use CliniCore\Utils\Response;
use CliniCore\Utils\Validator;
use CliniCore\Middleware\AuthMiddleware;
use CliniCore\Services\LedgerService;
use PDO;

class FinanceController {
    public function getCashbook(): void {
        $user = AuthMiddleware::authenticate();
        $whId = $_GET['warehouse_id'] ?? null;
        $date = $_GET['date'] ?? date('Y-m-d');

        $db = Database::getConnection();

        $query = "
            SELECT c.id, c.clinic_id, c.warehouse_id, c.entry_type, c.category, c.amount,
                   c.reference_type, c.reference_id, c.notes, c.created_at,
                   u.name AS created_by_name,
                   w.name AS warehouse_name
            FROM cashbook c
            LEFT JOIN users u ON u.id = c.created_by
            LEFT JOIN warehouses w ON w.id = c.warehouse_id
            WHERE c.clinic_id = :clinic_id AND DATE(c.created_at) = :dt
        ";

        $params = [':clinic_id' => $user['clinic_id'], ':dt' => $date];

        if ($whId) {
            $query .= " AND c.warehouse_id = :wh_id";
            $params[':wh_id'] = $whId;
        }

        $query .= " ORDER BY c.created_at DESC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($entries);
    }

    public function recordExpense(): void {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        Validator::make($body)
            ->required('category', 'Expense category is required')
            ->required('amount', 'Expense amount is required')
            ->numeric('amount')
            ->validateOrFail();

        $amount = (float) $body['amount'];
        if ($amount <= 0) {
            Response::error('INVALID_AMOUNT', 'Amount must be greater than zero.', 422);
        }

        $expense = Database::transaction(function(PDO $db) use ($user, $body, $amount) {
            $id = bin2hex(random_bytes(16));
            $whId = $body['warehouse_id'] ?? $user['assigned_warehouse_id'] ?? 'wh_str';
            $desc = trim((string) ($body['description'] ?? $body['category']));
            $expDate = $body['expense_date'] ?? date('Y-m-d');

            $stmt = $db->prepare("
                INSERT INTO expenses (id, clinic_id, warehouse_id, category, description, amount, payment_mode, paid_to, approved_by, expense_date, created_at)
                VALUES (:id, :clinic_id, :wh_id, :cat, :desc, :amt, :pmode, :paid_to, :user_id, :edate, NOW())
            ");
            $stmt->execute([
                ':id'        => $id,
                ':clinic_id' => $user['clinic_id'],
                ':wh_id'     => $whId,
                ':cat'       => trim((string) $body['category']),
                ':desc'      => $desc,
                ':amt'       => $amount,
                ':pmode'     => $body['payment_mode'] ?? 'cash',
                ':paid_to'   => $body['paid_to'] ?? null,
                ':user_id'   => $user['id'],
                ':edate'     => $expDate
            ]);

            // Post Outflow in Cashbook
            if (($body['payment_mode'] ?? 'cash') === 'cash') {
                LedgerService::postCashbook(
                    $db,
                    $user['clinic_id'],
                    $whId,
                    'out',
                    $body['category'],
                    $amount,
                    'expense',
                    $id,
                    $desc,
                    $user['id']
                );
            }

            return ['id' => $id, 'amount' => $amount];
        });

        Response::success($expense, 201);
    }
}
