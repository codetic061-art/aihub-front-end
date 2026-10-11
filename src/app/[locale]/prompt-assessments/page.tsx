/**
 * /[locale]/prompt-assessments — the prompt-critique exercises in this build.
 *
 * Flat, like the skills index. Linked from the About page's contents list.
 * Carries the 9-criterion rubric; the rubric is display-only (the keys were
 * never in the prerendered output).
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

const SECTION = 'prompt-assessments';
const TYPE: ContentType = 'prompt-assessment';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, t } = await loadIndex({ params }, TYPE);
  return indexMetadata(
    locale,
    SECTION,
    t('index.promptHeading'),
    t('index.promptIntro'),
  );
}

export default async function PromptAssessmentsIndexPage({ params }: Params) {
  const { locale, t, pages } = await loadIndex({ params }, TYPE);

  return (
    <IndexShell
      locale={locale}
      heading={t('index.promptHeading')}
      intro={t('index.promptIntro')}
      emptyText={t('index.empty')}
      pages={pages}
      items={toFilterable(pages, undefined, 'info')}
    />
  );
}
