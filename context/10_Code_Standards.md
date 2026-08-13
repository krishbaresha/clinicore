# ClinicFlow — Code Standards

> **Purpose:** This defines HOW code should be written (structure, naming, style) — different from `08_AI_Rules_and_Constraints.md` which defines HOW the AI should think/behave (don't guess, don't scope-creep). Follow both together.

---

## 1. Folder Structure (frontend)

```
src/
  components/       → reusable UI pieces (Button, Card, Table, Sidebar, StatCard)
  pages/            → one file per screen, matching sitemap names exactly
                       (Dashboard.jsx, PatientsList.jsx, PatientProfile.jsx, etc.)
  layouts/          → shared layout wrappers (SidebarLayout.jsx)
  api/              → all backend calls live here, grouped by entity
                       (patients.js, visits.js, store.js, auth.js)
  hooks/            → custom React hooks
  utils/            → formatting helpers (formatDate, formatCurrency)
  styles/           → global CSS/Tailwind config, design tokens
```

## 2. Folder Structure (backend)

```
src/
  routes/           → one file per entity (patients.js, visits.js, store.js, auth.js)
  controllers/      → business logic per route
  models/           → database schema definitions, matching TRD entity names exactly
  middleware/       → auth checks, role checks, error handler
  utils/            → shared helpers
```

## 3. Naming Conventions

| What | Convention | Example |
|---|---|---|
| React components | PascalCase | `PatientProfile.jsx` |
| Functions/variables | camelCase | `getPatientVisits()` |
| Database tables/columns | snake_case | `patient_id`, `visit_date` |
| API routes | kebab-case, plural nouns | `/patients`, `/store/sales` |
| CSS classes (if not Tailwind) | kebab-case | `patient-card` |
| Environment variables | UPPER_SNAKE_CASE | `DATABASE_URL` |

**Rule: field/column names must exactly match `07_Mock_Data.json` and `03_TRD_Architecture.md`. Never translate between naming styles inconsistently (e.g. don't send `visit_date` from backend and read `visitDate` on frontend without an explicit, intentional mapping layer).**

## 4. Component Style Rules

- One component = one file. No 500-line mega-components.
- Props should be explicit and typed (PropTypes or TypeScript if the stack uses it) — no silently accepting "whatever gets passed."
- Reuse `components/` pieces across screens (e.g. the same `<StatCard />` used on Dashboard should be the literal same component, not a copy-pasted near-duplicate).
- No inline hardcoded colors — always reference the design tokens from `04_Screens_and_Sitemap.md` Section 1 (Tailwind config variables or CSS custom properties).

## 5. Comments & Documentation

- Every non-obvious function gets a one-line comment explaining *why*, not *what* (the code already shows what).
- Every API route file starts with a comment block listing the routes it handles.
- TODO comments must include context: `// TODO: confirm with Krish — should low stock threshold differ per medicine type?` — not just `// TODO: fix this`.

## 6. Git Commit Conventions

Use conventional-commit style prefixes:

```
feat: add patient search functionality
fix: correct fee total calculation on Dashboard
refactor: extract StatCard component
docs: update Progress Log with session notes
chore: update dependencies
```

One logical change per commit. Don't bundle unrelated fixes into one commit.

## 7. Testing Expectations (MVP-level, keep it lightweight)

- Every API route should have at least one test verifying the success case and one verifying a common failure case (e.g. invalid input, missing auth).
- Every core user flow listed in `02_MVP_Scope.md` "MVP Demo Goal" section should be manually verified working before being marked complete in the Progress Log.
- Do not mark a feature "done" in the Progress Log without actually running it end-to-end at least once.

## 8. Error Handling Style

- Follow the standard API response shape from `08_AI_Rules_and_Constraints.md` Rule 5 — no exceptions.
- Frontend: all API calls wrapped in try/catch, with a user-friendly error message shown (not raw error dumps on screen).
- Backend: centralized error-handling middleware, not scattered try/catch blocks with inconsistent formats.

## 9. Formatting & Linting

- Use Prettier defaults (2-space indent, semicolons, single quotes) unless the project already has a different configured style — check for an existing `.prettierrc` before assuming.
- Run linter before considering any task "done."

## 10. What NOT to do

- Don't add new npm packages/dependencies without a clear reason logged in the Progress Log (dependency bloat is a real cost).
- Don't leave `console.log` debugging statements in committed code.
- Don't write code that only works with the mock data's specific values (e.g. hardcoding `if (patientName === "Muhammad Bilal")`) — always write logic that generalizes.
