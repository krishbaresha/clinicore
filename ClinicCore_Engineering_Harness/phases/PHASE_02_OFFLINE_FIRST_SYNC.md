# PHASE 02 — Durable Offline-First Sync

## Goal
A desktop user's work must survive app restart and temporary outages.

## Required
- Persistent local DB/cache.
- Persistent outbox.
- Stable IDs.
- Idempotent server mutation handling.
- Retry with backoff.
- Sync checkpoint/cursor.
- Push local mutations.
- Pull remote mutations.
- Safe acknowledgment.
- Failed mutation retention.
- Clear sync status.

## Critical acceptance test
1. Disable network.
2. Create user.
3. Create/update business data.
4. Close app.
5. Reopen app.
6. Data must still exist locally.
7. Re-enable network.
8. Automatic sync occurs.
9. VPS reflects changes.
10. Web reflects changes.
11. Second desktop can retrieve them.

No data loss is acceptable.
