# ClinicFlow — MVP Scope & Phased Roadmap

> **Note for AI tools:** Build ONLY what's in "MVP — Build Now" for the first version. Everything in Phase 2/3 should be acknowledged in the UI (e.g. a disabled button or "coming soon" tag) but not functionally built yet. This keeps the demo focused and prevents scope creep.

---

## MVP — Build Now (v1.0)

| # | Feature | Priority | Notes |
|---|---|---|---|
| 1 | Doctor login/auth | Must-have | Single doctor account to start |
| 2 | Dashboard (today's stats) | Must-have | Patients today, fees today, low stock alert count |
| 3 | Patient list + search (name/phone) | Must-have | Core value proposition of the whole product |
| 4 | Patient profile page (visit history timeline) | Must-have | Shows all past visits chronologically |
| 5 | Add new patient | Must-have | Simple form: name, phone, age, gender |
| 6 | Add new visit / prescription entry | Must-have | Symptoms, diagnosis, medicines, dosage, follow-up date, fee |
| 7 | Printable prescription view | Must-have | Clinic name/logo header, patient info, medicine list |
| 8 | Fees overview (daily/weekly/monthly totals) | Must-have | Simple report/chart |
| 9 | Medical store — inventory list | Should-have | Medicine name, stock qty, price |
| 10 | Medical store — sales log | Should-have | Record a sale, reduce stock |
| 11 | Low-stock alert | Should-have | Flag items below threshold |
| 12 | Receptionist role (limited access) | Should-have | Can add patients + collect fees, cannot edit prescriptions |

## Phase 2 — After MVP validated with real doctor(s)

- WhatsApp follow-up reminders (patient gets reminded of follow-up date)
- Appointment/token queue system for walk-ins
- Data export (CSV/PDF) for patient records and monthly reports
- Analytics: common diagnoses, patient retention rate, seasonal trends
- Multi-doctor support within one clinic (shared patient pool, separate dashboards)

## Phase 3 — Scale-up features

- Multi-branch / multi-clinic support (for doctors with more than one clinic)
- Offline-first mode with background sync (for low-connectivity areas)
- Inventory auto-deduction directly linked to prescription (dispense from Rx)
- SMS/WhatsApp based online booking for patients
- Subscription billing system (if selling as SaaS to multiple clinics)

---

## Feature Prioritization Logic

Ranked by: **(a) how directly it solves the core problem — lost patient history — and (b) how demo-able it is to a doctor in under 5 minutes.**

1. Search + patient history timeline is the single most important feature — it IS the product's core value.
2. Prescription entry + printable view comes second — doctors need to see themselves *using* it in their real workflow.
3. Fees tracking is the "sells itself" feature — doctors instantly see business value.
4. Medical store is a strong differentiator but secondary — only relevant to doctors who have a store, so it's modular, not mandatory.

## MVP Demo Goal

A working demo should let someone:
1. Log in and land on Dashboard.
2. Search an existing mock patient → see their visit history.
3. Add a new visit with a prescription → see it appear in history immediately.
4. View the printable prescription.
5. Check the Fees tab → see totals update.
6. Peek at the Medical Store tab → see inventory and a mock low-stock alert.

If all 6 steps work smoothly with mock data, the MVP demo is considered successful.
