<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Config\Database;
use CliniCore\Utils\Response;
use CliniCore\Utils\Validator;
use CliniCore\Middleware\AuthMiddleware;
use CliniCore\Services\StockService;
use PDO;

class B2bSalesController {
    public function getParties(): void {
        $user = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT p.id, p.clinic_id, p.party_code, p.party_name, p.city, p.phone, p.address,
                   p.salesman_id, p.credit_limit, p.current_balance, p.status,
                   s.name AS salesman_name
            FROM parties p
            LEFT JOIN salesmen s ON s.id = p.salesman_id
            WHERE p.clinic_id = :clinic_id AND p.status = 'active'
            ORDER BY p.party_name ASC
        ");
        $stmt->execute([':clinic_id' => $user['clinic_id']]);
        $parties = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($parties);
    }

    public function createParty(): void {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        Validator::make($body)
            ->required('party_code', 'Party Code is required')
            ->required('party_name', 'Party Name is required')
            ->validateOrFail();

        $db = Database::getConnection();
        $id = bin2hex(random_bytes(16));

        $stmt = $db->prepare("
            INSERT INTO parties (id, clinic_id, party_code, party_name, city, phone, address, salesman_id, credit_limit, current_balance, status, created_at)
            VALUES (:id, :clinic_id, :code, :name, :city, :phone, :address, :salesman_id, :credit_limit, :opening_bal, 'active', NOW())
        ");
        $stmt->execute([
            ':id'          => $id,
            ':clinic_id'   => $user['clinic_id'],
            ':code'        => strtoupper(trim((string) $body['party_code'])),
            ':name'        => trim((string) $body['party_name']),
            ':city'        => trim((string) ($body['city'] ?? 'Hyderabad')),
            ':phone'       => $body['phone'] ?? null,
            ':address'     => $body['address'] ?? null,
            ':salesman_id' => $body['salesman_id'] ?? null,
            ':credit_limit'=> (float) ($body['credit_limit'] ?? 0.00),
            ':opening_bal' => (float) ($body['current_balance'] ?? 0.00)
        ]);

        Response::success(['id' => $id, 'party_code' => $body['party_code']], 201);
    }

    public function checkout(): void {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        Validator::make($body)
            ->required('party_id', 'Party selection is required')
            ->required('warehouse_id', 'Warehouse is required')
            ->required('items', 'Invoice items are required')
            ->validateOrFail();

        $items = $body['items'];
        if (!is_array($items) || empty($items)) {
            Response::error('EMPTY_INVOICE', 'Invoice must contain at least 1 item.', 422);
        }

        $sale = Database::transaction(function(PDO $db) use ($user, $body, $items) {
            $saleId = bin2hex(random_bytes(16));
            $invoiceNo = 'B2B-' . rand(1000, 9999) . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));

            $subtotal = (float) ($body['subtotal'] ?? 0.00);
            $tradeDiscPct = (float) ($body['trade_discount_pct'] ?? 0.00);
            $tradeDiscRs = (float) ($body['trade_discount_rs'] ?? 0.00);
            $netTotal = max(0.00, $subtotal - $tradeDiscRs);
            $paidAmount = (float) ($body['paid_amount'] ?? 0.00);
            $dueAmount = max(0.00, $netTotal - $paidAmount);
            $paymentMode = $body['payment_mode'] ?? 'credit';

            // Insert B2B Sale Invoice
            $stmt = $db->prepare("
                INSERT INTO b2b_sales (id, clinic_id, invoice_no, party_id, salesman_id, warehouse_id, cashier_id, subtotal, trade_discount_pct, trade_discount_rs, net_total, paid_amount, due_amount, payment_mode, cheque_no, bank_name, cheque_clearance_date, notes, created_at)
                VALUES (:id, :clinic_id, :inv_no, :party_id, :sm_id, :wh_id, :cashier_id, :sub, :dpct, :drs, :net, :paid, :due, :pmode, :cno, :bname, :cdate, :notes, NOW())
            ");
            $stmt->execute([
                ':id'         => $saleId,
                ':clinic_id'  => $user['clinic_id'],
                ':inv_no'     => $invoiceNo,
                ':party_id'   => $body['party_id'],
                ':sm_id'      => $body['salesman_id'] ?? null,
                ':wh_id'      => $body['warehouse_id'],
                ':cashier_id' => $user['id'],
                ':sub'        => $subtotal,
                ':dpct'       => $tradeDiscPct,
                ':drs'        => $tradeDiscRs,
                ':net'        => $netTotal,
                ':paid'       => $paidAmount,
                ':due'        => $dueAmount,
                ':pmode'      => $paymentMode,
                ':cno'        => $body['cheque_no'] ?? null,
                ':bname'      => $body['bank_name'] ?? null,
                ':cdate'      => $body['cheque_clearance_date'] ?? null,
                ':notes'      => $body['notes'] ?? null
            ]);

            // Insert line items and deduct stock
            $itemStmt = $db->prepare("
                INSERT INTO b2b_sale_items (id, b2b_sale_id, inventory_id, batch_no, expiry_date, qty_boxes, base_units_deducted, box_sale_price, item_discount_pct, line_total)
                VALUES (:id, :sale_id, :inv_id, :batch, :exp, :qty_boxes, :deducted, :box_price, :item_disc, :ltotal)
            ");

            foreach ($items as $item) {
                $baseDeducted = (int) ($item['base_units_deducted'] ?? (($item['qty_boxes'] ?? 1) * 100));

                $itemStmt->execute([
                    ':id'         => bin2hex(random_bytes(16)),
                    ':sale_id'    => $saleId,
                    ':inv_id'     => $item['inventory_id'],
                    ':batch'      => $item['batch_no'] ?? null,
                    ':exp'        => $item['expiry_date'] ?? null,
                    ':qty_boxes'  => (int) ($item['qty_boxes'] ?? 1),
                    ':deducted'   => $baseDeducted,
                    ':box_price'  => (float) ($item['box_sale_price'] ?? 0.00),
                    ':item_disc'  => (float) ($item['item_discount_pct'] ?? 0.00),
                    ':ltotal'     => (float) ($item['line_total'] ?? 0.00)
                ]);

                // Stock deduction
                StockService::deductStock(
                    $db,
                    $user['clinic_id'],
                    $body['warehouse_id'],
                    $item['inventory_id'],
                    $baseDeducted,
                    'b2b_sale',
                    $saleId,
                    "B2B Invoice #{$invoiceNo}",
                    $user['id']
                );
            }

            // Update Party Balance with due amount
            if ($dueAmount > 0) {
                $partyStmt = $db->prepare("UPDATE parties SET current_balance = current_balance + :due, updated_at = NOW() WHERE id = :id");
                $partyStmt->execute([':due' => $dueAmount, ':id' => $body['party_id']]);
            }

            return ['id' => $saleId, 'invoice_no' => $invoiceNo, 'net_total' => $netTotal, 'due_amount' => $dueAmount];
        });

        Response::success($sale, 201);
    }
}
