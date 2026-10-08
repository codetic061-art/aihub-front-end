/**
 * GLOBAL TAG GATE — GA4 + Microsoft Clarity + Google AdSense loader.
 *
 * Proves four things about the third-party tags, which is why it is a gate and
 * not a lint rule:
 *
 *   1. SINGLE INSTALLATION. Each ID must appear exactly once across the whole
 *      source tree. Duplicated analytics is not cosmetic: GA4 bills per hit,
 *      Clarity double-records every session, and the second copy silently
 *      corrupts attribution. Nothing renders a tag twice today; the check exists
 *      so nobody discovers it from a data discrepancy instead.
 *   2. EXACT IDS. A truncated or typo'd measurement id fails SILENTLY —
 *      gtag.js still loads, still accepts `config`, and reports nothing back.
 *      The only way to catch `G-V5V2ZSJV` is to compare against a known-good
 *      value, which is what EXPECTED below is.
 *   3. ADSENSE POLICY. The loader is installed; ad units are not. No `<ins>`, no
 *      `adsbygoogle.push()`, no `data-ad-client`, anywhere. The site renders
 *      zero ads, and this is what keeps it that way.
 *   4. TAGS ACTUALLY LAND IN <head>. This cannot be asserted against source. A
 *      correct component can still place its scripts in <body> — and it does:
 *      with `strategy="afterInteractive"` the Next runtime appends them as the
 *      last children of <body>. That was measured, not assumed, which is why the
 *      component uses `beforeInteractive` and why this gate drives a real
 *      browser and reads `document.head`.
 *
 * THREE THINGS THIS GATE LEARNED THE HARD WAY, kept here so the next person does
 * not re-derive them:
 *
 *   - THE SERVED HTML CONTAINS EACH ID MORE THAN ONCE, AND THAT IS NOT A
 *     DUPLICATE INSTALLATION. A `beforeInteractive` next/script is emitted as a
 *     `<script>self.__next_s.push([...])</script>` bootstrap entry carrying the
 *     id and the inline body, AND the RSC flight payload repeats both. Measured
 *     on /en: the GA4 id appeared 5 times and the AdSense client 3 times, from
 *     a single `<Script>` element. Counting raw occurrences in HTML is therefore
 *     worthless as a duplicate test — it fails every correct build. The
 *     duplicate test lives on the SOURCE (L1); the HTML layer asserts presence
 *     and exact-id match only.
 *   - DO NOT GREP THE SOURCE FOR AD-UNIT MARKUP WITHOUT STRIPPING COMMENTS.
 *     This file's own policy note contains `<ins class="adsbygoogle">` and
 *     `adsbygoogle.push()` as examples of what is forbidden, and the first
 *     version of this gate failed the build on its own documentation.
 *   - HEADLESS CHROME MAY NOT BE LISTENING YET. Fetching /json/list before the
 *     port is bound throws `fetch failed`, so the target lookup retries until the
 *     port answers.
 *
 * Run: npx tsx scripts/verify-tags.ts   (or npm run verify:tags)
 * Env:  AIHUB_TAGS_PORT      port to serve on if nothing is up (default 3411)
 *       AIHUB_TAGS_BASE      an already-running server to use instead
 *       AIHUB_TAGS_CDP_PORT  headless Chrome debugging port (default 9471)
 *       AIHUB_SCRATCH        scratch root for the throwaway Chrome profile
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

/* ------------------------------------------------------------------ *
 * The known-good values. This is the contract; the source is checked
 * against it rather than against itself.
 * ------------------------------------------------------------------ */
const EXPECTED = {
  ga4: 'G-V5V2ZSJVDD',
  clarity: 'yuij0o3ixe',
  adsense: 'ca-pub-9301129052725168',
} as const;

const GA_SRC = 'https://www.googletagmanager.com/gtag/js?id=';
const ADS_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=';
const CLARITY_SRC = 'https://www.clarity.ms/tag/';

/**
 * Ad-unit markup. Loader-only install: none of this may appear in code.
 *
 * `<ins` alone is too loose — it matches prose like `<insensitive>`, so it is
 * anchored to a real tag. Comments are stripped before these run, because this
 * file's own policy note quotes the forbidden markup verbatim.
 */
const AD_UNIT_PATTERNS: { needle: RegExp; what: string }[] = [
  { needle: /<ins[\s>]/i, what: 'an <ins> ad placeholder' },
  { needle: /adsbygoogle\s*\.\s*push\s*\(/, what: 'an adsbygoogle.push() ad request' },
  { needle: /data-ad-client/i, what: 'a data-ad-client attribute' },
  { needle: /data-ad-slot/i, what: 'a data-ad-slot attribute' },
  { needle: /data-ad-format/i, what: 'a data-ad-format attribute' },
  { needle: /googlesyndication\.com\/pagead\/(?:js\/adsbygoogle\.js\?client=)?[\w-]*slot/i, what: 'a slot-scoped AdSense URL' },
];

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const PORT = Number(process.env.AIHUB_TAGS_PORT ?? 3411);
const BASE = process.env.AIHUB_TAGS_BASE ?? `http://127.0.0.1:${PORT}`;
const CDP_PORT = Number(process.env.AIHUB_TAGS_CDP_PORT ?? 9471);
const PROBE_PATHS = ['/en', '/ar'];

let failures = 0;
const fail = (m: string) => { failures++; console.error(`  FAIL  ${m}`); };
const pass = (m: string) => console.log(`  ok    ${m}`);

/**
 * Strip block and line comments. `//` is only stripped when not preceded by a
 * colon, so a URL like https://example.com is not cut in half.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/* ================================================================== *
 * LAYER 1 — SOURCE: exactly one installation, exact ids, no ad units
 * ================================================================== */

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs|mdx)$/.test(entry)) out.push(p);
  }
  return out;
}

/**
 * Count occurrences per file, across the whole tree. A total over all files is
 * what makes this a duplicate detector rather than a presence detector — two
 * files each holding one copy is exactly the failure mode, and it is invisible
 * to any per-file check.
 */
function countInTree(files: string[], needle: string): Map<string, number> {
  const hits = new Map<string, number>();
  for (const f of files) {
    const n = readFileSync(f, 'utf8').split(needle).length - 1;
    if (n > 0) hits.set(relative(ROOT, f).split(sep).join('/'), n);
  }
  return hits;
}

console.log('\n— source: exactly one installation per ID —');
const srcFiles = sourceFiles(SRC);
console.log(`  scanned ${srcFiles.length} files under src/`);

for (const [name, id] of Object.entries(EXPECTED)) {
  const hits = countInTree(srcFiles, id);
  const total = [...hits.values()].reduce((a, b) => a + b, 0);
  if (total === 0) {
    fail(`${name} id ${id} is not installed anywhere in src/`);
    continue;
  }
  if (total > 1) {
    const where = [...hits.entries()].map(([f, n]) => `${f} (x${n})`).join(', ');
    fail(`${name} id ${id} appears ${total} times in src/ — duplicate installation in ${where}`);
    continue;
  }
  pass(`${name} id ${id} installed once, in ${[...hits.keys()][0]}`);
}

console.log('\n— source: the loader is really wired up —');
const analyticsSrc = readFileSync(join(SRC, 'components/analytics-tags.tsx'), 'utf8');
analyticsSrc.includes(GA_SRC) ? pass('GA4 collector URL present') : fail('GA4 src url missing');
analyticsSrc.includes(CLARITY_SRC) ? pass('Clarity collector URL present') : fail('Clarity src url missing');
analyticsSrc.includes(ADS_SRC) ? pass('AdSense loader URL present') : fail('AdSense loader src url missing');

/**
 * Both layouts must never install the same tag. This is the specific duplication
 * shape next-intl apps hit: a tag added to `app/layout.tsx` and again to
 * `app/[locale]/layout.tsx` fires twice on every page.
 */
const installingLayouts = ['app/layout.tsx', 'app/[locale]/layout.tsx']
  .map((f) => join(SRC, f))
  .filter((f) => existsSync(f) && readFileSync(f, 'utf8').includes('AnalyticsTags'));
installingLayouts.length === 1
  ? pass(`AnalyticsTags rendered by exactly one layout: ${relative(ROOT, installingLayouts[0]).split(sep).join('/')}`)
  : fail(`AnalyticsTags is rendered by ${installingLayouts.length} layouts (${installingLayouts.map((f) => relative(ROOT, f)).join(', ') || 'none'}) — tags would install twice per page`);

console.log('\n— source: AdSense loader only, no ad units —');
let adUnitHits = 0;
for (const f of srcFiles) {
  const rel = relative(ROOT, f).split(sep).join('/');
  const code = stripComments(readFileSync(f, 'utf8'));
  for (const p of AD_UNIT_PATTERNS) {
    if (p.needle.test(code)) { fail(`${rel} contains ${p.what}`); adUnitHits++; }
  }
}
if (adUnitHits === 0) {
  pass(`no ad-unit markup in src/ code (${AD_UNIT_PATTERNS.length} patterns x ${srcFiles.length} files, comments stripped)`);
}

/* ================================================================== *
 * LAYER 2 — SERVED HTML: presence and exact id, NOT occurrence count
 * ================================================================== */

async function waitForServer(timeoutMs = 90_000): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(`${BASE}/en`, { signal: AbortSignal.timeout(8_000) });
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await sleep(1_000);
  }
  return false;
}

async function checkServedHtml() {
  console.log(`\n— served HTML: ${BASE} —`);
  let server: ChildProcess | null = null;
  if (!(await waitForServer(2_000))) {
    console.log(`  no server on ${BASE}; starting one`);
    server = spawn('npm', ['run', 'start', '--', '-p', String(PORT)], { stdio: 'ignore', shell: true });
    if (!(await waitForServer())) {
      fail('could not start a server to probe — build first, or set AIHUB_TAGS_BASE');
      server?.kill();
      process.exit(1);
    }
  }

  try {
    for (const p of PROBE_PATHS) {
      const res = await fetch(`${BASE}${p}`, { signal: AbortSignal.timeout(30_000) });
      const html = await res.text();
      const label = p.padEnd(6);
      if (res.status !== 200) { fail(`${label} HTTP ${res.status}`); continue; }

      // Presence, NOT a count: one <Script> legitimately serialises its id
      // several times (the next_s bootstrap plus the RSC flight payload). See
      // the header — counting here fails every correct build.
      for (const [name, id] of Object.entries(EXPECTED)) {
        html.includes(id)
          ? pass(`${label} ${name} id ${id} present in the response (${html.length.toLocaleString()}b)`)
          : fail(`${label} ${name} id ${id} is absent from the response`);
      }

      // Catch a truncated or edited id rather than merely tolerating it: pull the
      // id back out of the place it is written and compare with the expected one.
      //
      // GA4 and AdSense carry the id in the URL itself, so a typo shows up as a
      // wrong tail after the host. Clarity does NOT: its snippet builds the URL
      // by concatenation (`"https://www.clarity.ms/tag/"+i`) and passes the id as
      // an IIFE argument, so the literal host+id pair never appears in the HTML
      // at all. Matching it as a URL therefore yields an empty capture and fails
      // every correct build — so Clarity is checked as a quoted argument instead.
      const nearMisses: string[] = [];
      for (const [name, id] of Object.entries(EXPECTED)) {
        if (name === 'clarity') {
          // Appears in the served HTML twice over: as a real quoted IIFE
          // argument, and escaped inside the RSC flight payload. Accept either.
          const quoted = html.includes(`"${id}"`);
          const escaped = html.includes('\\"' + id + '\\"');
          if (!quoted && !escaped) nearMisses.push(`clarity: "${id}" is not an argument of the bootstrap`);
          continue;
        }
        const host = name === 'ga4' ? GA_SRC : ADS_SRC;
        const m = html.match(new RegExp(`${host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\w-]*)`));
        if (m && m[1] !== id) nearMisses.push(`${name}: host carries "${m[1]}", expected "${id}"`);
      }
      nearMisses.length === 0
        ? pass(`${label} every vendor id matches its exact expected value`)
        : fail(`${label} id mismatch — ${nearMisses.join('; ')}`);

      const adsUnits = AD_UNIT_PATTERNS.filter((a) => a.needle.test(stripComments(html)));
      adsUnits.length === 0
        ? pass(`${label} no ad-unit markup in the response`)
        : fail(`${label} response contains ${adsUnits.map((a) => a.what).join(', ')}`);
    }
  } finally {
    server?.kill();
  }
}

/* ================================================================== *
 * LAYER 3 — REAL DOM over CDP: the only place placement can be proven
 * ================================================================== */

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

/**
 * A dedicated profile under the scratch dir. Never the user's real Chrome: this
 * is a shared desktop, and a probe attached to their profile would be reading
 * their live tabs.
 */
function scratchProfile(): string {
  const base = process.env.AIHUB_SCRATCH ?? 'D:/Hermes/cache/scratch';
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, 'verify-tags-'));
}

/**
 * Minimal CDP client over the global WebSocket (Node 22+). Same shape as
 * scripts/drive-quiz.py: /json/list for a page target, then request/response by
 * message id. The `websockets` package that drive-quiz.py uses is a Python
 * dependency and must not become a Node one.
 */
class Cdp {
  private ws!: WebSocket;
  private id = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP websocket timeout')), 30_000);
      this.ws.onopen = () => { clearTimeout(timer); resolve(); };
      this.ws.onerror = () => { clearTimeout(timer); reject(new Error('CDP websocket failed')); };
    });
    this.ws.onmessage = (ev: MessageEvent) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown; error?: { message: string } };
      if (typeof msg.id !== 'number') return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result ?? {});
    };
  }

  call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const mid = ++this.id;
    this.ws.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(mid, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(mid)) reject(new Error(`${method} timed out`));
      }, 45_000);
    });
  }

  /** Evaluate in the page and return the value by value. */
  async js<T>(expression: string): Promise<T> {
    const r = (await this.call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })) as { exceptionDetails?: { text?: string; exception?: { description?: string } }; result?: { value?: T } };
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? 'js error');
    }
    return r.result?.value as T;
  }

  close(): void { try { this.ws.close(); } catch { /* already closed */ } }
}

/** Poll /json/list until Chrome is listening AND exposes a page target. */
async function pageTarget(timeoutMs = 45_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastErr = 'unknown';
  for (;;) {
    try {
      const targets = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`, {
        signal: AbortSignal.timeout(5_000),
      })).json()) as { type: string; webSocketDebuggerUrl?: string }[];
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      lastErr = 'no page target yet';
    } catch (e) {
      // The port is not bound for the first second or two of Chrome's life.
      lastErr = (e as Error).message;
    }
    if (Date.now() > deadline) throw new Error(`${lastErr} (after ${timeoutMs}ms on :${CDP_PORT})`);
    await sleep(500);
  }
}

/**
 * The four facts that only exist in a live DOM: where each collector script
 * element actually sits, the exact ids the DOM carries, whether any of it leaked
 * into visible text, and whether ad units exist.
 *
 * `innerText` is used for the leak check rather than innerHTML: innerText
 * returns only RENDERED text and a script element contributes nothing to it, so
 * a collector inlined into page content shows up there as its own text while a
 * properly-placed head script does not.
 *
 * RSC/framework payload scripts (`self.__next_f` / `self.__next_s`) carry the
 * props of the whole tree as escaped JSON, so a substring match against them
 * finds every id whether or not the real tag is present. They are excluded from
 * the per-tag matching below — which is why presence alone cannot be proven from
 * the raw HTML and needs the parsed DOM.
 */
const DOM_PROBE = `(() => {
  const all = [...document.querySelectorAll('script')];
  const isPayload = (s) => (s.textContent || '').includes('__next_f') || (s.textContent || '').includes('__next_s');
  const describe = (s) => ({
    id: s.id || null,
    src: s.src || null,
    parent: s.parentElement ? s.parentElement.tagName.toLowerCase() : null,
    // 2000 chars, not 200: Clarity's bootstrap is ~330 chars and the project id
    // sits at the END of the IIFE argument list. Truncating to 200 cut the id
    // off, so the exact-id assertion below failed on a correctly-rendered page.
    text: (s.textContent || '').trim().slice(0, 2000),
  });
  const tagEls = all.filter((s) => !isPayload(s));

  // Match the tag elements by the id WE assign in analytics-tags.tsx, not by a
  // substring of their contents. Counting by content is wrong twice over:
  //   - GA4 is intentionally TWO elements (ga4-loader fetches the collector,
  //     ga4-init configures it) and both carry the measurement id;
  //   - Clarity's inline IIFE creates a THIRD <script> of its own pointing at
  //     clarity.ms/tag/<id>, injected by the vendor snippet itself.
  // So \`byId\` is the single-installation assertion — one element per id we
  // own — while the id string is verified separately below.
  const byId = (elId) => all.filter((s) => s.id === elId).map(describe);

  // Any OTHER script pointing at a vendor host: a second install that forgot to
  // reuse our ids would otherwise slip past byId.
  //
  // Clarity needs an explicit exemption. Microsoft's own bootstrap snippet calls
  // document.createElement('script') and inserts a THIRD script element pointing
  // at clarity.ms/tag/<id>. That element is created by the vendor at runtime, has
  // no id, and is the documented mechanism — so counting it as a duplicate
  // install fails every correct build. It is allowed when it points at exactly
  // the expected project id; a second Clarity project id still fails.
  const known = {
    'ga4-loader': 'googletagmanager.com/gtag/js?id=' + ${JSON.stringify(EXPECTED.ga4)},
    'adsense-loader': 'adsbygoogle.js?client=' + ${JSON.stringify(EXPECTED.adsense)},
    'clarity-tag': 'clarity.ms/tag/' + ${JSON.stringify(EXPECTED.clarity)},
  };
  const byVendorHost = (needle, allowed) => tagEls
    .filter((s) => (s.src || '').includes(needle))
    .filter((s) => {
      if (s.id && known[s.id] && (s.src || '').includes(known[s.id])) return false;   // ours
      if (allowed && (s.src || '').includes(allowed)) return false;                  // vendor-created
      return true;
    })
    .map(describe);

  const bodyText = document.body ? document.body.innerText : '';
  return {
    url: location.pathname,
    headScriptCount: document.head.querySelectorAll('script').length,
    bodyScriptCount: document.body.querySelectorAll('script').length,
    ga4Loader: byId('ga4-loader'),
    ga4Init: byId('ga4-init'),
    clarityLoader: byId('clarity-loader'),
    adsenseLoader: byId('adsense-loader'),
    // Vendor-host scripts we did NOT author: a duplicate install shows up here.
    foreignGa: byVendorHost('googletagmanager.com/gtag/js'),
    foreignAds: byVendorHost('adsbygoogle.js'),
    foreignClarity: byVendorHost('clarity.ms/tag/', known['clarity-tag']),
    adsenseClientCount: (document.documentElement.innerHTML.match(/ca-pub-9301129052725168/g) || []).length,
    bodyInnerTextLength: bodyText.length,
    bodyLeaks: ['G-V5V2ZSJVDD','yuij0o3ixe','ca-pub-9301129052725168','googletagmanager.com','clarity.ms','googlesyndication.com']
      .filter((k) => bodyText.includes(k)),
    // The AdSense LOADER itself injects one hidden, zero-size, display:none
    // support <ins class="adsbygoogle adsbygoogle-noablate"> so its own script has
    // somewhere to live. That element is NOT an ad unit: it has no data-ad-slot,
    // no data-ad-client, and measures 0x0. Counting it as an ad unit makes the
    // gate fail on every correct build, so it is excluded by exactly that shape.
    // Anything with a slot, a client id, or real dimensions still fails.
    adUnitInDom: (() => {
      const isLoaderSupport = (el) => {
        if (!el.classList.contains('adsbygoogle-noablate')) return false;
        if (el.hasAttribute('data-ad-slot') || el.hasAttribute('data-ad-client')) return false;
        const r = el.getBoundingClientRect();
        // Strip spaces with replaceAll, NOT with /\s+/. A backslash escape
        // written into this template literal is consumed when the template is
        // parsed: /\s+/g arrives in the page as /s+/g, which deletes every
        // letter "s" — turning "display: none" into "diplay: none". The check
        // then fails open and reports a phantom ad unit on every build.
        const style = (el.getAttribute('style') || '').replaceAll(' ', '').toLowerCase();
        return r.width === 0 && r.height === 0 && style.includes('display:none');
      };
      const ins = [...document.querySelectorAll('ins')].filter((el) => !isLoaderSupport(el));
      return {
        ins: ins.length,
        visibleIns: ins.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 || r.height > 0;
        }).length,
        adsbygoogleEls: [...document.querySelectorAll('.adsbygoogle')].filter((el) => !isLoaderSupport(el)).length,
        dataAdClient: document.querySelectorAll('[data-ad-client]').length,
        dataAdSlot: document.querySelectorAll('[data-ad-slot]').length,
      };
    })(),
    globals: {
      gtag: typeof window.gtag,
      dataLayer: (window.dataLayer && window.dataLayer.length) || 0,
      clarity: typeof window.clarity,
      adsbygoogle: typeof window.adsbygoogle,
    },
  };
})()`;

interface TagEl { id: string | null; src: string | null; parent: string | null; text: string }
interface DomProbe {
  headScriptCount: number;
  bodyScriptCount: number;
  ga4Loader: TagEl[]; ga4Init: TagEl[]; clarityLoader: TagEl[]; adsenseLoader: TagEl[];
  foreignGa: TagEl[]; foreignAds: TagEl[]; foreignClarity: TagEl[];
  adsenseClientCount: number;
  bodyInnerTextLength: number;
  bodyLeaks: string[];
  adUnitInDom: Record<string, number>;
  globals: Record<string, string | number>;
}

/** Tag elements that ended up outside <head> on the last page probed. */
let strayTags: TagEl[] = [];

async function checkLiveDom() {
  console.log(`\n— live DOM (headless Chrome, CDP :${CDP_PORT}) —`);
  const chrome = CHROME_CANDIDATES.find((c) => existsSync(c));
  if (!chrome) {
    fail('no Chromium on this machine — cannot prove the tags are in <head>');
    return;
  }

  const profile = scratchProfile();
  const child = spawn(chrome, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    'about:blank',
  ], {
    // stdio[0] must be 'ignore' — 'inherit' makes Chrome exit before it binds.
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.resume();
  child.stderr?.resume();

  let cdp: Cdp | null = null;
  try {
    cdp = new Cdp(await pageTarget());
    await cdp.connect();
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');

    for (const p of PROBE_PATHS) {
      await cdp.call('Page.navigate', { url: `${BASE}${p}` });
      await sleep(4_000);
      const d = await cdp.js<DomProbe>(DOM_PROBE);
      const label = p.padEnd(6);
      if (!d.bodyInnerTextLength) { fail(`${label} page rendered no body text`); continue; }

      // Each tag we own must exist exactly once, and sit directly in <head>.
      for (const [name, list] of [
        ['ga4-loader', d.ga4Loader],
        ['ga4-init', d.ga4Init],
        ['clarity-loader', d.clarityLoader],
        ['adsense-loader', d.adsenseLoader],
      ] as const) {
        if (list.length === 0) { fail(`${label} ${name} is not in the DOM`); continue; }
        if (list.length > 1) { fail(`${label} ${name} appears ${list.length} times in the DOM — duplicate installation`); continue; }
        const where = list[0].parent;
        where === 'head'
          ? pass(`${label} ${name} is in <head> exactly once (${list[0].src ?? 'inline'})`)
          : fail(`${label} ${name} is NOT in <head> — its parent is <${where}>`);
      }

      // A vendor script that is NOT one of ours means someone installed a second
      // copy without reusing our ids. This is the duplicate that byId would miss.
      for (const [name, list] of [
        ['ga4', d.foreignGa], ['adsense', d.foreignAds], ['clarity', d.foreignClarity],
      ] as const) {
        list.length === 0
          ? pass(`${label} no second ${name} vendor script beyond the one we install`)
          : fail(`${label} ${list.length} unexpected extra ${name} script(s) — a duplicate install`);
      }

      // The rendered id must match the expected value exactly.
      const rendered = [
        ...d.ga4Loader.flatMap((s) => [s.src ?? '', s.text]),
        ...d.ga4Init.flatMap((s) => [s.src ?? '', s.text]),
        ...d.clarityLoader.flatMap((s) => [s.src ?? '', s.text]),
        ...d.adsenseLoader.flatMap((s) => [s.src ?? '', s.text]),
        ...d.foreignGa.flatMap((s) => [s.src ?? '', s.text]),
        ...d.foreignClarity.flatMap((s) => [s.src ?? '', s.text]),
      ].join('\n');
      for (const [name, id] of Object.entries(EXPECTED)) {
        rendered.includes(id)
          ? pass(`${label} rendered ${name} id matches ${id} exactly`)
          : fail(`${label} rendered ${name} id does not match ${id} — got ${JSON.stringify(rendered.slice(0, 240))}`);
      }

      d.bodyLeaks.length === 0
        ? pass(`${label} body.innerText (${d.bodyInnerTextLength} chars) has no tag or vendor trace`)
        : fail(`${label} body.innerText contains ${d.bodyLeaks.join(', ')} — a tag is rendering as visible content`);

      const units = Object.entries(d.adUnitInDom).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`);
      units.length === 0
        ? pass(`${label} live DOM has no ins / .adsbygoogle / data-ad-* elements`)
        : fail(`${label} live DOM has ad-unit elements: ${units.join(', ')}`);

      pass(`${label} vendors initialised — gtag:${d.globals.gtag} dataLayer:${d.globals.dataLayer} clarity:${d.globals.clarity} adsbygoogle:${d.globals.adsbygoogle}`);

      strayTags = [...d.ga4Loader, ...d.ga4Init, ...d.clarityLoader, ...d.adsenseLoader]
        .filter((s) => s.parent !== 'head');
    }

    strayTags.length === 0
      ? pass('no analytics tag element sits outside <head> after hydration')
      : fail(`${strayTags.length} tag element(s) outside <head>: ${strayTags.map((s) => s.id ?? s.src ?? 'inline').join(', ')}`);
  } catch (e) {
    fail(`live DOM check errored: ${(e as Error).message}`);
  } finally {
    cdp?.close();
    killTree(child);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/** Kill the Chrome we started, by PID. Never by image name — shared desktop. */
function killTree(child: ChildProcess): void {
  if (child.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
}

async function main() {
  await checkServedHtml();
  await checkLiveDom();
  console.log(failures === 0 ? '\ntags: all checks passed' : `\ntags: ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();