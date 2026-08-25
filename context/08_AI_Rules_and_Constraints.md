# CliniCore — AI Rules & Constraints (Anti-Guess Protocol)

---

## 🏛️ Rule 0 — Context-First Protocol (MANDATORY)
**Before writing or modifying any code:**
1. You must update the corresponding context files (e.g. `04_Screens_and_Sitemap.md`, `09_Progress_Log.md`) to reflect the changes.
2. Log all updates under the current milestone in `09_Progress_Log.md`.
3. Only then proceed to write source code.

---

## 🚫 Rule 1 — Anti-Guess Programming
- **No Invented Names:** Use exact field and model names defined in the schema.
- **No Unsolicited Deletion:** Never remove, overwrite, or simplify any working features, gestures, or logic unless explicitly commanded.
- **Ambiguity Guard:** If a requirement is ambiguous, stop and ask instead of making assumptions.

---

## 📂 Rule 2 — Code Standards & Folder Structure

### Frontend Structure (`frontend/src/`):
- `api/db.js`: Low-bloat database layer with local in-memory cache.
- `api/syncEngine.js`: Remote synchronization poller.
- `utils/thermalPrinter.js`: ESC/POS 80mm thermal receipt generator.
- `pages/`: Lazy-loaded React page components.
- `components/`: Reusable UI modules (modals, lightboxes, dropdowns).

### Backend Structure (`backend/src/`):
- `Controllers/`: Route controllers handling requests and responses.
- `Models/`: Database model logic mapping to MySQL tables.
- `Database.php`: Centralized PDO Connection manager.

### Formatting Rules:
- **Currency:** Display as `Rs. 1,200` (PKR).
- **Dates:** DD-MMM-YYYY (e.g., `25-Aug-2026`) in UI; ISO 8601 in database.
- **Phones:** Clean 11-digit local format (`03XXXXXXXXX`).
- **Standard API Shape:** Always return `{ success: true/false, data: ..., error: ... }`.
