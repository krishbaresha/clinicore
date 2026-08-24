<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Config\Database;
use CliniCore\Utils\Response;
use CliniCore\Utils\Validator;
use CliniCore\Middleware\AuthMiddleware;
use CliniCore\Services\StockService;
use PDO;

class InventoryController {
    public function getAll(): void {
        $user = AuthMiddleware::authenticate();
        $whId = $_GET['warehouse_id'] ?? null;
        $company = $_GET['company'] ?? null;

        $db = Database::getConnection();

        $query = "
            SELECT i.id, i.clinic_id, i.item_code, i.medicine_name, i.company_name, i.category,
                   i.strength, i.has_multi_unit, i.strips_per_box, i.units_per_strip,
                   i.box_label, i.strip_label, i.unit_label, i.box_cost_price,
                   i.box_sale_price, i.strip_sale_price, i.unit_sale_price,
                   i.low_stock_threshold, i.barcode, i.status,
                   COALESCE(ws.total_base_units, 0) AS current_warehouse_stock,
                   (SELECT COALESCE(SUM(total_base_units), 0) FROM warehouse_stocks WHERE inventory_id = i.id) AS total_all_warehouses_stock
            FROM inventory i
            LEFT JOIN warehouse_stocks ws ON ws.inventory_id = i.id AND ws.warehouse_id = :wh_id
            WHERE i.clinic_id = :clinic_id AND i.status = 'active'
        ";

        $params = [
            ':clinic_id' => $user['clinic_id'],
            ':wh_id'     => $whId ?: ($user['assigned_warehouse_id'] ?? 'wh_str')
        ];

        if ($company && $company !== 'All Companies') {
            $query .= " AND i.company_name = :company";
            $params[':company'] = $company;
        }

        $query .= " ORDER BY i.medicine_name ASC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success($items);
    }
}
