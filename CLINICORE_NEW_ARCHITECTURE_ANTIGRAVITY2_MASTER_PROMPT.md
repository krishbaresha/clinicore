# CLINICORE — NEW DESKTOP + MOBILE + VPS ARCHITECTURE MASTER PROMPT
## Antigravity 2 / Multi-Agent Full-System Rebuild & Migration Specification

> **MISSION**
>
> Stop trying to repair the existing PHP/web architecture incrementally.
> We are now designing a clean, production-grade Clinicore ecosystem from a verified understanding of the existing application, old software, business rules, data, assets, and workflows.
>
> The final product is a **fully installable desktop application + doctor mobile application**, backed by a single authoritative VPS server/database, with robust offline operation, automatic synchronization, accounting/inventory integrity, backup/disaster recovery, permissions, auditability, and migration of approximately two years of legacy data.
>
> The product is for **H/DR. ASIF ASHRAF KHAN CLINIC**, including clinic/OPD operations, medical store, warehouse, POS, wholesale, accounting, prescriptions, patient records, permissions, approvals, reporting, and administration.

---

# 0. DO NOT START CODING YET

This is a **new architecture/rebuild decision**, not permission to immediately delete the existing system.

First perform a complete forensic/context phase.

Do NOT:
- delete the current repository
- drop the existing production database
- destroy old data
- overwrite legacy files
- remove existing business logic before documenting it
- blindly convert every existing table into a new schema
- assume MongoDB is automatically better
- assume the current PHP architecture is correct
- assume the old Excel/Access structures are correct
- copy demo data into the new production database

Create a recovery snapshot/branch of the current system first.

The existing application is reference material for business rules, calculations, screens/workflows, reports, accounting behavior, permissions, inventory behavior, historical data, and legacy compatibility.

It is NOT automatically the blueprint for the new architecture.

---

# 1. FINAL PRODUCT VISION

The final ecosystem must contain:

```text
                    CLINICORE VPS
                         |
              +----------+----------+
              |                     |
       Canonical Database       Backend API
              |                     |
              +----------+----------+
                         |
          +--------------+--------------+
          |                             |
   Desktop Application            Doctor Mobile App
   Clinic / Store / POS           Approvals / Monitoring
          |
   Offline Local Database
   + Durable Outbox
```

There is **no dependency on a browser website for normal operation**.

The user should install the desktop application and run it like normal Windows software.

The doctor installs the mobile application.

The VPS/API exists as backend infrastructure, not as the primary user interface.

---

# 2. TECHNOLOGY DECISION — DO NOT ASSUME MONGODB

## Backend

Evaluate and compare:

```text
Node.js + TypeScript
+
NestJS OR Fastify
+
PostgreSQL
+
Prisma OR Drizzle
```

against MongoDB.

**Do not automatically choose MongoDB merely because it is easy to start.**

This application has:
- double-entry accounting
- stock movements
- purchases
- sales
- payments
- returns
- party balances
- supplier balances
- day closing
- invoices
- audit trails
- permissions
- relational references
- transactional workflows

Therefore **PostgreSQL should be the default recommendation**, subject to forensic validation.

Before implementation produce an architecture decision comparing PostgreSQL vs MongoDB on:
- transactions
- accounting integrity
- stock consistency
- reporting
- backup/restore
- indexing
- concurrency
- offline synchronization
- migrations
- long-term maintainability
- operational complexity

Default recommendation: **PostgreSQL**.

---

# 3. DESKTOP APPLICATION

Evaluate:

```text
React + TypeScript
+
Tauri
```

as the preferred Windows desktop shell.

Electron may be selected only if a demonstrated technical requirement justifies it.

The final desktop application must:
- install normally
- create normal Windows shortcuts
- run without opening a browser
- work offline
- connect securely to VPS when online
- synchronize automatically
- retain pending work through restart/power loss
- update safely
- never lose business data during updates

Users must not need to know about localhost, ports, Vite, React, API URLs, or DevTools.

---

# 4. DOCTOR MOBILE APPLICATION

Evaluate:

```text
React Native + Expo
```

for the doctor app.

The doctor app should support, according to authorized permissions:
- approval requests
- sensitive-action approvals
- permission approvals
- monitoring staff/POS activity
- notifications
- prescription/photo workflows
- audit review
- administrative approvals

It uses the same VPS backend and canonical database.

It must not create a second independent business database.

---

# 5. NO PUBLIC WEBSITE UI

The final product does NOT require a normal public website.

Required:
```text
Clinicore Desktop Installer
+
Doctor Mobile App
+
Secure VPS Backend/API
```

The domain may exist only for backend/API infrastructure, controlled administration if needed, update metadata, or health/status endpoints.

Do not build a public website UI unless explicitly required later.

---

# 6. CANONICAL DATA ARCHITECTURE

Non-negotiable:

```text
                    VPS DATABASE
                 SINGLE AUTHORITY
                       |
             +---------+---------+
             |                   |
       Desktop Clients      Doctor Mobile
             |
      Local SQLite Database
             |
      Durable Outbox/Inbox
```

The VPS database is the canonical authority for persistent shared data.

Local desktop storage is a local working database/cache.

It is NOT another permanent source of truth.

---

# 7. OFFLINE-FIRST BEHAVIOR

Desired UX:

```text
ONLINE
  |
  +--> server interaction normally
  |
OFFLINE
  |
  +--> application continues working
  |
  +--> local transaction stored safely
  |
RECONNECT
  |
  +--> queued operations synchronize
  |
  +--> server confirms canonical result
  |
  +--> other devices receive changes
```

But accounting and stock operations require strict transactional rules.

---

# 8. LOCAL DATABASE

Use/evaluate:

```text
SQLite
+
durable outbox
+
sync cursor
+
local transaction journal
+
encryption where appropriate
```

Do not use browser LocalStorage as the business database.

LocalStorage should be limited to small UI/session/preferences where appropriate.

---

# 9. ONLINE WRITE CONTRACT

For normal online operation:

```text
User Action
   ↓
Desktop App
   ↓
API
   ↓
Authentication
   ↓
Authorization
   ↓
Domain Validation
   ↓
PostgreSQL Transaction
   ↓
Commit
   ↓
Canonical Server Result
   ↓
Local SQLite Update
   ↓
UI Update
```

The UI must never claim permanent save before the server accepts a critical online transaction.

States should include:

```text
SAVED
PENDING OFFLINE SYNC
SYNCING
FAILED — RETRY
CONFLICT — REVIEW
```

---

# 10. OFFLINE WRITE CONTRACT

When VPS cannot be reached:

```text
User Action
   ↓
Local validation
   ↓
SQLite transaction
   ↓
Durable Outbox Mutation
   ↓
PENDING
   ↓
Application continues
   ↓
Internet returns
   ↓
Push mutation
   ↓
Server validates
   ↓
Idempotency check
   ↓
PostgreSQL transaction
   ↓
Canonical result
   ↓
ACK
   ↓
Local record reconciled
```

Application restart or power loss must not silently lose pending mutations.

---

# 11. IDEMPOTENCY

Every business mutation must have durable identifiers such as:

```text
mutation_id
idempotency_key
client_id
user_id
entity_type
entity_id
operation
created_at
client_version
schema_version
```

Duplicate request behavior:

```text
FIRST
→ execute
→ commit
→ store result

SECOND WITH SAME KEY
→ detect duplicate
→ do NOT execute again
→ return original canonical result
```

Mandatory for:
- sale
- payment
- purchase
- stock movement
- return
- transfer
- expense
- invoice
- OPD fee
- ledger transaction
- day closing

---

# 12. SERVER-SIDE BUSINESS AUTHORITY

Never trust a client with final stock or financial state.

Bad:

```text
client says:
stock = 147
balance = 50000
```

Good:

```text
client says:
SALE quantity=3
```

Server validates, calculates, creates stock/accounting effects, commits transaction, and returns canonical state.

The server is authoritative for business calculations.

---

# 13. ACCOUNTING ENGINE

Preserve and correctly implement:
- patient ledger
- supplier ledger
- wholesale party ledger
- cashbook
- expenses
- sales
- purchases
- payments
- returns
- OPD fees
- invoices
- day closing
- reversals
- adjustments
- double-entry accounting

Core invariant:

```text
TOTAL DEBITS = TOTAL CREDITS
```

Financial mutations must be transactional.

Do not fix accounting by directly editing balances.

Use authoritative transactions and reconciliation.

---

# 14. INVENTORY ENGINE

Support:
- medical store
- warehouse
- batches
- expiry
- FEFO
- stock movements
- purchases/GRN
- sales
- returns
- transfers
- adjustments
- physical reconciliation
- scrap/quarantine
- stock valuation

Distinguish:
```text
physical movement
available quantity
reserved quantity
damaged/expired/quarantined quantity
```

Use server-side transactional rules.

---

# 15. POS + INVOICING

Preserve the existing POS and invoice capabilities.

Support:
- sales
- invoice numbering
- customer/party
- items
- batches where applicable
- discounts
- payments
- outstanding amounts
- returns
- printable invoices
- thermal receipts
- historical lookup

Critical POS transactions require:
- transaction ID
- idempotency
- stock movement
- payment
- accounting entries
- audit event

---

# 16. DOCTOR APPROVAL SYSTEM

Use a formal server-authoritative approval model:

```text
Staff
 ↓
Sensitive action request
 ↓
VPS creates ApprovalRequest
 ↓
Doctor Mobile receives notification
 ↓
Doctor approves/rejects
 ↓
VPS records decision
 ↓
Desktop receives decision
 ↓
Operation proceeds
```

Possible approvals:
- editing finalized transactions
- historical stock changes
- deletion
- high discounts
- financial adjustments
- stock write-offs
- reopening closed periods
- privileged configuration changes

Never implement approval as a LocalStorage boolean.

---

# 17. OFFLINE DOCTOR APPROVAL

If offline approval is required, do NOT simply store:

```text
approved=true
```

in local storage.

Evaluate a secure offline authorization mechanism using protected device storage and cryptographic approval/signature, request ID, scope, timestamp, and one-time nonce.

The exact design must be threat-modelled before implementation.

---

# 18. ACTIVITY MONITORING / AUDIT

Monitor authorized activity such as:
- login/logout
- patient registration
- consultation
- prescription
- sale
- purchase
- payment
- refund
- stock adjustment
- transfer
- invoice
- approval
- rejected approval
- failed login
- permission changes
- backup
- restore
- deletion
- factory reset

Audit fields should include:
```text
user
role
device
action
entity
entity_id
timestamp
mutation_id
correlation ID
result
```

Never log passwords, tokens, API keys, or private keys.

---

# 19. PRESCRIPTION PHOTO WORKFLOW

Required:

```text
Doctor takes/selects prescription photo
        ↓
Associates patient
        ↓
Available locally immediately
        ↓
If online → secure upload to VPS
If offline → encrypted local pending upload
        ↓
reconnect → sync
        ↓
patient record attachment
```

Also support:

```text
Doctor sends/assigns prescription image to authorized counter workflow
        ↓
staff identifies patient
        ↓
attachment added to patient record
        ↓
stored locally + VPS
```

WhatsApp must NOT become the system-of-record. It may be an external communication channel only if explicitly implemented later.

---

# 20. DOCUMENT / IMAGE STORAGE

Prefer:

```text
VPS object/file storage
+
database metadata
+
encrypted local cache
```

Metadata should include:
```text
file_id
patient_id
uploaded_by
created_at
mime_type
size
checksum
storage_key
visibility
```

Access must be authorization-controlled.

---

# 21. BACKUP SYSTEM

Required:

```text
Desktop local backup
+
VPS automated backup
+
Offsite backup
```

### VPS
Automated scheduled database backups.

### Local
Automatically download encrypted backup packages to an approved local backup directory.

### Email
Send a backup file when practical. If too large, send a secure expiring download mechanism instead of huge email attachments.

### Verification
A backup is successful only after:
- checksum verification
- readable archive verification
- schema/version verification
- restore test
- authentication test
- sample business-data test

---

# 22. BACKUP SECURITY

Normal application backups must never contain plaintext:
- VPS passwords
- database passwords
- SSH private keys
- JWT signing secrets
- API private keys

Use encryption, checksums, version metadata, and separate secret provisioning.

---

# 23. RESTORE

Restore must be:

```text
select backup
 ↓
verify checksum
 ↓
verify format/version
 ↓
decrypt
 ↓
validate complete contents
 ↓
restore into staging
 ↓
run integrity checks
 ↓
verify users/auth
 ↓
verify accounting
 ↓
verify inventory
 ↓
verify relationships
 ↓
atomic promotion
```

A failed restore must not leave a half-restored database.

---

# 24. FACTORY RESET

Factory reset and restore are completely different.

Factory reset:
```text
explicit
+
authenticated
+
authorized
+
multi-confirmation
+
backup first
+
audit logged
```

Normal operation:
> Data remains permanently until an authorized deletion/reset occurs.

---

# 25. LEGACY DATA MIGRATION

Treat these as important legacy sources:

```text
DrCreate.xlsm
AshrafKhan.accdb
Cache folder
pictures/assets
existing Clinicore repository
```

The approximately two-year-old data is **historical production data, not demo data**.

It must be imported into the new system while remaining editable subject to appropriate permissions/auditing.

Migration:

```text
Legacy data
→ staging/import database
→ validation
→ mapping
→ preview
→ correction
→ approved import
→ canonical database
```

Never directly import raw legacy data into production without staging.

---

# 26. LEGACY IMPORT TOOL

Build an import utility supporting:
- Excel
- Access
- CSV where necessary

Generate:
- import report
- rejected rows
- duplicate report
- missing-reference report
- mapping report
- validation errors
- successful record count

Never silently discard records.

---

# 27. LEGACY DATA EDITABILITY

Historical data can remain editable, but:
- financial edits must be audited
- finalized records should use controlled amendment/reversal
- stock corrections should use adjustment transactions
- historical changes require appropriate permissions
- destructive deletion is restricted

Never silently rewrite accounting history.

---

# 28. DEMO DATA

Strict separation:

```text
DEMO DATA
≠
DEVELOPMENT FIXTURES
≠
SYSTEM CONFIGURATION
≠
PRODUCTION DATA
```

Production startup must never silently create fake patients, sales, medicines, accounts, or transactions.

---

# 29. DATA SYNC

Use a durable server-side monotonic change sequence.

Example:

```text
Client B
   ↓
GET /sync/pull?cursor=1842
   ↓
Server
   ↓
changes 1843..1850
   ↓
next_cursor=1850
```

Client advances cursor only after safely applying changes.

If sync fails, retain previous cursor and retry.

---

# 30. CONFLICT CONTROL

Use:
```text
record version
+
mutation ID
+
idempotency key
+
server timestamp
+
client ID
```

Never use naive last-write-wins for:
- accounting
- stock
- payments
- financial transactions
- finalized invoices
- day closing

Use domain-specific conflict rules.

---

# 31. GLOBAL DATA GUARANTEE

If two authorized clients connect to the same Clinicore organization:

```text
CLIENT A
    ↓
VPS
    ↓
DATABASE
    ↑
    |
CLIENT B
```

They must ultimately observe the same canonical business state, subject only to legitimate permissions/scopes.

Mandatory test:

```text
Client A creates patient
→ server commits

Client B automatically syncs
→ patient appears

Client B updates
→ server commits

Client A automatically syncs
→ updated patient appears
```

No hard refresh.
No Ctrl+Shift+R.
No manual import/export.

---

# 32. CACHE LOSS GUARANTEE

On a test client:

```text
delete local database/cache
→ reinstall application
→ login
→ connect VPS
→ rebuild local database
→ all authorized server data returns
```

If this fails, the system is not server-authoritative.

---

# 33. MULTI-DEVICE TEST MATRIX

Test:
```text
Desktop A online
Desktop B online

Desktop A offline
Desktop B online

Desktop A online
Desktop B offline

Both reconnect

Doctor mobile online
Doctor mobile offline

Application restart
Windows restart
Network interruption
VPS temporary outage
API temporary outage
duplicate request
partial failure
```

---

# 34. SAFE APPLICATION UPDATE

Updates must NEVER erase business data.

```text
new version
↓
download
↓
verify
↓
install
↓
preserve SQLite
↓
preserve outbox
↓
migrate DB transactionally
↓
restart
↓
continue
```

If migration fails, recovery/rollback must be possible.

---

# 35. NO BROWSER CACHE DEPENDENCY

The new desktop application must not depend on:
- Chrome LocalStorage
- Chrome IndexedDB
- browser cache
- service workers

for business persistence.

The desktop app owns its local SQLite database.

---

# 36. SECURITY

Implement:
- secure authentication
- server-side authorization
- RBAC
- device/session management
- rate limiting
- secure password hashing
- secure token/session handling
- audit logs
- encrypted transport
- encrypted sensitive local data
- backup encryption
- secret management
- no credentials in Git
- no credentials in installers
- no credentials in normal backups
- no VPS secrets in frontend code

---

# 37. VPS DEPLOYMENT

Target:

```text
Internet
   ↓
HTTPS
   ↓
Reverse Proxy
   ↓
Node.js API
   ↓
PostgreSQL
```

Use systemd or another appropriately managed deployment mechanism.

Do not expose PostgreSQL directly to the public internet without an explicit justified design.

---

# 38. API SECURITY

Every API request must validate:
```text
authentication
authorization
tenant/clinic scope
input schema
mutation ID
rate limits where relevant
```

A modified client must not be able to promote itself to admin.

---

# 39. BUSINESS LOGIC MIGRATION

Before replacing PHP, extract/document business rules from:
- current repository
- tests
- Excel
- Access
- reports
- UI workflows
- calculations
- invoices
- stock logic

Then implement equivalent/new TypeScript domain services.

Do NOT blindly translate PHP line-by-line.

Goal:

```text
same business capability
+
corrected architecture
+
better integrity
```

---

# 40. FUNCTIONAL PARITY

Preserve the business functionality already established in Clinicore, subject to forensic confirmation:

- OPD
- patient registration
- token/queue
- doctor consultation
- vitals
- EMR
- prescriptions
- medicine inventory
- batch/expiry
- FEFO
- pharmacy POS
- wholesale
- warehouse
- GRN/purchases
- sales
- returns
- transfers
- payments
- party ledger
- supplier ledger
- patient ledger
- cashbook
- expenses
- day closing
- accounting
- invoices
- thermal printing
- reports
- audit logs
- RBAC
- approvals
- backup/restore
- offline operation
- synchronization

Do not promise parity before auditing the actual current implementation.

---

# 41. CALCULATION OWNERSHIP

Create a dedicated deterministic calculation/domain layer for:
- pricing
- discounts
- taxes where applicable
- invoice totals
- stock quantities
- FEFO allocation
- ledger balances
- cashbook
- day closing
- profit/loss
- inventory valuation

Use decimal-safe financial calculations.

---

# 42. PORTALS

Keep logical areas separated:

```text
Doctor
Reception
Pharmacy
POS
Warehouse
Wholesale
Accounts
Admin
Super Admin
Reports
```

Permissions determine access.

Do not duplicate business logic between portals.

---

# 43. BRANDING / ASSETS

Final software identity:

**H/DR. ASIF ASHRAF KHAN CLINIC**

Inspect the provided Cache/assets directory for:
- logos
- clinic photos
- icons
- branding
- prescription assets
- print assets

Use real provided assets where available.

Do not invent branding when real assets exist.

---

# 44. CONTEXT PACKAGE

Before coding, create:

```text
CLINICORE_NEW_ARCHITECTURE/
```

with:

```text
00_EXECUTIVE_CONTEXT.md
01_CURRENT_SYSTEM_FORENSICS.md
02_BUSINESS_MODULES.md
03_LEGACY_DATA_MAP.md
04_ACCOUNTING_RULES.md
05_INVENTORY_RULES.md
06_PERMISSIONS_RBAC.md
07_APPROVAL_WORKFLOW.md
08_SYNC_ARCHITECTURE.md
09_BACKUP_RESTORE.md
10_SECURITY_MODEL.md
11_DESKTOP_ARCHITECTURE.md
12_MOBILE_ARCHITECTURE.md
13_API_CONTRACT.md
14_DATABASE_SCHEMA.md
15_MIGRATION_PLAN.md
16_TEST_PLAN.md
17_DEPLOYMENT_PLAN.md
18_ASSET_CATALOG.md
19_DECISIONS.md
```

This becomes the authoritative project context for future agents.

---

# 45. SOURCE MATERIAL TO INSPECT

Inspect all available:
```text
Current Clinicore repository
DrCreate.xlsm
AshrafKhan.accdb
Cache folder
pictures/assets
existing documentation
existing tests
existing reports
existing invoices
existing database/schema
```

Referenced local paths:

```text
E:\Soft\DrCreate\ClinicFlow\Cache
E:\Soft\DrCreate\ClinicFlow\Cache\DrCreate.xlsm
E:\Soft\DrCreate\ClinicFlow\Cache\AshrafKhan.accdb
```

If the agent can access these paths, inspect them directly.

If not, create `IMPORT_REQUIRED.md` and explicitly state what is unavailable.

Never claim a file was inspected if it was not accessible.

---

# 46. AGENT TEAM

Use sub-agents:

1. Current application forensic analyst
2. Excel/Access migration analyst
3. Accounting architect
4. Inventory/POS/warehouse architect
5. Backend/API architect
6. Database architect
7. Offline synchronization specialist
8. Desktop/Tauri specialist
9. Mobile/doctor app specialist
10. Security/RBAC specialist
11. Backup/disaster-recovery specialist
12. QA/E2E specialist
13. UI/UX/branding specialist
14. DevOps/VPS specialist

Do not allow incompatible independent architectures.

All major decisions must flow into:

```text
19_DECISIONS.md
```

---

# 47. ARCHITECTURE DECISION GATE

Before full implementation produce a decision report answering:

1. PostgreSQL vs MongoDB?
2. Tauri vs Electron?
3. React Native/Expo vs alternative?
4. SQLite design?
5. Offline sync design?
6. Conflict model?
7. Accounting transaction model?
8. Approval model?
9. Image storage?
10. Backup/offsite strategy?
11. Restore strategy?
12. Legacy migration?
13. Doctor authentication?
14. Permission enforcement?
15. Safe update mechanism?

Do not start full implementation until the decision report is internally consistent.

---

# 48. IMPLEMENTATION PHASES

## Phase 0 — Preservation
- recovery branch/tag
- verified current DB backup
- preserve legacy files

## Phase 1 — Context/Forensics
- repository
- Excel
- Access
- assets
- business rules
- calculations

## Phase 2 — Architecture
- database choice
- desktop choice
- mobile choice
- API
- sync
- schema

## Phase 3 — New Backend
- Node.js/TypeScript
- authentication
- authorization
- database
- migrations
- domain services
- accounting
- inventory
- audit
- sync

## Phase 4 — Desktop
- installer
- SQLite
- offline workflows
- outbox
- synchronization

## Phase 5 — Core Modules
- patients
- visits
- OPD
- pharmacy
- inventory
- warehouse
- POS
- wholesale
- accounting
- invoices
- reports

## Phase 6 — Doctor Mobile
- authentication
- approvals
- notifications
- monitoring
- prescription/photo workflow

## Phase 7 — Backup/Restore
- VPS backup
- local backup
- offsite/email
- restore verification

## Phase 8 — Legacy Migration
- staging
- Excel import
- Access import
- mapping
- validation
- correction
- final import

## Phase 9 — Security
- RBAC
- audit
- sessions
- approval security
- secrets

## Phase 10 — E2E
- two desktops
- desktop + mobile
- offline/online
- simultaneous transactions
- restore
- cache loss
- update

## Phase 11 — Production
- VPS
- HTTPS
- API
- database
- backups
- monitoring
- installers

## Phase 12 — Certification
Only after real-world tests pass.

---

# 49. ZERO-DATA-LOSS ACCEPTANCE TESTS

Mandatory:

```text
Desktop A creates patient
→ Desktop B automatically sees it

Desktop B edits patient
→ Desktop A automatically sees it

Desktop A loses local DB
→ reinstall/login
→ server data returns

Desktop goes offline
→ creates transaction
→ reconnects
→ exactly one server-side effect

Backup
→ disposable environment destruction
→ restore
→ same users/auth/permissions/data

Accounting reconciles
Inventory reconciles
Audit trail reconciles
```

Only then:

```text
PRODUCTION READY
```

---

# 50. ANTI-REGRESSION RULE

Never accept:

```text
"tests pass"
```

as proof of production readiness.

Required:

```text
automated tests
+
real database tests
+
real API tests
+
two-client tests
+
offline tests
+
restore tests
+
installer tests
+
doctor mobile tests
+
production environment tests
```

---

# 51. FINAL SUCCESS CONDITION

The finished system behaves as:

```text
                ONE CLINICORE SYSTEM
                       |
              VPS / PostgreSQL
                       |
          +------------+------------+
          |                         |
      Desktop                    Doctor App
          |
      Local SQLite
          |
      Offline Outbox
```

Users can work offline, restart the app/computer, reconnect, and synchronize without data loss.

Other authorized users receive canonical updates automatically.

Doctor approvals are server-authoritative when online and securely handled offline where required.

Backups exist locally, on VPS, and through an offsite strategy.

Restore reproduces:
- business data
- users
- permissions
- accounting history
- inventory history

---

# 52. ABSOLUTE ANTIGRAVITY RULE

Do not optimize for speed.

Optimize for correctness and evidence.

If uncertain:

```text
STOP
→ investigate
→ document evidence
→ decide
→ implement
```

Do not guess.
Do not invent missing data.
Do not delete old data to make tests pass.
Do not declare success because the UI looks correct.

The VPS database is the shared canonical source of truth.
Installed applications provide reliable offline working copies and durable synchronization.

**BEGIN WITH PHASE 0 AND PHASE 1 ONLY.**

Do not begin full implementation until the forensic/context package and architecture decision report are complete and internally consistent.
