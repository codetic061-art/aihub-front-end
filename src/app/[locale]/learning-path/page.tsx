/**
 * /[locale]/learning-path — the individual lesson steps in this build.
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

const SECTION = 'learning-path';
const TYPE: ContentType = 'lesson';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, t } = await loadIndex({ params }, TYPE);
  return indexMetadata(
    locale,
    SECTION,
    t('index.lessonsHeading'),
    t('index.lessonsIntro'),
  );
}

export default async function LearningPathIndexPage({ params }: Params) {
  const { locale, t, pages } = await loadIndex({ params }, TYPE);

  return (
    <IndexShell
      locale={locale}
      heading={t('index.lessonsHeading')}
      intro={t('index.lessonsIntro')}
      emptyText={t('index.empty')}
      pages={pages}
      items={toFilterable(pages, undefined, 'muted')}
    />
  );
}
