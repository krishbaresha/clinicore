# Current Architecture — ClinicCore (Baseline Forensic Snapshot)

*Generated in Phase 00 (Baseline & Forensic Audit) following the Zero-Guess Protocol.*

---

## 1. System Topology & Layers

```
                                 ┌──────────────────────────────────────────────┐
                                 │              VPS Central Host                │
                                 │             (https://clinicore.me)           │
                                 │                                              │
                                 │  Node.js API Server (backend/server.js)      │
                                 │  - JSON file-backed state & seed models      │
                                 │  - Master DB (PostgreSQL pg driver configured)│
                                 └──────────────────────┬───────────────────────┘
                                                        │
                                          HTTPS REST API & Sync Push/Pull
                                                        │
                   ┌────────────────────────────────────┴────────────────────────────────────┐
                   │                                                                         │
                   ▼                                                                         ▼
   ┌─────────────────────────────────────────┐                               ┌─────────────────────────────────────────┐
   │             Desktop Client              │                               │               Web Client                │
   │    (Tauri 2.0 Rust + React 19 SPA)      │                               │           (Browser SPA / PWA)           │
   ├─────────────────────────────────────────┤                               ├─────────────────────────────────────────┤
   │ - Rust IPC: atomic read/write files     │                               │ - Web Storage: localStorage (10MB cap)  │
   │ - Local Disk Storage:                   │                               │ - Hot Cache: In-memory Collection Maps  │
   │   %APPDATA%/ClinicFlow/data/*.json      │                               │ - Background Polling + Tab Focus Sync   │
   │ - Hot Cache: In-memory Collection Maps  │                               │ - Mutation Outbox with FSM Engine       │
   │ - syncEngine.js (FSM, Outbox, Deltas)   │                               │ - Cloud Health Probing (/api/v1/health) │
   └─────────────────────────────────────────┘                               └─────────────────────────────────────────┘
```

---

## 2. Component Inventory

### A. Frontend Layer (`frontend/`)
- **Framework & Libraries**: React `19.2.8`, Vite `8.2.0`, Tailwind CSS `4.3.3`, React Router `7.18.2`, Framer Motion, Lucide Icons, date-fns, i18next.
- **Data Engine (`frontend/src/api/db.js`)**:
  - In-memory hot caches (`_COLLECTION_CACHE`, `_ID_MAP_CACHE`) for $O(1)$ fast reads without JSON parsing bottlenecks.
  - Safe financial arithmetic utilities (`safeMoney`, `safeQty`, `calculateLineDiscount`, `calculateInvoiceFinancials`).
  - Cryptographic security: Pure JS constant-time SHA-256 + WebCrypto fallback + salt generator.
  - Mutation hooks notifying syncEngine on every collection write.
- **Unified Storage Driver (`frontend/src/api/storageDriver.js`)**:
  - Auto-detects runtime via `window.__TAURI__`.
  - In Tauri Desktop: Reads through an in-memory disk mirror initialized via Rust `list_collection_keys` + `read_collection`; writes asynchronously via Rust IPC `write_collection` using atomic temp-file-rename.
  - In Browser / Web: Falls back to `window.localStorage`.

### B. Desktop Native Engine (`frontend/src-tauri/`)
- **Framework**: Tauri 2.0 (Rust).
- **Core Binary (`src-tauri/src/main.rs`)**:
  - Implements native IPC commands: `read_collection`, `write_collection`, `remove_collection`, `list_collection_keys`, `get_data_path`.
  - Target storage path: `%APPDATA%/ClinicFlow/data/` (Windows) / `~/.local/share/ClinicFlow/data/` (Linux) / `~/Library/Application Support/ClinicFlow/data/` (macOS).

### C. Backend API & Cloud Store (`backend/`)
- **Server**: Node.js HTTP Server (`backend/server.js`) on port 5000 / production reverse proxy.
- **Endpoints**:
  - `GET /health`, `GET /api/v1/health` — Heartbeat & status probe.
  - `GET /api/v1/system/version`, `GET /version.json` — OTA update manifest.
  - `GET /api/v1/time` — Clock drift calibration.
  - `POST /api/v1/system/verify-passcode` — Master authentication & passcode sync.
  - `POST /api/v1/auth/login` — Session authentication.
  - `GET /api/v1/system/sync-state` — Full snapshot pull.
  - `POST /api/v1/system/sync-state` — Full snapshot push.
  - `POST /api/v1/sync/push` — Batch mutation outbox push with acknowledgment.
  - `GET /api/v1/system/config`, `POST /api/v1/system/config` — Tenant settings and security PINs.
- **Data Persistence**: Backed by JSON data store in `backend/data/` pre-seeded with master catalogs (`master_medicines_seed.json`, `master_parties_seed.json`, `master_suppliers_seed.json`, `master_accounts_seed.json`), with optional PostgreSQL (`pg`) connection pooling.

### D. Synchronization & Conflict Engine (`frontend/src/api/syncEngine.js`, `conflictResolver.js`)
- **FSM States**: `IDLE`, `SYNCING_PUSH`, `SYNCING_PULL`, `OFFLINE`, `ERROR`, `CONFLICT`, `DEAD_LETTER`.
- **Conflict Resolution**:
  - Patients: 3-way merge on field timestamps.
  - Inventory: PN-Counter positive/negative delta aggregation.
  - Settings/Passcodes: Server authoritative reconciliation.
- **Trigger Mechanisms**:
  - Debounced post-mutation write hook (`registerCollectionChangeHook`).
  - Network status events (`online`/`offline`).
  - Browser/Desktop window focus & visibility change.
  - Exponential backoff retry loop with dead-letter queue.

---

## 3. Baseline Verification Status
- Full Master Test Suite (`npm test`): **638/638 tests passing (0 failures)**.
- Clean zero-warning verification on all core calculation and recovery test suites.
