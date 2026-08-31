# ClinicCore — VPS Backend API Contract & Health Specification

*Verified and Documented in Phase 01 (VPS Connectivity & API Contract).*

---

## 1. Core Principles & Isolation Guard
- **No Direct Database Access**: Frontend clients (Web and Desktop) communicate exclusively with the Node.js VPS API via HTTPS. Database credentials (`pg`) remain strictly encapsulated on the VPS server.
- **Unified Base URL Resolution**:
  - Web: Dynamic `window.location.origin` if hosted, fallback `https://clinicore.me`.
  - Desktop: Explicit configured `VITE_API_URL` or canonical fallback `https://clinicore.me` (dev: `http://127.0.0.1:5000`).

---

## 2. API Endpoints Specification

### A. Health & Diagnostics
#### `GET /api/v1/health` (or `/health`)
- **Purpose**: Fast server liveness check.
- **Response**: `200 OK`
  ```json
  {
    "status": "healthy",
    "engine": "Node.js Canonical API",
    "version": "2.5.0"
  }
  ```

#### `GET /api/v1/time`
- **Purpose**: Precision master clock drift calibration.
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "epoch_ms": 1788200000000
    }
  }
  ```

---

### B. Master Security & Session Authentication
#### `POST /api/v1/system/verify-passcode`
- **Purpose**: Master passcode verification with auto-adoption bootstrap.
- **Request Body**:
  ```json
  { "passcode": "Champion24" }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "token": "node_admin_jwt_token_1788200000"
    }
  }
  ```
- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": { "message": "Incorrect master passcode." }
  }
  ```

#### `POST /api/v1/auth/login`
- **Purpose**: User session login.
- **Request Body**:
  ```json
  {
    "username": "dr_asif",
    "password": "hashed_or_plain_password"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "token": "node_jwt_token_1788200000",
    "user": { "id": "u_001", "name": "Dr. Asif Ashraf", "role": "doctor" }
  }
  ```

---

### C. Synchronization Engine
#### `GET /api/v1/system/sync-state`
- **Purpose**: Full collection snapshot pull.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "cf_inventory_v5": [...],
      "cf_parties_v5": [...],
      "cf_suppliers_v5": [...],
      "cf_accounts_v6": [...],
      "cf_warehouses_v6": [...],
      "cf_users_v5": [...]
    }
  }
  ```

#### `POST /api/v1/system/sync-state`
- **Purpose**: Full collection snapshot push.
- **Request Body**: Object map containing all synchronized collections.
- **Response `200 OK`**:
  ```json
  { "success": true }
  ```

#### `POST /api/v1/sync/push`
- **Purpose**: Incremental mutation outbox push with acknowledgment.
- **Request Body**:
  ```json
  {
    "device_id": "dev_win_x86_001",
    "mutations": [
      {
        "mutation_id": "mut_abc123",
        "entity_type": "users",
        "action": "CREATE",
        "entity_id": "u_002",
        "payload": { "id": "u_002", "name": "New Pharmacist", "role": "pharmacist" }
      }
    ]
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "results": [
        { "mutation_id": "mut_abc123", "status": "confirmed" }
      ]
    }
  }
  ```

---

### D. OTA Updates & System Config
#### `GET /api/v1/system/version`
- **Purpose**: Over-the-air update manifest inspection.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "version": "2.5.3",
    "build_id": "20260830.9912001",
    "release_channel": "production",
    "min_client_version": "2.4.0",
    "download_url": "https://clinicore.me"
  }
  ```

#### `GET /api/v1/system/config` / `POST /api/v1/system/config`
- **Purpose**: Read or update clinic settings, licensing status, and security keys.
