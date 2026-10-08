# AI Hub — Design Reference Pack (v1.0)

Production handoff reverse-engineered from two reference boards. **The reference images are the visual authority. This pack extracts; it does not redesign.**

## Source material

| Ref | File | What it actually contains |
|---|---|---|
| **A** | `Designing_AI_Hub_landing_page_2K_…jpg` (2752×1536) | 6 **light** explorations: Library, Map, Workshop, Academy, Ecosystem, Journey ("AI as a …") |
| **B** | `Create_AI_Hub_landing_page_2K_…jpg` (2752×1536) | Same 6 layouts with final copy ("Everything AI.", "Understand AI.", "Build with AI.", "Learn AI.", "Integrate AI Ecosystem.", "Implement AI."). **Panels 3 and 6 are DARK mode; panels 1, 2, 4, 5 are light.** |

> ⚠️ Correction to the brief: Image B is *not* a full dark board. Dark-mode evidence comes from exactly two panels (Workshop + Journey). Every dark token for components that only appear in light panels (shelf, map, course cards, ecosystem) is **inferred by applying the same light→dark rule** and is marked `[NEEDS VERIFICATION]` where it matters.

> ⚠️ The dark charcoal around the panels (`#151515`) and the caption line ("AI Hub | Connecting the Complete AI Ecosystem.") are **presentation board**, not product UI. Do not build them.

> ⚠️ Most small text in the renders is AI-image gibberish ("Organizial knowledge", "Sgors free"). Reproduce the *typographic treatment*, never the strings. Real copy comes from the content model (10_CONTENT_MAPPING.md).

## How to use this pack (coding agent)

1. Read `13_IMPLEMENTATION_GUARDRAILS.md` first. It is binding.
2. Import `03_DESIGN_TOKENS.css` unchanged. Never hard-code a colour, radius or font size in a component.
3. Build components from `06_COMPONENTS.md`; draw every sketch from `09_SKETCHES_AND_SVG.md`.
4. Treat everything in `07_LOCKED_ELEMENTS.md` as frozen.
5. Only `14_AI_GENERATION_PROMPTS.md` items need an external model (`REQUIRES USER ACTION`).
6. Verify with `15_COMPONENT_CHECKLIST.md` (pass/fail) before shipping.
7. `reference_preview.html` is a working proof of the tokens, SVG constructions and both themes — use it as the starting scaffold.

## File index

| # | File | Answers |
|---|---|---|
| 01 | README | this |
| 02 | DESIGN_SYSTEM | A. visual analysis, B. system, colour tables, light↔dark rules |
| 03 | DESIGN_TOKENS.css | C. token system (light + dark) |
| 04 | TYPOGRAPHY | type scale, font decision |
| 05 | LAYOUT | grid, geometry, measured ratios |
| 06 | COMPONENTS | D. inventory + specs |
| 07 | LOCKED_ELEMENTS | E. frozen visuals |
| 08 | ASSETS | F. classification A–F of every visual |
| 09 | SKETCHES_AND_SVG | G. SVG construction plans + code |
| 10 | CONTENT_MAPPING | category → template |
| 11 | RESPONSIVE | desktop / tablet / mobile |
| 12 | MOTION | restrained interaction spec |
| 13 | IMPLEMENTATION_GUARDRAILS | K. rules for the coding AI |
| 14 | AI_GENERATION_PROMPTS | H + I. what needs a model, exact prompts |
| 15 | COMPONENT_CHECKLIST | L. QA pass/fail, M. verification list, N. questions |

## Confidence legend

- **MEASURED** — sampled/measured from pixels (still JPEG-approximate).
- **APPROX** — measured but noisy; tune visually, keep hue family.
- **DERIVED** — not visible; computed from a visible token to fill a functional gap (hover, focus). Keep minimal.
- **[NEEDS VERIFICATION]** — cannot be determined from the images; default given.