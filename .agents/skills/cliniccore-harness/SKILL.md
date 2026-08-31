---
name: cliniccore-harness
description: Reusable Autonomous Engineering Harness Protocol & Phase Gates for ClinicCore
---

# ClinicCore Engineering Harness Skill

This skill enforces the 10-Phase Autonomous Engineering Protocol on ClinicCore.

## Core Rules:
1. **Zero-Guess Rule**: Inspect actual code before planning or editing.
2. **Context-First Rule**: Update documentation and context logs before and after modifications.
3. **Strict Validation Pipeline**: Always run:
   - `node scripts/scan_secrets.mjs`
   - `node scripts/scan_imports_and_hooks.mjs`
   - `npm test`
   - `npm run build`
4. **Data Protection**: Never wipe `%APPDATA%/ClinicFlow/data/` on app updates or sync pulls.
5. **Decoupled Architecture**: Desktop/Web -> HTTPS REST API -> Central DB (No DB credentials in client).
