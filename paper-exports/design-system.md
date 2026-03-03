# SoGoJet Design System v4 — Sunrise + Seafoam

> Extracted from Paper (16 artboards, 1346 nodes). This is the constitution.

## Color Palette

| Name | Hex | Role |
|------|-----|------|
| Dusk Sand | `#F5ECD7` | Page background |
| Sunrise Butter | `#F7E8A0` | — |
| Pale Horizon | `#FDEFC3` | Highlight surface, primary button text |
| Seafoam Mist | `#C8DDD4` | Status tint surface |
| Sage Drift | `#A8C4B8` | Selected surface, secondary text, active tab |
| Warm Dusk | `#E8C9A0` | Warm mid-tone surface, inactive progress bars |
| Deep Dusk | `#2C1F1A` | Primary text, primary button bg |
| Terracotta | `#D4734A` | Errors only, add-on prices |
| Off-White | `#FFFDF8` | Card surface |
| Body Text | `#5C4033` | Body text color |
| Muted Text | `#8A7F72` | Section label / muted text |
| Spec Text | `#5C4F4A` | Motion spec body, metadata text |
| Border Tint | `#C9A99A` | Section labels, borders, secondary info |
| Confirm Green | `#7BAF8E` | Success buttons, price badges, live indicators |
| Darker Green | `#4A8B7A` | Live price text, confirm button text |

## Typography

| Role | Font | Weight | Size | Line Height | Letter Spacing | Transform | Color |
|------|------|--------|------|-------------|----------------|-----------|-------|
| Display (hero) | Syne | 800 | 52px | 52px | -0.02em | uppercase | `#2C1F1A` |
| Page Title | Syne | 800 | 34px | 40px | -0.01em | uppercase | `#2C1F1A` |
| Card Title (feed) | Syne | 800 | 60px | 58px | -0.01em | uppercase | `#FFFFFF` |
| Headline | Syne | 800 | 22-28px | 24-32px | -0.01em | uppercase | `#2C1F1A` |
| Subheadline | Syne | 700-800 | 14-20px | 18-24px | -0.01em | — | `#2C1F1A` |
| Body | Inter | 400 | 15-16px | 24px | — | — | `#5C4033` |
| Secondary | Inter | 500 | 13px | 18px | — | — | `#A8C4B8` |
| Section Label | Inter | 600 | 10px | 12px | 0.08-0.12em | uppercase | `#A8C4B8` or `#C9A99A` |
| Small Label | Inter | 600 | 9-11px | 12-14px | 0.05-0.08em | uppercase | `#C9A99A` |
| Price (large) | Inter | 800 | 48px | 48px | — | — | `#2C1F1A` |
| Price (medium) | Inter/Syne | 700-800 | 22-28px | 28-34px | -0.02em | — | `#2C1F1A` |
| Button Text | Inter | 600 | 15-17px | 18-22px | 0.02em | — | `#FDEFC3` |
| Logo | Syne | 800 | 15-34px | — | — | uppercase | `#2C1F1A` + `#A8C4B8` |
| Boarding Pass | Syne | 800 | 36px | 36px | -0.01em | uppercase | `#2C1F1A` |
| Order Header | Bebas Neue | 400 | 22px | 28px | 0.02em | uppercase | `#2C1F1A` |

## Button System

| Type | Height | Radius | Background | Border | Text Color | Text Size/Weight |
|------|--------|--------|------------|--------|------------|-----------------|
| Primary Action | 52px | 14px | `#2C1F1A` | — | `#FDEFC3` | 16px/600 |
| Primary Large | 56px | 16px | `#2C1F1A` | — | `#FDEFC3` | 17px/600 |
| Confirm/Success | 48px | 14px | transparent | 1.5px `#7BAF8E` | `#7BAF8E` | 15px/600 |
| AI Action | 44px | 10px | `#7BAF8E` | — | `#FFFFFF` | 14px/600 |
| Secondary | 44px | 12px | transparent | 1.5px `#C9A99A` | `#2C1F1A` | 14px/500 |
| Error/Destructive | 44px | 12px | `#D4734A` | — | `#FFFFFF` | 14px/600 |
| Pill (filter) | 32px | 16px | `#2C1F1A` (active) / `#F2CEBC40` (inactive) | 1px `#C9A99A40` | `#FDEFC3` / `#5C4033` | 12px/600 |
| Cabin Class | 36px | 18px | `#A8C4B8` (active) / transparent | 1px `#C9A99A` | `#2C1F1A` | 13px/600 |

## Surface Hierarchy

| Surface | Background | Border | Radius |
|---------|------------|--------|--------|
| Page BG | `#F5ECD7` | — | — |
| Card | `#FFFDF8` | `1px solid #C9A99A20` | 14-16px |
| Highlight | `#FDEFC3` | `1px solid #E8C9A040` | 12-16px |
| Status Tint | `#C8DDD430` | `1px solid #C8DDD440` | 12-14px |
| Selected | `#A8C4B830` | `2px solid #A8C4B8` | 12-14px |
| Warm Mid | `#E8C9A0` | `1px solid #C9A99A40` | 12px |
| Flight Deal | `#F2CEBC33` | `1px solid #C9A99A40` | 16px |
| AI Planner | `#7BAF8E15` gradient | `1px solid #7BAF8E40` | 16px |
| Settings Row | `#FFFDF8` | — (gap separation) | grouped in 14px |
| Action Button Glass | `blur(16px) #FFFFFF14` | `1px solid #FFFFFF1F` | 26px (circle) |
| Price Pill | `blur(16px) #2C1F1AE6` | `1px solid #FFFFFF1A` | 24px |
| Feed Card | dark overlay on photo | — | — |

## Form Inputs

| Element | Height | Radius | Background | Border | Text |
|---------|--------|--------|------------|--------|------|
| Text Input | 44px | 10px | `#FFFDF8` | `1px solid #C9A99A60` | 15px Inter |
| Input Label | — | — | — | — | 11px Inter 500 uppercase `#C9A99A` tracking 0.05em |
| Accordion Row | auto | 12px | `#FFFDF8` | `1px solid #C9A99A40` | 14px Inter |
| Toggle (on) | 26×44px | 13px | `#A8C4B8` | — | white 22px knob |
| Toggle (off) | 26×44px | 13px | `#F5ECD7` | — | `#C9A99A` 22px knob |
| Counter Button | 32×32px | 8px | `#E8C9A060` (minus) / `#A8C4B830` (plus) | — | 18px |

## Motion Spec

| Animation | Property | Value |
|-----------|----------|-------|
| Card Swipe | Curve | `spring(1, 80, 12)` — mass 1, stiffness 80, damping 12 |
| Card Swipe | Velocity threshold | 800px/s |
| Card Swipe | Decay | 0.997 |
| Card Swipe | Trigger | drag 120px to trigger, overshoot on release |
| Price Pill Entrance | Duration | 400ms |
| Price Pill Entrance | Easing | ease-out |
| Price Pill Entrance | Transform | fade + translateY(8px) |
| Seat Selection | Duration | 200ms |
| Seat Selection | Easing | spring(0.7, 100, 8) |
| Seat Selection | Transform | scale(1.15) + fill |
| Save Heart | Duration | 300ms |
| Save Heart | Easing | cubic-bezier(.2, 1, .3, 1) |
| Save Heart | Transform | scale(1.3) → bounce |
| Page Transition | Duration | 350ms |
| Page Transition | Shared element | destination photo |
| Page Transition | Easing | ease-in-out |

## Fonts

- **Syne** — Display, headlines, logo, airport codes (ExtraBold 800, Bold 700)
- **Inter** — Body, UI labels, form inputs, buttons (Regular 400, Medium 500, SemiBold 600, Bold 700, ExtraBold 800)
- **Playfair Display** — Editorial quotes on destination detail (Italic 400)
- **Bebas Neue** — Boarding pass / confirmation headers (Regular 400)

## Spacing Rhythm

| Token | Value | Usage |
|-------|-------|-------|
| xs | 8px | Inline gaps, tag spacing |
| sm | 12-16px | Component internal padding |
| md | 20-24px | Section padding, page margins |
| lg | 32-40px | Section gaps, major spacing |
| xl | 56-60px | Top padding (below status bar) |

## Booking Flow Context

- Same destination photo persists across all 6 booking steps
- Photo position: absolute, bottom of header, height 60px
- Photo opacity: 15% on booking steps, 8% on confirmation
- Object-position: center 40%, no blur (raw at low opacity)
- Step progress bar: 6 segments, 3px tall, completed = `#A8C4B8`, pending = `#E8C9A0`

## Bottom Navigation

- 3 tabs: Explore (globe), Saved (heart), Settings (gear)
- Active: filled icon + `#A8C4B8` text (10px/600)
- Inactive: stroke icon + `#C9A99A` text (10px/400)
- Background: gradient fade from page color
- Padding: 40px left/right, 32px bottom, 12px top

## Seat Map

- Columns: A B C [aisle] D E F
- Row numbers: 9px Inter, `#B5ADA3`, right-aligned 20px wide
- Available: `#F0EBE3` bg, `1px #D4CCC0` border
- Selected: `#7BAF8E` bg, white checkmark
- Occupied: `#D4CCC0` bg, no border
- Extra legroom: `#E3EDE7` bg, `1px #C5D6CB` border
- Exit row: green `#7BAF8E` lines + "EXIT" label
- Seat size: 26×26px, 4px top radius, 6px bottom radius, 2px gap
- Fuselage: rounded top with 1.5px `#D4CCC0` border, bottom rounded 20px
