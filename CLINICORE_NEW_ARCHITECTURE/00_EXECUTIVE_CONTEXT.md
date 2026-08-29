# 00 — Executive Context & Vision

> **System:** CliniCore / ClinicFlow Master Architecture  
> **Client:** H/Dr. Asif Ashraf Khan Clinic & Wholesale Pharmacy (Hyderabad & Interior Sindh)  
> **Date:** August 29, 2026  
> **Status:** Phase 0 Preservation & Phase 1 Forensic Architecture Decision Stage  

---

## 1. Executive Summary & Core Mission

CliniCore (formerly ClinicFlow) is an enterprise-grade medical clinic management, pharmacy point-of-sale (POS), wholesale distribution, multi-godown warehouse, and accounting software suite tailored specifically for **H/Dr. Asif Ashraf Khan Clinic**.

The system must transition from a web-centric PHP/React prototype into a **true client-server desktop & mobile ecosystem**:
1. **Desktop Client**: Installable Windows application (Tauri + React + SQLite) operating 100% offline with zero browser dependencies.
2. **Doctor Mobile App**: Cross-platform mobile app (React Native + Expo) for remote chamber monitoring, sensitive action approvals, and vitals/prescription review.
3. **VPS Server & Canonical Database**: Hosted backend infrastructure (Node.js/TypeScript + NestJS/Fastify + PostgreSQL) acting as the single authoritative source of truth for persistent shared data, audit logs, and synchronized outbox mutations.

---

## 2. Core Architectural Guarantees & Constraints

1. **Zero Browser Dependency**: Normal daily operations (OPD registration, consultation, POS billing, inventory GRN, wholesale ledger management) run directly within installed native desktop windows.
2. **Server Supremacy & Domain Authority**: No client application is permitted to submit final balances, stock totals, or accounting closing numbers. Clients submit business operations (mutations with idempotency keys); the server calculates canonical balances inside ACID database transactions.
3. **Offline-First Resilience**: Work never stops when internet connection drops. Desktop clients record transactions to a durable local SQLite outbox queue. Upon reconnection, mutations sync monotonically via server change cursors without data clobbering.
4. **Historical Data Preservation**: Approximately 2 years of legacy production data originating from MS Access (`AshrafKhan.accdb`), Excel workbooks (`DrCreate.xlsm`), and MySQL production snapshots are treated as canonical historical records. Legacy data must be staged, validated, mapped, and preserved in full without silent truncation.
5. **Zero Data Loss Guarantee**: Clearing local browser cache or wiping a desktop working database never results in data loss. Logging in on a clean device re-hydrates full authorized state from the VPS canonical database.

---

## 3. Scope of Ecosystem Components

| Component | Target Technology | Target Users | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Canonical Server & Database** | Node.js + TypeScript + PostgreSQL | System Architecture | Single authoritative source of truth, API gateway, ACID transactions, backup vault |
| **Desktop Application** | React + TypeScript + Tauri + SQLite | Receptionists, Cashiers, Store Managers, Warehouse Incharges, Accountants, Admin | OPD queue, pharmacy POS, inventory management, wholesale billing, day closing, reporting |
| **Doctor Mobile App** | React Native + Expo | Doctor (H/Dr. Asif Ashraf Khan) | Remote chamber queue monitoring, real-time sensitive action approvals, EMR review |
| **Legacy Staging Pipeline** | Python / Node.js Migration ETL Engine | Migration Engineers | Staging, validating, mapping, and importing 2 years of MS Access & Excel records |

---

## 4. Phase 0 & Phase 1 Execution Principles

- **Zero Destruction**: No existing database table, repository file, or legacy file (`AshrafKhan.accdb`, `DrCreate.xlsm`) will be deleted, dropped, or overwritten.
- **Evidence-Based Engineering**: No architectural claim is accepted without log tracebacks, schema inspection, or mathematical proof.
- **Strict Decoupling**: Frontend UI components never execute business logic; all accounting debit/credit balances and stock movements are calculated by dedicated domain services.
