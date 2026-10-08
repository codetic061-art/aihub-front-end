import { LOCALES, allPages, type Locale } from '@/lib/data';
import { buildSearchIndex } from '@/lib/search';

/**
 * The search index, as static JSON.
 *
 * Why a route at all: the dialog needs the searchable data IN THE BROWSER, and
 * `@/lib/data` is a server module that statically imports both 500 KB locale
 * snapshots. Serving a projected, body-truncated index over HTTP keeps ~270 KB
 * of article text out of every page's JS bundle.
 *
 * It is fully STATIC: `generateStaticParams` + `force-static` means both locales
 * are prerendered at build time and this handler never runs on a request.
 */

export const dynamic = 'force-static';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale } = await params;
  const known = (LOCALES as readonly string[]).includes(locale) ? (locale as Locale) : 'en';

  const index = buildSearchIndex(known, allPages(known));

  return new Response(JSON.stringify({ locale: known, docs: index }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Content-addressed by build: a new deploy ships a new index, so the
      // browser must not serve a stale one from memory.
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  });
}