/**
 * /[locale]/exams — the full exam in this build.
 *
 * Flat, like the skills index. Linked from the About page's contents list.
 * Renders questions and options; cannot be scored (answer key unrecoverable).
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

const SECTION = 'exams';
const TYPE: ContentType = 'exam';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, t } = await loadIndex({ params }, TYPE);
  return indexMetadata(locale, SECTION, t('index.examsHeading'), t('index.examsIntro'));
}

export default async function ExamsIndexPage({ params }: Params) {
  const { locale, t, pages } = await loadIndex({ params }, TYPE);

  return (
    <IndexShell
      locale={locale}
      heading={t('index.examsHeading')}
      intro={t('index.examsIntro')}
      emptyText={t('index.empty')}
      pages={pages}
      items={toFilterable(pages, undefined, 'accent')}
    />
  );
}
