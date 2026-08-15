# ClinicFlow — Google Stitch UI Prompts

> **How to use this file:** Paste each prompt into Stitch one at a time, in the order given. Every prompt repeats the same design-system description on purpose — this keeps all generated screens visually consistent. Don't skip the repeated block even though it feels redundant.
>
> **UPDATED 13-Aug-2026:** Navigation is now role-based (Receptionist / Doctor / Pharmacist) per `04_Screens_and_Sitemap.md`. Old prompts for "New Visit / Prescription Entry" and "Medical Store Sales Log" are removed — replaced by Registration, Queue, Consultation (camera), and POS screens below, matching the real clinic workflow.

---

### Shared Design System Block (included in every prompt below)

```
Design system: Modern medical SaaS web app called "ClinicFlow".
Color palette: deep teal (#0F766E) as primary, soft mint/cyan as accent,
off-white background (#F8FAFC), amber for warnings, soft red for errors.
Style: glassmorphism cards (semi-transparent white with subtle blur and soft shadow),
rounded-2xl corners, generous whitespace, clean modern sans-serif typography
(Inter or Poppins style), bento-grid layout for dashboard stat cards.
Navigation is role-based — use the sidebar item list specified in each individual
prompt below (Receptionist, Doctor, and Pharmacist each see a different set).
The tone should feel professional, trustworthy, and calm — like software a doctor
or clinic staff would proudly use in front of a patient, not a generic admin template.
```

---

### Prompt 1 — Login Screen

```
[Insert Shared Design System Block]

Create a Login screen for ClinicFlow. Centered card (min-width 400px) on a soft
teal gradient background. Card contains: ClinicFlow logo/name at top with a small
medical pulse-line icon, "Email or Phone" input field, "Password" input field, a
prominent teal "Login" button, and a small "Forgot password?" link below.
Keep it minimal and calm, no sidebar on this screen. Ensure the card never
collapses narrower than its content — text must wrap at natural word boundaries,
never one word per line.
```

### Prompt 2 — Dashboard

```
[Insert Shared Design System Block]

Create a Dashboard screen for ClinicFlow. Sidebar shows the Receptionist nav set:
Dashboard, Register Patient, Today's Queue, Patients, Fees & Reports, Settings
(active item: Dashboard). Top of main content: greeting text with today's date
below it. Below that, a bento-grid of 5 glassmorphism stat cards: "Patients Today",
"Fees Collected Today", "New vs Repeat Patients", "Low Stock Alerts" (amber warning
icon if any), and "Current Token / Queue Length". Below the grid, a prominent
"Register Patient" quick-access button.
```

### Prompt 3 — Patient Registration (Counter)

```
[Insert Shared Design System Block]

Create a Patient Registration screen for ClinicFlow. Sidebar shows the
Receptionist nav set (active item: Register Patient). Top: a large, prominent
search bar with placeholder "Search by name, father/husband name, or phone...".
Below the search bar: search results appear as clickable cards, each showing
full name, relation name (e.g. "S/O Abdul Rasheed" or "W/O Farhan Siddiqui"),
and phone — this is critical because multiple patients can share the same
first/last name, so relation name and phone must always be visible to
distinguish them, never name alone.

Below the search area, a toggle: "Existing Patient Found" vs "New Patient" state.
For New Patient: a quick-add form with Full Name, Relation Type (dropdown:
Father/Husband/Wife), Relation Name, Phone, Age, Gender, CNIC (optional).
For an existing patient selected: show their basic info plus a Visit Type
toggle (New Visit / Follow-up).
At the bottom of either flow: a Fee Amount input and a prominent teal
"Register & Generate Token" button. On submit intent, show a simple token
number confirmation card (large token number, patient name, fee paid) as if
a receipt is about to print.
```

### Prompt 4 — Today's Queue (Counter View)

```
[Insert Shared Design System Block]

Create a Today's Queue screen for ClinicFlow. Sidebar shows the Receptionist
nav set (active item: Today's Queue). Main content: a simple, glanceable list
of today's tokens in order, each row showing token number (large, bold),
patient name, relation name, and a status badge (Waiting / In Consultation /
Completed / Skipped) using distinct colors (teal for in-consultation, gray
for waiting, green for completed, amber for skipped). This screen should be
readable at a glance from a few feet away — large text, high contrast, minimal
clutter, since counter staff check it quickly between tasks.
```

### Prompt 5 — Doctor's Live Queue

```
[Insert Shared Design System Block]

Create a Doctor's Live Queue screen for ClinicFlow. Sidebar shows the Doctor
nav set: Dashboard, My Queue, Patients, Fees & Reports, Settings (active item:
My Queue). Main content: a large, prominent card at the top showing the CURRENT
token being seen (very large token number, patient name, relation name, visit
type badge) with a big "Complete & Next" primary button. Below that, a compact
list of the next few waiting tokens in a queue strip, each with a small "Skip"
button (moves that token to the end of the queue without blocking the flow).
This screen is meant to be glanced at between patients, so prioritize the
current-token card being unmissable.
```

### Prompt 6 — Consultation Screen (Camera Capture)

```
[Insert Shared Design System Block]

Create a Consultation screen for ClinicFlow. Sidebar shows the Doctor nav set
(active item: My Queue, since this is reached from the queue). Top: a compact
patient info bar — name, relation name, age, gender, and a small "past visits: N"
count. Below that, two clearly separated capture sections:

Section 1 "Prescription Photo" — a large dashed-border upload/capture area with
a camera icon in the center and text "Take Photo of Prescription Pad", with a
secondary smaller "Upload from Gallery" text link below it. Once a photo is
captured, show a preview thumbnail with "Retake" and a checkmark/confirm state.

Section 2 "Patient Reports (optional)" — similar capture area but supports
multiple photos, shown as a small horizontal row of thumbnails once added, each
with a small remove (x) button, plus a "+ Add Another" tile.

Bottom: a large, prominent "Complete Visit" button (teal, full-width) that's
disabled/grayed out until at least the prescription photo is captured.
Do NOT include any typed medicine name, dosage, or diagnosis text fields on
this screen — it is intentionally photo-only.
```

### Prompt 7 — Patients List

```
[Insert Shared Design System Block]

Create a Patients List screen for ClinicFlow. Sidebar shows the Doctor nav set
(active item: Patients — this screen is shared/accessible by both Doctor and
Receptionist roles). Top: a large, prominent search bar with placeholder
"Search by name, father/husband name, or phone..." Below: a clean list of
patient cards, each showing full name, relation name, phone, last visit date,
and total visit count. Rows should be clickable, glassmorphism style, rounded
corners, hover state.
```

### Prompt 8 — Patient Profile

```
[Insert Shared Design System Block]

Create a Patient Profile screen for ClinicFlow. Top: a header card showing the
patient's full name (large), relation name, age, gender, phone, and CNIC.
Main content: a vertical timeline of past visits, most recent at top. Each
timeline entry is a card showing: visit date, a small "New" or "Follow-up"
badge, the fee paid, and — instead of a text medicine list — a clickable
thumbnail of the prescription photo for that visit (and small additional
thumbnails if report photos exist), which should visually indicate "click to
enlarge". Timeline should have a connecting line down the left side with dots
marking each visit date.
```

### Prompt 9 — Fees & Reports

```
[Insert Shared Design System Block]

Create a Fees & Reports screen for ClinicFlow with the Doctor or Receptionist
nav set (active item: Fees & Reports). Top: a toggle/tab switcher for Daily /
Weekly / Monthly view. Below: a glassmorphism summary card showing Total Fees
Collected and Total Visits (split into New vs Follow-up counts) for the
selected period, next to a simple bar or line chart visualizing fees over time.
```

### Prompt 10 — Medical Store POS (Cart & Checkout)

```
[Insert Shared Design System Block]

Create a Medical Store POS screen for ClinicFlow. Sidebar shows the Pharmacist
nav set: Medical Store POS, Inventory, Settings (active item: Medical Store POS)
— note this is a smaller, restricted nav since pharmacist staff don't see
Dashboard, Patients, or Fees. Layout is split into two columns:

Left column (wider): a medicine search/add bar at top, then a shopping-cart-style
list below it — each cart line shows medicine name, quantity (with +/- steppers),
unit price, and line total, with a small remove (x) per line. Below the cart,
a running Total in large bold text and a prominent "Checkout" button.

Right column (narrower, optional/collapsible): a "Linked Prescription" panel —
if a visit/token is selected, show the prescription photo here so staff can
visually cross-check what they're adding to the cart against what the doctor
actually wrote, rather than guessing from memory.

This should feel like a real point-of-sale interface — fast, clear pricing,
minimal friction to add items and checkout.
```

### Prompt 11 — Medical Store: Inventory

```
[Insert Shared Design System Block]

Create a Medical Store Inventory screen for ClinicFlow. Sidebar shows the
Pharmacist nav set (active item: Inventory). Top: "Add Medicine" button
top-right. Main content: a table with columns Medicine Name, Stock Quantity,
Unit Price, Status (a colored badge: green "In Stock" or amber "Low Stock").
Rows with low stock should have a subtle amber left-border highlight.
```

### Prompt 12 — Clinic Settings

```
[Insert Shared Design System Block]

Create a Clinic Settings screen for ClinicFlow. Sidebar shows whichever role's
nav set is currently active, with Settings as the active item (this screen is
shared across all three roles, but a Pharmacist should only see limited fields
relevant to them — the prompt output can show the fuller Doctor/Receptionist
version by default). Form sections: "Clinic Info" (Clinic Name, Address, Logo
upload with preview), and "Staff Accounts" (a simple list of staff with name
and a role badge — Doctor/Receptionist/Pharmacist shown in distinct badge
colors — plus an "Add Staff Account" button with a role dropdown).
```

---

## Tips for Feeding These into Antigravity After Stitch

- Once Stitch generates each screen, export/copy the component CODE (not a screenshot) and tell Antigravity: *"Here are the ClinicFlow screens generated from Stitch — wire them together using the routes and data model defined in the TRD and Sitemap documents, keep component and page names exactly as given."*
- Feed Antigravity `03_TRD_Architecture.md` and `04_Screens_and_Sitemap.md` as context alongside the Stitch output so naming stays synced end-to-end.
- Always sanity-check a generated screen's width/responsiveness (zoom out, check nothing is collapsed) before moving to the next prompt — see `references/common_pitfalls.md` in the webapp-planning-kit skill for the known Tailwind v4 width-collapse bug pattern if this happens again.
- Build/generate screens in roughly the same order as the sitemap's flow (Registration → Queue screens → Consultation → Patient Profile/List → Fees → POS → Inventory → Settings) so each screen's data assumptions match what was just established.
