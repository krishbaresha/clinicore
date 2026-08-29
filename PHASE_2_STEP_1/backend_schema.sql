-- =============================================================================
-- CLINICORE / CLINICFLOW MASTER ARCHITECTURE
-- PHASE 2 — STEP 1: CANONICAL POSTGRESQL DATABASE SCHEMA (backend_schema.sql)
--
-- Target Database: Canonical Server Database (PostgreSQL 16)
-- Single Source of Truth for shared persistent data, double-entry ledgers,
-- event-sourced stock movements, and sync outbox mutations.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS public;

-- Enable UUID Extension if not natively available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 0. GLOBAL MONOTONIC SYNC CURSOR & IDEMPOTENCY REGISTRY
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS sync_cursor_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    client_id VARCHAR(64) NOT NULL,
    user_id UUID,
    mutation_type VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID,
    request_payload JSONB NOT NULL,
    response_payload JSONB NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 200,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_idempotency_key ON idempotency_keys(idempotency_key);
CREATE INDEX idx_idempotency_client ON idempotency_keys(client_id, created_at);

-- =============================================================================
-- 1. CLINIC, ORGANIZATION & MULTI-WAREHOUSE INFRASTRUCTURE
-- =============================================================================

CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_code VARCHAR(32) NOT NULL UNIQUE DEFAULT 'CLINIC_001',
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(64),
    email VARCHAR(128),
    default_consultation_fee NUMERIC(15,2) NOT NULL DEFAULT 500.00,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    
    -- Provenance & Versioning
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    warehouse_code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. USERS, ROLES & AUTHENTICATION
-- =============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    assigned_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    username VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(128) UNIQUE,
    phone VARCHAR(64),
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN (
        'super_admin', 'admin', 'doctor', 'receptionist', 
        'pharmacist', 'cashier', 'wholesale_operator', 
        'warehouse_incharge', 'accountant'
    )),
    is_principal_doctor BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 3. PATIENTS, OPD QUEUE & CLINICAL EMR
-- =============================================================================

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    mr_number VARCHAR(32) NOT NULL UNIQUE, -- MR-00001
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(64),
    cnic VARCHAR(32),
    age VARCHAR(16),
    gender VARCHAR(16),
    address TEXT,
    outstanding_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patients_mr ON patients(mr_number);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_name ON patients(full_name);

CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    doctor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    token_number INTEGER NOT NULL, -- Daily reset #01, #02
    consultation_fee NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    fee_status VARCHAR(32) NOT NULL DEFAULT 'PAID', -- PAID, PENDING, WAIVED
    status VARCHAR(32) NOT NULL DEFAULT 'WAITING',  -- WAITING, IN_CHAMBER, COMPLETED, CANCELLED
    
    -- Clinical HUD Vitals & Notes
    vitals JSONB DEFAULT '{}'::jsonb, -- {bp, pulse, temp, spo2, weight, blood_sugar}
    symptoms TEXT,
    diagnosis TEXT,
    prescription_notes TEXT,
    completed_at TIMESTAMPTZ,
    
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unq_daily_token UNIQUE (clinic_id, visit_date, token_number)
);

CREATE INDEX idx_visits_queue ON visits(clinic_id, visit_date, status);

-- =============================================================================
-- 4. PARTIES, SUPPLIERS & SALESMEN
-- =============================================================================

CREATE TABLE parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    party_code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(128),
    address TEXT,
    phone VARCHAR(64),
    credit_limit NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00, -- Debit balance (Receivable)
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    supplier_code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    company_brand VARCHAR(128), -- BM Pvt LTD, Schwabe, MEKTUM, etc.
    phone VARCHAR(64),
    address TEXT,
    current_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00, -- Credit balance (Payable)
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 5. PHARMACY INVENTORY & FEFO BATCHES
-- =============================================================================

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    sku_code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    company_name VARCHAR(128),
    category VARCHAR(64),
    unit_type VARCHAR(32) NOT NULL DEFAULT 'Pcs',
    purchase_price_unit NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    retail_price_unit NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    min_reorder_qty NUMERIC(12,3) NOT NULL DEFAULT 10.000,
    total_stock_qty NUMERIC(12,3) NOT NULL DEFAULT 0.000,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_sku ON inventory(sku_code);
CREATE INDEX idx_inventory_company ON inventory(company_name);

CREATE TABLE medicine_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    batch_number VARCHAR(64) NOT NULL,
    expiry_date DATE NOT NULL,
    quantity_available NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (quantity_available >= 0),
    purchase_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    sale_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    is_quarantined BOOLEAN NOT NULL DEFAULT FALSE,
    
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unq_batch_per_wh UNIQUE (inventory_id, warehouse_id, batch_number)
);

CREATE INDEX idx_batch_fefo ON medicine_batches(inventory_id, expiry_date, quantity_available);

-- =============================================================================
-- 6. IMMUTABLE EVENT-SOURCED STOCK MOVEMENTS
-- =============================================================================

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES medicine_batches(id) ON DELETE RESTRICT,
    movement_type VARCHAR(32) NOT NULL CHECK (movement_type IN (
        'PURCHASE_RECEIPT', 'POS_SALE', 'B2B_SALE', 
        'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 
        'GODOWN_TRANSFER_OUT', 'GODOWN_TRANSFER_IN', 
        'STOCK_ADJUSTMENT', 'EXPIRED_QUARANTINE'
    )),
    quantity_delta NUMERIC(12,3) NOT NULL, -- Positive for IN, Negative for OUT
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    reference_id UUID, -- Links to sale_id, purchase_id, etc.
    reference_voucher VARCHAR(64),
    performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_mov_inv ON stock_movements(inventory_id, _created_at);
CREATE INDEX idx_stock_mov_wh ON stock_movements(warehouse_id, _created_at);

-- =============================================================================
-- 7. POS RETAIL & B2B WHOLESALE SALES
-- =============================================================================

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(64) NOT NULL UNIQUE,
    sale_type VARCHAR(32) NOT NULL CHECK (sale_type IN ('POS_RETAIL', 'B2B_WHOLESALE')),
    patient_id UUID REFERENCES patients(id) ON DELETE RESTRICT,
    party_id UUID REFERENCES parties(id) ON DELETE RESTRICT,
    salesman_name VARCHAR(128),
    bilty_number VARCHAR(128),
    transport_name VARCHAR(128),
    
    gross_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    cash_tendered NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    cash_change NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(32) NOT NULL DEFAULT 'PAID', -- PAID, PARTIAL, CREDIT
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sales_invoice ON sales(invoice_number);

CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES medicine_batches(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    net_line_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 8. IMMUTABLE DOUBLE-ENTRY FINANCIAL JOURNAL
-- =============================================================================

CREATE TABLE chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    account_code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(32) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    entry_number VARCHAR(64) NOT NULL UNIQUE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    voucher_number VARCHAR(64),
    description TEXT,
    reference_type VARCHAR(64), -- SALE, PURCHASE, EXPENSE, OPD_FEE
    reference_id UUID,
    total_debit NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_credit NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    _legacy_source VARCHAR(64),
    _legacy_id VARCHAR(64),
    _version BIGINT NOT NULL DEFAULT 1,
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_double_entry_balance CHECK (total_debit = total_credit)
);

CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    party_id UUID REFERENCES parties(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
    debit NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (debit >= 0),
    credit NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (credit >= 0),
    narration TEXT,
    
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_line_side CHECK (debit = 0 OR credit = 0)
);

-- =============================================================================
-- 9. DOCTOR APPROVAL REQUESTS & AUDIT LOGS
-- =============================================================================

CREATE TABLE approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action_type VARCHAR(64) NOT NULL, -- HIGH_DISCOUNT, STOCK_WRITE_OFF, REVERSAL
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID,
    details JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    approved_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    _sync_cursor BIGINT NOT NULL DEFAULT nextval('sync_cursor_seq'),
    _created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID,
    changes JSONB,
    client_ip VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_created ON audit_logs(created_at);
