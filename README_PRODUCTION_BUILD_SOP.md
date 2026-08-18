# ClinicFlow Production Build SOP

**Use this file after the doctor accepts the demo.** This SOP supersedes conflicting technology guidance elsewhere in the repository: ClinicFlow will use **React + PHP 8.2+/PDO + MySQL 8 on Hostinger-compatible hosting** unless a written architecture decision changes it.

## 1. Non-negotiable production boundaries

- No real patient, photo, financial, inventory, or staff data in browser `localStorage`.
- PHP API is the only writer to MySQL and file storage.
- Every API query is scoped by authenticated `clinic_id`.
- Use PHP password hashing (`password_hash` / Argon2id or bcrypt); never use the demo `djb2` hash.
- Sessions/tokens use secure, httpOnly, Secure, SameSite cookies; never expose secrets to React.
- Server-side RBAC is mandatory. UI hiding is not authorization.
- Store currency in integer paisa. Financial data uses append-only transactions; records are voided, not silently deleted.
- Every sensitive change is recorded in an audit log.

## 2. Required production architecture

```text
React SPA
  -> HTTPS /api
PHP 8.2 API (auth, authorization, validation, services)
  -> MySQL 8 (transactional data)
  -> private file storage (prescription/report images)
  -> encrypted backups + monitoring/logs
```

Use a versioned REST API (`/api/v1`). Keep React API adapters separate from business logic so the demo local adapter can be replaced gradually.

## 3. Database schema requirements

All business tables require: UUID `id`, `clinic_id` where applicable, `created_at`, `updated_at`, `created_by`, and an appropriate index. Patients, visits, financial records and stock records need `deleted_at` or a separate void/adjustment flow.

### Required domains

1. Identity: clinics, users, roles/permissions, refresh sessions.
2. Clinical: patients, patient identifiers, visits, queue entries, prescription photos, report photos, procedures, follow-ups.
3. Pharmacy: products, batches, stock locations, stock movements, suppliers, purchase invoices/items, sales invoices/items, returns.
4. Finance: accounts, financial transactions, payments, receivables/payables, expenses, shifts, shift closings, bank deposits.
5. Governance: audit logs, attachments, notifications, backups, import jobs.

### Key constraints

- Unique token: `(clinic_id, doctor_id, queue_date, token_number)`.
- Patient search indexes: `(clinic_id, phone)`, `(clinic_id, full_name)`, `(clinic_id, relation_name)`.
- Invoice/receipt numbers must be generated in a database transaction.
- Sale, stock movement, and financial post must commit or roll back together.
- Product batches must include quantity, purchase cost, expiry date, and location.

## 4. API and security SOP

1. Write OpenAPI/API contract first: endpoint, role, request, validation, response, error, and financial/stock side effect.
2. Authenticate every endpoint except login/password reset/public queue display.
3. Authorize every endpoint by role and permission. Examples: reception registers visits; doctor completes only their own visit; pharmacist cannot read patient clinical records; owner controls staff, settings, adjustments, backups.
4. Validate server-side: trimmed strings, Pakistani phone/CNIC formats, amount bounds, UUIDs, dates, allowed state transitions and file MIME/size.
5. Use PDO prepared statements only. No SQL string concatenation.
6. Protect login against enumeration and rate-limit it. Return generic login errors.
7. Store images outside the public web root; use random names, virus/MIME/size checks, signed/authorized downloads, and retention rules.
8. Log errors without passwords, tokens, CNIC, or medical details.
9. Set exact CORS origin, HTTPS-only cookies, CSP/security headers and production error masking.

## 5. Build order and quality gates

| Gate | Deliverable | Must pass before next gate |
|---|---|---|
| 0 | Signed workflow/spec + report/print samples | No unresolved workflow or financial rule. |
| 1 | Schema migrations + seed fixture | Migrations run on empty DB and rollback safely. |
| 2 | Auth/RBAC/audit framework | Unauthorized-role and cross-clinic tests fail safely. |
| 3 | Patient/queue/photo APIs | Atomic token test and photo authorization test pass. |
| 4 | Finance/inventory APIs | Receipt, return, stock and EOD reconciliation tests pass. |
| 5 | React API migration | No localStorage business-data reads/writes remain. |
| 6 | Import tool | Dry-run report and reconciliation signed by owner. |
| 7 | Pilot + parallel run | 2–4 weeks with no unresolved balance/stock discrepancies. |
| 8 | Go-live | Backup restore and rollback drill pass. |

## 6. Tests required before production

- Unit tests: money posting, stock movements, token sequence, discount/refund limits.
- API tests: validation, role access, cross-clinic isolation, concurrency/duplicate token and oversell prevention.
- E2E tests: registration to completed visit, pending-report upload, POS sale/return, purchase, EOD close, backup restore.
- Manual tests: actual printers, mobile camera permissions, slow internet, denied camera, upload failure, logout/session expiry.
- Disaster drill: restore yesterday's backup into a clean environment and reconcile counts.

## 7. Data migration SOP

1. Obtain a read-only copy of legacy Access/Excel data and list every table/field.
2. Define mapping, cleaning rules, and an `unmapped` exception report before importing.
3. Import into a staging database only; preserve legacy IDs in `legacy_source_id` fields.
4. Reconcile patient count, stock by item, account balances, receivables/payables, and daily totals against the legacy system.
5. Owner signs the reconciliation report. Only then run the production import in a scheduled cutover window.
6. Keep legacy data read-only and recoverable; never delete it during the first 12 months.

## 8. Operations SOP after launch

- Daily: verify automated backup job, failed uploads, low/expired stock, and previous shift variance.
- Weekly: review audit log exceptions, user accounts, failed logins, unclosed shifts, backup retention.
- Monthly: restore-test a backup, review access/permissions, release tested updates, send doctor a short usage/report summary.
- Incident: stop harmful action, preserve logs, inform owner, restore/reconcile if required, document root cause and preventive change.

## 9. AI/developer change-control template

Every pull request/task must state: purpose, roles, schema migration, API contract, validation, permission check, financial/stock effect, tests, rollout plan, rollback plan, and documentation update. No feature may be merged with an unexplained P0/P1 audit issue, secret, direct production data edit, or failed test.
