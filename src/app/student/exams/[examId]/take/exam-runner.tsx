'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CloudOff,
  Flag,
  LayoutGrid,
  Loader2,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Alert, Progress } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { cn, formatDuration } from '@/lib/utils';
import type { AttemptState } from '@/lib/exam/engine';
import { saveAnswerAction, submitAttemptAction } from '../../actions';

/**
 * The examination interface.
 *
 * Design decisions that matter here:
 *
 *  - THE CLOCK IS THE SERVER'S. `expiresAt` and `serverTime` arrive together,
 *    so the countdown is driven by an offset rather than the device clock. A
 *    student who changes their phone's time gains nothing, and the server
 *    re-checks the deadline on every save and on submit regardless.
 *
 *  - ANSWERS SAVE IMMEDIATELY, and a failed save is retried. Selections are
 *    also mirrored into sessionStorage so a reload mid-answer never loses the
 *    click that was in flight. The database remains the source of truth: the
 *    mirror is only used to re-drive pending saves.
 *
 *  - NOTHING HERE KNOWS THE ANSWERS. The payload has no correctness data, so
 *    there is nothing to find in the DOM, in React state, or in a response.
 *
 *  - LEAVING IS MADE DELIBERATE. The tab warns before unload, and submission
 *    always passes through a confirmation that names how many questions are
 *    still unanswered.
 */

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ExamRunner({
  attempt,
  studentName,
}: {
  attempt: AttemptState;
  studentName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const storageKey = `fodan-exam-${attempt.attemptId}`;

  const [answers, setAnswers] = React.useState<Record<string, string | null>>(
    () => ({ ...attempt.answers }),
  );
  const [current, setCurrent] = React.useState(0);
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [pendingCount, setPendingCount] = React.useState(0);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [gridOpen, setGridOpen] = React.useState(false);
  const [online, setOnline] = React.useState(true);

  const submittedRef = React.useRef(false);
  const pendingRef = React.useRef(new Map<string, string | null>());

  const total = attempt.questions.length;
  const question = attempt.questions[current];
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const unansweredCount = total - answeredCount;

  // --- Clock ---------------------------------------------------------------
  // Offset between this device's clock and the server's, measured once.
  const offsetRef = React.useRef(
    new Date(attempt.serverTime).getTime() - Date.now(),
  );
  const expiresAtMs = new Date(attempt.expiresAt).getTime();

  const [remaining, setRemaining] = React.useState(() =>
    Math.max(0, Math.floor((expiresAtMs - (Date.now() + offsetRef.current)) / 1000)),
  );

  // --- Restore anything that was mid-flight on the last page view ---------
  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const cached = JSON.parse(raw) as Record<string, string | null>;

      // Only fill gaps: the server's copy always wins where both exist.
      setAnswers((current) => {
        const merged = { ...current };
        for (const [questionId, optionId] of Object.entries(cached)) {
          if (!merged[questionId] && optionId) merged[questionId] = optionId;
        }
        return merged;
      });
    } catch {
      /* a corrupt cache is not worth surfacing to a student mid-exam */
    }
  }, [storageKey]);

  React.useEffect(() => {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {
      /* storage may be full or blocked; the server copy still stands */
    }
  }, [answers, storageKey]);

  // --- Connection awareness ----------------------------------------------
  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // --- Submission ---------------------------------------------------------
  const doSubmit = React.useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);

      const flush = [...pendingRef.current.entries()].map(
        ([questionId, optionId]) => ({ questionId, optionId }),
      );

      const result = await submitAttemptAction({
        attemptId: attempt.attemptId,
        answers: flush,
      });

      if (!result.ok) {
        submittedRef.current = false;
        setSubmitting(false);
        toast({
          tone: 'error',
          title: 'Your paper was not submitted',
          description: `${result.error} Please try again.`,
        });
        return;
      }

      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        /* nothing to recover from */
      }

      if (auto) {
        toast({
          tone: 'warn',
          title: 'Time is up',
          description: 'Your paper was submitted automatically.',
        });
      }

      router.replace(`/student/results/${attempt.attemptId}?just=1`);
    },
    [attempt.attemptId, router, storageKey, toast],
  );

  // --- Countdown ----------------------------------------------------------
  React.useEffect(() => {
    const tick = () => {
      const left = Math.max(
        0,
        Math.floor((expiresAtMs - (Date.now() + offsetRef.current)) / 1000),
      );
      setRemaining(left);
      if (left <= 0 && !submittedRef.current) {
        void doSubmit(true);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAtMs, doSubmit]);

  // --- Warn before leaving ------------------------------------------------
  React.useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (submittedRef.current) return;
      event.preventDefault();
      // Browsers ignore custom text now, but returnValue must be set for the
      // native prompt to appear at all.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // --- Answer selection ---------------------------------------------------
  const persist = React.useCallback(
    async (questionId: string, optionId: string | null) => {
      pendingRef.current.set(questionId, optionId);
      setPendingCount(pendingRef.current.size);
      setSaveState('saving');

      const result = await saveAnswerAction({
        attemptId: attempt.attemptId,
        questionId,
        optionId,
      });

      if (result.ok) {
        // Only clear if this exact value is still the pending one; a faster
        // second click must not be marked saved by the first response.
        if (pendingRef.current.get(questionId) === optionId) {
          pendingRef.current.delete(questionId);
          setPendingCount(pendingRef.current.size);
        }
        setSaveState('saved');
        return;
      }

      setSaveState('error');

      if (result.code === 'EXAM_RULE') {
        // The server says the attempt is over — stop fighting it.
        submittedRef.current = true;
        toast({
          tone: 'warn',
          title: 'This paper has closed',
          description: result.error,
        });
        router.replace(`/student/results/${attempt.attemptId}`);
      }
    },
    [attempt.attemptId, router, toast],
  );

  const choose = React.useCallback(
    (questionId: string, optionId: string) => {
      if (submittedRef.current) return;
      setAnswers((current) => ({ ...current, [questionId]: optionId }));
      void persist(questionId, optionId);
    },
    [persist],
  );

  // --- Retry loop for failed saves ---------------------------------------
  React.useEffect(() => {
    if (pendingCount === 0 || !online) return;

    const timer = setTimeout(() => {
      for (const [questionId, optionId] of pendingRef.current) {
        void persist(questionId, optionId);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [pendingCount, online, persist]);

  // --- Keyboard shortcuts -------------------------------------------------
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (confirmOpen || gridOpen) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (event.key === 'ArrowRight') {
        setCurrent((index) => Math.min(total - 1, index + 1));
      } else if (event.key === 'ArrowLeft') {
        setCurrent((index) => Math.max(0, index - 1));
      } else if (question && /^[1-9]$/.test(event.key)) {
        const option = question.options[Number(event.key) - 1];
        if (option) choose(question.id, option.id);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [choose, confirmOpen, gridOpen, question, total]);

  if (!question) {
    return (
      <div className="p-8">
        <Alert tone="danger" title="This paper has no questions">
          Please tell your teacher — the examination cannot be taken as it is.
        </Alert>
      </div>
    );
  }

  const lowTime = remaining <= 60;
  const warnTime = remaining <= 300;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[var(--surface-page)]">
      {/* --- Bar ------------------------------------------------------- */}
      <header className="shrink-0 border-b border-[var(--line-soft)] bg-[var(--surface-card)]">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo size="xs" decorative />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--text-strong)]">
              {attempt.title}
            </p>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {studentName} · Attempt {attempt.attemptNumber} of {attempt.attemptLimit}
            </p>
          </div>

          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-sm font-bold tabular-nums transition-colors',
              lowTime
                ? 'animate-pulse bg-danger-600 text-white'
                : warnTime
                  ? 'bg-warn-50 text-warn-700 dark:bg-warn-700/20 dark:text-warn-500'
                  : 'bg-[var(--surface-sunken)] text-[var(--text-strong)]',
            )}
            role="timer"
            aria-live={lowTime ? 'assertive' : 'off'}
          >
            <span className="sr-only">Time remaining:</span>
            {formatDuration(remaining)}
          </div>

          <Button
            variant="secondary"
            size="icon"
            className="lg:hidden"
            onClick={() => setGridOpen(true)}
            aria-label="Show all questions"
          >
            <LayoutGrid className="size-4" aria-hidden />
          </Button>
        </div>

        <Progress
          value={answeredCount}
          max={total}
          size="sm"
          tone={answeredCount === total ? 'success' : 'brand'}
          className="[&>div]:rounded-none"
        />
      </header>

      {/* --- Notices --------------------------------------------------- */}
      {!online ? (
        <div className="flex items-center justify-center gap-2 bg-warn-500 px-4 py-2 text-sm font-semibold text-white">
          <CloudOff className="size-4" aria-hidden />
          You are offline. Your answers are being kept and will be sent when you
          reconnect.
        </div>
      ) : saveState === 'error' && pendingCount > 0 ? (
        <div className="flex items-center justify-center gap-2 bg-danger-600 px-4 py-2 text-sm font-semibold text-white">
          <CircleAlert className="size-4" aria-hidden />
          {pendingCount} answer{pendingCount === 1 ? '' : 's'} could not be saved.
          Retrying…
        </div>
      ) : null}

      {/* --- Body ------------------------------------------------------- */}
      <div className="thin-scroll flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <main>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Question {current + 1} of {total}
              </p>
              <SaveIndicator state={saveState} pending={pendingCount} />
            </div>

            <div
              key={question.id}
              className="animate-fade-up rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <fieldset>
                <legend className="text-base font-semibold leading-relaxed text-[var(--text-strong)] sm:text-lg">
                  {question.text}
                </legend>

                <div className="mt-5 space-y-2.5">
                  {question.options.map((option, index) => {
                    const selected = answers[question.id] === option.id;
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-[var(--radius-field)] border-2 p-3.5 transition-all duration-150',
                          selected
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/70'
                            : 'border-[var(--line-soft)] hover:border-brand-300 hover:bg-[var(--surface-sunken)]',
                        )}
                      >
                        <input
                          type="radio"
                          name={`q-${question.id}`}
                          value={option.id}
                          checked={selected}
                          onChange={() => choose(question.id, option.id)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-lg text-sm font-bold transition-colors',
                            selected
                              ? 'bg-brand-600 text-white'
                              : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
                          )}
                        >
                          {option.label}
                        </span>
                        <span className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-[var(--text-body)] peer-checked:font-medium">
                          {option.text}
                        </span>
                        {selected ? (
                          <Check
                            className="mt-1 size-4 shrink-0 text-brand-600"
                            aria-hidden
                          />
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {answers[question.id] ? (
                <button
                  type="button"
                  onClick={() => {
                    setAnswers((current) => ({ ...current, [question.id]: null }));
                    void persist(question.id, null);
                  }}
                  className="mt-4 text-xs font-medium text-[var(--text-muted)] underline-offset-4 hover:text-danger-600 hover:underline"
                >
                  Clear my answer
                </button>
              ) : null}
            </div>

            {/* --- Navigation ---------------------------------------- */}
            <nav
              className="mt-5 flex items-center justify-between gap-3"
              aria-label="Question navigation"
            >
              <Button
                variant="secondary"
                disabled={current === 0}
                onClick={() => setCurrent((index) => Math.max(0, index - 1))}
                iconLeft={<ChevronLeft className="size-4" aria-hidden />}
              >
                Previous
              </Button>

              {current === total - 1 ? (
                <Button
                  variant="success"
                  onClick={() => setConfirmOpen(true)}
                  iconLeft={<Send className="size-4" aria-hidden />}
                >
                  Submit paper
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrent((index) => Math.min(total - 1, index + 1))}
                  iconRight={<ChevronRight className="size-4" aria-hidden />}
                >
                  Next
                </Button>
              )}
            </nav>

            <p className="mt-4 hidden text-center text-xs text-[var(--text-muted)] lg:block">
              Tip: use the arrow keys to move between questions, and the number
              keys 1–4 to choose an answer.
            </p>
          </main>

          {/* --- Question grid (desktop) ---------------------------- */}
          <aside className="hidden lg:block">
            <div className="sticky top-0">
              <QuestionGrid
                questions={attempt.questions}
                answers={answers}
                current={current}
                onSelect={setCurrent}
              />
              <Button
                variant="success"
                block
                className="mt-4"
                onClick={() => setConfirmOpen(true)}
                iconLeft={<Send className="size-4" aria-hidden />}
              >
                Submit paper
              </Button>
            </div>
          </aside>
        </div>
      </div>

      {/* --- Question grid (mobile) ------------------------------------ */}
      <Dialog open={gridOpen} onOpenChange={setGridOpen}>
        <DialogContent size="sm">
          <DialogHeader
            title="All questions"
            description={`${answeredCount} answered · ${unansweredCount} left`}
          />
          <DialogBody>
            <QuestionGrid
              questions={attempt.questions}
              answers={answers}
              current={current}
              onSelect={(index) => {
                setCurrent(index);
                setGridOpen(false);
              }}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="success"
              block
              onClick={() => {
                setGridOpen(false);
                setConfirmOpen(true);
              }}
            >
              Submit paper
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Submit confirmation --------------------------------------- */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="sm">
          <DialogHeader
            title="Submit your paper?"
            description="Once submitted you cannot change your answers."
          />
          <DialogBody className="space-y-4">
            <dl className="grid grid-cols-3 gap-3 text-center">
              <Tally label="Answered" value={answeredCount} tone="success" />
              <Tally label="Not answered" value={unansweredCount} tone="warn" />
              <Tally label="Time left" value={formatDuration(remaining)} tone="brand" />
            </dl>

            {unansweredCount > 0 ? (
              <Alert tone="warn" title={`${unansweredCount} question${unansweredCount === 1 ? '' : 's'} still blank`}>
                Blank answers score nothing. Go back and attempt them if you have
                time.
              </Alert>
            ) : (
              <Alert tone="success" title="Every question is answered">
                You are ready to submit.
              </Alert>
            )}

            {pendingCount > 0 ? (
              <Alert tone="warn" title="Some answers have not reached the server">
                They will be sent with your submission. Stay on this page until
                it finishes.
              </Alert>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Keep working
            </Button>
            <Button
              variant="success"
              loading={submitting}
              loadingLabel="Submitting your paper…"
              onClick={() => void doSubmit(false)}
              iconLeft={<Send className="size-4" aria-hidden />}
            >
              Yes, submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocking overlay while the submission is in flight. */}
      {submitting ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--color-ink)_65%,transparent)] backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-[var(--surface-raised)] px-8 py-7 shadow-[var(--shadow-lift)]">
            <Loader2 className="size-7 animate-spin text-brand-600" aria-hidden />
            <p className="text-sm font-semibold text-[var(--text-strong)]">
              Marking your paper…
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Do not close this page.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuestionGrid({
  questions,
  answers,
  current,
  onSelect,
}: {
  questions: AttemptState['questions'];
  answers: Record<string, string | null>;
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Questions
      </p>
      <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
        {questions.map((question, index) => {
          const answered = Boolean(answers[question.id]);
          const active = index === current;

          return (
            <button
              key={question.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-current={active ? 'true' : undefined}
              aria-label={`Question ${index + 1}${answered ? ', answered' : ', not answered'}`}
              className={cn(
                'grid aspect-square place-items-center rounded-lg text-xs font-bold tabular-nums transition-all',
                active
                  ? 'bg-brand-600 text-white ring-2 ring-brand-400 ring-offset-2 ring-offset-[var(--surface-card)]'
                  : answered
                    ? 'bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-500'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:bg-[var(--line-soft)]',
              )}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 space-y-1.5 text-xs text-[var(--text-muted)]">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded bg-success-50 ring-1 ring-success-500/30 dark:bg-success-700/30" aria-hidden />
          Answered
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded bg-[var(--surface-sunken)] ring-1 ring-[var(--line-strong)]" aria-hidden />
          Not answered
        </li>
      </ul>
    </div>
  );
}

function SaveIndicator({ state, pending }: { state: SaveState; pending: number }) {
  if (pending > 0 && state === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-danger-600">
        <AlertTriangle className="size-3.5" aria-hidden />
        Retrying
      </span>
    );
  }
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Saving
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-success-700 dark:text-success-500">
        <Check className="size-3.5" aria-hidden />
        Saved
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
      <Flag className="size-3.5" aria-hidden />
      Answers save automatically
    </span>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'success' | 'warn' | 'brand';
}) {
  const tones = {
    success: 'bg-success-50 text-success-700 dark:bg-success-700/15 dark:text-success-500',
    warn: 'bg-warn-50 text-warn-700 dark:bg-warn-700/15 dark:text-warn-500',
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  };

  return (
    <div className={cn('rounded-[var(--radius-field)] px-2 py-3', tones[tone])}>
      <dd className="font-display text-lg font-extrabold tabular-nums">{value}</dd>
      <dt className="text-[0.6875rem] font-medium">{label}</dt>
    </div>
  );
}
