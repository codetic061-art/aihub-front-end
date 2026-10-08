'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { Check, CircleDot, Clock } from 'lucide-react';

import { Button, Badge } from '@/components/ui/button';
import {
  gradeAttempt,
  isMultiSelect,
  type AnswerMap,
  type AnswerKeyEntry,
  type AssessmentQuestion,
  type AssessmentStatus,
  type GradedResult,
} from '@/lib/assessment';
import { submitAttempt } from '@/lib/assessment-api';
import { cn } from '@/lib/utils';

/**
 * Quiz player.
 *
 * ONE QUESTION AT A TIME, WITH AN HONEST RESULT SCREEN
 *
 * The hard constraint is that this component cannot grade an attempt from its
 * own props. `workers/src/assessments.ts` `stripAnswers()` removes the answer
 * key before a question is served, so the browser never holds the correct
 * options. Three states, and they are kept visually distinct on purpose:
 *
 *   answering — questions come from a real served payload; the learner picks.
 *   graded    — an `answerKey` was supplied, so a real score is computed and
 *               shown, per question, with the key's own points.
 *   submitted — no key. The attempt is recorded and the screen says it is
 *               awaiting results. There is deliberately NO number here: a
 *               percentage with no key behind it is a fabricated score, which
 *               is the one thing this component must never render.
 *
 * `onSubmitted` hands the raw answers to the caller so an authenticated path
 * can persist them; the player never pretends that happened on its own.
 */

export interface QuizPlayerLabels {
  question: string;
  of: string;
  next: string;
  previous: string;
  submit: string;
  retry: string;
  selectAnswer: string;
  results: string;
  awaitingTitle: string;
  awaitingBody: string;
  questionsNotInBuild: string;
  answered: string;
  passingScore: string;
  passed: string;
  notPassed: string;
  score: string;
  points: string;
  submittedOn: string;
}

export interface QuizPlayerProps {
  /** Stable id for the assessment, e.g. `quizzes/ai-fundamentals/…`. */
  assessmentRef: string;
  /** Title shown in the header. */
  title: string;
  /**
   * Served questions, WITHOUT answer keys.
   *
   * Empty is the current reality for a statically generated page, and is
   * handled explicitly: the player then renders the assessment's real
   * frontmatter metadata and says the questions are not in this build rather
   * than rendering a shell that looks playable.
   */
  questions: AssessmentQuestion[];
  /**
   * The answer key, when a caller has one.
   *
   * Supplied by an authenticated / Worker-backed call — never embedded in the
   * page. Omit it and the player records the attempt without scoring it.
   */
  answerKey?: AnswerKeyEntry[];
  /** Percentage needed to pass. `undefined` for a session-scope quiz. */
  passingScore?: number;
  /** Whether the learner may take it again. */
  allowRetry?: boolean;
  /** Question ids declared by the content, for the "not in this build" state. */
  declaredQuestionIds?: string[];
  onSubmitted?: (answers: AnswerMap, status: AssessmentStatus) => void;
  labels: QuizPlayerLabels;
}

type Selection = Record<string, string[]>;

export function QuizPlayer({
  assessmentRef,
  title,
  questions,
  answerKey,
  passingScore,
  allowRetry = false,
  declaredQuestionIds,
  onSubmitted,
  labels,
}: QuizPlayerProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Selection>({});
  const [status, setStatus] = useState<AssessmentStatus>('answering');
  const [result, setResult] = useState<GradedResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const groupId = useId();

  const hasQuestions = questions.length > 0;
  const question = questions[index];
  const answeredCount = questions.filter((q) => (answers[q.id] ?? []).length > 0).length;
  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (q.points ?? 0), 0),
    [questions],
  );

  /** The answer key, or null — the single switch that decides grade vs await. */
  const effectiveKey = useMemo(
    () => (answerKey && answerKey.length > 0 ? answerKey : null),
    [answerKey],
  );

  const select = useCallback(
    (optionId: string) => {
      setAnswers((prev) => {
        const current = prev[question.id] ?? [];
        if (!isMultiSelect(question.type)) return { ...prev, [question.id]: [optionId] };
        return {
          ...prev,
          [question.id]: current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId],
        };
      });
    },
    [question],
  );

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(questions.length - 1, next)));
      // Moving between questions should announce the new one, not the button
      // the learner just pressed.
      requestAnimationFrame(() => headingRef.current?.focus());
    },
    [questions.length],
  );

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    const payload: AnswerMap = answers;

    let graded: GradedResult | null = null;
    if (effectiveKey) {
      graded = gradeAttempt(questions, payload, effectiveKey, passingScore);
    } else {
      // No key: ask the boundary if one exists, and treat "not configured" and
      // "failed" identically — in both cases nothing was graded, so the honest
      // state is the same.
      const res = await submitAttempt({ assessmentRef, answers: payload });
      if (res.kind === 'ok' && res.data) graded = res.data;
    }

    setSubmitting(false);
    if (graded) {
      setResult(graded);
      setStatus('graded');
    } else {
      setResult(null);
      setStatus('submitted');
    }
    onSubmitted?.(payload, graded ? 'graded' : 'submitted');
    requestAnimationFrame(() => headingRef.current?.focus());
  }, [answers, assessmentRef, effectiveKey, onSubmitted, passingScore, questions]);

  const restart = useCallback(() => {
    setAnswers({});
    setIndex(0);
    setResult(null);
    setStatus('answering');
    requestAnimationFrame(() => headingRef.current?.focus());
  }, []);

  /* ------------------------------------------------------------- states --- */

  // No served questions. Say so plainly instead of rendering a dead player.
  if (!hasQuestions) {
    return (
      <section
        aria-labelledby={`${groupId}-heading`}
        className="mt-(--sp-6) rounded-[length:var(--radius-lg)] border border-border bg-card p-(--sp-5)"
      >
        <h2 id={`${groupId}-heading`} className="text-[length:var(--fs-h3)]">
          {title}
        </h2>
        <p className="mt-3 text-[length:var(--fs-body)] text-muted-foreground">
          {labels.questionsNotInBuild}
        </p>

        {/* What the content really declares, kept visible: the learner can see
            the assessment exists and how many questions it has. */}
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
          <div>
            <dt className="font-mono text-[length:var(--fs-caption)] text-muted-foreground">
              {labels.question}
            </dt>
            <dd className="font-mono text-[length:var(--fs-lede)]">
              {declaredQuestionIds?.length ?? 0}
            </dd>
          </div>
          {passingScore !== undefined && (
            <div>
              <dt className="font-mono text-[length:var(--fs-caption)] text-muted-foreground">
                {labels.passingScore}
              </dt>
              <dd className="font-mono text-[length:var(--fs-lede)]">{passingScore}</dd>
            </div>
          )}
        </dl>

        <p className="mt-5 text-[length:var(--fs-small)] text-muted-foreground">
          {labels.awaitingBody}
        </p>
      </section>
    );
  }

  /* --------------------------------------------------------- results ----- */

  if (status === 'graded' && result) {
    return (
      <QuizResult
        title={title}
        result={result}
        allowRetry={allowRetry}
        onRetry={restart}
        headingRef={headingRef}
        labels={labels}
      />
    );
  }

  if (status === 'submitted') {
    return (
      <section
        aria-labelledby={`${groupId}-heading`}
        className="mt-(--sp-6) rounded-[length:var(--radius-lg)] border border-border bg-card p-(--sp-5)"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={`${groupId}-heading`} ref={headingRef} tabIndex={-1}
              className="text-[length:var(--fs-h3)] outline-none">
            {labels.awaitingTitle}
          </h2>
          <Badge tone="outline">{labels.answered}: {answeredCount}</Badge>
        </div>
        <p className="mt-3 max-w-[60ch] text-[length:var(--fs-body)] text-muted-foreground">
          {labels.awaitingBody}
        </p>
        {allowRetry && (
          <div className="mt-5">
            <Button variant="outline" onClick={restart}>{labels.retry}</Button>
          </div>
        )}
      </section>
    );
  }

  /* ------------------------------------------------------- answering ----- */

  const selection = answers[question.id] ?? [];
  const isLast = index === questions.length - 1;

  return (
    <section
      aria-labelledby={`${groupId}-heading`}
      className="mt-(--sp-6) rounded-[length:var(--radius-lg)] border border-border bg-card p-(--sp-5)"
    >
      {/* Progress. `role="progressbar"` because it is a real completion ratio,
          and the textual form stays visible for screen readers. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${groupId}-heading`} className="text-[length:var(--fs-h3)]">
          {title}
        </h2>
        <p className="text-[length:var(--fs-small)] text-muted-foreground">
          {labels.question} {index + 1} {labels.of} {questions.length}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={answeredCount}
        aria-valuetext={`${answeredCount} ${labels.of} ${questions.length}`}
        className="mt-4 h-1.5 w-full overflow-hidden rounded-[length:var(--radius-pill)] bg-[var(--color-bg-secondary)]"
      >
        <div
          className="h-full bg-[var(--color-accent)] transition-[inline-size] duration-[var(--dur-2)] ease-[var(--ease)]"
          style={{
            inlineSize: `${
              questions.length === 0 ? 0 : (answeredCount / questions.length) * 100
            }%`,
          }}
        />
      </div>

      {/* One fieldset per question: a real group with a real legend, so the
          options are announced as belonging together and arrow keys work. */}
      <fieldset className="mt-6 border-0 p-0">
        <legend className="sr-only-focusable">
          {labels.question} {index + 1} {labels.of} {questions.length}
        </legend>

        {question.scenario && (
          <p className="mb-4 border-s-2 border-[var(--color-border-muted)] ps-4 text-[length:var(--fs-body)] text-muted-foreground">
            {question.scenario}
          </p>
        )}

        <h3
          ref={headingRef}
          tabIndex={-1}
          className="max-w-[65ch] text-[length:var(--fs-lede)] font-medium leading-[var(--lh-lede)] outline-none"
        >
          {question.prompt}
        </h3>

        {question.options && question.options.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2" role="radiogroup"
               aria-label={question.prompt}>
            {question.options.map((opt) => {
              const checked = selection.includes(opt.id);
              const multi = isMultiSelect(question.type);
              return (
                <label
                  key={opt.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-[length:var(--radius-md)] border p-3',
                    'transition-colors duration-[var(--dur-1)] ease-[var(--ease)]',
                    checked
                      ? 'border-[var(--color-accent)]'
                      : 'border-[var(--color-border-muted)] hover:border-border',
                  )}
                >
                  <input
                    type={multi ? 'checkbox' : 'radio'}
                    name={`${groupId}-${question.id}`}
                    value={opt.id}
                    checked={checked}
                    onChange={() => select(opt.id)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
                  />
                  <span className="text-[length:var(--fs-body)] leading-[var(--lh-body)]">
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-[length:var(--fs-small)] text-muted-foreground">
            {labels.selectAnswer}
          </p>
        )}
      </fieldset>

      {passingScore !== undefined && (
        <p className="mt-4 text-[length:var(--fs-caption)] text-muted-foreground">
          {labels.passingScore}: {passingScore}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
        >
          {labels.previous}
        </Button>

        {isLast ? (
          <Button
            variant="accent"
            onClick={handleSubmit}
            disabled={submitting || answeredCount < questions.length}
          >
            {labels.submit}
          </Button>
        ) : (
          <Button variant="accent" onClick={() => goTo(index + 1)}>
            {labels.next}
          </Button>
        )}

        {answeredCount < questions.length && (
          <p className="text-[length:var(--fs-caption)] text-muted-foreground">
            {labels.selectAnswer}
          </p>
        )}
      </div>

      {totalPoints > 0 && (
        <p className="mt-4 font-mono text-[length:var(--fs-caption)] text-muted-foreground">
          {totalPoints} {labels.points}
        </p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Result                                                                       */
/* -------------------------------------------------------------------------- */

function QuizResult({
  title,
  result,
  allowRetry,
  onRetry,
  headingRef,
  labels,
}: {
  title: string;
  result: GradedResult;
  allowRetry: boolean;
  onRetry: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  labels: QuizPlayerLabels;
}) {
  return (
    <section
      aria-labelledby="quiz-result-heading"
      className="mt-(--sp-6) rounded-[length:var(--radius-lg)] border border-border bg-card p-(--sp-5)"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="quiz-result-heading" ref={headingRef} tabIndex={-1}
            className="text-[length:var(--fs-h3)] outline-none">
          {labels.results}
        </h2>
        {result.passed !== null && (
          <Badge tone={result.passed ? 'info' : 'outline'}>
            {result.passed ? labels.passed : labels.notPassed}
          </Badge>
        )}
      </div>

      {/* A score is only rendered because a key produced it. */}
      <p className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-[length:var(--fs-display)] leading-none">
          {result.percent}
        </span>
        <span className="text-[length:var(--fs-small)] text-muted-foreground">
          {labels.score} · {result.earnedPoints}/{result.totalPoints} {labels.points}
        </span>
      </p>

      <ul role="list" className="mt-5 flex flex-col gap-2">
        {result.perQuestion.map((row) => (
          <li
            key={row.questionId}
            className="flex items-center gap-2 border-b border-[var(--color-border-muted)] pb-2 text-[length:var(--fs-small)]"
          >
            {row.correct === null ? (
              <CircleDot aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            ) : row.correct ? (
              <Check aria-hidden className="size-4 shrink-0 text-[var(--color-accent)]" />
            ) : (
              <Clock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="font-mono">{row.awarded}/{row.points}</span>
          </li>
        ))}
      </ul>

      {allowRetry && (
        <div className="mt-5">
          <Button variant="outline" onClick={onRetry}>{labels.retry}</Button>
        </div>
      )}
    </section>
  );
}