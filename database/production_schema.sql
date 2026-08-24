-- ============================================================================
-- CliniCore — Production Database Schema (MySQL 8.0 / InnoDB)
-- Clinic & Wholesale Homoeopathic Management System
-- Version: 2.0 (Production Release)
-- Target Server: Hostinger KVM 1 (Ubuntu 24.04 LTS, MySQL 8.0)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS clinicore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE clinicore;

-- Disable Foreign Key Checks during setup
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. IDENTITY, MULTI-TENANCY & RBAC DOMAIN
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS warehouses;
DROP TABLE IF EXISTS clinics;

CREATE TABLE clinics (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500) NULL,
    address TEXT NULL,
    phone VARCHAR(50) NULL,
    default_consultation_fee DECIMAL(10,2) DEFAULT 0.00,
    clinic_status ENUM('open', 'closed', 'break') DEFAULT 'open',
    clinic_status_note VARCHAR(255) NULL,
    public_notice TEXT NULL,
    license_key VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE warehouses (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NULL,
    incharge_name VARCHAR(255) NULL,
    phone VARCHAR(50) NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_store_counter BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    UNIQUE KEY uk_clinic_wh_code (clinic_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_label VARCHAR(100) NULL,
    role ENUM('owner', 'doctor', 'receptionist', 'pharmacist', 'cashier', 'godown_incharge', 'admin') NOT NULL,
    phone VARCHAR(50) NULL,
    email VARCHAR(255) NULL,
    password_hash VARCHAR(255) NOT NULL,
    assigned_warehouse_id VARCHAR(36) NULL,
    is_principal_doctor BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
    INDEX idx_user_clinic_role (clinic_id, role),
    INDEX idx_user_phone (phone),
    INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(36) NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_clinic_time (clinic_id, created_at),
    INDEX idx_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. CLINICAL & OPD QUEUE DOMAIN
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS visit_attachments;
DROP TABLE IF EXISTS visits;
DROP TABLE IF EXISTS patients;

CREATE TABLE patients (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    mr_number VARCHAR(50) NULL,
    full_name VARCHAR(255) NOT NULL,
    relation_name VARCHAR(255) NULL,
    relation_type ENUM('father', 'husband', 'wife', 'guardian', 'other') DEFAULT 'father',
    phone VARCHAR(50) NOT NULL,
    cnic VARCHAR(30) NULL,
    age INT NULL,
    gender ENUM('male', 'female', 'other') DEFAULT 'male',
    address TEXT NULL,
    city VARCHAR(100) DEFAULT 'Hyderabad',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    INDEX idx_patient_search (clinic_id, phone, full_name(50), relation_name(50)),
    INDEX idx_patient_mr (clinic_id, mr_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE visits (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    patient_id VARCHAR(36) NOT NULL,
    doctor_id VARCHAR(36) NOT NULL,
    token_number INT NOT NULL,
    queue_date DATE NOT NULL,
    visit_type ENUM('new', 'follow_up', 'emergency') DEFAULT 'new',
    status ENUM('waiting', 'in_consultation', 'completed', 'completed_reports_pending', 'skipped', 'cancelled') DEFAULT 'waiting',
    fee_amount DECIMAL(10,2) DEFAULT 0.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    net_fee DECIMAL(10,2) DEFAULT 0.00,
    payment_mode ENUM('cash', 'credit', 'free') DEFAULT 'cash',
    symptoms TEXT NULL,
    diagnosis TEXT NULL,
    notes TEXT NULL,
    prescription_image_url TEXT NULL,
    follow_up_date DATE NULL,
    registered_by VARCHAR(36) NULL,
    called_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (registered_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uk_token_per_doctor_day (clinic_id, doctor_id, queue_date, token_number),
    INDEX idx_queue_active (clinic_id, doctor_id, queue_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE visit_attachments (
    id VARCHAR(36) PRIMARY KEY,
    visit_id VARCHAR(36) NOT NULL,
    clinic_id VARCHAR(36) NOT NULL,
    file_type ENUM('report', 'xray', 'prescription', 'document') DEFAULT 'report',
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size_kb INT DEFAULT 0,
    notes VARCHAR(255) NULL,
    uploaded_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. INVENTORY & MULTI-WAREHOUSE STOCK DOMAIN
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS stock_transfer_items;
DROP TABLE IF EXISTS stock_transfers;
DROP TABLE IF EXISTS warehouse_stocks;
DROP TABLE IF EXISTS inventory;

CREATE TABLE inventory (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    item_code VARCHAR(50) NULL,
    medicine_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) DEFAULT 'Local Market',
    category VARCHAR(100) DEFAULT 'Tablet',
    strength VARCHAR(100) NULL,
    has_multi_unit BOOLEAN DEFAULT TRUE,
    strips_per_box INT DEFAULT 10,
    units_per_strip INT DEFAULT 10,
    box_label VARCHAR(50) DEFAULT 'Box',
    strip_label VARCHAR(50) DEFAULT 'Strip',
    unit_label VARCHAR(50) DEFAULT 'Tablet',
    box_cost_price DECIMAL(10,2) DEFAULT 0.00,
    box_sale_price DECIMAL(10,2) DEFAULT 0.00,
    strip_sale_price DECIMAL(10,2) DEFAULT 0.00,
    unit_sale_price DECIMAL(10,2) DEFAULT 0.00,
    low_stock_threshold INT DEFAULT 20,
    barcode VARCHAR(100) NULL,
    status ENUM('active', 'inactive', 'discontinued') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    INDEX idx_inv_search (clinic_id, medicine_name(50), company_name(50)),
    INDEX idx_inv_barcode (barcode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE warehouse_stocks (
    id VARCHAR(36) PRIMARY KEY,
    inventory_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    total_base_units INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    UNIQUE KEY uk_item_warehouse (inventory_id, warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_transfers (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    transfer_no VARCHAR(50) NOT NULL,
    from_warehouse_id VARCHAR(36) NOT NULL,
    to_warehouse_id VARCHAR(36) NOT NULL,
    status ENUM('pending', 'dispatched', 'received', 'cancelled') DEFAULT 'pending',
    notes TEXT NULL,
    dispatched_by VARCHAR(36) NULL,
    received_by VARCHAR(36) NULL,
    dispatched_at TIMESTAMP NULL,
    received_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY (dispatched_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uk_transfer_no (clinic_id, transfer_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_transfer_items (
    id VARCHAR(36) PRIMARY KEY,
    transfer_id VARCHAR(36) NOT NULL,
    inventory_id VARCHAR(36) NOT NULL,
    quantity_base_units INT NOT NULL,
    notes VARCHAR(255) NULL,
    FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_movements (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    inventory_id VARCHAR(36) NOT NULL,
    movement_type ENUM('purchase', 'pos_sale', 'b2b_sale', 'transfer_in', 'transfer_out', 'adjustment', 'return_in', 'return_out') NOT NULL,
    reference_id VARCHAR(36) NULL,
    qty_change_base_units INT NOT NULL,
    balance_after_base_units INT NOT NULL,
    notes VARCHAR(255) NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_mov_audit (warehouse_id, inventory_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. SUPPLIERS, PURCHASES & GRN DOMAIN
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS supplier_ledger;
DROP TABLE IF EXISTS purchase_items;
DROP TABLE IF EXISTS purchases;
DROP TABLE IF EXISTS suppliers;

CREATE TABLE suppliers (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NULL,
    phone VARCHAR(50) NULL,
    address TEXT NULL,
    current_balance DECIMAL(12,2) DEFAULT 0.00,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchases (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    purchase_no VARCHAR(50) NOT NULL,
    supplier_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    bill_no VARCHAR(100) NULL,
    bill_date DATE NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    net_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_mode ENUM('cash', 'credit', 'cheque', 'bank_transfer') DEFAULT 'credit',
    cheque_no VARCHAR(100) NULL,
    bank_name VARCHAR(100) NULL,
    cheque_date DATE NULL,
    notes TEXT NULL,
    received_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uk_purchase_no (clinic_id, purchase_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_items (
    id VARCHAR(36) PRIMARY KEY,
    purchase_id VARCHAR(36) NOT NULL,
    inventory_id VARCHAR(36) NOT NULL,
    batch_no VARCHAR(100) NULL,
    expiry_date DATE NULL,
    box_qty INT DEFAULT 0,
    strip_qty INT DEFAULT 0,
    unit_qty INT DEFAULT 0,
    total_base_units INT NOT NULL,
    cost_price_per_box DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE supplier_ledger (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    supplier_id VARCHAR(36) NOT NULL,
    entry_type ENUM('purchase_bill', 'payment_made', 'return_debit', 'adjustment') NOT NULL,
    reference_no VARCHAR(100) NULL,
    debit_amount DECIMAL(12,2) DEFAULT 0.00,
    credit_amount DECIMAL(12,2) DEFAULT 0.00,
    running_balance DECIMAL(12,2) NOT NULL,
    notes VARCHAR(255) NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_sup_ledger (supplier_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. PARTIES, SALESMEN, POS & B2B WHOLESALE DOMAIN
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS b2b_sale_items;
DROP TABLE IF EXISTS b2b_sales;
DROP TABLE IF EXISTS pos_sale_items;
DROP TABLE IF EXISTS pos_sales;
DROP TABLE IF EXISTS parties;
DROP TABLE IF EXISTS salesmen;

CREATE TABLE salesmen (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    commission_rate DECIMAL(5,2) DEFAULT 0.00,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE parties (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    party_code VARCHAR(50) NOT NULL,
    party_name VARCHAR(255) NOT NULL,
    city VARCHAR(100) DEFAULT 'Hyderabad',
    phone VARCHAR(50) NULL,
    address TEXT NULL,
    salesman_id VARCHAR(36) NULL,
    credit_limit DECIMAL(12,2) DEFAULT 0.00,
    current_balance DECIMAL(12,2) DEFAULT 0.00,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (salesman_id) REFERENCES salesmen(id) ON DELETE SET NULL,
    UNIQUE KEY uk_party_code (clinic_id, party_code),
    INDEX idx_party_search (clinic_id, party_name(50), city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pos_sales (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    receipt_no VARCHAR(50) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    cashier_id VARCHAR(36) NOT NULL,
    linked_visit_id VARCHAR(36) NULL,
    patient_id VARCHAR(36) NULL,
    customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
    customer_phone VARCHAR(50) NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    net_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    change_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_mode ENUM('cash', 'credit_patient', 'card', 'online') DEFAULT 'cash',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (linked_visit_id) REFERENCES visits(id) ON DELETE SET NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
    UNIQUE KEY uk_pos_receipt (clinic_id, receipt_no),
    INDEX idx_pos_time (clinic_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pos_sale_items (
    id VARCHAR(36) PRIMARY KEY,
    sale_id VARCHAR(36) NOT NULL,
    inventory_id VARCHAR(36) NOT NULL,
    unit_type_sold ENUM('box', 'strip', 'unit') NOT NULL DEFAULT 'unit',
    qty_sold INT NOT NULL,
    base_units_deducted INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES pos_sales(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE b2b_sales (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    invoice_no VARCHAR(50) NOT NULL,
    party_id VARCHAR(36) NOT NULL,
    salesman_id VARCHAR(36) NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    cashier_id VARCHAR(36) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    trade_discount_pct DECIMAL(5,2) DEFAULT 0.00,
    trade_discount_rs DECIMAL(12,2) DEFAULT 0.00,
    net_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_mode ENUM('credit', 'cash', 'cheque', 'bank_transfer') DEFAULT 'credit',
    cheque_no VARCHAR(100) NULL,
    bank_name VARCHAR(100) NULL,
    cheque_clearance_date DATE NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE RESTRICT,
    FOREIGN KEY (salesman_id) REFERENCES salesmen(id) ON DELETE SET NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE KEY uk_b2b_invoice (clinic_id, invoice_no),
    INDEX idx_b2b_party (party_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE b2b_sale_items (
    id VARCHAR(36) PRIMARY KEY,
    b2b_sale_id VARCHAR(36) NOT NULL,
    inventory_id VARCHAR(36) NOT NULL,
    batch_no VARCHAR(100) NULL,
    expiry_date DATE NULL,
    qty_boxes INT NOT NULL,
    base_units_deducted INT NOT NULL,
    box_sale_price DECIMAL(10,2) NOT NULL,
    item_discount_pct DECIMAL(5,2) DEFAULT 0.00,
    line_total DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (b2b_sale_id) REFERENCES b2b_sales(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. FINANCIALS, LEDGERS, EXPENSES & DAY-END CLOSINGS
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS shift_closings;
DROP TABLE IF EXISTS cashbook;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS patient_ledger;

CREATE TABLE patient_ledger (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    patient_id VARCHAR(36) NOT NULL,
    entry_type ENUM('opd_fee', 'pos_sale', 'payment_received', 'adjustment', 'refund') NOT NULL,
    reference_id VARCHAR(36) NULL,
    debit_amount DECIMAL(12,2) DEFAULT 0.00,
    credit_amount DECIMAL(12,2) DEFAULT 0.00,
    running_balance DECIMAL(12,2) NOT NULL,
    notes VARCHAR(255) NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_patient_ledger (patient_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE expenses (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_mode ENUM('cash', 'bank', 'cheque') DEFAULT 'cash',
    paid_to VARCHAR(255) NULL,
    approved_by VARCHAR(36) NULL,
    expense_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_expense_date (clinic_id, expense_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cashbook (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    entry_type ENUM('in', 'out') NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reference_type VARCHAR(50) NULL,
    reference_id VARCHAR(36) NULL,
    notes VARCHAR(255) NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_cashbook_time (warehouse_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE shift_closings (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    cashier_id VARCHAR(36) NOT NULL,
    shift_date DATE NOT NULL,
    opening_cash DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    system_cash_sales DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    opd_fee_collection DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    cash_expenses DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    expected_cash DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    actual_cash_counted DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    variance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    closed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_shift_audit (warehouse_id, shift_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable Foreign Key Checks
SET FOREIGN_KEY_CHECKS = 1;
