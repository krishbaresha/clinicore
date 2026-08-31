# ClinicCore — Multi-Tier Backup & Disaster Recovery Specification

*Verified and Documented in Phase 06 (Backup & Disaster Recovery).*

---

## 1. Multi-Tier Backup Architecture

```
                                  ┌──────────────────────────────────────────────┐
                                  │             VPS Central Cloud                │
                                  │   - Automated daily database dumps           │
                                  │   - 30-day rolling rotation / retention      │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                  ┌──────────────────────┴───────────────────────┐
                                  │                                              │
                                  ▼                                              ▼
              ┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
              │      Encrypted .cfbak Vault File     │       │     Cloud Relay Notifications        │
              │  - AES-GCM / SHA-256 HMAC integrity  │       │  - Optional Resend / Gmail SMTP      │
              │  - Timestamped full state snapshot   │       │  - Delivery status alert (no blobs)  │
              └──────────────────┬───────────────────┘       └──────────────────────────────────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
       [Local Desktop Download]     [Optional Google Drive]
       - On-demand / scheduled      - OAuth token integration
       - Stored in User Documents   - Encrypted cloud copy
```

---

## 2. `.cfbak` Encrypted Archive Standard
- **Format**: Encrypted JSON payload containing:
  - Magic Vault Header (`"CF_ENCRYPTED_BACKUP_V5"`)
  - Clinic & Tenant Metadata (`clinic_id`, `created_at`, `app_version`, `schema_version`)
  - SHA-256 Checksum Signature for tamper detection
  - Full relational collections snapshot
- **Security**: Tampered or corrupted backups are strictly rejected with explicit validation error messages before attempting restore.

---

## 3. Disaster Recovery & Restoration Protocol
1. **Pre-Restore Rollback Checkpoint**:
   - Before executing a restore, the engine creates an in-memory & on-disk checkpoint of current active data.
2. **Cold-Start Hydration**:
   - Tested and verified: A brand-new fresh installation (0 records) can be completely restored from a `.cfbak` snapshot, restoring all Patients, Visits, Inventory batches, POS/B2B Invoices, and Supplier Ledgers.
3. **Rollback Guarantee**:
   - If an imported backup fails schema validation or signature checks halfway through, the system automatically rolls back to the pre-restore checkpoint with **Zero Data Loss**.

---

## 4. Operational Best Practices
- Email notifications are used solely for alert summaries and delivery status confirmations; large raw backup blobs are NEVER transmitted as email attachments.
- Cloud credentials and API keys are read securely from runtime system settings / environment variables without plaintext hardcoding.
