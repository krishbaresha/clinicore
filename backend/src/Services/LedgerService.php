<?php
declare(strict_types=1);

namespace ClinicFlow\Services;

use PDO;

class LedgerService {
    /**
     * Records a cash in/out entry in the main cashbook.
     */
    public static function postCashbook(
        PDO $db,
        string $clinicId,
        string $warehouseId,
        string $entryType, // 'in' or 'out'
        string $category,
        float $amount,
        ?string $referenceType = null,
        ?string $referenceId = null,
        ?string $notes = null,
        ?string $userId = null
    ): void {
        if ($amount <= 0) return;

        $stmt = $db->prepare("
            INSERT INTO cashbook (id, clinic_id, warehouse_id, entry_type, category, amount, reference_type, reference_id, notes, created_by, created_at)
            VALUES (:id, :clinic_id, :wh_id, :etype, :cat, :amt, :reftype, :refid, :notes, :user_id, NOW())
        ");
        $stmt->execute([
            ':id'        => bin2hex(random_bytes(16)),
            ':clinic_id' => $clinicId,
            ':wh_id'     => $warehouseId,
            ':etype'     => $entryType,
            ':cat'       => $category,
            ':amt'       => $amount,
            ':reftype'   => $referenceType,
            ':refid'     => $referenceId,
            ':notes'     => $notes,
            ':user_id'   => $userId
        ]);
    }

    /**
     * Updates supplier balance and records a ledger transaction.
     */
    public static function postSupplierLedger(
        PDO $db,
        string $clinicId,
        string $supplierId,
        string $entryType, // 'purchase_bill', 'payment_made', 'return_debit'
        string $referenceNo,
        float $debitAmount,
        float $creditAmount,
        ?string $notes = null,
        ?string $userId = null
    ): void {
        // Lock supplier row
        $stmt = $db->prepare("SELECT current_balance FROM suppliers WHERE id = :id FOR UPDATE");
        $stmt->execute([':id' => $supplierId]);
        $current = (float) $stmt->fetchColumn();

        // Credit increases what we owe the supplier, Debit decreases it
        $newBalance = $current + $creditAmount - $debitAmount;

        $updateStmt = $db->prepare("UPDATE suppliers SET current_balance = :bal, updated_at = NOW() WHERE id = :id");
        $updateStmt->execute([':bal' => $newBalance, ':id' => $supplierId]);

        $ledgerStmt = $db->prepare("
            INSERT INTO supplier_ledger (id, clinic_id, supplier_id, entry_type, reference_no, debit_amount, credit_amount, running_balance, notes, created_by, created_at)
            VALUES (:id, :clinic_id, :sup_id, :etype, :ref, :debit, :credit, :bal, :notes, :user_id, NOW())
        ");
        $ledgerStmt->execute([
            ':id'         => bin2hex(random_bytes(16)),
            ':clinic_id'  => $clinicId,
            ':sup_id'     => $supplierId,
            ':etype'      => $entryType,
            ':ref'        => $referenceNo,
            ':debit'      => $debitAmount,
            ':credit'     => $creditAmount,
            ':bal'        => $newBalance,
            ':notes'      => $notes,
            ':user_id'    => $userId
        ]);
    }
}
