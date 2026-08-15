# ClinicFlow — Technical Requirements Document (TRD)

> **Note for AI tools (Antigravity):** This document defines the technical architecture. Use the exact entity names, field names, and page names given here across the entire codebase, so that generated components, database tables, and API routes all reference the same vocabulary. Do not invent alternate naming (e.g. don't mix "Visit" and "Appointment" and "Consultation" for the same concept — always use **"Visit"**).

---

## 1. Tech Stack — LOCKED IN (see `09_Progress_Log.md`, session 13-Aug-2026)

> **This is the final decision, not a recommendation.** Do not use Node.js, FastAPI, or PostgreSQL — that was an earlier draft recommendation and has been explicitly superseded. Hosting is on **Hostinger**, backend language is **PHP**, chosen for cost (fast + cheap for the client).

| Layer | Choice | Reasoning |
|---|---|---|
| Frontend | React (Vite) + Tailwind CSS | Fast to build, matches Stitch-generated component style |
| Backend | **PHP** (plain PHP or a lightweight framework e.g. Laravel/Slim — exact choice still open, see Progress Log) | Matches Hostinger's standard hosting environment, cheap and fast to deploy |
| Database | **MySQL** (Hostinger's standard offering) | Not 100% confirmed yet — flagged as open item in Progress Log, but MySQL is the near-certain default over PostgreSQL on Hostinger |
| Auth | Session-based auth or JWT (whichever fits the chosen PHP framework's conventions), role field (doctor/receptionist) | Simple, no third-party dependency needed for MVP |
| Hosting | **Hostinger** (single provider for both frontend build output and PHP backend) | Client-facing reason: fast + cheap |
| File storage | Local server storage on Hostinger (for lab reports, logo uploads), unless storage limits require an external option later | Only needed if attachments feature is included |

**Open items before backend coding starts (see Progress Log for details):**
- Confirm MySQL vs. any alternative Hostinger DB option.
- Confirm plain PHP vs. a framework (this affects the folder structure in `10_Code_Standards.md`, which currently shows a generic Node-style structure that will need a PHP-equivalent update once this is decided).

*(Section 2 onward — system architecture, data model, API endpoints, security — remain conceptually valid regardless of backend language. Table/field names and API response shape do not change. Only the literal backend implementation language, DB engine, and hosting provider change.)*

## 2. System Architecture (high-level)

```
[ React Frontend ]
        |
        | REST API (JSON, JWT auth header)
        v
[ Backend API Server ]
        |
        v
[ PostgreSQL Database ]
   - clinics
   - users (doctor/receptionist)
   - patients
   - visits
   - prescriptions (medicines within a visit)
   - store_inventory
   - store_sales
```

Multi-tenant note: each clinic is a separate `clinic_id`. All tables (patients, visits, inventory, sales) are scoped to a `clinic_id` so the same system can serve multiple clinics if sold as SaaS later (matches the TechBill multi-tenant pattern already used in past projects).

## 3. Core Data Model / Entities

> **MAJOR UPDATE (13-Aug-2026):** Real clinic workflow discovered from the doctor — see `09_Progress_Log.md`. This adds: token/queue system, relation-name-based patient search (to solve duplicate-name collisions), photo-based prescriptions (no typed medicine list), and a third user role (pharmacist). All entities below reflect this updated model — this supersedes any earlier simpler version.

### `clinics`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| name | text | |
| logo_url | text | |
| address | text | |
| created_at | timestamp | |

### `users`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| clinic_id | UUID | FK → clinics |
| name | text | |
| role | enum | `doctor`, `receptionist`, `pharmacist` — pharmacist can ONLY access Medical Store screens, never patient medical records |
| email / phone | text | |
| password_hash | text | |

### `patients`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| clinic_id | UUID | FK → clinics |
| full_name | text | |
| relation_name | text | Father/Husband/Wife's name — critical for disambiguating common names |
| relation_type | enum | `father`, `husband`, `wife` |
| phone | text | Indexed — primary search field alongside full_name + relation_name |
| cnic | text | Optional |
| age | int | |
| gender | enum | |
| created_at | timestamp | |

**Search rule:** patient search must match against `full_name` + `relation_name` + `phone` combined — never `full_name` alone, since duplicate names are common and returning the wrong patient's history is a real safety risk.

### `visits`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| patient_id | UUID | FK → patients |
| clinic_id | UUID | FK → clinics |
| doctor_id | UUID | FK → users (role=doctor) — which doctor this visit/token is assigned to. REQUIRED: the clinic has multiple doctors seeing patients concurrently (e.g. Dr. Asif Ashraf and a lady doctor colleague), so every visit/token belongs to exactly one doctor, and each doctor's queue only shows their own patients. |
| token_number | int | Assigned at registration, resets daily, must be atomically generated (no duplicate tokens same day) |
| visit_type | enum | `new`, `follow_up` |
| status | enum | `waiting`, `in_consultation`, `completed`, `completed_reports_pending`, `skipped` — `completed_reports_pending` means the doctor finished and moved on without uploading report photos yet; reception can complete that later (see Section 2 Reception Flow update) |
| visit_date | timestamp | |
| fee_amount | decimal | Collected at reception (Counter), not by the doctor |
| prescription_image_url | text | Photo of the physical prescription pad — REQUIRED to complete a visit |
| report_image_urls | text[] | Photos of any patient reports — OPTIONAL at consultation time; can be added later by reception if status is `completed_reports_pending` |
| follow_up_date | date | Optional |
| notes | text | Optional |

> **No structured `prescription_items` table for medicines** — per the doctor's real workflow, medicines are handwritten on a pad and only captured as a photo, not typed into the system. Do not build a medicine-name/dosage form for the doctor's consultation screen; build a camera-capture flow instead. (This was evaluated and intentionally decided — see Progress Log — favoring consultation speed over structured/searchable prescription data.)

### `store_inventory`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| clinic_id | UUID | FK → clinics |
| medicine_name | text | |
| unit_label | text | The smallest sellable unit for this medicine — e.g. `"tablet"`, `"bottle"`, `"injection"`, `"tube"`, `"capsule"`. Stock and price are always tracked in this unit — no separate box/strip/loose hierarchy needed; quantity sold can be any number (1 tablet or 50), unit stays fixed per medicine. |
| stock_qty | int | Quantity in `unit_label` units |
| unit_price | decimal | Price per single `unit_label` unit |
| low_stock_threshold | int | |

### `store_sales`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| clinic_id | UUID | FK → clinics |
| visit_id | UUID (nullable) | FK → visits — OPTIONAL. Null means a walk-in customer bought medicine without any clinic visit/consultation; the POS must fully support this standalone mode, not require a linked visit. |
| customer_name | text (nullable) | Optional, only relevant for walk-in sales without a visit_id, for the receipt |
| items | JSON | Array of `{ inventory_id, medicine_name, unit_label, quantity, unit_price, line_total }` |
| subtotal | decimal | Sum of all line_totals before discount/tax |
| discount_amount | decimal | Flat amount or computed from a percent entered at checkout — default 0 |
| tax_amount | decimal | Default 0 for now. Field exists so a future FBR Digital Invoicing integration (IRN/QR code generation, matching prior FBR DI API work) can be added later without a schema change — do not build FBR integration now, just keep this field present and unused/zero. |
| total_amount | decimal | subtotal - discount_amount + tax_amount |
| sale_date | timestamp | |

## 4. API Endpoints (MVP scope — UPDATED for real clinic workflow)

```
POST   /auth/login
GET    /dashboard/summary

GET    /patients?search=          (searches full_name + relation_name + phone together)
GET    /patients/:id
POST   /patients

GET    /patients/:id/visits
POST   /visits                     (registration: creates visit, assigns token_number atomically, status=waiting)

GET    /queue/today?doctor_id=      (a doctor's own live queue — visits with status=waiting/in_consultation FOR THAT DOCTOR ONLY, ordered by token_number; a logged-in doctor sees only their own doctor_id's queue automatically)
POST   /visits/:id/call             (sets status=in_consultation)
POST   /visits/:id/skip             (sets status=skipped, moves to end of queue)
POST   /visits/:id/complete         (accepts prescription_image_url [required] and report_image_urls [optional]; if report_image_urls is empty, sets status=completed_reports_pending, otherwise status=completed)
POST   /visits/:id/reports          (reception-only: adds report_image_urls to a visit that's status=completed_reports_pending, then updates status to completed)
GET    /visits/pending-reports       (reception: lists all visits currently status=completed_reports_pending, so reception knows which patients still need to come back for report upload)
POST   /uploads/prescription-photo  (accepts a captured/uploaded image, returns a URL, should compress client-side before upload)

GET    /fees/summary?range=daily|weekly|monthly

GET    /store/inventory
POST   /store/inventory
GET    /store/sales
POST   /store/sales                (accepts an array of {inventory_id, quantity}, optional visit_id [nullable — walk-in sales have no visit_id], optional customer_name, optional discount_amount, optional tax_amount; reduces stock, computes subtotal/total, returns receipt data)
```

## 5. Security Requirements

- Passwords hashed (bcrypt/argon2), never stored plain.
- JWT tokens with reasonable expiry + refresh flow.
- Role-based access control: receptionist role blocked from editing diagnosis/prescription fields at the API level (not just hidden in UI).
- Patient medical data is sensitive — encrypt at rest if hosting allows, and always serve over HTTPS.
- Rate-limit login endpoint to prevent brute force.

## 6. Non-Functional Requirements

- Search response time under 1 second for patient lookup, even with thousands of records.
- Mobile/tablet responsive UI — receptionist desk is often a tablet, not a desktop.
- Print-friendly CSS for the prescription view (clean output on A4/A5).
- System should degrade gracefully on slow internet (loading states, not blank screens).

## 7. Future Technical Considerations (Phase 3, not MVP)

- Offline-first local storage with background sync when internet returns (relevant given Pakistan's variable clinic internet connectivity).
- WhatsApp Business API integration for follow-up reminders.
- Audit log table (who changed what, when) if multi-user editing becomes common.
