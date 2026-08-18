# ClinicFlow Demo Audit & Fix List

**Status:** presentation demo only. This document is the source of truth for demo fixes. It does **not** authorize a production backend, database, or unplanned feature work.

## 1. Demo promise

Show a doctor this simple story in under 10 minutes:

1. Reception searches a patient by name, relation name, or phone.
2. Reception registers a new/follow-up visit, selects a doctor, takes the fee, prints a token receipt.
3. The doctor sees only their own live queue, calls the next token, captures a handwritten prescription/report photo, and completes the visit.
4. Reception can upload pending reports later.
5. Pharmacy sells medicine to a walk-in or a linked patient, prints a receipt, and stock decreases.
6. Owner sees fees, pharmacy sales, expenses, and an end-of-day cash summary.

If one of these six flows fails, fix that flow before adding a new screen.

## 2. Current truth — do not misrepresent it

- The app is a browser demo backed by `localStorage`, not a shared clinic system.
- Data is isolated to one browser profile/device. Clearing browser data, changing device, or using private mode can lose/isolate the demo data.
- Login, role checks, backup, and admin controls are demo-only; they are not production security.
- The PHP backend and MySQL schema are placeholders and are not connected to the React app.
- Never enter real patient data in this demo and never claim that data is encrypted, backed up, or shared across staff devices.

## 3. Must fix before showing a doctor

| Priority | Item | Acceptance test |
|---|---|---|
| P0 | Remove public developer/admin access for the presentation | `/developer` and `/super-admin` do not appear in navigation or in the demo flow. |
| P0 | Protect/reset warning | The demo reset action cannot be reached accidentally; export a backup before any reset. |
| P0 | Test the six demo flows above with a fresh browser profile | Each completes without console errors, blank state, or manually edited localStorage. |
| P0 | Confirm all print layouts on the actual printer/browser | Token receipt, POS receipt, prescription, and Z-report are readable at their intended paper widths. |
| P1 | Add obvious `Demo data` badge | The doctor must not mistake seed records for their real data. |
| P1 | Add a presentation reset button only behind a temporary presenter PIN | Reset must require a double confirmation and say it erases demo data. |
| P1 | Fix lint warnings and remove dead code | `npm run build` and `npm --prefix frontend run lint` should be clean. |
| P1 | Code-split heavy routes | The current first JS bundle is large; lazy-load reports, warehouse, and admin pages. |
| P2 | Prepare a short feedback form | Ask about token flow, prescription photo flow, fees, pharmacy, and missing reports. |

## 4. Known demo issues / risks

1. **Not multi-device:** two staff members will not see the same queue because data is local to each browser.
2. **Not tamper-proof:** anyone who can use browser developer tools can change demo data or roles.
3. **Not reliable backup:** the JSON export is useful for demo recovery only; it is not an automated or secure backup system.
4. **No production upload storage:** captured prescription/report images require server storage before real use.
5. **No real financial lock:** a sale, expense, refund, or shift closing can be altered in client-side data. Real financial records must be append-only.
6. **No migration:** historical data from DrCreate/Access has not been imported.

## 5. Demo regression checklist

Run this before every presentation.

- [ ] Start in a clean browser profile and log in as reception.
- [ ] Search an existing patient by each of: name, relation name, phone.
- [ ] Register a new patient and a follow-up; verify a doctor is required and a token is created.
- [ ] Print/view the registration receipt.
- [ ] Log in as each doctor; verify queues are separate.
- [ ] Call next, skip a token, finish a visit with prescription photo, and forward a report to reception.
- [ ] Upload the pending report as reception and see it on the patient profile.
- [ ] Make a walk-in pharmacy sale and a visit-linked sale; verify stock and receipt total.
- [ ] Record an expense, a supplier purchase/payment, a return/refund, and run EOD closing.
- [ ] Verify the EOD expected cash manually using the formula in `README_PRODUCT_ROADMAP_AND_LEGACY_GAPS.md`.
- [ ] Export the demo backup, import it into another clean profile, and verify records are restored.
- [ ] Run `npm run build` and `npm --prefix frontend run lint`.

## 6. AI guardrails for demo changes

An AI may fix a confirmed visual/flow bug only when it also provides a reproduction step and verification step. It must not:

- change the workflow, data model, routes, authentication, financial formula, or print layout without written approval;
- remove an existing working feature merely to simplify code;
- add APIs, database libraries, external services, secrets, or a backend during the demo phase;
- call `resetDatabaseToDemoData` as part of testing without explicit approval;
- claim the demo is production ready.

## 7. Doctor feedback to collect

Ask the doctor to rank each as **must-have / useful / not needed**:

- token process and separate doctor queues;
- handwritten prescription photo versus typed prescription;
- report-photo upload by reception later;
- follow-up fee rules and fee discounts;
- token/receipt/printer format;
- pharmacy POS, purchase, return, credit, and warehouse process;
- daily closing and doctor-wise fee report;
- WhatsApp reminders/receipts;
- old DrCreate reports or ledgers they cannot live without.

Do not build a feature because it sounds modern. Build it only after the doctor demonstrates where it fits in their real day.
