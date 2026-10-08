'use client';

/**
 * The browse-index filter and its grid.
 *
 * One client component serves all four index routes (concepts, skills, MCP,
 * docs). The alternative — a separate interactive island per route — is four
 * copies of the same debounce-and-filter logic, and the pack's guardrails are
 * explicit that a new card style is not allowed; a fourth copy of a filter is
 * the same mistake.
 *
 * It is a FILTER, not a search: it narrows the cards the server already rendered,
 * matching the text a reader can actually see on the card (title, description,
 * tags). Global full-text search is the dialog's job, over the same data.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

import { ResourceCard } from '@/components/ui/card';
import type { Locale } from '@/lib/locales';
import { matchesText } from '@/lib/search';
import { cn } from '@/lib/utils';

/**
 * One card's data, derived from what the card displays.
 *
 * The card is rendered HERE, inside this client component, rather than being
 * passed in as a render function from the server page. Next.js cannot serialise
 * a function across the server/client boundary, so the original
 * `children: (item) => ReactNode` shape made every index route fail prerendering
 * with "Functions cannot be passed directly to Client Components". Carrying the
 * fields instead keeps the boundary serialisable.
 */
export interface FilterableItem {
  refPath: string;
  /** Everything visible on the card, pre-joined by the server. */
  searchText: string;
  /** Domain/category label, used for the optional grouping headings. */
  group?: string;
  /** Card content. */
  title: string;
  description?: string;
  meta?: (string | number | null | undefined)[];
  accentDot?: 'accent' | 'info' | 'muted';
}

const DEBOUNCE_MS = 120;

export function FilterableGrid({
  locale,
  items,
  total,
  groupBy = false,
  labels,
}: {
  children?: never;
  /** Card fields per item; the grid renders the card itself. */
  /** Locale prefix for each card's href. */
  locale: Locale;
  items: FilterableItem[];
  /** Total count before filtering — the page heading already shows this. */
  total?: number;
  /** Draw `items[].group` as subheadings above each run of cards. */
  groupBy?: boolean;
  labels?: {
    /** Sections in display order; a run missing one is appended at the end. */
    order?: readonly string[];
    /**
     * Heading text per group key. A missing key falls back to the raw value, so
     * this is a progressive improvement rather than a requirement — but a slug
     * rendered raw is a machine key on the page, which is why the routes supply
     * translated labels for every group they declare.
     */
    text?: Record<string, string>;
  };
}) {
  const t = useTranslations('index');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const visible = useMemo(() => {
    if (!debounced.trim()) return items;
    return items.filter((item) => matchesText(item.searchText, debounced));
  }, [items, debounced]);

  const grouped = useMemo(() => {
    if (!groupBy) return [{ group: undefined, heading: undefined, rows: visible }];
    const order = labels?.order ?? [];
    const map = new Map<string, FilterableItem[]>();
    for (const item of visible) {
      const key = item.group ?? '';
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    const keys = [
      ...order.filter((key) => map.has(key)),
      ...[...map.keys()].filter((key) => !order.includes(key)).sort(),
    ];
    return keys.map((key) => ({
      group: key || undefined,
      heading: key ? (labels?.text?.[key] ?? key) : undefined,
      rows: map.get(key) ?? [],
    }));
  }, [visible, groupBy, labels]);

  const shown = visible.length;
  const totalCount = total ?? items.length;

  return (
    <>
      {/* A real `search` input, not a div: it gets a role, a clear affordance and
          the platform's own semantics for free. */}
      <div className="mt-(--sp-6) flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[length:var(--radius-md)] border border-border bg-card px-3">
          <label htmlFor="index-filter" className="sr-only">
            {t('filterLabel')}
          </label>
          <input
            id="index-filter"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault();
                setQuery('');
              }
            }}
            placeholder={t('filterPlaceholder')}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent text-[length:var(--fs-body)] outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label={t('filterClear')}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-[length:var(--radius-sm)] text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        {/* The count is announced, so a screen-reader user hears the grid shrink. */}
        <p role="status" aria-live="polite" className="shrink-0 text-[length:var(--fs-small)] text-muted-foreground">
          {shown === totalCount
            ? t('resultCount', { count: totalCount })
            : t('filteredCount', { shown, count: totalCount })}
        </p>
      </div>

      {shown === 0 ? (
        <p className="mt-(--sp-7) rounded-[length:var(--radius-lg)] border border-border bg-card p-8 text-center text-[length:var(--fs-small)] text-muted-foreground">
          {t('filterNone')}
        </p>
      ) : (
        <div className="mt-(--sp-5) flex flex-col gap-(--sp-7)">
          {grouped.map(({ group, heading, rows }) => (
            <section key={group ?? 'all'} aria-label={heading ?? group} className="flex flex-col gap-4">
              {group && (
                <h2 className="text-[length:var(--fs-h3)]">
                  {heading ?? group}
                  <span className="ms-2 font-mono text-[length:var(--fs-caption)] text-muted-foreground tabular-nums">
                    {String(rows.length).padStart(2, '0')}
                  </span>
                </h2>
              )}
              <ul role="list" className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3')}>
                {rows.map((item) => (
                                  <li key={item.refPath} className="list-none">
                                    <ResourceCard
                                      href={`/${locale}/${item.refPath}`}
                                      title={item.title}
                                      description={item.description}
                                      meta={item.meta}
                                      accentDot={item.accentDot}
                                    />
                                  </li>
                                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}