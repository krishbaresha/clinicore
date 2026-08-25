<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Config\Database;
use CliniCore\Utils\Response;
use PDO;

/**
 * 📧 System, Settings & Automated Notification Controller
 * Manages centralized system settings, Super Admin security, and email relays
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
    }

    /**
     * GET /api/v1/system/config
     * Retrieves centralized clinic configuration, automation keys, and settings
     */
    public function getConfig(): void
    {
        try {
            $db = Database::getConnection();
            $this->ensureSettingsTable($db);

            // 1. Fetch Clinic Profile from `clinics` table
            $stmt = $db->query("SELECT * FROM clinics LIMIT 1");
            $clinic = $stmt->fetch(PDO::FETCH_ASSOC) ?: [
                'id' => 'clinic_001',
                'name' => 'Dr. Muhammad Kashif Khan Clinic',
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

            // Merge clinic profile with system settings
            $response = [
                'clinic' => array_merge($clinic, [
                    'resend_api_key'        => $settings['resend_api_key'] ?? '',
                    'notification_email'    => $settings['notification_email'] ?? 'reports@drkashifclinic.com',
                    'whatsapp_gateway_no'   => $settings['whatsapp_gateway_no'] ?? '03473100304',
                    'report_frequency'      => $settings['report_frequency'] ?? 'daily_9pm',
                    'tab_pin'               => $settings['tab_pin'] ?? '7860',
                ]),
                'has_custom_passcode' => !empty($settings['admin_master_passcode']),
                'server_time'         => date('c')
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
                'admin_master_passcode'
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
     * Strictly verifies Super Admin master passcode (case-sensitive)
     */
    public function verifyPasscode(): void
    {
        try {
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
                Response::success(['authenticated' => true, 'message' => 'Super Admin authentication successful.']);
            } else {
                Response::error('UNAUTHORIZED', 'Incorrect Super Admin master passcode. Access denied.', 401);
            }
        } catch (\Throwable $e) {
            Response::error('AUTH_CHECK_FAILED', 'Authentication check failed: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/v1/system/send-email
     * Relays transactional emails & database backups via Resend API
     */
    public function sendEmail(): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $apiKey = trim($input['api_key'] ?? '');
        $to = $input['to'] ?? [];
        $subject = trim($input['subject'] ?? 'CliniCore System Report');
        $html = $input['html'] ?? '';
        $attachments = $input['attachments'] ?? [];

        if (empty($apiKey)) {
            Response::badRequest('Please provide a valid Resend API Key (re_xxxx).');
            return;
        }

        if (empty($to)) {
            Response::badRequest('Recipient email address is required.');
            return;
        }

        if (is_string($to)) {
            $to = array_filter(array_map('trim', explode(',', $to)));
        }

        $payload = [
            'from' => 'CliniCore System <onboarding@resend.dev>',
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
}
