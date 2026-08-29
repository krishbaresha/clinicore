# 09 — Backup, Disaster Recovery & Restore Validation

> **System:** CliniCore / ClinicFlow Master Architecture  

---

## 1. Triple-Layer Backup Strategy
1. **VPS Automated Backup**: Nightly `pg_dump` compressed archives stored on VPS backup partition.
2. **Desktop Local Backup**: Encrypted `.cfbak` packages downloaded automatically to local backup folder.
3. **Offsite Vault**: Nightly cron daemon dispatches encrypted backups to secure offsite vault.

## 2. Transactional Staging Restore Process
- Restores are unpacked into a temporary `staging_restore` PostgreSQL database.
- Integrity verification suite checks SHA-256 checksums, user table counts, ledger trial balances, and SKU catalogues.
- Atomic promotion replaces production schema only after 100% verification passes.
