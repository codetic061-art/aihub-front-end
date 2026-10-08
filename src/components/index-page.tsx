import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  LOCALES,
  isLocale,
  pagesByType,
  str,
  type Locale,
  type Page,
  type ContentType,
} from '@/lib/data';
import { DEFAULT_LOCALE } from '@/lib/locales';
import { siteUrl } from '@/lib/site';
import { Header, Footer } from '@/components/site-chrome';
import { SearchDialog } from '@/components/search-dialog';
import { FilterableGrid, type FilterableItem } from '@/components/filterable-grid';
import { ResourceCard } from '@/components/ui/card';

/**
 * THE BROWSE INDEX.
 *
 * One template for all four discovery surfaces. The nav has always pointed at
 * `/concepts`, `/skills`, `/mcp` and `/docs`; before this existed those URLs hit
 * the catch-all, which looked for a content page whose refPath was exactly
 * `concepts` — and none exists, because every real refPath has a second segment.
 * So the four destinations in the header were all dead links.
 *
 * These are STATIC SEGMENTS that sit above the catch-all `[...path]`, which Next
 * resolves in the opposite order: a concrete `app/[locale]/concepts/page.tsx`
 * wins over `[locale]/[...path]`. Individual pages (`/en/concepts/agent`) are
 * unaffected — the catch-all still serves every one of them, because a
 * single-segment refPath does not exist in the snapshot and so cannot collide
 * with an index. `scripts/verify-routes.ts` asserts exactly that.
 *
 * Intro copy is NOT written here. Each route passes a string it resolved from
 * `t('index.…')`, so both locales are checked by `verify-messages.ts` and no
 * prose is invented inside a template.
 */

type Params = { params: Promise<{ locale: string }> };

/**
 * Concept `domain` values, in the order the content tree uses them.
 * Read from the snapshot, not assumed: an unseen domain is appended at the end
 * rather than dropped, so adding a domain cannot silently hide those concepts.
 */
export const CONCEPT_DOMAIN_ORDER = [
  'fundamentals',
  'agents',
  'model-behavior',
  'prompting',
  'retrieval',
  'tooling',
  'mcp',
  'infrastructure',
  'evaluation',
  'safety',
] as const;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/** Canonical + hreflang, identical in shape to the content pages'. */
export function indexMetadata(
  locale: Locale,
  section: string,
  title: string,
  description: string,
): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: siteUrl(`/${locale}/${section}`),
      // Same shape as every other page's alternates: both locales plus
      // `x-default`, all absolute and all off the one origin constant.
      languages: {
        ...Object.fromEntries(
          LOCALES.map((l) => [l, siteUrl(`/${l}/${section}`)]),
        ),
        'x-default': siteUrl(`/${DEFAULT_LOCALE}/${section}`),
      },
    },
    robots: { index: true, follow: true },
  };
}

/**
 * Everything the four routes share: locale validation, the real page list and
 * the translations. Returns data rather than JSX so each route keeps control of
 * its own layout order.
 */
export async function loadIndex({ params }: Params, type: ContentType) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  // Required for static rendering: without it the locale-dependent messages opt
  // the whole tree out of prerendering.
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const pages = pagesByType(locale, type).sort((a, b) =>
    a.title.localeCompare(b.title, locale),
  );

  return { locale, t, pages };
}

/**
 * The filter rows.
 *
 * `searchText` is exactly what the card shows — title, description, tags — so
 * the filter can never match something the reader cannot see on the card.
 */
export function toFilterable(
  pages: Page[],
  groupOf?: (page: Page) => string | undefined,
  accentDot: 'accent' | 'info' | 'muted' = 'muted',
): FilterableItem[] {
  return pages.map((page) => ({
    refPath: page.refPath,
    searchText: [page.title, page.description, ...page.tags].join(' '),
    group: groupOf?.(page),
    title: page.title,
    description: page.description,
    meta: updatedMeta(page),
    accentDot,
  }));
}

/** Heading + honest intro + the filtered card grid, shared by all four routes. */
export function IndexShell({
  locale,
  heading,
  intro,
  emptyText,
  pages,
  items,
  groupOrder,
  groupLabels,
}: {
  locale: Locale;
  heading: string;
  intro: string;
  emptyText: string;
  pages: Page[];
  items: FilterableItem[];
  groupOrder?: readonly string[];
  /** Heading text per group key; a raw key is shown when one is missing. */
  groupLabels?: Record<string, string>;
}) {
  return (
    <>
      <Header locale={locale} />
      <SearchDialog locale={locale} />
      <main id="main" className="container-page">
        <div className="py-(--sp-7)">
          <header>
            <h1>{heading}</h1>
            <p className="mt-4 max-w-[62ch] text-[length:var(--fs-lede)] leading-[var(--lh-lede)] text-muted-foreground">
              {intro}
            </p>
          </header>

          {pages.length === 0 ? (
            <p className="mt-(--sp-7) text-[length:var(--fs-small)] text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            <FilterableGrid
              locale={locale}
              items={items}
              total={pages.length}
              groupBy={Boolean(groupOrder)}
              labels={groupOrder ? { order: groupOrder, text: groupLabels } : undefined}
            />
          )}
        </div>
      </main>
      <Footer locale={locale} />
    </>
  );
}

/* ---------------------------------------------------------------- helpers -- */

/** `updated_at` when the content carries one, else nothing. Never a filler. */
export function updatedMeta(page: Page): (string | number | null)[] {
  return [str(page.frontmatter, 'updated_at') ?? null];
}

