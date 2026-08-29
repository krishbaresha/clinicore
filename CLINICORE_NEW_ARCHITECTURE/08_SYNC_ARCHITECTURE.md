# 08 — Offline-First & Cloud Synchronization Architecture

> **System:** CliniCore / ClinicFlow Master Architecture  

---

## 1. Dual-Database Model
- **Client Desktop**: Local SQLite database (`clinicore_local.db`) with Write-Ahead Logging (WAL).
- **VPS Server**: Canonical PostgreSQL database acting as single authoritative source of truth.

## 2. Monotonic Sync Protocol
- **Outbox Push**: Local SQLite outbox queue stores pending mutations with `mutation_id` and `idempotency_key`. Reconnection posts queue to `POST /api/v1/sync/push`.
- **Monotonic Pull**: Desktop pulls canonical updates via `GET /api/v1/sync/pull?cursor=N`. Local SQLite updates records and advances local cursor to `N_next`.
