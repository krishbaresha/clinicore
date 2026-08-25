-- ============================================================================
-- CliniCore — Production Clean State (Zero Data Mode)
-- Completely empty database with 0 records across all tables.
-- Everything is created from scratch via the CliniCore Admin Panel.
-- ============================================================================

USE clinicore;

SET FOREIGN_KEY_CHECKS = 0;

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

TRUNCATE TABLE parties;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE salesmen;
TRUNCATE TABLE users;
TRUNCATE TABLE warehouses;
TRUNCATE TABLE clinics;

SET FOREIGN_KEY_CHECKS = 1;
