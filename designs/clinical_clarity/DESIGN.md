---
name: Clinical Clarity
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#3b665f'
  on-secondary: '#ffffff'
  secondary-container: '#bdece2'
  on-secondary-container: '#416c65'
  tertiary: '#4d5255'
  on-tertiary: '#ffffff'
  tertiary-container: '#656a6d'
  on-tertiary-container: '#e6eaee'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#bdece2'
  secondary-fixed-dim: '#a2d0c6'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#224e47'
  tertiary-fixed: '#dfe3e7'
  tertiary-fixed-dim: '#c3c7cb'
  on-tertiary-fixed: '#171c1f'
  on-tertiary-fixed-variant: '#43474b'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
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
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
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
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 32px
  gutter: 24px
  bento-gap: 20px
  section-margin: 48px
---

## Brand & Style

This design system is built for a high-fidelity medical SaaS environment that prioritizes practitioner focus and patient trust. The aesthetic merges **Modern Corporate** reliability with **Glassmorphism** to create a sense of depth and airiness, moving away from the "heavy" feeling of traditional medical software.

The emotional response should be one of calm, sterile precision, and effortless organization. We achieve this through:
- **Depth through Transparency:** Using semi-transparent layers to maintain context of the underlying workspace.
- **Bento Logic:** Organizing complex medical data into discrete, high-contrast "pods" that minimize cognitive load.
- **Intentional Whitespace:** Generous breathing room (32px base) to prevent the visual clutter common in data-heavy healthcare applications.

## Colors

The palette is rooted in a "Deep Teal" primary that conveys authority and clinical hygiene. 

- **Primary (#0F766E):** Used for primary actions, active navigation states, and critical brand touchpoints.
- **Secondary/Accent (#CCFBF1):** A soft mint used for subtle highlights, success states, and as a tint for glass surfaces to add "freshness."
- **Background (#F8FAFC):** An off-white slate that reduces eye strain compared to pure white.
- **Feedback:** Use Amber for non-blocking warnings (e.g., pending lab results) and Soft Red for critical errors or urgent patient alerts.

## Typography

The system utilizes a dual-font strategy: **Hanken Grotesk** for headlines to provide a sharp, contemporary "designer" feel, and **Inter** for all functional and body text to ensure maximum legibility for patient records and data entry.

- **Scale:** Maintain a clear hierarchy. Large displays are used for dashboard welcomes, while labels remain tight and systematic.
- **Weight:** Use Semibold (600) for interactive elements and Regular (400) for long-form patient notes.
- **Contrast:** Headlines should always be in the darkest neutral or primary teal to anchor the page.

## Layout & Spacing

The layout follows a **Bento-Grid** philosophy, where information is encapsulated in "tiles" of varying sizes that snap to a fluid 12-column grid.

- **The Grid:** Desktop uses a 12-column grid with 32px outer margins and 24px gutters.
- **Bento Containers:** All cards should have a standard 20px gap between them to maintain the "tiled" look without crowding.
- **Mobile Reflow:** On mobile, the 12-column grid collapses to a 1-column stack. Container padding reduces to 16px.
- **Padding:** Internal card padding should be a minimum of 24px (6 units) to allow data to "breathe."

## Elevation & Depth

This design system uses a sophisticated **Glassmorphic** layering technique instead of traditional heavy shadows.

- **Base Layer:** Background (#F8FAFC).
- **Surface Layer (Cards):** White (#FFFFFF) at 70% to 85% opacity.
- **Backdrop Blur:** 12px to 20px blur on all surface layers to create the frosted glass effect.
- **Borders:** 1px solid borders at 10% opacity of the primary teal or pure white to define edges.
- **Shadows:** Use only one "Ambient" shadow for floating elements (modals/dropdowns): `0 20px 40px rgba(15, 118, 110, 0.08)`. Avoid black shadows; always tint them with the primary teal.

## Shapes

The shape language is consistently soft and approachable.

- **Standard Radius:** 16px (1rem) for all main dashboard cards and containers.
- **Button Radius:** 12px for a more refined, clickable feel.
- **Inner Elements:** For nested elements (like inner progress bars or search inputs), use a slightly smaller radius (8px) to maintain visual nesting logic.
- **Pill Shapes:** Reserved exclusively for status indicators (tags/chips) to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Solid Deep Teal (#0F766E) with white text. 12px border-radius.
- **Secondary:** Soft Mint (#CCFBF1) background with Teal text. No border.
- **Ghost:** Transparent background with 1px Teal border.

### Bento Cards
The core component. Must include `backdrop-filter: blur(12px)`, a semi-transparent white background, and a 16px border-radius. Header sections within cards should be separated by a subtle 1px divider.

### Input Fields
Backgrounds should be slightly more opaque than the cards they sit on to indicate "writability." Use a 2px focus ring in the accent color (#CCFBF1).

### Lists & Tables
Rows should not have borders. Use alternating "zebra" stripes with 2% opacity teal, or highlight on hover with a 50% transparent mint background.

### Status Chips
Small, pill-shaped tags. Use high-contrast pairings: e.g., "Urgent" is Red text on 10% Red background. "Stable" is Teal text on 10% Teal background.

### Specialized Components
- **Patient Timeline:** A vertical line component using the primary teal with soft-shadowed nodes.
- **Metric Cards:** Large display typography for vital signs with a subtle trend sparkline in the background.