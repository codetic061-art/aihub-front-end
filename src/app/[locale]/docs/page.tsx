/**
 * /[locale]/docs — setup and reference documentation, grouped by category
 *
 * Grouped by the `category` each page declares. In this build that is the
 * product the page documents (`claude-code`), NOT a lifecycle stage — so the
 * groups are sorted rather than forced into an invented install/configure/
 * reference order that no real group belongs to.
 */
import type { Metadata } from 'next';

import {
  IndexShell,
  generateStaticParams,
  indexMetadata,
  loadIndex,
  toFilterable,
} from '@/components/index-page';
import { str } from '@/lib/data';
import type { ContentType } from '@/lib/locales';

/** Sorted alphabetically; see the note above on what `category` actually holds. */
const DOC_CATEGORY_ORDER = ['claude-code'] as const;

export { generateStaticParams };

const SECTION = 'docs';
const TYPE: ContentType = 'docs';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, t } = await loadIndex({ params }, TYPE);
  return indexMetadata(locale, SECTION, t('nav.docs'), t('index.docsIntro'));
}

export default async function DocsIndexPage({ params }: Params) {
  const { locale, t, pages } = await loadIndex({ params }, TYPE);

  // Same rule as the concepts index: a category is a machine key unless labelled.
  const groupLabels = Object.fromEntries(
    DOC_CATEGORY_ORDER.map((category) => [category, t(`index.categories.${category}`)]),
  );

  return (
    <IndexShell
      locale={locale}
      heading={t('nav.docs')}
      intro={t('index.docsIntro')}
      emptyText={t('index.empty')}
      pages={pages}
      items={toFilterable(pages, (page) => str(page.frontmatter, 'category'), 'muted')}
      groupOrder={DOC_CATEGORY_ORDER}
      groupLabels={groupLabels}
    />
  );
}
