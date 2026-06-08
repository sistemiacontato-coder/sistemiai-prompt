---
name: Prompt Machine
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-block:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 24px
  gutter: 16px
  sidebar-width: 280px
  compact-gap: 8px
  stack-gap: 16px
---

## Brand & Style
The design system is engineered for precision, high-density data management, and technical mastery. It targets prompt engineers, LLM developers, and AI researchers who require a workspace that feels like a high-performance IDE. 

The aesthetic is **Technical Modernism**—a blend of "Dark Mode" utilitarianism with subtle Glassmorphic depth. It prioritizes clarity and speed, using high-contrast typography and a cold, focused atmosphere. The UI should evoke a sense of "The Machine"—powerful, responsive, and systematic—avoiding unnecessary decorative elements in favor of functional density.

## Colors
The palette is rooted in a deep "Midnight Slate" spectrum to reduce eye strain during long engineering sessions. 

- **Primary (Electric Blue):** Used for primary actions, focus states, and active selection.
- **Success (Emerald):** Reserved for successful execution, API status "OK", and refined model outputs.
- **Background Tiers:** The base layer uses `#0f172a`. Elevated surfaces (sidebars, cards) use `#1e293b`.
- **Borders:** Low-contrast slate `#334155` provides structural definition without visual clutter.
- **Accents:** Use a specialized "Terminal Amber" (#f59e0b) sparingly for warnings or pending execution states.

## Typography
Typography is treated as a functional tool. **Inter** provides high legibility for UI labels and documentation, while **JetBrains Mono** is utilized for any data output, prompt variables, and code syntax to emphasize the technical nature of the application.

- **Scale:** Maintain a tight, compact scale to allow for high information density.
- **Hierarchy:** Use bold weights for headers but prioritize the "Label-Caps" style for section headers to evoke a terminal-like feel.
- **Code Blocks:** Should always use JetBrains Mono with 1.5 line-height for maximum readability of complex logic.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. Navigation and configuration panels (sidebars) are fixed-width, while the central workspace (the prompt editor) is fluid to maximize the line-length for code.

- **Grid:** Use a 12-column grid for dashboard views, but switch to a 2-column or 3-column "Split Pane" layout for the core engineering experience.
- **Rhythm:** A 4px baseline grid ensures tight vertical alignment.
- **Breakpoints:**
  - **Desktop (1280px+):** Full 3-pane view (Nav, Editor, Output).
  - **Tablet (768px - 1279px):** Editor and Output only; Navigation moves to a collapsed rail.
  - **Mobile (<767px):** Single pane stacked view with bottom-sheet configuration.

## Elevation & Depth
This design system utilizes **Tonal Layering** and **Glassmorphism** rather than traditional heavy shadows.

- **Surface Levels:** 
  - Level 0 (Base): `#0f172a`.
  - Level 1 (Panels): `#1e293b` with a 1px solid border of `#334155`.
  - Level 2 (Modals/Popovers): `#1e293b` with a 20px background blur and 40% opacity on the fill to create a glass effect over the editor.
- **Shadows:** Use a single, razor-sharp shadow for Level 2 elements: `0 4px 20px rgba(0, 0, 0, 0.5)`.
- **Glow:** Active indicators (e.g., a "Running" light) should have a soft 4px outer glow of their respective accent color.

## Shapes
To maintain a professional and "engineered" look, the design system uses a **Soft (0.25rem)** roundedness for standard components. 

- **Input Fields/Buttons:** 4px radius.
- **Code Blocks/Cards:** 8px radius (`rounded-lg`).
- **Status Pills:** Fully rounded (pill-shaped) to distinguish them from functional buttons.

## Components
- **Buttons:** Primary buttons are solid `#3b82f6` with white text. Secondary buttons are ghost-style with a `#334155` border. Use a "monospaced" label style for technical actions like "RUN_PROMPT".
- **Technical Input Fields:** Use a dark background (`#0f172a`) inside `#1e293b` panels. Focus states must show a 1px `#3b82f6` border and a subtle blue outer glow.
- **Code Preview Blocks:** Syntactically highlighted blocks using a custom palette. Include a "Copy" utility button in the top-right corner that only appears on hover.
- **Status Indicators:** Small circular dots. Green (Pulse) for active, Red for error, Blue for idle. 
- **Sidebars:** Integrated vertical tabs for "History," "Variables," and "Model Settings." Use active-state vertical bars on the left edge of the tab to indicate selection.
- **Chips/Tokens:** Use for prompt variables (e.g., `{{user_name}}`). These should have a slight blue tint background and a border to make them look "inserted" into the text.