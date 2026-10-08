'use client';

import { useTranslations } from 'next-intl';

import { QuizPlayer, type QuizPlayerLabels } from '@/components/quiz-player';
import { ExamPlayer, type ExamPlayerLabels } from '@/components/exam-player';
import { PromptEvaluator } from '@/components/prompt-evaluator';
import { ProgressPanel } from '@/components/progress-panel';
import type { AssessmentQuestion, AnswerKeyEntry } from '@/lib/assessment';
import type { Locale } from '@/lib/data';

/**
 * Localisation wiring for the interactive layer. Pure string plumbing.
 *
 * WHY THIS FILE PASSES NO `Page` OBJECT
 *
 * These wrappers are Client Components. Passing `page` — or anything that
 * closes over `page.frontmatter` — makes Next serialize the WHOLE frontmatter
 * into the RSC payload embedded in the HTML. On a quiz page that frontmatter
 * contains `answer.correct` plus every distractor's `reason_wrong`, so the
 * answer key would ship to the browser and be readable in the network tab:
 * precisely what `workers/src/assessments.ts` exists to prevent.
 *
 * That leak was real. It was caught by grepping the served HTML for
 * `reason_wrong` and `\\"correct\\"`, which is worth remembering as a habit:
 * "I stripped the keys before rendering" is not the same claim as "the keys are
 * not in the document", and only the second one matters.
 *
 * So the boundary is structural rather than careful: the Server Component reads
 * the frontmatter and passes only the scalars the client needs — a title, a ref,
 * a number, and the already-stripped question list. Nothing else crosses, so
 * there is nothing to leak. Adding a `page` prop here would silently reopen it.
 *
 * The players stay pure: they take their strings as props and never call
 * `useTranslations`, which is what makes them trivially testable.
 */

export interface QuizPlayerIslandProps {
  /** Stable assessment ref, e.g. `quizzes/ai-fundamentals/…`. */
  assessmentRef: string;
  title: string;
  /** Served questions, already stripped of every answer key. */
  questions: AssessmentQuestion[];
  /** Supplied only by an authenticated / Worker-backed grading call. */
  answerKey?: AnswerKeyEntry[];
  passingScore?: number;
  allowRetry?: boolean;
  /** Question ids from the snapshot, for the "not in this build" state. */
  declaredQuestionIds: string[];
}

export function QuizPlayerIsland({
  assessmentRef,
  title,
  questions = [],
  answerKey,
  passingScore,
  allowRetry,
  declaredQuestionIds,
}: QuizPlayerIslandProps) {
  const t = useTranslations('assessment');

  const labels: QuizPlayerLabels = {
    question: t('question'),
    of: t('of'),
    next: t('next'),
    previous: t('previous'),
    submit: t('submit'),
    retry: t('retry'),
    selectAnswer: t('selectAnswer'),
    results: t('results'),
    awaitingTitle: t('awaitingTitle'),
    awaitingBody: t('awaitingBody'),
    questionsNotInBuild: t('questionsNotInBuild'),
    answered: t('answered'),
    passingScore: t('passedScore'),
    passed: t('passed'),
    notPassed: t('notPassed'),
    score: t('score'),
    points: t('points'),
    submittedOn: t('answered'),
  };

  return (
    <QuizPlayer
      assessmentRef={assessmentRef}
      title={title}
      questions={questions}
      answerKey={answerKey}
      passingScore={passingScore}
      allowRetry={allowRetry}
      declaredQuestionIds={declaredQuestionIds}
      labels={labels}
    />
  );
}

export interface ExamPlayerIslandProps {
  assessmentRef: string;
  title: string;
  questions: AssessmentQuestion[];
  answerKey?: AnswerKeyEntry[];
  passingScore?: number;
  maxAttempts?: number;
  timeLimitMinutes?: number;
  certificateTitle?: string;
  declaredQuestionIds: string[];
}

export function ExamPlayerIsland({
  assessmentRef,
  title,
  questions,
  answerKey,
  passingScore,
  maxAttempts,
  timeLimitMinutes,
  certificateTitle,
  declaredQuestionIds,
}: ExamPlayerIslandProps) {
  const t = useTranslations('assessment');
  const tc = useTranslations('common');

  const labels: ExamPlayerLabels = {
    question: t('question'),
    of: t('of'),
    submit: t('submit'),
    retry: t('retry'),
    results: t('results'),
    selectAnswer: t('selectAnswer'),
    awaitingTitle: t('awaitingTitle'),
    awaitingBody: t('awaitingBody'),
    questionsNotInBuild: t('questionsNotInBuild'),
    passed: t('passed'),
    notPassed: t('notPassed'),
    score: t('score'),
    points: t('points'),
    passingScore: t('passedScore'),
    timeLeft: t('timeLeft'),
    minutes: tc('minutes'),
    timeUp: t('timeUp'),
    submitAnyway: t('submitAnyway'),
    autoSubmitted: t('autoSubmitted'),
    navigator: t('navigator'),
    answered: t('answered'),
    attemptsNotice: t('attemptsNotice'),
    maxAttempts: t('maxAttempts'),
    certificate: t('certificate'),
  };

  return (
    <ExamPlayer
      assessmentRef={assessmentRef}
      title={title}
      questions={questions}
      answerKey={answerKey}
      passingScore={passingScore}
      maxAttempts={maxAttempts}
      timeLimitMinutes={timeLimitMinutes}
      certificateTitle={certificateTitle}
      declaredQuestionIds={declaredQuestionIds}
      labels={labels}
    />
  );
}

export interface PromptEvaluatorIslandProps {
  assessmentRef: string;
  /** The real task from the page frontmatter, shown above the textarea. */
  task?: string;
  /** Criterion ids the page exercises. Empty → the full canonical nine. */
  rubricCriteria: string[];
}

export function PromptEvaluatorIsland({
  assessmentRef,
  task,
  rubricCriteria,
}: PromptEvaluatorIslandProps) {
  const t = useTranslations('assessment');
  const tp = useTranslations('prompt');

  return (
    <PromptEvaluator
      assessmentRef={assessmentRef}
      task={task}
      rubricCriteria={rubricCriteria}
      labels={{
        title: tp('title'),
        placeholder: tp('placeholder'),
        evaluate: tp('evaluate'),
        evaluating: tp('evaluating'),
        unavailable: tp('unavailable'),
        notConnected: t('notConnected'),
        failed: t('failed'),
        retry: t('retry'),
        rubric: tp('rubric'),
        total: tp('total'),
        missing: t('missing'),
        task: t('task'),
        reasoning: t('reasoning'),
        improvement: t('improvement'),
        verdict: t('verdict'),
        level: t('level'),
        weight: t('weight'),
        yourPrompt: t('yourPrompt'),
        clear: t('clear'),
      }}
    />
  );
}

export interface ProgressPanelIslandProps {
  locale: Locale;
  courses: { ref: string; title: string }[];
  interactive?: boolean;
}

export function ProgressPanelIsland({
  locale,
  courses,
  interactive = true,
}: ProgressPanelIslandProps) {
  const t = useTranslations('assessment');
  return (
    <ProgressPanel
      locale={locale}
      courses={courses}
      interactive={interactive}
      labels={{
        title: t('progressTitle'),
        sessionsCompleted: t('sessionsCompleted'),
        of: t('of'),
        remaining: t('remaining'),
        noneLeft: t('noneLeft'),
        markDone: t('markDone'),
        markNotDone: t('markNotDone'),
        localOnly: t('localOnly'),
        localOnlyBody: t('localOnlyBody'),
        reset: t('reset'),
        resetNotice: t('resetNotice'),
        noCourses: t('noCourses'),
      }}
    />
  );
}