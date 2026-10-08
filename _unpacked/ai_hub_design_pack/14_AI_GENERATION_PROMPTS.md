# 14 — AI Generation Requirements & Prompts

Only the companion **action poses** (and optionally the desk-object set) need a model. Everything else is code (08).

**Why code is insufficient for poses:** foreshortened limbs, seated/flying postures, held props (compass, laptop) and overlap with objects need dozens of hand-tuned Bézier paths; generating then vectorising is faster and more faithful. The front pose in 09 §1 is the proportion master.

**Pipeline (REQUIRES USER ACTION):**
1. Generate with a vector-capable model — recommended **Recraft V3, style "Vector art / Line art"** (outputs SVG directly). Alternatives: GPT-Image-1 / Ideogram → then vectorise with Vectorizer.ai or Illustrator Image Trace (Black & White → expand; 3 colours).
2. Attach the reference crop (`crop_A_TL_hero` etc.) + the 09 §1 SVG as **image reference** when the model supports it.
3. Post-process SVG: replace fills with `var(--bot-fill)` / `var(--bot-visor)` / `var(--bot-eye)`, strokes with `var(--bot-stroke)`, stroke width normalised to 2.2 at 200px height, remove background rect. Run SVGO.
4. Deliver to `/components/companion/poses/*.svg`; check against 07 L1.

**Shared spec for all prompts:** transparent background, PNG 2048px or SVG, aspect as listed, character fills ~80% of height, centred, no ground shadow.

### Base style block (prepend to every prompt)
```
Flat vector line-art illustration of a small friendly robot-astronaut mascot. Clean uniform black outlines (#111110), consistent 2px-equivalent line weight, round line caps, no hatching. Flat fills only: warm cream body (#FBF8F2), solid black rounded-rectangle visor (#0A0A0A) covering the upper face, two small white vertical oval eyes and a small white smile arc inside the visor. Rounded helmet slightly wider than tall, a circular ear disc with an inner ring on one side, short black neck band, rounded rectangular torso with a small outlined chest panel, tube-shaped arms and legs with ring joints, mitten hands, chunky rounded boots. Head is about one third of total height. Minimal editorial tech illustration style, like a modern product landing page spot illustration. Isolated on a transparent background.
```
### Negative prompt (all)
```
gradient, shading, shadows, drop shadow, glow, 3D render, realistic, photo, texture, grain, noise, sketchy, hand-drawn jitter, crosshatching, watercolor, colored body, blue robot, orange robot, purple, neon, mouth, teeth, nose, antenna, cape, jetpack flames, background scene, floor, text, watermark, logo, extra fingers, thick outlines, thin hairlines, anime, chibi exaggeration, cute blush cheeks
```

| ID | Pose | Aspect | Where used | Prompt (append to base) |
|---|---|---|---|---|
| **P1** | Standing, 3/4 turned left, right arm extended pointing/touching | 3:4 | Library hero, beside books | `Standing pose turned three-quarters to the left, one arm extended forward with an open mitten hand as if gently touching a book on a shelf, other arm relaxed, looking toward the extended hand.` |
| **P2** | Standing, holding a large compass, looking at viewer | 3:4 | Map hero, bottom-right | `Standing front-facing, holding a large round navigation compass in front of the body with both hands; the compass has a black outline, cream face and a two-tone needle in cobalt blue (#2549BB) and black. Head tilted slightly, friendly.` |
| **P3** | Seated on a stool at a desk, typing on a laptop, side/3-4 view | 4:3 | Workshop scene | `Sitting on a simple stool, viewed three-quarters from the left, both hands typing on an open cream laptop with black outline on a desk edge. Only the robot and the laptop, no other objects.` |
| **P4** | Sitting cross-legged on the floor with an open laptop on lap | 1:1 | Academy hero | `Sitting cross-legged on the ground, an open cream laptop with a small cobalt blue (#2549BB) circle logo on its lid resting on the lap, hands on the keyboard, head slightly tilted down at the screen.` |
| **P5** | Floating/flying, body diagonal, one arm extended forward | 4:3 | Journey hero, top-right | `Floating weightlessly in a gentle diagonal pose, body leaning forward to the left, one arm extended forward as if leading the way, legs trailing behind relaxed, like drifting in zero gravity. No jetpack, no motion lines.` |
| P6 (optional) | Desk object set | 16:5 | Workshop desk row | see below |

### P6 — Desk objects (only if not hand-built per 09 §10)
```
Flat vector line-art set of six workshop desk objects in a single horizontal row with even spacing, isometric 3/4 view, on transparent background: a cobalt blue (#2549BB) pencil cup holding three pencils (one with an orange #F08436 tip), a screwdriver with a cobalt blue handle lying diagonally, a cream computer mouse with a curved cable, a cream lined notepad, a cream spiral notebook with a blue pen, and an open cream laptop. Uniform black outlines (#111110), round caps, flat fills only (cream #FBF8F2, cobalt blue, one orange accent), minimal editorial tech illustration style.
```
Negative: same as above minus robot terms, plus `robot, person, hands, desk surface, perspective floor`.

### Vector/SVG model prompt (for tracing a chosen PNG)
```
Convert this illustration to a clean SVG with at most 4 colours: #111110 (strokes), #FBF8F2 (body fill), #0A0A0A (visor), #FFFFFF (eyes). Use stroked paths for outlines (stroke-width uniform), not filled outline shapes. Remove the background. Keep exact silhouette and proportions. Group as <g id="body">, <g id="visor">, <g id="face">.
```

**Constraints for acceptance:** passes 07 L1 checklist; identical cream body in light and dark; ≤150 paths; no embedded raster.