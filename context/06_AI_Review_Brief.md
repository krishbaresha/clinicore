# ClinicFlow — AI Review & Critique Brief

> **Purpose of this document:** This is meant to be given to another AI (or a second opinion from Claude/ChatGPT/Gemini) to critically review the ClinicFlow product plan. Paste this whole document, along with the other 5 files (PRD, MVP Scope, TRD, Sitemap, Stitch Prompts) as context, and ask the AI to answer the review questions below honestly — including disagreeing with decisions already made.

---

## 1. Context Summary (for the reviewing AI)

ClinicFlow is a planned web application for solo/small private clinic doctors in Pakistan. The core problem it solves: patients lose their paper prescriptions, so when they return to the same doctor later (sometimes years later), there's no record of past visits, diagnoses, or medicines prescribed. ClinicFlow gives doctors a permanent, searchable digital patient record, prescription entry with printable output, consultation fee tracking, and an optional in-clinic medical store (pharmacy) inventory/sales module.

Target user: solo doctor running a private clinic, sometimes with a receptionist, sometimes also running a small medicine store from the same premises. Built for the Pakistani market specifically — low-resource clinics, variable internet connectivity, WhatsApp-first communication culture, Urdu/English/Roman-Urdu mixed usage.

The five other documents provided alongside this one define: the full PRD, MVP feature scope, technical architecture and data model, screen sitemap with a shared design system, and ready-to-use UI generation prompts.

## 2. Specific Questions for the Reviewing AI

### Product/Business Gaps
1. What critical clinic workflow steps are missing that a real doctor would immediately notice (e.g. anything about vitals, allergies, chronic condition flags, patient consent, insurance/panel billing for corporate-tied patients)?
2. Is there a risk that doctors won't trust digital records for medico-legal reasons? What would increase trust (e.g. tamper-proof audit logs, timestamps)?
3. Are there patient-safety-critical features missing — e.g. drug allergy warnings, drug interaction checks, duplicate-prescription warnings?
4. What would a clinic with high patient volume (50+ patients/day) need that a low-volume clinic wouldn't — does the current design scale to that?

### Data & Privacy Gaps
5. Is patient medical data being handled with sufficient care given it's sensitive personal health information? What's missing from a privacy/compliance standpoint, especially considering Pakistan doesn't have a fully mature health-data regulation framework — what "best practice" should still be followed anyway?
6. What happens if a doctor wants to delete a patient's record (right to be forgotten) — is this addressed?
7. Is there a backup/disaster-recovery consideration if the doctor's account or the hosting service has an outage — could a clinic lose all history?

### Technical Architecture Gaps
8. Does the current data model (in the TRD) support future needs cleanly, or will it require painful migrations (e.g. multi-branch support, multi-doctor shared patients)?
9. Is the offline-first consideration deferred to Phase 3 a mistake given many clinics in smaller cities/towns in Pakistan have unreliable internet? Should it be pulled into MVP?
10. Is the medical store module tightly enough integrated with patient visits, or does keeping them loosely connected create data-entry duplication risk (same medicine info entered twice)?

### UX/Adoption Gaps
11. Doctors are often not tech-savvy and extremely time-constrained during consultations — does the "New Visit/Prescription Entry" screen design (per the Stitch prompts) look fast enough for real-time use during a live consultation, or does it look like it'll slow the doctor down?
12. Is there a smoother onboarding path for a doctor who has years of existing paper records — should there be a "bulk import old patients" feature considered for Phase 2?
13. Would doctors resist because this looks like extra software to manage, when they're used to a notebook and pen — what specific feature or framing would lower that resistance?

### Business Model Gaps
14. Is a monthly subscription model appropriate for this market, or would doctors prefer a one-time purchase / lifetime license given price sensitivity in this segment?
15. What would make a doctor choose ClinicFlow over simply using a WhatsApp Business catalog, a generic Excel sheet, or an existing generic clinic-management SaaS already available internationally?

## 3. Requested Output Format from the Reviewing AI

Please answer in three sections:
1. **Critical gaps** (things that could cause the product to fail or feel unsafe/untrustworthy to a doctor)
2. **Nice-to-have improvements** (would meaningfully improve it, not urgent)
3. **Explicit disagreements** (anything in the provided PRD/TRD/Sitemap that you think is the wrong decision, and what you'd do instead)

Do not just validate the plan — the goal is to find real weaknesses before development time is spent building it.
