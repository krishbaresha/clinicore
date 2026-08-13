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

### `clinics`
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | text | e.g. "Dr. Ahmed's Clinic" |
| logo_url | text | Optional, for prescription branding |
| address | text | |
| created_at | timestamp | |

### `users`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| clinic_id | UUID | FK → clinics |
| name | text | |
| role | enum | `doctor`, `receptionist` |
| email / phone | text | For login |
| password_hash | text | |

### `patients`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| clinic_id | UUID | FK → clinics |
| full_name | text | |
| phone | text | Indexed — primary search field |
| cnic | text | Optional |
| age | int | |
| gender | enum | |
| created_at | timestamp | First-ever visit date |

### `visits`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| patient_id | UUID | FK → patients |
| clinic_id | UUID | FK → clinics |
| visit_date | timestamp | |
| symptoms | text | |
| diagnosis | text | |
| fee_amount | decimal | |
| follow_up_date | date | Optional |
| notes | text | Optional |

### `prescription_items`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| visit_id | UUID | FK → visits |
| medicine_name | text | |
| dosage | text | e.g. "1 tablet twice daily" |
| duration | text | e.g. "5 days" |

### `store_inventory`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| clinic_id | UUID | FK → clinics |
| medicine_name | text | |
| stock_qty | int | |
| unit_price | decimal | |
| low_stock_threshold | int | Default e.g. 10 |

### `store_sales`
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| clinic_id | UUID | FK → clinics |
| inventory_id | UUID | FK → store_inventory |
| quantity_sold | int | |
| sale_amount | decimal | |
| sale_date | timestamp | |
| linked_visit_id | UUID | Optional — Phase 3 auto-dispense link |

## 4. API Endpoints (MVP scope)

```
POST   /auth/login
GET    /dashboard/summary

GET    /patients?search=
GET    /patients/:id
POST   /patients

GET    /patients/:id/visits
POST   /visits
GET    /visits/:id  (includes prescription_items)

GET    /fees/summary?range=daily|weekly|monthly

GET    /store/inventory
POST   /store/inventory
GET    /store/sales
POST   /store/sales
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
