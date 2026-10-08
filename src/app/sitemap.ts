import type { MetadataRoute } from 'next';

import { LOCALES, DEFAULT_LOCALE, allPages } from '@/lib/data';
import { siteUrl } from '@/lib/site';
import { SECTIONS } from '@/components/policy-pages';

/**
 * The sitemap.
 *
 * Built as a framework route (`app/sitemap.ts`) rather than a static file in
 * `public/`, for one reason: a static file is a second copy of the origin. It
 * goes stale the moment the domain changes and nothing fails — the site keeps
 * 200-ing while telling Google to crawl a host that no longer exists. Deriving
 * it here means the `<loc>` entries and the canonicals are computed from the same
 * `SITE_URL`, so they cannot disagree.
 *
 * WHAT IS LISTED
 *
 * Every real page in the snapshot, in BOTH locales as separate URLs — not one
 * entry with two alternates. Google indexes each locale separately; it needs its
 * own `<url>` entry with its own `<loc>` to do that. The alternates block then
 * tells it which entries are translations of each other, plus `x-default` for
 * readers whose language matches neither.
 *
 * The static index routes (`/en/concepts`, `/en/skills`, `/en/mcp`,
 * `/en/docs`) are real, crawlable, indexable destinations with their own
 * canonicals — the landing page links to them and `indexMetadata()` gives them
 * hreflang — so they belong in a sitemap. Excluded: `/api/*` (not content, and
 * disallow-worthy) and the 404.
 *
 * NOT LISTED: the bot review sheet. It was a design tool — every pose and
 * expression side by side, unlinked, deletable once the design froze. Listing a
 * page here that no longer exists invites Google to crawl a 404, and a sitemap
 * that names dead URLs is the fastest way to get a crawl budget downgraded. If
 * a route is not public, it does not belong here.
 *
 * `lastModified` is deliberately omitted rather than invented. A `lastModified`
 * that never changes teaches Google to ignore the field; one that changes on
 * every deploy because the build ran teaches it to ignore the field HARDER, and
 * pages get crawled at the freshness you always claim. Real change dates live in
 * each page's `updated_at` frontmatter and are rendered on the page itself.
 */

export const dynamic = 'force-static';

/** Static segments above the catch-all that are real destinations. */
/**
 * hreflang alternates for one locale-prefixed path.
 *
 * Each alternate is the same path under every locale, and `x-default` points at
 * the default locale — which is what Google falls back to for a reader it cannot
 * match to a language.
 */
function alternates(pathSuffix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of LOCALES) {
    out[locale] = siteUrl(`/${locale}${pathSuffix}`);
  }
  out['x-default'] = siteUrl(`/${DEFAULT_LOCALE}${pathSuffix}`);
  return out;
}

/**
 * One entry per locale per path.
 *
 * The homepage is included because `routing.localePrefix: 'always'` means
 * `/en` and `/ar` are the only entry points to the site — there is no unprefixed
 * `/` to redirect from — so omitting them would hide the front door from a crawl
 * that starts at the sitemap.
 */
function buildEntries(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  const push = (
    pathSuffix: string,
    priority: number,
    changeFrequency: 'daily' | 'weekly' | 'monthly',
  ) => {
    for (const locale of LOCALES) {
      entries.push({
        url: siteUrl(`/${locale}${pathSuffix}`),
        changeFrequency,
        priority,
        alternates: { languages: alternates(pathSuffix) },
      });
    }
  };

  // Homepages. High priority and recrawled often: they are the most linked-to
  // URLs on the site and the landing page's content changes with the feed.
  push('', 1.0, 'daily');

  // The four standing pages (About, Contact, Privacy, Terms). These are code
  // routes, not content records, so the snapshot loop below cannot find them —
  // the sections are imported from the component that owns the routes rather
  // than listed here, so adding a fifth policy page cannot silently miss the
  // sitemap.
  for (const section of Object.keys(SECTIONS)) {
    push(`/${section}`, 0.3, 'monthly');
  }

  // The four browse indexes. Each is a real destination linked from the landing
  // page; keep this list in step with `src/app/[locale]/*/page.tsx`.
  push('/concepts', 0.9, 'weekly');
  push('/skills', 0.9, 'weekly');
  push('/mcp', 0.9, 'weekly');
  push('/docs', 0.9, 'weekly');

  // Every content page, read from the snapshot rather than a hand-kept list, so
  // the sitemap cannot drift from what is actually built. Two locales × 85.
  for (const locale of LOCALES) {
    for (const page of allPages(locale)) {
      entries.push({
        url: siteUrl(`/${locale}/${page.refPath}`),
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: { languages: alternates(`/${page.refPath}`) },
      });
    }
  }

  return entries;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return dedupeEntries(buildEntries());
}

/**
 * Duplicates are a real failure mode here, not a hypothetical: the index
 * sections above and the per-page loop are two separate sources of paths, so a
 * future content page whose refPath happened to be `concepts` would emit the
 * same `<loc>` twice, and Google treats one copy as a duplicate and drops it.
 * Collapsing here makes the invariant structural instead of something a separate
 * gate has to notice. First occurrence wins, so the higher-priority entry above
 * is the one kept.
 */
function dedupeEntries(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  const out: MetadataRoute.Sitemap = [];
  for (const entry of entries) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    out.push(entry);
  }
  return out;
}

/** Exported for `scripts/verify-launch.ts`, which asserts the emitted count. */
export { buildEntries as buildSitemapEntries };
