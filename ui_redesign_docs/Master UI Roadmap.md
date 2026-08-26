# **05 — Master Implementation Roadmap**

## **🎯 5-Phase Execution Strategy**

The UI modernization must be executed in 5 distinct phases. Do NOT attempt to refactor all screens in a single prompt. Execute one phase at a time, verify with the test harness, and proceed to the next.

┌───────────────────────────────────────────────────────────────────┐  
│                      5-PHASE EXECUTION ROADMAP                    │  
├───────────────────────────────────────────────────────────────────┤  
│ Phase 1: Theme Tokens, Global Navigation Shell & Index CSS        │  
│ Phase 2: Doctor Queue & OPD Consultation Workspace                │  
│ Phase 3: Pharmacy POS Counter & Wholesale Invoicing Workspace     │  
│ Phase 4: Financial Registers, Double-Entry CashBook & Z-Reports   │  
│ Phase 5: Multi-Level Stock Ledger, Inventory & Admin Governance   │  
└───────────────────────────────────────────────────────────────────┘

## **📊 Phase Verification Criteria**

| Phase | Target Files | Verification Check |
| :---- | :---- | :---- |
| **Phase 1** | index.css, SidebarLayout.jsx | Mobile drawer functions, zero horizontal overflow, build succeeds |
| **Phase 2** | DoctorQueue.jsx, ConsultationScreen.jsx | Queue cards active, sticky action bar clears mobile nav, tests pass |
| **Phase 3** | MedicalStorePOS.jsx, ReceiptModal.jsx | Split view responsive, Qty steppers touch-friendly, sales checkout passes |
| **Phase 4** | FeesReports.jsx, CashBookModal.jsx | Note counters calculate live, tables scroll horizontally, Z-Reports functional |
| **Phase 5** | MedicalStoreInventory.jsx, DeveloperAdminPanel.jsx | 4-Level matrix works, tabbed admin panels clean, full test suite passing |

