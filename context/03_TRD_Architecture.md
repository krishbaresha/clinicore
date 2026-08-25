# CliniCore — Technical Requirements Document (TRD)

---

## 1. Technical Stack & Deployment

| Layer | Architecture | Specifications |
|---|---|---|
| **Frontend** | React + Vite + Tailwind CSS | PWA SPA, code-splitted, low-bloat components (<320KB initial bundle). |
| **Backend** | Plain PHP 8.3 Engine | Hostinger VPS deployment, REST API structure, MySQL PDO query engine. |
| **Database** | MySQL v8.0 | Hosted on `127.0.0.1:3306` (`clinicore` database). |
| **Sync Engine** | Bidirectional Polling Sync | Periodic 6-second JSON polling for synchronizing local storage changes with MySQL state. |
| **PWA Cache** | In-Memory & LocalStorage Cache | O(1) reads with `_COLLECTION_CACHE` and `_ID_MAP_CACHE` to avoid JSON parsing inside render loops. |

---

## 2. Core Database Schema (MySQL)

### `clinics`
Tracks active tenant info, branding, pins, and passcodes.
- `id` (VARCHAR(50), PRIMARY KEY): e.g. `'clinic_001'`
- `name` (VARCHAR(255)): Doctor's clinic name (e.g. `'Dr. Muhammad Asif Ashraf Khan Clinic'`)
- `address` (TEXT)
- `phone` (VARCHAR(50))
- `default_consultation_fee` (DECIMAL(10,2))
- `clinic_status` (ENUM('open', 'closed', 'break'))
- `public_notice` (TEXT)

### `system_settings`
Centralized key-value storage for licensing, Resend email settings, and passcode security PINs.
- `setting_key` (VARCHAR(100), PRIMARY KEY): e.g. `'admin_master_passcode'`, `'tab_pin'`, `'tab_security_json'`
- `setting_value` (TEXT)

### `users`
Tracks authorized clinic staff and doctors.
- `id` (VARCHAR(50), PRIMARY KEY)
- `username` (VARCHAR(100), UNIQUE)
- `name` (VARCHAR(100))
- `email` (VARCHAR(150))
- `password` (VARCHAR(255))
- `role` (ENUM('doctor', 'receptionist', 'warehouse', 'admin'))
- `warehouse_id` (VARCHAR(50), Nullable)
- `consultation_fee` (DECIMAL(10,2))
- `can_view_financials` (BOOLEAN)
- `is_owner` (BOOLEAN)

### `patients`
Tracks clinic patients.
- `id` (VARCHAR(50), PRIMARY KEY)
- `full_name` (VARCHAR(150))
- `relation_name` (VARCHAR(150))
- `relation_type` (ENUM('father', 'husband', 'wife', 'mother'))
- `phone` (VARCHAR(50))
- `age` (INT)
- `gender` (VARCHAR(20))
- `address` (TEXT)

### `visits`
OPD consultation entries.
- `id` (VARCHAR(50), PRIMARY KEY)
- `patient_id` (VARCHAR(50))
- `doctor_id` (VARCHAR(50))
- `token_number` (INT)
- `vitals_bp` (VARCHAR(20)), `vitals_pulse` (VARCHAR(20)), `vitals_temp` (VARCHAR(20))
- `symptoms` (TEXT)
- `diagnosis` (TEXT)
- `treatment_json` (TEXT): Array of prescribed medicines, potency, and dosage instructions.
- `fee_amount` (DECIMAL(10,2))
- `fee_status` (ENUM('Paid', 'Unpaid'))
- `prescription_image_url` (TEXT): Canvas compressed prescription photos
- `report_image_urls` (TEXT): Canvas compressed patient reports

---

## 3. Bidirectional Sync & Outbox Queue
- **State Snapshots:** The frontend tracks changes locally using localStorage.
- **Outbox Queue (`db.js`):** Offline mutations are placed in an outbox queue.
- **Sync Polling (`syncEngine.js`):** When internet is restored, the poller pushes mutations to `/api/v1/system/sync-state` and reconciles conflict resolution.
