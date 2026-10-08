'use client';

/**
 * Theme + language controls, and the header itself.
 *
 * Client-side for two reasons only: the theme toggle writes to localStorage and
 * the language switcher needs the current pathname. Everything else on the page
 * stays a Server Component.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { policyMessages } from '@/i18n/policy-messages';
import { useCallback, useState, useEffect, useRef } from 'react';
import { Menu, X, Sun, Moon, Globe } from 'lucide-react';

import { LOCALES, dirFor, type Locale } from '@/lib/locales';
import { useTheme } from '@/components/theme-provider';
import { SearchDialog } from '@/components/search-dialog';
import { SearchButton } from '@/components/search-trigger';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------- ThemeSwitcher */

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const t = useTranslations('common');
  const next = theme === 'dark' ? t('lightMode') : t('darkMode');

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next}
      title={next}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-[length:var(--radius-md)]',
        'border border-border bg-transparent text-foreground',
        'transition-colors duration-[var(--dur-1)] hover:bg-muted',
        className,
      )}
    >
      {/* Both icons render; CSS picks one, so there is no hydration mismatch
          between server HTML and the client's stored preference. */}
      <Sun className="size-4 dark:hidden" aria-hidden />
      <Moon className="hidden size-4 dark:block" aria-hidden />
    </button>
  );
}

/* ---------------------------------------------------------- LanguageSwitcher */

/**
 * Keeps the reader on the equivalent page.
 *
 * The path after the locale prefix is identical across languages by contract
 * (`docs/url-routing.md`), so swapping the prefix is the whole operation. If the
 * target page does not exist in the other language the link still works and the
 * destination renders its own honest "not translated" state — better than
 * silently dumping the reader on a homepage.
 */
export function LanguageSwitcher({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  const pathname = usePathname() ?? '/';
  const t = useTranslations('common');
  const rest = pathname.replace(new RegExp(`^/${locale}`), '') || '';
  const target: Locale = locale === 'en' ? 'ar' : 'en';

  return (
    <Link
      href={`/${target}${rest}`}
      hrefLang={target}
      lang={target}
      dir={dirFor(target)}
      aria-label={`${t('language')}: ${target === 'ar' ? 'العربية' : 'English'}`}
      title={t('language')}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-[length:var(--radius-md)] border border-border',
        'px-2.5 text-[length:var(--fs-nav)] transition-colors duration-[var(--dur-1)] hover:bg-muted',
        className,
      )}
    >
      <Globe className="size-4" aria-hidden />
      <span className="font-medium uppercase">{target}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------- Header */

const NAV = [
  { key: 'courses', href: '/courses' },
  { key: 'concepts', href: '/concepts' },
  { key: 'skills', href: '/skills' },
  { key: 'mcp', href: '/mcp' },
  { key: 'docs', href: '/docs' },
] as const;

export function Header({ locale }: { locale: Locale }) {
  const t = useTranslations('nav');
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);

  // A route change should close the mobile sheet; otherwise it stays open over
  // the page the reader just asked for.
  useEffect(() => setOpen(false), [pathname]);

  // Escape closes the sheet. A dialog that ignores Escape traps keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const href = (h: string) => `/${locale}${h}`;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[var(--color-bg)]">
      <div className="container-page flex h-16 items-center gap-4">
        <Link
          href={`/${locale}`}
          className="font-display text-[length:var(--fs-nav)] font-semibold tracking-tight"
        >
          AI Hub
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const full = href(item.href);
            const active = pathname.startsWith(full);
            return (
              <Link
                key={item.key}
                href={full}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-[length:var(--radius-md)] px-3 py-2 text-[length:var(--fs-nav)]',
                  'transition-colors duration-[var(--dur-1)] hover:bg-muted',
                  active && 'bg-muted font-medium',
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          {/* Opens the search dialog (see search-dialog.tsx, which owns the state
              so the "/" shortcut and this button can never disagree). */}
          <SearchButton />
          <LanguageSwitcher locale={locale} />
          <ThemeSwitcher />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t('close') : t('menu')}
            className="inline-flex size-9 items-center justify-center rounded-[length:var(--radius-md)] border border-border md:hidden"
          >
            {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-border bg-[var(--color-bg)] md:hidden"
        >
          <nav aria-label="Mobile" className="container-page flex flex-col py-2">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={href(item.href)}
                className="rounded-[length:var(--radius-md)] px-3 py-3 text-[length:var(--fs-body)] hover:bg-muted"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------- Footer */

export function Footer({ locale }: { locale: Locale }) {
  const t = useTranslations('footer');
  const tn = useTranslations('nav');

  const columns = [
    {
      title: t('explore'),
      links: [
        { label: tn('concepts'), href: '/concepts' },
        { label: tn('skills'), href: '/skills' },
        { label: tn('mcp'), href: '/mcp' },
      ],
    },
    {
      title: t('learn'),
      links: [
        { label: tn('courses'), href: '/courses' },
        { label: tn('docs'), href: '/docs' },
        { label: tn('credits'), href: '/free-credits' },
      ],
    },
    {
      // The four standing pages. AdSense requires all of them, and a legal page
      // nothing links to is not reachable by a reader who needs it. Labels are
      // read from policyMessages rather than duplicated here, so the footer and
      // the page headings cannot disagree.
      title: t('siteInfo'),
      links: [
        { label: policyMessages[locale].about.title, href: '/about' },
        { label: policyMessages[locale].contact.title, href: '/contact' },
        { label: policyMessages[locale].privacy.title, href: '/privacy-policy' },
        { label: policyMessages[locale].terms.title, href: '/terms' },
      ],
    },
  ];

  return (
    // L9: full-bleed near-black band in BOTH themes.
    <footer className="mt-(--sp-9) bg-[var(--color-footer-bg)] text-[var(--color-footer-text)]">
      <div className="container-page grid gap-8 py-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display text-[length:var(--fs-nav)] font-semibold">AI Hub</p>
          <p className="mt-2 max-w-[42ch] text-[length:var(--fs-small)] text-[var(--color-footer-muted)]">
            {t('tagline')}
          </p>
          <p className="mt-4 text-[length:var(--fs-caption)] text-[var(--color-footer-muted)]">
            {t('builtFrom')}
          </p>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-[length:var(--fs-label)] font-medium uppercase tracking-wider opacity-70">
              {col.title}
            </p>
            <ul role="list" className="mt-3 flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={`/${locale}${l.href}`}
                    className="text-[length:var(--fs-small)] hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-[var(--color-footer-muted)]/25">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-4 text-[length:var(--fs-caption)] text-[var(--color-footer-muted)]">
          <p>
            © {new Date().getFullYear()} AI Hub. {t('rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}