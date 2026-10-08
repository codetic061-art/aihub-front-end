import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { Footer, Header } from '@/components/site-chrome';
import { policyMessages } from '@/i18n/policy-messages';
import { pagesByType } from '@/lib/data';
import { DEFAULT_LOCALE, LOCALES, TYPE_DIRS } from '@/lib/locales';
import type { Locale } from '@/lib/locales';

/**
 * The four standing pages — About, Contact, Privacy Policy, Terms of Use.
 *
 * WHY THEY EXIST
 *
 * AdSense requires these four, and a site with no privacy policy cannot run
 * advertising at all. They are also the only pages on this site whose text has
 * no content file behind it, which is why the prose lives in
 * `src/i18n/policy-messages.ts` rather than the content tree.
 *
 * WHY ONE FILE FOR ALL FOUR
 *
 * They share a layout, a metadata shape, a canonical/hreflang pattern and one
 * data dependency (corpus counts). Four copies of that wiring is four places
 * for a route or a canonical link to drift.
 *
 * WHAT THEY DELIBERATELY DO NOT CONTAIN
 *
 * No company name, address, registration number or jurisdiction — the header
 * of policy-messages.ts explains why inventing one is worse than the gap.
 *
 * COUNTS ARE READ, NEVER TYPED
 *
 * The About page publishes a count per content type. Those numbers come from
 * `pagesByType()` against the live snapshot, so the page cannot claim a size
 * the site does not have. A type with no pages is omitted rather than rendered
 * as "0", because a zero row reads as a broken site rather than an honest
 * absence.
 */

/**
 * The page slug in the URL to its section in the policy messages.
 *
 * Exported because these four are real, indexable, locale-prefixed routes that
 * are NOT in the content snapshot, so `app/sitemap.ts` cannot discover them by
 * reading `src/content/*.json`. Exporting the map is what lets the sitemap
 * include them from the same source of truth the routes themselves use — a
 * hard-coded list in the sitemap would be a second place to forget to add the
 * fifth policy page.
 */
export const SECTIONS = {
  about: 'about',
  contact: 'contact',
  'privacy-policy': 'privacy',
  terms: 'terms',
} as const;

type Section = (typeof SECTIONS)[keyof typeof SECTIONS];

const isSection = (value: string): value is keyof typeof SECTIONS =>
  Object.prototype.hasOwnProperty.call(SECTIONS, value);

/**
 * Content type -> the directory it is served under, so the About page links to
 * a real URL rather than repeating the directory name as a literal.
 */
const COUNTED = [
  { type: 'concept', dir: TYPE_DIRS.concept, key: 'concepts' },
  { type: 'session', dir: TYPE_DIRS.session, key: 'sessions' },
  { type: 'course', dir: TYPE_DIRS.course, key: 'courses' },
  { type: 'skill', dir: TYPE_DIRS.skill, key: 'skills' },
  { type: 'mcp', dir: TYPE_DIRS.mcp, key: 'mcp' },
  { type: 'quiz', dir: TYPE_DIRS.quiz, key: 'quizzes' },
  { type: 'exam', dir: TYPE_DIRS.exam, key: 'exams' },
  { type: 'prompt-assessment', dir: TYPE_DIRS['prompt-assessment'], key: 'prompt' },
  { type: 'docs', dir: TYPE_DIRS.docs, key: 'docs' },
] as const;

/** URL directory -> message key, for the counted-type list. */
const COUNTED_KEY: Record<string, string> = Object.fromEntries(
  COUNTED.map(({ dir, key }) => [dir, key]),
);

export async function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    Object.keys(SECTIONS).map((page) => ({ locale, page })),
  );
}

function policyMetadata(locale: Locale, section: Section, title: string, description: string): Metadata {
  const url = `/${locale}/${pageFor(section)}`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        // x-default points at the default locale, matching every other page on
        // the site. Without it these four pages are the only ones a search
        // engine cannot fall back on for a language it has no match for.
        ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}/${pageFor(section)}`])),
        'x-default': `/${DEFAULT_LOCALE}/${pageFor(section)}`,
      },
    },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      locale,
      alternateLocale: LOCALES.filter((l) => l !== locale),
    },
  };
}

/** Section -> the URL slug that serves it. */
function pageFor(section: Section): keyof typeof SECTIONS {
  const found = (Object.entries(SECTIONS) as [string, Section][]).find(([, v]) => v === section);
  if (!found) throw new Error(`no route slug for section ${section}`);
  return found[0] as keyof typeof SECTIONS;
}

/**
 * Metadata factory for one standing page.
 *
 * Exported as a factory rather than a bare `generateMetadata` because each
 * route is its own Next.js segment: an export in this shared module is not
 * picked up unless the segment re-exports it, and a missing export silently
 * degrades to the layout's title and canonical — which is exactly the bug this
 * comment exists to prevent.
 */
export function makeMetadata(page: keyof typeof SECTIONS) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: Locale }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    const section = SECTIONS[page];
    const bundle = policyMessages[locale];
    if (!bundle) return {};
    const text = bundle[section];
    // The lede carries `{total}`; a description is rendered raw by the consumer
    // (Google, social cards), so an unsubstituted placeholder would ship as the
    // literal string "This build holds {total} pages." Metadata is a string
    // with no substitution step downstream — it has to be filled here.
    const description =
      page === 'about' ? fill(text.lede, { total: corpus(locale).total }) : text.lede;
    return policyMetadata(locale, section, text.title, description);
  };
}

/** A titled prose block, or a bulleted list when given an array. */
function Block({
  title,
  body,
  as: Heading = 'h2',
}: {
  title?: string;
  body: string | readonly string[];
  as?: 'h2' | 'h3';
}) {
  return (
    <section className="policy-block">
      {title ? <Heading>{title}</Heading> : null}
      {typeof body === 'string' ? (
        <p>{body}</p>
      ) : (
        <ul>
          {body.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Plural handling for the counts the About page publishes.
 *
 * Both locales need it and neither shares a rule:
 *
 *   - English has two forms, selected on `n === 1` (CLDR: one / other).
 *   - Arabic has six. The relevant buckets are zero, one (1), two (2),
 *     few (3-10), many (11-99) and other (100+). "2 pages" is صفحتان, not
 *     "2 صفحة"; and 3-10 is صفحات, not 3 صفحة.
 *
 * Forms are declared as separate keys in policy-messages.ts
 * (`concepts_one`, `concepts_few`, ...) rather than an inline mini-syntax the
 * renderer has to parse out of a string. Keys are data, selection is code, and
 * verify-messages.ts can assert each counted type declares every form its
 * locale requires — which is the check that stops a half-translated label from
 * shipping.
 *
 * `contents.total` is the same problem in one sentence: it needs an Arabic
 * plural too, so it follows the identical rule via `total_*` keys.
 */

/**
 * Substitutes `{total}` in a single-sentence lede. Scoped to `total` on purpose:
 * the counted-type labels go through `countedLabel` instead, because they need
 * locale plural rules, not a blind find-and-replace.
 */
function fill(template: string, values: Readonly<Record<string, number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

/** CLDR plural category for a count, for the two locales this site has. */
function pluralCategory(locale: Locale, n: number): string {
  if (locale !== 'ar') return n === 1 ? 'one' : 'other';
  if (n === 0) return 'zero';
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return 'few';
  return 'many';
}

/**
 * Reads `<key>_<category>` out of the contents bundle, falling back through the
 * forms that are always safe: the requested category, then English's `other`
 * form, then the bare key. A fallback yields real words rather than a blank
 * label or a literal `{n}`.
 */
function countedLabel(
  contents: Record<string, string>,
  key: string,
  locale: Locale,
  n: number,
  total?: number,
): string | undefined {
  const category = pluralCategory(locale, n);
  for (const candidate of [`${key}_${category}`, `${key}_other`, key]) {
    const value = contents[candidate];
    if (!value) continue;
    // Substitute BOTH placeholders. `total_*` sentences use {total} while the
    // per-type labels use {n}; leaving one unsubstituted ships a literal
    // "{total}" to the reader, which is worse than a missing sentence.
    return value.replace(/\{(\w+)\}/g, (match, name: string) => {
      if (name === 'n') return String(n);
      if (name === 'total') return total === undefined ? match : String(total);
      return match;
    });
  }
  return undefined;
}

/** The live corpus, one count per counted type. */
function corpus(locale: Locale): { counts: Record<string, number>; total: number } {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const { type, dir } of COUNTED) {
    const n = pagesByType(locale, type).length;
    counts[dir] = n;
    total += n;
  }
  return { counts, total };
}

export default async function PolicyPage({
  locale,
  page,
}: {
  locale: Locale;
  page: string;
}) {
  setRequestLocale(locale);

  // Each branch narrows its own bundle from the same source, so TypeScript can
  // see the section-specific shape instead of a four-way union it cannot
  // discriminate.
  if (isSection(page)) {
    const bundle = policyMessages[locale];

    if (page === 'about') {
      const { counts, total } = corpus(locale);
      const t = bundle.about;
      const contents = t.contents as unknown as Record<string, string>;
      const totalText = countedLabel(contents, 'total', locale, total, total);
      return (
        <>
          <Header locale={locale} />
          <main id="main" className="policy-page">
            <header className="policy-header">
              <h1>{t.title}</h1>
              <p className="lede">{fill(t.lede, { total })}</p>
            </header>
            <Block title={t.contents.title} body={t.contents.body} />
            <Block title={t.what.title} body={t.what.body} />
            <section className="policy-block">
              <ul>
                {COUNTED.map(({ dir }) => {
                  const n = counts[dir] ?? 0;
                  // A type with no pages is omitted rather than printed as 0:
                  // a zero row reads as a broken site, not an honest absence.
                  if (n === 0) return null;
                  const key = COUNTED_KEY[dir];
                  if (!key) return null;
                  const label = countedLabel(contents, key, locale, n);
                  if (!label) return null;
                  return (
                    <li key={dir}>
                      <a href={`/${locale}/${dir}`}>{label}</a>
                    </li>
                  );
                })}
              </ul>
              {totalText ? <p>{totalText}</p> : null}
            </section>
            <Block title={t.how.title} body={t.how.body} />
            <Block title={t.not.title} body={t.not.body} />
          </main>
          <Footer locale={locale} />
        </>
      );
    }

    if (page === 'contact') {
      const t = bundle.contact;
      return (
        <>
          <Header locale={locale} />
          <main id="main" className="policy-page">
            <header className="policy-header">
              <h1>{t.title}</h1>
              <p className="lede">{t.lede}</p>
            </header>
            <Block title={t.notPublished.title} body={t.notPublished.body} />
            <Block title={t.now.title} body={t.now.body} />
            <Block body={[t.now.broken, t.now.unclear]} />
            <Block title={t.privacy.title} body={t.privacy.body} />
          </main>
          <Footer locale={locale} />
        </>
      );
    }

    if (page === 'privacy-policy') {
      const t = bundle.privacy;
      return (
        <>
          <Header locale={locale} />
          <main id="main" className="policy-page">
            <header className="policy-header">
              <h1>{t.title}</h1>
              <p className="lede">{t.lede}</p>
            </header>
            <Block title={t.summary.title} body={t.summary.body} />
            <Block title={t.collect.title} body={t.collect.body} />
            <Block
              body={[
                t.collect.analytics,
                t.collect.clarity,
                t.collect.adsense,
                t.collect.ads,
                t.collect.local,
              ]}
            />
            <Block title={t.cookies.title} body={t.cookies.body} />
            <Block title={t.vendors.title} body={t.vendors.body} />
            <Block body={[t.vendors.google, t.vendors.clarity, t.vendors.thirdparty]} />
            <Block title={t.choices.title} body={t.choices.body} />
            <Block body={[t.choices.optout, t.choices.browser, t.choices.limits]} />
            <Block title={t.children.title} body={t.children.body} />
            <Block title={t.changes.title} body={t.changes.body} />
            <Block title={t.contact.title} body={t.contact.body} />
          </main>
          <Footer locale={locale} />
        </>
      );
    }

    const t = bundle.terms;
    return (
      <>
        <Header locale={locale} />
        <main id="main" className="policy-page">
          <header className="policy-header">
            <h1>{t.title}</h1>
            <p className="lede">{t.lede}</p>
          </header>
          <Block title={t.nature.title} body={t.nature.body} />
          <Block title={t.use.title} body={t.use.body} />
          <Block body={[t.use.lawful, t.use.noHarm, t.use.noAbuse, t.use.noCopy]} />
          <Block title={t.external.title} body={t.external.body} />
          <Block title={t.accuracy.title} body={t.accuracy.body} />
          <Block title={t.ip.title} body={t.ip.body} />
          <Block title={t.availability.title} body={t.availability.body} />
          <Block title={t.liability.title} body={t.liability.body} />
          <Block title={t.changes.title} body={t.changes.body} />
          <Block title={t.contact.title} body={t.contact.body} />
        </main>
        <Footer locale={locale} />
      </>
    );
  }

  notFound();
}
