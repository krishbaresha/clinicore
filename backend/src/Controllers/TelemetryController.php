<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Utils\Response;

class TelemetryController
{
    public function ingestEvents(): void
    {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);

        if (!is_array($data) || !isset($data['events']) || !is_array($data['events'])) {
            Response::badRequest('Invalid telemetry payload structure');
            return;
        }

        $events = $data['events'];
        $appVersion = $data['app_version'] ?? 'unknown';

        $logDir = dirname(__DIR__, 2) . '/storage/logs';
        if (!is_dir($logDir)) {
            @mkdir($logDir, 0775, true);
        }

        $logFile = $logDir . '/telemetry_' . date('Y-m-d') . '.log';
        $logEntries = '';

        foreach ($events as $event) {
            $type = $event['type'] ?? 'GENERAL_ERROR';
            $msg  = $event['message'] ?? 'N/A';
            $time = $event['timestamp'] ?? date('c');
            $url  = $event['url'] ?? '/';

            $logEntries .= sprintf(
                "[%s] [VER:%s] [TYPE:%s] [PATH:%s] %s | STACK: %s\n",
                $time,
                $appVersion,
                $type,
                $url,
                $msg,
                str_replace("\n", " -> ", $event['stack'] ?? '')
            );
        }

        @file_put_contents($logFile, $logEntries, FILE_APPEND | LOCK_EX);

        Response::success([
            'status' => 'ingested',
            'count' => count($events)
        ]);
    }
}
