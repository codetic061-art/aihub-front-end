'use client';

import { useMemo } from 'react';
import Link from 'next/link';

import { Button, Badge } from '@/components/ui/button';
import type { Locale } from '@/lib/data';
import {
  courseProgress,
  sessionsForCourse,
  useProgress,
} from '@/lib/progress';

/**
 * Course progress panel — sessions completed, per course, local only.
 *
 * WHAT THIS IS NOT
 *
 * There is no account, no sync and no attempt ledger in this project. Every
 * mark here lives in one `localStorage` key on this device. The panel says so in
 * its own footer rather than presenting a number as if it were a synced record,
 * because "you completed 3 of 4" reads very differently depending on whether it
 * survives a cache clear.
 *
 * THE DENOMINATOR IS DERIVED, NOT STORED
 *
 * `total` comes from the real content snapshot via `courseProgress()` — course
 * → modules → sessions, the same reverse lookup `LearningTree` performs. It is
 * recomputed from the snapshot the page was built with, so it cannot drift when
 * content changes. Only `done` is persisted.
 *
 * HYDRATION
 *
 * `useProgress` reads in an effect, so the first paint is the server-rendered
 * "not started" state and the stored value replaces it afterwards. That is what
 * keeps these pages statically renderable: no storage access during render.
 */

export interface ProgressPanelLabels {
  title: string;
  sessionsCompleted: string;
  of: string;
  remaining: string;
  noneLeft: string;
  markDone: string;
  markNotDone: string;
  localOnly: string;
  localOnlyBody: string;
  reset: string;
  resetNotice: string;
  noCourses: string;
}

export interface ProgressPanelProps {
  locale: Locale;
  /** `courses/<slug>` refs to report on. Usually the course index pages. */
  courses: { ref: string; title: string }[];
  /** When false the panel is read-only — no checkboxes, no reset. */
  interactive?: boolean;
  labels: ProgressPanelLabels;
}

/** Stable, collision-free id for a session checkbox. */
function checkboxId(courseRef: string, sessionRef: string): string {
  return `progress-${courseRef}--${sessionRef}`.replace(/[^a-zA-Z0-9-]/g, '-');
}

export function ProgressPanel({
  locale,
  courses,
  interactive = true,
  labels,
}: ProgressPanelProps) {
  const { snapshot, done, setDone, reset } = useProgress();

  const rows = useMemo(
    () =>
      courses.map((c) => {
        const sessions = sessionsForCourse(locale, c.ref);
        return {
          ref: c.ref,
          title: c.title,
          sessions,
          progress: courseProgress(locale, c.ref, c.title, done),
        };
      }),
    [courses, done, locale],
  );

  if (courses.length === 0) {
    return (
      <p className="mt-4 text-[length:var(--fs-small)] text-muted-foreground">
        {labels.noCourses}
      </p>
    );
  }

  const storeIsBroken = snapshot.outcome === 'unreadable';

  return (
    <section
      aria-labelledby="progress-heading"
      className="mt-(--sp-6) rounded-[length:var(--radius-lg)] border border-border bg-card p-(--sp-5)"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="progress-heading" className="text-[length:var(--fs-h3)]">
          {labels.title}
        </h2>
        <Badge tone="outline">{labels.localOnly}</Badge>
      </div>

      {storeIsBroken && (
        <p role="status" className="mt-3 text-[length:var(--fs-small)] text-muted-foreground">
          {labels.resetNotice}
        </p>
      )}

      <ul role="list" className="mt-5 flex flex-col gap-5">
        {rows.map(({ ref, title, sessions, progress }) => {
          const finished =
            progress.totalSessions > 0 &&
            progress.completedSessions === progress.totalSessions;

          return (
            <li
              key={ref}
              className="border-t border-[var(--color-border-muted)] pt-4 first:border-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/${locale}/${ref}`} className="font-medium hover:text-accent">
                  {title}
                </Link>
                <p className="font-mono text-[length:var(--fs-caption)] text-muted-foreground">
                  {labels.sessionsCompleted}: {progress.completedSessions} {labels.of}{' '}
                  {progress.totalSessions}
                </p>
              </div>

              {/* A real progressbar: the count is the accessible value, and the
                  textual counts beside it are never replaced by the bar. */}
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.totalSessions}
                aria-valuenow={progress.completedSessions}
                aria-valuetext={`${progress.completedSessions} ${labels.of} ${progress.totalSessions}`}
                aria-label={title}
                className="mt-2.5 h-1.5 w-full overflow-hidden rounded-[length:var(--radius-pill)] bg-[var(--color-bg-secondary)]"
              >
                {/* Blue at every fill level: the bar is not an accent-2 surface. */}
                <div
                  className="h-full bg-[var(--color-accent)] transition-[inline-size] duration-[var(--dur-2)] ease-[var(--ease)]"
                  style={{ inlineSize: `${progress.percent}%` }}
                />
              </div>

              <p className="mt-2 text-[length:var(--fs-caption)] text-muted-foreground">
                {finished ? labels.noneLeft : `${labels.remaining}: ${progress.remaining.length}`}
              </p>

              {interactive && sessions.length > 0 && (
                <ul role="list" className="mt-3 flex flex-col gap-1.5">
                  {sessions.map((s) => {
                    const isDone = done.has(s.ref);
                    const inputId = checkboxId(ref, s.ref);
                    return (
                      <li key={s.ref} className="flex items-start gap-2.5">
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={isDone}
                          onChange={(e) => setDone(s.ref, e.target.checked)}
                          className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                        />
                        <label
                          htmlFor={inputId}
                          className="text-[length:var(--fs-small)] leading-[var(--lh-body)]"
                        >
                          {s.title}
                          <span className="sr-only-focusable">
                            {isDone ? ` — ${labels.markNotDone}` : ` — ${labels.markDone}`}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-(--sp-6) border-t border-[var(--color-border-muted)] pt-4">
        <p className="text-[length:var(--fs-caption)] text-muted-foreground">
          {labels.localOnlyBody}
        </p>
        {interactive && snapshot.completed.length > 0 && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={reset}>
              {labels.reset}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}