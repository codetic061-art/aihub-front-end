import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  allPages,
  getPage,
  pagesByType,
  LOCALES,
  isLocale,
  str,
  resources,
  glossary,
  type Locale,
  type Page,
  type ContentType,
  type Resource,
  type GlossaryEntry,
} from '@/lib/data';
import { SearchDialog } from '@/components/search-dialog';
import { Header, Footer } from '@/components/site-chrome';
import { ButtonLink, Badge, MetaRow } from '@/components/ui/button';
import {
  ResourceCard,
  CourseCard,
  SessionCard,
} from '@/components/ui/card';
import { Callout, CodeBlock, KeyValueList, Markdown } from '@/components/ui/prose';
import {
  ConceptFields,
  Relations,
  ExamplesList,
  ExercisesList,
  SourceLinks,
  type WorkedExample,
  type Exercise,
} from '@/components/ui/structured';
import { LearningTree, AssessmentLinks, SessionPager } from '@/components/learning-tree';
import {
  readExamSpec,
  readPromptSpec,
  readQuizSpec,
  readStoredQuestions,
  stripAnswerKey,
} from '@/lib/assessment';
import {
  QuizPlayerIsland,
  ExamPlayerIsland,
  PromptEvaluatorIsland,
  ProgressPanelIsland,
} from '@/components/assessment-islands';

/**
 * ONE template for every content type.
 *
 * This is the mechanism that keeps the project at "one implementation" instead of
 * "170 implementations". There is no per-slug page file anywhere in the app: the
 * only route is `[locale]/[...path]`, and `generateStaticParams` enumerates every
 * real record from the content snapshot. Adding a course, a concept or a skill
 * adds a URL and nothing else.
 *
 * The type-specific PARTIALS below are small composable sections, not separate
 * pages. A Skill page and a Concept page share this file, this layout, this
 * header and this metadata pipeline; they differ only by which partial renders.
 */

type Params = { params: Promise<{ locale: string; path?: string[] }> };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aihub.example';

/* ------------------------------------------------------ static generation -- */

export function generateStaticParams() {
  // Enumerate every page in every locale. ~170 entries, all prerendered.
  const out: { locale: string; path: string[] }[] = [];
  for (const locale of LOCALES) {
    for (const page of allPages(locale)) {
      out.push({ locale, path: page.refPath.split('/') });
    }
  }
  return out;
}

/* ---------------------------------------------------------------- metadata -- */

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, path } = await params;
  if (!isLocale(locale)) return {};
  const refPath = (path ?? []).join('/');
  const page = refPath ? getPage(locale, refPath) : undefined;
  if (!page) return { title: 'Not found' };

  const t = await getTranslations({ locale, namespace: 'common' });
  const canonical = `${SITE_URL}/${locale}/${page.refPath}`;

  return {
    title: page.title,
    description: page.description || page.summary,
    alternates: {
      canonical,
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `${SITE_URL}/${l}/${page.refPath}`]),
      ),
    },
    openGraph: {
      type: 'article',
      title: page.title,
      description: page.description,
      url: canonical,
      locale: locale === 'ar' ? 'ar_AR' : 'en_US',
    },
    twitter: { card: 'summary', title: page.title, description: page.description },
    robots: { index: true, follow: true },
  };
}

/* ------------------------------------------------------------- partials --- */

/**
 * Learning-tree partial: course, session, module, lesson, quiz, exam.
 *
 * Renders what the page actually declares — outcomes, modules, objectives, its own
 * worked examples, exercises, glossary and official resources — not just the
 * markdown body. The frontmatter `examples[]` and `exercises[]` are the substance
 * of a lesson; a template that skipped them renders an empty shell with a title.
 */
function LearningPartial({
  locale,
  page,
  t,
}: {
  locale: Locale;
  page: Page;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const fm = page.frontmatter;
  const strs = (k: string): string[] =>
    Array.isArray(fm[k]) ? (fm[k] as string[]).filter((x) => typeof x === 'string') : [];
  const modules = strs('modules');
  const outcomes = strs('outcomes');
  const objectives = strs('objectives').length ? strs('objectives') : strs('passes');
  const examples = (Array.isArray(fm['examples']) ? fm['examples'] : []) as WorkedExample[];
  const exercises = (Array.isArray(fm['exercises']) ? fm['exercises'] : []) as Exercise[];
  const terms = (Array.isArray(fm['glossary']) ? fm['glossary'] : []) as {
    term?: string;
    definition?: string;
  }[];
  const res = resources(fm, 'official_resources');
  const est = typeof fm['estimated_minutes'] === 'number' ? fm['estimated_minutes'] : undefined;

  return (
    <>
      {outcomes.length > 0 && (
        <section aria-labelledby="outcomes" className="mt-(--sp-7)">
          <h2 id="outcomes" className="text-[length:var(--fs-h3)]">{t('course.outcomes')}</h2>
          <ul role="list" className="mt-4 flex flex-col gap-2.5">
            {outcomes.map((o, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {modules.length > 0 && (
        <section aria-labelledby="modules" className="mt-(--sp-7)">
          <h2 id="modules" className="text-[length:var(--fs-h3)]">{t('course.modules')}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {modules.map((ref) => {
              const target = getPage(locale, ref);
              return (
                <ResourceCard
                  key={ref}
                  href={`/${locale}/${ref}`}
                  title={target?.title ?? ref.split('/').pop() ?? ref}
                  description={target?.description}
                  accentDot="info"
                />
              );
            })}
          </div>
        </section>
      )}

      {objectives.length > 0 && (
        <section aria-labelledby="objectives" className="mt-(--sp-7)">
          <h2 id="objectives" className="text-[length:var(--fs-h3)]">{t('session.objectives')}</h2>
          <ul role="list" className="mt-4 flex flex-col gap-2">
            {objectives.map((o, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="font-mono text-[var(--color-accent)]">→</span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        The curriculum is DERIVED from the session → module → course links, not
        read from `fm.modules`: no page in the tree declares that array, so reading
        it forward rendered a course page with no modules at all.
      */}
      {str(fm, 'kind') !== 'module' && (
        <LearningTree
          locale={locale}
          course={page}
          labels={{ modules: t('course.modules'), sessions: t('course.sessions') }}
        />
      )}

      <Markdown body={page.body} />

      <AssessmentLinks
        locale={locale}
        page={page}
        labels={{ quiz: t('session.quiz'), exam: t('course.finalExam'), next: t('session.nextSession'), back: t('common.previous') }}
      />

      <ExamplesList examples={examples} heading={t('concept.Worked examples')} />

      <ExercisesList exercises={exercises} heading={t('session.exercise')} />

      {terms.length > 0 && (
        <section aria-labelledby="glossary" className="mt-(--sp-7)">
          <h2 id="glossary" className="text-[length:var(--fs-h3)]">{t('session.glossary')}</h2>
          <dl className="mt-4 grid gap-4">
            {terms.map((entry, i) => (
              <div key={i} className="border-s-2 border-[var(--color-accent)] ps-4">
                <dt className="font-medium">{entry.term}</dt>
                {entry.definition && <dd className="mt-1 text-muted-foreground">{entry.definition}</dd>}
              </div>
            ))}
          </dl>
        </section>
      )}

      {res.length > 0 && (
        <section aria-labelledby="resources" className="mt-(--sp-7)">
          <h2 id="resources" className="text-[length:var(--fs-h3)]">{t('session.resources')}</h2>
          <ul role="list" className="mt-3 flex flex-col gap-2">
            {res.map((r: Resource, i: number) =>
              r.url && /^https?:\/\//i.test(r.url) ? (
                <li key={i}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                     className="text-[length:var(--fs-small)] text-[var(--color-accent)] hover:underline">
                    {r.title ?? r.url}
                  </a>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      )}

      {est !== undefined && (
        <p className="mt-(--sp-6) text-[length:var(--fs-caption)] text-muted-foreground">
          {t('course.estimated')}: {est} {t('common.minutes')}
        </p>
      )}

      <SessionPager
        locale={locale}
        page={page}
        labels={{ next: t('session.nextSession'), back: t('common.previous') }}
      />
    </>
  );
}
/**
 * Course partial: curriculum plus the local progress panel.
 *
 * The learning content is exactly what every other learning page renders, so it
 * is delegated rather than duplicated — a course page is a session/course tree
 * with a progress readout underneath it. Module pages are excluded: a single
 * module's progress belongs on the course page, and repeating it per module
 * would imply a module is a track of its own.
 */
function CoursePartial({
  locale,
  page,
  t,
}: {
  locale: Locale;
  page: Page;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (str(page.frontmatter, 'kind') === 'module') {
    return <LearningPartial locale={locale} page={page} t={t} />;
  }

  return (
    <>
      <LearningPartial locale={locale} page={page} t={t} />
      <ProgressPanelIsland
        locale={locale}
        courses={[{ ref: page.refPath, title: page.title }]}
      />
    </>
  );
}

/**
 * Assessment partial: the interactive layer for quiz, exam and prompt-assessment.
 *
 * These pages already render as prose further down the tree. This adds the part
 * that can be operated: a quiz player, an exam player with a timer, or the
 * prompt evaluator.
 *
 * QUESTIONS ARE PASSED, AND THE KEYS ARE NOT
 *
 * The snapshot's assessment pages carry full question objects, so there is
 * something real to hand a player. Two rules keep the key out of the
 * document:
 *
 *   1. `stripAnswerKey` runs HERE, in this Server Component, so the players
 *      receive questions with no `answer`, no `reason_wrong` and no matching
 *      map.
 *   2. ONLY SCALARS cross into the islands. Passing `page` (or anything
 *      closing over `page.frontmatter`) makes Next serialise the whole
 *      frontmatter into the RSC payload — which puts `reason_wrong` and
 *      `answer.correct` straight back into the HTML. That leak was real,
 *      and was caught by grepping the served page for `reason_wrong`.
 *
 * The earlier version of this comment claimed questions were unavailable
 * because the frontmatter parser collapsed nested block sequences. That was
 * a real parser bug, since fixed in `scripts/lib/content.ts`; the claim here
 * now describes what is actually true.
 */
function AssessmentPartial({
  locale,
  page,
}: {
  locale: Locale;
  page: Page;
}) {
  const stored = readStoredQuestions(page.frontmatter);
  const questions = stripAnswerKey(stored);
  const ids = stored.map((q) => q.id);
  const quiz = readQuizSpec(page.frontmatter);
  const exam = readExamSpec(page.frontmatter);

  return (
    <>
      {page.type === 'quiz' && (
        <QuizPlayerIsland
          assessmentRef={page.refPath}
          title={page.title}
          questions={questions}
          declaredQuestionIds={ids}
          passingScore={quiz.passingScore}
          allowRetry={quiz.allowRetry}
        />
      )}
      {page.type === 'exam' && (
        <ExamPlayerIsland
          assessmentRef={page.refPath}
          title={page.title}
          questions={questions}
          declaredQuestionIds={ids}
          passingScore={exam.passingScore}
          maxAttempts={exam.maxAttempts}
          timeLimitMinutes={exam.timeLimitMinutes}
          certificateTitle={exam.certificate?.title}
        />
      )}
      {page.type === 'prompt-assessment' && <PromptSpecIsland page={page} />}
    </>
  );
}

/**
 * Prompt-evaluator inputs, read server-side so the task string and the rubric
 * ids are the only things that cross into the client.
 */
function PromptSpecIsland({ page }: { page: Page }) {
  const spec = readPromptSpec(page.frontmatter);
  return (
    <PromptEvaluatorIsland
      assessmentRef={page.refPath}
      task={spec.task}
      rubricCriteria={spec.rubricCriteria}
    />
  );
}

function ResourcePartial({
  locale,
  page,
  t,
}: {
  locale: Locale;
  page: Page;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const fm = page.frontmatter;
  const s = (k: string): string | undefined => str(fm, k);

  const rows: { label: string; value: string }[] = [];
  const push = (label: string, v: string | undefined) => { if (v) rows.push({ label, value: v }); };
  push(t('concept.Author'), s('author') ?? s('creator') ?? s('owner'));
  push(t('concept.Repository'), s('repository') ?? s('repo') ?? s('github_url'));
  push(t('concept.License'), s('license'));
  push(t('concept.Package'), s('package'));
  push(t('concept.Version'), s('version'));
  push(t('concept.Homepage'), s('homepage'));
  push(t('concept.Docs'), s('official_docs_url') ?? s('docs_url'));

  const links = [
    { label: t('concept.Repository'), url: s('github_url') ?? '' },
    { label: t('concept.Documentation'), url: s('official_docs_url') ?? s('docs_url') ?? '' },
    { label: t('concept.Homepage'), url: s('homepage') ?? '' },
  ];

  return (
    <>
      <KeyValueList rows={rows} title={t('common.learnMore')} />
      <Markdown body={page.body} />
      <SourceLinks links={links} heading={t('concept.Sources')} />
      <Relations
        fields={fm}
        locale={locale}
        heading={() => t('concept.Related')}
        labels={{
          concepts: t('concept.Concepts'),
          sessions: t('concept.Sessions'),
          skills: t('concept.Skills'),
          mcp: t('concept.MCP'),
          docs: t('concept.Documentation'),
          tools: t('concept.Tools'),
        }}
      />
    </>
  );
}
function ConceptPartial({
  locale,
  page,
  t,
}: {
  locale: Locale;
  page: Page;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <>
      <ConceptFields
        fields={page.frontmatter}
        locale={locale}
        heading={(label) => t(`concept.${label}`)}
      />
      <Markdown body={page.body} className="mt-(--sp-7)" />
      <Relations
        fields={page.frontmatter}
        locale={locale}
        heading={() => t('common.learnMore')}
        labels={{
          concepts: t('concept.Related concepts'),
          sessions: t('concept.Taught by'),
          skills: t('concept.Related skills'),
          mcp: t('concept.Related MCP'),
          docs: t('concept.Documentation'),
        }}
      />
    </>
  );
}
/* ------------------------------------------------------------------- page -- */

export default async function ContentPage({ params }: Params) {
  const { locale, path } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const refPath = (path ?? []).join('/');
  if (!refPath) notFound();
  const page = getPage(locale, refPath);
  if (!page) notFound();

  const t = await getTranslations({ locale });

  const partial = (() => {
    switch (page.type) {
      case 'quiz':
      case 'exam':
      case 'prompt-assessment':
        return <AssessmentPartial locale={locale} page={page} />;
      case 'course':
        return <CoursePartial locale={locale} page={page} t={t} />;
      case 'session':
      case 'lesson':
        return <LearningPartial locale={locale} page={page} t={t} />;
      case 'concept':
        return <ConceptPartial locale={locale} page={page} t={t} />;
      default:
        return <ResourcePartial locale={locale} page={page} t={t} />;
    }
  })();

  const related = pagesByType(locale, page.type)
    .filter((p) => p.refPath !== page.refPath)
    .slice(0, 3);

  const fm = page.frontmatter;
  const level = str(fm, 'level');
  const minutes =
    typeof fm['estimated_minutes'] === 'number' ? fm['estimated_minutes'] : undefined;

  return (
      <>
        <Header locale={locale} />
        <SearchDialog locale={locale} />
        <main id="main" className="container-page">
        <article className="py-(--sp-6)">
          <header>
            <MetaRow
              className="mb-4"
              items={[page.type, level, minutes ? `${minutes} ${t('common.minutes')}` : null]}
            />
            <h1>{page.title}</h1>
            {page.description && (
              <p className="mt-4 max-w-[60ch] text-[length:var(--fs-lede)] leading-[var(--lh-lede)] text-muted-foreground">
                {page.description}
              </p>
            )}
            {page.tags.length > 0 && (
              <ul role="list" className="mt-5 flex flex-wrap gap-2">
                {page.tags.slice(0, 8).map((tag) => (
                  <li key={tag}>
                    <Badge tone="outline">{tag}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </header>

          <div className="mt-(--sp-7)">{partial}</div>
        </article>

        {related.length > 0 && (
          <section aria-labelledby="related" className="mt-(--sp-8) border-t border-border pt-(--sp-7)">
            <h2 id="related" className="text-[length:var(--fs-h3)]">
              {t('common.learnMore')}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <ResourceCard
                  key={p.refPath}
                  href={`/${locale}/${p.refPath}`}
                  title={p.title}
                  description={p.description}
                />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer locale={locale} />
    </>
  );
}