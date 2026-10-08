/**
 * Local progress store — deterministic, browser-local, no server.
 *
 * WHAT THIS IS NOT
 *
 * There is no accounts table, no sync endpoint and no attempt ledger in this
 * project. `workers/src/index.ts` serves no write routes at all. So everything
 * here lives in one `localStorage` key, is namespaced per locale, and never
 * claims to be a server record. Clearing site data clears it, and two browsers
 * do not see each other — which is why every surface that renders it says so
 * in words rather than implying cloud state.
 *
 * WHY THE COUNT IS COMPUTED, NOT STORED
 *
 * `total` for a course is derived from the real content snapshot: the sessions
 * that name this course's modules, found by reverse lookup (the same rule
 * `components/learning-tree.tsx` uses, because the content declares the tree in
 * one direction only). Storing a total would let it drift from the content; a
 * computed one cannot. `done` is whatever the learner has marked, intersected
 * with sessions that still exist — a deleted session silently leaves the
 * denominator rather than inflating the numerator.
 */

import { useCallback, useEffect, useState } from 'react';

import { modulePagesFor, pagesByType, sessionPagesFor, type Locale } from './data';

const STORAGE_KEY = 'aihub:progress:v1';
const SCHEMA_VERSION = 1;

export interface ProgressState {
  v: number;
  /** Session refPaths (locale-independent) the learner has marked done. */
  completed: string[];
  /** ISO timestamps of each completion, parallel to `completed`. */
  completedAt: string[];
}

/** Every state the store can produce. Each is a valid answer, not an error. */
export type ProgressOutcome = 'unreadable' | 'empty' | 'loaded';

export interface ProgressSnapshot {
  outcome: ProgressOutcome;
  completed: string[];
  completedAt: string[];
}

function emptyState(): ProgressState {
  return { v: SCHEMA_VERSION, completed: [], completedAt: [] };
}

/**
 * Read persisted state. Never throws and never rejects: a corrupt value is
 * reported as `unreadable` so the UI can say the store was reset rather than
 * silently showing zeros as if the learner had done nothing.
 */
export function readProgress(): ProgressSnapshot {
  if (typeof window === 'undefined') {
    return { outcome: 'unreadable', completed: [], completedAt: [] };
  }
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode / disabled storage.
    return { outcome: 'unreadable', completed: [], completedAt: [] };
  }
  if (!raw) return { outcome: 'empty', completed: [], completedAt: [] };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { outcome: 'unreadable', completed: [], completedAt: [] };
    }
    const rec = parsed as Record<string, unknown>;
    if (rec['v'] !== SCHEMA_VERSION) {
      return { outcome: 'unreadable', completed: [], completedAt: [] };
    }
    const completed = Array.isArray(rec['completed'])
      ? rec['completed'].filter((x): x is string => typeof x === 'string')
      : [];
    const completedAt = Array.isArray(rec['completedAt'])
      ? rec['completedAt'].filter((x): x is string => typeof x === 'string')
      : [];
    return { outcome: 'loaded', completed, completedAt };
  } catch {
    return { outcome: 'unreadable', completed: [], completedAt: [] };
  }
}

function writeProgress(next: ProgressState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Hooks                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The raw store: read on mount, write on demand. Not read during render on the
 * server — the first paint always matches the prerendered HTML, then the stored
 * values hydrate in. This is what keeps the pages statically renderable.
 */
export function useProgress(): {
  snapshot: ProgressSnapshot;
  /** Ids marked done, as a Set for O(1) membership. */
  done: ReadonlySet<string>;
  setDone: (id: string, done: boolean) => void;
  reset: () => void;
} {
  const [snapshot, setSnapshot] = useState<ProgressSnapshot>({
    outcome: 'empty',
    completed: [],
    completedAt: [],
  });

  useEffect(() => {
    setSnapshot(readProgress());
  }, []);

  const persist = useCallback((next: ProgressState) => {
    writeProgress(next);
    setSnapshot({
      outcome: 'loaded',
      completed: next.completed,
      completedAt: next.completedAt,
    });
  }, []);

  const setDone = useCallback(
    (id: string, done: boolean) => {
      const current = readProgress();
      // Rebuild both arrays in lockstep so `completedAt[i]` always describes
      // `completed[i]`. Filtering them independently would drift the pairing.
      const pairs = current.completed
        .map((ref, i) => ({ ref, at: current.completedAt[i] }))
        .filter((p) => p.ref !== id);
      if (done) pairs.push({ ref: id, at: new Date().toISOString() });
      persist({
        v: SCHEMA_VERSION,
        completed: pairs.map((p) => p.ref),
        completedAt: pairs.map((p) => p.at),
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    persist(emptyState());
  }, [persist]);

  const done = new Set(snapshot.completed);
  return { snapshot, done, setDone, reset };
}

/* -------------------------------------------------------------------------- */
/* Derived course progress                                                      */
/* -------------------------------------------------------------------------- */

export interface CourseProgress {
  /** `courses/<slug>` — the course index refPath. */
  courseRef: string;
  courseTitle: string;
  /** Session refPaths that exist in this locale's snapshot. */
  totalSessions: number;
  /** How many of those the learner has marked done. */
  completedSessions: number;
  /** Integer 0-100. Zero when the course has no sessions to complete. */
  percent: number;
  /** Session refPaths still open, in `position` order. */
  remaining: string[];
}

/**
 * Sessions of a course, resolved the same way `LearningTree` resolves them:
 * course → modules that name it → sessions that name those modules.
 *
 * `sessionPagesFor` keys off the course directory (`sessions/<slug>/…`), which
 * is what every real session in the snapshot uses. `LearningTree` falls back to
 * matching `module` refs when that lookup is empty; this does too, so the
 * denominator cannot disagree with the tree printed directly above it.
 */
export function sessionsForCourse(
  locale: Locale,
  courseRef: string,
): { ref: string; title: string }[] {
  const prefix = courseRef.replace(/\/index$/, '');
  const modules = new Set(modulePagesFor(locale, prefix).map((m) => m.refPath));

  const viaDirectory = sessionPagesFor(locale, prefix);
  const viaModule = pagesByType(locale, 'session').filter((s) => {
    const moduleRef = s.frontmatter['module'];
    return typeof moduleRef === 'string' && modules.has(moduleRef);
  });

  const seen = new Set<string>();
  const out: { ref: string; title: string }[] = [];
  for (const s of [...viaDirectory, ...viaModule]) {
    if (seen.has(s.refPath)) continue;
    seen.add(s.refPath);
    out.push({ ref: s.refPath, title: s.title });
  }
  return out;
}

/** Build the deterministic per-course progress record. */
export function courseProgress(
  locale: Locale,
  courseRef: string,
  courseTitle: string,
  done: ReadonlySet<string>,
): CourseProgress {
  const sessions = sessionsForCourse(locale, courseRef);
  const remaining = sessions.filter((s) => !done.has(s.ref)).map((s) => s.ref);
  const completedSessions = sessions.length - remaining.length;
  return {
    courseRef,
    courseTitle,
    totalSessions: sessions.length,
    completedSessions,
    // Guard the divide: a course with no sessions reads 0%, not NaN.
    percent: sessions.length === 0 ? 0 : Math.round((completedSessions / sessions.length) * 100),
    remaining,
  };
}