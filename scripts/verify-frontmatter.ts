/**
 * FRONTMATTER PARSER GATE
 *
 * The parser is hand-rolled on purpose (no YAML dependency), which means its
 * limits are its own and have to be tested rather than assumed.
 *
 * WHY THIS FILE EXISTS
 * The parser read only two shapes: `key:` followed by `- scalar` lines, and
 * `key:` followed by `sub: value` lines. Assessment frontmatter nests three
 * deep —
 *
 *     questions:
 *       - id: "q1"
 *         options:
 *           - id: "a"
 *             label: "..."
 *         answer:
 *           - "a"
 *
 * — and given a `- id: "q1"` item the old reader took the whole line as a
 * scalar string. Every quiz's `questions` therefore became the single string
 * `id: "q1"`, the UI rendered no question controls at all, and the served page
 * said the questions were "not in this build" while the markdown body promised
 * "Five questions". Nothing failed loudly: the build was clean, all 85 routes
 * returned 200, and TypeScript was clean.
 *
 * That is the failure this gate exists to prevent. A parser that silently
 * degrades a nested block into a string is worse than one that throws.
 *
 * WHAT IT READS NOW
 * Two sources, and the split matters:
 *
 *   1. The pure parser assertions below run `parseFrontmatter()` on inline
 *      strings. They depend on no corpus at all, so they keep proving the
 *      parser's own behaviour after the MDX tree was deleted.
 *   2. The corpus assertions read `src/content/<locale>.json` — the snapshot
 *      the site actually serves, through the app's own `src/lib/data.ts`
 *      readers. The `content/<lang>/**.mdx` tree this file used to walk is
 *      gone from disk (see the HISTORY note in `scripts/lib/content.ts`):
 *      `loadPages()` now returns `[]`, which is why the corpus half of this
 *      gate reported 6 failures against 85 real pages that ship fine.
 *
 * Run: npm run verify:frontmatter
 */
import assert from 'node:assert/strict';

import { parseFrontmatter } from './lib/content';
import { allPages, pagesByType, type Page } from '../src/lib/data';
import { LOCALES } from '../src/lib/locales';

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (e) {
    failures++;
    console.error(`  FAIL  ${name}\n        ${(e as Error).message.replace(/\n/g, '\n        ')}`);
  }
}

const wrap = (fm: string) => `---\n${fm}\n---\n\nbody text\n`;

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

console.log('\n— scalars —');

check('plain scalar', () => {
  const { data } = parseFrontmatter(wrap('title: Hello World'));
  assert.equal(data.title, 'Hello World');
});

check('quoted string keeps its spaces and colon', () => {
  const { data } = parseFrontmatter(wrap('description: "A: colon, and spaces"'));
  assert.equal(data.description, 'A: colon, and spaces');
});

check('numbers and booleans', () => {
  const { data } = parseFrontmatter(wrap('points: 16\nratio: 1.5\nshuffle: true\nretry: false'));
  assert.equal(data.points, 16);
  assert.equal(data.ratio, 1.5);
  assert.equal(data.shuffle, true);
  assert.equal(data.retry, false);
});

check('inline array', () => {
  const { data } = parseFrontmatter(wrap('tags: ["a", "b", "c"]'));
  assert.deepEqual(data.tags, ['a', 'b', 'c']);
});

/* ------------------------------------------------------------------ *
 * One level
 * ------------------------------------------------------------------ */

console.log('\n— one level deep —');

check('sequence of scalars', () => {
  const { data } = parseFrontmatter(wrap('tags:\n  - alpha\n  - beta'));
  assert.deepEqual(data.tags, ['alpha', 'beta']);
});

check('mapping', () => {
  const { data } = parseFrontmatter(wrap('meta:\n  a: 1\n  b: two'));
  assert.deepEqual(data.meta, { a: 1, b: 'two' });
});

check('a key after a block is still read', () => {
  const { data } = parseFrontmatter(wrap('tags:\n  - x\ntitle: After'));
  assert.deepEqual(data.tags, ['x']);
  assert.equal(data.title, 'After');
});

/* ------------------------------------------------------------------ *
 * The regression: sequences of mappings
 * ------------------------------------------------------------------ */

console.log('\n— sequences of mappings (the bug) —');

check('`- id: x` yields an object, not the string "id: x"', () => {
  const { data } = parseFrontmatter(
    wrap('questions:\n  - id: "q1"\n    type: "single-choice"\n  - id: "q2"'),
  );
  assert.ok(Array.isArray(data.questions), 'questions must be an array');
  assert.equal(data.questions.length, 2);
  assert.equal(typeof data.questions[0], 'object', 'item must be an object, not a string');
  assert.equal((data.questions[0] as Record<string, unknown>).id, 'q1');
  assert.equal((data.questions[0] as Record<string, unknown>).type, 'single-choice');
  assert.equal((data.questions[1] as Record<string, unknown>).id, 'q2');
});

check('a nested sequence inside a sequence item', () => {
  const { data } = parseFrontmatter(
    wrap('questions:\n  - id: "q1"\n    options:\n      - "a"\n      - "b"'),
  );
  const q = (data.questions as Record<string, unknown>[])[0];
  assert.deepEqual(q.options, ['a', 'b']);
});

check('a nested mapping inside a sequence item', () => {
  const { data } = parseFrontmatter(
    wrap('questions:\n  - id: "q1"\n    answer:\n      - "a"\n    points: 10'),
  );
  const q = (data.questions as Record<string, unknown>[])[0];
  assert.deepEqual(q.answer, ['a']);
  assert.equal(q.points, 10);
});

check('THREE levels: mapping > sequence of mappings > sequence of mappings', () => {
  const { data } = parseFrontmatter(
    wrap(
      [
        'questions:',
        '  - id: "q1"',
        '    options:',
        '      - id: "a"',
        '        label: "Wrong answer"',
        '        reason_wrong: "Because reasons"',
        '      - id: "b"',
        '        label: "Right answer"',
        '    answer:',
        '      - "b"',
        '  - id: "q2"',
        '    options:',
        '      - id: "c"',
        '        label: "Only option"',
        '    answer:',
        '      - "c"',
      ].join('\n'),
    ),
  );

  const qs = data.questions as Record<string, unknown>[];
  assert.equal(qs.length, 2, 'two questions');

  const q1 = qs[0];
  assert.equal(q1.id, 'q1');
  const opts = q1.options as Record<string, unknown>[];
  assert.equal(opts.length, 2, 'q1 has two options');
  assert.equal(opts[0].id, 'a');
  assert.equal(opts[0].label, 'Wrong answer');
  assert.equal(opts[0].reason_wrong, 'Because reasons');
  assert.equal(opts[1].label, 'Right answer');
  assert.deepEqual(q1.answer, ['b']);

  const q2 = qs[1];
  assert.equal(q2.id, 'q2');
  assert.equal((q2.options as unknown[]).length, 1);
  assert.deepEqual(q2.answer, ['c']);
});

/* ------------------------------------------------------------------ *
 * The real corpus — the snapshot the site actually serves
 * ------------------------------------------------------------------ */

console.log('\n— the shipped content snapshot —');

const QUIZ = 'quizzes/ai-fundamentals/evaluating-ai-output-methods';

/**
 * Floor, not a target. The MDX tree was deleted and an earlier ingest wrote a
 * bare `[]` over 85 pages per locale while the build still reported success —
 * so "empty" has to be a loud failure here, in both locales, or the next
 * absence ships silently.
 */
const MIN_PAGES = 50;
/** The corpus promises five questions; anything fewer is a stripped corpus. */
const MIN_QUESTIONS = 5;

/** Every quiz and exam page in a locale, as the app resolves them. */
const assessments = (locale: 'en' | 'ar'): Page[] => [
  ...pagesByType(locale, 'quiz'),
  ...pagesByType(locale, 'exam'),
];

/**
 * The check that IS the original bug: `questions` must be a non-empty array of
 * objects with ids. A single raw YAML string here (`'id: "q1"'`) is the exact
 * degradation this gate was written for — a string is not a question, so the
 * player renders nothing while the page still claims to have questions.
 */
const assertRealQuestions = (page: Page): void => {
  const qs = page.frontmatter.questions;
  assert.ok(
    Array.isArray(qs),
    `${page.refPath}: questions is ${qs === undefined ? 'absent' : typeof qs}, not an array`,
  );
  assert.ok(
    (qs as unknown[]).length > 0,
    `${page.refPath}: questions is an empty array`,
  );
  for (const item of qs as unknown[]) {
    assert.equal(
      typeof item,
      'object',
      `${page.refPath}: a question is a ${typeof item} — ${JSON.stringify(String(item).slice(0, 60))}`,
    );
    const rec = item as Record<string, unknown>;
    assert.equal(
      typeof rec.id,
      'string',
      `${page.refPath}: a question has ${rec.id === undefined ? 'no id' : `a non-string id ${JSON.stringify(rec.id)}`}`,
    );
    assert.ok(
      (rec.id as string).trim().length > 0,
      `${page.refPath}: a question has an empty id`,
    );
  }
};

let enPages: Page[] = [];
check('the content snapshot is readable and non-empty in both locales', () => {
  for (const loc of LOCALES) {
    const pages = allPages(loc);
    assert.ok(
      pages.length >= MIN_PAGES,
      `${loc}: only ${pages.length} page(s) — expected ${MIN_PAGES}+; an empty snapshot ships a blank site with a clean build`,
    );
    if (loc === 'en') enPages = pages;
  }
});

const quiz = enPages.find((p) => p.refPath === QUIZ);
check(`the quiz at ${QUIZ} exists`, () => {
  assert.ok(quiz, 'quiz not found in the shipped snapshot');
});

check('every quiz parses its questions into objects', () => {
  for (const loc of LOCALES) {
    const quizzes = pagesByType(loc, 'quiz');
    assert.ok(quizzes.length >= 3, `expected 3+ ${loc} quizzes, got ${quizzes.length}`);
    for (const q of quizzes) assertRealQuestions(q);
  }
});

check('the exam parses its questions too', () => {
  for (const loc of LOCALES) {
    const exams = pagesByType(loc, 'exam');
    assert.ok(exams.length >= 1, `expected at least one ${loc} exam`);
    for (const e of exams) assertRealQuestions(e);
  }
});

check('the snapshot really does hold the questions', () => {
  // Guards against a gate that passes because the corpus was already stripped.
  // It used to count `- id: ` lines in the MDX on disk; with the tree gone the
  // equivalent claim about shipped data is the parsed array itself.
  assert.ok(quiz, 'no quiz page to inspect');
  const qs = quiz.frontmatter.questions;
  assert.ok(Array.isArray(qs), `${QUIZ}: questions is not an array`);
  const items = qs as Record<string, unknown>[];
  assert.ok(
    items.length >= MIN_QUESTIONS,
    `${QUIZ} has ${items.length} question(s), expected ${MIN_QUESTIONS}+`,
  );
  for (const item of items) {
    assert.equal(
      typeof item.id,
      'string',
      `${QUIZ}: question ${JSON.stringify(item.id)} has no string id`,
    );
    assert.ok(
      (item.id as string).trim().length > 0,
      `${QUIZ}: a question has an empty id`,
    );
  }
});

check('nothing anywhere degraded into a raw YAML string', () => {
  // The specific shape of the old bug: a value that still looks like YAML.
  const suspicious: string[] = [];
  const scan = (v: unknown, where: string) => {
    if (typeof v === 'string' && /^[a-z_]+:\s/.test(v) && v.includes(':')) {
      suspicious.push(`${where} = ${JSON.stringify(v.slice(0, 60))}`);
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => scan(x, `${where}[${i}]`));
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) scan(x, `${where}.${k}`);
    }
  };
  for (const loc of LOCALES) {
    for (const p of allPages(loc)) scan(p.frontmatter, `${loc}:${p.refPath}`);
  }
  assert.equal(
    suspicious.length,
    0,
    `${suspicious.length} field(s) still hold raw YAML:\n        ${suspicious.slice(0, 5).join('\n        ')}`,
  );
});

check('both locales parse', () => {
  const counts: string[] = [];
  for (const loc of LOCALES) {
    const pages = allPages(loc);
    assert.ok(pages.length >= MIN_PAGES, `${loc}: only ${pages.length} pages`);
    for (const p of pages) {
      assert.equal(typeof p.refPath, 'string', `${loc}: a page has no refPath`);
      assert.ok(
        p.frontmatter && typeof p.frontmatter === 'object',
        `${loc}:${p.refPath}: frontmatter is not an object`,
      );
      assert.equal(typeof p.body, 'string', `${loc}:${p.refPath}: body is not a string`);
    }
    counts.push(`${loc}=${pages.length}`);
    // Every assessment page in BOTH locales must still yield real questions, so
    // a locale that lost its nested blocks cannot pass on the other's data.
    for (const p of assessments(loc)) assertRealQuestions(p);
  }
  console.log(`        pages: ${counts.join(' ')}`);
});

console.log(
  failures === 0
    ? '\nfrontmatter: all checks passed'
    : `\nfrontmatter: ${failures} failure(s)`,
);
process.exit(failures === 0 ? 0 : 1);