# CliniCore — Documentation Index (README)

> **For any AI developer tool starting work on this project: read this index first.** This folder contains the single source of truth (SSOT) regarding the business workflows, technical design, and rules for the CliniCore hybrid desktop & cloud application.

---

## Active Documentation Sitemap

| Filename | Purpose | What it details |
|---|---|---|
| [00_README_Index.md](file:///e:/Soft/DrCreate/ClinicFlow/context/00_README_Index.md) | Documentation Index | Orientation guide and file map |
| [01_PRD.md](file:///e:/Soft/DrCreate/ClinicFlow/context/01_PRD.md) | Product Requirements | Target systems, features, business operations, and scoping |
| [02_MVP_Scope.md](file:///e:/Soft/DrCreate/ClinicFlow/context/02_MVP_Scope.md) | Production Scope Summary | Current live modules: OPD Clinic, Pharmacy POS, and B2B Wholesale |
| [03_TRD_Architecture.md](file:///e:/Soft/DrCreate/ClinicFlow/context/03_TRD_Architecture.md) | Technical Design & Stack | Database schema, VPS settings, caching, and APIs |
| [04_Screens_and_Sitemap.md](file:///e:/Soft/DrCreate/ClinicFlow/context/04_Screens_and_Sitemap.md) | App Screens & Navigation | Full description of 20+ screens, tab routing, and PIN security |
| [08_AI_Rules_and_Constraints.md](file:///e:/Soft/DrCreate/ClinicFlow/context/08_AI_Rules_and_Constraints.md) | Developer Rules & Standards | Anti-Guess standards, folder structure, code standards, and constraints |
| [09_Progress_Log.md](file:///e:/Soft/DrCreate/ClinicFlow/context/09_Progress_Log.md) | Historical Milestone Log | Full log of changes, past fixes, and current status |
| [12_Desktop_Offline_First_Sync_Architecture.md](file:///e:/Soft/DrCreate/ClinicFlow/context/12_Desktop_Offline_First_Sync_Architecture.md) | SQLite Desktop Sync | Service worker caching, local outbox queue, and sync mechanisms |
| [13_Legacy_Access_Migration_Playbook.md](file:///e:/Soft/DrCreate/ClinicFlow/context/13_Legacy_Access_Migration_Playbook.md) | MS Access Migration | Schema mappings from legacy `.accdb` file and bulk imports |
| [14_Comprehensive_Conversation_and_Feature_Context.md](file:///e:/Soft/DrCreate/ClinicFlow/context/14_Comprehensive_Conversation_and_Feature_Context.md) | Chronological Decisions | Log of all major milestones and historical design approvals |
| [15_Multi_Warehouse_Operator_Architecture_and_Future_Roadmap.md](file:///e:/Soft/DrCreate/ClinicFlow/context/15_Multi_Warehouse_Operator_Architecture_and_Future_Roadmap.md) | Multi-Warehouse Ops | Godown management, operator switching, and audit trails |

---

## Documentation Synchronization Policy

Whenever changes are made to the codebase (such as updating schemas, adding screens, changing API routes, or updating passcodes):
1. Immediately update the corresponding documentation files in this directory.
2. Log the change details under the latest milestone in `09_Progress_Log.md`.
3. Never allow documentation to drift from the actual code.
