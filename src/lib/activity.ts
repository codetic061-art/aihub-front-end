/**
 * LANDING PAGE ACTIVITY FEED.
 *
 * ---------------------------------------------------------------------------
 * HONESTY CONTRACT
 * ---------------------------------------------------------------------------
 * There is no backend feed. Nothing on this site is pushed, streamed or polled
 * at request time: the entire site is prerendered from a build-time content
 * snapshot (`src/content/<locale>.json`). This module exists so the landing
 * page can show *what was actually added to the content* without ever
 * implying a live connection.
 *
 * What that means concretely:
 *   - every item below is a REAL page, with its real title in the requested
 *     locale, taken from the snapshot — nothing is invented here;
 *   - the ordering is deterministic (newest `updated_at`, then `refPath`), so
 *     the same build always produces the same panel in both languages;
 *   - the client rotates emphasis over this fixed list on a fixed interval.
 *     It never fetches, so it cannot claim to be receiving anything.
 *
 * The panel that renders this carries a visible "sample data" marker and says
 * outright that no live feed is behind it.
 *
 * ---------------------------------------------------------------------------
 * THE SEAM FOR A REAL API
 * ---------------------------------------------------------------------------
 * `getActivityFeed()` is the single function a real backend replaces. It is
 * async and takes only a locale, which is exactly the shape a
 * `fetch('/api/activity?locale=ar')` implementation would have. When the
 * endpoint exists, change the body of that one function; the server component,
 * the client panel, the i18n keys and the honesty copy all stay as they are.
 */

import { pagesByType, str, type Locale, type Page } from './data';

/** Which content type each update line describes. One per pack archetype. */
export type ActivityKind = 'concept' | 'session' | 'skill' | 'mcp';

export interface ActivityItem {
  kind: ActivityKind;
  /** Real content refPath — this is a real page, and the panel links to it. */
  refPath: string;
  /** Real title from the snapshot, in the requested locale. */
  title: string;
}

/** Where the data came from. Surfaced in the UI so the claim stays honest. */
export const ACTIVITY_SOURCE = 'content-snapshot' as const;
export type ActivitySource = typeof ACTIVITY_SOURCE;

/**
 * Rotation period, in milliseconds. A constant on purpose: the panel claims to
 * be a timed rotation, so the timing must be declared, not incidental.
 */
export const ACTIVITY_ROTATION_MS = 4200;

/**
 * Newest first, ties broken by refPath. Deterministic across builds and
 * identical in both locales — the tie-break is on the URL, never on the title,
 * because titles are translated and would order the two languages differently.
 */
function byNewestThenRefPath(a: Page, b: Page): number {
  const ua = str(a.frontmatter, 'updated_at') ?? '';
  const ub = str(b.frontmatter, 'updated_at') ?? '';
  if (ua !== ub) return ub.localeCompare(ua);
  return a.refPath.localeCompare(b.refPath);
}

/**
 * Kinds in panel order. Each kind appears once so the panel always names all
 * four kinds of addition the content tree can produce, rather than four skills
 * in a row that read like one long list.
 */
const KIND_ORDER: ActivityKind[] = ['session', 'skill', 'mcp', 'concept'];

/**
 * Build the panel's list from the snapshot. Pure and synchronous — this is a
 * read of prerendered data, not a request to anything.
 */
export function buildActivityFeed(locale: Locale, perKind = 1): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const kind of KIND_ORDER) {
    const pages = pagesByType(locale, kind).slice().sort(byNewestThenRefPath);
    for (const page of pages.slice(0, Math.max(1, perKind))) {
      items.push({ kind, refPath: page.refPath, title: page.title });
    }
  }
  return items;
}

/**
 * The one function a real API would replace. Async so the future implementation
 * can be a fetch without touching any caller.
 */
export async function getActivityFeed(
  locale: Locale,
  perKind = 1,
): Promise<ActivityItem[]> {
  return buildActivityFeed(locale, perKind);
}