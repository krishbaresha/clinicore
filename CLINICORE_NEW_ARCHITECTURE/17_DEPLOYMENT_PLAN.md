# 17 — VPS Deployment & Infrastructure Plan

> **System:** CliniCore / ClinicFlow Master Architecture  

---

## Target Infrastructure
- **Server**: Hostinger VPS (Ubuntu 24.04 LTS, 4 vCPU, 8GB RAM)
- **Web Server / Reverse Proxy**: Nginx 1.24 with TLS 1.3
- **Database**: PostgreSQL 16 with WAL archiving
- **Process Manager**: Systemd system daemons for Node.js API & background sync workers
