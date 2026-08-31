# PHASE 03 — Web Multi-Client Consistency

## Goal
Changes from one web session become visible in another authorized session.

## Investigate
- Query caching.
- stale state.
- mutation invalidation.
- polling.
- WebSocket/SSE.
- focus refresh.
- optimistic UI.

## Acceptance
Browser A creates a user.
Browser B receives the change according to the selected consistency mechanism.
Refresh must not remove correctly persisted data.

Document the chosen mechanism and why it was selected.
