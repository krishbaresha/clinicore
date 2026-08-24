# ClinicFlow — Documentation Index (README)

> **For any AI tool (Antigravity, Stitch, Claude, ChatGPT, etc.) starting work on this project: read this file first.** It tells you which file to read for what purpose, and the order to read them in. This project is built and maintained across multiple AI sessions/tools — these documents are the shared memory and rulebook that keep everyone aligned.

---

## Read Order for a New AI Session

1. **This README** — orientation
2. `09_Progress_Log.md` — what's already been done, what's blocked, what's next
3. `08_AI_Rules_and_Constraints.md` — how to behave (don't guess, don't scope-creep)
4. `01_PRD.md` — what the product is and why
5. Then whichever specific file matches the current task (see mapping below)
6. **Before finishing the session:** update `09_Progress_Log.md`

---

## File Map by Category

| Category | File | What it answers |
|---|---|---|
| **Project Overview** | `01_PRD.md` | What is ClinicFlow, who is it for, what problem does it solve, what's in/out of scope |
| **Project Overview (scope detail)** | `02_MVP_Scope.md` | What exactly to build now vs later (MVP / Phase 2 / Phase 3) |
| **Architecture** | `03_TRD_Architecture.md` | Tech stack, database schema, API endpoints, security requirements |
| **UI Context** | `04_Screens_and_Sitemap.md` | Every screen, navigation structure, shared design system (colors, fonts, layout rules) |
| **UI Context (generation)** | `05_Stitch_UI_Prompts.md` | Ready-to-use prompts for generating each screen in Google Stitch, kept visually consistent |
| **Sample Data** | `07_Mock_Data.json` | Realistic fake data (patients, visits, prescriptions, inventory) — use this, don't invent new data |
| **Offline Desktop & Sync** | `12_Desktop_Offline_First_Sync_Architecture.md` | Electron/SQLite embedded architecture, Outbox sync, Conflict resolution, Direct ESC/POS printing |
| **Legacy Data Migration** | `13_Legacy_Access_Migration_Playbook.md` | Python Access extraction scripts, schema mapping, data sanitization, dry-run reconciliation |
| **Master Feature & Memory Log** | `14_Comprehensive_Conversation_and_Feature_Context.md` | Full chronological user decisions, milestones, security audit fixes, and architectural context |
| **Multi-Warehouse & Operator Switching** | `15_Multi_Warehouse_Operator_Architecture_and_Future_Roadmap.md` | Single-login operator switching, warehouse staff filtering, cash drawer audit, and future risk roadmap |
| **AI Workflow Rules** | `08_AI_Rules_and_Constraints.md` | The hard rules that prevent guess-programming, scope creep, and inconsistent code |
| **Code Standards** | `10_Code_Standards.md` | Folder structure, naming conventions, git commit style, testing expectations, error handling style |
| **Progress Tracker** | `09_Progress_Log.md` | Session-by-session history — what was built, what was decided, what's next (THE memory file) |
| **External Review** | `06_AI_Review_Brief.md` | Give this to a second AI (with the other files) to critique the plan for gaps before/during building |

---

## The Golden Rule

Every file above must stay consistent with every other file. If you change something in one file (e.g. rename a field, add a screen, change a decision), you must:

1. Update every other file that references it.
2. Log the change and reason in `09_Progress_Log.md`.

**Never let these documents drift out of sync with each other or with the actual code** — that's exactly the kind of gap that causes an AI to guess wrong later.

---

## Quick Reference: All Context Files

```
00_README_Index.md                               ← you are here
01_PRD.md                                        ← Project Overview
02_MVP_Scope.md                                  ← Project Overview (scope)
03_TRD_Architecture.md                           ← Architecture
04_Screens_and_Sitemap.md                        ← UI Context
05_Stitch_UI_Prompts.md                          ← UI Context (generation prompts)
06_AI_Review_Brief.md                            ← External Review
07_Mock_Data.json                                ← Sample Data
08_AI_Rules_and_Constraints.md                   ← AI Workflow Rules
09_Progress_Log.md                               ← Progress Tracker
10_Code_Standards.md                             ← Code Standards
11_Antigravity_Workflow_and_Prompts.md           ← Workflow & Prompts
12_Desktop_Offline_First_Sync_Architecture.md    ← Offline Desktop & Cloud Sync Architecture
13_Legacy_Access_Migration_Playbook.md           ← MS Access Data Migration Playbook
14_Comprehensive_Conversation_and_Feature_Context.md ← Master Memory & Decisions Log
```
