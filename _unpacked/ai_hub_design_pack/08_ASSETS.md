# 08 — Asset Classification

A = HTML/CSS · B = SVG · C = CSS + SVG · D = real raster · E = AI-generated required · F = optional decorative

| # | Element | Class | Notes |
|---|---|---|---|
| 1 | Page background | A | flat colour token |
| 2 | Header, nav, buttons, search | A | |
| 3 | Logo glyph | B | `[NEEDS VERIFICATION]` — user to supply mark |
| 4 | UI icons (search, clock, chevrons, arrow, book, pin) | B | Lucide set, 1.5px stroke, round caps (matches ref line style) `[NEEDS VERIFICATION]` |
| 5 | Social icons | B | Lucide/simple-icons glyph in CSS circle (C) |
| 6 | **Companion — front standing pose** | B | constructible in code (09 §1) — reference SVG provided |
| 7 | **Companion — 5 action poses** (pointing, compass, typing at desk, seated w/ laptop, flying) | **E → vectorised to B** | perspective/foreshortening & hand poses too costly to hand-path; generate with locked prompt then vectorise (14 §P1–P5). REQUIRES USER ACTION |
| 8 | Shelf plank + dividers | C | CSS borders or SVG rects (09 §3) |
| 9 | Books cluster | B | rects + rotations (09 §4) |
| 10 | Book stacks (Academy, blue/orange/cream) | B | stacked rounded rects with page lines (09 §4b) |
| 11 | Folder ResourceCard outline | C | HTML card + generated SVG path (09 §2) |
| 12 | Card category icons | B | 16px line icons |
| 13 | CourseCard media sketches | B | inline SVG line-art (09 §5) |
| 14 | Badge, pills, MetaRow | A | |
| 15 | Progress bars | A | |
| 16 | Knowledge map nodes/edges/labels | B (+A labels) | data-driven SVG; labels as HTML overlay or SVG `<text>` (09 §6) |
| 17 | Compass held by bot | part of #7 | standalone compass icon = B |
| 18 | Map legend | A + B symbols | |
| 19 | Ecosystem flow edges | B | computed Béziers (09 §7) |
| 20 | Flow pills | A | |
| 21 | Journey path + dots + arrows | B | single SVG overlay behind cards (09 §8) |
| 22 | Phase mini-diagrams | B | 09 §8b |
| 23 | Perspective grid (floor/wall) | B | programmatic lines (09 §9) |
| 24 | Monitor + code window | C | SVG frame + HTML `<pre>` |
| 25 | Desk objects (cup+pencils, screwdriver, mouse, notepad, notebook, laptop) | B | simple line-art, ~6–20 primitives each (09 §10). If budget-limited: **E** (14 §P6) |
| 26 | FeatureCard corner sketches (file sheet, orbit lines) | B / F | 09 §11 |
| 27 | Orange exit curve (Ecosystem) | F | single path |
| 28 | Presentation board bg / caption | — | NOT PART OF PRODUCT |

**Real raster images (D): none required.** No photography exists in the system.
**AI generation (E): only the 5 companion action poses, and optionally the desk-object set.**