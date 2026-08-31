# ClinicCore AI Engineering Context

This file is the compact source of truth for future AI agents.

## System
ClinicCore — clinic / pharmacy / POS management platform.

## Clients
- Desktop
- Web
- Future external websites/integrations

## Central infrastructure
- VPS backend
- VPS central database

## Core architecture target
Desktop/Web -> Secure VPS API -> Central VPS DB

Desktop additionally has durable local persistence for offline work.

## Engineering philosophy
Inspect -> Plan -> Implement -> Test -> Verify -> Commit -> Document.

## Never
- guess architecture
- lose data
- expose DB credentials
- silently discard sync failures
- reinstall manually for normal application updates
