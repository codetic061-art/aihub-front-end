/**
 * Locales and URL shape — the two things the EDGE middleware needs.
 *
 * This module is deliberately free of `node:fs` and any other server-only
 * dependency, because `src/middleware.ts` imports it and middleware runs on the
 * edge runtime. The filesystem-backed content reader lives in `content.ts`,
 * which the middleware never touches.
 *
 * Single source of truth for both: if a locale is added here, routing, the
 * language switcher and the content loader all pick it up.
 */

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export const DEFAULT_LOCALE: Locale = 'en';

/** Direction for a locale. Arabic is RTL; everything else is LTR. */
export function dirFor(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** URL segment per content type, per the project's `docs/url-routing.md`. */
export const TYPE_DIRS = {
  docs: 'docs',
  lesson: 'learning-path',
  skill: 'skills',
  mcp: 'mcp',
  'free-credit': 'free-credits',
  course: 'courses',
  session: 'sessions',
  quiz: 'quizzes',
  exam: 'exams',
  concept: 'concepts',
  'prompt-assessment': 'prompt-assessments',
} as const;

export type ContentType = keyof typeof TYPE_DIRS;

export const ALL_TYPES = Object.keys(TYPE_DIRS) as ContentType[];

/** Inverse of TYPE_DIRS: URL segment → content type. */
export const TYPE_BY_DIR: Record<string, ContentType> = Object.fromEntries(
  (Object.entries(TYPE_DIRS) as [ContentType, string][]).map(([type, dir]) => [dir, type]),
);

/**
 * Split a locale-prefixed path into its parts.
 * `/ar/concepts/token` → { locale: 'ar', segments: ['concepts', 'token'] }
 * Returns null when the first segment is not a locale.
 */
export function splitLocalePath(pathname: string): {
  locale: Locale;
  segments: string[];
} | null {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  const [first, ...rest] = clean.split('/');
  if (!isLocale(first)) return null;
  return { locale: first, segments: rest };
}