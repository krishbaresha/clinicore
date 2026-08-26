# **06 — Executable Agent Prompts for Antigravity**

> **Instructions:** Copy each prompt block below into Antigravity one phase at a time. Do not move to the next phase until npm test and npm run build succeed.

### **🟢 PROMPT PHASE 1: Theme Tokens & Navigation Shell**

Act as the Principal UI/UX Senior Frontend Engineer. Your task is to implement Phase 1 of the CliniCore UI Redesign Roadmap.

Follow the guidelines in \`ui\_redesign\_docs/01\_UI\_Design\_System\_and\_Tokens.md\` and \`02\_Universal\_Responsiveness\_Rules.md\`.

TASKS:  
1\. Update \`src/index.css\` with glassmorphism utilities, modern custom scrollbars, zero horizontal window scroll locks, and 44px ergonomic touch targets.  
2\. Refactor \`src/layouts/SidebarLayout.jsx\`:  
   \- Apply translucent glassmorphism to top bar and mobile drawer.  
   \- Add responsive sidebar collapse (Full on desktop, 80px compact on tablet, drawer on mobile).  
   \- Retain all \`syncEngine\` subscribers, active clinic titles, and operator profile switchers.  
3\. Verify zero breaking changes: Run \`npm run build\` and ensure exit code 0\.

### **🟢 PROMPT PHASE 2: Doctor Queue & OPD Consultation Workspace**

Act as the Principal UI/UX Senior Frontend Engineer. Your task is to implement Phase 2 of the CliniCore UI Redesign Roadmap.

Follow specifications in \`ui\_redesign\_docs/03\_Screen\_by\_Screen\_UI\_Specifications.md\` (Section 3\) and \`04\_Anti\_Bug\_Zero\_Regression\_Protocol.md\`.

TASKS:  
1\. Refactor \`src/pages/DoctorQueue.jsx\`:  
   \- Convert patient token lists into responsive glassmorphic cards with status pills.  
   \- Add single-tap doctor chamber queue switcher.  
2\. Refactor \`src/pages/ConsultationScreen.jsx\`:  
   \- Add Vitals HUD card (BP, Pulse, Temp).  
   \- Ensure sticky bottom action bar positions safely above mobile bottom nav (\`bottom-16 md:bottom-0\`).  
   \- Preserve all photo capture, compression, and report upload logic.  
3\. Verify: Run \`npm test\` and \`npm run build\`.

### **🟢 PROMPT PHASE 3: Counter POS & Pharmacy Sales Workspace**

Act as the Principal UI/UX Senior Frontend Engineer. Your task is to implement Phase 3 of the CliniCore UI Redesign Roadmap.

Follow specifications in \`ui\_redesign\_docs/03\_Screen\_by\_Screen\_UI\_Specifications.md\` (Section 4).

TASKS:  
1\. Refactor \`src/pages/MedicalStorePOS.jsx\`:  
   \- Create responsive split-view (Left: Medicine matrix with brand tags \`\[BM\]\`, \`\[Paul Brooks\]\`; Right: Touch-friendly POS checkout cart).  
   \- Enforce 44px min-touch target on Qty steppers (\`+\` / \`-\`) and line item percentage discount inputs.  
   \- Preserve all \`dbSales.checkout\` logic, stock deductions, and 80mm thermal receipt modals.  
2\. Verify: Run \`npm test\` and \`npm run build\`.

### **🟢 PROMPT PHASE 4: Financial Registers, CashBook & Z-Reports**

Act as the Principal UI/UX Senior Frontend Engineer. Your task is to implement Phase 4 of the CliniCore UI Redesign Roadmap.

Follow specifications in \`ui\_redesign\_docs/03\_Screen\_by\_Screen\_UI\_Specifications.md\` (Section 5).

TASKS:  
1\. Refactor \`src/pages/FeesReports.jsx\`:  
   \- Structure into a 3-tab Bento Interface (Daily Cash Closing, Cashbook Ledger, OPD Trends).  
   \- Style physical note denomination counters with live variance feedback.  
   \- Add horizontal scroll wrappers to CashBook debit/credit ledger tables.  
   \- Retain all \`dbCashBook\` operations and thermal voucher triggers.  
2\. Verify: Run \`npm test\` and \`npm run build\`.

### **🟢 PROMPT PHASE 5: Stock Ledger & Governance Admin Suite**

Act as the Principal UI/UX Senior Frontend Engineer. Your task is to implement Phase 5 of the CliniCore UI Redesign Roadmap.

Follow specifications in \`ui\_redesign\_docs/03\_Screen\_by\_Screen\_UI\_Specifications.md\` (Section 6\) and \`05\_Master\_Implementation\_Roadmap.md\`.

TASKS:  
1\. Refactor \`src/pages/MedicalStoreInventory.jsx\` and \`src/components/StockLedgerModal.jsx\`:  
   \- Redesign 4-level drilldown matrix into a tabbed dashboard pane with sticky table headers.  
   \- Retain all bulk Access/CSV imports and stock transfer handlers.  
2\. Refactor \`src/pages/DeveloperAdminPanel.jsx\`:  
   \- Apply clean tabbed navigation for Software Licensing, Audits, and Staff Management.  
3\. Run full verification: \`npm test\` (all tests passing) and \`npm run build\`.  
