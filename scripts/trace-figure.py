"""
TRACE A ROBOT FIGURE FROM A REFERENCE IMAGE INTO SVG PATHS.

Turns a flat line-art robot reference into the four path layers the BotFigure
component needs, at whatever resolution the source image happens to be.

    python scripts/trace-figure.py <image> <outdir>

Layers produced, in <outdir>/paths.json:
    outer   the figure's outer silhouette, as one closed contour
    inner   every interior line (chest panel, ear, joints, limb separations)
    visor   the solid dark visor, as a filled shape
    face    the white eyes, as filled shapes

WHY A TRACE
Six earlier attempts rebuilt the bot from the design pack's proportional anatomy
and every one was wrong on a different part. A hand-derived ellipse is only as
good as the number behind it, and the pack's numbers disagree with the reference
images (it specifies head w:h 1.05 where the image measures 1.56). Measuring the
reference is the only version of this that can be right.

WHY NOT floodFill
cv2.floodFill's masked overload is gone or changed shape in OpenCV 5 here, and
the two-argument BFS below behaves identically on every version. It is also
easier to reason about: "not ink" is exactly the condition the mask needs.

WHY A PER-CHANNEL WHITE TEST
The background is not white, so a luminance threshold does not separate the two.
The ground in the references is around rgb(251, 248,242); testing each channel
>= 250 keeps the true-white eyes and mouth and rejects the cream ground. A plain
`> 240` luminance test swallowed 12,961 background pixels in the first run.
"""
from __future__ import annotations

import json
import re
import sys
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

MIN_COMPONENT = 8


# --------------------------------------------------------------------------- #
# adaptive ink threshold
# --------------------------------------------------------------------------- #
def ink_threshold(gray: np.ndarray) -> int:
    """
    Derive the ink/paper split from the image itself.

    A hardcoded value does not transfer. One reference drew its outlines in
    near-black (luma ~20-60); the next drew them in light grey (~130) with only
    the visor below any fixed cut, so a fixed threshold of 110 found the visor
    and nothing else — the trace reported 1,235 body pixels in a 159x167 box
    and produced an empty figure.

    The two populations are well separated (paper ~239-250, linework ~120-160,
    visor ~20-40), so the split is placed between the dark and bright modes.
    """
    paper = float(np.percentile(gray, 90))
    dark = float(np.percentile(gray, 8))
    return int((paper + dark) / 2)


# --------------------------------------------------------------------------- #
# crop
# --------------------------------------------------------------------------- #
def find_figure(gray: np.ndarray, thr: int) -> tuple[int, int, int, int]:
    """
    Bounding box of the drawn figure: the (x, y, w, h) of everything that is ink.

    A card border is excluded by construction, because the border is INK and so
    is the figure — density cannot tell them apart on this reference, where the
    card's bottom edge is 93.7% dark and its left edge is a 1px column dark in
    only 0.6% of rows. Three earlier attempts tried to tell them apart and each
    one failed differently: by pixel density, by long contiguous runs, and by
    walking inward from the edge (whose counter ran off the array and blanked
    the image entirely).

    So the border is simply not part of the search. A figure is drawn with paper
    around it, so the outermost few percent of the image is excluded and the
    box is taken from what remains. That is one assumption, and it holds for
    every reference: the bot is a character portrait, not a bleed-to-edge
    illustration.
    """
    H, W = gray.shape
    dark = gray < thr
    band = max(2, int(min(H, W) * 0.03))

    inner = np.zeros_like(dark)
    inner[band : H - band, band : W - band] = dark[band : H - band, band : W - band]

    ys, xs = np.nonzero(inner)
    if not len(ys):
        return 0, 0, W, H
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    return x0, y0, x1 - x0 + 1, y1 - y0 + 1


def prepare(rgb: np.ndarray, thr: int) -> np.ndarray:
    """
    Return the figure alone: card border painted out, then cropped to the figure.

    The card border MUST be painted out rather than merely cropped away, and the
    distinction is not cosmetic. The silhouette is found by flooding the
    background inward from the edge of the image, and a card border is a CLOSED
    contour — the flood cannot get past it, so the flood never reaches the robot
    and the traced "silhouette" comes back as the card: a 157x165 rectangle
    around an 81x115 figure. Painting the border to paper makes the flood work
    again.
    """
    H, W = rgb.shape[:2]
    clean = rgb.copy()

    # Straight lines along the image edge are the card. No part of a robot
    # produces a row or column that is dark across half the image.
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    dark = gray < thr
    clean[dark.sum(axis=1) > W * 0.5] = 245
    clean[:, dark.sum(axis=0) > H * 0.5] = 245

    x, y, w, h = find_figure(cv2.cvtColor(clean, cv2.COLOR_RGB2GRAY), thr)
    pad = 2
    y0 = max(0, y - pad)
    x0 = max(0, x - pad)
    return clean[y0 : y + h + pad, x0 : x + w + pad]


# --------------------------------------------------------------------------- #
# masks
# --------------------------------------------------------------------------- #
def not_ink_mask(gray: np.ndarray, thr: int) -> np.ndarray:
    """
    BFS from the border over non-ink pixels; return 1 for the background.

    Everything the fill cannot reach is inside the figure. The figure's outline
    is a closed black contour in flat line art, so the reach is exactly the
    paper around the robot.
    """
    H, W = gray.shape
    free = gray >= thr
    outside = np.zeros((H, W), bool)

    seeds = [(0, x) for x in range(W)] + [(H - 1, x) for x in range(W)]
    seeds += [(y, 0) for y in range(H)] + [(y, W - 1) for y in range(H)]

    q: deque[tuple[int, int]] = deque()
    for y, x in seeds:
        if free[y, x] and not outside[y, x]:
            outside[y, x] = True
            q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and free[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                q.append((ny, nx))

    return outside.astype(np.uint8)


def solid_dark_mask(gray: np.ndarray, thr: int, min_area: int, min_fill: float) -> np.ndarray:
    """Dark components that are solidly filled, not outline strokes."""
    m = (gray < thr).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    out = np.zeros_like(m)
    for i in range(1, n):
        w, h, area = (
            int(stats[i, cv2.CC_STAT_WIDTH]),
            int(stats[i, cv2.CC_STAT_HEIGHT]),
            int(stats[i, cv2.CC_STAT_AREA]),
        )
        if area >= min_area and area / max(w * h, 1) >= min_fill:
            out = (labels == i).astype(np.uint8)
    return out


def face_mask(gray: np.ndarray, visor: np.ndarray) -> np.ndarray:
    """
    The eyes and mouth: the light shapes sitting INSIDE the dark visor.

    Every earlier approach treated the face as "the white parts of the image",
    which is wrong twice over. A global brightness test cannot work at all,
    because the visor itself is bright — it is a light-grey shape on a light
    card, and the largest blob above any useful cut is the visor (768px) rather
    than an eye. And a per-channel >= 250 test returns nothing when the paper
    is 239 rather than white.

    The face is defined by WHERE it is, not by its colour: lighter than the
    visor, and enclosed by it. So the visor is located first, its interior is
    eroded by 2px to drop the visor's own antialiased rim, and the light shapes
    inside that window are taken. On this reference that returns exactly the
    two eyes and the mouth, and nothing else.
    """
    if not visor.any():
        return np.zeros(gray.shape, np.uint8)

    ys, xs = np.nonzero(visor)
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1

    win = np.zeros(gray.shape, np.uint8)
    win[y0 + 2 : y1 - 2, x0 + 2 : x1 - 2] = 1

    # "Lighter than ink" is relative: the visor here bottoms out at 15 but its
    # body sits at ~60-70, so a fixed floor either keeps the rim or loses the
    # eyes. Use the visor's own median as the floor.
    floor = int(np.percentile(gray[visor > 0], 75))
    m = ((gray > floor) & (win > 0)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))

    # Keep only the real features. The visor's antialiased rim leaks through
    # the eroded window and shows up as extra small blobs hugging the border
    # of the window, so a raw connected-components pass returns 6-7 regions
    # where a robot face has 3.
    #
    # The three real ones are identified by their arrangement, not their size
    # alone: the two eyes are the pair at the same height, side by side, and the
    # mouth is the blob centred between and below them. Picking the top three by
    # area is not equivalent — on this reference a 6x3 rim artifact at (27,21)
    # outranks the 4x3 mouth at (37,39), and would be drawn as a third eye.
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    blobs = []
    for i in range(1, n):
        x, y, w, h, a = (int(v) for v in stats[i, :5])
        if a < 2:
            continue
        # Reject window-border artifacts: they touch the edge of the window.
        if x <= 0 or y <= 0 or x + w >= m.shape[1] or y + h >= m.shape[0]:
            continue
        blobs.append((a, x, y, w, h))
    if len(blobs) < 2:
        return m

    # The eye pair: the two largest blobs whose vertical centres nearly match.
    blobs.sort(key=lambda b: -b[0])
    eyes = None
    for i in range(len(blobs)):
        for j in range(i + 1, len(blobs)):
            b1, b2 = blobs[i], blobs[j]
            c1, c2 = b1[2] + b1[4] / 2, b2[2] + b2[4] / 2
            if abs(c1 - c2) <= 2 and b1[3] <= b2[3] * 2 and b2[3] <= b1[3] * 2:
                eyes = (b1, b2)
                break
        if eyes:
            break
    if not eyes:
        return m

    # Resolve the eye blobs back to their component indices so the same labels
    # array can be reused for the mouth pass.
    idx = []
    for i in range(1, n):
        x, y, w, h, a = (int(v) for v in stats[i, :5])
        if a < 2:
            continue
        if x <= 0 or y <= 0 or x + w >= m.shape[1] or y + h >= m.shape[0]:
            continue
        for b in eyes:
            if abs(x - b[1]) <= 1 and abs(y - b[2]) <= 1:
                idx.append(i)
    # The mouth: the largest remaining blob below and between the eyes.
    ex = (eyes[0][1] + eyes[0][3] / 2 + eyes[1][1] + eyes[1][3] / 2) / 2
    ey = (eyes[0][2] + eyes[1][2]) / 2
    rest = []
    for i in range(1, n):
        if i in idx:
            continue
        x, y, w, h, a = (int(v) for v in stats[i, :5])
        if a < 2 or y + h / 2 <= ey:
            continue
        rest.append((a, i, abs((x + w / 2) - ex)))
    if rest:
        rest.sort(key=lambda z: (z[2], -z[0]))
        idx.append(rest[0][1])

    out = np.zeros_like(m)
    for i in idx:
        out[labels == i] = 1
    return out


# --------------------------------------------------------------------------- #
# paths
# --------------------------------------------------------------------------- #
def contour_to_path(mask: np.ndarray, eps: float = 0.4, want: str = "largest") -> str:
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return ""
    if want == "largest":
        c = max(cnts, key=cv2.contourArea)
    else:
        c = sorted(cnts, key=cv2.contourArea, reverse=True)[0]

    pts = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
    if len(pts) < 3:
        pts = cv2.approxPolyDP(c, 0.2, True).reshape(-1, 2)
    if len(pts) < 3:
        return ""

    out = [f"M {pts[0][0]} {pts[0][1]}"]
    out += [f"L {x} {y}" for x, y in pts[1:]]
    out.append("Z")
    return " ".join(out)


def mask_to_subpaths(mask: np.ndarray, eps: float, min_area: int) -> list[str]:
    cnts, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    paths: list[str] = []
    for c in sorted(cnts, key=cv2.contourArea, reverse=True):
        if cv2.contourArea(c) < min_area:
            continue
        pts = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
        if len(pts) < 2:
            continue
        d = [f"M {pts[0][0]} {pts[0][1]}"]
        d += [f"L {x} {y}" for x, y in pts[1:]]
        d.append("Z")
        paths.append(" ".join(d))
    return paths


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2

    src = Path(sys.argv[1])
    outdir = Path(sys.argv[2])
    outdir.mkdir(parents=True, exist_ok=True)

    rgb = np.asarray(Image.open(src).convert("RGB"))
    print(f"source {src.name}: {rgb.shape[1]}x{rgb.shape[0]}")

    thr = ink_threshold(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY))
    print(f"ink threshold {thr} (adaptive)")

    fig_rgb = prepare(rgb, thr)
    H, W = fig_rgb.shape[:2]
    print(f"figure crop: {W}x{H}")

    gray = cv2.cvtColor(fig_rgb, cv2.COLOR_RGB2GRAY)
    ink = (gray < thr).astype(np.uint8)

    # --- silhouette ------------------------------------------------------- #
    outside = not_ink_mask(gray, thr)
    fig = (outside == 0).astype(np.uint8)
    # Close 1px gaps the trace may have left in the outline.
    fig = cv2.morphologyEx(fig, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))

    cnts, _ = cv2.findContours(fig, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        print("FAIL: no figure found")
        return 1
    body = max(cnts, key=cv2.contourArea)
    print(f"silhouette: {W}x{H}, area {int(cv2.contourArea(body))}")

    # Store a per-row profile as a fallback: the exact pixel extent, usable even
    # if the contour simplifier over-fits.
    profile: list[list[int]] = []
    ys, xs = np.nonzero(fig)
    for y in range(int(ys.min()), int(ys.max()) + 1):
        cols = np.nonzero(fig[y])[0]
        if len(cols):
            profile.append([y, int(cols.min()), int(cols.max()), int(len(cols))])

    # --- interior lines --------------------------------------------------- #
    # A thin ring around the outer contour, then subtract it. Using FILLED here
    # instead covers the whole interior and deletes every detail line.
    ring = np.zeros((H, W), np.uint8)
    cv2.drawContours(ring, [body], -1, 1, thickness=2)
    inner = (ink & (ring == 0)).astype(np.uint8)
    inner_paths = mask_to_subpaths(inner, 0.4, MIN_COMPONENT)
    print(f"interior: {int(inner.sum())} px in {len(inner_paths)} sub-paths")

    # --- visor ------------------------------------------------------------ #
    # A filled dark mass. The line art has no competing solid of this size, and
    # the aspect filter keeps a wide visor from being read as a limb.
    # Try a ladder of thresholds and keep the first solid blob. The visor and
    # the surrounding outline MERGE at the adaptive ink threshold, so a single
    # pass finds nothing; lowering the cut separates them again, and solidity
    # then picks the visor out from the strokes.
    visor = np.zeros((H, W), np.uint8)
    for cut in (thr, int(thr * 0.8), int(thr * 0.6), int(thr * 0.45), 120, 90, 60):
        m = solid_dark_mask(gray, cut, min_area=300, min_fill=0.55)
        if not m.any():
            continue
        n2, _, st2, _ = cv2.connectedComponentsWithStats(m, 8)
        best, best_a = None, 0
        for i in range(1, n2):
            wv, hv, a = (int(st2[i, cv2.CC_STAT_WIDTH]),
                         int(st2[i, cv2.CC_STAT_HEIGHT]),
                         int(st2[i, cv2.CC_STAT_AREA]))
            # Wide, solid, and in the upper half — that is the visor and
            # nothing else in a robot figure.
            if a > best_a and wv > hv * 0.9 and wv > W * 0.12:
                best, best_a = i, a
        if best is not None:
            cv2.drawContours(visor, [max(cv2.findContours(
                (m == best).astype(np.uint8), cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE)[0], key=cv2.contourArea)],
                -1, 1, thickness=-1)
            print(f"visor found at threshold {cut}")
            break
    vp = mask_to_subpaths(visor, 0.4, 200)
    for d in vp[:1]:
        pairs = re.findall(r'(-?[\d.]+) (-?[\d.]+)', d)
        if not pairs:
            continue
        pts = np.array([[float(a), float(b)] for a, b in pairs])
        print(f"visor: {pts[:, 0].max() - pts[:, 0].min():.0f}x"
              f"{pts[:, 1].max() - pts[:, 1].min():.0f} at "
              f"({pts[:, 0].min():.0f},{pts[:, 1].min():.0f})")

    # --- face ------------------------------------------------------------- #
    whites = face_mask(gray, visor)
    face_paths = mask_to_subpaths(whites, 0.4, 2)
    print(f"face: {len(face_paths)} white regions")

    out = {
        "outer": contour_to_path(fig, 0.4),
        "inner": " ".join(inner_paths),
        "visor": vp[0] if vp else "",
        "face": " ".join(face_paths),
        "w": W,
        "h": H,
        "crop": {"x": 0, "y": 0, "w": W, "h": H},
        "profile": profile,
    }
    p = outdir / "paths.json"
    p.write_text(json.dumps(out, indent=2), encoding="utf-8")

    for k in ("outer", "inner", "visor", "face"):
        print(f"  {k:6} {len(out[k]):>6,} chars")

    # A visual so the trace can be judged, not assumed.
    vis = fig_rgb.copy()
    cv2.drawContours(vis, [body], -1, (220, 30, 30), 1)
    if vp:
        vmask = np.zeros((H, W), np.uint8)
        cv2.drawContours(vmask, [max(cv2.findContours(visor, cv2.RETR_EXTERNAL,
                                                      cv2.CHAIN_APPROX_SIMPLE)[0],
                                       key=cv2.contourArea)], -1, 1, thickness=-1)
        vis[vmask > 0] = (0, 0, 0)
    Image.fromarray(vis).save(outdir / "trace-check.png")
    print(f"\nwrote {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
