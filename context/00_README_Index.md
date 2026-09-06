# CliniCore — Documentation Index (README)

> **For any AI developer tool starting work on this project: read this index first.** This folder contains the single source of truth (SSOT) regarding the business workflows, technical design, and rules for the CliniCore hybrid desktop & cloud application.

---

## Active Documentation Sitemap

| Filename | Purpose | What it details |
|---|---|---|
| [README.md](file:///e:/Soft/DrCreate/Clinicore/README.md) | GitHub Root Overview | Executive summary, live architecture, features, shortcuts, and setup (v2.5.40) |
| [00_README_Index.md](file:///e:/Soft/DrCreate/Clinicore/context/00_README_Index.md) | Documentation Index | Orientation guide, sitemap, and master documentation index |
| [01_PRD.md](file:///e:/Soft/DrCreate/Clinicore/context/01_PRD.md) | Product Requirements Document | Medical OPD, retail pharmacy, B2B wholesale, and WhatsApp closing workflows |
| [02_MVP_Scope.md](file:///e:/Soft/DrCreate/Clinicore/context/02_MVP_Scope.md) | Canonical Schemas & Data Dictionary | Core MVP scope, entities, and database dictionary |
| [03_TRD_Architecture.md](file:///e:/Soft/DrCreate/Clinicore/context/03_TRD_Architecture.md) | Technical Architecture & Specs | Cloud/desktop hybrid sync, REST APIs, and background services |
| [04_Screens_and_Sitemap.md](file:///e:/Soft/DrCreate/Clinicore/context/04_Screens_and_Sitemap.md) | App Screens & Navigation | Full description of 20+ screens, tab routing, modals, and Day Closing PDF engine |
| [08_AI_Rules_and_Constraints.md](file:///e:/Soft/DrCreate/Clinicore/context/08_AI_Rules_and_Constraints.md) | Developer Rules & Standards | Anti-Guess standards, folder structure, code standards, and constraints |
| [09_Progress_Log.md](file:///e:/Soft/DrCreate/Clinicore/context/09_Progress_Log.md) | Master Progress & Audit Log | Full historical milestone logs (Milestones 1–253) & audit handovers |
| [12_Desktop_Offline_First_Sync_Architecture.md](file:///e:/Soft/DrCreate/Clinicore/context/12_Desktop_Offline_First_Sync_Architecture.md) | Offline-First Sync Architecture | 7-state FSM, IndexedDB Vault, PN-counter stock deltas, 3-way merge |
| [13_Legacy_Access_Migration_Playbook.md](file:///e:/Soft/DrCreate/Clinicore/context/13_Legacy_Access_Migration_Playbook.md) | MS Access Migration | Schema mappings from legacy `.accdb` file and bulk imports |
| [14_Comprehensive_Conversation_and_Feature_Context.md](file:///e:/Soft/DrCreate/Clinicore/context/14_Comprehensive_Conversation_and_Feature_Context.md) | Chronological Decisions | Log of all major milestones and historical design approvals (1–253) |
| [15_ClinicFlow_Complete_User_Manual_Hinglish.md](file:///e:/Soft/DrCreate/Clinicore/context/15_ClinicFlow_Complete_User_Manual_Hinglish.md) | Master User Manual | Step-by-step operational guide in clear conversational Hinglish |
| [15_Multi_Warehouse_Operator_Architecture_and_Future_Roadmap.md](file:///e:/Soft/DrCreate/Clinicore/context/15_Multi_Warehouse_Operator_Architecture_and_Future_Roadmap.md) | Multi-Warehouse Architecture | Multi-tier logistics, transfer protocols, and godown matrices |

---

## Documentation Synchronization Policy

Whenever changes are made to the codebase (such as updating schemas, adding screens, changing API routes, or updating passcodes):
1. Immediately update the corresponding documentation files in this directory.
2. Log the change details under the latest milestone in `09_Progress_Log.md`.
3. Never allow documentation to drift from the actual code.
