# ClinicFlow — Screens, Sitemap & Shared Design System

> **Note for AI tools (Stitch / Antigravity):** This is the single source of truth for page names, navigation structure, and design tokens. Every screen generated — whether by Stitch or hand-coded in Antigravity — must use these exact page names and this exact design system so the final app feels like ONE product, not stitched-together mismatched screens.

---

## 1. Global Design System (use on every screen)

- **Product name:** ClinicFlow (always shown in top-left of sidebar/navbar with a simple medical-cross or pulse-line icon)
- **Color palette:**
  - Primary: Teal / Medical Blue (`#0F766E` or similar deep teal)
  - Accent: Soft cyan/mint for highlights and success states
  - Background: Very light gray/off-white (`#F8FAFC`), with glassmorphism cards (semi-transparent white, subtle blur, soft shadow)
  - Alert/low-stock: Amber/orange
  - Error: Soft red
- **Typography:** Clean modern sans-serif (Inter, Poppins, or similar). Headings semi-bold, body regular.
- **Layout style:** Bento-grid dashboard cards on the Dashboard screen; clean table/list views elsewhere; rounded corners (`rounded-2xl`), soft shadows, generous whitespace.
- **Navigation:** Persistent left sidebar (desktop) / bottom nav or hamburger (mobile). Nav items are **role-based** — each role sees only their relevant items, in this order:
  - **Receptionist:** Dashboard, Register Patient, Today's Queue, Pending Reports, Patients, Fees & Reports, Settings
  - **Doctor:** Dashboard, My Queue, Patients, Fees & Reports, Settings
  - **Pharmacist:** Medical Store POS, Inventory, Settings (no access to Dashboard, Patients, or Fees — pharmacist never sees medical/financial-consultation data)

## 2. Full Sitemap (page names — use exactly as written)

> **UPDATED (13-Aug-2026):** Real clinic workflow adds a 3-role system — Reception/Counter, Doctor, and Medical Store/Pharmacist. New screens below reflect this.

```
/login                        → Login Screen
/dashboard                    → Dashboard
/reception/register           → Patient Registration (Counter)
/reception/queue               → Today's Queue (Counter view)
/reception/pending-reports     → Pending Report Uploads (Counter)
/doctor/queue                  → Doctor's Live Queue
/doctor/consultation/:visitId  → Consultation Screen (camera capture)
/patients                      → Patients List
/patients/:id                  → Patient Profile
/patients/new                  → Add New Patient
/fees                          → Fees & Reports
/store/pos                     → Medical Store POS (Cart & Checkout)
/store                         → Medical Store — Inventory
/settings                      → Clinic Settings
```

### Reception / Counter Flow (NEW)

**Patient Registration (`/reception/register`)**
- Search bar: search existing patients by Name + Relation Name (Father/Husband/Wife) + Phone combined — never name alone, to avoid duplicate-name mix-ups.
- If found: select existing patient, confirm visit type (New/Follow-up).
- If not found: quick-add form — Full Name, Relation Type (Father/Husband/Wife dropdown), Relation Name, Phone, Age, Gender.
- **Select Doctor** dropdown (required) — the clinic has multiple doctors seeing patients at the same time (e.g. Dr. Asif Ashraf and a lady doctor colleague); reception must choose which doctor this patient's token is for, since each doctor has their own separate queue.
- Fee input (consultation fee — smart-suggest follow-up fee if patient has prior visits).
- On submit: generates a **Token Number** (atomic, resets daily) + a printable **Registration Receipt** (token + patient name + fee paid) — this is a separate print format from the medicine POS receipt.

**Today's Queue (`/reception/queue`)**
- Simple live list of today's tokens and their status (Waiting / In Consultation / Completed / Skipped) — lets the counter staff answer "what number are we on" without walking to the doctor's room.

**Pending Report Uploads (`/reception/pending-reports`)** — NEW
- A list of visits currently `status=completed_reports_pending` — i.e. the doctor completed the consultation without uploading report photos (to save time and see the next patient faster). Each row shows patient name, relation name, token number, and visit date.
- Clicking a row opens a simple camera-capture UI (same pattern as the doctor's report-photo capture) so reception can take/upload the report photos later, whenever the patient comes back with their reports or reception gets a free moment — without needing the doctor again.
- Once reports are uploaded here, status updates to `completed`.

### Doctor Flow (NEW)

**Doctor's Live Queue (`/doctor/queue`)**
- **Multi-doctor clinic:** the logged-in doctor sees ONLY their own queue (filtered by doctor_id) — Dr. Asif Ashraf and a colleague (e.g. a lady doctor) seeing patients concurrently each get their own independent, separate queue, never a shared/mixed one.
- Large, clear display of the current token being seen and the next few waiting — this is what's shown/glanced at between patients.
- "Call Next" button advances to the next waiting token.
- Each queued entry has "Skip" (patient not present, moves to end of queue) — this prevents the whole queue from jamming if a patient steps out.

**Consultation Screen (`/doctor/consultation/:visitId`)**
- Patient info shown at top (name, age, relation name, past visit count).
- **Camera capture area** for the prescription pad photo — big, simple "Take Photo" / "Upload Photo" button (mobile/tablet camera access), with a preview and retake option before confirming.
- Second, separate camera capture area for patient reports (X-ray/lab reports) — supports multiple photos.
- "Complete Visit" button — enabled once the prescription photo is captured (report photos are OPTIONAL). Saves whatever images are present to the visit record; if report photos weren't added, sets status to `completed_reports_pending` instead of `completed` so reception can add them later without involving the doctor again. Returns to the queue for the next token — this lets the doctor move fast when time is short, without being blocked on uploading reports.
- No typed medicine/dosage form on this screen — intentionally photo-only, per the real clinic workflow (see 09_Progress_Log.md).

### Medical Store Flow (UPDATED — full standalone POS)

**Medical Store POS (`/store/pos`)** — this is a real, general-purpose POS, not just a clinic-visit add-on
- **Works with or without a linked visit** — an "optional" toggle/search at the top: "Link to a patient visit" (look up by token/patient, shows the prescription photo alongside in a split view so staff can visually cross-check what they're adding) OR "Walk-in Customer" (no visit link needed — anyone can walk into the store and buy medicine directly, with an optional customer name field for the receipt).
- A running cart: search/add medicines from inventory, adjust quantity freely (1 tablet, 10 tablets, 1 bottle, whatever — every medicine in inventory has a fixed smallest sellable unit like "tablet" or "bottle", and quantity can be any number in that unit; see `03_TRD_Architecture.md` `unit_label` field). Each cart line shows medicine name, unit label, quantity, unit price, line total.
- Subtotal shown, then a **Discount** field (flat amount or percent — staff can apply one at checkout for any reason, e.g. loyal patient, bulk purchase), then a **Tax** field (present in the UI but defaults to 0/off for now — reserved for future FBR Digital Invoicing integration, not built yet), then the final Total.
- "Checkout" — reduces stock for each item, generates a printable POS receipt showing subtotal, discount, tax, and total, using the same thermal 80mm print pattern as the other receipts.

**Medical Store — Inventory (`/store`)** — stock management screen, separate from the POS/checkout screen. Each medicine's `unit_label` (tablet/bottle/injection/tube/etc.) is shown alongside stock quantity, since that's the unit stock is tracked and sold in.



## 3. Screen-by-Screen Breakdown

### Login Screen
- Clinic logo/name, email or phone + password fields, "Login" button.
- Clean, centered card on a soft gradient/teal background.

### Dashboard (Doctor & Receptionist versions differ slightly)
- Top: greeting + today's date.
- Bento-grid of stat cards: Patients Today, Fees Collected Today, New vs Repeat Patients, Low Stock Alerts count, Current Token / Queue Length.
- Below: quick-access buttons — Receptionist sees "Register Patient"; Doctor sees "Go to My Queue".

### Patients List
- Search bar at top (search by name or phone) — this is the hero interaction of the whole app, make it prominent.
- List/table of patients: name, phone, last visit date, total visits count.
- "Add New Patient" button top-right.

### Patient Profile
- Header: patient name, relation name (Father/Husband/Wife), age, gender, phone, CNIC.
- Visit history shown as a **vertical timeline** (most recent at top) — each entry shows date, visit type (New/Follow-up), the prescription photo (thumbnail, click to enlarge) and any report photos, fee paid.
- No text diagnosis/medicine list here — history is photo-based per the real clinic workflow.

### Add New Patient (used within Registration flow, see Section 2 above)
- Full Name, Relation Type (dropdown: Father/Husband/Wife), Relation Name, Phone, Age, Gender, CNIC (optional).
- Save button → generates token, returns to Registration receipt.

### Fees & Reports
- Toggle: Daily / Weekly / Monthly.
- Total fee collected, number of visits (split by New vs Follow-up), simple bar/line chart.

### Medical Store — Inventory
- Table: medicine name, stock qty, unit price, status (In Stock / Low Stock badge).
- "Add Medicine" button.

### Clinic Settings
- Clinic name, logo upload, address — used on printable receipts.
- User management (add receptionist/doctor/pharmacist accounts).

## 4. Consistency Rules for AI Tools

1. Every screen shares the same sidebar navigation, in the same order, with the same icons.
2. Every button that performs the same action (e.g. "Save") uses the same label and same color across screens — don't vary "Save" vs "Submit" vs "Confirm" for the same action type.
3. Every data table (Patients, Inventory, Sales) uses the same table style/component.
4. Card components (Dashboard stat cards, Patient Profile cards) share the same glassmorphism style defined in Section 1.
5. Use the same field names across screens and docs: "Fee" (not "Charges" or "Bill"), "Visit" (not "Appointment" or "Consultation"), "Medicine" (not "Drug" or "Item").
