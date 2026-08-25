<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Config\Database;
use CliniCore\Utils\Response;
use CliniCore\Utils\Validator;
use CliniCore\Middleware\AuthMiddleware;
use CliniCore\Services\StockService;
use CliniCore\Services\LedgerService;
use PDO;

class PosSalesController {
    public function checkout(): void {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        Validator::make($body)
            ->required('items', 'Cart items are required')
            ->required('warehouse_id', 'Warehouse counter is required')
            ->validateOrFail();

        $items = $body['items'];
        if (!is_array($items) || empty($items)) {
            Response::error('EMPTY_CART', 'Cart cannot be empty for checkout.', 422);
        }

        $sale = Database::transaction(function(PDO $db) use ($user, $body, $items) {
            $saleId = bin2hex(random_bytes(16));
            $receiptNo = 'POS-' . rand(1000, 9999) . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));

            $subtotal = (float) ($body['subtotal'] ?? 0.00);
            $discount = (float) ($body['discount_amount'] ?? 0.00);
            $netTotal = max(0.00, $subtotal - $discount);
            $paidAmount = (float) ($body['paid_amount'] ?? $netTotal);
            $changeAmount = max(0.00, $paidAmount - $netTotal);

            $stmt = $db->prepare("
                INSERT INTO pos_sales (id, clinic_id, receipt_no, warehouse_id, cashier_id, linked_visit_id, patient_id, customer_name, customer_phone, subtotal, discount_amount, net_total, paid_amount, change_amount, payment_mode, created_at)
                VALUES (:id, :clinic_id, :rec_no, :wh_id, :cashier_id, :visit_id, :pid, :cname, :cphone, :sub, :disc, :net, :paid, :change, :pmode, NOW())
            ");
            $stmt->execute([
                ':id'         => $saleId,
                ':clinic_id'  => $user['clinic_id'],
                ':rec_no'     => $receiptNo,
                ':wh_id'      => $body['warehouse_id'],
                ':cashier_id' => $user['id'],
                ':visit_id'   => $body['linked_visit_id'] ?? null,
                ':pid'        => $body['patient_id'] ?? null,
                ':cname'      => $body['customer_name'] ?? 'Walk-in Customer',
                ':cphone'     => $body['customer_phone'] ?? null,
                ':sub'        => $subtotal,
                ':disc'       => $discount,
                ':net'        => $netTotal,
                ':paid'       => $paidAmount,
                ':change'     => $changeAmount,
                ':pmode'      => $body['payment_mode'] ?? 'cash'
            ]);

            // Process line items & stock deductions
            $itemStmt = $db->prepare("
                INSERT INTO pos_sale_items (id, sale_id, inventory_id, unit_type_sold, qty_sold, base_units_deducted, unit_price, line_total)
                VALUES (:id, :sale_id, :inv_id, :utype, :qty, :deducted, :uprice, :ltotal)
            ");

            foreach ($items as $item) {
                $baseDeducted = (int) ($item['base_units_deducted'] ?? $item['quantity'] ?? 1);

                $itemStmt->execute([
                    ':id'       => bin2hex(random_bytes(16)),
                    ':sale_id'  => $saleId,
                    ':inv_id'   => $item['inventory_id'],
                    ':utype'    => $item['unit_type'] ?? 'unit',
                    ':qty'      => (int) ($item['quantity'] ?? 1),
                    ':deducted' => $baseDeducted,
                    ':uprice'   => (float) ($item['unit_price'] ?? 0.00),
                    ':ltotal'   => (float) ($item['line_total'] ?? 0.00)
                ]);

                // Atomic Stock Reduction
                StockService::deductStock(
                    $db,
                    $user['clinic_id'],
                    $body['warehouse_id'],
                    $item['inventory_id'],
                    $baseDeducted,
                    'pos_sale',
                    $saleId,
                    "POS Receipt #{$receiptNo}",
                    $user['id']
                );
            }

            // Post to Cashbook if paid in cash
            if (($body['payment_mode'] ?? 'cash') === 'cash' && $paidAmount > 0) {
                LedgerService::postCashbook(
                    $db,
                    $user['clinic_id'],
                    $body['warehouse_id'],
                    'in',
                    'POS Medicine Sale',
                    $netTotal,
                    'pos_sale',
                    $saleId,
                    "POS Receipt #{$receiptNo}",
                    $user['id']
                );
            }

            return ['id' => $saleId, 'receipt_no' => $receiptNo, 'net_total' => $netTotal];
        });

        Response::success($sale, 201);
    }
}
