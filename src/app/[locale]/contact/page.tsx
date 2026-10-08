import PolicyPage, { makeMetadata } from '@/components/policy-pages';
import type { Locale } from '@/lib/locales';

/**
 * /contact
 *
 * Thin route wrapper. The page body lives in `policy-pages.tsx` so all four
 * standing pages share one layout, one metadata shape and one corpus-count
 * dependency — see that file for why these pages exist at all.
 *
 * `generateMetadata` must be re-exported HERE as well as implemented there:
 * Next.js only reads metadata exports from the route segment, so omitting it
 * silently falls back to the layout's title and canonical.
 */
export const generateMetadata = makeMetadata('contact');

export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale; page: string }>;
}) {
  const { locale } = await params;
  return <PolicyPage locale={locale} page="contact" />;
}
