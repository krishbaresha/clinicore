# PHASE 00 — Baseline & Forensic Audit

## Goal
Understand the actual system before changing anything.

## Tasks
- Inventory repository.
- Detect frontend/backend/desktop framework.
- Detect DB and ORM.
- Detect local desktop DB/cache.
- Detect API base URL configuration.
- Detect auth/token lifecycle.
- Detect sync engine/outbox/polling/websocket.
- Detect POS/inventory/purchase models.
- Detect CI/CD.
- Detect updater.
- Detect backups.
- Detect environment files and deployment config.

## Bug reproduction
Reproduce:
1. Desktop user creation.
2. Close desktop.
3. Reopen.
4. Verify whether user remains.
5. Test sync indicator.
6. Test API connectivity.
7. Create data on Web Browser A.
8. Check Browser B/incognito.
9. Refresh Browser B.
10. Test another desktop if available.

## Deliverables
- docs/ARCHITECTURE_CURRENT.md
- docs/KNOWN_ISSUES.md
- docs/DATA_MODEL.md
- docs/TEST_MATRIX.md
- ai-harness/STATE.md
- ai-harness/EXECUTION_LOG.md

## Gate
No source-code modification unless explicitly approved after forensic report.
