---
name: ClinicFlow Clinical Intelligence
colors:
  surface: '#f7faf8'
  surface-dim: '#d7dbd9'
  surface-bright: '#f7faf8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f4f3'
  surface-container: '#ebefed'
  surface-container-high: '#e5e9e7'
  surface-container-highest: '#e0e3e1'
  on-surface: '#181c1c'
  on-surface-variant: '#3e4947'
  inverse-surface: '#2d3130'
  inverse-on-surface: '#eef1f0'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#006b5e'
  on-secondary: '#ffffff'
  secondary-container: '#96f3e1'
  on-secondary-container: '#007164'
  tertiary: '#4f5254'
  on-tertiary: '#ffffff'
  tertiary-container: '#676a6c'
  on-tertiary-container: '#e9ebed'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#96f3e1'
  secondary-fixed-dim: '#7ad7c6'
  on-secondary-fixed: '#00201b'
  on-secondary-fixed-variant: '#005046'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f7faf8'
  on-background: '#181c1c'
  surface-variant: '#e0e3e1'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  sidebar-width: 260px
  container-max: 1440px
---

## Brand & Style

The design system is engineered to evoke professional reliability and clinical calm. It targets healthcare providers and administrative staff who require high-density information management without the cognitive load typically associated with legacy medical software.

The aesthetic direction merges **Modern Corporate** structure with **Glassmorphism** accents. This creates a clear hierarchy where the most critical patient data resides on "elevated" translucent layers, floating above a stable, grounded background. The interface prioritizes clarity, utilizing generous whitespace to separate diagnostic data from navigation, ensuring the environment feels spacious and organized.

## Colors

The palette is anchored by a deep teal to establish authority and trust. A soft mint/cyan serves as the primary accent for interactive states and highlight indicators, providing a fresh, hygienic contrast.

- **Primary (#0F766E):** Used for primary actions, active navigation states, and brand headers.
- **Secondary (#99F6E4):** Used for subtle backgrounds in chips, light-weight buttons, and "success" indicators.
- **Background (#F8FAFC):** An off-white base that prevents eye strain during long clinical shifts.
- **Surface:** Pure white (#FFFFFF) is reserved for cards and modals to maximize the glassmorphic backdrop-blur effect.

## Typography

This design system utilizes a dual-font strategy. **Hanken Grotesk** is used for headlines to provide a sharp, contemporary, and precise feel. **Inter** is the workhorse for all body copy, data tables, and labels due to its exceptional legibility in high-density medical contexts.

Large display type is slightly tracked-in for a more compact, modern appearance, while labels use subtle tracking-out and uppercase styling to differentiate them clearly from clinical notes.

## Layout & Spacing

The dashboard layout utilizes a **Bento-grid** philosophy. Content is organized into modular rectangular containers of varying sizes that fit together seamlessly.

- **Grid System:** 12-column grid for desktop, 4-column for mobile.
- **Sidebar:** A persistent 260px left sidebar with a semi-transparent blur effect.
- **Dashboard Modules:** Modules should use a `gap` of 24px (`spacing.md`).
- **Mobile Adaptation:** On mobile devices, the Bento-grid collapses into a single vertical stack, and the sidebar transforms into a bottom navigation bar or a hamburger-triggered drawer.

## Elevation & Depth

Depth is achieved through **Glassmorphism** rather than traditional heavy shadows.

- **The Glass Layer:** Cards use a white background at 70% opacity with a `backdrop-filter: blur(12px)`.
- **Shadows:** Use a single, ultra-soft shadow: `0 8px 32px 0 rgba(15, 118, 110, 0.08)`. This adds a subtle teal-tinted depth that feels organic to the brand.
- **Borders:** A 1px solid border at 20% opacity (white) provides a "rim light" effect on the edge of glass cards to ensure they don't bleed into the background.

## Shapes

The design system uses a very soft, approachable corner radius. 

- **Cards & Modules:** 1rem (16px) `rounded-2xl`.
- **Buttons & Inputs:** 0.75rem (12px) `rounded-xl`.
- **Search Bars:** Fully rounded (pill-shaped) to distinguish them from data entry fields.
- **Icons:** Use a medium stroke-weight (1.5px or 2px) with rounded caps and joins to match the UI's softness.

## Components

### Buttons
- **Primary:** Solid Teal (#0F766E) with white text. High-contrast, no shadow.
- **Secondary:** Soft Mint (#99F6E4) background with Teal text.
- **Ghost:** Transparent background with Teal border and text. Use for less critical actions like "Cancel" or "Go Back."

### Cards (The Bento Unit)
The fundamental building block. Every card must have the `backdrop-blur` and `rounded-2xl` properties. Headers within cards should be `headline-md` or `body-lg` (bold).

### Navigation (Sidebar)
The left sidebar uses a darker variant of the teal or a high-opacity glass effect. Active links are indicated by a vertical mint-colored pill on the left edge and a subtle background highlight.

### Data Inputs
Input fields should have a light grey background (#F1F5F9) that turns white on focus. Labels sit 8px above the input in `label-md` style.

### Specialized Clinical Components
- **Patient Status Chips:** Small, rounded pills using semantic colors (e.g., Amber for "Pending Lab Results", Soft Red for "Urgent Follow-up").
- **Mini-Charts:** Sparkline charts should use the primary teal color with a soft mint gradient fill below the line.