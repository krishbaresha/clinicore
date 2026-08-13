# ClinicFlow — AI Rules & Constraints (Anti-Guess-Programming Protocol)

> **Read this before writing any code.** These rules exist to stop guess-programming — where an AI fills gaps in its understanding with assumptions instead of asking. Guess-programming produces bugs, mismatched naming, wasted credits (redoing work), and code that "looks right" but breaks integration. Follow every rule below without exception.

---

## Rule 1 — Never invent field/variable/route names

Only use names that already exist in `01_PRD.md`, `03_TRD_Architecture.md`, `04_Screens_and_Sitemap.md`, and `07_Mock_Data.json`. If a name is needed that isn't defined in these documents, **stop and ask** instead of inventing one. Do not silently rename existing fields "for clarity" or "best practice" — consistency matters more than personal style preference.

## Rule 2 — If context is missing, ask — don't assume

If a requirement is ambiguous or a detail is missing (e.g. "what happens if two patients have the exact same name and phone?"), do not silently pick an interpretation and proceed. State the ambiguity clearly and ask a specific question, or explicitly flag the assumption you're making in the Progress Log (Rule 7) so a human or another AI can catch it later.

## Rule 3 — Never touch files/scope outside the current task

If asked to build the "New Visit" screen, do not also refactor the "Patient Profile" screen "while you're at it," even if you notice something that looks improvable. Flag it instead ("Noticed X could be improved in Patient Profile — not touching it now, logging for later"). Scope creep is a leading cause of wasted credits and broken working code.

## Rule 4 — Match existing patterns before introducing new ones

Before writing new code, look at how similar things were already built in this project (naming style, folder structure, component patterns, error handling style). New code should look like it was written by the same person/system as existing code. If no precedent exists yet, use exactly what's defined in `03_TRD_Architecture.md`.

## Rule 5 — Standard API response shape (never deviate)

Every API response must follow this exact shape — no exceptions, no alternate formats:

```json
// Success
{ "success": true, "data": { ... }, "error": null }

// Error
{ "success": false, "data": null, "error": { "code": "STRING_CODE", "message": "human readable message" } }
```

## Rule 6 — Every feature needs a "definition of done" before coding starts

Before implementing anything, state in plain language: "This is done when [specific testable behavior]." Example: "Patient search is done when typing a partial name or phone number returns matching patients from `07_Mock_Data.json` within the UI, including zero-result state." If this can't be stated clearly, the task isn't specified enough to build yet — ask for clarification first.

## Rule 7 — Always update the Progress Log after meaningful work

After completing any task (a screen, an API route, a bug fix), update `09_Progress_Log.md` with: what was built, what decisions/assumptions were made, what's still broken or incomplete, and what the next step should be. This is mandatory — it's how a different AI session or a different AI tool picks up work without re-guessing everything from scratch. Treat this like a shift-handover note to a coworker who wasn't in the room.

## Rule 8 — Don't silently swallow errors

Never write a try/catch that hides an error without logging or surfacing it. Every error must be visible somewhere (console log at minimum, ideally shown to the user in a friendly way per the design system).

## Rule 9 — Don't fabricate data or fake success

If something isn't actually implemented yet (e.g. WhatsApp reminders in Phase 2), don't build a fake button that pretends to work. Either don't render it, or clearly mark it "Coming Soon" / disabled — per `02_MVP_Scope.md`. Fake-working features are worse than missing features because they hide broken promises until a real user hits them.

## Rule 10 — Currency, date, and locale formats are fixed

- Currency: PKR, displayed as "Rs. 1,200" (not "$" or "₨" or "PKR 1200").
- Dates: displayed as `DD-MMM-YYYY` (e.g. "15-Mar-2023") in the UI; stored as ISO 8601 (`2023-03-15T10:00:00Z`) in the database/API — exactly as shown in `07_Mock_Data.json`.
- Phone numbers: stored and displayed as entered in mock data format (`03XXXXXXXXX`), no country code assumptions added silently.

## Rule 11 — Security defaults are non-negotiable

Never generate code that stores passwords in plain text, exposes `.env`/secret values in frontend code, or skips authentication checks on any route "temporarily for testing" without a clear, loud comment (`// TEMP: remove before deploy`) that also gets logged in the Progress Log.

## Rule 12 — When in doubt about a medical/clinical detail, don't guess

This is healthcare-adjacent software. Never invent medical terminology, dosage conventions, or clinical logic. Use exactly what's in the mock data or what the doctor/user explicitly provides. If a clinical assumption seems necessary (e.g. "should low-stock threshold apply differently to controlled medicines?"), flag it — don't decide it silently.

---

## Quick Self-Check Before Submitting Any Code (AI should run through this mentally)

- [ ] Did I use only names/fields that already exist in the docs or mock data?
- [ ] Did I stay inside the scope of the current task only?
- [ ] Did I follow the standard API response shape?
- [ ] Did I avoid faking any not-yet-built feature as if it works?
- [ ] Did I update the Progress Log with what I did and any assumptions made?
- [ ] If I was unsure about anything, did I flag it instead of silently deciding?
