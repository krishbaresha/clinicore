# CliniCore VPS Deployment — Session Save Context
**Last Updated:** 2026-08-24 21:39 PKT

## Current VPS State
- IP: 77.37.45.233 (Hostinger KVM 1, Ubuntu 24.04)
- Stack: Nginx + PHP 8.3-FPM + MySQL 8.0
- /var/www/clinicore EXISTS but NO git repo initialized

## Immediate Next Steps (Resume Here)
1. SSH: root@77.37.45.233 (pass: Keru@11998844)
2. Clone: git clone https://github.com/krishbaresha/clinicore.git /var/www/clinicore
3. Fix all: bash /var/www/clinicore/scripts/vps_fix_all.sh
4. Verify: curl -s http://localhost/api/health
5. Upload frontend: scp -r frontend/dist/* root@77.37.45.233:/var/www/clinicore/frontend/dist/

## Last Commit
ed7fd9e — refactor: full app rename ClinicFlow -> CliniCore

## App Rename Status
- ClinicFlow -> CliniCore: COMPLETE (all 30 files updated)
- GitHub repo: https://github.com/krishbaresha/clinicore.git
- DB name: clinicore
- Namespaces: CliniCore\Controllers\...
