# 19 — Architecture Decision Gate & Technology Matrix

> **System:** CliniCore / ClinicFlow Master Architecture  
> **Client:** H/Dr. Asif Ashraf Khan Clinic & Wholesale Pharmacy  
> **Status:** Verified Architectural Decision Report  

---

## Architecture Decision Gate: 15 Core System Questions

### 1. Database Architecture Choice: PostgreSQL vs MongoDB?
- **Decision**: **PostgreSQL** (Node.js/TypeScript + NestJS/Fastify + Prisma/Drizzle + PostgreSQL 16).
- **Rationale**: CliniCore features 29,009 financial transactions, double-entry ledgers, stock movements, and batch FEFO allocation. PostgreSQL provides native ACID transactions, strict relational foreign key constraints, decimal-safe financial types (`NUMERIC(15,2)`), and deterministic query planner execution. MongoDB is rejected for core business operations to prevent multi-document consistency failures during network or power interruptions.

### 2. Desktop Application Shell: Tauri vs Electron?
- **Decision**: **Tauri + React 19 + TypeScript**.
- **Rationale**: Tauri uses native OS webview rendering (WebView2 on Windows), producing extremely lightweight binaries (~12 MB installer vs >120 MB Electron), consuming <60 MB RAM (vs >400 MB Electron), and offering native Rust IPC performance for local SQLite database access and ESC/POS thermal printer hardware streaming.

### 3. Doctor Mobile Application: React Native + Expo vs Alternatives?
- **Decision**: **React Native + Expo**.
- **Rationale**: Enables rapid cross-platform deployment (iOS & Android) with shared TypeScript domain types, native push notifications for sensitive approval requests, camera access for prescription photo attachments, and secure biometric authentication (FaceID / Fingerprint).

### 4. Local Desktop Database: SQLite Design
- **Decision**: **Local SQLite Database (`clinicore_local.db`) + WAL Mode**.
- **Rationale**: Replaces browser LocalStorage. SQLite runs natively inside the Tauri Rust core process with Write-Ahead Logging (WAL) enabled for non-blocking concurrent reads/writes and atomic transaction recovery during sudden power loss.

### 5. Offline Sync Mechanism
- **Decision**: **Monotonic Change Cursor + Durable SQLite Outbox Queue**.
- **Rationale**: Offline mutations are written to a local `outbox_mutations` table in SQLite with deterministic UUID `mutation_id` and `idempotency_key`. Reconnection triggers incremental push to `/api/v1/sync/push` and monotonic pull via `GET /api/v1/sync/pull?cursor=N`.

### 6. Conflict Resolution Model
- **Decision**: **Domain-Specific Mathematical Conflict Resolvers + Record Versioning**.
- **Rationale**: Naive last-write-wins is explicitly forbidden for accounting and stock. Stock updates use commutative delta math (`stock = stock + delta`); patient records use 3-way field merge; financial ledgers use immutable compensating transactions.

### 7. Accounting Transaction Model
- **Decision**: **Immutable Double-Entry Journal (`total_debits == total_credits`)**.
- **Rationale**: Direct balance editing is strictly prohibited. Every sale, purchase, payment, or expense creates balanced debit and credit journal entries. Closed periods (`is_period_closed`) lock historical entries.

### 8. Doctor Approval System Model
- **Decision**: **Server-Authoritative Approval Requests + Biometric Mobile Sign-off**.
- **Rationale**: Sensitive actions (high discounts >15%, stock write-offs >10 units, backdated edits) create a pending `ApprovalRequest` on the VPS. The doctor receives a push notification on mobile, approves via biometric prompt, and VPS commits the decision.

### 9. Offline Doctor Approval Security
- **Decision**: **Cryptographic Asymmetric Key Nonce Signing (ED25519)**.
- **Rationale**: Offline approvals generate a cryptographically signed payload containing `request_id`, `scope`, `timestamp`, and `nonce` signed by the doctor's local private key stored in Secure Enclave / Keystore.

### 10. Image & Document Storage
- **Decision**: **VPS File Storage + Local Encrypted Cache + Database Metadata**.
- **Rationale**: Prescription photos and medical reports are stored in VPS object storage, referenced by metadata in PostgreSQL (`patient_documents`), and cached locally in encrypted disk storage.

### 11. Backup & Offsite Strategy
- **Decision**: **Triple-Layer Automated Backup Pipeline (VPS Automated + Local Encrypted + Offsite Vault)**.
- **Rationale**: VPS runs automated nightly PostgreSQL dumps (`pg_dump`). Desktop downloads encrypted `.cfbak` packages to local backup folder. Offsite vault receives encrypted snapshots via scheduled cron daemon.

### 12. Restore Strategy
- **Decision**: **Transactional Staging Promotion with Pre-Restore Checkpoints**.
- **Rationale**: Restores decrypt and validate checksums into a temporary staging database (`staging_restore`). Verification tests confirm user auth, ledger totals, and SKU counts before atomic production promotion.

### 13. Legacy Migration Strategy
- **Decision**: **Staged ETL Pipeline for 29,000+ MS Access & Excel Records**.
- **Rationale**: `AshrafKhan.accdb` (29,009 journal rows, 25,765 stock rows) and `DrCreate.xlsm` are staged in `staging_legacy`, validated for SKU/party references, mapped to canonical PostgreSQL schemas, and imported with full `_legacy_id` lineage.

### 14. Doctor & Staff Authentication
- **Decision**: **Salted SHA-256 / Argon2id Password Hasher + VPS JWT Sessions**.
- **Rationale**: Passwords use RFC 6234 salted SHA-256 / Argon2id digests. Sessions issue secure JWT tokens with explicit role permissions (`admin`, `doctor`, `receptionist`, `pharmacist`, `cashier`, `warehouse`).

### 15. Safe Application Update Mechanism
- **Decision**: **Tauri Auto-Updater + Transactional SQLite Schema Migrations**.
- **Rationale**: Desktop app updates update application binaries while leaving `clinicore_local.db` and `outbox_mutations` intact. Schema migrations execute transactionally on app launch without wiping business data.
