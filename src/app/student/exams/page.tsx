import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Repeat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, PageHeader } from '@/components/ui/card';
import { Badge, EmptyState } from '@/components/ui/feedback';
import { guardLearningAccess } from '@/lib/auth/guards';
import { getStudentExams, type StudentExamRow } from '@/lib/data/student';
import { formatDateTime, formatPercent } from '@/lib/utils';

export const metadata: Metadata = { title: 'Examinations' };

export default async function ExamsPage() {
  const user = await guardLearningAccess('/student/exams');
  const exams = await getStudentExams(user);

  const now = Date.now();
  const open = exams.filter((exam) => statusOf(exam, now) === 'open');
  const upcoming = exams.filter((exam) => statusOf(exam, now) === 'upcoming');
  const finished = exams.filter((exam) => {
    const status = statusOf(exam, now);
    return status === 'done' || status === 'closed';
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Examinations"
        description={`Papers set for ${user.student?.className ?? 'your class'}. Read the instructions before you begin — the timer starts as soon as you open the paper.`}
      />

      {exams.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" aria-hidden />}
          title="No examinations yet"
          description="When your teacher publishes an examination for your class, it will appear here."
        />
      ) : null}

      {open.length > 0 ? (
        <Section title="Open now" description="These can be taken immediately.">
          <div className="grid gap-4 sm:grid-cols-2">
            {open.map((exam) => (
              <ExamCard key={exam.id} exam={exam} now={now} />
            ))}
          </div>
        </Section>
      ) : null}

      {upcoming.length > 0 ? (
        <Section title="Coming up" description="Not open yet — note the date.">
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((exam) => (
              <ExamCard key={exam.id} exam={exam} now={now} />
            ))}
          </div>
        </Section>
      ) : null}

      {finished.length > 0 ? (
        <Section title="Completed and closed">
          <div className="grid gap-4 sm:grid-cols-2">
            {finished.map((exam) => (
              <ExamCard key={exam.id} exam={exam} now={now} />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

type ExamState = 'open' | 'upcoming' | 'closed' | 'done';

function statusOf(exam: StudentExamRow, now: number): ExamState {
  if (exam.openAttemptId) return 'open';
  if (exam.availableFrom && exam.availableFrom.getTime() > now) return 'upcoming';
  if (exam.availableTo && exam.availableTo.getTime() < now) return 'closed';
  if (exam.attemptsUsed >= exam.attemptLimit) return 'done';
  return 'open';
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      {description ? (
        <p className="mb-4 mt-0.5 text-sm text-[var(--text-muted)]">{description}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
    </section>
  );
}

function ExamCard({ exam, now }: { exam: StudentExamRow; now: number }) {
  const state = statusOf(exam, now);
  const attemptsLeft = Math.max(0, exam.attemptLimit - exam.attemptsUsed);

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {exam.subjectName}
            </p>
            <h3 className="mt-0.5 text-base font-bold text-[var(--text-strong)]">
              {exam.title}
            </h3>
          </div>
          <StateBadge state={state} resuming={Boolean(exam.openAttemptId)} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <Fact
            icon={<Clock className="size-3.5" aria-hidden />}
            label="Duration"
            value={`${exam.durationMins} min`}
          />
          <Fact
            icon={<FileText className="size-3.5" aria-hidden />}
            label="Questions"
            value={String(exam.totalQuestions)}
          />
          <Fact
            icon={<CheckCircle2 className="size-3.5" aria-hidden />}
            label="Pass mark"
            value={`${exam.passMark}%`}
          />
          <Fact
            icon={<Repeat className="size-3.5" aria-hidden />}
            label="Attempts"
            value={`${exam.attemptsUsed} of ${exam.attemptLimit}`}
          />
        </dl>

        {exam.availableTo ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <CalendarClock className="size-3.5" aria-hidden />
            {state === 'upcoming'
              ? `Opens ${formatDateTime(exam.availableFrom)}`
              : `Closes ${formatDateTime(exam.availableTo)}`}
          </p>
        ) : null}

        {exam.bestPercentage !== null ? (
          <p className="mt-3 text-xs font-semibold text-[var(--text-body)]">
            Best score so far: {formatPercent(exam.bestPercentage)}
          </p>
        ) : null}

        <div className="mt-auto pt-5">
          {state === 'open' ? (
            <Button asChild block>
              <Link href={`/student/exams/${exam.id}`}>
                {exam.openAttemptId ? 'Resume examination' : 'Start examination'}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : state === 'upcoming' ? (
            <Button block variant="secondary" disabled>
              <Lock className="size-4" aria-hidden />
              Not open yet
            </Button>
          ) : exam.lastAttemptId ? (
            <Button asChild block variant="secondary">
              <Link href={`/student/results/${exam.lastAttemptId}`}>
                View my result
              </Link>
            </Button>
          ) : (
            <Button block variant="secondary" disabled>
              <Lock className="size-4" aria-hidden />
              Closed
            </Button>
          )}

          {state === 'open' && attemptsLeft > 0 && !exam.openAttemptId ? (
            <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
              {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} remaining
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function StateBadge({ state, resuming }: { state: ExamState; resuming: boolean }) {
  if (resuming) return <Badge tone="warn" dot>In progress</Badge>;
  switch (state) {
    case 'open':
      return <Badge tone="success" dot>Open</Badge>;
    case 'upcoming':
      return <Badge tone="info">Scheduled</Badge>;
    case 'done':
      return <Badge tone="neutral">Completed</Badge>;
    default:
      return <Badge tone="neutral">Closed</Badge>;
  }
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[var(--text-muted)]">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-bold text-[var(--text-strong)]">{value}</dd>
    </div>
  );
}
