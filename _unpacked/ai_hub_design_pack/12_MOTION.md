# 12 — Motion (restrained)

| Interaction | Spec |
|---|---|
| Button hover | bg/border colour `--dur-1` linear |
| Button active | `translateY(1px)` instant |
| Focus-visible | `--focus-ring`, no animation |
| Card hover (Resource/Course/Feature) | `translateY(-3px)` `--dur-2 --ease-out`; category icon stroke → `--color-accent`. No shadow. |
| Link hover | underline appears (offset 4px) |
| Carousel | scroll-snap; arrows `scrollBy(cardWidth+gap)` smooth |
| Progress bar | fill width 0→value, 600ms `--ease-out` on enter (once) |
| Companion idle | `translateY(0 → -4px)` 4s ease-in-out alternate; blink every 6–9s |
| Map nodes | hover: node scale 1.15 + connected edges → 1.5px; "You Are Here" blue dot pulse ring (scale 1→1.8, opacity .5→0, 2.4s, infinite) — only live indicator |
| Flow graph | on enter: edges draw left→right (dashoffset) staggered 40ms; hover pill highlights its edges |
| Journey path | on enter: path draws 1.2s; dots pop (scale 0→1) as the line reaches them |
| Code window | optional typing caret blink (1s steps(1)) on last line; no auto-typing loops |
| Section reveal | opacity 0→1 + translateY(8px→0), `--dur-3`, once, IntersectionObserver threshold .2 |
| Theme switch | `color`, `background-color`, `border-color`, `stroke`, `fill` 200ms; no view-transition sweeps |
| Cursor | pointer on all cards/pills/nodes; default elsewhere. No custom cursors. |

`prefers-reduced-motion`: disable all transforms/draws; keep colour transitions at 0ms.
Forbidden: parallax, particles, glow pulses, 3D tilt, marquee, gradient shimmer, scroll-jacking.