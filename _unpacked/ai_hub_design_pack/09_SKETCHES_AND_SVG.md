# 09 — Sketches & SVG Construction

## Global line-art rules (apply to every sketch)
| Property | Value |
|---|---|
| Stroke colour | `var(--illus-stroke)` (bot: `var(--bot-stroke)`) |
| Stroke width | 2px for scenes ≥ 160px tall, 1.5px for in-card sketches ≤ 120px, 1px for edges/grids |
| Caps / joins | `stroke-linecap="round" stroke-linejoin="round"` |
| Fills | flat only: `--color-surface-raised` (paper), `--color-accent`, `--color-accent-2`, `--color-ink-fill`. **No gradients, no filters, no shadows.** |
| Roughness | **none** — the refs are clean vector, not hand-jittered. Do NOT use rough.js or `feTurbulence`. |
| Opacity | 100% (grids may use 100% of a lighter grid token instead of opacity) |
| Scaling | `viewBox` + `width:100%`; for UI outlines use `vector-effect="non-scaling-stroke"` |
| Accessibility | decorative → `aria-hidden="true"`; meaningful (map/flow) → `role="img"` + `<title>` |

---
## §1 Companion — reference front pose (B, LOCKED)
viewBox `0 0 120 200`. Use as the canonical construction; action poses (14 §P1–P5) must match these proportions.
```svg
<svg class="companion" viewBox="0 0 120 200" aria-hidden="true" fill="none"
     stroke="var(--bot-stroke)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <!-- arms (behind torso) -->
  <rect x="17" y="90" width="15" height="42" rx="7.5" fill="var(--bot-fill)"/>
  <rect x="88" y="90" width="15" height="42" rx="7.5" fill="var(--bot-fill)"/>
  <path d="M18 104h13M89 104h13"/>
  <circle cx="24.5" cy="138" r="8" fill="var(--bot-fill)"/>
  <circle cx="95.5" cy="138" r="8" fill="var(--bot-fill)"/>
  <!-- legs -->
  <rect x="41" y="134" width="16" height="38" rx="6" fill="var(--bot-fill)"/>
  <rect x="63" y="134" width="16" height="38" rx="6" fill="var(--bot-fill)"/>
  <path d="M41 152h16M63 152h16"/>
  <!-- boots -->
  <rect x="34" y="168" width="26" height="18" rx="9" fill="var(--bot-fill)"/>
  <rect x="60" y="168" width="26" height="18" rx="9" fill="var(--bot-fill)"/>
  <!-- torso + chest panel -->
  <rect x="32" y="84" width="56" height="56" rx="14" fill="var(--bot-fill)"/>
  <rect x="45" y="97" width="30" height="20" rx="3"/>
  <!-- neck -->
  <rect x="46" y="76" width="28" height="10" rx="3" fill="var(--bot-visor)" stroke="none"/>
  <!-- ear disc -->
  <circle cx="99" cy="42" r="10" fill="var(--bot-fill)"/><circle cx="99" cy="42" r="4.5"/>
  <!-- helmet -->
  <rect x="20" y="6" width="78" height="72" rx="32" fill="var(--bot-fill)"/>
  <!-- visor + face -->
  <rect x="29" y="18" width="58" height="40" rx="16" fill="var(--bot-visor)" stroke="none"/>
  <ellipse cx="49" cy="35" rx="4" ry="6" fill="var(--bot-eye)" stroke="none"/>
  <ellipse cx="67" cy="35" rx="4" ry="6" fill="var(--bot-eye)" stroke="none"/>
  <path d="M51 46q7 5 14 0" stroke="var(--bot-eye)" stroke-width="2.4"/>
</svg>
```
Proportion check: head 72/200 = 0.36H ✔ · visor 58/78 = 74% width ✔ · torso 56/200 = 0.28H ✔.
Animation: idle bob `translateY(0→-4px)` 4s ease-in-out infinite (12_MOTION). Eyes may blink (scaleY 1→0.1, 120ms, every 6–9s). Nothing else.

---
## §2 Folder ResourceCard outline (C)
HTML card (`position:relative; padding-top: calc(var(--card-tab-drop) + 14px)`) + absolutely-positioned SVG drawn from measured size. Border is the SVG, not CSS.
```js
// folderPath(w, h, {r=10, drop=12, ratio=0.70}) → SVG path d
export function folderPath(w, h, { r = 10, drop = 12, ratio = 0.70 } = {}) {
  const t = Math.round(w * ratio);          // end of high tab
  return [
    `M0 ${r}`, `Q0 0 ${r} 0`,               // top-left corner
    `H${t - 4}`, `Q${t} 0 ${t + 3} 3`,      // soften bevel start
    `L${t + drop - 3} ${drop - 3}`, `Q${t + drop} ${drop} ${t + drop + 4} ${drop}`, // 45° bevel
    `H${w - r}`, `Q${w} ${drop} ${w} ${drop + r}`,
    `V${h - r}`, `Q${w} ${h} ${w - r} ${h}`,
    `H${r}`, `Q0 ${h} 0 ${h - r}`, 'Z'
  ].join(' ');
}
// usage: ResizeObserver on card → svg.setAttribute('viewBox',`0 0 ${w} ${h}`); path.d = folderPath(w-1.5,h-1.5) translated by .75
```
SVG: `fill="var(--color-surface)" stroke="var(--color-border)" stroke-width="1.5"`, `inset:0`, `z-index:-1` within an isolated card (`isolation:isolate`). React/no-JS fallback: `preserveAspectRatio="none"` + `vector-effect="non-scaling-stroke"` on a fixed-aspect card (0.8) — acceptable.

---
## §3 Shelf plank (C)
```svg
<svg viewBox="0 0 1000 40" preserveAspectRatio="none" class="shelf-plank" aria-hidden="true">
  <path d="M10 2H990L1000 12H0Z" fill="var(--color-surface-raised)" stroke="var(--color-border)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
  <rect x="0" y="12" width="1000" height="16" fill="var(--color-surface)" stroke="var(--color-border)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
</svg>
```
Top face = 10px deep parallelogram, front face 14–16px. Under-shelf: second plank at card-row bottom; vertical uprights (1.5px rects 10px wide) at container edges and at the TopicList/card divider.

## §4 Book cluster (B) — viewBox `0 0 140 100`, bottom on y=100
| Book | x | w | h | fill | rotate (about bottom centre) |
|---|---|---|---|---|---|
| 1 | 4 | 14 | 66 | orange | −14° |
| 2 | 26 | 16 | 84 | paper | 0 |
| 3 | 42 | 14 | 92 | ink | 0 |
| 4 | 56 | 15 | 84 | blue | 0 |
| 5 | 71 | 15 | 88 | paper | 0 |
| 6 | 92 | 14 | 70 | blue | +16° |
Each book: `rect rx=2`, 2px ink stroke; paper books get one horizontal spine line 8px from top. Top caps: small 4px ellipse highlight is NOT used.

## §4b Book stacks (Academy)
3–4 horizontal books stacked with ±3° jitter; each = rounded rect (rx 3) with cover colour (blue/orange/paper) + a paper "page block" strip (6px) along the open edge with 2–3 thin page lines. Colour order top→bottom: blue, paper, blue, orange. Second smaller stack right of bot: blue over orange.

---
## §5 CourseCard media sketches (B)
Media 120px tall, sketch box 160×80 centred-right. Strokes 1.5 ink, fills limited to paper. Three motifs (from refs):
1. **Doc→branches:** rounded doc rect (28×30, 3 text lines) at left; 3 lines exit right as a fork (one horizontal, two 30° diagonals) ending in ⌀6 hollow nodes. 
2. **Chip→branches:** paper rounded square (26×26) with a small glyph inside, same fork.
3. **Stacked blocks→branches:** isometric 3×2 brick (cubes 10px) with fork + one dashed connector to a small `└┘` bracket.
```svg
<svg viewBox="0 0 160 80" fill="none" stroke="var(--color-ink-fill)" stroke-width="1.5" stroke-linecap="round">
  <rect x="20" y="25" width="28" height="30" rx="3" fill="var(--color-surface-raised)"/>
  <path d="M26 34h16M26 40h16M26 46h10"/>
  <path d="M48 40H90M70 40L104 18H140M70 40l34 22h36"/>
  <circle cx="140" cy="18" r="3" fill="var(--color-surface-raised)"/><circle cx="140" cy="62" r="3" fill="var(--color-surface-raised)"/><circle cx="90" cy="40" r="3" fill="var(--color-surface-raised)"/>
</svg>
```

---
## §6 Knowledge map (B, data-driven)
```js
const map = {
  nodes: [ // size: lg|md|sm|dot|hollow; tone: blue|orange|ink
    { id:'hub1', x:470, y:250, size:'lg', tone:'blue' },
    { id:'hub2', x:580, y:180, size:'lg', tone:'blue' },
    { id:'core', x:520, y:212, size:'md', tone:'ink', label:'Concepts', pill:true },
    { id:'skills', x:540, y:140, size:'md', tone:'orange', label:'Skills' },
    { id:'here', x:500, y:335, size:'md', tone:'blue', label:'You Are Here', pill:true, here:true },
    /* … */ ],
  edges: [ ['hub1','core'], ['core','hub2'], ['hub2','skills',{dashed:true}] ]
};
```
Render: edges first (`<line>` 1px `--color-line`, dashed `3 4`), then nodes (`<circle>` r = 18/10/7/4, hollow = paper fill + 1.5 ink stroke), then labels (13px/500 offset +12px x, −4px y; pill labels = HTML `.pill` absolutely positioned via `left: x/W*100%`). ~30 nodes, 2 hubs, ≈40% blue · 25% ink dots · 20% orange · 15% hollow/sm. Layout is hand-authored (do not use force simulation — composition is LOCKED); responsive by `viewBox` scaling, labels hidden < 640px except pills.

## §7 Ecosystem flow (B)
Columns at x = 0.20W (source rail), 0.50W (hubs), 0.82W (targets). Edge: 
`M x1 y1 C x1+0.5dx y1, x2-0.5dx y2, x2 y2` with `dx = x2-x1`; arrowhead `<marker>` 6×6 path `M0 0L6 3L0 6` stroke ink, no fill. Source rail: long gentle curve from left edge through companion to bottom-left with 4–5 blue ⌀7 dots and one orange ⌀7 near companion. Hub pills: black. Target pills: outline + 14px coloured dot icon (blue ×5, orange ×4 alternating as in ref). Orange decorative exit curve: 1.5px `--color-accent-2`, from top target to beyond right edge (`overflow:visible`).

## §8 Journey path (B)
One SVG behind the 4 PhaseCards (`position:absolute; inset:0; z-index:0`), cards above (`z-index:1`, paper/page fill so the line is hidden behind them). Path built from card rects with 28px rounded corners (use `A` arcs or `Q`):
companion hand (top-right) → loops left along top → down into card 3 top-centre (dot) → card 3 bottom (dot) → U-turn under card 3 → up the right side to card 4 left-mid (arrow) … and from card 1 bottom (dot) → along bottom (dot under card 2) → up to card 3 left. Stroke 1.5 `--color-line`. Dots ⌀10 blue at every card-edge contact. Straight 1px arrows (`→`, 32px) between cards 1→2 and 3→4. Draw-in animation: `stroke-dasharray: L; stroke-dashoffset: L→0` 1.2s on enter.
### §8b Phase mini-diagrams (inside SketchWindow 160×70)
- Learn: 3 blue ⌀9 dots + small triangle + square, connected by curved arrows.
- Understand: hatched globe circle + blue "brain" cluster (5 overlapping blue circles) + dotted bulb outline.
- Practice: 3 blue dots + blue capsule, curved arrows, one orange dot with dashed arrow.
- Build: blue rounded square + gear outline + small square + blue rounded rect, dashed connectors.

## §9 Perspective grid (Workshop, B, generated)
```js
function perspectiveGrid(W, H, {vx=W/2, vy=-H*0.6, rays=24, rows=6}) {
  const lines = [];
  for (let i=0;i<=rays;i++){ const x=(i/rays)*W*1.6-W*0.3; lines.push(`M${vx + (x-vx)*0.18} 0L${x} ${H}`); } // converging floor rays
  for (let j=1;j<=rows;j++){ const y = H*Math.pow(j/rows,1.8); lines.push(`M0 ${y}H${W}`); }           // receding horizontals
  return lines.join('');
}
```
Floor: `stroke: var(--color-grid); stroke-width:1`. Wall: square grid 56px behind monitor, same stroke, fades only by *ending*, not opacity. Floor occupies the band from below hero text to card row top.

## §10 Desk objects (B, ~6–20 primitives each, 2px ink, flat fills)
Pencil cup (blue cylinder + 3 pencils, one orange tip) · Screwdriver (blue handle, angled 20°) · Computer mouse (paper, cable curve) · Notepad (paper, 6 lines, isometric skew `skewX(-20deg)`) · Spiral notebook (paper, coil dots, blue pen) · Laptop (open, isometric, paper). Draw each in its own `<symbol>` in `/icons/desk.svg`. If time-boxed, use 14 §P6.

## §11 FeatureCard corner sketches (F)
File sheet: 36×44 rect with dog-ear (10px) + 3 lines, clipped by card bottom edge. Orbit: 2 ellipses 1px + one blue ⌀6 dot, clipped bottom-right.