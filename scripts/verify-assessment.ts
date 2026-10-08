/**
 * Behavioural checks for the assessment layer.
 *
 * These are the assertions the design rules actually turn on:
 *   1. No key → no score. `gradeAttempt` returns null, so the UI cannot render a
 *      number it did not earn.
 *   2. Exact-match grading, because the exam body states there is no partial
 *      credit inside a question.
 *   3. Rubric arithmetic matches `aihub/scripts/lib/rubric.ts` exactly.
 *   4. Progress arithmetic cannot produce NaN or a stale denominator.
 *
 * Run: npx tsx scripts/verify-assessment.ts
 */
import assert from 'node:assert/strict';

import {
  gradeAttempt,
  levelPoints,
  scoreJudgments,
  RUBRIC_CRITERIA,
  RUBRIC_LEVELS,
  readExamSpec,
  readQuizSpec,
  readPromptSpec,
  readStoredQuestions,
  readQuestionIds,
  stripAnswerKey,
  extractAnswerKey,
  type AssessmentQuestion,
  type AnswerKeyEntry,
  type AnswerMap,
  type RubricLevel,
  type StoredQuestion,
} from '../src/lib/assessment';
import { allPages } from '../src/lib/data';
import { boundaryConfigured, evaluatePrompt, submitAttempt } from '../src/lib/assessment-api';
import { courseProgress, readProgress } from '../src/lib/progress';

let passed = 0;
let skipped = 0;

/**
 * A check that cannot run in this repository's current state.
 *
 * Some assertions need data that only exists in the MDX source tree, which was
 * deleted before this snapshot was rebuilt from the last good `.next` build.
 * Specifically: answer keys and prompt rubrics never shipped to the browser —
 * that was the point of the leak gate — so they are not in the prerendered HTML
 * and therefore not in the recovered snapshot.
 *
 * Those checks are skipped rather than deleted. Deleting them would quietly
 * remove the only thing that would notice if scoring silently stopped working
 * once the keys are restored. Skipping them says the truth: not run, not
 * passing, not gone.
 */
function skip(name: string, why: string) {
  skipped++;
  console.log(`  skip ${name}`);
  console.log(`       ${why}`);
}

function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

/* --------------------------------------------------------------- fixtures -- */

const questions: AssessmentQuestion[] = [
  {
    id: 'q1',
    type: 'single-choice',
    prompt: 'Which one?',
    points: 16,
    options: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
  },
  {
    id: 'q2',
    type: 'multiple-answer',
    prompt: 'Which two?',
    points: 20,
    options: [
      { id: 'x', label: 'X' },
      { id: 'y', label: 'Y' },
      { id: 'z', label: 'Z' },
    ],
  },
];

const key: AnswerKeyEntry[] = [
  { questionId: 'q1', correct: ['a'] },
  { questionId: 'q2', correct: ['x', 'z'] },
];

/* ------------------------------------------------------- the honesty rule -- */

console.log('\n1. No answer key → no score');

check('gradeAttempt returns null with no key', () => {
  assert.equal(gradeAttempt(questions, { q1: ['a'] }, null), null);
});

check('gradeAttempt returns null with an empty key', () => {
  assert.equal(gradeAttempt(questions, { q1: ['a'] }, []), null);
});

check('gradeAttempt returns null when answers are wrong — never a zero', () => {
  // The critical asymmetry: "not graded" is null, not 0. A wrong answer with a
  // key present IS scored zero, which is a different claim.
  assert.equal(gradeAttempt(questions, { q1: ['b'] }, undefined), null);
});

/* ------------------------------------------------------------- real grading -- */

console.log('\n2. With a key, grading is exact and deterministic');

check('all correct scores full marks', () => {
  const r = gradeAttempt(questions, { q1: ['a'], q2: ['x', 'z'] }, key, 70);
  assert.ok(r);
  assert.equal(r.earnedPoints, 36);
  assert.equal(r.totalPoints, 36);
  assert.equal(r.percent, 100);
  assert.equal(r.passed, true);
});

check('multi-select in the wrong order is still correct (display order is meaningless)', () => {
  const r = gradeAttempt(questions, { q1: ['a'], q2: ['z', 'x'] }, key, 70);
  assert.ok(r);
  assert.equal(r.percent, 100);
});

check('a partially-correct multi-select scores zero — no partial credit', () => {
  const r = gradeAttempt(questions, { q1: ['a'], q2: ['x'] }, key, 70);
  assert.ok(r);
  // q1 earns 16, q2 earns 0. Overlap is not credit.
  assert.equal(r.earnedPoints, 16);
  assert.equal(r.percent, 44);
  assert.equal(r.passed, false);
});

check('a wrong single-choice scores zero', () => {
  const r = gradeAttempt(questions, { q1: ['b'], q2: ['x', 'z'] }, key, 70);
  assert.ok(r);
  assert.equal(r.earnedPoints, 20);
});

check('an unanswered question scores zero when a key exists', () => {
  const r = gradeAttempt(questions, { q1: ['a'] }, key, 70);
  assert.ok(r);
  assert.equal(r.perQuestion.find((p) => p.questionId === 'q2')?.awarded, 0);
});

check('a question with no key entry is reported null, not false', () => {
  // "Nobody graded this" must stay distinguishable from "graded as wrong".
  const partial: AnswerKeyEntry[] = [{ questionId: 'q1', correct: ['a'] }];
  const r = gradeAttempt(questions, { q1: ['a'], q2: ['x', 'z'] }, partial);
  assert.ok(r);
  const q2 = r.perQuestion.find((p) => p.questionId === 'q2');
  assert.equal(q2?.correct, null);
});

check('passing score is respected at the boundary', () => {
  // 16/36 = 44.4% → percent 44. Asserting the boundary either side of it:
  // 44 passes, 45 does not.
  const r = gradeAttempt(questions, { q1: ['a'] }, key, 44);
  assert.equal(r?.percent, 44);
  assert.equal(r?.passed, true);
  const r2 = gradeAttempt(questions, { q1: ['a'] }, key, 45);
  assert.equal(r2?.passed, false);
  const r3 = gradeAttempt(questions, { q1: ['a'], q2: ['x', 'z'] }, key, 100);
  assert.equal(r3?.passed, true, 'a full score meets a 100% threshold');
});

check('no passing score → passed is null, not false', () => {
  const r = gradeAttempt(questions, { q1: ['a'], q2: ['x', 'z'] }, key);
  assert.equal(r?.passed, null);
});

check('a zero-question assessment does not divide by zero', () => {
  const r = gradeAttempt([], {}, key);
  assert.equal(r?.percent, 0);
});

check('grading is order-independent', () => {
  const r1 = gradeAttempt(questions, { q2: ['z', 'x'], q1: ['a'] }, key, 70);
  const r2 = gradeAttempt(questions, { q1: ['a'], q2: ['x', 'z'] }, key, 70);
  assert.deepEqual(r1, r2);
});

/* ------------------------------------------------------------------ rubric -- */

console.log('\n3. Rubric arithmetic mirrors scripts/lib/rubric.ts');

check('weights sum to exactly 100', () => {
  const total = RUBRIC_CRITERIA.reduce((s, c) => s + c.weight, 0);
  assert.equal(total, 100);
});

check('all nine canonical criterion ids are present', () => {
  const ids = RUBRIC_CRITERIA.map((c) => c.id).sort();
  assert.deepEqual(ids, [
    'acceptance-criteria',
    'boundaries',
    'constraints-and-non-goals',
    'context-supplied',
    'decomposition',
    'expected-output',
    'failure-behaviour',
    'task-definition',
    'verification-and-tests',
  ]);
});

check('levelPoints is thirds, rounded — matches levelPoints() upstream', () => {
  // weight 15 → 0/5/10/15 ; weight 10 → 0/3/7/10 ; weight 12 → 0/4/8/12
  assert.equal(levelPoints(15, 'absent'), 0);
  assert.equal(levelPoints(15, 'weak'), 5);
  assert.equal(levelPoints(15, 'adequate'), 10);
  assert.equal(levelPoints(15, 'strong'), 15);
  assert.equal(levelPoints(10, 'weak'), 3);
  assert.equal(levelPoints(10, 'adequate'), 7);
  assert.equal(levelPoints(12, 'adequate'), 8);
  assert.equal(levelPoints(6, 'weak'), 2);
});

check('a fully strong judgment set scores exactly 100', () => {
  const all = RUBRIC_CRITERIA.map((c) => ({ criterion: c.id, level: 'strong' as RubricLevel }));
  const { total, judged, missing } = scoreJudgments(all);
  assert.equal(total, 100);
  assert.equal(missing.length, 0);
  assert.equal(judged.length, 9);
});

check('an unjudged criterion scores absent and is reported in missing', () => {
  const { total, missing } = scoreJudgments([
    { criterion: 'task-definition', level: 'strong' },
  ]);
  assert.equal(total, 15);
  assert.equal(missing.length, 8);
  assert.ok(!missing.includes('task-definition'));
});

check('an empty judgment set scores 0 and lists all nine as missing', () => {
  const { total, missing } = scoreJudgments([]);
  assert.equal(total, 0);
  assert.equal(missing.length, 9);
});

check('an unknown criterion id is ignored, not crashed on', () => {
  const { total } = scoreJudgments([{ criterion: 'not-a-criterion', level: 'strong' }]);
  assert.equal(total, 0);
});

check('the level scale is the four documented values', () => {
  assert.deepEqual([...RUBRIC_LEVELS], ['absent', 'weak', 'adequate', 'strong']);
});

/* --------------------------------------------------- the integration boundary */

console.log('\n4. The grading boundary reports "not configured" rather than inventing');

/** Async variant: awaits the promise before asserting. */
const pending: Promise<void>[] = [];
function checkAsync(name: string, fn: () => Promise<void>) {
  pending.push(
    (async () => {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
    })(),
  );
}

check('no base URL is configured', () => {
  assert.equal(boundaryConfigured(), false);
});

void checkAsync('submitAttempt → unconfigured, never a fabricated result', async () => {
  const res = await submitAttempt({ assessmentRef: 'quizzes/x', answers: { q1: ['a'] } });
  assert.equal(res.kind, 'unconfigured');
});

void checkAsync('evaluatePrompt → unconfigured, never a fabricated score', async () => {
  const res = await evaluatePrompt({ promptText: 'add pagination' });
  assert.equal(res.kind, 'unconfigured');
  // And explicitly: no report object leaked through either path.
  assert.equal('data' in res, false);
});

/* ------------------------------------------------------- frontmatter readers */

console.log('\n5. Frontmatter readers handle the REAL shipped shapes');

check('readQuizSpec reads the real quiz frontmatter', () => {
  const spec = readQuizSpec({
    scope: 'session',
    assesses: 'sessions/a/b',
    assesses_title: 'B',
    allow_retry: true,
    shuffle_options: true,
    questions: ['output-is-a-draft'],
  });
  assert.equal(spec.scope, 'session');
  assert.equal(spec.allowRetry, true);
  assert.equal(spec.shuffleOptions, true);
  assert.deepEqual(spec.questionIds, ['output-is-a-draft']);
});

check('readQuizSpec on an id-only questions array yields ids, not objects', () => {
  // This is the actual bug being documented: the snapshot holds IDs.
  const spec = readQuizSpec({ questions: ['fluent-bigram-is-not-understanding'] });
  assert.equal(spec.questionIds.length, 1);
  assert.equal(typeof spec.questionIds[0], 'string');
});

check('readExamSpec reads the real exam frontmatter', () => {
  const spec = readExamSpec({
    course: 'courses/ai-fundamentals/index',
    course_title: 'AI Fluency',
    passing_score: 70,
    max_attempts: 3,
    time_limit_minutes: 45,
    covers_modules: ['courses/ai-fundamentals/a'],
    certificate: { id: 'c1', title: 'AI Fluency Certificate', criteria: '70+' },
  });
  assert.equal(spec.passingScore, 70);
  assert.equal(spec.maxAttempts, 3);
  assert.equal(spec.timeLimitMinutes, 45);
  assert.equal(spec.certificate?.title, 'AI Fluency Certificate');
  assert.equal(spec.coversModules.length, 1);
});

check('readers tolerate entirely absent fields', () => {
  const q = readQuizSpec({});
  const e = readExamSpec({});
  const p = readPromptSpec({});
  assert.equal(q.passingScore, undefined);
  assert.equal(q.questionIds.length, 0);
  assert.equal(e.timeLimitMinutes, undefined);
  assert.equal(p.task, undefined);
  assert.deepEqual(p.rubricCriteria, []);
});

check('readers reject non-numeric passing_score rather than coercing it', () => {
  assert.equal(readExamSpec({ passing_score: 'seventy' }).passingScore, undefined);
  assert.equal(readExamSpec({ passing_score: Number.NaN }).passingScore, undefined);
});

check('readPromptSpec reads task, concepts, rubric and variants', () => {
  const spec = readPromptSpec({
    task: 'Add cursor pagination.',
    concepts: ['concepts/prompting'],
    rubric: ['criterion: "task-definition"'],
    assessments: ['variant: "weak"'],
    allow_retry: true,
  });
  assert.equal(spec.task, 'Add cursor pagination.');
  assert.deepEqual(spec.rubricCriteria, ['criterion: "task-definition"']);
  assert.deepEqual(spec.assessmentVariants, ['variant: "weak"']);
  assert.equal(spec.allowRetry, true);
});

/* ----------------------------------------------------------------- progress */

console.log('\n6. Progress arithmetic is deterministic and cannot divide by zero');

check('a course with no sessions reads 0%, not NaN', () => {
  const p = courseProgress('en', 'courses/nonexistent/index', 'Nope', new Set());
  assert.equal(p.totalSessions, 0);
  assert.equal(p.percent, 0);
  assert.equal(p.completedSessions, 0);
});

check('progress is derived from real content, not from what is marked', () => {
  // The real AI Fluency course: mark nothing → 0 of its real session count.
  const p = courseProgress('en', 'courses/ai-fundamentals/index', 'AI Fluency', new Set());
  assert.ok(p.totalSessions > 0, 'the real course must resolve to real sessions');
  assert.equal(p.percent, 0);
  assert.equal(p.remaining.length, p.totalSessions);
});

check('a marked session the content does not contain is ignored', () => {
  // Stale ids must not inflate progress — the denominator is content-derived.
  const p = courseProgress('en', 'courses/ai-fundamentals/index', 'AI Fluency', new Set(['sessions/deleted-page']));
  assert.equal(p.completedSessions, 0);
});

check('marking every real session reaches exactly 100%', () => {
  const empty = courseProgress('en', 'courses/ai-fundamentals/index', 'AI Fluency', new Set());
  const all = new Set(empty.remaining);
  const p = courseProgress('en', 'courses/ai-fundamentals/index', 'AI Fluency', all);
  assert.equal(p.percent, 100);
  assert.equal(p.remaining.length, 0);
});

check('progress is identical across two calls — no clock, no randomness', () => {
  const a = courseProgress('en', 'courses/ai-fundamentals/index', 'AI Fluency', new Set());
  const b = courseProgress('en', 'courses/ai-fundamentals/index', 'AI Fluency', new Set());
  assert.deepEqual(a, b);
});

check('the store reports unreadable rather than throwing when storage is absent', () => {
  // Server-side (no window) and private-mode browsers both land here.
  const snap = readProgress();
  assert.ok(['unreadable', 'empty', 'loaded'].includes(snap.outcome));
  assert.ok(Array.isArray(snap.completed));
});

/* --------------------------------------- the key must never reach the client -- */

console.log('\n7. stripAnswerKey removes every leak path');

check('stripAnswerKey drops answer and every reason_wrong', () => {
  const stored: StoredQuestion[] = [
    {
      id: 'q1',
      type: 'single-choice',
      prompt: 'Pick A',
      points: 10,
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B', reason_wrong: 'B is wrong because…' },
      ],
      answer: { kind: 'choice', correct: ['a'] },
      explanation: 'Why A is right.',
    },
  ];
  const [out] = stripAnswerKey(stored);
  assert.ok(out);
  assert.equal('answer' in out, false, 'answer must not survive');
  assert.equal(out.options?.length, 2);
  // reason_wrong presence identifies the correct option, so it must be gone.
  assert.equal('reason_wrong' in (out.options?.[1] ?? {}), false);
  // But the explanation is not a key and must survive.
  assert.equal(stored[0].explanation, 'Why A is right.');
});

check('the serialized player payload contains no correct-answer marker', () => {
  const stored: StoredQuestion[] = [
    {
      id: 'q1',
      type: 'single-choice',
      prompt: 'P',
      points: 10,
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B', reason_wrong: 'leaky' },
      ],
      answer: { kind: 'choice', correct: ['a'] },
    },
  ];
  const json = JSON.stringify(stripAnswerKey(stored));
  assert.equal(json.includes('reason_wrong'), false, json);
  assert.equal(json.includes('"correct"'), false, json);
  assert.equal(json.includes('"answer"'), false, json);
});

check('a matching question is turned into unassigned choices', () => {
  const stored: StoredQuestion[] = [
    {
      id: 'm1',
      type: 'matching',
      prompt: 'Match',
      points: 10,
      pairs: [
        { id: 'token', term: 'Token', matches: 'def-token' },
        { id: 'window', term: 'Context window', matches: 'def-window' },
      ],
      answer: { kind: 'matching', correct: { token: 'def-token', window: 'def-window' } },
    },
  ];
  const [out] = stripAnswerKey(stored);
  assert.ok(out);
  // 2 terms + 2 definitions, presented unpaired.
  assert.equal(out.options?.length, 4);
  assert.ok(out.options?.some((o) => o.id === 'token'));
  assert.ok(out.options?.some((o) => o.id === 'def-token'));
});

check('extractAnswerKey reads keys without leaking them into the question list', () => {
  const stored: StoredQuestion[] = [
    {
      id: 'q1',
      type: 'single-choice',
      prompt: 'P',
      points: 10,
      answer: { kind: 'choice', correct: ['a'] },
    },
    { id: 'q2', type: 'single-choice', prompt: 'P2', points: 10 },
  ];
  const key = extractAnswerKey(stored);
  assert.equal(key.length, 1, 'only questions that HAVE a key produce an entry');
  assert.deepEqual(key[0], { questionId: 'q1', correct: ['a'] });
});

check('readStoredQuestions ignores bare id strings instead of faking a question', () => {
  // A fake question with no prompt and no options is worse than an absence.
  const objs = readStoredQuestions({
    questions: [{ id: 'q1', type: 'single-choice', prompt: 'P', points: 10 }, 'bare-id'],
  });
  assert.equal(objs.length, 1);
  assert.equal(objs[0].id, 'q1');
  const ids = readQuestionIds({ questions: [{ id: 'q1' }, 'bare-id'] });
  assert.deepEqual(ids, ['q1', 'bare-id'], 'both forms still report an id');
});

/* ------------------------------- the real shipped snapshot, end to end ------ */

console.log('\n8. The REAL snapshot: questions load, and no key escapes');

/*
 * Loaded through the app's own data layer, not a hand-written fixture, so this
 * fails the moment the real content shape changes.
 */
const realPages = allPages('en');
const realQuizzes = realPages.filter((p) => p.type === 'quiz');
const realExams = realPages.filter((p) => p.type === 'exam');

check('the real snapshot has quizzes and an exam', () => {
  assert.ok(realQuizzes.length > 0, 'expected real quiz pages');
  assert.ok(realExams.length > 0, 'expected a real exam page');
});

check('real quiz questions ARE present as full objects (not id strings)', () => {
  const q = realQuizzes[0];
  assert.ok(q, 'no quiz page');
  const stored = readStoredQuestions(q.frontmatter);
  assert.ok(stored.length > 0, 'quiz frontmatter carried no question objects');
  assert.equal(typeof stored[0].prompt, 'string');
  assert.ok(stored[0].prompt.length > 10);
});

check('real questions sum to exactly 100 points, as schemas/quiz.ts requires', () => {
  for (const p of [...realQuizzes, ...realExams]) {
    const stored = readStoredQuestions(p.frontmatter);
    const total = stored.reduce((s, q) => s + (q.points ?? 0), 0);
    assert.equal(total, 100, `${p.refPath} totals ${total}`);
  }
});

check('every real question is answerable after stripping (nothing unclickable)', () => {
  for (const p of [...realQuizzes, ...realExams]) {
    for (const q of stripAnswerKey(readStoredQuestions(p.frontmatter))) {
      // An `ordering` question gets its choices derived from the key ids, since
      // the schema stores no items for it; everything else has real options.
      assert.ok(
        q.options && q.options.length > 0,
        `${p.refPath}/${q.id} (${q.type}) rendered with nothing to click`,
      );
      assert.ok(
        q.options.every((o) => typeof o.label === 'string' && o.label.length > 0),
        `${p.refPath}/${q.id}: an option has no label`,
      );
    }
  }
});

check('stripping every real assessment page leaks no answer data', () => {
  for (const p of [...realQuizzes, ...realExams]) {
    const stripped = stripAnswerKey(readStoredQuestions(p.frontmatter));
    const json = JSON.stringify(stripped);
    assert.equal(json.includes('reason_wrong'), false, `${p.refPath} leaked reason_wrong`);
    assert.equal(json.includes('"correct"'), false, `${p.refPath} leaked correct`);
    assert.equal(json.includes('"answer"'), false, `${p.refPath} leaked answer`);
    assert.equal(json.includes('"matches"'), false, `${p.refPath} leaked a matching map`);
    assert.ok(stripped.length > 0, `${p.refPath} stripped to nothing`);
  }
});

if ([...realQuizzes, ...realExams].some((p) =>
        extractAnswerKey(readStoredQuestions(p.frontmatter)).length > 0)) {
  check('the real snapshot DOES contain keys — documenting the leak risk we avoid', () => {
  const withKeys = [...realQuizzes, ...realExams].filter(
    (p) => extractAnswerKey(readStoredQuestions(p.frontmatter)).length > 0,
  );
  assert.ok(
    withKeys.length > 0,
    'expected the snapshot to carry answer keys; if this ever fails, the serving ' +
      'layer has started stripping and this module no longer needs to',
  );
  // The keys must reference real option ids, or grading would silently zero out.
  for (const p of [...realQuizzes, ...realExams]) {
    const stored = readStoredQuestions(p.frontmatter);
    for (const entry of extractAnswerKey(stored)) {
      const q = stored.find((s) => s.id === entry.questionId);
      assert.ok(q, `key for unknown question ${entry.questionId}`);
      // Resolve against the STRIPPED question, which is what a learner can
      // actually select — a key naming something unselectable would score 0.
      const stripped = stripAnswerKey([q])[0];
      const ids = new Set((stripped.options ?? []).map((o) => o.id));
      for (const id of entry.correct) {
        assert.ok(ids.has(id), `${p.refPath}/${entry.questionId}: key names unknown option "${id}"`);
      }
    }
  }
});

} else {
  skip('the real snapshot DOES contain keys', 'the recovered snapshot carries no answer keys — they were never sent to the browser, so they are not in the prerendered HTML it was rebuilt from');
}
if (realExams.length > 0 &&
    extractAnswerKey(readStoredQuestions(realExams[0].frontmatter)).length > 0) {
  check('an all-correct attempt using the real key scores exactly 100', () => {
  const p = realExams[0];
  assert.ok(p, 'no exam page');
  const stored = readStoredQuestions(p.frontmatter);
  const key = extractAnswerKey(stored);
  const perfect: AnswerMap = {};
  for (const e of key) perfect[e.questionId] = e.correct;
  const r = gradeAttempt(stripAnswerKey(stored), perfect, key, 70);
  assert.ok(r);
  assert.equal(r.percent, 100);
  assert.equal(r.passed, true);
  assert.equal(r.earnedPoints, 100);
});

} else {
  skip('an all-correct attempt using the real key scores exactly 100', 'the recovered snapshot carries no answer keys — they were never sent to the browser, so they are not in the prerendered HTML it was rebuilt from');
}

if (realExams.length > 0 &&
    extractAnswerKey(readStoredQuestions(realExams[0].frontmatter)).length > 0) {
  check('an all-wrong attempt using the real key scores exactly 0', () => {
  const p = realExams[0];
  assert.ok(p, 'no exam page');
  const stored = readStoredQuestions(p.frontmatter);
  const key = extractAnswerKey(stored);
  const wrong: AnswerMap = {};
  for (const q of stripAnswerKey(stored)) {
    const right = new Set(key.find((k) => k.questionId === q.id)?.correct ?? []);
    const opts = q.options ?? [];
    // Pick the first option that is NOT correct.
    wrong[q.id] = [opts.find((o) => !right.has(o.id))?.id ?? opts[0].id];
  }
  const r = gradeAttempt(stripAnswerKey(stored), wrong, key, 70);
  assert.ok(r);
  assert.equal(r.percent, 0);
  assert.equal(r.passed, false);
});

} else {
  skip('an all-wrong attempt using the real key scores exactly 0', 'the recovered snapshot carries no answer keys — they were never sent to the browser, so they are not in the prerendered HTML it was rebuilt from');
}

if (realPages.some((p) => p.type === 'prompt-assessment' &&
    Array.isArray((p.frontmatter as Record<string, unknown>)?.rubric))) {
  check('real prompt-assessment pages carry a 9-criterion rubric summing to 100', () => {
  const pa = realPages.filter((p) => p.type === 'prompt-assessment');
  assert.ok(pa.length > 0, 'expected prompt-assessment pages');
  for (const p of pa) {
    const rubric = p.frontmatter['rubric'];
    assert.ok(Array.isArray(rubric) && rubric.length === 9, `${p.refPath}: rubric length`);
    const ids = new Set(RUBRIC_CRITERIA.map((c) => c.id));
    const declared = (rubric as unknown[])
      .map((r) => {
        if (typeof r === 'string') return r.replace(/^criterion:\s*/, '').replace(/^["']|["']$/g, '');
        if (r && typeof r === 'object') {
          const c = (r as { criterion?: unknown }).criterion;
          return typeof c === 'string' ? c : '';
        }
        return '';
      })
      .filter(Boolean);
    for (const id of declared) {
      assert.ok(ids.has(id as never), `${p.refPath}: unknown rubric criterion "${id}"`);
    }
  }
});

} else {
  skip('real prompt-assessment pages carry a 9-criterion rubric', 'the recovered snapshot carries no prompt rubric — the rubric was never rendered into the prerendered HTML the snapshot was rebuilt from');
}

check('both locales carry the same assessment structure', () => {
  const arQuizzes = allPages('ar').filter((p) => p.type === 'quiz');
  const arExams = allPages('ar').filter((p) => p.type === 'exam');
  assert.equal(arQuizzes.length, realQuizzes.length, 'quiz count differs between locales');
  assert.equal(arExams.length, realExams.length, 'exam count differs between locales');
  for (let i = 0; i < realQuizzes.length; i++) {
    const en = readStoredQuestions(realQuizzes[i].frontmatter);
    const ar = readStoredQuestions(arQuizzes[i].frontmatter);
    assert.deepEqual(
      en.map((q) => q.id),
      ar.map((q) => q.id),
      `${realQuizzes[i].refPath}: question ids differ between locales`,
    );
    const enPts = en.reduce((s, q) => s + (q.points ?? 0), 0);
    const arPts = ar.reduce((s, q) => s + (q.points ?? 0), 0);
    assert.equal(enPts, arPts, `${realQuizzes[i].refPath}: points differ between locales`);
  }
});

/* ------------------------------------------------------------------ report -- */

// No top-level await: this file compiles to CJS under tsx.
void Promise.all(pending).then(() => {
  // Skips are counted in the headline, not buried. "37 passed, 4 skipped" and
  // "41 passed" read very differently to whoever is deciding whether scoring is
  // actually covered right now.
  const skippedNote = skipped > 0 ? `, ${skipped} skipped` : '';
  console.log(`\n${passed} check(s) passed${skippedNote}.`);
  if (process.exitCode) console.error('\nSome checks FAILED.');
  else if (skipped > 0) {
    console.log('No check failed. The skipped ones need data only the MDX tree had.');
  } else {
    console.log('All assessment behaviour checks passed.');
  }
});