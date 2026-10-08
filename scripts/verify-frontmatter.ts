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
 * Run: npm run verify:frontmatter
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseFrontmatter, loadPages, CONTENT_ROOT } from './lib/content';
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
 * The real corpus
 * ------------------------------------------------------------------ */

console.log('\n— the real content tree —');

const QUIZ = 'quizzes/ai-fundamentals/evaluating-ai-output-methods';

let enPages: ReturnType<typeof loadPages> = [];
check('the content tree is readable', () => {
  enPages = loadPages('en');
  assert.ok(enPages.length > 50, `expected 50+ pages, got ${enPages.length}`);
});

const quiz = enPages.find((p) => p.refPath === QUIZ);
check(`the quiz at ${QUIZ} exists`, () => {
  assert.ok(quiz, 'quiz not found in the content tree');
});

check('every quiz parses its questions into objects', () => {
  const quizzes = enPages.filter((p) => p.type === 'quiz');
  assert.ok(quizzes.length >= 3, `expected 3+ quizzes, got ${quizzes.length}`);
  for (const q of quizzes) {
    const qs = q.frontmatter.questions;
    assert.ok(Array.isArray(qs), `${q.refPath}: questions is not an array`);
    assert.ok(
      (qs as unknown[]).length >= 3,
      `${q.refPath}: only ${(qs as unknown[]).length} question(s) — expected 5`,
    );
    for (const item of qs as unknown[]) {
      assert.equal(
        typeof item,
        'object',
        `${q.refPath}: a question is a ${typeof item}, not an object`,
      );
      const rec = item as Record<string, unknown>;
      assert.ok(rec.id, `${q.refPath}: a question has no id`);
      assert.ok(rec.prompt, `${q.refPath}: question ${rec.id} has no prompt`);

      // The answer is a MAPPING, not a list: `answer: { kind, correct }`.
      const ans = rec.answer;
      assert.ok(ans && typeof ans === 'object' && !Array.isArray(ans),
        `${q.refPath}: question ${rec.id} has no answer object`);
      const ansRec = ans as Record<string, unknown>;

      // The corpus has six question types, and they do NOT all carry a sibling
      // list of choices. Measured from the content tree, not assumed:
      //
      //   single-choice, multiple-answer, true-false, scenario -> `options`
      //   matching                                      -> `pairs`
      //   ordering                                       -> NOTHING: its items
      //                                                      live only in
      //                                                      answer.correct
      //
      // Asserting a list for every type fails on a valid ordering question, and
      // asserting nothing would let a genuinely broken option list through. So
      // the expectation is per type.
      const type = typeof rec.type === 'string' ? rec.type : '';
      const listKey = type === 'matching' ? 'pairs' : 'options';
      const list = rec[listKey];
      const ids = new Set<string>();

      if (type === 'ordering') {
        // No choices list; answer.correct IS the ordered item list, checked
        // below by the list branch.
        assert.ok(!list,
          `${q.refPath}: ordering question ${rec.id} unexpectedly carries ${listKey}`);
      } else {
        assert.ok(
          Array.isArray(list) && (list as unknown[]).length >= 2,
          `${q.refPath}: question ${rec.id} (type ${type || '?'}) has no usable ${listKey}`,
        );
        for (const o of list as Record<string, unknown>[]) {
          assert.ok(o && typeof o === 'object',
            `${q.refPath}: a ${listKey} entry of ${rec.id} is not a mapping`);
          assert.ok(o.id, `${q.refPath}: a ${listKey} entry of ${rec.id} has no id`);
          ids.add(String(o.id));
        }
      }
      // `answer.correct` has TWO shapes, and the parser must survive both:
      //   choice   -> a LIST of option ids
      //   matching -> a MAP of term id -> definition id
      // Asserting only the list shape fails on a valid matching question, which
      // is exactly what happened while this gate was being written.
      const correct = ansRec.correct;
      assert.ok(correct && typeof correct === 'object',
        `${q.refPath}: question ${rec.id} has an empty answer.correct`);

      if (Array.isArray(correct)) {
        assert.ok(correct.length > 0,
          `${q.refPath}: question ${rec.id} has an empty answer.correct list`);
        for (const c of correct as string[]) {
          // An ordering question has no sibling list, so its correct ids cannot
          // be cross-checked against one; they are the items themselves.
          if (ids.size > 0) {
            assert.ok(
              ids.has(c),
              `${q.refPath}: question ${rec.id} marks "${c}" correct but it is not in ${listKey}`,
            );
          }
        }
      } else {
        const pairs = correct as Record<string, unknown>;
        const entries = Object.entries(pairs);
        assert.ok(entries.length > 0,
          `${q.refPath}: question ${rec.id} has an empty answer.correct map`);
        for (const [termId, defId] of entries) {
          assert.ok(ids.has(termId),
            `${q.refPath}: question ${rec.id} keys correct on unknown term "${termId}"`);
          assert.ok(ids.has(String(defId)),
            `${q.refPath}: question ${rec.id} maps "${termId}" to unknown "${String(defId)}"`);
        }
      }
      assert.ok(rec.explanation,
        `${q.refPath}: question ${rec.id} has no explanation`);
    }
  }
});

check('the exam parses its questions too', () => {
  const exams = enPages.filter((p) => p.type === 'exam');
  assert.ok(exams.length >= 1, 'expected at least one exam');
  for (const e of exams) {
    const qs = e.frontmatter.questions;
    assert.ok(Array.isArray(qs), `${e.refPath}: questions is not an array`);
    assert.ok(
      (qs as unknown[]).length >= 3,
      `${e.refPath}: only ${(qs as unknown[]).length} question(s)`,
    );
  }
});

check('the source MDX on disk really does hold the questions', () => {
  // Guards against a test that passes because the corpus was already stripped.
  const src = readFileSync(join(CONTENT_ROOT, 'en', `${QUIZ}.mdx`), 'utf8');
  const count = (src.match(/^\s{2}- id: /gm) ?? []).length;
  assert.ok(count >= 5, `source MDX has ${count} question ids, expected 5+`);
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
  for (const p of enPages) scan(p.frontmatter, p.refPath);
  assert.equal(
    suspicious.length,
    0,
    `${suspicious.length} field(s) still hold raw YAML:\n        ${suspicious.slice(0, 5).join('\n        ')}`,
  );
});

check('both locales parse', () => {
  for (const loc of LOCALES) {
    const pages = loadPages(loc);
    assert.ok(pages.length > 50, `${loc}: only ${pages.length} pages`);
  }
});

console.log(
  failures === 0
    ? '\nfrontmatter: all checks passed'
    : `\nfrontmatter: ${failures} failure(s)`,
);
process.exit(failures === 0 ? 0 : 1);
