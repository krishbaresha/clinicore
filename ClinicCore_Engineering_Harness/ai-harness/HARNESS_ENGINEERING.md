# Harness Engineering — Autonomous Phase Runner

## Purpose

Make AI work state-driven rather than chat-history-driven.

## Required control files

- Master prompt
- Phase files
- STATE.md
- TASK_QUEUE.md
- EXECUTION_LOG.md
- FAILURES.md
- NEXT_AGENT.md

## Agent loop

1. Read MASTER prompt.
2. Read STATE.md.
3. Read current phase file.
4. Inspect repository.
5. Execute only current phase.
6. Run tests.
7. If PASS:
   - update docs/logs
   - commit
   - advance STATE.md
8. If FAIL:
   - do not advance
   - record failure
   - repair
   - rerun tests
9. Before context/turn limit:
   - update NEXT_AGENT.md
   - update STATE.md
   - stop cleanly.

## Autonomy boundary

The harness should not automatically approve destructive database operations, production migrations, credential changes, or major architecture rewrites.

Those actions require explicit human approval.

## Suggested machine-readable state

STATE.md is human-readable. If the IDE supports automation, maintain an additional state JSON with:

- phase
- task
- status
- last_commit
- last_test
- blocker
- next_action

## Important

Do not build an autonomous loop that repeatedly edits code without gates. The purpose of the harness is controlled execution, not uncontrolled self-modification.
