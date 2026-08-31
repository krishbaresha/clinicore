# PHASE 06 — Backup & Disaster Recovery

## Goal
Ensure data survives client failure, web replacement, or accidental local loss.

## Layers
1. Desktop local backup
2. VPS database backup
3. Optional Google Drive backup
4. Optional Gmail SMTP notification

## Requirements
- encrypted backup where appropriate
- timestamp
- integrity check
- retention
- upload result
- retry
- restore test
- audit log

Email attachment is not the primary backup store.
Never hard-code SMTP/Drive credentials.
