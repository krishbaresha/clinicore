# ClinicFlow — Antigravity Build Workflow & Prompts

> **Purpose:** This is the actual execution playbook — the order in which to build ClinicFlow inside Antigravity, with exact prompts to paste at each step. Read `00_README_Index.md` first if you haven't. This file assumes all 11 project docs are already uploaded/attached as project context in Antigravity.

---

## Step 0 — One-Time Project Setup in Antigravity

1. Create a new project in Antigravity.
2. Upload/attach ALL of these files to the project's context/knowledge base (not just paste once — keep them attached so every future session can reference them):
   - `00_README_Index.md`
   - `01_PRD.md`
   - `02_MVP_Scope.md`
   - `03_TRD_Architecture.md`
   - `04_Screens_and_Sitemap.md`
   - `07_Mock_Data.json`
   - `08_AI_Rules_and_Constraints.md`
   - `09_Progress_Log.md`
   - `10_Code_Standards.md`
3. Send this as your very first message in the project:

```
Read 00_README_Index.md first, then 09_Progress_Log.md, then 08_AI_Rules_and_Constraints.md. 
Confirm you understand the project before we start building anything. 
Do not write any code yet — just summarize back to me: what ClinicFlow is, 
what tech stack we're using (check 03_TRD_Architecture.md for the LOCKED IN stack — 
PHP + MySQL + Hostinger, not Node/Postgres), and what rules you'll follow while coding.
```

This forces Antigravity to actually process the context before touching code, and lets you catch any misunderstanding immediately instead of after code is written.

---

## Build Order (why this order matters)

Build in this sequence — each step depends on the previous one being solid, and building in the wrong order is a common cause of wasted rework:

1. Project skeleton (folders, config, DB connection)
2. Database schema (from mock data + TRD)
3. Auth (login) — everything else needs a logged-in user
4. Patients module (list, search, profile, add)
5. Visits/Prescription module (depends on patients existing)
6. Printable prescription view
7. Fees & Reports (depends on visits data existing)
8. Medical Store module (independent, can technically go earlier, but lower priority per MVP scope)
9. Dashboard (pulls data from everything above, so build it last even though it's the first screen users see)
10. Polish pass (error states, loading states, responsive check)

---

## Step-by-Step Prompts

### Step 1 — Project Skeleton

```
Set up the initial project skeleton for ClinicFlow following the folder structure 
in 10_Code_Standards.md, using PHP for backend and React (Vite) + Tailwind for 
frontend, per the locked-in stack in 03_TRD_Architecture.md. 

Set up the database connection config for MySQL (use placeholder credentials in 
a .env file, don't hardcode them). Create the database tables exactly matching 
the entities and field names in 03_TRD_Architecture.md Section 3 and 07_Mock_Data.json 
— use the same table/field names, no renaming.

After this, update 09_Progress_Log.md with what was set up and any assumptions made.
```

### Step 2 — Seed Database with Mock Data

```
Write a database seed script that inserts the data from 07_Mock_Data.json into 
the MySQL tables created in the previous step, exactly as-is — same IDs, same 
field values. This lets us test every screen with realistic data instead of 
empty tables. Update 09_Progress_Log.md when done.
```

### Step 3 — Auth (Login)

```
Build the login flow: backend route(s) for authentication per the API response 
shape in 08_AI_Rules_and_Constraints.md Rule 5, and the frontend Login screen 
matching the design described in 04_Screens_and_Sitemap.md and the Stitch prompt 
in 05_Stitch_UI_Prompts.md (if you already have the Stitch-generated component, 
wire it up; otherwise build it to match that description). 

Use the mock users from 07_Mock_Data.json to test login (doctor and receptionist 
roles). Enforce role-based access per 03_TRD_Architecture.md Section 5 — 
receptionist should not be able to hit any prescription/diagnosis edit endpoints.

Definition of done: I can log in as Dr. Ahmed Raza (user_001) and as Sana Malik 
(user_002) and get correctly routed with the right permissions. 
Update 09_Progress_Log.md when done.
```

### Step 4 — Patients Module

```
Build the Patients module: 
1. Patients List screen (search by name/phone, matching 04_Screens_and_Sitemap.md)
2. Patient Profile screen (visit history timeline)
3. Add New Patient form
Backend routes per 03_TRD_Architecture.md Section 4 (/patients, /patients/:id, 
/patients/:id/visits). Use 07_Mock_Data.json patients to verify search and 
profile display work correctly, including the case of pat_001 (Muhammad Bilal) 
who has two visits two years apart — confirm his full history shows correctly, 
since that's the core value proposition of this product.

Definition of done: searching "Bilal" or his phone number returns his profile, 
and his profile shows both visits in the timeline. 
Update 09_Progress_Log.md when done.
```

### Step 5 — Reception, Queue & Consultation Modules (UPDATED — real clinic workflow)

```
Build the Reception Registration screen (search by full_name + relation_name + 
phone combined, quick-add form, atomic token generation), Today's Queue (counter 
view), Doctor's Live Queue (Call Next / Skip), and the Consultation screen 
(camera capture for prescription photo + optional report photos, NO typed 
medicine/dosage fields) — per 04_Screens_and_Sitemap.md and 03_TRD_Architecture.md. 

Test the duplicate-name search specifically: searching "Bilal" against 
07_Mock_Data.json must correctly show pat_001 and pat_004 as two distinct 
people (they intentionally share the same full_name), disambiguated by 
relation_name and phone.

Definition of done: I can register a patient (including the duplicate-name 
test), see them appear correctly ordered in the doctor's queue, capture a 
prescription photo on the Consultation screen, and complete the visit — and 
the visit then appears in that patient's profile timeline showing the photo, 
not a typed medicine list. 
Update 09_Progress_Log.md when done.
```

### Step 6 — Printable Prescription View

```
Build the Printable Prescription view per 04_Screens_and_Sitemap.md and the 
Stitch prompt for it — letterhead style, print-friendly CSS, minimal UI chrome.

Definition of done: opening this view for any visit and using the browser's 
print/PDF function produces a clean, professional-looking output. 
Update 09_Progress_Log.md when done.
```

### Step 7 — Fees & Reports

```
Build the Fees & Reports screen: daily/weekly/monthly toggle, total fees, 
total visits, and a simple chart, per 04_Screens_and_Sitemap.md. Pull real 
totals from the visits data (fee_amount field).

Definition of done: totals shown match a manual sum of fee_amount across the 
mock visits for the selected period. Update 09_Progress_Log.md when done.
```

### Step 8 — Medical Store Module

```
Build the Medical Store Inventory and Sales Log screens per 04_Screens_and_Sitemap.md. 
Recording a sale should reduce the linked inventory stock_qty. Low stock badge 
should trigger based on low_stock_threshold (see inv_002 and inv_004 in 
07_Mock_Data.json — both should already show as "Low Stock" once seeded).

Definition of done: recording a sale reduces stock correctly, and low-stock 
items are visually flagged. Update 09_Progress_Log.md when done.
```

### Step 9 — Dashboard

```
Build the Dashboard screen last, since it aggregates data from everything built 
so far: patients today, fees today, new vs repeat patients, low stock alert 
count — per 04_Screens_and_Sitemap.md and its Stitch prompt.

Definition of done: all four stat cards show real numbers derived from the 
seeded mock data, not placeholder/fake numbers. Update 09_Progress_Log.md when done.
```

### Step 10 — Polish Pass

```
Do a full pass across every screen built so far: 
1. Add loading states for any data-fetching screen
2. Add empty states (e.g. "No patients yet" / "No visits recorded") 
3. Add error states per 08_AI_Rules_and_Constraints.md Rule 8 (visible, not swallowed)
4. Check mobile/tablet responsiveness on Patients List and New Visit screens 
   specifically, since these are used at the reception desk
5. Run through the Code Standards checklist in 10_Code_Standards.md

List anything you find broken or inconsistent, don't silently fix and move on — 
report it first. Update 09_Progress_Log.md with a full summary of this pass.
```

---

## After Each Step — Standing Instruction

Paste this at the end of every step above if Antigravity doesn't do it automatically:

```
Before we move to the next step: update 09_Progress_Log.md with what you built, 
any assumptions you made, anything incomplete, and confirm the Definition of 
Done above was actually met — don't just say it's done, tell me how you verified it.
```

---

## If Antigravity Gets Something Wrong Mid-Build

Use this recovery prompt instead of just re-explaining from scratch:

```
Stop. Re-read 08_AI_Rules_and_Constraints.md and 09_Progress_Log.md. 
The issue is: [describe what went wrong]. 
Which rule did this violate, and what should have happened instead? 
Fix only this specific issue — do not touch unrelated files.
```
