# ClinicFlow Backend Security & Development Rules

## MANDATORY: These rules MUST be followed when writing ANY backend code for ClinicFlow.

### Authentication & Passwords
- NEVER store passwords in plaintext. Use bcrypt with minimum 12 salt rounds.
- NEVER send JWT tokens in response body. Use httpOnly, Secure, SameSite=Strict cookies.
- NEVER expose password hashes in API responses. Strip `password` field from all user queries.
- Access tokens MUST expire in 15 minutes maximum. Use refresh tokens for session renewal.
- Login endpoints MUST use rate limiting (5 attempts per 15 minutes per IP).
- Login error messages MUST be generic ("Invalid credentials") — never reveal if email exists.

### API Security
- EVERY API endpoint MUST have authentication middleware (`auth`) unless it's login/register.
- EVERY API endpoint MUST have role authorization (`authorize('owner', 'doctor')`) with specific roles.
- EVERY API endpoint MUST validate request body/params/query using Zod schemas.
- NEVER use `*` in CORS origin. Whitelist the exact frontend domain only.
- ALWAYS use `helmet()` middleware for security headers.
- ALWAYS return standardized response format: `{ success: bool, data/error: ... }`.

### Database & SQL
- NEVER use string concatenation/template literals for SQL queries.
- ALWAYS use parameterized queries or ORM (Prisma/Knex).
- ALWAYS use foreign keys with proper cascading rules.
- Store currency as INTEGER (paisa/cents), NEVER as float/decimal.
- Every table MUST have `id` (UUID), `created_at`, `updated_at`.
- Use soft deletes (`deleted_at`) for patients, visits, and financial records.

### Input Validation
- ALL string inputs MUST be trimmed and length-limited.
- Phone numbers MUST match Pakistani format: `/^03\d{9}$/`.
- CNIC MUST match format: `/^\d{5}-\d{7}-\d{1}$/`.
- Emails MUST be lowercased and format-validated.
- Numbers MUST have min/max range validation.
- IDs MUST be validated as UUID format.

### Error Handling
- NEVER return stack traces in production responses.
- ALWAYS log errors server-side with context (path, method, userId, IP).
- NEVER log passwords, tokens, or API keys.
- Use global error handler middleware as the last middleware.

### Secrets & Environment
- ALL secrets (DB URL, JWT secret, API keys) MUST be in `.env` file.
- `.env` MUST be in `.gitignore`. NEVER commit it.
- Commit `.env.example` with placeholder values only.
- NEVER hardcode API keys, passwords, or secrets in source code.

### New Feature Checklist
When adding any new feature, ALWAYS verify:
1. Zod validation schema exists for every new endpoint
2. Auth middleware is applied to every protected route
3. Role authorization is applied with correct role list
4. All user inputs are sanitized (trim, max length, type check)
5. Correct HTTP status codes are returned (201 for create, 204 for delete, etc.)
6. No sensitive data appears in API responses
7. Error cases are handled (not found, duplicate, unauthorized)
8. Build passes with zero errors

### Settings & Admin Routes
- `/api/settings/*` endpoints are OWNER-ONLY. Use `authorize('owner')`.
- `/api/users/*` management endpoints are OWNER-ONLY.
- Database reset/restore endpoints are OWNER-ONLY with double confirmation.
- Staff cannot modify their own role or is_owner flag.

### ClinicFlow-Specific Rules
- Clinic data is scoped by `clinic_id`. ALWAYS filter queries by the user's clinic_id.
- Patients, visits, sales, inventory are ALL clinic-scoped. Never return cross-clinic data.
- OPD token numbers reset daily. Generate per-clinic, per-date sequential tokens.
- Financial data (fees, sales, purchases) requires `can_view_financials` or `is_owner` permission.
- Shift closings are immutable once locked. No updates or deletes on locked records.
