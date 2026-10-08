import Link from 'next/link';
import { SessionCard } from '@/components/ui/card';
import { MetaRow } from '@/components/ui/button';
import {
  getPage,
  pagesByType,
  num,
  str,
  type Locale,
  type Page,
} from '@/lib/data';

/**
 * The learning tree, derived from the links that actually exist.
 *
 * WHY THIS IS DERIVED, NOT READ
 * The content declares the tree in ONE direction only: every session names its
 * `module`, every module names its `course`. Nothing walks back up — the course
 * index page has no `modules` or `sessions` array at all, and neither do the
 * module pages. Measured on the real tree: 10 course-type pages, 0 of which
 * declare `modules` or `sessions`.
 *
 * So a template that read `fm.modules` rendered a course page with a title, a
 * description and no curriculum — which is what the first build did. The tree is
 * therefore reconstructed by reverse lookup: for a course, find the module pages
 * that name it, then the sessions that name those modules. This is the same
 * bidirectional reasoning the content validator's V16 applies; here it is
 * presentation, not validation.
 *
 * Nothing is invented: a module or session that no page points at simply does not
 * appear, because there is no path to it from the course anyway.
 */

interface ModuleGroup {
  module: Page;
  sessions: Page[];
}

export function LearningTree({
  locale,
  course,
  labels,
}: {
  locale: Locale;
  course: Page;
  labels: { modules: string; sessions: string };
}) {
  const courseSlug = str(course.frontmatter, 'slug') ?? 'index';
  const courseRef = course.refPath.replace(/\/index$/, '');
  // `course: "ai-fundamentals"` on a module names the slug, not the full refPath.
  const slug = courseRef.split('/')[1] ?? courseSlug;

  const modulePages = pagesByType(locale, 'course').filter(
    (p) =>
      p.refPath !== course.refPath &&
      str(p.frontmatter, 'kind') === 'module' &&
      str(p.frontmatter, 'course') === slug,
  );

  const allSessions = pagesByType(locale, 'session');

  const groups: ModuleGroup[] = modulePages
    .map((module) => {
      const moduleRef = module.refPath;
      const sessions = allSessions
        .filter((s) => str(s.frontmatter, 'module') === moduleRef)
        .sort(
          (a, b) =>
            (num(a.frontmatter, 'position') ?? 0) - (num(b.frontmatter, 'position') ?? 0),
        );
      return { module, sessions };
    })
    // A module with no sessions is still part of the curriculum — it is published
    // and a reader should see that it exists — so it is kept, not filtered.
    .sort(
      (a, b) =>
        (num(a.module.frontmatter, 'position') ?? 0) -
        (num(b.module.frontmatter, 'position') ?? 0),
    );

  if (groups.length === 0) return null;

  const totalSessions = groups.reduce((n, g) => n + g.sessions.length, 0);
  const totalMinutes = groups.reduce(
    (n, g) =>
      n +
      g.sessions.reduce(
        (m, s) => m + (num(s.frontmatter, 'estimated_minutes') ?? 0),
        0,
      ),
    0,
  );

  return (
    <section aria-labelledby="curriculum" className="mt-(--sp-7)">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="curriculum" className="text-[length:var(--fs-h3)]">
          {labels.modules}
        </h2>
        <MetaRow
          items={[
            groups.length,
            `${totalSessions} ${labels.sessions.toLowerCase()}`,
            totalMinutes > 0 ? `${totalMinutes} min` : null,
          ]}
        />
      </div>

      <ol role="list" className="mt-5 flex flex-col gap-(--sp-6)">
        {groups.map(({ module, sessions }, i) => (
          <li key={module.refPath}>
            <div className="flex flex-wrap items-baseline gap-3">
              <span
                aria-hidden
                className="font-mono text-[length:var(--fs-label)] text-muted-foreground tabular-nums"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-[length:var(--fs-body)] font-medium">
                <Link
                  href={`/${locale}/${module.refPath}`}
                  className="hover:text-[var(--color-accent)]"
                >
                  {module.title}
                </Link>
              </h3>
            </div>

            {module.description && (
              <p className="mt-1.5 ms-9 max-w-[62ch] text-[length:var(--fs-small)] text-muted-foreground">
                {module.description}
              </p>
            )}

            {sessions.length > 0 && (
              <ul role="list" className="mt-3 flex flex-col gap-2 ms-9">
                {sessions.map((s) => (
                  <li key={s.refPath}>
                    <SessionCard
                      href={`/${locale}/${s.refPath}`}
                      title={s.title}
                      position={num(s.frontmatter, 'position')}
                      duration={num(s.frontmatter, 'estimated_minutes')}
                      description={str(s.frontmatter, 'description')}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The assessment block: a page's quiz or exam, and a course's final exam.
 *
 * `passes`, `next_session` and `previous_session` are the session's own declared
 * forward/back links. The quiz is reached through the session's `quiz:` field,
 * which the content validator requires to point back at a quiz that assesses it
 * — so this link is guaranteed to resolve or the build is already failing.
 */
export function AssessmentLinks({
  locale,
  page,
  labels,
}: {
  locale: Locale;
  page: Page;
  labels: { quiz: string; exam: string; next: string; back: string };
}) {
  const fm = page.frontmatter;
  const items: { label: string; ref: string }[] = [];

  const quiz = str(fm, 'quiz');
  if (quiz) items.push({ label: labels.quiz, ref: quiz });

  const exam = str(fm, 'exam');
  if (exam) items.push({ label: labels.exam, ref: exam });

  if (items.length === 0) return null;

  return (
    <ul role="list" className="mt-(--sp-6) flex flex-wrap gap-3">
      {items.map(({ label, ref }) => {
        const target = getPage(locale, ref);
        // A dangling ref would render a 404 to a reader. Absent, not broken.
        if (!target) return null;
        return (
          <li key={ref}>
            <Link
              href={`/${locale}/${ref}`}
              className="inline-flex items-center rounded-[length:var(--radius-pill)] border border-border px-4 py-2 text-[length:var(--fs-small)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-muted"
            >
              {label}: {target.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Previous / next session, from the session's own declared neighbours. */
export function SessionPager({
  locale,
  page,
  labels,
}: {
  locale: Locale;
  page: Page;
  labels: { next: string; back: string };
}) {
  const fm = page.frontmatter;
  const prevRef = str(fm, 'previous_session');
  const nextRef = str(fm, 'next_session');

  const prev = prevRef ? getPage(locale, prevRef) : undefined;
  const next = nextRef ? getPage(locale, nextRef) : undefined;
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Session navigation"
      className="mt-(--sp-8) grid gap-3 border-t border-border pt-(--sp-6) sm:grid-cols-2"
    >
      <div>
        {prev && (
          <Link
            href={`/${locale}/${prev.refPath}`}
            className="block rounded-[length:var(--radius-md)] border border-border p-4 transition-colors hover:bg-muted"
          >
            <span className="text-[length:var(--fs-caption)] uppercase tracking-wider text-muted-foreground">
              {labels.back}
            </span>
            <span className="mt-1 block text-[length:var(--fs-small)]">{prev.title}</span>
          </Link>
        )}
      </div>
      <div className="sm:text-end">
        {next && (
          <Link
            href={`/${locale}/${next.refPath}`}
            className="block rounded-[length:var(--radius-md)] border border-border p-4 transition-colors hover:bg-muted"
          >
            <span className="text-[length:var(--fs-caption)] uppercase tracking-wider text-muted-foreground">
              {labels.next}
            </span>
            <span className="mt-1 block text-[length:var(--fs-small)]">{next.title}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}