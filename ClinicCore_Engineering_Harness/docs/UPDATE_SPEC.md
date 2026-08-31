# ClinicCore — Desktop Auto-Update & Data Preservation Specification

*Verified and Documented in Phase 05 (Enterprise Desktop Auto-Update).*

---

## 1. Desktop Framework & Architecture
- **Framework**: Tauri 2.0 (Rust Core + Webview2 / Chromium).
- **Product Identifier**: `com.clinicore.desktop`
- **Current Canonical Version**: `v2.5.3` (Build `20260830.9912001`).

---

## 2. Release & OTA Update Pipeline

```
[Developer Git Tag / Release] (e.g. v2.5.4)
                │
                ▼
[GitHub Actions CI / Build Runner]
- Builds Windows .msi / .exe & Linux / macOS binaries
- Generates SHA-256 integrity signatures
- Publishes Release Assets to GitHub Releases / VPS CDN
                │
                ▼
[VPS Version Endpoint: /api/v1/system/version]
- Returns: { version, build_id, download_url, min_client_version, changelog }
                │
                ▼
[Desktop Client Check]
1. Polled periodically or triggered via "Check for Updates" in Admin Panel.
2. Compares local SemVer with remote `version` using `compareSemver()`.
3. If Update Available:
   - Renders interactive Update Modal with Changelog & Release Notes.
   - User choices: [Update Now] or [Later / Dismiss].
```

---

## 3. Strict Local Data Preservation Guarantee

**CRITICAL MANDATE**: An application binary update **MUST NEVER DELETE OR OVERWRITE** local user data.

| Directory / Resource | Storage Location | Protection Guarantee |
|---|---|---|
| **Local Collections** | `%APPDATA%/ClinicFlow/data/*.json` | Isolated in OS user roaming data; untouched by binary replacement |
| **Pending Outbox Queue** | `cf_outbox_mutations_v5.json` | Persists unpushed mutations across update reboots |
| **Local System Settings** | `cf_system_settings_v5.json` | Preserves clinic hardware & printer configurations |
| **Active Session Tokens** | Local storage / Disk cache | Retains user login state without forcing re-authentication |

---

## 4. Rollback & Fault Tolerance
- In the event of a failed download or corrupt update payload, the desktop client aborts installation, displays a descriptive notification, and safely maintains the currently running version without data loss.
- Minimum client version gate (`min_client_version`) alerts operators if a database schema migration requires a mandatory client update before continuing sync operations.
