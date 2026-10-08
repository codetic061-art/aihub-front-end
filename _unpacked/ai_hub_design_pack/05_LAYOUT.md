# 05 — Layout & Geometry

## Scale model
The reference panels are ~825px wide (at 2K export). Treat a panel as a **1200px design canvas**; multiply reference px by **k ≈ 1.455**. Recommended implementation values below are rounded to the 4px grid. Exact px are `[NEEDS VERIFICATION]`; **ratios are binding**.

## Global
| Property | Value | Rule |
|---|---|---|
| Design canvas | 1200px | build desktop at 1200–1440 |
| Container | `max-width: 1120px` (1056–1200 acceptable) | centred |
| Gutters | `clamp(20px, 6vw, 72px)` | ref: content starts at 6.3% of panel width |
| Grid | 12 cols, 24px gap | |
| Header height | 72px | logo, nav, actions on one baseline |
| Hero top padding | 64px | header → headline |
| Section gap | 96px (64 on tablet, 48 mobile) | |

## Header
`[Logo] —— nav (centre-left, starts ~33% of width) —— [Search 240×40 | Log in] [Sign up]`. Nav items gap 28–32px. Actions gap 12px. Header has **no bottom border, no background change** — it sits on paper.

## Hero
- Grid `minmax(0, 7fr) minmax(0, 5fr)`; text column ~55%, illustration ~45%.
- Stack: headline → 16px → lede (max 42ch) → 28px → buttons (gap 12px).
- Illustration column bottom-aligned with the shelf/next structure; companion overlaps section boundaries (it can stand *on* the next component — e.g. the shelf).
- Hero height ≈ 0.33 × canvas width (~400px) before next section.

## Section layouts (one per reference panel)

| Section (B copy) | Archetype | Grid |
|---|---|---|
| 1 "Everything AI." | Library shelf | hero; shelf plank full-container width; 5 ResourceCards `repeat(5, 1fr)` gap 24 standing on plank; second shelf row: TopicList (cols 1–6) + divider + 2 cards (cols 8–12) |
| 2 "Understand AI." | Knowledge map | text cols 1–5; map canvas cols 5–12 overlapping vertically with text; legend bottom-left (≈ 140×160) |
| 3 "Build with AI." | Workshop | text cols 1–6; desk scene full-width under text (perspective grid floor ~ 40% of hero height); monitor top-right; 2 FeatureCards `1fr 1fr` gap 16 |
| 4 "Learn AI." | Academy | hero; row: 3 CourseCards + Dashboard → `1fr 1fr 1fr 1.1fr`, card gap 16, dashboard gap 36 |
| 5 "Integrate AI Ecosystem." | Flow graph | text cols 1–5 top; graph full-width below/right: 3 columns of pills (source → hubs → targets), targets column right-aligned |
| 6 "Implement AI." | Journey | text cols 1–6; 4 PhaseCards `repeat(4, 1fr)` gap 64 (arrows live in gaps); card 3 lifted −24px; path weaves around |

## Measured component geometry (ref → implementation)
| Component | Ref px | Impl px |
|---|---|---|
| Button | 31h, r≈6, px≈14 | 44h, r 8, px 20 |
| Small button (dashboard/feature) | 26h | 36h |
| Search input | 170×30 | 240×40 |
| Resource card | 127×160, gap 19 | 185×232 (fluid), gap 24 |
| Folder tab drop | ~9px at 70% width | 12px at 70% |
| Course card | 164×170, media 82 | ~240×248, media 120 |
| Dashboard card | 183×170 | ~265×248 |
| Phase card | 148×150 | ~215×218 |
| Large map node | ⌀24 | ⌀36 |
| Companion (hero) | ~200 tall | 180–300 (`--companion-h-hero`) |
| Footer band | ~75 tall | 112px, 3 link columns |

## Alignment rules
- Everything left-aligns to the container edge, including section titles, legend and footer logo.
- Card rows align their top edges to a shared structure line (the shelf plank, the course-row top).
- Text baseline in buttons is optically centred; icons in pills sit centred on cap height.
- Illustrations may break the container on the right (map edges, flow lines, orange accent line exits panel edge) but **never on the left**.

## Footer
Two variants (both in refs):
- **FooterBand** (Library, Academy, Workshop, Journey): full-bleed black, 112px, logo left, 3 link columns starting ~25% width (col gap 64), social icons right.
- **FooterInline** (Map, Ecosystem): on paper, 1px ink top rule inside container, same internal layout, ink colours.
Default: FooterBand on the landing page. `[NEEDS VERIFICATION]` which variant per route.