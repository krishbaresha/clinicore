# Clinicore 🩺

ClinicFlow is a premium, modern, and highly responsive Clinic Management System designed for doctors and clinic receptionists. It streamlines patient registration, visit logs, smart prescription writing, inventory tracking, sales logging, and billing workflows.

---

## 🚀 Key Features

*   **Responsive Dashboard**: Real-time stats (patient counts, daily visits, sales totals, low stock alerts) with charts and clean mobile-friendly layouts.
*   **Patient Profiles & Timeline**: Comprehensive patient records, visit timelines, and a medical documents vault with in-app WebRTC camera capture.
*   **Smart Prescription Builder**:
    *   Inventory autocomplete search (suggests medicines with stock levels).
    *   Quick dosage presets (`1-0-1`, `1-1-1`, etc.).
    *   Auto-calculated total quantities with custom overrides.
    *   Dynamic service & procedures billing builder.
*   **Printable POS Receipts**: Optimized 80mm thermal receipt print format with isolated printing window layout.
*   **Medical Store & Inventory**: Tracking stock levels, sales logs, and auto-deductions when items are prescribed.
*   **Mock Database Layer**: A full ESM local database proxy preloaded with mock data. All operations (CRUD, searching, billing, prescriptions) persist to browser `localStorage` for an instant zero-config interactive demo.

---

## 🛠️ Technology Stack

*   **Frontend**: React (Vite), Tailwind CSS (v4), React Router DOM.
*   **Backend (Planned)**: PHP (Standard PDO for MySQL).
*   **Database**: MySQL.
*   **Deployment**: Vercel/Netlify (Frontend SPA), Hostinger (Planned for PHP/MySQL).

---

## 📂 Project Structure

```text
├── backend/            # PHP controllers, models, and routes (next phase)
├── database/           # MySQL schemas and PHP database seed script
├── designs/            # UI design mockups and screens
├── frontend/           # Vite + React SPA project folder
│   ├── src/
│   │   ├── api/        # Mock ESM API endpoints (localStorage)
│   │   ├── layouts/    # Responsive sidebar layout
│   │   ├── pages/      # 11 Interactive pages
│   └── vercel.json     # SPA routing configuration for Vercel
└── README.md           # Project guide (this file)
```

---

## 💻 Local Setup

### 1. Clone the project and install dependencies
```bash
cd frontend
npm install
```

### 2. Start the development server
```bash
npm run dev
```

---

## 🌐 Deployment to Vercel (Temporary Demo)

This frontend app is fully functional with mock data via `localStorage`.

1. Go to the [Vercel Dashboard](https://vercel.com/new).
2. Select your imported private GitHub repository.
3. Configure the following project options:
   *   **Root Directory**: Select `frontend`.
   *   **Framework Preset**: `Vite` (Auto-detected).
   *   **Build Command**: `npm run build`.
   *   **Output Directory**: `dist`.
4. Click **Deploy**!
