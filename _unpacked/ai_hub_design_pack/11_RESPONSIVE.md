# 11 — Responsive Behaviour

Breakpoints: **desktop ≥1024**, **tablet 640–1023**, **mobile <640**. Same tokens, same identity; only arrangement changes.

| Component | Desktop | Tablet | Mobile |
|---|---|---|---|
| Header | logo · nav · actions | nav → menu icon-button; search → icon-button | logo + menu + Sign up (sm) |
| Hero | 7/5 split, illus right | 6/6, companion scale 80% | stacked: text → illustration (max 280px tall, right-aligned) |
| Display type | 72px | 56px | 44px (fluid clamp), still −0.035em |
| Shelf + ResourceCards | 5 cols on plank | 3 cols, second plank row | horizontal scroll-snap row on a single plank (card 72vw), books hidden <400px |
| Lower shelf (TopicList + cards) | 2 regions | stack | stack; topic list 1 col |
| NodeMap | full composition | viewBox scale, legend below map | scale to width; plain labels hidden, pills kept; legend collapses to inline chips |
| Workshop | full scene | grid + monitor + 3 objects | grid strip + companion only; monitor hidden |
| FeatureCards | 2 cols | 2 cols | 1 col |
| CourseCards + Dashboard | 3 + 1 | 2-up carousel + dashboard below | scroll-snap carousel (80vw) + dashboard full width; arrows hidden (swipe) |
| FlowGraph | 3 columns horizontal | scale | **re-orient vertical**: source on top, hubs as wrap row, targets as wrap row; edges simplified to vertical Béziers |
| Journey | 4 cards in row, card 3 lifted | 2×2, lift removed, path redrawn | vertical stack; path = single vertical line on the left with blue dots at each card |
| Footer band | logo · 3 cols · social | logo row, 3 cols | logo, cols 2-up, social row |

Rules: tap targets ≥44px; never shrink body below 15px; never hide primary CTAs; companion never disappears from the hero (it is the identity), only scales.