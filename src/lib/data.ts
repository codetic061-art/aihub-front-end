/**
 * RUNTIME content access.
 *
 * Reads the build-time snapshot produced by `scripts/ingest-content.ts`
 * (MDX → `src/content/<locale>.json`). No `node:fs`, no path resolution, no
 * filesystem tracing — so any module here can be imported by a Server
 * Component, and the whole site stays statically renderable.
 *
 * This is the ONLY module templates should use. Keeping the boundary here is
 * what makes "170 pages from one template" true rather than aspirational.
 */
import enData from '@/content/en.json';
import arData from '@/content/ar.json';

import {
  ALL_TYPES,
  TYPE_DIRS,
  TYPE_BY_DIR,
  LOCALES,
  isLocale,
  dirFor,
  splitLocalePath,
  DEFAULT_LOCALE,
  type ContentType,
  type Locale,
} from './locales';

export {
  ALL_TYPES,
  TYPE_DIRS,
  TYPE_BY_DIR,
  LOCALES,
  isLocale,
  dirFor,
  splitLocalePath,
  DEFAULT_LOCALE,
  type ContentType,
  type Locale,
};

/* -------------------------------------------------------------------------- */
/* Snapshot shape                                                              */
/* -------------------------------------------------------------------------- */

export interface Page {
  /** `/<type-dir>/<subpath>/<slug>` — the path AFTER the locale prefix. */
  refPath: string;
  type: ContentType;
  title: string;
  description: string;
  summary: string;
  tags: string[];
  frontmatter: Record<string, unknown>;
  body: string;
  words: number;
}

/* -------------------------------------------------------------------------- */
/* Frontmatter readers — tolerant, never throwing                             */
/* -------------------------------------------------------------------------- */
/* A projection must not take a page down: a missing optional field renders as
   absent, not as a 500. Anything genuinely required is validated upstream by the
   project's own content validator, not here. */

export function str(fm: Record<string, unknown>, key: string): string | undefined {
  const v = fm[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

export function num(fm: Record<string, unknown>, key: string): number | undefined {
  const v = fm[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function list(fm: Record<string, unknown>, key: string): string[] {
  const v = fm[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export interface Resource {
  title?: string;
  url?: string;
}
export function resources(fm: Record<string, unknown>, key: string): Resource[] {
  const v = fm[key];
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is Resource => typeof x === 'object' && x !== null,
  );
}

export interface GlossaryEntry {
  term?: string;
  definition?: string;
}
export function glossary(fm: Record<string, unknown>): GlossaryEntry[] {
  const v = fm['glossary'];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is GlossaryEntry => typeof x === 'object' && x !== null);
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

const CACHE = new Map<Locale, Page[]>();

function pagesFor(locale: Locale): Page[] {
  const cached = CACHE.get(locale);
  if (cached) return cached;
  const raw = locale === 'ar' ? arData : enData;
  const list = raw as unknown as Page[];
  CACHE.set(locale, list);
  return list;
}

export function allPages(locale: Locale): Page[] {
  return pagesFor(locale);
}

export function getPage(locale: Locale, refPath: string): Page | undefined {
  const clean = refPath.replace(/^\/+|\/+$/g, '');
  return pagesFor(locale).find((p) => p.refPath === clean);
}

export function pagesByType(locale: Locale, type: ContentType): Page[] {
  return pagesFor(locale).filter((p) => p.type === type);
}

/** Every page under a type-dir subpath, e.g. `courses/ai-fundamentals`. */
export function pagesUnder(locale: Locale, prefix: string): Page[] {
  const clean = prefix.replace(/^\/+|\/+$/g, '');
  return pagesFor(locale).filter((p) => p.refPath === clean || p.refPath.startsWith(`${clean}/`));
}

/** Resolve a pageref from frontmatter to a page in the same locale. */
export function resolveRef(locale: Locale, ref: string | undefined): Page | undefined {
  if (!ref) return undefined;
  return getPage(locale, ref);
}

/** Resolve many, dropping the ones that do not exist. Never throws. */
export function resolveRefs(locale: Locale, refs: string[]): Page[] {
  return refs
    .map((r) => resolveRef(locale, r))
    .filter((p): p is Page => Boolean(p));
}

/** Sorted by `position` when present, then title. Used for sessions in a course. */
export function sortByPosition(pages: Page[]): Page[] {
  return [...pages].sort((a, b) => {
    const pa = num(a.frontmatter, 'position') ?? Number.MAX_SAFE_INTEGER;
    const pb = num(b.frontmatter, 'position') ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.title.localeCompare(b.title);
  });
}

/** Course index pages only (courses/<slug>/index), not the module pages. */
export function courseIndexPages(locale: Locale): Page[] {
  return pagesByType(locale, 'course').filter((p) => p.refPath.endsWith('/index'));
}

export function modulePagesFor(locale: Locale, coursePrefix: string): Page[] {
  return pagesByType(locale, 'course').filter(
    (p) => p.refPath.startsWith(`${coursePrefix}/`) && !p.refPath.endsWith('/index'),
  );
}

export function sessionPagesFor(locale: Locale, coursePrefix: string): Page[] {
  return pagesByType(locale, 'session').filter((p) =>
    p.refPath.startsWith(`sessions/${coursePrefix.replace(/^courses\//, '')}/`),
  );
}

/* -------------------------------------------------------------------------- */
/* Derived display helpers                                                     */
/* -------------------------------------------------------------------------- */

/** Reading time in whole minutes, at a deliberate 200 words per minute. */
export function readingMinutes(page: Page): number {
  return Math.max(1, Math.round(page.words / 200));
}

export function pageTitle(page: Page): string {
  return page.title || page.refPath;
}

/** Breadcrumb trail for a page, derived from its refPath. */
export function breadcrumbsFor(page: Page): { label: string; href: string | null }[] {
  const segments = page.refPath.split('/');
  const dir = segments[0];
  const type = TYPE_BY_DIR[dir];
  const crumbs: { label: string; href: string | null }[] = [
    { label: type ? type.replace(/-/g, ' ') : dir, href: `/${dir}` },
  ];
  let acc = '';
  for (let i = 1; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const isLast = i === segments.length - 1;
    crumbs.push({
      label: isLast ? pageTitle(page) : segments[i],
      href: isLast ? null : acc,
    });
  }
  return crumbs;
}