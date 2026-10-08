# 07 — LOCKED VISUAL ELEMENTS

Only *theme adaptation explicitly listed here* is allowed.

## L1. The AI Companion (robot-astronaut)
**Anatomy (front pose, proportions of total height H):**
- Head/helmet ≈ 0.36H, slightly wider than tall (w:h ≈ 1.05), cream fill, 2px ink outline.
- **Visor**: black rounded rectangle ≈ 70% of head width, ≈ 52% of head height, corner radius ≈ 40% of visor height, positioned upper-centre.
- **Face**: two white vertical oval eyes + one small white smile arc. Nothing else (no antenna, no mouth fill, no cheeks, no glow).
- **Ear disc** on one side of the helmet (circle ≈ 0.26 of head height, with inner concentric circle).
- **Neck**: short black band.
- **Torso**: rounded rectangle ≈ 0.27H, chest panel = outlined rectangle.
- **Arms/legs**: tube limbs with ring joints, mitten hands, short legs, chunky rounded boots.
- Colours: body `--bot-fill`, lines `--bot-stroke`, visor `--bot-visor`, eyes `--bot-eye`. **No blue/orange on the bot.**

DO NOT CHANGE: silhouette · head-to-body ratio · visor shape · face (2 eyes + smile) · ear disc · line weight · flat fills · cream body in dark mode · personality (friendly, curious, helpful) · placement logic (always right side of hero, interacting with the section's object).
Theme adaptation allowed: **none** (bot is identical in both themes).

**Poses (one per section, all locked):** standing-pointing at books (Library) · holding compass, looking at viewer (Map) · seated at desk typing on laptop (Workshop) · sitting cross-legged with laptop, books beside (Academy) · small standing on the flow rail (Ecosystem) · floating/flying, arm extended along the path (Journey).

## L2. Library shelf + books
Plank with 3D top face spanning the container; books cluster: orange (tilted left) · cream · black (tallest) · blue · cream · blue (tilted right). Exactly two blues, one orange, one black. Cards stand in the shelf. DO NOT change into a grid of floating cards.

## L3. Folder-tab ResourceCard silhouette
Left 70% high tab, 45° bevel drop of 12px. DO NOT replace with a plain rectangle or a top-left tab.

## L4. Knowledge map composition
Two clusters around big blue hubs, ink dot nodes, mix of plain labels + black pills, dashed edges, legend bottom-left, compass-bot bottom-right.

## L5. Workshop perspective grid + desk
One-point perspective floor converging to centre-top, square wall grid, monitor with code top-right, desk objects in a horizontal row. Dark mode: grid lines `--color-grid`; objects keep blue accents.

## L6. Journey path
One continuous line; phase cards Learn → Understand → Practice (lifted) → Build; blue junction dots; companion at the path's start top-right.

## L7. Ecosystem flow graph
Left→right three-tier flow, curved edges, black hub pills, outline target pills with coloured dot icons, orange exit curve.

## L8. Colour-header CourseCard
Blue/orange media with ink sketch + black "Course" badge. DO NOT use photos or gradients in the media area.

## L9. Footer black band
Full-bleed `#000` in both themes.

## L10. Paper background
Flat `--color-bg`. No texture, noise, grain, gradient, or pattern (the refs are clean).