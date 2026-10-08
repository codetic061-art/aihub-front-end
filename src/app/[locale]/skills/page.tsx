/**
 * /[locale]/skills — every skill pack, SDK and plugin collection in the snapshot
 *
 * No grouping: the packs share no single axis worth sorting on, so they stay in
 * title order and the filter does the narrowing.
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

const SECTION = 'skills';
const TYPE: ContentType = 'skill';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, t } = await loadIndex({ params }, TYPE);
  return indexMetadata(locale, SECTION, t('nav.skills'), t('index.skillsIntro'));
}

export default async function SkillsIndexPage({ params }: Params) {
  const { locale, t, pages } = await loadIndex({ params }, TYPE);

  return (
    <IndexShell
      locale={locale}
      heading={t('nav.skills')}
      intro={t('index.skillsIntro')}
      emptyText={t('index.empty')}
      pages={pages}
      items={toFilterable(pages, undefined, 'info')}
    />
  );
}
