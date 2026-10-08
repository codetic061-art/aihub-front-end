'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CircleDot, Clock } from 'lucide-react';

import { Button, Badge } from '@/components/ui/button';
import {
  gradeAttempt,
  isMultiSelect,
  type AnswerKeyEntry,
  type AssessmentQuestion,
  type AssessmentStatus,
  type AnswerMap,
  type GradedResult,
} from '@/lib/assessment';
import { submitAttempt } from '@/lib/assessment-api';
import { cn } from '@/lib/utils';

/**
 * Exam player — timed, multi-question, with a question navigator.
 *
 * DIFFERENT FROM THE QUIZ PLAYER, AND WHY
 *
 * An exam is a different contract, not a bigger quiz: it declares
 * `time_limit_minutes`, `max_attempts` and a `passing_score`, and the content
 * states there is no partial credit inside a question. So this component shows
 * all questions on one page with a navigator, counts down, auto-submits at zero,
 * and never pretends to track attempts (there is no attempt ledger to track
 * them in — `max_attempts` is displayed, not enforced, and the UI says so).
 *
 * THE SAME HONESTY RULE APPLIES
 *
 * `stripAnswers()` removes the key before questions are served, so with no
 * `answerKey` this component records the attempt and reports "awaiting results"
 * with NO percentage. Same three states as the quiz player, and the same rule:
 * a number appears only when a key produced it.
 *
 * The timer is presentation only. It is monotonic-clock derived (not a naive
 * `setInterval` count) so a backgrounded tab does not lose time, and it stops
 * permanently once the attempt is submitted — it cannot re-arm and re-fire.
 */

export interface ExamPlayerLabels {
  question: string;
  of: string;
  submit: string;
  retry: string;
  results: string;
  selectAnswer: string;
  awaitingTitle: string;
  awaitingBody: string;
  questionsNotInBuild: string;
  passed: string;
  notPassed: string;
  score: string;
  points: string;
  passingScore: string;
  timeLeft: string;
  minutes: string;
  timeUp: string;
  submitAnyway: string;
  autoSubmitted: string;
  navigator: string;
  answered: string;
  attemptsNotice: string;
  maxAttempts: string;
  certificate: string;
}

export interface ExamPlayerProps {
  assessmentRef: string;
  title: string;
  /** Served questions, WITHOUT answer keys. */
  questions: AssessmentQuestion[];
  answerKey?: AnswerKeyEntry[];
  passingScore?: number;
  /** Declared attempt cap. Displayed; not enforceable without an attempt store. */
  maxAttempts?: number;
  /** Declared time limit in minutes. Absent → no timer is shown at all. */
  timeLimitMinutes?: number;
  /** Certificate title, when the exam awards one. */
  certificateTitle?: string;
  declaredQuestionIds?: string[];
  onSubmitted?: (answers: AnswerMap, status: AssessmentStatus) => void;
  labels: ExamPlayerLabels;
}

type Selection = Record<string, string[]>;

/** Seconds remaining, formatted mm:ss. Deterministic, no locale surprises. */
function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function ExamPlayer({
  assessmentRef,
  title,
  questions,
  answerKey,
  passingScore,
  maxAttempts,
  timeLimitMinutes,
  certificateTitle,
  declaredQuestionIds,
  onSubmitted,
  labels,
}: ExamPlayerProps) {
  const [answers, setAnswers] = useState<Selection>({});
  const [status, setStatus] = useState<AssessmentStatus>('answering');
  const [result, setResult] = useState<GradedResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  const hasQuestions = questions.length > 0;
  const answeredCount = questions.filter((q) => (answers[q.id] ?? []).length > 0).length;
  const allAnswered = hasQuestions && answeredCount === questions.length;

  const effectiveKey = useMemo(
    () => (answerKey && answerKey.length > 0 ? answerKey : null),
    [answerKey],
  );

  /* ---------------------------------------------------------------- timer -- */

  const limitSeconds = timeLimitMinutes === undefined ? null : timeLimitMinutes * 60;
  // Deadline rather than a decrementing counter: a throttled or backgrounded
  // tab still expires at the right wall-clock moment.
  const [remaining, setRemaining] = useState<number | null>(limitSeconds);
  const deadlineRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const finalise = useCallback(
    async (reason: 'manual' | 'timeout') => {
      // The ref guard is what makes auto-submit and the button idempotent: two
      // calls in the same tick cannot both grade.
      if (submittedRef.current) return;
      submittedRef.current = true;

      const payload: AnswerMap = answers;
      setSubmitting(true);

      let graded: GradedResult | null = null;
      if (effectiveKey) {
        graded = gradeAttempt(questions, payload, effectiveKey, passingScore);
      } else {
        const res = await submitAttempt({ assessmentRef, answers: payload });
        if (res.kind === 'ok' && res.data) graded = res.data;
      }

      setSubmitting(false);
      if (reason === 'timeout') setAutoSubmitted(true);
      if (graded) {
        setResult(graded);
        setStatus('graded');
      } else {
        setResult(null);
        setStatus('submitted');
      }
      onSubmitted?.(payload, graded ? 'graded' : 'submitted');
      requestAnimationFrame(() => headingRef.current?.focus());
    },
    [answers, assessmentRef, effectiveKey, onSubmitted, passingScore, questions],
  );

  useEffect(() => {
    if (status !== 'answering' || limitSeconds === null) return;
    deadlineRef.current = Date.now() + limitSeconds * 1000;

    const tick = () => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) void finalise('timeout');
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [finalise, limitSeconds, status]);

  const restart = useCallback(() => {
    submittedRef.current = false;
    setAnswers({});
    setResult(null);
    setStatus('answering');
    setAutoSubmitted(false);
    setRemaining(limitSeconds);
    requestAnimationFrame(() => headingRef.current?.focus());
  }, [limitSeconds]);

  const toggle = useCallback((questionId: string, optionId: string, multi: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (!multi) return { ...prev, [questionId]: [optionId] };
      return {
        ...prev,
        [questionId]: current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      };
    });
  }, []);

  /* ------------------------------------------------------------- states --- */

  if (!hasQuestions) {
    return (
      <section
        aria-labelledby="exam-heading"
        className="mt-(--sp-6) rounded-[length:var(--radius-lg)] border border-border bg-card p-(--sp-5)"
      >
        <h2 id="exam-heading" className="text-[length:var(--fs-h3)]">{title}</h2>
        <p className="mt-3 text-[length:var(--fs-body)] text-muted-foreground">
          {labels.questionsNotInBuild}
        </p>

        {/* The rules the content really declares stay visible even though the
            questions cannot be served: a learner reading the exam page still
            needs to know it is 45 minutes, out of 100, passing at 70. */}
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {timeLimitMinutes !== undefined && (
            <div className="border-s-2 border-[var(--color-border-muted)] ps-3">
              <dt className="font-mono text-[length:var(--fs-caption)] text-muted-foreground">
                {labels.timeLeft}
              </dt>
              {/* The declared limit is in MINUTES. Printing "45:00" would read
                  as a clock, which is what the running timer shows — two
                  different things sharing one format. */}
              <dd className="font-mono text-[length:var(--fs-lede)]">
                {timeLimitMinutes} {labels.minutes}
              </dd>
            </div>
          )}
          {passingScore !== undefined && (
            <div className="border-s-2 border-[var(--color-border-muted)] ps-3">
              <dt className="font-mono text-[length:var(--fs-caption)] text-muted-foreground">
                {labels.passingScore}
              </dt>
              <dd className="font-mono text-[length:var(--fs-lede)]">{passingScore}</dd>
            </div>
          )}
          {maxAttempts !== undefined && (
            <div className="border-s-2 border-[var(--color-border-muted)] ps-3">
              <dt className="font-mono text-[length:var(--fs-caption)] text-muted-foreground">
                {labels.maxAttempts}
              </dt>
              <dd className="font-mono text-[length:var(--fs-lede)]">{maxAttempts}</dd>
            </div>
          )}
          <div className="border-s-2 border-[var(--color-border-muted)] ps-3">
            <dt className="font-mono text-[length:var(--fs-caption)] text-muted-foreground">
              {labels.question}
            </dt>
            <dd className="font-mono text-[length:var(--fs-lede)]">
              {declaredQuestionIds?.length ?? 0}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-[length:var(--fs-small)] text-muted-foreground">
          {labels.awaitingBody}
        </p>
        {maxAttempts !== undefined && (
          <p className="mt-2 text-[length:var(--fs-caption)] text-muted-foreground">
            {labels.attemptsNotice}
          </p>
        )}
      </section>
    );
  }

  if (status === 'graded' && result) {
    return (
      <ExamResult
        title={title}
        result={result}
        certificateTitle={certificateTitle}
        onRetry={restart}
        headingRef={headingRef}
        labels={labels}
      />
    );
  }

  if (status === 'submitted') {
    return (
      <section
        aria-labelledby="exam-heading"
        className="mt-(--sp-6) rounded-[length:var(--radius-lg)] border border-border bg-card p-(--sp-5)"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="exam-heading" ref={headingRef} tabIndex={-1}
              className="text-[length:var(--fs-h3)] outline-none">
            {labels.awaitingTitle}
          </h2>
          <Badge tone="outline">{labels.answered}: {answeredCount}</Badge>
        </div>
        {autoSubmitted && (
          <p className="mt-3 flex items-center gap-2 text-[length:var(--fs-small)] text-muted-foreground">
            <AlertTriangle aria-hidden className="size-4 shrink-0" />
            {labels.autoSubmitted}
          </p>
        )}
        <p className="mt-3 max-w-[60ch] text-[length:var(--fs-body)] text-muted-foreground">
          {labels.awaitingBody}
        </p>
      </section>
    );
  }

  /* ----------------------------------------------------------- answering -- */

  const timeIsLow = remaining !== null && remaining <= 60;

  return (
    <section aria-labelledby="exam-heading"
             className="mt-(--sp-6) rounded-[length:var(--radius-lg)] border border-border bg-card p-(--sp-5)">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="exam-heading" className="text-[length:var(--fs-h3)]">{title}</h2>
        {remaining !== null && (
          // `role="timer"` so it is announced rather than silently counting.
          <p
            role="timer"
            aria-live="off"
            className={cn(
              'inline-flex items-center gap-2 font-mono text-[length:var(--fs-lede)]',
              timeIsLow ? 'text-[var(--color-accent-2)]' : 'text-muted-foreground',
            )}
          >
            <Clock aria-hidden className="size-4" />
            {formatClock(remaining)}
          </p>
        )}
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
            inlineSize: `${(answeredCount / questions.length) * 100}%`,
          }}
        />
      </div>

      {/* Navigator: every question at once, so its answered state is visible. */}
      <nav aria-label={labels.navigator} className="mt-5">
        <ol role="list" className="flex flex-wrap gap-2">
          {questions.map((q, i) => {
            const isAnswered = (answers[q.id] ?? []).length > 0;
            return (
              <li key={q.id}>
                <a
                  href={`#exam-q-${q.id}`}
                  aria-current={isAnswered ? undefined : 'location'}
                  className={cn(
                    'inline-flex size-8 items-center justify-center rounded-[length:var(--radius-sm)] border font-mono text-[length:var(--fs-caption)]',
                    isAnswered
                      ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border-muted)] text-muted-foreground',
                  )}
                >
                  {i + 1}
                  {isAnswered && <span className="sr-only-focusable">✓</span>}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      <ol role="list" className="mt-6 flex flex-col gap-(--sp-6)">
        {questions.map((q, i) => {
          const selection = answers[q.id] ?? [];
          const multi = isMultiSelect(q.type);
          return (
            <li key={q.id} id={`exam-q-${q.id}`} className="scroll-mt-24">
              <fieldset className="border-0 p-0">
                <legend className="sr-only-focusable">
                  {labels.question} {i + 1} {labels.of} {questions.length}
                </legend>
                <p className="font-mono text-[length:var(--fs-caption)] text-muted-foreground">
                  {labels.question} {i + 1}
                </p>
                {q.scenario && (
                  <p className="mt-2 border-s-2 border-[var(--color-border-muted)] ps-4 text-[length:var(--fs-body)] text-muted-foreground">
                    {q.scenario}
                  </p>
                )}
                <p className="mt-1 max-w-[65ch] text-[length:var(--fs-lede)] font-medium leading-[var(--lh-lede)]">
                  {q.prompt}
                </p>
                {q.options && q.options.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {q.options.map((opt) => {
                      const checked = selection.includes(opt.id);
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
                            name={`exam-${q.id}`}
                            value={opt.id}
                            checked={checked}
                            onChange={() => toggle(q.id, opt.id, multi)}
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
                  <p className="mt-3 text-[length:var(--fs-small)] text-muted-foreground">
                    {labels.selectAnswer}
                  </p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="mt-(--sp-6) flex flex-wrap items-center gap-3 border-t border-[var(--color-border-muted)] pt-5">
        <Button
          variant="accent"
          onClick={() => void finalise('manual')}
          disabled={submitting || (!allAnswered && remaining === null)}
        >
          {remaining !== null && !allAnswered ? labels.submitAnyway : labels.submit}
        </Button>
        <p className="text-[length:var(--fs-small)] text-muted-foreground">
          {labels.answered}: {answeredCount} {labels.of} {questions.length}
        </p>
      </div>

      {maxAttempts !== undefined && (
        <p className="mt-4 text-[length:var(--fs-caption)] text-muted-foreground">
          {labels.maxAttempts}: {maxAttempts} · {labels.attemptsNotice}
        </p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function ExamResult({
  title,
  result,
  certificateTitle,
  onRetry,
  headingRef,
  labels,
}: {
  title: string;
  result: GradedResult;
  certificateTitle?: string;
  onRetry: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  labels: ExamPlayerLabels;
}) {
  const canCertify = result.passed === true && certificateTitle !== undefined;
  return (
    <section aria-labelledby="exam-result-heading"
             className="mt-(--sp-6) rounded-[length:var(--radius-lg)] border border-border bg-card p-(--sp-5)">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="exam-result-heading" ref={headingRef} tabIndex={-1}
            className="text-[length:var(--fs-h3)] outline-none">
          {labels.results}
        </h2>
        {result.passed !== null && (
          <Badge tone={result.passed ? 'info' : 'outline'}>
            {result.passed ? labels.passed : labels.notPassed}
          </Badge>
        )}
      </div>

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
          <li key={row.questionId}
              className="flex items-center gap-2 border-b border-[var(--color-border-muted)] pb-2 text-[length:var(--fs-small)]">
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

      {result.passingScore !== undefined && (
        <p className="mt-4 text-[length:var(--fs-caption)] text-muted-foreground">
          {labels.passingScore}: {result.passingScore}
        </p>
      )}

      {canCertify && (
        <p className="mt-4 border-s-2 border-[var(--color-accent)] ps-4 text-[length:var(--fs-small)]">
          {labels.certificate}: {certificateTitle}
        </p>
      )}

      <div className="mt-5">
        <Button variant="outline" onClick={onRetry}>{labels.retry}</Button>
      </div>
    </section>
  );
}