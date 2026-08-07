---
name: PropTech Precision
colors:
  surface: '#f8fafb'
  surface-dim: '#d8dadb'
  surface-bright: '#f8fafb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f5'
  surface-container: '#eceeef'
  surface-container-high: '#e6e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#3c494a'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#eff1f2'
  outline: '#6c7a7a'
  outline-variant: '#bbc9ca'
  surface-tint: '#00696e'
  primary: '#00696e'
  on-primary: '#ffffff'
  primary-container: '#00c4cc'
  on-primary-container: '#004c4f'
  inverse-primary: '#3cdae2'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#595f66'
  on-tertiary: '#ffffff'
  tertiary-container: '#acb2b9'
  on-tertiary-container: '#3e454b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#63f7ff'
  primary-fixed-dim: '#3cdae2'
  on-primary-fixed: '#002021'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#dde3eb'
  tertiary-fixed-dim: '#c1c7cf'
  on-tertiary-fixed: '#161c22'
  on-tertiary-fixed-variant: '#41474e'
  background: '#f8fafb'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
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
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
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
  gutter: 24px
  margin: 32px
---

## Brand & Style

This design system centers on a **Minimalist Corporate** aesthetic tailored for high-stakes real estate operations. The personality is efficient, transparent, and authoritative, designed to reduce cognitive load for users managing complex property data. 

The style prioritizes high-fidelity clarity through expansive whitespace and a "content-first" hierarchy. It utilizes a sophisticated blend of flat design and subtle depth to guide the user's eye toward critical performance indicators and calls to action. The emotional response should be one of total control and professional reliability.

## Colors

The palette is anchored by a vibrant **Turquoise (#00C4CC)**, used strategically for primary actions and brand presence to signify innovation and trust. 

- **Primary:** Turquoise (#00C4CC) for high-priority buttons, active states, and focus indicators.
- **Secondary (Deep Slate):** #0F172A for primary headings and body text to ensure maximum legibility and a premium feel.
- **Surface/Neutral:** #F8FAFB is the foundational background color, providing a soft contrast against #FFFFFF cards. 
- **Border/Muted:** #E2E8F0 for structural dividers and subtle UI boundaries.
- **Semantic:** Success (Emerald), Warning (Amber), and Error (Rose) should follow a muted, pastel-tinted implementation to avoid breaking the minimalist harmony.

## Typography

The design system utilizes **Inter** exclusively to leverage its exceptional legibility and systematic feel. 

- **Headlines:** Use tighter letter-spacing for large displays to create a compact, modern look.
- **Body:** Standard weight is 400; use 500 for semi-bold emphasis within paragraphs.
- **Labels:** Small labels use a medium or semi-bold weight with increased letter-spacing to ensure readability at diminished sizes.
- **Hierarchy:** Maintain a clear vertical rhythm by strictly adhering to the defined line heights, ensuring data-heavy screens remain scannable.

## Layout & Spacing

This design system employs a **12-column fluid grid** for the main content area, paired with a fixed-width sidebar (260px). 

- **Desktop:** 32px external margins and 24px gutters. Elements should align to an 8px grid system for consistency.
- **Tablet:** Margins reduce to 24px. Sidebar collapses into a narrow icon-only rail (72px) or a hidden hamburger menu.
- **Mobile:** Single column layout with 16px horizontal margins. 
- **Consistency:** Use the `md` (24px) spacing unit for most internal card padding to create a spacious, high-end feel.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Ambient Shadows**. 

- **Level 0 (Background):** #F8FAFB (Flat).
- **Level 1 (Cards/Sidebar):** White (#FFFFFF) with a very soft, diffused shadow: `0px 4px 20px rgba(15, 23, 42, 0.05)`.
- **Level 2 (Dropdowns/Modals):** White (#FFFFFF) with a more pronounced shadow to indicate focus: `0px 10px 30px rgba(15, 23, 42, 0.1)`.
- **Borders:** Use 1px solid #E2E8F0 for UI elements that require structural definition without the weight of a shadow, such as table rows or input fields.

## Shapes

The shape language is modern and approachable. All primary containers (Cards, Modals) utilize a **12px (`rounded-lg`)** or **16px (`rounded-xl`)** corner radius to soften the professional aesthetic.

- **Buttons & Inputs:** 8px radius for a crisp, functional appearance.
- **Data Tags/Chips:** Fully pill-shaped (999px) to distinguish them from interactive buttons.
- **Selection States:** Use a 4px radius for internal selection indicators within menus.

## Components

- **Buttons:** Primary buttons use the Turquoise background with white text. Secondary buttons use a white background with #E2E8F0 borders and Slate text. Avoid heavy gradients; use solid fills.
- **Sidebar Navigation:** Use thick-stroke (2px) line icons. The active state should be indicated by a Turquoise vertical bar on the left edge and a subtle Turquoise tint (5% opacity) on the background.
- **Data Visualization:** Charts should use Turquoise as the primary data color, supported by Slate and a palette of cool-toned neutrals. Background grid lines on charts should be #F1F5F9.
- **Input Fields:** Default state uses a 1px border (#E2E8F0). Focus state shifts the border to Turquoise with a 3px soft Turquoise glow (20% opacity).
- **Widgets/Cards:** Every card must have a consistent 24px padding. Headers within cards should use the `label-md` style for metadata or `headline-md` for titles.
- **Action Tables:** Rows should have a hover state of #F8FAFB. Ensure ample cell padding (16px vertical) to maintain the minimalist breathability.