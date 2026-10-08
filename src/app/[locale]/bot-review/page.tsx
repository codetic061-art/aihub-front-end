import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { LOCALES, type Locale } from '@/lib/locales';
import { BotContactSheet } from '@/components/bot/bot';

/**
 * Bot V2 review sheet.
 *
 * Deliberately NOT linked from the site navigation. The brief requires
 * "do not accept the first design, iterate, explore multiple variants, select the
 * strongest" — that needs all variants visible at once, which is a review tool,
 * not a user-facing page. It is prerendered like everything else, so it costs
 * nothing at runtime and can be deleted once the design is frozen.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function BotReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) notFound();
  setRequestLocale(locale as Locale);

  return (
    <main className="mx-auto w-full max-w-6xl px-(--sp-5) py-(--sp-8)">
      <h1 className="text-[length:var(--fs-h2)]">Bot V2 — review sheet</h1>
      <p className="mt-2 max-w-[62ch] text-[length:var(--fs-body)] text-muted-foreground">
        Every state and pose, drawn from one part library so the head-to-body
        ratio cannot drift between variants. Geometry is enforced by
        <code className="mx-1 font-mono text-[0.9em]">npm run verify:bot</code>.
      </p>
      <BotContactSheet />
    </main>
  );
}