<?php
declare(strict_types=1);

namespace ClinicFlow\Services;

use ClinicFlow\Config\Database;
use PDO;
use Exception;

class QueueService {
    /**
     * Gets today's Pakistan Standard Time (UTC+5) Date (YYYY-MM-DD).
     */
    public static function getTodayPKTDate(): string {
        $pkt = new \DateTime('now', new \DateTimeZone('Asia/Karachi'));
        return $pkt->format('Y-m-d');
    }

    /**
     * Generates the next sequential token number for a given doctor on the specified date atomically.
     */
    public static function getNextTokenNumber(PDO $db, string $clinicId, string $doctorId, string $queueDate): int {
        $stmt = $db->prepare("
            SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token
            FROM visits
            WHERE clinic_id = :clinic_id AND doctor_id = :doctor_id AND queue_date = :queue_date
            FOR UPDATE
        ");
        $stmt->execute([
            ':clinic_id'  => $clinicId,
            ':doctor_id'  => $doctorId,
            ':queue_date' => $queueDate
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int) ($row['next_token'] ?? 1);
    }
}
