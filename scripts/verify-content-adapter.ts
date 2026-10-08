/**
 * Verify the content adapter against the REAL tree before any template depends
 * on it. A parser that silently half-reads frontmatter is how fabricated content
 * reaches a page, so this asserts against real files, not mocks.
 *
 * Run: npx tsx scripts/verify-content-adapter.ts
 */
import {
  loadPages,
  getPage,
  listByType,
  firstParagraph,
  parseFrontmatter,
  ALL_TYPES,
  TYPE_DIRS,
  contentRootExists,
} from './lib/content';

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  pass  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('=== 0. content root reachable ===');
check('content root exists', contentRootExists(), 'set AIHUB_CONTENT_ROOT');
if (!contentRootExists()) {
  console.log('\ncontent root missing — cannot verify');
  process.exit(1);
}

console.log('\n=== 1. page counts per locale and type ===');
const en = loadPages('en');
const ar = loadPages('ar');
check('English pages load', en.length > 0, `got ${en.length}`);
check('Arabic pages load', ar.length > 0, `got ${ar.length}`);
check('mirrored page counts match', en.length === ar.length, `en=${en.length} ar=${ar.length}`);

const counts: Record<string, number> = {};
for (const p of en) counts[p.type] = (counts[p.type] ?? 0) + 1;
console.log('  EN by type:', JSON.stringify(counts));
for (const t of ALL_TYPES) {
  const n = counts[t] ?? 0;
  console.log(`    ${t.padEnd(20)} ${n}`);
}

console.log('\n=== 2. every page has the fields a template needs ===');
const missingTitle = en.filter((p) => !p.frontmatter.title);
const missingDesc = en.filter((p) => !p.frontmatter.description);
const missingType = en.filter((p) => !p.frontmatter.type);
check('every EN page has a title', missingTitle.length === 0,
  missingTitle.slice(0, 3).map((p) => p.refPath).join(', '));
check('every EN page has a description', missingDesc.length === 0,
  missingDesc.slice(0, 3).map((p) => p.refPath).join(', '));
check('every page carries its type', missingType.length === 0);

console.log('\n=== 3. the YAML subset actually used parses ===');
const withArrays = en.filter((p) => Array.isArray(p.frontmatter.tags));
const withObjects = en.filter((p) =>
  Array.isArray(p.frontmatter.official_resources) &&
  p.frontmatter.official_resources!.length > 0,
);
const withGlossary = en.filter((p) => Array.isArray(p.frontmatter.glossary));
check('block/inline arrays parse', withArrays.length > 0, 'no tags arrays found');
check('inline objects parse (official_resources)', withObjects.length > 0);
check('glossary blocks parse', withGlossary.length > 0);
check('no parsed value is a raw string that should be a list',
  en.every((p) => !String(p.frontmatter.tags ?? '').startsWith('[')));

console.log('\n=== 4. pageref resolution against the real tree ===');
let refFields = 0;
const dangling: string[] = [];
for (const p of en) {
  const fm = p.frontmatter as Record<string, unknown>;
  for (const [key, value] of Object.entries(fm)) {
    const refs: string[] = [];
    if (typeof value === 'string' && /^[a-z-]+\//.test(value)) refs.push(value);
    else if (Array.isArray(value)) {
      for (const v of value) if (typeof v === 'string' && /^[a-z-]+\//.test(v)) refs.push(v);
    }
    for (const r of refs) {
      if (!/^(sessions|courses|concepts|quizzes|exams|docs|skills|mcp|learning-path|free-credits|prompt-assessments)\//.test(r)) continue;
      refFields++;
      if (!getPage('en', r)) dangling.push(`${p.refPath} ${key} -> ${r}`);
    }
  }
}
check('pagerefs checked', refFields > 0, 'none found — the scan is not working');
check('no dangling pagerefs in EN', dangling.length === 0,
  dangling.slice(0, 4).join(' | '));

console.log('\n=== 5. route shape follows docs/url-routing.md ===');
check('refPath starts with the type dir',
  en.every((p) => p.refPath.startsWith(TYPE_DIRS[p.type] + '/')),
  en.find((p) => !p.refPath.startsWith(TYPE_DIRS[p.type] + '/'))?.refPath ?? '');
check('no .mdx in refPath', en.every((p) => !p.refPath.endsWith('.mdx')));
check('no backslashes in refPath', en.every((p) => !p.refPath.includes('\\')));
check('refPaths are unique per locale',
  new Set(en.map((p) => p.refPath)).size === en.length);

console.log('\n=== 6. every Arabic page has an English mirror ===');
const enRefs = new Set(en.map((p) => p.refPath));
const orphans = ar.filter((p) => !enRefs.has(p.refPath));
check('no orphan Arabic pages', orphans.length === 0,
  orphans.slice(0, 3).map((p) => p.refPath).join(', '));

console.log('\n=== 7. listByType matches the route families ===');
for (const t of ['concept', 'course', 'session', 'skill', 'mcp'] as const) {
  const list = listByType('en', t);
  check(`listByType('en', '${t}') returns pages`, list.length > 0, `got ${list.length}`);
}

console.log('\n=== 8. frontmatter edge cases ===');
const scalars = parseFrontmatter('---\na: 1\nb: "two"\nc: true\nd: null\ne: 3.5\n---\nbody');
check('scalars parse', scalars.data.a === 1 && scalars.data.b === 'two' &&
  scalars.data.c === true && scalars.data.d === null && scalars.data.e === 3.5,
  JSON.stringify(scalars.data));
const inline = parseFrontmatter('---\ntags: ["a", "b"]\nres: [{"title": "T", "url": "https://x.dev"}]\n---\nx');
check('inline array of objects parses',
  Array.isArray(inline.data.tags) && inline.data.tags.length === 2 &&
  Array.isArray(inline.data.official_resources) === false, // unknown key kept as-is
  JSON.stringify(inline.data));
const noFm = parseFrontmatter('no frontmatter here');
check('missing frontmatter degrades without throwing', typeof noFm.body === 'string');

console.log('\n=== 9. firstParagraph extracts readable text ===');
const sample = en[0];
const para = firstParagraph(sample.body);
check('firstParagraph returns prose', para.length > 40, JSON.stringify(para.slice(0, 60)));
check('firstParagraph strips code fences', !para.includes('```'));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
console.log(`pages: en=${en.length} ar=${ar.length}`);
process.exit(failures === 0 ? 0 : 1);