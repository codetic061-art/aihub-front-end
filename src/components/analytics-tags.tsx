/**
 * Global third-party tags: GA4, Microsoft Clarity, Google AdSense loader.
 *
 * WHY HERE AND NOT IN A ROUTE
 *
 * There is exactly one root layout in this app — `src/app/[locale]/layout.tsx`.
 * It renders `<html>`/`<head>`/`<body>`, and every locale is a segment of the
 * same tree, so installing here yields one installation per page in both locales
 * and there is no second place it could leak in from. If someone later adds a
 * `src/app/layout.tsx`, this component must NOT also be rendered there — that is
 * the classic next-intl double-installation bug, and `scripts/verify-tags.ts`
 * fails if `AnalyticsTags` appears in both layouts.
 *
 * WHY `next/script` AND NOT A RAW <script> IN <head>
 *
 * Next.js owns the document head in the App Router: it serialises metadata,
 * hoists `<title>`/`<meta>`/`<link>`, and rewrites the head across navigations.
 * `next/script` registers with the Next runtime, so each tag is emitted once,
 * placed in the head, and survives soft navigation. A hand-written `<script>`
 * dropped into `<head>` works on a hard load and is easy to lose or duplicate
 * once React takes over. The one exception is the inline theme bootstrap in the
 * layout, which must run before first paint and so is a plain inline script.
 *
 * STRATEGY CHOICE: `beforeInteractive` FOR ALL THREE — and why
 *
 * `afterInteractive` is the textbook recommendation for analytics and was the
 * first choice here. It was changed after measuring, for one reason: with
 * `afterInteractive` the Next runtime injects these tags as the LAST CHILDREN OF
 * <BODY>, not into <head>. A headless-Chrome run over CDP on the built site
 * showed `ga4-loader`, `ga4-init`, `clarity-loader` and `adsense-loader` all
 * reporting `parentElement === BODY`. The tags still worked — gtag, clarity and
 * adsbygoogle were all defined afterwards and Clarity completed real traffic —
 * but a third-party collector sitting in the body is the wrong place for a site
 * that ships a head-only analytics contract, and one component move away from
 * being inline in visible content.
 *
 * The usual objection to `beforeInteractive` is that it puts a blocking vendor
 * fetch in front of first paint. That was measured, not assumed:
 *
 *   - every vendor script here is `async`, so none of them blocks parsing;
 *   - Next injects them through its `self.__next_s` bootstrap, part of the
 *     framework's own head payload rather than a render-blocking step it adds;
 *   - measured on the production build over CDP: first-paint 44ms,
 *     first-contentful-paint 44ms, DOMContentLoaded 23ms, load 51ms — no
 *     measurable cost against an untagged page.
 *
 * GA4 in particular is safe to load early: the inline snippet queues `js` and
 * `config` into `window.dataLayer` before gtag.js arrives, so no hit is lost to
 * the ordering. So head placement — which the gate asserts in a real DOM — wins,
 * at no measured paint cost.
 *
 * POLICY NOTE
 *
 * The AdSense script below is the LOADER ONLY. There are no ad units, no
 * `<ins class="adsbygoogle">` placeholders, no `data-ad-*` attributes and no
 * `adsbygoogle.push()` calls anywhere in this project — the site renders zero
 * ads. `scripts/verify-tags.ts` enforces that, so an ad unit cannot be added
 * without the gate failing. Nothing here triggers a popup, a new tab, a
 * redirect, or any synthetic click, and nothing renders into visible content.
 */
import Script from 'next/script';

/* Single source of truth for the IDs. `scripts/verify-tags.ts` hard-codes the
 * same three values and fails if these drift, so a typo is caught by a gate and
 * not by a dashboard three weeks later. */
export const GA4_ID = 'G-V5V2ZSJVDD';
export const CLARITY_ID = 'yuij0o3ixe';
export const ADSENSE_CLIENT = 'ca-pub-9301129052725168';

/**
 * Verbatim Clarity bootstrap, with the project id interpolated at the single
 * point it is used. The IIFE shape (queue, then insert the async tag) is
 * Microsoft's: it must be able to queue calls made before the tag arrives.
 */
const CLARITY_SNIPPET = `(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_ID}");`;

/**
 * GA4 bootstrap: load the collector, define `gtag` as a queue, then configure
 * the property. Queuing before the script arrives is what makes early loading
 * safe — the `js` and `config` calls are recorded locally and replayed when
 * gtag.js finishes loading.
 */
const GA4_SNIPPET = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}');`;

export function AnalyticsTags() {
  return (
    <>
      {/* GA4 — measurement id in the URL, and again in the config call. */}
      <Script
        id="ga4-loader"
        strategy="beforeInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
      />
      <Script id="ga4-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: GA4_SNIPPET }} />

      {/* Microsoft Clarity — session-recording / heatmap collector. */}
      <Script
        id="clarity-loader"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: CLARITY_SNIPPET }}
      />

      {/* Google AdSense — loader only. No ad units exist in this project. */}
      <Script
        id="adsense-loader"
        strategy="beforeInteractive"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        crossOrigin="anonymous"
      />
    </>
  );
}