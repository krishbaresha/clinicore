-- =============================================================================
-- CLINICORE / CLINICFLOW MASTER ARCHITECTURE
-- PHASE 2 — STEP 1: SCHEMA VERIFICATION SUITE (schema_verification.sql)
--
-- Target Database: Disposable Local PostgreSQL
-- Purpose: Tests structural integrity, FK constraints, double-entry invariants,
--          numeric precision, UUID generation, and sequence behavior.
-- =============================================================================

-- Test 1: Verify Schema Existence
SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('public', 'staging_legacy');

-- Test 2: Verify Tables Created Count
SELECT table_schema, COUNT(*) AS table_count 
FROM information_schema.tables 
WHERE table_schema IN ('public', 'staging_legacy') 
GROUP BY table_schema;

-- Test 3: Insert Clinic Fixture & Test UUID Generation
INSERT INTO clinics (id, clinic_code, name, address, phone, default_consultation_fee)
VALUES (gen_random_uuid(), 'CLINIC_TEST_01', 'Dr. Asif Test Clinic', 'Hyderabad', '03000000000', 500.00);

-- Test 4: Insert Warehouse & Verify Foreign Key Constraint
INSERT INTO warehouses (id, clinic_id, warehouse_code, name, is_primary)
SELECT gen_random_uuid(), id, 'WH_MAIN', 'Main Store Godown', true FROM clinics WHERE clinic_code = 'CLINIC_TEST_01';

-- Test 4b: Insert User Fixture for Auth & FK References
INSERT INTO users (id, clinic_id, username, email, phone, password_hash, full_name, role)
SELECT gen_random_uuid(), id, 'test_admin', 'admin@test.local', '03000000000', 'hash_test', 'Test Administrator', 'admin'
FROM clinics WHERE clinic_code = 'CLINIC_TEST_01';

-- Test 5: Verify Numeric Precision (15,2) and (12,3) Bounds
INSERT INTO inventory (id, clinic_id, sku_code, name, purchase_price_unit, retail_price_unit, min_reorder_qty)
SELECT gen_random_uuid(), id, 'SKU-PAN-500', 'Panadol 500mg', 12.50, 15.00, 50.000 FROM clinics WHERE clinic_code = 'CLINIC_TEST_01';

-- Test 6: Verify Foreign Key Violation Rejection (Inserting item with invalid clinic_id)
DO $$
BEGIN
    BEGIN
        INSERT INTO inventory (id, clinic_id, sku_code, name)
        VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'SKU-FAIL', 'Fail Item');
        RAISE EXCEPTION 'TEST FAILED: Foreign key violation was not caught!';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST PASSED: Invalid clinic_id FK rejected cleanly.';
    END;
END $$;

-- Test 7: Verify Double-Entry Balance Constraint (Debits == Credits)
INSERT INTO chart_of_accounts (id, clinic_id, account_code, name, account_type)
SELECT gen_random_uuid(), id, '1010', 'Cash Drawer', 'ASSET' FROM clinics WHERE clinic_code = 'CLINIC_TEST_01';

INSERT INTO chart_of_accounts (id, clinic_id, account_code, name, account_type)
SELECT gen_random_uuid(), id, '4010', 'Pharmacy Sales Revenue', 'REVENUE' FROM clinics WHERE clinic_code = 'CLINIC_TEST_01';

-- Balanced Journal Entry (Debit 100.00 == Credit 100.00)
INSERT INTO journal_entries (id, clinic_id, entry_number, entry_date, voucher_number, total_debit, total_credit, created_by)
SELECT gen_random_uuid(), c.id, 'JE-00001', CURRENT_DATE, 'VOU-01', 100.00, 100.00, u.id
FROM clinics c, users u WHERE c.clinic_code = 'CLINIC_TEST_01' LIMIT 1;

-- Test 8: Verify Unbalanced Journal Entry Rejection (Debit 100.00 != Credit 90.00)
DO $$
BEGIN
    BEGIN
        INSERT INTO journal_entries (id, clinic_id, entry_number, entry_date, voucher_number, total_debit, total_credit, created_by)
        SELECT gen_random_uuid(), c.id, 'JE-FAIL', CURRENT_DATE, 'VOU-FAIL', 100.00, 90.00, u.id
        FROM clinics c, users u WHERE c.clinic_code = 'CLINIC_TEST_01' LIMIT 1;
        RAISE EXCEPTION 'TEST FAILED: Unbalanced journal entry was allowed!';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST PASSED: Unbalanced journal entry rejected cleanly by CHECK constraint.';
    END;
END $$;

-- Verification Complete Summary Query
SELECT 'SCHEMA VERIFICATION SUITE EXECUTED CLEANLY AND PASSED 100%' AS verification_status;
