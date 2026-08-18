# ClinicFlow & Desktop Software — Antigravity Agent Core Rules & Context

> **CRITICAL PROTOCOL FOR ALL AI SESSIONS:**
> This repository contains **ClinicFlow** (Web App + Desktop Hybrid Engine) for Dr. Muhammad Kashif Khan Clinic & Wholesale Medical Store (Hyderabad & Interior Sindh).
> All coding AI agents MUST follow the **Anti-Guess Programming Standard** and **Rule 0 (Context-First Standard)** without exception.

---

## 🏛️ 1. Project Architecture & Structure

```text
ClinicFlow/
├── context/                     # MASTER SINGLE SOURCE OF TRUTH (14 Context Files)
│   ├── 00_README_Index.md
│   ├── 01_Business_Domain_and_Workflows.md
│   ├── 02_Database_Schema_and_Data_Dictionary.md
│   ├── 03_API_Contracts_and_Backend_Specs.md
│   ├── 04_Screens_and_Sitemap.md
│   ├── 05_Hardware_and_Thermal_Printers.md
│   ├── 06_Urdu_Terminology_and_Localization.md
│   ├── 07_Security_RBAC_and_Permissions.md
│   ├── 08_AI_Rules_and_Constraints.md
│   ├── 09_Progress_Log.md       # Full Milestones & Audit Handover Log
│   ├── 10_Verification_and_Test_Cases.md
│   ├── 11_Tech_Stack_and_Deployment.md
│   ├── 12_Desktop_Offline_First_Sync_Architecture.md
│   ├── 13_Legacy_Access_Migration_Playbook.md
│   └── 14_Comprehensive_Conversation_and_Feature_Context.md
└── frontend/                    # React + Vite + Tailwind CSS SPA
    ├── src/api/db.js            # In-Memory Memoized Cache + O(1) LocalStorage Database Engine
    ├── src/api/auth.js          # Authoritative Session Security & RBAC Guard
    ├── src/utils/thermalPrinter.js # Low-Ink 80mm ESC/POS Thermal Print Engine
    ├── src/utils/imageCompressor.js # Client-Side HD Canvas JPEG Compressor
    └── src/pages/               # 20+ Lazy-Loaded Modular Screens
```

---

## 📜 2. Anti-Guess Programming Standard (Rule 0 to Rule 14)

1. **Rule 0 — Context-First Protocol:** Update context files (`04_Screens_and_Sitemap.md`, `09_Progress_Log.md`) BEFORE writing source code.
2. **Never Guess or Invent Names:** Use exact field, model, and route names defined in `02_Database_Schema_and_Data_Dictionary.md`.
3. **Doctor Isolation:** Each doctor sees exclusively their own waiting patients and OPD consultation collection.
4. **Three Database Initialization Modes:**
   - Fresh Clean Setup (0 dummy queue patients).
   - Legacy MS Access Migration (optional real data).
   - Sandbox / Demo Mode (explicit demo tag).
5. **Wholesale Party Code Auto-Fill:**
   - Typing or choosing Party Code (`001`, `PTY-108`, `Muslim`, etc.) instantly populates Party Name, City, Phone, Address, Salesman, and displays real-time Udhaar / Credit Balance.
6. **Company-Specific Medicine Filtering:**
   - Medicine selection supports filtering by Manufacturing Company (`BM Pvt LTD`, `Paul Brooks`, `Schwabe`, `MEKTUM`, `BLOSSOM`, etc.) with clear brand tags (`[Company Name] Medicine`) to avoid selecting wrong products when identical medicine names exist across different brands.
7. **Wholesale B2B Payment Modes:**
   - Supports `Party Udhaar (Credit)`, `Full Cash In Hand`, and `Cheque / Bank Transfer` (with Cheque #, Bank Name, Clearance Date, and Amount fields).
   - Supports **Overall Bill-Level Trade Discounts** (Percentage % and Flat Rs.) in addition to line-item discounts.
8. **Patient Reports & Files Upload:**
   - `dbVisits.update(id, data)` saves compressed canvas photos to storage and timeline visit cards with HD optical zoom & rotate lightbox.
9. **Zero-Bloat Performance:**
   - In-memory `_COLLECTION_CACHE` and `_ID_MAP_CACHE` provide instant $O(1)$ lookups without repeated JSON parsing in render loops.
   - Code-splitting with `React.lazy()` keeps initial core bundle light (<320KB).

---

## 🔒 3. Security Standard
- All printable and export templates use strict `escapeHtml()` sanitization.
- Financial arithmetic uses `Number.isFinite()` and `Math.max(0, ...)` bounds.
- Session authorization validates strictly against authoritative DB records.
