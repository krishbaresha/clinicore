# ClinicCore — Durable Offline-First Sync Specification

*Verified and Documented in Phase 02 (Durable Offline-First Sync).*

---

## 1. Core Synchronization Architecture

ClinicCore implements a robust, bi-directional, offline-first synchronization architecture designed to guarantee **Zero Data Loss** across network disruptions and application restarts.

```
       [Desktop / Web Client Local Store]
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
[In-Memory Hot Cache]        [Durable Disk Outbox Queue]
(_COLLECTION_CACHE)             (cf_outbox_mutations_v5)
       │                               │
       │                   ┌───────────┴───────────┐
       │                   │ Online & Reconnect    │
       ▼                   ▼                       ▼
[Atomic Local Disk]  [Sync FSM Engine]  [Exponential Backoff Retry]
(%APPDATA%/data/*.json)    │                       │
                           ▼                       ▼
                 [Push /api/v1/sync/push]  [Pull /api/v1/system/sync-state]
                           │                       │
                           └───────────┬───────────┘
                                       ▼
                       [VPS Node.js Backend API & DB]
```

---

## 2. Sync Finite State Machine (FSM)

The engine transitions deterministically across these discrete states:

| FSM State | Description | UI Indicator | Action on Entry |
|---|---|---|---|
| `IDLE` | Fully synchronized and online | 🟢 Cloud with Check | Ready for mutations or background polling |
| `SYNCING_PUSH` | Actively pushing batch mutations to VPS | 🟡 Rotating Arrow | Transmits payload to `/api/v1/sync/push` |
| `SYNCING_PULL` | Hydrating collections from VPS authority | 🟡 Sync In-Progress | Fetches state from `/api/v1/system/sync-state` |
| `OFFLINE` | Network unreachable or socket disconnected | ⚪ Cloud with Slash | Enqueues mutations to local durable Outbox |
| `ERROR` | API/Server error or transient failure | 🔴 Red Warning Cloud | Starts exponential backoff timer ($1s \dots 30s$) |
| `CONFLICT` | Concurrent edit detected on entity | 🟠 Conflict Warning | Invokes domain-specific 3-way resolver |
| `DEAD_LETTER` | Max retries ($>5$) exhausted on payload | 🟣 Dead-Letter Alert | Retains record for manual inspection / retry |

---

## 3. Offline Data Durability Protocol

### A. Local Mutation Enqueuing
When an entity (Patient, Sale, User, Expense, Stock Movement) is created or modified:
1. It is assigned a **deterministic, collision-free UUID** (`_id` / `id`).
2. Record lineage metadata is stamped (`_device_id`, `_client_version`, `_created_at`, `_updated_at`).
3. Local collection in memory and disk (`%APPDATA%/ClinicFlow/data/*.json`) is updated immediately.
4. An outbox mutation entry is added with status `"pending"`.

### B. Boot-Time Dirty Record Protection
During app startup or pull hydration from VPS:
- Any local entity present in the outbox queue (`pending` or `sending`) is **shielded from remote overwrite**.
- Patients undergo **3-Way Merging** preserving local pending edits.
- Inventory quantities use **PN-Counter Delta Reconciliations** so offline sales correctly deduct server stock.

### C. Server Idempotency & Acknowledgment
- Server receives mutations with unique `mutation_id`s.
- Duplicate replay requests return cached confirmation without re-executing side effects.
- Upon receiving `status: "confirmed"`, the client purges the item from the local outbox.

---

## 4. Conflict Resolution Matrix

| Domain / Entity | Resolution Strategy | Authoritative Mechanism |
|---|---|---|
| **Patients** | 3-Way Field Merge | Latest field timestamp + conflict lineage tracking |
| **Inventory / Stock** | PN-Counter Delta | Adds/subtracts transactional deltas rather than absolute overwrites |
| **Users / Auth** | Bidirectional Reconciliation | Merges un-synced local users; preserves active sessions |
| **System Settings & License** | Server Supremacy | VPS values override local settings; local overrides blocked |
| **POS / B2B Invoices** | Immutable Ledger | Invoices are append-only; revisions create return/adjustment records |

---

## 5. Manual Sync & Diagnostics
- The Cloud Sync button remains **fully clickable at all times**.
- When offline: Opens the **Connection & Outbox Diagnostic Dialog**, allowing users to review pending mutations, trigger a connectivity check, or inspect dead-letter items.
- When online: Triggers immediate bidirectional Push + Pull reconciliation.
