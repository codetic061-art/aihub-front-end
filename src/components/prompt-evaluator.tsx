'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { AlertTriangle, Plug } from 'lucide-react';

import { Button, Badge } from '@/components/ui/button';
import {
  RUBRIC_CRITERIA,
  levelPoints,
  scoreJudgments,
  type RubricLevel,
} from '@/lib/assessment';
import {
  boundaryConfigured,
  evaluatePrompt,
  type PromptJudgment,
} from '@/lib/assessment-api';
import { cn } from '@/lib/utils';

/**
 * Engineering-prompt evaluator.
 *
 * WHY THERE IS NO SCORE UNDERNEATH THIS FORM
 *
 * `aihub/scripts/lib/rubric.ts` is explicit: it "scores a set of judgments.
 * It does not produce them." The judgment step — reading a learner's prompt and
 * deciding that `task-definition` is `weak` because the scope has no boundary
 * — is the future LLM evaluator and does not exist. `workers/src/index.ts` has no
 * prompt-evaluation route either.
 *
 * So this form calls a real, typed boundary (`lib/assessment-api.ts`) and has
 * three honest outcomes:
 *
 *   unconfigured — no endpoint. Reported as unavailable, in words, up front.
 *   failed      — the endpoint exists and did not answer. Reported as such.
 *   ok          — judgments arrived, and the report below renders them with the
 *                 server's own `total` and `verdict`.
 *
 * What this component never does: infer a level from the text, count keywords,
 * or render a number that no evaluator produced. A heuristic that looks like
 * scoring is the specific failure the backend design warns about.
 *
 * The rubric STRUCTURE below is real and safe to show — nine criteria, canonical
 * weights summing to 100, the level ladder. That is authored data, not a
 * prediction about the learner's prompt.
 */

export interface PromptEvaluatorLabels {
  title: string;
  placeholder: string;
  evaluate: string;
  evaluating: string;
  unavailable: string;
  notConnected: string;
  failed: string;
  retry: string;
  rubric: string;
  total: string;
  missing: string;
  task: string;
  reasoning: string;
  improvement: string;
  verdict: string;
  level: string;
  weight: string;
  yourPrompt: string;
  clear: string;
}

export interface PromptEvaluatorProps {
  /** The prompt-assessment page whose rubric applies, for the report header. */
  assessmentRef?: string;
  /** The real task from the page frontmatter. Shown so the task is visible. */
  task?: string;
  /** Criterion ids this page exercises. Empty → the full canonical nine. */
  rubricCriteria?: string[];
  labels: PromptEvaluatorLabels;
}

/** Localised verdict words; the ids themselves stay the wire contract. */
const VERDICT_TONE: Record<string, 'info' | 'outline' | 'neutral' | 'accent'> = {
  'not-actionable': 'outline',
  'needs-revision': 'outline',
  usable: 'info',
  'production-ready': 'info',
};

export function PromptEvaluator({
  assessmentRef,
  task,
  rubricCriteria = [],
  labels,
}: PromptEvaluatorProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'idle' | 'unconfigured' | 'failed' | 'ok'>('idle');
  const [reason, setReason] = useState<string>('');
  const [report, setReport] = useState<{
    total: number;
    verdict: string;
    judgments: PromptJudgment[];
    missing: string[];
  } | null>(null);
  const fieldId = useId();
  const resultRef = useRef<HTMLDivElement>(null);

  const connected = boundaryConfigured();

  // Prefer the page's own subset; fall back to the canonical nine.
  const shownCriteria = rubricCriteria.length > 0
    ? RUBRIC_CRITERIA.filter((c) => rubricCriteria.includes(c.id))
    : [...RUBRIC_CRITERIA];

  const submit = useCallback(async () => {
    if (text.trim().length === 0) return;
    setBusy(true);
    setState('idle');

    const res = await evaluatePrompt({ assessmentRef, promptText: text });

    if (res.kind === 'unconfigured') {
      setBusy(false);
      setState('unconfigured');
      return;
    }
    if (res.kind === 'failed') {
      setBusy(false);
      setReason(res.reason);
      setState('failed');
      return;
    }

    const data = res.data;
    setBusy(false);
    setState('ok');
    // Trust the server's own arithmetic. The local `scoreJudgments` is a
    // defensive mirror, used only to fill a missing `missing` list.
    const mirror = scoreJudgments(data.judgments as { criterion: string; level: RubricLevel }[]);
    setReport({
      total: data.total,
      verdict: data.verdict,
      judgments: data.judgments,
      missing: data.missing.length > 0 ? data.missing : mirror.missing,
    });
    requestAnimationFrame(() => resultRef.current?.focus());
  }, [assessmentRef, text]);

  return (
    <section
      aria-labelledby="prompt-evaluator-heading"
      className="mt-(--sp-6) rounded-[length:var(--radius-lg)] border border-border bg-card p-(--sp-5)"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="prompt-evaluator-heading" className="text-[length:var(--fs-h3)]">
          {labels.title}
        </h2>
        <Badge tone="outline">{labels.weight}: {shownCriteria.reduce((s, c) => s + c.weight, 0)}</Badge>
      </div>

      {task && (
        <div className="mt-4 border-s-2 border-[var(--color-border-muted)] ps-4">
          <p className="font-mono text-[length:var(--fs-caption)] text-muted-foreground">
            {labels.task}
          </p>
          <p className="mt-1 text-[length:var(--fs-small)] leading-[var(--lh-body)]">{task}</p>
        </div>
      )}

      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={fieldId} className="block font-medium">
          {labels.yourPrompt}
        </label>
        <textarea
          id={fieldId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={labels.placeholder}
          rows={7}
          className={cn(
            'mt-2 w-full resize-y rounded-[length:var(--radius-md)] border border-border bg-transparent p-3',
            'text-[length:var(--fs-body)] leading-[var(--lh-body)]',
            'placeholder:text-muted-foreground',
          )}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="submit" variant="accent" disabled={busy || text.trim().length === 0}>
            {busy ? labels.evaluating : labels.evaluate}
          </Button>
          {text.length > 0 && (
            <Button type="button" variant="ghost" onClick={() => setText('')}>
              {labels.clear}
            </Button>
          )}
        </div>
      </form>

      {/* The unavailable state is a standing disclosure, not an error toast:
          a reader who types a prompt deserves to know before submitting that
          nothing will score it. */}
      {!connected && (
        <p className="mt-5 flex items-start gap-2 border-t border-[var(--color-border-muted)] pt-4 text-[length:var(--fs-small)] text-muted-foreground">
          <Plug aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{labels.notConnected}</span>
        </p>
      )}

      {state === 'unconfigured' && (
        <p
          role="status"
          className="mt-4 flex items-start gap-2 rounded-[length:var(--radius-md)] border border-[var(--color-border-muted)] p-3 text-[length:var(--fs-small)]"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{labels.unavailable}</span>
        </p>
      )}

      {state === 'failed' && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-[length:var(--radius-md)] border border-[var(--color-border-muted)] p-3 text-[length:var(--fs-small)]"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{labels.failed} {reason}</span>
        </p>
      )}

      {state === 'ok' && report && (
        <div ref={resultRef} tabIndex={-1} className="mt-6 outline-none">
          <div className="flex flex-wrap items-baseline gap-3 border-t border-[var(--color-border-muted)] pt-5">
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-[length:var(--fs-display)] leading-none">
                {report.total}
              </span>
              <span className="text-[length:var(--fs-small)] text-muted-foreground">
                {labels.total}
              </span>
            </p>
            <Badge tone={VERDICT_TONE[report.verdict] ?? 'outline'}>
              {labels.verdict}: {report.verdict}
            </Badge>
          </div>

          <h3 className="mt-6 text-[length:var(--fs-small)] font-medium">{labels.rubric}</h3>
          <ul role="list" className="mt-3 flex flex-col gap-3">
            {shownCriteria.map((c) => {
              const judgment = report.judgments.find((j) => j.criterion === c.id);
              const level = judgment?.level;
              return (
                <li
                  key={c.id}
                  className="rounded-[length:var(--radius-md)] border border-[var(--color-border-muted)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[length:var(--fs-small)]">{c.id}</span>
                    <span className="flex items-center gap-2 text-[length:var(--fs-caption)] text-muted-foreground">
                      {level ? (
                        <>
                          <span>
                            {labels.level}: {level}
                          </span>
                          <span className="font-mono">
                            {levelPoints(c.weight, level)}/{c.weight}
                          </span>
                        </>
                      ) : (
                        labels.missing
                      )}
                    </span>
                  </div>
                  {judgment?.reasoning && (
                    <p className="mt-2 text-[length:var(--fs-small)] leading-[var(--lh-body)]">
                      <span className="font-medium">{labels.reasoning}: </span>
                      {judgment.reasoning}
                    </p>
                  )}
                  {judgment?.improvement && (
                    <p className="mt-1 text-[length:var(--fs-small)] leading-[var(--lh-body)] text-muted-foreground">
                      <span className="font-medium">{labels.improvement}: </span>
                      {judgment.improvement}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {report.missing.length > 0 && (
            <p className="mt-4 text-[length:var(--fs-caption)] text-muted-foreground">
              {labels.missing}: {report.missing.join(', ')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}