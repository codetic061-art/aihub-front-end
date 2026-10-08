import { defineRouting } from 'next-intl/routing';
import { LOCALES } from '@/lib/locales';

/**
 * Routing — one locale-prefixed URL space for both languages.
 *
 * Mirrors the backend contract exactly (`docs/url-routing.md`): a page lives at
 * `/<lang>/<type-dir>/<subpath>/<slug>`, so the frontend adds no translation of
 * its own and every canonical/hreflang URL the SEO layer emits keeps working.
 *
 * `localePrefix: 'always'` — /en/… and /ar/… are both real URLs. That is what
 * lets the language switcher keep a reader on the equivalent page instead of
 * bouncing them to a homepage.
 *
 * The locale list is imported from ./locales rather than repeated, so a new
 * language only has to be added in one place. That module is edge-safe (no
 * node:fs), which matters because the middleware imports this file.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'en',
  localePrefix: 'always',
  // The URL prefix already namespaces content by locale; no extra prefix needed.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];