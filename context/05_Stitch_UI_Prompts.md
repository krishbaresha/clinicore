# ClinicFlow — Google Stitch UI Prompts

> **How to use this file:** Paste each prompt into Stitch one at a time, in the order given. Every prompt repeats the same design-system description on purpose — this is what keeps all generated screens visually consistent (same colors, same fonts, same layout language). Do not skip the repeated design-system paragraph even though it feels redundant — it's what prevents Stitch from generating mismatched screens.

---

### Shared Design System Block (included in every prompt below)

```
Design system: Modern medical SaaS web app called "ClinicFlow". 
Color palette: deep teal (#0F766E) as primary, soft mint/cyan as accent, 
off-white background (#F8FAFC), amber for warnings, soft red for errors. 
Style: glassmorphism cards (semi-transparent white with subtle blur and soft shadow), 
rounded-2xl corners, generous whitespace, clean modern sans-serif typography 
(Inter or Poppins style), bento-grid layout for dashboard stat cards. 
Persistent left sidebar navigation with these exact items in this order: 
Dashboard, Patients, New Visit, Fees & Reports, Medical Store, Settings. 
The tone should feel professional, trustworthy, and calm — like software a doctor 
would proudly use in front of a patient, not a generic admin template.
```

---

### Prompt 1 — Login Screen

```
[Insert Shared Design System Block]

Create a Login screen for ClinicFlow. Centered card on a soft teal gradient 
background. Card contains: ClinicFlow logo/name at top with a small medical 
pulse-line icon, "Email or Phone" input field, "Password" input field, a 
prominent teal "Login" button, and a small "Forgot password?" link below. 
Keep it minimal and calm, no sidebar on this screen.
```

### Prompt 2 — Dashboard

```
[Insert Shared Design System Block]

Create a Dashboard screen for ClinicFlow with the persistent left sidebar 
(active item: Dashboard). Top of main content: greeting text "Good Morning, 
Dr. Ahmed" with today's date below it. Below that, a bento-grid of 4 glassmorphism 
stat cards: "Patients Today" (with number and small icon), "Fees Collected Today" 
(currency value), "New vs Repeat Patients" (small split visual), "Low Stock Alerts" 
(count with amber warning icon). Below the grid, three quick-access buttons: 
"Add New Patient", "New Visit", "View Reports".
```

### Prompt 3 — Patients List

```
[Insert Shared Design System Block]

Create a Patients List screen for ClinicFlow with the persistent left sidebar 
(active item: Patients). Top of main content: a large, prominent search bar 
with placeholder "Search patient by name or phone..." and an "Add New Patient" 
button top-right. Below: a clean table/list of patients with columns: Name, 
Phone, Last Visit Date, Total Visits. Rows should be clickable cards with 
hover state, glassmorphism style, rounded corners.
```

### Prompt 4 — Patient Profile

```
[Insert Shared Design System Block]

Create a Patient Profile screen for ClinicFlow with the persistent left sidebar. 
Top: a header card showing patient's name (large), age, gender, phone number, 
and CNIC. Below: an "Add New Visit" button aligned right. Main content: a 
vertical timeline of past visits, most recent at top, each timeline entry as a 
card showing visit date, diagnosis, list of prescribed medicines, and fee paid. 
Timeline should have a connecting line down the left side with dots marking 
each visit date.
```

### Prompt 5 — Add New Patient

```
[Insert Shared Design System Block]

Create an Add New Patient form screen for ClinicFlow with the persistent left 
sidebar. Centered form card with fields: Full Name, Phone Number, Age, Gender 
(dropdown), CNIC (optional, marked as optional). A prominent teal "Save Patient" 
button at the bottom of the card. Keep the form clean and short, single column.
```

### Prompt 6 — New Visit / Prescription Entry

```
[Insert Shared Design System Block]

Create a New Visit / Prescription Entry screen for ClinicFlow with the 
persistent left sidebar. Top: patient name shown in a small info bar (auto-filled). 
Form sections: "Symptoms" (textarea), "Diagnosis" (textarea), "Medicines" 
(repeatable row group with Medicine Name, Dosage, Duration fields and an 
"+ Add Medicine" button), "Follow-up Date" (date picker), "Fee Amount" (currency 
input). Prominent "Save Visit" button at the bottom.
```

### Prompt 7 — Printable Prescription View

```
[Insert Shared Design System Block, but this screen should look like a clean 
printable document, minimal UI chrome, no sidebar]

Create a Printable Prescription view for ClinicFlow. Letterhead-style top 
section with clinic logo, clinic name, and address. Below: patient name, age, 
and visit date in a simple row. Main content: a clean list of prescribed 
medicines with dosage and duration. Bottom: a signature line for the doctor. 
A small "Print" button fixed at the top-right corner (hidden when actually 
printed). Paper-like white background, elegant serif or clean sans-serif font, 
minimal color use — mostly black text on white, with a subtle teal accent line 
under the clinic name.
```

### Prompt 8 — Fees & Reports

```
[Insert Shared Design System Block]

Create a Fees & Reports screen for ClinicFlow with the persistent left sidebar 
(active item: Fees & Reports). Top: a toggle/tab switcher for Daily / Weekly / 
Monthly view. Below: a glassmorphism summary card showing Total Fees Collected 
and Total Visits for the selected period, next to a simple bar or line chart 
visualizing fees over time.
```

### Prompt 9 — Medical Store: Inventory

```
[Insert Shared Design System Block]

Create a Medical Store Inventory screen for ClinicFlow with the persistent left 
sidebar (active item: Medical Store). Top: "Add Medicine" button top-right. 
Main content: a table with columns Medicine Name, Stock Quantity, Unit Price, 
Status (a colored badge: green "In Stock" or amber "Low Stock"). Rows with low 
stock should have a subtle amber left-border highlight.
```

### Prompt 10 — Medical Store: Sales Log

```
[Insert Shared Design System Block]

Create a Medical Store Sales Log screen for ClinicFlow with the persistent left 
sidebar (active item: Medical Store, with a secondary tab "Sales Log" active). 
Top: "Record Sale" button top-right. Main content: a table with columns Date, 
Medicine Sold, Quantity, Amount. A small summary strip above the table showing 
Total Sales This Month.
```

### Prompt 11 — Clinic Settings

```
[Insert Shared Design System Block]

Create a Clinic Settings screen for ClinicFlow with the persistent left sidebar 
(active item: Settings). Form sections: "Clinic Info" (Clinic Name, Address, 
Logo upload with preview), and "Staff Accounts" (a simple list of staff with 
name and role badge, plus an "Add Staff Account" button). Save button at the 
bottom of each section.
```

---

## Tips for Feeding These into Antigravity After Stitch

- Once Stitch generates each screen, export/copy the component code and tell Antigravity: *"Here are the ClinicFlow screens generated from Stitch — wire them together using the routes and data model defined in the TRD and Sitemap documents, keep component and page names exactly as given."*
- Feed Antigravity the `03_TRD_Architecture.md` and `04_Screens_and_Sitemap.md` files as context alongside the Stitch output so naming stays synced end-to-end.
