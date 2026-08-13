CREATE DATABASE IF NOT EXISTS clinicflow;
USE clinicflow;

CREATE TABLE clinics (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('doctor', 'receptionist') NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    password_hash VARCHAR(255),
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
);

CREATE TABLE patients (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    cnic VARCHAR(20),
    age INT,
    gender ENUM('male', 'female', 'other'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
);

CREATE TABLE visits (
    id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36) NOT NULL,
    clinic_id VARCHAR(36) NOT NULL,
    visit_date TIMESTAMP NOT NULL,
    symptoms TEXT,
    diagnosis TEXT,
    fee_amount DECIMAL(10, 2),
    follow_up_date DATE,
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
);

CREATE TABLE prescription_items (
    id VARCHAR(36) PRIMARY KEY,
    visit_id VARCHAR(36) NOT NULL,
    medicine_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(255),
    duration VARCHAR(255),
    FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
);

CREATE TABLE store_inventory (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    medicine_name VARCHAR(255) NOT NULL,
    stock_qty INT NOT NULL DEFAULT 0,
    unit_price DECIMAL(10, 2) NOT NULL,
    low_stock_threshold INT DEFAULT 10,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
);

CREATE TABLE store_sales (
    id VARCHAR(36) PRIMARY KEY,
    clinic_id VARCHAR(36) NOT NULL,
    inventory_id VARCHAR(36) NOT NULL,
    quantity_sold INT NOT NULL,
    sale_amount DECIMAL(10, 2) NOT NULL,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    linked_visit_id VARCHAR(36),
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES store_inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (linked_visit_id) REFERENCES visits(id) ON DELETE SET NULL
);
