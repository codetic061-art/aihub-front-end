/**
 * THE DEPLOYMENT ORIGIN — one constant, one place.
 *
 * Before this module existed the origin was written out three times
 * (`[locale]/layout.tsx`, `[locale]/[...path]/page.tsx`, `components/index-page.tsx`),
 * each with its own copy of the fallback string. Three copies is three chances to
 * promote the real domain and leave two of them behind, and the failure is
 * silent: canonicals on the index pages would point at one host while the
 * content pages point at another, and nothing errors. The three sites that read
 * this file are now the only readers.
 *
 * Canonical URLs, `og:url`, hreflang alternates, the sitemap `<loc>` entries and
 * robots.txt `Sitemap:` all resolve through here, so they cannot disagree —
 * there is no second copy to fall out of date.
 *
 * WHY THE FALLBACK IS `.invalid`
 *
 * RFC 2606 reserves `.invalid` precisely so it can never be registered. A
 * missing `NEXT_PUBLIC_SITE_URL` therefore produces an origin that is obviously
 * wrong and cannot resolve, rather than a plausible-looking host that might
 * belong to somebody else — a guessed real domain is the expensive mistake, and
 * a placeholder that fails loudly costs nothing. `.example` is also reserved but
 * is widely used by real documentation sites; `.invalid` is the stronger signal.
 *
 * TO PROMOTE THE REAL DOMAIN
 *
 *   set NEXT_PUBLIC_SITE_URL=https://<real-host>   (no trailing slash)
 *
 * That single environment variable is the whole change. Nothing else is edited:
 * no literal, no config file, no code. `scripts/verify-launch.ts` fails the build
 * if any emitted absolute URL disagrees with this value.
 */

/** Normalised origin: scheme + host, never a trailing slash. */
function normalise(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed;
}

/**
 * The deployment origin. `NEXT_PUBLIC_SITE_URL` is read at build time, so it must
 * be present in the build environment — inlining it into the client bundle is
 * what lets `metadataBase` resolve the absolute URLs Next emits.
 */
export const SITE_URL = normalise(
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aihub.invalid',
);

/** True when the build is still on the un-promoted placeholder. */
export const SITE_URL_IS_PLACEHOLDER = /\.invalid$/i.test(
  new URL(SITE_URL).hostname,
);

/**
 * Google Search Console verification code, and the name Google requires the
 * HTML-file method to be served under.
 *
 * Two independent methods, deliberately both present:
 *   - the HTML file survives any template edit, because `public/` is copied
 *     verbatim into the build and nothing renders it;
 *   - the meta tag survives a redeploy that drops a hand-uploaded file, because
 *     it lives in the root layout's metadata.
 * Each is lost by a different mistake, so keeping both means neither mistake can
 * silently unverify the property. `scripts/verify-launch.ts` asserts both carry
 * this exact code, that neither is duplicated, and that they agree.
 */
export const GOOGLE_VERIFICATION_CODE = 'googledd514071c836e8ad';

/** The file Google fetches by name: `<code>.html`. */
export const GOOGLE_VERIFICATION_FILE = `${GOOGLE_VERIFICATION_CODE}.html`;

/** The literal Google parses out of the file. Not HTML, not a <meta> tag. */
export const GOOGLE_VERIFICATION_FILE_CONTENT =
  `google-site-verification: ${GOOGLE_VERIFICATION_CODE}`;

/**
 * Absolute URL for a site path. The single way any module builds one, so a
 * relative path can never be accidentally concatenated onto a bare host.
 */
export function siteUrl(path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean === '/' ? `${SITE_URL}/` : `${SITE_URL}${clean}`;
}

/** `/robots.txt` on the production origin. */
export const ROBOTS_URL = siteUrl('/robots.txt');

/** `/sitemap.xml` on the production origin. */
export const SITEMAP_URL = siteUrl('/sitemap.xml');

/**
 * Hosts that must never survive into a canonical, an `og:url`, a sitemap
 * `<loc>` or a robots `Sitemap:` line.
 *
 * This is the list of "we deployed it somewhere temporary and shipped the URL"
 * mistakes. They are all unresolvable-or-wrong rather than harmful, but each one
 * is a real indexing failure: a canonical pointing at a preview host tells a
 * crawler the page does not exist at the production host, which is exactly how a
 * site ends up deindexed while the preview looked perfect.
 */
export const FORBIDDEN_HOST_PATTERNS: readonly RegExp[] = [
  /localhost/i,
  /127\.0\.0\.1/,
  /\[::1\]/,
  /0\.0\.0\.0/,
  /\.local\b/i,
  /preview/i,
  /github\.io/i,
  /githubusercontent\.com/i,
  /pages\.dev/i,
  /workers\.dev/i,
  /trycloudflare\.com/i,
  /vercel\.app/i,
  /netlify\.app/i,
];