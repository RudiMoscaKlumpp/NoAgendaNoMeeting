# Style Guide

> **Purpose:** Defines the visual style for AI Value Stream tools.
>
> **Palette:** Catppuccin Latte (light) + Catppuccin Mocha (dark), with **Sapphire** as the single primary accent.
>
> **Philosophy:** Depth comes from Catppuccin's native tonal layering (Base / Mantle / Crust / Surface 0–2). Inline UI is flat. Only genuinely floating UI (modals, dropdowns, popovers, floating action bars) gets a soft `shadow-elevated`.

---

## Palette

### Latte (light, default)

| Role | Token | Hex |
|------|-------|-----|
| Base | `ctp-base` | `#eff1f5` |
| Mantle | `mantle` | `#e6e9ef` |
| Crust | `crust` | `#dce0e8` |
| Surface 0 | `surface-0` | `#ccd0da` |
| Surface 1 | `surface-1` | `#bcc0cc` |
| Surface 2 | `surface-2` | `#acb0be` |
| Overlay 0 | `overlay-0` | `#9ca0b0` |
| Overlay 1 | `overlay-1` | `#8c8fa1` |
| Overlay 2 | `overlay-2` | `#7c7f93` |
| Text | `text` | `#4c4f69` |
| Subtext 0 | `subtext-0` | `#6c6f85` |
| Subtext 1 | `subtext-1` | `#5c5f77` |
| Sapphire (accent) | `sapphire` | `#209fb5` |
| Blue (links) | `blue` | `#1e66f5` |
| Green (success) | `green` | `#40a02b` |
| Yellow (warning) | `yellow` | `#df8e1d` |
| Red (error) | `red` | `#d20f39` |
| Rosewater | `rosewater` | `#dc8a78` |
| **On-Accent** (text on saturated fills) | `on-accent` | `#11111b` |

> The Base token is exposed as `ctp-base` (not `base`) in Tailwind to avoid collision with Tailwind's built-in `text-base` font-size utility. Use `bg-ctp-base` / `text-ctp-base`.

> `on-accent` is the text color to use on saturated accent fills (Sapphire / Green / Yellow / Red / Blue buttons or pills). Latte borrows Mocha Crust because no Latte subpalette token clears WCAG AA 4.5:1 against Latte's mid-luminance accents. This is the single deliberate exception to "Latte uses Latte tokens."

### Mocha (dark)

| Role | Token | Hex |
|------|-------|-----|
| Base | `ctp-base` | `#1e1e2e` |
| Mantle | `mantle` | `#181825` |
| Crust | `crust` | `#11111b` |
| Surface 0 | `surface-0` | `#313244` |
| Surface 1 | `surface-1` | `#45475a` |
| Surface 2 | `surface-2` | `#585b70` |
| Overlay 0 | `overlay-0` | `#6c7086` |
| Overlay 1 | `overlay-1` | `#7f849c` |
| Overlay 2 | `overlay-2` | `#9399b2` |
| Text | `text` | `#cdd6f4` |
| Subtext 0 | `subtext-0` | `#a6adc8` |
| Subtext 1 | `subtext-1` | `#bac2de` |
| Sapphire (accent) | `sapphire` | `#74c7ec` |
| Blue (links) | `blue` | `#89b4fa` |
| Green (success) | `green` | `#a6e3a1` |
| Yellow (warning) | `yellow` | `#f9e2af` |
| Red (error) | `red` | `#f38ba8` |
| Rosewater | `rosewater` | `#f5e0dc` |
| **On-Accent** (text on saturated fills) | `on-accent` | `#1e1e2e` |

---

## Contrast table (WCAG AA)

Text on saturated accent fills uses `on-accent`:

| Pairing | Latte ratio | Mocha ratio |
|---|---|---|
| Sapphire bg + `on-accent` text | 5.97:1 AA | 8.69:1 AAA |
| Green bg + `on-accent` text | 5.61:1 AA | 11.00:1 AAA |
| Yellow bg + `on-accent` text | 7.17:1 AAA | 12.91:1 AAA |
| Red bg + `destructive-foreground` text | 4.81:1 AA | 7.08:1 AAA |

---

## Theme toggle

Dark mode is toggled by adding the `.mocha` class to `<html>`. Tailwind `darkMode` is configured as `['class', '.mocha']`, so `dark:*` variants resolve against the Mocha class. Use these when a single CSS variable cannot express a theme-specific decision.

---

## Text hierarchy

Text color roles follow Catppuccin conventions:

| Role | Token | Usage |
|------|-------|-------|
| Body, headlines | `text` | Primary copy, page titles, section headers, module headings |
| Sub-headlines, labels | `subtext-0` or `subtext-1` | Secondary labels, form field labels, helper text near inputs |
| Subtle / muted | `overlay-1` | Timestamps, deemphasized captions, placeholder-ish copy |
| Text on accent | `on-accent` | Text sitting on a Sapphire button or Sapphire-filled surface |

Links use `blue`. No underline at rest, underline on hover.

---

## Surface layering (how depth works)

Depth is tonal, not shadowed. Stack surface tokens to create visual hierarchy:

- **Base**: page background. The "floor."
- **Mantle**: lower than Base. Used for subtle recessed strips, footers, adjacent sections.
- **Crust**: deepest tier. Reserve for the most recessed elements.
- **Surface 0 / 1 / 2**: progressively raised interactive surfaces. Cards, panels, inputs.
- **Overlay 0 / 1 / 2**: borders, dividers, muted text.

A typical card: `Surface 0` background on a `Base` page, with a `Surface 2` border. No shadow.

For inline UI, **never** add a `box-shadow` to simulate lift. Shift to the next surface tier instead.

---

## Typography

**Font family:** Plus Jakarta Sans (loaded via Google Fonts). Weights: 300, 400, 500, 600, 700, 800.

Used for all three roles: headline, body, and label.

| Element | Style |
|---------|-------|
| Page title | `text-4xl md:text-5xl font-black text-text tracking-tight` |
| Section headers | `text-2xl font-black text-text uppercase tracking-tight` |
| Module headings | `text-xl font-bold text-text` |
| Body text | `text-lg text-subtext-0 font-medium` |
| Labels | `text-xs font-black text-text uppercase tracking-widest` |
| Helper / muted text | `text-sm font-bold text-overlay-1` or `text-subtext-0` |
| Button text | `font-black uppercase tracking-widest` |

---

## Components

### Card

- Background: `surface-0`
- Border: `border-2 border-surface-2`
- Corners: `rounded-xl`
- Shadow: **none** (flat)
- Padding: `p-6`

No horizontal dividers inside cards. Separate content with spacing (`space-y-4`) or background shifts.

### Button

- **Primary:** `bg-sapphire text-on-accent border-2 border-sapphire rounded-xl font-black uppercase tracking-widest`. Flat. Active state: `translate-y-0.5`.
- **Neutral:** Use shadcn `variant="outline"` or `variant="secondary"`. Do not build a custom class. Outline reads `Surface 0` background with `Surface 2` border and `text` foreground.
- **Disabled:** `opacity-60`, `cursor-not-allowed`, border falls back to `surface-2`.
- All buttons use 2px borders.

### Input

- Background: `bg-surface-0`
- Resting border: `border-2 border-surface-2`
- Focus: `focus:border-sapphire focus:ring-2 focus:ring-sapphire/30` (Sapphire focus ring)
- Radius: `rounded-lg`
- Label: above field, `text-xs font-black text-text uppercase tracking-widest mb-2`

### Link

- Color: `text-blue`
- Rest: no underline
- Hover: `hover:underline underline-offset-4`

---

## Shadow policy

**Inline UI is flat.** Cards, buttons, inputs, panels, nav bars, and step indicators carry no `box-shadow`.

**Floating UI only** (modals, dropdowns, popovers, floating action bars) uses the `shadow-elevated` utility:

- **Latte:** `Text` color at 6% opacity, 32px blur, 16px Y offset
- **Mocha:** `Crust` color at 40% opacity, 32px blur, 16px Y offset

Implemented as a theme-aware Tailwind utility that reads CSS variables, so a single class works across both themes.

---

## Tailwind token reference

Semantic color names exposed to Tailwind:

    ctp-base, mantle, crust,
    surface-0, surface-1, surface-2,
    overlay-0, overlay-1, overlay-2,
    text, subtext-0, subtext-1,
    sapphire, blue, green, yellow, red, rosewater,
    on-accent

shadcn primitives are mapped as:
`primary = sapphire`, `secondary = surface-1`, `muted = surface-0`, `accent = surface-1`, `destructive = red`, `border = surface-2`, `ring = sapphire`, `background = ctp-base`, `foreground = text`.

Tokens should live in `tailwind.config.ts` and a global CSS file (`index.css` or equivalent) as CSS custom properties, with `:root` carrying Latte values and `.mocha` carrying Mocha overrides.

---

_Reference: [Catppuccin palette](https://catppuccin.com/palette/). When uncertain, defer to Catppuccin's published hex values._
