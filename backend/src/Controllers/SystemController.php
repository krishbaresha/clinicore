<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Config\Database;
use CliniCore\Config\Env;
use CliniCore\Middleware\AuthMiddleware;
use CliniCore\Middleware\RBACMiddleware;
use CliniCore\Utils\RateLimiter;
use CliniCore\Utils\Response;
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
                Response::success(['authenticated' => true, 'message' => 'Super Admin authentication successful.']);
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

            Response::success($state);
        } catch (\Throwable $e) {
            Response::error('SYNC_FETCH_FAILED', 'Failed to fetch cloud state: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/v1/system/sync-state
     * Saves application collections from any browser into central MySQL (Authenticated Users Only)
     */
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
            RBACMiddleware::requireAdminOrOwner();

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

            // 1. Wipe all transactional data from app_cloud_state (JSON blob store)
            $db->exec("DELETE FROM app_cloud_state WHERE collection_key NOT IN ('system_settings', 'license')");

            // 2. Wipe dedicated relational tables
            $tables = ['patients', 'visits', 'expenses', 'stock_movements', 'idempotency_keys'];
            foreach ($tables as $table) {
                try {
                    $db->exec("TRUNCATE TABLE `$table`");
                } catch (\Throwable $tableErr) {
                    // Table may not exist yet — skip silently
                }
            }

            // 3. Reset invoice counters
            try { $db->exec("DELETE FROM app_cloud_state WHERE collection_key LIKE 'cf_seq_%'"); } catch (\Throwable) {}

            // 4. Clear backup files older than reset
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

            // Restore each collection into app_cloud_state
            $restoredKeys = [];
            $upsertStmt = $db->prepare("
                INSERT INTO app_cloud_state (collection_key, data_json, updated_at)
                VALUES (:key, :data, NOW())
                ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = NOW()
            ");

            foreach ($collections as $collectionKey => $collectionData) {
                // Sanitize key
                $safeKey = preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)$collectionKey);
                if (empty($safeKey)) continue;

                $dataJson = is_string($collectionData) ? $collectionData : json_encode($collectionData, JSON_UNESCAPED_UNICODE);
                $upsertStmt->execute([':key' => $safeKey, ':data' => $dataJson]);
                $restoredKeys[] = $safeKey;
            }

            // Also restore patients & visits into their dedicated MySQL tables (best-effort)
            if (isset($collections['cf_patients_v5']) && is_array($collections['cf_patients_v5'])) {
                try {
                    $patStmt = $db->prepare("INSERT IGNORE INTO patients (id, clinic_id, data_json, created_at) VALUES (:id, :cid, :data, NOW())");
                    foreach ($collections['cf_patients_v5'] as $pat) {
                        if (!empty($pat['id'])) {
                            $patStmt->execute([
                                ':id'   => $pat['id'],
                                ':cid'  => $pat['clinic_id'] ?? 'clinic_001',
                                ':data' => json_encode($pat, JSON_UNESCAPED_UNICODE),
                            ]);
                        }
                    }
                } catch (\Throwable) {}
            }

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
