# ClinicFlow — Multi-Warehouse Operator Architecture, Quick Shift Switching & Future Risk Roadmap

> **Context File:** `context/15_Multi_Warehouse_Operator_Architecture_and_Future_Roadmap.md`  
> **Status:** Specification Freeze & Active Implementation Blueprint  
> **Target System:** Dr. Muhammad Asif Ashraf Khan Clinic & Wholesale Homoeopathic Store (Hyderabad & Interior Sindh)  
> **Core Principle:** Single-Login Multi-Operator Workflow (Zero Logout Overhead) + Real-time Accountability + Inter-Godown Safety.

---

## 🏛️ 1. Business Context & Problem Statement

In high-volume medical retail and wholesale distribution environments, multiple staff members (e.g., Raza, Usama, Waheed Bhai, Farhan) take turns operating the **POS billing counter** or the **wholesale godown terminals**.

### The Problem with Traditional Re-Login:
1. Logging out and entering email/password for every 2-minute bill causes cashier congestion, slows patient queues, and leads to staff sharing credentials.
2. If everyone uses a single generic account without operator attribution, cash drawer shortages, stock discrepancies, and unauthorized discounts cannot be traced.

---

## ⚡ 2. Single-Login + Quick Active Operator Switching Architecture

The counter/terminal PC logs in **once at the start of the business day**. Individual operators switch their active identity with a **1-click dropdown/pill selector** without interrupting the active session.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  🏥 Medical Store POS Counter               [👤 Operator: Raza (Counter 1) ▾]  [F2 Search] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  📦 Central Godown 1 (Lajpat Road)          [👤 Operator: Usama (Incharge) ▾]  [➕ New GRN]│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Workflow Rules:
1. **Session Persistence:** Login remains active for the full work shift on the browser terminal.
2. **Instant Operator Switching:** Top-bar header features an **Active Operator Pill**. Clicking it instantly changes the current operator for subsequent transactions.
3. **Local Memoization:** Selected operator ID is stored in `localStorage` (`cf_pos_active_operator`) so accidental page reloads preserve the active operator.
4. **Immutable Transaction Attribution:** Every generated transaction attaches the following metadata:
   ```javascript
   {
     id: "sale_1042",
     receipt_no: "POS-7861",
     warehouse_id: "wh_str",           // Location Identifier
     warehouse_name: "Medical Store Counter",
     cashier_id: "user_raza_01",
     cashier_name: "Raza (Counter 1)", // Displayed on Receipts & Logs
     created_at: "2026-08-24T17:15:00Z"
   }
   ```
5. **80mm Thermal Receipt Header/Footer:**
   ```text
   ================================================
    Dr. Muhammad Asif Ashraf Khan Clinic & Homoeo Store
   Lajpat Road, Hyderabad | Phone: 0300-1234567
   ================================================
   Invoice #: POS-7861      Date: 24/08/2026 05:15 PM
   Cashier / Operator: Raza (Counter 1)
   ------------------------------------------------
   ```

---

## 🏢 3. Multi-Warehouse Portals & Assigned Staff Filtering

Regardless of how many physical godowns or retail counters exist, each terminal displays only the operators assigned to that location:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ LOCATION 1: Medical Store Counter (POS)                                                 │
│ Assigned Operators: Waheed Bhai, Counter Staff, Receptionist                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ LOCATION 2: Main Central Godown 1 (Lajpat Road Bulk Storage)                            │
│ Assigned Operators: Raza (Godown Incharge), Bulk Dispatch Team                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ LOCATION 3: Secondary Godown 2 (Site Area Overflow Storage)                             │
│ Assigned Operators: Usama (Incharge), Warehouse Logisticians                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Filtering Logic:
- When a terminal is configured or logged in for `wh_001` (Main Godown), the Operator dropdown filters:
  ```javascript
  const activeStaff = dbUsers.getAll().filter(u => 
    u.status === "active" && (u.assigned_warehouse_id === currentWarehouseId || u.role === "owner" || u.role === "admin")
  );
  ```
- This prevents a Counter POS operator from accidentally being tagged on Godown bulk dispatches.

---

## 👥 4. Operator & Staff Master Management (`/settings` & `/admin`)

Staff and Salesmen are configured in the **Staff & Master Registration** section:

### Data Model Schema (`dbUsers` / `dbSalesmen`):
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `String` | Unique identifier (e.g. `staff_raza_101`) |
| `name` | `String` | Full name (e.g. `Raza Ali`) |
| `display_label` | `String` | Badge label (e.g. `Raza (Counter 1)`) |
| `role` | `String` | `cashier` \| `salesman` \| `godown_incharge` \| `pharmacist` \| `doctor` \| `admin` |
| `assigned_warehouse_id`| `String` | Linked warehouse (`wh_str`, `wh_001`, `wh_002`) |
| `phone` | `String` | Contact number for WhatsApp reports |
| `status` | `String` | `active` \| `inactive` \| `suspended` |
| `can_give_discounts` | `Boolean` | Privilege to offer line or bill discounts |
| `max_discount_pct` | `Number` | Maximum allowed discount without manager PIN (e.g. 10%) |

---

## ⏰ 5. Real-Time Telemetry & Dynamic Dashboard Greetings

The dashboard provides real-time time-of-day awareness:
- **05:00 AM – 11:59 AM:** ☀️ `Good Morning, Dr. Kashif Khan` / `صبح بخیر`
- **12:00 PM – 04:59 PM:** 🌤️ `Good Afternoon, Dr. Kashif Khan` / `دوپہر بخیر`
- **05:00 PM – 04:59 AM:** 🌙 `Good Evening, Dr. Kashif Khan` / `شام بخیر`
- **Live Formatted Calendar:** `Monday, 24 August 2026` + Live Shift Telemetry.

---

## 🔮 6. Senior Developer Gap Analysis & Future Risk Roadmap

Detailed architectural solutions for 4 major operational hurdles encountered during scaling:

### ⚠️ Risk 1: Cash Drawer Accountability & Mid-Shift Shortages
- **Problem:** If Operator A runs the till from 9 AM to 1 PM (Rs. 30k) and Operator B runs from 1 PM to 6 PM (Rs. 40k), an end-of-day cash shortage of Rs. 1,500 causes finger-pointing.
- **Solution:** 
  1. **Operator-wise Cash Breakdown in Day-End Z-Report:**
     - `Raza Total Cash Sales:` Rs. 30,000 (12 Invoices)
     - `Usama Total Cash Sales:` Rs. 40,000 (18 Invoices)
     - `Total Drawer Cash:` Rs. 70,000
  2. **1-Click Mid-Shift Cash Drawer Handover:** Allows outgoing operator to lock their sub-shift count before handing over the drawer.

---

### ⚠️ Risk 2: Unauthorized Bill Deletions & Discount Fraud
- **Problem:** Cashier issues bill, takes cash from patient, then deletes or voids the invoice post-departure to pocket the money.
- **Solution:**
  1. **Zero Hard-Deletes:** Invoices are never purged from the database.
  2. **Audit-Logged Voids:** Voiding an invoice requires:
     - Mandatory Reason (e.g., "Doctor modified prescription formulation").
     - Authorizing Doctor / Super Admin PIN.
     - Referenced original receipt ID in the financial audit log.

---

### ⚠️ Risk 3: Inter-Godown Stock Transfer Race Conditions ("Dispatched 50, Arrived 48")
- **Problem:** Godown 1 dispatches 50 bottles of BM Drops to Counter POS. 2 bottles break in transit. Immediate automatic stock increment leads to inventory inflation.
- **Solution — Two-Step Transfer Protocol:**
  - **Step 1 (Dispatch):** Godown Incharge creates transfer $\to$ Status: `In-Transit` (Godown stock deducted by 50).
  - **Step 2 (Receive & Acknowledge):** Counter receiver physically counts items and clicks `Accept Stock (48 Received, 2 Damaged)`. Counter stock increments by 48, and 2 units are booked to `Damaged / Wastage Account`.

---

### ⚠️ Risk 4: Hardware Thermal Printer Paper Jam & Queue Rush
- **Problem:** 80mm printer paper runs out or gets jammed during peak OPD rush. Cashier cannot easily locate past sales in the log while queue waits.
- **Solution:**
  - Dedicated **`F10 — Instant Reprint Last Receipt`** shortcut button on POS screen that re-triggers the ESC/POS print buffer for the latest transaction without opening search modals.

---

## 🛡️ 8. Zero-Pilferage Stock Theft Prevention Engine (اسٹاک چوری کی مکمل روک تھام)

Medical stores aur wholesale godowns me stock theft / pilferage rokne ke liye **5-Layer Security Shield**:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      🛡️ ZERO-PILFERAGE 5-LAYER STOCK PROTECTION                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Strict Negative Stock Lock (Negative Stock Sell Band - Zero Tolerance)       │
│ Layer 2: Dual-PIN Stock Adjustment & Damage Write-Off (With Mandatory Photo Proof)    │
│ Layer 3: 2-Step Inter-Godown Transfer Gate Pass & Physical Receipt Sign-Off           │
│ Layer 4: Blind Cyclic Stock Audit (Physical Shelf Count vs Software Balance)          │
│ Layer 5: Unbilled Sale Deterrent (Customer Thermal Receipt + OPD Prescription Link)   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Layer 1: Strict Negative Stock Lock (Zero Tolerance)
- **Vulnerability:** Salesman bina purchase charhaye ya chori chhupane ke liye stock negative me le jata hai.
- **Solution:** POS aur Wholesale Invoices me negative stock selling **100% BLOCKED**. Agar Counter par 5 units hain, toh system 6th unit sell karne ki ijazat nahi dega jab tak Godown se formal transfer ya purchase record na ho.

### 2. Layer 2: Dual-PIN Damage & Expiry Write-Off (Photo Proof)
- **Vulnerability:** Salesman achhi dawa ghar le jaye aur software me "Toot gayi / Damaged" likh de.
- **Solution:**
  - Kisi bhi item ko `Damaged` ya `Wastage` mark karne ke liye **Doctor / Super Admin Master PIN** lazmi hoga.
  - Optional Photo Capture: Tooti hui bottle ya phati packing ki photo upload karna compulsory hoga jo audit log me hamesha rahegi.

### 3. Layer 3: 2-Step Transfer Gate Pass
- **Vulnerability:** Delivery boy raste me 10 bottles chori karke bole "40 mili thi".
- **Solution:**
  - Godown Incharge dispatch karega $\rightarrow$ Gate Pass Slip print hogi (`Dispatched: 50`).
  - Counter Incharge physical count karke slip par sign karega aur software me `48 Received + 2 Discrepancy` enter karega. Discrepancy report foran Doctor Sahab ko alert karegi.

### 4. Layer 4: Blind Cyclic Stock Audit (Andha Stock Muaina)
- **Vulnerability:** Staff ko pata hota hai system me kitna stock likha hai, toh wo sirf system wala number likh dete hain.
- **Solution:**
  - **Blind Count Sheet:** Staff ko print nikaal kar di jaye jisme dawaiyon ke naam hon lekin **Stock Quantity blank ho**.
  - Staff physical gin kar quantity likhega.
  - Software compare karega:
    - *Software Stock:* 100 units
    - *Physical Count:* 94 units
    - *Variance:* -6 units (Chori / Shortage value: Rs. 1,800) $\rightarrow$ Shift Incharge ki salary/account se audit flag.

### 5. Layer 5: 100% Mandatory Receipt Verification
- Patient ko slip milna lazmi hai; bina slip mariz ko dawa dene par reception/doctor counter cross-check karega (Linked OPD token check).

---

## 📋 9. Implementation Checklist

- [x] Context & Architecture Specification Documented (`context/15_Multi_Warehouse_Operator_Architecture_and_Future_Roadmap.md`).
- [ ] Implement Quick Active Operator Dropdown Selector in `MedicalStorePOS.jsx`.
- [ ] Implement Quick Active Operator Dropdown Selector in `WarehouseManagement.jsx`.
- [ ] Implement Anti-Theft Strict Negative Stock Lock in POS checkout.
- [ ] Implement Admin PIN requirement for Stock Adjustments & Damage Write-offs.
- [ ] Implement Blind Cyclic Stock Audit screen with automated variance calculation.
- [ ] Tag `cashier_name` and `cashier_id` in `dbSales.checkout()` and `dbPurchases.addGRN()`.
- [ ] Add Operator Filter & Column in `MedicalStoreSalesLog.jsx`.
- [ ] Add Operator-wise Cash Totals in Day-End Z-Report (`FeesReports.jsx`).
- [ ] Add `F10 — Reprint Last Receipt` hotkey in `MedicalStorePOS.jsx`.
- [ ] Run full test suite (`npm test`) to ensure zero regression.
