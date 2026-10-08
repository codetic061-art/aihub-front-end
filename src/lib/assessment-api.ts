/**
 * Integration boundary: attempt submission and rubric evaluation.
 *
 * WHY THIS FILE EXISTS AND WHY IT CALLS NOTHING YET
 *
 * The backend has a real grading model (`db/migrations/0005_assessments.sql`,
 * `schemas/question.ts`) and a real rubric scorer (`scripts/lib/rubric.ts`), but
 * `workers/src/index.ts` serves only:
 *
 *   /api/health  /api/sync  /api/cron
 *   /api/pages   /api/pages/*   /api/search
 *   /api/graph/* /api/stats      /api/navigation
 *
 * There is no `/api/attempts` and no prompt-evaluation route. So this module
 * defines the *contract* those two routes will implement and reports
 * `unconfigured` until a base URL is supplied. It does not guess a URL, and it
 * does not fall back to anything that invents a score.
 *
 * `assessment.unavailable` / `prompt.unavailable` in `src/i18n/messages.ts`
 * already describe exactly this state to the reader.
 *
 * TO WIRE IT UP
 *
 *   export const ASSESSMENT_API_BASE_URL = 'https://<worker-host>';
 *
 * then implement, on the Worker:
 *
 *   POST /api/attempts
 *     body  { assessmentRef: string; attemptId?: string; answers: Record<string, string[]> }
 *     200   { status: 'graded'; result: { totalPoints; earnedPoints; percent;
 *                                     passed: boolean|null; passingScore?: number;
 *                                     perQuestion: { questionId; correct; points; awarded }[] } }
 *     202   { status: 'submitted'; reason: string }   // key not applied yet
 *     4xx/5xx { error: { code: string; message: string } }
 *
 *   POST /api/prompts/evaluate
 *     body  { assessmentRef: string; promptText: string }
 *     200   { total: number; verdict: RubricVerdict;
 *             judgments: { criterion; level; reasoning; improvement }[];
 *             judged: RubricCriterionId[]; missing: RubricCriterionId[] }
 *     503   { error: { code: 'evaluator_unavailable'; message } }
 *
 * The grading side MUST apply the key server-side: the browser never receives
 * correct answers, so it is structurally incapable of computing a real score.
 */

/* -------------------------------------------------------------------------- */
/* Base URL                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * TODO(worker): set to the deployed Worker origin to enable both calls.
 * Left undefined on purpose — a placeholder host would produce a request that
 * fails somewhere plausible-looking rather than an honest "not configured".
 */
export const ASSESSMENT_API_BASE_URL: string | undefined = undefined;

/** How long a single evaluation request may take before giving up. */
const REQUEST_TIMEOUT_MS = 20_000;

/* -------------------------------------------------------------------------- */
/* Types                                                                        */
/* -------------------------------------------------------------------------- */

import type { AnswerMap, GradedResult, RubricCriterionId, RubricLevel, RubricVerdict } from './assessment';

export interface AttemptSubmission {
  /** The quiz or exam this attempt belongs to, e.g. `quizzes/ai-fundamentals/…`. */
  assessmentRef: string;
  answers: AnswerMap;
}

export interface PromptEvaluationRequest {
  /** The prompt-assessment page whose rubric applies, or `null` for canonical. */
  assessmentRef?: string;
  promptText: string;
}

export interface PromptJudgment {
  criterion: RubricCriterionId;
  level: RubricLevel;
  /** Required upstream: a level without a reason is an assertion, not feedback. */
  reasoning?: string;
  /** The one change that would move this criterion up a level. */
  improvement?: string;
}

export interface PromptEvaluation {
  total: number;
  verdict: RubricVerdict;
  judgments: PromptJudgment[];
  judged: RubricCriterionId[];
  missing: RubricCriterionId[];
}

/**
 * The three outcomes a caller must distinguish.
 *
 *  `ok`          — a real response arrived.
 *  `unconfigured`— no base URL: nothing was attempted, nothing was scored.
 *  `failed`      — the endpoint was called and did not return a usable result.
 */
export type BoundaryResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'unconfigured' }
  | { kind: 'failed'; reason: string };

/* -------------------------------------------------------------------------- */
/* Internals                                                                    */
/* -------------------------------------------------------------------------- */

/** Thrown for a non-2xx or unparseable body; caught and mapped to `failed`. */
class BoundaryError extends Error {}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Narrow an untrusted payload to a `GradedResult`.
 *
 * Every field is checked because a malformed score from a server is still a
 * score this UI would put in front of a learner. Anything that does not match
 * is a failure, not a zero.
 */
function parseGradedResult(v: unknown): GradedResult | null {
  if (!isRecord(v)) return null;
  const { totalPoints, earnedPoints, percent, passed, passingScore, perQuestion } = v;

  const numOk =
    typeof totalPoints === 'number' && Number.isFinite(totalPoints) &&
    typeof earnedPoints === 'number' && Number.isFinite(earnedPoints) &&
    typeof percent === 'number' && Number.isFinite(percent);
  if (!numOk) return null;
  if (!Array.isArray(perQuestion)) return null;

  const rows = perQuestion.filter(
    (r): r is GradedResult['perQuestion'][number] =>
      isRecord(r) &&
      typeof r['questionId'] === 'string' &&
      typeof r['points'] === 'number' &&
      typeof r['awarded'] === 'number' &&
      (r['correct'] === null || typeof r['correct'] === 'boolean'),
  );

  return {
    totalPoints,
    earnedPoints,
    percent,
    passed: passed === null || passed === undefined ? null : passed === true,
    passingScore:
      typeof passingScore === 'number' && Number.isFinite(passingScore)
        ? passingScore
        : undefined,
    perQuestion: rows,
  };
}

function parseEvaluation(v: unknown): PromptEvaluation | null {
  if (!isRecord(v)) return null;
  if (typeof v['total'] !== 'number' || !Number.isFinite(v['total'])) return null;
  if (!Array.isArray(v['judgments'])) return null;

  const judgments = v['judgments'].filter(
    (j): j is PromptJudgment =>
      isRecord(j) && typeof j['criterion'] === 'string' && typeof j['level'] === 'string',
  );
  const verdict = v['verdict'];
  if (typeof verdict !== 'string') return null;

  return {
    total: v['total'],
    verdict: verdict as RubricVerdict,
    judgments,
    judged: Array.isArray(v['judged'])
      ? (v['judged'].filter((x): x is string => typeof x === 'string') as RubricCriterionId[])
      : judgments.map((j) => j.criterion),
    missing: Array.isArray(v['missing'])
      ? (v['missing'].filter((x): x is string => typeof x === 'string') as RubricCriterionId[])
      : [],
  };
}

async function postJson<T>(url: string, body: unknown, parse: (v: unknown) => T | null): Promise<BoundaryResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 202) return { kind: 'ok', data: null as T };

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BoundaryError(`HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }

    const json: unknown = await res.json();
    const parsed = parse(json);
    if (parsed === null) throw new BoundaryError('response did not match the documented shape');
    return { kind: 'ok', data: parsed };
  } catch (err) {
    const reason =
      err instanceof BoundaryError
        ? err.message
        : err instanceof Error && err.name === 'AbortError'
          ? 'request timed out'
          : 'network error';
    return { kind: 'failed', reason };
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Public calls                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Submit an attempt for server-side grading.
 *
 * On success `data` carries a real result and the caller shows a score. If the
 * endpoint is absent the caller shows "submitted, awaiting results" — which is
 * what this UI actually does today, because `ASSESSMENT_API_BASE_URL` is unset.
 */
export function submitAttempt(submission: AttemptSubmission): Promise<BoundaryResult<GradedResult | null>> {
  if (!ASSESSMENT_API_BASE_URL) {
    return Promise.resolve({ kind: 'unconfigured' });
  }
  return postJson<GradedResult | null>(
    `${ASSESSMENT_API_BASE_URL}/api/attempts`,
    { assessmentRef: submission.assessmentRef, answers: submission.answers },
    (v) => (isRecord(v) && v['status'] === 'submitted' ? null : parseGradedResult(v)),
  );
}

/**
 * Evaluate a submitted engineering prompt against the nine-criterion rubric.
 *
 * Returns `unconfigured` today. That is the honest answer: the scoring model
 * exists, but nothing produces the judgments yet (`scripts/lib/rubric.ts`
 * scores a judgment set and does not read text), so there is no endpoint and
 * this UI reports no score.
 */
export function evaluatePrompt(
  req: PromptEvaluationRequest,
): Promise<BoundaryResult<PromptEvaluation>> {
  if (!ASSESSMENT_API_BASE_URL) {
    return Promise.resolve({ kind: 'unconfigured' });
  }
  return postJson<PromptEvaluation>(
    `${ASSESSMENT_API_BASE_URL}/api/prompts/evaluate`,
    { assessmentRef: req.assessmentRef ?? null, promptText: req.promptText },
    parseEvaluation,
  );
}

/** Exposed so the UI can say *why* it is disabled rather than just being inert. */
export function boundaryConfigured(): boolean {
  return typeof ASSESSMENT_API_BASE_URL === 'string' && ASSESSMENT_API_BASE_URL.length > 0;
}