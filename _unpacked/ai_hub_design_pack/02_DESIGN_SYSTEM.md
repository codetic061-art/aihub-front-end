# 02 — Design System (Visual Analysis + Extracted System)

## A. Visual forensic summary

**Personality:** an *engineer's notebook printed on warm paper*. Calm, editorial, technical, slightly playful. The whole system is **flat ink line-art on cream**, with exactly **two spot colours** (cobalt blue, signal orange) and **black** as the third "colour". One recurring character — a small astronaut-robot — performs a different task in every section.

**How it is constructed (the 7 rules that generate every screen):**

1. **Paper + ink.** Background is a single flat warm cream. Everything else is drawn *on* it with near-black ink lines. Surfaces are not "lifted" — cards are the same paper, separated only by a 1.5px ink outline. **No shadows, no gradients, no blur, no glass.**
2. **Line weight hierarchy instead of elevation.** Hairline (1px) for connections/grids, 1.5px for UI containers, 2px for illustrations. Depth is shown by *drawing* (shelf thickness, perspective grid), never by shadow.
3. **Three-ink colour logic.** Black = structure + secondary emphasis (black buttons, black pills, footer band). Blue = primary action + "main" nodes + filled data. Orange = secondary highlight, used at ≤10% of any panel (one book, a few nodes, one course card). Never a third accent.
4. **Left-anchored editorial hero.** Huge tight-tracked headline left, 2–3 line lede, 1–2 buttons; illustration + companion occupy the right ~45%.
5. **Illustration becomes the layout.** The signature art is also the content container: the shelf *holds* the resource cards, the node map *is* the navigation, the journey path *connects* the phase cards, the flow graph *is* the integration list.
6. **Small rounded rectangles everywhere.** 8–10px radius on cards/buttons, pills for tags/labels. No sharp corners, no large blobs.
7. **Monochrome UI chrome.** Header and footer are pure type + black/blue buttons. The footer is a solid black band (or an inline ruled footer in diagram-heavy pages).

**Typography personality:** neo-grotesk (Inter-family look), semibold display with very tight negative tracking, regular body. Black on cream, high contrast, no colour in text except links/buttons.

**Layout philosophy:** single centred container with generous side gutters; 12-column underlying grid; sections stacked with large vertical gaps; content density *medium* (more like a product brochure than a dashboard).

**Decorative language:** perspective grids, dashed connector lines, small dots at path junctions, arrowheads, tiny line icons in the top-left of cards. Decoration is always *diagrammatic*, never ornamental.

**Inferred interaction cues:** "Learn more" links, carousel arrows, "You Are Here" marker, progress bars, "Next steps →" → hover/press states and subtle path/node animation are justified; nothing suggests heavy motion.

## B. Colour system

### Light mode (MEASURED unless stated)

| Token | HEX | RGB | Usage | Contrast intention |
|---|---|---|---|---|
| `--color-bg` | `#F4EEE3` APPROX | 244 238 227 | page paper | base |
| `--color-bg-secondary` | `#EAE3D7` DERIVED | 234 227 215 | hover tint, progress track | subtle (1.1:1) |
| `--color-surface` | `#F6F0E6` APPROX | 246 240 230 | card paper (≈bg) | separation by border only |
| `--color-surface-raised` | `#FBF8F2` | 251 248 242 | inner sketch window, bot body | barely lighter |
| `--color-text-primary` | `#111110` | 17 17 16 | headlines, body, ink | ~17:1 on bg (AAA) |
| `--color-text-secondary` | `#4A4741` APPROX | 74 71 65 | card descriptions, lede alt | ~8.5:1 (AAA) |
| `--color-text-tertiary` | `#7C7976` | 124 121 118 | meta, "Learn more", legend items | ~3.9:1 → use ≥13px medium only |
| `--color-border` | `#111110` | — | card/button outline | ink line |
| `--color-border-muted` | `#D8D0C3` DERIVED | — | dividers only | low |
| `--color-accent` | `#2549BB` | 37 73 187 | primary button, main nodes, blue course card | white text 7.4:1 |
| `--color-accent-2` | `#F08436` | 240 132 54 | orange book/node/card | **black** text only (≈8:1); white fails |
| `--color-ink-fill` | `#0A0A0A` | 10 10 10 | black button, black pill, "Sign up" | white text 19:1 |
| `--color-footer-bg` | `#000000` | 0 0 0 | footer band | cream text |
| `--color-grid` | `#CFC7BA` APPROX | — | workshop grid | decorative |

### Dark mode (MEASURED from B-panel 3 & 6)

| Token | HEX | Usage | Note |
|---|---|---|---|
| `--color-bg` | `#1E1E1E` | page | neutral charcoal, **not** blue-black |
| `--color-surface` | transparent | cards | dark cards are outline-only, fill = page |
| `--color-surface-raised` | `#252525` DERIVED | menus/code | |
| `--color-text-primary` | `#F2E8DE` | headline/body | **warm cream, not white** — keeps paper DNA |
| `--color-text-secondary` | `#C9C0B6` APPROX | descriptions | |
| `--color-text-tertiary` | `#8F8A84` APPROX | meta | |
| `--color-border` | `#66676D` APPROX | card outline | cool mid-grey, ~1.5px |
| `--color-line` | `#BDB7B0` APPROX | journey path, edges | |
| `--color-grid` | `#353534` | perspective grid | |
| `--color-accent` | `#2E4BAF` | primary button, blue dots | same hue, marginally duller |
| `--color-accent-2` | `#F08436` | orange highlights | unchanged |
| `--color-inverse-fill` | `#EFE2D7` | "Sign up" (panel 3) | [NEEDS VERIFICATION] panel 6 keeps it black |
| `--color-footer-bg` | `#000000` | footer | unchanged — footer is black in both themes |

### Status colours
Only **info (= blue)** and **warning (= orange)** exist. **Success / danger are NOT in the references.** Tokens are provided as placeholders but flagged; prefer ink + icon/label for status.

### Light → dark transformation rules (apply to components never shown in dark)

| Element class | Light | Dark |
|---|---|---|
| Page | cream `#F4EEE3` | charcoal `#1E1E1E` |
| Card fill | paper | transparent |
| Card outline | ink `#111` | grey `#66676D` |
| Text | ink | cream `#F2E8DE` |
| Line-art (non-bot) | ink | cream / `#BDB7B0` |
| Blue / orange fills | unchanged | unchanged (blue `#2E4BAF`) |
| Black pills | black + white text | black + cream text (still visible against #1E1E1E via contrast) |
| Outline buttons | ink outline | cream outline |
| Companion bot | cream body, black ink | **unchanged** (LOCKED) |
| Footer | black | black |
| Colour-header course card | blue/orange fill, ink sketch | unchanged fills; outline → grey [NEEDS VERIFICATION] |

**What stays identical between themes:** geometry, spacing, typography, radii, stroke widths, component structure, accent hues, footer, bot.
**What changes:** page, text, outlines, non-bot line-art colour, card fill (paper → none), inverse button.