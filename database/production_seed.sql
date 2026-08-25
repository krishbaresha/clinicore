-- ============================================================================
-- CliniCore — Production Clean Setup (Ground Zero Mode)
-- Zero mock data, zero dummy records, ready for fresh production data entry.
-- ============================================================================

USE clinicore;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Wipe all transactional & ledger data
TRUNCATE TABLE visit_attachments;
TRUNCATE TABLE visits;
TRUNCATE TABLE patients;
TRUNCATE TABLE patient_ledger;

TRUNCATE TABLE pos_sale_items;
TRUNCATE TABLE pos_sales;
TRUNCATE TABLE b2b_sale_items;
TRUNCATE TABLE b2b_sales;
TRUNCATE TABLE purchase_items;
TRUNCATE TABLE purchases;
TRUNCATE TABLE supplier_ledger;
TRUNCATE TABLE stock_transfer_items;
TRUNCATE TABLE stock_transfers;
TRUNCATE TABLE stock_movements;
TRUNCATE TABLE warehouse_stocks;
TRUNCATE TABLE inventory;

TRUNCATE TABLE expenses;
TRUNCATE TABLE cashbook;
TRUNCATE TABLE shift_closings;
TRUNCATE TABLE audit_logs;

-- 2. Wipe master catalogues
TRUNCATE TABLE parties;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE salesmen;
TRUNCATE TABLE users;
TRUNCATE TABLE warehouses;
TRUNCATE TABLE clinics;

-- 3. Primary Clinic Entity
INSERT INTO clinics (id, name, logo_url, address, phone, default_consultation_fee, clinic_status, created_at)
VALUES (
    'clinic_001',
    'Dr. Muhammad Kashif Khan Clinic & Wholesale Homoeopathic Store',
    '/clinic-logo.png',
    'Lajpat Road, Hyderabad, Sindh, Pakistan',
    '0347-3100304',
    300.00,
    'open',
    NOW()
);

-- 4. Default Store & Godown
INSERT INTO warehouses (id, clinic_id, code, name, location, incharge_name, phone, is_default, is_store_counter, status, notes)
VALUES (
    'wh_main',
    'clinic_001',
    'WH-MAIN',
    'Main Store & Godown',
    'Lajpat Road, Hyderabad',
    'Dr. Kashif',
    '0347-3100304',
    TRUE,
    TRUE,
    'active',
    'Primary store counter and dispensary'
);

-- 5. Master Owner Login (Dr. Kashif)
-- Default Password: 'password123'
INSERT INTO users (id, clinic_id, name, display_label, role, phone, email, password_hash, assigned_warehouse_id, is_principal_doctor, status)
VALUES (
    'user_kashif_01',
    'clinic_001',
    'Dr. Muhammad Kashif Khan',
    'Dr. Kashif (Principal)',
    'owner',
    '03473100304',
    'drkashif@clinicore.pk',
    '$2y$10$pC2D/HvZvma4OBWeNkh51eBNMD7n3KAOs/etdFbwrL217VoRtI9ky',
    'wh_main',
    TRUE,
    'active'
);

SET FOREIGN_KEY_CHECKS = 1;
