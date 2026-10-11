/**
 * /[locale]/quizzes — the short comprehension checks in this build.
 *
 * Flat, like the skills index. Linked from the About page's contents list.
 * These render questions and options; they cannot be scored because the answer
 * keys were never part of the prerendered output (see the assessment gate).
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

const SECTION = 'quizzes';
const TYPE: ContentType = 'quiz';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, t } = await loadIndex({ params }, TYPE);
  return indexMetadata(locale, SECTION, t('index.quizzesHeading'), t('index.quizzesIntro'));
}

export default async function QuizzesIndexPage({ params }: Params) {
  const { locale, t, pages } = await loadIndex({ params }, TYPE);

  return (
    <IndexShell
      locale={locale}
      heading={t('index.quizzesHeading')}
      intro={t('index.quizzesIntro')}
      emptyText={t('index.empty')}
      pages={pages}
      items={toFilterable(pages, undefined, 'accent')}
    />
  );
}
