# PHASE 05 — Enterprise Desktop Auto-Update

## Goal
Users do not reinstall manually for every software release.

## Tasks
- Detect actual desktop framework.
- Select supported updater.
- CI release workflow.
- Version metadata.
- Release manifest.
- Artifact integrity/signing where supported.
- Update check.
- Update modal.
- Later/cancel.
- Admin Check for Updates.
- Release notes.
- Safe rollback/failure behavior.

## Data protection
Application update MUST NOT delete:
- local DB
- local configuration
- pending outbox
- user data

Test update over a real previous version.
