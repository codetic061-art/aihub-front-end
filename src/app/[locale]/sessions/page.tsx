/**
 * /[locale]/sessions — the guided walkthroughs in this build.
 *
 * Flat, like the skills index. Linked from the About page's contents list.
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

const SECTION = 'sessions';
const TYPE: ContentType = 'session';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, t } = await loadIndex({ params }, TYPE);
  return indexMetadata(locale, SECTION, t('index.sessionsHeading'), t('index.sessionsIntro'));
}

export default async function SessionsIndexPage({ params }: Params) {
  const { locale, t, pages } = await loadIndex({ params }, TYPE);

  return (
    <IndexShell
      locale={locale}
      heading={t('index.sessionsHeading')}
      intro={t('index.sessionsIntro')}
      emptyText={t('index.empty')}
      pages={pages}
      items={toFilterable(pages, undefined, 'info')}
    />
  );
}
