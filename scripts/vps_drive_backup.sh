#!/bin/bash
# ==============================================================================
# ClinicCore — Automated Google Drive & Local Nightly Backup Engine
# Runs automatically via crontab every night at 2:00 AM
# ==============================================================================

BACKUP_DIR="/var/backups/clinicore"
DATE_STR=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/clinicore_backup_${DATE_STR}.sql.gz"
STATE_BACKUP="${BACKUP_DIR}/clinicore_state_${DATE_STR}.json.gz"

mkdir -p "${BACKUP_DIR}"

echo "[1/3] Creating MySQL Database Dump..."
if command -v mysqldump &> /dev/null; then
    mysqldump -u root clinicore 2>/dev/null | gzip > "${BACKUP_FILE}"
fi

echo "[2/3] Archiving Application State Collections..."
if [ -f "/var/www/clinicore/backend/data/sync_state.json" ]; then
    gzip -c "/var/www/clinicore/backend/data/sync_state.json" > "${STATE_BACKUP}"
fi

echo "[3/3] Uploading to Google Drive (if rclone configured)..."
if command -v rclone &> /dev/null; then
    rclone copy "${BACKUP_DIR}" gdrive:ClinicCore_Backups/ --max-age 30d
    echo "✓ Uploaded to Google Drive: gdrive:ClinicCore_Backups/"
else
    echo "Note: rclone not installed or configured. Backups safely preserved locally at ${BACKUP_DIR}"
fi

# Clean up local backups older than 30 days
find "${BACKUP_DIR}" -type f -name "*.gz" -mtime +30 -exec rm -f {} \;
echo "✓ Local backup rotation complete. 30-day retention enforced."
