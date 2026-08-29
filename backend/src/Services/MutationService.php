<?php

declare(strict_types=1);

namespace CliniCore\Services;

use PDO;
use Exception;

class MutationService {
    public static function mutate(
        PDO $db,
        string $clinicId,
        string $userId,
        string $entity,
        string $entityId,
        string $operation,
        array $payload
    ): void {
        switch ($entity) {
            case 'patients':
                self::mutatePatient($db, $clinicId, $entityId, $operation, $payload);
                break;
            case 'visits':
                self::mutateVisit($db, $clinicId, $userId, $entityId, $operation, $payload);
                break;
            case 'inventory':
                self::mutateInventory($db, $clinicId, $entityId, $operation, $payload);
                break;
            case 'expenses':
                self::mutateExpense($db, $clinicId, $userId, $entityId, $operation, $payload);
                break;
            case 'pos_sales':
            case 'sales':
                self::mutatePosSale($db, $clinicId, $userId, $entityId, $operation, $payload);
                break;
            case 'b2b_sales':
                self::mutateB2bSale($db, $clinicId, $userId, $entityId, $operation, $payload);
                break;
            case 'purchases':
                self::mutatePurchase($db, $clinicId, $userId, $entityId, $operation, $payload);
                break;
            case 'parties':
                self::mutateParty($db, $clinicId, $entityId, $operation, $payload);
                break;
            case 'suppliers':
                self::mutateSupplier($db, $clinicId, $entityId, $operation, $payload);
                break;
            case 'salesmen':
                self::mutateSalesman($db, $clinicId, $entityId, $operation, $payload);
                break;
            case 'warehouses':
                self::mutateWarehouse($db, $clinicId, $entityId, $operation, $payload);
                break;
            case 'users':
                self::mutateUser($db, $clinicId, $entityId, $operation, $payload);
                break;
            case 'stock_movements':
                self::mutateStockMovement($db, $clinicId, $userId, $entityId, $payload);
                break;
            default:
                // Fallback singleton/app state storage for other config entities
                $saveState = $db->prepare("
                    INSERT INTO app_cloud_state (collection_key, data_json, updated_at)
                    VALUES (:k, :v, NOW())
                    ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = NOW()
                ");
                $saveState->execute([
                    ':k' => "cf_{$entity}_v5",
                    ':v' => json_encode($payload)
                ]);
                break;
        }
    }

    private static function mutatePatient(PDO $db, string $clinicId, string $id, string $op, array $p): void {
        if ($op === 'DELETE') {
            $stmt = $db->prepare("UPDATE patients SET deleted_at = NOW() WHERE id = :id AND clinic_id = :cid");
            $stmt->execute([':id' => $id, ':cid' => $clinicId]);
            return;
        }

        $stmt = $db->prepare("
            INSERT INTO patients (id, clinic_id, mr_number, full_name, relation_name, relation_type, phone, cnic, age, gender, address, city, notes)
            VALUES (:id, :cid, :mr, :name, :rname, :rtype, :phone, :cnic, :age, :gender, :address, :city, :notes)
            ON DUPLICATE KEY UPDATE
                full_name = VALUES(full_name),
                relation_name = VALUES(relation_name),
                relation_type = VALUES(relation_type),
                phone = VALUES(phone),
                cnic = VALUES(cnic),
                age = VALUES(age),
                gender = VALUES(gender),
                address = VALUES(address),
                city = VALUES(city),
                notes = VALUES(notes),
                updated_at = NOW()
        ");

        $stmt->execute([
            ':id'      => $id,
            ':cid'     => $clinicId,
            ':mr'      => $p['mr_number'] ?? ('MR-' . rand(10000, 99999)),
            ':name'    => (string) ($p['full_name'] ?? $p['name'] ?? 'Unnamed'),
            ':rname'   => $p['relation_name'] ?? null,
            ':rtype'   => $p['relation_type'] ?? 'father',
            ':phone'   => (string) ($p['phone'] ?? '03000000000'),
            ':cnic'    => $p['cnic'] ?? null,
            ':age'     => isset($p['age']) ? (int)$p['age'] : null,
            ':gender'  => $p['gender'] ?? 'male',
            ':address' => $p['address'] ?? null,
            ':city'    => $p['city'] ?? 'Hyderabad',
            ':notes'   => $p['notes'] ?? null,
        ]);
    }

    private static function mutateVisit(PDO $db, string $clinicId, string $userId, string $id, string $op, array $p): void {
        if ($op === 'DELETE') {
            $stmt = $db->prepare("DELETE FROM visits WHERE id = :id AND clinic_id = :cid");
            $stmt->execute([':id' => $id, ':cid' => $clinicId]);
            return;
        }

        $stmt = $db->prepare("
            INSERT INTO visits (id, clinic_id, patient_id, doctor_id, token_number, queue_date, status, fee_amount, net_fee, symptoms, diagnosis, notes)
            VALUES (:id, :cid, :pid, :did, :tok, :qdate, :status, :fee, :nfee, :sym, :diag, :notes)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                diagnosis = VALUES(diagnosis),
                symptoms = VALUES(symptoms),
                fee_amount = VALUES(fee_amount),
                net_fee = VALUES(net_fee),
                notes = VALUES(notes),
                updated_at = NOW()
        ");

        $stmt->execute([
            ':id'     => $id,
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

    private static function mutateInventory(PDO $db, string $clinicId, string $id, string $op, array $p): void {
        if ($op === 'DELETE') {
            $stmt = $db->prepare("DELETE FROM inventory WHERE id = :id AND clinic_id = :cid");
            $stmt->execute([':id' => $id, ':cid' => $clinicId]);
            return;
        }

        $stmt = $db->prepare("
            INSERT INTO inventory (id, clinic_id, sku_code, name, generic_name, category, manufacturing_company, box_label, unit_label, units_per_box, purchase_price_box, purchase_price_unit, retail_price_unit, min_reorder_qty, status, notes)
            VALUES (:id, :cid, :sku, :name, :gen, :cat, :mfg, :blabel, :ulabel, :upb, :ppb, :ppu, :rpu, :min_q, :status, :notes)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                sku_code = VALUES(sku_code),
                generic_name = VALUES(generic_name),
                category = VALUES(category),
                manufacturing_company = VALUES(manufacturing_company),
                box_label = VALUES(box_label),
                unit_label = VALUES(unit_label),
                units_per_box = VALUES(units_per_box),
                purchase_price_box = VALUES(purchase_price_box),
                purchase_price_unit = VALUES(purchase_price_unit),
                retail_price_unit = VALUES(retail_price_unit),
                min_reorder_qty = VALUES(min_reorder_qty),
                status = VALUES(status),
                notes = VALUES(notes),
                updated_at = NOW()
        ");

        $stmt->execute([
            ':id'      => $id,
            ':cid'     => $clinicId,
            ':sku'     => $p['sku_code'] ?? '',
            ':name'    => $p['name'] ?? '',
            ':gen'     => $p['generic_name'] ?? null,
            ':cat'     => $p['category'] ?? 'General',
            ':mfg'     => $p['manufacturing_company'] ?? null,
            ':blabel'  => $p['box_label'] ?? 'Packs',
            ':ulabel'  => $p['unit_label'] ?? 'Units',
            ':upb'     => (int) ($p['units_per_box'] ?? 1),
            ':ppb'     => (float) ($p['purchase_price_box'] ?? 0.0),
            ':ppu'     => (float) ($p['purchase_price_unit'] ?? 0.0),
            ':rpu'     => (float) ($p['retail_price_unit'] ?? 0.0),
            ':min_q'   => (int) ($p['min_reorder_qty'] ?? 10),
            ':status'  => $p['status'] ?? 'active',
            ':notes'   => $p['notes'] ?? null
        ]);
    }

    private static function mutateExpense(PDO $db, string $clinicId, string $userId, string $id, string $op, array $p): void {
        if ($op === 'DELETE') {
            $stmt = $db->prepare("DELETE FROM expenses WHERE id = :id AND clinic_id = :cid");
            $stmt->execute([':id' => $id, ':cid' => $clinicId]);
            return;
        }

        $stmt = $db->prepare("
            INSERT INTO expenses (id, clinic_id, warehouse_id, category, description, amount, payment_mode, expense_date)
            VALUES (:id, :cid, :wid, :cat, :desc, :amt, :pmode, :edate)
            ON DUPLICATE KEY UPDATE
                amount = VALUES(amount),
                description = VALUES(description),
                category = VALUES(category),
                expense_date = VALUES(expense_date)
        ");

        $stmt->execute([
            ':id'    => $id,
            ':cid'   => $clinicId,
            ':wid'   => $p['warehouse_id'] ?? null,
            ':cat'   => $p['category'] ?? 'General',
            ':desc'  => $p['description'] ?? 'Expense',
            ':amt'   => (float) ($p['amount'] ?? 0.0),
            ':pmode' => $p['payment_mode'] ?? 'cash',
            ':edate' => $p['date'] ?? $p['expense_date'] ?? date('Y-m-d')
        ]);
    }

    private static function mutatePosSale(PDO $db, string $clinicId, string $userId, string $id, string $op, array $p): void {
        if ($op === 'DELETE') {
            // VOID POS sale logically instead of hard delete
            $stmt = $db->prepare("UPDATE pos_sales SET is_voided = TRUE, voided_by = :uid WHERE id = :id AND clinic_id = :cid");
            $stmt->execute([':uid' => $userId, ':id' => $id, ':cid' => $clinicId]);
            return;
        }

        // Insert POS Sale Master
        $stmt = $db->prepare("
            INSERT INTO pos_sales (id, clinic_id, receipt_no, warehouse_id, cashier_id, linked_visit_id, patient_id, customer_name, customer_phone, subtotal, discount_amount, tax_amount, net_total, paid_amount, change_amount, payment_mode, is_voided, created_at)
            VALUES (:id, :cid, :rno, :wid, :cashier, :visit, :pid, :cname, :cphone, :sub, :disc, :tax, :net, :paid, :change, :pmode, :void, :created)
            ON DUPLICATE KEY UPDATE is_voided = VALUES(is_voided)
        ");

        $stmt->execute([
            ':id'      => $id,
            ':cid'     => $clinicId,
            ':rno'     => $p['receipt_no'] ?? $p['invoice_no'] ?? ('POS-' . rand(10000, 99999)),
            ':wid'     => $p['warehouse_id'] ?? 'wh_str',
            ':cashier' => $p['cashier_id'] ?? $userId,
            ':visit'   => $p['linked_visit_id'] ?? null,
            ':pid'     => $p['patient_id'] ?? null,
            ':cname'   => $p['customer_name'] ?? 'Walk-in Customer',
            ':cphone'  => $p['customer_phone'] ?? null,
            ':sub'     => (float) ($p['subtotal'] ?? 0.0),
            ':disc'    => (float) ($p['discount_amount'] ?? 0.0),
            ':tax'     => (float) ($p['tax_amount'] ?? 0.0),
            ':net'     => (float) ($p['net_total'] ?? 0.0),
            ':paid'    => (float) ($p['paid_amount'] ?? 0.0),
            ':change'  => (float) ($p['change_amount'] ?? 0.0),
            ':pmode'   => $p['payment_mode'] ?? 'Cash',
            ':void'    => !empty($p['is_voided']) ? 1 : 0,
            ':created' => $p['created_at'] ?? date('Y-m-d H:i:s')
        ]);

        // Insert items and adjust stocks atomically via StockService
        if (isset($p['items']) && is_array($p['items'])) {
            $db->prepare("DELETE FROM pos_sale_items WHERE sale_id = :id")->execute([':id' => $id]);
            $itemStmt = $db->prepare("
                INSERT INTO pos_sale_items (id, sale_id, inventory_id, unit_type_sold, qty_sold, base_units_deducted, unit_price, disc_pct, disc_flat, line_total)
                VALUES (:id, :sale_id, :inv_id, :utype, :qty, :deducted, :price, :dpct, :dflat, :total)
            ");

            foreach ($p['items'] as $item) {
                $itemId = bin2hex(random_bytes(16));
                $deducted = (int) ($item['base_units_deducted'] ?? $item['qty_sold'] ?? 1);
                $itemStmt->execute([
                    ':id'      => $itemId,
                    ':sale_id' => $id,
                    ':inv_id'  => $item['inventory_id'],
                    ':utype'   => $item['unit_type_sold'] ?? 'unit',
                    ':qty'     => (int) ($item['qty_sold'] ?? 1),
                    ':deducted'=> $deducted,
                    ':price'   => (float) ($item['unit_price'] ?? 0.0),
                    ':dpct'    => (float) ($item['disc_pct'] ?? 0.0),
                    ':dflat'   => (float) ($item['disc_flat'] ?? 0.0),
                    ':total'   => (float) ($item['line_total'] ?? 0.0)
                ]);

                // Adjust stock on VPS
                StockService::deductStock(
                    $db,
                    $clinicId,
                    $p['warehouse_id'] ?? 'wh_str',
                    $item['inventory_id'],
                    $deducted,
                    'sale',
                    $id,
                    'POS Sale item checkout',
                    $userId
                );
            }
        }
    }

    private static function mutateB2bSale(PDO $db, string $clinicId, string $userId, string $id, string $op, array $p): void {
        $stmt = $db->prepare("
            INSERT INTO b2b_sales (id, clinic_id, invoice_no, party_id, salesman_id, warehouse_id, cashier_id, subtotal, trade_discount_pct, trade_discount_rs, net_total, paid_amount, due_amount, payment_mode, cheque_no, bank_name, cheque_clearance_date, notes, created_at)
            VALUES (:id, :cid, :ino, :pid, :sid, :wid, :cashier, :sub, :dpct, :drs, :net, :paid, :due, :pmode, :cno, :bname, :cdate, :notes, :created)
            ON DUPLICATE KEY UPDATE cashier_id = VALUES(cashier_id)
        ");

        $netTotal = (float) ($p['net_total'] ?? 0.0);
        $paid = (float) ($p['paid_amount'] ?? 0.0);
        $due = $netTotal - $paid;

        $stmt->execute([
            ':id'      => $id,
            ':cid'     => $clinicId,
            ':ino'     => $p['invoice_no'] ?? ('B2B-' . rand(10000, 99999)),
            ':pid'     => $p['party_id'],
            ':sid'     => $p['salesman_id'] ?? null,
            ':wid'     => $p['warehouse_id'] ?? 'wh_str',
            ':cashier' => $userId,
            ':sub'     => (float) ($p['subtotal'] ?? 0.0),
            ':dpct'    => (float) ($p['trade_discount_pct'] ?? 0.0),
            ':drs'     => (float) ($p['trade_discount_rs'] ?? 0.0),
            ':net'     => $netTotal,
            ':paid'    => $paid,
            ':due'     => $due,
            ':pmode'   => $p['payment_mode'] ?? 'Full Cash In Hand',
            ':cno'     => $p['cheque_no'] ?? null,
            ':bname'   => $p['bank_name'] ?? null,
            ':cdate'   => $p['cheque_clearance_date'] ?? null,
            ':notes'   => $p['notes'] ?? null,
            ':created' => $p['created_at'] ?? date('Y-m-d H:i:s')
        ]);

        // Update B2B party balance in MySQL transaction
        if ($p['payment_mode'] === 'Party Udhaar (Credit)') {
            $partyStmt = $db->prepare("UPDATE parties SET current_balance = current_balance + :due WHERE id = :pid");
            $partyStmt->execute([':due' => $due, ':pid' => $p['party_id']]);
        }
    }

    private static function mutatePurchase(PDO $db, string $clinicId, string $userId, string $id, string $op, array $p): void {
        $stmt = $db->prepare("
            INSERT INTO purchases (id, clinic_id, purchase_no, supplier_id, warehouse_id, bill_no, bill_date, subtotal, discount_amount, tax_amount, net_total, paid_amount, due_amount, payment_mode, cheque_no, bank_name, cheque_date, notes, received_by, created_at)
            VALUES (:id, :cid, :pno, :sid, :wid, :bno, :bdate, :sub, :disc, :tax, :net, :paid, :due, :pmode, :cno, :bname, :cdate, :notes, :uid, :created)
        ");

        $net = (float) ($p['net_total'] ?? 0.0);
        $paid = (float) ($p['paid_amount'] ?? 0.0);
        $due = $net - $paid;

        $stmt->execute([
            ':id'      => $id,
            ':cid'     => $clinicId,
            ':pno'     => $p['purchase_no'] ?? ('PUR-' . rand(10000, 99999)),
            ':sid'     => $p['supplier_id'],
            ':wid'     => $p['warehouse_id'] ?? 'wh_str',
            ':bno'     => $p['bill_no'] ?? null,
            ':bdate'   => $p['bill_date'] ?? date('Y-m-d'),
            ':sub'     => (float) ($p['subtotal'] ?? 0.0),
            ':disc'    => (float) ($p['discount_amount'] ?? 0.0),
            ':tax'     => (float) ($p['tax_amount'] ?? 0.0),
            ':net'     => $net,
            ':paid'    => $paid,
            ':due'     => $due,
            ':pmode'   => $p['payment_mode'] ?? 'credit',
            ':cno'     => $p['cheque_no'] ?? null,
            ':bname'   => $p['bank_name'] ?? null,
            ':cdate'   => $p['cheque_date'] ?? null,
            ':notes'   => $p['notes'] ?? null,
            ':uid'     => $userId,
            ':created' => $p['created_at'] ?? date('Y-m-d H:i:s')
        ]);

        // Post supplier ledger & adjust stock
        LedgerService::postSupplierLedger($db, $clinicId, $p['supplier_id'], 'purchase_bill', $p['purchase_no'] ?? $id, 0.0, $due, 'Purchase GRN checkout', $userId);
    }

    private static function mutateParty(PDO $db, string $clinicId, string $id, string $op, array $p): void {
        $stmt = $db->prepare("
            INSERT INTO parties (id, clinic_id, party_code, party_name, city, phone, address, salesman_id, credit_limit, current_balance, status, created_at)
            VALUES (:id, :cid, :code, :name, :city, :phone, :address, :sid, :limit, :bal, :status, NOW())
            ON DUPLICATE KEY UPDATE
                party_name = VALUES(party_name),
                city = VALUES(city),
                phone = VALUES(phone),
                address = VALUES(address)
        ");
        $stmt->execute([
            ':id'      => $id,
            ':cid'     => $clinicId,
            ':code'    => $p['party_code'] ?? ('PTY-' . rand(100, 999)),
            ':name'    => $p['party_name'] ?? 'Generic Party',
            ':city'    => $p['city'] ?? 'Hyderabad',
            ':phone'   => $p['phone'] ?? null,
            ':address' => $p['address'] ?? null,
            ':sid'     => $p['salesman_id'] ?? null,
            ':limit'   => (float) ($p['credit_limit'] ?? 100000.0),
            ':bal'     => (float) ($p['current_balance'] ?? 0.0),
            ':status'  => $p['status'] ?? 'active'
        ]);
    }

    private static function mutateSupplier(PDO $db, string $clinicId, string $id, string $op, array $p): void {
        $stmt = $db->prepare("
            INSERT INTO suppliers (id, clinic_id, name, company_name, phone, address, current_balance, status, created_at)
            VALUES (:id, :cid, :name, :cname, :phone, :address, :bal, :status, NOW())
            ON DUPLICATE KEY UPDATE name = VALUES(name), company_name = VALUES(company_name), phone = VALUES(phone), address = VALUES(address)
        ");
        $stmt->execute([
            ':id'      => $id,
            ':cid'     => $clinicId,
            ':name'    => $p['name'] ?? '',
            ':cname'   => $p['company_name'] ?? null,
            ':phone'   => $p['phone'] ?? null,
            ':address' => $p['address'] ?? null,
            ':bal'     => (float) ($p['current_balance'] ?? 0.0),
            ':status'  => $p['status'] ?? 'active'
        ]);
    }

    private static function mutateSalesman(PDO $db, string $clinicId, string $id, string $op, array $p): void {
        $stmt = $db->prepare("
            INSERT INTO salesmen (id, clinic_id, name, phone, commission_rate, status, created_at)
            VALUES (:id, :cid, :name, :phone, :crate, :status, NOW())
            ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone)
        ");
        $stmt->execute([
            ':id'     => $id,
            ':cid'    => $clinicId,
            ':name'   => $p['name'] ?? '',
            ':phone'  => $p['phone'] ?? null,
            ':crate'  => (float) ($p['commission_rate'] ?? 0.0),
            ':status' => $p['status'] ?? 'active'
        ]);
    }

    private static function mutateWarehouse(PDO $db, string $clinicId, string $id, string $op, array $p): void {
        $stmt = $db->prepare("
            INSERT INTO warehouses (id, clinic_id, name, code, address, status, notes, created_at)
            VALUES (:id, :cid, :name, :code, :address, :status, :notes, NOW())
            ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code), address = VALUES(address)
        ");
        $stmt->execute([
            ':id'      => $id,
            ':cid'     => $clinicId,
            ':name'    => $p['name'] ?? '',
            ':code'    => $p['code'] ?? '',
            ':address' => $p['address'] ?? '',
            ':status'  => $p['status'] ?? 'active',
            ':notes'   => $p['notes'] ?? null
        ]);
    }

    private static function mutateUser(PDO $db, string $clinicId, string $id, string $op, array $p): void {
        $stmt = $db->prepare("
            INSERT INTO users (id, clinic_id, name, display_label, role, phone, email, password_hash, assigned_warehouse_id, is_principal_doctor, status)
            VALUES (:id, :cid, :name, :label, :role, :phone, :email, :phash, :wid, :pdoc, :status)
            ON DUPLICATE KEY UPDATE name = VALUES(name), display_label = VALUES(display_label), role = VALUES(role), email = VALUES(email), password_hash = VALUES(password_hash), status = VALUES(status)
        ");
        $stmt->execute([
            ':id'      => $id,
            ':cid'     => $clinicId,
            ':name'    => $p['name'] ?? '',
            ':label'   => $p['display_label'] ?? $p['name'] ?? '',
            ':role'    => $p['role'] ?? 'staff',
            ':phone'   => $p['phone'] ?? null,
            ':email'   => $p['email'] ?? null,
            ':phash'   => $p['password_hash'] ?? $p['password'] ?? '',
            ':wid'     => $p['assigned_warehouse_id'] ?? null,
            ':pdoc'    => !empty($p['is_principal_doctor']) ? 1 : 0,
            ':status'  => $p['status'] ?? 'active'
        ]);
    }

    private static function mutateStockMovement(PDO $db, string $clinicId, string $userId, string $id, array $p): void {
        $stmt = $db->prepare("
            INSERT INTO stock_movements (id, clinic_id, warehouse_id, inventory_id, movement_type, reference_id, qty_change_base_units, balance_after_base_units, notes, created_by, created_at)
            VALUES (:id, :cid, :wid, :iid, :mtype, :ref, :qty, :bal, :notes, :uid, NOW())
        ");
        $stmt->execute([
            ':id'    => $id,
            ':cid'   => $clinicId,
            ':wid'   => $p['warehouse_id'] ?? $p['destination_location_id'] ?? $p['source_location_id'] ?? 'wh_str',
            ':iid'   => $p['inventory_id'] ?? '',
            ':mtype' => $p['movement_type'] ?? 'adjustment',
            ':ref'   => $p['reference_id'] ?? $p['source_voucher_no'] ?? null,
            ':qty'   => (int) ($p['qty_change_base_units'] ?? $p['qty_base_units'] ?? 0),
            ':bal'   => (int) ($p['balance_after_base_units'] ?? $p['running_balance_snapshot'] ?? 0),
            ':notes' => $p['notes'] ?? null,
            ':uid'   => $userId
        ]);
    }
}
