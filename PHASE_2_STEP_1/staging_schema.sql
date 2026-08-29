-- =============================================================================
-- CLINICORE / CLINICFLOW MASTER ARCHITECTURE
-- PHASE 2 — STEP 1: LEGACY STAGING SCHEMA (staging_schema.sql)
--
-- Target Database: Local Disposable / Staging PostgreSQL
-- Purpose: Holds raw, un-transformed historical data from legacy MS Access
--          (AshrafKhan.accdb - 12.29 MB) and Excel (DrCreate.xlsm).
-- Rules: NO production table modifications; preserves original IDs & raw fields;
--        tracks ETL validation, mapping status, and error logs.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS staging_legacy;

-- -----------------------------------------------------------------------------
-- 1. Legacy Accounts Staging (AshrafKhan.accdb -> Accounts table: 263 rows)
-- -----------------------------------------------------------------------------
CREATE TABLE staging_legacy.stg_accounts (
    stg_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_source VARCHAR(64) NOT NULL DEFAULT 'AshrafKhan.accdb',
    legacy_table VARCHAR(64) NOT NULL DEFAULT 'Accounts',
    legacy_id VARCHAR(64) NOT NULL,
    raw_account_name TEXT,
    raw_account_no VARCHAR(64),
    raw_narration TEXT,
    raw_account_type VARCHAR(64),
    
    -- ETL Processing Lineage & Status
    validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, VALID, INVALID, IGNORED
    mapping_status VARCHAR(32) NOT NULL DEFAULT 'UNMAPPED',   -- UNMAPPED, MAPPED_PARTY, MAPPED_SUPPLIER, MAPPED_ACCOUNT
    target_entity_type VARCHAR(64),
    target_entity_id UUID,
    validation_errors JSONB DEFAULT '[]'::jsonb,
    
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stg_accounts_legacy_id ON staging_legacy.stg_accounts(legacy_id);
CREATE INDEX idx_stg_accounts_status ON staging_legacy.stg_accounts(validation_status, mapping_status);

-- -----------------------------------------------------------------------------
-- 2. Legacy Inventory Catalogue Staging (AshrafKhan.accdb -> Inventory table: 4,237 rows)
-- -----------------------------------------------------------------------------
CREATE TABLE staging_legacy.stg_inventory (
    stg_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_source VARCHAR(64) NOT NULL DEFAULT 'AshrafKhan.accdb',
    legacy_table VARCHAR(64) NOT NULL DEFAULT 'Inventory',
    legacy_id VARCHAR(64) NOT NULL,
    raw_item_name TEXT,
    raw_item_code VARCHAR(128),
    raw_narration TEXT,
    raw_minimum_level NUMERIC(12,3),
    raw_sale_price NUMERIC(15,2),
    raw_purchase_price NUMERIC(15,2),
    
    -- ETL Processing Lineage & Status
    validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    mapping_status VARCHAR(32) NOT NULL DEFAULT 'UNMAPPED',
    target_inventory_id UUID,
    validation_errors JSONB DEFAULT '[]'::jsonb,
    
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stg_inventory_legacy_id ON staging_legacy.stg_inventory(legacy_id);
CREATE INDEX idx_stg_inventory_code ON staging_legacy.stg_inventory(raw_item_code);

-- -----------------------------------------------------------------------------
-- 3. Legacy Invoice Headers Staging (AshrafKhan.accdb -> Invextra table: 7,590 rows)
-- -----------------------------------------------------------------------------
CREATE TABLE staging_legacy.stg_invextra (
    stg_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_source VARCHAR(64) NOT NULL DEFAULT 'AshrafKhan.accdb',
    legacy_table VARCHAR(64) NOT NULL DEFAULT 'Invextra',
    legacy_id VARCHAR(64) NOT NULL,
    raw_date VARCHAR(64),
    parsed_date TIMESTAMPTZ,
    raw_voucher_no VARCHAR(64),
    raw_type VARCHAR(32), -- Sale, Purchase, Return
    raw_account_name TEXT,
    raw_term VARCHAR(64),
    raw_term_ac VARCHAR(64),
    raw_bilty VARCHAR(128),
    raw_transport VARCHAR(128),
    raw_salesman VARCHAR(128),
    raw_net_amount NUMERIC(15,2),
    raw_cash_received NUMERIC(15,2),
    
    -- ETL Processing Lineage & Status
    validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    mapping_status VARCHAR(32) NOT NULL DEFAULT 'UNMAPPED',
    target_sale_id UUID,
    target_purchase_id UUID,
    validation_errors JSONB DEFAULT '[]'::jsonb,
    
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stg_invextra_voucher ON staging_legacy.stg_invextra(raw_voucher_no);

-- -----------------------------------------------------------------------------
-- 4. Legacy Stock Movement Line-Items Staging (AshrafKhan.accdb -> Mainpro table: 25,765 rows)
-- -----------------------------------------------------------------------------
CREATE TABLE staging_legacy.stg_mainpro (
    stg_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_source VARCHAR(64) NOT NULL DEFAULT 'AshrafKhan.accdb',
    legacy_table VARCHAR(64) NOT NULL DEFAULT 'Mainpro',
    legacy_id VARCHAR(64) NOT NULL,
    raw_date VARCHAR(64),
    parsed_date TIMESTAMPTZ,
    raw_voucher_no VARCHAR(64),
    raw_transaction_type VARCHAR(64),
    raw_item_name TEXT,
    raw_description TEXT,
    raw_qty_in NUMERIC(12,3),
    raw_qty_out NUMERIC(12,3),
    raw_ref VARCHAR(64),
    raw_rate NUMERIC(15,2),
    raw_gross NUMERIC(15,2),
    raw_disc_percent NUMERIC(5,2),
    raw_disc_flat NUMERIC(15,2),
    raw_net NUMERIC(15,2),
    
    -- ETL Processing Lineage & Status
    validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    mapping_status VARCHAR(32) NOT NULL DEFAULT 'UNMAPPED',
    target_stock_movement_id UUID,
    target_inventory_id UUID,
    validation_errors JSONB DEFAULT '[]'::jsonb,
    
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stg_mainpro_voucher ON staging_legacy.stg_mainpro(raw_voucher_no);
CREATE INDEX idx_stg_mainpro_item ON staging_legacy.stg_mainpro(raw_item_name);

-- -----------------------------------------------------------------------------
-- 5. Legacy Financial Journal Staging (AshrafKhan.accdb -> MainAc table: 29,009 rows)
-- -----------------------------------------------------------------------------
CREATE TABLE staging_legacy.stg_mainac (
    stg_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_source VARCHAR(64) NOT NULL DEFAULT 'AshrafKhan.accdb',
    legacy_table VARCHAR(64) NOT NULL DEFAULT 'MainAc',
    legacy_id VARCHAR(64) NOT NULL,
    raw_date VARCHAR(64),
    parsed_date TIMESTAMPTZ,
    raw_voucher_no VARCHAR(64),
    raw_account_name TEXT,
    raw_transaction_type VARCHAR(64),
    raw_description TEXT,
    raw_debit NUMERIC(15,2),
    raw_credit NUMERIC(15,2),
    
    -- ETL Processing Lineage & Status
    validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    mapping_status VARCHAR(32) NOT NULL DEFAULT 'UNMAPPED',
    target_journal_entry_id UUID,
    validation_errors JSONB DEFAULT '[]'::jsonb,
    
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stg_mainac_voucher ON staging_legacy.stg_mainac(raw_voucher_no);

-- -----------------------------------------------------------------------------
-- 6. Legacy CashBook Staging (AshrafKhan.accdb -> CashBook table: 4,236 rows)
-- -----------------------------------------------------------------------------
CREATE TABLE staging_legacy.stg_cashbook (
    stg_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_source VARCHAR(64) NOT NULL DEFAULT 'AshrafKhan.accdb',
    legacy_table VARCHAR(64) NOT NULL DEFAULT 'CashBook',
    legacy_id VARCHAR(64) NOT NULL,
    raw_voucher_no VARCHAR(64),
    raw_date VARCHAR(64),
    parsed_date TIMESTAMPTZ,
    raw_account_name TEXT,
    raw_description TEXT,
    raw_amount NUMERIC(15,2),
    raw_type VARCHAR(32),
    
    -- ETL Processing Lineage & Status
    validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    mapping_status VARCHAR(32) NOT NULL DEFAULT 'UNMAPPED',
    target_cashbook_id UUID,
    validation_errors JSONB DEFAULT '[]'::jsonb,
    
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 7. Legacy Appointments Staging (AshrafKhan.accdb -> Appointment table: 46 rows)
-- -----------------------------------------------------------------------------
CREATE TABLE staging_legacy.stg_appointments (
    stg_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_source VARCHAR(64) NOT NULL DEFAULT 'AshrafKhan.accdb',
    legacy_table VARCHAR(64) NOT NULL DEFAULT 'Appointment',
    legacy_id VARCHAR(64) NOT NULL,
    raw_doctor TEXT,
    raw_patient_name TEXT,
    raw_patient_contact VARCHAR(64),
    raw_patient_age VARCHAR(32),
    raw_gender VARCHAR(32),
    raw_charges NUMERIC(15,2),
    raw_date VARCHAR(64),
    raw_token_no VARCHAR(32),
    raw_status VARCHAR(32),
    
    -- ETL Processing Lineage & Status
    validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    mapping_status VARCHAR(32) NOT NULL DEFAULT 'UNMAPPED',
    target_visit_id UUID,
    target_patient_id UUID,
    validation_errors JSONB DEFAULT '[]'::jsonb,
    
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
