import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Check,
  CircleSlash,
  Clock,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui/card';
import { Alert, Badge, ProgressRing } from '@/components/ui/feedback';
import { Breadcrumb, DescriptionList } from '@/components/ui/misc';
import { PrintButton } from '@/components/ui/print-button';
import { ReportLetterhead } from '@/components/brand/logo';
import { guardStudent } from '@/lib/auth/guards';
import { getAttemptReview } from '@/lib/exam/engine';
import { isAppError } from '@/lib/errors';
import { cn, formatDateTime, formatDuration, formatPercent } from '@/lib/utils';

export const metadata: Metadata = { title: 'Result' };

export default async function ResultDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ just?: string }>;
}) {
  const user = await guardStudent();
  const { attemptId } = await params;
  const { just } = await searchParams;

  const review = await getAttemptReview(attemptId, user).catch((error) => {
    if (isAppError(error) && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')) {
      notFound();
    }
    throw error;
  });

  const { result, exam, attempt, questions, revealAnswers } = review;

  // A teacher can hold results back. Until they release them the student sees
  // confirmation that the paper was received — and nothing else.
  if (!exam.showResultInstantly) {
    return (
      <div className="mx-auto max-w-lg py-8 text-center">
        <span
          className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
          aria-hidden
        >
          <Check className="size-7" />
        </span>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Your paper was received
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {exam.title} was submitted on{' '}
          {formatDateTime(attempt.submittedAt)}. Your teacher will release the
          result — you will be notified when it is ready.
        </p>
        <Button asChild className="mt-6">
          <Link href="/student/results">Back to my results</Link>
        </Button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <Alert tone="warn" title="This result is still being prepared">
          Refresh in a moment. If it does not appear, tell your teacher.
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print">
        <PageHeader
          breadcrumb={
            <Breadcrumb
              items={[
                { label: 'My results', href: '/student/results' },
                { label: exam.title },
              ]}
            />
          }
          title={exam.title}
          description={`${exam.subject} · ${exam.className}`}
          actions={
            <>
              <Button asChild variant="secondary" size="sm">
                <Link href="/student/results">
                  <ArrowLeft className="size-4" aria-hidden />
                  All results
                </Link>
              </Button>
              <PrintButton />
            </>
          }
        />
      </div>

      {just === '1' ? (
        <Alert
          tone={result.passed ? 'success' : 'info'}
          className="no-print mb-5"
          title={result.passed ? 'Well done' : 'Paper submitted'}
        >
          {result.passed
            ? `You passed with ${formatPercent(result.percentage)}.`
            : `You scored ${formatPercent(result.percentage)}. The pass mark was ${exam.passMark}%. Go over the lesson material and try again if you have another attempt.`}
        </Alert>
      ) : null}

      {/* Printable letterhead */}
      <div className="mb-6 hidden print:block">
        <ReportLetterhead
          title="Examination result"
          subtitle={formatDateTime(result.submittedAt)}
        />
        <p className="mt-3 text-sm">
          <strong>{review.student.fullName}</strong> (@{review.student.username}) ·{' '}
          {exam.className}
        </p>
      </div>

      {/* --- Score card ------------------------------------------------ */}
      <Card className="mb-6 overflow-hidden">
        <div
          className={cn(
            'flex flex-wrap items-center gap-6 p-6 sm:p-8',
            result.passed
              ? 'bg-gradient-to-br from-success-50 to-transparent dark:from-success-700/10'
              : 'bg-gradient-to-br from-danger-50 to-transparent dark:from-danger-700/10',
          )}
        >
          <ProgressRing value={result.percentage} size={104} strokeWidth={8} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={result.passed ? 'success' : 'danger'} dot>
                {result.passed ? 'Passed' : 'Not passed'}
              </Badge>
              <Badge tone="neutral">
                Attempt {attempt.attemptNumber}
              </Badge>
              {attempt.status === 'AUTO_SUBMITTED' ? (
                <Badge tone="warn">Submitted automatically at the deadline</Badge>
              ) : null}
            </div>

            <p className="mt-3 font-display text-4xl font-extrabold tracking-tight text-[var(--text-strong)]">
              {result.score}
              <span className="text-2xl text-[var(--text-muted)]">
                /{result.totalMarks}
              </span>
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {formatPercent(result.percentage)} · Grade{' '}
              <span className="font-bold text-[var(--text-strong)]">
                {result.grade}
              </span>{' '}
              · Pass mark {exam.passMark}%
            </p>
          </div>
        </div>

        <CardContent className="border-t border-[var(--line-soft)]">
          <DescriptionList
            columns={3}
            items={[
              {
                term: 'Correct',
                description: (
                  <span className="inline-flex items-center gap-1.5 text-success-700 dark:text-success-500">
                    <Check className="size-4" aria-hidden />
                    {result.correctCount}
                  </span>
                ),
              },
              {
                term: 'Wrong',
                description: (
                  <span className="inline-flex items-center gap-1.5 text-danger-600 dark:text-danger-500">
                    <X className="size-4" aria-hidden />
                    {result.incorrectCount}
                  </span>
                ),
              },
              {
                term: 'Not answered',
                description: (
                  <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
                    <CircleSlash className="size-4" aria-hidden />
                    {result.unansweredCount}
                  </span>
                ),
              },
              {
                term: 'Questions answered',
                description: `${result.answeredCount} of ${questions.length}`,
              },
              {
                term: 'Time taken',
                description: (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" aria-hidden />
                    {formatDuration(result.durationSeconds)}
                  </span>
                ),
              },
              {
                term: 'Submitted',
                description: formatDateTime(result.submittedAt),
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* --- Question review ------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">
            {revealAnswers ? 'Question by question' : 'Your answers'}
          </CardTitle>
          <Badge tone="neutral">
            <Award className="size-3" aria-hidden />
            {questions.length} questions
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {!revealAnswers ? (
            <div className="border-b border-[var(--line-soft)] px-5 py-3">
              <p className="text-sm text-[var(--text-muted)]">
                Your teacher has kept the correct answers hidden for this paper.
                You can still see which questions you got right.
              </p>
            </div>
          ) : null}

          <ol className="divide-y divide-[var(--line-soft)]">
            {questions.map((question) => (
              <li key={question.id} className="p-5">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold',
                      question.isCorrect === true
                        ? 'bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-500'
                        : question.selectedOptionId
                          ? 'bg-danger-50 text-danger-700 dark:bg-danger-700/20 dark:text-danger-500'
                          : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
                    )}
                    aria-hidden
                  >
                    {question.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-relaxed text-[var(--text-strong)]">
                      {question.text}
                    </p>

                    <ul className="mt-3 space-y-1.5">
                      {question.options.map((option) => {
                        const chosen = option.id === question.selectedOptionId;
                        const correct = revealAnswers && option.isCorrect === true;

                        return (
                          <li
                            key={option.id}
                            className={cn(
                              'flex items-start gap-2.5 rounded-[var(--radius-field)] border px-3 py-2 text-sm',
                              correct
                                ? 'border-success-500/40 bg-success-50 dark:bg-success-700/10'
                                : chosen
                                  ? 'border-danger-500/40 bg-danger-50 dark:bg-danger-700/10'
                                  : 'border-[var(--line-soft)]',
                            )}
                          >
                            <span
                              className="mt-px w-4 shrink-0 text-xs font-bold text-[var(--text-muted)]"
                              aria-hidden
                            >
                              {option.label}
                            </span>
                            <span className="min-w-0 flex-1 text-[var(--text-body)]">
                              {option.text}
                            </span>
                            {chosen ? (
                              <Badge
                                tone={
                                  question.isCorrect ? 'success' : 'danger'
                                }
                                className="shrink-0"
                              >
                                Your answer
                              </Badge>
                            ) : null}
                            {correct && !chosen ? (
                              <Badge tone="success" className="shrink-0">
                                Correct
                              </Badge>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>

                    {!question.selectedOptionId ? (
                      <p className="mt-2 text-xs font-medium text-warn-600 dark:text-warn-500">
                        You did not answer this question.
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
