/**
 * BOT V2 — TRACED PART LIBRARY
 *
 * The figure is the reference's own outline, traced from the supplied image and
 * scaled into a 256-unit design space. It is NOT reconstructed from proportions.
 *
 * WHY A TRACE AND NOT A DRAWING
 * Six earlier attempts rebuilt the bot from the design pack's fractional
 * anatomy (head 0.36H, w:h 1.05, torso 0.27H). Every one looked close and was
 * wrong on a different part — the helmet too narrow, the arms detached from the
 * body, the legs hidden behind the torso, the boots as four separate blobs. A
 * hand-derived ellipse is only as good as the number behind it, and the pack's
 * numbers disagree with the reference images: it specifies head w:h 1.05 where
 * the image measures 1.56, and torso 0.27H where the image measures 0.34H with
 * the torso TALLER than the head.
 *
 * The pack settles that conflict itself: "If this pack and the images disagree,
 * the images win." Recorded in DEVIATIONS.md.
 *
 * WHY THE GEOMETRY IS BEZIERS, NOT POLYLINES
 * The tracer emits contours, which are polygons. Joined with straight lines they
 * cut the inside of every curve, so a helmet came out an octagon and the boots
 * wedges — facets that then magnified with the figure instead of hiding. The
 * paths below were fitted to quadratics, with the contour tolerance set to 0.4
 * source pixels so the polygon never visibly departs from the original edge.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS FIXED AND WHAT IS STATE
 * ---------------------------------------------------------------------------
 * Fixed, shared by every state and pose: the silhouette, the black visor, the
 * ear, the chest panel, the out-pointing arm, the arm at the side, the legs and
 * boots, the line weight. This is the character, and it does not change.
 *
 * Varied by state: the two eyes and the mouth. The reference is a head-on
 * figure with a fixed gesture — one arm extended, one at its side — so a pose
 * is a transform of the whole figure rather than a redraw. Redrawing the body
 * per pose is the failure mode described above.
 *
 * Never used: colour. The bot is unfilled line art on light paper, so state is
 * never signalled by tinting it, and a recolour would also force the reader to
 * learn a colour key — the "annoying chatbot" register the brief rules out.
 */

import type { ReactNode } from 'react';

/** Design height. The trace was scaled so the figure is exactly this tall. */
export const H = 256;

/** Figure viewBox width, from the traced bounding box. */
export const FIG_W = 183;

const STROKE = 'var(--bot-stroke, #111111)';
const VISOR = 'var(--bot-visor, #111111)';
const FACE = 'var(--bot-face, var(--bot-eye, #FFFFFF))';

/**
 * Line weight in design units, measured from the reference: a 1.9px stroke on
 * an 85x119 figure, taken as twice the median distance-transform radius (0.95px)
 * over stroke-like pixels. It scales with the figure rather than being typed in
 * as a constant, because a fixed design-space value is heavier or lighter than
 * the source depending on how much the trace was magnified.
 */
const W = 4.09;

/* ------------------------------------------------------------------ *
 * TRACED GEOMETRY
 *
 * From scripts/trace-figure.py + scripts/svg-from-trace.py against the
 * supplied reference. Regenerate with:
 *   python scripts/trace-figure.py <reference.png> <outdir>
 *   python scripts/svg-from-trace.py <outdir>/paths.json <outdir>/bot.svg
 * ------------------------------------------------------------------ */

const OUTER = "M 103.27 4.30 Q 94.66 4.30 93.58 5.38 Q 92.50 6.45 89.28 6.45 Q 86.05 6.45 84.97 7.53 Q 83.90 8.61 81.75 8.61 Q 79.60 8.61 78.53 9.68 Q 77.45 10.76 74.22 11.84 Q 70.99 12.91 68.84 15.06 Q 66.69 17.21 65.62 17.21 Q 64.54 17.21 59.16 23.66 Q 53.78 30.12 53.78 31.20 Q 53.78 32.27 51.63 35.50 Q 49.48 38.72 49.48 40.88 Q 49.48 43.03 48.41 44.11 Q 47.33 45.18 47.33 61.31 Q 47.33 77.45 48.41 78.53 Q 49.48 79.60 49.48 81.75 Q 49.48 83.90 50.55 84.97 Q 51.63 86.05 52.70 89.28 Q 53.78 92.50 60.23 98.95 Q 66.69 105.41 68.84 105.41 Q 70.99 105.41 73.14 107.56 Q 75.29 109.71 75.29 111.86 Q 75.29 114.02 66.69 122.62 Q 58.08 131.23 58.08 132.31 Q 58.08 133.38 52.70 138.75 Q 47.33 144.13 46.25 144.13 Q 45.18 144.13 44.11 145.21 Q 43.03 146.29 40.88 146.29 Q 38.72 146.29 37.64 147.37 Q 36.57 148.44 35.50 148.44 Q 34.42 148.44 33.34 149.51 Q 32.27 150.59 30.12 150.59 Q 27.97 150.59 26.89 151.67 Q 25.82 152.74 22.59 152.74 Q 19.36 152.74 18.29 153.81 Q 17.21 154.89 15.06 154.89 Q 12.91 154.89 10.76 157.04 Q 8.61 159.19 7.53 159.19 Q 6.45 159.19 6.45 160.26 Q 6.45 161.34 5.38 162.42 Q 4.30 163.50 4.30 165.65 Q 4.30 167.80 8.61 167.80 Q 12.91 167.80 13.98 168.88 Q 15.06 169.95 15.06 172.10 Q 15.06 174.25 16.14 175.32 Q 17.21 176.40 21.52 176.40 Q 25.82 176.40 29.05 174.25 Q 32.27 172.10 37.65 172.10 Q 43.03 172.10 44.11 171.02 Q 45.18 169.95 47.33 169.95 Q 49.48 169.95 50.55 168.88 Q 51.63 167.80 54.86 166.73 Q 58.08 165.65 60.23 163.50 Q 62.39 161.34 64.54 161.34 Q 66.69 161.34 67.77 162.42 Q 68.84 163.50 68.84 168.88 Q 68.84 174.25 69.91 175.32 Q 70.99 176.40 70.99 179.63 Q 70.99 182.86 72.06 183.94 Q 73.14 185.01 73.14 216.20 Q 73.14 247.39 72.06 248.47 Q 70.99 249.55 72.06 249.55 Q 73.14 249.55 74.22 248.47 Q 75.29 247.39 75.29 239.87 Q 75.29 232.34 76.37 231.26 Q 77.45 230.18 87.13 230.18 Q 96.81 230.18 97.88 231.26 Q 98.96 232.34 98.96 240.94 Q 98.96 249.55 100.03 249.55 Q 101.11 249.55 101.11 231.26 Q 101.11 212.97 102.19 211.89 Q 103.26 210.82 109.72 210.82 Q 116.17 210.82 117.25 211.89 Q 118.32 212.97 118.32 216.20 Q 118.32 219.43 119.39 220.50 Q 120.47 221.58 120.47 235.56 Q 120.47 249.55 121.55 248.47 Q 122.62 247.39 122.62 240.94 Q 122.62 234.49 123.69 233.42 Q 124.77 232.34 128.00 232.34 Q 131.23 232.34 132.31 231.26 Q 133.38 230.18 138.75 230.18 Q 144.13 230.18 145.21 231.26 Q 146.29 232.34 146.29 240.94 Q 146.29 249.55 147.37 249.55 Q 148.44 249.55 148.44 229.11 Q 148.44 208.67 149.51 207.59 Q 150.59 206.52 152.74 206.52 Q 154.89 206.52 155.96 207.59 Q 157.04 208.67 157.04 212.97 Q 157.04 217.28 161.34 217.28 Q 165.65 217.28 168.88 214.05 Q 172.10 210.82 172.10 209.75 Q 172.10 208.67 173.18 207.59 Q 174.25 206.52 174.25 201.14 Q 174.25 195.76 175.32 194.69 Q 176.40 193.61 176.40 176.40 Q 176.40 159.19 175.32 158.12 Q 174.25 157.04 174.25 153.81 Q 174.25 150.59 173.18 149.51 Q 172.10 148.44 172.10 146.28 Q 172.10 144.13 169.95 140.91 Q 167.80 137.68 167.80 135.53 Q 167.80 133.38 164.57 129.07 Q 161.34 124.77 160.26 121.54 Q 159.19 118.32 157.04 116.17 Q 154.89 114.02 153.81 114.02 Q 152.74 114.02 149.51 111.86 Q 146.29 109.71 144.13 109.71 Q 141.98 109.71 138.75 107.56 Q 135.53 105.41 135.53 103.26 Q 135.53 101.11 143.06 93.58 Q 150.59 86.05 152.74 80.67 Q 154.89 75.29 158.12 70.99 Q 161.34 66.69 161.34 57.01 Q 161.34 47.33 159.19 45.18 Q 157.04 43.03 157.04 41.95 Q 157.04 40.87 155.96 40.87 Q 154.89 40.87 153.81 39.80 Q 152.74 38.72 150.59 33.34 Q 148.44 27.97 145.21 24.74 Q 141.98 21.51 141.98 20.44 Q 141.98 19.36 137.68 16.13 Q 133.38 12.91 132.31 12.91 Q 131.23 12.91 125.85 9.68 Q 120.47 6.45 117.25 6.45 Q 114.02 6.45 112.94 5.38 Q 111.87 4.30 103.27 4.30 Z";
const INNER = "M 119.39 44.10 Q 118.32 40.87 117.25 40.87 Q 116.17 40.87 115.09 39.80 Q 114.02 38.72 104.34 38.72 Q 94.66 38.72 93.58 39.80 Q 92.50 40.87 84.97 40.87 Q 77.45 40.87 76.37 41.95 Q 75.29 43.03 68.84 43.03 Q 62.39 43.03 61.31 44.11 Q 60.24 45.18 57.01 46.25 Q 53.78 47.33 53.78 48.41 Q 53.78 49.48 52.70 50.55 Q 51.63 51.63 51.63 61.31 Q 51.63 70.99 52.70 72.06 Q 53.78 73.14 53.78 76.37 Q 53.78 79.60 54.86 80.67 Q 55.93 81.75 55.93 83.90 Q 55.93 86.05 59.16 89.28 Q 62.39 92.50 64.54 92.50 Q 66.69 92.50 67.77 93.58 Q 68.84 94.66 79.59 94.66 Q 90.35 94.66 91.42 93.58 Q 92.50 92.50 98.95 92.50 Q 105.41 92.50 106.48 91.42 Q 107.56 90.35 110.79 90.35 Q 114.02 90.35 115.09 89.28 Q 116.17 88.20 117.25 88.20 Q 118.32 88.20 121.54 84.97 Q 124.77 81.75 124.77 69.91 Q 124.77 58.08 123.69 57.00 Q 122.62 55.93 122.62 52.70 Q 122.62 49.48 121.55 48.41 Q 120.47 47.33 119.39 44.10 Z M 78.53 136.61 Q 77.45 137.68 77.45 149.51 Q 77.45 161.34 78.53 162.42 Q 79.60 163.50 79.60 164.57 Q 79.60 165.65 82.82 165.65 Q 86.05 165.65 87.12 166.73 Q 88.20 167.80 103.26 167.80 Q 118.32 167.80 118.32 166.73 Q 118.32 165.65 119.39 164.57 Q 120.47 163.50 120.47 152.74 Q 120.47 141.98 119.39 140.91 Q 118.32 139.83 118.32 137.68 Q 118.32 135.53 98.96 135.53 Q 79.60 135.53 78.53 136.61 Z M 79.60 150.59 Q 79.60 137.68 80.67 136.61 Q 81.75 135.53 86.05 135.53 Q 90.35 135.53 91.42 136.61 Q 92.50 137.68 104.34 137.68 Q 116.17 137.68 117.25 138.75 Q 118.32 139.83 118.32 151.67 Q 118.32 163.50 117.25 164.57 Q 116.17 165.65 98.96 165.65 Q 81.75 165.65 80.67 164.57 Q 79.60 163.50 79.60 150.59 Z M 151.66 118.32 Q 148.44 116.17 146.28 116.17 Q 144.13 116.17 140.91 120.47 Q 137.68 124.77 137.68 130.15 Q 137.68 135.53 138.75 136.61 Q 139.83 137.68 139.83 139.83 Q 139.83 141.98 144.13 148.44 Q 148.44 154.89 148.44 166.72 Q 148.44 178.55 147.37 179.63 Q 146.29 180.71 146.29 182.86 Q 146.29 185.01 145.21 186.08 Q 144.13 187.16 141.98 187.16 Q 139.83 187.16 138.75 188.24 Q 137.68 189.31 134.45 190.38 Q 131.23 191.46 124.77 197.92 Q 118.32 204.37 118.32 205.44 Q 118.32 206.52 119.39 207.59 Q 120.47 208.67 121.55 207.59 Q 122.62 206.52 122.62 205.44 Q 122.62 204.37 129.07 197.92 Q 135.53 191.46 136.61 191.46 Q 137.68 191.46 138.75 190.38 Q 139.83 189.31 141.98 189.31 Q 144.13 189.31 145.21 190.38 Q 146.29 191.46 146.29 197.92 Q 146.29 204.37 147.37 203.30 Q 148.44 202.22 149.51 202.22 Q 150.59 202.22 150.59 201.14 Q 150.59 200.07 154.89 196.84 Q 159.19 193.61 162.42 193.61 Q 165.65 193.61 166.73 194.69 Q 167.80 195.76 168.88 195.76 Q 169.95 195.76 169.95 194.69 Q 169.95 193.61 164.57 193.61 Q 159.19 193.61 157.04 191.46 Q 154.89 189.31 154.89 178.56 Q 154.89 167.80 158.12 165.65 Q 161.34 163.50 166.72 163.50 Q 172.10 163.50 172.10 162.42 Q 172.10 161.34 167.80 161.34 Q 163.50 161.34 162.42 162.42 Q 161.34 163.50 159.19 163.50 Q 157.04 163.50 155.96 164.57 Q 154.89 165.65 153.81 164.57 Q 152.74 163.50 152.74 162.42 Q 152.74 161.34 149.51 155.97 Q 146.29 150.59 146.29 148.44 Q 146.29 146.29 145.21 145.21 Q 144.13 144.13 144.13 136.61 Q 144.13 129.08 148.44 124.78 Q 152.74 120.47 153.81 120.47 Q 154.89 120.47 151.66 118.32 Z M 132.31 109.71 Q 133.38 109.71 131.23 107.56 Q 129.08 105.41 130.16 104.34 Q 131.23 103.26 131.23 102.19 Q 131.23 101.11 130.16 101.11 Q 129.08 101.11 128.00 102.19 Q 126.92 103.26 124.77 103.26 Q 122.62 103.26 121.55 104.34 Q 120.47 105.41 117.25 105.41 Q 114.02 105.41 112.94 106.48 Q 111.87 107.56 95.73 107.56 Q 79.60 107.56 80.67 108.63 Q 81.75 109.71 80.67 110.79 Q 79.60 111.87 79.60 112.94 Q 79.60 114.02 80.67 112.94 Q 81.75 111.87 84.97 115.09 Q 88.20 118.32 89.28 118.32 Q 90.35 118.32 91.42 119.39 Q 92.50 120.47 102.19 120.47 Q 111.87 120.47 112.94 119.39 Q 114.02 118.32 116.17 118.32 Q 118.32 118.32 119.39 117.25 Q 120.47 116.17 123.69 115.09 Q 126.92 114.02 129.07 111.86 Q 131.23 109.71 132.31 109.71 Z M 149.51 168.88 Q 150.59 167.80 152.74 171.03 Q 154.89 174.25 154.89 183.93 Q 154.89 193.61 151.66 197.92 Q 148.44 202.22 147.37 201.14 Q 146.29 200.07 146.29 192.54 Q 146.29 185.01 147.37 183.94 Q 148.44 182.86 148.44 176.41 Q 148.44 169.95 149.51 168.88 Z M 92.50 72.06 Q 92.50 68.84 93.58 67.77 Q 94.66 66.69 96.81 66.69 Q 98.96 66.69 100.03 67.77 Q 101.11 68.84 101.11 72.06 Q 101.11 75.29 100.03 76.37 Q 98.96 77.45 96.81 77.45 Q 94.66 77.45 93.58 76.37 Q 92.50 75.29 92.50 72.06 Z M 62.39 70.99 Q 64.54 68.84 67.77 72.06 Q 70.99 75.29 68.84 77.44 Q 66.69 79.60 65.62 79.60 Q 64.54 79.60 62.39 76.37 Q 60.24 73.14 62.39 70.99 Z M 148.44 39.80 Q 148.44 38.72 147.37 39.80 Q 146.29 40.87 145.21 40.87 Q 144.13 40.87 141.98 44.10 Q 139.83 47.33 139.83 53.78 Q 139.83 60.24 140.91 61.31 Q 141.98 62.39 141.98 64.54 Q 141.98 66.69 145.21 69.91 Q 148.44 73.14 149.51 73.14 Q 150.59 73.14 151.67 72.06 Q 152.74 70.99 150.59 70.99 Q 148.44 70.99 146.28 68.84 Q 144.13 66.69 144.13 65.62 Q 144.13 64.54 143.06 63.47 Q 141.98 62.39 141.98 60.23 Q 141.98 58.08 140.91 57.00 Q 139.83 55.93 139.83 54.86 Q 139.83 53.78 140.91 52.70 Q 141.98 51.63 141.98 48.41 Q 141.98 45.18 144.13 43.02 Q 146.29 40.87 147.37 40.87 Q 148.44 40.87 148.44 39.80 Z M 77.45 190.38 Q 77.45 189.31 77.45 191.46 Q 77.45 193.61 79.60 196.84 Q 81.75 200.07 82.83 200.07 Q 83.90 200.07 87.12 203.30 Q 90.35 206.52 92.50 206.52 Q 94.66 206.52 95.73 207.59 Q 96.81 208.67 97.88 208.67 Q 98.96 208.67 98.96 207.59 Q 98.96 206.52 96.81 206.52 Q 94.66 206.52 92.50 204.37 Q 90.35 202.22 89.28 202.22 Q 88.20 202.22 82.83 196.84 Q 77.45 191.46 77.45 190.38 Z";
const VISOR_D = "M 120.47 46.25 Q 120.47 45.18 117.25 41.95 Q 114.02 38.72 105.41 38.72 Q 96.81 38.72 95.73 39.80 Q 94.66 40.87 86.06 40.87 Q 77.45 40.87 76.37 41.95 Q 75.29 43.03 69.92 43.03 Q 64.54 43.03 63.47 44.11 Q 62.39 45.18 60.23 45.18 Q 58.08 45.18 54.86 49.48 Q 51.63 53.78 51.63 61.31 Q 51.63 68.84 52.70 69.91 Q 53.78 70.99 53.78 75.29 Q 53.78 79.60 54.86 80.67 Q 55.93 81.75 57.00 84.97 Q 58.08 88.20 61.31 90.35 Q 64.54 92.50 67.77 92.50 Q 70.99 92.50 72.06 93.58 Q 73.14 94.66 78.52 94.66 Q 83.90 94.66 84.97 93.58 Q 86.05 92.50 94.66 92.50 Q 103.26 92.50 104.34 91.42 Q 105.41 90.35 108.64 90.35 Q 111.87 90.35 112.94 89.28 Q 114.02 88.20 117.25 87.12 Q 120.47 86.05 122.62 83.90 Q 124.77 81.75 124.77 69.91 Q 124.77 58.08 123.69 57.00 Q 122.62 55.93 122.62 52.70 Q 122.62 49.48 121.55 48.41 Q 120.47 47.33 120.47 46.25 Z";

/** Face anchors, measured from the traced face layer's three regions. */
const EYE_L_X = 66.69;
const EYE_R_X = 97.88;
const EYE_Y = 76.4;
const EYE_RX = 4.84;
const EYE_RY = 6.46;
const MOUTH_X = 82.82;
const MOUTH_Y = 86.05;
const MOUTH_W = 3.23;

/* ------------------------------------------------------------------ *
 * EXPRESSION
 * ------------------------------------------------------------------ */

export interface Eyes {
  /** Pupil offset from the traced centre. */
  dx: number;
  dy: number;
  /** Vertical squash. 1 = as traced; <1 narrows; >1 widens. */
  ry: number;
  /** Horizontal squash, for the narrowed "focused" look. */
  rx: number;
}

export interface Face {
  eyes: Eyes;
  /** Mouth arc: positive curves down (smile), negative up (frown). */
  curve: number;
  /** Half-width of the mouth arc. */
  width: number;
}

/**
 * All 15 states from the brief. `welcome` uses the traced eye geometry and a
 * flat mouth, so that state is faithful by construction rather than by my
 * judgement — the reference's own face is the baseline the rest move away from.
 */
export const FACES: Record<string, Face> = {
  welcome:      { eyes: { dx: 0,   dy: 0,   ry: 1,    rx: 1 },    curve: 0,   width: MOUTH_W },
  exploring:    { eyes: { dx: 2.4, dy: -0.8, ry: 0.88, rx: 0.92 }, curve: -1,   width: 3 },
  learning:     { eyes: { dx: 0,   dy: 1.2, ry: 1,    rx: 1 },    curve: -0.8, width: 3.1 },
  thinking:     { eyes: { dx: -2.6, dy: -1.6, ry: 0.82, rx: 0.86 }, curve: 0,  width: 2.7 },
  reading:      { eyes: { dx: 0,   dy: 2.2, ry: 0.9,  rx: 0.94 }, curve: -0.6, width: 2.8 },
  pointing:     { eyes: { dx: 1.8, dy: -0.4, ry: 0.96, rx: 0.98 }, curve: -0.3, width: 3.1 },
  recommending: { eyes: { dx: 1,   dy: 0,   ry: 1,    rx: 1 },    curve: -0.3, width: 3.1 },
  searching:    { eyes: { dx: 2.8, dy: -1,   ry: 0.7,  rx: 0.8 },  curve: 0,   width: 2.6 },
  testing:      { eyes: { dx: 0,   dy: 0,   ry: 0.94, rx: 0.97 }, curve: -0.7, width: 2.9 },
  success:      { eyes: { dx: 0,   dy: 0,   ry: 1,    rx: 1 },    curve: 1.8, width: 3.8 },
  warning:      { eyes: { dx: 0,   dy: 0,   ry: 1.16, rx: 1.1 },  curve: 0,   width: 3 },
  updating:     { eyes: { dx: 1,   dy: 0,   ry: 0.92, rx: 0.96 }, curve: -0.6, width: 2.9 },
  idle:         { eyes: { dx: 0,   dy: 1,   ry: 0.97, rx: 0.98 }, curve: -0.5, width: 2.8 },
  error:        { eyes: { dx: 0,   dy: 1,   ry: 0.78, rx: 0.84 }, curve: -2.4, width: 3 },
  celebration:  { eyes: { dx: 0,   dy: 0,   ry: 1.08, rx: 1.04 }, curve: 2.4, width: 4 },
};

/* ------------------------------------------------------------------ *
 * POSES
 * ------------------------------------------------------------------ */

/**
 * A pose is an affine transform of the traced figure, never a second drawing.
 * This is what guarantees the nine poses share one silhouette: there is only
 * one set of paths in this file.
 */
export interface Pose {
  name: string;
  /** Rotation about the figure's feet, degrees. */
  rotate?: number;
  /** Uniform scale, about the feet. */
  scale?: number;
  /** Vertical offset — the floating pose. */
  offsetY?: number;
  /** Horizontal skew, for a leaning pose. */
  skewX?: number;
}

export const POSES: Record<string, Pose> = {
  standing:   { name: 'standing' },
  pointing:   { name: 'pointing', skewX: -2 },
  waving:     { name: 'waving', rotate: -3, offsetY: -2 },
  thinking:   { name: 'thinking', rotate: 2, skewX: 1 },
  reading:    { name: 'reading', rotate: 1, offsetY: 3 },
  celebrating: { name: 'celebrating', rotate: -2, offsetY: -4 },
  floating:   { name: 'floating', offsetY: -12, rotate: -2 },
  sitting:    { name: 'sitting', offsetY: 6, scale: 0.92 },
  typing:     { name: 'typing', offsetY: 6, scale: 0.92, skewX: 2 },
};

/* ------------------------------------------------------------------ *
 * ASSEMBLY
 * ------------------------------------------------------------------ */

export interface BotFigureOptions {
  state?: string;
  pose?: string;
  scale?: number;
  className?: string;
  /** Rendered into the figure's own coordinate space, above everything. */
  children?: ReactNode;
}

/**
 * The figure.
 *
 * Layer order matches the reference: the interior ink plus the outer outline,
 * then the solid visor, then the white face. The face is last so the eyes and
 * mouth sit ON the visor.
 *
 * The body carries no fill. The reference is unfilled line art, and filling the
 * silhouette cream — as an earlier revision did — darkens the whole figure
 * against the page and destroys the style.
 */
export function BotFigure({
  state = 'welcome',
  pose = 'standing',
  scale = 1,
  className,
  children,
}: BotFigureOptions) {
  const face = FACES[state] ?? FACES.welcome;
  const p = POSES[pose] ?? POSES.standing;
  const { eyes, curve, width } = face;

  const rx = EYE_RX * eyes.rx;
  const ry = EYE_RY * eyes.ry;

  // Pose transform, applied about the figure's centre line and feet so the
  // boots stay planted when it scales.
  const rot = p.rotate ?? 0;
  const sk = p.skewX ?? 0;
  const oy = p.offsetY ?? 0;
  const total = scale * (p.scale ?? 1);
  const px = FIG_W / 2;
  const py = H;
  const t = [
    `translate(${px} ${py})`,
    rot ? ` rotate(${rot.toFixed(2)})` : '',
    sk ? ` skewX(${sk.toFixed(2)})` : '',
    ` scale(${total.toFixed(3)})`,
    ` translate(${(-px).toFixed(2)} ${(-py).toFixed(2)})`,
    oy ? ` translate(0 ${oy.toFixed(2)})` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <g className={className} data-bot data-state={state} data-pose={pose} transform={t}>
      <g
        id="bot-ink"
        fill="none"
        stroke={STROKE}
        strokeWidth={W}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d={INNER} />
        <path d={OUTER} />
      </g>

      <g id="bot-visor" fill={VISOR} stroke="none">
        <path d={VISOR_D} />
      </g>

      <g id="bot-face" fill={FACE} stroke="none">
        <ellipse
          className="bot-eye"
          cx={(EYE_L_X + eyes.dx).toFixed(2)}
          cy={(EYE_Y + eyes.dy).toFixed(2)}
          rx={rx.toFixed(2)}
          ry={ry.toFixed(2)}
        />
        <ellipse
          className="bot-eye"
          cx={(EYE_R_X + eyes.dx).toFixed(2)}
          cy={(EYE_Y + eyes.dy).toFixed(2)}
          rx={rx.toFixed(2)}
          ry={ry.toFixed(2)}
        />
        <path
          className="bot-mouth"
          d={`M ${(MOUTH_X - width).toFixed(2)} ${MOUTH_Y} Q ${MOUTH_X} ${(MOUTH_Y + curve).toFixed(2)} ${(MOUTH_X + width).toFixed(2)} ${MOUTH_Y}`}
          fill="none"
          stroke={FACE}
          strokeWidth={W}
          strokeLinecap="round"
        />
      </g>
      {children}
    </g>
  );
}

export const BOT_VIEWBOX = `0 0 ${FIG_W} ${H}`;

/** Ground line, so a hero scene can align props to the boots. */
export const GROUND = H;
