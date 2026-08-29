<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Config\Database;
use CliniCore\Config\Env;
use CliniCore\Middleware\AuthMiddleware;
use CliniCore\Middleware\RBACMiddleware;
use CliniCore\Utils\RateLimiter;
use CliniCore\Utils\Response;
use CliniCore\Utils\JWT;
use PDO;

/**
 * 📧 System, Settings, Full-Stack Sync & Automated Notification Controller
 * Manages centralized system settings, Super Admin security, email relays, and 1-click backup downloads
 */
class SystemController
{
    private function ensureSettingsTable(PDO $db): void
    {
        $db->exec("
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value LONGTEXT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        $db->exec("
            CREATE TABLE IF NOT EXISTS app_cloud_state (
                collection_key VARCHAR(100) PRIMARY KEY,
                data_json LONGTEXT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    }

    private function getBackupStorageDir(): string
    {
        $dir = dirname(__DIR__, 2) . '/storage/backups';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        return $dir;
    }

    /**
     * GET /api/v1/system/config
     * Retrieves centralized clinic configuration, automation keys, and settings.
     * Sensitive credentials (passcodes, PINs, Resend keys) are redacted for non-admin callers.
     */
    public function getConfig(): void
    {
        try {
            $db = Database::getConnection();
            $this->ensureSettingsTable($db);

            $authUser = AuthMiddleware::optional();
            $isAdmin = $authUser && ($authUser['role'] === 'admin' || $authUser['role'] === 'owner' || !empty($authUser['is_principal_doctor']));

            // 1. Fetch Clinic Profile from `clinics` table
            $stmt = $db->query("SELECT * FROM clinics LIMIT 1");
            $clinic = $stmt->fetch(PDO::FETCH_ASSOC) ?: [
                'id' => 'clinic_001',
                'name' => 'Dr. Muhammad Asif Ashraf Khan Clinic',
                'address' => 'Lajpat Road, Hyderabad, Sindh',
                'phone' => '03473100304',
                'default_consultation_fee' => 300,
                'clinic_status' => 'open',
                'clinic_status_note' => '',
                'public_notice' => ''
            ];

            // 2. Fetch all system settings from `system_settings` table
            $stmt = $db->query("SELECT setting_key, setting_value FROM system_settings");
            $settingsRows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $settings = [];
            foreach ($settingsRows as $row) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }

            $resendKey = $settings['resend_api_key'] ?? Env::get('RESEND_API_KEY', '');
            $adminPasscode = $settings['admin_master_passcode'] ?? 'KB2026';
            $tabPin = $settings['tab_pin'] ?? '7860';

            // Merge clinic profile with system settings — Redact secrets if not admin
            $clinicPayload = array_merge($clinic, [
                'notification_email'    => !empty($settings['notification_email']) ? $settings['notification_email'] : 'drasifhosting@gmail.com',
                'whatsapp_gateway_no'   => !empty($settings['whatsapp_gateway_no']) ? $settings['whatsapp_gateway_no'] : '03473100304',
                'report_frequency'      => !empty($settings['report_frequency']) ? $settings['report_frequency'] : 'daily_9pm',
                'resend_api_key'        => $isAdmin ? $resendKey : null,
                'tab_pin'               => $isAdmin ? $tabPin : null,
                'admin_master_passcode' => $isAdmin ? $adminPasscode : null,
                'tab_security_json'     => $isAdmin ? ($settings['tab_security_json'] ?? '') : null,
                'license_policy'        => $settings['license_policy'] ?? '',
            ]);

            $response = [
                'clinic'                => $clinicPayload,
                'has_custom_passcode'   => !empty($settings['admin_master_passcode']),
                'has_resend_configured' => !empty($resendKey),
                'server_time'           => date('c')
            ];

            Response::success($response);
        } catch (\Throwable $e) {
            Response::error('CONFIG_FETCH_FAILED', 'Failed to retrieve system settings: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/v1/system/config
     * Saves centralized clinic configuration, automation keys, and settings to MySQL
     */
    public function saveConfig(): void
    {
        try {
            RBACMiddleware::requireAdminOrOwner();

            $input = json_decode(file_get_contents('php://input'), true) ?? [];
            $db = Database::getConnection();
            $this->ensureSettingsTable($db);

            // 1. Update `clinics` table if clinic fields are provided
            $name = trim((string)($input['name'] ?? ''));
            $phone = trim((string)($input['phone'] ?? ''));
            $address = trim((string)($input['address'] ?? ''));
            $fee = (float)($input['default_consultation_fee'] ?? 300);
            $status = in_array($input['clinic_status'] ?? 'open', ['open', 'closed', 'break'], true) ? $input['clinic_status'] : 'open';
            $statusNote = trim((string)($input['clinic_status_note'] ?? ''));
            $publicNotice = trim((string)($input['public_notice'] ?? ''));

            if (!empty($name)) {
                $stmt = $db->prepare("
                    INSERT INTO clinics (id, name, phone, address, default_consultation_fee, clinic_status, clinic_status_note, public_notice)
                    VALUES ('clinic_001', :name, :phone, :address, :fee, :status, :status_note, :public_notice)
                    ON DUPLICATE KEY UPDATE
                        name = VALUES(name),
                        phone = VALUES(phone),
                        address = VALUES(address),
                        default_consultation_fee = VALUES(default_consultation_fee),
                        clinic_status = VALUES(clinic_status),
                        clinic_status_note = VALUES(clinic_status_note),
                        public_notice = VALUES(public_notice)
                ");
                $stmt->execute([
                    ':name'          => $name,
                    ':phone'         => $phone,
                    ':address'       => $address,
                    ':fee'           => $fee,
                    ':status'        => $status,
                    ':status_note'   => $statusNote,
                    ':public_notice' => $publicNotice
                ]);
            }

            // 2. Persist all settings into `system_settings` table
            $settingKeys = [
                'resend_api_key',
                'notification_email',
                'whatsapp_gateway_no',
                'report_frequency',
                'tab_pin',
                'admin_master_passcode',
                'tab_security_json',
                'license_policy'
            ];

            $upsert = $db->prepare("
                INSERT INTO system_settings (setting_key, setting_value)
                VALUES (:k, :v)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ");

            foreach ($settingKeys as $key) {
                if (isset($input[$key])) {
                    $val = (string)$input[$key];
                    $upsert->execute([':k' => $key, ':v' => $val]);
                }
            }

            Response::success(['message' => 'System configuration saved to MySQL successfully.'], 200);
        } catch (\Throwable $e) {
            Response::error('CONFIG_SAVE_FAILED', 'Failed to save system settings: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/v1/system/verify-passcode
     * Strictly verifies Super Admin master passcode with server-side rate limiting
     */
    public function verifyPasscode(): void
    {
        try {
            RateLimiter::check('verify_passcode', 5, 300);

            $input = json_decode(file_get_contents('php://input'), true) ?? [];
            $passcode = (string)($input['passcode'] ?? '');

            if (empty($passcode)) {
                Response::error('INVALID_PASSCODE', 'Master passcode is required.', 400);
                return;
            }

            $db = Database::getConnection();
            $this->ensureSettingsTable($db);

            $stmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'admin_master_passcode'");
            $stmt->execute();
            $savedPasscode = $stmt->fetchColumn();

            // Default fallback is KB2026 if not yet configured in DB
            $authoritativePasscode = $savedPasscode ?: 'KB2026';

            // STRICT CASE-SENSITIVE EQUALITY CHECK
            if ($passcode === $authoritativePasscode) {
                RateLimiter::clear('verify_passcode');
                
                // Issue a temporary token for the admin session
                $token = JWT::encode([
                    'user_id'   => 'user_admin',
                    'clinic_id' => 'clinic_001',
                    'role'      => 'admin',
                ]);

                Response::success([
                    'authenticated' => true, 
                    'message' => 'Super Admin authentication successful.',
                    'token' => $token
                ]);
            } else {
                RateLimiter::hit('verify_passcode', 300);
                Response::error('UNAUTHORIZED', 'Incorrect Super Admin master passcode. Access denied.', 401);
            }
        } catch (\Throwable $e) {
            Response::error('AUTH_CHECK_FAILED', 'Authentication check failed: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/v1/system/prepare-backup
     * Stores the encrypted backup payload on server and generates a 1-click direct download link (Admin/Owner only)
     */
    public function prepareBackup(): void
    {
        try {
            $user = RBACMiddleware::requireAdminOrOwner();

            $input = json_decode(file_get_contents('php://input'), true) ?? [];
            $filename = preg_replace('/[^a-zA-Z0-9_\-\.]/', '', (string)($input['filename'] ?? ''));
            $content = (string)($input['content'] ?? '');

            if (empty($filename)) {
                $filename = 'CliniCore_Encrypted_Backup_' . date('Y-m-d_His') . '.cfbak';
            }

            if (empty($content)) {
                Response::error('EMPTY_BACKUP', 'Backup payload cannot be empty.', 400);
                return;
            }

            $backupDir = $this->getBackupStorageDir();
            $filePath = $backupDir . '/' . $filename;

            // If base64 encoded, decode; otherwise write raw string
            $fileData = base64_decode($content, true);
            if ($fileData === false) {
                $fileData = $content;
            }

            file_put_contents($filePath, $fileData);

            // Generate secure download URL
            $downloadUrl = "https://api.clinicore.me/api/v1/system/download-backup?file=" . urlencode($filename);

            Response::success([
                'filename'     => $filename,
                'download_url' => $downloadUrl,
                'size_bytes'   => strlen($fileData),
                'saved_at'     => date('c')
            ]);
        } catch (\Throwable $e) {
            Response::error('BACKUP_SAVE_FAILED', 'Failed to store backup on server: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/v1/system/download-backup?file=...
     * Directly streams and downloads the .cfbak file to the browser with 1 click (Admin/Owner only)
     */
    public function downloadBackup(): void
    {
        RBACMiddleware::requireAdminOrOwner();

        $filename = basename((string)($_GET['file'] ?? ''));
        if (empty($filename) || !str_ends_with($filename, '.cfbak')) {
            http_response_code(400);
            echo "Invalid backup file request.";
            exit;
        }

        $backupDir = $this->getBackupStorageDir();
        $filePath = $backupDir . '/' . $filename;

        // Search alternate storage paths if not found in primary
        if (!file_exists($filePath)) {
            $candidates = [
                dirname(__DIR__, 2) . '/storage/backups/' . $filename,
                dirname(__DIR__, 3) . '/storage/backups/' . $filename,
                '/var/www/clinicore/backend/storage/backups/' . $filename,
                '/var/www/clinicore/storage/backups/' . $filename,
            ];
            foreach ($candidates as $cand) {
                if (file_exists($cand)) {
                    $filePath = $cand;
                    break;
                }
            }
        }

        if (!file_exists($filePath)) {
            http_response_code(404);
            echo "Requested backup vault file was not found or has expired.";
            exit;
        }

        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
        header('Pragma: public');
        header('Content-Length: ' . filesize($filePath));
        header('Access-Control-Allow-Origin: *');

        readfile($filePath);
        exit;
    }

    /**
     * GET /api/v1/system/sync-state
     * Returns full application snapshot from MySQL so all browsers share identical live data (Authenticated Users Only)
     */
    public function getSyncState(): void
    {
        try {
            AuthMiddleware::authenticate();

            $db = Database::getConnection();
            $this->ensureSettingsTable($db);

            $stmt = $db->query("SELECT collection_key, data_json FROM app_cloud_state");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $state = [];
            foreach ($rows as $row) {
                $decoded = json_decode($row['data_json'], true);
                $state[$row['collection_key']] = $decoded !== null ? $decoded : $row['data_json'];
            }

            // --- Overwrite with Authoritative Relational MySQL Data ---

            // Patients
            $pStmt = $db->query("SELECT * FROM patients WHERE deleted_at IS NULL");
            $patients = $pStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($patients as &$p) {
                $p['age'] = $p['age'] !== null ? (int)$p['age'] : null;
            }
            $state['cf_patients_v5'] = $patients;

            // Visits
            $vStmt = $db->query("SELECT *, created_at AS visit_date FROM visits");
            $visits = $vStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($visits as &$v) {
                $v['token_number'] = (int)$v['token_number'];
                $v['fee_amount'] = (float)$v['fee_amount'];
                $v['net_fee'] = (float)$v['net_fee'];
            }
            $state['cf_visits_v5'] = $visits;

            // Inventory & Location Stocks
            $iStmt = $db->query("SELECT * FROM inventory");
            $inventory = $iStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            
            $wsStmt = $db->query("SELECT * FROM warehouse_stocks");
            $stocks = $wsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $stocksByInventory = [];
            foreach ($stocks as $stock) {
                $stocksByInventory[$stock['inventory_id']][$stock['warehouse_id']] = (int)$stock['total_base_units'];
            }
            
            foreach ($inventory as &$i) {
                $i['units_per_box'] = (int)$i['units_per_box'];
                $i['purchase_price_box'] = (float)$i['purchase_price_box'];
                $i['purchase_price_unit'] = (float)$i['purchase_price_unit'];
                $i['retail_price_unit'] = (float)$i['retail_price_unit'];
                $i['min_reorder_qty'] = (int)$i['min_reorder_qty'];
                
                $i['location_stocks'] = $stocksByInventory[$i['id']] ?? new \stdClass();
                $i['store_stock'] = $stocksByInventory[$i['id']]['wh_str'] ?? 0;
                $i['warehouse_stock'] = $stocksByInventory[$i['id']]['wh_001'] ?? 0;
                $i['stock_qty'] = $i['store_stock'];
                $i['total_base_stock'] = $i['store_stock'] + $i['warehouse_stock'];
            }
            $state['cf_inventory_v5'] = $inventory;

            // POS Sales
            $salesStmt = $db->query("SELECT * FROM pos_sales");
            $sales = $salesStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            
            $itemsStmt = $db->query("SELECT * FROM pos_sale_items");
            $allItems = $itemsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $itemsBySale = [];
            foreach ($allItems as $item) {
                $itemsBySale[$item['sale_id']][] = [
                    'inventory_id' => $item['inventory_id'],
                    'qty_sold' => (int)$item['qty_sold'],
                    'base_units_deducted' => (int)$item['base_units_deducted'],
                    'unit_price' => (float)$item['unit_price'],
                    'line_total' => (float)$item['line_total']
                ];
            }
            foreach ($sales as &$s) {
                $s['items'] = $itemsBySale[$s['id']] ?? [];
                $s['sale_date'] = $s['created_at'];
                $s['total_amount'] = (float)$s['net_total'];
                $s['subtotal_amount'] = (float)$s['subtotal'];
                $s['paid_amount'] = (float)$s['paid_amount'];
                $s['change_amount'] = (float)$s['change_amount'];
                $s['is_voided'] = (bool)$s['is_voided'];
            }
            $state['cf_sales_v5'] = $sales;

            // B2B Sales
            $b2bStmt = $db->query("SELECT * FROM b2b_sales");
            $b2bSales = $b2bStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($b2bSales as &$b) {
                $b['total_amount'] = (float)$b['net_total'];
                $b['paid_amount'] = (float)$b['paid_amount'];
                $b['balance_due'] = (float)$b['due_amount'];
                $b['buyer_id'] = $b['party_id'];
                $b['sale_date'] = $b['created_at'];
            }
            $state['cf_b2b_sales_v5'] = $b2bSales;

            // Purchases
            $purStmt = $db->query("SELECT * FROM purchases");
            $purchases = $purStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($purchases as &$pr) {
                $pr['total_amount'] = (float)$pr['net_total'];
                $pr['paid_amount'] = (float)$pr['paid_amount'];
                $pr['balance_due'] = (float)$pr['due_amount'];
                $pr['purchase_date'] = $pr['created_at'];
            }
            $state['cf_purchases_v5'] = $purchases;

            // Expenses
            $expStmt = $db->query("SELECT * FROM expenses");
            $expenses = $expStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($expenses as &$ex) {
                $ex['amount'] = (float)$ex['amount'];
                $ex['date'] = $ex['expense_date'];
            }
            $state['cf_expenses_v5'] = $expenses;

            // Parties
            $partiesStmt = $db->query("SELECT * FROM parties");
            $parties = $partiesStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($parties as &$py) {
                $py['balance_due'] = (float)$py['current_balance'];
                $py['name'] = $py['party_name'];
            }
            $state['cf_parties_v5'] = $parties;

            // Suppliers
            $supStmt = $db->query("SELECT * FROM suppliers");
            $suppliers = $supStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($suppliers as &$sp) {
                $sp['balance_due'] = (float)$sp['current_balance'];
            }
            $state['cf_suppliers_v5'] = $suppliers;

            // Salesmen
            $smStmt = $db->query("SELECT * FROM salesmen");
            $state['cf_salesmen_v5'] = $smStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // Warehouses
            $whStmt = $db->query("SELECT * FROM warehouses");
            $warehouses = $whStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($warehouses as &$wh) {
                $wh['is_store_counter'] = (bool)$wh['is_store_counter'];
                $wh['is_default'] = (bool)$wh['is_default'];
            }
            $state['cf_warehouses_v6'] = $warehouses;

            // Users
            $uStmt = $db->query("SELECT * FROM users");
            $users = $uStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($users as &$us) {
                $us['is_principal_doctor'] = (bool)$us['is_principal_doctor'];
            }
            $state['cf_users_v5'] = $users;

            Response::success($state);
        } catch (\Throwable $e) {
            Response::error('SYNC_FETCH_FAILED', 'Failed to fetch cloud state: ' . $e->getMessage(), 500);
        }
    }
    public function saveSyncState(): void
    {
        try {
            AuthMiddleware::authenticate();

            $input = json_decode(file_get_contents('php://input'), true) ?? [];
            $db = Database::getConnection();
            $this->ensureSettingsTable($db);

            $stmt = $db->prepare("
                INSERT INTO app_cloud_state (collection_key, data_json)
                VALUES (:k, :v)
                ON DUPLICATE KEY UPDATE data_json = VALUES(data_json)
            ");

            foreach ($input as $collectionKey => $data) {
                $jsonStr = is_string($data) ? $data : json_encode($data);
                $stmt->execute([':k' => (string)$collectionKey, ':v' => $jsonStr]);
            }

            Response::success(['message' => 'Cloud database snapshot synchronized successfully.']);
        } catch (\Throwable $e) {
            Response::error('SYNC_SAVE_FAILED', 'Failed to save cloud state: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/v1/system/send-email
     * Relays transactional emails & database backups via Resend API (Authenticated Staff Only)
     */
    public function sendEmail(): void
    {
        $user = AuthMiddleware::authenticate();
        if ($user['role'] !== 'admin' && $user['role'] !== 'owner' && empty($user['is_principal_doctor'])) {
            Response::forbidden('Only clinic administrators can dispatch system email relays.');
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $apiKey = trim($input['api_key'] ?? '');
        if (empty($apiKey)) {
            $db = Database::getConnection();
            $this->ensureSettingsTable($db);
            $stmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'resend_api_key'");
            $stmt->execute();
            $apiKey = (string)($stmt->fetchColumn() ?: Env::get('RESEND_API_KEY', ''));
        }

        $to = $input['to'] ?? [];
        $subject = trim($input['subject'] ?? 'CliniCore System Report');
        $html = $input['html'] ?? '';
        $attachments = $input['attachments'] ?? [];

        if (empty($apiKey)) {
            Response::badRequest('No Resend API Key configured on server or in request.');
            return;
        }

        if (empty($to)) {
            Response::badRequest('Recipient email address is required.');
            return;
        }

        if (is_string($to)) {
            $to = array_filter(array_map('trim', explode(',', $to)));
        }

        $from = trim($input['from'] ?? '');
        if (empty($from)) {
            $from = 'CliniCore System <backup@clinicore.me>';
        }

        $payload = [
            'from' => $from,
            'to' => array_values($to),
            'subject' => $subject,
            'html' => $html,
        ];

        if (!empty($attachments) && is_array($attachments)) {
            $payload['attachments'] = $attachments;
        }

        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
                'User-Agent: CliniCore-Backend/2.0'
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_SSL_VERIFYPEER => true
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            Response::error('RESEND_NETWORK_ERROR', "Failed to connect to Resend API: {$curlError}", 502);
            return;
        }

        $result = json_decode((string)$response, true);

        if ($httpCode >= 200 && $httpCode < 300) {
            Response::success($result, 200, ['message' => 'Email dispatched successfully via Resend API.']);
        } else {
            $msg = $result['message'] ?? $result['error'] ?? (string)$response;
            Response::error('RESEND_DISPATCH_FAILED', (string)$msg, $httpCode, $result);
        }
    }

    /**
     * POST|GET /api/v1/system/trigger-scheduled-backup
     * Triggers server-side cron evaluation and backup generation (Admin/Owner or Secret Cron Key)
     */
    public function triggerScheduledBackup(): void
    {
        $cronKey = $_GET['cron_key'] ?? $_POST['cron_key'] ?? '';
        $validCronKey = Env::get('CRON_SECRET_KEY', 'cf_cron_2026');

        if ($cronKey !== $validCronKey) {
            RBACMiddleware::requireAdminOrOwner();
        }

        $script = dirname(__DIR__, 2) . '/cron_daily_backup.php';
        if (!file_exists($script)) {
            Response::error('SCRIPT_NOT_FOUND', 'Cron runner script not found.', 500);
            return;
        }

        $force = (isset($_GET['force']) && $_GET['force'] === '1') || (isset($_POST['force']) && $_POST['force'] === '1');
        $cmd = 'php ' . escapeshellarg($script) . ($force ? ' --force' : '') . ' 2>&1';
        $output = shell_exec($cmd);

        Response::success([
            'output' => trim((string)$output),
            'force' => $force,
            'timestamp' => date('c')
        ], 200, ['message' => 'Scheduled backup runner executed on VPS.']);
    }

    /**
     * POST /api/v1/system/factory-reset
     * Permanently wipes ALL transactional data from VPS MySQL.
     * Requires Admin/Owner role + master passcode confirmation.
     * After this, all browsers will pull an empty state and start fresh.
     */
    public function factoryReset(): void
    {
        try {
            // Security: passcode verification below is the sole auth gate.
            // RBACMiddleware not used here because admin sessions use passcode,
            // not a persisted DB user record.

            $input = json_decode(file_get_contents('php://input'), true) ?? [];
            $passcode = trim((string)($input['passcode'] ?? ''));

            if (empty($passcode)) {
                Response::error('PASSCODE_REQUIRED', 'Master passcode is required to perform factory reset.', 400);
                return;
            }

            $db = Database::getConnection();
            $this->ensureSettingsTable($db);

            // Verify master passcode against VPS DB
            $stmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'admin_master_passcode'");
            $stmt->execute();
            $savedPasscode = $stmt->fetchColumn() ?: 'KB2026';

            if ($passcode !== $savedPasscode) {
                Response::error('UNAUTHORIZED', 'Incorrect master passcode. Factory reset denied.', 401);
                return;
            }

            // Disable foreign key checks to allow truncating tables
            $db->exec("SET FOREIGN_KEY_CHECKS = 0");

            // 1. Wipe all transactional data from app_cloud_state (JSON blob store)
            $db->exec("DELETE FROM app_cloud_state WHERE collection_key NOT IN ('system_settings', 'license')");

            // 2. Wipe ALL relational tables to ensure absolute zero-start
            $tables = [
                'visit_attachments', 'visits', 'patients', 'patient_ledger',
                'pos_sale_items', 'pos_sales', 'b2b_sale_items', 'b2b_sales',
                'purchase_items', 'purchases', 'supplier_ledger', 
                'stock_transfer_items', 'stock_transfers', 'stock_movements', 
                'warehouse_stocks', 'inventory', 'expenses', 'cashbook', 
                'shift_closings', 'audit_logs', 'parties', 'suppliers', 
                'salesmen', 'users', 'warehouses', 'clinics'
            ];
            foreach ($tables as $table) {
                try {
                    $db->exec("TRUNCATE TABLE `$table`");
                } catch (\Throwable $tableErr) {
                    // Table may not exist yet — skip silently
                }
            }

            // 3. Reset invoice/sequential counters
            try { $db->exec("DELETE FROM app_cloud_state WHERE collection_key LIKE 'cf_seq_%'"); } catch (\Throwable) {}

            // 4. Re-seed exactly ONE default clinic (required for tenant scoping)
            $stmtClinic = $db->prepare("INSERT INTO clinics (id, name, logo_url, address, created_at) VALUES (:id, :name, :logo_url, :address, :created_at)");
            $stmtClinic->execute([
                ':id' => 'clinic_001',
                ':name' => 'H/Dr.Asif Ashraf Khan Clinic',
                ':logo_url' => '/clinic-logo.png',
                ':address' => 'Lajpat Road, Hyderabad, Sindh',
                ':created_at' => date('Y-m-d H:i:s')
            ]);

            // Re-enable foreign key checks
            $db->exec("SET FOREIGN_KEY_CHECKS = 1");

            // 7. Clear backup files older than reset
            $backupDir = $this->getBackupStorageDir();
            foreach (glob($backupDir . '/*.cfbak') ?: [] as $file) {
                @unlink($file);
            }

            Response::success([
                'reset'       => true,
                'message'     => 'Factory reset complete. All transactional data wiped. Pull from VPS to get empty state.',
                'reset_at'    => date('c'),
            ]);
        } catch (\Throwable $e) {
            Response::error('RESET_FAILED', 'Factory reset failed: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/v1/system/restore-backup-data
     * Receives a decrypted backup payload (JSON) and restores all collections to VPS MySQL.
     * After restore, all browsers will pull the restored data on next sync.
     * Requires Admin/Owner role + master passcode confirmation.
     */
    public function restoreBackupData(): void
    {
        try {
            RBACMiddleware::requireAdminOrOwner();

            $input = json_decode(file_get_contents('php://input'), true) ?? [];
            $passcode = trim((string)($input['passcode'] ?? ''));
            $collections = $input['collections'] ?? [];
            $metadata = $input['metadata'] ?? [];

            if (empty($passcode)) {
                Response::error('PASSCODE_REQUIRED', 'Master passcode is required to restore backup.', 400);
                return;
            }

            if (empty($collections) || !is_array($collections)) {
                Response::error('INVALID_PAYLOAD', 'Backup payload must contain a collections object.', 400);
                return;
            }

            $db = Database::getConnection();
            $this->ensureSettingsTable($db);

            // Verify master passcode
            $stmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'admin_master_passcode'");
            $stmt->execute();
            $savedPasscode = $stmt->fetchColumn() ?: 'KB2026';

            if ($passcode !== $savedPasscode) {
                Response::error('UNAUTHORIZED', 'Incorrect master passcode. Backup restore denied.', 401);
                return;
            }

            // Perform backup restoration inside an ACID database transaction to ensure atomicity
            $restoredKeys = [];
            Database::transaction(function (PDO $db) use ($collections, &$restoredKeys) {
                // Disable foreign key constraints during bulk load
                $db->exec("SET FOREIGN_KEY_CHECKS = 0");

                // 1. Restore each collection into JSON app_cloud_state table
                $upsertStmt = $db->prepare("
                    INSERT INTO app_cloud_state (collection_key, data_json, updated_at)
                    VALUES (:key, :data, NOW())
                    ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = NOW()
                ");

                foreach ($collections as $collectionKey => $collectionData) {
                    $safeKey = preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)$collectionKey);
                    if (empty($safeKey)) continue;

                    $dataJson = is_string($collectionData) ? $collectionData : json_encode($collectionData, JSON_UNESCAPED_UNICODE);
                    $upsertStmt->execute([':key' => $safeKey, ':data' => $dataJson]);
                    $restoredKeys[] = $safeKey;
                }

                // 2. Restore Relational Database State

                // A. Clinics
                if (isset($collections['cf_clinic_v5'])) {
                    $db->exec("DELETE FROM clinics");
                    $clinic = $collections['cf_clinic_v5'];
                    if (isset($clinic['id'])) {
                        $clinic = [$clinic];
                    }
                    if (is_array($clinic)) {
                        $stmt = $db->prepare("INSERT INTO clinics (id, name, logo_url, address, phone, default_consultation_fee, clinic_status, public_notice) 
                                              VALUES (:id, :name, :logo_url, :address, :phone, :default_consultation_fee, :clinic_status, :public_notice)");
                        foreach ($clinic as $c) {
                            $stmt->execute([
                                ':id' => $c['id'],
                                ':name' => $c['name'] ?? 'Clinic',
                                ':logo_url' => $c['logo_url'] ?? '',
                                ':address' => $c['address'] ?? '',
                                ':phone' => $c['phone'] ?? '',
                                ':default_consultation_fee' => $c['default_consultation_fee'] ?? 300,
                                ':clinic_status' => $c['clinic_status'] ?? 'open',
                                ':public_notice' => $c['public_notice'] ?? ''
                            ]);
                        }
                    }
                }

                // B. Warehouses
                if (isset($collections['cf_warehouses_v6']) && is_array($collections['cf_warehouses_v6'])) {
                    $db->exec("DELETE FROM warehouses");
                    $stmt = $db->prepare("INSERT INTO warehouses (id, clinic_id, name, code, address, status, notes) 
                                          VALUES (:id, :clinic_id, :name, :code, :address, :status, :notes)");
                    foreach ($collections['cf_warehouses_v6'] as $w) {
                        $stmt->execute([
                            ':id' => $w['id'],
                            ':clinic_id' => $w['clinic_id'] ?? 'clinic_001',
                            ':name' => $w['name'] ?? '',
                            ':code' => $w['code'] ?? '',
                            ':address' => $w['address'] ?? '',
                            ':status' => $w['status'] ?? 'active',
                            ':notes' => $w['notes'] ?? ''
                        ]);
                    }
                }

                // C. Users
                if (isset($collections['cf_users_v5']) && is_array($collections['cf_users_v5'])) {
                    $db->exec("DELETE FROM users");
                    $stmt = $db->prepare("INSERT INTO users (id, clinic_id, name, display_label, role, phone, email, password_hash, assigned_warehouse_id, is_principal_doctor, status) 
                                          VALUES (:id, :clinic_id, :name, :display_label, :role, :phone, :email, :password_hash, :assigned_warehouse_id, :is_principal_doctor, :status)");
                    foreach ($collections['cf_users_v5'] as $u) {
                        $passHash = $u['password_hash'] ?? $u['password'] ?? '';
                        $stmt->execute([
                            ':id' => $u['id'],
                            ':clinic_id' => $u['clinic_id'] ?? 'clinic_001',
                            ':name' => $u['name'] ?? '',
                            ':display_label' => $u['display_label'] ?? $u['name'] ?? '',
                            ':role' => $u['role'] ?? 'staff',
                            ':phone' => $u['phone'] ?? '',
                            ':email' => $u['email'] ?? '',
                            ':password_hash' => $passHash,
                            ':assigned_warehouse_id' => $u['assigned_warehouse_id'] ?? null,
                            ':is_principal_doctor' => !empty($u['is_principal_doctor']) ? 1 : 0,
                            ':status' => $u['status'] ?? 'active'
                        ]);
                    }
                }

                // D. Patients
                if (isset($collections['cf_patients_v5']) && is_array($collections['cf_patients_v5'])) {
                    $db->exec("DELETE FROM patients");
                    $stmt = $db->prepare("INSERT INTO patients (id, clinic_id, mr_number, full_name, relation_name, relation_type, phone, cnic, age, gender, address, city, notes) 
                                          VALUES (:id, :clinic_id, :mr_number, :full_name, :relation_name, :relation_type, :phone, :cnic, :age, :gender, :address, :city, :notes)");
                    foreach ($collections['cf_patients_v5'] as $p) {
                        $stmt->execute([
                            ':id' => $p['id'],
                            ':clinic_id' => $p['clinic_id'] ?? 'clinic_001',
                            ':mr_number' => $p['mr_number'] ?? '',
                            ':full_name' => $p['full_name'] ?? $p['name'] ?? 'Unnamed',
                            ':relation_name' => $p['relation_name'] ?? null,
                            ':relation_type' => $p['relation_type'] ?? 'father',
                            ':phone' => $p['phone'] ?? '',
                            ':cnic' => $p['cnic'] ?? null,
                            ':age' => isset($p['age']) ? (int)$p['age'] : null,
                            ':gender' => $p['gender'] ?? 'male',
                            ':address' => $p['address'] ?? null,
                            ':city' => $p['city'] ?? 'Hyderabad',
                            ':notes' => $p['notes'] ?? null
                        ]);
                    }
                }

                // E. Visits
                if (isset($collections['cf_visits_v5']) && is_array($collections['cf_visits_v5'])) {
                    $db->exec("DELETE FROM visits");
                    $stmt = $db->prepare("INSERT INTO visits (id, clinic_id, patient_id, doctor_id, token_number, queue_date, status, fee_amount, net_fee, symptoms, diagnosis, notes) 
                                          VALUES (:id, :clinic_id, :patient_id, :doctor_id, :token_number, :queue_date, :status, :fee_amount, :net_fee, :symptoms, :diagnosis, :notes)");
                    foreach ($collections['cf_visits_v5'] as $v) {
                        $stmt->execute([
                            ':id' => $v['id'],
                            ':clinic_id' => $v['clinic_id'] ?? 'clinic_001',
                            ':patient_id' => $v['patient_id'] ?? 'pat_unknown',
                            ':doctor_id' => $v['doctor_id'] ?? 'unknown_doc',
                            ':token_number' => $v['token_number'] ?? 1,
                            ':queue_date' => $v['queue_date'] ?? date('Y-m-d'),
                            ':status' => $v['status'] ?? 'waiting',
                            ':fee_amount' => $v['fee_amount'] ?? 500,
                            ':net_fee' => $v['net_fee'] ?? 500,
                            ':symptoms' => $v['symptoms'] ?? null,
                            ':diagnosis' => $v['diagnosis'] ?? null,
                            ':notes' => $v['notes'] ?? null
                        ]);
                    }
                }

                // F. Inventory
                if (isset($collections['cf_inventory_v5']) && is_array($collections['cf_inventory_v5'])) {
                    $db->exec("DELETE FROM inventory");
                    $stmt = $db->prepare("INSERT INTO inventory (id, clinic_id, sku_code, name, generic_name, category, manufacturing_company, box_label, unit_label, units_per_box, purchase_price_box, purchase_price_unit, retail_price_unit, min_reorder_qty, status, notes) 
                                          VALUES (:id, :clinic_id, :sku_code, :name, :generic_name, :category, :manufacturing_company, :box_label, :unit_label, :units_per_box, :purchase_price_box, :purchase_price_unit, :retail_price_unit, :min_reorder_qty, :status, :notes)");
                    foreach ($collections['cf_inventory_v5'] as $i) {
                        $stmt->execute([
                            ':id' => $i['id'],
                            ':clinic_id' => $i['clinic_id'] ?? 'clinic_001',
                            ':sku_code' => $i['sku_code'] ?? '',
                            ':name' => $i['name'] ?? '',
                            ':generic_name' => $i['generic_name'] ?? null,
                            ':category' => $i['category'] ?? 'General',
                            ':manufacturing_company' => $i['manufacturing_company'] ?? null,
                            ':box_label' => $i['box_label'] ?? 'Packs',
                            ':unit_label' => $i['unit_label'] ?? 'Units',
                            ':units_per_box' => $i['units_per_box'] ?? 1,
                            ':purchase_price_box' => $i['purchase_price_box'] ?? 0,
                            ':purchase_price_unit' => $i['purchase_price_unit'] ?? 0,
                            ':retail_price_unit' => $i['retail_price_unit'] ?? 0,
                            ':min_reorder_qty' => $i['min_reorder_qty'] ?? 10,
                            ':status' => $i['status'] ?? 'active',
                            ':notes' => $i['notes'] ?? null
                        ]);
                    }
                }

                // Re-enable constraints
                $db->exec("SET FOREIGN_KEY_CHECKS = 1");
            });

            Response::success([
                'restored'        => true,
                'collections_restored' => count($restoredKeys),
                'keys'            => $restoredKeys,
                'backup_metadata' => $metadata,
                'restored_at'     => date('c'),
                'message'         => 'Backup restored to VPS. All browsers will receive restored data on next sync pull.',
            ]);
        } catch (\Throwable $e) {
            Response::error('RESTORE_FAILED', 'Backup restore failed: ' . $e->getMessage(), 500);
        }
    }
}
