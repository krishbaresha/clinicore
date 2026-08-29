# 13 — REST API Specifications

> **System:** CliniCore / ClinicFlow Master Architecture  

---

## 1. Core Endpoints
- `POST /api/v1/auth/login` — Session authentication & JWT issuance.
- `GET /api/v1/sync/pull?cursor=N` — Monotonic change pull.
- `POST /api/v1/sync/push` — Batch outbox mutation push with idempotency keys.
- `POST /api/v1/approvals/request` — Initiate doctor approval request.
- `POST /api/v1/system/restore-backup-data` — Transactional backup restore with master passcode.
