# PHASE 04 — VPS Durable Source of Truth

## Goal
The VPS remains the durable central data store independently of the Web UI.

## Requirements
- Central DB on VPS.
- Backend API.
- Backups.
- migrations.
- health checks.
- monitoring/logging.
- restore procedure.
- documented API contract.

Future websites/integrations must be able to consume the backend without rewriting the data layer.

Do not expose DB credentials to clients.
