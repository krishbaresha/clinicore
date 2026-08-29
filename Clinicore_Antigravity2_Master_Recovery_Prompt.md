# CLINICORE --- MASTER RECOVERY, VPS-SOURCE-OF-TRUTH & PRODUCTION STABILIZATION PLAN

## Antigravity 2 --- Multi-Agent Execution Prompt

> **MISSION:** Recover Clinicore from the current broken state,
> establish the VPS/MySQL backend as the authoritative source of truth,
> preserve safe offline/local caching, repair authentication and
> backup/restore semantics, eliminate demo/seed data without destroying
> real data, fix the production black-screen deployment, and only then
> certify the system.
>
> **IMPORTANT:** This document supersedes the previous "100% production
> ready" claim. The previous certification must be treated as
> **UNVERIFIED** until independently reproduced from the actual
> repository, running application, production build, VPS, database, and
> browser.

------------------------------------------------------------------------

# 0. NON-NEGOTIABLE RULES

## STOP FEATURE DEVELOPMENT

Do not add new business features until the system is stable.

Do not continue cosmetic polish, refactoring, or architecture expansion
while critical production defects exist.

## DO NOT TRUST PREVIOUS CERTIFICATION

The previous report claimed:

-   637/637 tests
-   42 suites
-   zero secrets
-   production-ready
-   offline-first sync
-   financial integrity
-   backup/restore
-   RBAC
-   production build

Those claims are evidence to investigate, NOT proof.

If an actual runtime workflow fails, mark the relevant certification as
failed regardless of previous test results.

## DATA SAFETY

NEVER:

-   delete production MySQL data
-   truncate tables
-   reset the production database
-   clear production LocalStorage
-   delete production IndexedDB
-   overwrite user data with demo data
-   run destructive migrations without a verified backup
-   silently replace real accounts with seed accounts
-   modify passwords just to make login pass
-   remove auth/security controls to bypass a bug

Before any destructive operation:

1.  make a verified backup
2.  verify the backup can be read
3.  document exactly what will change
4.  use a disposable/staging environment first
5.  obtain explicit approval for production destruction

------------------------------------------------------------------------

# 1. CURRENT PROBLEMS TO SOLVE

The current system has the following known issues:

### A. Production website is broken

`clinicore.me` currently shows a black screen.

Localhost can load/run the application.

Therefore investigate the difference between:

-   Vite development mode
-   production build
-   production preview
-   VPS deployment
-   Nginx
-   HTTPS
-   API
-   service worker/PWA cache
-   environment configuration
-   browser runtime errors

Do not assume the React application itself is completely broken.

### B. Demo data was removed and the application became unstable

The previous implementation contained demo/seed data.

An attempt was made to remove the demo data, after which the application
became broken.

Determine exactly:

-   which demo data existed
-   where it was seeded
-   whether seed code is mixed with production initialization
-   whether demo data was accidentally used as required configuration
-   whether deleting demo records removed required
    reference/configuration records
-   whether authentication depended on seed accounts
-   whether migrations expected seed records
-   whether foreign keys/reference IDs now point to missing records

The goal is:

> REMOVE DEMO CONTENT WITHOUT REMOVING REQUIRED SYSTEM CONFIGURATION.

### C. Data is currently being treated as local-first when the desired business model is server-authoritative

Current architecture documentation describes LocalStorage/IndexedDB plus
an offline sync engine.

That is useful for offline resilience, but the desired production
behavior is:

> VPS/MySQL is the authoritative canonical database for persistent
> business records.

The browser's LocalStorage/IndexedDB must NOT become an independent
permanent database that can silently diverge from the VPS.

### D. Required data lifecycle

Desired model:

``` text
              AUTHORITATIVE
              VPS / MySQL
                   │
                   │ initial sync / snapshot
                   ▼
        Browser Local Cache
        IndexedDB / LocalStorage
                   │
                   │ user action
                   ▼
             Mutation Queue
                   │
             ONLINE NOW?
              /         \
            YES          NO
             │            │
             ▼            ▼
         VPS API       Durable Outbox
             │            │
             └──────┬─────┘
                    │
                 Retry/Sync
                    │
                    ▼
              VPS / MySQL
                    │
              canonical state
                    │
                    ▼
             Client refresh
```

The exact implementation may differ, but the invariants below are
mandatory.

------------------------------------------------------------------------

# 2. TARGET DATA ARCHITECTURE

## 2.1 VPS IS THE SOURCE OF TRUTH

For permanent business data:

``` text
MySQL on VPS = canonical authoritative state
```

The browser cache is:

``` text
performance cache + offline working set + durable outbox
```

It is NOT the ultimate authority.

## 2.2 ONLINE ACTION

When the client is online:

``` text
User action
→ validate
→ send mutation to VPS
→ VPS authenticates/authorizes
→ VPS validates
→ MySQL transaction commits
→ server returns canonical result/version
→ client updates local cache
→ UI refreshes automatically
```

Do not rely on:

``` text
write LocalStorage
→ assume success
→ maybe sync later
```

for normal online operations.

## 2.3 OFFLINE ACTION

When the client genuinely cannot reach the VPS:

``` text
User action
→ local validation
→ durable IndexedDB transaction/outbox
→ mark pending
→ continue working
→ reconnect
→ push mutations to VPS
→ server validates
→ idempotency check
→ MySQL commit
→ canonical response
→ mark mutation ACKED
→ update local cache
```

Offline mode is a fallback for continuity, not a replacement for the
server.

## 2.4 NO SILENT LOCAL-ONLY SUCCESS

If an operation is business-critical and online:

-   sale
-   payment
-   purchase
-   stock movement
-   patient registration
-   consultation
-   ledger transaction
-   day closing

the UI must not falsely tell the user that it is permanently saved if
the VPS has not accepted it.

Use clear states such as:

``` text
SAVED TO SERVER
PENDING SYNC
FAILED — RETRY REQUIRED
CONFLICT — REVIEW REQUIRED
```

------------------------------------------------------------------------

# 3. CLIENT CACHE POLICY

Design a clear ownership model.

## Canonical

VPS/MySQL owns:

-   users
-   roles
-   permissions
-   patients
-   visits
-   prescriptions
-   medicines
-   batches
-   warehouses
-   stock movements
-   sales
-   purchases
-   payments
-   ledgers
-   expenses
-   day closings
-   audit records
-   configuration that must be centrally governed

## Local cache

Browser may hold:

-   recently fetched records
-   offline working data
-   UI preferences
-   temporary drafts
-   images/blobs where appropriate
-   pending outbox mutations
-   sync metadata

Do not create two competing canonical databases.

------------------------------------------------------------------------

# 4. AUTHENTICATION --- CRITICAL BUG

Known issue:

> Backup contains login credentials/accounts, but after restoring the
> backup, logging in with those credentials does not open the
> corresponding user account.

Investigate this as a first-class production defect.

Possible causes to inspect, without assuming any:

-   passwords stored differently between local and server
-   account records restored but password hashes not restored
-   account IDs changed
-   role IDs changed
-   user-to-role mapping missing
-   tenant/clinic ID mismatch
-   device binding
-   local session state overriding server authentication
-   server auth checking a different database
-   migration changed password format
-   legacy hash upgrade failure
-   backup excludes auth/config collections
-   restored data exists locally but server database remains unchanged
-   user account exists in MySQL but API authentication points elsewhere
-   JWT/session state is stale
-   seed/demo account removal accidentally removed required auth
    configuration

## Required final invariant

A restored backup containing a valid user account must be able to
authenticate through the actual production authentication flow.

Test:

``` text
Create account
→ verify login
→ create backup
→ destroy ONLY disposable test environment
→ restore backup
→ start clean client
→ login with same credentials
→ verify same role
→ verify same permissions
→ verify same relevant data
```

Do NOT test destructive restore against production first.

------------------------------------------------------------------------

# 5. AUTHORITY OF USER ACCOUNTS

User accounts MUST have a clearly defined canonical owner.

Preferred:

``` text
VPS/MySQL
    ↓
users
roles
permissions
sessions/tokens
```

The browser should not be able to invent a privileged account by
modifying LocalStorage.

If offline login is supported, document exactly:

-   what credentials are cached
-   how they are protected
-   what privileges are allowed offline
-   how account revocation propagates
-   how password changes propagate
-   what happens after device loss

Do not claim secure offline authentication without verifying the actual
threat model.

------------------------------------------------------------------------

# 6. BACKUP / RESTORE CONTRACT

A backup must contain everything required to reproduce the intended
application state.

Classify backup contents:

### BUSINESS DATA

-   patients
-   visits
-   prescriptions
-   medicines
-   batches
-   warehouses
-   stock movements
-   sales
-   purchases
-   payments
-   ledgers
-   expenses
-   reports/configuration where applicable

### IDENTITY / GOVERNANCE

-   users
-   roles
-   permissions
-   account status
-   required authentication metadata
-   clinic/tenant identity
-   necessary governance configuration

### SYSTEM CONFIGURATION

Only portable configuration belongs in the backup.

NEVER put:

-   VPS passwords
-   API private keys
-   database passwords
-   JWT signing secrets
-   SSH private keys

into a normal application data backup.

Secrets must be provisioned separately.

## Restore invariant

After restore:

``` text
data state = backed-up state
```

subject only to explicitly documented system-level secrets/environment
values.

------------------------------------------------------------------------

# 7. FACTORY RESET VS RESTORE

These operations MUST be completely different.

## Factory Reset

Means:

> intentionally wipe application/business data and initialize a clean
> installation.

Must be:

-   explicit
-   authenticated
-   authorized
-   heavily confirmed
-   preferably protected by Super Admin controls
-   audited
-   backed up before execution

## Restore Backup

Means:

> replace/reconstruct the current application data with a selected
> backup snapshot.

It must NOT:

-   create random demo accounts
-   silently seed demo data
-   generate new user IDs unexpectedly
-   invalidate restored account credentials
-   lose historical transactions
-   silently skip collections

## Normal operation

Data should persist indefinitely until an authorized permanent
delete/factory-reset operation occurs.

------------------------------------------------------------------------

# 8. DEMO DATA REMOVAL

Create a strict separation:

``` text
DEMO / DEVELOPMENT SEED
        ≠
PRODUCTION INITIALIZATION
        ≠
SYSTEM CONFIGURATION
```

Identify all demo data sources:

-   seed scripts
-   fixtures
-   hardcoded arrays
-   fake users
-   sample patients
-   fake medicines
-   mock sales
-   mock reports
-   development bootstrap logic
-   test database loaders
-   fallback initialization

Remove only actual demo content.

Preserve:

-   required schema metadata
-   permission definitions
-   role definitions
-   application configuration
-   required reference data
-   migration metadata
-   system-level settings

Add a regression test proving:

> production startup never automatically inserts demo business records.

------------------------------------------------------------------------

# 9. PRODUCTION BLACK SCREEN --- PHASE

Before modifying application logic, diagnose the production environment.

## Test A

``` text
npm run dev
```

## Test B

Build production:

``` text
npm run build
```

## Test C

Run exact production artifact locally:

``` text
npm run preview
```

Compare:

### A works + B/C fail

Likely build/config/runtime issue.

### A works + B/C work + domain fails

Likely:

-   VPS
-   Nginx
-   deployment
-   HTTPS
-   asset paths
-   cache
-   service worker
-   environment
-   API/CORS

## Browser checks

Capture FIRST console error.

Inspect:

-   JS 404
-   CSS 404
-   chunk loading errors
-   MIME type errors
-   CORS
-   API 401/403/500/502
-   service worker failures
-   failed dynamic imports

Do not focus only on secondary errors.

------------------------------------------------------------------------

# 10. VITE / PRODUCTION ASSET CHECK

Verify:

-   `vite.config.*`
-   `base`
-   generated `index.html`
-   `/assets/*.js`
-   `/assets/*.css`
-   PWA manifest
-   service worker
-   cache names

Every asset referenced by production `index.html` must exist on the VPS.

No stale `index.html` may reference deleted chunks.

------------------------------------------------------------------------

# 11. NGINX / VPS CHECK

Verify:

-   actual document root
-   actual deployed build directory
-   `index.html`
-   SPA fallback
-   static asset MIME types
-   HTTPS
-   redirects
-   API routing
-   PHP 8.3
-   PHP-FPM
-   MySQL connection
-   CORS
-   response headers
-   cache headers

Confirm that the domain is serving the current build.

Do not merely assume deployment succeeded because the deployment command
returned exit code 0.

------------------------------------------------------------------------

# 12. SERVICE WORKER / PWA UPDATE SYSTEM

The desired behavior includes:

> when a new production version is deployed, the client should update
> automatically without requiring Ctrl+Shift+R and without losing data.

Implement a safe update flow.

Desired lifecycle:

``` text
New build deployed
      ↓
new build/version detected
      ↓
service worker update
      ↓
download new assets
      ↓
verify new assets
      ↓
activate safely
      ↓
reload application automatically
      ↓
preserve user data
```

IMPORTANT:

Never equate:

``` text
hard refresh
```

with:

``` text
data migration
```

An automatic app refresh must NOT clear:

-   IndexedDB
-   LocalStorage
-   pending outbox
-   cached business records
-   authentication state unless security policy requires re-login

## Update safety

Before activating a new client build:

-   ensure pending mutations are safe
-   preserve outbox
-   maintain schema compatibility
-   run migrations transactionally
-   support rollback if migration fails

------------------------------------------------------------------------

# 13. VERSION COMPATIBILITY

Every client mutation should carry enough metadata to detect
incompatible versions, such as:

-   client version
-   build ID
-   schema version
-   device ID
-   mutation ID

Server should reject/handle incompatible clients gracefully.

Do not allow an old browser build to silently corrupt newer server data.

Use:

``` text
CLIENT_TOO_OLD
SCHEMA_MISMATCH
SYNC_REQUIRED
FORCE_RELOAD
```

when necessary.

------------------------------------------------------------------------

# 14. SYNC ENGINE REBUILD / VERIFICATION

The documented system has a 7-state sync FSM and an IndexedDB outbox.

Verify actual implementation, not documentation.

Required states may include:

``` text
IDLE
SYNCING
OFFLINE
DRAINING
CONFLICT
ERROR
PAUSED
```

For every mutation:

``` text
mutation_id
entity
operation
payload
created_at
client_id
client_version
schema_version
status
retry_count
idempotency_key
```

## Idempotency

If the same mutation reaches the VPS twice:

``` text
first request → commit
second request → return original result
```

It must NOT double:

-   charge
-   payment
-   sale
-   stock movement
-   ledger transaction

------------------------------------------------------------------------

# 15. SERVER-FIRST ONLINE TRANSACTIONS

For online operations, prefer:

``` text
UI
 ↓
API
 ↓
server validation
 ↓
MySQL transaction
 ↓
commit
 ↓
canonical response
 ↓
client cache update
```

Do not allow:

``` text
UI
 ↓
LocalStorage write
 ↓
UI says "saved"
 ↓
server maybe syncs later
```

unless the user is genuinely offline.

------------------------------------------------------------------------

# 16. STOCK / INVENTORY SAFETY

Inventory must be server-authoritative when online.

Never calculate final permanent stock by trusting an arbitrary browser
count.

Preferred:

``` text
Stock movement event
→ server transaction
→ MySQL commit
→ canonical balance
```

Offline deltas may be queued, then merged server-side using the verified
conflict model.

Test:

-   two devices online
-   two devices offline
-   simultaneous sale
-   transfer
-   return
-   adjustment
-   reconnect
-   duplicate retry
-   final server balance

------------------------------------------------------------------------

# 17. FINANCIAL SAFETY

For:

-   sale
-   purchase
-   payment
-   refund
-   expense
-   OPD fee
-   reversal
-   adjustment
-   day close

verify:

``` text
API validation
→ MySQL transaction
→ journal entry
→ ledger update
→ audit event
→ canonical response
```

No local-only permanent financial transaction while online.

Test server-side invariants:

``` text
Total Debit = Total Credit
```

and reconcile:

-   patient ledger
-   supplier ledger
-   wholesale party ledger
-   cashbook
-   day closing

------------------------------------------------------------------------

# 18. AUDIT LOGS

Audit logs must identify:

-   user
-   action
-   entity
-   record ID
-   timestamp
-   device/client
-   source/origin
-   before/after where appropriate
-   correlation/mutation ID

Do not expose passwords, tokens, or sensitive secrets in audit logs.

If Merkle chaining is used, verify the chain against actual persisted
records.

------------------------------------------------------------------------

# 19. RBAC / AUTHORIZATION

Authentication answers:

> Who are you?

Authorization answers:

> What are you allowed to do?

Every privileged API endpoint must enforce authorization server-side.

Never rely solely on:

``` text
React route guard
```

for security.

Test:

-   receptionist
-   doctor
-   pharmacist
-   warehouse
-   accountant
-   admin
-   super admin

against unauthorized API calls.

------------------------------------------------------------------------

# 20. LOCAL STORAGE SECURITY

Audit every LocalStorage key.

For each key document:

``` text
purpose
data owner
sensitivity
TTL
server-backed?
safe to delete?
```

Never store unnecessary secrets in LocalStorage.

Do not store privileged server credentials there.

Do not allow a modified browser value to grant elevated permissions.

------------------------------------------------------------------------

# 21. DATABASE / MIGRATION SAFETY

Inspect all migrations.

Every migration must be:

-   versioned
-   idempotent where appropriate
-   tested
-   non-destructive unless explicitly required
-   compatible with existing records

Never assume:

``` text
empty database = normal database
```

Production must work with:

-   empty installation
-   real restored database
-   existing upgraded database

------------------------------------------------------------------------

# 22. SECRET SECURITY

Maintain the previously required security posture:

-   no secrets in Git
-   no secrets in frontend
-   no credentials in scripts
-   no VPS passwords in source
-   no private keys in repository
-   no production `.env` committed
-   Git history scanned
-   production bundle scanned
-   GitHub Actions protected
-   pre-push scanning
-   server secrets stored server-side

If a real secret was ever publicly committed:

``` text
assume compromised
→ replace
→ deploy replacement
→ verify
→ revoke old credential
```

Never print actual secrets in logs or reports.

------------------------------------------------------------------------

# 23. TEST THE ACTUAL PRODUCTION SYSTEM

Do not stop at unit tests.

Required layers:

### Layer 1 --- Static

-   AST
-   lint
-   type/symbol checks

### Layer 2 --- Unit

Business logic.

### Layer 3 --- Integration

Frontend/API/database.

### Layer 4 --- Browser/E2E

Actual UI.

### Layer 5 --- Production smoke

Actual:

`https://clinicore.me`

### Layer 6 --- VPS data verification

Actual MySQL.

### Layer 7 --- Recovery

Backup → restore → login → workflow.

------------------------------------------------------------------------

# 24. MANDATORY END-TO-END TEST MATRIX

## Authentication

-   create user
-   login
-   logout
-   wrong password
-   role verification
-   backup
-   restore
-   login again

## OPD

``` text
patient
→ token
→ doctor queue
→ consultation
→ vitals
→ prescription
→ fee
→ ledger
```

## Pharmacy

``` text
medicine
→ batch
→ purchase
→ GRN
→ stock
→ POS
→ payment
→ return
```

## Wholesale

``` text
party
→ warehouse
→ sale
→ discount
→ credit
→ payment
→ ledger
```

## Offline

``` text
disconnect
→ create patient
→ create transaction
→ close/reopen app
→ reconnect
→ sync
→ verify VPS
```

## Online

``` text
connected
→ create transaction
→ confirm VPS persistence
→ refresh browser
→ verify same record
→ second device
→ verify same record
```

------------------------------------------------------------------------

# 25. CRITICAL SERVER-AUTHORITY TEST

This test is mandatory.

### Test:

1.  Create a record online.
2.  Verify it exists in VPS/MySQL.
3.  Clear ONLY a disposable client's local cache in a test environment.
4.  Reload.
5.  Log in.
6.  Verify the record returns from VPS.
7.  Create another record from a second device.
8.  Refresh first device.
9.  Verify it receives the server record.

Expected:

``` text
Local cache can disappear.
Server data survives.
```

This proves the browser is not the permanent source of truth.

------------------------------------------------------------------------

# 26. AUTO-UPDATE TEST

1.  Deploy Build A.
2.  Open browser.
3.  Create safe test data.
4.  Confirm VPS persistence.
5.  Deploy Build B.
6.  Wait for update mechanism.
7.  Application automatically refreshes.
8.  Do NOT press Ctrl+Shift+R.
9.  Verify Build B loaded.
10. Verify data still exists.
11. Verify pending outbox is preserved.
12. Verify no duplicate transaction occurred.

------------------------------------------------------------------------

# 27. BACKUP / RESTORE TEST

Use staging/disposable environment.

``` text
State A
→ backup
→ create changes
→ restore State A
→ restart server/client
→ login
→ verify all business records
→ verify users/roles
→ verify ledgers
→ verify inventory
→ verify audit history
```

Expected:

``` text
restored state == backup state
```

except explicitly externalized secrets/environment values.

------------------------------------------------------------------------

# 28. FACTORY RESET TEST

Only in disposable environment.

``` text
backup
→ authenticated factory reset
→ verify business data gone
→ verify required system configuration remains
→ verify demo data NOT automatically recreated
→ restore backup
→ verify original state
```

------------------------------------------------------------------------

# 29. PRODUCTION BLACK-SCREEN EXIT CRITERIA

Do not declare production fixed until:

-   `clinicore.me` loads
-   no fatal startup console error
-   JS assets load
-   CSS loads
-   service worker works safely
-   API health is good
-   login works
-   dashboard works
-   OPD works
-   pharmacy works
-   finance works
-   production data persists to VPS
-   browser refresh does not lose data

------------------------------------------------------------------------

# 30. DO NOT USE DEMO DATA TO PROVE PRODUCTION

Tests must clearly distinguish:

``` text
TEST FIXTURE
DEMO DATA
STAGING DATA
PRODUCTION DATA
```

No production acceptance test is valid if it only succeeds because a
demo account or seeded record exists.

------------------------------------------------------------------------

# 31. GIT RECOVERY STRATEGY

Inspect:

-   current HEAD
-   recent commits
-   phase commits
-   last known working commit
-   deployment commits
-   demo-removal commit
-   auth changes
-   storage changes
-   sync changes
-   PWA changes

If a known-good commit exists:

``` text
GOOD COMMIT
    ↓ diff
BROKEN COMMIT
    ↓
REGRESSION
```

Prefer minimal rollback/revert of the offending change over a full
rewrite.

Preserve the current broken state in a branch/tag before risky recovery.

------------------------------------------------------------------------

# 32. SUB-AGENT STRUCTURE

Create these agents:

### Agent 1 --- Production Runtime

Black screen, browser console, asset loading, PWA.

### Agent 2 --- VPS/Nginx

Deployment, document root, HTTPS, PHP, API.

### Agent 3 --- Database

MySQL schema, migrations, persistence, transactions.

### Agent 4 --- Authentication

Users, password hashes, roles, sessions/JWT, backup restore login.

### Agent 5 --- Demo Data

Find all seed/demo sources and safely separate them.

### Agent 6 --- Local Storage

LocalStorage/IndexedDB ownership and persistence.

### Agent 7 --- Sync

Outbox, idempotency, conflict handling, server authority.

### Agent 8 --- Financial

Transactions, ledgers, day closing.

### Agent 9 --- Inventory

Stock, batches, transfers, FEFO.

### Agent 10 --- Backup/Restore

Snapshot completeness and recovery.

### Agent 11 --- Security

Secrets, RBAC, API authorization, logs.

### Agent 12 --- E2E QA

Real browser workflows.

### Agent 13 --- Git Forensics

Identify regression commits and last known-good state.

### Agent 14 --- Release Manager

Coordinates all agents and blocks unsafe changes.

------------------------------------------------------------------------

# 33. AGENT RULE

Every agent must report:

``` text
OBSERVED
PROVEN
SUSPECTED
UNVERIFIED
```

Never convert suspicion into fact.

No agent may claim:

"fixed"

without reproducing the original failure and showing the post-fix
result.

------------------------------------------------------------------------

# 34. CHANGE CONTROL

Before changing a file:

1.  identify why it is involved
2.  inspect current implementation
3.  inspect callers
4.  inspect tests
5.  inspect related backend/API behavior
6.  make smallest safe change
7.  run targeted tests
8.  run integration tests
9.  run production build
10. manually verify

Do not make broad automated rewrites.

------------------------------------------------------------------------

# 35. REGRESSION TESTS

Every discovered bug must receive a regression test where practical.

Examples:

``` text
demo removal must not break login

restored user credentials must authenticate

online transaction must reach VPS

browser cache loss must not lose server data

new deployment must auto-update

service worker must not serve incompatible chunks

duplicate sync mutation must not duplicate billing

factory reset must not accidentally run during normal startup
```

------------------------------------------------------------------------

# 36. FINAL CERTIFICATION RULE

The previous:

> "100% PRODUCTION READY"

statement is revoked until this recovery plan passes.

Final statuses:

## PASS

All critical workflows work in actual production.

## CONDITIONAL PASS

Only non-critical known issues remain and are explicitly documented.

## FAIL

Any critical workflow is broken.

Critical includes:

-   login
-   data persistence
-   VPS connectivity
-   patient records
-   pharmacy transactions
-   stock
-   finance
-   backup/restore
-   production startup
-   data integrity

------------------------------------------------------------------------

# 37. FINAL REPORT FORMAT

Return:

## A. Root Causes

Exact root cause for each known issue.

## B. Changes

Exact files changed.

## C. Data Safety

State whether any production data was modified/deleted.

## D. Architecture

Explain final:

``` text
VPS/MySQL
↓
API
↓
Client cache
↓
Offline outbox
```

and which layer is authoritative.

## E. Authentication

Explain:

``` text
backup
→ restore
→ same account
→ same credentials
→ successful login
```

with evidence.

## F. Demo Data

List what was removed and what required system configuration was
preserved.

## G. Production

Report:

-   domain
-   HTTP/HTTPS
-   build
-   JS assets
-   API
-   database
-   PWA
-   auto-update

## H. Tests

Give actual numbers only.

Do not manufacture test counts.

## I. Manual E2E

  Workflow             Result
  -------------------- -----------
  Production startup   PASS/FAIL
  Login                PASS/FAIL
  Patient              PASS/FAIL
  OPD                  PASS/FAIL
  Pharmacy             PASS/FAIL
  Inventory            PASS/FAIL
  Wholesale            PASS/FAIL
  Finance              PASS/FAIL
  Backup               PASS/FAIL
  Restore              PASS/FAIL
  Restored login       PASS/FAIL
  Offline              PASS/FAIL
  Sync                 PASS/FAIL
  Auto-update          PASS/FAIL
  Printing             PASS/FAIL

## J. Final Gate

Return exactly one:

`PASS`

`CONDITIONAL PASS`

`FAIL`

------------------------------------------------------------------------

# 38. EXECUTION ORDER

Antigravity MUST execute in this order:

``` text
PHASE 0
Freeze feature development

PHASE 1
Create recovery branch/tag + backup

PHASE 2
Reproduce production black screen

PHASE 3
Identify last known-good commit

PHASE 4
Audit demo-data removal regression

PHASE 5
Audit authentication and restored-login failure

PHASE 6
Verify VPS/MySQL canonical persistence

PHASE 7
Repair client cache / offline architecture

PHASE 8
Repair sync + idempotency

PHASE 9
Repair backup/restore semantics

PHASE 10
Repair factory-reset semantics

PHASE 11
Repair PWA automatic update

PHASE 12
Repair Nginx/VPS production deployment

PHASE 13
Run security/secrets verification

PHASE 14
Run integration tests

PHASE 15
Run real browser E2E

PHASE 16
Run staging backup/restore

PHASE 17
Run controlled production smoke test

PHASE 18
Final independent certification
```

------------------------------------------------------------------------

# 39. MOST IMPORTANT SUCCESS CONDITION

The final application must behave like this:

``` text
                 ┌──────────────────┐
                 │   VPS / MySQL    │
                 │ AUTHORITATIVE DB │
                 └────────┬─────────┘
                          │
                    HTTPS API
                          │
                          ▼
                 ┌──────────────────┐
                 │ Clinicore Client │
                 │ React/PWA        │
                 └────────┬─────────┘
                          │
             ┌────────────┴────────────┐
             │                         │
          ONLINE                    OFFLINE
             │                         │
             ▼                         ▼
       Save to VPS              Save pending mutation
             │                         │
             ▼                         │
       Canonical response             │
             │                         │
             └────────────┬────────────┘
                          ▼
                     Local cache
                          │
                          ▼
                  Automatic refresh
                  when new build arrives
                          │
                          ▼
                  NO DATA LOSS
```

## FINAL PRINCIPLE

**The browser is allowed to cache.**

**The browser is allowed to work offline.**

**The browser is NOT allowed to become the permanent authoritative
database for business data.**

**The VPS/MySQL database is the canonical source of truth.**

Every online business action must ultimately be committed to VPS/MySQL.

Every offline action must be durably queued and later committed to
VPS/MySQL.

A new frontend build must update automatically without Ctrl+Shift+R and
without clearing business data.

A backup restore must restore both business state and the user/account
state necessary for authentication.

Normal application operation must never behave like factory reset.

Permanent deletion must occur only through an explicit authorized
destructive operation.

And no production certification is valid until the actual production
website, VPS, database, authentication, sync, backup/restore, and
browser workflows have been manually verified.

**START WITH PHASE 0. DO NOT SKIP THE FORENSIC/DIAGNOSTIC STEPS.**
