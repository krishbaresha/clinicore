# Known Issues & Forensic Vulnerability Matrix — ClinicCore

*Recorded during Phase 00 (Baseline & Forensic Audit).*

---

## 1. Documented Incident Reports & Root-Cause Forensic Analysis

### Issue 1: Desktop User Creation Disappearance on App Restart
- **Symptom**: User created on Desktop, appears locally in the UI session, but disappears after closing and reopening the Desktop application.
- **Forensic Root Cause**:
  1. **Async Write Race / Memory-Only Window**: In `storageDriver.js`, `setItem` updates the in-memory `_diskCache` synchronously, but dispatches the Rust IPC `write_collection` asynchronously (fire-and-forget). If the app is closed immediately or if `initDiskCache()` is not fully awaited before `initDB()` or `auth.js` boot runs, the cold start reads stale/empty collection JSON from disk.
  2. **Snapshot Sync Overwrite**: When the Desktop starts up, `syncEngine.js` performs an eager `pullLatestCloudState()`. If the newly created user was not yet successfully pushed to the VPS (or if VPS is reached in read-only snapshot mode), the pull hydration replaces the local collection without 3-way user reconciliation.
- **Resolution Path (Phase 02/03)**:
  - Enforce synchronous/blocking flush on critical entity creation and ensure `waitForDiskCache()` strictly blocks app boot.
  - Implement bidirectional reconciliation for `users` collection during sync pull so local un-synced users are merged rather than overwritten.

### Issue 2: False "No Internet / Offline" Sync Status Despite Active Network
- **Symptom**: Cloud/Sync icon shows "Offline / Sync Failed" even when the host machine has active internet access.
- **Forensic Root Cause**:
  1. `syncEngine.js` relies on `navigator.onLine` and immediate fetch against `API_BASE`.
  2. If the local development environment or desktop packaged URL resolves to `http://127.0.0.1:5000` while backend service is not running locally, or if DNS/TLS handshake to `https://clinicore.me` times out/fails CORS, the FSM transitions to `ERROR`/`OFFLINE` without providing granular diagnostic reasons (DNS failure vs Auth token expired vs VPS 502/Down).
  3. Clicking the sync icon in some views did not trigger an interactive retry/diagnostics modal.
- **Resolution Path (Phase 01/02)**:
  - Add explicit health check probe endpoint with distinct diagnostic codes: `DNS_UNREACHABLE`, `TLS_ERROR`, `SERVER_502`, `AUTH_EXPIRED`.
  - Keep the Sync button fully interactive in all states, opening a connection inspection dialog.

### Issue 3: Cross-Client Tab Web Synchronization Lag
- **Symptom**: When data is created in Browser A, Browser B (or Incognito) does not instantly reflect the new record without manual refresh.
- **Forensic Root Cause**:
  - Web client sync pull relies on `visibilitychange` and `focus` event listeners or polling intervals. When Browser B is in a background tab or unfocused, updates remain queued on the server until the tab receives focus or the poll timer triggers.
- **Resolution Path (Phase 03)**:
  - Optimize tab focus / broadcast channel sync and polling interval for active session multi-client consistency.
