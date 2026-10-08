/**
 * /[locale]/concepts — every concept page, grouped by the `domain` it declares.
 *
 * The group order is fixed in `CONCEPT_DOMAIN_ORDER` rather than sorted by
 * title, because a reader arriving here wants the foundations first and the
 * topics that build on them after; an alphabetical mix of `evaluation`,
 * `prompting` and `safety` teaches nothing about how the subject is layered.
 */
import type { Metadata } from 'next';

import {
  CONCEPT_DOMAIN_ORDER,
  IndexShell,
  generateStaticParams,
  indexMetadata,
  loadIndex,
  toFilterable,
} from '@/components/index-page';
import { str } from '@/lib/data';
import type { ContentType } from '@/lib/locales';

export { generateStaticParams };

const SECTION = 'concepts';
const TYPE: ContentType = 'concept';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, t } = await loadIndex({ params }, TYPE);
  return indexMetadata(locale, SECTION, t('nav.concepts'), t('index.conceptsIntro'));
}

export default async function ConceptsIndexPage({ params }: Params) {
  const { locale, t, pages } = await loadIndex({ params }, TYPE);

  /*
   * Every group the snapshot actually uses, labelled. `CONCEPT_DOMAIN_ORDER`
   * lists the ten declared domains, but only those present in the content get a
   * heading — the grid drops absent keys — so the label map covers the same set.
   */
  const groupLabels = Object.fromEntries(
    CONCEPT_DOMAIN_ORDER.map((domain) => [domain, t(`index.domains.${domain}`)]),
  );

  return (
    <IndexShell
      locale={locale}
      heading={t('nav.concepts')}
      intro={t('index.conceptsIntro')}
      emptyText={t('index.empty')}
      pages={pages}
      items={toFilterable(pages, (page) => str(page.frontmatter, 'domain'), 'accent')}
      groupOrder={CONCEPT_DOMAIN_ORDER}
      groupLabels={groupLabels}
    />
  );
}
