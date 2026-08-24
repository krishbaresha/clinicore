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

class PurchaseController {
    public function getSuppliers(): void {
        $user = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT id, clinic_id, name, company_name, phone, address, current_balance, status
            FROM suppliers
            WHERE clinic_id = :clinic_id AND status = 'active'
            ORDER BY name ASC
        ");
        $stmt->execute([':clinic_id' => $user['clinic_id']]);
        $suppliers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($suppliers);
    }

    public function createPurchase(): void {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        Validator::make($body)
            ->required('supplier_id', 'Supplier selection is required')
            ->required('warehouse_id', 'Destination Warehouse is required')
            ->required('items', 'Purchase items are required')
            ->validateOrFail();

        $items = $body['items'];
        if (!is_array($items) || empty($items)) {
            Response::error('EMPTY_PURCHASE', 'Purchase bill must contain at least 1 item.', 422);
        }

        $purchase = Database::transaction(function(PDO $db) use ($user, $body, $items) {
            $purchaseId = bin2hex(random_bytes(16));
            $purchaseNo = 'PUR-' . rand(1000, 9999) . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));

            $subtotal = (float) ($body['subtotal'] ?? 0.00);
            $discount = (float) ($body['discount_amount'] ?? 0.00);
            $netTotal = max(0.00, $subtotal - $discount);
            $paidAmount = (float) ($body['paid_amount'] ?? 0.00);
            $dueAmount = max(0.00, $netTotal - $paidAmount);
            $billDate = $body['bill_date'] ?? date('Y-m-d');

            $stmt = $db->prepare("
                INSERT INTO purchases (id, clinic_id, purchase_no, supplier_id, warehouse_id, bill_no, bill_date, subtotal, discount_amount, net_total, paid_amount, due_amount, payment_mode, notes, received_by, created_at)
                VALUES (:id, :clinic_id, :pno, :sup_id, :wh_id, :bno, :bdate, :sub, :disc, :net, :paid, :due, :pmode, :notes, :user_id, NOW())
            ");
            $stmt->execute([
                ':id'        => $purchaseId,
                ':clinic_id' => $user['clinic_id'],
                ':pno'       => $purchaseNo,
                ':sup_id'    => $body['supplier_id'],
                ':wh_id'     => $body['warehouse_id'],
                ':bno'       => $body['bill_no'] ?? null,
                ':bdate'     => $billDate,
                ':sub'       => $subtotal,
                ':disc'      => $discount,
                ':net'       => $netTotal,
                ':paid'      => $paidAmount,
                ':due'       => $dueAmount,
                ':pmode'     => $body['payment_mode'] ?? 'credit',
                ':notes'     => $body['notes'] ?? null,
                ':user_id'   => $user['id']
            ]);

            // Insert line items & increment stock
            $itemStmt = $db->prepare("
                INSERT INTO purchase_items (id, purchase_id, inventory_id, batch_no, expiry_date, box_qty, strip_qty, unit_qty, total_base_units, cost_price_per_box, line_total)
                VALUES (:id, :pid, :inv_id, :batch, :exp, :bqty, :sqty, :uqty, :tunits, :cost, :ltotal)
            ");

            foreach ($items as $item) {
                $boxQty = (int) ($item['box_qty'] ?? 0);
                $stripQty = (int) ($item['strip_qty'] ?? 0);
                $unitQty = (int) ($item['unit_qty'] ?? 0);
                $totalBaseUnits = (int) ($item['total_base_units'] ?? (($boxQty * 100) + ($stripQty * 10) + $unitQty));

                $itemStmt->execute([
                    ':id'     => bin2hex(random_bytes(16)),
                    ':pid'    => $purchaseId,
                    ':inv_id' => $item['inventory_id'],
                    ':batch'  => $item['batch_no'] ?? null,
                    ':exp'    => $item['expiry_date'] ?? null,
                    ':bqty'   => $boxQty,
                    ':sqty'   => $stripQty,
                    ':uqty'   => $unitQty,
                    ':tunits' => $totalBaseUnits,
                    ':cost'   => (float) ($item['cost_price_per_box'] ?? 0.00),
                    ':ltotal' => (float) ($item['line_total'] ?? 0.00)
                ]);

                // Increment warehouse stock
                StockService::addStock(
                    $db,
                    $user['clinic_id'],
                    $body['warehouse_id'],
                    $item['inventory_id'],
                    $totalBaseUnits,
                    'purchase',
                    $purchaseId,
                    "GRN Purchase #{$purchaseNo}",
                    $user['id']
                );
            }

            // Post Supplier Ledger
            LedgerService::postSupplierLedger(
                $db,
                $user['clinic_id'],
                $body['supplier_id'],
                'purchase_bill',
                $purchaseNo,
                $paidAmount,
                $netTotal,
                "Inward GRN Bill #{$purchaseNo}",
                $user['id']
            );

            return ['id' => $purchaseId, 'purchase_no' => $purchaseNo, 'net_total' => $netTotal];
        });

        Response::success($purchase, 201);
    }
}
