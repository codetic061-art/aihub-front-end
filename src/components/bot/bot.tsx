'use client';

/**
 * BOT V2 — public component.
 *
 * `<Bot />` renders one figure. `<BotContactSheet />` renders the whole system
 * for review, which is how the brief's "do not accept the first design, iterate
 * and compare" requirement is actually satisfied: variants are laid out side by
 * side, not judged one at a time in isolation.
 *
 * THEME
 * The bot is identical in both themes — the pack allows no theme adaptation, and
 * its fill stays cream on the navy background. All colour comes from the
 * `--bot-*` tokens, so there is nothing to switch.
 *
 * MOTION
 * State changes are CSS-only and transform/opacity-only, and every animation is
 * disabled under `prefers-reduced-motion`. The figure is a static SVG by
 * default: an animation library on a page that only needs a blinking eye is
 * measured cost for no gain, and the brief asks for minimal client JS.
 */

import { useEffect, useRef, useState } from 'react';
import { BotFigure, BOT_VIEWBOX, FACES, POSES, type BotFigureOptions } from './parts';

export interface BotProps extends Omit<BotFigureOptions, 'children'> {
  /** Rendered height in px. Width follows the viewBox aspect. */
  height?: number | string;
  /** Accessible name. The figure is decorative unless given one. */
  title?: string;
  /** `decorative` hides it from assistive tech; `status` announces state. */
  role?: 'decorative' | 'status';
  /** Cycle through states on an interval. Off by default: motion, not noise. */
  cycleStates?: boolean;
  cycleMs?: number;
  className?: string;
}

export function Bot({
  height = 240,
  title,
  role = 'decorative',
  state,
  pose = 'standing',
  scale,
  cycleStates = false,
  cycleMs = 2600,
  className,
}: BotProps) {
  const allStates = Object.keys(FACES);
  const [auto, setAuto] = useState(state ?? allStates[0]);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (state) setAuto(state);
  }, [state]);

  useEffect(() => {
    if (!cycleStates || reduced) return;
    const id = setInterval(() => {
      setAuto((prev) => {
        const i = allStates.indexOf(prev);
        return allStates[(i + 1) % allStates.length];
      });
    }, cycleMs);
    return () => clearInterval(id);
  }, [cycleStates, cycleMs, reduced, allStates.join()]);

  const active = state ?? auto;
  const isDecorative = role === 'decorative';

  return (
    <svg
      viewBox={BOT_VIEWBOX}
      height={height}
      role={isDecorative ? 'presentation' : 'img'}
      aria-hidden={isDecorative || undefined}
      aria-label={isDecorative ? undefined : title ?? `AI Hub companion: ${active}`}
      className={className}
      data-bot-root
      data-active-state={active}
    >
      {!isDecorative && <title>{title ?? `AI Hub companion: ${active}`}</title>}
      {/* The fill/stroke contract lives on the svg so every part inherits it and
          no individual part can drift. */}
      <g
        fill="var(--bot-fill)"
        stroke="var(--bot-stroke)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <BotFigure state={active} pose={pose} scale={scale} />
      </g>
    </svg>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------------ *
 * CONTACT SHEET — the iteration surface
 * ------------------------------------------------------------------ */

const POSE_ORDER = [
  'standing',
  'pointing',
  'waving',
  'thinking',
  'reading',
  'celebrating',
  'floating',
  'sitting',
  'typing',
] as const;

/**
 * Every state and pose, laid out for comparison.
 *
 * Renders in both themes side by side rather than as separate screenshots,
 * because the single most expensive bot mistake in this project so far was
 * checking the figure in one theme and assuming the other followed — the pack
 * demands the cream body survive on navy, and that is only visible if both are
 * on the same sheet.
 */
export function BotContactSheet({ height = 200 }: { height?: number }) {
  const states = Object.keys(FACES);

  return (
    <div className="bot-contact-sheet">
      <section>
        <h2 className="text-[length:var(--fs-h4)]">States — same pose, face only</h2>
        <p className="mt-1 text-[length:var(--fs-small)] text-muted-foreground">
          {states.length} states. Expression is carried by eye geometry and the mouth arc
          only — no colour, no extra facial parts.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {states.map((s) => (
            <figure key={s} className="bot-cell">
              <svg
                viewBox={BOT_VIEWBOX}
                height={height}
                role="img"
                aria-label={`Bot in ${s} state`}
              >
                <g
                  fill="var(--bot-fill)"
                  stroke="var(--bot-stroke)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  <BotFigure state={s} pose="standing" />
                </g>
              </svg>
              <figcaption>{s}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[length:var(--fs-h4)]">Poses</h2>
        <p className="mt-1 text-[length:var(--fs-small)] text-muted-foreground">
          Arm posture, lean and ground contact. The figure keeps the same head:body
          ratio in every one.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {POSE_ORDER.map((p) => (
            <figure key={p} className="bot-cell">
              <svg viewBox={BOT_VIEWBOX} height={height} role="img" aria-label={`Bot ${p} pose`}>
                <g
                  fill="var(--bot-fill)"
                  stroke="var(--bot-stroke)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  <BotFigure state="welcome" pose={p} />
                </g>
              </svg>
              <figcaption>{p}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[length:var(--fs-h4)]">Theme check — cream body must survive on navy</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div
            className="bot-cell"
            data-theme="light"
            style={{ background: 'var(--cream-50)', color: 'var(--ink-900)' }}
          >
            <svg viewBox={BOT_VIEWBOX} height={height} role="img" aria-label="Bot on light background">
              <g
                fill="var(--bot-fill)"
                stroke="var(--bot-stroke)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              >
                <BotFigure state="success" pose="pointing" />
              </g>
            </svg>
            <figcaption>light</figcaption>
          </div>
          <div
            className="bot-cell"
            data-theme="dark"
            style={{ background: 'var(--ink-950)', color: 'var(--cream-50)' }}
          >
            <svg viewBox={BOT_VIEWBOX} height={height} role="img" aria-label="Bot on dark background">
              <g
                fill="var(--bot-fill)"
                stroke="var(--bot-stroke)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              >
                <BotFigure state="success" pose="pointing" />
              </g>
            </svg>
            <figcaption>dark</figcaption>
          </div>
        </div>
      </section>
    </div>
  );
}

export { FACES, POSES };
