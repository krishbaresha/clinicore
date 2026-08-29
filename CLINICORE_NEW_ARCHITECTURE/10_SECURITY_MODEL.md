# 10 — System Security & Secret Management

> **System:** CliniCore / ClinicFlow Master Architecture  

---

## 1. Password Hashing & Key Derivation
- Passwords hashed using Argon2id / RFC 6234 Salted SHA-256 digests.
- No plain-text passwords stored in database, local SQLite, or backup archives.

## 2. Transport & Secret Security
- All client-server communication enforced via TLS 1.3 HTTPS.
- Zero secrets, JWT signing keys, or database passwords committed to Git.
