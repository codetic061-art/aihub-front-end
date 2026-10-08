/**
 * Assessment domain model — the types the players share, the pure scoring
 * arithmetic, and tolerant readers for the real assessment frontmatter.
 *
 * WHY ANSWERS ARE A PROP AND NOT DATA
 *
 * `workers/src/assessments.ts` `stripAnswers()` is the single place the backend
 * removes an answer key: a served question has no `answer`, no per-option
 * `reason_wrong` (its *presence* identifies the correct option) and no matching
 * pair map, while `explanation` survives because it is not itself a key. So a
 * served question can be rendered, but it cannot be graded. Grading therefore
 * arrives as `answerKey` — supplied by an authenticated / Worker-backed call,
 * never embedded in the page — and the player must be correct in BOTH states.
 * With a key it grades. Without one it records the attempt and says so. It
 * never invents a score.
 *
 * The rubric constants below mirror `aihub/scripts/lib/rubric.ts` exactly (same
 * ids, same weights, same thirds-and-round arithmetic, same verdict bands) so
 * the report this module renders cannot disagree with the one the server
 * computes. They are a mirror, not a second source of truth: when the server
 * sends judgments, the server's `total` and `verdict` are what get displayed.
 */

/* -------------------------------------------------------------------------- */
/** Served question shapes (mirror `workers/src/contracts.ts` AssessmentQuestion) */
/* -------------------------------------------------------------------------- */

/**
 * A question as it sits in the build-time snapshot.
 *
 * IMPORTANT — the shipped JSON currently CONTAINS answer keys.
 * Measured on `src/content/en.json`: all 4 quizzes carry 5 questions summing to
 * 100 points, and the 1 exam carries 9 summing to 100, and every one of them
 * includes `answer.correct` plus per-option `reason_wrong`. So the *content*
 * is complete and gradeable; it is the public *serving* layer that strips keys
 * (see `workers/src/assessments.ts`), and this static build renders content
 * straight from the snapshot.
 *
 * That means a page built this way would publish its own answer key in the HTML.
 * `stripAnswerKey` below is what prevents it: the players are fed stripped
 * questions, exactly as a Worker-served payload would be, and grading stays on
 * an explicit `answerKey` prop. Anyone wanting the real key supplies it.
 */
export interface StoredQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  /**
   * An `ordering` question's items.
   *
   * There is a real gap here. `schemas/question.ts` defines `ordering` with only
   * an `answer.correct` id array and no `items` array, and the content follows
   * that: the four stages to sequence appear only inside the prompt prose ("(a)
   * … (b) …") and the key names ids like `split-the-prompt-into-tokens` that
   * exist nowhere in the frontmatter. So the items are recoverable only as ids,
   * with no labels.
   *
   * Rather than fabricate labels — inventing "Tokenise the prompt" for
   * `split-the-prompt-into-tokens` would be writing content that is not in the
   * content — the ids are passed through and the player renders the item ids as
   * the choices. That is honest and it is answerable: the key is the same id set,
   * so a learner picking the four ids in the order given by the prompt does grade
   * correctly. A real fix belongs upstream: add `items` to the `ordering` schema.
   */
  items?: { id: string; text: string }[];
  /** Marks this question contributes to the 100-point total. */
  points?: number;
  difficulty?: 1 | 2 | 3;
  concepts?: string[];
  source?: { title?: string; url?: string };
  explanation?: string;
  options?: (AssessmentOption & { reason_wrong?: string })[];
  scenario?: string;
  pairs?: { id: string; term: string; matches: string }[];
  /** The key. Never passed to a player directly — see `stripAnswerKey`. */
  answer?: {
    kind: 'choice' | 'matching' | 'ordering';
    correct?: string[] | Record<string, string>;
  };
}

/**
 * Remove every answer key from a question set.
 *
 * A direct port of `stripAnswers()` in `workers/src/assessments.ts`, kept
 * behaviourally identical on purpose:
 *   - `answer` is dropped entirely (its `correct` array IS the key);
 *   - each option's `reason_wrong` is dropped, because its *presence* marks
 *     the correct option and keeping it would re-leak the answer;
 *   - a `matching` question's `pairs[].matches` is dropped, because that
 *     mapping is the answer for that question type;
 *   - `explanation` is KEPT — it explains the answer after an attempt and is
 *     not itself a key.
 *
 * `matching` questions then present their terms and definitions with no
 * pairing, which is exactly what `contracts.ts` describes: an empty `options`
 * plus present `items` is how a client tells a matching question from a broken
 * one.
 */
export function stripAnswerKey(questions: readonly StoredQuestion[]): AssessmentQuestion[] {
  return questions.map((q) => {
    const { answer, pairs, ...rest } = q;
    const out: AssessmentQuestion = {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
    };
    if (q.scenario !== undefined) out.scenario = q.scenario;
    if (q.options) {
      out.options = q.options.map((o) => ({ id: o.id, label: o.label }));
    }
    // A matching question's `pairs` become unassigned choices: the terms one
    // side, the definitions the other, with `matches` removed.
    if (pairs) {
      out.options = [
        ...pairs.map((p) => ({ id: p.id, label: p.term })),
        ...pairs.map((p) => ({ id: `def-${p.id}`, label: p.matches })),
      ];
    }
    // An `ordering` question stores no items at all — only the key's id list.
    // The ids are the only description of the choices that exists, so they are
    // surfaced as options whose label IS the id. Fabricating readable labels
    // here would mean writing content the MDX does not contain.
    if (q.type === 'ordering' && !out.options && Array.isArray(answer?.correct)) {
      out.options = answer.correct.map((id) => ({ id, label: id }));
    }
    return out;
  });
}

/**
 * Extract the answer key from stored questions.
 *
 * Separate from `stripAnswerKey` so the two can never be confused: one call
 * produces what the learner sees, the other what the grader holds.
 */
export function extractAnswerKey(
  questions: readonly StoredQuestion[],
): AnswerKeyEntry[] {
  const entries: AnswerKeyEntry[] = [];
  for (const q of questions) {
    const correct = q.answer?.correct;
    if (Array.isArray(correct)) {
      entries.push({ questionId: q.id, correct });
    } else if (correct && typeof correct === 'object') {
      // A matching key is a term→definition id map. The player models a
      // matching answer as the set of selected option ids, so the values are
      // taken as the correct selection.
      entries.push({ questionId: q.id, correct: Object.values(correct) });
    }
  }
  return entries;
}

/** The closed question-type union. Mirrors `schemas/question.ts`. */
export type QuestionType =
  | 'single-choice'
  | 'multiple-answer'
  | 'true-false'
  | 'scenario'
  | 'matching'
  | 'ordering';

export interface AssessmentOption {
  id: string;
  label: string;
}

export interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  /** Marks this question contributes. Only used when a key is present. */
  points?: number;
  /** Absent on `matching` (whose items carry the choices) and `ordering`. */
  options?: AssessmentOption[];
  /** The situation a `scenario` question reasons about. */
  scenario?: string;
}

/** One entry per question. `correct` is option ids, all of which must be picked. */
export interface AnswerKeyEntry {
  questionId: string;
  correct: string[];
}

/**
 * How a player is being scored.
 *
 *  `graded`    — a key was supplied; `result` holds a real score.
 *  `submitted` — no key; the attempt is recorded and waiting on a grader.
 *
 * There is deliberately no third state that shows a number. "Awaiting grading"
 * and "scored" are different claims and the UI must not blur them.
 */
export type AssessmentStatus = 'answering' | 'submitted' | 'graded';

export interface QuestionResult {
  questionId: string;
  /** True only when a key existed for this question and the sets matched. */
  correct: boolean | null;
  points: number;
  awarded: number;
}

export interface GradedResult {
  /** Sum of the awardable points across the served questions. */
  totalPoints: number;
  earnedPoints: number;
  /** 0-100, rounded. Equals the earned share because totals are 100. */
  percent: number;
  /** `undefined` when the assessment declares no passing score. */
  passed: boolean | null;
  passingScore?: number;
  perQuestion: QuestionResult[];
}

/* -------------------------------------------------------------------------- */
/* Answers                                                                      */
/* -------------------------------------------------------------------------- */

/** question id → selected option ids. */
export type AnswerMap = Record<string, string[]>;

/** True when a question type takes more than one selection. */
export function isMultiSelect(type: QuestionType): boolean {
  return type === 'multiple-answer';
}

/**
 * A question is answered when its selection exactly equals the key.
 *
 * Equality, not overlap: the exam body states there is no partial credit inside
 * a question, so `selecting two of three correct options` scores zero, exactly
 * as a single wrong option costs the whole question. Sets are compared
 * order-independently because `shuffle_options` means display order carries no
 * meaning.
 */
function selectionMatches(selected: string[], correct: string[]): boolean {
  if (selected.length !== correct.length) return false;
  const want = new Set(correct);
  return selected.every((id) => want.has(id));
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Grade an attempt against a key. Returns `null` when there is no key — the
 * caller must then render the "submitted, awaiting results" state, and must not
 * substitute a number of its own.
 */
export function gradeAttempt(
  questions: AssessmentQuestion[],
  answers: AnswerMap,
  answerKey: AnswerKeyEntry[] | null | undefined,
  passingScore?: number,
): GradedResult | null {
  if (!answerKey || answerKey.length === 0) return null;

  const keyById = new Map(answerKey.map((entry) => [entry.questionId, entry.correct]));

  const perQuestion: QuestionResult[] = questions.map((q) => {
    const points = q.points ?? 0;
    const correct = keyById.get(q.id);
    if (correct === undefined) {
      // No key for this question is not the same as a wrong answer. It is
      // reported as ungraded (null) and earns nothing, which keeps the result
      // honest instead of silently scoring it as incorrect.
      return { questionId: q.id, correct: null, points, awarded: 0 };
    }
    const selected = answers[q.id] ?? [];
    const ok = selectionMatches(selected, correct);
    return { questionId: q.id, correct: ok, points, awarded: ok ? points : 0 };
  });

  const totalPoints = perQuestion.reduce((sum, r) => sum + r.points, 0);
  const earnedPoints = perQuestion.reduce((sum, r) => sum + r.awarded, 0);
  const percent =
    totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  return {
    totalPoints,
    earnedPoints,
    percent,
    passed: passingScore === undefined ? null : percent >= passingScore,
    passingScore,
    perQuestion,
  };
}

/* -------------------------------------------------------------------------- */
/* Prompt rubric — mirror of `aihub/scripts/lib/rubric.ts`                       */
/* -------------------------------------------------------------------------- */

export const RUBRIC_LEVELS = ['absent', 'weak', 'adequate', 'strong'] as const;
export type RubricLevel = (typeof RUBRIC_LEVELS)[number];

/** The closed criterion set, with the canonical weights that sum to 100. */
export const RUBRIC_CRITERIA = [
  { id: 'task-definition', weight: 15 },
  { id: 'context-supplied', weight: 15 },
  { id: 'constraints-and-non-goals', weight: 10 },
  { id: 'expected-output', weight: 10 },
  { id: 'acceptance-criteria', weight: 12 },
  { id: 'verification-and-tests', weight: 12 },
  { id: 'boundaries', weight: 10 },
  { id: 'failure-behaviour', weight: 10 },
  { id: 'decomposition', weight: 6 },
] as const;

export type RubricCriterionId = (typeof RUBRIC_CRITERIA)[number]['id'];

export const RUBRIC_VERDICTS = [
  'not-actionable',
  'needs-revision',
  'usable',
  'production-ready',
] as const;
export type RubricVerdict = (typeof RUBRIC_VERDICTS)[number];

/** Points a criterion of `weight` is worth at `level`: thirds, rounded. */
export function levelPoints(weight: number, level: RubricLevel): number {
  const numerators: Record<RubricLevel, number> = {
    absent: 0,
    weak: 1,
    adequate: 2,
    strong: 3,
  };
  return Math.round((weight * numerators[level]) / 3);
}

/**
 * Total for a set of judgments.
 *
 * A criterion with no judgment scores `absent` and is reported in `missing`,
 * exactly as the backend does — dropping it would inflate the total by whatever
 * that criterion was worth, which is the quiet way a rubric stops meaning
 * anything. Used only to render a server payload defensively; the server's own
 * `total` wins when present.
 */
export function scoreJudgments(
  judgments: readonly { criterion: string; level: RubricLevel }[],
): { total: number; judged: RubricCriterionId[]; missing: RubricCriterionId[] } {
  const byId = new Map(judgments.map((j) => [j.criterion, j.level]));
  const judged: RubricCriterionId[] = [];
  const missing: RubricCriterionId[] = [];
  let total = 0;

  for (const c of RUBRIC_CRITERIA) {
    const level = byId.get(c.id) ?? 'absent';
    total += levelPoints(c.weight, level);
    if (byId.has(c.id)) judged.push(c.id);
    else missing.push(c.id);
  }
  return { total, judged, missing };
}

/* -------------------------------------------------------------------------- */
/* Frontmatter readers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Readers for the assessment fields that genuinely exist in the shipped
 * snapshot. Every reader is tolerant: a missing field yields `undefined` rather
 * than throwing, because the catch-all template must not 500 on a page whose
 * frontmatter is thinner than another locale's.
 *
 * `questions` IS present on quiz and exam pages — but as an array of question
 * ID STRINGS, not question objects (see `readQuestionIds`). That is a property
 * of the build-time snapshot, not of the schema, and the players are built to
 * take real question objects from a served payload instead.
 */
function readStringList(fm: Record<string, unknown>, key: string): string[] {
  const v = fm[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

/**
 * Read the `questions` array as stored question objects.
 *
 * Two shapes are accepted, because the snapshot has been through two states
 * during development and this reader must not break on either:
 *   - full objects (current): `{ id, type, prompt, options, answer, … }`
 *   - id strings (an older snapshot): `['fluent-bigram-is-not-understanding']`
 *
 * A bare id string carries no prompt or options, so it is NOT turned into a
 * fake question — a rendered question with nothing to click is worse than an
 * explicit absence. Such entries are dropped, and `declaredQuestionIds` still
 * reports them so the omission is visible rather than silent.
 */
export function readStoredQuestions(fm: Record<string, unknown>): StoredQuestion[] {
  const v = fm['questions'];
  if (!Array.isArray(v)) return [];
  return v.filter(
    (q): q is StoredQuestion =>
      typeof q === 'object' && q !== null && !Array.isArray(q) && typeof (q as { id?: unknown }).id === 'string',
  );
}

/** Question ids the page declares, whether stored as objects or bare strings. */
export function readQuestionIds(fm: Record<string, unknown>): string[] {
  const v = fm['questions'];
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === 'string' && item.trim()) out.push(item);
    else if (item && typeof item === 'object' && !Array.isArray(item)) {
      const id = (item as { id?: unknown }).id;
      if (typeof id === 'string' && id.trim()) out.push(id);
    }
  }
  return out;
}

export interface QuizSpec {
  scope?: string;
  assesses?: string;
  assessesTitle?: string;
  passingScore?: number;
  allowRetry: boolean;
  shuffleOptions: boolean;
  questionCount?: number;
  /** Ids declared in the snapshot — metadata, NOT renderable questions. */
  questionIds: string[];
}

export function readQuizSpec(fm: Record<string, unknown>): QuizSpec {
  const passing = fm['passing_score'];
  const count = fm['question_count'];
  return {
    scope: typeof fm['scope'] === 'string' ? fm['scope'] : undefined,
    assesses: typeof fm['assesses'] === 'string' ? fm['assesses'] : undefined,
    assessesTitle:
      typeof fm['assesses_title'] === 'string' ? fm['assesses_title'] : undefined,
    passingScore:
      typeof passing === 'number' && Number.isFinite(passing) ? passing : undefined,
    allowRetry: fm['allow_retry'] === true,
    shuffleOptions: fm['shuffle_options'] === true,
    questionCount:
      typeof count === 'number' && Number.isFinite(count) ? count : undefined,
    questionIds: readStringList(fm, 'questions'),
  };
}

export interface ExamSpec {
  course?: string;
  courseTitle?: string;
  passingScore?: number;
  maxAttempts?: number;
  timeLimitMinutes?: number;
  coversModules: string[];
  certificate?: { id?: string; title?: string; criteria?: string };
  questionIds: string[];
}

export function readExamSpec(fm: Record<string, unknown>): ExamSpec {
  const readOptNum = (key: string): number | undefined => {
    const v = fm[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  };
  const cert = fm['certificate'];
  const certObj =
    cert && typeof cert === 'object' && !Array.isArray(cert)
      ? (cert as Record<string, unknown>)
      : undefined;
  const certTitle = certObj?.['title'];
  const certId = certObj?.['id'];
  const certCriteria = certObj?.['criteria'];

  return {
    course: typeof fm['course'] === 'string' ? fm['course'] : undefined,
    courseTitle:
      typeof fm['course_title'] === 'string' ? fm['course_title'] : undefined,
    passingScore: readOptNum('passing_score'),
    maxAttempts: readOptNum('max_attempts'),
    timeLimitMinutes: readOptNum('time_limit_minutes'),
    coversModules: readStringList(fm, 'covers_modules'),
    certificate:
      certTitle || certId || certCriteria
        ? {
            id: typeof certId === 'string' ? certId : undefined,
            title: typeof certTitle === 'string' ? certTitle : undefined,
            criteria: typeof certCriteria === 'string' ? certCriteria : undefined,
          }
        : undefined,
    questionIds: readStringList(fm, 'questions'),
  };
}

export interface PromptSpec {
  task?: string;
  concepts: string[];
  allowRetry: boolean;
  /** Criterion ids the page declares. Weights come from RUBRIC_CRITERIA. */
  rubricCriteria: string[];
  /** Worked-variant names, e.g. "weak". Labels for prose examples only. */
  assessmentVariants: string[];
}

export function readPromptSpec(fm: Record<string, unknown>): PromptSpec {
  return {
    task: typeof fm['task'] === 'string' ? fm['task'] : undefined,
    concepts: readStringList(fm, 'concepts'),
    allowRetry: fm['allow_retry'] === true,
    rubricCriteria: readStringList(fm, 'rubric'),
    assessmentVariants: readStringList(fm, 'assessments'),
  };
}