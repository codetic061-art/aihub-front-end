import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { routing } from '@/i18n/routing';
import { LOCALES } from '@/lib/data';
import { ThemeProvider, themeInitScript } from '@/components/theme-provider';

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
 * SITE_URL is the deployment origin. It must be set in the environment; the
 * RFC 2606 fallback below is deliberately an unresolvable .example domain so a
 * missing variable produces an obviously-wrong absolute URL rather than a
 * plausible-looking one pointing somewhere real.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aihub.example';

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