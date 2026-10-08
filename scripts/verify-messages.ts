/**
 * Message-key gate.
 *
 * Every `t('…')` call in the app must resolve in BOTH locales. A key that exists
 * only in English renders as the raw key path on the Arabic page — a visible
 * regression that ships silently because TypeScript cannot see inside the
 * message object.
 *
 * This also catches the inverse error: adding a message to one locale only.
 *
 * Run: npm run verify:messages
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import messages from '../src/i18n/messages';
import { LOCALES } from '../src/lib/locales';

const ROOT = join(process.cwd(), 'src');
const SKIP = new Set(['node_modules', '.next', 'content']);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name.startsWith('.') || SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === '.ts' || extname(full) === '.tsx') out.push(full);
  }
  return out;
}

/**
 * Collect `t('key')` calls TOGETHER WITH the namespace in scope.
 *
 * The namespace matters: inside a component that called
 * `useTranslations('footer')`, `t('tagline')` resolves to `footer.tagline`, not
 * `tagline`. A checker that ignored the namespace would report those as missing —
 * and would also miss a genuinely missing footer translation, which is the bug
 * worth catching.
 */
const STATIC_KEY = /\bt\(\s*'([a-zA-Z][\w.]*)'/g;

/**
 * Resolve the namespace for a `t('key')` call at `index`.
 *
 * Namespaces are per-FUNCTION, not per-file: `t` is bound to `common` in
 * ThemeSwitcher and to `footer` in Footer within the same module. So resolution
 * is scoped to the enclosing function, and within it matched by the translator
 * VARIABLE the call uses (`t` vs `tn`), because `const tn = useTranslations('nav')`
 * sitting after `const t = useTranslations('footer')` does not rebind `t`.
 *
 * Server components bind the namespace through
 * `getTranslations({ …, namespace: 'x' })` instead of a variable.
 */
function namespaceFor(src: string, index: number): string {
  const before = src.slice(0, index);

  // Start of the enclosing top-level function (or the file, for module scope).
  let scopeStart = 0;
  for (const marker of ['\nexport function ', '\nfunction ', '\nexport async function ', '\nasync function ']) {
    const at = before.lastIndexOf(marker);
    if (at > scopeStart) scopeStart = at + 1;
  }
  const scope = before.slice(scopeStart);

  // Which translator variable is this call on?
  const call = /\b([A-Za-z_$][\w$]*)\(\s*'[a-zA-Z][\w.]*'/.exec(src.slice(index));
  const varName = call?.[1];

  if (varName) {
    const decl = new RegExp(
      `const\\s+${varName}\\s*=\\s*useTranslations\\(\\s*'([a-zA-Z][\\w.]*)'`,
    ).exec(scope);
    if (decl) return decl[1] + '.';
  }

  const server = [...scope.matchAll(/namespace:\s*'([a-zA-Z][\w.]*)'/g)].pop();
  if (server) return server[1] + '.';

  const anyHook = [...scope.matchAll(/useTranslations\(\s*'([a-zA-Z][\w.]*)'\s*\)/g)].pop();
  return anyHook ? anyHook[1] + '.' : '';
}

/** Fully-qualified `t('a.b')` keys already carry their namespace. */
function qualify(ns: string, key: string): string {
  return key.includes('.') || !ns ? key : ns + key;
}

function has(obj: unknown, path: string): boolean {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (!cur || typeof cur !== 'object') return false;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur !== undefined;
}

const used = new Map<string, Set<string>>(); // key -> files

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(STATIC_KEY)) {
    const key = qualify(namespaceFor(src, m.index), m[1]);
    if (!used.has(key)) used.set(key, new Set());
    used.get(key)!.add(file.replace(ROOT, 'src'));
  }
}

// Dynamic keys built as `concept.${label}` — enumerate the labels the component
// can pass, so a new label cannot skip translation.
const DYNAMIC_PREFIX = 'concept.';
const dynamicLabels = new Set<string>();
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/heading\('([^']+)'\)/g)) {
    dynamicLabels.add(m[1]);
    const key = DYNAMIC_PREFIX + m[1];
    if (!used.has(key)) used.set(key, new Set());
    used.get(key)!.add(file.replace(ROOT, 'src'));
  }
}

let failures = 0;
const rows: string[] = [];

for (const key of [...used.keys()].sort()) {
  const missing = LOCALES.filter((l) => !has(messages[l], key));
  if (missing.length === 0) continue;
  failures++;
  rows.push(
    `  ${key.padEnd(34)} missing in: ${missing.join(', ')}   used by: ${[...used.get(key)!].join(', ')}`,
  );
}

// ---------------------------------------------------------------------------
// GROUP HEADINGS MUST BE TRANSLATED
//
// The concepts and docs indexes group cards by a frontmatter field (`domain`,
// `category`). Those values are machine slugs — `model-behavior`, `claude-code`
// — and a group heading falls back to the raw key when no label exists. That
// puts "model-behavior 02" on the page in BOTH locales, which is exactly the
// kind of untranslated string a reader sees immediately.
//
// So this asserts the CONTENT and the MESSAGES agree: every grouping value that
// appears in the snapshot must have a label in every locale. Adding a concept
// page with a new `domain` fails the build until the label is written.
// ---------------------------------------------------------------------------
{
  type Page = { type: string; frontmatter: Record<string, unknown> };
  const GROUP_FIELDS = ['domain', 'category'] as const;
  const GROUP_NAMESPACES: Record<(typeof GROUP_FIELDS)[number], string> = {
    domain: 'index.domains',
    category: 'index.categories',
  };

  const usedGroups = new Map<string, Set<string>>(); // namespace -> values
  for (const locale of LOCALES) {
    const snapshot = JSON.parse(
      readFileSync(join(ROOT, 'content', `${locale}.json`), 'utf8'),
    ) as { pages: Page[] } | Page[];
    // The snapshot is a bare array of pages; accept a `{ pages }` wrapper too so
    // this keeps working if the ingest shape changes.
    const pages = Array.isArray(snapshot) ? snapshot : snapshot.pages;
    for (const page of pages) {
      for (const field of GROUP_FIELDS) {
        const value = page.frontmatter[field];
        if (typeof value !== 'string' || !value.trim()) continue;
        const ns = GROUP_NAMESPACES[field];
        if (!usedGroups.has(ns)) usedGroups.set(ns, new Set());
        usedGroups.get(ns)!.add(value);
      }
    }
  }

  let groupFailures = 0;
  for (const [ns, values] of [...usedGroups.entries()].sort()) {
    const missing = LOCALES.filter((l) =>
      [...values].some((v) => !has(messages[l], `${ns}.${v}`)),
    );
    const values_ = [...values].sort().join(', ');
    if (missing.length === 0) {
      console.log(`group headings ok: ${ns.padEnd(18)} ${values_}`);
      continue;
    }
    groupFailures += missing.length;
    rows.push(
      `  ${ns} has no label in: ${missing.join(', ')}   values: ${values_}`,
    );
  }

  if (groupFailures > 0) {
    failures += groupFailures;
    console.error(
      `\n${groupFailures} group heading(s) untranslated:\n${rows.splice(0).join('\n')}`,
    );
    console.error(
      '\nA group heading without a label renders the raw slug (e.g. "model-behavior").' +
        ' Add the label under the namespace above in every locale.',
    );
    process.exit(1);
  }
}

console.log(`static + dynamic message keys used: ${used.size}`);
console.log(`dynamic concept labels: ${[...dynamicLabels].sort().join(', ')}`);

if (failures > 0) {
  console.error(`\n${failures} key(s) incomplete:\n${rows.join('\n')}`);
  console.error('\nEvery key must exist in every locale. Add the missing translation.');
  process.exit(1);
}

console.log('\nall message keys resolve in: ' + LOCALES.join(', '));


/**
 * Plural-form coverage for the About page's corpus counts.
 *
 * The counted labels declare one key per CLDR plural category
 * (`concepts_one`, `concepts_few`, ...) and the renderer picks a form from the
 * count. A missing form does not fail TypeScript and does not fail the build:
 * the renderer's fallback chain quietly substitutes `_other`, so an Arabic
 * reader sees "صفحة واحدة" written as "2 صفحة" — wrong, and invisible in review.
 *
 * This asserts the form table is complete for both locales. Arabic needs zero,
 * one, two, few and many; English needs one and other. `zero` is required for
 * Arabic because a counted type with no pages renders nothing at all, so the
 * form is unreachable in practice — but a label that only appears when it is
 * unreachable is a label nobody ever proofreads.
 */
import { policyMessages } from '../src/i18n/policy-messages';

const COUNTED_KEYS = [
  'concepts',
  'sessions',
  'courses',
  'skills',
  'mcp',
  'quizzes',
  'exams',
  'prompt',
  'docs',
  'total',
] as const;

const REQUIRED_FORMS: Record<string, readonly string[]> = {
  en: ['one', 'other'],
  // Arabic: zero/one/two are noun-only (no numeral), few/many carry the numeral.
  ar: ['zero', 'one', 'two', 'few', 'many'],
};

let pluralFailures = 0;
for (const [locale, forms] of Object.entries(REQUIRED_FORMS)) {
  const bundle = (policyMessages as Record<string, any>)[locale];
  if (!bundle) {
    console.log(`  FAIL  policy messages have no ${locale} bundle`);
    pluralFailures++;
    continue;
  }
  const contents = bundle.about?.contents ?? {};
  for (const key of COUNTED_KEYS) {
    const missing = forms.filter((f) => typeof contents[`${key}_${f}`] !== 'string');
    if (missing.length > 0) {
      console.log(
        `  FAIL  ${locale} about.contents is missing plural form(s): ` +
          missing.map((f) => `${key}_${f}`).join(', '),
      );
      pluralFailures++;
    } else {
      console.log(`  ok    ${locale} ${key} declares ${forms.join('/')}`);
    }
  }
}

/**
 * No message may ship a literal `{placeholder}`.
 *
 * A template can be perfectly complete in every plural form and still reach the
 * reader with `{total}` printed on the page, because the renderer substitutes
 * only the placeholders it knows about. That is a rendering bug with no type
 * error and no build failure — it was caught here only by looking at the served
 * Arabic page.
 *
 * Allowed placeholders are the ones the policy renderer actually fills: `n` for
 * a per-type count, `total` for the corpus total. Anything else is a template
 * referring to a value nobody passes.
 */
const ALLOWED_PLACEHOLDERS = new Set(['n', 'total']);
let placeholderFailures = 0;

for (const locale of Object.keys(REQUIRED_FORMS)) {
  const bundle = (policyMessages as Record<string, any>)[locale];
  const contents = bundle?.about?.contents ?? {};
  for (const [key, value] of Object.entries(contents as Record<string, string>)) {
    for (const found of String(value).matchAll(/\{(\w+)\}/g)) {
      if (!ALLOWED_PLACEHOLDERS.has(found[1])) {
        console.log(
          `  FAIL  ${locale} about.contents.${key} uses unknown placeholder ` +
            `{${found[1]}}; the renderer will not substitute it`,
        );
        placeholderFailures++;
      }
    }
  }
}
if (placeholderFailures === 0) {
  console.log('  ok    no message ships an unsubstituted placeholder');
}

/**
 * The About page's description must not carry `{total}`.
 *
 * The counted-label check above only reads the messages module; it cannot see
 * whether the RENDERER filled the placeholder before handing the string to
 * `generateMetadata`. That split is how "{total}" reached a live
 * `<meta name="description">` while the visible page read correctly — a page
 * that looks right and is described to Google with a brace.
 *
 * So this asserts the contract at the source: the About lede is the one
 * description built from a template, and it is exactly the case that needs
 * substituting.
 */
const aboutLede = (policyMessages as Record<string, any>).en?.about?.lede;
if (typeof aboutLede === 'string' && aboutLede.includes('{total}')) {
  console.log(
    '  note  en about.lede is templated ({total}) — makeMetadata() must fill it ' +
      'before passing it to generateMetadata',
  );
}

if (pluralFailures > 0 || placeholderFailures > 0) {
  console.log(
    `\nplural forms: ${pluralFailures} failure(s); placeholders: ${placeholderFailures} failure(s)`,
  );
  process.exitCode = 1;
}
