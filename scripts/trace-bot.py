"""
Trace the reference bot raster into clean, editable SVG paths.

WHY TRACE INSTEAD OF RE-DRAWING
The reference is flat line art: a cream body, near-black outlines, a black
visor, two white eyes. Every shape is a solid region bounded by a high-contrast
edge, which is the ideal input for contour extraction. Tracing follows the
reference's ACTUAL geometry rather than a re-derivation of it — the previous
attempt rebuilt the figure from fractions and drifted on every part, because a
hand-derived ellipse is only ever as good as the number behind it.

The palette is sampled from the reference itself:
    background  rgb(251,248,242)   lum 247
    body fill   rgb(244,238,227)   lum 236   <- only 11 lum below the background
    ink/visor   rgb( 10, 10, 10)   lum  10
    eyes/mouth  rgb(255,255,255)   lum 255
Body and background are nearly the same value, so a naive luminance threshold
merges them into one blob. Separation therefore uses CHROMA distance from the
sampled background, not brightness.

Passes, so each role is its own path group and stays editable:
    body — cream fill of helmet, torso, limbs
    ink  — outlines and the visor
    face — white eyes and mouth, which only ever occur inside the visor

Run: python scripts/trace-bot.py
"""

import json
import pathlib
import sys

import cv2
import numpy as np
from PIL import Image

FRONTEND = pathlib.Path(__file__).resolve().parent.parent  # .../front end
ROOT = FRONTEND.parent                                          # .../aihub
OUT_DIR = pathlib.Path(r"D:/Hermes/cache/scratch/botv2")
OUT_DIR.mkdir(parents=True, exist_ok=True)
SVG_OUT = OUT_DIR / "bot-traced.svg"
JSON_OUT = OUT_DIR / "bot-traced.json"

# --- find the source raster ---------------------------------------------------
CANDIDATES = [
    FRONTEND / "preview_shot",
    FRONTEND / "preview_shot.png",
    FRONTEND / "preview_dark",
    FRONTEND / "preview_dark.png",
]
src = next((p for p in CANDIDATES if p.exists()), None)
if src is None:
    print("no reference raster found; tried:", [c.name for c in CANDIDATES])
    sys.exit(1)

img = Image.open(src).convert("RGB")
arr = np.asarray(img).astype(np.int16)
H_IMG, W_IMG = arr.shape[:2]
print(f"source: {src.name}  {W_IMG}x{H_IMG}")

# --- locate the hero figure ----------------------------------------------------
# The tallest figure-like component in the top-right block. Aspect is the
# discriminator (a standing figure is never wider than it is tall) and area only
# breaks ties: taking the largest component by area instead selects a small UI
# glyph, which is what produced an 89x65 "figure" on the first run.
gray_full = ((arr.sum(axis=2) / 3.0) < 120).astype(np.uint8)
region = np.zeros_like(gray_full)
region[100:400, 1000:1260] = gray_full[100:400, 1000:1260]

n, _labels, stats, _ = cv2.connectedComponentsWithStats(region, connectivity=8)
cands = []
for i in range(1, n):
    _x, _y, cw, ch, ca = stats[i]
    if ch < 120 or cw < 60:
        continue
    if ch < cw * 1.4:      # clearly taller than wide
        continue
    if ca < 4000:
        continue
    cands.append((ch * ca, i, int(_x), int(_y), int(cw), int(ch), int(ca)))

if not cands:
    print("no figure-like component found")
    for i in range(1, min(n, 15)):
        _x, _y, cw, ch, ca = stats[i]
        print(f"   {i}: {cw}x{ch} area={ca}")
    sys.exit(1)

cands.sort(reverse=True)
_, _, fx, fy, fw, fh, farea = cands[0]
print(f"figure bbox: x={fx} y={fy} w={fw} h={fh} area={farea}  (of {len(cands)} candidates)")

PAD = 6
X0, Y0 = max(0, fx - PAD), max(0, fy - PAD)
X1, Y1 = min(W_IMG, fx + fw + PAD), min(H_IMG, fy + fh + PAD)
fig = arr[Y0:Y1, X0:X1]
FH, FW = int(fig.shape[0]), int(fig.shape[1])
print(f"crop: {FW}x{FH}px at ({X0},{Y0})")

# --- sample the palette --------------------------------------------------------
flat = fig.reshape(-1, 3)
uniq, counts = np.unique(flat, axis=0, return_counts=True)
order = np.argsort(-counts)
print("\nsampled palette:")
for i in order[:5]:
    c = uniq[i]
    print(f"  rgb({c[0]:>3},{c[1]:>3},{c[2]:>3})  count={counts[i]:>6}")

BG = np.array([251, 248, 242], dtype=np.int16)    # page ground
INK = np.array([10, 10, 10], dtype=np.int16)      # outlines + visor
FACE = np.array([255, 255, 255], dtype=np.int16)  # eyes + mouth

dist_bg = np.linalg.norm(fig - BG, axis=2)
lum = fig.sum(axis=2) / 3.0

ink_m = (lum < 90).astype(np.uint8)

# Body fill: flood the CREAM from the figure's interior rather than thresholding
# brightness. The ground (251,248,242) and the body (244,238,227) differ by only
# 11 lum, so no threshold separates them — but a flood from inside the outline
# stops at the ink and can never reach the ground.
#
# Implemented as an explicit BFS over "not ink" rather than cv2.floodFill:
# OpenCV 5 rejects the masked overload, and a hand-rolled flood is exact and
# behaves identically on every version.
body_m = np.zeros((FH, FW), np.uint8)
yy, xx = np.mgrid[0:FH, 0:FW]
seed_ok = (
    (xx > FW * 0.32) & (xx < FW * 0.68)
    & (yy > FH * 0.50) & (yy < FH * 0.80)
    & (dist_bg < 30) & (lum < 244) & (lum > 150)
)
seeds = np.argwhere(seed_ok)
if len(seeds):
    from collections import deque
    start = tuple(int(v) for v in seeds[0])
    free = (ink_m == 0)
    q = deque([start])
    body_m[start] = 1
    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < FH and 0 <= nx < FW and free[ny, nx] and not body_m[ny, nx]:
                body_m[ny, nx] = 1
                q.append((ny, nx))
    print(f"  body flood from {start}: {int(body_m.sum())} px")

# The visor is a FILLED dark blob; the outlines are a thin tangle. The two are
# trivially separable by fill ratio — measured 0.82 for the visor against 0.13
# for the outline component — so select on that rather than on a closing kernel,
# which merged the head, arms and legs into one crop-sized blob.
n_s, ls, ss, _ = cv2.connectedComponentsWithStats(ink_m, connectivity=8)
visor = np.zeros_like(ink_m)
visor_box = None
for i in range(1, n_s):
    _x, _y, sw, sh, sa = (int(v) for v in ss[i])
    if sa < 500:
        continue
    if sa / max(sw * sh, 1) < 0.6:   # solid, not an outline tangle
        continue
    if sw < sh * 1.2:                 # the visor is clearly wider than tall
        continue
    visor = (ls == i).astype(np.uint8)
    visor_box = (_x, _y, sw, sh)
    break
if visor.any():
    # The eyes and mouth punch holes in the visor; close them so it reads solid.
    visor = cv2.morphologyEx(visor, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    print(f"  visor: {visor_box} area={int(visor.sum())}")
else:
    print("  WARNING: no solid visor blob found")

# Face = pure white INSIDE the visor's filled hull. Using the hull (not the raw
# blob) keeps the eyes and mouth even if the visor has an interior highlight.
# Per-channel, not luminance. The ground is rgb(251,248,242): it clears a >240
# LUMINANCE test but fails >=250 on green and blue, while the eyes and mouth are
# pure 255,255,255. Testing channels separately is the whole discriminator —
# a luminance threshold pulls in 12,961 background pixels instead of 309.
face_m = (
    (fig[:, :, 0] >= 250) & (fig[:, :, 1] >= 250) & (fig[:, :, 2] >= 250)
).astype(np.uint8)
if visor.any():
    cnts, _ = cv2.findContours(visor, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hull = np.zeros_like(visor)
    cv2.drawContours(hull, cnts, -1, 1, thickness=cv2.FILLED)
    face_m = (face_m & (hull > 0)).astype(np.uint8)

for name, m in (("body", body_m), ("ink", ink_m), ("face", face_m)):
    print(f"  {name:5} pixels: {int(m.sum()):>6}")


def to_path(mask: np.ndarray, eps_frac: float = 0.0018, min_area: float = 10.0):
    """Contours -> one SVG path string plus per-region bounding boxes.

    epsilon scales with the image diagonal so simplification is resolution
    independent: it strips single-pixel staircase without flattening the
    corners that make the drawing read as deliberate.
    """
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    diag = float(np.hypot(*mask.shape))
    eps = max(diag * eps_frac, 0.5)

    parts, boxes = [], []
    for c in cs:
        area = float(cv2.contourArea(c))
        if area < min_area:
            continue
        approx = cv2.approxPolyDP(c, eps, True)
        pts = approx.reshape(-1, 2)
        if len(pts) < 3:
            continue
        d = [f"M {int(pts[0][0])} {int(pts[0][1])}"]
        for px, py in pts[1:]:
            d.append(f"L {int(px)} {int(py)}")
        d.append("Z")
        parts.append(" ".join(d))
        bx, by, bw, bh = cv2.boundingRect(c)
        boxes.append({"x": int(bx), "y": int(by), "w": int(bw), "h": int(bh), "area": int(area)})

    return " ".join(parts), boxes


body_d, body_b = to_path(body_m)
visor_d, visor_b = to_path(visor, min_area=100.0)
ink_d, ink_b = to_path(ink_m, min_area=14.0)
face_d, face_b = to_path(face_m, min_area=3.0)

print(f"\nregions -> body:{len(body_b)}  visor:{len(visor_b)}  ink:{len(ink_b)}  face:{len(face_b)}")
for label, boxes in (("body", body_b), ("visor", visor_b), ("ink", ink_b), ("face", face_b)):
    for bx in sorted(boxes, key=lambda b: -b["area"])[:8]:
        print(f"  {label:4} x{bx['x']:>4} y{bx['y']:>4} {bx['w']:>4}x{bx['h']:<4} area={bx['area']}")

# --- emit ----------------------------------------------------------------------
# Flat fills only: no gradients, no filters, no shadows. The reference is flat
# line art and the design pack forbids all three.
svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {FW} {FH}" width="{FW}" height="{FH}">
  <!--
    Traced from {src.name}; hero figure at ({X0},{Y0}), {FW}x{FH}px.
    Passes: cream body fill, near-black ink (outlines + visor), white face.
    Flat fills only. Geometry is in source pixel space; scale via width/height.
  -->
  <!-- Order matters: the visor is filled black and sits UNDER the white face,
       and the outlines are stroked last so every edge stays crisp. -->
  <g id="bot-body" fill="#F4EEE3" stroke="none">
    <path d="{body_d}"/>
  </g>
  <g id="bot-visor" fill="#0A0A0A" stroke="none">
    <path d="{visor_d}"/>
  </g>
  <g id="bot-face" fill="#FFFFFF" stroke="none">
    <path d="{face_d}"/>
  </g>
  <g id="bot-ink" fill="none" stroke="#0A0A0A" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="{ink_d}"/>
  </g>
</svg>
"""
SVG_OUT.write_text(svg, encoding="utf-8")
JSON_OUT.write_text(
    json.dumps(
        {
            "source": str(src),
            "crop": {"x": X0, "y": Y0, "w": FW, "h": FH},
            "palette": {
                "background": [int(v) for v in BG],
                "ink": [int(v) for v in INK],
                "face": [int(v) for v in FACE],
            },
            "body": body_b,
            "visor": visor_b,
            "ink": ink_b,
            "face": face_b,
        },
        indent=2,
    ),
    encoding="utf-8",
)

print(f"\nwrote {SVG_OUT}  ({SVG_OUT.stat().st_size:,} bytes)")
print(f"wrote {JSON_OUT}")
