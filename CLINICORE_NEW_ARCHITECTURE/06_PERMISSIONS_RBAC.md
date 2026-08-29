# 06 — Security, RBAC & Privilege Boundaries

> **System:** CliniCore / ClinicFlow Master Architecture  

---

## 1. Enterprise Roles Matrix
1. `super_admin`: Full system access, master passcode management, system settings.
2. `admin` / `owner`: Full clinic & wholesale access, financial reports, approvals.
3. `doctor`: Chamber OPD queue, patient EMR, consultation, mobile approval sign-off.
4. `receptionist`: Patient registration, OPD queue token issuance, fee collection.
5. `pharmacist`: Inventory management, stock adjustments, batch quarantine.
6. `cashier`: Pharmacy POS billing, cash sales, receipt printing.
7. `wholesale_operator`: B2B party sales, salesman tracking, bilty transport entries.
8. `warehouse_incharge`: Godown stock transfers, GRN purchase receipts, stock count.
9. `accountant`: Cashbook, supplier payments, party ledger settlements, financial audit.

## 2. Multi-Warehouse Location Scoping
Users assigned to a specific warehouse (`assigned_warehouse_id`) are restricted to viewing and mutating inventory strictly within their assigned location.
