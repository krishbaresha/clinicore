<?php
declare(strict_types=1);

namespace CliniCore\Services;

use PDO;
use Exception;

class StockService {
    /**
     * Deducts base stock from a specific warehouse atomically and records movement.
     */
    public static function deductStock(
        PDO $db,
        string $clinicId,
        string $warehouseId,
        string $inventoryId,
        int $qtyBaseUnits,
        string $movementType,
        ?string $referenceId = null,
        ?string $notes = null,
        ?string $userId = null
    ): void {
        if ($qtyBaseUnits <= 0) return;

        // Fetch and lock current warehouse stock
        $stmt = $db->prepare("
            SELECT total_base_units 
            FROM warehouse_stocks 
            WHERE inventory_id = :inv_id AND warehouse_id = :wh_id 
            FOR UPDATE
        ");
        $stmt->execute([':inv_id' => $inventoryId, ':wh_id' => $warehouseId]);
        $current = $stmt->fetch(PDO::FETCH_ASSOC);

        $currentStock = $current ? (int) $current['total_base_units'] : 0;
        $newStock = $currentStock - $qtyBaseUnits;

        // Update or insert warehouse stock
        if ($current) {
            $updateStmt = $db->prepare("
                UPDATE warehouse_stocks 
                SET total_base_units = :new_stock, updated_at = NOW() 
                WHERE inventory_id = :inv_id AND warehouse_id = :wh_id
            ");
            $updateStmt->execute([':new_stock' => $newStock, ':inv_id' => $inventoryId, ':wh_id' => $warehouseId]);
        } else {
            $insertStmt = $db->prepare("
                INSERT INTO warehouse_stocks (id, inventory_id, warehouse_id, total_base_units, created_at) 
                VALUES (:id, :inv_id, :wh_id, :new_stock, NOW())
            ");
            $insertStmt->execute([
                ':id'        => bin2hex(random_bytes(16)),
                ':inv_id'    => $inventoryId,
                ':wh_id'     => $warehouseId,
                ':new_stock' => $newStock
            ]);
        }

        // Record immutable stock movement log
        $moveStmt = $db->prepare("
            INSERT INTO stock_movements (id, clinic_id, warehouse_id, inventory_id, movement_type, reference_id, qty_change_base_units, balance_after_base_units, notes, created_by, created_at)
            VALUES (:id, :clinic_id, :wh_id, :inv_id, :mtype, :ref, :qty_change, :balance, :notes, :user_id, NOW())
        ");
        $moveStmt->execute([
            ':id'         => bin2hex(random_bytes(16)),
            ':clinic_id'  => $clinicId,
            ':wh_id'      => $warehouseId,
            ':inv_id'     => $inventoryId,
            ':mtype'      => $movementType,
            ':ref'        => $referenceId,
            ':qty_change' => -$qtyBaseUnits,
            ':balance'    => $newStock,
            ':notes'      => $notes,
            ':user_id'    => $userId
        ]);
    }

    /**
     * Adds base stock to a specific warehouse atomically and records movement.
     */
    public static function addStock(
        PDO $db,
        string $clinicId,
        string $warehouseId,
        string $inventoryId,
        int $qtyBaseUnits,
        string $movementType,
        ?string $referenceId = null,
        ?string $notes = null,
        ?string $userId = null
    ): void {
        if ($qtyBaseUnits <= 0) return;

        $stmt = $db->prepare("
            SELECT total_base_units 
            FROM warehouse_stocks 
            WHERE inventory_id = :inv_id AND warehouse_id = :wh_id 
            FOR UPDATE
        ");
        $stmt->execute([':inv_id' => $inventoryId, ':wh_id' => $warehouseId]);
        $current = $stmt->fetch(PDO::FETCH_ASSOC);

        $currentStock = $current ? (int) $current['total_base_units'] : 0;
        $newStock = $currentStock + $qtyBaseUnits;

        if ($current) {
            $updateStmt = $db->prepare("
                UPDATE warehouse_stocks 
                SET total_base_units = :new_stock, updated_at = NOW() 
                WHERE inventory_id = :inv_id AND warehouse_id = :wh_id
            ");
            $updateStmt->execute([':new_stock' => $newStock, ':inv_id' => $inventoryId, ':wh_id' => $warehouseId]);
        } else {
            $insertStmt = $db->prepare("
                INSERT INTO warehouse_stocks (id, inventory_id, warehouse_id, total_base_units, created_at) 
                VALUES (:id, :inv_id, :wh_id, :new_stock, NOW())
            ");
            $insertStmt->execute([
                ':id'        => bin2hex(random_bytes(16)),
                ':inv_id'    => $inventoryId,
                ':wh_id'     => $warehouseId,
                ':new_stock' => $newStock
            ]);
        }

        // Record movement
        $moveStmt = $db->prepare("
            INSERT INTO stock_movements (id, clinic_id, warehouse_id, inventory_id, movement_type, reference_id, qty_change_base_units, balance_after_base_units, notes, created_by, created_at)
            VALUES (:id, :clinic_id, :wh_id, :inv_id, :mtype, :ref, :qty_change, :balance, :notes, :user_id, NOW())
        ");
        $moveStmt->execute([
            ':id'         => bin2hex(random_bytes(16)),
            ':clinic_id'  => $clinicId,
            ':wh_id'      => $warehouseId,
            ':inv_id'     => $inventoryId,
            ':mtype'      => $movementType,
            ':ref'        => $referenceId,
            ':qty_change' => $qtyBaseUnits,
            ':balance'    => $newStock,
            ':notes'      => $notes,
            ':user_id'    => $userId
        ]);
    }
}
