# 📖 CliniCore (ClinicFlow) — Complete Master User Manual & Guidebook
### *A Practical Step-by-Step Operating Handbook for Dr. Muhammad Asif Ashraf Khan Clinic & Wholesale Pharmacy*

---

```
  ========================================================================================
  🏥 CLINICORE HYBRID ENGINE V2.5 — COMPLETE STEP-BY-STEP OPERATING MANUAL (HINGLISH)
  ========================================================================================
  Author: K.B Software / Senior Systems Engineering Team
  Language: Hinglish (Roman Urdu + Standard Medical/Accounting English)
  Target Users: Clinic Receptionists, Dispensers, Godown Keepers, Doctors, Accountants & Admins
  Format: Printable PDF-Ready Book / Online Operating Guide
  ========================================================================================
```

---

## 📑 Table of Contents (Fehrist)

1. [🌟 System Overview & Daily Workflow Architecture](#1-system-overview--daily-workflow-architecture)
2. [🎫 Chapter 1: Reception Desk & Patient Token Generation](#2-chapter-1-reception-desk--patient-token-generation)
3. [🩺 Chapter 2: Doctor Consultation Chamber & OPD Queue](#3-chapter-2-doctor-consultation-chamber--opd-queue)
4. [💊 Chapter 3: Medical Store POS (Pharmacy Counter Dispensing)](#4-chapter-3-medical-store-pos-pharmacy-counter-dispensing)
5. [🏢 Chapter 4: Wholesale B2B Sales & Party Management](#5-chapter-4-wholesale-b2b-sales--party-management)
6. [📦 Chapter 5: Company Purchases (Inward GRN, Batch # & Expiry)](#6-chapter-5-company-purchases-inward-grn-batch--expiry)
7. [📊 Chapter 6: 4-Level Stock Ledger Audit Engine](#7-chapter-6-4-level-stock-ledger-audit-engine)
8. [💰 Chapter 7: CashBook, Day Closing & 1-Click WhatsApp Report](#8-chapter-7-cashbook-day-closing--1-click-whatsapp-report)
9. [📂 Chapter 8: Patient Profile, Medical Records & Optical Zoom Lightbox](#9-chapter-8-patient-profile-medical-records--optical-zoom-lightbox)
10. [📺 Chapter 9: Waiting Room TV Screen & Public Live Tracker](#10-chapter-9-waiting-room-tv-screen--public-live-tracker)
11. [🔐 Chapter 10: Super Admin Panel, Staff Roles & 9:00 PM Auto Backup](#11-chapter-10-super-admin-panel-staff-roles--900-pm-auto-backup)
12. [⌨️ Appendix: Keyboard Hotkeys & Fast Navigation Cheatsheet](#12-appendix-keyboard-hotkeys--fast-navigation-cheatsheet)

---

## 1. 🌟 System Overview & Daily Workflow Architecture

CliniCore ek complete **Hybrid Web + Desktop Engine** hai jo Doctor Clinic aur Wholesale Medical Store dono ko ek sath seamless sync ke sath chalata hai.

### 🔄 Pure Din ka Complete Flowchart:

```
               ┌──────────────────────────────────────────────┐
               │    1. Patient Aata Hai (Reception Desk)       │
               │   • Token #01 Generate hota hai             │
               │   • 80mm Slip Print ho kar Patient ko milti  │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │     2. Waiting Area (TV Screen Display)      │
               │   • TV par "Token #01 ── Room 1" call hota   │
               │   • Patient Doctor Chamber me enter hota hai │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │   3. Doctor Chamber (Consultation Screen)    │
               │   • Doctor checkup karta hai                 │
               │   • Prescription likh kar Camera se photo li │
               │   • Visit "Completed" mark hoti hai          │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │    4. Pharmacy Counter (Medical Store POS)   │
               │   • Dispenser "F4 (Link OPD)" dabata hai     │
               │   • Doctor ka likha hua nuskha screen par    │
               │   • Dawai scan kar ke 80mm Bill print hota   │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │    5. Day Closing & Galla Hisaab (Night)     │
               │   • OPD Fees + POS Sales + Expenses calculate│
               │   • 1-Click WhatsApp report doctor ko send   │
               │   • Raat 9:00 PM automated cloud backup mail │
               └──────────────────────────────────────────────┘
```

---

## 2. 🎫 Chapter 1: Reception Desk & Patient Token Generation

### 📌 Ye Feature Kis Liye Bana Hai?
Mareezon ki aamad par unka token banana, OPD fee collect karna, aur 80mm thermal slip print karna taake mareez line me lag kar baithay aur TV screen par apna number dekh sakay.

### 🛠️ Kese Use Karna Hai (Step-by-Step):

1. Sidebar se **"Reception Queue"** ya **"New Patient"** par click karein.
2. **Naya Mareez (New Patient):**
   - Name (e.g. `Abdul Ghaffar`), Phone Number (`0300-1234567`), Age (`42`), Gender (`Male`), City (`Hyderabad`) likhein.
   - Doctor select karein (`Dr. Muhammad Asif Ashraf Khan`).
   - Fee Status select karein (`Paid: Rs. 300` ya `Free / Waived`).
3. **Purana Mareez (Existing Patient Search):**
   - Agar mareez pehle aa chuka hai, to sirf uska **Phone Number** ya **MR Number** type karein. Uska sara record auto-fill ho jaye ga!
4. **Print Token & Check-in:**
   - **"Save & Print Token"** button dabayein (ya `Enter` press karein).
   - Thermal Printer se automatically **80mm Token Slip** print ho kar nikal aye gi:
     ```text
     ================================
      DR. MUHAMMAD ASIF ASHRAF KHAN
       Lajpat Road, Hyderabad, Sindh
     ================================
     TOKEN NUMBER: #01
     Patient: Abdul Ghaffar (42y / Male)
     Date: 27-Aug-2026 09:30 AM
     OPD Fee: Rs. 300 (PAID)
     ================================
      Please wait for your call on TV
     ================================
     ```

### 💡 Special Feature: Late Arrival Re-issuance (Skipped Token)
- Agar koi mareez apne time par mojood nahi tha aur doctor ne skip kar diya, to jab wo wapis aye:
- Receptionist uske naam ke aage **"Re-issue Token"** dabaye ga.
- Mareez ko naya active token mil jaye ga **bina dobara fees charge kiye**!

---

## 3. 🩺 Chapter 2: Doctor Consultation Chamber & OPD Queue

### 📌 Ye Feature Kis Liye Bana Hai?
Doctor apne kamray me baith kar computer/tablet par live waiting list dekhta hai, aglay mareez ko TV screen par call karta hai, aur mareez ka nuskha (prescription) camera se scan kar ke database me save karta hai.

### 🛠️ Kese Use Karna Hai:

1. Sidebar se **"Doctor Chamber"** ya **"Consultation"** open karein.
2. **Call Next Patient:**
   - Screen par sab se upar bara button hoga: **"Call Next Patient (Token #01)"**.
   - Ye button dabate hi Waiting Hall TV screen par chime bajti hai aur display ho jata hai: `Token #01 — Please Proceed to Room 1`.
3. **Doctor Prescription (HD Camera Capture & Upload):**
   - Doctor apna parcha hath se likhta hai.
   - WebApp par **"Snap Prescription"** ya **"Upload Photo"** button dabayein.
   - System ka built-in HD Canvas Compressor photo ko compress kar ke instantly save kar deta hai (100% crystal clear zoom quality ke sath).
4. **Diagnosis & Advised Tests:**
   - Clinical notes (e.g. `BP: 130/85, Fever 101F, Viral Infection`) aur required lab tests type karein.
5. **Mark Completed:**
   - **"Complete & Next"** dabayein.
   - Mareez pharmacy ki taraf move ho jata hai aur next token ready ho jata hai.

---

## 4. 💊 Chapter 3: Medical Store POS (Pharmacy Counter Dispensing)

### 📌 Ye Feature Kis Liye Bana Hai?
Pharmacy counter par fast retail sale karne ke liye. Chahe direct bahar se walk-in customer dawai lene aye ya clinic ke andar se doctor ka prescription lekar aye.

### 🛠️ Kese Use Karna Hai:

#### Case A: Walk-In Retail Customer (Bahar ka Grahak)
1. **Search Medicine:** Search bar me dawai ka naam ya company code type karein (e.g. `Panadol`, `Diacard`, `BM-01`).
2. **Keyboard Add:** Arrow keys se medicine select karein aur `Enter` dabayein. Dawai cart me add ho jaye gi.
3. **Qty & Discount:** Qty enter karein (e.g. `2`). Agar koi discount % dena hai to likhein.
4. **Checkout (F2):**
   - `F2` dabayein ya **"Complete & Print"** par click karein.
   - 80mm receipt foran print ho jaye gi aur godown/store ka stock deduct ho jaye ga.

#### Case B: Linked OPD Patient (Doctor ka Mareez)
1. Screen par **"Link OPD (F4)"** button dabayein.
2. Mareez ka **Token #** (e.g. `01`) ya **Naam** select karein.
3. Screen par doctor ka likha hua **Prescription Photo** pop-up ho jaye ga!
4. Dispenser screen par nuskha dekhte hue dawaiyan add karega aur bill nikal dega.

#### 👤 Single-Login Multi-Operator Switching:
- Counter terminal par **Mustafa** login hai.
- Agar Mustafa ki jagah **Raza** ya **Usama** baithe, to screen ke top bar par **"Operator: [ Raza Ali ▼ ]"** select karein.
- Har bill par Raza Ali ka naam stamp hoga, logout karne ki koi zaroorat nahi!

---

## 5. 🏢 Chapter 4: Wholesale B2B Sales & Party Management

### 📌 Ye Feature Kis Liye Bana Hai?
Medical Stores aur Wholesale Partyon ko bulk medicine supply karne, Udhaar/Credit ledger maintain karne aur biltiyan/invoices banane ke liye.

### 🛠️ Kese Use Karna Hai:

1. Sidebar se **"Wholesale / Warehouse"** me jayein aur **"New Sale Invoice"** kholein.
2. **⚡ Fast Party Code Search:**
   - Party Code wale box me party ka code type karein (e.g. `001`, `Muslim`, `PTY-108`).
   - Software foran Party Name, City (`Dharki`), Phone, Narration aur Salesman auto-fill kar dega!
3. **💰 Live Customer Udhaar Banner:**
   - Screen par peela banner show hoga:
     > `Party: #001 — Muslim Medical Store (Dharki) | Current Udhaar: Rs. 14,500 [⚡ Live Ledger Sync]`
4. **Add Wholesale Items:**
   - Product Code ya Name search karein.
   - Packing size (e.g. `30ML`, `120ML`), TP Rate, Gross, aur Company Discount % auto-calculate hoga.
5. **Bill-Level Trade Discount & Freight (Bilty) Charges:**
   - Footer me extra bill discount (e.g. `Rs. 500`) aur Bilty/Courier charges (e.g. `Rs. 200`) add karein.
6. **Save & Print Invoice:**
   - Invoice save ho jaye gi aur party ke khate (ledger) me udhaar update ho jaye ga.

---

## 6. 📦 Chapter 5: Company Purchases (Inward GRN, Batch # & Expiry)

### 📌 Ye Feature Kis Liye Bana Hai?
Jab distributor ya pharma company (Schwabe, BM, Paul Brooks, Contimade waghera) se stock clinic ke godown me aye, to unka bill enter karna taake stock add ho jaye.

### 🛠️ Kese Use Karna Hai:

1. Sidebar se **"Purchases / Inward GRN"** kholein.
2. **Header Details:**
   - **Company Invoice / Bill #:** Distributor ki invoice ka number likhein (e.g. `10505`).
   - **Supplier / Company:** Select karein (e.g. `Contimade Traders`).
   - **Salesman / Booker:** Select karein ya `+ New Salesman` se on-the-fly add karein.
   - **Bilty # & Carrier:** Courier tracking number likhein (e.g. `PAR23311018`).
3. **Cart Entry (Fast Line Item Bar):**
   - Medicine select karein.
   - **Batch # / Lot No:** Dabay par likha batch number daalein (e.g. `250525`).
   - **Expiry Date:** Exp date daalein (e.g. `04/30` ya `30-Apr-30`).
   - Qty, TP Rate, Gross, Disc % enter kar ke **"Add"** dabayein.
4. **Footer Breakdown:**
   - Items Subtotal me se **Extra Trade Discount (Rs.)** minus karein aur **Freight / Courier Expense** plus karein.
5. **Save Invoice & Add to Stock:**
   - Ek click par godown me stock add ho jaye ga aur distributor ke khate me payable amount chali jaye gi.

---

## 7. 📊 Chapter 6: 4-Level Stock Ledger Audit Engine

### 📌 Ye Feature Kis Liye Bana Hai?
Dr. Asif Khan ke MS Access style ka 4-level audit ledger jo batata hai ke konsi dawai kab aayi, kis bill se aayi, kis mareez ya party ko bechi gayi, aur ab godown me kitni bachi hai!

### 🔍 4-Level Audit Tree:
- **Level 1 (Category Summary):** Brands aur Categories ki list (e.g. Drops, Syrup, Ointment, Schwabe, BM).
- **Level 2 (SKU Summary):** Us category ke andar tamam medicines aur unka mojooda stock.
- **Level 3 (Product Timeline):** Date-wise hisaab (kis date ko kitna stock In hua aur kitna Out hua).
- **Level 4 (Voucher Deep-Dive):** Us date ka exact Sale Invoice ya Purchase Bill No aur mukammal tafseel.

---

## 8. 💰 Chapter 7: CashBook, Day Closing & 1-Click WhatsApp Report

### 📌 Ye Feature Kis Liye Bana Hai?
Clinic aur pharmacy ke pure din ki aamadni (Cash Inflow) aur kharchon (Cash Outflow) ka hisab jodna aur doctor sahab ko WhatsApp par closing slip bhejna.

### 🛠️ Kese Use Karna Hai:

1. Sidebar se **"Day Closing / Reports"** par jayein.
2. Screen par live summary show hogi:
   - **Total OPD Fees Collected:** `Rs. 13,500`
   - **Total POS Counter Sales:** `Rs. 28,400`
   - **Total Wholesale Recovery Received:** `Rs. 15,000`
   - **Total Shop Expenses Paid:** `Rs. 1,200`
   - **Net Cash In Hand (Galla Balance):** `Rs. 55,700`
3. **Print Day Closing:**
   - **"Print 80mm Summary"** dabane se receipt print ho kar cash ke sath attach ho jati hai.
4. **1-Click WhatsApp Dispatch:**
   - **"Send WhatsApp"** dabayein. Doctor sahab ke WhatsApp par formatted report chali jaye gi:
     ```text
     📋 DAILY CLOSING REPORT — CLINICORE
     🏥 Dr. Muhammad Asif Ashraf Khan Clinic
     📅 Date: 27-Aug-2026

     • Total OPD Patients: 45 (Rs. 13,500)
     • Counter Pharmacy Sales: Rs. 28,400
     • Wholesale Recoveries: Rs. 15,000
     • Clinic Expenses: Rs. 1,200
     ---------------------------------
     💵 NET CASH IN HAND: Rs. 55,700
     ---------------------------------
     Auto-Generated by CliniCore Engine
     ```

---

## 9. 📂 Chapter 8: Patient Profile, Medical Records & Optical Zoom Lightbox

### 📌 Ye Feature Kis Liye Bana Hai?
Jab koi purana mareez aaye, to uski pichli tamam visits, purane nuskhe, lab reports aur tareekhein 1 second me dekhna.

### 🛠️ Kese Use Karna Hai:

1. **Patients List** me jayein aur mareez ka naam ya phone search karein.
2. Mareez ki profile par click karein:
   - **Visit History Cards:** Pichle tamam checkups ki tareekhein aur fess status.
   - **HD Prescription Lightbox:** Nuskhe ki photo par click karein.
   - **Optical Zoom & Rotate:** Lightbox me `+` (Zoom In), `-` (Zoom Out), aur `Rotate 90°` ke buttons se doctor ka likha nuskha bari screen par HD quality me study karein.
   - **Upload Lab Reports:** Mareez ke Blood Test, X-Ray ya Ultrasound ki photos upload karein jo hamesha uski file me mehfooz rahein gi.

---

## 10. 📺 Chapter 9: Waiting Room TV Screen & Public Live Tracker

### 📌 Ye Feature Kis Liye Bana Hai?
Waiting area me lagi TV screen par mareezon ke tokens live show karna aur mareezon ke mobile par QR code se live token tracker chalana.

### 🛠️ Kese Use Karna Hai:

1. **TV Screen Mode (`/live`):**
   - Reception wale computer se TV ko HDMI cable ya Smart TV Browser par `https://app.clinicore.me/live` open karein.
   - Screen par bara **Current Calling Token (#01 ── Room 1)** aur niche **Next Waiting Tokens (#02, #03, #04)** green aesthetics me audio chime ke sath display honge.
2. **Patient Mobile Live Tracker (`/`):**
   - Mareez apni slip par mojood QR code scan kar ke apne phone par dekh sakta hai ke uske aage kitne mareez baaqi hain, taake wo bahar wait kar sakay.

---

## 11. 🔐 Chapter 10: Super Admin Panel, Staff Roles & 9:00 PM Auto Backup

### 📌 Ye Feature Kis Liye Bana Hai?
Clinic ke security ruls, staff members ke passwords, automated cloud backups aur software licensing policy ko control karne ke liye.

### 🛠️ Key Controls (`/admin`):

1. **Staff & Users Management:**
   - Naye staff members add karein (Cashier, Storekeeper, Doctor, Receptionist).
   - Har staff ko sirf uske role ka access milega.
2. **Nightly 9:00 PM Automated Cloud Backup:**
   - System daily raat 9:00 PM par live database ka snapshot `.cfbak` file bana kar doctor sahab ki email (`drasifhosting@gmail.com`) par deliver karta hai.
3. **Manual 1-Click Backup & Restore:**
   - Kisi bhi waqt **"Download .cfbak Backup"** dabane se pura database encrypt ho kar download ho jata hai.
4. **Software Licensing & Remote Control:**
   - Developer yahan se monthly subscription fee, grace period aur selective modules (POS, B2B, Reports) ko control kar sakta hai.
   - **"1-Click Mark as Paid"** se 30 din ki full access extension ho jati hai.

---

## 12. ⌨️ Appendix: Keyboard Hotkeys & Fast Navigation Cheatsheet

Tezi se billing aur registration karne ke liye mouse chhor kar ye keyboard shortcuts use karein:

| Hotkey | Feature / Action | Screen |
|---|---|---|
| **`Enter`** | Quick Add item / Submit Form | Everywhere |
| **`Tab`** | Next Input Field par jump karna | All Forms |
| **`F4`** | Link Today's OPD Doctor Prescription | Medical Store POS |
| **`F10`** | Instant Reprint Last Printed Receipt | Medical Store POS |
| **`F2`** | Fast Cash Checkout & Print Receipt | Medical Store POS |
| **`Esc`** | Close Open Modal / Search Popup | Everywhere |
| **`Ctrl + P`** | Print Screen / Save as PDF | Browser Standard |

---

## 🖨️ How to Save / Print This Manual as a PDF Book:

1. Is document ko browser me open karein.
2. Apne keyboard se **`Ctrl + P`** (Print) dabayein.
3. Destination me **"Save as PDF"** select karein.
4. Layout ko **"Portrait"** aur Margins ko **"Default"** par set kar ke **"Save"** dabayein.
5. Aapki mukammal **CliniCore Operating Manual PDF Book** ready ho jaye gi!

---
*© 2026 CliniCore (ClinicFlow) — Engineered by K.B Software for Dr. Muhammad Asif Ashraf Khan Clinic & Wholesale Pharmacy.*
