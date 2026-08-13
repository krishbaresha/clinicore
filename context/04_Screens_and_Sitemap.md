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
- **Navigation:** Persistent left sidebar (desktop) / bottom nav or hamburger (mobile), with these exact items in this exact order:
  1. Dashboard
  2. Patients
  3. New Visit
  4. Fees & Reports
  5. Medical Store
  6. Settings

## 2. Full Sitemap (page names — use exactly as written)

```
/login                      → Login Screen
/dashboard                  → Dashboard
/patients                   → Patients List
/patients/:id               → Patient Profile
/patients/new                → Add New Patient
/visits/new                  → New Visit / Prescription Entry
/visits/:id/print            → Printable Prescription View
/fees                         → Fees & Reports
/store                        → Medical Store — Inventory
/store/sales                  → Medical Store — Sales Log
/settings                     → Clinic Settings
```

## 3. Screen-by-Screen Breakdown

### Login Screen
- Clinic logo/name, email or phone + password fields, "Login" button.
- Clean, centered card on a soft gradient/teal background.

### Dashboard
- Top: greeting ("Good Morning, Dr. [Name]") + today's date.
- Bento-grid of stat cards: Patients Today, Fees Collected Today, New vs Repeat Patients, Low Stock Alerts count.
- Below: quick-access buttons — "Add New Patient", "New Visit", "View Reports".

### Patients List
- Search bar at top (search by name or phone) — this is the hero interaction of the whole app, make it prominent.
- List/table of patients: name, phone, last visit date, total visits count.
- "Add New Patient" button top-right.

### Patient Profile
- Header: patient name, age, gender, phone, CNIC.
- Visit history shown as a **vertical timeline** (most recent at top) — each entry shows date, diagnosis, medicines prescribed, fee paid.
- "Add New Visit" button for this patient.

### Add New Patient
- Simple form: Full Name, Phone, Age, Gender, CNIC (optional).
- Save button → redirects to new Patient Profile.

### New Visit / Prescription Entry
- Patient name shown at top (auto-filled if coming from patient profile).
- Fields: Symptoms, Diagnosis, Medicines (repeatable rows: medicine name, dosage, duration), Follow-up Date, Fee Amount.
- "Save Visit" button.

### Printable Prescription View
- Clinic logo/name + address at top (letterhead style).
- Patient name, age, date.
- Medicines list, doctor's signature line at bottom.
- "Print" button, minimal UI chrome (this view should look good on paper, not just screen).

### Fees & Reports
- Toggle: Daily / Weekly / Monthly.
- Total fee collected, number of visits, simple bar/line chart.

### Medical Store — Inventory
- Table: medicine name, stock qty, unit price, status (In Stock / Low Stock badge).
- "Add Medicine" button.

### Medical Store — Sales Log
- Table: date, medicine sold, quantity, amount.
- "Record Sale" button (reduces stock automatically).

### Clinic Settings
- Clinic name, logo upload, address — used on printable prescriptions.
- User management (add receptionist account) — MVP-optional.

## 4. Consistency Rules for AI Tools

1. Every screen shares the same sidebar navigation, in the same order, with the same icons.
2. Every button that performs the same action (e.g. "Save") uses the same label and same color across screens — don't vary "Save" vs "Submit" vs "Confirm" for the same action type.
3. Every data table (Patients, Inventory, Sales) uses the same table style/component.
4. Card components (Dashboard stat cards, Patient Profile cards) share the same glassmorphism style defined in Section 1.
5. Use the same field names across screens and docs: "Fee" (not "Charges" or "Bill"), "Visit" (not "Appointment" or "Consultation"), "Medicine" (not "Drug" or "Item").
