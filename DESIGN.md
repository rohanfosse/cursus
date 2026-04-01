# Design System: Cursus

## 1. Visual Theme & Atmosphere

Cursus is an education-first communication platform designed for engineering school cohorts. The design balances two audiences: students who expect a modern, Discord-like chat experience, and teachers who need a professional tool they can trust with grading and scheduling. The result is a system built on muted indigo-blue accents against neutral dark surfaces, with warm amber/sepia as the light-mode alternative — approachable but never casual.

The app uses Lato as its primary typeface across most themes, switching to Inter for the "Cursus" theme and the landing page — both geometric sans-serifs that read well at the small sizes (11-15px) dominant in a messaging interface. JetBrains Mono appears on the landing page for version badges and statistics, adding a technical credibility signal for the engineering audience. Display headlines on the landing use Inter at weight 800 with aggressive negative letter-spacing (-0.03em), inspired by Linear and Stripe — dense, compressed headings that feel engineered rather than designed.

The depth system relies on multi-layer shadows tinted to match the theme palette (indigo-tinted in light mode, pure black in dark). Glassmorphism is used sparingly on the landing page nav and demo windows (`backdrop-filter: blur(16-20px)`) but never in the app itself, where clarity beats decoration. The border philosophy is whisper-thin: `rgba(255,255,255,0.1)` in dark mode, `rgba(0,0,0,0.08)` in light — structure without noise.

**Key Characteristics:**
- 5 themes: Default (dark neutral), Light (warm sepia), Night (near-black), Marine (deep blue), Cursus (landing-style indigo)
- Lato for app, Inter for landing + Cursus theme, JetBrains Mono for tech labels
- Blue accent (#4A90D9 dark, #c27c2c light, #3b82f6 cursus) as the single interactive color
- Emerald (#059669) reserved for success states and the landing CTA
- Grade system A-D with dedicated color scale (green/blue/orange/red)
- Whisper borders: semi-transparent, never solid dark colors
- 4-layer shadow system per theme (sm/md/lg/card)
- Rail + Sidebar + Main three-panel layout at 72px + 240px + fluid

## 2. Color Palette & Roles

### App — Default Theme (Dark)

| Token | Value | Role |
|-------|-------|------|
| `--bg-rail` | `#161819` | Navigation rail (leftmost panel) |
| `--bg-sidebar` | `#1c1d1f` | Sidebar (channel list) |
| `--bg-main` | `#232425` | Main content area |
| `--bg-input` | `#1a1b1d` | Input fields background |
| `--bg-elevated` | `#2c2d2f` | Cards, elevated surfaces |
| `--bg-hover` | `rgba(255,255,255,.05)` | Hover state overlay |
| `--bg-active` | `rgba(74,144,217,.16)` | Active/selected state |
| `--bg-modal` | `#1e1f21` | Modal background |
| `--text-primary` | `#E8E9EA` | Headings, body text |
| `--text-secondary` | `#8B8D91` | Descriptions, metadata |
| `--text-muted` | `#616467` | Placeholders, hints |
| `--accent` | `#4A90D9` | Primary interactive color (links, buttons, active states) |
| `--accent-hover` | `#5da3f0` | Accent hover |
| `--accent-dark` | `#2e6dae` | Accent pressed |
| `--accent-light` | `#7EB8FF` | Accent on dark surfaces |
| `--color-danger` | `#E74C3C` | Destructive actions, errors |
| `--color-warning` | `#E8891A` | Deadlines, caution |
| `--color-success` | `#2ECC71` | Completion, positive |
| `--color-info` | `#3B82F6` | Informational |
| `--border` | `rgba(255,255,255,.1)` | Default border |
| `--border-input` | `rgba(255,255,255,.16)` | Input borders (slightly stronger) |

### App — Light Theme (Warm Sepia)

| Token | Value | Role |
|-------|-------|------|
| `--bg-rail` | `#f0ebe3` | Rail background |
| `--bg-sidebar` | `#f5f0e8` | Sidebar |
| `--bg-main` | `#faf8f4` | Main content |
| `--bg-elevated` | `#faf8f4` | Cards |
| `--text-primary` | `#2c2418` | Primary text (warm brown-black) |
| `--text-secondary` | `#7a6e5e` | Secondary text |
| `--accent` | `#c27c2c` | Amber accent |
| `--border` | `rgba(100,70,30,.1)` | Warm-tinted borders |

### App — Grade Colors

| Token | Value | Grade |
|-------|-------|-------|
| `--color-grade-a` | `#2ECC71` | Excellent (green) |
| `--color-grade-b` | `#4A90D9` | Good (blue) |
| `--color-grade-c` | `#F39C12` | Satisfactory (orange) |
| `--color-grade-d` | `#E74C3C` | Insufficient (red) |
| `--color-grade-na` | `#95A5A6` | Not applicable (gray) |

### App — Devoir Type Colors

| Token | Value | Type |
|-------|-------|------|
| `--color-livrable` | `#4A90D9` | Deliverable |
| `--color-soutenance` | `#F39C12` | Oral presentation |
| `--color-cctl` | `#9B87F5` | Written exam |
| `--color-etude-de-cas` | `#2ECC71` | Case study |
| `--color-memoire` | `#E74C3C` | Thesis/memoir |
| `--color-autre` | `#95A5A6` | Other |

### Landing Page — Light Mode

| Token | Value | Role |
|-------|-------|------|
| `--primary` | `#6366F1` | Indigo brand color |
| `--accent` | `#059669` | Emerald CTA |
| `--bg` | `#F5F3FF` | Page background (light indigo tint) |
| `--bg-card` | `#FFFFFF` | Card surfaces |
| `--text` | `#1E1B4B` | Dark indigo-navy headings |
| `--text-2` | `#64748B` | Secondary text (slate) |
| `--text-3` | `#94A3B8` | Muted text |
| `--border` | `#E0E7FF` | Light indigo borders |
| `--color-chat` | `#6366F1` | Feature: chat |
| `--color-devoirs` | `#059669` | Feature: assignments |
| `--color-docs` | `#F59E0B` | Feature: documents |
| `--color-dashboard` | `#8B5CF6` | Feature: dashboard |

### Landing Page — Dark Mode

| Token | Value | Role |
|-------|-------|------|
| `--primary` | `#818CF8` | Lighter indigo |
| `--accent` | `#34D399` | Lighter emerald |
| `--bg` | `#0F0D1A` | Deep navy canvas |
| `--bg-card` | `#1A1733` | Dark card surfaces |
| `--text` | `#F1F0FF` | Off-white text |
| `--border` | `rgba(129,140,248,.15)` | Indigo-tinted borders |

## 3. Typography Rules

### Font Families

| Context | Font | Fallbacks |
|---------|------|-----------|
| App (default/dark/night/marine) | Lato | -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif |
| App (cursus theme) + Landing | Inter | -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif |
| Landing tech labels | JetBrains Mono | ui-monospace, SF Mono, monospace |

### App Typography Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-2xs` | 10px | Micro labels, overlines |
| `--text-xs` | 11px | Badges, timestamps |
| `--text-sm` | 12px | Captions, metadata |
| `--text-base` | 14px | Default body text |
| `--text-md` | 15px | Emphasized body |
| `--text-lg` | 17px | Section titles |
| `--text-xl` | 20px | Page titles |
| `--text-2xl` | 24px | Dashboard headings |

Base font size: 14.5px. Message line-height: 1.6.

### Landing Typography Hierarchy

| Role | Size | Weight | Letter Spacing | Notes |
|------|------|--------|----------------|-------|
| Hero H1 | clamp(3rem, 6vw, 5rem) | 800 | -0.03em | Tight line-height 1.05 |
| Feature H2 | clamp(1.75rem, 3vw, 2.5rem) | 700 | -0.02em | |
| Body Large | 18px | 400 | normal | Feature descriptions |
| Body | 16px | 600 | normal | Buttons |
| Small | 14px | 500 | normal | Nav links, footer |
| Caption | 13px | 500-600 | normal | Badges, proof items |
| Micro | 12px | 600 | 0.5px | Uppercase labels, bento |
| Mono | 12px | 500 | -0.3px | JetBrains Mono: version, stats |

## 4. Component Stylings

### Buttons

| Variant | Background | Text | Border | Radius | Padding | Hover | Active |
|---------|------------|------|--------|--------|---------|-------|--------|
| Primary | `var(--accent)` | `#fff` | none | `var(--radius)` 10px | 9px 18px | brightness(1.1) + shadow | brightness(.92) |
| Ghost | transparent | `var(--text-secondary)` | 1px solid `var(--border)` | `var(--radius)` | 8px 16px | bg-hover + text-primary | bg-active |
| Danger | `var(--color-danger)` | `#fff` | none | `var(--radius)` | 8px 16px | brightness(1.1) | — |
| Icon | transparent | `var(--text-secondary)` | none | `var(--radius)` | 5px (30x30) | bg-hover + text-primary | bg-active |
| Landing Primary | `var(--accent)` emerald | `#fff` | none | 14px | 14px 28px | translateY(-2px) + shadow-md | — |
| Landing Secondary | transparent | `var(--text)` | 2px solid border | 14px | 14px 28px | bg-glass | — |

All buttons: `font-weight: 600`, disabled state: `opacity: .4; cursor: not-allowed`.

### Cards

| Variant | Background | Border | Radius | Shadow | Hover |
|---------|------------|--------|--------|--------|-------|
| Dashboard | `var(--bg-elevated)` | 1px solid border | 14px | — | border-color accent-tinted |
| Project | `var(--bg-elevated)` | 1px solid border | 12px | shadow-card + inset | translateY(-3px) + shadow-card-hover |
| Bento (landing) | `var(--bg-card)` | 1px solid border | 16px | — | translateY(-3px) + 4-layer shadow |
| Download | `var(--bg-card)` | 1px solid border | 20px | — | translateY(-4px) + shadow-md |

### Inputs

All form inputs: `background: var(--bg-hover)`, `border: 1px solid var(--border-input)`, `border-radius: var(--radius-sm)` (6px), `padding: 9px 12px`, `font-size: 14px`. Focus: `border-color: var(--accent)` + `box-shadow: 0 0 0 2px rgba(accent, .15)`.

### Modals

Overlay: `rgba(0,0,0,.7)` + `backdrop-filter: blur(3px)`. Box: `var(--bg-modal)`, `border-radius: var(--radius-lg)` (14px), `max-height: 88vh`. Sticky header/footer with `var(--bg-modal)` background. Sizes: small 400px, default 560px, large 740px.

### Badges

| Variant | Background | Text | Radius | Size |
|---------|------------|------|--------|------|
| Deadline OK | `rgba(46,204,113,.16)` | `#6FCF97` | 20px pill | 11px bold |
| Deadline Soon | `rgba(232,137,26,.16)` | `#F2C94C` | 20px pill | 11px bold |
| Deadline Over | `rgba(231,76,60,.16)` | `#EB5757` | 20px pill | 11px bold |
| Tag | `rgba(accent,.2)` | `var(--accent)` | 4px | 11px bold |
| Type (livrable) | `rgba(74,144,217,.15)` | `var(--accent)` | 4px | 10px 800 uppercase |
| Grade A | `var(--color-grade-a)` | `#fff` | 6px | — |

### Toast

Fixed top-right (16px offset), `border-radius: 12px`, `backdrop-filter: blur(12px)`. Success: green-tinted. Error: red-tinted. Info: blue-tinted. Spring entry animation with 4s auto-dismiss (8s for errors).

## 5. Layout Principles

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Tight gaps, icon margins |
| `--space-sm` | 8px | Small gaps, list spacing |
| `--space-md` | 12px | Card padding, section gaps |
| `--space-lg` | 16px | Standard padding |
| `--space-xl` | 24px | Section padding, large gaps |

### App Layout

| Panel | Width | Token |
|-------|-------|-------|
| Navigation Rail | 72px | `--rail-width` |
| Sidebar | 240px | `--sidebar-width` |
| Channel Header | 52px height | `--header-height` |
| Right Panel (devoirs) | 340px | `--panel-width` |
| Titlebar (Electron) | 32px | `--titlebar-height` |

Three-panel layout: Rail (fixed) + Sidebar (resizable) + Main (fluid). Main content scrolls independently.

### Landing Layout

Max content width: 1100px. Bento grid: `repeat(3, 1fr)` with 12px gap. Feature rows: `1fr 1fr` with 64px gap. Hero padding: 120px top, 80px bottom.

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 4px | Type badges, minimal rounding |
| `--radius-sm` | 6px | Inputs, small elements |
| `--radius` | 10px | Default (buttons, icons, cards) |
| `--radius-lg` | 14px | Modals, large cards |
| `--radius-xl` | 20px | Pills, deadline badges |
| `--radius-full` | 50% | Avatars, circular buttons |

## 6. Depth & Elevation

| Level | Shadow Token | Light Value | Dark Value | Use |
|-------|-------------|-------------|------------|-----|
| Flat | none | — | — | Page background, rails |
| Subtle | `--shadow-sm` | `0 1px 2px rgba(80,50,10,.06)` | `0 1px 2px rgba(0,0,0,.2)` | Hover states |
| Card | `--shadow-card` | 2-layer: `.08` + `.06` | 2-layer: `.3` + `.2` | Cards at rest |
| Elevated | `--shadow-md` | `0 4px 12px rgba(80,50,10,.1)` | `0 4px 12px rgba(0,0,0,.25)` | Dropdowns, popovers |
| Card Hover | `--shadow-card-hover` | 2-layer: `.12` + `.08` | 2-layer: `.4` + `.3` | Card hover + translateY(-3px) |
| Modal | `--shadow-lg` | `0 8px 30px rgba(80,50,10,.14)` | `0 8px 30px rgba(0,0,0,.35)` | Modals, overlays |
| Landing Demo | 4-layer stack | indigo-tinted (99,102,241) | black-tinted | Demo windows |

**Shadow Philosophy:** Shadows are theme-colored — warm sepia tint in light mode, pure darkness in dark/night, and indigo tint on the landing page. The landing uses 4-layer stacking (1px + 4px + 12px + 24px) for realistic depth; the app uses simpler 2-layer stacks for performance.

## 7. Do's and Don'ts

### Do
- Use CSS custom properties for ALL colors — never hardcode hex in components
- Use `var(--accent)` as the single interactive color per theme
- Apply whisper-thin borders: `var(--border)` at 0.08-0.1 opacity
- Use grade colors (`--color-grade-a` through `--color-grade-d`) consistently for A-D notation
- Apply letter-spacing -0.03em on display headings (landing) and -0.02em on H2
- Use `translateY(-2px to -4px)` hover lifts on interactive cards
- Use `backdrop-filter: blur()` only on landing nav and glassmorphic elements
- Apply `prefers-reduced-motion` to disable all animations
- Keep modals at `max-height: 88vh` with sticky header/footer
- Use JetBrains Mono exclusively for version numbers, stats, and code labels

### Don't
- Don't use pure black (`#000`) or pure white (`#fff`) as text colors — use the themed tokens
- Don't mix Lato and Inter in the same context (Lato = app, Inter = landing/cursus theme)
- Don't use `box-shadow` without checking the theme variant — shadows are theme-colored
- Don't use border-radius above 20px except for pills and avatars
- Don't introduce new colors outside the established accent/semantic system
- Don't use inline `style="background: #hex"` for colors that change between themes
- Don't add new z-index values without checking the scale (100-9000)
- Don't use `rgba(0,0,0,*)` borders in light mode — use warm-tinted `rgba(100,70,30,*)`
- Don't hardcode font-size in px without checking the `--text-*` scale

## 8. Responsive Behavior

### App Breakpoints

| Width | Changes |
|-------|---------|
| <= 768px | Sidebar collapses, icon buttons enlarge to 40px touch targets, modal padding reduces |
| <= 480px | Modal padding 14px 16px, simplified layouts |

### Landing Breakpoints

| Width | Changes |
|-------|---------|
| <= 1024px | Feature row gap 64px -> 32px |
| <= 768px | Nav center hidden, burger shown, features stack 1-col, demo sidebar hidden |
| <= 640px | Bento 3-col -> 2-col, CTA buttons full-width on cards |
| <= 520px | Bento proof stacks vertical, hero buttons stack, download grid 1-col, H1 shrinks |
| <= 420px | Bento 2-col -> 1-col |
| <= 375px | Hero padding shrinks, H1 1.75rem |

### Touch Targets
- App icon buttons: 30px default, 40px on mobile
- App buttons: 9px 18px padding minimum
- Landing buttons: 14px 28px (generous)
- Modal close: 30px default, 40px on mobile

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 9. Agent Prompt Guide

### Quick Color Reference (Default Dark Theme)
- Page background: `#232425`
- Sidebar: `#1c1d1f`
- Rail: `#161819`
- Card: `#2c2d2f`
- Text primary: `#E8E9EA`
- Text secondary: `#8B8D91`
- Text muted: `#616467`
- Accent: `#4A90D9`
- Danger: `#E74C3C`
- Success: `#2ECC71`
- Warning: `#E8891A`
- Border: `rgba(255,255,255,.1)`

### Quick Color Reference (Landing Light)
- Page: `#F5F3FF`
- Card: `#FFFFFF`
- Text: `#1E1B4B`
- Primary: `#6366F1`
- CTA: `#059669`
- Border: `#E0E7FF`

### Example Component Prompts
- "Create a card: `var(--bg-elevated)` background, `1px solid var(--border)`, `var(--radius-lg)` (14px) radius, `var(--shadow-card)` shadow. On hover: border tints toward accent, translateY(-3px), shadow-card-hover."
- "Create a primary button: `var(--accent)` background, white text, `var(--radius)` (10px), 9px 18px padding, font-weight 600. Hover: brightness(1.1) + shadow. Disabled: opacity .4."
- "Create a deadline badge: `var(--deadline-soon-bg)` background, `var(--deadline-soon-text)` text, `var(--radius-xl)` (20px pill), 11px bold, 2px 8px padding, 1px border matching rgba(.3)."
- "Create a modal: `var(--bg-modal)`, `var(--radius-lg)`, max-height 88vh, shadow-lg. Sticky header/footer with border. Overlay at rgba(0,0,0,.7) + blur(3px)."
- "Create a bento card (landing): `var(--bg-card)`, 1px solid `var(--border)`, 16px radius, 16px padding. Hover: translateY(-3px), 4-layer indigo-tinted shadow, border-color shifts to `var(--primary-light)`."

### Iteration Guide
1. Always use `var(--token)` syntax — never raw hex in component CSS
2. Check which theme context you're in: app uses `--accent` (blue), landing uses `--primary` (indigo) + `--accent` (emerald)
3. The app has 5 themes — all component colors must come from CSS variables
4. Shadows are theme-colored — warm sepia in light, pure black in dark, indigo on landing
5. Grade colors are A=green, B=blue, C=orange, D=red — never deviate
6. Border radius: inputs 6px, buttons/icons 10px, cards 14px, pills 20px, avatars 50%
7. Spacing: 4/8/12/16/24 — the 8px grid with 4px micro-adjustments
8. Font: Lato in app, Inter on landing/cursus-theme, JetBrains Mono for tech labels only
9. Always provide `prefers-reduced-motion` alternative for animations
10. Z-index: modals 1000-1100, overlays 2000, toast 10000 — never exceed or gap
