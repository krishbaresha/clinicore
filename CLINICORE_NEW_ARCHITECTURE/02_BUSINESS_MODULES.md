# 02 — Business Modules & Workflows

> **System:** CliniCore / ClinicFlow Master Architecture  
> **Client:** H/Dr. Asif Ashraf Khan Clinic & Wholesale Pharmacy  

---

## 1. OPD & Patient Lifecycle Module
- **Patient Registration**: Sequential MR ID generation (`MR-00001`), phone normalization (`+923XX`), multi-identifier search (MR, Phone, Name, CNIC).
- **Daily Queue Management**: Date-based queue numbering (`#01`, `#02`) auto-resetting every morning at 00:00 PKT.
- **Doctor Chamber Isolation**: Doctor sees strictly their assigned chamber queue. Completed visits marked with `completed_at` timestamps.
- **EMR & Consultation**: Vitals validation (BP, Pulse, Temp, SpO2, Weight, Blood Sugar), symptoms, diagnosis, internal clinical notes, prescription entries.

## 2. Pharmacy POS & Retail Module
- **POS Control Deck**: F1 (Search), F2/Ctrl+Enter (Checkout & Print), F3 (Company Filter), F4 (Prescription Link), F6 (Cash/Udhaar), F7 (Discount), F8 (Cash Given), F10 (Reprint), F11 (Clear).
- **FEFO Batch Allocation**: First Expiry First Out batch sorting automatically pre-selecting oldest non-expired batch.
- **Receipt Printing**: 80mm ESC/POS thermal printing with watermarked version badges and custom logo header.

## 3. Wholesale Distribution & Multi-Godown Warehouse Module
- **Party Code Auto-Fill**: Entering party code (`001`, `PTY-108`) populates Name, City, Phone, Address, Salesman, and real-time Udhaar Credit Balance.
- **Company Medicine Filtering**: Filter items by manufacturer (`BM Pvt LTD`, `Paul Brooks`, `Schwabe`, `MEKTUM`, `BLOSSOM`) to avoid brand mix-ups.
- **Godown Stock Isolation**: Multi-warehouse stock tracking across Primary Store and secondary Godowns.

## 4. Financial & Double-Entry Accounting Module
- **Ledgers**: Patient Ledger, Supplier Ledger, Wholesale Party Ledger, CashBook.
- **Day Closing (Z-Report)**: Deterministic 12:00 drawer reconciliation matching Opening Cash + OPD Cash + POS Cash + B2B Cash - Expenses - Supplier Payments.
