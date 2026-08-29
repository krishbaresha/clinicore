# 11 — Tauri Desktop Application Specification

> **System:** CliniCore / ClinicFlow Master Architecture  

---

## 1. Technology Stack
- **Framework**: Tauri 2.0 (Rust Core + OS Native WebView2)
- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Local Storage**: Native SQLite (`clinicore_local.db`) via Rust IPC bindings.

## 2. Desktop System Capabilities
- Direct hardware ESC/POS thermal printer communication via USB / Serial.
- Single-instance application lock preventing duplicate launches.
- Tray icon with background sync indicator.
