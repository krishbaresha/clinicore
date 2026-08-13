# ClinicFlow — Product Requirements Document (PRD)

> **Note for AI tools (Antigravity / Stitch / other):** This is the master product definition. Every screen, feature, and data model built for this product must align with what's described here. Product name is **ClinicFlow** — use this name consistently in UI headers, page titles, and file/component names. Do not rename it to something else mid-build.

---

## 1. Problem Statement

Doctors running small-to-medium private clinics in Pakistan currently rely on **paper prescriptions and manual memory** to track patient history. This creates recurring problems:

- Patients lose their physical prescriptions, so when they return (sometimes months or years later), the doctor has no record of past diagnosis, medicines given, or dosage.
- Doctors cannot quickly answer "when did this patient last visit, and what did I prescribe?"
- Clinic fee collection is tracked informally (notebook/memory), making daily/monthly revenue unclear.
- If the doctor also runs a small in-clinic medical store (pharmacy), stock and sales are tracked separately (or not at all), disconnected from patient visits.

## 2. Product Vision

ClinicFlow is a web application that gives doctors a **permanent, searchable digital record** of every patient they've ever treated — even if the patient loses their own copy — plus simple financial tracking for consultations and an optional in-house medical store module.

The core promise: **"Search a patient's name, see their entire history — even from 2 years ago."**

## 3. Target Users

| Persona | Description | Primary Need |
|---|---|---|
| **Solo Doctor** | Runs a private clinic, sees patients daily, may or may not have a receptionist | Fast patient lookup, prescription entry, fee tracking |
| **Clinic Receptionist** | Handles patient check-in, fee collection, basic data entry | Simple, error-proof entry screens (not full medical editing rights) |
| **Doctor with Medical Store** | Same as solo doctor, but also sells medicines directly from clinic | Needs inventory + sales tracking connected to patient visits |

## 4. Goals

- Give doctors permanent, never-lost patient history.
- Make patient search instant, by name or phone number.
- Track consultation fees per visit and generate simple revenue reports.
- Optionally track medical store inventory and sales, linked to prescriptions.
- Be usable on tablet/mobile at the reception desk, not just desktop.
- Feel trustworthy and "professional medical software," not a generic template.

## 5. Non-Goals (Out of Scope for now)

- Not a hospital-grade Electronic Health Record (EHR) system with lab integrations, imaging, insurance claims, etc.
- Not a telemedicine/video consultation platform.
- Not a full accounting/tax system — only clinic-level fee and store revenue tracking.
- Not initially multi-branch (single clinic location per account, expandable later).

## 6. Core Features (MVP)

1. **Patient Records** — create, search, and view patient profiles with full visit history.
2. **Visit / Prescription Entry** — log a new visit with symptoms, diagnosis, prescribed medicines, dosage, follow-up date.
3. **Printable Prescription** — clean, clinic-branded prescription output.
4. **Fee Tracking** — record fee per visit; view daily/weekly/monthly totals.
5. **Medical Store Module** — inventory list, stock levels, sales log, low-stock alerts.
6. **Dashboard** — daily snapshot: patients seen today, fees collected today, low-stock alerts, new vs repeat patients.
7. **Authentication** — doctor login; optional receptionist role with limited permissions.

## 7. Phase 2 Features (Explicitly planned, not built in MVP)

- WhatsApp follow-up reminders to patients.
- Multi-doctor / multi-branch support.
- Appointment/token queue system.
- Analytics: most common diagnoses, seasonal disease trends.
- Data export (CSV/PDF) of patient records and financial reports.
- Offline-first mode with sync (for low-internet areas).

## 8. Success Metrics (how we know it's working)

- A doctor can find any past patient's record in under 10 seconds via search.
- Zero "lost" patient history — every visit ever entered stays retrievable.
- Doctor can see today's total fee collection without manual calculation.
- Medical store stock count stays accurate after each sale.

## 9. Key User Stories

- *As a doctor*, I want to search a patient by name so I can see everything I've prescribed them, even from years ago.
- *As a doctor*, I want to add a new visit quickly during a busy consultation, without slowing down.
- *As a receptionist*, I want to register a new patient and collect fee without touching medical/prescription fields.
- *As a doctor with a medical store*, I want to see how much stock I have left and how much I sold today.
- *As a doctor*, I want a simple report at the end of the month showing total patients and total earnings.

## 10. Design Tone

Professional medical trust + modern SaaS feel. Reference aesthetic: **glassmorphism, bento-grid dashboard layout, teal/medical-blue color palette**, clean sans-serif typography. Should feel like something a doctor would proudly show a colleague — not a generic admin panel template.
