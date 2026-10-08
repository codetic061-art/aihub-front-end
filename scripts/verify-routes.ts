/**
 * Route-conflict gate for the browse indexes.
 *
 * The indexes are STATIC segments (`app/[locale]/concepts/page.tsx`) sitting next
 * to a CATCH-ALL (`app/[locale]/[...path]/page.tsx`). Next prefers the static
 * segment, so the indexes work — but that is only safe while no content page's
 * refPath is a single segment, because a page at refPath `concepts` would then be
 * unreachable: the index would shadow it.
 *
 * This asserts that invariant against the REAL snapshot, so a content change
 * that adds a single-segment refPath fails a gate instead of silently shipping a
 * 404. Run: npx tsx scripts/verify-routes.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { LOCALES, TYPE_DIRS } from '../src/lib/locales';
import { allPages } from '../src/lib/data';

import en from '../src/content/en.json';
import ar from '../src/content/ar.json';

type Page = { refPath: string; type: string; title: string };

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

/** The static segment each index route owns, and the content type it lists. */
const INDEX_SEGMENTS = ['concepts', 'skills', 'mcp', 'docs'] as const;

const APP = join(process.cwd(), 'src', 'app');

/** Every `page.tsx` route file under `app/[locale]/…`, relative to `[locale]`. */
function routeFiles(
  dir: string = join(APP, '[locale]'),
  isRoot = true,
): { rel: string; file: string }[] {
  const out: { rel: string; file: string }[] = [];

  // The homepage is `[locale]/page.tsx` — a FILE in the locale root, not a
  // subdirectory, so the directory walk below never sees it. Without this the
  // chrome check silently skipped the one page most likely to be missing it.
  //
  // `isRoot` matters: this function recurses, and `join(dir,'page.tsx')` on a
  // NESTED dir is that route's own page (already added by the caller), not the
  // homepage. Testing `isRoot` rather than `existsSync` avoids reporting the
  // homepage once per directory.
  if (isRoot && existsSync(join(dir, 'page.tsx'))) {
    out.push({ rel: '', file: join(dir, 'page.tsx') });
  }

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    const rel = name === '[locale]' ? '' : name;
    if (fsExists(join(full, 'page.tsx'))) {
      out.push({ rel, file: join(full, 'page.tsx') });
    }
    out.push(...routeFiles(full, false));
  }
  return out;
}

function fsExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

console.log('=== 1. index route files exist ===');
const routes = routeFiles();
const rels = new Set(routes.map((r) => r.rel));
for (const segment of INDEX_SEGMENTS) {
  check(
    `app/[locale]/${segment}/page.tsx exists`,
    rels.has(segment),
    `found: ${[...rels].join(', ')}`,
  );
}
check('catch-all [...path] still present', rels.has('[...path]'), [...rels].join(', '));

console.log('\n=== 2. no content page shadows an index segment ===');
for (const [label, data] of [
  ['en', en as unknown as Page[]],
  ['ar', ar as unknown as Page[]],
] as const) {
  for (const segment of INDEX_SEGMENTS) {
    const clash = data.filter((p) => p.refPath === segment);
    check(
      `${label}: no refPath === "${segment}"`,
      clash.length === 0,
      clash.map((p) => p.title).join(', '),
    );
  }
}

console.log('\n=== 3. every refPath has >= 2 segments (nothing else can shadow) ===');
for (const locale of LOCALES) {
  const single = allPages(locale).filter((p) => !p.refPath.includes('/'));
  check(
    `${locale}: all ${allPages(locale).length} pages have a slug`,
    single.length === 0,
    single.map((p) => p.refPath).join(', '),
  );
}

console.log('\n=== 4. index segments match their content type ===');
for (const [label, data] of [
  ['en', en as unknown as Page[]],
  ['ar', ar as unknown as Page[]],
] as const) {
  for (const [segment, type] of Object.entries(TYPE_DIRS)) {
    if (!INDEX_SEGMENTS.includes(segment as (typeof INDEX_SEGMENTS)[number])) continue;
    const wrong = data.filter((p) => p.refPath.startsWith(`${segment}/`) && p.type !== type);
    check(
      `${label}: ${segment}/ pages are all type "${type}"`,
      wrong.length === 0,
      wrong.map((p) => `${p.refPath} is ${p.type}`).join(', '),
    );
  }
}

console.log('\n=== 5. the two locales carry the same pages at the same paths ===');
const enPaths = new Set((en as unknown as Page[]).map((p) => p.refPath));
const arPaths = new Set((ar as unknown as Page[]).map((p) => p.refPath));
const onlyEn = [...enPaths].filter((p) => !arPaths.has(p));
const onlyAr = [...arPaths].filter((p) => !enPaths.has(p));
check('no EN-only pages', onlyEn.length === 0, onlyEn.join(', '));
check('no AR-only pages', onlyAr.length === 0, onlyAr.join(', '));


// ---------------------------------------------------------------------------
// EVERY PAGE MOUNTS THE SHARED CHROME
//
// `SearchDialog` listens for the `search:open` event that `SearchTrigger`
// dispatches. A page that renders the trigger but forgets the dialog has a
// search button that silently does nothing — no error, no console message, and
// HTTP 200 on every route. That is exactly how the landing page shipped without
// a working search: the trigger lives in `Header`, and the dialog was mounted
// only on the content pages.
//
// So assert the pairing directly rather than discovering it by clicking.
// ---------------------------------------------------------------------------
{
  const CHROME = /<Header\b/;
  const DIALOG = /<SearchDialog\b/;
  console.log('\n=== 6. every page with site chrome also mounts the search dialog ===');
  for (const { rel, file } of routeFiles()) {
    if (!file.endsWith('page.tsx')) continue;
    const src = readFileSync(file, 'utf8');
    check(
      `app/[locale]/${rel || '(home)'} mounts SearchDialog`,
      !CHROME.test(src) || DIALOG.test(src),
      'renders <Header> but no <SearchDialog>, so its search trigger does nothing',
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} route check(s) failed`);
  process.exit(1);
}
console.log('\nroute tree is consistent: indexes own the four single segments, catch-all owns the rest');
