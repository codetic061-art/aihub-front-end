# 04 — Typography

## Family identification
- **Observed:** neo-grotesk sans; double-storey `a`, straight-tail `y`, flat terminals, tall x-height, very tight display tracking, rectangular `I` with no serifs ("AI" reads as two verticals + A). Matches **Inter / Inter Display** most closely (alternatives with the same skeleton: Geist, SF Pro Display). `[NEEDS VERIFICATION]`
- **Decision:** `Inter Display` 600 for display/headings (opsz cuts give the tight, crisp large size), `Inter` 400/500/600 for UI. Self-host variable woff2, `font-display: swap`.
- **Monospace** (code window, Workshop): narrow technical mono, light-on-dark → `JetBrains Mono` 400 (fallback IBM Plex Mono). `[NEEDS VERIFICATION]`
- **Never** substitute Poppins, Montserrat, DM Sans, Space Grotesk or any rounded/geometric display face — they change the personality.

## Measured ratios (from 825px reference panel)
| Element | Height in ref | Ratio to body |
|---|---|---|
| Display cap-height | ~38px | ×4.2 |
| Section title ("Course cards") | ~19px font | ×1.6 |
| Lede/body | ~12.5px font | ×1.0 |
| Card description | ~10px | ×0.8 |
| "Learn more" / meta | ~8.5px | ×0.7 |

## Type scale (1200px canvas; tokens in 03)
| Name | Token | Size | Weight | LH | Tracking | Usage |
|---|---|---|---|---|---|---|
| Display | `--fs-display` | 44→72px | 600 | 1.0 | −0.035em | hero headline, max 2 lines ("Everything AI. / One intelligent hub.") |
| H2 | `--fs-h2` | 24→28px | 600 | 1.2 | −0.015em | "Course cards", "Research Topics", "User dashboard" |
| H3 | `--fs-h3` | 18→22px | 500 | 1.25 | −0.01em | phase titles (Learn/Understand…), feature card titles |
| Card title | `--fs-card-title` | 17px | 600 | 1.3 | 0 | resource/course card titles, 2 lines max |
| Lede | `--fs-lede` | 16→18px | 400 | 1.45 | 0 | hero sub-copy, colour = **primary** (not grey) |
| Body | `--fs-body` | 16px | 400 | 1.5 | 0 | lists, paragraphs |
| Nav | `--fs-nav` | 15px | 500 | 1 | 0 | header links |
| Button | `--fs-button` | 15px | 500 | 1 | 0 | all buttons, sentence case |
| Small | `--fs-small` | 14px | 400 | 1.45 | 0 | card descriptions (secondary colour, 3–4 lines) |
| Label | `--fs-label` | 13px | 500 | 1.2 | 0 | graph node labels, legend title(600) |
| Caption | `--fs-caption` | 12px | 400/500 | 1.4 | 0.005em | meta row, "Learn more", badge, legend items |
| Mono | `--fs-mono` | 12px | 400 | 1.6 | 0 | code window |
| Footer link | `--fs-small` | 14px | 400 | 1.7 | 0 | footer columns |

## Rules
- **Casing:** Sentence case everywhere. Headlines end with a full stop in the final copy ("Learn AI."). No ALL-CAPS labels except none — even badges are "Course" sentence case.
- **Colour:** text is ink or cream only; blue only inside blue buttons; no coloured headlines.
- **Hero lede max-width:** ~42ch. Headline max-width ~14ch per line.
- **Weights in use:** 400, 500, 600 only. No 700/800, no light weights in product UI (the thin caption font belongs to the presentation board).
- **Logo wordmark:** "AI Hub", 600, ~18px, tracking −0.01em, preceded by a 18px glyph.
- `font-feature-settings: "cv11", "ss03"` are optional Inter alternates — do NOT enable unless verified against the reference `a`/`l`.