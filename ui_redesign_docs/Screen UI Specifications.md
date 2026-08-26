# **03 — Screen-by-Screen UI Layout Specifications**

## **1\. Top Navigation & Global Sidebar (SidebarLayout.jsx)**

* **Header Bar:** Glassmorphic container featuring dynamic clinic branding, live cloud sync status pill (🟢 Online / 🟡 Syncing), and active operator avatar pill.  
* **Desktop Navigation:** Collapsible sidebar (256px expanded ⇄ 80px compact icon mode).  
* **Mobile Navigation:** Touch drawer (z-50) with backdrop blur and fixed mobile bottom nav bar (h-16).

## **2\. Executive Dashboard (Dashboard.jsx)**

* **Telemetry Cards:** Bento-grid with 4 KPI summary cards (Today's OPD Collections, Total Patients Registered, Counter Sales, Active Chamber Status).  
* **Chamber Switcher:** Quick-access profile pill allowing doctors to swap chambers instantly.

## **3\. OPD Queue & Doctor Chamber (DoctorQueue.jsx & ConsultationScreen.jsx)**

* **Queue Cards:** Translucent cards with animated status badges (Waiting, In Consultation, Completed, Reports Pending).  
* **Vitals HUD:** Compact visual widget logging BP, Pulse, and Temp.  
* **Fixed Action Bar:** Bottom bar (bottom-16 md:bottom-0) with side-by-side "Complete Visit" and "Complete & Forward Reports" buttons.

## **4\. Counter Pharmacy POS (MedicalStorePOS.jsx)**

* **Split-Screen Workspace:**  
  * *Left Pane:* Searchable inventory matrix with company brand tags (\[BM\], \[Paul Brooks\], \[Schwabe\]) and stock level chips.  
  * *Right Pane:* Interactive POS checkout cart with touch-friendly quantity steppers, item discount inputs, and 80mm printable receipt triggers.

## **5\. Financial Register & CashBook (FeesReports.jsx)**

* **3-Tab Bento Interface:**  
  1. *Daily Cash Closing:* Opening cash float input, drawer cash calculation, and physical note denomination counter (5000, 1000, 500, 100, 50, 20, 10\) with live variance alert.  
  2. *CashBook Journal:* Inline double-entry voucher entry form (Receive / Paid) and dual debit/credit ledger tables.  
  3. *OPD Analytics:* Visual trends and daily fee totals.

## **6\. Stock Ledger & Inventory (MedicalStoreInventory.jsx & StockLedgerModal.jsx)**

* **4-Level Drilldown Matrix:** Clean tabbed views (Category Summary → SKU Summary → Timeline → Date Voucher History Modal) with sticky headers and search filters.