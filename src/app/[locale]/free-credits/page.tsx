/**
 * /[locale]/free-credits — vendor free-credit offers referenced by the site.
 *
 * Flat, like the skills index: a single grouping axis does not exist in the
 * snapshot for these pages. The footer "Learn" column links here.
 */
import type { Metadata } from 'next';

import {
  IndexShell,
  generateStaticParams,
  indexMetadata,
  loadIndex,
  toFilterable,
} from '@/components/index-page';
import type { ContentType } from '@/lib/locales';

export { generateStaticParams };

const SECTION = 'free-credits';
const TYPE: ContentType = 'free-credit';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, t } = await loadIndex({ params }, TYPE);
  return indexMetadata(locale, SECTION, t('nav.credits'), t('index.creditsIntro'));
}

export default async function FreeCreditsIndexPage({ params }: Params) {
  const { locale, t, pages } = await loadIndex({ params }, TYPE);

  return (
    <IndexShell
      locale={locale}
      heading={t('nav.credits')}
      intro={t('index.creditsIntro')}
      emptyText={t('index.empty')}
      pages={pages}
      items={toFilterable(pages, undefined, 'info')}
    />
  );
}
