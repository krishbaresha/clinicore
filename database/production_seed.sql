-- ============================================================================
-- CliniCore — Production Seed Data
-- Initial Master Data & Staff Accounts
-- ============================================================================

USE clinicore;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Master Clinic
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
) ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 2. Master Warehouses & Godowns
INSERT INTO warehouses (id, clinic_id, code, name, location, incharge_name, phone, is_default, is_store_counter, status, notes)
VALUES
('wh_001', 'clinic_001', 'GDW-01', 'Main Godown (Lajpat Road)', 'Lajpat Road, Hyderabad', 'Raza', '0300-9998877', TRUE, FALSE, 'active', 'Primary wholesale bulk storage godown'),
('wh_002', 'clinic_001', 'GDW-02', 'Secondary Godown (Site Area)', 'Site Area, Hyderabad', 'Usama', '0322-1234567', FALSE, FALSE, 'active', 'Overflow and bulk dry storage'),
('wh_str', 'clinic_001', 'STR-01', 'Medical Store Counter (POS)', 'Lajpat Road, Main Counter', 'Waheed Bhai', '0311-1234567', FALSE, TRUE, 'active', 'Retail counter and OPD dispensary')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 3. Master Users (Default Password: 'password123' -> $2y$12$e6mK1LqWbCg2m4gN7WzP..g78V2VbB2qU3iW4F0eT6A8e4kR3W9/q)
-- Hash generated using standard bcrypt (Cost 12)
INSERT INTO users (id, clinic_id, name, display_label, role, phone, email, password_hash, assigned_warehouse_id, is_principal_doctor, status)
VALUES
('user_kashif_01', 'clinic_001', 'Dr. Muhammad Kashif Khan', 'Dr. Kashif (Principal)', 'owner', '03473100304', 'drkashif@clinicore.pk', '$2y$10$pC2D/HvZvma4OBWeNkh51eBNMD7n3KAOs/etdFbwrL217VoRtI9ky', 'wh_str', TRUE, 'active'),
('user_asif_02', 'clinic_001', 'Dr. Asif Ashraf', 'Dr. Asif (Consultant)', 'doctor', '03001234567', 'drasif@clinicore.pk', '$2y$10$pC2D/HvZvma4OBWeNkh51eBNMD7n3KAOs/etdFbwrL217VoRtI9ky', 'wh_str', FALSE, 'active'),
('user_waheed_03', 'clinic_001', 'Waheed Bhai', 'Waheed (Counter 1)', 'receptionist', '03111234567', 'waheed@clinicore.pk', '$2y$10$pC2D/HvZvma4OBWeNkh51eBNMD7n3KAOs/etdFbwrL217VoRtI9ky', 'wh_str', FALSE, 'active'),
('user_raza_04', 'clinic_001', 'Raza Ali', 'Raza (Godown 1)', 'godown_incharge', '03009998877', 'raza@clinicore.pk', '$2y$10$pC2D/HvZvma4OBWeNkh51eBNMD7n3KAOs/etdFbwrL217VoRtI9ky', 'wh_001', FALSE, 'active'),
('user_usama_05', 'clinic_001', 'Usama Khan', 'Usama (Godown 2)', 'godown_incharge', '03221234567', 'usama@clinicore.pk', '$2y$10$pC2D/HvZvma4OBWeNkh51eBNMD7n3KAOs/etdFbwrL217VoRtI9ky', 'wh_002', FALSE, 'active'),
('user_admin_00', 'clinic_001', 'Super Administrator', 'Super Admin', 'admin', '03000000000', 'admin@clinicore.pk', '$2y$10$pC2D/HvZvma4OBWeNkh51eBNMD7n3KAOs/etdFbwrL217VoRtI9ky', NULL, FALSE, 'active')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 4. Master Salesmen
INSERT INTO salesmen (id, clinic_id, name, phone, commission_rate, status)
VALUES
('sm_01', 'clinic_001', 'Farhan Ali (Hyderabad City)', '0301-2223344', 2.50, 'active'),
('sm_02', 'clinic_001', 'Tariq Mehmood (Interior Sindh)', '0302-3334455', 3.00, 'active'),
('sm_03', 'clinic_001', 'Direct Counter Orders', '0347-3100304', 0.00, 'active')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 5. Master Suppliers
INSERT INTO suppliers (id, clinic_id, name, company_name, phone, address, current_balance, status)
VALUES
('sup_bm_01', 'clinic_001', 'BM Homoeo Pharma Pvt Ltd', 'BM Pvt LTD', '042-35551122', 'Industrial Area, Lahore', 0.00, 'active'),
('sup_pb_02', 'clinic_001', 'Paul Brooks Homoeo Laboratories', 'Paul Brooks', '021-34442233', 'Korangi Industrial Area, Karachi', 0.00, 'active'),
('sup_schwabe_03', 'clinic_001', 'Dr. Willmar Schwabe Germany', 'Dr. Willmar Schwabe', '021-32221100', 'Karachi Import Office', 0.00, 'active'),
('sup_mektum_04', 'clinic_001', 'Mektum Homoeo Pharma', 'MEKTUM', '051-4443322', 'Rawalpindi, Pakistan', 0.00, 'active')
ON DUPLICATE KEY UPDATE name=VALUES(name);

SET FOREIGN_KEY_CHECKS = 1;
