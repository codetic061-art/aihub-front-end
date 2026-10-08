'use client';

/**
 * "UPDATING NOW" PANEL.
 *
 * The hero companion stands beside a screen with a very thin status line and a
 * short rotating list of update messages.
 *
 * The honesty contract, in code:
 *   - `items` are real pages passed in from the server (see `@/lib/activity`).
 *     This component invents nothing.
 *   - It rotates emphasis over that fixed list on a fixed timer. There is NO
 *     fetch, no SSE, no polling — so the panel can never be read as a live feed.
 *   - It renders a visible "sample data" marker and says plainly that no live
 *     feed is connected. A reader is told exactly what they are looking at.
 *   - If a real API later replaces the data source, the server component swaps
 *     `getActivityFeed()` for a fetch and nothing in this file changes.
 *
 * Rotation is CSS-driven on a translated track rather than a JS index per row,
 * so there is one timer and no state churn while rotating.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  ACTIVITY_ROTATION_MS,
  ACTIVITY_SOURCE,
  type ActivityItem,
  type ActivityKind,
} from '@/lib/activity';

export function UpdatingPanel({
  locale,
  items,
  rotationMs = ACTIVITY_ROTATION_MS,
  className,
}: {
  locale: string;
  items: ActivityItem[];
  rotationMs?: number;
  className?: string;
}) {
  /*
   * ONE root translator with fully-qualified keys. Two bound translators in one
   * component is ambiguous for scripts/verify-messages.ts: it resolves a call
   * against the LAST `useTranslations(...)` in scope, so the later one would
   * claim every key. A root translator carries no namespace, so each key names
   * its own and stays verifiable.
   */
  const t = useTranslations();

  const [step, setStep] = useState(0);
  /*
   * Rotation freezes the moment anything inside takes focus. Without this,
   * tabbing to a row would focus a link the translateY track is currently
   * pushing out of the visible window — focusable but invisible.
   */
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    if (frozen || items.length < 2) return;
    const id = window.setInterval(() => {
      setStep((n) => (n + 1) % items.length);
    }, rotationMs);
    return () => window.clearInterval(id);
  }, [rotationMs, items.length, frozen]);

  /*
   * Literal `t()` calls, not a computed key. The message gate can only verify a
   * key it can see in the source, so building `line.${kind}` dynamically would
   * ship four unverified translations.
   */
  const KIND_LABEL: Record<ActivityKind, ReactNode> = {
    concept: t('home.updates.line.concept'),
    session: t('home.updates.line.session'),
    skill: t('home.updates.line.skill'),
    mcp: t('home.updates.line.mcp'),
  };

  if (items.length === 0) return null;

  const slide = -(step * 100) / items.length;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[length:var(--radius-lg)] border border-border',
        'bg-[var(--color-surface-raised)] p-4',
        className,
      )}
      onFocusCapture={() => setFrozen(true)}
    >
      {/*
        Thin status line. No pulse animation and no "live" wording: a blinking
        dot would imply a connection that does not exist.
      */}
      <p className="flex items-center gap-2 text-[length:var(--fs-label)] font-medium">
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-[var(--color-accent-2)]"
        />
        {t('home.updatingNow')}
      </p>

      {/*
        The rows ARE the links. An earlier draft hid the rotating track from
        assistive tech and repeated the same items in a second, static list,
        which duplicated the content on screen and gave sighted readers a plainer
        copy of the same thing. One list is now both the visible rotation and the
        navigation: every item is in the tab order, and the rotation is CSS-only
        decoration over it. One row is visible; the track moves one row per step.
      */}
      <div className="overflow-hidden">
        <div
          className="transition-transform duration-[var(--dur-3)] ease-[var(--ease)]"
          style={{ transform: `translateY(${frozen ? 0 : slide}%)` }}
        >
          <ul role="list">
            {items.map((item) => (
              <li key={item.refPath}>
                <Link
                  href={`/${locale}/${item.refPath}`}
                  className="flex h-8 items-center gap-2 truncate text-[length:var(--fs-small)] hover:underline"
                >
                  <span className="shrink-0 text-[var(--color-accent)]">
                    {KIND_LABEL[item.kind]}
                  </span>
                  <span className="truncate">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/*
        The honesty marker. Required, not optional: without it the panel reads as
        a live activity stream, which would be a false claim.
      */}
      <p className="border-t border-border-muted pt-2 text-[length:var(--fs-caption)] text-muted-foreground">
        {t('home.updates.sampleData', { source: ACTIVITY_SOURCE })}
      </p>
    </div>
  );
}