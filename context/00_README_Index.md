# CliniCore — Documentation Index (README)

> **For any AI developer tool starting work on this project: read this index first.** This folder contains the single source of truth (SSOT) regarding the business workflows, technical design, and rules for the CliniCore hybrid desktop & cloud application.

---

## Active Documentation Sitemap

| Filename | Purpose | What it details |
|---|---|---|
| [README.md](file:///e:/Soft/DrCreate/ClinicFlow/README.md) | GitHub Root Overview | Executive summary, live architecture, features, shortcuts, and setup |
| [00_README_Index.md](file:///e:/Soft/DrCreate/ClinicFlow/context/00_README_Index.md) | Documentation Index | Orientation guide, sitemap, and master documentation index |
| [01_Business_Domain_and_Workflows.md](file:///e:/Soft/DrCreate/ClinicFlow/context/01_Business_Domain_and_Workflows.md) | Business Domain & Workflows | OPD consultation, retail pharmacy, B2B wholesale, Sindh territories |
| [02_Database_Schema_and_Data_Dictionary.md](file:///e:/Soft/DrCreate/ClinicFlow/context/02_Database_Schema_and_Data_Dictionary.md) | Canonical Schemas & Data Dictionary | 25 domain entities, MySQL DDL, SQLite schemas, and Zod validations |
| [03_API_Contracts_and_Backend_Specs.md](file:///e:/Soft/DrCreate/ClinicFlow/context/03_API_Contracts_and_Backend_Specs.md) | Backend & REST API Specs | PHP 8.3 REST routes, JWT authentication, sync push/pull contracts |
| [04_Screens_and_Sitemap.md](file:///e:/Soft/DrCreate/ClinicFlow/context/04_Screens_and_Sitemap.md) | App Screens & Navigation | Full description of 20+ screens, tab routing, modals, and RBAC guards |
| [05_Hardware_and_Thermal_Printers.md](file:///e:/Soft/DrCreate/ClinicFlow/context/05_Hardware_and_Thermal_Printers.md) | Thermal Print Engine Specs | Low-ink 80mm ESC/POS layout, custom header studio, receipt types |
| [06_Urdu_Terminology_and_Localization.md](file:///e:/Soft/DrCreate/ClinicFlow/context/06_Urdu_Terminology_and_Localization.md) | Bilingual Localization | English / Urdu / Roman Urdu translation dictionaries & typography |
| [07_Security_RBAC_and_Permissions.md](file:///e:/Soft/DrCreate/ClinicFlow/context/07_Security_RBAC_and_Permissions.md) | Security & Permission Matrix | Canonical module.action matrix, role capabilities, warehouse scoping |
| [08_AI_Rules_and_Constraints.md](file:///e:/Soft/DrCreate/ClinicFlow/context/08_AI_Rules_and_Constraints.md) | Developer Rules & Standards | Anti-Guess standards, folder structure, code standards, and constraints |
| [09_Progress_Log.md](file:///e:/Soft/DrCreate/ClinicFlow/context/09_Progress_Log.md) | Master Progress & Audit Log | Full historical milestone logs (Milestones 1–66) & audit handovers |
| [10_Verification_and_Test_Cases.md](file:///e:/Soft/DrCreate/ClinicFlow/context/10_Verification_and_Test_Cases.md) | Verification & Test Framework | 42 test suites, 637 assertions, data integrity formulas, and QA matrices |
| [11_Tech_Stack_and_Deployment.md](file:///e:/Soft/DrCreate/ClinicFlow/context/11_Tech_Stack_and_Deployment.md) | Tech Stack & VPS Deployment | React 19, Vite 8, Hostinger VPS, Nginx, HTTPS, crontab, systemd |
| [12_Desktop_Offline_First_Sync_Architecture.md](file:///e:/Soft/DrCreate/ClinicFlow/context/12_Desktop_Offline_First_Sync_Architecture.md) | Offline-First Sync Architecture | 7-state FSM, IndexedDB Vault, PN-counter stock deltas, 3-way merge |
| [13_Legacy_Access_Migration_Playbook.md](file:///e:/Soft/DrCreate/ClinicFlow/context/13_Legacy_Access_Migration_Playbook.md) | MS Access Migration | Schema mappings from legacy `.accdb` file and bulk imports |
| [14_Comprehensive_Conversation_and_Feature_Context.md](file:///e:/Soft/DrCreate/ClinicFlow/context/14_Comprehensive_Conversation_and_Feature_Context.md) | Chronological Decisions | Log of all major milestones and historical design approvals |
| [15_ClinicFlow_Complete_User_Manual_Hinglish.md](file:///e:/Soft/DrCreate/ClinicFlow/context/15_ClinicFlow_Complete_User_Manual_Hinglish.md) | Master User Manual | Step-by-step operational guide in clear conversational language |

---

## Documentation Synchronization Policy

Whenever changes are made to the codebase (such as updating schemas, adding screens, changing API routes, or updating passcodes):
1. Immediately update the corresponding documentation files in this directory.
2. Log the change details under the latest milestone in `09_Progress_Log.md`.
3. Never allow documentation to drift from the actual code.
