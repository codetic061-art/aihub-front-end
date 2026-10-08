# 15 — Component & Visual QA Checklist

Mark each ☐ PASS / FAIL. Compare against reference crops side-by-side at 1200px and in both themes.

## Typography
☐ Display is Inter-Display-like semibold, tracking ≈ −0.035em, LH 1.0, ≤2 lines
☐ Only weights 400/500/600 used
☐ Lede is primary ink colour, ~42ch max
☐ Sentence case everywhere; headlines end with a period
☐ Card descriptions secondary colour, line-clamped (title 2, desc 4)
## Spacing & Layout
☐ Container ≤1120–1200, left text edge aligned across header/hero/sections/footer
☐ Hero 7/5 split; illustration right
☐ Section gaps ≈96px desktop
☐ 4px spacing grid (no 13/17/19px gaps)
☐ Resource cards stand on the shelf plank; 5 per row desktop
## Colours & Background
☐ Page bg flat cream ≈#F4EEE3 (light) / #1E1E1E (dark); zero texture/gradient
☐ Only blue #2549BB / orange #F08436 accents; orange ≤10% area
☐ No white text on orange
☐ Footer pure black in both themes
## Cards
☐ ResourceCard folder silhouette: high tab left 70%, 45° bevel, 12px drop
☐ Card outlines 1.5px ink (light) / #66676D (dark); radius 10
☐ No shadows on any card; hover = lift 3px only
☐ CourseCard media solid blue/orange, ink sketch, black "Course" badge
## Buttons
☐ 4 variants only (primary, ink, outline, inverse); radius 8; 44/36px heights
☐ Visible focus ring; active nudge 1px
## Bot
☐ Silhouette, head 0.36H, black visor ~72% head width, two oval eyes + smile, ear disc
☐ Cream body + black ink in BOTH themes; no accent colours on bot
☐ Pose matches section (07 L1)
## Illustrations & Sketches
☐ All A/B/C items are code, not rasters
☐ Strokes uniform 1/1.5/2, round caps, no roughness filters
☐ Map: 2 blue hubs, mixed plain labels + black pills, dashed edges, legend bottom-left
☐ Flow: 3 tiers, Bézier edges w/ arrowheads, orange exit curve
☐ Journey: continuous path, blue junction dots, card 3 lifted
☐ Workshop: perspective floor + wall grid, monitor with real code text
## Borders & Radius
☐ Radii only from {4, 6, 8, 10, pill}
☐ Graph edges 1px; UI 1.5px; illustrations 2px
## Light / Dark
☐ Geometry identical between themes (diff screenshots: only colours differ)
☐ Dark text warm cream #F2E8DE, not #FFFFFF
☐ Dark cards transparent fill with grey outline
☐ Non-bot line-art inverts to cream; blue/orange fills unchanged
## Responsive
☐ Tablet/mobile follow 11_RESPONSIVE table; companion always visible in hero
☐ Carousels scroll-snap; tap targets ≥44px
☐ Flow graph re-orients vertical on mobile; journey becomes vertical path

---
## M. [NEEDS VERIFICATION] register
| # | Item | Default used | How to verify |
|---|---|---|---|
| V1 | Exact font family | Inter Display 600 / Inter | user confirms or supplies font files |
| V2 | Monospace face | JetBrains Mono | — |
| V3 | All HEX values (JPEG noise ±3%) | sampled medians | compare against source design file if any |
| V4 | Exact px dimensions | ×1.455 from 825px panel | ratios binding; fine-tune visually |
| V5 | Logo glyph | generic knot mark placeholder | user supplies SVG |
| V6 | Dark "Sign up" colour (cream in Build, black in Implement) | cream inverse | user choice |
| V7 | Dark tokens for Library/Map/Academy/Ecosystem components | derived by 02 rules | review dark build |
| V8 | Success/danger colours | not in refs → avoid | — |
| V9 | Icon set | Lucide 1.5px | matches line style |
| V10 | Whether sections alternate light/dark on one page or theme is global | global toggle | Q4 |
| V11 | Footer variant per page (band vs inline) | band on landing | — |
| V12 | Any animation | none visible in stills; 12_MOTION is inferred | — |
| V13 | Bot poses are raster in refs (AI-rendered) | regenerate + vectorise | 14 |