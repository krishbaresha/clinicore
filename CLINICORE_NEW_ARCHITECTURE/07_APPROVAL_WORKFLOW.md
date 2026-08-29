# 07 — Doctor Approval & Governance Workflow

> **System:** CliniCore / ClinicFlow Master Architecture  

---

## 1. Governance Thresholds
The following sensitive actions require formal Doctor Approval:
- POS / B2B Invoice Discount > 15%
- Stock Adjustment Variance > 10 units
- Historical Record Editing / Reversal
- Backdated Expense Entry
- Debt Write-Off / Credit Limit Override

## 2. Real-Time Approval Lifecycle
```text
Staff Initiates Sensitive Action
              ↓
   VPS creates ApprovalRequest
              ↓
  Push Notification to Doctor Mobile
              ↓
   Doctor Reviews & Biometric Approve
              ↓
    VPS Commits Transaction
              ↓
   Desktop App Receives ACK
```
