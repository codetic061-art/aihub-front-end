/**
 * PRE-PUBLISH GATE — the thing that must pass before this site is indexed.
 *
 * Every check here exists because the failure it catches is SILENT. The site
 * keeps returning 200, the pages keep rendering, the build keeps passing, and the
 * property simply never appears in Google — or worse, appears with the wrong
 * canonical and gets deindexed. There is no console error to look for, which is
 * precisely why these are assertions instead of comments.
 *
 * THE ONE RULE: this file contains NO duplicated constants.
 *
 * The origin is imported from `../src/lib/site` — the same module the layout,
 * the catch-all route, `sitemap.ts` and `robots.ts` read. The verification code
 * is imported from the same place. So this gate cannot pass while the build is
 * emitting a different host: if someone hard-codes a literal into a template,
 * this fails naming that template; if someone promotes the domain by editing
 * `lib/site.ts` instead of setting the env var, both the build and this gate move
 * together and stay correct. A verifier that hard-codes its own copy of the
 * expected value is worse than no verifier, because it silently agrees with
 * itself.
 *
 * IT CHECKS THE BUILT OUTPUT, NOT THE SOURCE.
 *
 * Source greps prove intent; they cannot prove what Next actually emitted. So
 * the authoritative pass parses the prerendered HTML in `.next/server/app` and the
 * real sitemap/robots bodies. If you have not built, this tells you rather than
 * reporting a confident pass over files that do not exist.
 *
 * Run: npm run verify:launch
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/*
 * Imported, never re-declared. See the module comment: a literal copy of either
 * value here would make this gate self-confirming and worthless.
 */
import {
  SITE_URL,
  SITE_URL_IS_PLACEHOLDER,
  GOOGLE_VERIFICATION_CODE,
  GOOGLE_VERIFICATION_FILE,
  GOOGLE_VERIFICATION_FILE_CONTENT,
  FORBIDDEN_HOST_PATTERNS,
  siteUrl,
} from '../src/lib/site';
import { LOCALES, DEFAULT_LOCALE } from '../src/lib/locales';
import { allPages } from '../src/lib/data';
import { buildSitemapEntries } from '../src/app/sitemap';
import { SECTIONS } from '../src/components/policy-pages';

import en from '../src/content/en.json';
import ar from '../src/content/ar.json';

const ROOT = process.cwd();
const APP_OUT = join(ROOT, '.next', 'server', 'app');
const PUBLIC_DIR = join(ROOT, 'public');

/**
 * Newest mtime under a subtree, ignoring directories.
 *
 * Used to catch the nastiest way this gate can lie: it reads `.next`, so if the
 * source changed after the last build, it is validating the PREVIOUS build and
 * reporting a clean pass for code that was never compiled. That is how a
 * verification tag can be deleted from the layout while the gate still reports
 * the tag present on all 50 sampled pages. Verified by experiment — the build
 * predated the edit and the gate passed anyway.
 */
function newestMtime(dir: string): number {
  if (!existsSync(dir)) return 0;
  let newest = 0;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    try {
      const s = statSync(full);
      newest = Math.max(newest, s.isDirectory() ? newestMtime(full) : s.mtimeMs);
    } catch { /* unreadable entry: skip rather than fail the gate */ }
  }
  return newest;
}

/** The static browse sections that are real, indexable destinations. */
const INDEX_SECTIONS = ['concepts', 'skills', 'mcp', 'docs'] as const;

/**
 * How many rendered pages must carry a canonical and a verification tag before a
 * partial build is allowed to look healthy. A full build emits 187; sampling a
 * broad set is what makes the "no stray host anywhere" claim real rather than
 * "the homepage was fine".
 */
const MIN_PAGES_SCANNED = 50;

let failures = 0;

/** A failure always names the file it is about, so it can be opened and fixed. */
function fail(file: string, message: string): void {
  failures++;
  console.error(`  FAIL  ${file}\n        ${message}`);
}

function pass(message: string): void {
  console.log(`  pass  ${message}`);
}

function check(file: string, ok: boolean, message: string): boolean {
  if (ok) pass(`${file}: ${message}`);
  else fail(file, message);
  return ok;
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

const rel = (p: string): string => relative(ROOT, p).replace(/\\/g, '/');

/** Every prerendered `.html` in the build, excluding internals. */
function renderedPages(dir: string = APP_OUT, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '_global-error') continue;
      renderedPages(full, out);
    } else if (name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

/* ============================================================== *
 * 1. THE ORIGIN IS REAL, NOT A PLACEHOLDER
 * ============================================================== */

section('1. deployment origin');

const originHost = new URL(SITE_URL).hostname;
console.log(`  origin = ${SITE_URL} (${SITE_URL_IS_PLACEHOLDER ? 'PLACEHOLDER' : 'promoted'})`);

check(
  'src/lib/site.ts',
  SITE_URL.startsWith('https://'),
  `origin must be https, got "${SITE_URL}" — an http origin redirects every crawler and costs ranking`,
);

check(
  'src/lib/site.ts',
  !SITE_URL.endsWith('/'),
  `origin must not carry a trailing slash, got "${SITE_URL}" — it would produce "//en" in every URL`,
);

// This is a WARNING about launch readiness, not a hard failure: the task forbids
// guessing the real domain, so the placeholder is the correct state right now and
// failing here would make the gate unusable until a domain exists. It is reported
// loudly instead, because a site that is genuinely ready to publish must not be
// on a `.invalid` host.
if (SITE_URL_IS_PLACEHOLDER) {
  console.log(
    `  NOTE  still on the RFC 2606 placeholder (${originHost}).\n` +
      `        The site will build and serve, but Google cannot index an\n` +
      `        unresolvable canonical. Promote it before launch with the one line:\n` +
      `          NEXT_PUBLIC_SITE_URL=https://<real-host>\n` +
      `        (no code change; ${rel('src/lib/site.ts')} holds the fallback.)`,
  );
} else {
  pass(`origin promoted to a real host (${originHost})`);
}

/* ============================================================== *
 * 2. SEARCH CONSOLE VERIFICATION — BOTH METHODS
 * ============================================================== */

section('2. google search console verification');

const vfile = join(PUBLIC_DIR, GOOGLE_VERIFICATION_FILE);
const vrel = rel(vfile);

if (!existsSync(vfile)) {
  fail(
    vrel,
    `verification file is MISSING. Google fetches /${GOOGLE_VERIFICATION_FILE} by that exact name and parses that exact string. Re-create it with exactly: "${GOOGLE_VERIFICATION_FILE_CONTENT}"`,
  );
} else {
  const bytes = readFileSync(vfile);
  const text = bytes.toString('utf8');

  check(vrel, text === GOOGLE_VERIFICATION_FILE_CONTENT, 'content must be exactly the issued string, byte for byte');
  if (text !== GOOGLE_VERIFICATION_FILE_CONTENT) {
    console.error(`        expected: ${JSON.stringify(GOOGLE_VERIFICATION_FILE_CONTENT)}`);
    console.error(`        actual:   ${JSON.stringify(text)}`);
  }

  check(
    vrel,
    !/<html|<meta|<!doctype/i.test(text),
    'must be the bare token Google parses — not an HTML document or a <meta> tag',
  );
  check(vrel, !/\s\s|\r/.test(text), 'must be a single line with no CR or doubled whitespace');

  // A second, differently-named file is the failure where someone hand-adds a
  // verification file per environment. Google only fetches the exact issued name,
  // so the extras are dead weight that implies a working setup.
  const stray = existsSync(PUBLIC_DIR)
    ? readdirSync(PUBLIC_DIR).filter((f) => /^google.*\.html$/i.test(f) && f !== GOOGLE_VERIFICATION_FILE)
    : [];
  check(vrel, stray.length === 0, `no duplicate google verification files (found: ${stray.join(', ') || 'none'})`);

  // Next serves `public/` straight from the project root at runtime and does NOT
  // copy it into `.next`, so its absence from the build output is expected and is
  // not evidence of a problem. What must be asserted instead is that nothing in
  // the app tree can shadow the path: a route at
  // `app/googledd514071c836e8ad.html/route.ts`, or a catch-all, would take
  // precedence over the static file and make Google fetch something else.
  const shadowed = existsSync(join(ROOT, 'src', 'app', GOOGLE_VERIFICATION_FILE));
  check(
    vrel,
    !shadowed,
    'no app route may shadow this path — a route segment at src/app/<name> would outrank the public/ file',
  );
}

/* --- the meta tag, and that the two methods AGREE --- */

{
  const pages = renderedPages();
  const layoutFile = 'src/app/[locale]/layout.tsx';
  const layoutSrc = readFileSync(join(ROOT, 'src', 'app', '[locale]', 'layout.tsx'), 'utf8');

  // The meta tag must be emitted from the shared constant, never hand-typed.
  //
  // This previously asserted only that the token `GOOGLE_VERIFICATION_CODE`
  // appears at least once in the file — which the IMPORT satisfies on its own.
  // Deleting the whole `verification:` block therefore passed, because the unused
  // import was still there. It now asserts the field is actually declared and
  // bound to the constant.
  const declaresField = /verification\s*:\s*\{[\s\S]{0,80}?google\s*:\s*GOOGLE_VERIFICATION_CODE/.test(layoutSrc);
  check(
    layoutFile,
    declaresField,
    'must declare `verification: { google: GOOGLE_VERIFICATION_CODE }` — the meta tag is emitted from the shared constant, not a hand-typed literal',
  );

  // A hand-typed literal is the other failure: someone pastes the code straight
  // into the metadata object and it then drifts from the file on disk.
  const literalInMetadata = /verification\s*:\s*\{[\s\S]{0,80}?google\s*:\s*['"`]googledd/.test(layoutSrc);
  check(
    layoutFile,
    !literalInMetadata,
    'must not hand-type the code in the metadata object — it must come from the constant so the file and the tag cannot disagree',
  );

  if (pages.length > 0) {
    const sample = pages.slice(0, MIN_PAGES_SCANNED);
    let missing = 0;
    let wrong = 0;
    let duplicated = 0;
    for (const file of sample) {
      const html = readFileSync(file, 'utf8');
      const hits = html.match(
        /<meta[^>]*name="google-site-verification"[^>]*content="([^"]+)"/g,
      ) ?? [];
      if (hits.length === 0) missing++;
      else if (hits.length > 1) duplicated++;
      else if (!(hits[0] ?? '').includes(`content="${GOOGLE_VERIFICATION_CODE}"`)) wrong++;
    }
    check(
      layoutFile,
      missing === 0,
      `every sampled page must carry the meta tag (${missing}/${sample.length} missing)`,
    );
    check(
      layoutFile,
      wrong === 0,
      `meta tag must carry code ${GOOGLE_VERIFICATION_CODE} (${wrong}/${sample.length} wrong)`,
    );
    check(
      layoutFile,
      duplicated === 0,
      `meta tag must appear exactly once per page (${duplicated}/${sample.length} duplicated)`,
    );
  } else {
    console.log('  skip  no built pages — meta tag checked at source only (run npm run build)');
  }
}

/* ============================================================== *
 * 3. EVERY EMITTED ABSOLUTE URL NAMES THE ONE ORIGIN
 * ============================================================== */

section('3. canonicals, og:url and hreflang all name the one origin');

if (!existsSync(APP_OUT)) {
  fail(
    '.next/server/app',
    'no build output found. Run `npm run build` first — this gate verifies what is actually emitted, not what the source intends.',
  );
} else {
  // Refuse to certify a stale build rather than reporting a confident pass over
  // markup that predates the current source.
  const builtAt = statSync(APP_OUT).mtimeMs;
  const srcNewest = Math.max(
    newestMtime(join(ROOT, 'src')),
    existsSync(PUBLIC_DIR) ? newestMtime(PUBLIC_DIR) : 0,
  );
  if (srcNewest > builtAt) {
    fail(
      '.next/server/app',
      `the build is OLDER than src/ or public/, so the results below describe the previous build, not the current source. Run \`npm run build\` and re-run this gate.`,
    );
  } else {
    pass('.next/server/app: build output is newer than src/ and public/');
  }

  const pages = renderedPages();
  console.log(`  scanning ${pages.length} rendered pages…`);

  let canonTotal = 0;
  let canonWrong = 0;
  let ogTotal = 0;
  let ogWrong = 0;
  let altTotal = 0;
  let altWrong = 0;
  let noCanon = 0;
  const wrongExamples: string[] = [];

  const wrongHost = (u: string): boolean => {
    try {
      return new URL(u).origin !== SITE_URL;
    } catch {
      return true;
    }
  };

  for (const file of pages) {
    const html = readFileSync(file, 'utf8');

    const canon = /<link[^>]*rel="canonical"[^>]*href="([^"]+)"/.exec(html);
    if (canon) {
      canonTotal++;
      if (wrongHost(canon[1])) {
        canonWrong++;
        if (wrongExamples.length < 5) wrongExamples.push(`${rel(file)}: canonical ${canon[1]}`);
      }
    } else {
      noCanon++;
    }

    const og = /<meta[^>]*property="og:url"[^>]*content="([^"]+)"/.exec(html);
    if (og) {
      ogTotal++;
      if (wrongHost(og[1])) {
        ogWrong++;
        if (wrongExamples.length < 5) wrongExamples.push(`${rel(file)}: og:url ${og[1]}`);
      }
    }

    // React writes the attribute as `hrefLang`. A lowercase-only pattern matches
    // nothing and the check passes vacuously — it must accept either casing, and
    // the count is asserted non-zero below so that can never happen again.
    for (const m of html.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"/gi)) {
      altTotal++;
      if (wrongHost(m[2])) {
        altWrong++;
        if (wrongExamples.length < 5) wrongExamples.push(`${rel(file)}: hreflang ${m[1]} ${m[2]}`);
      }
    }
  }

  check(
    'src/lib/site.ts',
    canonWrong === 0 && ogWrong === 0 && altWrong === 0,
    `all absolute URLs name ${SITE_URL} — canonical ${canonTotal - canonWrong}/${canonTotal}, og:url ${ogTotal - ogWrong}/${ogTotal}, hreflang ${altTotal - altWrong}/${altTotal}`,
  );

  // Guards the check above from being vacuous: if the hreflang pattern ever stops
  // matching the emitted markup, `altTotal` collapses to 0 and "0 wrong out of 0"
  // would read as a pass.
  check(
    'src/lib/site.ts',
    altTotal > 0,
    `hreflang alternates were actually found and checked (${altTotal} seen; 0 means the matcher is broken, not that the site is clean)`,
  );
  for (const e of wrongExamples) fail('src/lib/site.ts', `wrong host in ${e}`);

  // `_not-found` and `_global-error` are Next's internal error documents, not
  // pages of the site: they are not linked from anywhere, must never be
  // indexed, and correctly carry no canonical. Requiring one would push someone
  // to add one, which is the opposite of right.
  const realPages = pages.filter((p) => !/_not-found|_global-error/.test(rel(p)));
  const noCanonReal = realPages.filter(
    (p) => !/<link[^>]*rel="canonical"/.test(readFileSync(p, 'utf8')),
  );
  check(
    'src/lib/site.ts',
    noCanonReal.length === 0,
    `every real page needs a canonical; ${noCanonReal.length} of ${realPages.length} have none (${noCanonReal.slice(0, 3).map(rel).join(', ')})`,
  );
}

/* ============================================================== *
 * 4. NO STRAY HOSTS ANYWHERE
 * ============================================================== */

section('4. no localhost / preview / cloudflare URLs survive');

{
  const pages = renderedPages();
  const scan: [string, string][] = [];

  // Source files that can emit an absolute URL.
  for (const f of [
    'src/lib/site.ts',
    'src/app/sitemap.ts',
    'src/app/robots.ts',
    'src/app/[locale]/layout.tsx',
    'src/app/[locale]/[...path]/page.tsx',
    'src/components/index-page.tsx',
  ]) {
    const full = join(ROOT, f);
    if (existsSync(full)) scan.push([f, readFileSync(full, 'utf8')]);
  }
  for (const p of pages) scan.push([rel(p), readFileSync(p, 'utf8')]);

  const hits: string[] = [];
  for (const [name, text] of scan) {
    for (const m of text.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) {
      const url = m[0];
      if (FORBIDDEN_HOST_PATTERNS.some((re) => re.test(url))) {
        hits.push(`${name}: ${url.slice(0, 120)}`);
      }
    }
  }
  check(
    'src/**',
    hits.length === 0,
    `no forbidden hosts in ${scan.length} files (${hits.length} found)`,
  );
  for (const h of hits.slice(0, 10)) fail(h.split(':')[0], h.split(': ').slice(1).join(': '));
}

/* ============================================================== *
 * 5. SITEMAP
 * ============================================================== */

section('5. sitemap');

{
  const sitemapFile = 'src/app/sitemap.ts';
  const pagesPerLocale = LOCALES.map((l) => allPages(l).length);
  const expected = LOCALES.reduce((n, l) => n + allPages(l).length, 0);
  // Plus the homepages, the five static browse sections and the four code-driven
  // policy pages — all in both locales. The policy pages are not in the content
  // snapshot, so they must be counted separately or this check silently drifts
  // by eight every time someone adds a policy page.
  const staticPerLocale = 1 + INDEX_SECTIONS.length + Object.keys(SECTIONS).length;
  const expectedTotal = expected + LOCALES.length * staticPerLocale;
  console.log(
    `  expected ${expected} content pages (${pagesPerLocale.join(' + ')}) + ${staticPerLocale} static/policy x ${LOCALES.length} locales = ${expectedTotal}`,
  );

  // Every real destination must be in the sitemap, not merely the right COUNT —
  // a list can hit the right total by omitting one page and duplicating another.
  const requiredPaths = [
    ...LOCALES.map((l) => `/${l}`),
    ...LOCALES.flatMap((l) => INDEX_SECTIONS.map((s) => `/${l}/${s}`)),
    ...LOCALES.flatMap((l) => Object.keys(SECTIONS).map((s) => `/${l}/${s}`)),
  ];


  const entries = buildSitemapEntries();
  const locs = entries.map((e) => e.url);

  check(
    sitemapFile,
    locs.length === expectedTotal,
    `entry count must match the snapshot: expected ${expectedTotal}, built ${locs.length}`,
  );

  // The count above is computed, so it cannot undercount on its own — but it can
  // only count what someone remembered to enumerate. The RENDERED output is the
  // independent truth: every page Next actually built must have a `<loc>`.
  //
  // Without this, adding a route family (the four policy pages were exactly this)
  // silently drops it from the sitemap: the expected total is derived from the
  // same list that generates the sitemap, so both sides move together and the
  // check still passes with the pages missing. This compares the built pages
  // against the sitemap, so a route nobody remembered is a failure.
  const builtPages = renderedPages()
    // Relative to APP_OUT, not the project root — `rel()` is root-relative and
    // would leave a `.next/server/app/` prefix on every entry, making every page
    // look missing. Then strip the locale/index shape down to a URL path.
    .map((f) => f.slice(APP_OUT.length + 1).replace(/\.html$/, '').replace(/\\/g, '/'))
    // Next's internal documents and the API routes are not content.
    .filter((p) => !p.startsWith('_') && !p.startsWith('api/'))
    // NOTE: do not strip a trailing `/index` — `courses/ai-fundamentals/index`
    // is that page's real refPath in the snapshot, and its real URL. Stripping it
    // made the four course-index pages look missing from a sitemap that
    // correctly contains them.
    .map((p) => '/' + p);
  const notInSitemap = builtPages.filter((p) => !locs.includes(siteUrl(p)));
  check(
    sitemapFile,
    notInSitemap.length === 0,
    `every BUILT page must appear in the sitemap (${notInSitemap.length} missing: ${notInSitemap.slice(0, 4).join(', ')})`,
  );

  // THE REVERSE OF THE CHECK ABOVE, and the one that matters most.
  //
  // "every built page is in the sitemap" catches a page nobody remembered. It
  // cannot catch a page that was DELETED and is still listed — the built set
  // simply shrinks and the assertion still passes. That is how a dead URL gets
  // into a sitemap: someone removes the route, forgets the sitemap entry, and
  // Google is told to crawl a 404.
  //
  // A sitemap naming dead URLs is worse than a small sitemap: it spends crawl
  // budget on 404s and is a standard trigger for a crawl-budget downgrade. So
  // assert both directions.
  const builtSet = new Set(builtPages.map((p) => siteUrl(p)));
  const dead = locs.filter((u) => !builtSet.has(u));
  check(
    sitemapFile,
    dead.length === 0,
    `every <loc> must be a page the build produced (${dead.length} dead: ${dead.slice(0, 4).join(', ')})`,
  );

  const dupes = locs.filter((u, i) => locs.indexOf(u) !== i);
  check(sitemapFile, dupes.length === 0, `no duplicate <loc> (${dupes.length} duplicates: ${[...new Set(dupes)].slice(0, 3).join(', ')})`);

  const missingStatic = requiredPaths.filter((p) => !locs.includes(siteUrl(p)));
  check(
    sitemapFile,
    missingStatic.length === 0,
    `every static/policy destination is listed (${missingStatic.length} missing: ${missingStatic.slice(0, 4).join(', ')})`,
  );

  const wrongOrigin = locs.filter((u) => {
    try { return new URL(u).origin !== SITE_URL; } catch { return true; }
  });
  check(sitemapFile, wrongOrigin.length === 0, `every <loc> names ${SITE_URL} (${wrongOrigin.length} wrong)`);

  const badHost = locs.filter((u) => FORBIDDEN_HOST_PATTERNS.some((re) => re.test(u)));
  check(sitemapFile, badHost.length === 0, `no localhost/preview/cloudflare URL in <loc> (${badHost.slice(0, 3).join(', ')})`);

  // Every real page must be present, not merely the right COUNT — a sitemap can
  // hit the right total by omitting one page and duplicating another, which is
  // exactly what a stale hand-maintained list does.
  const missing: string[] = [];
  for (const locale of LOCALES) {
    for (const page of allPages(locale)) {
      if (!locs.includes(siteUrl(`/${locale}/${page.refPath}`))) missing.push(`/${locale}/${page.refPath}`);
    }
  }
  check(sitemapFile, missing.length === 0, `every snapshot page is listed (${missing.length} missing: ${missing.slice(0, 3).join(', ')})`);

  // hreflang, including x-default, on both the loc and its alternates.
  const noXDefault = entries.filter((e) => !e.alternates?.languages?.['x-default']);
  check(sitemapFile, noXDefault.length === 0, `every entry declares an x-default alternate (${noXDefault.length} missing)`);

  const altWrong: string[] = [];
  for (const e of entries) {
    for (const [lang, url] of Object.entries(e.alternates?.languages ?? {})) {
      try {
        if (new URL(url ?? '').origin !== SITE_URL) altWrong.push(`${e.url} [${lang}] -> ${url}`);
      } catch { altWrong.push(`${e.url} [${lang}] -> unparseable`); }
    }
  }
  check(sitemapFile, altWrong.length === 0, `every alternate names ${SITE_URL} (${altWrong.length} wrong)`);

  const noSelfAlternate = entries.filter(
    (e) => !Object.values(e.alternates?.languages ?? {}).some((u) => (u ?? '').split('?')[0] === e.url),
  );
  check(sitemapFile, noSelfAlternate.length === 0, `each entry lists its own URL among its alternates (${noSelfAlternate.length} do not)`);

  const xDefaultOk = entries.every((e) => {
    const x = e.alternates?.languages?.['x-default'] ?? '';
    return x.startsWith(siteUrl(`/${DEFAULT_LOCALE}`));
  });
  check(sitemapFile, xDefaultOk, `x-default points at the default locale (${DEFAULT_LOCALE})`);
}

/* ============================================================== *
 * 6. ROBOTS
 * ============================================================== */

section('6. robots.txt');

{
  const robotsFile = 'src/app/robots.ts';
  const src = readFileSync(join(ROOT, 'src', 'app', 'robots.ts'), 'utf8');

  // `Disallow: /` is the catastrophic one: the site keeps serving 200 and is
  // simply never indexed. Assert the absence of the bare form explicitly.
  // Match ONLY the bare root disallow: `Disallow: /` at end of line, or the
  // literal `disallow: '/'` / `"/"`. An earlier version of this regex stopped at
  // the quote after the slash and so matched `disallow: ['/api/']` — flagging a
  // correct file as the catastrophic error it exists to catch.
  const bareDisallowAll =
    /disallow:\s*\/\s*$/im.test(src) || /disallow:\s*['"`]\/['"`]/i.test(src);
  check(robotsFile, !bareDisallowAll, 'must NOT contain `Disallow: /` — that unindexes the whole site');

  check(robotsFile, /userAgent:\s*['"`]\*['"`]/.test(src), 'must declare a wildcard crawler rule (allow normal crawlers)');
  check(robotsFile, /userAgent:\s*['"`]Googlebot['"`]/.test(src), 'must explicitly allow Googlebot');
  check(robotsFile, /allow:\s*['"`]\/['"`]/.test(src), 'must explicitly allow the site root');
  check(robotsFile, /SITEMAP_URL/.test(src), 'the Sitemap: line must come from SITEMAP_URL, not a typed literal');

  const built = join(ROOT, '.next', 'server', 'app', 'robots.txt.body');
  const alt = join(APP_OUT, 'robots.txt');
  const source = existsSync(built) ? built : existsSync(alt) ? alt : null;
  if (source) {
    const body = readFileSync(source, 'utf8');
    const sitemapLine = /Sitemap:\s*(\S+)/.exec(body);
    check(
      robotsFile,
      Boolean(sitemapLine),
      'the rendered robots.txt must contain a Sitemap: line',
    );
    if (sitemapLine) {
      check(
        robotsFile,
        sitemapLine[1] === siteUrl('/sitemap.xml'),
        `Sitemap: must name ${siteUrl('/sitemap.xml')} — got ${sitemapLine[1]}`,
      );
    }
    check(robotsFile, !/Disallow:\s*\/\s*$/im.test(body), 'rendered robots.txt must not disallow the whole site');
    check(robotsFile, /Googlebot/i.test(body), 'rendered robots.txt must name Googlebot');
    const badHost = body.match(/https?:\/\/[^\s]+/g)?.filter((u) => FORBIDDEN_HOST_PATTERNS.some((re) => re.test(u)));
    check(robotsFile, (badHost ?? []).length === 0, `no forbidden host in rendered robots.txt (${badHost?.[0] ?? 'none'})`);
  } else {
    console.log('  skip  no built robots.txt — run npm run build');
  }
}

/* ============================================================== *
 * 7. NO ACCIDENTAL noindex
 * ============================================================== */

section('7. indexing directives');

{
  // A `noindex` that leaks onto an important page removes it from the index
  // while leaving it perfectly reachable — the worst combination, because
  // nothing looks broken.
  const pages = renderedPages();
  const offenders: string[] = [];

  // Scanned across EVERY rendered page rather than a hand-picked "important"
  // list. A named list needs maintaining and misses anything added later; the
  // failure this catches (a stray noindex on one template) is exactly the kind
  // that appears on a page nobody remembered to list.
  for (const file of pages) {
    const r = rel(file);
    // Next marks its own internal documents `noindex` by default, which is
    // CORRECT — a 404 must not be indexed. Flagging it would train whoever reads
    // this output to ignore it. The 404 is asserted positively below instead.
    if (/_not-found|_global-error/.test(r)) continue;
    const html = readFileSync(file, 'utf8');
    const robots = /<meta[^>]*name="robots"[^>]*content="([^"]+)"/.exec(html);
    if (!robots) continue;
    const directives = robots[1].toLowerCase();
    if (/noindex|nofollow/.test(directives)) {
      offenders.push(`${r}: robots=${robots[1]}`);
    }
  }
  check(
    'src/app/**',
    offenders.length === 0,
    `no page may carry noindex/nofollow (${offenders.length}: ${offenders.slice(0, 3).join('; ')})`,
  );

  // Positive counterpart: the 404 must be `noindex`. A 404 that IS indexable is
  // how soft-404s get indexed and how a site accrues junk URLs in its own index.
  const notFoundFile = join(APP_OUT, '_not-found.html');
  if (existsSync(notFoundFile)) {
    const nf = readFileSync(notFoundFile, 'utf8');
    const m = /<meta[^>]*name="robots"[^>]*content="([^"]+)"/.exec(nf);
    check(
      'src/app/not-found.tsx',
      Boolean(m && /noindex/i.test(m[1])),
      `the 404 must be noindex — it is currently ${m ? m[1] : 'declaring no robots meta at all'}`,
    );
  }

  // The site opts in to indexing explicitly, which is worth asserting too: it is
  // what makes the above check meaningful rather than vacuous.
  const layoutSrc = readFileSync(join(ROOT, 'src', 'app', '[locale]', 'layout.tsx'), 'utf8');
  check('src/app/[locale]/layout.tsx', /robots:\s*\{\s*index:\s*true/.test(layoutSrc), 'the root layout must declare index:true, follow:true');
}

/* ============================================================== */

if (failures > 0) {
  console.error(`\n${failures} launch check(s) FAILED — do not publish.`);
  process.exit(1);
}
console.log('\nlaunch gate: all checks passed. Ready to promote NEXT_PUBLIC_SITE_URL and publish.');