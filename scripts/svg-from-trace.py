"""
RENDER TRACED PATHS TO A STANDALONE SVG, for visual comparison against the source.

    python scripts/svg-from-trace.py <paths.json> <out.svg> [height_units]

The bot's design space is 256 units tall; the trace is in source pixels, so this
scales the pixel geometry up into that space. Scaling is a single uniform factor
applied to every path, which keeps the traced proportions exact — the figure is
never re-fitted, only magnified.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DESIGN_H = 256.0

# Contour tolerance, in SOURCE pixels. 0.4 is below the 1px stroke width, so the
# polygon stays within half a pixel of the source edge at every point — close
# enough that the eye cannot see the difference, and loose enough to drop the
# staircase artefacts that pixel-edge tracing produces.
#
# It must be well under the stroke width. At eps=1.2 on an 85x119 figure the
# contour simplified to ~45 points, which drew the helmet as an octagon and the
# boots as wedges; those facets then scaled up with the figure instead of
# disappearing.
CONTOUR_EPS = 0.4


def fit_bezier(d: str) -> str:
    """
    Replace straight chords with smooth quadratic segments, per sub-path.

    A traced contour is a dense point list whose vertices lie ON the source
    curve. Joining them with straight lines cuts the inside of every curve, so a
    circle comes out as a polygon. Using each point as a quadratic control point
    and the edge midpoint as the endpoint reproduces the same curve with no
    visible corners.

    Each sub-path is handled SEPARATELY. The interior-detail path holds ten
    disjoint sub-paths in one string ("M ... Z M ... Z"), and a parser that
    strips every number in order reads the M and Z of the second sub-path as
    coordinates of the first. That produced long spurious diagonals straight
    across the robot's chest — the ladder of crossing lines in the first curved
    render. Sub-paths are split on M before any coordinates are read.
    """
    import re as _re

    out: list[str] = []
    for sub in _re.findall(r'M\s[^M]*Z', d):
        nums = [float(v) for v in _re.findall(r'-?[\d.]+', sub)]
        pts = list(zip(nums[0::2], nums[1::2]))
        if len(pts) < 3:
            out.append(sub)
            continue

        def mid(a, b):
            return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)

        # Start at the midpoint of the last->first edge so the path closes
        # smoothly instead of leaving a visible corner at the seam.
        start = mid(pts[-1], pts[0])
        seg = [f"M {start[0]:.2f} {start[1]:.2f}"]
        n = len(pts)
        for i in range(n):
            cur = pts[i]
            m = mid(cur, pts[(i + 1) % n])
            seg.append(f"Q {cur[0]:.2f} {cur[1]:.2f} {m[0]:.2f} {m[1]:.2f}")
        seg.append("Z")
        out.append(" ".join(seg))
    return " ".join(out)


def scale_path(d: str, k: float) -> str:
    if not d:
        return ""
    return re.sub(
        r'(-?[\d.]+) (-?[\d.]+)',
        lambda m: f"{float(m.group(1)) * k:.2f} {float(m.group(2)) * k:.2f}",
        d,
    )


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2

    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    data = json.loads(src.read_text(encoding="utf-8"))

    H = data["h"]
    W = data["w"]
    k = DESIGN_H / H

    def build(d: str) -> str:
        return fit_bezier(scale_path(d, k)) if d else ""

    outer = build(data.get("outer", ""))
    inner = build(data.get("inner", ""))
    visor = build(data.get("visor", ""))
    face = build(data.get("face", ""))

    # The body is WHITE, not cream. This reference is unfilled line art on a
    # light card, and filling it cream would darken the whole figure against
    # the page. The fill stays paper-coloured and only the ink is dark.
    body_fill = data.get("bodyFill", "#FFFFFF")

    # Line weight, measured in source pixels and scaled like everything else.
    # The reference draws at roughly 2px on an 85x119 figure, which is what
    # keeps it reading as light line art rather than heavy cartoon outlines.
    # Hardcoding a design-space value instead (4.5 units) is what made the
    # first render look like a bold sticker: the same number is 2.15x heavier
    # once the trace is scaled up from source pixels.
    STROKE = float(data.get("stroke", 2.0)) * k

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W * k:.0f} {DESIGN_H:.0f}"
     width="{W * k:.0f}" height="{DESIGN_H:.0f}" fill="none">
  <g id="body" fill="{body_fill}" stroke="none">
    <path d="{outer}"/>
  </g>
  <g id="ink" fill="none" stroke="#111111" stroke-width="{STROKE:.2f}"
     stroke-linejoin="round" stroke-linecap="round">
    <path d="{inner}"/>
    <path d="{outer}"/>
  </g>
  <g id="visor" fill="#111111" stroke="none">
    <path d="{visor}"/>
  </g>
  <g id="face" fill="#FFFFFF" stroke="none">
    <path d="{face}"/>
  </g>
</svg>
"""
    out.write_text(svg, encoding="utf-8")
    print(f"wrote {out}  viewBox {W * k:.0f}x{DESIGN_H:.0f}  (from {W}x{H} px, x{k:.3f})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
