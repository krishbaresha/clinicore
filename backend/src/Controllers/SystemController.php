<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Utils\Response;

/**
 * 📧 System & Automated Notification Controller
 * Dispatches encrypted backups and reports via Resend API from the backend
 */
class SystemController
{
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
