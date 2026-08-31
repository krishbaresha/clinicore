# PHASE 01 — VPS Connectivity & API Contract

## Goal
Make Desktop/Web reliably reach the VPS backend.

## Verify
- DNS
- HTTPS/TLS
- API health endpoint
- authentication
- CORS
- environment variables
- production build variables
- VPS process/service
- reverse proxy
- firewall/network
- database connectivity
- API error handling

## Architecture rule
Clients connect to a secure VPS backend API.
Clients NEVER connect directly to the database.

## Acceptance
- Healthy API is detected correctly.
- Internet without API reachability is shown as API unavailable, not falsely as generic "offline".
- Auth failures are distinguished from network failures.
- Desktop production build uses the intended VPS API endpoint.
