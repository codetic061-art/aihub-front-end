# 06 — Component Inventory & Specs

All values reference tokens. States not visible in the refs are **DERIVED** and minimal.

### 1. SiteHeader
- **Purpose:** global nav. **Layout:** flex, height `--header-h`, container width. Transparent on paper; becomes `--color-bg` + 1px `--color-border-muted` bottom rule only once page is scrolled (DERIVED, optional).
- **Variants:** `search` (Search input + Sign up — Library) · `auth` (Log in + Sign up — all others).
- **Mobile:** nav collapses to a 32px outline icon-button (menu) right of logo; Sign up stays visible.

### 2. Logo
Glyph 18–20px (line knot mark) + "AI Hub" 600 18px, gap 8px. Ink in light, cream in dark/footer. `[NEEDS VERIFICATION]` glyph — see Questions.

### 3. NavLink
15px/500, `--color-text-primary`. Hover: underline 1px offset 4px (DERIVED). Active: 600 weight + underline. No pills, no background.

### 4. SearchInput
240×40, radius `--radius-md`, 1.5px border `--color-border` at ~60% (ref looks lighter than cards: use `color-mix(in srgb, var(--color-border) 55%, transparent)`), fill transparent, 16px magnifier icon left (12px inset), placeholder tertiary. Focus: border → full ink + `--focus-ring`.

### 5. Button
| Variant | Fill | Text | Border | Seen |
|---|---|---|---|---|
| `primary` | `--color-accent` | white | none | Search, Explore, Enroll Today, Begin Your Journey |
| `ink` | `--color-ink-fill` | `--color-on-ink` | none | Browse Knowledge Base, Sign up, Open Device, Start Building |
| `outline` | transparent | text-primary | 1.5px `--color-border` | View My Progress, Start Building (light), Log in, Next steps → |
| `inverse` | `--color-inverse-fill` | `--color-on-inverse` | none | Sign up (dark) |
- Sizes: `md` 44h/px 20; `sm` 36h/px 14; `block` full-width (dashboard).
- Radius `--radius-md`. 15px/500. Optional trailing arrow icon 14px ("Next steps →").
- Hover: fill → `*-hover` / outline gets `--color-bg-secondary` fill. Active: `translateY(1px)`. Focus-visible: `--focus-ring`. Disabled: 40% opacity.

### 6. IconButton (carousel arrows)
32×32, radius `--radius-sm`, 1.5px border, 16px chevron. Pair with 8px gap, aligned right of section title.

### 7. Hero
Headline (Display) + Lede + ButtonGroup + illustration slot (`<Companion pose>` + scene). See 05.

### 8. Companion (LOCKED) — see 07 + 09 §1.

### 9. ShelfScene
Plank: full-width rectangle 14px tall with a 3D top face (parallelogram 10px deep), 1.5px ink, paper fill. Lower shelf: second plank + vertical divider posts. Books stand on the plank right of centre (09 §4). Cards stand on/inside plank rows.

### 10. ResourceCard (folder card) — core template
- **Shape:** folder silhouette — top edge high for left 70%, steps down `--card-tab-drop` (12px) via a 45° bevel for the right 30% (09 §2). Radius 10.
- **Size:** fluid width (min 170px), aspect ≈ 0.8, padding 14px.
- **Content:** 16px category line-icon (orange-brown `--color-accent-2-shade` stroke, 1.5px) → 10px → title (card-title, 2 lines clamp) → 8px → description (small, secondary, 4 lines clamp) → auto → "Learn more" (caption, tertiary).
- **Light:** paper fill, ink outline. **Dark:** no fill, grey outline, cream text.
- **Hover:** outline 1.5→2px? NO — keep 1.5px; translateY(−3px) + icon turns blue (DERIVED). Whole card is a link.

### 11. CourseCard
- Outline card radius 10, overflow hidden. **Media** 120px tall, fill blue OR orange (per category, never other colours), 1px ink rule below media, ink line-art sketch centred-right (09 §5).
- **Badge** top-left inside media (8px inset).
- **Body** padding 12px: title card-title 2 lines → MetaRow (count line, then clock icon + relative time) caption/secondary.
- Ratio of colours in a row of 3: blue, blue, orange (keep ≥2:1 blue:orange).

### 12. Badge / Pill
Height 22px, padding 0 10px, radius pill, `--color-ink-fill`, `--color-on-ink`, 12px/500. Variant `outline` (graph targets): paper fill + 1.5px ink border.

### 13. SectionHeading
H2 + optional right slot (IconButton pair). Margin-bottom 16px.

### 14. DashboardCard + ProgressRow
Outline card, radius 10, padding 14px. ProgressRow: label (small/500) left, value (caption, tertiary, tabular-nums) right, then 6px bar: track = 1px ink outline pill with paper fill; fill = ink, radius pill. Rows gap 18px. Footer: `primary` block button sm.

### 15. NodeMap (Knowledge graph)
SVG canvas. Nodes: `lg` blue ⌀36, `md` blue/orange/ink ⌀20, `sm` ⌀14, `dot` ink ⌀8, `hollow` 1.5px ink ring ⌀14. Edges 1px ink straight lines; "uncertain" edges dashed `3 4`. Labels: plain 13px/500 text offset 8px from node, **or** black Pill for key concepts (≈30% of labels). `YouAreHere` = black pill with 8px blue dot prefix. 2 node clusters around one `lg` hub each. See 09 §6.

### 16. MapLegend
Outline box radius 6, padding 12px, title 13/600, rows 12px with 8px symbol + 8px gap: blue dot, ink dot, orange dot, hollow ring, pin icon. Max 5 rows.

### 17. FlowGraph (Ecosystem)
Three columns: source (companion + Skills/Agents pills on a long curved rail with blue dots) → hub pills (black fill, icon dot) → target pills (outline, with 14px blue/orange filled circle icon). Edges: cubic Béziers, 1px ink, arrowhead 5px at target. One orange 1.5px curve exits the right edge (decorative). See 09 §7.

### 18. JourneyPath + PhaseCard
PhaseCard: H3 label **above** card (not inside), outline card radius 10, padding 10px; inner **SketchWindow** (outline radius 4, ~60% of card height) containing a MiniDiagram; description (small) below. Card 3 lifted `--phase-card-lift`. Between cards: 1px arrow (→) centred vertically. JourneyPath: continuous 1.5px line with 24px corner radii running from top-right (companion) down and around the cards, blue ⌀10 dots where it touches card edges. CTA `outline sm` "Next steps →" bottom-right. See 09 §8.

### 19. WorkshopScene
PerspectiveGrid floor + wall grid (09 §9), CodeWindow (monitor, top-right), desk objects (pencil cup, screwdriver, mouse, notepad, notebook, laptop), companion typing. Under it: 2 FeatureCards.

### 20. CodeWindow
Monitor outline (1.5px) with stand; inner window `--color-code-bg`, radius 4, padding 10px, mono 12px, cream text with 2 token colours: orange (strings) and blue-light `#8FA6E6` (keywords) DERIVED. Real `<pre><code>` text.

### 21. FeatureCard
Outline radius 6, padding 20px, min-height 180; H3 → 8px → small desc (2 lines) → 16px → Button sm (`ink` light / `primary` or `outline` dark); bottom-right corner holds a small decorative sketch (paper/file or orbit lines) clipped by card edge.

### 22. TopicList
H2 + small intro + 2-column bullet list (body 15px, 6px round ink bullets, row gap 10).

### 23. MetaRow
Caption/secondary; optional 12px clock icon; items stacked or `·`-separated.

### 24. Footer
FooterBand / FooterInline (05). Link columns: 3 × 3 links, 14px, line-height 1.7, column gap 64. SocialIcon: ⌀26 cream circle with 14px ink glyph (band) / ink circle with cream glyph (inline). Gap 10.

### Not present in references (do NOT invent styles)
Live Update module, File Sketch card, Category Filter, Featured Resource, Content List, toasts, modals, tables. If needed, compose from existing pieces (see 10_CONTENT_MAPPING).