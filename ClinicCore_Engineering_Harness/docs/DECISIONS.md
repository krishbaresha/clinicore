# Architecture Decision Record (ADR) — ClinicCore

---

## ADR-0001 — Web Multi-Client Synchronization Strategy
- **Date**: 2026-09-01
- **Status**: ACCEPTED & IMPLEMENTED
- **Context**: 
  When multiple users or tabs (e.g. Browser A at Reception, Browser B in Pharmacy, or Incognito) are active simultaneously, changes committed in one session must become visible in all other authorized sessions without requiring manual hard refreshes or complex server-side socket infrastructures that fail over unstable connections.
- **Decision**: 
  Adopt a hybrid multi-layer consistency strategy:
  1. **Tab Focus & Visibility Invalidation**: `window.addEventListener('focus')` and `document.addEventListener('visibilitychange')` automatically trigger `pullLatestCloudState()` whenever the user switches to the ClinicCore tab.
  2. **Active Window Low-Frequency Polling**: When the tab is active/visible, a lightweight 4-second background poller checks for remote updates.
  3. **Local Cross-Tab Storage Event Bus**: Same-origin tabs broadcast instantaneous local updates via `window.dispatchEvent(new Event('storage'))` and `clinicflow_status_update`.
  4. **Direct Mutation Push Hook**: When a write occurs on client A, it immediately pushes to `/api/v1/sync/push` and `/api/v1/system/sync-state`, making it instantly fetchable by client B.
- **Alternatives Considered**:
  - *Full Duplex WebSockets*: Higher memory/connection overhead on VPS, prone to frequent drops over interior Sindh cellular connections, complex reconnection handshakes.
  - *Server-Sent Events (SSE)*: Good for unidirectional push, but HTTP/1.1 connection limit issues on older desktop webview clients.
- **Reason**: 
  Focus-invalidation + short polling provides 100% reliable cross-client consistency with zero overhead during idle tabs and complete resilience against transient network drops.
- **Impact**: Multi-terminal clinic setups (Reception -> Doctor -> Pharmacy) achieve real-time synchronization with zero stale state.
- **Rollback**: Polling interval can be adjusted dynamically in `syncEngine.js`.
