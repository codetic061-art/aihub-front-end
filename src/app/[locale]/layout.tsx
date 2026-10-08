import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { routing } from '@/i18n/routing';
import { LOCALES } from '@/lib/data';
import { GOOGLE_VERIFICATION_CODE, SITE_URL } from '@/lib/site';
import { ThemeProvider, themeInitScript } from '@/components/theme-provider';
import { AnalyticsTags } from '@/components/analytics-tags';

import '../globals.css';

/**
 * Root layout.
 *
 * `<html lang dir>` is set here, per locale, and that single attribute is what
 * drives RTL: the stylesheet uses logical properties throughout, so Arabic needs
 * no separate component tree — only `dir="rtl"` and a slightly taller line-height.
 */

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * `metadataBase` and the alternates block feed canonical + hreflang.
 *
 * SITE_URL is imported from `@/lib/site` — the one module that holds the
 * deployment origin. It must be set in the environment
 * (`NEXT_PUBLIC_SITE_URL`); the fallback there is an RFC 2606 `.invalid`
 * domain, so a missing variable produces an obviously-wrong, unresolvable
 * absolute URL rather than a plausible-looking one pointing somewhere real.
 *
 * The verification meta tag lives here too. `public/<code>.html` and this tag
 * are two independent, individually sufficient methods that fail in different
 * ways — a redeploy can drop a hand-uploaded file, a template edit can drop the
 * tag — so shipping both means neither mistake silently unverifies the
 * property. The code itself is never written here: it comes from the same
 * constant, so the two cannot drift apart.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: 'home' });

  /**
   * Every language's own URL is declared as an alternate, plus `x-default`.
   * Each locale page also renders its own canonical in its own generateMetadata,
   * which overrides the value inherited from here.
   */
  const languages = Object.fromEntries(
    LOCALES.map((l) => [l, `${SITE_URL}/${l}`]),
  ) as Record<string, string>;

  return {
    metadataBase: new URL(SITE_URL),
    /**
     * HTML-file verification method, second of two. Rendered by Next into
     * `<head>` on every page of the site.
     */
    verification: {
      google: GOOGLE_VERIFICATION_CODE,
    },
    title: {
      default: 'AI Hub',
      template: `%s · AI Hub`,
    },
    description:
      locale === 'ar'
        ? 'تعلّم الذكاء الاصطناعي، وافهم مفاهيمه، واستكشف مهاراته وأدواته وخدماته.'
        : 'Learn AI, understand its concepts, and explore the skills, tools and MCP servers that make it usable.',
    alternates: {
      canonical: `/${locale}`,
      languages: { ...languages, 'x-default': `${SITE_URL}/en` },
    },
    openGraph: {
      type: 'website',
      siteName: 'AI Hub',
      locale: locale === 'ar' ? 'ar_AR' : 'en_US',
      title: 'AI Hub',
      description:
        locale === 'ar'
          ? 'تعلّم الذكاء الاصطناعي، وافهم مفاهيمه، واستكشف مهاراته وأدواته.'
          : 'Learn AI, understand its concepts, and explore the skills and tools that make it usable.',
      url: `/${locale}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: 'AI Hub',
      description:
        locale === 'ar'
          ? 'تعلّم الذكاء الاصطناعي، وافهم مفاهيمه، واستكشف مهاراته وأدواته.'
          : 'Learn AI, understand its concepts, and explore the skills and tools that make it usable.',
    },
    robots: { index: true, follow: true },
  };
  }

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required for static rendering: without it the locale-dependent messages
  // opt the whole tree out of prerendering.
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'common' });
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} data-theme="light" suppressHydrationWarning>
      <head>
        {/* Sets the theme before first paint — see theme-provider for why this
            cannot live in an effect. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/*
          GA4, Clarity and the AdSense loader.

          `next/script` (not raw <script> tags) because Next.js owns the
          document head in the App Router: next/script registers with the Next
          runtime so each tag is injected exactly once and survives soft
          navigations. All three use afterInteractive — they are third-party
          collectors that must not block first paint or hydration. See
          analytics-tags.tsx for the full rationale.
        */}
        <AnalyticsTags />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider>
          <ThemeProvider>
            <a href="#main" className="skip-link">
              {t('skipToContent')}
            </a>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}