/**
 * /[locale]/courses — every course in the snapshot.
 *
 * Flat, like the skills index: the snapshot carries no field these pages could
 * be grouped on, so they stay in title order and the filter does the narrowing.
 * The header nav and the footer "Learn" column have always linked here; this
 * route is what makes that link land instead of hitting the 404 catch-all.
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

const SECTION = 'courses';
const TYPE: ContentType = 'course';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, t } = await loadIndex({ params }, TYPE);
  return indexMetadata(locale, SECTION, t('nav.courses'), t('index.coursesIntro'));
}

export default async function CoursesIndexPage({ params }: Params) {
  const { locale, t, pages } = await loadIndex({ params }, TYPE);

  return (
    <IndexShell
      locale={locale}
      heading={t('nav.courses')}
      intro={t('index.coursesIntro')}
      emptyText={t('index.empty')}
      pages={pages}
      items={toFilterable(pages, undefined, 'accent')}
    />
  );
}
