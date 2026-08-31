# ClinicCore — Target Architecture & VPS Source of Truth Specification

*Formulated and Documented in Phase 04 (VPS Durable Source of Truth).*

---

## 1. Target System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   VPS Host Layer (Hostinger Ubuntu / systemd)          │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │           Reverse Proxy & SSL Termination (Nginx / HTTPS)      │   │
│   │                      https://clinicore.me                      │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │           ClinicCore Canonical Node.js API Service             │   │
│   │                      (backend/server.js)                       │   │
│   │                                                                │   │
│   │  - REST API Engine (Auth, Time, Health, System Config)         │   │
│   │  - Mutation Outbox Gateway (/api/v1/sync/push)                 │   │
│   │  - System State Engine (/api/v1/system/sync-state)             │   │
│   │  - Auto-Migration & Schema Version Guard                       │   │
│   │  - Background Automation Daemon (24/7 Python / cron)           │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ (Local Socket / Encapsulated)      │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │         Durable Central Persistence Store (PostgreSQL / JSON)  │   │
│   │   - Database credentials NEVER exposed to any client           │   │
│   │   - Automated daily snapshots & point-in-time archives         │   │
│   └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
                  HTTPS JSON REST API (Tokens / Idempotency)
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         │                                                     │
         ▼                                                     ▼
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│          Desktop Client          │        │         Web Client / PWA         │
│   (Tauri 2.0 Rust + React 19)    │        │         (Vite React 19)          │
│                                  │        │                                  │
│ - Local Offline SQLite / JSON    │        │ - Local Browser Storage          │
│ - Outbox Queue & FSM Engine      │        │ - Outbox Queue & FSM Engine      │
│ - Zero Data Loss on Restart      │        │ - Auto Multi-Tab Sync            │
└──────────────────────────────────┘        └──────────────────────────────────┘
```

---

## 2. Decoupling & Independent Evolution
1. **Web UI Decoupling**: The Web frontend is treated strictly as an API client, never as an authoritative database. If the frontend is redesigned, replaced with Next.js, or re-themed, the backend API and central database remain 100% stable and intact.
2. **Third-Party & Multi-Tenant Readability**: Future integrations (e.g. Lab APIs, Mobile Companion Apps, Supplier Electronic Orders) consume the standardized `/api/v1/...` API endpoints with token authentication without altering internal data models.
3. **Strict Credential Encapsulation**: Clients authenticate via JWT tokens / Master Passcode verification. Central database connection strings (`DATABASE_URL`, `pg` credentials) exist only in the VPS server environment (`.env`) and are NEVER transmitted to or bundled inside client binaries.
