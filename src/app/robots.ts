import type { MetadataRoute } from 'next';

import { SITEMAP_URL } from '@/lib/site';

/**
 * robots.txt.
 *
 * A framework route (`app/robots.ts`) rather than a static file in `public/`,
 * for the same reason the sitemap is: a static robots.txt is a second copy of the
 * origin, and a stale one is worse than none. `Sitemap:` pointing at a host that
 * no longer resolves makes Google log a fetch error on every crawl and eventually
 * stop fetching it, and nothing in the app reports that. Building it here means
 * the `Sitemap:` line is computed from the same `SITE_URL` as every canonical.
 *
 * `next-intl`'s locale prefix is why the path list below is structured the way it
 * is: every real URL on this site begins with `/en` or `/ar`, because
 * `routing.localePrefix: 'always'`. There is no unprefixed `/` to protect, and
 * no admin, private or staging section — the whole site is public content.
 *
 * WHAT IS AND IS NOT DISALLOWED
 *
 *   /api/       — the search index. It is an internal implementation detail for
 *                 the client-side dialog, not content, and indexing a JSON
 *                 endpoint wastes crawl budget. Disallowing it is advisory only:
 *                 Google has to be able to fetch a URL to see the robots rule, and
 *                 that costs crawl budget it will not spend here.
 *
 * Nothing else is disallowed. In particular there is deliberately no
 * `Disallow: /` — that instruction means "crawl nothing", which is the exact
 * opposite of a site preparing to launch. It is the single highest-cost typo
 * available in this file, because it produces no error anywhere: every page still
 * 200s, the site still looks perfect locally, and the property is simply never
 * indexed.
 *
 * The verification file is NOT disallowed. It must stay crawlable — that is the
 * entire mechanism by which Google confirms ownership.
 */

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
      {
        // Googlebot is declared explicitly rather than relying on the wildcard
        // above. It is redundant today and that is the point: it documents that
        // Google is a first-class intended reader of this site, and if the
        // wildcard rule is ever edited, narrowed or dropped by mistake, this
        // block still says the thing that matters most.
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: SITEMAP_URL,
  };
}