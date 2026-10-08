# 13 — IMPLEMENTATION GUARDRAILS (binding for the coding AI)

The reference images are the authority. If this pack and the images disagree, the images win; if the images are ambiguous, this pack wins; never fill gaps with taste.

## Never
1. Do not redesign, modernise or "improve" anything.
2. Do not replace the font family (Inter/Inter Display skeleton) or add weights other than 400/500/600.
3. Do not replace the flat cream background; no texture, noise, grain, gradient or pattern.
4. Do not add gradients anywhere (buttons, cards, text, media, backgrounds).
5. Do not add drop shadows, glows, blur or glassmorphism. Elevation = outline only.
6. Do not introduce colours beyond the token set; no purple, teal, neon, or "AI" iridescence. Max two accents: blue + orange.
7. Do not add generic AI visuals (brains, circuits glow, sparkles ✨, orbs, waves, 3D renders, holograms).
8. Do not change the companion bot: silhouette, proportions, visor, face, line weight, cream body in dark mode.
9. Do not replace line-art with stock illustrations, emoji, photos or 3D icons.
10. Do not use screenshots/rasters for anything classified A/B/C in 08_ASSETS.
11. Do not change component proportions, radii (4/6/8/10/pill) or stroke weights (1/1.5/2).
12. Do not convert folder cards into plain rectangles, or cards into floating grids off the shelf.
13. Do not change layout archetypes or section order without user approval.
14. Do not copy gibberish text from the images; use real content.
15. Do not build the presentation-board frame or its caption.
16. Do not use orange as a button colour or as text colour; do not put white text on orange.
17. Do not use hand-drawn/rough filters — strokes are clean vectors.

## Always
- Consume tokens from `03_DESIGN_TOKENS.css` only; theme via `[data-theme]` on `<html>`.
- Keep geometry identical across themes; only semantic colour tokens switch.
- Keep orange ≤10% of visible area per section.
- Keep illustrations right, text left in heroes.
- Use semantic HTML (`header/nav/main/section/footer`), visible focus, AA contrast for text (tertiary text only ≥13px/500).
- Mark any deviation in a `DEVIATIONS.md` with reason + screenshot.