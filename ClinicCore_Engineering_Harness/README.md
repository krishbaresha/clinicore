# ClinicCore Autonomous Engineering Pack

This pack is designed for Antigravity/other coding agents working on ClinicCore.

## Start here

1. Read `00_MASTER_AGENT_PROMPT.md`
2. Read `ai-harness/HARNESS_ENGINEERING.md`
3. Start `phases/PHASE_00_BASELINE_FORENSICS.md`
4. Do not modify source during forensic baseline.
5. Record every action in `ai-harness/EXECUTION_LOG.md`.
6. Keep `ai-harness/STATE.md` current.
7. Before handing work to another AI, update `ai-harness/NEXT_AGENT.md`.

## Phase order

00 Baseline
01 VPS/API Connectivity
02 Offline-first Sync
03 Web Multi-client Sync
04 VPS Source of Truth
05 Desktop Auto-update
06 Backup/Disaster Recovery
07 Smart POS Stock Replenishment
08 Regression/Security
09 Production Acceptance

## Core architecture

Desktop/Web -> Secure VPS API -> VPS Central DB

Desktop also maintains durable local state for offline work.

## Important

These files are an engineering control plane. They do not replace repository inspection.

