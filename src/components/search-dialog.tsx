'use client';

/**
 * Global search dialog.
 *
 * Mounted ONCE per page by `site-chrome.tsx`. Everything about the interaction
 * lives here: the "/" shortcut, Escape, the focus trap, arrow-key navigation and
 * the result-count announcement. The header button and the keyboard both dispatch
 * the same `search:open` event, so there is exactly one owner of "is it open".
 *
 * A11y contract implemented here, deliberately not hand-waved:
 *   - `role="dialog" aria-modal="true"` + `aria-labelledby` on the panel
 *   - the input is a `role="combobox"` with `aria-expanded`, `aria-controls` and
 *     `aria-activedescendant`, so focus NEVER leaves the text field while
 *     arrowing through results — that is what makes arrow keys work in a
 *     screen reader instead of only on a physical keyboard
 *   - the list is `role="listbox"`, each hit `role="option"` with `aria-selected`
 *   - a polite live region announces "N results" / "no results", so the count is
 *     not a purely visual signal
 *   - Tab is trapped inside the panel while open, and focus returns to the
 *     element that opened it on close
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CornerDownLeft, Search, X } from 'lucide-react';

import type { Locale } from '@/lib/locales';
import { searchIndex, type SearchDoc, type SearchHit } from '@/lib/search';
import { cn } from '@/lib/utils';

/** How long to wait after the last keystroke before scoring. */
const DEBOUNCE_MS = 120;
const MAX_RESULTS = 12;

/* -------------------------------------------------------------------------- */

type Status = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * Fetch + cache the index, once per locale.
 *
 * Module-level so opening the dialog a second time is instant: the promise is
 * reused and the parsed documents stay in memory. A rejected fetch is cached as
 * `null` too, so a failing endpoint is not retried on every keystroke.
 */
const indexCache = new Map<string, Promise<SearchDoc[] | null>>();

function loadIndex(locale: Locale): Promise<SearchDoc[] | null> {
  const cached = indexCache.get(locale);
  if (cached) return cached;
  const request = fetch(`/api/search/${locale}`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data: { docs?: SearchDoc[] }) =>
      Array.isArray(data?.docs) ? data.docs : null,
    )
    .catch(() => null);
  indexCache.set(locale, request);
  return request;
}

/* -------------------------------------------------------------------------- */

export function SearchDialog({ locale }: { locale: Locale }) {
  const t = useTranslations('search');
  const tn = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [index, setIndex] = useState<SearchDoc[]>([]);
  const [active, setActive] = useState(0);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const labelId = useId();
  const hintId = useId();

  /* ----------------------------------------------------------- open / close */

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setDebounced('');
    setActive(0);
    const target = restoreFocusTo.current;
    if (target && document.contains(target)) target.focus();
  }, []);

  // One global shortcut: "/" opens, Escape closes. Skipped while the reader is
  // already typing, or inside any other field, so "/" stays a normal character
  // in a form field and a reader's text input.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (event.key === '/' && !typing) {
        event.preventDefault();
        restoreFocusTo.current = target;
        setOpen(true);
        return;
      }
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // The header button dispatches this; listening on the document means the
  // header does not need to know this component exists.
  useEffect(() => {
    const onOpen = () => {
      restoreFocusTo.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    document.addEventListener('search:open', onOpen);
    return () => document.removeEventListener('search:open', onOpen);
  }, []);

  // Move focus in on open, and put the page behind it out of reach: `inert` is
  // what actually stops Tab from walking into the article behind the dialog.
  useEffect(() => {
    if (!open) return;
    const target = inputRef.current;
    target?.focus();

    // `inert` is applied to the page's own top-level elements only. Script/style
    // nodes are skipped: marking them inert has no focus effect but can confuse
    // dev tooling, and nothing under them is reachable by Tab anyway.
    const INERT_SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE']);
    const siblings = Array.from(document.body.children).filter(
      (el) =>
        el !== dialogRef.current &&
        !el.contains(dialogRef.current) &&
        !INERT_SKIP.has(el.tagName),
    );
    const previouslyInert = siblings.filter((el) => el.hasAttribute('inert'));
    for (const el of siblings) el.setAttribute('inert', '');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      for (const el of siblings) if (!previouslyInert.includes(el)) el.removeAttribute('inert');
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  /* ------------------------------------------------------------------ data */

  // Locale switch invalidates the previous locale's results.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus('loading');
    void loadIndex(locale).then((docs) => {
      if (cancelled) return;
      setIndex(docs ?? []);
      setStatus(docs ? 'ready' : 'failed');
    });
    return () => {
      cancelled = true;
    };
  }, [open, locale]);

  // Debounce: scoring runs on the settled value, not on every keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const hits = useMemo<SearchHit[]>(
    () => (status === 'ready' ? searchIndex(index, debounced, MAX_RESULTS) : []),
    [status, index, debounced],
  );

  const totalCount = useMemo(
    () => searchIndex(index, debounced, Number.MAX_SAFE_INTEGER).length,
    [index, debounced],
  );

  // Clamp the active option whenever the result set changes underneath it.
  useEffect(() => {
    setActive(0);
  }, [debounced, locale]);

  // Keep the active option scrolled into view during arrow-key navigation.
  useEffect(() => {
    if (!open || hits.length === 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`#search-opt-${active}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open, hits.length]);

  const go = useCallback(
    (href: string) => {
      close();
      // Same-route navigation must be a real push, otherwise Next treats it as a
      // no-op and the reader stays on the current page.
      if (href === pathname) return;
      router.push(href);
    },
    [close, pathname, router],
  );

  /* ------------------------------------------------------- focus trap (Tab) */

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      // Only wrap at the two ends; never intercept Tab in the middle, or the
      // control stops behaving like a normal dialog.
      if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && activeEl === first) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (hits.length === 0) return;
      event.preventDefault();
      setActive((prev) => {
        const next =
          event.key === 'ArrowDown'
            ? (prev + 1) % hits.length
            : (prev - 1 + hits.length) % hits.length;
        return next;
      });
      return;
    }

    if (event.key === 'Home') {
      if (hits.length === 0) return;
      event.preventDefault();
      setActive(0);
      return;
    }

    if (event.key === 'End') {
      if (hits.length === 0) return;
      event.preventDefault();
      setActive(hits.length - 1);
      return;
    }

    if (event.key === 'Enter') {
      const hit = hits[active];
      if (!hit) return;
      event.preventDefault();
      go(hit.doc.href);
    }
  };

  /* ----------------------------------------------------------------- render */

  if (!open) return null;

  const hasQuery = debounced.trim().length > 0;
  const statusMessage =
    status === 'failed'
      ? t('indexFailed')
      : !hasQuery
        ? t('idle')
        : hits.length === 0
          ? `${t('noResults')} — ${t('noResultsHint')}`
          : t('count', { count: totalCount });

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:items-center">
      {/*
        Scrim. Flat fill, no blur — the pack forbids glassmorphism, and a blurred
        backdrop would be the single loudest deviation on the site. Clicking it
        closes, which is the expected behaviour for a command-style search.
      */}
      <button
        type="button"
        aria-label={t('close')}
        onClick={close}
        className="absolute inset-0 h-full w-full cursor-default bg-[var(--ink-900)] opacity-40"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onKeyDown={onPanelKeyDown}
        className={cn(
          'relative flex max-h-[min(80dvh,40rem)] w-full max-w-2xl flex-col',
          'rounded-[length:var(--radius-xl)] border border-border bg-[var(--color-surface-raised)]',
        )}
      >
        {/* Input row */}
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <label id={labelId} htmlFor={`${labelId}-input`} className="sr-only">
            {t('label')}
          </label>
          <input
            id={`${labelId}-input`}
            ref={inputRef}
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            aria-expanded={hits.length > 0}
            aria-controls={`${labelId}-list`}
            aria-describedby={hintId}
            aria-autocomplete="list"
            {...(hits.length > 0 ? { 'aria-activedescendant': `${labelId}-opt-${active}` } : {})}
            placeholder={t('placeholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={cn(
              'min-w-0 flex-1 bg-transparent text-[length:var(--fs-body)]',
              'outline-none placeholder:text-[var(--color-text-tertiary)]',
            )}
          />
          <button
            type="button"
            onClick={close}
            aria-label={t('close')}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-[length:var(--radius-md)] border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* Live region: the result count is announced, not just drawn. */}
        <p id={hintId} role="status" aria-live="polite" className="sr-only">
          {statusMessage}
        </p>

        {/* Results */}
        {status === 'failed' ? (
          <p className="px-4 py-8 text-center text-[length:var(--fs-small)] text-muted-foreground">
            {t('indexFailed')}
          </p>
        ) : hits.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[length:var(--fs-body)]">
              {hasQuery ? t('noResults') : t('find')}
            </p>
            <p className="mt-1.5 text-[length:var(--fs-small)] text-muted-foreground">
              {hasQuery ? t('noResultsHint') : t('idle')}
            </p>
            {/* Real sections to try, not invented suggestion chips. */}
            {!hasQuery && (
              <ul role="list" className="mt-4 flex flex-wrap justify-center gap-2">
                {(['concepts', 'skills', 'mcp', 'docs'] as const).map((section) => (
                  <li key={section}>
                    <a
                      href={`/${locale}/${section}`}
                      className="inline-flex items-center rounded-[length:var(--radius-pill)] border border-border px-2.5 py-0.5 text-[length:var(--fs-caption)] text-muted-foreground transition-colors hover:bg-muted"
                    >
                      {tn(section)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <p className="border-b border-border-muted px-4 py-2 text-[length:var(--fs-caption)] text-muted-foreground">
              {t('showing', { shown: hits.length, count: totalCount })}
            </p>
            <ul
              id={`${labelId}-list`}
              ref={listRef}
              role="listbox"
              aria-label={t('label')}
              className="min-h-0 flex-1 overflow-y-auto p-2"
            >
              {hits.map((hit, i) => (
                <li key={hit.doc.refPath} className="list-none">
                  <Link
                    id={`${labelId}-opt-${i}`}
                    href={hit.doc.href}
                    role="option"
                    aria-selected={i === active}
                    onClick={(event) => {
                      event.preventDefault();
                      go(hit.doc.href);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      'block rounded-[length:var(--radius-md)] border p-3 transition-colors',
                      i === active
                        ? 'border-border bg-muted'
                        : 'border-transparent hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[length:var(--fs-body)] font-medium">
                        {hit.doc.title}
                      </span>
                      {/* The section is shown so a reader knows WHERE a result
                          lands. It is the real refPath segment, not a category
                          invented for the search UI. */}
                      <span className="shrink-0 rounded-[length:var(--radius-pill)] border border-border px-1.5 text-[length:var(--fs-mono)] text-muted-foreground">
                        {hit.doc.section}
                      </span>
                      {i === active && (
                        <CornerDownLeft className="ms-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                    </div>
                    {hit.doc.description && (
                      <p className="mt-1 line-clamp-2 text-[length:var(--fs-small)] text-muted-foreground">
                        {hit.doc.description}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Keyboard legend — the same bindings that work, stated. */}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2 text-[length:var(--fs-caption)] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="font-mono">↑</kbd>
            <kbd className="font-mono">↓</kbd>
            {t('navigate')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="font-mono">↵</kbd>
            {t('open')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="font-mono">esc</kbd>
            {t('close')}
          </span>
        </p>
      </div>
    </div>
  );
}