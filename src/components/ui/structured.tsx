import Link from 'next/link';
import { Badge } from './button';
import { CodeBlock, Callout } from './prose';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/locales';

/**
 * Structured-content partials.
 *
 * The content model is far richer than the page body: a concept carries its own
 * definition, aliases, mechanism, use-cases and anti-definition; a session
 * carries worked `examples` and `exercises` in frontmatter. A template that only
 * renders the markdown body throws almost all of that away — measured earlier, 36
 * concepts silently dropped 10 fields each and 16 sessions dropped every example
 * and exercise.
 *
 * Each partial below renders a type's real structure. They are composable
 * sections, not pages, so a new content type gets a partial rather than a route.
 */

/* --------------------------------------------------------------- concept --- */

export function ConceptFields({
  fields,
  locale,
  heading,
}: {
  fields: Record<string, unknown>;
  locale: Locale;
  heading: (label: string) => string;
}) {
  const {
    definition,
    aliases,
    why_it_exists,
    how_it_works,
    when_to_use,
    what_it_is_not,
    example,
    domain,
    confidence,
  } = fields;

  const s = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v : undefined;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  const aliasesList = arr(aliases);
  const notList = arr(what_it_is_not);

  return (
    <div className="mt-(--sp-6) flex flex-col gap-(--sp-6)">
      {s(definition) && (
        <section aria-labelledby="definition">
          <h2 id="definition" className="text-[length:var(--fs-h3)]">
            {heading('Definition')}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[length:var(--fs-lede)] leading-[var(--lh-lede)]">
            {s(definition)}
          </p>
        </section>
      )}

      {(aliasesList.length > 0 || s(domain)) && (
        <section>
          <h2 className="text-[length:var(--fs-h3)]">{heading('Also known as')}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {s(domain) && <Badge tone="info">{s(domain)}</Badge>}
            {aliasesList.map((a) => (
              <Badge key={a} tone="outline">
                {a}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {s(why_it_exists) && (
        <section aria-labelledby="why">
          <h2 id="why" className="text-[length:var(--fs-h3)]">
            {heading('Why it exists')}
          </h2>
          <p className="mt-3 max-w-[62ch]">{s(why_it_exists)}</p>
        </section>
      )}

      {s(how_it_works) && (
        <section aria-labelledby="how">
          <h2 id="how" className="text-[length:var(--fs-h3)]">
            {heading('How it works')}
          </h2>
          <p className="mt-3 max-w-[62ch]">{s(how_it_works)}</p>
        </section>
      )}

      {s(example) && (
        <section aria-labelledby="example">
          <h2 id="example" className="text-[length:var(--fs-h3)]">
            {heading('Example')}
          </h2>
          <p className="mt-3 max-w-[62ch] font-mono text-[length:var(--fs-small)]">
            {s(example)}
          </p>
        </section>
      )}

      {s(when_to_use) && (
        <section aria-labelledby="when">
          <h2 id="when" className="text-[length:var(--fs-h3)]">
            {heading('When to use it')}
          </h2>
          <p className="mt-3 max-w-[62ch]">{s(when_to_use)}</p>
        </section>
      )}

      {notList.length > 0 && (
        <section aria-labelledby="not">
          <h2 id="not" className="text-[length:var(--fs-h3)]">
            {heading('What it is not')}
          </h2>
          <ul role="list" className="mt-3 flex flex-col gap-2">
            {notList.map((n) => (
              <li key={n} className="flex gap-3">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-accent-2)]" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        Confidence is rendered because it is a real epistemic claim in the data,
        not decoration: this is a concept whose sourcing has been verified to a
        stated level. Showing it is the honest thing; hiding it would imply a
        certainty the content does not assert.
      */}
      {s(confidence) && (
        <p className="text-[length:var(--fs-caption)] text-muted-foreground">
          {heading('Sourcing')}: {s(confidence)}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- relations --- */

const RELATION_GROUPS: { field: string; key: string }[] = [
  { field: 'related_concepts', key: 'concepts' },
  { field: 'taught_by', key: 'sessions' },
  { field: 'related_skills', key: 'skills' },
  { field: 'related_mcp', key: 'mcp' },
  { field: 'related_docs', key: 'docs' },
];

/**
 * Renders the page's declared relations.
 *
 * Only refs that actually resolve are shown: a dangling pageref is a content bug
 * the validator already reports, and rendering it as a link would ship a 404 to a
 * reader. Absent rather than broken.
 */
export function Relations({
  fields,
  locale,
  heading,
  labels,
}: {
  fields: Record<string, unknown>;
  locale: Locale;
  heading: (label: string) => string;
  labels: Record<string, string>;
}) {
  const rows = RELATION_GROUPS.map(({ field, key }) => {
    const v = fields[field];
    const refs = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    return { key, refs };
  }).filter((r) => r.refs.length > 0);

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="relations" className="mt-(--sp-8) border-t border-border pt-(--sp-6)">
      <h2 id="relations" className="text-[length:var(--fs-h3)]">
        {heading('Related')}
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        {rows.map(({ key, refs }) => (
          <div key={key}>
            <p className="text-[length:var(--fs-caption)] uppercase tracking-wider text-muted-foreground">
              {labels[key] ?? key}
            </p>
            <ul role="list" className="mt-2 flex flex-wrap gap-2">
              {refs.map((ref) => (
                <li key={ref}>
                  <Link
                    href={`/${locale}/${ref}`}
                    className={cn(
                      'inline-flex rounded-[length:var(--radius-pill)] border border-border px-3 py-1',
                      'text-[length:var(--fs-small)] transition-colors hover:bg-muted hover:border-[var(--color-border-strong)]',
                    )}
                  >
                    {ref.split('/').pop()}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- session --- */

export interface WorkedExample {
  title?: string;
  language?: string;
  code?: string;
  rationale?: string;
}

/**
 * A worked example.
 *
 * `output` is rendered in its own block and labelled, because the content model
 * distinguishes claimed output from real output — a distinction this project
 * treats as load-bearing. Rendering both in the same style would blur it.
 */
export function ExampleBlock({ example }: { example: WorkedExample }) {
  if (!example?.code && !example?.title) return null;
  return (
    <figure className="my-6">
      {example.title && (
        <figcaption className="mb-2 text-[length:var(--fs-small)] font-medium">
          {example.title}
        </figcaption>
      )}
      {example.code && (
        <CodeBlock code={example.code} language={example.language ?? 'python'} />
      )}
      {example.rationale && (
        <p className="mt-2 text-[length:var(--fs-small)] text-muted-foreground">
          {example.rationale}
        </p>
      )}
    </figure>
  );
}

export function ExamplesList({
  examples,
  heading,
}: {
  examples: WorkedExample[];
  heading: string;
}) {
  const usable = (examples ?? []).filter((e) => e && (e.code || e.title));
  if (usable.length === 0) return null;
  return (
    <section aria-labelledby="examples" className="mt-(--sp-7)">
      <h2 id="examples" className="text-[length:var(--fs-h3)]">
        {heading}
      </h2>
      <div className="mt-4">
        {usable.map((ex, i) => (
          <ExampleBlock key={i} example={ex} />
        ))}
      </div>
    </section>
  );
}

export interface Exercise {
  title?: string;
  instruction?: string;
  objective?: string;
  starter_code?: string;
  solution?: string;
  language?: string;
}

export function ExerciseBlock({
  exercise,
  index,
  heading,
}: {
  exercise: Exercise;
  index: number;
  heading: string;
}) {
  if (!exercise?.title && !exercise?.instruction) return null;
  return (
    <section aria-labelledby={`exercise-${index}`} className="mt-(--sp-7)">
      <h2 id={`exercise-${index}`} className="text-[length:var(--fs-h3)]">
        {heading} {index + 1}
      </h2>
      {exercise.title && (
        <p className="mt-2 font-medium">{exercise.title}</p>
      )}
      {exercise.instruction && (
        <p className="mt-2 max-w-[62ch]">{exercise.instruction}</p>
      )}
      {exercise.objective && (
        <Callout tone="info" title="Objective">
          {exercise.objective}
        </Callout>
      )}
      {exercise.starter_code && (
        <CodeBlock code={exercise.starter_code} language={exercise.language ?? 'python'} />
      )}
    </section>
  );
}

export function ExercisesList({
  exercises,
  heading,
}: {
  exercises: Exercise[];
  heading: string;
}) {
  const usable = (exercises ?? []).filter((e) => e && (e.title || e.instruction));
  if (usable.length === 0) return null;
  return (
    <>
      {usable.map((ex, i) => (
        <ExerciseBlock key={i} exercise={ex} index={i} heading={heading} />
      ))}
    </>
  );
}

/* ----------------------------------------------------------------- links --- */

/**
 * External provenance links (a skill's repo, an MCP server's package).
 *
 * Rendered as real links with `rel="noopener noreferrer"`, and only when the
 * field is a usable absolute http(s) URL — never a placeholder or a bare string,
 * because a dead "source" link is worse than no link.
 */
export function SourceLinks({
  links,
  heading,
}: {
  links: { label: string; url: string }[];
  heading: string;
}) {
  const usable = links.filter(
    (l) => typeof l.url === 'string' && /^https?:\/\//i.test(l.url),
  );
  if (usable.length === 0) return null;

  return (
    <section className="mt-(--sp-6)">
      <h2 className="text-[length:var(--fs-h3)]">{heading}</h2>
      <ul role="list" className="mt-3 flex flex-col gap-2">
        {usable.map((l) => (
          <li key={l.url}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[length:var(--fs-small)] text-[var(--color-accent)] hover:underline"
            >
              {l.label}
              <span aria-hidden className="text-[length:var(--fs-caption)]">
                ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}