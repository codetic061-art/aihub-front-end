import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import {
  allPages,
  courseIndexPages,
  modulePagesFor,
  pagesByType,
  str,
  type Locale,
  type Page,
} from '@/lib/data';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/locales';
import { siteUrl } from '@/lib/site';
import { getActivityFeed } from '@/lib/activity';
import { Header, Footer } from '@/components/site-chrome';
import { SearchDialog } from '@/components/search-dialog';
import { ButtonLink, MetaRow } from '@/components/ui/button';
import { CourseCard, ResourceCard, StatCard } from '@/components/ui/card';
import { Bot } from '@/components/bot/bot';
import { UpdatingPanel } from '@/components/landing/updating-panel';
import { Puzzle, Plug, BookOpen, GraduationCap, Ticket } from 'lucide-react';

/**
 * THE LANDING PAGE.
 *
 * A Server Component, statically prerendered per locale, composed entirely from
 * the content snapshot. Every number, title, description and link below is read
 * out of `src/content/<locale>.json` — nothing is invented and nothing is typed
 * in by hand.
 *
 * Section order follows the pack's content mapping (10_CONTENT_MAPPING.md) and
 * the reference composition: hero → what it is + counts → learn → discover →
 * skills → MCP → developer docs → free credits.
 *
 * DESIGN CONSTRAINTS enforced here (13_IMPLEMENTATION_GUARDRAILS.md):
 *   - flat only: no gradients, no shadows, no glow, no blur. Cards are the
 *     existing outline-only primitives, so no new card style is introduced;
 *   - two accents max: blue for the single primary action, orange only for the
 *     one small dot in the status line (a few pixels, well under 10%);
 *   - the illustration is on the right, the text on the left;
 *   - `border-s`/`ms-`/`pe-`/`ps-` throughout, never left/right, so `dir="rtl"`
 *     mirrors without a second implementation.
 *
 * This file is the ONLY route for `/[locale]`. Its siblings (`/concepts`,
 * `/skills`, `/mcp`, `/docs`) are static segments that win over `[...path]`;
 * nothing here needs to know they exist.
 */

export function generateStaticParams() {
  return ['en', 'ar'].map((locale) => ({ locale }));
}

/* ---------------------------------------------------------------- helpers -- */

/** `2026-10-04` → an ISO-parseable value, or undefined. Never throws. */
function updatedDate(page: Page): string | undefined {
  const raw = str(page.frontmatter, 'updated_at');
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

/** Newest first, ties broken by refPath so both locales order identically. */
function byNewest(a: Page, b: Page): number {
  const ua = updatedDate(a) ?? '';
  const ub = updatedDate(b) ?? '';
  if (ua !== ub) return ub.localeCompare(ua);
  return a.refPath.localeCompare(b.refPath);
}

/**
 * Evenly spread `count` picks across a list, so a six-column row samples the
 * whole range instead of clustering at the start. Deterministic: same input,
 * same output, no randomness and no `Math.random()` at render time.
 */
function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    out.push(items[Math.floor((i * items.length) / count)]);
  }
  return out;
}

function href(locale: Locale, page: Page): string {
  return `/${locale}/${page.refPath}`;
}

/** A section heading block: h2 plus one lede. No eyebrow, no badge. */
function SectionHead({
  id,
  title,
  lede,
}: {
  id: string;
  title: string;
  lede?: string;
}) {
  return (
    <header className="max-w-[62ch]">
      <h2 id={id} className="text-[length:var(--fs-h2)]">
        {title}
      </h2>
      {lede && (
        <p className="mt-3 text-[length:var(--fs-lede)] leading-[var(--lh-lede)] text-muted-foreground">
          {lede}
        </p>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ page -- */

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (raw === 'ar' ? 'ar' : 'en') as Locale;
  setRequestLocale(locale);

  /*
   * One root translator, fully-qualified keys (`home.x`, `common.y`).
   *
   * Two bound translators in one function is ambiguous for
   * scripts/verify-messages.ts: it resolves a `t()` call against the LAST
   * `namespace:` in the enclosing function, so whichever translator was declared
   * last would swallow every key and report them all missing. A root translator
   * has no namespace to resolve against, so each key carries its own — which the
   * gate can verify. This mirrors the catch-all content route.
   */
  const t = await getTranslations({ locale });

  /* ---------------------------------------------------------- real data -- */

  const concepts = pagesByType(locale, 'concept');
  const skills = pagesByType(locale, 'skill').slice().sort(byNewest);
  const mcps = pagesByType(locale, 'mcp').slice().sort(byNewest);
  const docs = pagesByType(locale, 'docs');
  const sessions = pagesByType(locale, 'session');
  const quizzes = pagesByType(locale, 'quiz');
  const exams = pagesByType(locale, 'exam');
  const lessons = pagesByType(locale, 'lesson');
  const credits = pagesByType(locale, 'free-credit');
  const courses = courseIndexPages(locale)
    .slice()
    .sort((a, b) => a.refPath.localeCompare(b.refPath));

  const feed = await getActivityFeed(locale);

  // Counts for the "what is in the build" strip. Every value is the length of a
  // real array out of the snapshot — none is typed in by hand.
  const counts = [
    { value: allPages(locale).length, label: t('home.countPages'), href: undefined },
    { value: concepts.length, label: t('home.countConcepts'), href: `/${locale}/concepts` },
    { value: courses.length, label: t('home.countCourses'), href: `/${locale}/courses` },
    { value: skills.length, label: t('home.countSkills'), href: `/${locale}/skills` },
    { value: mcps.length, label: t('home.countMcp'), href: `/${locale}/mcp` },
  ];

  /* ------------------------------------------------------------- sections -- */

  const learnCourses = courses.map((course) => {
    const prefix = course.refPath.replace(/\/index$/, '');
    return {
      course,
      modules: modulePagesFor(locale, prefix).length,
      level: str(course.frontmatter, 'level'),
      minutes:
        typeof course.frontmatter['estimated_minutes'] === 'number'
          ? (course.frontmatter['estimated_minutes'] as number)
          : undefined,
    };
  });

  // Six concepts sampled across the alphabet, so the row shows range.
  const discoverConcepts = spread(
    concepts.slice().sort((a, b) => a.refPath.localeCompare(b.refPath)),
    6,
  );

  return (
    <>
      <Header locale={locale} />
      <SearchDialog locale={locale} />

      <main id="main">
        {/* ============================================================ HERO */}
        {/*
          Grid `7fr 5fr` as in the reference: text block left, companion and
          screen right. On mobile it stacks with the panel above the bot — the
          panel is content, the illustration is decoration, so content wins.
        */}
        <section
          aria-labelledby="hero-title"
          className="container-page grid items-end gap-(--sp-6) pt-(--sp-8) md:grid-cols-[7fr_5fr] md:gap-(--sp-7)"
        >
          <div className="min-w-0">
            {/*
              Two explicit lines with a <br>, and a wide `max-w` so the H1 can
              never wrap past three lines at any viewport. No badge or pill
              above the fold, and no raw stat counts in the hero — the counts
              live in their own strip further down.
            */}
            <h1 id="hero-title" className="max-w-[20ch]">
              {t('home.heroTitle')}
              <br />
              {t('home.heroTitleLine2')}
            </h1>
            <p className="mt-6 max-w-[52ch] text-[length:var(--fs-lede)] leading-[var(--lh-lede)] text-muted-foreground">
              {t('home.heroLede')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={`/${locale}/courses`} variant="accent" size="lg">
                {t('home.heroPrimary')}
              </ButtonLink>
              <ButtonLink
                href={courses[0] ? href(locale, courses[0]) : `/${locale}/courses`}
                variant="outline"
                size="lg"
              >
                {t('home.heroSecondary')}
              </ButtonLink>
            </div>
          </div>

          {/* Illustration column: right of the text at md and up. */}
          <div className="flex flex-col gap-(--sp-5) md:items-end">
            <UpdatingPanel locale={locale} items={feed} className="w-full md:max-w-sm" />
            <Bot
              pose="pointing"
              state="welcome"
              role="decorative"
              height={200}
              className="self-end"
            />
          </div>
        </section>

        {/* ============================================== WHAT AI HUB IS */}
        <section
          aria-labelledby="is-title"
          className="container-page mt-(--sp-9) scroll-mt-20 border-t border-border pt-(--sp-7)"
        >
          <div className="grid gap-(--sp-7) lg:grid-cols-[5fr_7fr]">
            <SectionHead id="is-title" title={t('home.isTitle')} lede={t('home.isLede')} />

            <ul role="list" className="grid gap-(--sp-5) sm:grid-cols-3">
              {(
                [
                  ['home.isPointLibrary', 'home.isPointLibraryBody'],
                  ['home.isPointSourced', 'home.isPointSourcedBody'],
                  ['home.isPointPath', 'home.isPointPathBody'],
                ] as const
              ).map(([head, body], i) => (
                <li key={head} className="border-t-2 border-[var(--color-accent)] pt-(--sp-3)">
                  <p className="font-mono text-[length:var(--fs-caption)] text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-2 text-[length:var(--fs-card-title)]">{t(head)}</h3>
                  <p className="mt-2 text-[length:var(--fs-small)] leading-[var(--lh-body)] text-muted-foreground">
                    {t(body)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Counts strip. Real array lengths, each linking to its own index
              where one exists. */}
          <div className="mt-(--sp-7)">
            <h3 className="text-[length:var(--fs-label)] font-medium uppercase tracking-wider text-muted-foreground">
              {t('home.countsTitle')}
            </h3>
            <ul
              role="list"
              className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            >
              {counts.map((c) => (
                <li key={c.label}>
                  <StatCard
                    value={c.value}
                    label={c.label}
                    {...(c.href ? { href: c.href } : {})}
                    className="h-full"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ====================================================== LEARN AI */}
        <section
          aria-labelledby="learn-title"
          className="container-page mt-(--sp-9) scroll-mt-20 border-t border-border pt-(--sp-7)"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead
              id="learn-title"
              title={t('home.learnTitle')}
              lede={t('home.learnLede')}
            />
            <ButtonLink href={`/${locale}/courses`} variant="outline" size="sm">
              {t('common.viewAll')}
            </ButtonLink>
          </div>

          <ul role="list" className="mt-(--sp-6) grid gap-(--sp-4) sm:grid-cols-2 lg:grid-cols-3">
            {learnCourses.map(({ course, modules, level, minutes }) => (
              <li key={course.refPath} className="flex">
                {/*
                  `badge` stays the pack's locked word (L8: a black "Course"
                  badge). Passing the level here instead would put "beginner" in
                  the badge and then repeat it in the meta row.
                */}
                <CourseCard
                  href={href(locale, course)}
                  title={course.title}
                  description={course.description}
                  badge={t('home.learnBadge')}
                  {...(level ? { level } : {})}
                  {...(minutes ? { minutes } : {})}
                  {...(modules ? { lessons: modules } : {})}
                  className="flex-1"
                />
              </li>
            ))}
          </ul>

          {/* The learning tree in numbers: modules, sessions, quizzes and exams,
              each counted from the snapshot. */}
          <dl className="mt-(--sp-6) grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                [
                  t('home.learnModule'),
                  courses.reduce(
                    (n, c) =>
                      n + modulePagesFor(locale, c.refPath.replace(/\/index$/, '')).length,
                    0,
                  ),
                ],
                [t('home.learnSession'), sessions.length],
                [t('home.learnQuiz'), quizzes.length],
                [t('home.learnExam'), exams.length],
              ] as [string, number][]
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-[length:var(--radius-md)] border border-border-muted p-4"
              >
                <dd className="font-display text-[length:var(--fs-h3)] leading-none tabular-nums">
                  {value}
                </dd>
                <dt className="mt-2 text-[length:var(--fs-caption)] text-muted-foreground">
                  {label}
                </dt>
              </div>
            ))}
          </dl>
        </section>

        {/* =================================================== UNDERSTAND AI */}
        <section
          aria-labelledby="discover-title"
          className="container-page mt-(--sp-9) scroll-mt-20 border-t border-border pt-(--sp-7)"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead
              id="discover-title"
              title={t('home.discoverTitle')}
              lede={t('home.discoverLede')}
            />
            <ButtonLink href={`/${locale}/concepts`} variant="outline" size="sm">
              {t('home.discoverAll')}
            </ButtonLink>
          </div>

          {/*
            A definition list, not a card grid: each concept is a term plus the
            sentence that makes it a concept page. The measure matters more than
            density here.
          */}
          <dl className="mt-(--sp-6) grid gap-(--sp-6) md:grid-cols-2 xl:grid-cols-3">
            {discoverConcepts.map((page) => {
              const fm = page.frontmatter;
              const definition = str(fm, 'definition');
              const why = str(fm, 'why_it_exists');
              const updated = updatedDate(page);
              return (
                <div key={page.refPath} className="flex flex-col">
                  <dt>
                    <a
                      href={href(locale, page)}
                      className="text-[length:var(--fs-card-title)] font-medium hover:text-[var(--color-accent)] hover:underline"
                    >
                      {page.title}
                    </a>
                  </dt>
                  {definition && (
                    <dd className="mt-2 text-[length:var(--fs-small)] leading-[var(--lh-body)] text-muted-foreground">
                      {definition}
                    </dd>
                  )}
                  {why && (
                    <dd className="mt-3 border-s-2 border-[var(--color-border-muted)] ps-3 text-[length:var(--fs-small)] leading-[var(--lh-body)]">
                      <span className="font-medium">{t('home.discoverWhy')}. </span>
                      {why}
                    </dd>
                  )}
                  {updated && (
                    <dd className="mt-3">
                      <MetaRow items={[`${t('home.updatedLabel')}: ${updated}`]} />
                    </dd>
                  )}
                </div>
              );
            })}
          </dl>
        </section>

        {/* =================================================== SKILLS + MCP */}
        {/*
          Two catalogue sections on one band, so they read as one shelf. Skill
          cards take `puzzle` and MCP cards take `plug`, per the pack's category
          icon rule — and never `sparkle`, which the pack bans.
        */}
        <section
          aria-labelledby="skills-title"
          className="container-page mt-(--sp-9) scroll-mt-20 border-t border-border pt-(--sp-7)"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead
              id="skills-title"
              title={t('home.skillsTitle')}
              lede={t('home.skillsLede')}
            />
            <ButtonLink href={`/${locale}/skills`} variant="outline" size="sm">
              {t('home.skillsAll')}
            </ButtonLink>
          </div>

          <ul role="list" className="mt-(--sp-6) grid gap-(--sp-4) sm:grid-cols-2 lg:grid-cols-3">
            {skills.slice(0, 6).map((page) => (
              <li key={page.refPath} className="flex">
                <ResourceCard
                  href={href(locale, page)}
                  title={page.title}
                  description={page.description}
                  icon={<Puzzle className="size-4" aria-hidden />}
                  accentDot="info"
                  meta={[updatedDate(page) ?? null]}
                  className="flex-1"
                />
              </li>
            ))}
          </ul>

          <div className="mt-(--sp-8) flex flex-wrap items-end justify-between gap-4">
            <SectionHead id="mcp-title" title={t('home.mcpTitle')} lede={t('home.mcpLede')} />
            <ButtonLink href={`/${locale}/mcp`} variant="outline" size="sm">
              {t('home.mcpAll')}
            </ButtonLink>
          </div>

          <ul role="list" className="mt-(--sp-6) grid gap-(--sp-4) sm:grid-cols-2 lg:grid-cols-3">
            {mcps.map((page) => {
              const pkg = str(page.frontmatter, 'package');
              return (
                <li key={page.refPath} className="flex">
                  <ResourceCard
                    href={href(locale, page)}
                    title={page.title}
                    description={page.description}
                    icon={<Plug className="size-4" aria-hidden />}
                    accentDot="accent"
                    meta={[pkg ? `${t('home.mcpPackage')}: ${pkg}` : null, updatedDate(page)]}
                    className="flex-1"
                  />
                </li>
              );
            })}
          </ul>
        </section>

        {/* ============================================ DOCS + FREE CREDITS */}
        <section
          aria-labelledby="docs-title"
          className="container-page mt-(--sp-9) scroll-mt-20 border-t border-border pt-(--sp-7)"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead
              id="docs-title"
              title={t('home.docsTitle')}
              lede={t('home.docsLede')}
            />
            <ButtonLink href={`/${locale}/docs`} variant="outline" size="sm">
              {t('home.docsAll')}
            </ButtonLink>
          </div>

          <ul role="list" className="mt-(--sp-6) grid gap-(--sp-4) sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((page) => (
              <li key={page.refPath} className="flex">
                <ResourceCard
                  href={href(locale, page)}
                  title={page.title}
                  description={page.description}
                  icon={<BookOpen className="size-4" aria-hidden />}
                  accentDot="muted"
                  meta={[updatedDate(page) ?? null]}
                  className="flex-1"
                />
              </li>
            ))}

            {lessons.map((page) => (
              <li key={page.refPath} className="flex">
                <ResourceCard
                  href={href(locale, page)}
                  title={page.title}
                  description={page.description}
                  icon={<GraduationCap className="size-4" aria-hidden />}
                  accentDot="muted"
                  meta={[updatedDate(page) ?? null]}
                  className="flex-1"
                />
              </li>
            ))}
          </ul>

          {/* Free credits. `FeatureCard` per the pack's mapping; the one card
              archetype allowed an ink button instead of being a link-card. */}
          <div className="mt-(--sp-8)">
            <SectionHead
              id="credits-title"
              title={t('home.creditsTitle')}
              lede={t('home.creditsLede')}
            />
          </div>

          <ul role="list" className="mt-(--sp-6) grid gap-(--sp-4) sm:grid-cols-2">
            {credits.map((page) => {
              const fm = page.frontmatter;
              const provider = str(fm, 'provider');
              const value = str(fm, 'credit_value');
              const requirements = Array.isArray(fm['requirements'])
                ? (fm['requirements'] as string[]).filter((x) => typeof x === 'string')
                : [];
              return (
                <li key={page.refPath}>
                  <article className="flex h-full flex-col rounded-[length:var(--radius-lg)] border border-border bg-card p-5">
                    <div className="flex items-center gap-2">
                      <Ticket className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <h3 className="text-[length:var(--fs-card-title)]">{page.title}</h3>
                    </div>
                    {page.description && (
                      <p className="mt-2 text-[length:var(--fs-small)] text-muted-foreground">
                        {page.description}
                      </p>
                    )}
                    <MetaRow
                      className="mt-4"
                      items={[
                        provider ? `${t('home.creditsProvider')}: ${provider}` : null,
                        value ? `${t('home.creditsValue')}: ${value}` : null,
                      ]}
                    />
                    {requirements.length > 0 && (
                      <ul role="list" className="mt-4 flex flex-col gap-1.5">
                        {requirements.map((r, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-[length:var(--fs-small)] text-muted-foreground"
                          >
                            <span aria-hidden className="shrink-0 text-[var(--color-accent)]">
                              →
                            </span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-auto pt-(--sp-5)">
                      <ButtonLink href={href(locale, page)} variant="primary" size="sm">
                        {t('home.creditsApply')}
                      </ButtonLink>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>

          <p className="mt-(--sp-7) text-[length:var(--fs-caption)] text-muted-foreground">
            {t('home.sourcesLabel')}
          </p>
        </section>
      </main>

      <Footer locale={locale} />
    </>
  );
}

/* ---------------------------------------------------------------- metadata -- */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (raw === 'ar' ? 'ar' : 'en') as Locale;
  const t = await getTranslations({ locale, namespace: 'home' });
  return {
    title: 'AI Hub',
    description: t('heroLede'),
    /**
     * Absolute, from the one origin constant.
     *
     * This block used to be relative (`{ en: '/en', ar: '/ar', 'x-default': '/en' }`).
     * Because a page's `generateMetadata` REPLACES the layout's alternates rather
     * than merging into them, those three relative values overwrote the absolute
     * hreflang set the layout had already built — so the two highest-value URLs
     * on the site, the two homepages, were emitted with a canonical and no
     * hreflang at all. Google needs those alternates to tell that /en and /ar are
     * the same page in two languages rather than two competing pages.
     *
     * Relative alternates here were only ever "working" by accident: they resolve
     * through `metadataBase`, so the host was right, but the language mapping was
     * silently discarded. Building them from `siteUrl()` cannot regress that way.
     */
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, siteUrl(`/${l}`)])),
        'x-default': siteUrl(`/${DEFAULT_LOCALE}`),
      },
    },
  };
}